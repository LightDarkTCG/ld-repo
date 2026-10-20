import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CardData, ArchetypeData, CardVariationItem } from './types';
import { allCards as defaultCards, archetypesList as defaultArchetypes, collectionsList as defaultCollections } from './data';
import { compareCardCodes } from './deckUtils';
import { isUserAdmin } from './authService';
import { db, auth } from './firebase';
import { collection, getDocs, doc, setDoc, onSnapshot, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

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

/**
 * Remove suffixes like -ALT, -MOD, -alt, -mod, -Alt, -Mod from card codes.
 * Ensures cards/skins retain their authentic printed code.
 */
export const cleanCardCode = (rawCode?: string): string => {
  if (!rawCode) return '';
  return rawCode.replace(/-(?:ALT|MOD|alt|mod|M)$/i, '').trim();
};

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
  const clean = cleanCardCode(codeToUse);
  const parts = clean.split('/');
  if (parts.length === 3) {
    const year = parts[0];
    const sheet = parts[1];
    const numStr = parts[2];
    const digits = numStr.replace(/[^0-9]/g, '');
    if (digits) {
      const paddedNum = digits.padStart(5, '0');
      const cleanSheetDigits = sheet.replace(/[^0-9]/g, '');
      const paddedSheet = cleanSheetDigits ? cleanSheetDigits.padStart(4, '0') : sheet;
      return `${year}/${paddedSheet}/${paddedNum}`;
    }
  }
  return clean;
};

/**
 * Priority order for displaying cards in the catalog and album:
 * 1º Moderno - Base / Novo Frame (highest priority: 4)
 * 2º Moderno - Arte Alternativa / Skin (priority: 3)
 * 3º Legado - Base (priority: 2)
 * 4º Legado - Arte Alternativa / Skin (priority: 1)
 * REGRA ABSOLUTA: FRAME MODERNO SEMPRE PRIMEIRO, SE NÃO TIVER, FRAME LEGADO
 */
export const getCardDisplayPriority = (card: CardData): number => {
  if (!card) return 0;
  const isModernDirect = card.frame === 'Moderno' || (card.code && card.code.endsWith('-M'));
  const hasModernVariant = Boolean(card.variants && card.variants.some(v => v.frame === 'Moderno'));
  const isModern = isModernDirect || hasModernVariant;

  const typeLower = (card.variationType || '').toLowerCase();
  const isSkinOrAA = typeLower.includes('skin') || 
                     typeLower.includes('arte alternativa') || 
                     typeLower.includes('aa') || 
                     (card.isVariation && !typeLower.includes('novo frame') && !typeLower.includes('moderno'));

  // 1º Moderno Puro / Novo Frame
  if (isModern && !isSkinOrAA) return 4;
  // 2º Moderno Arte Alternativa / Skin
  if (isModern && isSkinOrAA) return 3;
  // 3º Legado Base
  if (!isModern && !isSkinOrAA) return 2;
  // 4º Legado Arte Alternativa / Skin
  return 1;
};

/**
 * Regra: Quando a carta tiver frame legado e frame moderno, usar somente moderno.
 * Converte a carta para sua versão ou variante moderna caso exista no catálogo ou em suas variantes.
 */
