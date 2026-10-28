import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CardData, ArchetypeData, CardVariationItem } from './types';
import { allCards as defaultCards, archetypesList as defaultArchetypes, collectionsList as defaultCollections } from './data';
import { compareCardCodes } from './deckUtils';
import { isUserAdmin } from './authService';
import { db, auth, readBrowserCache, writeBrowserCache } from './firebase';
import { collection, getDocs, doc, setDoc, onSnapshot, deleteDoc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const CARDS_CACHE_KEY = 'ld_cache_cards_v2';
const ARCHETYPES_CACHE_KEY = 'ld_cache_archetypes_v2';
const COLLECTIONS_CACHE_KEY = 'ld_cache_collections_v2';

/**
 * Recursively strips undefined fields from an object so Firestore setDoc / updateDoc does not reject it.
 */
export const sanitizeForFirestore = <T extends Record<string, any>>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => (typeof item === 'object' && item !== null ? sanitizeForFirestore(item) : item)) as any;
  }
  const result: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) {
      continue;
    }
    if (val !== null && typeof val === 'object') {
      result[key] = sanitizeForFirestore(val);
    } else {
      result[key] = val;
    }
  }
  return result;
};

const cleanCodeCache = new Map<string, string>();

/**
 * Remove suffixes like -ALT, -MOD, -alt, -mod, -Alt, -Mod from card codes.
 * Ensures cards/skins retain their authentic printed code.
 */
export const cleanCardCode = (rawCode?: string): string => {
  if (!rawCode) return '';
  const cached = cleanCodeCache.get(rawCode);
  if (cached !== undefined) return cached;
  const cleaned = rawCode.replace(/(?:[-_](?:ALT|MOD|alt|mod|M))$/i, '').trim();
  cleanCodeCache.set(rawCode, cleaned);
  return cleaned;
};

const baseCodeCache = new Map<string, string>();

/**
 * Obtém o código canônico da carta base para agrupamento consistente no catálogo e no álbum:
 * - Se a carta possui parentCode, utiliza o parentCode limpo.
 * - Converte códigos de variação com letras no número da carta para o código base correspondente:
 *   Ex: '2025/0001/B0001' (Jim skin de Booster 2) -> '2025/0001/00001'
 *       '2025/0001/B0232' (Blair skin de Natal) -> '2025/0001/00232'
 *       '2025/0001/0B188' (Hyummeng skin) -> '2025/0001/00188'
 *       '2026/0001/A0301' (Mahina skin A) -> '2026/0001/00301'
 */
export const getBaseCardCode = (rawCode?: string, parentCode?: string): string => {
  const codeToUse = parentCode || rawCode;
  if (!codeToUse) return '';
  const cached = baseCodeCache.get(codeToUse);
  if (cached !== undefined) return cached;

  const clean = cleanCardCode(codeToUse);
  const parts = clean.split('/');
  let result = clean;
  if (parts.length === 3) {
    const year = parts[0];
    const sheet = parts[1];
    const numStr = parts[2];
    const digits = numStr.replace(/[^0-9]/g, '');
    if (digits) {
      const paddedNum = digits.padStart(5, '0');
      const cleanSheetDigits = sheet.replace(/[^0-9]/g, '');
      const paddedSheet = cleanSheetDigits ? cleanSheetDigits.padStart(4, '0') : sheet;
      result = `${year}/${paddedSheet}/${paddedNum}`;
    }
  }
  baseCodeCache.set(codeToUse, result);
  return result;
};

/**
 * Gera chave única para identificar uma versão/variação específica de uma carta (por imagem ou frame).
 */
export const getVersionRareKey = (imageUrl?: string, frame?: string): string => {
  const cleanUrl = (imageUrl || '').trim();
  if (cleanUrl) return cleanUrl;
  return `frame_${frame || 'Legado'}`;
};

/**
 * Mapa pré-computado O(1) de cartas padrão por código base para evitar loops O(N²) e travamentos.
 */
export const defaultCardsByBaseCode = new Map<string, CardData>();
export const defaultCardsGroupByBaseCode = new Map<string, CardData[]>();
defaultCards.forEach(d => {
  const base = getBaseCardCode(d.code, d.parentCode);
  if (base) {
    if (!defaultCardsByBaseCode.has(base)) {
      defaultCardsByBaseCode.set(base, d);
    }
    const list = defaultCardsGroupByBaseCode.get(base) || [];
    list.push(d);
    defaultCardsGroupByBaseCode.set(base, list);
  }
});

/**
 * Recupera o código da carta a partir do ID do documento no Firestore caso o campo `code` tenha sido omitido.
 */
const recoverCodeFromDocId = (docId: string): string => {
  if (!docId) return '';
  const cleanId = docId.replace(/(?:[-_](?:ALT|MOD|alt|mod|M))$/i, '');
  if (/^\d{4}_\d{4}_[A-Za-z0-9]+$/.test(cleanId)) {
    return cleanId.replace(/_/g, '/');
  }
  return '';
};

/**
 * Identifica se a carta pertence ao formato / era Legado
 */
export const isLegacyCard = (c: CardData): boolean => {
  if (!c) return false;
  if (c.frame === 'Moderno') return false;
  if (c.code && c.code.endsWith('-M')) return false;
  if (c.collection === 'Invasão do Caos' || c.collection === 'Booster Invasão do Caos' || c.collection === 'Reforço Macroversal' || c.collection === 'LOUCURAS CAÓTICAS') return false;
  if (c.code && c.code.startsWith('2026')) return false;
  return true;
};

/**
 * Prioridade de exibição: cartas base têm precedência sobre skins/artes alternativas.
 * Cartas de Frame Legado mantêm sua autenticidade de Frame Legado.
 */
export const getCardDisplayPriority = (card: CardData): number => {
  if (!card) return 0;
  const typeLower = (card.variationType || '').toLowerCase();
  const isSkinOrAA = typeLower.includes('skin') || 
                     typeLower.includes('arte alternativa') || 
                     typeLower.includes('aa') || 
                     (card.isVariation && !typeLower.includes('base') && !typeLower.includes('legado') && !typeLower.includes('novo frame') && !typeLower.includes('moderno'));

  // 1º Carta Base (Legado ou Moderna)
  if (!isSkinOrAA) return 2;
  // 2º Variação / Skin / Arte Alternativa
  return 1;
};

/**
 * Retorna a carta preservando seu frame autêntico.
 * Cartas com frame Legado NUNCA são forçadas para frame Moderno.
 */
export const resolveModernFrameOnly = (card: CardData, allCardsList?: CardData[]): CardData => {
  return card;
};

export interface DeleteCardOptions {
  specificId?: string;
  frame?: string;
  imageUrl?: string;
  variationType?: string;
  deleteAllVersions?: boolean;
  isSingleVariantOnly?: boolean;
}

interface CardContextType {
  cards: CardData[];
  archetypes: ArchetypeData[];
  collections: string[];
  loading: boolean;
  isCodeMigrated: boolean;
  saveCard: (card: CardData) => Promise<void>;
  saveArchetype: (archetype: ArchetypeData) => Promise<void>;
  saveCollection: (name: string) => Promise<void>;
  deleteCard: (target: string | CardData, options?: DeleteCardOptions) => Promise<void>;
  deleteCollection?: (name: string) => Promise<void>;
  setCardCatalogCover: (
    cardOrCode: CardData | string,
    coverVariant?: CardData | CardVariationItem | null,
    clearCover?: boolean
  ) => Promise<void>;
  setCardRarePrintSettings: (
    cardOrCode: CardData | string,
    isRare: boolean,
    maxCopies?: number
  ) => Promise<void>;
  cleanAllCardSuffixes: () => Promise<{ updatedCount: number }>;
  migrateCodeDataToFirebase: () => Promise<{
    migratedCards: number;
    migratedVariants: number;
    migratedArchetypes: number;
    migratedCollections: number;
  }>;
}

const CardContext = createContext<CardContextType | undefined>(undefined);

