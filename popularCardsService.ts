import { collection, getDocs, collectionGroup } from 'firebase/firestore';
import { db } from './firebase';
import { CardData, CardType } from './types';
import { cleanCardCode, getCardDisplayPriority } from './CardContext';
import { isModernCard } from './deckUtils';

export interface PopularCardStat {
  rank: number;
  card: CardData;
  code: string;
  deckCount: number;
  totalCopies: number;
  usagePercentage: number;
  avgCopies: number;
  trend: 'hot' | 'up' | 'stable';
}

export interface PopularCardsReport {
  herois: PopularCardStat[];
  efeitos: PopularCardStat[];
  equipamentos: PopularCardStat[];
  combatentes: PopularCardStat[];
  totalDecksAnalyzed: number;
  topOverallCard: PopularCardStat | null;
  mostPopularArchetype: string;
  lastUpdated: Date;
}

/**
 * REQUISITO DO USUÁRIO: "SOMENTE NAS CARTAS POPULARES, quando a carta tiver frame legado e frame moderno, usar somente moderno"
 * Busca a versão com Moldura Moderna correspondente para a carta (caso exista no catálogo ou em suas variantes).
 */
export function getModernCardForPopular(card: CardData, allCards: CardData[]): CardData {
  if (!card) return card;
  if (isModernCard(card)) {
    return card;
  }

  // 1. Verificar se a própria carta possui uma variante com frame 'Moderno'
  if (card.variants && card.variants.length > 0) {
    const modernVar = card.variants.find(v => 
      v.frame === 'Moderno' || 
      (v.name && v.name.toLowerCase().includes('modern')) ||
      (v.code && v.code.endsWith('-M'))
    );
    if (modernVar) {
      return {
        ...card,
        frame: 'Moderno',
        imageUrl: modernVar.imageUrl || card.imageUrl,
        rarity: modernVar.rarity || 'Comum',
        code: cleanCardCode(modernVar.code || card.code)
      };
    }
  }

  // 2. Verificar se existe uma versão Moderna em allCards com mesmo nome normalizado ou mesmo código base
  const normName = (card.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const baseCode = cleanCardCode(card.parentCode || card.code).toLowerCase();

  const modernMatch = allCards.find(ac => {
    if (!ac || !isModernCard(ac)) return false;
    const acNormName = (ac.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const acBaseCode = cleanCardCode(ac.parentCode || ac.code).toLowerCase();
    return (normName && acNormName === normName) || (baseCode && acBaseCode === baseCode);
  });

  if (modernMatch) {
    return modernMatch;
  }

  return card;
}

/**
 * Normaliza datas do Firestore ou JavaScript para timestamp em milissegundos.
 */
function extractTimestampMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') return new Date(ts).getTime();
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

/**
 * REQUISITOS DO USUÁRIO:
 * 1. "as cartas populares sao baseadas nos ultimos 30 dias"
 * 2. "atualmente resete a lista, deixe ela vazia até usuários com conta com email e senha registrado montem seus decks"
 */
export async function fetchCommunityDecks(): Promise<{ mainDeckCodes: string[]; sideDeckCodes?: string[] }[]> {
  const decksList: { mainDeckCodes: string[]; sideDeckCodes?: string[] }[] = [];
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const isWithin30Days = (data: any): boolean => {
    const ts = data.updatedAt || data.createdAt;
    if (!ts) return false;
    const ms = extractTimestampMs(ts);
    if (!ms || isNaN(ms)) return false;
    return (now - ms) <= THIRTY_DAYS_MS;
  };

  const isRegisteredEmailAccount = (data: any): boolean => {
    // Exige explicitamente conta cadastrada com e-mail e senha
    return Boolean(
      data.isEmailAccount === true ||
      (typeof data.userEmail === 'string' && data.userEmail.includes('@') && !data.isAnonymous)
    );
  };

  // 1. Tentar ler da coleção pública de decks comunitários espelhados
  try {
    const communitySnap = await getDocs(collection(db, 'communityDecks'));
    communitySnap.forEach(d => {
      const data = d.data();
      if (
        isRegisteredEmailAccount(data) && 
        isWithin30Days(data) && 
        Array.isArray(data.mainDeckCodes) && 
        data.mainDeckCodes.length > 0
      ) {
        decksList.push({
          mainDeckCodes: data.mainDeckCodes,
          sideDeckCodes: data.sideDeckCodes || []
        });
      }
    });
  } catch (err) {
    console.warn('Consulta a communityDecks:', err);
  }

  // 2. Tentar ler de collectionGroup savedDecks se disponível (também filtrado estritamente por e-mail e 30 dias)
  try {
    const groupSnap = await getDocs(collectionGroup(db, 'savedDecks'));
    groupSnap.forEach(d => {
      const data = d.data();
      if (
        isRegisteredEmailAccount(data) && 
        isWithin30Days(data) && 
        Array.isArray(data.mainDeckCodes) && 
        data.mainDeckCodes.length > 0
      ) {
        const exists = decksList.some(item => 
          item.mainDeckCodes.length === data.mainDeckCodes.length &&
          item.mainDeckCodes[0] === data.mainDeckCodes[0]
        );
        if (!exists) {
          decksList.push({
            mainDeckCodes: data.mainDeckCodes,
            sideDeckCodes: data.sideDeckCodes || []
          });
        }
      }
    });
  } catch (groupErr) {
    console.warn('Consulta a collectionGroup(savedDecks):', groupErr);
  }

  // LISTA RESETADA: Decks mockados / baseline foram 100% removidos.
  // A lista permanece vazia até usuários com conta de e-mail e senha salvarem seus decks.
  return decksList;
}

export function computePopularCards(
  decks: { mainDeckCodes: string[]; sideDeckCodes?: string[] }[],
  allCards: CardData[]
): PopularCardsReport {
  // Se não houver nenhum deck registrado nos últimos 30 dias, retorna lista vazia
  if (decks.length === 0) {
    return {
      herois: [],
      efeitos: [],
      equipamentos: [],
      combatentes: [],
      totalDecksAnalyzed: 0,
      topOverallCard: null,
      mostPopularArchetype: 'Aguardando decks de contas registradas',
      lastUpdated: new Date()
    };
  }

  const totalDecks = decks.length;

  // Mapa de códigos para a carta correspondente (resolvendo para a versão Moderna se existir)
  const canonicalCardMap = new Map<string, CardData>();
  for (const card of allCards) {
    if (!card) continue;
    const clean = cleanCardCode(card.code).toLowerCase();
    const modernVersion = getModernCardForPopular(card, allCards);
    if (clean && (!canonicalCardMap.has(clean) || getCardDisplayPriority(modernVersion) > getCardDisplayPriority(canonicalCardMap.get(clean)!))) {
      canonicalCardMap.set(clean, modernVersion);
    }
  }

  // Contadores por código limpo da versão moderna/canônica
  const deckAppearances = new Map<string, number>(); // quantos decks usam
  const totalCopies = new Map<string, number>();      // total de cópias somadas

  for (const deck of decks) {
    const combinedCodes = [...(deck.mainDeckCodes || []), ...(deck.sideDeckCodes || [])];
    const seenInThisDeck = new Set<string>();

    for (const rawCode of combinedCodes) {
      if (!rawCode) continue;
      const clean = cleanCardCode(rawCode).toLowerCase();
      if (!clean) continue;

      // Obtém a carta canônica para esta entrada (se houver moderna, consolida no código da moderna)
      const baseCard = canonicalCardMap.get(clean);
      const effectiveCode = baseCard ? cleanCardCode(baseCard.code).toLowerCase() : clean;

      // Incrementa total de cópias
      totalCopies.set(effectiveCode, (totalCopies.get(effectiveCode) || 0) + 1);

      // Incrementa decks únicos
      if (!seenInThisDeck.has(effectiveCode)) {
        seenInThisDeck.add(effectiveCode);
        deckAppearances.set(effectiveCode, (deckAppearances.get(effectiveCode) || 0) + 1);
      }
    }
  }

  const buildStatsForType = (targetType: CardType): PopularCardStat[] => {
    // Filtra cartas do tipo desejado
    const matchingCards = allCards.filter(c => c && c.type === targetType && !c.deleted);

    // Converte cada carta para sua versão Moderna se possuir ambas
    const modernCandidates = matchingCards.map(c => getModernCardForPopular(c, allCards));

    // Deduplica garantindo que quando a carta tiver frame legado e frame moderno, usar SOMENTE moderno
    const uniqueCardsMap = new Map<string, CardData>();
    for (const card of modernCandidates) {
      const normName = (card.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const clean = cleanCardCode(card.code).toLowerCase();
      const dedupeKey = normName || clean;
      if (!dedupeKey) continue;
      const existing = uniqueCardsMap.get(dedupeKey);
      if (!existing || getCardDisplayPriority(card) > getCardDisplayPriority(existing)) {
        uniqueCardsMap.set(dedupeKey, card);
      }
    }

    // SOMENTE inclui cartas que REALMENTE foram usadas em pelo menos 1 deck registrado nos últimos 30 dias
    const usedCards = Array.from(uniqueCardsMap.values()).filter(card => {
      const clean = cleanCardCode(card.code).toLowerCase();
      return (deckAppearances.get(clean) || 0) > 0;
    });

    const statsList: PopularCardStat[] = usedCards.map(card => {
      const clean = cleanCardCode(card.code).toLowerCase();
      const inDecks = deckAppearances.get(clean) || 0;
      const copies = totalCopies.get(clean) || 0;

      // Pontuação composta (frequência em decks tem peso 10, cópias totais peso 2)
      const score = (inDecks * 10) + (copies * 2);

      const percentage = Math.round((inDecks / totalDecks) * 100);
      const avg = inDecks > 0 ? Number((copies / inDecks).toFixed(1)) : 0;

      let trend: 'hot' | 'up' | 'stable' = 'stable';
      if (inDecks >= totalDecks * 0.4) trend = 'hot';
      else if (inDecks >= totalDecks * 0.2) trend = 'up';

      return {
        rank: 0,
        card,
        code: card.code,
        deckCount: inDecks,
        totalCopies: copies,
        usagePercentage: percentage,
        avgCopies: avg,
        trend,
        _score: score
      } as any;
    });

    // Ordena decrescente por score de popularidade, depois por nome
    statsList.sort((a: any, b: any) => {
      if (b._score !== a._score) return b._score - a._score;
      if (b.deckCount !== a.deckCount) return b.deckCount - a.deckCount;
      if (b.totalCopies !== a.totalCopies) return b.totalCopies - a.totalCopies;
      return a.card.name.localeCompare(b.card.name);
    });

    // Retorna até as TOP 10 de cada tipo com rank 1 a 10
    const top10 = statsList.slice(0, 10).map((item, idx) => ({
      ...item,
      rank: idx + 1
    }));

    return top10;
  };

  const herois = buildStatsForType('Herói');
  const efeitos = buildStatsForType('Efeito');
  const equipamentos = buildStatsForType('Equipamento');
  const combatentes = buildStatsForType('Combatente');

  // Identifica a carta #1 absoluta mais usada
  const allTop = [...herois, ...efeitos, ...equipamentos, ...combatentes];
  allTop.sort((a, b) => (b.deckCount * 10 + b.totalCopies) - (a.deckCount * 10 + a.totalCopies));
  const topOverallCard = allTop[0] || null;

  // Arquétipo mais popular
  const archetypeCounts = new Map<string, number>();
  for (const item of allTop) {
    if (item.card.archetype) {
      const arch = item.card.archetype.split('/')[0].trim();
      if (arch) {
        archetypeCounts.set(arch, (archetypeCounts.get(arch) || 0) + 1);
      }
    }
  }
  let mostPopularArchetype = 'Aguardando mais decks';
  let maxArchCount = 0;
  archetypeCounts.forEach((cnt, name) => {
    if (cnt > maxArchCount) {
      maxArchCount = cnt;
      mostPopularArchetype = name;
    }
  });

  return {
    herois,
    efeitos,
    equipamentos,
    combatentes,
    totalDecksAnalyzed: totalDecks,
    topOverallCard,
    mostPopularArchetype,
    lastUpdated: new Date()
  };
}
