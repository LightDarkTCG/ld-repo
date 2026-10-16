import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { cleanCardCode } from './CardContext';
import { CardData } from './types';

export interface AlbumEntry {
  quantity: number;
  foils?: string[]; // Tipos de foil possuídos (ex: 'arco iris', 'ouro')
  updatedAt?: any;
}

export interface FoilTypeInfo {
  id: string;
  name: string;
  shortName: string;
  color: string;
  badgeBg: string;
  border: string;
  gradient: string;
  shimmerClass: string;
  description: string;
}

/**
 * 11 Tipos de cartas Foil disponíveis no jogo
 */
export const FOIL_TYPES: FoilTypeInfo[] = [
  { 
    id: 'arco iris', 
    name: 'Arco-íris', 
    shortName: 'Arco-íris',
    color: 'text-pink-300', 
    badgeBg: 'bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/20 text-pink-200 border-pink-500/50', 
    border: 'border-pink-500', 
    gradient: 'from-pink-500 via-purple-500 to-cyan-400',
    shimmerClass: 'foil-shimmer-rainbow',
    description: 'Reflexo prismático iridescente de arco-íris cósmico' 
  },
  { 
    id: 'estilhaço', 
    name: 'Estilhaço', 
    shortName: 'Estilhaço',
    color: 'text-cyan-300', 
    badgeBg: 'bg-cyan-950/70 text-cyan-200 border-cyan-500/50', 
    border: 'border-cyan-500', 
    gradient: 'from-cyan-400 via-sky-500 to-indigo-500',
    shimmerClass: 'foil-shimmer-shatter',
    description: 'Padrão geométrico de vidro quebrado cintilante' 
  },
  { 
    id: 'confeti', 
    name: 'Confeti', 
    shortName: 'Confeti',
    color: 'text-yellow-300', 
    badgeBg: 'bg-yellow-950/70 text-yellow-200 border-yellow-500/50', 
    border: 'border-yellow-500', 
    gradient: 'from-yellow-400 via-pink-400 to-emerald-400',
    shimmerClass: 'foil-shimmer-confetti',
    description: 'Partículas cintilantes multicoloridas espalhadas' 
  },
  { 
    id: 'coração', 
    name: 'Coração', 
    shortName: 'Coração',
    color: 'text-rose-400', 
    badgeBg: 'bg-rose-950/70 text-rose-200 border-rose-500/50', 
    border: 'border-rose-500', 
    gradient: 'from-rose-400 via-pink-500 to-red-500',
    shimmerClass: 'foil-shimmer-heart',
    description: 'Holofoil com micro-corações brilhantes pulsantes' 
  },
  { 
    id: 'espiral', 
    name: 'Espiral', 
    shortName: 'Espiral',
    color: 'text-indigo-300', 
    badgeBg: 'bg-indigo-950/70 text-indigo-200 border-indigo-500/50', 
    border: 'border-indigo-500', 
    gradient: 'from-indigo-400 via-purple-500 to-violet-600',
    shimmerClass: 'foil-shimmer-spiral',
    description: 'Vórtice hipnótico espiral com ondas de luz' 
  },
  { 
    id: 'prata', 
    name: 'Prata', 
    shortName: 'Prata',
    color: 'text-slate-200', 
    badgeBg: 'bg-slate-800 text-slate-100 border-slate-400/60', 
    border: 'border-slate-400', 
    gradient: 'from-slate-200 via-gray-300 to-slate-400',
    shimmerClass: 'foil-shimmer-silver',
    description: 'Acabamento cromado espelhado metálico puro' 
  },
  { 
    id: 'ouro', 
    name: 'Ouro', 
    shortName: 'Ouro',
    color: 'text-amber-300', 
    badgeBg: 'bg-amber-950/80 text-amber-200 border-amber-500/60', 
    border: 'border-amber-500', 
    gradient: 'from-amber-300 via-yellow-400 to-amber-500',
    shimmerClass: 'foil-shimmer-gold',
    description: 'Brilho nobre e dourado maciço dos campeões' 
  },
  { 
    id: 'confeti 3d', 
    name: 'Confeti 3D', 
    shortName: 'Confeti 3D',
    color: 'text-emerald-300', 
    badgeBg: 'bg-emerald-950/70 text-emerald-200 border-emerald-500/50', 
    border: 'border-emerald-500', 
    gradient: 'from-emerald-400 via-teal-400 to-cyan-500',
    shimmerClass: 'foil-shimmer-3d',
    description: 'Efeito holográfico tridimensional profundo' 
  },
  { 
    id: 'frente e verso', 
    name: 'Frente e Verso', 
    shortName: 'Frente/Verso',
    color: 'text-purple-300', 
    badgeBg: 'bg-purple-950/70 text-purple-200 border-purple-500/50', 
    border: 'border-purple-500', 
    gradient: 'from-purple-400 via-fuchsia-500 to-pink-500',
    shimmerClass: 'foil-shimmer-double',
    description: 'Laminação holofoil de alta densidade em ambas as faces' 
  },
  { 
    id: 'palha', 
    name: 'Palha', 
    shortName: 'Palha',
    color: 'text-amber-200', 
    badgeBg: 'bg-yellow-950/60 text-yellow-200 border-yellow-600/50', 
    border: 'border-yellow-600', 
    gradient: 'from-yellow-600 via-amber-400 to-yellow-700',
    shimmerClass: 'foil-shimmer-straw',
    description: 'traços holograficos como palha espalhada'
  },
  { 
    id: 'floco de neve', 
    name: 'Floco de Neve', 
    shortName: 'Floco Neve',
    color: 'text-sky-200', 
    badgeBg: 'bg-sky-950/70 text-sky-200 border-sky-400/50', 
    border: 'border-sky-400', 
    gradient: 'from-sky-200 via-blue-300 to-indigo-300',
    shimmerClass: 'foil-shimmer-snowflake',
    description: 'Cristais poligonais gélidos e flocos de neve' 
  }
];

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
 * Atualiza a lista de foils possuídas para uma carta no álbum do usuário
 */
