import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CardData, ArchetypeData, CardVariationItem } from './types';
import { allCards as defaultCards, archetypesList as defaultArchetypes, collectionsList as defaultCollections } from './data';
import { compareCardCodes } from './deckUtils';
import { db, auth } from './firebase';
import { collection, getDocs, doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
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
  return rawCode.replace(/-(?:ALT|MOD|alt|mod)$/i, '').trim();
};

/**
 * Priority order for displaying cards in the catalog:
 * 1º Moderno (highest)
 * 2º AA / Skin (Arte Alternativa, Skin)
 * 3º Legado / Clássico
 */
export const getCardDisplayPriority = (card: CardData): number => {
  const isModern = card.frame === 'Moderno' || (card.code && card.code.endsWith('-M'));
  const typeLower = (card.variationType || '').toLowerCase();
  const isSkinOrAA = typeLower.includes('skin') || 
                     typeLower.includes('arte alternativa') || 
                     typeLower.includes('aa') || 
                     (card.isVariation && !typeLower.includes('novo frame') && !typeLower.includes('moderno'));

  if (isModern && !isSkinOrAA) return 3; // Moderno puro (1ª prioridade)
  if (isModern && isSkinOrAA) return 2.5; // Moderno AA / Skin
  if (isSkinOrAA) return 2; // AA / Skin (2ª prioridade)
  return 1; // Legado / Base (3ª prioridade)
};

interface CardContextType {
  cards: CardData[];
  archetypes: ArchetypeData[];
  collections: string[];
  loading: boolean;
  saveCard: (card: CardData) => Promise<void>;
  saveArchetype: (archetype: ArchetypeData) => Promise<void>;
  saveCollection: (name: string) => Promise<void>;
  deleteCard: (code: string) => Promise<void>;
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
      setIsAdmin(!!u);
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
            if (!v.imageUrl || seenImages.has(v.imageUrl)) continue;
            seenImages.add(v.imageUrl);

            const vCode = cleanCardCode(v.code || rawData.code);
            // Skip variants if they mistakenly came from an entirely different collection/code (e.g. B-reprints)
            if (vCode && cleanedCode && vCode !== cleanedCode) {
              if (vCode.includes('B') !== cleanedCode.includes('B')) {
                continue;
              }
            }

            cleanedVariants.push({
              ...v,
              code: vCode
            });
          }
          if (cleanedVariants.length === 0) cleanedVariants = undefined;
        }

        const card: CardData = {
          ...rawData,
          id: docSnap.id,
          code: cleanedCode,
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
    const cleanedCard: CardData = {
      ...card,
      code: cleanCode,
      ...(card.parentCode ? { parentCode: cleanCardCode(card.parentCode) } : {}),
      ...(card.variants && card.variants.length > 0
        ? { variants: card.variants.map(v => ({ ...v, code: cleanCardCode(v.code) })) }
        : {})
    };

    // Determine target docId: if card has an explicit id, use it; otherwise use sanitized cleanCode
    const docId = card.id ? card.id.replace(/\//g, '_') : cleanCode.replace(/\//g, '_');
    await setDoc(doc(db, 'customCards', docId), sanitizeForFirestore({ ...cleanedCard, id: docId }));
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

  const deleteCard = async (code: string) => {
    if (!code) return;
    try {
      console.log('deleting', code);
      const isDefault = defaultCards.some(d => d.code === code);
      const cleanDocId = cleanCardCode(code).replace(/\//g, '_');
      if (isDefault) {
        // Store as deleted so it removes the original default card when loaded
        await setDoc(doc(db, 'customCards', cleanDocId), { code: cleanCardCode(code), deleted: true });
      } else {
        await deleteDoc(doc(db, 'customCards', cleanDocId));
      }
      console.log('deleted', code);
    } catch (e: any) {
      console.error('error deleting', e);
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