export const CardProvider = ({ children }: { children: ReactNode }) => {
  // Inicializa exclusivamente a partir do Cache do Navegador (memória local sincronizada com o Firebase)
  // NUNCA inicializa com dados fixos antigos para evitar piscar informações desatualizadas
  const [allMergedCards, setAllMergedCards] = useState<CardData[]>(() => {
    return readBrowserCache<CardData[]>(CARDS_CACHE_KEY) || [];
  });
  const [cards, setCards] = useState<CardData[]>(() => {
    const cached = readBrowserCache<CardData[]>(CARDS_CACHE_KEY) || [];
    return cached.filter(c => !c.isHidden);
  });
  const [archetypes, setArchetypes] = useState<ArchetypeData[]>(() => {
    return readBrowserCache<ArchetypeData[]>(ARCHETYPES_CACHE_KEY) || [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const cached = readBrowserCache<CardData[]>(CARDS_CACHE_KEY);
    return !cached || cached.length === 0;
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCodeMigrated, setIsCodeMigrated] = useState<boolean>(false);
  const migrationRunningRef = React.useRef(false);

  const [explicitCollections, setExplicitCollections] = useState<string[]>(() => {
    return readBrowserCache<string[]>(COLLECTIONS_CACHE_KEY) || [];
  });

  // Coleções derivadas exclusivamente do Firebase + Cache do navegador
  const collections = React.useMemo(() => Array.from(new Set([
    ...explicitCollections,
    ...cards.map(c => c.collection).filter(Boolean)
  ])).sort() as string[], [explicitCollections, cards]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setIsAdmin(isUserAdmin(u));
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (isAdmin) {
      setCards(allMergedCards);
    } else {
      setCards(allMergedCards.filter(c => !c.isHidden));
    }
  }, [allMergedCards, isAdmin]);

  /**
   * Migra todas as cartas, variações/skins, arquétipos e coleções do código (data.ts)
   * diretamente para o Firebase Firestore sem sobrescrever nenhuma edição do Admin.
   */
  const migrateCodeDataToFirebase = React.useCallback(async () => {
    if (migrationRunningRef.current) {
      return { migratedCards: 0, migratedVariants: 0, migratedArchetypes: 0, migratedCollections: 0 };
    }
    migrationRunningRef.current = true;
    try {
      const [cardsSnap, archSnap, colSnap] = await Promise.all([
        getDocs(collection(db, 'customCards')),
        getDocs(collection(db, 'customArchetypes')),
        getDocs(collection(db, 'customCollections'))
      ]);

      const docsByBase = new Map<string, any[]>();
      const orphanDocIds: string[] = [];

      cardsSnap.forEach(d => {
        const data = { id: d.id, ...d.data() } as any;
        const isDeleted = data.deleted === true && (data.isExplicitlyDeleted === true || data.name === 'Carta Excluída');
        if (!isDeleted && !data.name && !data.imageUrl && (!data.variants || data.variants.length === 0)) {
          orphanDocIds.push(d.id);
          return;
        }
        const rawCode = data.code || recoverCodeFromDocId(d.id);
        const base = getBaseCardCode(rawCode, data.parentCode);
        if (!base) return;
        if (!docsByBase.has(base)) docsByBase.set(base, []);
        docsByBase.get(base)!.push(data);
      });

      type PendingOp =
        | { type: 'set'; col: string; id: string; data: any; merge?: boolean }
        | { type: 'delete'; col: string; id: string };

      const ops: PendingOp[] = [];
      let migratedCards = 0;
      let migratedVariants = 0;
      let migratedArchetypes = 0;
      let migratedCollections = 0;

      // Remove órfãos vazios sem nome e sem imagem (ex: var_1790098735157_v22f)
      orphanDocIds.forEach(orphanId => {
        ops.push({ type: 'delete', col: 'customCards', id: orphanId });
      });

      // Verifica cada grupo de carta base do código (defaultCards)
      defaultCardsGroupByBaseCode.forEach((defs, baseCode) => {
        const cleanBase = cleanCardCode(baseCode);
        const canonicalId = cleanBase.replace(/[\/\s-]/g, '_');
        const fsDocs = docsByBase.get(baseCode) || [];

        const isDeleted = fsDocs.some(d => d.deleted === true && (d.isExplicitlyDeleted === true || d.name === 'Carta Excluída'));
        if (isDeleted) return;

        const deletedImgs = new Set<string>();
        fsDocs.forEach(d => {
          if (Array.isArray(d.deletedVariantImages)) {
            d.deletedVariantImages.forEach((img: string) => { if (img) deletedImgs.add(img); });
          }
        });

        const baseDef = defs.find(d => cleanCardCode(d.code) === cleanBase) || defs[0];
        const extraDefs = defs.filter(d => d !== baseDef);
        const canonicalDoc = fsDocs.find(d => d.id === canonicalId);

        if (!canonicalDoc) {
          // Cria o documento canônico completo no Firebase
          const baseFrame = baseDef.frame || (isLegacyCard(baseDef) ? 'Legado' : 'Moderno');
          const baseRarity = baseFrame === 'Moderno' && (baseDef.rarity === 'Beta' || !baseDef.rarity)
            ? 'Moderno Comum'
            : ((baseDef.rarity === 'Beta' || !baseDef.rarity) ? 'Legado Comum' : baseDef.rarity);

          const initialVariants: CardVariationItem[] = [];
          extraDefs.forEach((ext, idx) => {
            if (!ext.imageUrl || deletedImgs.has(ext.imageUrl)) return;
            const extFrame = ext.frame || (isLegacyCard(ext) ? 'Legado' : 'Moderno');
            const isSkin = cleanCardCode(ext.code) !== cleanBase || ext.rarity === 'Evento';
            initialVariants.push({
              id: `var_${cleanCardCode(ext.code).replace(/[\/\s-]/g, '_')}_${idx}`,
              code: cleanCardCode(ext.code) || cleanBase,
              name: ext.variationType || (isSkin ? 'Evento / Skin' : (extFrame === 'Moderno' ? 'Novo Frame' : 'Arte Alternativa')),
              imageUrl: ext.imageUrl,
              frame: extFrame,
              collection: ext.collection || baseDef.collection,
              rarity: ext.rarity || baseRarity,
              isRarePrint: Boolean(ext.isRarePrint),
              requiresAdminVerification: Boolean(ext.requiresAdminVerification),
              maxPrintCopies: ext.maxPrintCopies || 0
            });
          });

          const newDocData: CardData = {
            ...baseDef,
            id: canonicalId,
            code: cleanBase,
            frame: baseFrame,
            rarity: baseRarity,
            deleted: false,
            ...(initialVariants.length > 0 ? { variants: initialVariants } : {})
          };

          ops.push({
            type: 'set',
            col: 'customCards',
            id: canonicalId,
            data: sanitizeForFirestore(newDocData),
            merge: true
          });
          migratedCards++;
          migratedVariants += initialVariants.length;
        } else {
          // O documento canônico já existe no Firestore:
          // Verifica se falta alguma variante/skin de defaultCards ou a versão Legado original
          const fsImgs = new Set<string>();
          let hasLegacyInFirestore = false;

          fsDocs.forEach(d => {
            const dFrame = d.frame || (isLegacyCard(d) ? 'Legado' : 'Moderno');
            if (d.imageUrl) {
              fsImgs.add(d.imageUrl);
              if (dFrame === 'Legado') hasLegacyInFirestore = true;
            }
            if (Array.isArray(d.variants)) {
              d.variants.forEach((v: any) => {
                if (v.imageUrl) {
                  fsImgs.add(v.imageUrl);
                  if ((v.frame || 'Legado') === 'Legado') hasLegacyInFirestore = true;
                }
              });
            }
          });

          const existingVariants: CardVariationItem[] = Array.isArray(canonicalDoc.variants)
            ? [...canonicalDoc.variants]
            : [];
          let addedVariant = false;

          defs.forEach((defItem, idx) => {
            if (!defItem.imageUrl || deletedImgs.has(defItem.imageUrl) || fsImgs.has(defItem.imageUrl)) return;
            const defFrame = defItem.frame || (isLegacyCard(defItem) ? 'Legado' : 'Moderno');
            const isSkin = cleanCardCode(defItem.code) !== cleanBase || defItem.rarity === 'Evento' || idx > 0;

            // Se for a versão base Legado e o Firestore já possui uma imagem base Legado atualizada pelo Admin, respeita a do Firestore
            if (!isSkin && defFrame === 'Legado' && hasLegacyInFirestore) {
              return;
            }

            fsImgs.add(defItem.imageUrl);
            existingVariants.push({
              id: `var_${cleanCardCode(defItem.code).replace(/[\/\s-]/g, '_')}_${existingVariants.length}`,
              code: cleanCardCode(defItem.code) || cleanBase,
              name: defItem.variationType || (isSkin ? (defItem.rarity === 'Evento' ? 'Evento / Skin' : 'Skin / Variação') : defFrame),
              imageUrl: defItem.imageUrl,
              frame: defFrame,
              collection: defItem.collection || canonicalDoc.collection || baseDef.collection,
              rarity: defItem.rarity === 'Beta' ? 'Legado Comum' : (defItem.rarity || 'Legado Comum'),
              isRarePrint: Boolean(defItem.isRarePrint),
              requiresAdminVerification: Boolean(defItem.requiresAdminVerification),
              maxPrintCopies: defItem.maxPrintCopies || 0
            });
            addedVariant = true;
            migratedVariants++;
          });

          const missingMetaPatch: Record<string, any> = {};
          if (!canonicalDoc.code) missingMetaPatch.code = cleanBase;
          if (!canonicalDoc.name && baseDef.name) missingMetaPatch.name = baseDef.name;
          if (!canonicalDoc.type && baseDef.type) missingMetaPatch.type = baseDef.type;
          if (!canonicalDoc.collection && baseDef.collection) missingMetaPatch.collection = baseDef.collection;
          if (canonicalDoc.description === undefined && baseDef.description !== undefined) missingMetaPatch.description = baseDef.description;

          if (addedVariant || Object.keys(missingMetaPatch).length > 0) {
            ops.push({
              type: 'set',
              col: 'customCards',
              id: canonicalId,
              data: sanitizeForFirestore({
                ...missingMetaPatch,
                ...(addedVariant ? { variants: existingVariants } : {})
              }),
              merge: true
            });
          }
        }
      });

      // Verifica arquétipos padrão (defaultArchetypes)
      const existingArchIds = new Set<string>();
      archSnap.forEach(d => {
        existingArchIds.add(d.id);
        const data = d.data() as any;
        if (data?.name) existingArchIds.add(data.name);
      });

      defaultArchetypes.forEach(arch => {
        const docId = arch.name.replace(/\//g, '_');
        if (!existingArchIds.has(docId) && !existingArchIds.has(arch.name)) {
          const { icon, ...serializableArch } = arch as any;
          ops.push({
            type: 'set',
            col: 'customArchetypes',
            id: docId,
            data: sanitizeForFirestore(serializableArch),
            merge: true
          });
          migratedArchetypes++;
        }
      });

      // Verifica coleções padrão (defaultCollections)
      const existingColNames = new Set<string>();
      colSnap.forEach(d => {
        existingColNames.add(d.id);
        const data = d.data() as any;
        if (data?.name) existingColNames.add(data.name);
      });

      defaultCollections.forEach(colName => {
        const docId = colName.replace(/\//g, '_');
        if (!existingColNames.has(docId) && !existingColNames.has(colName)) {
          ops.push({
            type: 'set',
            col: 'customCollections',
            id: docId,
            data: { name: colName.trim() },
            merge: true
          });
          migratedCollections++;
        }
      });

      if (ops.length > 0) {
        const CHUNK_SIZE = 400;
        for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
          const chunk = ops.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          chunk.forEach(op => {
            const ref = doc(db, op.col, op.id);
            if (op.type === 'delete') {
              batch.delete(ref);
            } else {
              batch.set(ref, op.data, { merge: Boolean(op.merge) });
            }
          });
          await batch.commit();
        }
      }

      setIsCodeMigrated(true);
      return { migratedCards, migratedVariants, migratedArchetypes, migratedCollections };
    } catch (err) {
      console.error('Erro ao migrar cartas do código para o Firebase:', err);
      return { migratedCards: 0, migratedVariants: 0, migratedArchetypes: 0, migratedCollections: 0 };
    } finally {
      migrationRunningRef.current = false;
    }
  }, []);

  useEffect(() => {
    const unsubCards = onSnapshot(collection(db, 'customCards'), (snapshot) => {
      // 1. Identifica códigos base deletados e imagens de variações deletadas
      const deletedBaseCodes = new Set<string>();
      const deletedVariantImages = new Set<string>();
      const firestoreBaseCodes = new Set<string>();

      snapshot.forEach(docSnap => {
        const d = docSnap.data() as any;
        const rawCode = d.code || recoverCodeFromDocId(docSnap.id);
        const base = getBaseCardCode(rawCode, d.parentCode);
        const isActuallyDeleted = d.deleted === true && (d.isExplicitlyDeleted === true || (d.name === 'Carta Excluída' && !d.imageUrl && !d.archetype && !d.isRarePrint));
        if (isActuallyDeleted && base) {
          deletedBaseCodes.add(base);
        }
        if (Array.isArray(d.deletedVariantImages)) {
          d.deletedVariantImages.forEach((img: string) => {
            if (img) deletedVariantImages.add(img);
          });
        }
      });

      // 2. Agrupa todos os documentos do Firebase por código base canônico
      const groups = new Map<string, CardData[]>();

      snapshot.forEach(docSnap => {
        const rawData = docSnap.data() as CardData;
        const isActuallyDeleted = (rawData as any).deleted === true && ((rawData as any).isExplicitlyDeleted === true || (rawData.name === 'Carta Excluída' && !rawData.imageUrl && !rawData.archetype && !rawData.isRarePrint));
        if (isActuallyDeleted) return;

        // Ignora documentos órfãos vazios sem nome e sem imagem (como var_1790098735157_v22f)
        if (!rawData.name && !rawData.imageUrl && (!rawData.variants || rawData.variants.length === 0)) {
          return;
        }

        const originalCode = rawData.code || recoverCodeFromDocId(docSnap.id);
        const cleanedCode = cleanCardCode(originalCode);
        const base = getBaseCardCode(cleanedCode, rawData.parentCode);
        if (!base || deletedBaseCodes.has(base)) return;
        if (rawData.imageUrl && deletedVariantImages.has(rawData.imageUrl)) return;

        firestoreBaseCodes.add(base);

        let effectiveRarity = rawData.rarity;
        if (rawData.frame === 'Moderno' && (!effectiveRarity || effectiveRarity === 'Beta')) {
          effectiveRarity = 'Comum';
        }

        const card: CardData = {
          ...rawData,
          id: docSnap.id,
          code: cleanedCode || base,
          rarity: effectiveRarity || 'Comum',
          ...(rawData.parentCode ? { parentCode: cleanCardCode(rawData.parentCode) } : {})
        };

        let list = groups.get(base);
        if (!list) {
          list = [];
          groups.set(base, list);
        }
        list.push(card);
      });

      // Verifica se ainda há cartas do código que aguardam o commit do batch de migração no Firestore
      let needsMigration = false;
      defaultCards.forEach(c => {
        const base = getBaseCardCode(c.code, c.parentCode);
        if (!base || deletedBaseCodes.has(base)) return;
        if (c.imageUrl && deletedVariantImages.has(c.imageUrl)) return;
        if (!firestoreBaseCodes.has(base)) {
          needsMigration = true;
          let list = groups.get(base);
          if (!list) {
            list = [];
            groups.set(base, list);
          }
          list.push(c);
        } else {
          // Verifica se alguma skin/variação secundária ainda não foi gravada no grupo do Firestore
          const list = groups.get(base)!;
          const isSkinOrSecondary = cleanCardCode(c.code) !== cleanCardCode(base) || c.rarity === 'Evento';
          if (isSkinOrSecondary && c.imageUrl) {
            const existsInGroup = list.some(item =>
              item.imageUrl === c.imageUrl ||
              (item.variants && item.variants.some(v => v.imageUrl === c.imageUrl))
            );
            if (!existsInGroup) {
              needsMigration = true;
              list.push(c);
            }
          }
        }
      });

      setIsCodeMigrated(!needsMigration);

      // 3. Para cada grupo de código base, consolida em EXATAMENTE 1 carta canônica representativa
      const canonicalCards: CardData[] = [];

      groups.forEach((group, baseCode) => {
        const canonicalDocId = cleanCardCode(baseCode).replace(/[\/\s-]/g, '_');
        const primaryFirestoreDoc = group.find(c => c.id === canonicalDocId);
        const firestoreCard = primaryFirestoreDoc || group.find(c => Boolean(c.id && !c.isVariation)) || group.find(c => Boolean(c.id));

        // Identifica se a carta é originalmente do formato Legado (era 2025) em O(1):
        const defaultMatch = defaultCardsByBaseCode.get(baseCode);
        const isBaseLegacy = defaultMatch ? isLegacyCard(defaultMatch) : group.some(isLegacyCard);

        // Verifica se há capa manual definida pelo Administrador (priorizando o doc canônico)
        const coverDoc = (primaryFirestoreDoc && primaryFirestoreDoc.catalogCoverImageUrl !== undefined)
          ? primaryFirestoreDoc
          : group.find(c => Boolean(c.catalogCoverImageUrl));
        const coverImageUrl = coverDoc?.catalogCoverImageUrl || undefined;
        const coverFrame = coverDoc?.catalogCoverFrame || undefined;

        // Mapa de Tiragem Rara por versão/imagem (NUNCA propaga para todas as versões!)
        const mergedRareByImage: Record<string, { isRarePrint: boolean; maxPrintCopies: number }> = {};
        let hasExplicitRareMap = false;

        group.forEach(c => {
          if (c.rarePrintByImage && typeof c.rarePrintByImage === 'object') {
            hasExplicitRareMap = true;
            Object.entries(c.rarePrintByImage).forEach(([k, val]) => {
              if (val && typeof val === 'object') {
                mergedRareByImage[k] = {
                  isRarePrint: Boolean(val.isRarePrint),
                  maxPrintCopies: val.isRarePrint ? (Number(val.maxPrintCopies) || 1) : 0
                };
              }
            });
          }
        });

        const resolveVersionRareStatus = (
          imgUrl?: string,
          frame?: string,
          itemRare?: boolean,
          itemReqVer?: boolean,
          itemMaxCopies?: number,
          itemRarity?: string
        ) => {
          if (itemRarity === 'Moderno Macroversal' || itemRarity === 'Macroversal') {
            return { isRarePrint: true, requiresAdminVerification: true, maxPrintCopies: 1 };
          }
          const vKey = getVersionRareKey(imgUrl, frame);
          if (mergedRareByImage[vKey] !== undefined) {
            const entry = mergedRareByImage[vKey];
            return {
              isRarePrint: entry.isRarePrint,
              requiresAdminVerification: entry.isRarePrint,
              maxPrintCopies: entry.isRarePrint ? (entry.maxPrintCopies || 1) : 0
            };
          }
          if (imgUrl && mergedRareByImage[imgUrl] !== undefined) {
            const entry = mergedRareByImage[imgUrl];
            return {
              isRarePrint: entry.isRarePrint,
              requiresAdminVerification: entry.isRarePrint,
              maxPrintCopies: entry.isRarePrint ? (entry.maxPrintCopies || 1) : 0
            };
          }
          // Se o documento já usa mapa por imagem, qualquer imagem não listada como true é tiragem comum!
          if (hasExplicitRareMap) {
            return { isRarePrint: false, requiresAdminVerification: false, maxPrintCopies: 0 };
          }
          const explicit = Boolean(itemRare || itemReqVer);
          return {
            isRarePrint: explicit,
            requiresAdminVerification: explicit,
            maxPrintCopies: explicit ? (Number(itemMaxCopies) || 1) : 0
          };
        };

        let chosenCard: CardData | undefined = undefined;

        // PRIORIDADE 1: Se o Admin definiu uma capa específica para o catálogo:
        if (coverImageUrl) {
          const directMatch = group.find(c => c.imageUrl === coverImageUrl && (!coverFrame || (c.frame || 'Legado') === coverFrame))
            || group.find(c => c.imageUrl === coverImageUrl);
          if (directMatch) {
            chosenCard = {
              ...directMatch,
              frame: coverFrame || directMatch.frame || (isBaseLegacy ? 'Legado' : 'Moderno')
            };
          } else {
            for (const c of group) {
              const v = c.variants?.find(v => v.imageUrl === coverImageUrl);
              if (v) {
                chosenCard = {
                  ...c,
                  id: v.id || `var_${v.code || baseCode}`,
                  imageUrl: v.imageUrl,
                  frame: coverFrame || v.frame || (isBaseLegacy ? 'Legado' : 'Moderno'),
                  variationType: v.name || c.variationType || 'Capa do Catálogo',
                  rarity: v.rarity || c.rarity,
                  isVariation: true,
                  isRarePrint: v.isRarePrint,
                  requiresAdminVerification: v.requiresAdminVerification,
                  maxPrintCopies: v.maxPrintCopies
                };
                break;
              }
            }
          }
        }

        // PRIORIDADE 2: Carta base autêntica
        // No catálogo principal, se a carta possui versão moderna (ou variação moderna), a versão moderna é exibida como capa!
        if (!chosenCard) {
          const nonDeletedGroup = group.filter(c => !c.imageUrl || !deletedVariantImages.has(c.imageUrl));
          const withImages = nonDeletedGroup.filter(c => Boolean(c.imageUrl));
          const candidateGroup = withImages.length > 0 ? withImages : (nonDeletedGroup.length > 0 ? nonDeletedGroup : group);

          const modernFirestoreBase = candidateGroup.find(c => 
            Boolean(c.id && !c.isVariation && (
              c.frame === 'Moderno' || 
              (c.frame !== 'Legado' && defaultMatch && c.imageUrl && c.imageUrl !== defaultMatch.imageUrl)
            ))
          );
          const anyModernCard = candidateGroup.find(c => 
            c.frame === 'Moderno' || 
            (c.code && c.code.endsWith('-M')) ||
            (c.collection === 'Invasão do Caos' || c.collection === 'Reforço Macroversal') ||
            (c.variationType && (c.variationType.toLowerCase().includes('moderno') || c.variationType.toLowerCase().includes('novo frame')))
          );

          let modernVariantCard: CardData | undefined = undefined;
          for (const c of candidateGroup) {
            const v = c.variants?.find(v => 
              v.imageUrl && 
              !deletedVariantImages.has(v.imageUrl) && 
              (v.frame === 'Moderno' || v.name?.toLowerCase().includes('moderno') || v.name?.toLowerCase().includes('novo frame'))
            );
            if (v) {
              modernVariantCard = {
                ...c,
                id: v.id || `var_${v.code || baseCode}`,
                imageUrl: v.imageUrl,
                frame: 'Moderno',
                variationType: v.name || 'Novo Frame',
                rarity: v.rarity || c.rarity,
                isRarePrint: v.isRarePrint,
                requiresAdminVerification: v.requiresAdminVerification,
                maxPrintCopies: v.maxPrintCopies
              };
              break;
            }
          }

          const firestoreNewImage = candidateGroup.find(c =>
            Boolean(c.id && c.imageUrl && (!defaultMatch || c.imageUrl !== defaultMatch.imageUrl) && c.frame !== 'Legado')
          );

          const modernMatch = modernFirestoreBase || anyModernCard || modernVariantCard || (firestoreNewImage ? { ...firestoreNewImage, frame: 'Moderno' as const } : undefined);

          if (modernMatch) {
            chosenCard = {
              ...modernMatch,
              frame: 'Moderno'
            };
          } else {
            const legacyFirestore = candidateGroup.find(c => isLegacyCard(c) && !c.isVariation);
            const legacyDefault = defaultMatch && isLegacyCard(defaultMatch) ? defaultMatch : null;
            const legacyAny = candidateGroup.find(isLegacyCard);

            chosenCard = legacyFirestore || legacyDefault || legacyAny || candidateGroup[0];
            chosenCard = {
              ...chosenCard,
              frame: 'Legado'
            };
          }
        }

        // Determina a raridade oficial da carta escolhida
        let finalRarity = chosenCard.rarity || firestoreCard?.rarity || 'Comum';
        if (!firestoreCard?.rarity && defaultMatch && chosenCard.frame === 'Legado') {
          const dRarity = (defaultMatch.rarity || '').toLowerCase();
          if (dRarity === 'beta' || dRarity === 'comum' || !dRarity) {
            finalRarity = 'Comum';
          }
        }

        // Consolida todas as variantes / skins / artes alternativas no array variants
        const allVariants: CardVariationItem[] = [];
        const seenVarImages = new Set<string>();
        if (chosenCard.imageUrl) seenVarImages.add(chosenCard.imageUrl);

        // Garante que a versão Legado autêntica esteja presente em allVariants caso não seja a capa atual
        const legacyCandidate = group.find(c => isLegacyCard(c) && c.imageUrl && !deletedVariantImages.has(c.imageUrl)) || 
          (defaultMatch && defaultMatch.imageUrl && isLegacyCard(defaultMatch) && !deletedVariantImages.has(defaultMatch.imageUrl) ? defaultMatch : null);

        if (legacyCandidate && legacyCandidate.imageUrl && !seenVarImages.has(legacyCandidate.imageUrl)) {
          seenVarImages.add(legacyCandidate.imageUrl);
          const legRare = resolveVersionRareStatus(
            legacyCandidate.imageUrl,
            'Legado',
            legacyCandidate.isRarePrint,
            legacyCandidate.requiresAdminVerification,
            legacyCandidate.maxPrintCopies,
            legacyCandidate.rarity
          );
          allVariants.push({
            id: legacyCandidate.id || `var_${legacyCandidate.code || baseCode}_legado`,
            code: cleanCardCode(legacyCandidate.code) || cleanCardCode(baseCode),
            name: 'Legado',
            imageUrl: legacyCandidate.imageUrl,
            frame: 'Legado',
            collection: legacyCandidate.collection,
            rarity: legacyCandidate.rarity || 'Legado Comum',
            tier: legacyCandidate.tier,
            isCatalogCover: Boolean(coverImageUrl && legacyCandidate.imageUrl === coverImageUrl),
            isRarePrint: legRare.isRarePrint,
            requiresAdminVerification: legRare.requiresAdminVerification,
            maxPrintCopies: legRare.maxPrintCopies
          });
        }

        const chosenEffectiveFrame = coverImageUrl
          ? (coverFrame || chosenCard.frame || (isBaseLegacy ? 'Legado' : 'Moderno'))
          : (chosenCard.frame || (isBaseLegacy ? 'Legado' : 'Moderno'));

        let hasBaseLegacySlot = chosenEffectiveFrame === 'Legado' || allVariants.some(v => v.frame === 'Legado');
        let hasBaseModernSlot = chosenEffectiveFrame === 'Moderno' || allVariants.some(v => v.frame === 'Moderno');

        group.forEach(item => {
          if (item.variants && item.variants.length > 0) {
            item.variants.forEach(v => {
              if (!v.imageUrl || seenVarImages.has(v.imageUrl) || deletedVariantImages.has(v.imageUrl)) return;
              seenVarImages.add(v.imageUrl);
              const vFrame = v.frame || (v.name?.toLowerCase().includes('moderno') ? 'Moderno' : (isBaseLegacy ? 'Moderno' : 'Legado'));
              const vRarity = vFrame === 'Moderno' && v.rarity === 'Beta' ? 'Comum' : (v.rarity || 'Comum');
              const vRare = resolveVersionRareStatus(
                v.imageUrl,
                vFrame,
                v.isRarePrint,
                v.requiresAdminVerification,
                v.maxPrintCopies,
                vRarity
              );
              let vName = v.name;
              if (!vName) {
                if (vFrame === 'Moderno') {
                  vName = hasBaseModernSlot ? 'Arte Alternativa' : 'Novo Frame';
                  hasBaseModernSlot = true;
                } else {
                  vName = hasBaseLegacySlot ? 'Arte Alternativa' : 'Legado';
                  hasBaseLegacySlot = true;
                }
              } else {
                if (vFrame === 'Moderno') hasBaseModernSlot = true;
                if (vFrame === 'Legado') hasBaseLegacySlot = true;
              }
              allVariants.push({
                id: v.id || `var_${v.code || baseCode}_${allVariants.length}`,
                code: cleanCardCode(v.code) || cleanCardCode(baseCode),
                name: vName,
                imageUrl: v.imageUrl,
                frame: vFrame,
                collection: v.collection || item.collection,
                rarity: vRarity,
                tier: v.tier,
                isCatalogCover: Boolean(coverImageUrl && v.imageUrl === coverImageUrl),
                isRarePrint: vRare.isRarePrint,
                requiresAdminVerification: vRare.requiresAdminVerification,
                maxPrintCopies: vRare.maxPrintCopies
              });
            });
          }

          if (item.imageUrl && !seenVarImages.has(item.imageUrl) && !deletedVariantImages.has(item.imageUrl)) {
            seenVarImages.add(item.imageUrl);
            const itemFrame = item.frame || (isLegacyCard(item) ? 'Legado' : 'Moderno');
            const itemRarity = itemFrame === 'Moderno' && item.rarity === 'Beta' ? 'Comum' : (item.rarity || 'Comum');
            const itemRare = resolveVersionRareStatus(
              item.imageUrl,
              itemFrame,
              item.isRarePrint,
              item.requiresAdminVerification,
              item.maxPrintCopies,
              itemRarity
            );
            const cleanedItemCode = cleanCardCode(item.code) || cleanCardCode(baseCode);
            const isSkinCode = cleanedItemCode !== cleanCardCode(baseCode);
            let itemName = item.variationType;
            if (!itemName) {
              if (isSkinCode || item.rarity === 'Evento') {
                itemName = item.rarity === 'Evento' ? 'Evento / Skin' : 'Skin / Variação';
              } else if (itemFrame === 'Moderno') {
                itemName = hasBaseModernSlot ? 'Arte Alternativa' : 'Novo Frame';
                hasBaseModernSlot = true;
              } else {
                itemName = hasBaseLegacySlot ? 'Arte Alternativa' : 'Legado';
                hasBaseLegacySlot = true;
              }
            } else {
              if (itemFrame === 'Moderno') hasBaseModernSlot = true;
              if (itemFrame === 'Legado') hasBaseLegacySlot = true;
            }
            allVariants.push({
              id: item.id || `var_${item.code || baseCode}_${allVariants.length}`,
              code: cleanedItemCode,
              name: itemName,
              imageUrl: item.imageUrl,
              frame: itemFrame,
              collection: item.collection,
              rarity: itemRarity,
              tier: item.tier,
              isCatalogCover: Boolean(coverImageUrl && item.imageUrl === coverImageUrl),
              isRarePrint: itemRare.isRarePrint,
              requiresAdminVerification: itemRare.requiresAdminVerification,
              maxPrintCopies: itemRare.maxPrintCopies
            });
          }
        });

        const effectiveFrame = coverImageUrl
          ? (coverFrame || chosenCard.frame || (isBaseLegacy ? 'Legado' : 'Moderno'))
          : (chosenCard.frame || (isBaseLegacy ? 'Legado' : 'Moderno'));

        const chosenRare = resolveVersionRareStatus(
          chosenCard.imageUrl,
          effectiveFrame,
          chosenCard.isRarePrint,
          chosenCard.requiresAdminVerification,
          chosenCard.maxPrintCopies,
          finalRarity
        );

        const STALE_VEU_ARCHETYPES: Record<string, string> = {
          '2026/0001/00306': 'Véu / Furtivo / Insano / Sortudo',
          '2026/0001/00307': 'Cósmico / Véu',
          '2026/0001/00309': 'Véu / Cósmico / Furtivo',
          '2026/0001/00310': 'Véu / Divindade',
          '2026/0001/00311': 'Furtivo / Insano / Cósmico',
          '2026/0001/00312': 'Véu / Cósmico',
        };
        const resolvedArchetype = (
          firestoreCard?.archetype !== undefined &&
          !(defaultMatch && STALE_VEU_ARCHETYPES[baseCode] && firestoreCard.archetype === STALE_VEU_ARCHETYPES[baseCode])
        )
          ? firestoreCard.archetype
          : (defaultMatch?.archetype || chosenCard.archetype);

        const customProps = firestoreCard ? {
          id: firestoreCard.id,
          name: firestoreCard.name || chosenCard.name,
          archetype: resolvedArchetype,
          type: firestoreCard.type || chosenCard.type,
          collection: firestoreCard.collection || chosenCard.collection,
          description: firestoreCard.description !== undefined ? firestoreCard.description : chosenCard.description,
          ct: firestoreCard.ct !== undefined ? firestoreCard.ct : chosenCard.ct,
          attack: firestoreCard.attack !== undefined ? firestoreCard.attack : chosenCard.attack,
          defense: firestoreCard.defense !== undefined ? firestoreCard.defense : chosenCard.defense,
          lore: firestoreCard.lore !== undefined ? firestoreCard.lore : chosenCard.lore,
          isHidden: firestoreCard.isHidden !== undefined ? firestoreCard.isHidden : chosenCard.isHidden,
          frame: effectiveFrame
        } : {
          frame: effectiveFrame
        };

        canonicalCards.push({
          ...chosenCard,
          ...customProps,
          code: cleanCardCode(baseCode) || cleanCardCode(chosenCard.code),
          rarity: finalRarity,
          catalogCoverImageUrl: coverImageUrl || undefined,
          catalogCoverFrame: coverFrame || undefined,
          isCatalogCover: Boolean(coverImageUrl && chosenCard.imageUrl === coverImageUrl),
          isRarePrint: chosenRare.isRarePrint,
          requiresAdminVerification: chosenRare.requiresAdminVerification,
          maxPrintCopies: chosenRare.maxPrintCopies,
          rarePrintByImage: hasExplicitRareMap ? mergedRareByImage : undefined,
          variants: allVariants.length > 0 ? allVariants : undefined
        });
      });

      canonicalCards.sort((a, b) => compareCardCodes(a.code, b.code));
      setAllMergedCards(canonicalCards);
      writeBrowserCache(CARDS_CACHE_KEY, canonicalCards);
      setLoading(false);
    }, (err: any) => {
      if (err.code !== 'unavailable') console.error(err);
      setLoading(false);
    });

    const unsubArchetypes = onSnapshot(collection(db, 'customArchetypes'), (snapshot) => {
      const customArchMap = new Map<string, ArchetypeData>();
      snapshot.forEach(docSnap => {
        customArchMap.set(docSnap.id, docSnap.data() as ArchetypeData);
      });

      const mergedArch = [...defaultArchetypes];
      customArchMap.forEach((v, k) => {
        const index = mergedArch.findIndex(a => a.name === k);
        if (index >= 0) {
          mergedArch[index] = v;
        } else {
          mergedArch.push(v);
        }
      });
      setArchetypes(mergedArch);
      writeBrowserCache(ARCHETYPES_CACHE_KEY, mergedArch);
    }, (err: any) => {
      if (err.code !== 'unavailable') console.error(err);
    });

    const unsubCollections = onSnapshot(collection(db, 'customCollections'), (snapshot) => {
      const dbCollections: string[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.name) dbCollections.push(data.name);
      });
      const finalCols = Array.from(new Set([...defaultCollections, ...dbCollections]));
      setExplicitCollections(finalCols);
      writeBrowserCache(COLLECTIONS_CACHE_KEY, finalCols);
    }, (err: any) => {
      if (err.code !== 'unavailable') console.error(err);
    });

    return () => {
      unsubCards();
      unsubArchetypes();
      unsubCollections();
    };
  }, []);

  // Executa automaticamente a migração das cartas/arquétipos/coleções do código para o Firebase quando o Admin está autenticado
  useEffect(() => {
    if (isAdmin && !isCodeMigrated && !loading) {
      migrateCodeDataToFirebase();
    }
  }, [isAdmin, isCodeMigrated, loading, migrateCodeDataToFirebase]);

  const saveCard = async (card: CardData) => {
    if (!card.code) return;
    const cleanCode = cleanCardCode(card.code);
    const baseCode = getBaseCardCode(cleanCode, card.parentCode);
    const cleanDocId = cleanCardCode(baseCode).replace(/[\/\s-]/g, '_');

    let effectiveRarity = card.rarity || (card.frame === 'Moderno' ? 'Moderno Comum' : 'Legado Comum');
    if (card.frame === 'Moderno' && (effectiveRarity === 'Beta' || effectiveRarity === 'Comum')) {
      effectiveRarity = 'Moderno Comum';
    } else if ((card.frame || 'Legado') === 'Legado' && (effectiveRarity === 'Beta' || effectiveRarity === 'Comum')) {
      effectiveRarity = 'Legado Comum';
    }

    const isMacroversal = effectiveRarity === 'Moderno Macroversal' || effectiveRarity === 'Macroversal';

    const cleanedVariants = card.variants && card.variants.length > 0
      ? card.variants.map(v => ({
          ...v,
          code: cleanCardCode(v.code),
          rarity: v.frame === 'Moderno' && (v.rarity === 'Beta' || v.rarity === 'Comum') ? 'Moderno Comum' : (v.rarity || 'Moderno Comum')
        }))
      : undefined;

    const cleanedCard: CardData = {
      ...card,
      code: cleanCode,
      rarity: effectiveRarity,
      deleted: false,
      ...(isMacroversal ? { isRarePrint: true, maxPrintCopies: 1, requiresAdminVerification: true } : {}),
      ...(card.parentCode ? { parentCode: cleanCardCode(card.parentCode) } : {}),
      ...(cleanedVariants ? { variants: cleanedVariants } : {})
    };

    const docId = card.id && card.id !== cleanDocId && card.isVariation
      ? card.id.replace(/\//g, '_')
      : cleanDocId;

    await setDoc(doc(db, 'customCards', docId), sanitizeForFirestore({ ...cleanedCard, id: docId, deleted: false }), { merge: true });

    // Always synchronize core metadata (INCLUDING code!) to the canonical base card document in Firestore
    if (docId !== cleanDocId) {
      await setDoc(doc(db, 'customCards', cleanDocId), sanitizeForFirestore({
        code: cleanCardCode(baseCode),
        name: cleanedCard.name,
        archetype: cleanedCard.archetype !== undefined ? cleanedCard.archetype : '',
        type: cleanedCard.type,
        collection: cleanedCard.collection,
        description: cleanedCard.description,
        ct: cleanedCard.ct,
        attack: cleanedCard.attack,
        defense: cleanedCard.defense,
        lore: cleanedCard.lore,
        deleted: false
      }), { merge: true });
    }

    // If saving a variation that has a parentCode, also keep parent's variants array up-to-date
    if (cleanedCard.isVariation && cleanedCard.parentCode) {
      try {
        const parentCleanCode = cleanCardCode(cleanedCard.parentCode);
        const parentDocId = parentCleanCode.replace(/[\/\s-]/g, '_');
        const parentRef = doc(db, 'customCards', parentDocId);
        const parentSnap = await getDoc(parentRef);
        if (parentSnap.exists()) {
          const parentData = parentSnap.data() as CardData;
          const variants = [...(parentData.variants || [])];
          
          const vIdx = variants.findIndex(v => 
            (v.id && (v.id === docId || v.id === card.id)) ||
            (v.imageUrl && (v.imageUrl === cleanedCard.imageUrl || (card.imageUrl && v.imageUrl === card.imageUrl))) ||
            (v.name && cleanedCard.variationType && v.name.toLowerCase() === cleanedCard.variationType.toLowerCase())
          );

          const updatedItem: CardVariationItem = {
            id: docId,
            code: cleanedCard.code,
            frame: cleanedCard.frame || 'Moderno',
            name: cleanedCard.variationType || 'Variação',
            rarity: cleanedCard.rarity || 'Comum',
            imageUrl: cleanedCard.imageUrl || '',
            isRarePrint: Boolean(cleanedCard.isRarePrint),
            requiresAdminVerification: Boolean(cleanedCard.requiresAdminVerification ?? cleanedCard.isRarePrint),
            maxPrintCopies: cleanedCard.isRarePrint ? (cleanedCard.maxPrintCopies || 1) : 0
          };

          if (vIdx >= 0) {
            variants[vIdx] = {
              ...variants[vIdx],
              ...updatedItem
            };
          } else {
            variants.push(updatedItem);
          }

          await updateDoc(parentRef, { variants: sanitizeForFirestore(variants) });
        }
      } catch (err) {
        console.warn('Could not sync parent variant:', err);
      }
    }
  };

  const cleanAllCardSuffixes = async (): Promise<{ updatedCount: number }> => {
    try {
      const snap = await getDocs(collection(db, 'customCards'));
      let updatedCount = 0;
      for (const docSnap of snap.docs) {
        const data = docSnap.data() as CardData;
        const origCode = data.code || '';
        const cleaned = cleanCardCode(origCode);
        const hasIdSuffix = /-(?:ALT|MOD|alt|mod)$/i.test(docSnap.id);
        const hasCodeSuffix = origCode !== cleaned;

        if (hasIdSuffix || hasCodeSuffix) {
          const cleanDocId = cleanCardCode(docSnap.id).replace(/\//g, '_');
          const cleanedCard: CardData = {
            ...data,
            id: cleanDocId,
            code: cleaned,
            ...(data.parentCode ? { parentCode: cleanCardCode(data.parentCode) } : {}),
            ...(data.variants && data.variants.length > 0
              ? { variants: data.variants.map(v => ({ ...v, code: cleanCardCode(v.code) })) }
              : {})
          };
          await setDoc(doc(db, 'customCards', cleanDocId), sanitizeForFirestore(cleanedCard));
          if (cleanDocId !== docSnap.id) {
            await deleteDoc(doc(db, 'customCards', docSnap.id));
          }
          updatedCount++;
        }
      }
      return { updatedCount };
    } catch (e) {
      console.error('Erro ao limpar sufixos:', e);
      throw e;
    }
  };

  const saveArchetype = async (archetype: ArchetypeData) => {
    if (!archetype.name) return;
    await setDoc(doc(db, 'customArchetypes', archetype.name.replace(/\//g, '_')), archetype);
  };

  const saveCollection = async (name: string) => {
    if (!name.trim()) return;
    await setDoc(doc(db, 'customCollections', name.replace(/\//g, '_')), { name: name.trim() });
  };

  const deleteCollection = async (name: string) => {
    if (!name.trim()) return;
    await deleteDoc(doc(db, 'customCollections', name.replace(/\//g, '_')));
  };

  const setCardCatalogCover = async (
    cardOrCode: CardData | string,
    coverVariant?: CardData | CardVariationItem | null,
    clearCover: boolean = false
  ) => {
    try {
      const rawCode = typeof cardOrCode === 'string' ? cardOrCode : (cardOrCode.parentCode || cardOrCode.code);
      const baseCode = getBaseCardCode(rawCode);
      const cleanBase = cleanCardCode(baseCode);
      const cleanDocId = cleanBase.replace(/[\/\s-]/g, '_');

      const baseRef = doc(db, 'customCards', cleanDocId);
      const snap = await getDoc(baseRef);
      const defaultMatch = defaultCardsByBaseCode.get(baseCode);

      if (clearCover || !coverVariant || !coverVariant.imageUrl) {
        if (snap.exists()) {
          const existingData = snap.data() as CardData;
          const updatedVariants = Array.isArray(existingData.variants)
            ? existingData.variants.map(v => ({ ...v, isCatalogCover: false }))
            : undefined;
          await setDoc(baseRef, sanitizeForFirestore({
            code: existingData.code || cleanBase,
            catalogCoverImageUrl: null,
            catalogCoverFrame: null,
            catalogCoverVariationId: null,
            isCatalogCover: false,
            ...(updatedVariants ? { variants: updatedVariants } : {})
          }), { merge: true });
        }
      } else {
        const targetImg = coverVariant.imageUrl;
        const targetFrame = coverVariant.frame || 'Moderno';
        const coverData: Record<string, any> = {
          code: cleanBase,
          catalogCoverImageUrl: targetImg,
          catalogCoverFrame: targetFrame,
          catalogCoverVariationId: coverVariant.id || '',
          deleted: false
        };

        if (snap.exists()) {
          const existingData = snap.data() as CardData;
          if (Array.isArray(existingData.variants)) {
            coverData.variants = existingData.variants.map(v => ({
              ...v,
              isCatalogCover: Boolean(v.imageUrl && v.imageUrl === targetImg)
            }));
          }
          await setDoc(baseRef, sanitizeForFirestore(coverData), { merge: true });
        } else {
          const fullData: any = typeof cardOrCode === 'object' ? { ...(defaultMatch || {}), ...cardOrCode } : (defaultMatch || {});
          const cleanedVariants = Array.isArray(fullData.variants)
            ? fullData.variants.map((v: any) => ({
                ...v,
                isCatalogCover: Boolean(v.imageUrl && v.imageUrl === targetImg)
              }))
            : undefined;
          await setDoc(baseRef, sanitizeForFirestore({
            ...fullData,
            id: cleanDocId,
            code: cleanBase,
            name: fullData.name || (typeof cardOrCode === 'object' ? cardOrCode.name : 'Carta'),
            ...coverData,
            ...(cleanedVariants ? { variants: cleanedVariants } : {})
          }), { merge: true });
        }
      }
    } catch (err: any) {
      console.error('Erro ao definir capa do catálogo:', err);
      alert('Erro ao definir capa do catálogo: ' + err.message);
    }
  };

  const setCardRarePrintSettings = async (
    cardOrCode: CardData | string,
    isRare: boolean,
    maxCopies: number = 1
  ) => {
    try {
      const rawCode = typeof cardOrCode === 'string' ? cardOrCode : (cardOrCode.parentCode || cardOrCode.code);
      const baseCode = getBaseCardCode(rawCode);
      const cleanBase = cleanCardCode(baseCode);
      const cleanDocId = cleanBase.replace(/[\/\s-]/g, '_');

      const targetImageUrl = typeof cardOrCode === 'object' ? (cardOrCode.imageUrl || '').trim() : '';
      const targetFrame = typeof cardOrCode === 'object' ? (cardOrCode.frame || 'Moderno') : 'Moderno';
      const versionKey = getVersionRareKey(targetImageUrl, targetFrame);
      const effectiveCopies = isRare ? (Number(maxCopies) || 1) : 0;

      const baseRef = doc(db, 'customCards', cleanDocId);
      const snap = await getDoc(baseRef);
      const defaultMatch = defaultCardsByBaseCode.get(baseCode);

      if (snap.exists()) {
        const existingData = snap.data() as CardData;
        const existingMap: Record<string, { isRarePrint: boolean; maxPrintCopies: number }> = {
          ...(existingData.rarePrintByImage || {})
        };

        existingMap[versionKey] = {
          isRarePrint: Boolean(isRare),
          maxPrintCopies: effectiveCopies
        };
        if (targetImageUrl && versionKey !== targetImageUrl) {
          existingMap[targetImageUrl] = {
            isRarePrint: Boolean(isRare),
            maxPrintCopies: effectiveCopies
          };
        }

        // Atualiza apenas a variação correspondente em variants[] e limpa flags acidentais nas demais
        const updatedVariants = Array.isArray(existingData.variants)
          ? existingData.variants.map(v => {
              const vKey = getVersionRareKey(v.imageUrl, v.frame);
              const isTargetVar = targetImageUrl ? v.imageUrl === targetImageUrl : vKey === versionKey;
              if (isTargetVar) {
                return {
                  ...v,
                  isRarePrint: Boolean(isRare),
                  requiresAdminVerification: Boolean(isRare),
                  maxPrintCopies: effectiveCopies
                };
              }
              const mapped = existingMap[vKey] || (v.imageUrl ? existingMap[v.imageUrl] : undefined);
              const varRare = mapped ? Boolean(mapped.isRarePrint) : false;
              return {
                ...v,
                isRarePrint: varRare,
                requiresAdminVerification: varRare,
                maxPrintCopies: varRare ? (mapped?.maxPrintCopies || 1) : 0
              };
            })
          : undefined;

        const baseOwnKey = getVersionRareKey(existingData.imageUrl, existingData.frame);
        const isBaseTarget = !targetImageUrl || existingData.imageUrl === targetImageUrl || baseOwnKey === versionKey;
        const baseMapped = existingMap[baseOwnKey] || (existingData.imageUrl ? existingMap[existingData.imageUrl] : undefined);
        const baseIsRare = isBaseTarget ? Boolean(isRare) : Boolean(baseMapped?.isRarePrint);
        const baseMaxCopies = baseIsRare ? (isBaseTarget ? effectiveCopies : (baseMapped?.maxPrintCopies || 1)) : 0;

        await setDoc(baseRef, sanitizeForFirestore({
          code: existingData.code || cleanBase,
          rarePrintByImage: existingMap,
          isRarePrint: baseIsRare,
          requiresAdminVerification: baseIsRare,
          maxPrintCopies: baseMaxCopies,
          deleted: false,
          ...(updatedVariants ? { variants: updatedVariants } : {})
        }), { merge: true });
      } else {
        const fullData: any = typeof cardOrCode === 'object' ? { ...(defaultMatch || {}), ...cardOrCode } : (defaultMatch || {});
        const newMap: Record<string, { isRarePrint: boolean; maxPrintCopies: number }> = {
          [versionKey]: {
            isRarePrint: Boolean(isRare),
            maxPrintCopies: effectiveCopies
          }
        };
        if (targetImageUrl && versionKey !== targetImageUrl) {
          newMap[targetImageUrl] = {
            isRarePrint: Boolean(isRare),
            maxPrintCopies: effectiveCopies
          };
        }

        const updatedVariants = Array.isArray(fullData.variants)
          ? fullData.variants.map((v: any) => {
              const isTargetVar = targetImageUrl ? v.imageUrl === targetImageUrl : false;
              return {
                ...v,
                isRarePrint: isTargetVar ? Boolean(isRare) : false,
                requiresAdminVerification: isTargetVar ? Boolean(isRare) : false,
                maxPrintCopies: isTargetVar ? effectiveCopies : 0
              };
            })
          : undefined;

        const isBaseTarget = !targetImageUrl || fullData.imageUrl === targetImageUrl;

        await setDoc(baseRef, sanitizeForFirestore({
          ...fullData,
          id: cleanDocId,
          code: cleanBase,
          name: fullData.name || (typeof cardOrCode === 'object' ? cardOrCode.name : 'Carta'),
          rarePrintByImage: newMap,
          isRarePrint: isBaseTarget ? Boolean(isRare) : false,
          requiresAdminVerification: isBaseTarget ? Boolean(isRare) : false,
          maxPrintCopies: isBaseTarget ? effectiveCopies : 0,
          deleted: false,
          ...(updatedVariants ? { variants: updatedVariants } : {})
        }), { merge: true });
      }

      // Se for uma variação com documento separado real no Firestore (não sintético 'var_...'), atualiza-o também
      if (typeof cardOrCode === 'object' && cardOrCode.id && cardOrCode.id !== cleanDocId && !cardOrCode.id.startsWith('var_')) {
        try {
          const varDocRef = doc(db, 'customCards', cardOrCode.id);
          const varSnap = await getDoc(varDocRef);
          if (varSnap.exists()) {
            await updateDoc(varDocRef, {
              isRarePrint: Boolean(isRare),
              requiresAdminVerification: Boolean(isRare),
              maxPrintCopies: effectiveCopies
            });
          }
        } catch (e) {
          console.warn('Could not update specific variation doc for rare print:', e);
        }
      }
    } catch (err: any) {
      console.error('Erro ao definir tiragem rara:', err);
      alert('Erro ao configurar tiragem rara: ' + err.message);
    }
  };

  const deleteCard = async (target: string | CardData, options?: DeleteCardOptions) => {
    if (!target) return;
    try {
      const cardObj: CardData | null = typeof target === 'object' && target !== null ? target : null;
      const rawCode = typeof target === 'string' ? target : (cardObj?.code || '');
      const baseCode = getBaseCardCode(rawCode || cardObj?.parentCode || '');
      const cleanCode = cleanCardCode(baseCode);
      const cleanDocId = cleanCode.replace(/[\/\s-]/g, '_');
      const specificId = options?.specificId || cardObj?.id;
      const targetFrame = options?.frame || cardObj?.frame;
      const targetImageUrl = options?.imageUrl || cardObj?.imageUrl;
      const targetVarType = options?.variationType || cardObj?.variationType;
      const deleteAll = Boolean(options?.deleteAllVersions);
      const isSingleVariant = !deleteAll && Boolean(
        options?.isSingleVariantOnly ||
        cardObj?.isVariation ||
        (specificId && specificId !== cleanDocId) ||
        (targetImageUrl && cardObj?.variants && cardObj.variants.length > 0)
      );
      const isDefault = defaultCards.some(d => getBaseCardCode(d.code, d.parentCode) === cleanCode);

      console.log('deleteCard executing:', { rawCode, cleanCode, cleanDocId, specificId, targetFrame, isSingleVariant, deleteAll });

      // Busca todos os documentos relacionados no Firestore
      const snap = await getDocs(collection(db, 'customCards'));
      const relatedDocs = snap.docs.filter(docSnap => {
        const d = docSnap.data();
        const dCode = cleanCardCode(d.code);
        const dParentCode = cleanCardCode(d.parentCode);
        const dBase = getBaseCardCode(dCode, dParentCode);
        return (
          docSnap.id === cleanDocId ||
          docSnap.id === specificId ||
          docSnap.id.startsWith(cleanDocId + '-') ||
          docSnap.id.startsWith(cleanDocId + '_') ||
          dBase === cleanCode ||
          dCode === cleanCode ||
          dParentCode === cleanCode
        );
      });

      if (deleteAll) {
        // Apaga TODOS os documentos relacionados à carta
        for (const docSnap of relatedDocs) {
          await deleteDoc(docSnap.ref);
        }
        if (isDefault) {
          // Se for carta default do jogo em data.ts, marca como deletada para ocultar do catálogo e álbum
          await setDoc(doc(db, 'customCards', cleanDocId), { 
            code: cleanCode, 
            deleted: true, 
            isExplicitlyDeleted: true,
            name: cardObj?.name || 'Carta Excluída' 
          });
        }
        // Remove referências a esta carta dos arrays variants de outros documentos
        for (const docSnap of snap.docs) {
          const d = docSnap.data();
          if (d.variants && Array.isArray(d.variants)) {
            const initialLen = d.variants.length;
            const filtered = d.variants.filter((v: any) => cleanCardCode(v.code) !== cleanCode && v.id !== specificId);
            if (filtered.length !== initialLen) {
              await updateDoc(docSnap.ref, { variants: sanitizeForFirestore(filtered) });
            }
          }
        }
      } else if (isSingleVariant) {
        // APAGA APENAS A VARIAÇÃO / SKIN / FRAME ESPECÍFICO (NUNCA MARCA DELETED NO BASE!)
        console.log('Apagando apenas variante específica:', { specificId, targetImageUrl, targetFrame, targetVarType });

        // 1. Se houver doc específico com ID diferente do documento base, apaga-o
        if (specificId && specificId !== cleanDocId) {
          await deleteDoc(doc(db, 'customCards', specificId)).catch(() => {});
        }

        // 2. Apaga documentos filhos/separados de variação (-MOD, _var_...) que combinem com a imagem ou ID
        for (const docSnap of relatedDocs) {
          if (docSnap.id === cleanDocId) continue; // NUNCA apaga o documento base aqui!
          const d = docSnap.data();
          const matchesId = specificId && docSnap.id === specificId;
          const matchesImage = Boolean(targetImageUrl && d.imageUrl === targetImageUrl);
          if (matchesId || matchesImage) {
            await deleteDoc(docSnap.ref);
          }
        }

        // 3. Atualiza o documento base no Firestore:
        // - Adiciona targetImageUrl a deletedVariantImages para não ressuscitar de data.ts
        // - Remove a variação do array variants
        // - Se era a capa do catálogo, remove a capa
        const baseDocRef = doc(db, 'customCards', cleanDocId);
        const baseSnap = await getDoc(baseDocRef);
        let existingDeletedImgs: string[] = [];
        let existingVariants: any[] = [];
        let currentCoverImg: string | null = null;

        if (baseSnap.exists()) {
          const bData = baseSnap.data() as any;
          existingDeletedImgs = Array.isArray(bData.deletedVariantImages) ? [...bData.deletedVariantImages] : [];
          existingVariants = Array.isArray(bData.variants) ? [...bData.variants] : [];
          currentCoverImg = bData.catalogCoverImageUrl || null;
        }

        if (targetImageUrl && !existingDeletedImgs.includes(targetImageUrl)) {
          existingDeletedImgs.push(targetImageUrl);
        }

        const filteredVariants = existingVariants.filter((v: any) => {
          if (specificId && v.id === specificId) return false;
          if (targetImageUrl && v.imageUrl === targetImageUrl) return false;
          return true;
        });

        const updatePayload: any = {
          deletedVariantImages: existingDeletedImgs,
          variants: sanitizeForFirestore(filteredVariants)
        };

        if (baseSnap.exists()) {
          const bData = baseSnap.data() as any;
          if (bData.imageUrl && targetImageUrl && bData.imageUrl === targetImageUrl) {
            if (filteredVariants.length > 0) {
              updatePayload.imageUrl = filteredVariants[0].imageUrl;
              updatePayload.frame = filteredVariants[0].frame || 'Moderno';
            }
          }
        }

        if (currentCoverImg && targetImageUrl && currentCoverImg === targetImageUrl) {
          updatePayload.catalogCoverImageUrl = null;
          updatePayload.catalogCoverFrame = null;
          updatePayload.catalogCoverVariationId = null;
        }

        await setDoc(baseDocRef, updatePayload, { merge: true });
      } else {
        // Exclusão pontual sem flag deleteAll:
        // NUNCA marca carta default do sistema como deletada!
        // Apenas remove documentos customizados órfãos do Firestore se existirem e não forem default
        console.log('Limpeza segura sem flag deleteAll:', { cleanDocId, isDefault });
        if (!isDefault) {
          for (const docSnap of relatedDocs) {
            await deleteDoc(docSnap.ref);
          }
          await deleteDoc(doc(db, 'customCards', cleanDocId)).catch(() => {});
        }
      }

      console.log('deleteCard concluído com sucesso para:', cleanCode);
    } catch (e: any) {
      console.error('error deleting card:', e);
      alert('Erro ao apagar: ' + e.message);
    }
  };

  return (
    <CardContext.Provider value={{ 
      cards, 
      archetypes, 
      collections, 
      loading, 
      isCodeMigrated,
      saveCard, 
      saveArchetype, 
      saveCollection, 
      deleteCard, 
      deleteCollection, 
      setCardCatalogCover,
      setCardRarePrintSettings,
      cleanAllCardSuffixes,
      migrateCodeDataToFirebase
    }}>
      {children}
    </CardContext.Provider>
  );
};

export const useCards = () => {
  const context = useContext(CardContext);
  if (context === undefined) {
    throw new Error('useCards must be used within a CardProvider');
  }
  return context;
};
