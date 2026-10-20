import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './firebase';
import { CardData, AlbumVerificationRequest } from './types';
import { getBaseCardCode, cleanCardCode } from './CardContext';
import { setUserCardQuantity, normalizeAlbumKey } from './albumService';

export const isCardRarePrint = (card?: CardData | null): boolean => {
  if (!card) return false;
  if (card.requiresAdminVerification) return true;
  if (card.isRarePrint) return true;
  if (typeof card.maxPrintCopies === 'number' && card.maxPrintCopies > 0) return true;
  return false;
};

/**
 * Cria uma solicitação de verificação de posse para uma carta de tiragem rara.
 */
export const createVerificationRequest = async (
  user: User,
  card: CardData,
  proofNote: string = ''
): Promise<string> => {
  if (!user || !user.uid) throw new Error('Usuário não autenticado.');
  if (!card) throw new Error('Carta inválida.');

  const baseCode = getBaseCardCode(card.code, card.parentCode);
  const cleanCode = cleanCardCode(card.code);
  const reqId = `${user.uid}_${cleanCode.replace(/[\/\s-]/g, '_')}_${Date.now()}`;
  const reqRef = doc(db, 'albumVerificationRequests', reqId);

  const requestData: AlbumVerificationRequest = {
    id: reqId,
    userId: user.uid,
    userEmail: user.email || '',
    userName: user.displayName || user.email?.split('@')[0] || 'Colecionador',
    userPhoto: user.photoURL || undefined,
    cardCode: cleanCode,
    baseCardCode: baseCode,
    cardName: card.name,
    cardImageUrl: card.imageUrl || undefined,
    cardCollection: card.collection || '',
    cardFrame: card.frame || 'Moderno',
    maxPrintCopies: card.maxPrintCopies || 1,
    proofNote: proofNote.trim(),
    status: 'pending',
    requestedAt: new Date().toISOString()
  };

  await setDoc(reqRef, {
    ...requestData,
    createdAt: serverTimestamp()
  });

  return reqId;
};

/**
 * Ouve em tempo real todas as solicitações pendentes para o painel / perfil do Administrador.
 */
export const subscribePendingVerificationRequests = (
  callback: (requests: AlbumVerificationRequest[]) => void
) => {
  const reqCol = collection(db, 'albumVerificationRequests');
  return onSnapshot(reqCol, (snap) => {
    const list: AlbumVerificationRequest[] = [];
    snap.forEach((d) => {
      const data = d.data() as AlbumVerificationRequest;
      if (data.status === 'pending') {
        list.push({ ...data, id: d.id });
      }
    });
    // Ordena da mais recente para a mais antiga
    list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    callback(list);
  }, (err) => {
    console.error('Erro ao ouvir solicitações pendentes de tiragem rara:', err);
    callback([]);
  });
};

/**
 * Ouve em tempo real todas as solicitações (pendentes, aprovadas, recusadas).
 */
export const subscribeAllVerificationRequests = (
  callback: (requests: AlbumVerificationRequest[]) => void
) => {
  const reqCol = collection(db, 'albumVerificationRequests');
  return onSnapshot(reqCol, (snap) => {
    const list: AlbumVerificationRequest[] = [];
    snap.forEach((d) => {
      const data = d.data() as AlbumVerificationRequest;
      list.push({ ...data, id: d.id });
    });
    list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    callback(list);
  }, (err) => {
    console.error('Erro ao ouvir todas as solicitações de tiragem rara:', err);
    callback([]);
  });
};

/**
 * Ouve em tempo real as solicitações enviadas por um usuário específico.
 */
export const subscribeUserVerificationRequests = (
  userId: string,
  callback: (requests: AlbumVerificationRequest[]) => void
) => {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const reqCol = collection(db, 'albumVerificationRequests');
  return onSnapshot(reqCol, (snap) => {
    const list: AlbumVerificationRequest[] = [];
    snap.forEach((d) => {
      const data = d.data() as AlbumVerificationRequest;
      if (data.userId === userId) {
        list.push({ ...data, id: d.id });
      }
    });
    list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
    callback(list);
  }, (err) => {
    console.error('Erro ao ouvir solicitações do usuário:', err);
    callback([]);
  });
};

/**
 * Aprova e confirma a posse de uma carta rara no álbum do jogador.
 */
export const approveVerificationRequest = async (
  request: AlbumVerificationRequest,
  adminEmail: string
) => {
  if (!request || !request.id) return;

  const reqRef = doc(db, 'albumVerificationRequests', request.id);
  await updateDoc(reqRef, {
    status: 'approved',
    resolvedAt: new Date().toISOString(),
    resolvedBy: adminEmail
  });

  // Credita a carta no álbum do usuário autenticado como verificado
  const cardObj: CardData = {
    code: request.cardCode,
    name: request.cardName,
    imageUrl: request.cardImageUrl,
    frame: (request.cardFrame as any) || 'Moderno',
    type: 'Herói',
    archetype: '',
    collection: request.cardCollection || '',
    ct: 0,
    description: ''
  };

  await setUserCardQuantity(request.userId, cardObj, 1, request.cardFrame);
};

/**
 * Recusa a solicitação de posse com nota explicativa.
 */
export const rejectVerificationRequest = async (
  requestId: string,
  adminNote: string = '',
  adminEmail: string = ''
) => {
  if (!requestId) return;
  const reqRef = doc(db, 'albumVerificationRequests', requestId);
  await updateDoc(reqRef, {
    status: 'rejected',
    resolvedAt: new Date().toISOString(),
    resolvedBy: adminEmail,
    adminNote: adminNote.trim()
  });
};

/**
 * Exclui permanentemente uma solicitação de verificação.
 */
export const deleteVerificationRequest = async (requestId: string) => {
  if (!requestId) return;
  await deleteDoc(doc(db, 'albumVerificationRequests', requestId));
};
