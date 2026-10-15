import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { cleanCardCode } from './CardContext';
import { CardData } from './types';

export interface AlbumEntry {
  quantity: number;
  updatedAt?: any;
}

export type UserAlbumMap = Record<string, AlbumEntry>;

/**
 * Normaliza a chave do álbum para que cada carta seja INDEPENDENTE.
 * - Versões Modernas de cartas Legado (ex: Asmonious Moderno) recebem chave com sufixo _MOD.
 * - Versões Legado mantêm sua chave original (ex: 2025_0001_00152).
 * - Cartas nativas de coleções modernas (ex: Invasão do Caos) possuem código próprio.
 * - Desta forma, adicionar a versão Legado NUNCA adiciona a versão Moderna automaticamente.
 */
export const normalizeAlbumKey = (
  cardOrCode?: CardData | string | null,
  frame?: string,
  id?: string
): string => {
  if (!cardOrCode) return '';

  if (typeof cardOrCode === 'string') {
    const raw = cardOrCode.trim();
    const isExplicitModern = frame === 'Moderno' || 
                             raw.endsWith('-MOD') || 
                             raw.endsWith('-M') || 
                             raw.endsWith('_MOD') || 
                             (id && id.includes('-MOD'));

    const base = cleanCardCode(raw).replace(/[\/\s-]/g, '_');
    if (isExplicitModern) {
      return base.endsWith('_MOD') ? base : `${base}_MOD`;
    }
    return base;
  }

  // CardData
  const card = cardOrCode;
  const isModern = card.frame === 'Moderno' || 
                   (card.code && (card.code.endsWith('-MOD') || card.code.endsWith('-M'))) || 
                   (card.id && card.id.includes('-MOD')) ||
                   (card.variationType && card.variationType.toLowerCase().includes('moderno'));

  const baseKey = cleanCardCode(card.code || card.id || '').replace(/[\/\s-]/g, '_');

  // Coleções criadas originalmente na era moderna já possuem código exclusivo (ex: Invasão do Caos 2026/0001/00301)
  const isModernNativeSet = card.collection === 'Invasão do Caos' || 
                            card.collection === 'Booster Invasão do Caos' || 
                            card.collection === 'Reforço Macroversal' ||
                            (card.code && card.code.startsWith('2026/'));

  if (isModern && !isModernNativeSet) {
    return baseKey.endsWith('_MOD') ? baseKey : `${baseKey}_MOD`;
  }

  return baseKey;
};

/**
 * Atualiza a quantidade de uma carta no álbum do usuário de forma independente
 */
export const setUserCardQuantity = async (
  userId: string,
  cardOrCode: CardData | string,
  quantity: number,
  frame?: string
): Promise<void> => {
  if (!userId || !cardOrCode) return;
  const key = normalizeAlbumKey(cardOrCode, frame);
  if (!key) return;
  const cleanQty = Math.max(0, Math.floor(quantity));

  const albumRef = doc(db, 'users', userId, 'album', 'data');

  await setDoc(albumRef, {
    cards: {
      [key]: {
        quantity: cleanQty,
        updatedAt: new Date().toISOString()
      }
    },
    lastUpdated: serverTimestamp()
  }, { merge: true });
};

/**
 * Atualiza múltiplas cartas no álbum do usuário em uma única gravação atômica
 */
export const setMultipleUserCardQuantities = async (
  userId: string,
  entries: { cardOrCode: CardData | string; quantity: number; frame?: string }[]
): Promise<void> => {
  if (!userId || !entries || entries.length === 0) return;
  const albumRef = doc(db, 'users', userId, 'album', 'data');
  const now = new Date().toISOString();

  const cardsUpdate: Record<string, { quantity: number; updatedAt: string }> = {};
  for (const entry of entries) {
    const key = normalizeAlbumKey(entry.cardOrCode, entry.frame);
    if (!key) continue;
    cardsUpdate[key] = {
      quantity: Math.max(0, Math.floor(entry.quantity)),
      updatedAt: now
    };
  }

  await setDoc(albumRef, {
    cards: cardsUpdate,
    lastUpdated: serverTimestamp()
  }, { merge: true });
};

