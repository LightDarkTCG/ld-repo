import { collection, doc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './firebase';
import { UserAlbumMap, normalizeAlbumKey } from './albumService';
import { CardData } from './types';
import { isLegacyCard, isSpecialCard } from './components/AlbumModal';

export interface CollectorRankEntry {
  userId: string;
  displayName: string;
  email?: string;
  photoURL?: string;
  uniqueCards: number;
  totalCopies: number;
  uniqueLegado: number;
  uniqueModerno: number;
  specialCards: number;
  completionPercentage: number;
  isAmbassador?: boolean; // Colecionador é Embaixador Oficial do jogo
  ambassadorRole?: string; // Ex: 'Embaixador Oficial', 'Criador & Embaixador'
  ambassadorAssignedBy?: string; // Email do administrador que nomeou
  ambassadorAssignedAt?: any; // Data da nomeação
  updatedAt?: any;
}

export type CollectorSortCriteria = 'unique' | 'total' | 'legado' | 'moderno' | 'special';

/**
 * Sincroniza as estatísticas de colecionador do usuário com o ranking comunitário na nuvem
 */
export async function syncUserCollectorStats(
  userId: string,
  user: User | null,
  albumCards: UserAlbumMap,
  allCards: CardData[]
): Promise<CollectorRankEntry | null> {
  if (!userId || !user) return null;

  let uniqueCards = 0;
  let totalCopies = 0;
  let uniqueLegado = 0;
  let uniqueModerno = 0;
  let specialCards = 0;

  // Mapa de todas as cartas pelo código normalizado
  const cardMap = new Map<string, CardData>();
  for (const c of allCards) {
    const k = normalizeAlbumKey(c);
    if (k && !cardMap.has(k)) {
      cardMap.set(k, c);
    }
  }

  Object.entries(albumCards || {}).forEach(([key, entry]) => {
    const qty = entry?.quantity || 0;
    if (qty > 0) {
      uniqueCards++;
      totalCopies += qty;

      const card = cardMap.get(key);
      if (card) {
        if (isLegacyCard(card)) {
          uniqueLegado++;
        } else {
          uniqueModerno++;
        }
        if (isSpecialCard(card)) {
          specialCards++;
        }
      } else {
        if (key.endsWith('_MOD')) {
          uniqueModerno++;
        } else {
          uniqueLegado++;
        }
      }
    }
  });

  const totalCatalogueCount = cardMap.size > 0 ? cardMap.size : 355;
  const completionPercentage = Math.min(100, Math.round((uniqueCards / totalCatalogueCount) * 100));

  const displayName = user.displayName?.trim() || user.email?.split('@')[0] || 'Colecionador';

  const rankEntry: CollectorRankEntry = {
    userId,
    displayName,
    email: user.email || '',
    photoURL: user.photoURL || '',
    uniqueCards,
    totalCopies,
    uniqueLegado,
    uniqueModerno,
    specialCards,
    completionPercentage,
    updatedAt: serverTimestamp()
  };

  try {
    const rankRef = doc(db, 'collectorsRanking', userId);
    await setDoc(rankRef, rankEntry, { merge: true });
  } catch (err) {
    console.warn('Erro ao sincronizar ranking de colecionador:', err);
  }

  return rankEntry;
}

/**
 * Busca e ordena a lista de colecionadores pelo critério selecionado
 */
export function sortCollectors(
  collectors: CollectorRankEntry[],
  criteria: CollectorSortCriteria
): CollectorRankEntry[] {
  return [...collectors].sort((a, b) => {
    switch (criteria) {
      case 'total':
        if (b.totalCopies !== a.totalCopies) return b.totalCopies - a.totalCopies;
        return b.uniqueCards - a.uniqueCards;
      case 'legado':
        if (b.uniqueLegado !== a.uniqueLegado) return b.uniqueLegado - a.uniqueLegado;
        return b.uniqueCards - a.uniqueCards;
      case 'moderno':
        if (b.uniqueModerno !== a.uniqueModerno) return b.uniqueModerno - a.uniqueModerno;
        return b.uniqueCards - a.uniqueCards;
      case 'special':
        if (b.specialCards !== a.specialCards) return b.specialCards - a.specialCards;
        return b.uniqueCards - a.uniqueCards;
      case 'unique':
      default:
        if (b.uniqueCards !== a.uniqueCards) return b.uniqueCards - a.uniqueCards;
        return b.totalCopies - a.totalCopies;
    }
  });
}

/**
 * Ouve o ranking de colecionadores em tempo real
 */
export function subscribeCollectorsRanking(
  onUpdate: (ranking: CollectorRankEntry[]) => void,
  onError?: (err: any) => void
): () => void {
  const rankingRef = collection(db, 'collectorsRanking');
  return onSnapshot(rankingRef, (snapshot) => {
    const entries: CollectorRankEntry[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && typeof data.uniqueCards === 'number') {
        entries.push({
          userId: docSnap.id,
          displayName: data.displayName || 'Colecionador',
          email: data.email || '',
          photoURL: data.photoURL || '',
          uniqueCards: data.uniqueCards || 0,
          totalCopies: data.totalCopies || 0,
          uniqueLegado: data.uniqueLegado || 0,
          uniqueModerno: data.uniqueModerno || 0,
          specialCards: data.specialCards || 0,
          completionPercentage: data.completionPercentage || 0,
          isAmbassador: Boolean(data.isAmbassador),
          ambassadorRole: data.ambassadorRole || (data.isAmbassador ? 'Embaixador Oficial' : undefined),
          ambassadorAssignedBy: data.ambassadorAssignedBy || undefined,
          ambassadorAssignedAt: data.ambassadorAssignedAt || undefined,
          updatedAt: data.updatedAt
        });
      }
    });
    onUpdate(entries);
  }, (err) => {
    console.error('Erro ao ouvir ranking de colecionadores:', err);
    if (onError) onError(err);
  });
}

/**
 * Atribui ou remove o status de Embaixador de um colecionador.
 * Exclusivo para administradores.
 */
export async function setCollectorAmbassadorStatus(
  userId: string,
  isAmbassador: boolean,
  adminEmail?: string,
  role: string = 'Embaixador Oficial'
): Promise<void> {
  if (!userId) throw new Error('ID do usuário é obrigatório');

  const rankRef = doc(db, 'collectorsRanking', userId);
  await setDoc(rankRef, {
    isAmbassador,
    ambassadorRole: isAmbassador ? role : null,
    ambassadorAssignedBy: isAmbassador ? (adminEmail || 'admin') : null,
    ambassadorAssignedAt: isAmbassador ? serverTimestamp() : null
  }, { merge: true });

  // Espelha no documento do usuário em /users/{userId}
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      isAmbassador,
      ambassadorRole: isAmbassador ? role : null
    }, { merge: true });
  } catch (err) {
    console.warn('Não foi possível espelhar em users:', err);
  }
}
