import { collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './firebase';
import { UserAlbumMap, normalizeAlbumKey, getVariationArtHash } from './albumService';
import { CardData } from './types';
import { isLegacyCard, isSpecialCard } from './components/AlbumModal';
import { cleanCardCode } from './CardContext';

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

export interface CatalogueStats {
  totalCount: number;
  legacyCount: number;
  modernCount: number;
  variationCount: number;
  specialCount: number;
  cardMap: Map<string, CardData>;
  cardsList: CardData[];
}

/**
 * Retorna o universo total e contagem rigorosa do catálogo de cartas.
 * Segue EXATAMENTE o mesmo conjunto de cartas e regras do Álbum ("Todos"):
 * TOTAL DE CARTAS = Todas as cartas colecionáveis registradas no jogo (Legado, Modernas, Variações, Skins e Artes Alternativas).
 */
export function getCatalogueUniverse(allCards: CardData[]): CatalogueStats {
  const seen = new Set<string>();
  const seenImages = new Set<string>();
  const cardMap = new Map<string, CardData>();
  const cardsList: CardData[] = [];

  let legacyCount = 0;
  let modernCount = 0;
  let variationCount = 0;
  let specialCount = 0;

  for (const card of allCards || []) {
    if (!card) continue;
    const codeKey = normalizeAlbumKey(card);
    if (codeKey && !seen.has(codeKey)) {
      seen.add(codeKey);
      if (card.imageUrl) seenImages.add(card.imageUrl);
      cardsList.push(card);
      cardMap.set(codeKey, card);

      if (isSpecialCard(card)) {
        specialCount++;
      }
      if (card.isVariation) {
        variationCount++;
      }
      if (isLegacyCard(card)) {
        legacyCount++;
      } else {
        modernCount++;
      }
    }

    // Se a carta possui variações (como versão Moderna de carta Legado, ou skins):
    if (card.variants && card.variants.length > 0) {
      for (const v of card.variants) {
        if (!v.imageUrl || seenImages.has(v.imageUrl)) continue;
        const vFrame = v.frame || (isLegacyCard(card) ? 'Moderno' : 'Legado');
        const varRare = Boolean(v.isRarePrint || v.requiresAdminVerification || v.rarity === 'Moderno Macroversal' || v.rarity === 'Macroversal');
        const varCard: CardData = {
          ...card,
          id: v.id || `var_${v.code || card.code}`,
          code: cleanCardCode(v.code) || cleanCardCode(card.code),
          imageUrl: v.imageUrl,
          frame: vFrame,
          rarity: v.rarity || card.rarity,
          variationType: v.name,
          collection: v.collection || card.collection,
          isVariation: true,
          isCatalogCover: Boolean(v.isCatalogCover),
          isRarePrint: varRare,
          requiresAdminVerification: varRare,
          maxPrintCopies: varRare ? (v.maxPrintCopies || 1) : 0
        };
        let varKey = normalizeAlbumKey(varCard, vFrame);
        if (varKey && seen.has(varKey)) {
          varKey = `${varKey}_VAR_${getVariationArtHash(varCard)}`;
        }
        if (varKey && !seen.has(varKey)) {
          seen.add(varKey);
          seenImages.add(v.imageUrl);
          cardsList.push(varCard);
          cardMap.set(varKey, varCard);

          if (isSpecialCard(varCard)) {
            specialCount++;
          }
          variationCount++;
          if (isLegacyCard(varCard)) {
            legacyCount++;
          } else {
            modernCount++;
          }
        }
      }
    }
  }

  return {
    totalCount: cardsList.length,
    legacyCount,
    modernCount,
    variationCount,
    specialCount,
    cardMap,
    cardsList
  };
}

/**
 * Calcula as estatísticas completas e reais do acervo de um colecionador:
 * Avalia a posse do usuário contra exatamente as mesmas cartas do Álbum Geral.
 */
export function calculateCollectorStats(
  albumCards: UserAlbumMap,
  allCards: CardData[]
): {
  uniqueCards: number;
  totalCopies: number;
  uniqueLegado: number;
  uniqueModerno: number;
  specialCards: number;
  completionPercentage: number;
  totalCatalogueCount: number;
  legacyCount: number;
  modernCount: number;
  variationCount: number;
} {
  const universe = getCatalogueUniverse(allCards);

  let uniqueLegado = 0;
  let uniqueModerno = 0;
  let specialCards = 0;
  let totalCopies = 0;

  // Itera por todas as cartas reais do catálogo do jogo
  for (const card of universe.cardsList) {
    const key = normalizeAlbumKey(card);
    const entry = albumCards?.[key];
    const qty = entry?.quantity || 0;
    if (qty > 0) {
      totalCopies += qty;
      if (isLegacyCard(card)) {
        uniqueLegado++;
      } else {
        uniqueModerno++;
      }
      if (isSpecialCard(card)) {
        specialCards++;
      }
    }
  }

  const uniqueCards = uniqueLegado + uniqueModerno;
  const totalCatalogueCount = universe.totalCount;

  // Porcentagem de conclusão da coleção geral (limitada a 100%)
  const completionPercentage = totalCatalogueCount > 0 
    ? Math.min(100, Math.round((uniqueCards / totalCatalogueCount) * 100))
    : 0;

  return {
    uniqueCards,
    totalCopies,
    uniqueLegado,
    uniqueModerno,
    specialCards,
    completionPercentage,
    totalCatalogueCount,
    legacyCount: universe.legacyCount,
    modernCount: universe.modernCount,
    variationCount: universe.variationCount
  };
}

/**
 * Sincroniza as estatísticas de colecionador do usuário com o ranking comunitário na nuvem.
 */
export async function syncUserCollectorStats(
  userId: string,
  user: User | null,
  albumCards: UserAlbumMap,
  allCards: CardData[]
): Promise<CollectorRankEntry | null> {
  if (!userId || !user) return null;

  const stats = calculateCollectorStats(albumCards, allCards);
  const displayName = user.displayName?.trim() || user.email?.split('@')[0] || 'Colecionador';

  const rankEntry: CollectorRankEntry = {
    userId,
    displayName,
    email: user.email || '',
    photoURL: user.photoURL || '',
    uniqueCards: stats.uniqueCards,
    totalCopies: stats.totalCopies,
    uniqueLegado: stats.uniqueLegado,
    uniqueModerno: stats.uniqueModerno,
    specialCards: stats.specialCards,
    completionPercentage: stats.completionPercentage,
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
 * Ouve o ranking de colecionadores em tempo real.
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
        const uniqueCards = Math.max(0, data.uniqueCards || 0);
        const uniqueLegado = Math.max(0, data.uniqueLegado || 0);
        const uniqueModerno = Math.max(0, data.uniqueModerno || 0);
        const specialCards = Math.max(0, data.specialCards || 0);
        const totalCopies = Math.max(0, data.totalCopies || 0);
        const completionPercentage = Math.min(100, Math.max(0, data.completionPercentage || 0));

        entries.push({
          userId: docSnap.id,
          displayName: data.displayName || 'Colecionador',
          email: data.email || '',
          photoURL: data.photoURL || '',
          uniqueCards,
          totalCopies,
          uniqueLegado,
          uniqueModerno,
          specialCards,
          completionPercentage,
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

/**
 * Audita e atualiza os documentos de ranking no Firestore calculando com precisão
 * a posse com base no catálogo oficial do Álbum.
 */
export async function repairAllRankingDocs(allCards: CardData[]): Promise<number> {
  let fixedCount = 0;
  try {
    const rankingRef = collection(db, 'collectorsRanking');
    const snap = await getDocs(rankingRef);

    for (const docSnap of snap.docs) {
      try {
        const albumSnap = await getDoc(doc(db, 'users', docSnap.id, 'album', 'data'));
        if (albumSnap.exists()) {
          const albumCards = albumSnap.data()?.cards || {};
          const stats = calculateCollectorStats(albumCards, allCards);

          await setDoc(docSnap.ref, {
            uniqueCards: stats.uniqueCards,
            uniqueLegado: stats.uniqueLegado,
            uniqueModerno: stats.uniqueModerno,
            specialCards: stats.specialCards,
            totalCopies: stats.totalCopies,
            completionPercentage: stats.completionPercentage,
            updatedAt: serverTimestamp()
          }, { merge: true });

          fixedCount++;
        }
      } catch (e) {
        // Ignora erros individuais de documento
      }
    }
  } catch (err) {
    console.warn('Erro durante reparação do ranking:', err);
  }
  return fixedCount;
}
