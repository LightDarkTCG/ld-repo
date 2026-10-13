import { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from './firebase';

export interface UserSavedDeck {
  id: string;
  name: string;
  heroName?: string;
  mainDeckCodes: string[];
  sideDeckCodes: string[];
  cardCount: number;
  coverImageUrl?: string;
  createdAt?: any;
  updatedAt?: any;
}

export const saveUserDeckToFirestore = async (
  userId: string,
  deckData: {
    id?: string;
    name: string;
    heroName?: string;
    mainDeckCodes: string[];
    sideDeckCodes: string[];
    coverImageUrl?: string;
  }
): Promise<string> => {
  if (!userId) throw new Error('Usuário não autenticado.');
  
  const deckId = deckData.id || `deck_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const deckRef = doc(db, 'users', userId, 'savedDecks', deckId);

  const currentUser = auth.currentUser;
  const isEmailAccount = Boolean(
    currentUser && 
    !currentUser.isAnonymous && 
    currentUser.email && 
    currentUser.email.includes('@')
  );

  const payload: UserSavedDeck & { isEmailAccount?: boolean; userEmail?: string } = {
    id: deckId,
    name: (deckData.name || 'Meu Deck').trim(),
    heroName: deckData.heroName || '',
    mainDeckCodes: deckData.mainDeckCodes || [],
    sideDeckCodes: deckData.sideDeckCodes || [],
    cardCount: (deckData.mainDeckCodes || []).length,
    coverImageUrl: deckData.coverImageUrl || '',
    updatedAt: serverTimestamp(),
    isEmailAccount,
    userEmail: currentUser?.email || ''
  };

  if (!deckData.id) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(deckRef, payload, { merge: true });

  // Espelha na coleção global da comunidade para contabilização das cartas populares
  // Somente decks de usuários cadastrados com e-mail e senha
  try {
    const communityRef = doc(db, 'communityDecks', deckId);
    if (isEmailAccount) {
      await setDoc(communityRef, {
        ...payload,
        userId,
        isEmailAccount: true,
        userEmail: currentUser?.email || ''
      }, { merge: true });
    } else {
      await deleteDoc(communityRef).catch(() => {});
    }
  } catch (err) {
    console.warn('Não foi possível espelhar na coleção da comunidade:', err);
  }

  return deckId;
};

export const deleteUserDeckFromFirestore = async (
  userId: string,
  deckId: string
): Promise<void> => {
  if (!userId || !deckId) return;
  const deckRef = doc(db, 'users', userId, 'savedDecks', deckId);
  await deleteDoc(deckRef);

  try {
    const communityRef = doc(db, 'communityDecks', deckId);
    await deleteDoc(communityRef);
  } catch (err) {
    // Silencioso se não existir
  }
};

export const useSavedDecks = (userId?: string | null) => {
  const [decks, setDecks] = useState<UserSavedDeck[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!userId) {
      setDecks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const decksCollection = collection(db, 'users', userId, 'savedDecks');
    const q = query(decksCollection, orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: UserSavedDeck[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push(docSnap.data() as UserSavedDeck);
      });
      setDecks(fetched);
      setLoading(false);
    }, (err) => {
      console.error('Erro ao ouvir decks salvos:', err);
      // Fallback query sem orderBy caso o índice ainda esteja sendo criado
      const fallbackUnsub = onSnapshot(decksCollection, (fallbackSnap) => {
        const list: UserSavedDeck[] = [];
        fallbackSnap.forEach(d => list.push(d.data() as UserSavedDeck));
        setDecks(list);
        setLoading(false);
      }, (fallbackErr) => {
        console.warn('Erro ao carregar decks sem orderBy:', fallbackErr);
        setLoading(false);
      });
      return () => fallbackUnsub();
    });

    return () => unsubscribe();
  }, [userId]);

  return {
    decks,
    loading,
    saveDeck: (deckData: { id?: string; name: string; heroName?: string; mainDeckCodes: string[]; sideDeckCodes: string[]; coverImageUrl?: string; }) => 
      saveUserDeckToFirestore(userId!, deckData),
    deleteDeck: (deckId: string) => deleteUserDeckFromFirestore(userId!, deckId)
  };
};
