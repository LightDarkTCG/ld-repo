import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CardData, ArchetypeData } from './types';
import { allCards as defaultCards, archetypesList as defaultArchetypes, collectionsList as defaultCollections } from './data';
import { db, auth } from './firebase';
import { collection, getDocs, doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

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
}

const CardContext = createContext<CardContextType | undefined>(undefined);

export const CardProvider = ({ children }: { children: ReactNode }) => {
  const [allMergedCards, setAllMergedCards] = useState<CardData[]>(defaultCards);
  const [cards, setCards] = useState<CardData[]>(defaultCards);
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
      snapshot.forEach(doc => {
        customCardsMap.set(doc.id, doc.data() as CardData);
      });

      const mergedCards = [...defaultCards];
      customCardsMap.forEach((v, k) => {
        const index = mergedCards.findIndex(c => c.code === v.code);
        if (v.deleted) {
          if (index >= 0) mergedCards.splice(index, 1);
        } else if (index >= 0) {
          mergedCards[index] = v;
        } else {
          mergedCards.push(v);
        }
      });
      setAllMergedCards(mergedCards);
    }, (err: any) => {
      if (err.code !== 'unavailable') console.error(err);
    });

    const unsubArchetypes = onSnapshot(collection(db, 'customArchetypes'), (snapshot) => {
      const customArchMap = new Map<string, ArchetypeData>();
      snapshot.forEach(doc => {
        customArchMap.set(doc.id, doc.data() as ArchetypeData);
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
      snapshot.forEach(doc => {
        const data = doc.data();
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
    await setDoc(doc(db, 'customCards', card.code.replace(/\//g, '_')), card);
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
      if (isDefault) {
        // Store as deleted so it removes the original default card when loaded
        await setDoc(doc(db, 'customCards', code.replace(/\//g, '_')), { code, deleted: true });
      } else {
        await deleteDoc(doc(db, 'customCards', code.replace(/\//g, '_')));
      }
      console.log('deleted', code);
    } catch (e: any) {
      console.error('error deleting', e);
      alert('Erro ao apagar: ' + e.message);
    }
  };

  return (
    <CardContext.Provider value={{ cards, archetypes, collections, loading, saveCard, saveArchetype, saveCollection, deleteCard, deleteCollection }}>
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
