import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

let firestoreDb: Firestore;
try {
  if (typeof window !== 'undefined') {
    firestoreDb = initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      },
      firebaseConfig.firestoreDatabaseId
    );
  } else {
    firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
} catch {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export const storage = getStorage(app);

/**
 * Lê dados em cache do navegador (localStorage) de forma síncrona para exibição instantânea (0ms)
 * sem piscar configurações antigas enquanto o Firebase sincroniza em tempo real.
 */
export function readBrowserCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Salva os dados mais recentes do Firebase no cache do navegador (localStorage).
 */
export function writeBrowserCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Caso o armazenamento local esteja cheio, limpa chaves antigas e tenta novamente
    try {
      window.localStorage.removeItem(key);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignora silenciosamente se o navegador bloquear localStorage
    }
  }
}

