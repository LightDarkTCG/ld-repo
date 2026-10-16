import { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './firebase';
import { CardData } from './types';
import { cleanCardCode } from './CardContext';

export interface WantedCardItem {
  cardCode: string;
  cardName: string;
  cardCollection?: string;
  imageUrl?: string;
  type?: string;
  frame?: string;
  foilWanted?: string; // 'qualquer' | 'normal' | 'arco iris' | 'ouro' | 'confeti' | etc.
  quantity?: number;
  notes?: string;
  priority?: 'alta' | 'media' | 'baixa';
  addedAt: string;
}

export interface UserWishlistDoc {
  userId: string;
  userName: string;
  userAvatar?: string;
  userEmail?: string;
  cards: WantedCardItem[];
  updatedAt?: any;
}

export interface InterestedPlayerInfo {
  userId: string;
  userName: string;
  userAvatar?: string;
  userEmail?: string;
  foilWanted?: string;
  notes?: string;
  priority?: string;
  quantity?: number;
  addedAt?: string;
}

export interface MostWantedCardSummary {
  cardCode: string;
  cardName: string;
  cardCollection?: string;
  imageUrl?: string;
  type?: string;
  rarity?: string;
  frame?: string;
  wantedCount: number;
  interestedPlayers: InterestedPlayerInfo[];
}

/**
 * Normaliza o código para comparação única da carta na wishlist
 */
export const normalizeWishlistCode = (codeOrCard?: CardData | string | null): string => {
  if (!codeOrCard) return '';
  if (typeof codeOrCard === 'string') {
    return cleanCardCode(codeOrCard).trim();
  }
  return cleanCardCode(codeOrCard.code || codeOrCard.id || '').trim();
};

/**
 * Salva a lista de cartas procuradas do usuário no Firestore (tanto no perfil quanto na lista pública comunitária)
 */
export async function saveUserWishlist(
  userId: string,
  user: User | null,
  cards: WantedCardItem[]
): Promise<void> {
  if (!userId) return;

  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Jogador';
  const payload: UserWishlistDoc = {
    userId,
    userName: displayName,
    userAvatar: user?.photoURL || '',
    userEmail: user?.email || '',
    cards,
    updatedAt: serverTimestamp()
  };

  try {
    // 1. Salva no documento de wishlist do usuário
    const userWishlistRef = doc(db, 'users', userId, 'wishlist', 'data');
    await setDoc(userWishlistRef, payload, { merge: true });

    // 2. Espelha na coleção comunitária para agregação em tempo real das mais procuradas
    const commWishlistRef = doc(db, 'communityWishlists', userId);
    await setDoc(commWishlistRef, payload, { merge: true });
  } catch (err) {
    console.error('Erro ao salvar wishlist do usuário:', err);
  }
}

/**
 * Adiciona uma carta às "Cartas que procuro"
 */
export async function addCardToWishlist(
  userId: string,
  user: User | null,
  currentCards: WantedCardItem[],
  card: CardData,
  foilWanted: string = 'qualquer',
  notes: string = '',
  quantity: number = 1,
  priority: 'alta' | 'media' | 'baixa' = 'media'
): Promise<WantedCardItem[]> {
  if (!userId || !card) return currentCards;

  const targetCode = normalizeWishlistCode(card);
  const exists = currentCards.some(c => normalizeWishlistCode(c.cardCode) === targetCode);

  let updatedList: WantedCardItem[];
  if (exists) {
    // Atualiza opções
    updatedList = currentCards.map(c => {
      if (normalizeWishlistCode(c.cardCode) === targetCode) {
        return {
          ...c,
          foilWanted,
          notes: notes || c.notes,
          quantity: quantity || c.quantity || 1,
          priority: priority || c.priority || 'media'
        };
      }
      return c;
    });
  } else {
    const newItem: WantedCardItem = {
      cardCode: card.code || card.id,
      cardName: card.name,
      cardCollection: card.collection || '',
      imageUrl: card.imageUrl || '',
      type: card.type || '',
      frame: card.frame || '',
      foilWanted,
      quantity,
      notes,
      priority,
      addedAt: new Date().toISOString()
    };
    updatedList = [newItem, ...currentCards];
  }

  await saveUserWishlist(userId, user, updatedList);
  return updatedList;
}

/**
 * Remove uma carta da wishlist do usuário
 */
export async function removeCardFromWishlist(
  userId: string,
  user: User | null,
  currentCards: WantedCardItem[],
  cardCodeOrCard: CardData | string
): Promise<WantedCardItem[]> {
  if (!userId) return currentCards;
  const targetCode = normalizeWishlistCode(cardCodeOrCard);
  const updatedList = currentCards.filter(c => normalizeWishlistCode(c.cardCode) !== targetCode);

  await saveUserWishlist(userId, user, updatedList);
  return updatedList;
}

/**
 * Hook para gerenciar as "Cartas que procuro" do usuário conectado
 */
export function useUserWishlist(userId?: string | null, currentUser?: User | null) {
  const [wishlist, setWishlist] = useState<WantedCardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!userId) {
      setWishlist([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const wishlistRef = doc(db, 'users', userId, 'wishlist', 'data');
    const unsubscribe = onSnapshot(wishlistRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setWishlist(Array.isArray(data.cards) ? data.cards : []);
      } else {
        setWishlist([]);
      }
      setLoading(false);
    }, (err) => {
      console.warn('Erro ao escutar wishlist:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const isCardWanted = (cardOrCode?: CardData | string | null): boolean => {
    if (!cardOrCode) return false;
    const targetCode = normalizeWishlistCode(cardOrCode);
    return wishlist.some(c => normalizeWishlistCode(c.cardCode) === targetCode);
  };

  const getWantedItem = (cardOrCode?: CardData | string | null): WantedCardItem | undefined => {
    if (!cardOrCode) return undefined;
    const targetCode = normalizeWishlistCode(cardOrCode);
    return wishlist.find(c => normalizeWishlistCode(c.cardCode) === targetCode);
  };

  const addCard = async (
    card: CardData, 
    foilWanted: string = 'qualquer', 
    notes: string = '', 
    quantity: number = 1,
    priority: 'alta' | 'media' | 'baixa' = 'media'
  ) => {
    if (!userId) return;
    return await addCardToWishlist(userId, currentUser || null, wishlist, card, foilWanted, notes, quantity, priority);
  };

  const removeCard = async (cardCodeOrCard: CardData | string) => {
    if (!userId) return;
    return await removeCardFromWishlist(userId, currentUser || null, wishlist, cardCodeOrCard);
  };

  return {
    wishlist,
    loading,
    isCardWanted,
    getWantedItem,
    addCard,
    removeCard
  };
}

/**
 * Ouve a lista comunitária de wishlists para calcular as cartas mais procuradas em tempo real
 */
export function subscribeCommunityWishlists(
  onUpdate: (wishlists: UserWishlistDoc[]) => void,
  onError?: (err: any) => void
): () => void {
  const commRef = collection(db, 'communityWishlists');
  return onSnapshot(commRef, (snapshot) => {
    const list: UserWishlistDoc[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data && Array.isArray(data.cards)) {
        list.push({
          userId: docSnap.id,
          userName: data.userName || 'Jogador',
          userAvatar: data.userAvatar || '',
          userEmail: data.userEmail || '',
          cards: data.cards,
          updatedAt: data.updatedAt
        });
      }
    });
    onUpdate(list);
  }, (err) => {
    if (onError) onError(err);
  });
}

/**
 * Agrega e ranqueia as cartas mais procuradas da comunidade
 */
export function aggregateMostWantedCards(
  wishlists: UserWishlistDoc[],
  allCards: CardData[] = []
): MostWantedCardSummary[] {
  const map = new Map<string, MostWantedCardSummary>();

  // Dicionário de cartas oficiais para enriquecer dados
  const cardLookup = new Map<string, CardData>();
  for (const c of allCards) {
    const code = normalizeWishlistCode(c);
    if (code && !cardLookup.has(code)) {
      cardLookup.set(code, c);
    }
  }

  for (const userDoc of wishlists) {
    const seenCardsForThisUser = new Set<string>();

    for (const item of userDoc.cards || []) {
      const code = normalizeWishlistCode(item.cardCode);
      if (!code || seenCardsForThisUser.has(code)) continue;
      seenCardsForThisUser.add(code);

      const officialCard = cardLookup.get(code);
      const cardName = officialCard?.name || item.cardName || code;
      const cardCollection = officialCard?.collection || item.cardCollection || '';
      const imageUrl = officialCard?.imageUrl || item.imageUrl || '';
      const type = officialCard?.type || item.type || '';
      const rarity = officialCard?.rarity || '';
      const frame = officialCard?.frame || item.frame || '';

      if (!map.has(code)) {
        map.set(code, {
          cardCode: item.cardCode,
          cardName,
          cardCollection,
          imageUrl,
          type,
          rarity,
          frame,
          wantedCount: 0,
          interestedPlayers: []
        });
      }

      const summary = map.get(code)!;
      summary.wantedCount += 1;
      summary.interestedPlayers.push({
        userId: userDoc.userId,
        userName: userDoc.userName,
        userAvatar: userDoc.userAvatar,
        userEmail: userDoc.userEmail,
        foilWanted: item.foilWanted || 'qualquer',
        notes: item.notes || '',
        priority: item.priority || 'media',
        quantity: item.quantity || 1,
        addedAt: item.addedAt
      });
    }
  }

  const result = Array.from(map.values());
  // Ordena por maior número de jogadores procurando
  result.sort((a, b) => {
    if (b.wantedCount !== a.wantedCount) {
      return b.wantedCount - a.wantedCount;
    }
    return a.cardName.localeCompare(b.cardName);
  });

  return result;
}
