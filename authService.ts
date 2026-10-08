import { useState, useEffect } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  updateProfile,
  User 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export const ADMIN_EMAILS: string[] = [
  'viniciuspdiasuzumaki@gmail.com'
];

export const isUserAdmin = (user: User | null): boolean => {
  if (!user || !user.email) return false;
  return ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase());
};

export const loginWithGoogle = async (): Promise<User | null> => {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Registra ou atualiza o perfil básico do usuário no Firestore
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName || 'Jogador',
          email: user.email || '',
          photoURL: user.photoURL || '',
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        });
      } else {
        await setDoc(userRef, {
          displayName: user.displayName || 'Jogador',
          photoURL: user.photoURL || '',
          lastLoginAt: serverTimestamp()
        }, { merge: true });
      }
    }

    return user;
  } catch (error: any) {
    console.error('Erro ao autenticar com Google:', error);
    throw error;
  }
};

export const logoutGoogle = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Erro ao deslogar:', error);
    throw error;
  }
};

export const updateUserDisplayName = async (newName: string): Promise<void> => {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('O nome não pode ser vazio.');
  if (trimmed.length > 30) throw new Error('O nome deve ter no máximo 30 caracteres.');

  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Usuário não autenticado.');

  // Atualiza perfil no Firebase Auth
  await updateProfile(currentUser, { displayName: trimmed });

  // Atualiza perfil na coleção do Firestore
  const userRef = doc(db, 'users', currentUser.uid);
  await setDoc(userRef, {
    displayName: trimmed,
    lastLoginAt: serverTimestamp()
  }, { merge: true });
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(isUserAdmin(auth.currentUser));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAdmin(isUserAdmin(currentUser));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const changeDisplayName = async (newName: string) => {
    await updateUserDisplayName(newName);
    if (auth.currentUser) {
      // Cria uma nova referência com as propriedades atualizadas
      setUser(Object.assign(Object.create(Object.getPrototypeOf(auth.currentUser)), auth.currentUser));
    }
  };

  return {
    user,
    loading,
    isAdmin,
    loginWithGoogle,
    logoutGoogle,
    changeDisplayName
  };
};
