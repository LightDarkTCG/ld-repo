import { collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from './firebase';
import { UserAlbumMap, normalizeAlbumKey } from './albumService';
import { CardData } from './types';
import { isLegacyCard, isSpecialCard } from './components/AlbumModal';
import { cleanCardCode } from './CardContext';
import { allCards as defaultCards } from './data';

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
}

/**
 * Retorna o universo total e contagem rigorosa do catálogo de cartas:
 * FÓRMULA OFICIAL DO JOGO:
 * TOTAL DE CARTAS = Quantidade de Cartas Legado 
 *                 + Quantidade de Cartas Modernas 
 *                 + Variações, Skins, Artes Alternativas e qualquer uma adicionada depois.
 *
 * Sempre segue o catálogo de cartas e aumenta a quantidade máxima de cartas possíveis.
 * NUNCA altera automaticamente as cartas atuais dos colecionadores (eles mesmos devem preencher as que faltam).
 */
export function getCatalogueUniverse(allCards: CardData[]): CatalogueStats {
  const seenCodes = new Set<string>();
  const allSources: CardData[] = [];

  for (const c of [...defaultCards, ...(allCards || [])]) {
    if (!c) continue;
    const key = `${c.id || ''}_${c.code || ''}_${c.frame || ''}_${c.variationType || ''}_${c.imageUrl || ''}`;
    if (!seenCodes.has(key)) {
      seenCodes.add(key);
      allSources.push(c);
    }
  }

  const legacySet = new Set<string>();
  const modernSet = new Set<string>();
  const variationSet = new Set<string>();
  const specialSet = new Set<string>();
  const cardMap = new Map<string, CardData>();

  for (const c of allSources) {
    if (!c) continue;
    const baseCode = cleanCardCode(c.parentCode || c.code);
    if (!baseCode) continue;

    const baseAlbumKey = normalizeAlbumKey(c);
    if (baseAlbumKey) {
      cardMap.set(baseAlbumKey, c);
    }

    if (isSpecialCard(c)) {
      specialSet.add(baseAlbumKey);
    }

    // 1. Variações, Skins, Artes Alternativas
    if (c.isVariation) {
      variationSet.add(baseAlbumKey || c.id || `${baseCode}_var`);
    } 
    // 2. Cartas Modernas nativas (ex: Invasão do Caos ou coleções modernas)
    else if (c.frame === 'Moderno' || (c.code && c.code.endsWith('-M')) || c.collection === 'Invasão do Caos' || c.collection === 'Booster Invasão do Caos' || c.collection === 'Reforço Macroversal') {
      modernSet.add(baseAlbumKey || `${baseCode}_MOD`);
    } 
    // 3. Cartas Legado
    else {
      legacySet.add(baseAlbumKey || baseCode);
      // Cada carta Legado também possui sua versão com Novo Frame Moderno no jogo
      const modKey = normalizeAlbumKey(c, 'Moderno');
      modernSet.add(modKey);
      cardMap.set(modKey, { ...c, frame: 'Moderno' });
    }

    // Variantes internas no array c.variants (skins, artes alternativas)
    if (c.variants && Array.isArray(c.variants)) {
      c.variants.forEach(v => {
        const vKey = normalizeAlbumKey(v.code || c.code, v.frame, v.id);
        if (vKey) {
          cardMap.set(vKey, { ...c, ...v, id: v.id || c.id });
          variationSet.add(vKey);
          if (isSpecialCard(c)) specialSet.add(vKey);
        }
      });
    }
  }

  const legacyCount = legacySet.size;
  const modernCount = modernSet.size;
  const variationCount = variationSet.size;
  const specialCount = specialSet.size;

  // FÓRMULA OFICIAL EXATA:
  // TOTAL DE CARTAS = quantidade legado + quantidade modernas + variações + skins + alternativas e qualquer uma que adicionar depois
  const totalCount = legacyCount + modernCount + variationCount;

  return {
    totalCount,
    legacyCount,
    modernCount,
    variationCount,
    specialCount,
    cardMap
  };
}

/**
 * Calcula as estatísticas completas e reais do acervo de um colecionador:
 * REGRA: CARTAS ÚNICAS = SOMA DE TODAS LEGADO, TODAS MODERNAS, TODAS AS VARIAÇÕES, SKINS E ARTES ALTERNATIVAS.
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

  Object.entries(albumCards || {}).forEach(([key, entry]) => {
    const qty = entry?.quantity || 0;
    if (qty > 0) {
      totalCopies += qty;

      const card = universe.cardMap.get(key);
      const isModern = key.endsWith('_MOD') || 
                       key.endsWith('-MOD') || 
                       key.endsWith('-M') || 
                       key.endsWith('_M') || 
                       (card && (!isLegacyCard(card) || card.frame === 'Moderno'));

      if (isModern) {
        uniqueModerno++;
      } else {
        uniqueLegado++;
      }

      if (card && isSpecialCard(card)) {
        specialCards++;
      }
    }
  });

  // CARTAS UNICAS = SOMA DE TODAS LEGADO, TODAS MODERNAS, TODAS AS VARIAÇÕES, SKINS E ARTES ALTERNATIVAS
  const uniqueCards = uniqueLegado + uniqueModerno;

  // O total máximo de cartas possíveis segue dinamicamente o catálogo do jogo
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
 * Apenas atualiza o usuário que chamou a sincronização através de seu próprio álbum.
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
 * Não altera nem distorce os valores registrados de nenhum colecionador.
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
 * Recalcula manualmente o ranking se explicitamente solicitado pelo administrador.
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