export const resolveModernFrameOnly = (card: CardData, allCardsList: CardData[]): CardData => {
  if (!card) return card;
  const baseCode = getBaseCardCode(card.code, card.parentCode).toLowerCase();

  // 1. Se a carta já tem frame Moderno:
  if (card.frame === 'Moderno' || (card.code && card.code.endsWith('-M'))) {
    const modernOnlyVariants = card.variants?.filter(
      v => v.frame === 'Moderno' || (v.frame !== 'Legado' && !(v.name || '').toLowerCase().includes('legado'))
    );
    return {
      ...card,
      frame: 'Moderno',
      variants: modernOnlyVariants && modernOnlyVariants.length > 0 ? modernOnlyVariants : undefined
    };
  }

  // 2. Se a carta possui variante com frame Moderno dentro do seu próprio array de variantes:
  const modernVariant = card.variants?.find(v => v.frame === 'Moderno');
  if (modernVariant) {
    const modernOnlyVariants = card.variants?.filter(
      v => v.frame === 'Moderno' || (v.frame !== 'Legado' && !(v.name || '').toLowerCase().includes('legado'))
    );
    return {
      ...card,
      frame: 'Moderno',
      imageUrl: modernVariant.imageUrl || card.imageUrl,
      variationType: modernVariant.name || 'Novo Frame',
      variants: modernOnlyVariants && modernOnlyVariants.length > 0 ? modernOnlyVariants : undefined
    };
  }

  // 3. Se no catálogo geral allCardsList existe uma carta com o mesmo código base que tem frame Moderno:
  if (allCardsList && allCardsList.length > 0) {
    const matchingModern = allCardsList.find(c =>
      c &&
      (c.frame === 'Moderno' || (c.code && c.code.endsWith('-M')) || c.variants?.some(v => v.frame === 'Moderno')) &&
      getBaseCardCode(c.code, c.parentCode).toLowerCase() === baseCode
    );

    if (matchingModern) {
      if (matchingModern.frame === 'Moderno') {
        const modernOnlyVariants = matchingModern.variants?.filter(
          v => v.frame === 'Moderno' || (v.frame !== 'Legado' && !(v.name || '').toLowerCase().includes('legado'))
        );
        return {
          ...card,
          imageUrl: matchingModern.imageUrl || card.imageUrl,
          frame: 'Moderno',
          variationType: matchingModern.variationType || 'Novo Frame',
          variants: modernOnlyVariants && modernOnlyVariants.length > 0 ? modernOnlyVariants : undefined
        };
      }
      const matchModVar = matchingModern.variants?.find(v => v.frame === 'Moderno');
      if (matchModVar) {
        return {
          ...card,
          imageUrl: matchModVar.imageUrl || card.imageUrl,
          frame: 'Moderno',
          variationType: matchModVar.name || 'Novo Frame',
          variants: matchingModern.variants?.filter(v => v.frame === 'Moderno')
        };
      }
    }
  }

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
}

const CardContext = createContext<CardContextType | undefined>(undefined);

const initialSortedCards = [...defaultCards].sort((a, b) => compareCardCodes(a.code, b.code));

