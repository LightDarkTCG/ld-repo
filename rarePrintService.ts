import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './firebase';
import { CardData, AlbumVerificationRequest, RarePrintOwner } from './types';
import { getBaseCardCode, cleanCardCode } from './CardContext';
import { setUserCardQuantity, normalizeAlbumKey, getVariationArtHash } from './albumService';

export interface RegisteredSiteUser {
  userId: string;
  displayName: string;
  email: string;
  photoURL?: string;
}

export const isCardRarePrint = (card?: CardData | null): boolean => {
  if (!card) return false;
  if (card.requiresAdminVerification) return true;
  if (card.isRarePrint) return true;
  if (typeof card.maxPrintCopies === 'number' && card.maxPrintCopies > 0) return true;
  if (Array.isArray(card.rarePrintOwners) && card.rarePrintOwners.length > 0) return true;
  return false;
};

export const getCardRarePrintOwners = (card?: CardData | null): RarePrintOwner[] => {
  if (!card || !Array.isArray(card.rarePrintOwners)) return [];
  return card.rarePrintOwners.filter(o => o && o.userId);
};

export const hasAssignedRarePrintOwners = (card?: CardData | null): boolean => {
  return getCardRarePrintOwners(card).length > 0;
};

export const isUserOfficialRarePrintOwner = (card?: CardData | null, userId?: string | null): boolean => {
  if (!userId) return false;
  const owners = getCardRarePrintOwners(card);
  return owners.some(o => o.userId === userId);
};

/**
 * Busca todos os usuários cadastrados no banco do site (unificando /users e /collectorsRanking)
 */
export const fetchRegisteredUsers = async (): Promise<RegisteredSiteUser[]> => {
  const userMap = new Map<string, RegisteredSiteUser>();

  try {
    const [usersSnap, rankSnap] = await Promise.all([
      getDocs(collection(db, 'users')).catch(() => null),
      getDocs(collection(db, 'collectorsRanking')).catch(() => null)
    ]);

    if (rankSnap) {
      rankSnap.forEach(d => {
        const data = d.data();
        const uid = d.id;
        if (!uid) return;
        userMap.set(uid, {
          userId: uid,
          displayName: (data.displayName || data.name || data.email?.split('@')[0] || 'Jogador').trim(),
          email: (data.email || '').trim(),
          photoURL: data.photoURL || undefined
        });
      });
    }

    if (usersSnap) {
      usersSnap.forEach(d => {
        const data = d.data();
        const uid = d.id;
        if (!uid) return;
        const existing = userMap.get(uid);
        const displayName = (data.displayName || data.name || existing?.displayName || data.email?.split('@')[0] || 'Jogador').trim();
        const email = (data.email || existing?.email || '').trim();
        const photoURL = data.photoURL || existing?.photoURL || undefined;
        userMap.set(uid, {
          userId: uid,
          displayName,
          email,
          photoURL
        });
      });
    }
  } catch (err) {
    console.error('Erro ao buscar banco de cadastros de usuários:', err);
  }

  return Array.from(userMap.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, 'pt-BR', { sensitivity: 'base' })
  );
};

/**
 * Retorna todas as chaves possíveis pelas quais esta versão específica de carta pode estar salva no álbum
 */
export const getCandidateAlbumKeysForCard = (card: CardData): string[] => {
  const keys = new Set<string>();
  const primary = normalizeAlbumKey(card);
  if (primary) keys.add(primary);

  const withExplicitFrame = normalizeAlbumKey(card, card.frame);
  if (withExplicitFrame) keys.add(withExplicitFrame);

  if ((card as any).albumKey) {
    keys.add((card as any).albumKey);
  }

  // Se for variação com imagem própria, também adiciona a chave com hash de arte para cobrir variações
  if (card.isVariation && card.imageUrl) {
    const baseWithoutVar = (primary || '').split('_VAR_')[0];
    if (baseWithoutVar) {
      keys.add(`${baseWithoutVar}_VAR_${getVariationArtHash(card)}`);
    }
  }

  return Array.from(keys).filter(Boolean);
};

/**
 * Sincroniza a posse de uma carta de tiragem limitada:
 * 1. Garante que o(s) dono(s) selecionado(s) recebam a carta em seus álbuns.
 * 2. Varre todos os outros cadastros do site e remove automaticamente a carta do álbum de quem NÃO for o dono.
 */
export const syncRarePrintOwnershipAcrossAlbums = async (
  card: CardData,
  owners: RarePrintOwner[]
): Promise<{
  creditedCount: number;
  removedFromUsersCount: number;
  removedFromUserNames: string[];
}> => {
  const candidateKeys = getCandidateAlbumKeysForCard(card);
  const primaryKey = normalizeAlbumKey(card) || candidateKeys[0];
  if (!primaryKey || candidateKeys.length === 0) {
    return { creditedCount: 0, removedFromUsersCount: 0, removedFromUserNames: [] };
  }

  const validOwners = (owners || []).filter(o => o && o.userId);
  const ownerIdsSet = new Set(validOwners.map(o => o.userId));
  const nowIso = new Date().toISOString();

  let creditedCount = 0;
  let removedFromUsersCount = 0;
  const removedFromUserNames: string[] = [];

  // 1. Credita a carta no álbum de cada dono oficial
  for (const owner of validOwners) {
    try {
      const albumRef = doc(db, 'users', owner.userId, 'album', 'data');
      const albumSnap = await getDoc(albumRef);
      const currentCards = albumSnap.exists() ? (albumSnap.data()?.cards || {}) : {};
      const existingEntry = currentCards[primaryKey];
      const targetQty = Math.max(existingEntry?.quantity || 0, owner.copies || 1);

      await setDoc(albumRef, {
        cards: {
          [primaryKey]: {
            ...(existingEntry || {}),
            quantity: targetQty,
            updatedAt: nowIso
          }
        },
        lastUpdated: serverTimestamp()
      }, { merge: true });
      creditedCount++;
    } catch (err) {
      console.warn(`Erro ao creditar carta limitada para o dono ${owner.userId}:`, err);
    }
  }

  // 2. Se há dono(s) definido(s), remove automaticamente dos álbuns de todos os outros usuários cadastrados
  if (validOwners.length > 0) {
    const allRegistered = await fetchRegisteredUsers();
    for (const regUser of allRegistered) {
      if (ownerIdsSet.has(regUser.userId)) continue;

      try {
        const otherAlbumRef = doc(db, 'users', regUser.userId, 'album', 'data');
        const otherSnap = await getDoc(otherAlbumRef);
        if (!otherSnap.exists()) continue;

        const otherCards = otherSnap.data()?.cards || {};
        const updates: Record<string, any> = {};
        let hadCard = false;

        for (const k of candidateKeys) {
          if (otherCards[k] && (otherCards[k].quantity > 0 || (otherCards[k].foils && otherCards[k].foils.length > 0))) {
            updates[k] = {
              quantity: 0,
              foils: [],
              updatedAt: nowIso
            };
            hadCard = true;
          }
        }

        if (hadCard) {
          await setDoc(otherAlbumRef, {
            cards: updates,
            lastUpdated: serverTimestamp()
          }, { merge: true });
          removedFromUsersCount++;
          removedFromUserNames.push(regUser.displayName || regUser.email || regUser.userId);
        }
      } catch (err) {
        console.warn(`Erro ao verificar/remover carta limitada do álbum de ${regUser.userId}:`, err);
      }
    }
  }

  return {
    creditedCount,
    removedFromUsersCount,
    removedFromUserNames
  };
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
