import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { cleanCardCode } from './CardContext';

export interface AlbumEntry {
  quantity: number;
  updatedAt?: any;
}

export type UserAlbumMap = Record<string, AlbumEntry>;

/**
 * Normaliza o código da carta para indexação consistente no álbum
 */
export const normalizeAlbumKey = (code?: string): string => {
  if (!code) return '';
  return cleanCardCode(code).replace(/[\/\s-]/g, '_');
};

/**
 * Atualiza a quantidade de uma carta no álbum do usuário
 */
export const setUserCardQuantity = async (
  userId: string,
  cardCode: string,
  quantity: number
): Promise<void> => {
  if (!userId || !cardCode) return;
  const key = normalizeAlbumKey(cardCode);
  const cleanQty = Math.max(0, Math.floor(quantity));

  const albumRef = doc(db, 'users', userId, 'album', 'data');

  if (cleanQty <= 0) {
    // Para quantidade 0, guardamos 0 ou apagamos
    await setDoc(albumRef, {
      cards: {
        [key]: {
          quantity: 0,
          updatedAt: new Date().toISOString()
        }
      },
      lastUpdated: serverTimestamp()
    }, { merge: true });
  } else {
    await setDoc(albumRef, {
      cards: {
        [key]: {
          quantity: cleanQty,
          updatedAt: new Date().toISOString()
        }
      },
      lastUpdated: serverTimestamp()
    }, { merge: true });
  }
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

  const getQuantity = (cardCode?: string): number => {
    if (!cardCode) return 0;
    const key = normalizeAlbumKey(cardCode);
    return album[key]?.quantity || 0;
  };

  const hasCard = (cardCode?: string): boolean => {
    return getQuantity(cardCode) > 0;
  };

  const updateQuantity = async (cardCode: string, newQuantity: number) => {
    if (!userId) return;
    await setUserCardQuantity(userId, cardCode, newQuantity);
  };

  const incrementCard = async (cardCode: string) => {
    if (!userId) return;
    const current = getQuantity(cardCode);
    await setUserCardQuantity(userId, cardCode, current + 1);
  };

  const decrementCard = async (cardCode: string) => {
    if (!userId) return;
    const current = getQuantity(cardCode);
    if (current > 0) {
      await setUserCardQuantity(userId, cardCode, current - 1);
    }
  };

  return {
    album,
    loading,
    getQuantity,
    hasCard,
    updateQuantity,
    incrementCard,
    decrementCard
  };
};