export const setUserCardFoils = async (
  userId: string,
  cardOrCode: CardData | string,
  foils: string[],
  currentQty: number = 1,
  frame?: string
): Promise<void> => {
  if (!userId || !cardOrCode) return;
  const key = normalizeAlbumKey(cardOrCode, frame);
  if (!key) return;

  const albumRef = doc(db, 'users', userId, 'album', 'data');
  const cleanFoils = Array.from(new Set(foils.map(f => f.trim().toLowerCase()))).filter(Boolean);
  
  // Se marcou foil mas a quantidade é 0, eleva para pelo menos 1 cópia
  const targetQty = cleanFoils.length > 0 ? Math.max(1, currentQty) : currentQty;

  await setDoc(albumRef, {
    cards: {
      [key]: {
        quantity: targetQty,
        foils: cleanFoils,
        updatedAt: new Date().toISOString()
      }
    },
    lastUpdated: serverTimestamp()
  }, { merge: true });
};

/**
 * Alterna a posse de um tipo específico de foil em uma carta
 */
export const toggleUserCardFoil = async (
  userId: string,
  cardOrCode: CardData | string,
  foilId: string,
  currentEntry?: AlbumEntry,
  frame?: string
): Promise<string[]> => {
  if (!userId || !cardOrCode || !foilId) return [];
  const key = normalizeAlbumKey(cardOrCode, frame);
  if (!key) return [];

  const cleanFoilId = foilId.trim().toLowerCase();
  const currentFoils = (currentEntry?.foils || []).map(f => f.toLowerCase());
  
  let newFoils: string[];
  if (currentFoils.includes(cleanFoilId)) {
    newFoils = currentFoils.filter(f => f !== cleanFoilId);
  } else {
    newFoils = [...currentFoils, cleanFoilId];
  }

  const currentQty = currentEntry?.quantity || 0;
  await setUserCardFoils(userId, cardOrCode, newFoils, currentQty, frame);
  return newFoils;
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

  const getCardFoils = (cardOrCode?: CardData | string | null, frame?: string): string[] => {
    if (!cardOrCode) return [];
    const key = normalizeAlbumKey(cardOrCode, frame);
    return album[key]?.foils || [];
  };

  const hasFoil = (cardOrCode?: CardData | string | null, foilType?: string, frame?: string): boolean => {
    const foils = getCardFoils(cardOrCode, frame);
    if (!foilType) return foils.length > 0;
    return foils.includes(foilType.toLowerCase().trim());
  };

  const setCardFoils = async (cardOrCode: CardData | string, foils: string[], frame?: string) => {
    if (!userId) return;
    const current = getQuantity(cardOrCode, frame);
    await setUserCardFoils(userId, cardOrCode, foils, current, frame);
  };

  const toggleCardFoil = async (cardOrCode: CardData | string, foilId: string, frame?: string) => {
    if (!userId) return [];
    const key = normalizeAlbumKey(cardOrCode, frame);
    const entry = album[key];
    return await toggleUserCardFoil(userId, cardOrCode, foilId, entry, frame);
  };

  return {
    album,
    loading,
    getQuantity,
    hasCard,
    getCardFoils,
    hasFoil,
    setCardFoils,
    toggleCardFoil,
    updateQuantity,
    incrementCard,
    decrementCard,
    addCollectionCards,
    removeCollectionCards
  };
};
