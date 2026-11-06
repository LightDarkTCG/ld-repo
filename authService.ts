import { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth,
  signOut, 
  onAuthStateChanged, 
  updateProfile,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User 
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db, readBrowserCache, writeBrowserCache } from './firebase';
import firebaseConfig from './firebase-applet-config.json';
import { CollaboratorProfile } from './types';

export const ADMIN_EMAILS: string[] = [
  'viniciuspdiasuzumaki@gmail.com'
];

const COLLABORATORS_CACHE_KEY = 'ld_cache_collaborators_v1';

let cachedCollaborators: CollaboratorProfile[] =
  readBrowserCache<CollaboratorProfile[]>(COLLABORATORS_CACHE_KEY) || [];

const collabListeners = new Set<(list: CollaboratorProfile[]) => void>();
let collabSnapshotInitialized = false;

function notifyCollaboratorListeners(list: CollaboratorProfile[]) {
  cachedCollaborators = list;
  writeBrowserCache(COLLABORATORS_CACHE_KEY, list);
  collabListeners.forEach((cb) => cb(list));
}

function ensureCollaboratorsListener() {
  if (collabSnapshotInitialized || typeof window === 'undefined') return;
  collabSnapshotInitialized = true;
  try {
    onSnapshot(
      doc(db, 'appSettings', 'collaborators'),
      (snap) => {
        if (snap.exists() && Array.isArray(snap.data()?.list)) {
          notifyCollaboratorListeners(snap.data().list as CollaboratorProfile[]);
        } else {
          notifyCollaboratorListeners([]);
        }
      },
      () => {
        // Fallback silencioso
      }
    );
  } catch {
    // ignore
  }
}

export const isUserAdmin = (user: User | null): boolean => {
  if (!user || !user.email) return false;
  return ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase());
};

export const getCollaboratorProfile = (user: User | null, listOverride?: CollaboratorProfile[]): CollaboratorProfile | null => {
  if (!user) return null;
  ensureCollaboratorsListener();
  const list = listOverride || cachedCollaborators;
  const emailLower = (user.email || '').trim().toLowerCase();
  return (
    list.find(
      (c) =>
        (c.uid && c.uid === user.uid) ||
        (emailLower && c.email.trim().toLowerCase() === emailLower)
    ) || null
  );
};

export const isUserCollaborator = (user: User | null): boolean => {
  if (!user) return false;
  return Boolean(getCollaboratorProfile(user));
};

export const canUserEditLore = (user: User | null): boolean => {
  if (!user) return false;
  if (isUserAdmin(user)) return true;
  const collab = getCollaboratorProfile(user);
  return Boolean(collab && collab.canEditLore !== false);
};

export const canUserEditCardLore = (user: User | null): boolean => {
  if (!user) return false;
  if (isUserAdmin(user)) return true;
  const collab = getCollaboratorProfile(user);
  return Boolean(collab && collab.canEditCardLore !== false);
};

export async function fetchCollaboratorsList(): Promise<CollaboratorProfile[]> {
  ensureCollaboratorsListener();
  try {
    const snap = await getDoc(doc(db, 'appSettings', 'collaborators'));
    if (snap.exists() && Array.isArray(snap.data()?.list)) {
      const list = snap.data().list as CollaboratorProfile[];
      notifyCollaboratorListeners(list);
      return list;
    }
  } catch (err) {
    console.warn('Erro ao buscar lista de colaboradores:', err);
  }
  return cachedCollaborators;
}

