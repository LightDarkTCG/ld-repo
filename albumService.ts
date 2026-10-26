import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { cleanCardCode, getBaseCardCode } from './CardContext';
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
 * Gera um hash estável e determinístico de 6-7 caracteres a partir da URL da imagem ou identificador da variação.
 */
export const getVariationArtHash = (cardOrStr: CardData | string): string => {
  const seed = typeof cardOrStr === 'string' 
    ? cardOrStr 
    : (cardOrStr.imageUrl || cardOrStr.id || cardOrStr.variationType || '');
  if (!seed) return 'alt';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).substring(0, 7);
};

/**
 * Normaliza a chave do álbum para que cada carta e CADA VARIAÇÃO seja 100% INDEPENDENTE.
 * - Versão Legado base: ex: 2025_0001_00152
 * - Versão Moderna base de carta Legado ("Novo Frame"): ex: 2025_0001_00152_MOD
 * - Carta nativa de coleção moderna (ex: Invasão do Caos): ex: 2026_0001_00301
 * - Artes Alternativas, Skins e Variações:
 *   - Se o código impresso tem letra distintiva (ex: 2025/0001/B0152): ex: 2025_0001_B0152
 *   - Se compartilha o mesmo código numérico mas é uma Arte Alternativa / Skin com imagem própria:
 *     ex: 2026_0001_00301_VAR_xyz123 ou 2025_0001_00152_MOD_VAR_xyz123
 * Desta forma, marcar uma arte alternativa NUNCA adiciona a versão base moderna,
 * e cada variação conta individualmente tanto no Álbum quanto no Hall da Fama.
 */
export const normalizeAlbumKey = (
  cardOrCode?: CardData | string | null,
  frame?: string,
  id?: string
): string => {
  if (!cardOrCode) return '';

  if (typeof cardOrCode === 'string') {
    const raw = cardOrCode.trim();
    // Se já é uma chave de variação normalizada, preserva-a
    if (raw.includes('_VAR_')) {
      return raw;
    }

    const isExplicitModern = frame === 'Moderno' || 
                             raw.endsWith('-MOD') || 
                             raw.endsWith('-M') || 
                             raw.endsWith('_MOD') || 
                             (id && id.includes('-MOD'));

    const base = cleanCardCode(raw).replace(/[\/\s-]/g, '_');
    if (isExplicitModern) {
      if (base.startsWith('2026_')) {
        return base;
      }
      return base.endsWith('_MOD') ? base : `${base}_MOD`;
    }
    return base;
  }

  // CardData
  const card = cardOrCode;
  if (!frame && !id && (card as any).albumKey) {
    return (card as any).albumKey;
  }

  const rawCode = card.code || card.id || '';
  const cleanCode = cleanCardCode(rawCode);
  const baseCode = getBaseCardCode(cleanCode, card.parentCode);

  // Verifica se o segmento do número da carta possui letras que indicam uma skin específica (ex: '2025/0001/B0152', '2025/0001/0B188')
  // Diferenças puramente numéricas de zero à esquerda (ex: '2025/0001/0073' vs '2025/0001/00073') NÃO são skins!
  const codeSegments = cleanCode.split(/[\/_]/);
  const lastSegment = codeSegments[codeSegments.length - 1] || '';
  const hasLetterInCardNum = /[a-zA-Z]/.test(lastSegment);
  const isSkinCode = Boolean(cleanCode && baseCode && cleanCode !== baseCode && hasLetterInCardNum);

  const baseKey = isSkinCode
    ? cleanCode.replace(/[\/\s-]/g, '_')
    : cleanCardCode(baseCode || cleanCode).replace(/[\/\s-]/g, '_');

  const effectiveFrame = frame || card.frame;
  const isModern = effectiveFrame === 'Moderno' || 
                   (rawCode && (rawCode.endsWith('-MOD') || rawCode.endsWith('-M') || rawCode.endsWith('_MOD'))) || 
                   (card.id && (card.id.includes('-MOD') || card.id.includes('_MOD'))) ||
                   (id && (id.includes('-MOD') || id.includes('_MOD'))) ||
                   (card.variationType && card.variationType.toLowerCase().includes('moderno'));

  // Coleções criadas originalmente na era moderna já possuem código exclusivo (ex: Invasão do Caos 2026/0001/00301)
  const isModernNativeSet = card.collection === 'Invasão do Caos' || 
                            card.collection === 'Booster Invasão do Caos' || 
                            card.collection === 'Reforço Macroversal' ||
                            baseKey.startsWith('2026_');

  let standardKey = baseKey;
  if (isModern && !isModernNativeSet) {
    standardKey = baseKey.endsWith('_MOD') ? baseKey : `${baseKey}_MOD`;
  }

  // Identifica se a carta é uma variação / skin / arte alternativa
  const vt = (card.variationType || '').trim().toLowerCase();
  const isBaseFrameName = vt === 'novo frame' || 
                          vt === 'moderno' || 
                          vt === 'frame moderno' || 
                          vt === 'legado' || 
                          vt === 'frame legado' || 
                          vt === 'base' || 
                          vt === 'padrão';

  const isVariation = Boolean(
    isSkinCode ||
    (vt && !isBaseFrameName) ||
    (card.isVariation && !isBaseFrameName) ||
    (card.id && (card.id.startsWith('var_') || card.id.startsWith('custom_var_')) && !isBaseFrameName)
  );

  if (isVariation) {
    // Se o próprio código já é uma chave única de skin (ex: 2025_0001_B0152), standardKey já é único!
    if (isSkinCode) {
      return standardKey;
    }
    // Caso contrário, gera uma chave individual baseada na imagem da arte alternativa
    const varHash = getVariationArtHash(card);
    return `${standardKey}_VAR_${varHash}`;
  }

  return standardKey;
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
