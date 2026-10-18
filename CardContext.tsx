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
      const rawDocsMap = new Map<string, CardData>();
      snapshot.forEach(docSnap => {
        rawDocsMap.set(docSnap.id, { ...(docSnap.data() as CardData), id: docSnap.id });
      });

      const customCardsMap = new Map<string, CardData>();
      
      snapshot.forEach(docSnap => {
        const rawData = docSnap.data() as CardData;
        const originalCode = rawData.code || '';
        const cleanedCode = cleanCardCode(originalCode);
        
        let cleanedVariants: CardVariationItem[] | undefined = undefined;
        if (rawData.variants && rawData.variants.length > 0) {
          const seenImages = new Set<string>();
          cleanedVariants = [];
          for (const v of rawData.variants) {
            // If this variant has a corresponding child doc, use the child doc's authoritative latest data
            const childDoc = v.id ? rawDocsMap.get(v.id) : null;
            const effectiveImg = (childDoc && childDoc.imageUrl) ? childDoc.imageUrl : v.imageUrl;
            if (!effectiveImg || seenImages.has(effectiveImg)) continue;
            seenImages.add(effectiveImg);

            const vCode = cleanCardCode((childDoc && childDoc.code) || v.code || rawData.code);

            // As requested by user: cards of Modern frame are Comum, not Beta
            let vRarity = (childDoc && childDoc.rarity) || v.rarity;
            const vFrame = (childDoc && childDoc.frame) || v.frame;
            if (vFrame === 'Moderno' && (!vRarity || vRarity === 'Beta')) {
              vRarity = 'Comum';
            }

            cleanedVariants.push({
              ...v,
              id: v.id || (childDoc ? childDoc.id : undefined),
              imageUrl: effectiveImg,
              frame: vFrame || 'Moderno',
              name: (childDoc && childDoc.variationType) || v.name || 'Variação',
              code: vCode,
              rarity: vRarity || 'Comum'
            });
          }
          if (cleanedVariants.length === 0) cleanedVariants = undefined;
        }

        // As requested by user: cards of Modern frame (modern versions of legacy cards) are Comum, not Beta
        let effectiveRarity = rawData.rarity;
        if (rawData.frame === 'Moderno' && (!effectiveRarity || effectiveRarity === 'Beta')) {
          effectiveRarity = 'Comum';
        }

        const card: CardData = {
          ...rawData,
          id: docSnap.id,
          code: cleanedCode,
          rarity: effectiveRarity || 'Comum',
          ...(rawData.parentCode ? { parentCode: cleanCardCode(rawData.parentCode) } : {}),
          ...(cleanedVariants ? { variants: cleanedVariants } : {})
        };

        customCardsMap.set(docSnap.id, card);
      });

      const mergedCards = [...defaultCards];
      customCardsMap.forEach((v) => {
        // If deleted
        if (v.deleted) {
          const index = mergedCards.findIndex(c => c.code === v.code && (c.id === v.id || !v.isVariation));
          if (index >= 0) mergedCards.splice(index, 1);
          return;
        }

        // Check if matching card exists by id or (for base cards) by code and collection
        const index = mergedCards.findIndex(c => 
          (v.id && c.id === v.id) || 
          (!v.isVariation && c.code === v.code && (!v.collection || !c.collection || c.collection === v.collection))
        );
        if (index >= 0) {
          mergedCards[index] = v;
        } else {
          mergedCards.push(v);
        }
      });

      mergedCards.sort((a, b) => compareCardCodes(a.code, b.code));
      setAllMergedCards(mergedCards);
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

  const deleteCard = async (target: string | CardData, options?: DeleteCardOptions) => {
    if (!target) return;
    try {
      const cardObj: CardData | null = typeof target === 'object' && target !== null ? target : null;
      const rawCode = typeof target === 'string' ? target : (cardObj?.code || '');
      const cleanCode = cleanCardCode(rawCode || cardObj?.parentCode || '');
      const cleanDocId = cleanCode.replace(/\//g, '_');
      const specificId = options?.specificId || cardObj?.id;
      const targetFrame = options?.frame || cardObj?.frame;
      const targetImageUrl = options?.imageUrl || cardObj?.imageUrl;
      const targetVarType = options?.variationType || cardObj?.variationType;
      const deleteAll = Boolean(options?.deleteAllVersions);
      const isModern = targetFrame === 'Moderno' || targetVarType === 'Novo Frame';
      const isDefault = defaultCards.some(d => cleanCardCode(d.code) === cleanCode);

      console.log('deleteCard executing:', { rawCode, cleanCode, cleanDocId, specificId, targetFrame, isModern, deleteAll });

      // Fetch all documents from customCards
      const snap = await getDocs(collection(db, 'customCards'));
      const relatedDocs = snap.docs.filter(docSnap => {
        const d = docSnap.data();
        const dCode = cleanCardCode(d.code);
        const dParentCode = cleanCardCode(d.parentCode);
        return (
          docSnap.id === cleanDocId ||
          docSnap.id === specificId ||
          docSnap.id.startsWith(cleanDocId + '-') ||
          docSnap.id.startsWith(cleanDocId + '_') ||
          dCode === cleanCode ||
          dParentCode === cleanCode
        );
      });

      if (deleteAll) {
        // Delete all related documents in Firestore
        for (const docSnap of relatedDocs) {
          await deleteDoc(docSnap.ref);
        }
        if (isDefault) {
          // If default base card from data.ts, mark it as deleted
          await setDoc(doc(db, 'customCards', cleanDocId), { code: cleanCode, deleted: true });
        }
        // Clean up any remaining references in any card's variants array
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
      } else {
        // Deleting ONLY the SPECIFIC VARIANT, SKIN, OR FRAME
        console.log('Deleting specific variant/frame:', { specificId, targetImageUrl, targetFrame, targetVarType });

        // 1. If specific document exists with ID matching specificId and it's not the base doc:
        if (specificId && specificId !== cleanDocId) {
          await deleteDoc(doc(db, 'customCards', specificId)).catch(() => {});
        }

        // 2. Scan related documents: delete ONLY the document that matches this exact variant/frame
        for (const docSnap of relatedDocs) {
          const d = docSnap.data();

          // Never delete the base cleanDocId document when deleting an alternate art or variation
          if (docSnap.id === cleanDocId) {
            // Only if deleting the Modern base frame override on a default legacy card
            if (targetFrame === 'Moderno' && targetVarType === 'Novo Frame' && d.frame === 'Moderno' && (!targetImageUrl || d.imageUrl === targetImageUrl)) {
              if (isDefault) {
                // Revert to legacy default card
                await deleteDoc(docSnap.ref);
              }
            }
            continue;
          }

          // For separate variation documents (-MOD, -M, _var_...):
          const matchesId = specificId && docSnap.id === specificId;
          const matchesImage = Boolean(targetImageUrl && d.imageUrl === targetImageUrl);

          if (matchesId || matchesImage) {
            await deleteDoc(docSnap.ref);
          } else if (targetFrame === 'Moderno' && targetVarType === 'Novo Frame' && (docSnap.id.endsWith('-MOD') || docSnap.id.endsWith('-M'))) {
            // Deleting the Modern frame version
            if (!targetImageUrl || d.imageUrl === targetImageUrl) {
              await deleteDoc(docSnap.ref);
            }
          }
        }

        // 3. Remove this exact variant from any variants array across related docs
        for (const docSnap of relatedDocs) {
          const d = docSnap.data();
          if (d.variants && Array.isArray(d.variants)) {
            const initialLen = d.variants.length;
            const filtered = d.variants.filter((v: any) => {
              if (specificId && v.id === specificId) return false;
              if (targetImageUrl && v.imageUrl === targetImageUrl) return false;
              if (targetFrame === 'Moderno' && targetVarType === 'Novo Frame' && (v.frame === 'Moderno' || v.name === 'Novo Frame')) {
                if (!targetImageUrl || v.imageUrl === targetImageUrl) return false;
              }
              return true;
            });
            if (filtered.length !== initialLen) {
              await updateDoc(docSnap.ref, { variants: sanitizeForFirestore(filtered) });
            }
          }
        }

        // 4. If cleanDocId had { deleted: true } set previously, remove that flag if isDefault so base card lives!
        const baseDoc = relatedDocs.find(d => d.id === cleanDocId);
        if (baseDoc && baseDoc.data().deleted === true && isDefault) {
          await deleteDoc(baseDoc.ref);
        }
      }

      console.log('deleteCard completed successfully for:', cleanCode);
    } catch (e: any) {
      console.error('error deleting card:', e);
      alert('Erro ao apagar: ' + e.message);
    }
  };

  return (
    <CardContext.Provider value={{ cards, archetypes, collections, loading, saveCard, saveArchetype, saveCollection, deleteCard, deleteCollection, cleanAllCardSuffixes }}>
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