export async function createOrSaveCollaboratorUser(params: {
  email: string;
  password?: string;
  displayName: string;
  roleTitle?: string;
  canEditLore?: boolean;
  canEditCardLore?: boolean;
  existingUid?: string;
}): Promise<{ list: CollaboratorProfile[]; createdNewAuthAccount: boolean }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanName = params.displayName.trim() || cleanEmail.split('@')[0] || 'Colaborador';
  const cleanRole = (params.roleTitle || 'Colaborador de Lore & Dados').trim();
  const canEditLore = params.canEditLore !== false;
  const canEditCardLore = params.canEditCardLore !== false;

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Informe um e-mail válido para o colaborador.');
  }

  let resolvedUid = params.existingUid || '';
  let createdNewAuthAccount = false;

  // Se uma senha foi informada, criamos a conta no Firebase Auth usando uma instância secundária
  // para NÃO deslogar o Administrador atual!
  if (params.password && params.password.trim().length > 0) {
    if (params.password.trim().length < 6) {
      throw new Error('A senha do novo usuário colaborador deve ter pelo menos 6 caracteres.');
    }
    const secondaryAppName = 'CollaboratorCreatorApp';
    const secondaryApp = getApps().some((a) => a.name === secondaryAppName)
      ? getApp(secondaryAppName)
      : initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, params.password.trim());
      if (cred.user) {
        resolvedUid = cred.user.uid;
        createdNewAuthAccount = true;
        await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
      }
      await signOut(secondaryAuth).catch(() => {});
    } catch (authErr: any) {
      await signOut(secondaryAuth).catch(() => {});
      if (authErr?.code === 'auth/email-already-in-use') {
        // Se o e-mail já tem conta no site, apenas promovemos a conta existente a Colaborador
        createdNewAuthAccount = false;
      } else {
        throw new Error(getFriendlyAuthErrorMessage(authErr));
      }
    }
  }

  const currentList = await fetchCollaboratorsList();
  const existingEntry = currentList.find((c) => c.email.toLowerCase() === cleanEmail);
  const finalUid = resolvedUid || existingEntry?.uid || undefined;

  const newEntry: CollaboratorProfile = {
    ...(finalUid ? { uid: finalUid } : {}),
    email: cleanEmail,
    displayName: cleanName,
    roleTitle: cleanRole,
    canEditLore,
    canEditCardLore,
    createdAt: existingEntry?.createdAt || new Date().toISOString(),
    createdBy: auth.currentUser?.email || 'admin'
  };

  const nextList = [
    ...currentList.filter((c) => c.email.toLowerCase() !== cleanEmail),
    newEntry
  ];

  // Salva na configuração global de colaboradores
  await setDoc(
    doc(db, 'appSettings', 'collaborators'),
    JSON.parse(
      JSON.stringify({
        list: nextList,
        updatedAt: new Date().toISOString()
      })
    ),
    { merge: true }
  );

  // Se temos o UID do colaborador, já gravamos o documento /collaborators/{uid} e /users/{uid}
  if (finalUid) {
    await setDoc(
      doc(db, 'collaborators', finalUid),
      JSON.parse(JSON.stringify(newEntry)),
      { merge: true }
    ).catch(() => {});

    await setDoc(
      doc(db, 'users', finalUid),
      {
        uid: finalUid,
        displayName: cleanName,
        email: cleanEmail,
        isCollaborator: true,
        collaboratorRole: cleanRole,
        lastLoginAt: serverTimestamp()
      },
      { merge: true }
    ).catch(() => {});
  }

  notifyCollaboratorListeners(nextList);
  return { list: nextList, createdNewAuthAccount };
}

export async function removeCollaboratorUser(email: string, uid?: string): Promise<CollaboratorProfile[]> {
  const cleanEmail = email.trim().toLowerCase();
  const currentList = await fetchCollaboratorsList();
  const target = currentList.find((c) => c.email.toLowerCase() === cleanEmail);
  const targetUid = uid || target?.uid;

  const nextList = currentList.filter((c) => c.email.toLowerCase() !== cleanEmail);

  await setDoc(
    doc(db, 'appSettings', 'collaborators'),
    JSON.parse(
      JSON.stringify({
        list: nextList,
        updatedAt: new Date().toISOString()
      })
    ),
    { merge: true }
  );

  if (targetUid) {
    await deleteDoc(doc(db, 'collaborators', targetUid)).catch(() => {});
    await setDoc(
      doc(db, 'users', targetUid),
      {
        isCollaborator: false,
        collaboratorRole: ''
      },
      { merge: true }
    ).catch(() => {});
  }

  notifyCollaboratorListeners(nextList);
  return nextList;
}