export const CardProvider = ({ children }: { children: ReactNode }) => {
  const [allMergedCards, setAllMergedCards] = useState<CardData[]>(initialSortedCards);
  const [cards, setCards] = useState<CardData[]>(initialSortedCards);
  const [archetypes, setArchetypes] = useState<ArchetypeData[]>(defaultArchetypes);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [explicitCollections, setExplicitCollections] = useState<string[]>([]);

  // Collections are uniquely derived from all cards plus defaults and explicit ones
  const collections = Array.from(new Set([
    ...defaultCollections,
    ...explicitCollections,
    ...cards.map(c => c.collection).filter(Boolean)
  ])).sort() as string[];

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

  useEffect(() => {
    const unsubCards = onSnapshot(collection(db, 'customCards'), (snapshot) => {
      // 1. Identifica códigos base deletados e imagens de variações deletadas
      const deletedBaseCodes = new Set<string>();
      const deletedVariantImages = new Set<string>();

      snapshot.forEach(docSnap => {
        const d = docSnap.data() as any;
        const base = getBaseCardCode(d.code, d.parentCode);
        if (d.deleted) {
          deletedBaseCodes.add(base);
        }
        if (Array.isArray(d.deletedVariantImages)) {
          d.deletedVariantImages.forEach((img: string) => {
            if (img) deletedVariantImages.add(img);
          });
        }
      });

      // 2. Agrupa todos os cards de defaultCards e Firestore por código base canônico
      const groups = new Map<string, CardData[]>();

      // Insere defaultCards não deletados
      defaultCards.forEach(c => {
        const base = getBaseCardCode(c.code, c.parentCode);
        if (deletedBaseCodes.has(base)) return;
        if (c.imageUrl && deletedVariantImages.has(c.imageUrl)) return;
        if (!groups.has(base)) groups.set(base, []);
        groups.get(base)!.push(c);
      });

      // Insere documentos customizados do Firestore
      snapshot.forEach(docSnap => {
        const rawData = docSnap.data() as CardData;
        const originalCode = rawData.code || '';
        const cleanedCode = cleanCardCode(originalCode);
        const base = getBaseCardCode(cleanedCode, rawData.parentCode);

        if (rawData.deleted || deletedBaseCodes.has(base)) return;
        if (rawData.imageUrl && deletedVariantImages.has(rawData.imageUrl)) return;

        let effectiveRarity = rawData.rarity;
        if (rawData.frame === 'Moderno' && (!effectiveRarity || effectiveRarity === 'Beta')) {
          effectiveRarity = 'Comum';
        }

        const card: CardData = {
          ...rawData,
          id: docSnap.id,
          code: cleanedCode,
          rarity: effectiveRarity || 'Comum',
          ...(rawData.parentCode ? { parentCode: cleanCardCode(rawData.parentCode) } : {})
        };

        if (!groups.has(base)) groups.set(base, []);
        groups.get(base)!.push(card);
      });

      // 3. Para cada grupo de código base, consolida em EXATAMENTE 1 carta canônica representativa
      const canonicalCards: CardData[] = [];

      groups.forEach((group, baseCode) => {
        // Verifica se há capa manual definida pelo Administrador
        const coverImageUrl = group.find(c => c.catalogCoverImageUrl)?.catalogCoverImageUrl;
        const coverFrame = group.find(c => c.catalogCoverFrame)?.catalogCoverFrame;
        const anyRarePrint = group.some(c => c.isRarePrint || c.requiresAdminVerification);
        const maxCopies = group.find(c => typeof c.maxPrintCopies === 'number')?.maxPrintCopies;

        let chosenCard: CardData | undefined = undefined;

        // PRIORIDADE 1: Se o Admin definiu uma capa específica para o catálogo:
        if (coverImageUrl) {
          chosenCard = group.find(c => c.imageUrl === coverImageUrl);
          if (!chosenCard) {
            for (const c of group) {
              const v = c.variants?.find(v => v.imageUrl === coverImageUrl);
              if (v) {
                chosenCard = {
                  ...c,
                  id: v.id || `var_${v.code || baseCode}`,
                  imageUrl: v.imageUrl,
                  frame: v.frame || coverFrame || 'Moderno',
                  variationType: v.name || c.variationType || 'Capa do Catálogo',
                  isVariation: true
                };
                break;
              }
            }
          }
        }

        // Prioriza documento do Firestore salvo pelo Administrador
        const firestoreCard = group.find(c => Boolean(c.id && (!c.isVariation || cleanCardCode(c.code) === baseCode))) ||
                              group.find(c => Boolean(c.id));

        // PRIORIDADE 2: REGRA ABSOLUTA: FRAME MODERNO SEMPRE PRIMEIRO, SE NÃO TIVER, FRAME LEGADO
        // Se a prioridade de frame for igual, a versão customizada salva no Firestore SEMPRE tem prioridade sobre o default estático!
        if (!chosenCard) {
          const nonDeletedGroup = group.filter(c => !c.imageUrl || !deletedVariantImages.has(c.imageUrl));
          const candidateGroup = nonDeletedGroup.length > 0 ? nonDeletedGroup : group;
          const sorted = [...candidateGroup].sort((a, b) => {
            const pDiff = getCardDisplayPriority(b) - getCardDisplayPriority(a);
            if (pDiff !== 0) return pDiff;
            const aIsFirestore = Boolean(a.id);
            const bIsFirestore = Boolean(b.id);
            if (aIsFirestore !== bIsFirestore) {
              return bIsFirestore ? 1 : -1;
            }
            return 0;
          });
          chosenCard = sorted[0];

          if (chosenCard.frame !== 'Moderno') {
            chosenCard = resolveModernFrameOnly(chosenCard, defaultCards);
          }
        }

        // Determina a raridade oficial da carta base: respeita edição do Admin no Firestore
        const defaultMatch = defaultCards.find(d => getBaseCardCode(d.code, d.parentCode) === baseCode);
        let finalRarity = firestoreCard?.rarity || chosenCard.rarity || 'Comum';
        if (!firestoreCard?.rarity && defaultMatch) {
          const dRarity = (defaultMatch.rarity || '').toLowerCase();
          if (dRarity === 'beta' || dRarity === 'comum' || !dRarity) {
            finalRarity = 'Comum';
          }
        }

        // Consolida todas as variantes / skins / artes alternativas no array variants
        const allVariants: CardVariationItem[] = [];
        const seenVarImages = new Set<string>();
        if (chosenCard.imageUrl) seenVarImages.add(chosenCard.imageUrl);

        group.forEach(item => {
          if (item.variants && item.variants.length > 0) {
            item.variants.forEach(v => {
              if (!v.imageUrl || seenVarImages.has(v.imageUrl) || deletedVariantImages.has(v.imageUrl)) return;
              seenVarImages.add(v.imageUrl);
              allVariants.push({
                id: v.id || `var_${v.code || baseCode}_${allVariants.length}`,
                code: cleanCardCode(v.code) || cleanCardCode(baseCode),
                name: v.name || (v.frame === 'Moderno' ? 'Novo Frame' : 'Legado'),
                imageUrl: v.imageUrl,
                frame: v.frame || 'Moderno',
                rarity: v.frame === 'Moderno' && v.rarity === 'Beta' ? 'Comum' : (v.rarity || 'Comum'),
                tier: v.tier,
                isCatalogCover: coverImageUrl ? v.imageUrl === coverImageUrl : false
              });
            });
          }

          if (item.imageUrl && !seenVarImages.has(item.imageUrl) && !deletedVariantImages.has(item.imageUrl)) {
            seenVarImages.add(item.imageUrl);
            allVariants.push({
              id: item.id || `var_${item.code || baseCode}_${allVariants.length}`,
              code: cleanCardCode(item.code) || cleanCardCode(baseCode),
              name: item.variationType || (item.frame === 'Moderno' ? 'Novo Frame' : 'Legado'),
              imageUrl: item.imageUrl,
              frame: item.frame || 'Legado',
              rarity: item.frame === 'Moderno' && item.rarity === 'Beta' ? 'Comum' : (item.rarity || 'Comum'),
              tier: item.tier,
              isCatalogCover: coverImageUrl ? item.imageUrl === coverImageUrl : false
            });
          }
        });

        // Metadados editados pelo Admin no Firestore sempre prevalecem sobre valores estáticos default
        const customProps = firestoreCard ? {
          name: firestoreCard.name || chosenCard.name,
          archetype: firestoreCard.archetype !== undefined ? firestoreCard.archetype : chosenCard.archetype,
          type: firestoreCard.type || chosenCard.type,
          collection: firestoreCard.collection || chosenCard.collection,
          description: firestoreCard.description !== undefined ? firestoreCard.description : chosenCard.description,
          ct: firestoreCard.ct !== undefined ? firestoreCard.ct : chosenCard.ct,
          attack: firestoreCard.attack !== undefined ? firestoreCard.attack : chosenCard.attack,
          defense: firestoreCard.defense !== undefined ? firestoreCard.defense : chosenCard.defense,
          lore: firestoreCard.lore !== undefined ? firestoreCard.lore : chosenCard.lore,
          isHidden: firestoreCard.isHidden !== undefined ? firestoreCard.isHidden : chosenCard.isHidden,
          ...(firestoreCard.frame ? { frame: firestoreCard.frame } : {})
        } : {};

        canonicalCards.push({
          ...chosenCard,
          ...customProps,
          code: cleanCardCode(baseCode) || cleanCardCode(chosenCard.code),
          rarity: finalRarity,
          catalogCoverImageUrl: coverImageUrl || undefined,
          isCatalogCover: Boolean(coverImageUrl && chosenCard.imageUrl === coverImageUrl),
          isRarePrint: Boolean(anyRarePrint),
          requiresAdminVerification: Boolean(anyRarePrint),
          maxPrintCopies: maxCopies ?? chosenCard.maxPrintCopies,
          variants: allVariants.length > 0 ? allVariants : undefined
        });
      });

      canonicalCards.sort((a, b) => compareCardCodes(a.code, b.code));
      setAllMergedCards(canonicalCards);
    }, (err: any) => {
      if (err.code !== 'unavailable') console.error(err);
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
    }, (err: any) => {
      if (err.code !== 'unavailable') console.error(err);
    });

    const unsubCollections = onSnapshot(collection(db, 'customCollections'), (snapshot) => {
      const dbCollections: string[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.name) dbCollections.push(data.name);
      });
      setExplicitCollections(dbCollections);
    }, (err: any) => {
      if (err.code !== 'unavailable') console.error(err);
    });

    setLoading(false);
    return () => {
      unsubCards();
      unsubArchetypes();
      unsubCollections();
    };
  }, []);

  const saveCard = async (card: CardData) => {
    if (!card.code) return;
    const cleanCode = cleanCardCode(card.code);

    // If card frame is Moderno and rarity is Beta, convert to Comum
    let effectiveRarity = card.rarity || 'Comum';
    if (card.frame === 'Moderno' && effectiveRarity === 'Beta') {
      effectiveRarity = 'Comum';
    }

    const cleanedVariants = card.variants && card.variants.length > 0
      ? card.variants.map(v => ({
          ...v,
          code: cleanCardCode(v.code),
          rarity: v.frame === 'Moderno' && v.rarity === 'Beta' ? 'Comum' : (v.rarity || 'Comum')
        }))
      : undefined;

    const cleanedCard: CardData = {
      ...card,
      code: cleanCode,
      rarity: effectiveRarity,
      ...(card.parentCode ? { parentCode: cleanCardCode(card.parentCode) } : {}),
      ...(cleanedVariants ? { variants: cleanedVariants } : {})
    };

    // Determine target docId: if card has an explicit id, use it; otherwise use sanitized cleanCode
    const docId = card.id ? card.id.replace(/\//g, '_') : cleanCode.replace(/\//g, '_');
    await setDoc(doc(db, 'customCards', docId), sanitizeForFirestore({ ...cleanedCard, id: docId }));

    // If saving a variation that has a parentCode, also keep parent's variants array up-to-date
    if (cleanedCard.isVariation && cleanedCard.parentCode) {
      try {
        const parentCleanCode = cleanCardCode(cleanedCard.parentCode);
        const parentDocId = parentCleanCode.replace(/\//g, '_');
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
            imageUrl: cleanedCard.imageUrl || ''
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
      const cleanDocId = cleanCardCode(baseCode).replace(/[\/\s-]/g, '_');

      // Atualiza o documento base no Firestore
      const baseRef = doc(db, 'customCards', cleanDocId);
      const snap = await getDoc(baseRef);

      if (clearCover || !coverVariant) {
        if (snap.exists()) {
          await updateDoc(baseRef, {
            catalogCoverImageUrl: null,
            catalogCoverFrame: null,
            catalogCoverVariationId: null
          });
        }
      } else {
        const coverData = {
          catalogCoverImageUrl: coverVariant.imageUrl,
          catalogCoverFrame: coverVariant.frame || 'Moderno',
          catalogCoverVariationId: coverVariant.id || ''
        };
        if (snap.exists()) {
          await updateDoc(baseRef, coverData);
        } else {
          await setDoc(baseRef, {
            code: cleanCardCode(baseCode),
            name: typeof cardOrCode === 'object' ? cardOrCode.name : 'Carta',
            ...coverData
          }, { merge: true });
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
      const cleanDocId = cleanCardCode(baseCode).replace(/[\/\s-]/g, '_');

      const baseRef = doc(db, 'customCards', cleanDocId);
      const snap = await getDoc(baseRef);

      const rareData = {
        isRarePrint: Boolean(isRare),
        requiresAdminVerification: Boolean(isRare),
        maxPrintCopies: isRare ? (Number(maxCopies) || 1) : 0
      };

      if (snap.exists()) {
        await updateDoc(baseRef, rareData);
      } else {
        await setDoc(baseRef, {
          code: cleanCardCode(baseCode),
          name: typeof cardOrCode === 'object' ? cardOrCode.name : 'Carta',
          ...rareData
        }, { merge: true });
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
        // APAGA A CARTA BASE COMPLETA
        console.log('Apagando carta base:', { cleanDocId, isDefault });
        if (isDefault) {
          await setDoc(doc(db, 'customCards', cleanDocId), { 
            code: cleanCode, 
            deleted: true, 
            name: cardObj?.name || 'Carta Excluída' 
          });
        } else {
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
      saveCard, 
      saveArchetype, 
      saveCollection, 
      deleteCard, 
      deleteCollection, 
      setCardCatalogCover,
      setCardRarePrintSettings,
      cleanAllCardSuffixes 
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