/**
 * Hook para gerenciar o álbum do usuário conectado com sincronização em tempo real
 */
export const useUserAlbum = (userId?: string | null) => {
  const [album, setAlbum] = useState<UserAlbumMap>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!userId) {
      setAlbum({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const albumRef = doc(db, 'users', userId, 'album', 'data');
    const unsubscribe = onSnapshot(albumRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAlbum(data.cards || {});
      } else {
        setAlbum({});
      }
      setLoading(false);
    }, (err) => {
      console.error('Erro ao ouvir álbum do usuário:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const getQuantity = (cardOrCode?: CardData | string | null, frame?: string): number => {
    if (!cardOrCode) return 0;
    const key = normalizeAlbumKey(cardOrCode, frame);
    return album[key]?.quantity || 0;
  };

  const hasCard = (cardOrCode?: CardData | string | null, frame?: string): boolean => {
    return getQuantity(cardOrCode, frame) > 0;
  };

  const updateQuantity = async (cardOrCode: CardData | string, newQuantity: number, frame?: string) => {
    if (!userId) return;
    await setUserCardQuantity(userId, cardOrCode, newQuantity, frame);
  };

  const incrementCard = async (cardOrCode: CardData | string, frame?: string) => {
    if (!userId) return;
    const current = getQuantity(cardOrCode, frame);
    await setUserCardQuantity(userId, cardOrCode, current + 1, frame);
  };

  const decrementCard = async (cardOrCode: CardData | string, frame?: string) => {
    if (!userId) return;
    const current = getQuantity(cardOrCode, frame);
    if (current > 0) {
      await setUserCardQuantity(userId, cardOrCode, current - 1, frame);
    }
  };

  /**
   * Adiciona todas as cartas de uma coleção/deck de uma só vez ao álbum.
   * - mode 'add': adiciona +qty cópias para cada carta da coleção.
   * - mode 'ensure_at_least': garante que o usuário tenha pelo menos qty cópias de cada carta (completa faltantes).
   * Cada carta mantém sua identidade (Legado vs Moderno) de forma independente.
   */
  const addCollectionCards = async (
    cards: (CardData | string)[],
    mode: 'add' | 'ensure_at_least' = 'add',
    qty: number = 1
  ): Promise<number> => {
    if (!userId || !cards || cards.length === 0) return 0;

    const entriesMap = new Map<string, { cardOrCode: CardData | string; quantity: number }>();
    for (const c of cards) {
      const key = normalizeAlbumKey(c);
      if (!key) continue;
      const current = getQuantity(c);
      const targetQty = mode === 'add' ? current + qty : Math.max(current, qty);
      entriesMap.set(key, { cardOrCode: c, quantity: targetQty });
    }

    const entries = Array.from(entriesMap.values());
    await setMultipleUserCardQuantities(userId, entries);
    return entries.length;
  };

  /**
   * Zera a posse de todas as cartas de uma coleção no álbum
   */
  const removeCollectionCards = async (cards: (CardData | string)[]): Promise<number> => {
    if (!userId || !cards || cards.length === 0) return 0;
    const entriesMap = new Map<string, { cardOrCode: CardData | string; quantity: number }>();
    for (const c of cards) {
      const key = normalizeAlbumKey(c);
      if (!key) continue;
      entriesMap.set(key, { cardOrCode: c, quantity: 0 });
    }
    const entries = Array.from(entriesMap.values());
    await setMultipleUserCardQuantities(userId, entries);
    return entries.length;
  };

  return {
    album,
    loading,
    getQuantity,
    hasCard,
    updateQuantity,
    incrementCard,
    decrementCard,
    addCollectionCards,
    removeCollectionCards
  };
};