export const getFriendlyAuthErrorMessage = (error: any): string => {
  if (!error) return 'Erro desconhecido ao autenticar.';
  const code = error.code || '';
  switch (code) {
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
    case 'auth/network-request-failed':
      return 'Erro de conexão com o servidor. Verifique sua internet.';
    default:
      return error.message || 'Falha ao autenticar. Tente novamente.';
  }
};

const syncUserProfile = async (user: User, fallbackName?: string) => {
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    const displayName = user.displayName || fallbackName || 'Jogador';

    // Verifica se o e-mail do usuário está na lista de colaboradores autorizados
    const collabList = await fetchCollaboratorsList();
    const matchedCollab = user.email
      ? collabList.find((c) => c.email.toLowerCase() === user.email!.toLowerCase())
      : undefined;

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        email: user.email || '',
        photoURL: user.photoURL || '',
        ...(matchedCollab
          ? { isCollaborator: true, collaboratorRole: matchedCollab.roleTitle }
          : {}),
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      });
    } else {
      await setDoc(userRef, {
        displayName: user.displayName || displayName,
        photoURL: user.photoURL || '',
        ...(matchedCollab
          ? { isCollaborator: true, collaboratorRole: matchedCollab.roleTitle }
          : {}),
        lastLoginAt: serverTimestamp()
      }, { merge: true });
    }

    // Se for colaborador, garante que o documento /collaborators/{uid} exista para as regras do Firestore
    if (matchedCollab) {
      const updatedEntry: CollaboratorProfile = {
        ...matchedCollab,
        uid: user.uid,
        displayName: matchedCollab.displayName || displayName
      };
      await setDoc(
        doc(db, 'collaborators', user.uid),
        JSON.parse(JSON.stringify(updatedEntry)),
        { merge: true }
      ).catch(() => {});

      if (!matchedCollab.uid) {
        const nextList = collabList.map((c) =>
          c.email.toLowerCase() === matchedCollab.email.toLowerCase() ? updatedEntry : c
        );
        await setDoc(
          doc(db, 'appSettings', 'collaborators'),
          JSON.parse(JSON.stringify({ list: nextList, updatedAt: new Date().toISOString() })),
          { merge: true }
        ).catch(() => {});
        notifyCollaboratorListeners(nextList);
      }
    }
  } catch (firestoreErr) {
    console.warn('Não foi possível sincronizar perfil no Firestore:', firestoreErr);
  }
};

// Deprecated fallback: se alguma tela antiga chamar, usa login com apelido rápido
export const loginWithGoogle = async (): Promise<User> => {
  return loginWithGuest('Jogador');
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

export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Erro ao deslogar:', error);
    throw error;
  }
};
export const logoutGoogle = logout;

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
  const [collaborators, setCollaborators] = useState<CollaboratorProfile[]>(() => {
    ensureCollaboratorsListener();
    return cachedCollaborators;
  });

  useEffect(() => {
    ensureCollaboratorsListener();
    const handleCollabUpdate = (list: CollaboratorProfile[]) => {
      setCollaborators([...list]);
    };
    collabListeners.add(handleCollabUpdate);

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAdmin(isUserAdmin(currentUser));
      setLoading(false);
      if (currentUser) {
        syncUserProfile(currentUser).catch(() => {});
      }
    });

    return () => {
      collabListeners.delete(handleCollabUpdate);
      unsubscribe();
    };
  }, []);

  const collaboratorProfile = getCollaboratorProfile(user, collaborators);
  const isCollaborator = Boolean(collaboratorProfile);
  const canEditLore = Boolean(isAdmin || (collaboratorProfile && collaboratorProfile.canEditLore !== false));
  const canEditCardLore = Boolean(isAdmin || (collaboratorProfile && collaboratorProfile.canEditCardLore !== false));

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
    isCollaborator,
    collaboratorProfile,
    canEditLore,
    canEditCardLore,
    collaborators,
    loginWithGoogle,
    loginWithGuest,
    loginWithEmail,
    registerWithEmail,
    logoutGoogle,
    logout: logoutGoogle,
    changeDisplayName
  };
};

