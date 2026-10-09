import { useState, useEffect } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  updateProfile,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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

export const getFriendlyAuthErrorMessage = (error: any): string => {
  if (!error) return 'Erro desconhecido ao autenticar.';
  const code = error.code || '';
  switch (code) {
    case 'auth/unauthorized-domain':
      return 'O domínio deste site ainda não foi adicionado à lista de domínios autorizados no Firebase Authentication. Você pode entrar com Apelido logo abaixo para continuar salvando seu álbum e decks normalmente!';
    case 'auth/popup-closed-by-user':
      return 'A janela de login com Google foi fechada antes de concluir.';
    case 'auth/popup-blocked':
      return 'O seu navegador bloqueou a janela pop-up do Google. Por favor, autorize pop-ups para este site ou entre usando Apelido.';
    case 'auth/cancelled-popup-request':
      return 'A solicitação de login foi cancelada.';
    case 'auth/operation-not-allowed':
      return 'O provedor de login com Google não está ativo no Firebase Console. Utilize a opção de login com Apelido abaixo.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Senha incorreta ou credenciais inválidas.';
    case 'auth/user-not-found':
      return 'Nenhum usuário encontrado com este e-mail.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está em uso por outra conta.';
    case 'auth/weak-password':
      return 'A senha deve ter pelo menos 6 caracteres.';
    case 'auth/invalid-email':
      return 'Formato de e-mail inválido.';
    default:
      return error.message || 'Falha ao autenticar com Google. Tente novamente ou use a opção de Apelido.';
  }
};

const syncUserProfile = async (user: User, fallbackName?: string) => {
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    const displayName = user.displayName || fallbackName || 'Jogador';
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        email: user.email || '',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      });
    } else {
      await setDoc(userRef, {
        displayName: user.displayName || displayName,
        photoURL: user.photoURL || '',
        lastLoginAt: serverTimestamp()
      }, { merge: true });
    }
  } catch (firestoreErr) {
    console.warn('Não foi possível sincronizar perfil no Firestore:', firestoreErr);
  }
};

export const loginWithGoogle = async (): Promise<User> => {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    if (user) {
      await syncUserProfile(user);
    }
    return user;
  } catch (error: any) {
    console.error('Erro ao autenticar com Google:', error);
    throw error;
  }
};

export const loginWithGuest = async (nickname: string): Promise<User> => {
  const cleanName = nickname.trim() || 'Jogador';
  try {
    const result = await signInAnonymously(auth);
    const user = result.user;
    if (user) {
      await updateProfile(user, { displayName: cleanName });
      await syncUserProfile(user, cleanName);
    }
    return user;
  } catch (error: any) {
    console.error('Erro ao autenticar com convidado:', error);
    throw error;
  }
};

export const loginWithEmail = async (email: string, pass: string): Promise<User> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
    const user = result.user;
    if (user) {
      await syncUserProfile(user);
    }
    return user;
  } catch (error: any) {
    console.error('Erro ao autenticar com email/senha:', error);
    throw error;
  }
};

export const registerWithEmail = async (email: string, pass: string, name: string): Promise<User> => {
  const cleanName = name.trim() || 'Jogador';
  try {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    const user = result.user;
    if (user) {
      await updateProfile(user, { displayName: cleanName });
      await syncUserProfile(user, cleanName);
    }
    return user;
  } catch (error: any) {
    console.error('Erro ao cadastrar com email/senha:', error);
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
  try {
    await setDoc(userRef, {
      displayName: trimmed,
      lastLoginAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('Erro ao atualizar nome no Firestore:', err);
  }
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
      setUser(Object.assign(Object.create(Object.getPrototypeOf(auth.currentUser)), auth.currentUser));
    }
  };

  return {
    user,
    loading,
    isAdmin,
    loginWithGoogle,
    loginWithGuest,
    loginWithEmail,
    registerWithEmail,
    logoutGoogle,
    changeDisplayName
  };
};
