import { allCards } from '../data';
import { getBaseCardCode } from '../CardContext';
import { readBrowserCache } from '../firebase';
import { CardData } from '../types';
import {
  BotAdaptiveMemory,
  BotDeckSelection,
  BotLossDiagnosisEntry,
  ChoiceCandidate,
  DuelGameState,
  DuelLogType,
  FieldFighter,
  HeuristicEvaluationResult,
  PlayerDuelState,
  PlayerId,
  PlayerSideHeuristic,
  StructuralDeckId
} from './botTypes';

export interface StructuralDeckOption {
  id: StructuralDeckId;
  label: string;
  shortName: string;
  heroCode: string;
  heroName: string;
}

export const STRUCTURAL_DECK_OPTIONS: StructuralDeckOption[] = [
  {
    id: 'Insanis',
    label: 'Deck Insanis (Jim • Macroverso)',
    shortName: 'Insanis',
    heroCode: '2025/0001/00001',
    heroName: 'Jim - O Senhor do Macroverso'
  },
  {
    id: 'Invasão do Caos',
    label: 'Deck Véu • Invasão do Caos (Mahina do Véu)',
    shortName: 'Deck Véu',
    heroCode: '2026/0001/00301',
    heroName: 'Mahina - O Arauto do Véu'
  },
  {
    id: 'Príncipe do Macroverso',
    label: 'Príncipe do Macroverso (Jenos • Destinado)',
    shortName: 'Príncipe do Macroverso',
    heroCode: '2025/0001/00031',
    heroName: 'Jenos Senhor do Macroverso'
  },
  {
    id: 'Mechs e Mangas',
    label: 'Mechs e Mangas (Spear Vellret • Longinus)',
    shortName: 'Mechs e Mangas',
    heroCode: '2025/0001/00061',
    heroName: 'Spear Vellret'
  },
  {
    id: 'Herdeiro do Caos',
    label: 'Herdeiro do Caos (Mahina Lúmeni • Lúmen/Darkus)',
    shortName: 'Herdeiro do Caos',
    heroCode: '2025/0001/00091',
    heroName: 'Mahina - O Herdeiro de Lúmeni'
  },
  {
    id: 'Mundo em Chamas',
    label: 'Mundo em Chamas (Donnie • Samurai das Chamas)',
    shortName: 'Mundo em Chamas',
    heroCode: '2025/0001/00121',
    heroName: 'Donnie - Samurai das Chamas'
  },
  {
    id: 'Corruptor Profano',
    label: 'Corruptor Profano (Otto & Asmonious)',
    shortName: 'Corruptor Profano',
    heroCode: '2025/0001/00151',
    heroName: 'Otto - Arauto da Corrupção'
  },
  {
    id: 'O Escolhido',
    label: 'O Escolhido (Salazar • Conceito)',
    shortName: 'O Escolhido',
    heroCode: '2025/0001/00181',
    heroName: 'Salazar - Guia dos Escolhidos'
  },
  {
    id: 'Deusa da Lua',
    label: 'Deusa da Lua (Selena • Divindade CT 12)',
    shortName: 'Deusa da Lua',
    heroCode: '2025/0001/00211',
    heroName: 'Selena - Deusa da Lua'
  }
];

export function getStructuralDeckMeta(deckId: StructuralDeckId): StructuralDeckOption {
  return (
    STRUCTURAL_DECK_OPTIONS.find((d) => d.id === deckId) || STRUCTURAL_DECK_OPTIONS[0]
  );
}

let uidCounter = 1;
export function nextUid(prefix = 'id'): string {
  uidCounter += 1;
  return `${prefix}_${Date.now()}_${uidCounter}`;
}

function isAlternateArtOrSkinLabel(label?: string, rarity?: string): boolean {
  const l = (label || '').toLowerCase();
  const r = (rarity || '').toLowerCase();
  return (
    l.includes('arte alternativa') ||
    l.includes('skin') ||
    l.includes('evento') ||
    l.includes('natal') ||
    l.includes('aa') ||
    r.includes('evento') ||
    r.includes('limitada')
  );
}

/**
 * Resolves the canonical Base Moderno (Novo Frame) image and metadata for a card
 * using the live CardContext / Firestore cache.
 * Strictly idempotent: always compares against the static Legacy URL from `allCards`
 * and excludes Alternate Art / Event skins so cards never randomly flip to Alternate Art.
 */
export function resolveModernCardVersion(
  baseCard: CardData,
  liveCards?: CardData[]
): CardData {
  const pool =
    liveCards && liveCards.length > 0
      ? liveCards
      : readBrowserCache<CardData[]>('ld_cache_cards_v2') || [];

  const targetBaseCode = getBaseCardCode(baseCard.code, baseCard.parentCode);
  const staticLegacyDef =
    allCards.find(
      (c) =>
        getBaseCardCode(c.code, c.parentCode) === targetBaseCode &&
        !c.isVariation &&
        c.rarity !== 'Evento'
    ) || allCards.find((c) => getBaseCardCode(c.code, c.parentCode) === targetBaseCode);

  const legacyDefaultUrl = staticLegacyDef?.imageUrl;

  const liveMatch = pool.find(
    (c) => getBaseCardCode(c.code, c.parentCode) === targetBaseCode
  );

  if (!liveMatch) {
    return { ...baseCard, frame: 'Moderno' };
  }

  let modernImageUrl: string | undefined;

  // 1. First check variants for an explicit Base Moderno ("Novo Frame" / "Moderno") that is NOT Alternate Art / Skin
  if (Array.isArray(liveMatch.variants)) {
    const strictBaseModernVariant = liveMatch.variants.find(
      (v) =>
        v.imageUrl &&
        v.imageUrl !== legacyDefaultUrl &&
        (v.frame === 'Moderno' ||
          v.name?.toLowerCase().includes('moderno') ||
          v.name?.toLowerCase().includes('novo frame')) &&
        !isAlternateArtOrSkinLabel(v.name, v.rarity)
    );
    if (strictBaseModernVariant?.imageUrl) {
      modernImageUrl = strictBaseModernVariant.imageUrl;
    }
  }

  // 2. If liveMatch itself is Base Moderno (not an Alternate Art / Skin cover) and differs from the Legacy URL
  if (
    !modernImageUrl &&
    liveMatch.frame === 'Moderno' &&
    liveMatch.imageUrl &&
    liveMatch.imageUrl !== legacyDefaultUrl &&
    !isAlternateArtOrSkinLabel(liveMatch.variationType, liveMatch.rarity)
  ) {
    modernImageUrl = liveMatch.imageUrl;
  }

  // 3. Fallback to any non-legacy Moderno variant if no strict base variant was tagged
  if (!modernImageUrl && Array.isArray(liveMatch.variants)) {
    const anyNonSkinVariant = liveMatch.variants.find(
      (v) =>
        v.imageUrl &&
        v.imageUrl !== legacyDefaultUrl &&
        v.frame !== 'Legado' &&
        !isAlternateArtOrSkinLabel(v.name, v.rarity)
    );
    const anyModernVariant = liveMatch.variants.find(
      (v) =>
        v.imageUrl &&
        v.imageUrl !== legacyDefaultUrl &&
        (v.frame === 'Moderno' ||
          v.name?.toLowerCase().includes('moderno') ||
          v.name?.toLowerCase().includes('novo frame'))
    );
    modernImageUrl = anyNonSkinVariant?.imageUrl || anyModernVariant?.imageUrl;
  }

  // 4. Final fallback to liveMatch.imageUrl
  if (!modernImageUrl && liveMatch.imageUrl && liveMatch.imageUrl !== legacyDefaultUrl) {
    modernImageUrl = liveMatch.imageUrl;
  }

  return {
    ...baseCard,
    name: liveMatch.name || baseCard.name,
    archetype:
      liveMatch.archetype !== undefined ? liveMatch.archetype : baseCard.archetype,
    ct: liveMatch.ct !== undefined ? liveMatch.ct : baseCard.ct,
    attack: liveMatch.attack !== undefined ? liveMatch.attack : baseCard.attack,
    defense: liveMatch.defense !== undefined ? liveMatch.defense : baseCard.defense,
    description:
      liveMatch.description !== undefined ? liveMatch.description : baseCard.description,
    imageUrl: modernImageUrl || baseCard.imageUrl,
    frame: 'Moderno',
    rarity:
      liveMatch.rarity &&
      !liveMatch.rarity.toLowerCase().includes('legado') &&
      liveMatch.rarity !== 'Beta'
        ? liveMatch.rarity
        : 'Moderno Comum',
    code: baseCard.code
  };
}

export function getStructuralDeckCards(
  deckId: StructuralDeckId,
  liveCards?: CardData[]
): CardData[] {
  return allCards
    .filter(
      (c) => c.collection === deckId && !c.isVariation && c.rarity !== 'Evento'
    )
    .map((c) => resolveModernCardVersion(c, liveCards));
}

export function getInsanisCards(liveCards?: CardData[]): CardData[] {
  return getStructuralDeckCards('Insanis', liveCards);
}

export function isJimCard(card: CardData): boolean {
  return card.name.includes('Jim');
}

export function isVeuCard(card: CardData): boolean {
  return (
    card.name.toLowerCase().includes('véu') ||
    (card.archetype || '').includes('Véu')
  );
}

export function isCamadaCard(card: CardData): boolean {
  return card.name.includes('Camada');
}

export function isContinuousBackrowCard(card: CardData): boolean {
  const desc = (card.description || '').toLowerCase();
  if (card.type === 'Equipamento' && desc.includes('equipa o jogador')) {
    return true;
  }
  if (
    card.code === '2025/0001/00016' ||
    card.code === '2025/0001/00017' ||
    card.code === '2026/0002/00315'
  ) {
    return true;
  }
  if (
    card.type === 'Efeito' &&
    (desc.includes('permanece em campo') || desc.includes('permanece no campo'))
  ) {
    return true;
  }
  return false;
}

export function goesToErasedWhenEliminated(
  card: CardData,
  withoutActivatingEffects = false
): boolean {
  if (withoutActivatingEffects) return false;
  if (card.type === 'Herói') return false;
  if (isJimCard(card) && card.type === 'Combatente') return true;
  return (
    card.description.includes('enviada para a Zona Apagada') ||
    card.description.includes('enviado para a Zona Apagada')
  );
}

/**
 * Envia uma carta para a Zona Morta ou Zona Apagada respeitando a regra dos Combatentes «Jim»:
 * Todo Combatente «Jim» (exceto o Herói «Jim - O Senhor do Macroverso») vai para a Zona Apagada
 * em vez de ir para a Zona Morta, a menos que o efeito especifique explicitamente
 * "envie para a Zona Morta sem ativar seus efeitos" (withoutActivatingEffects = true).
 */
export function sendCardToDeadOrErasedZone(
  state: DuelGameState,
  ownerId: PlayerId,
  card: CardData,
  withoutActivatingEffects = false
): 'erasedZone' | 'deadZone' {
  const owner = getPlayerState(state, ownerId);
  if (goesToErasedWhenEliminated(card, withoutActivatingEffects)) {
    owner.erasedZone.push(card);
    addLog(
      state,
      ownerId,
      `«${card.name}» foi enviado para a Zona Apagada em vez da Zona Morta (${countJimsInErasedZone(owner)} «Jim» na Zona Apagada).`,
      'info'
    );
    return 'erasedZone';
  }
  owner.deadZone.push(card);
  return 'deadZone';
}

export const ALL_OFFICIAL_ARCHETYPES: string[] = [
  'Macroversal',
  'Furtivo',
  'Divindade',
  'Conceito',
  'Escolhido',
  'Insano',
  'Reativo',
  'Solador',
  'Sortudo',
  'Azarado',
  'Caos',
  'Ordem',
  'Lúmen',
  'Darkus',
  'Cósmico',
  'Véu'
];

const AUTHORITATIVE_VEU_ARCHETYPES: Record<string, string> = {
  '2026/0001/00306': 'Véu / Caos / Cósmico / Sortudo',
  '2026/0001/00307': 'Véu / Lúmen',
  '2026/0001/00309': 'Véu / Macroversal / Insano',
  '2026/0001/00310': 'Véu / Lúmen',
  '2026/0001/00311': 'Véu / Cósmico / Macroversal',
  '2026/0001/00312': 'Véu / Macroversal'
};

export function parseBaseArchetypes(card: CardData): string[] {
  const authoritative = AUTHORITATIVE_VEU_ARCHETYPES[card.code];
  const raw = authoritative || card.archetype;
  if (!raw || !raw.trim()) return [];
  return raw
    .split('/')
    .map((s) => s.trim())
    .filter((s) => Boolean(s) && s !== 'Desconhecido' && s !== 'Nenhum');
}

/**
 * Descarta uma carta diretamente da Mão ou do Deck para uma Zona (Morta ou Apagada),
 * disparando o Arquétipo [Cósmico]: "Ao entrar em campo ou ser descartado diretamente para alguma Zona, gera 1 Runa no seu lado do campo."
 */
export function discardCardDirectlyToZone(
  state: DuelGameState,
  ownerId: PlayerId,
  card: CardData,
  targetZone: 'deadZone' | 'erasedZone'
): void {
  const owner = getPlayerState(state, ownerId);
  if (targetZone === 'erasedZone') {
    owner.erasedZone.push(card);
  } else {
    owner.deadZone.push(card);
  }
  const archs = parseBaseArchetypes(card);
  if ((card.type === 'Combatente' || card.type === 'Herói') && archs.includes('Cósmico')) {
    owner.runes += 1;
    addLog(
      state,
      ownerId,
      `✨ Arquétipo [Cósmico]: «${card.name}» foi descartado diretamente para a ${
        targetZone === 'erasedZone' ? 'Zona Apagada' : 'Zona Morta'
      } e gerou +1 Runa para ${owner.name} (Total: ${owner.runes} Runas)!`,
      'effect'
    );
    checkOttoAscensionToAsmonious(state, ownerId);
  }
}

/**
 * Rolagem oficial de dados respeitando o Arquétipo [Sortudo]:
 * "Sempre que algum dado for rolado contra ou a favor do jogador que possui combatentes com 'Sortudo' em campo,
 * ele rola um dado extra (para cada Sortudo) e escolhe o melhor resultado para ele."
 */
export function rollDieWithSortudo(
  state: DuelGameState,
  beneficiaryId: PlayerId,
  sides: number,
  preferFn?: (candidate: number, currentBest: number) => boolean
): { result: number; rolls: number[]; sortudoCount: number } {
  const p = getPlayerState(state, beneficiaryId);
  const sortudoCount = p.frontline.filter(
    (f) => f !== null && hasArchetype(state, f, 'Sortudo')
  ).length;
  const totalRolls = 1 + sortudoCount;
  const rolls: number[] = [];
  for (let i = 0; i < totalRolls; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1);
  }
  let best = rolls[0];
  for (let i = 1; i < rolls.length; i++) {
    const r = rolls[i];
    const isBetter = preferFn ? preferFn(r, best) : r > best;
    if (isBetter) best = r;
  }
  return { result: best, rolls, sortudoCount };
}

export function dealPrimordialDamageToDeck(
  state: DuelGameState,
  targetPlayerId: PlayerId,
  sourcePlayerId: PlayerId,
  amount: number,
  sourceLabel: string
): number {
  const target = getPlayerState(state, targetPlayerId);
  const milledCount = Math.min(amount, target.deck.length);
  const milled = target.deck.splice(0, milledCount);
  for (const c of milled) {
    discardCardDirectlyToZone(state, targetPlayerId, c, 'erasedZone');
  }
  addLog(
    state,
    sourcePlayerId,
    `🌌 ${sourceLabel}: Causou ${amount} de Dano Primordial no Deck de ${target.name} (${milledCount} carta(s) enviada(s) do topo do Deck para a Zona Apagada)!`,
    'effect'
  );
  return milledCount;
}

export function shuffleCards<T>(arr: T[]): T[] {
  const res = [...arr];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
}

export function buildStructuralDeckForDuel(
  deckId: StructuralDeckId,
  liveCards?: CardData[]
): {
  mainDeck: CardData[];
  heroDeck: CardData[];
} {
  const pool = getStructuralDeckCards(deckId, liveCards);
  const meta = getStructuralDeckMeta(deckId);

  const heroes = pool.filter((c) => c.type === 'Herói');
  heroes.sort((a, b) => {
    if (a.code === meta.heroCode) return -1;
    if (b.code === meta.heroCode) return 1;
    return 0;
  });

  const uniqueMainCards: CardData[] = [];
  const seenCodes = new Set<string>();
  const seenNames = new Set<string>();

  for (const card of pool) {
    if (card.type === 'Herói') continue;
    const normName = card.name.trim().toLowerCase();
    if (!seenCodes.has(card.code) && !seenNames.has(normName) && uniqueMainCards.length < 34) {
      seenCodes.add(card.code);
      seenNames.add(normName);
      uniqueMainCards.push({ ...card });
    }
  }

  return {
    mainDeck: shuffleCards(uniqueMainCards),
    heroDeck: heroes.map((h) => ({ ...h }))
  };
}

export function buildInsanisDeck(
  _mode: 'structural_29' | 'optimized_40',
  liveCards?: CardData[]
): {
  mainDeck: CardData[];
  heroDeck: CardData[];
} {
  return buildStructuralDeckForDuel('Insanis', liveCards);
}

export function createInitialPlayerState(
  id: PlayerId,
  name: string,
  _deckMode: 'structural_29' | 'optimized_40',
  liveCards?: CardData[],
  deckId: StructuralDeckId = 'Insanis'
): PlayerDuelState {
  const { mainDeck, heroDeck } = buildStructuralDeckForDuel(deckId, liveCards);
  const hand = mainDeck.slice(0, 5);
  const remainingDeck = mainDeck.slice(5);

  return {
    id,
    name,
    deckId,
    hp: 20,
    mana: 12,
    maxManaCap: 12,
    runes: 0,
    hand,
    deck: remainingDeck,
    heroDeck,
    deadZone: [],
    erasedZone: [],
    frontline: [null, null, null, null, null, null],
    backrow: [null, null, null, null, null, null],
    ctReductionThisRound: 0,
    permCtReduction: 0,
    permCtPenalty: 0,
    pendingPactoLifeLossNextRound: 0,
    skipDrawsUntilGlobalTurn: 0,
    hasAttackedInCurrentTurn: false,
    lockedFromAttackingThisTurn: false,
    lostFighterInBattleThisTurn: false,
    heroDiedThisTurn: false,
    damageDealtToEnemyPlayerThisRound: 0,
    alliedFightersLostWhileSelenaLuaActive: 0,
    pendingRitosFestival: [],
    pendingComoPlanejadoCards: [],
    floquinhoTreatedAsHeroCodes: []
  };
}

export function createInitialDuelState(
  deckMode: 'structural_29' | 'optimized_40' = 'structural_29',
  liveCards?: CardData[],
  playerDeckId: StructuralDeckId = 'Insanis',
  botDeckSelection: BotDeckSelection = 'Invasão do Caos'
): DuelGameState {
  const resolvedBotDeckId: StructuralDeckId =
    botDeckSelection === 'random'
      ? STRUCTURAL_DECK_OPTIONS[
          Math.floor(Math.random() * STRUCTURAL_DECK_OPTIONS.length)
        ].id
      : botDeckSelection;

  const playerMeta = getStructuralDeckMeta(playerDeckId);
  const botMeta = getStructuralDeckMeta(resolvedBotDeckId);

  let pRoll = Math.floor(Math.random() * 20) + 1;
  let bRoll = Math.floor(Math.random() * 20) + 1;
  while (pRoll === bRoll) {
    pRoll = Math.floor(Math.random() * 20) + 1;
    bRoll = Math.floor(Math.random() * 20) + 1;
  }
  const winner: PlayerId = pRoll > bRoll ? 'player' : 'bot';

  return {
    round: 1,
    turnInRound: 1,
    globalTurn: 1,
    firstPlayerOfRound: winner,
    activePlayer: winner,
    phase: 'INITIATIVE',
    winner: null,
    winReason: null,
    initiativeRoll: {
      playerRoll: pRoll,
      botRoll: bRoll,
      winner
    },
    mulliganDone: false,
    player: createInitialPlayerState(
      'player',
      `Você (${playerMeta.shortName})`,
      deckMode,
      liveCards,
      playerDeckId
    ),
    bot: createInitialPlayerState(
      'bot',
      `Bot ${botMeta.shortName}`,
      deckMode,
      liveCards,
      resolvedBotDeckId
    ),
    reactionWindow: null,
    pendingChoiceQueue: [],
    pendingGuerreiroSplashDamage: false,
    logs: [
      {
        id: nextUid('log'),
        round: 1,
        turn: 1,
        actor: 'system',
        text: `Matchup: Você [${playerMeta.shortName}] vs Bot [${botMeta.shortName}] • Rolagem de Iniciativa (1D20): Você tirou ${pRoll} vs Bot tirou ${bRoll}.`,
        type: 'info'
      }
    ],
    deckMode,
    playerDeckId,
    botDeckId: resolvedBotDeckId
  };
}

export function addLog(
  state: DuelGameState,
  actor: PlayerId | 'system',
  text: string,
  type: DuelLogType = 'info'
) {
  state.logs.unshift({
    id: nextUid('log'),
    round: state.round,
    turn: state.turnInRound,
    actor,
    text,
    type
  });
}

export function getOpponentId(id: PlayerId): PlayerId {
  return id === 'player' ? 'bot' : 'player';
}

export function getPlayerState(state: DuelGameState, id: PlayerId): PlayerDuelState {
  return id === 'player' ? state.player : state.bot;
}

export function countJimsInErasedZone(p: PlayerDuelState): number {
  return p.erasedZone.filter((c) => isJimCard(c)).length;
}

export function getAllSupportCardsInSlot(s: { card: CardData; stackedCards?: CardData[] } | null): CardData[] {
  if (!s) return [];
  return [s.card, ...(s.stackedCards || [])];
}

export function countCamadasOnField(p: PlayerDuelState): number {
  let total = 0;
  for (const s of p.backrow) {
    if (!s) continue;
    for (const c of getAllSupportCardsInSlot(s)) {
      if (isCamadaCard(c)) total += 1;
    }
  }
  return total;
}

export function hasActiveCamada(p: PlayerDuelState, camadaCode: string): boolean {
  return p.backrow.some(
    (s) => s !== null && getAllSupportCardsInSlot(s).some((c) => c.code === camadaCode)
  );
}

export function countVeuFightersOnField(state: DuelGameState, p: PlayerDuelState): number {
  return p.frontline.filter(
    (f) => f !== null && (f.archetypes.includes('Véu') || isVeuCard(f.card))
  ).length;
}

export function countVeuCardsOnPlayerField(p: PlayerDuelState): number {
  let count = 0;
  for (const f of p.frontline) {
    if (f && (f.archetypes.includes('Véu') || isVeuCard(f.card))) {
      count += 1;
    }
  }
  return count;
}

/**
 * Verifica estritamente os requisitos oficiais de invocação de cada Herói da Zona do Herói.
 * REGRA OFICIAL: APENAS «Jim - O Senhor do Macroverso» (2025/0001/00001) possui "Invoque esse Herói a qualquer momento".
 * Todos os demais Heróis só podem ser invocados em sua Fase Principal cumprindo seu requisito específico,
 * ou através das cartas de invocação de seus respectivos decks.
 */
export function canSummonHeroDirectly(
  state: DuelGameState,
  actorId: PlayerId,
  heroCard?: CardData,
  isAnytimeOrReactionWindow = false
): { allowed: boolean; reason: string; badgeText: string } {
  const p = getPlayerState(state, actorId);
  const card = heroCard || p.heroDeck[0];
  if (!card) {
    return { allowed: false, reason: 'Nenhum Herói disponível na Zona do Herói.', badgeText: 'Sem Herói' };
  }

  const hasAvailableSlot =
    p.frontline.some((s) => s === null) ||
    p.frontline.some((f) => f !== null && f.isHero);

  if (!hasAvailableSlot) {
    return {
      allowed: false,
      reason: 'Todas as 6 colunas de combatentes estão ocupadas.',
      badgeText: 'Campo Cheio'
    };
  }

  // 1. JIM - O SENHOR DO MACROVERSO (2025/0001/00001): O ÚNICO Herói com "Invoque esse Herói a qualquer momento"
  if (card.code === '2025/0001/00001') {
    const erasedJims = countJimsInErasedZone(p);
    return {
      allowed: true,
      reason: `Invoque esse Herói a qualquer momento (${erasedJims} «Jim» na Zona Apagada).`,
      badgeText: `A Qualquer Momento (${erasedJims} Jim Apagados)`
    };
  }

  // Qualquer outro Herói NÃO pode ser invocado em janela de Reação ou Pré-Compra ("A Qualquer Momento")
  if (isAnytimeOrReactionWindow || state.phase !== 'MAIN_PHASE' || state.activePlayer !== actorId) {
    return {
      allowed: false,
      reason: 'Apenas «Jim - O Senhor do Macroverso» pode ser invocado A Qualquer Momento.',
      badgeText: 'Apenas na sua Fase Principal'
    };
  }

  switch (card.code) {
    case '2026/0001/00301': {
      // Mahina - O Arauto do Véu:
      // "Para invocar este Herói, descarte um Herói «Mahina» do campo para a Zona Apagada ou tenha 4 cartas com «Véu» em seu nome ou Arquétipo em seu lado do campo."
      const hasMahinaHeroOnField = p.frontline.some(
        (f) => f !== null && f.isHero && f.card.name.includes('Mahina')
      );
      const veuCardsOnField = countVeuCardsOnPlayerField(p);
      if (hasMahinaHeroOnField || veuCardsOnField >= 4) {
        return {
          allowed: true,
          reason: hasMahinaHeroOnField
            ? 'Requisito cumprido: Descartar Herói «Mahina» do campo para a Zona Apagada.'
            : `Requisito cumprido: ${veuCardsOnField}/4 combatentes com «Véu» em seu lado do campo.`,
          badgeText: `Pronto (${veuCardsOnField}/4 Véu em campo)`
        };
      }
      return {
        allowed: false,
        reason: `Requer 4 combatentes com «Véu» em seu lado do campo (atual: ${veuCardsOnField}/4) ou descartar um Herói «Mahina» do campo.`,
        badgeText: `Requer 4 Combatentes Véu (${veuCardsOnField}/4)`
      };
    }

    case '2025/0001/00031': {
      // Jenos Senhor do Macroverso:
      // "Este Herói só pode ser invocado pelo próprio efeito. Tenha ao menos outros 2 Heróis nas suas Zonas ou gaste 17 de mana, invoque «Jenos Senhor do Macroverso»."
      const heroesInZones =
        p.deadZone.filter((c) => c.type === 'Herói').length +
        p.erasedZone.filter((c) => c.type === 'Herói').length;
      if (heroesInZones >= 2 || p.mana >= 17) {
        return {
          allowed: true,
          reason:
            heroesInZones >= 2
              ? `Requisito cumprido: ${heroesInZones}/2 Heróis nas suas Zonas.`
              : `Requisito cumprido: Gastar 17 de Mana.`,
          badgeText: heroesInZones >= 2 ? `Pronto (${heroesInZones}/2 Heróis nas Zonas)` : 'Pronto (17 Mana)'
        };
      }
      return {
        allowed: false,
        reason: `Requer ao menos outros 2 Heróis nas suas Zonas (atual: ${heroesInZones}/2) ou gastar 17 de Mana (atual: ${p.mana}/17).`,
        badgeText: `Requer 2 Heróis nas Zonas (${heroesInZones}/2) ou 17 Mana`
      };
    }

    case '2025/0001/00032': {
      // Jenos Corrompido:
      // "Este Herói só pode ser invocado pelo próprio efeito. A partir da terceira rodada, pague 10 de vida de jogador, invoque «Jenos Corrompido»."
      if (state.round >= 3 && p.hp > 10) {
        return {
          allowed: true,
          reason: 'Requisito cumprido: 3ª Rodada+ e pagar 10 PV.',
          badgeText: 'Pronto (Pagar 10 PV)'
        };
      }
      return {
        allowed: false,
        reason: `Requer 3ª Rodada ou superior (Rodada atual: ${state.round}) e mais de 10 PV para pagar 10 PV (Vida atual: ${p.hp} PV).`,
        badgeText: `Requer Rodada 3+ (R${state.round}) e >10 PV`
      };
    }

    case '2025/0001/00033': {
      // Jenos Destinado:
      // "Este Herói só pode ser invocado pelo próprio efeito. Tenha 5 cartas com «Destinado(a)» no nome do seu lado do campo, invoque «Jenos Destinado»."
      const destinadosOnField =
        p.frontline.filter((f) => f !== null && /destinad[oa]/i.test(f.card.name)).length +
        p.backrow.filter((s) => s !== null && /destinad[oa]/i.test(s.card.name)).length +
        p.frontline.reduce(
          (acc, f) =>
            acc + (f ? f.equipments.filter((e) => /destinad[oa]/i.test(e.card.name)).length : 0),
          0
        );
      if (destinadosOnField >= 5) {
        return {
          allowed: true,
          reason: `Requisito cumprido: ${destinadosOnField}/5 cartas «Destinado(a)» em campo.`,
          badgeText: `Pronto (${destinadosOnField}/5 Destinado)`
        };
      }
      return {
        allowed: false,
        reason: `Requer 5 cartas com «Destinado(a)» no nome do seu lado do campo (atual: ${destinadosOnField}/5).`,
        badgeText: `Requer 5 «Destinado(a)» (${destinadosOnField}/5)`
      };
    }

    case '2025/0001/00034': {
      // Jenos Senhor da Guerra:
      // "Este Herói só pode ser invocado pelo próprio efeito. Cause ao menos 5 de dano na vida do seu inimigo na rodada atual, invoque «Jenos Senhor da Guerra»."
      if (p.damageDealtToEnemyPlayerThisRound >= 5) {
        return {
          allowed: true,
          reason: `Requisito cumprido: Causou ${p.damageDealtToEnemyPlayerThisRound}/5 de dano ao oponente nesta rodada.`,
          badgeText: `Pronto (${p.damageDealtToEnemyPlayerThisRound}/5 Dano na Rodada)`
        };
      }
      return {
        allowed: false,
        reason: `Requer causar ao menos 5 de dano na vida do inimigo na rodada atual (atual: ${p.damageDealtToEnemyPlayerThisRound}/5).`,
        badgeText: `Requer 5 Dano na Rodada (${p.damageDealtToEnemyPlayerThisRound}/5)`
      };
    }

    case '2025/0001/00035': {
      // Jenos Caído:
      // "Este Herói só pode ser invocado pelo próprio efeito. Tenha sua vida reduzida à zero e 5 ou mais cartas com «Destinado(a)» no nome em suas Zonas, invoque «Jenos Caído»."
      return {
        allowed: false,
        reason: '«Jenos Caído» é invocado automaticamente quando sua vida é reduzida a 0 tendo 5+ cartas «Destinado(a)» nas suas Zonas.',
        badgeText: 'Gatilho ao chegar a 0 PV (5+ Destinado nas Zonas)'
      };
    }

    case '2025/0001/00061': // Spear Vellret
      return {
        allowed: false,
        reason: '«Spear Vellret» deve ser invocado pela carta «Mensagem Final» (com «Kiara» em campo/mão/Zonas) ou pelo efeito de «Spear Kiara» equipada com «Longinus».',
        badgeText: 'Via «Mensagem Final» ou «Spear Kiara»'
      };

    case '2025/0001/00062': // Vellret - Escolhido de Salazar
      return {
        allowed: false,
        reason: '«Vellret - Escolhido de Salazar» deve ser invocado pela carta «Destruidor de Realidades» ou «Spear Kiara».',
        badgeText: 'Via «Destruidor de Realidades»'
      };

    case '2025/0001/00063': // Vellret - Condenado do Jim
      return {
        allowed: false,
        reason: '«Vellret - Condenado do Jim» deve ser invocado pela carta «Pela Família» ou «Spear Kiara».',
        badgeText: 'Via «Pela Família»'
      };

    case '2025/0001/00091': // Mahina - O Herdeiro de Lúmeni
      return {
        allowed: false,
        reason: '«Mahina - O Herdeiro de Lúmeni» deve ser invocado pelo efeito de «Coroa Lúmeni» ou «Grande Sábio».',
        badgeText: 'Via «Coroa Lúmeni» / «Grande Sábio»'
      };

    case '2025/0001/00092': // Equilíbrio Imperfeito Mahina
      return {
        allowed: false,
        reason: '«Equilíbrio Imperfeito Mahina» deve ser invocado pela carta «Sacrificio Maior» (tendo «Viorie» ou «Karn» nas Zonas).',
        badgeText: 'Via «Sacrificio Maior»'
      };

    case '2025/0001/00093': // Estrategista Mahina
      return {
        allowed: false,
        reason: '«Estrategista Mahina» deve ser invocado pela carta «Mestre Manipulador».',
        badgeText: 'Via «Mestre Manipulador»'
      };

    case '2025/0001/00121': // Donnie - Samurai das Chamas
    case '2025/0001/00122': // Donnie - Grande General
    case '2025/0001/00123': // Donnie - O Sorrateiro
    case '2025/0001/00124': // Donnie - O Fogo Primordial
      return {
        allowed: false,
        reason: `«${card.name}» deve ser invocado pela carta «Mundo em Chamas» (CT 3) ou pelo efeito de sucessão quando outro Herói «Donnie» é enviado às Zonas.`,
        badgeText: 'Via «Mundo em Chamas»'
      };

    case '2025/0001/00151': // Otto - Arauto da Corrupção
      return {
        allowed: false,
        reason: '«Otto - Arauto da Corrupção» deve ser invocado pela carta «Ritos da Corrupção» (CT 1).',
        badgeText: 'Via «Ritos da Corrupção»'
      };

    case '2025/0001/00152': // Asmonious - O Corruptor
      return {
        allowed: false,
        reason: '«Asmonious - O Corruptor» só pode ser invocado pelo efeito de «Otto - Arauto da Corrupção» ao atingir 10 Runas.',
        badgeText: 'Via «Otto» (10 Runas)'
      };

    case '2025/0001/00181': // Salazar - Guia dos Escolhidos
    case '2025/0001/00182': { // Salazar - O Poderoso Líder
      const oppositeCode =
        card.code === '2025/0001/00181' ? '2025/0001/00182' : '2025/0001/00181';
      const oppositeOnField = p.frontline.find(
        (f) => f !== null && f.card.code === oppositeCode && !f.usedOncePerRoundAbility
      );
      if (oppositeOnField) {
        return {
          allowed: true,
          reason: `Troca de Dualidade (1x por rodada): Substitui «${oppositeOnField.card.name}» em campo e gera +1 Runa.`,
          badgeText: 'Trocar Salazar (+1 Runa)'
        };
      }
      return {
        allowed: false,
        reason: `«${card.name}» deve ser invocado pela carta «Invocação do Escolhido» (CT 3) ou «Pelo Bem Maior» (CT 6), ou trocado 1x por rodada com o outro Salazar em campo.`,
        badgeText: 'Via «Invocação do Escolhido»'
      };
    }

    case '2025/0001/00183': {
      // Salazar - Grande Mestre da Dualidade: "Para invocar este Herói, gaste 12 Runas."
      if (p.runes >= 12) {
        return {
          allowed: true,
          reason: `Requisito cumprido: Gastar 12 Runas (atual: ${p.runes} Runas).`,
          badgeText: `Pronto (Gastar 12 Runas)`
        };
      }
      return {
        allowed: false,
        reason: `Para invocar «Salazar - Grande Mestre da Dualidade», gaste 12 Runas (atual: ${p.runes}/12 Runas).`,
        badgeText: `Requer 12 Runas (${p.runes}/12)`
      };
    }

    case '2025/0001/00184': // Salazar - O Falho
      return {
        allowed: false,
        reason: '«Salazar - O Falho» deve ser invocado pela carta «Não Existe Paz Verdadeira» ou «Pelo Bem Maior».',
        badgeText: 'Via «Não Existe Paz Verdadeira»'
      };

    case '2025/0001/00185': {
      // Salazar - Destruidor do Macroverso:
      // "Para invocar esse Herói, é necessário descartar de seu campo para a Zona Apagada «Salazar - Mestre da Dualidade», «Salazar - Guia dos Escolhidos» e «Salazar - O Poderoso Líder» e ter 5 ou menos de vida."
      const hasGuia = p.frontline.some((f) => f !== null && f.card.code === '2025/0001/00181');
      const hasLider = p.frontline.some((f) => f !== null && f.card.code === '2025/0001/00182');
      const hasMestre = p.frontline.some((f) => f !== null && f.card.code === '2025/0001/00183');
      if (p.hp <= 5 && hasGuia && hasLider && hasMestre) {
        return {
          allowed: true,
          reason: 'Requisito cumprido: ≤5 PV e os 3 «Salazar» (Mestre da Dualidade, Guia e Poderoso Líder) em campo!',
          badgeText: 'Pronto (≤5 PV + 3 Salazar)'
        };
      }
      return {
        allowed: false,
        reason: `Requer estar com 5 ou menos de Vida (atual: ${p.hp} PV) e ter em campo «Salazar - Grande Mestre da Dualidade», «Salazar - Guia dos Escolhidos» e «Salazar - O Poderoso Líder».`,
        badgeText: `Requer ≤5 PV (${p.hp} PV) + 3 Salazar`
      };
    }

    case '2025/0001/00211': {
      // Selena - Deusa da Lua: "No início da 5ª Rodada, invoque esta carta em campo."
      if (state.round >= 5) {
        return {
          allowed: true,
          reason: '5ª Rodada alcançada: «Selena - Deusa da Lua» pode ser invocada!',
          badgeText: 'Pronto (5ª Rodada+)'
        };
      }
      return {
        allowed: false,
        reason: `«Selena - Deusa da Lua» é invocada automaticamente no início da 5ª Rodada (Rodada atual: ${state.round}/5).`,
        badgeText: `Invoca na 5ª Rodada (R${state.round}/5)`
      };
    }

    case '2025/0001/00212': // Selena - Conceito da Criação
      return {
        allowed: false,
        reason: '«Selena - Conceito da Criação» só pode ser invocada pelo efeito de «Selena - Deusa da Lua» (após 3 combatentes aliados irem para as Zonas).',
        badgeText: 'Via «Selena - Deusa da Lua»'
      };

    case '2025/0001/00213': // Selena - Mãe dos Guerreiros
      return {
        allowed: false,
        reason: '«Selena - Mãe dos Guerreiros» deve ser invocada pela carta «Luto Eterno» (tendo 5+ combatentes nas Zonas).',
        badgeText: 'Via «Luto Eterno»'
      };

    case '2025/0001/00214': // Selena - Macroverso Inverso
      return {
        allowed: false,
        reason: '«Selena - Macroverso Inverso» deve ser invocada pela carta «Desespero» quando sua vida chegar a 0.',
        badgeText: 'Via «Desespero» (0 PV)'
      };

    default:
      return { allowed: true, reason: 'Pronto para invocar.', badgeText: 'Pronto' };
  }
}

/**
 * Cobra os custos/sacrifícios específicos exigidos pela invocação direta de um Herói da Zona do Herói.
 */
export function payDirectHeroSummonCost(
  state: DuelGameState,
  actorId: PlayerId,
  heroCard: CardData
): void {
  const p = getPlayerState(state, actorId);

  if (heroCard.code === '2026/0001/00301') {
    // Mahina - O Arauto do Véu: se tiver menos de 4 cartas Véu em campo, descarta o Herói Mahina em campo para a Zona Apagada
    const veuCardsCount = countVeuCardsOnPlayerField(p);
    const mahinaSlot = p.frontline.findIndex(
      (f) => f !== null && f.isHero && f.card.name.includes('Mahina')
    );
    if (veuCardsCount < 4 && mahinaSlot !== -1) {
      sendFighterFromFieldToZone(state, actorId, mahinaSlot, true, false);
    }
  } else if (heroCard.code === '2025/0001/00031') {
    // Jenos Senhor do Macroverso: se tiver menos de 2 Heróis nas Zonas, gasta 17 de Mana
    const heroesInZones =
      p.deadZone.filter((c) => c.type === 'Herói').length +
      p.erasedZone.filter((c) => c.type === 'Herói').length;
    if (heroesInZones < 2 && p.mana >= 17) {
      p.mana -= 17;
      addLog(
        state,
        actorId,
        `⚡ ${p.name} gastou 17 de Mana para invocar «Jenos Senhor do Macroverso»!`,
        'effect'
      );
    }
  } else if (heroCard.code === '2025/0001/00032') {
    // Jenos Corrompido: pague 10 de vida de jogador
    p.hp = Math.max(1, p.hp - 10);
    addLog(
      state,
      actorId,
      `💔 ${p.name} pagou 10 PV para invocar «Jenos Corrompido» (Vida: ${p.hp} PV)!`,
      'life_loss'
    );
  } else if (heroCard.code === '2025/0001/00181' || heroCard.code === '2025/0001/00182') {
    // Salazar Guia <-> Poderoso Líder swap: retorna o anterior para a heroDeck e ganha +1 Runa
    const oppositeCode =
      heroCard.code === '2025/0001/00181' ? '2025/0001/00182' : '2025/0001/00181';
    const oppositeSlot = p.frontline.findIndex(
      (f) => f !== null && f.card.code === oppositeCode
    );
    if (oppositeSlot !== -1) {
      const prevHero = p.frontline[oppositeSlot]!;
      p.frontline[oppositeSlot] = null;
      p.heroDeck.push(prevHero.card);
      p.runes += 1;
      addLog(
        state,
        actorId,
        `✨ Troca de Dualidade «Salazar»: «${prevHero.card.name}» retornou à Zona do Herói e ${p.name} recebeu +1 Runa (Total: ${p.runes} Runas)!`,
        'effect'
      );
    }
  } else if (heroCard.code === '2025/0001/00183') {
    // Salazar - Grande Mestre da Dualidade: gaste 12 Runas
    p.runes = Math.max(0, p.runes - 12);
    addLog(
      state,
      actorId,
      `✨ ${p.name} gastou 12 Runas para invocar «Salazar - Grande Mestre da Dualidade»!`,
      'effect'
    );
  } else if (heroCard.code === '2025/0001/00185') {
    // Salazar - Destruidor do Macroverso: descarta Salazars do campo para a Zona Apagada
    for (let i = 0; i < 6; i++) {
      if (p.frontline[i] && p.frontline[i]!.card.name.includes('Salazar')) {
        sendFighterFromFieldToZone(state, actorId, i, true, false);
      }
    }
  }
}

export function getEffectiveCt(p: PlayerDuelState, card: CardData, extraReduction = 0): number {
  if (card.type === 'Herói') return 0;
  // Floquinho Caótica do Véu (2026/0001/00314): "Para invocar esse combatente, gaste Vida de Jogador em vez de mana."
  if (
    card.code === '2025/0001/00029' ||
    card.code === '2025/0001/00112' ||
    card.code === '2026/0001/00314'
  ) {
    return 0;
  }

  let baseCt = card.ct;

  // Selena - Conceito da Criação (2025/0001/00212) e Selena - Mãe dos Guerreiros (2025/0001/00213):
  // "Suas cartas de CT 12 passam a ter CT 1."
  const hasSelenaCt12To1 = p.frontline.some(
    (f) =>
      f !== null &&
      (f.card.code === '2025/0001/00212' || f.card.code === '2025/0001/00213')
  );
  if (hasSelenaCt12To1 && baseCt === 12) {
    baseCt = 1;
  }

  // Deck Véu («Mahina - O Arauto do Véu» 2026/0001/00301 ou Herói com «Véu» em campo)
  const hasMahinaArautoDoVeu = p.frontline.some(
    (f) => f !== null && f.card.code === '2026/0001/00301'
  );
  const hasVeuHeroOnField = p.frontline.some(
    (f) =>
      f !== null &&
      (f.card.code === '2026/0001/00301' ||
        f.card.code === '2026/0001/00313' ||
        (f.isHero && (f.archetypes.includes('Véu') || f.card.name.includes('Véu'))))
  );

  if (hasMahinaArautoDoVeu && card.code === '2026/0001/00312') {
    // A SENHORA DO VÉU (2026/0001/00312): "O custo desta carta se torna 1 caso «Mahina - O Arauto do Véu» esteja em campo."
    baseCt = 1;
  } else if (
    hasMahinaArautoDoVeu &&
    (card.code === '2026/0001/00302' || // Arthemiel do Véu
      card.code === '2026/0001/00303' || // Atropos do Véu
      card.code === '2026/0001/00304' || // Eizen do Véu
      card.code === '2026/0001/00305' || // Três do Véu
      card.code === '2026/0001/00310')   // Aqua Caótica
  ) {
    // "Caso «Mahina - O Arauto do Véu» esteja em campo, o CT desta carta é reduzido em 4."
    baseCt = Math.max(0, baseCt - 4);
  } else if (
    hasVeuHeroOnField &&
    (card.code === '2026/0001/00306' || // Crystal Caótica do Véu
      card.code === '2026/0001/00307' || // Zwey
      card.code === '2026/0001/00308' || // LUNALLY
      card.code === '2026/0001/00311')   // Rebirth do Véu
  ) {
    // "Caso um Herói com «Véu» em seu nome esteja em campo, o CT desta carta é reduzido em 4."
    baseCt = Math.max(0, baseCt - 4);
  }

  // Sexta Camada (2026/0002/00329): "Reduz o CT de suas cartas em 1 para cada carta com «Camada» em seu nome do seu lado do campo."
  let camadaReduction = 0;
  if (hasActiveCamada(p, '2026/0002/00329')) {
    camadaReduction += countCamadasOnField(p);
  }

  const permRed = p.permCtReduction || 0;
  const permPen = p.permCtPenalty || 0;
  const raw = baseCt - p.ctReductionThisRound - permRed + permPen - camadaReduction - extraReduction;
  return Math.max(0, raw);
}

export function getCardAuthorityCt(p: PlayerDuelState, card: CardData): number {
  if (card.type === 'Herói') return card.ct;
  if (card.code === '2026/0001/00314') return card.ct;
  return getEffectiveCt(p, card);
}

export function getEffectiveArchetypes(
  state: DuelGameState,
  fighter: FieldFighter,
  ignoreEquipments = false,
  combatTargetEnemySlot?: number
): string[] {
  const opp = getPlayerState(state, getOpponentId(fighter.owner));
  const oppositeFighter = opp.frontline[fighter.slotIndex];

  const rawHasSolador =
    fighter.archetypes.includes('Solador') ||
    (!ignoreEquipments &&
      fighter.equipments.some((e) => (e.grantedArchetypes || []).includes('Solador')));

  // O HORROR DO VÉU (2026/0001/00313): "Enquanto esta carta estiver em campo, os combatentes inimigos perdem seus Arquétipos."
  // Se este combatente tem [Solador] e está em combate contra um alvo específico, ignora outras cartas inimigas fora a carta alvo.
  const horrorApplies = opp.frontline.some(
    (f) =>
      f !== null &&
      f.card.code === '2026/0001/00313' &&
      (!rawHasSolador || combatTargetEnemySlot === undefined || f.slotIndex === combatTargetEnemySlot)
  );
  if (horrorApplies) {
    return [];
  }

  // Arquétipo [Véu]: Anula arquétipos do combatente inimigo na mesma coluna
  // (em caso de dois combatentes com Véu um em frente ao outro, ambos ficam sem os Arquétipos)
  if (
    oppositeFighter &&
    (!rawHasSolador ||
      combatTargetEnemySlot === undefined ||
      oppositeFighter.slotIndex === combatTargetEnemySlot)
  ) {
    const oppRawArchs = [
      ...oppositeFighter.archetypes,
      ...(rawHasSolador
        ? []
        : oppositeFighter.equipments.flatMap((e) => e.grantedArchetypes || []))
    ];
    if (oppRawArchs.includes('Véu')) {
      return [];
    }
  }

  let list = [...fighter.archetypes];
  const hasDivindade = list.includes('Divindade');

  if (!ignoreEquipments) {
    for (const eq of fighter.equipments) {
      if (eq.grantedArchetypes && eq.grantedArchetypes.length > 0) {
        for (const a of eq.grantedArchetypes) {
          list.push(a);
          if (
            hasDivindade &&
            eq.grantedArchetypes.length === 1 &&
            (a === 'Lúmen' || a === 'Darkus')
          ) {
            list.push(a);
          }
        }
      }
    }
  }

  // Floquinho Caótica do Véu (2026/0001/00314):
  // "Esse combatente remove o Arquétipo Macroversal dos Heróis inimigos enquanto estiver em campo."
  if (
    fighter.isHero &&
    opp.frontline.some(
      (f) =>
        f !== null &&
        f.card.code === '2026/0001/00314' &&
        (!rawHasSolador || combatTargetEnemySlot === undefined || f.slotIndex === combatTargetEnemySlot)
    )
  ) {
    list = list.filter((a) => a !== 'Macroversal');
  }

  return list;
}

export function countArchetypeStacks(
  state: DuelGameState,
  fighter: FieldFighter,
  archName: string,
  ignoreEquipments = false,
  combatTargetEnemySlot?: number
): number {
  return getEffectiveArchetypes(state, fighter, ignoreEquipments, combatTargetEnemySlot).filter(
    (a) => a === archName
  ).length;
}

export function hasArchetype(
  state: DuelGameState,
  fighter: FieldFighter,
  archName: string,
  ignoreEquipments = false,
  combatTargetEnemySlot?: number
): boolean {
  return (
    countArchetypeStacks(state, fighter, archName, ignoreEquipments, combatTargetEnemySlot) > 0
  );
}

export function getFighterEffectiveAtk(
  state: DuelGameState,
  fighter: FieldFighter,
  inCombat = false,
  ignoredByEnemySolador = false
): number {
  const ownerState = getPlayerState(state, fighter.owner);
  const oppState = getPlayerState(state, getOpponentId(fighter.owner));
  let atk = fighter.baseAtk + fighter.permAtkBonus + fighter.tempAtkBonus;

  // Jim - Assassino (2025/0001/00004): +2 ATK por Jim na Zona Apagada
  if (fighter.card.code === '2025/0001/00004') {
    const erasedJimFighters = ownerState.erasedZone.filter(
      (c) => isJimCard(c) && (c.type === 'Combatente' || c.type === 'Herói')
    ).length;
    atk += erasedJimFighters * 2;
  }

  // Jim - Paladina (2025/0001/00006): +8 ATK em combate
  if (inCombat && fighter.card.code === '2025/0001/00006') {
    atk += 8;
  }

  // Spear Vellret (2025/0001/00061): "Ganha +5 de Ataque para cada carta com «Longinus» no nome em seu lado do campo."
  if (fighter.card.code === '2025/0001/00061') {
    let longinusCount = 0;
    for (const f of ownerState.frontline) {
      if (f) {
        if (f.card.name.includes('Longinus')) longinusCount++;
        longinusCount += f.equipments.filter((e) => e.card.name.includes('Longinus')).length;
      }
    }
    for (const s of ownerState.backrow) {
      if (s && s.card.name.includes('Longinus')) longinusCount++;
    }
    atk += longinusCount * 5;
  }

  // Estrategista Mahina (2025/0001/00093): "Ganha +3 de Ataque para cada combatente em campo com a vida atual diferente da vida base."
  if (fighter.card.code === '2025/0001/00093') {
    const diffHpFighters = [...ownerState.frontline, ...oppState.frontline].filter(
      (f) => f !== null && f.currentHp !== f.baseHp
    ).length;
    atk += diffHpFighters * 3;
  }

  // Asmonious - O Corruptor (2025/0001/00152) & Salazar - Grande Mestre da Dualidade (2025/0001/00183):
  // "Ganha +3 de Ataque para cada Runa em seu campo."
  if (fighter.card.code === '2025/0001/00152' || fighter.card.code === '2025/0001/00183') {
    atk += ownerState.runes * 3;
  }

  // Salazar - Guia dos Escolhidos (2025/0001/00181):
  // "Seus combatentes com «Blair» ou «Hyummeng» no nome ganham +5 de Ataque."
  // Se o oponente tem [Solador], ignora outras cartas inimigas fora a carta alvo (como um Salazar em outra coluna).
  if (
    !ignoredByEnemySolador &&
    (fighter.card.name.includes('Blair') || fighter.card.name.includes('Hyummeng')) &&
    ownerState.frontline.some((f) => f !== null && f.card.code === '2025/0001/00181')
  ) {
    atk += 5;
  }

  // Salazar - O Falho (2025/0001/00184):
  // "Para cada carta no seu Deck, este Herói ganha +1 de CT, +1 de Ataque e +1 de Vida."
  if (fighter.card.code === '2025/0001/00184') {
    atk += ownerState.deck.length;
  }

  // Selena - Mãe dos Guerreiros (2025/0001/00213):
  // "Ganha +5 de Ataque e +5 de Vida para cada carta de CT 12 nas suas Zonas."
  if (fighter.card.code === '2025/0001/00213') {
    const ct12InZones =
      ownerState.deadZone.filter((c) => c.ct === 12).length +
      ownerState.erasedZone.filter((c) => c.ct === 12).length;
    atk += ct12InZones * 5;
  }

  // Selena - Macroverso Inverso (2025/0001/00214):
  // "Ganha +5 de Ataque para cada carta na sua Zona Morta."
  if (fighter.card.code === '2025/0001/00214') {
    atk += ownerState.deadZone.length * 5;
  }

  // PRIMEIRA CAMADA (2026/0002/00324):
  // "Seus combatentes recebem 1 de ataque para cada carta com «Camada» em seu nome do seu lado do campo.
  // Seus combatentes com Arquétipo Véu recebem 3 de ataque para cada carta com «Camada» em seu nome do seu lado do campo."
  // Se o oponente tem [Solador], ignora outras cartas inimigas fora a carta alvo (como Primeira Camada no suporte).
  if (!ignoredByEnemySolador && hasActiveCamada(ownerState, '2026/0002/00324')) {
    const ownCamadasCount = countCamadasOnField(ownerState);
    const hasVeu = hasArchetype(state, fighter, 'Véu');
    atk += ownCamadasCount * (hasVeu ? 3 : 1);
  }

  // Crystal Caótica do Véu (2026/0001/00306): "Recebe +5 de ataque para cada carta no campo inimigo."
  if (fighter.card.code === '2026/0001/00306') {
    const enemyCardsOnField =
      oppState.frontline.filter((f) => f !== null).length +
      oppState.backrow.reduce((acc, s) => acc + (s ? getAllSupportCardsInSlot(s).length : 0), 0);
    atk += enemyCardsOnField * 5;
  }

  // RYURAN (2026/0001/00309): "Para cada combatente com Arquétipo Véu do seu lado do campo ou suas Zonas, esta carta recebe +3 de ataque."
  if (fighter.card.code === '2026/0001/00309') {
    const veuOnField = ownerState.frontline.filter(
      (f) => f !== null && hasArchetype(state, f, 'Véu')
    ).length;
    const veuInZones =
      ownerState.deadZone.filter(
        (c) => (c.type === 'Combatente' || c.type === 'Herói') && parseBaseArchetypes(c).includes('Véu')
      ).length +
      ownerState.erasedZone.filter(
        (c) => (c.type === 'Combatente' || c.type === 'Herói') && parseBaseArchetypes(c).includes('Véu')
      ).length;
    atk += (veuOnField + veuInZones) * 3;
  }

  // Bônus de ATK de Equipamentos acoplados ao combatente
  // Respeita [Solador] (ignora equipamentos inimigos no combate, pois são outras cartas fora a carta alvo) e [Divindade]
  if (!ignoredByEnemySolador) {
    const equipMult = hasArchetype(state, fighter, 'Divindade') ? 2 : 1;
    for (const eq of fighter.equipments) {
      const desc = eq.card.description || '';
      const atkPlusMatch = desc.match(/\+(\d+)\s*de\s*(?:Ataque|ataque)/i);
      if (atkPlusMatch) {
        atk += parseInt(atkPlusMatch[1], 10) * equipMult;
      }
      const atkMinusMatch = desc.match(/-(\d+)\s*de\s*(?:Ataque|ataque)/i);
      if (atkMinusMatch) {
        atk -= parseInt(atkMinusMatch[1], 10) * equipMult;
      }
    }
  }

  return Math.max(0, atk);
}

/**
 * Quantidade máxima de ataques que um combatente pode realizar no turno atual.
 */
export function getMaxAttacksPerTurn(state: DuelGameState, fighter: FieldFighter): number {
  const owner = getPlayerState(state, fighter.owner);

  // Crystal Caótica do Véu (2026/0001/00306):
  // "Se alguma carta com «Jim» ou «Mahina» em seu nome estiver do seu lado do campo, «Crystal Caótica do Véu» ataca duas vezes por turno."
  if (fighter.card.code === '2026/0001/00306') {
    const hasJimOrMahinaOnSide =
      owner.frontline.some(
        (f) => f !== null && (f.card.name.includes('Jim') || f.card.name.includes('Mahina'))
      ) ||
      owner.backrow.some(
        (s) =>
          s !== null &&
          getAllSupportCardsInSlot(s).some(
            (c) => c.name.includes('Jim') || c.name.includes('Mahina')
          )
      );
    if (hasJimOrMahinaOnSide) return 2;
  }

  // Jenos Corrompido (2025/0001/00032), Longinus Duelista (2025/0001/00068), Zeus (2025/0001/00215)
  if (
    fighter.card.code === '2025/0001/00032' ||
    fighter.card.code === '2025/0001/00068' ||
    fighter.card.code === '2025/0001/00215'
  ) {
    return 2;
  }

  // Spear Vellret (2025/0001/00061): "Pode atacar 2 vezes por turno caso haja 2 ou mais cartas «Errante» em seu lado do campo."
  if (fighter.card.code === '2025/0001/00061') {
    const errantes =
      owner.frontline.filter((f) => f !== null && f.card.name.includes('Errante')).length +
      owner.backrow.filter((s) => s !== null && s.card.name.includes('Errante')).length;
    if (errantes >= 2) return 2;
  }

  return 1;
}

/**
 * Sincroniza o efeito contínuo de «Crystal Caótica do Véu» (2026/0001/00306):
 * "Enquanto este combatente estiver em campo, o ataque e vida de todos os combatentes inimigos são invertidos
 * (caso a vida se torne 0, ele é enviado para a Zona Morta)."
 */
export function syncCrystalCaoticaStatInversion(state: DuelGameState): void {
  for (const sideId of ['player', 'bot'] as PlayerId[]) {
    const side = getPlayerState(state, sideId);
    const opp = getPlayerState(state, getOpponentId(sideId));
    const oppHasCrystal = opp.frontline.some(
      (f) => f !== null && f.card.code === '2026/0001/00306'
    );

    for (let slot = 0; slot < 6; slot++) {
      const f = side.frontline[slot];
      if (!f) continue;
      const alreadyInverted = Boolean((f as any).crystalInverted);

      if (oppHasCrystal && !alreadyInverted) {
        const prevAtk = Math.max(0, f.baseAtk + f.permAtkBonus + f.tempAtkBonus);
        const prevHp = f.currentHp;
        f.baseAtk = prevHp;
        f.permAtkBonus = 0;
        f.tempAtkBonus = 0;
        f.baseHp = prevAtk;
        f.currentHp = prevAtk;
        f.maxHp = Math.max(1, prevAtk);
        (f as any).crystalInverted = true;

        addLog(
          state,
          opp.id,
          `💎 «Crystal Caótica do Véu»: Status de «${f.card.name}» invertidos (${prevAtk}/${prevHp} → ATK ${f.baseAtk} / Vida ${f.currentHp})!`,
          'effect'
        );

        if (f.currentHp <= 0) {
          addLog(
            state,
            opp.id,
            `💀 «Crystal Caótica do Véu»: A vida de «${f.card.name}» tornou-se 0 após a inversão e ele foi enviado para a Zona Morta!`,
            'life_loss'
          );
          sendFighterFromFieldToZone(state, sideId, slot, false, false);
        }
      } else if (!oppHasCrystal && alreadyInverted) {
        const prevAtk = Math.max(0, f.baseAtk + f.permAtkBonus + f.tempAtkBonus);
        const prevHp = f.currentHp;
        f.baseAtk = prevHp;
        f.permAtkBonus = 0;
        f.tempAtkBonus = 0;
        f.baseHp = prevAtk;
        f.currentHp = Math.max(1, prevAtk);
        f.maxHp = Math.max(1, prevAtk);
        (f as any).crystalInverted = false;
      }
    }
  }
}

export function isProtectedByJimAnciao(
  state: DuelGameState,
  fighter: FieldFighter,
  attackerIsSolador = false
): boolean {
  if (attackerIsSolador) return false;
  if (!isJimCard(fighter.card)) return false;

  const ownerState = getPlayerState(state, fighter.owner);
  return ownerState.frontline.some(
    (ally) =>
      ally !== null &&
      ally.instanceId !== fighter.instanceId &&
      ally.card.code === '2025/0001/00010'
  );
}

function tryTriggerZeroHpHeroSave(state: DuelGameState, pid: PlayerId): boolean {
  const p = getPlayerState(state, pid);
  if (p.hp > 0) return false;

  // 1. Jenos Caído (2025/0001/00035):
  // "Tenha sua vida reduzida à zero e 5 ou mais cartas com «Destinado(a)» no nome em suas Zonas, invoque «Jenos Caído». Ao ser invocado, recupere 20 de vida de jogador."
  const jenosCaidoIdx = p.heroDeck.findIndex((c) => c.code === '2025/0001/00035');
  const destinadosInZones =
    p.deadZone.filter((c) => /destinad[oa]/i.test(c.name)).length +
    p.erasedZone.filter((c) => /destinad[oa]/i.test(c.name)).length;

  if (jenosCaidoIdx !== -1 && destinadosInZones >= 5) {
    const [jenosCaido] = p.heroDeck.splice(jenosCaidoIdx, 1);
    p.hp = 20;
    const slot = p.frontline.findIndex((s) => s === null);
    const targetSlot = slot !== -1 ? slot : 0;
    addLog(
      state,
      pid,
      `👑 Gatilho de Sobrevivência! Com ${destinadosInZones} cartas «Destinado(a)» nas Zonas, ${p.name} invocou «Jenos Caído» e recuperou 20 PV!`,
      'summon'
    );
    summonFighterToSlot(state, pid, jenosCaido, targetSlot);
    return true;
  }

  // 2. Desespero (2025/0001/00228) -> Selena - Macroverso Inverso (2025/0001/00214):
  // "Quando sua vida for reduzida a 0, recupere 9 de vida e invoque «Selena - Macroverso Inverso» de qualquer lugar."
  const desesperoIdx = p.hand.findIndex((c) => c.code === '2025/0001/00228');
  if (desesperoIdx !== -1) {
    const [desespero] = p.hand.splice(desesperoIdx, 1);
    p.deadZone.push(desespero);
    p.hp = 9;

    let selenaInverso: CardData | null = null;
    const hIdx = p.heroDeck.findIndex((c) => c.code === '2025/0001/00214');
    const dIdx = p.deck.findIndex((c) => c.code === '2025/0001/00214');
    const zIdx = p.deadZone.findIndex((c) => c.code === '2025/0001/00214');
    const eIdx = p.erasedZone.findIndex((c) => c.code === '2025/0001/00214');
    if (hIdx !== -1) selenaInverso = p.heroDeck.splice(hIdx, 1)[0];
    else if (dIdx !== -1) selenaInverso = p.deck.splice(dIdx, 1)[0];
    else if (zIdx !== -1) selenaInverso = p.deadZone.splice(zIdx, 1)[0];
    else if (eIdx !== -1) selenaInverso = p.erasedZone.splice(eIdx, 1)[0];

    addLog(
      state,
      pid,
      `👑 «Desespero» ativado ao chegar a 0 PV! ${p.name} recuperou 9 PV e invocou «Selena - Macroverso Inverso»!`,
      'summon'
    );
    if (selenaInverso) {
      const slot = p.frontline.findIndex((s) => s === null);
      summonFighterToSlot(state, pid, selenaInverso, slot !== -1 ? slot : 0);
    }
    return true;
  }

  return false;
}

export function checkWinCondition(state: DuelGameState): boolean {
  if (state.phase === 'GAME_OVER') return true;

  if (state.player.hp <= 0) {
    tryTriggerZeroHpHeroSave(state, 'player');
  }
  if (state.bot.hp <= 0) {
    tryTriggerZeroHpHeroSave(state, 'bot');
  }

  if (state.player.hp <= 0 && state.bot.hp <= 0) {
    state.player.hp = 0;
    state.bot.hp = 0;
    state.phase = 'GAME_OVER';
    state.winner = 'draw';
    state.winReason = 'Ambos os jogadores chegaram a 0 Pontos de Vida simultaneamente!';
    addLog(state, 'system', state.winReason, 'life_loss');
    return true;
  }

  if (state.player.hp <= 0) {
    state.player.hp = 0;
    state.phase = 'GAME_OVER';
    state.winner = 'bot';
    state.winReason = 'Seus Pontos de Vida chegaram a 0. Vitória do Bot!';
    addLog(state, 'bot', state.winReason, 'life_loss');
    return true;
  }

  if (state.bot.hp <= 0) {
    state.bot.hp = 0;
    state.phase = 'GAME_OVER';
    state.winner = 'player';
    state.winReason = 'Os Pontos de Vida do Bot chegaram a 0. Você venceu o duelo!';
    addLog(state, 'player', state.winReason, 'summon');
    return true;
  }

  return false;
}

export function dealDamageToPlayer(
  state: DuelGameState,
  targetId: PlayerId,
  sourceId: PlayerId,
  amount: number,
  reason: string
): number {
  if (amount <= 0) return 0;
  if (state.round === 1 && targetId !== sourceId) {
    addLog(
      state,
      'system',
      `Proteção da 1ª Rodada: ${targetId === 'player' ? 'Você' : 'O Bot'} não sofreu os ${amount} de dano de ${reason}.`,
      'info'
    );
    return 0;
  }

  const target = getPlayerState(state, targetId);
  const source = getPlayerState(state, sourceId);

  // Donnie - O Sorrateiro (2025/0001/00123): "O jogador não recebe dano de fontes que causam 1 de dano."
  if (
    amount === 1 &&
    target.frontline.some((f) => f !== null && f.card.code === '2025/0001/00123')
  ) {
    addLog(
      state,
      targetId,
      `🛡️ «Donnie - O Sorrateiro»: ${target.name} ignorou 1 de dano de ${reason}!`,
      'effect'
    );
    return 0;
  }

  target.hp = Math.max(0, target.hp - amount);
  if (sourceId !== targetId) {
    source.damageDealtToEnemyPlayerThisRound += amount;

    // Jenos Corrompido (2025/0001/00032): "Sempre que causar dano na vida do jogador inimigo, ganha +2 de Ataque."
    for (const f of source.frontline) {
      if (f && f.card.code === '2025/0001/00032') {
        f.permAtkBonus += 2;
        addLog(
          state,
          sourceId,
          `⚔️ «Jenos Corrompido» recebeu +2 de Ataque por causar dano à vida de ${target.name}!`,
          'effect'
        );
      }
      // Donnie - Samurai das Chamas (2025/0001/00121):
      // "Sempre que causar dano na vida do jogador inimigo, cause 2 de dano em todos os combatentes inimigos e descarte 2 cartas do topo do Deck inimigo."
      if (f && f.card.code === '2025/0001/00121' && !reason.includes('Samurai das Chamas')) {
        const milled = target.deck.splice(0, Math.min(2, target.deck.length));
        target.deadZone.push(...milled);
        for (let slot = 0; slot < 6; slot++) {
          if (target.frontline[slot]) {
            target.frontline[slot]!.currentHp -= 2;
            if (target.frontline[slot]!.currentHp <= 0) {
              sendFighterFromFieldToZone(state, targetId, slot, false, false);
            }
          }
        }
        addLog(
          state,
          sourceId,
          `🔥 «Donnie - Samurai das Chamas»: Causou 2 de dano a todos os combatentes inimigos e descartou ${milled.length} carta(s) do topo do Deck de ${target.name}!`,
          'effect'
        );
      }
    }
  }

  addLog(
    state,
    sourceId,
    `💔 ${target.name} perdeu ${amount} PV (${reason}). Vida restante: ${target.hp} PV.`,
    'life_loss'
  );
  checkWinCondition(state);
  return amount;
}

export function sendFighterFromFieldToZone(
  state: DuelGameState,
  ownerId: PlayerId,
  slotIndex: number,
  forceErasedZone = false,
  byCombat = false,
  withoutActivatingEffects = false
): FieldFighter | null {
  const owner = getPlayerState(state, ownerId);
  const fighter = owner.frontline[slotIndex];
  if (!fighter) return null;

  // Fallen Destinada (2025/0001/00041):
  // "Descarte esse combatente do seu lado do campo para a Zona Apagada e negue a morte de um Herói aliado."
  if (!withoutActivatingEffects && fighter.isHero && fighter.card.code !== '2025/0001/00041') {
    const fallenSlot = owner.frontline.findIndex(
      (f) => f !== null && f.card.code === '2025/0001/00041'
    );
    if (fallenSlot !== -1) {
      const fallen = owner.frontline[fallenSlot]!;
      owner.frontline[fallenSlot] = null;
      owner.erasedZone.push(fallen.card);
      fighter.currentHp = Math.max(1, fighter.currentHp);
      addLog(
        state,
        ownerId,
        `🛡️ «Fallen Destinada» foi descartada do campo para a Zona Apagada para negar a morte do Herói «${fighter.card.name}»!`,
        'reaction'
      );
      return null;
    }
  }

  // Vellret - Condenado do Jim (2025/0001/00063):
  // "Uma vez por invocação, pague 7 de vida de jogador para negar a própria morte."
  if (
    !withoutActivatingEffects &&
    fighter.card.code === '2025/0001/00063' &&
    !fighter.usedOncePerRoundAbility &&
    owner.hp > 7
  ) {
    fighter.usedOncePerRoundAbility = true;
    owner.hp -= 7;
    fighter.currentHp = Math.max(1, fighter.currentHp);
    addLog(
      state,
      ownerId,
      `🛡️ «Vellret - Condenado do Jim»: ${owner.name} pagou 7 PV (Vida: ${owner.hp} PV) para negar a morte de «Vellret - Condenado do Jim»!`,
      'reaction'
    );
    return null;
  }

  owner.frontline[slotIndex] = null;

  for (const eq of fighter.equipments) {
    owner.deadZone.push(eq.card);
  }

  const toErased =
    !withoutActivatingEffects &&
    (forceErasedZone || goesToErasedWhenEliminated(fighter.card, withoutActivatingEffects));
  if (toErased) {
    owner.erasedZone.push(fighter.card);
    addLog(
      state,
      ownerId,
      `«${fighter.card.name}» foi enviado para a Zona Apagada (${countJimsInErasedZone(owner)} «Jim» na Zona Apagada).`,
      'info'
    );
  } else {
    owner.deadZone.push(fighter.card);
    addLog(
      state,
      ownerId,
      withoutActivatingEffects
        ? `«${fighter.card.name}» foi enviado para a Zona Morta sem ativar seus efeitos.`
        : `«${fighter.card.name}» foi enviado para a Zona Morta.`,
      'info'
    );
  }

  if (byCombat) {
    owner.lostFighterInBattleThisTurn = true;
  }
  if (fighter.isHero) {
    owner.heroDiedThisTurn = true;
  }

  if (!withoutActivatingEffects) {
    // 0. Floquinho Caótica do Véu (2026/0001/00314):
    // "Quando enviada do campo para qualquer Zona, você recebe 5 Runas."
    if (fighter.card.code === '2026/0001/00314') {
      owner.runes += 5;
      addLog(
        state,
        ownerId,
        `✨ «Floquinho Caótica do Véu» foi enviada do campo para as Zonas e concedeu +5 Runas a ${owner.name} (Total: ${owner.runes} Runas)!`,
        'effect'
      );
      checkOttoAscensionToAsmonious(state, ownerId);
    }

    // 1. A SENHORA DO VÉU (2026/0001/00312):
    // "Caso um Herói com «Véu» em seu nome seja enviado do seu campo para alguma Zona, descarte esta carta do campo e invoque de qualquer lugar «O Horror do Véu»."
    if (fighter.isHero && fighter.card.name.includes('Véu')) {
      const senhoraSlot = owner.frontline.findIndex(
        (f) => f !== null && f.card.code === '2026/0001/00312'
      );
      if (senhoraSlot !== -1) {
        const senhora = owner.frontline[senhoraSlot]!;
        owner.frontline[senhoraSlot] = null;
        owner.deadZone.push(senhora.card);

        let horrorCard: CardData | null = null;
        const dIdx = owner.deck.findIndex((c) => c.code === '2026/0001/00313');
        const hIdx = owner.hand.findIndex((c) => c.code === '2026/0001/00313');
        const zIdx = owner.deadZone.findIndex((c) => c.code === '2026/0001/00313');
        const eIdx = owner.erasedZone.findIndex((c) => c.code === '2026/0001/00313');

        if (dIdx !== -1) horrorCard = owner.deck.splice(dIdx, 1)[0];
        else if (hIdx !== -1) horrorCard = owner.hand.splice(hIdx, 1)[0];
        else if (zIdx !== -1) horrorCard = owner.deadZone.splice(zIdx, 1)[0];
        else if (eIdx !== -1) horrorCard = owner.erasedZone.splice(eIdx, 1)[0];

        if (horrorCard) {
          addLog(
            state,
            ownerId,
            `👁️ «A Senhora do Véu» foi descartada após a queda de «${fighter.card.name}» e invocou «O Horror do Véu»!`,
            'summon'
          );
          summonFighterToSlot(state, ownerId, horrorCard, senhoraSlot);
        }
      }
    }

    // 2. Sucessão dos 4 Heróis «Donnie» (2025/0001/00121, 00122, 00123, 00124):
    // "Ao ser enviado para Zona Morta ou Apagada, invoque do seu lado do campo, qualquer outro Herói com «Donnie» em seu nome que ainda não foi usado no jogo."
    if (fighter.isHero && fighter.card.name.includes('Donnie')) {
      if (fighter.card.code === '2025/0001/00124') {
        const cfIdx = owner.deck.findIndex((c) => c.name.includes('Conceito Fogo'));
        if (cfIdx !== -1) {
          const [cfCard] = owner.deck.splice(cfIdx, 1);
          owner.hand.push(cfCard);
          addLog(
            state,
            ownerId,
            `🔥 «Donnie - O Fogo Primordial»: Buscou «${cfCard.name}» do Deck para a mão ao sair do campo!`,
            'effect'
          );
        }
      }
      const nextDonnieIdx = owner.heroDeck.findIndex((c) => c.name.includes('Donnie'));
      if (nextDonnieIdx !== -1) {
        const [nextDonnie] = owner.heroDeck.splice(nextDonnieIdx, 1);
        addLog(
          state,
          ownerId,
          `🔥 Sucessão «Donnie»! Após «${fighter.card.name}» ir para as Zonas, «${nextDonnie.name}» foi invocado automaticamente!`,
          'summon'
        );
        summonFighterToSlot(state, ownerId, nextDonnie, slotIndex);
      }
    }

    // 3. Mahina - O Herdeiro de Lúmeni (2025/0001/00091):
    // "Quando for enviado para a Zona Morta ou Apagada, invoque até 2 combatentes com «Viorie» ou «Karn» no nome do Deck ou mão."
    if (fighter.card.code === '2025/0001/00091') {
      let summonedCount = 0;
      const isViorieOrKarn = (c: CardData) =>
        c.type === 'Combatente' && (c.name.includes('Viorie') || c.name.includes('Karn'));
      for (let s = 0; s < 6 && summonedCount < 2; s++) {
        if (owner.frontline[s] === null) {
          const dIdx = owner.deck.findIndex(isViorieOrKarn);
          const hIdx = owner.hand.findIndex(isViorieOrKarn);
          let vkCard: CardData | null = null;
          if (dIdx !== -1) vkCard = owner.deck.splice(dIdx, 1)[0];
          else if (hIdx !== -1) vkCard = owner.hand.splice(hIdx, 1)[0];
          if (vkCard) {
            summonFighterToSlot(state, ownerId, vkCard, s);
            summonedCount++;
          }
        }
      }
    }

    // 4. Otto - Arauto da Corrupção (2025/0001/00151) & Asmonious - O Corruptor (2025/0001/00152):
    if (
      (fighter.card.code === '2025/0001/00151' || fighter.card.code === '2025/0001/00152') &&
      owner.deck.length > 0 &&
      owner.frontline[slotIndex] === null
    ) {
      const millNeed = fighter.card.code === '2025/0001/00151' ? 2 : 1;
      if (owner.deck.length >= millNeed) {
        const milled = owner.deck.splice(0, millNeed);
        owner.erasedZone.push(...milled);
        const zIdx = owner.deadZone.indexOf(fighter.card);
        if (zIdx !== -1) owner.deadZone.splice(zIdx, 1);
        else {
          const eIdx = owner.erasedZone.indexOf(fighter.card);
          if (eIdx !== -1) owner.erasedZone.splice(eIdx, 1);
        }
        addLog(
          state,
          ownerId,
          `💀 «${fighter.card.name}» enviou ${millNeed} carta(s) do topo do Deck para a Zona Apagada e retornou ao campo!`,
          'summon'
        );
        summonFighterToSlot(state, ownerId, fighter.card, slotIndex);
      }
    }

    // 5. Selena - Deusa da Lua (2025/0001/00211):
    const selenaLuaSlot = owner.frontline.findIndex(
      (f) => f !== null && f.card.code === '2025/0001/00211'
    );
    if (selenaLuaSlot !== -1 && fighter.card.code !== '2025/0001/00211') {
      owner.alliedFightersLostWhileSelenaLuaActive += 1;
      if (owner.alliedFightersLostWhileSelenaLuaActive >= 3) {
        const selenaLua = owner.frontline[selenaLuaSlot]!;
        owner.frontline[selenaLuaSlot] = null;
        owner.deck.push(selenaLua.card);
        owner.alliedFightersLostWhileSelenaLuaActive = 0;

        let selenaCriacao: CardData | null = null;
        const hIdx = owner.heroDeck.findIndex((c) => c.code === '2025/0001/00212');
        const dIdx = owner.deck.findIndex((c) => c.code === '2025/0001/00212');
        if (hIdx !== -1) selenaCriacao = owner.heroDeck.splice(hIdx, 1)[0];
        else if (dIdx !== -1) selenaCriacao = owner.deck.splice(dIdx, 1)[0];

        if (selenaCriacao) {
          addLog(
            state,
            ownerId,
            `🌙 «Selena - Deusa da Lua»: Após 3 combatentes aliados irem para as Zonas, retornou ao Deck e invocou «Selena - Conceito da Criação»!`,
            'summon'
          );
          summonFighterToSlot(state, ownerId, selenaCriacao, selenaLuaSlot);
        }
      }
    }
  }

  syncCrystalCaoticaStatInversion(state);
  return fighter;
}

export function applyEffectDamageToFighter(
  state: DuelGameState,
  sourcePlayerId: PlayerId,
  targetOwnerId: PlayerId,
  targetSlotIndex: number,
  rawDamage: number,
  sourceCard: CardData,
  sourceEffectiveCt: number,
  skipAzaradoRedirect = false
): boolean {
  const targetOwner = getPlayerState(state, targetOwnerId);
  let actualSlot = targetSlotIndex;
  let targetFighter = targetOwner.frontline[actualSlot];
  if (!targetFighter) return false;

  const isEnemyEffect = sourcePlayerId !== targetOwnerId;

  if (isEnemyEffect && !skipAzaradoRedirect) {
    const azaradoFighter = targetOwner.frontline.find(
      (f) => f !== null && !f.azaradoUsedThisRound && hasArchetype(state, f, 'Azarado')
    );
    if (azaradoFighter && azaradoFighter.slotIndex !== actualSlot) {
      azaradoFighter.azaradoUsedThisRound = true;
      actualSlot = azaradoFighter.slotIndex;
      targetFighter = azaradoFighter;
      addLog(
        state,
        targetOwnerId,
        `Arquétipo [Azarado]: «${azaradoFighter.card.name}» atraiu o efeito de «${sourceCard.name}» para si!`,
        'reaction'
      );
    } else if (azaradoFighter && azaradoFighter.slotIndex === actualSlot) {
      azaradoFighter.azaradoUsedThisRound = true;
    }
  }

  // Imunidade a efeitos de cartas concedida por «Ritos do Festival» na rodada em que é invocado
  if (targetFighter.immuneToCardEffectsRound === state.round) {
    addLog(
      state,
      targetOwnerId,
      `🛡️ «${targetFighter.card.name}» está imune a efeitos de cartas nesta rodada («Ritos do Festival»)!`,
      'effect'
    );
    return false;
  }

  if (
    isEnemyEffect &&
    !targetFighter.macroversalUsedThisRound &&
    hasArchetype(state, targetFighter, 'Macroversal') &&
    sourceEffectiveCt < targetFighter.card.ct
  ) {
    targetFighter.macroversalUsedThisRound = true;
    addLog(
      state,
      targetOwnerId,
      `Arquétipo [Macroversal] disparou obrigatoriamente! «${targetFighter.card.name}» (CT ${targetFighter.card.ct}) negou o efeito de «${sourceCard.name}» (CT ${sourceEffectiveCt})!`,
      'reaction'
    );
    return false;
  }

  const darkusStacks = countArchetypeStacks(state, targetFighter, 'Darkus');
  let finalDamage = Math.max(0, rawDamage - darkusStacks * 3);
  if (darkusStacks > 0 && rawDamage > 0) {
    addLog(
      state,
      targetOwnerId,
      `Arquétipo [Darkus]: Reduziu o dano de efeito em ${darkusStacks * 3} (${rawDamage} → ${finalDamage}).`,
      'effect'
    );
  }

  const hasGema5 = targetFighter.equipments.some((e) => e.card.code === '2025/0001/00015');
  if (hasGema5 && finalDamage > 0) {
    finalDamage = Math.floor(finalDamage / 2);
    addLog(
      state,
      targetOwnerId,
      `«Gema Macroversal 5»: Dano de efeito reduzido pela metade (${finalDamage}).`,
      'effect'
    );
  }

  if (finalDamage <= 0) {
    addLog(
      state,
      targetOwnerId,
      `«${targetFighter.card.name}» não sofreu dano do efeito de «${sourceCard.name}».`,
      'info'
    );
    return false;
  }

  targetFighter.currentHp -= finalDamage;
  addLog(
    state,
    sourcePlayerId,
    `💔 «${sourceCard.name}» causou ${finalDamage} de dano a «${targetFighter.card.name}» (Vida restante: ${Math.max(0, targetFighter.currentHp)}).`,
    'life_loss'
  );

  if (targetFighter.currentHp <= 0) {
    sendFighterFromFieldToZone(state, targetOwnerId, actualSlot, false, false);
    return true;
  }
  return false;
}

/**
 * Aplica dano de efeito em área (AoE) a todos os combatentes inimigos.
 * Regra Oficial de [Azarado]: "Inclusive efeitos em área (concentrando todo o efeito apenas no portador)".
 */
export function applyAoEEffectDamageToEnemyFighters(
  state: DuelGameState,
  sourcePlayerId: PlayerId,
  targetOwnerId: PlayerId,
  damagePerTarget: number,
  sourceCard: CardData,
  sourceEffectiveCt: number
): number {
  if (damagePerTarget <= 0) return 0;
  const targetOwner = getPlayerState(state, targetOwnerId);
  const activeTargets = targetOwner.frontline.filter((f): f is FieldFighter => f !== null);
  if (activeTargets.length === 0) return 0;

  const azaradoFighter = activeTargets.find(
    (f) => !f.azaradoUsedThisRound && hasArchetype(state, f, 'Azarado')
  );
  if (azaradoFighter) {
    azaradoFighter.azaradoUsedThisRound = true;
    const totalConcentratedDmg = damagePerTarget * activeTargets.length;
    addLog(
      state,
      targetOwnerId,
      `🎯 Arquétipo [Azarado]: «${azaradoFighter.card.name}» concentrou todo o efeito em área de «${sourceCard.name}» (${activeTargets.length}x ${damagePerTarget} = ${totalConcentratedDmg} de dano) apenas em si!`,
      'reaction'
    );
    const killed = applyEffectDamageToFighter(
      state,
      sourcePlayerId,
      targetOwnerId,
      azaradoFighter.slotIndex,
      totalConcentratedDmg,
      sourceCard,
      sourceEffectiveCt,
      true
    );
    return killed ? 1 : 0;
  }

  let killedCount = 0;
  for (let slot = 0; slot < 6; slot++) {
    if (targetOwner.frontline[slot]) {
      const killed = applyEffectDamageToFighter(
        state,
        sourcePlayerId,
        targetOwnerId,
        slot,
        damagePerTarget,
        sourceCard,
        sourceEffectiveCt,
        true
      );
      if (killed) killedCount++;
    }
  }
  return killedCount;
}

export function equipSupportOrCamadaToBackrow(
  state: DuelGameState,
  ownerId: PlayerId,
  card: CardData,
  preferredSlot = -1
): boolean {
  const owner = getPlayerState(state, ownerId);

  // Regra das Camadas: "Como todas equipam o jogador, elas podem ser empilhadas no mesmo espaço!"
  if (isCamadaCard(card)) {
    if (
      preferredSlot >= 0 &&
      preferredSlot < 6 &&
      owner.backrow[preferredSlot] !== null &&
      isCamadaCard(owner.backrow[preferredSlot]!.card)
    ) {
      const targetSup = owner.backrow[preferredSlot]!;
      targetSup.stackedCards = targetSup.stackedCards || [];
      targetSup.stackedCards.push(card);
      addLog(
        state,
        ownerId,
        `✨ ${owner.name} empilhou «${card.name}» na Zona de Suporte ${preferredSlot + 1} (${countCamadasOnField(owner)} «Camada(s)» em seu lado do campo).`,
        'effect'
      );
      return true;
    }

    const existingCamadaSlot = owner.backrow.findIndex(
      (s) => s !== null && isCamadaCard(s.card)
    );
    if (
      existingCamadaSlot !== -1 &&
      (preferredSlot === -1 || !owner.backrow.some((s) => s === null))
    ) {
      const targetSup = owner.backrow[existingCamadaSlot]!;
      targetSup.stackedCards = targetSup.stackedCards || [];
      targetSup.stackedCards.push(card);
      addLog(
        state,
        ownerId,
        `✨ ${owner.name} empilhou «${card.name}» na Zona de Suporte ${existingCamadaSlot + 1} (${countCamadasOnField(owner)} «Camada(s)» em seu lado do campo).`,
        'effect'
      );
      return true;
    }
  }

  const slot =
    preferredSlot >= 0 &&
    preferredSlot < 6 &&
    owner.backrow[preferredSlot] === null
      ? preferredSlot
      : owner.backrow.findIndex((s) => s === null);

  if (slot === -1) return false;

  owner.backrow[slot] = {
    instanceId: nextUid('sup'),
    card,
    stackedCards: [],
    slotIndex: slot,
    owner: ownerId,
    usedOncePerRound: false
  };

  addLog(
    state,
    ownerId,
    `✨ ${owner.name} equipou/ativou «${card.name}» na Zona de Suporte ${slot + 1}${
      isCamadaCard(card) ? ` (${countCamadasOnField(owner)} «Camada(s)» em seu lado do campo)` : ''
    }.`,
    'effect'
  );
  return true;
}

export function getCamadaCandidatesForPlayer(p: PlayerDuelState): ChoiceCandidate[] {
  const candidates: ChoiceCandidate[] = [];
  p.deck.forEach((c, idx) => {
    if (isCamadaCard(c)) {
      candidates.push({
        id: `camada_deck_${idx}_${c.code}`,
        card: c,
        sourceZone: 'deck',
        sourceIndex: idx,
        subtitle: 'No seu Deck'
      });
    }
  });
  p.hand.forEach((c, idx) => {
    if (isCamadaCard(c)) {
      candidates.push({
        id: `camada_hand_${idx}_${c.code}`,
        card: c,
        sourceZone: 'hand',
        sourceIndex: idx,
        subtitle: 'Na sua Mão'
      });
    }
  });
  p.deadZone.forEach((c, idx) => {
    if (isCamadaCard(c)) {
      candidates.push({
        id: `camada_dead_${idx}_${c.code}`,
        card: c,
        sourceZone: 'deadZone',
        sourceIndex: idx,
        subtitle: 'Na Zona Morta'
      });
    }
  });
  p.erasedZone.forEach((c, idx) => {
    if (isCamadaCard(c)) {
      candidates.push({
        id: `camada_erased_${idx}_${c.code}`,
        card: c,
        sourceZone: 'erasedZone',
        sourceIndex: idx,
        subtitle: 'Na Zona Apagada'
      });
    }
  });
  return candidates;
}

export function pullAndEquipCamadaFromAnywhere(
  state: DuelGameState,
  ownerId: PlayerId
): CardData | null {
  const owner = getPlayerState(state, ownerId);
  const canPlaceCamada =
    owner.backrow.some((s) => s === null) ||
    owner.backrow.some((s) => s !== null && isCamadaCard(s.card));
  if (!canPlaceCamada) return null;

  const dIdx = owner.deck.findIndex((c) => isCamadaCard(c));
  if (dIdx !== -1) {
    const [camada] = owner.deck.splice(dIdx, 1);
    equipSupportOrCamadaToBackrow(state, ownerId, camada);
    return camada;
  }
  const zIdx = owner.deadZone.findIndex((c) => isCamadaCard(c));
  if (zIdx !== -1) {
    const [camada] = owner.deadZone.splice(zIdx, 1);
    equipSupportOrCamadaToBackrow(state, ownerId, camada);
    return camada;
  }
  const eIdx = owner.erasedZone.findIndex((c) => isCamadaCard(c));
  if (eIdx !== -1) {
    const [camada] = owner.erasedZone.splice(eIdx, 1);
    equipSupportOrCamadaToBackrow(state, ownerId, camada);
    return camada;
  }
  const hIdx = owner.hand.findIndex((c) => isCamadaCard(c));
  if (hIdx !== -1) {
    const [camada] = owner.hand.splice(hIdx, 1);
    equipSupportOrCamadaToBackrow(state, ownerId, camada);
    return camada;
  }
  return null;
}

export function checkOttoAscensionToAsmonious(state: DuelGameState, ownerId: PlayerId): boolean {
  const owner = getPlayerState(state, ownerId);
  if (owner.runes < 10) return false;
  const ottoSlot = owner.frontline.findIndex(
    (f) => f !== null && f.card.code === '2025/0001/00151'
  );
  if (ottoSlot === -1) return false;

  const ottoFighter = owner.frontline[ottoSlot]!;
  owner.frontline[ottoSlot] = null;
  for (const eq of ottoFighter.equipments) {
    owner.deadZone.push(eq.card);
  }
  owner.erasedZone.push(ottoFighter.card);

  let asmonious: CardData | null = null;
  const hIdx = owner.heroDeck.findIndex((c) => c.code === '2025/0001/00152');
  const dIdx = owner.deck.findIndex((c) => c.code === '2025/0001/00152');
  const zIdx = owner.deadZone.findIndex((c) => c.code === '2025/0001/00152');
  if (hIdx !== -1) asmonious = owner.heroDeck.splice(hIdx, 1)[0];
  else if (dIdx !== -1) asmonious = owner.deck.splice(dIdx, 1)[0];
  else if (zIdx !== -1) asmonious = owner.deadZone.splice(zIdx, 1)[0];

  if (asmonious) {
    addLog(
      state,
      ownerId,
      `👑 10+ Runas alcançadas! «Otto - Arauto da Corrupção» foi enviado para a Zona Apagada e invocou «Asmonious - O Corruptor»!`,
      'summon'
    );
    summonFighterToSlot(state, ownerId, asmonious, ottoSlot);
    return true;
  }
  return false;
}

export function summonFighterToSlot(
  state: DuelGameState,
  ownerId: PlayerId,
  card: CardData,
  slotIndex: number
): FieldFighter {
  const owner = getPlayerState(state, ownerId);
  const opp = getPlayerState(state, getOpponentId(ownerId));
  // O HORROR DO VÉU (2026/0001/00313) ou Floquinho buscada por Rebirth do Véu ("tratado como um Herói para efeito de outras cartas")
  const isTreatedAsHeroByRebirth =
    (owner.floquinhoTreatedAsHeroCodes || []).includes(card.code) ||
    (card.name.includes('Floquinho') && (owner.floquinhoTreatedAsHeroCodes || []).length > 0);
  const isHero =
    card.type === 'Herói' || card.code === '2026/0001/00313' || isTreatedAsHeroByRebirth;

  if (card.type === 'Herói') {
    const allowsMultipleHeroes =
      owner.frontline.some(
        (f) =>
          f !== null &&
          (f.card.code === '2025/0001/00183' || f.card.code === '2025/0001/00337')
      ) || card.code === '2025/0001/00183';
    if (!allowsMultipleHeroes) {
      const existingHeroSlot = owner.frontline.findIndex(
        (f) => f !== null && f.card.type === 'Herói'
      );
      if (existingHeroSlot !== -1 && existingHeroSlot !== slotIndex) {
        addLog(
          state,
          ownerId,
          `Um novo Herói entrou em campo: o Herói anterior foi enviado para a Zona Morta.`,
          'info'
        );
        sendFighterFromFieldToZone(state, ownerId, existingHeroSlot, false, false);
      }
    }
  }

  if (owner.frontline[slotIndex] !== null) {
    sendFighterFromFieldToZone(state, ownerId, slotIndex, false, false);
  }

  const baseArchs = parseBaseArchetypes(card);
  let baseAtk = card.attack || 0;
  let baseHp = card.defense || 1;
  let permAtkBonus = 0;
  let permHpBonus = 0;
  let jimLordTier5Plus = false;
  let jimLordTier6Mana = false;

  if (card.code === '2025/0001/00001') {
    const erasedJims = countJimsInErasedZone(owner);
    addLog(
      state,
      ownerId,
      `👑 «Jim - O Senhor do Macroverso» invocado (0 de Mana) com ${erasedJims} «Jim» na Zona Apagada!`,
      'summon'
    );

    if (erasedJims >= 5) {
      permAtkBonus += 15;
      permHpBonus += 15;
      jimLordTier5Plus = true;
      addLog(state, ownerId, `[5+ Jim]: +15 de Ataque e +15 de Vida!`, 'life_gain');
    }
    if (erasedJims >= 6) {
      jimLordTier6Mana = true;
      addLog(
        state,
        ownerId,
        `[6+ Jim]: No começo de cada turno, recebe +5 de Mana (passando de 12)!`,
        'effect'
      );
    }
    if (erasedJims >= 7) {
      for (const a of ['Conceito', 'Ordem', 'Caos', 'Lúmen', 'Darkus']) {
        if (!baseArchs.includes(a)) baseArchs.push(a);
      }
      addLog(
        state,
        ownerId,
        `[7+ Jim]: Recebeu os arquétipos Conceito, Ordem, Caos, Lúmen e Darkus!`,
        'effect'
      );
    }
    if (erasedJims >= 8) {
      permAtkBonus += 15;
      permHpBonus += 15;
      addLog(state, ownerId, `[8+ Jim]: +15 adicionais em todos os status (+30/+30 total)!`, 'life_gain');
    }
    if (erasedJims >= 11) {
      const dmg = erasedJims * 10;
      addLog(
        state,
        ownerId,
        `[11+ Jim]: Poder Supremo! Causa ${dmg} de dano direto na vida do oponente!`,
        'attack'
      );
      dealDamageToPlayer(
        state,
        getOpponentId(ownerId),
        ownerId,
        dmg,
        `Efeito de 11+ Jim de «Jim - O Senhor do Macroverso»`
      );
    }
  }

  const fighter: FieldFighter = {
    instanceId: nextUid('fighter'),
    card,
    slotIndex,
    owner: ownerId,
    baseAtk,
    baseHp,
    currentHp: baseHp + permHpBonus,
    maxHp: baseHp + permHpBonus,
    permAtkBonus,
    permHpBonus,
    tempAtkBonus: 0,
    archetypes: baseArchs,
    equipments: [],
    summonedRound: state.round,
    summonedTurnGlobal: state.globalTurn,
    hasAttackedThisTurn: false,
    attacksThisTurnCount: 0,
    usedOncePerRoundAbility: false,
    macroversalUsedThisRound: false,
    azaradoUsedThisRound: false,
    isHero,
    jimLordTier5Plus,
    jimLordTier6Mana,
    jimLordTier9GemUsedThisRound: false
  };

  owner.frontline[slotIndex] = fighter;

  if (state.activePlayer === ownerId && owner.hasAttackedInCurrentTurn) {
    owner.lockedFromAttackingThisTurn = true;
    fighter.hasAttackedThisTurn = true;
    addLog(
      state,
      ownerId,
      `Como ${owner.name} invocou após já ter atacado neste turno, não poderá declarar novos ataques neste turno.`,
      'info'
    );
  }

  addLog(
    state,
    ownerId,
    `✨ ${owner.name} invocou «${card.name}» na Coluna ${slotIndex + 1} (ATK ${getFighterEffectiveAtk(state, fighter)} / Vida ${fighter.currentHp})${
      isTreatedAsHeroByRebirth ? ' [Tratada como Herói por Rebirth do Véu]' : ''
    }.`,
    'summon'
  );

  if (hasArchetype(state, fighter, 'Cósmico')) {
    owner.runes += 1;
    addLog(
      state,
      ownerId,
      `Arquétipo [Cósmico]: «${card.name}» gerou 1 Runa (Total: ${owner.runes}).`,
      'effect'
    );
    checkOttoAscensionToAsmonious(state, ownerId);
  }

  if (isHero) {
    for (const enemyF of opp.frontline) {
      if (enemyF && hasArchetype(state, enemyF, 'Escolhido')) {
        enemyF.permAtkBonus += 5;
        enemyF.permHpBonus += 5;
        enemyF.currentHp += 5;
        enemyF.maxHp += 5;
        addLog(
          state,
          opp.id,
          `Arquétipo [Escolhido]: «${enemyF.card.name}» recebeu +5/+5 permanentemente pela invocação de Herói inimigo!`,
          'life_gain'
        );
      }
    }
  }

  // =========================================================================
  // EFEITOS OFICIAIS DE ENTRADA DOS HERÓIS E COMBATENTES (DATA.TS & INVASÃO DO CAOS)
  // =========================================================================
  if (card.code === '2026/0001/00301') {
    // Mahina - O Arauto do Véu
    addLog(
      state,
      ownerId,
      `👑 «Mahina - O Arauto do Véu» em campo! Reduz em 4 o CT dos combatentes do Véu na mão e não pode deixar o campo por resultado de combate.`,
      'effect'
    );
  } else if (card.code === '2025/0001/00031') {
    // Jenos Senhor do Macroverso:
    // "Após 1 rodada de sua invocação, retorna todas as suas cartas de suas Zonas para seu Deck e recupere sua vida de jogador completamente. Após 3 rodadas com esse Herói em campo, causa 99999.... de dano a vida do jogador inimigo."
    addLog(
      state,
      ownerId,
      `👑 «Jenos Senhor do Macroverso» invocado! Após 1 rodada em campo, retornará todas as cartas das Zonas ao Deck e restaurará sua Vida completamente; após 3 rodadas em campo, causará 99999 de dano ao oponente!`,
      'summon'
    );
  } else if (card.code === '2025/0001/00035') {
    // Jenos Caído: "Ao ser invocado, recupere 20 de vida de jogador."
    owner.hp = Math.max(owner.hp, 20);
    addLog(
      state,
      ownerId,
      `💚 «Jenos Caído»: ${owner.name} recuperou sua vida para ${owner.hp} PV!`,
      'life_gain'
    );
  } else if (card.code === '2025/0001/00041') {
    // Fallen Destinada: "Ao invocar esse combatente, caso tenha, invoque um Herói das suas Zonas para o campo."
    const freeHeroSlot = owner.frontline.findIndex((s) => s === null);
    if (freeHeroSlot !== -1) {
      let revivedHero: CardData | null = null;
      const dzIdx = owner.deadZone.findIndex((c) => c.type === 'Herói');
      const ezIdx = owner.erasedZone.findIndex((c) => c.type === 'Herói');
      if (dzIdx !== -1) revivedHero = owner.deadZone.splice(dzIdx, 1)[0];
      else if (ezIdx !== -1) revivedHero = owner.erasedZone.splice(ezIdx, 1)[0];
      if (revivedHero) {
        addLog(
          state,
          ownerId,
          `✨ «Fallen Destinada»: Invocou o Herói «${revivedHero.name}» das Zonas para o campo!`,
          'summon'
        );
        summonFighterToSlot(state, ownerId, revivedHero, freeHeroSlot);
      }
    }
  } else if (card.code === '2025/0001/00061') {
    // Spear Vellret: "Ganha +5 de Vida para cada carta com «Errante» no nome em seu lado do campo."
    const erranteCount =
      owner.frontline.filter((f) => f !== null && f.card.name.includes('Errante')).length +
      owner.backrow.filter((s) => s !== null && s.card.name.includes('Errante')).length;
    if (erranteCount > 0) {
      const hpBonus = erranteCount * 5;
      fighter.permHpBonus += hpBonus;
      fighter.currentHp += hpBonus;
      fighter.maxHp += hpBonus;
      addLog(
        state,
        ownerId,
        `💚 «Spear Vellret»: Recebeu +${hpBonus} de Vida por ${erranteCount} carta(s) «Errante» em campo!`,
        'life_gain'
      );
    }
  } else if (card.code === '2025/0001/00063') {
    // Vellret - Condenado do Jim: "Ganha o Arquétipo [Macroversal] caso um combatente com «Kiara» no nome esteja em sua Zona Morta ou Apagada."
    const hasKiaraInZones = [...owner.deadZone, ...owner.erasedZone].some((c) =>
      c.name.includes('Kiara')
    );
    if (hasKiaraInZones && !fighter.archetypes.includes('Macroversal')) {
      fighter.archetypes.push('Macroversal');
      addLog(
        state,
        ownerId,
        `✨ «Vellret - Condenado do Jim»: Recebeu o Arquétipo [Macroversal] por ter «Kiara» nas Zonas!`,
        'effect'
      );
    }
  } else if (card.code === '2025/0001/00093') {
    // Estrategista Mahina: "Se «Grande Sábio», «Cristal do Equilíbrio», «Energia Lúmen», «Energia Darkus», «Viorie» e «Karn» estiverem em suas Zonas, cause 25 de dano na vida do jogador inimigo."
    const zonesPool = [...owner.deadZone, ...owner.erasedZone];
    const reqNames = [
      'Grande Sábio',
      'Cristal do Equilíbrio',
      'Energia Lúmen',
      'Energia Darkus',
      'Viorie',
      'Karn'
    ];
    if (reqNames.every((req) => zonesPool.some((c) => c.name.includes(req)))) {
      dealDamageToPlayer(
        state,
        getOpponentId(ownerId),
        ownerId,
        25,
        'Combo Supremo de «Estrategista Mahina»'
      );
    }
  } else if (card.code === '2025/0001/00151') {
    // Otto - Arauto da Corrupção: "Sempre que é colocado em campo, ganha +1 Runa. Ao alcançar 10 Runas, envie «Otto» para a Zona Apagada e invoque «Asmonious - O Corruptor»."
    owner.runes += 1;
    addLog(
      state,
      ownerId,
      `💀 «Otto - Arauto da Corrupção»: Gerou +1 Runa ao entrar em campo (Total: ${owner.runes}/10 Runas para Asmonious)!`,
      'effect'
    );
    if (owner.runes >= 10) {
      owner.frontline[slotIndex] = null;
      owner.erasedZone.push(card);
      let asmonious: CardData | null = null;
      const hIdx = owner.heroDeck.findIndex((c) => c.code === '2025/0001/00152');
      const dIdx = owner.deck.findIndex((c) => c.code === '2025/0001/00152');
      const zIdx = owner.deadZone.findIndex((c) => c.code === '2025/0001/00152');
      if (hIdx !== -1) asmonious = owner.heroDeck.splice(hIdx, 1)[0];
      else if (dIdx !== -1) asmonious = owner.deck.splice(dIdx, 1)[0];
      else if (zIdx !== -1) asmonious = owner.deadZone.splice(zIdx, 1)[0];
      if (asmonious) {
        addLog(
          state,
          ownerId,
          `👑 10+ Runas alcançadas! «Otto - Arauto da Corrupção» foi enviado para a Zona Apagada e invocou «Asmonious - O Corruptor»!`,
          'summon'
        );
        return summonFighterToSlot(state, ownerId, asmonious, slotIndex);
      }
    }
  } else if (card.code === '2025/0001/00152') {
    // Asmonious - O Corruptor: "Sempre que é colocado em campo, ganha +1 Runa."
    owner.runes += 1;
    addLog(
      state,
      ownerId,
      `👑 «Asmonious - O Corruptor»: Gerou +1 Runa ao entrar em campo (Total: ${owner.runes} Runas → +${owner.runes * 3} ATK)!`,
      'effect'
    );
  } else if (card.code === '2025/0001/00181') {
    // Salazar - Guia dos Escolhidos: "Ao ser invocado, o jogador ganha +3 de mana."
    owner.mana += 3;
    addLog(
      state,
      ownerId,
      `⚡ «Salazar - Guia dos Escolhidos»: ${owner.name} recebeu +3 de Mana (Mana: ${owner.mana})!`,
      'effect'
    );
  } else if (card.code === '2025/0001/00182') {
    // Salazar - O Poderoso Líder: "Ao ser invocado, o jogador ganha +3 de vida. Seus combatentes com «Blair» ou «Hyummeng» no nome ganham +5 de Vida."
    owner.hp += 3;
    for (const ally of owner.frontline) {
      if (ally && (ally.card.name.includes('Blair') || ally.card.name.includes('Hyummeng'))) {
        ally.permHpBonus += 5;
        ally.currentHp += 5;
        ally.maxHp += 5;
      }
    }
    addLog(
      state,
      ownerId,
      `💚 «Salazar - O Poderoso Líder»: ${owner.name} recebeu +3 PV (Vida: ${owner.hp} PV) e concedeu +5 de Vida aos aliados «Blair»/«Hyummeng»!`,
      'life_gain'
    );
  } else if (card.code === '2025/0001/00183') {
    // Salazar - Grande Mestre da Dualidade: "Ganha +3 de Ataque e +3 de Vida para cada Runa em seu campo."
    const hpBonus = owner.runes * 3;
    if (hpBonus > 0) {
      fighter.permHpBonus += hpBonus;
      fighter.currentHp += hpBonus;
      fighter.maxHp += hpBonus;
    }
  } else if (card.code === '2025/0001/00184') {
    // Salazar - O Falho: "Para cada carta no seu Deck, este Herói ganha +1 de CT, +1 de Ataque e +1 de Vida."
    const deckBonus = owner.deck.length;
    fighter.permHpBonus += deckBonus;
    fighter.currentHp += deckBonus;
    fighter.maxHp += deckBonus;
    addLog(
      state,
      ownerId,
      `👑 «Salazar - O Falho»: Recebeu +${deckBonus} de Ataque e +${deckBonus} de Vida pelas ${deckBonus} cartas no Deck!`,
      'effect'
    );
  } else if (card.code === '2025/0001/00211') {
    // Selena - Deusa da Lua
    owner.alliedFightersLostWhileSelenaLuaActive = 0;
    addLog(
      state,
      ownerId,
      `🌙 «Selena - Deusa da Lua» entrou em campo! A cada turno aumenta +1/+1 de todos os seus combatentes, e após 3 aliados irem às Zonas invoca «Selena - Conceito da Criação»!`,
      'effect'
    );
  } else if (card.code === '2025/0001/00212') {
    // Selena - Conceito da Criação: "Suas cartas de CT 12 passam a ter CT 1."
    addLog(
      state,
      ownerId,
      `🌙 «Selena - Conceito da Criação»: Todas as cartas de CT 12 de ${owner.name} agora custam apenas 1 de CT!`,
      'effect'
    );
  } else if (card.code === '2025/0001/00213') {
    // Selena - Mãe dos Guerreiros: "Ganha +5 de Ataque e +5 de Vida para cada carta de CT 12 nas suas Zonas."
    const ct12InZones =
      owner.deadZone.filter((c) => c.ct === 12).length +
      owner.erasedZone.filter((c) => c.ct === 12).length;
    const hpBonus = ct12InZones * 5;
    fighter.permHpBonus += hpBonus;
    fighter.currentHp += hpBonus;
    fighter.maxHp += hpBonus;
    addLog(
      state,
      ownerId,
      `🌙 «Selena - Mãe dos Guerreiros»: Suas cartas de CT 12 passam a ter CT 1 e recebeu +${hpBonus}/+${hpBonus} pelas ${ct12InZones} cartas CT 12 nas Zonas!`,
      'effect'
    );
  } else if (card.code === '2025/0001/00214') {
    // Selena - Macroverso Inverso: "Ao ser invocada, envie todos os seus outros combatentes para a Zona Morta. Ganha +5 de Ataque para cada carta na Zona Morta e +5 de Vida para cada carta na Zona Apagada."
    for (let s = 0; s < 6; s++) {
      if (s !== slotIndex && owner.frontline[s] !== null) {
        sendFighterFromFieldToZone(state, ownerId, s, false, false);
      }
    }
    const hpBonus = owner.erasedZone.length * 5;
    fighter.permHpBonus += hpBonus;
    fighter.currentHp += hpBonus;
    fighter.maxHp += hpBonus;
    addLog(
      state,
      ownerId,
      `🌙 «Selena - Macroverso Inverso»: Recebeu +${owner.deadZone.length * 5} ATK e +${hpBonus} Vida pelas cartas nas Zonas!`,
      'effect'
    );
  }

  // Jim - Necromante (2025/0001/0011):
  // "Ao ser invocado, envie todos os «Jim» da sua Zona Morta para sua Zona Apagada ou envie 1 «Jim» da sua mão para sua Zona Apagada."
  if (card.code === '2025/0001/0011') {
    const deadJims = owner.deadZone.filter((c) => isJimCard(c));
    const handJims = owner.hand
      .map((c, idx) => ({ c, idx }))
      .filter((item) => isJimCard(item.c) && (item.c.type === 'Combatente' || item.c.type === 'Herói'));

    if (ownerId === 'player' && (deadJims.length > 0 || handJims.length > 0)) {
      const candidates: ChoiceCandidate[] = handJims.map((item) => ({
        id: `hand_${item.idx}_${item.c.code}`,
        card: item.c,
        sourceZone: 'hand',
        sourceIndex: item.idx,
        subtitle: 'Na sua Mão'
      }));
      state.pendingChoiceQueue.push({
        title: 'Efeito de «Jim - Necromante»',
        description:
          'Envie todos os «Jim» da sua Zona Morta para a Zona Apagada OU selecione 1 «Jim» da sua mão para enviar à Zona Apagada:',
        candidates,
        minSelect: deadJims.length > 0 ? 0 : 1,
        maxSelect: 1,
        allowConfirmAllFromDeadZoneOption: deadJims.length > 0,
        deadZoneJimCount: deadJims.length,
        effectKind: 'NECROMANTE'
      });
    } else if (ownerId === 'bot') {
      if (deadJims.length > 0) {
        owner.deadZone = owner.deadZone.filter((c) => !isJimCard(c));
        owner.erasedZone.push(...deadJims);
        addLog(
          state,
          ownerId,
          `Efeito de «Jim - Necromante»: Moveu ${deadJims.length} «Jim» da Zona Morta para a Zona Apagada!`,
          'effect'
        );
      } else if (handJims.length > 0) {
        const [discarded] = owner.hand.splice(handJims[0].idx, 1);
        owner.erasedZone.push(discarded);
        addLog(
          state,
          ownerId,
          `Efeito de «Jim - Necromante»: Enviou «${discarded.name}» da mão para a Zona Apagada!`,
          'effect'
        );
      }
    }
  }

  syncCrystalCaoticaStatInversion(state);
  return fighter;
}

/**
 * Invoca «Floquinho Caótica do Véu» (2026/0001/00314) gastando Vida de Jogador em vez de Mana.
 * "Ao ser invocada, você não gasta mana, em vez disso, gaste qualquer quantidade de Vida de Jogador,
 * e então, ela ganha 3 de CT, 3 de Ataque e 3 de Vida para cada 1 de Vida de Jogador gasto."
 */
export function summonFloquinhoCaoticaWithHp(
  state: DuelGameState,
  ownerId: PlayerId,
  card: CardData,
  slotIndex: number,
  hpToSpend: number
): FieldFighter {
  const owner = getPlayerState(state, ownerId);
  const actualHpSpent = Math.max(1, Math.min(hpToSpend, Math.max(1, owner.hp - 1)));
  owner.hp = Math.max(1, owner.hp - actualHpSpent);
  const statBonus = actualHpSpent * 3;
  const scaledCard: CardData = {
    ...card,
    ct: statBonus,
    attack: statBonus,
    defense: statBonus
  };
  addLog(
    state,
    ownerId,
    `💔 «Floquinho Caótica do Véu»: ${owner.name} gastou ${actualHpSpent} de Vida de Jogador (Vida restante: ${owner.hp} PV) → Status: CT ${statBonus} / ATK ${statBonus} / Vida ${statBonus}!`,
    'life_loss'
  );
  return summonFighterToSlot(state, ownerId, scaledCard, slotIndex);
}

/**
 * «Aqua Caótica» (2026/0001/00310):
 * "Seus outros combatentes podem atacar esta carta, fazendo com que o combatente a frente dela
 * receba 2x o dano que ela receber (ignorando arquétipos)."
 */
export function executeFriendlyAttackOnAquaCaotica(
  state: DuelGameState,
  ownerId: PlayerId,
  attackerSlot: number,
  aquaSlot: number
) {
  const owner = getPlayerState(state, ownerId);
  const oppId = getOpponentId(ownerId);
  const opp = getPlayerState(state, oppId);

  const attacker = owner.frontline[attackerSlot];
  const aqua = owner.frontline[aquaSlot];
  if (!attacker || !aqua || attackerSlot === aquaSlot || aqua.card.code !== '2026/0001/00310') {
    return;
  }

  attacker.attacksThisTurnCount = (attacker.attacksThisTurnCount || 0) + 1;
  if (attacker.attacksThisTurnCount >= getMaxAttacksPerTurn(state, attacker)) {
    attacker.hasAttackedThisTurn = true;
  }
  owner.hasAttackedInCurrentTurn = true;

  const atkVal = getFighterEffectiveAtk(state, attacker, true);
  const aquaLumen = countArchetypeStacks(state, aqua, 'Lúmen');
  const dmgReceivedByAqua = Math.max(0, atkVal - aquaLumen * 3);

  aqua.currentHp -= dmgReceivedByAqua;
  addLog(
    state,
    ownerId,
    `🌊 «Aqua Caótica»: «${attacker.card.name}» atacou a aliada «Aqua Caótica» causando ${dmgReceivedByAqua} de dano (Vida de Aqua: ${Math.max(0, aqua.currentHp)})!`,
    'attack'
  );

  const enemyFront = opp.frontline[aquaSlot];
  if (enemyFront && dmgReceivedByAqua > 0) {
    const reflectedDmg = dmgReceivedByAqua * 2;
    enemyFront.currentHp -= reflectedDmg;
    addLog(
      state,
      ownerId,
      `💥 Efeito de «Aqua Caótica»: O combatente inimigo à frente («${enemyFront.card.name}» na Coluna ${aquaSlot + 1}) recebeu 2x o dano (${reflectedDmg}) ignorando arquétipos!`,
      'attack'
    );
    if (enemyFront.currentHp <= 0) {
      sendFighterFromFieldToZone(state, oppId, aquaSlot, false, true);
    }
  }

  if (aqua.currentHp <= 0) {
    sendFighterFromFieldToZone(state, ownerId, aquaSlot, false, true);
  }

  checkWinCondition(state);
}

export function executeCombatResolution(
  state: DuelGameState,
  attackerOwnerId: PlayerId,
  attackerSlot: number,
  targetSlot: number
) {
  const atkOwner = getPlayerState(state, attackerOwnerId);
  const defOwnerId = getOpponentId(attackerOwnerId);
  const defOwner = getPlayerState(state, defOwnerId);

  const attacker = atkOwner.frontline[attackerSlot];
  if (!attacker) return;

  attacker.attacksThisTurnCount = (attacker.attacksThisTurnCount || 0) + 1;
  if (attacker.attacksThisTurnCount >= getMaxAttacksPerTurn(state, attacker)) {
    attacker.hasAttackedThisTurn = true;
  }
  atkOwner.hasAttackedInCurrentTurn = true;

  const defenderForSoladorCheck = targetSlot >= 0 ? defOwner.frontline[targetSlot] : null;
  const attackerIsSolador = hasArchetype(
    state,
    attacker,
    'Solador',
    false,
    targetSlot >= 0 ? targetSlot : undefined
  );
  const defenderIsSolador = defenderForSoladorCheck
    ? hasArchetype(state, defenderForSoladorCheck, 'Solador', attackerIsSolador, attackerSlot)
    : false;
  const anySolador = attackerIsSolador || defenderIsSolador;

  const attackerAtk = getFighterEffectiveAtk(state, attacker, true, defenderIsSolador);
  const hasGema3 =
    !defenderIsSolador && attacker.equipments.some((e) => e.card.code === '2025/0001/00014');
  const isAttackerDivindade = hasArchetype(
    state,
    attacker,
    'Divindade',
    defenderIsSolador,
    targetSlot >= 0 ? targetSlot : undefined
  );
  const playerDmgMultiplier = hasGema3 ? (isAttackerDivindade ? 4 : 2) : 1;

  if (targetSlot === -1) {
    const enemyFightersCount = defOwner.frontline.filter((f) => f !== null).length;
    if (enemyFightersCount > 0) {
      addLog(
        state,
        attackerOwnerId,
        `Ataque direto cancelado: o oponente possui combatentes em campo.`,
        'info'
      );
      return;
    }
    const finalDirectDmg = attackerAtk * playerDmgMultiplier;
    addLog(
      state,
      attackerOwnerId,
      `⚔️ «${attacker.card.name}» realizou um Ataque Direto causando ${finalDirectDmg} de dano!`,
      'attack'
    );
    const dealt = dealDamageToPlayer(
      state,
      defOwnerId,
      attackerOwnerId,
      finalDirectDmg,
      `Ataque Direto de «${attacker.card.name}»`
    );
    // Floquinho Caótica do Véu (2026/0001/00314): "Sempre que causar dano na Vida do Jogador inimigo, aumente o custo das cartas do oponente em 2."
    if (dealt > 0 && attacker.card.code === '2026/0001/00314') {
      defOwner.permCtPenalty = (defOwner.permCtPenalty || 0) + 2;
      addLog(
        state,
        attackerOwnerId,
        `❄️ «Floquinho Caótica do Véu»: Aumentou o custo (CT) de todas as cartas de ${defOwner.name} em +2 (Penalidade total: +${defOwner.permCtPenalty} CT)!`,
        'effect'
      );
    }
    return;
  }

  const defender = defOwner.frontline[targetSlot];
  if (!defender) {
    addLog(
      state,
      attackerOwnerId,
      `O alvo do ataque na Coluna ${targetSlot + 1} não está mais em campo.`,
      'info'
    );
    return;
  }

  if (anySolador) {
    addLog(
      state,
      'system',
      `Arquétipo [Solador] ativo: Ignora todas as outras cartas inimigas fora a carta alvo (arquétipos e efeitos da própria carta alvo permanecem ativos)!`,
      'attack'
    );
  }

  // Jenos Senhor da Guerra (2025/0001/00034): "Sempre que é alvo de um ataque, ganha +3 de mana."
  // É efeito da própria carta alvo, portanto NÃO é ignorado por [Solador]!
  if (defender.card.code === '2025/0001/00034') {
    defOwner.mana += 3;
    addLog(
      state,
      defOwnerId,
      `⚡ «Jenos Senhor da Guerra»: ${defOwner.name} recebeu +3 de Mana ao ser alvo de um ataque!`,
      'effect'
    );
  }

  const defenderAtk = getFighterEffectiveAtk(state, defender, true, attackerIsSolador);

  let dmgToDefender = attackerAtk;
  // Jenos Senhor da Guerra (2025/0001/00034): "Causa o dobro de dano contra combatentes que possuam ao menos 1 equipamento."
  // Se o atacante tem [Solador], ele ignora os equipamentos do alvo; caso contrário, verifica normalmente.
  if (!attackerIsSolador && attacker.card.code === '2025/0001/00034' && defender.equipments.length > 0) {
    dmgToDefender *= 2;
  }
  // Vellret - Condenado do Jim (2025/0001/00063): "Ao atacar combatentes com «Dragão» no nome, ganha +20 de Ataque."
  if (attacker.card.code === '2025/0001/00063' && defender.card.name.includes('Dragão')) {
    dmgToDefender += 20;
  }

  if (isProtectedByJimAnciao(state, defender, attackerIsSolador)) {
    dmgToDefender = 0;
    addLog(
      state,
      defOwnerId,
      `Efeito de «Jim - Ancião»: Protegeu «${defender.card.name}» de todo o dano de combate!`,
      'effect'
    );
  } else {
    // [Solador] NÃO ignora arquétipos inimigos da carta alvo (apenas ignora equipamentos externos caso attackerIsSolador seja true)
    const defLumen = countArchetypeStacks(
      state,
      defender,
      'Lúmen',
      attackerIsSolador,
      attackerSlot
    );
    if (defLumen > 0) {
      dmgToDefender = Math.max(0, dmgToDefender - defLumen * 3);
      addLog(
        state,
        defOwnerId,
        `Arquétipo [Lúmen] de «${defender.card.name}» reduziu o dano de combate em ${defLumen * 3}.`,
        'effect'
      );
    }
  }

  let dmgToAttacker = defenderAtk;
  if (hasArchetype(state, attacker, 'Furtivo', defenderIsSolador, targetSlot)) {
    dmgToAttacker = 0;
    addLog(
      state,
      attackerOwnerId,
      `Arquétipo [Furtivo]: «${attacker.card.name}» não sofre dano de combate ao atacar!`,
      'effect'
    );
  } else if (isProtectedByJimAnciao(state, attacker, defenderIsSolador)) {
    dmgToAttacker = 0;
    addLog(
      state,
      attackerOwnerId,
      `Efeito de «Jim - Ancião»: Protegeu «${attacker.card.name}» do dano de retorno!`,
      'effect'
    );
  } else {
    const atkLumen = countArchetypeStacks(
      state,
      attacker,
      'Lúmen',
      defenderIsSolador,
      targetSlot
    );
    if (atkLumen > 0) {
      dmgToAttacker = Math.max(0, dmgToAttacker - atkLumen * 3);
      addLog(
        state,
        attackerOwnerId,
        `Arquétipo [Lúmen] de «${attacker.card.name}» reduziu o dano recebido em ${atkLumen * 3}.`,
        'effect'
      );
    }
  }

  const defenderHpBefore = defender.currentHp;
  defender.currentHp -= dmgToDefender;
  attacker.currentHp -= dmgToAttacker;

  addLog(
    state,
    attackerOwnerId,
    `⚔️ Combate: «${attacker.card.name}» (ATK ${attackerAtk}) vs «${defender.card.name}» (ATK ${defenderAtk}) → Dano causado: ${dmgToDefender} | Dano sofrido: ${dmgToAttacker}.`,
    'attack'
  );

  // Regra Oficial de [Caos] e [Ordem]:
  // "Tanto o Arquétipo Ordem quanto o Caos só funcionam quando você está declarando ataques no seu turno e nunca recebendo ataques!"
  const excessDamage = dmgToDefender - defenderHpBefore;
  if (excessDamage > 0 && state.activePlayer === attackerOwnerId) {
    if (hasArchetype(state, attacker, 'Caos', defenderIsSolador, targetSlot)) {
      const caosDmg = excessDamage * playerDmgMultiplier;
      addLog(
        state,
        attackerOwnerId,
        `Arquétipo [Caos]: ${caosDmg} de dano excedente perfurou para a vida de ${defOwner.name}!`,
        'life_loss'
      );
      const dealtCaos = dealDamageToPlayer(
        state,
        defOwnerId,
        attackerOwnerId,
        caosDmg,
        `Dano Excedente [Caos] de «${attacker.card.name}»`
      );
      if (dealtCaos > 0 && attacker.card.code === '2026/0001/00314') {
        defOwner.permCtPenalty = (defOwner.permCtPenalty || 0) + 2;
        addLog(
          state,
          attackerOwnerId,
          `❄️ «Floquinho Caótica do Véu»: Aumentou o custo (CT) de todas as cartas de ${defOwner.name} em +2 (Penalidade total: +${defOwner.permCtPenalty} CT)!`,
          'effect'
        );
      }
    }
    if (hasArchetype(state, attacker, 'Ordem', defenderIsSolador, targetSlot)) {
      atkOwner.hp += excessDamage;
      addLog(
        state,
        attackerOwnerId,
        `💚 Arquétipo [Ordem]: ${atkOwner.name} recuperou +${excessDamage} PV pelo dano excedente (Vida: ${atkOwner.hp} PV)!`,
        'life_gain'
      );
    }
  }

  // Mahina - O Arauto do Véu (2026/0001/00301):
  // "Não pode deixar o campo por resultado de combate, em vez disso, recebe um Arquétipo."
  // O HORROR DO VÉU (2026/0001/00313): "Não pode ser eliminada em combate."
  const triggerMahinaVeuCombatSurvival = (mahinaFighter: FieldFighter, mahinaOwnerId: PlayerId) => {
    mahinaFighter.currentHp = 1;
    if (mahinaFighter.card.code === '2026/0001/00313') {
      addLog(
        state,
        mahinaOwnerId,
        `👁️ «O Horror do Véu» não pode ser eliminado em combate!`,
        'effect'
      );
      return;
    }

    if (mahinaOwnerId === 'player') {
      const archCandidates: ChoiceCandidate[] = ALL_OFFICIAL_ARCHETYPES.map((arch, idx) => ({
        id: `mahina_arch_${idx}_${arch}`,
        card: {
          ...mahinaFighter.card,
          name: `Arquétipo [${arch}]`,
          archetype: arch,
          description: `Concede o Arquétipo [${arch}] permanentemente a «Mahina - O Arauto do Véu».`
        },
        sourceZone: 'field',
        sourceIndex: mahinaFighter.slotIndex,
        subtitle: mahinaFighter.archetypes.includes(arch) ? 'Já possui (acumula se aplicável)' : 'Novo Arquétipo'
      }));
      state.pendingChoiceQueue.push({
        title: '«Mahina - O Arauto do Véu» — Escolha o Arquétipo Recebido',
        description:
          '«Mahina - O Arauto do Véu» não pode deixar o campo por resultado de combate! Escolha qual Arquétipo ele recebe:',
        candidates: archCandidates,
        minSelect: 1,
        maxSelect: 1,
        targetSlotForChosenCard: mahinaFighter.slotIndex,
        effectKind: 'MAHINA_VEU_COMBAT_ARCHETYPE'
      });
      addLog(
        state,
        'player',
        `✨ «Mahina - O Arauto do Véu» sobreviveu ao combate com 1 de Vida! Escolha qual Arquétipo ele receberá.`,
        'effect'
      );
    } else {
      const bonusPool = ['Solador', 'Caos', 'Ordem', 'Lúmen', 'Darkus', 'Furtivo', 'Conceito', 'Divindade'];
      const nextArch = bonusPool.find((a) => !mahinaFighter.archetypes.includes(a)) || 'Lúmen';
      mahinaFighter.archetypes.push(nextArch);
      addLog(
        state,
        mahinaOwnerId,
        `✨ «Mahina - O Arauto do Véu» não pode deixar o campo por resultado de combate! Permaneceu com 1 de Vida e recebeu o Arquétipo [${nextArch}]!`,
        'effect'
      );
    }
  };

  if (defender.currentHp <= 0) {
    if (defender.card.code === '2026/0001/00301' || defender.card.code === '2026/0001/00313') {
      triggerMahinaVeuCombatSurvival(defender, defOwnerId);
    }
  }

  if (attacker.currentHp <= 0) {
    if (attacker.card.code === '2026/0001/00301' || attacker.card.code === '2026/0001/00313') {
      triggerMahinaVeuCombatSurvival(attacker, attackerOwnerId);
    }
  }

  const defenderDied = defender.currentHp <= 0;

  if (defenderDied) {
    // [Solador] NÃO ignora arquétipos inimigos da carta alvo (como [Insano] nativo do alvo)!
    const defHadInsano =
      !hasArchetype(state, attacker, 'Véu', defenderIsSolador, targetSlot) &&
      hasArchetype(state, defender, 'Insano', attackerIsSolador, attackerSlot);
    const isFeiticeira = defender.card.code === '2025/0001/00009';

    sendFighterFromFieldToZone(state, defOwnerId, targetSlot, false, true);

    if (attacker.card.code === '2025/0001/00034' && atkOwner.frontline[attackerSlot]) {
      attacker.permAtkBonus += 3;
      attacker.permHpBonus += 3;
      attacker.currentHp += 3;
      attacker.maxHp += 3;
      addLog(
        state,
        attackerOwnerId,
        `⚔️ «Jenos Senhor da Guerra»: Recebeu +3/+3 ao eliminar «${defender.card.name}»!`,
        'life_gain'
      );
    }

    if (attacker.card.code === '2025/0001/00122' && defender.card.ct > 0) {
      dealDamageToPlayer(
        state,
        defOwnerId,
        attackerOwnerId,
        defender.card.ct,
        `«Donnie - Grande General» (CT ${defender.card.ct} de «${defender.card.name}»)`
      );
    }

    if (defHadInsano && atkOwner.frontline[attackerSlot]) {
      attacker.currentHp -= 5;
      addLog(
        state,
        defOwnerId,
        `💔 Arquétipo [Insano]: Ao ser eliminado em combate, «${defender.card.name}» causou 5 de dano direto na vida de «${attacker.card.name}»!`,
        'life_loss'
      );
    }

    if (isFeiticeira) {
      const livingEnemies = atkOwner.frontline.filter(
        (f): f is FieldFighter => f !== null && f.currentHp > 0
      );
      if (livingEnemies.length > 0) {
        livingEnemies.sort((a, b) => a.currentHp - b.currentHp);
        const lowestEnemy = livingEnemies[0];
        addLog(
          state,
          defOwnerId,
          `Efeito de «Jim - Feiticeira»: Ao morrer em combate, dispara 8 de dano contra «${lowestEnemy.card.name}»!`,
          'life_loss'
        );
        applyEffectDamageToFighter(
          state,
          defOwnerId,
          attackerOwnerId,
          lowestEnemy.slotIndex,
          8,
          defender.card,
          defender.card.ct
        );
      }
    }

    if (attacker.card.code === '2025/0001/00002') {
      const otherEnemies = defOwner.frontline.filter((f): f is FieldFighter => f !== null);
      if (otherEnemies.length > 0) {
        if (attackerOwnerId === 'player') {
          state.pendingGuerreiroSplashDamage = true;
          addLog(
            state,
            'player',
            `Efeito de «Jim - Guerreiro»: Clique em um combatente no campo para causar 5 de dano!`,
            'effect'
          );
        } else {
          const splashTarget = otherEnemies[0];
          addLog(
            state,
            attackerOwnerId,
            `Efeito de «Jim - Guerreiro»: Ao abater o inimigo, causa 5 de dano em «${splashTarget.card.name}»!`,
            'life_loss'
          );
          applyEffectDamageToFighter(
            state,
            attackerOwnerId,
            defOwnerId,
            splashTarget.slotIndex,
            5,
            attacker.card,
            attacker.card.ct
          );
        }
      }
    }
  }

  if (atkOwner.frontline[attackerSlot] && atkOwner.frontline[attackerSlot]!.currentHp <= 0) {
    const survivingDef = defOwner.frontline[targetSlot];
    const atkHadInsano =
      (!survivingDef || !hasArchetype(state, survivingDef, 'Véu', attackerIsSolador, attackerSlot)) &&
      hasArchetype(state, attacker, 'Insano', defenderIsSolador, targetSlot);
    const atkIsFeiticeira = attacker.card.code === '2025/0001/00009';

    sendFighterFromFieldToZone(state, attackerOwnerId, attackerSlot, false, true);

    if (atkHadInsano && defOwner.frontline[targetSlot]) {
      const defAfter = defOwner.frontline[targetSlot]!;
      defAfter.currentHp -= 5;
      addLog(
        state,
        attackerOwnerId,
        `💔 Arquétipo [Insano]: «${attacker.card.name}» causou 5 de dano direto em «${defAfter.card.name}»!`,
        'life_loss'
      );
      if (defAfter.currentHp <= 0) {
        sendFighterFromFieldToZone(state, defOwnerId, targetSlot, false, true);
      }
    }

    if (atkIsFeiticeira) {
      const livingEnemies = defOwner.frontline.filter(
        (f): f is FieldFighter => f !== null && f.currentHp > 0
      );
      if (livingEnemies.length > 0) {
        livingEnemies.sort((a, b) => a.currentHp - b.currentHp);
        const lowestEnemy = livingEnemies[0];
        addLog(
          state,
          attackerOwnerId,
          `Efeito de «Jim - Feiticeira»: Ao morrer em combate, dispara 8 de dano contra «${lowestEnemy.card.name}»!`,
          'life_loss'
        );
        applyEffectDamageToFighter(
          state,
          attackerOwnerId,
          defOwnerId,
          lowestEnemy.slotIndex,
          8,
          attacker.card,
          attacker.card.ct
        );
      }
    }
  }

  // [Reativo] vem de OUTROS combatentes inimigos fora a carta alvo (`ally.slotIndex !== targetSlot`).
  // Portanto, se o atacante tiver [Solador], ele ignora todos os outros combatentes inimigos fora o alvo!
  if (!attackerIsSolador) {
    for (const ally of defOwner.frontline) {
      if (
        ally &&
        ally.slotIndex !== targetSlot &&
        hasArchetype(state, ally, 'Reativo')
      ) {
        const validTargets = atkOwner.frontline.filter((f): f is FieldFighter => f !== null);
        if (validTargets.length > 0) {
          const reactiveTarget = validTargets[0];
          const reactiveDmg = getFighterEffectiveAtk(state, ally, false);
          reactiveTarget.currentHp -= reactiveDmg;
          addLog(
            state,
            defOwnerId,
            `Arquétipo [Reativo]: «${ally.card.name}» contra-atacou «${reactiveTarget.card.name}» causando ${reactiveDmg} de dano!`,
            'reaction'
          );
          if (reactiveTarget.currentHp <= 0) {
            sendFighterFromFieldToZone(state, attackerOwnerId, reactiveTarget.slotIndex, false, false);
          }
        }
      }
    }
  }

  checkWinCondition(state);
}

export function processStartOfRound(state: DuelGameState) {
  for (const pid of [state.firstPlayerOfRound, getOpponentId(state.firstPlayerOfRound)]) {
    const p = getPlayerState(state, pid);
    const oppId = getOpponentId(pid);
    const opp = getPlayerState(state, oppId);

    p.mana = 12;
    p.ctReductionThisRound = 0;
    p.damageDealtToEnemyPlayerThisRound = 0;

    if (p.pendingPactoLifeLossNextRound > 0) {
      const loss = p.pendingPactoLifeLossNextRound;
      p.pendingPactoLifeLossNextRound = 0;
      p.hp = Math.max(0, p.hp - loss);
      addLog(
        state,
        pid,
        `💔 «Pacto Forçado» cobrou seu preço: ${p.name} perdeu ${loss} PV no começo da rodada (Vida: ${p.hp} PV).`,
        'life_loss'
      );
      if (checkWinCondition(state)) return;
    }

    // 1. Ato Final (2026/0002/00320):
    // "Caso esse Herói tenha «Mahina» em seu nome, na próxima rodada após o uso desta carta, retorne ele para o Deck de Herói."
    if (p.pendingAtoFinalMahinaReturnRound && state.round >= p.pendingAtoFinalMahinaReturnRound) {
      p.pendingAtoFinalMahinaReturnRound = undefined;
      const isMahinaHero = (c: CardData) => c.type === 'Herói' && c.name.includes('Mahina');
      const dzIdx = p.deadZone.findIndex(isMahinaHero);
      const ezIdx = p.erasedZone.findIndex(isMahinaHero);
      let returnedHero: CardData | null = null;
      if (dzIdx !== -1) returnedHero = p.deadZone.splice(dzIdx, 1)[0];
      else if (ezIdx !== -1) returnedHero = p.erasedZone.splice(ezIdx, 1)[0];
      if (returnedHero) {
        p.heroDeck.push(returnedHero);
        addLog(
          state,
          pid,
          `👑 «Ato Final»: O Herói «${returnedHero.name}» retornou das Zonas para o Deck de Herói de ${p.name}!`,
          'effect'
        );
      }
    }

    // 2. Ritos do Festival (2026/0002/00319):
    // "Após 2 rodadas, invoque ele no campo. Na rodada que este combatente é invocado por este efeito, ele fica imune a efeitos de cartas."
    if (p.pendingRitosFestival && p.pendingRitosFestival.length > 0) {
      const remainingRitos: typeof p.pendingRitosFestival = [];
      for (const entry of p.pendingRitosFestival) {
        if (state.round >= entry.summonOnRound) {
          const freeSlot = p.frontline.findIndex((s) => s === null);
          if (freeSlot !== -1) {
            const dzIdx = p.deadZone.findIndex((c) => c.code === entry.card.code);
            const ezIdx = p.erasedZone.findIndex((c) => c.code === entry.card.code);
            let cardToSummon: CardData = entry.card;
            if (dzIdx !== -1) cardToSummon = p.deadZone.splice(dzIdx, 1)[0];
            else if (ezIdx !== -1) cardToSummon = p.erasedZone.splice(ezIdx, 1)[0];
            const summoned = summonFighterToSlot(state, pid, cardToSummon, freeSlot);
            summoned.immuneToCardEffectsRound = state.round;
            addLog(
              state,
              pid,
              `🩸 «Ritos do Festival»: «${cardToSummon.name}» foi invocado da Zona Morta para o campo e está IMUNE a efeitos de cartas nesta rodada!`,
              'summon'
            );
          } else {
            remainingRitos.push(entry);
          }
        } else {
          remainingRitos.push(entry);
        }
      }
      p.pendingRitosFestival = remainingRitos;
    }

    // 3. Como Planejado (2026/0002/00322):
    // "No início da próxima rodada, a carta negada é usada automaticamente sem custo (caso não possa ser usada, retorne ela para o seu Deck)."
    if (p.pendingComoPlanejadoCards && p.pendingComoPlanejadoCards.length > 0) {
      const remainingPlanned: typeof p.pendingComoPlanejadoCards = [];
      for (const entry of p.pendingComoPlanejadoCards) {
        if (state.round >= entry.triggerOnRound) {
          const ezIdx = p.erasedZone.findIndex((c) => c.code === entry.card.code);
          if (ezIdx !== -1) p.erasedZone.splice(ezIdx, 1);
          const plannedCard = entry.card;

          let canAutoUse = true;
          if (plannedCard.type === 'Combatente' || plannedCard.type === 'Herói') {
            canAutoUse = p.frontline.some((s) => s === null);
          } else if (isContinuousBackrowCard(plannedCard)) {
            canAutoUse =
              p.backrow.some((s) => s === null) ||
              (isCamadaCard(plannedCard) &&
                p.backrow.some((s) => s !== null && isCamadaCard(s.card)));
          } else if (plannedCard.type === 'Equipamento') {
            canAutoUse = p.frontline.some((f) => f !== null);
          } else {
            const desc = (plannedCard.description || '').toLowerCase();
            if (
              plannedCard.code === '2025/0001/00023' ||
              plannedCard.code === '2025/0001/00024' ||
              plannedCard.code === '2025/0001/00028' ||
              plannedCard.code === '2025/0001/00029' ||
              plannedCard.code === '2026/0002/00317' ||
              plannedCard.code === '2026/0002/00322' ||
              desc.includes('negue')
            ) {
              canAutoUse = false;
            }
          }

          if (canAutoUse) {
            addLog(
              state,
              pid,
              `🎯 «Como Planejado»: A carta «${plannedCard.name}» da Zona Apagada foi usada automaticamente sem custo para ${p.name}!`,
              'effect'
            );
            const targetSlot =
              plannedCard.type === 'Combatente' || plannedCard.type === 'Herói'
                ? p.frontline.findIndex((s) => s === null)
                : isContinuousBackrowCard(plannedCard)
                ? p.backrow.findIndex((s) => s === null)
                : 0;
            resolveInsanisCardEffect(state, pid, plannedCard, Math.max(0, targetSlot));
          } else {
            p.deck.push(plannedCard);
            p.deck = shuffleCards(p.deck);
            addLog(
              state,
              pid,
              `🎯 «Como Planejado»: Como «${plannedCard.name}» não pôde ser usada no início da rodada, ela foi retornada para o Deck de ${p.name}!`,
              'info'
            );
          }
        } else {
          remainingPlanned.push(entry);
        }
      }
      p.pendingComoPlanejadoCards = remainingPlanned;
    }

    // Selena - Deusa da Lua (2025/0001/00211): "No início da 5ª Rodada, invoque esta carta em campo."
    if (state.round === 5) {
      const selenaIdx = p.heroDeck.findIndex((c) => c.code === '2025/0001/00211');
      const freeSlot = p.frontline.findIndex((s) => s === null);
      if (selenaIdx !== -1 && freeSlot !== -1) {
        const [selenaCard] = p.heroDeck.splice(selenaIdx, 1);
        addLog(
          state,
          pid,
          `🌙 Início da 5ª Rodada! «Selena - Deusa da Lua» foi invocada automaticamente para ${p.name}!`,
          'summon'
        );
        summonFighterToSlot(state, pid, selenaCard, freeSlot);
      }
    }

    // =========================================================================
    // EFEITOS OFICIAIS DE INÍCIO DE RODADA DAS CAMADAS DO VÉU (INVASÃO DO CAOS)
    // "Para cada carta com «Camada» em seu nome em seu lado do campo..."
    // =========================================================================
    const camadasCount = countCamadasOnField(p);
    const veuFightersCount = countVeuFightersOnField(state, p);

    if (camadasCount > 0) {
      if (hasActiveCamada(p, '2026/0002/00326')) {
        const extraMana = camadasCount * (veuFightersCount >= 2 ? 2 : 1);
        p.mana += extraMana;
        addLog(
          state,
          pid,
          `⚡ «Terceira Camada»: ${p.name} recebeu +${extraMana} de Mana pelas ${camadasCount} «Camada(s)» em seu lado do campo (Mana: ${p.mana})!`,
          'effect'
        );
      }

      if (hasActiveCamada(p, '2026/0002/00327')) {
        const healAmt = camadasCount * (veuFightersCount >= 2 ? 4 : 2);
        p.hp += healAmt;
        addLog(
          state,
          pid,
          `💚 «Quarta Camada»: ${p.name} recebeu +${healAmt} de Vida de Jogador pelas ${camadasCount} «Camada(s)» em seu lado do campo (Vida: ${p.hp} PV)!`,
          'life_gain'
        );
      }

      if (hasActiveCamada(p, '2026/0002/00328')) {
        p.runes += camadasCount;
        addLog(
          state,
          pid,
          `✨ «Quinta Camada»: ${p.name} recebeu +${camadasCount} Runa(s) pelas ${camadasCount} «Camada(s)» em seu lado do campo (Total: ${p.runes} Runas)!`,
          'effect'
        );
      }
    }

    for (const f of p.frontline) {
      if (f) {
        f.usedOncePerRoundAbility = false;
        f.macroversalUsedThisRound = false;
        f.azaradoUsedThisRound = false;
        f.jimLordTier9GemUsedThisRound = false;

        if (hasArchetype(state, f, 'Conceito')) {
          f.currentHp += 5;
          addLog(
            state,
            pid,
            `💚 Arquétipo [Conceito]: «${f.card.name}» recebeu +5 de Vida no começo da rodada (Vida: ${f.currentHp}).`,
            'life_gain'
          );
        }

        // Jenos Senhor do Macroverso (2025/0001/00031):
        if (f.card.code === '2025/0001/00031') {
          if (state.round === f.summonedRound + 1) {
            const returnedCount = p.deadZone.length + p.erasedZone.length;
            p.deck.push(...p.deadZone, ...p.erasedZone);
            p.deadZone = [];
            p.erasedZone = [];
            p.deck = shuffleCards(p.deck);
            p.hp = Math.max(p.hp, 20);
            addLog(
              state,
              pid,
              `👑 «Jenos Senhor do Macroverso» (1 Rodada em campo): Retornou ${returnedCount} cartas das Zonas ao Deck e restaurou a vida de ${p.name} para ${p.hp} PV!`,
              'life_gain'
            );
          } else if (state.round >= f.summonedRound + 3) {
            dealDamageToPlayer(
              state,
              oppId,
              pid,
              99999,
              '«Jenos Senhor do Macroverso» (3 Rodadas em campo)'
            );
            if (checkWinCondition(state)) return;
          }
        }

        // Spear Vellret (2025/0001/00061):
        if (f.card.code === '2025/0001/00061') {
          let longinusCount = 0;
          for (const af of p.frontline) {
            if (af) {
              if (af.card.name.includes('Longinus')) longinusCount++;
              longinusCount += af.equipments.filter((e) => e.card.name.includes('Longinus')).length;
            }
          }
          for (const s of p.backrow) {
            for (const c of getAllSupportCardsInSlot(s)) {
              if (c.name.includes('Longinus')) longinusCount++;
            }
          }
          if (longinusCount > 0) {
            p.hp += longinusCount;
            addLog(
              state,
              pid,
              `💚 «Spear Vellret»: ${p.name} recuperou +${longinusCount} PV pelas ${longinusCount} carta(s) «Longinus» em campo!`,
              'life_gain'
            );
          }
        }

        // Spear Kiara (2025/0001/0073):
        if (
          f.card.code === '2025/0001/0073' &&
          f.equipments.some((e) => e.card.name.includes('Longinus')) &&
          p.heroDeck.some((h) => h.name.includes('Vellret'))
        ) {
          const vIdx = p.heroDeck.findIndex((h) => h.name.includes('Vellret'));
          const freeSlot = p.frontline.findIndex((s) => s === null);
          if (vIdx !== -1 && freeSlot !== -1) {
            const [vellretHero] = p.heroDeck.splice(vIdx, 1);
            addLog(
              state,
              pid,
              `👑 «Spear Kiara» equipada com «Longinus» invocou o Herói «${vellretHero.name}»!`,
              'summon'
            );
            summonFighterToSlot(state, pid, vellretHero, freeSlot);
          }
        }

        // Equilíbrio Imperfeito Mahina (2025/0001/00092):
        if (f.card.code === '2025/0001/00092') {
          applyAoEEffectDamageToEnemyFighters(state, pid, oppId, 3, f.card, f.card.ct);
          for (const targetName of ['Energia Lúmen', 'Energia Darkus']) {
            const dIdx = p.deck.findIndex((c) => c.name.includes(targetName));
            const zIdx = p.deadZone.findIndex((c) => c.name.includes(targetName));
            if (dIdx !== -1) p.hand.push(p.deck.splice(dIdx, 1)[0]);
            else if (zIdx !== -1) p.hand.push(p.deadZone.splice(zIdx, 1)[0]);
          }
          addLog(
            state,
            pid,
            `👑 «Equilíbrio Imperfeito Mahina»: Causou 3 de dano aos combatentes inimigos e buscou «Energia Lúmen» / «Energia Darkus»!`,
            'effect'
          );
        }

        // Donnie - Samurai das Chamas (2025/0001/00121):
        if (f.card.code === '2025/0001/00121') {
          const isCorte = (c: CardData) => c.code === '2025/0001/00149' || c.name.includes('Corte Ígneo');
          const dIdx = p.deck.findIndex(isCorte);
          const zIdx = p.deadZone.findIndex(isCorte);
          if (dIdx !== -1) {
            p.hand.push(p.deck.splice(dIdx, 1)[0]);
            addLog(state, pid, `🔥 «Donnie - Samurai das Chamas»: Buscou «Corte Ígneo» para a mão!`, 'effect');
          } else if (zIdx !== -1) {
            p.hand.push(p.deadZone.splice(zIdx, 1)[0]);
            addLog(state, pid, `🔥 «Donnie - Samurai das Chamas»: Recuperou «Corte Ígneo» da Zona Morta para a mão!`, 'effect');
          }
        }

        // Donnie - Grande General (2025/0001/00122):
        if (f.card.code === '2025/0001/00122') {
          if (p.deck.length > 0) discardCardDirectlyToZone(state, pid, p.deck.shift()!, 'erasedZone');
          if (opp.deck.length > 0) discardCardDirectlyToZone(state, oppId, opp.deck.shift()!, 'erasedZone');
          addLog(
            state,
            pid,
            `🔥 «Donnie - Grande General»: Enviou 1 carta do topo de ambos os Decks para a Zona Apagada!`,
            'effect'
          );
        }

        // Lordes do Corruptor Profano (2025/0001/00155 a 2025/0001/00161):
        if (
          f.card.code === '2025/0001/00155' ||
          f.card.code === '2025/0001/00156' ||
          f.card.code === '2025/0001/00157' ||
          f.card.code === '2025/0001/00158' ||
          f.card.code === '2025/0001/00159' ||
          f.card.code === '2025/0001/00160' ||
          f.card.code === '2025/0001/00161'
        ) {
          p.runes += 1;
          addLog(
            state,
            pid,
            `✨ «${f.card.name}»: Gerou +1 Runa no começo da rodada (Total: ${p.runes} Runas)!`,
            'effect'
          );
          checkOttoAscensionToAsmonious(state, pid);
        }

        // Asmonious - O Corruptor (2025/0001/00152):
        if (f.card.code === '2025/0001/00152' && p.frontline.some((s) => s === null)) {
          const freeSlot = p.frontline.findIndex((s) => s === null);
          const isCorrompido = (c: CardData) =>
            c.type === 'Combatente' && /corrompid[oa]/i.test(c.name);
          const dIdx = p.deck.findIndex(isCorrompido);
          const zIdx = p.deadZone.findIndex(isCorrompido);
          const hIdx = p.hand.findIndex(isCorrompido);
          let corrCard: CardData | null = null;
          if (dIdx !== -1) corrCard = p.deck.splice(dIdx, 1)[0];
          else if (zIdx !== -1) corrCard = p.deadZone.splice(zIdx, 1)[0];
          else if (hIdx !== -1) corrCard = p.hand.splice(hIdx, 1)[0];
          if (corrCard && freeSlot !== -1) {
            addLog(
              state,
              pid,
              `💀 «Asmonious - O Corruptor»: Invocou «${corrCard.name}» no começo da rodada!`,
              'summon'
            );
            summonFighterToSlot(state, pid, corrCard, freeSlot);
          }
        }

        // Arthemiel do Véu (2026/0001/00302): "No começo da rodada, receba 7 de Vida de Jogador."
        if (f.card.code === '2026/0001/00302') {
          p.hp += 7;
          addLog(
            state,
            pid,
            `💚 «Arthemiel do Véu»: ${p.name} recebeu +7 de Vida de Jogador no começo da rodada (Vida: ${p.hp} PV)!`,
            'life_gain'
          );
        }

        // Atropos do Véu (2026/0001/00303): "No começo da rodada, cause 5 de dano na Vida do Jogador inimigo."
        if (f.card.code === '2026/0001/00303') {
          dealDamageToPlayer(state, oppId, pid, 5, '«Atropos do Véu» (Início da Rodada)');
          if (checkWinCondition(state)) return;
        }

        // Eizen do Véu (2026/0001/00304):
        if (f.card.code === '2026/0001/00304' && p.frontline.some((s) => s === null)) {
          const freeSlot = p.frontline.findIndex((s) => s === null);
          const isValidEizenTarget = (c: CardData) =>
            c.type === 'Combatente' &&
            c.code !== '2026/0001/00313' &&
            (c.name.includes('Véu') || (c.archetype || '').includes('Véu'));

          let summonedCard: CardData | null = null;
          const zIdx = p.deadZone.findIndex(isValidEizenTarget);
          const eIdx = p.erasedZone.findIndex(isValidEizenTarget);
          const dIdx = p.deck.findIndex(isValidEizenTarget);
          const hIdx = p.hand.findIndex(isValidEizenTarget);

          if (zIdx !== -1) summonedCard = p.deadZone.splice(zIdx, 1)[0];
          else if (eIdx !== -1) summonedCard = p.erasedZone.splice(eIdx, 1)[0];
          else if (dIdx !== -1) summonedCard = p.deck.splice(dIdx, 1)[0];
          else if (hIdx !== -1) summonedCard = p.hand.splice(hIdx, 1)[0];

          if (summonedCard && freeSlot !== -1) {
            addLog(
              state,
              pid,
              `✨ «Eizen do Véu» (Início da Rodada): Invocou «${summonedCard.name}» para a Coluna ${freeSlot + 1}!`,
              'summon'
            );
            summonFighterToSlot(state, pid, summonedCard, freeSlot);
          }
        }

        // Três do Véu (2026/0001/00305):
        if (f.card.code === '2026/0001/00305') {
          const r1 = rollDieWithSortudo(state, pid, 6, (v) => v === 3);
          const r2 = rollDieWithSortudo(state, pid, 6, (v) => v === 3);
          const r3 = rollDieWithSortudo(state, pid, 6, (v) => v === 3);
          const hitThree = r1.result === 3 || r2.result === 3 || r3.result === 3;
          if (hitThree) {
            const enemyFighter = opp.frontline.find((ef) => ef !== null && !ef.isHero);
            if (enemyFighter) {
              opp.frontline[enemyFighter.slotIndex] = null;
              opp.deck.push(enemyFighter.card);
              addLog(
                state,
                pid,
                `🎲 «Três do Véu» rolou 3D6 (${r1.result}, ${r2.result}, ${r3.result}) → Saiu 3! Retornou «${enemyFighter.card.name}» do campo inimigo para o Deck!`,
                'effect'
              );
            } else {
              dealPrimordialDamageToDeck(state, pid, oppId, 3, '«Três do Véu» (Saiu 3 nos 3D6)');
            }
          } else {
            addLog(
              state,
              pid,
              `🎲 «Três do Véu» rolou 3D6 (${r1.result}, ${r2.result}, ${r3.result}) — nenhum 3 saiu nesta rodada.`,
              'info'
            );
          }
        }

        // O HORROR DO VÉU (2026/0001/00313):
        if (f.card.code === '2026/0001/00313') {
          const uniqueArchs = new Set<string>();
          for (const af of [...p.frontline, ...opp.frontline]) {
            if (af) {
              for (const a of getEffectiveArchetypes(state, af)) {
                uniqueArchs.add(a);
              }
            }
          }
          const horrorDmg = uniqueArchs.size * 10;
          if (horrorDmg > 0) {
            dealDamageToPlayer(
              state,
              oppId,
              pid,
              horrorDmg,
              `«O Horror do Véu» (${uniqueArchs.size} Arquétipos diferentes em campo)`
            );
            if (checkWinCondition(state)) return;
          }
        }

        // Rebirth do Véu (2026/0001/00311):
        // "Após 1 rodada em campo, esta carta adiciona para a sua mão de qualquer lugar um combatente com «Floquinho» em seu nome, sendo tratado como um Herói para efeito de outras cartas."
        if (
          f.card.code === '2026/0001/00311' &&
          state.round >= f.summonedRound + 1 &&
          !f.rebirthVeuTriggered
        ) {
          f.rebirthVeuTriggered = true;
          const isFloquinho = (c: CardData) =>
            (c.type === 'Combatente' || c.type === 'Herói') && c.name.includes('Floquinho');
          let floq: CardData | null = null;
          const dIdx = p.deck.findIndex(isFloquinho);
          const zIdx = p.deadZone.findIndex(isFloquinho);
          const eIdx = p.erasedZone.findIndex(isFloquinho);
          if (dIdx !== -1) floq = p.deck.splice(dIdx, 1)[0];
          else if (zIdx !== -1) floq = p.deadZone.splice(zIdx, 1)[0];
          else if (eIdx !== -1) floq = p.erasedZone.splice(eIdx, 1)[0];

          if (floq) {
            p.hand.push(floq);
            p.floquinhoTreatedAsHeroCodes = p.floquinhoTreatedAsHeroCodes || [];
            if (!p.floquinhoTreatedAsHeroCodes.includes(floq.code)) {
              p.floquinhoTreatedAsHeroCodes.push(floq.code);
            }
            addLog(
              state,
              pid,
              `✨ «Rebirth do Véu» (Após 1 rodada em campo): Adicionou «${floq.name}» para a mão de ${p.name} (tratada como Herói para efeitos de outras cartas)!`,
              'effect'
            );
          } else {
            addLog(
              state,
              pid,
              `«Rebirth do Véu» ativou após 1 rodada, mas não havia nenhuma «Floquinho» no Deck ou nas Zonas de ${p.name}.`,
              'info'
            );
          }
        }

        // Grande Sábio (2025/0001/00095): "Após 1 rodada em campo, busque «Coroa Lúmeni» para a sua mão."
        if (f.card.code === '2025/0001/00095' && state.round === f.summonedRound + 1) {
          const coroaIdx = p.deck.findIndex((c) => c.code === '2025/0001/00110');
          if (coroaIdx !== -1) {
            const [coroa] = p.deck.splice(coroaIdx, 1);
            p.hand.push(coroa);
            addLog(
              state,
              pid,
              `✨ «Grande Sábio»: Buscou «Coroa Lúmeni» do Deck para a mão de ${p.name}!`,
              'effect'
            );
          }
        }

        // «Jim - Rei Elfo» (2025/0001/00005):
        if (
          f.card.code === '2025/0001/00005' &&
          state.round === f.summonedRound + 1 &&
          p.frontline.some((s) => s === null)
        ) {
          if (pid === 'player') {
            const deckJims: ChoiceCandidate[] = p.deck
              .map((c, idx) => ({ c, idx }))
              .filter((item) => isJimCard(item.c) && item.c.type === 'Combatente')
              .map((item) => ({
                id: `rei_elfo_deck_${item.idx}_${item.c.code}`,
                card: item.c,
                sourceZone: 'deck' as const,
                sourceIndex: item.idx,
                subtitle: 'No seu Deck'
              }));

            if (deckJims.length > 0) {
              state.pendingChoiceQueue.push({
                title: '«Jim - Rei Elfo» (Efeito Automático na Rodada Seguinte)',
                description:
                  'Escolha 1 combatente «Jim» do seu Deck para invocar automaticamente em campo:',
                candidates: deckJims,
                minSelect: 1,
                maxSelect: 1,
                effectKind: 'REI_ELFO'
              });
            } else {
              addLog(
                state,
                pid,
                `«Jim - Rei Elfo»: Efeito automático da rodada seguinte disparou, mas não há combatentes «Jim» restantes no seu Deck.`,
                'info'
              );
            }
          } else {
            const candidates = p.deck
              .map((c, idx) => ({ c, idx }))
              .filter((item) => isJimCard(item.c) && item.c.type === 'Combatente')
              .sort((a, b) => b.c.ct - a.c.ct);

            if (candidates.length > 0) {
              const chosen = candidates[0];
              p.deck.splice(chosen.idx, 1);
              const freeSlot = p.frontline.findIndex((s) => s === null);
              if (freeSlot !== -1) {
                addLog(
                  state,
                  pid,
                  `«Jim - Rei Elfo» (Rodada Seguinte): Bot invocou automaticamente «${chosen.c.name}» do Deck na Coluna ${freeSlot + 1}!`,
                  'summon'
                );
                summonFighterToSlot(state, 'bot', chosen.c, freeSlot);
              }
            }
          }
        }
      }
    }

    for (const s of p.backrow) {
      if (s) {
        s.usedOncePerRound = false;
        for (const supCard of getAllSupportCardsInSlot(s)) {
          if (supCard.code === '2025/0001/00016') {
            if (pid === 'player') {
              const deckJims: ChoiceCandidate[] = p.deck
                .map((c, idx) => ({ c, idx }))
                .filter((item) => isJimCard(item.c) && item.c.type === 'Combatente')
                .map((item) => ({
                  id: `ascensao_${item.idx}_${item.c.code}`,
                  card: item.c,
                  sourceZone: 'deck',
                  sourceIndex: item.idx,
                  subtitle: 'No seu Deck'
                }));
              if (deckJims.length > 0) {
                state.pendingChoiceQueue.push({
                  title: '«Ascensão do Rei» (Início da Rodada)',
                  description: 'Escolha 1 combatente «Jim» do seu Deck para enviar à sua Zona Apagada:',
                  candidates: deckJims,
                  minSelect: 1,
                  maxSelect: 1,
                  effectKind: 'ASCENSAO_DO_REI'
                });
              }
            } else {
              const jimIdx = p.deck.findIndex((c) => isJimCard(c) && c.type === 'Combatente');
              if (jimIdx !== -1) {
                const [sentJim] = p.deck.splice(jimIdx, 1);
                discardCardDirectlyToZone(state, pid, sentJim, 'erasedZone');
                addLog(
                  state,
                  pid,
                  `«Ascensão do Rei»: Bot enviou «${sentJim.name}» do Deck para a Zona Apagada (${countJimsInErasedZone(p)} «Jim» na Zona Apagada).`,
                  'effect'
                );
              }
            }
          } else if (supCard.code === '2025/0001/00110') {
            const mahinaIdx = p.heroDeck.findIndex((c) => c.code === '2025/0001/00091');
            const freeSlot = p.frontline.findIndex((slot) => slot === null);
            if (mahinaIdx !== -1 && freeSlot !== -1) {
              const [mahinaHero] = p.heroDeck.splice(mahinaIdx, 1);
              addLog(
                state,
                pid,
                `👑 «Coroa Lúmeni»: Invocou o Herói «${mahinaHero.name}» em campo!`,
                'summon'
              );
              summonFighterToSlot(state, pid, mahinaHero, freeSlot);
            }
          } else if (supCard.code === '2026/0002/00315') {
            // APOTEOSE DO VÉU: "No começo da Rodada, caso queira, perca 5 de Vida de Jogador e coloque em campo de qualquer lugar uma carta com «Camada» em seu nome."
            const canPlaceCamada =
              p.backrow.some((slot) => slot === null) ||
              p.backrow.some((slot) => slot !== null && isCamadaCard(slot.card));
            if (p.hp > 5 && canPlaceCamada) {
              if (pid === 'player') {
                const camadaCandidates = getCamadaCandidatesForPlayer(p);
                if (camadaCandidates.length > 0) {
                  state.pendingChoiceQueue.push({
                    title: '«Apoteose do Véu» (Início da Rodada • Opcional)',
                    description:
                      'Caso queira pagar 5 PV, selecione qual «Camada» deseja colocar em campo (ou confirme sem selecionar nenhuma para não pagar 5 PV):',
                    candidates: camadaCandidates,
                    minSelect: 0,
                    maxSelect: 1,
                    effectKind: 'APOTEOSE_ROUND_START'
                  });
                }
              } else {
                const equipped = pullAndEquipCamadaFromAnywhere(state, pid);
                if (equipped) {
                  p.hp -= 5;
                  addLog(
                    state,
                    pid,
                    `💔 «Apoteose do Véu»: ${p.name} perdeu 5 PV no começo da rodada e colocou «${equipped.name}» em campo (Vida: ${p.hp} PV)!`,
                    'life_loss'
                  );
                }
              }
            }
          } else if (
            supCard.code === '2025/0001/00137' ||
            supCard.code === '2025/0001/00138' ||
            supCard.code === '2025/0001/00139'
          ) {
            applyAoEEffectDamageToEnemyFighters(state, pid, oppId, 1, supCard, supCard.ct);
          }
        }
      }
    }

    for (const f of p.frontline) {
      if (f && f.equipments.some((e) => e.card.code === '2025/0001/00012')) {
        const threshold = f.currentHp / 2;
        for (let slot = 0; slot < 6; slot++) {
          const enemyF = opp.frontline[slot];
          if (enemyF && enemyF.currentHp < threshold) {
            const enemyHasGema5 = enemyF.equipments.some((e) => e.card.code === '2025/0001/00015');
            if (enemyHasGema5) {
              enemyF.currentHp -= 5;
              addLog(
                state,
                pid,
                `💔 «Crueldade» ativou contra «${enemyF.card.name}», mas «Gema Macroversal 5» converteu a eliminação em 5 de dano!`,
                'life_loss'
              );
              if (enemyF.currentHp <= 0) {
                sendFighterFromFieldToZone(state, oppId, slot, false, false);
              }
            } else {
              addLog(
                state,
                pid,
                `💔 «Crueldade» equipada em «${f.card.name}» (Vida ${f.currentHp}) eliminou automaticamente «${enemyF.card.name}» (Vida ${enemyF.currentHp} < ${threshold})!`,
                'life_loss'
              );
              sendFighterFromFieldToZone(state, oppId, slot, false, false);
            }
          }
        }
      }
    }
  }

  addLog(
    state,
    'system',
    `Início da Rodada ${state.round}: Mana de ambos os jogadores restaurada!`,
    'info'
  );
}

export function hasPlayerAnytimeActionsAvailable(state: DuelGameState): boolean {
  const p = state.player;
  const heroCard = p.heroDeck[0];
  if (heroCard && canSummonHeroDirectly(state, 'player', heroCard, true).allowed) {
    return true;
  }
  if (p.frontline.some((f) => f !== null && f.card.code === '2025/0001/00007' && !f.usedOncePerRoundAbility)) {
    return true;
  }
  if (
    p.backrow.some((s) => s !== null && s.card.code === '2025/0001/00017' && !s.usedOncePerRound) &&
    p.deck.some((c) => c.ct === p.runes)
  ) {
    return true;
  }
  return false;
}

export function processStartOfTurn(state: DuelGameState) {
  const active = getPlayerState(state, state.activePlayer);
  const nonActive = getPlayerState(state, getOpponentId(state.activePlayer));

  active.hasAttackedInCurrentTurn = false;
  active.lockedFromAttackingThisTurn = false;
  active.lostFighterInBattleThisTurn = false;
  active.heroDiedThisTurn = false;
  nonActive.lostFighterInBattleThisTurn = false;
  nonActive.heroDiedThisTurn = false;

  for (const f of active.frontline) {
    if (f) {
      f.hasAttackedThisTurn = false;
      f.attacksThisTurnCount = 0;
    }
  }

  if (state.globalTurn >= 2) {
    for (const pid of [state.activePlayer, getOpponentId(state.activePlayer)]) {
      const p = getPlayerState(state, pid);
      if (state.globalTurn <= p.skipDrawsUntilGlobalTurn) {
        addLog(
          state,
          pid,
          `«Manipulação das Realidades»: ${p.name} está impedido de comprar carta neste turno!`,
          'effect'
        );
      } else if (p.deck.length > 0) {
        const drawn = p.deck.shift()!;
        p.hand.push(drawn);
        addLog(state, pid, `${p.name} comprou 1 carta (${p.deck.length} restantes no Deck).`, 'info');
      } else {
        addLog(state, pid, `${p.name} não possui mais cartas no Deck para comprar!`, 'info');
      }
    }
  }

  for (const pid of [state.activePlayer, getOpponentId(state.activePlayer)]) {
    const p = getPlayerState(state, pid);
    const oppId = getOpponentId(pid);
    const opp = getPlayerState(state, oppId);

    for (const s of p.backrow) {
      if (s && s.card.code === '2025/0001/00017') {
        p.runes += 1;
        addLog(
          state,
          pid,
          `«Busca Pela Eternidade»: ${p.name} recebeu +1 Runa (Total: ${p.runes} Runas).`,
          'effect'
        );
      }
    }

    for (const f of p.frontline) {
      if (!f) continue;

      if (f.jimLordTier6Mana) {
        p.mana += 5;
        addLog(
          state,
          pid,
          `«Jim - O Senhor do Macroverso» [6+ Jim]: ${p.name} recebeu +5 de Mana (Mana atual: ${p.mana})!`,
          'effect'
        );
      }

      // Jenos Destinado (2025/0001/00033):
      if (f.card.code === '2025/0001/00033' && pid === state.activePlayer) {
        const destinadosCount =
          p.frontline.filter((af) => af !== null && /destinad[oa]/i.test(af.card.name)).length +
          p.backrow.filter((as) => as !== null && /destinad[oa]/i.test(as.card.name)).length;
        let drawnExtra = 0;
        for (let i = 0; i < destinadosCount && p.deck.length > 0; i++) {
          p.hand.push(p.deck.shift()!);
          drawnExtra++;
        }
        if (drawnExtra > 0) {
          addLog(
            state,
            pid,
            `👑 «Jenos Destinado»: ${p.name} comprou +${drawnExtra} carta(s) extra(s) pelos «Destinado(a)» em campo!`,
            'effect'
          );
        }
      }

      // Jenos Caído (2025/0001/00035):
      if (f.card.code === '2025/0001/00035' && pid === state.activePlayer) {
        const d1 = rollDieWithSortudo(state, pid, 6, (v) => v <= 2).result;
        const d2 = rollDieWithSortudo(state, pid, 6).result;
        p.hp = Math.max(0, p.hp - d1);
        opp.hp = Math.max(0, opp.hp - d2);
        addLog(
          state,
          pid,
          `🎲 «Jenos Caído»: ${p.name} perdeu ${d1} PV e ${opp.name} perdeu ${d2} PV no início do turno!`,
          'life_loss'
        );
        if (checkWinCondition(state)) return;
      }

      // Vellret - Escolhido de Salazar (2025/0001/00062):
      if (f.card.code === '2025/0001/00062' && pid === state.activePlayer) {
        const mangaIdx = p.deck.findIndex((c) => c.name.includes('Manga'));
        if (mangaIdx !== -1) {
          const [mangaCard] = p.deck.splice(mangaIdx, 1);
          p.hand.push(mangaCard);
          addLog(
            state,
            pid,
            `👑 «Vellret - Escolhido de Salazar»: Buscou «${mangaCard.name}» do Deck para a mão!`,
            'effect'
          );
        }
      }

      // Mahina - O Herdeiro de Lúmeni (2025/0001/00091):
      if (f.card.code === '2025/0001/00091' && pid === state.activePlayer) {
        f.permAtkBonus += 3;
        f.permHpBonus += 3;
        f.currentHp += 3;
        f.maxHp += 3;
        addLog(
          state,
          pid,
          `👑 «Mahina - O Herdeiro de Lúmeni»: Recebeu +3/+3 no início do turno!`,
          'life_gain'
        );
      }

      // Salazar - Guia dos Escolhidos (2025/0001/00181):
      if (f.card.code === '2025/0001/00181' && pid === state.activePlayer) {
        const rem = Math.min(2, opp.mana);
        opp.mana -= rem;
        if (rem > 0) {
          addLog(
            state,
            pid,
            `⚡ «Salazar - Guia dos Escolhidos»: Removeu ${rem} de Mana de ${opp.name}!`,
            'effect'
          );
        }
      }

      // Salazar - O Poderoso Líder (2025/0001/00182):
      if (f.card.code === '2025/0001/00182' && pid === state.activePlayer) {
        dealDamageToPlayer(state, oppId, pid, 1, '«Salazar - O Poderoso Líder»');
        if (checkWinCondition(state)) return;
      }

      // Salazar - O Falho (2025/0001/00184):
      if (f.card.code === '2025/0001/00184' && pid === state.activePlayer) {
        const recovered = p.deadZone.shift() || p.erasedZone.shift();
        if (recovered) {
          p.deck.push(recovered);
          f.permHpBonus += 1;
          f.currentHp += 1;
          f.maxHp += 1;
          addLog(
            state,
            pid,
            `👑 «Salazar - O Falho»: Retornou «${recovered.name}» das Zonas para o Deck (+1/+1)!`,
            'effect'
          );
        }
      }

      // Salazar - Destruidor do Macroverso (2025/0001/00185):
      if (f.card.code === '2025/0001/00185' && pid === state.activePlayer) {
        applyAoEEffectDamageToEnemyFighters(state, pid, oppId, 10, f.card, f.card.ct);
        p.hp += 5;
        addLog(
          state,
          pid,
          `👑 «Salazar - Destruidor do Macroverso»: Causou 10 de dano a todos os combatentes inimigos e recuperou +5 PV para ${p.name}!`,
          'life_gain'
        );
      }

      // Selena - Deusa da Lua (2025/0001/00211):
      if (f.card.code === '2025/0001/00211') {
        for (const ally of p.frontline) {
          if (ally) {
            ally.permAtkBonus += 1;
            ally.permHpBonus += 1;
            ally.currentHp += 1;
            ally.maxHp += 1;
          }
        }
        addLog(
          state,
          pid,
          `🌙 «Selena - Deusa da Lua»: Todos os combatentes de ${p.name} receberam +1/+1 neste turno!`,
          'life_gain'
        );
      }

      // Selena - Macroverso Inverso (2025/0001/00214):
      if (f.card.code === '2025/0001/00214' && pid === state.activePlayer) {
        p.hp += 5;
        addLog(
          state,
          pid,
          `💚 «Selena - Macroverso Inverso»: ${p.name} recuperou +5 PV (Vida: ${p.hp} PV)!`,
          'life_gain'
        );
      }

      // Mahina - O Arauto do Véu (2026/0001/00301):
      // "No começo do turno, recebe +5 de Ataque. No começo do turno, pode selecionar uma carta com «Véu» ou «Camada» em seu nome ou um combatente com o Arquétipo Véu das suas Zonas e adicionar à sua mão."
      if (f.card.code === '2026/0001/00301' && pid === state.activePlayer) {
        f.permAtkBonus += 5;
        const isVeuOrCamada = (c: CardData) =>
          c.name.includes('Véu') ||
          c.name.includes('Camada') ||
          (c.archetype || '').includes('Véu') ||
          (AUTHORITATIVE_VEU_ARCHETYPES[c.code] || '').includes('Véu');

        addLog(
          state,
          pid,
          `👑 «Mahina - O Arauto do Véu» (Início do Turno): Recebeu +5 de Ataque (ATK ${getFighterEffectiveAtk(state, f)})!`,
          'effect'
        );

        if (pid === 'player') {
          const zoneCandidates: ChoiceCandidate[] = [];
          p.deadZone.forEach((c, idx) => {
            if (isVeuOrCamada(c)) {
              zoneCandidates.push({
                id: `mahina_dead_${idx}_${c.code}`,
                card: c,
                sourceZone: 'deadZone',
                sourceIndex: idx,
                subtitle: 'Na Zona Morta'
              });
            }
          });
          p.erasedZone.forEach((c, idx) => {
            if (isVeuOrCamada(c)) {
              zoneCandidates.push({
                id: `mahina_erased_${idx}_${c.code}`,
                card: c,
                sourceZone: 'erasedZone',
                sourceIndex: idx,
                subtitle: 'Na Zona Apagada'
              });
            }
          });

          if (zoneCandidates.length > 0) {
            state.pendingChoiceQueue.push({
              title: '«Mahina - O Arauto do Véu» (Início do Turno)',
              description:
                'Selecione até 1 carta com «Véu», «Camada» ou combatente com Arquétipo Véu das suas Zonas para adicionar à sua mão:',
              candidates: zoneCandidates,
              minSelect: 0,
              maxSelect: 1,
              effectKind: 'MAHINA_VEU_ZONES'
            });
          }
        } else {
          let recovered: CardData | null = null;
          const zIdx = p.deadZone.findIndex(isVeuOrCamada);
          const eIdx = p.erasedZone.findIndex(isVeuOrCamada);
          if (zIdx !== -1) recovered = p.deadZone.splice(zIdx, 1)[0];
          else if (eIdx !== -1) recovered = p.erasedZone.splice(eIdx, 1)[0];
          if (recovered) {
            p.hand.push(recovered);
            addLog(
              state,
              pid,
              `👑 «Mahina - O Arauto do Véu»: Bot recuperou «${recovered.name}» das Zonas para a mão!`,
              'effect'
            );
          }
        }
      }

      // Zwey (2026/0001/00307):
      if (f.card.code === '2026/0001/00307' && pid === state.activePlayer) {
        const enemyNonHero = opp.frontline
          .filter((ef): ef is FieldFighter => ef !== null && !ef.isHero && getFighterEffectiveAtk(state, ef) > 0)
          .sort((a, b) => getFighterEffectiveAtk(state, b) - getFighterEffectiveAtk(state, a))[0];
        if (enemyNonHero && !f.usedOncePerRoundAbility) {
          f.usedOncePerRoundAbility = true;
          enemyNonHero.baseAtk = 0;
          enemyNonHero.permAtkBonus = 0;
          enemyNonHero.tempAtkBonus = 0;
          addLog(
            state,
            pid,
            `«Zwey»: Reduziu o ataque de «${enemyNonHero.card.name}» para 0!`,
            'effect'
          );
        }
        const zeroAtkCount = [...p.frontline, ...opp.frontline].filter(
          (af) => af !== null && getFighterEffectiveAtk(state, af) === 0
        ).length;
        if (zeroAtkCount > 0) {
          const manaGain = zeroAtkCount * 3;
          p.mana += manaGain;
          addLog(
            state,
            pid,
            `⚡ «Zwey»: ${p.name} recebeu +${manaGain} de Mana por ${zeroAtkCount} combatente(s) com 0 de Ataque em campo!`,
            'effect'
          );
        }
      }

      if (f.card.code === '2025/0001/00008' && pid === state.activePlayer) {
        const rollRes = rollDieWithSortudo(state, pid, 4);
        const removed = Math.min(opp.mana, rollRes.result);
        opp.mana -= removed;
        addLog(
          state,
          pid,
          `🎲 «Jim - Arqueira» rolou 1D4 (${rollRes.rolls.join(', ')} → ${rollRes.result}) e removeu ${removed} de Mana de ${opp.name} (Mana restante: ${opp.mana})!`,
          'effect'
        );
      }
    }
  }
}

export function advanceTurn(state: DuelGameState, skipPreDrawWindow = false) {
  if (checkWinCondition(state)) return;

  if (!skipPreDrawWindow && hasPlayerAnytimeActionsAvailable(state)) {
    state.phase = 'PRE_DRAW_WINDOW';
    addLog(
      state,
      'system',
      `Passagem de Turno: Janela «A Qualquer Momento» aberta antes da compra de cartas!`,
      'info'
    );
    return;
  }

  state.phase = 'MAIN_PHASE';

  if (state.turnInRound === 1) {
    state.turnInRound = 2;
    state.globalTurn += 1;
    state.activePlayer = getOpponentId(state.firstPlayerOfRound);
    addLog(
      state,
      'system',
      `--- Rodada ${state.round} • Turno 2 (${getPlayerState(state, state.activePlayer).name}) ---`,
      'info'
    );
    processStartOfTurn(state);
  } else {
    state.round += 1;
    state.turnInRound = 1;
    state.globalTurn += 1;
    state.activePlayer = state.firstPlayerOfRound;
    addLog(
      state,
      'system',
      `=== NOVA RODADA ${state.round} • Turno 1 (${getPlayerState(state, state.activePlayer).name}) ===`,
      'info'
    );
    processStartOfRound(state);
    if (!checkWinCondition(state)) {
      processStartOfTurn(state);
    }
  }
}

export function canPlayCardInMainPhase(
  state: DuelGameState,
  actorId: PlayerId,
  card: CardData
): { allowed: boolean; reason?: string } {
  const p = getPlayerState(state, actorId);
  const opp = getPlayerState(state, getOpponentId(actorId));
  const effCt = getEffectiveCt(p, card);

  if (card.type === 'Herói') {
    const heroCheck = canSummonHeroDirectly(state, actorId, card, false);
    return { allowed: heroCheck.allowed, reason: heroCheck.reason };
  }

  // Floquinho Caótica do Véu (2026/0001/00314) usa Vida de Jogador ao invés de Mana!
  if (card.code === '2026/0001/00314') {
    if (p.hp <= 1) {
      return {
        allowed: false,
        reason: '«Floquinho Caótica do Véu» exige gastar pelo menos 1 de Vida de Jogador para ser invocada.'
      };
    }
    if (!p.frontline.some((s) => s === null)) {
      return { allowed: false, reason: 'Todas as 6 colunas de Combatentes estão ocupadas.' };
    }
    return { allowed: true };
  }

  if (p.mana < effCt) {
    return { allowed: false, reason: `Mana insuficiente (${p.mana}/${effCt} CT).` };
  }

  if (card.type === 'Combatente') {
    if (card.code === '2026/0001/00313') {
      return {
        allowed: false,
        reason: '«O Horror do Véu» só pode ser invocado pelo efeito de «A Senhora do Véu».'
      };
    }
    const hasEmptyFront = p.frontline.some((s) => s === null);
    if (!hasEmptyFront) {
      return { allowed: false, reason: 'Todas as 6 colunas de Combatentes estão ocupadas.' };
    }
    return { allowed: true };
  }

  if (isContinuousBackrowCard(card)) {
    // Camadas podem ser empilhadas no mesmo espaço de qualquer outra Camada já em campo!
    if (isCamadaCard(card)) {
      const canStackOrPlace =
        p.backrow.some((s) => s === null) ||
        p.backrow.some((s) => s !== null && isCamadaCard(s.card));
      if (!canStackOrPlace) {
        return { allowed: false, reason: 'Suas 6 zonas de suporte atrás estão cheias.' };
      }
      return { allowed: true };
    }
    if (!p.backrow.some((s) => s === null)) {
      return { allowed: false, reason: 'Suas 6 zonas de suporte atrás estão cheias.' };
    }
    return { allowed: true };
  }

  if (card.type === 'Equipamento') {
    if (
      card.code === '2025/0001/00013' ||
      card.code === '2025/0001/00014' ||
      card.code === '2025/0001/00015'
    ) {
      const hasHeroOnField = p.frontline.some((f) => f !== null && f.isHero);
      if (!hasHeroOnField) {
        return { allowed: false, reason: 'As Gemas Macroversais só podem ser equipadas em Heróis em campo.' };
      }
    } else {
      const hasAnyFighter = p.frontline.some((f) => f !== null);
      if (!hasAnyFighter) {
        return { allowed: false, reason: 'Você precisa de um combatente em campo para equipar.' };
      }
    }
    return { allowed: true };
  }

  switch (card.code) {
    case '2025/0001/00018':
      if (!p.heroDiedThisTurn) {
        return { allowed: false, reason: 'Só pode ser ativada quando seu Herói for enviado às Zonas neste turno.' };
      }
      return { allowed: true };

    case '2025/0001/00019':
      if (state.round === 1) {
        return { allowed: false, reason: 'Não é permitido realizar ataques na 1ª Rodada.' };
      }
      if (!p.frontline.some((f) => f !== null)) {
        return { allowed: false, reason: 'Você precisa de pelo menos 1 combatente em campo.' };
      }
      return { allowed: true };

    case '2025/0001/00020':
      if (!p.frontline.some((f) => f !== null)) {
        return { allowed: false, reason: 'Você precisa de 1 combatente em campo para descartar.' };
      }
      return { allowed: true };

    case '2025/0001/00021': {
      const jimsOnField = p.frontline.filter((f) => f !== null && isJimCard(f.card)).length;
      const jimInHand = p.hand.some((c) => c.code !== card.code && isJimCard(c) && c.type === 'Combatente');
      if (jimsOnField < 2) {
        return { allowed: false, reason: 'Requer 2 ou mais «Jim» em seu campo.' };
      }
      if (!jimInHand) {
        return { allowed: false, reason: 'Requer um combatente «Jim» na sua mão.' };
      }
      if (!p.frontline.some((s) => s === null)) {
        return { allowed: false, reason: 'Campo cheio.' };
      }
      return { allowed: true };
    }

    case '2025/0001/00022':
    case '2025/0001/00026':
    case '2025/0001/00116': // Alteração de Realidade
      return { allowed: true };

    case '2025/0001/00023':
    case '2025/0001/00024':
    case '2025/0001/00028':
    case '2025/0001/00112': // Férias
    case '2026/0002/00317': // Coragem ao Contrário
      return { allowed: false, reason: 'Esta carta só pode ser usada como reação durante o combate.' };

    case '2025/0001/00025':
      if (!p.lostFighterInBattleThisTurn) {
        return { allowed: false, reason: 'Só pode ser usada após perder um combatente em batalha neste turno.' };
      }
      if (!opp.frontline.some((f) => f !== null)) {
        return { allowed: false, reason: 'Não há combatentes inimigos em campo.' };
      }
      return { allowed: true };

    case '2025/0001/00027': {
      const hasJimCandidate =
        p.hand.some((c) => isJimCard(c) && c.type === 'Combatente') ||
        p.deadZone.some((c) => isJimCard(c) && c.type === 'Combatente');
      if (!hasJimCandidate) {
        return { allowed: false, reason: 'Nenhum combatente «Jim» disponível na mão ou Zona Morta.' };
      }
      if (!p.frontline.some((s) => s === null)) {
        return { allowed: false, reason: 'Campo de combatentes cheio.' };
      }
      return { allowed: true };
    }

    case '2025/0001/00029':
    case '2026/0002/00322': // Como Planejado
      return { allowed: false, reason: `«${card.name}» é usada em reação para negar uma carta do oponente.` };

    case '2025/0001/00030':
      if (p.hp <= 8) {
        return { allowed: false, reason: 'Você precisa ter mais de 8 PV para pagar o custo de 8 de vida.' };
      }
      return { allowed: true };

    // CARTAS DO DECK INVASÃO DO CAOS (VÉU)
    case '2026/0002/00316': { // AQUI FOI...
      if (p.hp >= 20) {
        return { allowed: false, reason: '«AQUI FOI...» requer que você tenha perdido pelo menos 1 de Vida de Jogador (abaixo de 20 PV).' };
      }
      if (!opp.frontline.some((f) => f !== null)) {
        return { allowed: false, reason: 'Não há combatentes inimigos em campo.' };
      }
      return { allowed: true };
    }

    case '2026/0002/00318': { // O Papai Chegou
      const anyFighterOnField =
        p.frontline.some((f) => f !== null) || opp.frontline.some((f) => f !== null);
      if (!anyFighterOnField) {
        return { allowed: false, reason: 'Requer pelo menos 1 combatente em campo.' };
      }
      return { allowed: true };
    }

    case '2026/0002/00319': { // Ritos do Festival
      const hasDeckFighter = p.deck.some((c) => c.type === 'Combatente' && !isTreatedAsHeroCard(p, c));
      if (!hasDeckFighter) {
        return { allowed: false, reason: 'Não há combatentes (não-Herói) disponíveis no seu Deck.' };
      }
      return { allowed: true };
    }

    case '2026/0002/00320': { // Ato Final
      const hasHeroAvailable =
        p.frontline.some((f) => f !== null && f.isHero) ||
        p.heroDeck.length > 0 ||
        p.hand.some((c) => c.type === 'Herói' || isTreatedAsHeroCard(p, c)) ||
        p.deck.some((c) => c.type === 'Herói' || isTreatedAsHeroCard(p, c));
      if (!hasHeroAvailable) {
        return { allowed: false, reason: 'Você precisa de um Herói disponível (em campo, Deck de Herói, Mão ou Deck) para enviar às Zonas.' };
      }
      return { allowed: true };
    }

    // CARTAS DE INVOCAÇÃO DE HERÓI DOS OUTROS DECKS ESTRUTURAIS
    case '2025/0001/00079': { // Mensagem Final -> Invoca Spear Vellret (2025/0001/00061)
      const hasKiaraAnywhere =
        p.deadZone.some((c) => c.name.includes('Kiara')) ||
        p.erasedZone.some((c) => c.name.includes('Kiara')) ||
        p.frontline.some((f) => f !== null && f.card.name.includes('Kiara')) ||
        p.hand.some((c) => c.name.includes('Kiara'));
      if (!hasKiaraAnywhere) {
        return { allowed: false, reason: 'Requer «Kiara» em suas Zonas, campo ou mão para invocar «Spear Vellret».' };
      }
      return { allowed: true };
    }

    case '2025/0001/00108': { // Sacrificio Maior -> Invoca Equilíbrio Imperfeito Mahina (2025/0001/00092)
      const hasViorieOrKarn =
        p.deadZone.some((c) => c.name.includes('Viorie') || c.name.includes('Karn')) ||
        p.erasedZone.some((c) => c.name.includes('Viorie') || c.name.includes('Karn')) ||
        p.frontline.some((f) => f !== null && (f.card.name.includes('Viorie') || f.card.name.includes('Karn')));
      if (!hasViorieOrKarn) {
        return { allowed: false, reason: 'Requer «Viorie» ou «Karn» em suas Zonas ou campo para invocar «Equilíbrio Imperfeito Mahina».' };
      }
      return { allowed: true };
    }

    case '2025/0001/00202': { // Pelo Bem Maior -> Descarte 3 combatentes do seu lado do campo e invoque um Herói
      const fightersOnField = p.frontline.filter((f) => f !== null).length;
      if (fightersOnField < 3) {
        return {
          allowed: false,
          reason: `Requer descartar 3 combatentes do seu lado do campo (atual: ${fightersOnField}/3).`
        };
      }
      return { allowed: true };
    }

    case '2025/0001/00228': // Desespero
      return { allowed: false, reason: '«Desespero» ativa automaticamente da sua mão quando sua vida chega a 0.' };

    case '2025/0001/00292': { // Luto Eterno -> Invoca Selena - Mãe dos Guerreiros (2025/0001/00213)
      const fightersInZones =
        p.deadZone.filter((c) => c.type === 'Combatente' || c.type === 'Herói').length +
        p.erasedZone.filter((c) => c.type === 'Combatente' || c.type === 'Herói').length;
      if (fightersInZones < 5) {
        return { allowed: false, reason: `Requer ao menos 5 combatentes nas suas Zonas (atual: ${fightersInZones}/5).` };
      }
      return { allowed: true };
    }

    default:
      return { allowed: true };
  }
}

function pullHeroByCodeOrPredicate(
  p: PlayerDuelState,
  predicate: (c: CardData) => boolean
): CardData | null {
  const hIdx = p.heroDeck.findIndex(predicate);
  if (hIdx !== -1) return p.heroDeck.splice(hIdx, 1)[0];
  const dIdx = p.deck.findIndex(predicate);
  if (dIdx !== -1) return p.deck.splice(dIdx, 1)[0];
  const zIdx = p.deadZone.findIndex(predicate);
  if (zIdx !== -1) return p.deadZone.splice(zIdx, 1)[0];
  const eIdx = p.erasedZone.findIndex(predicate);
  if (eIdx !== -1) return p.erasedZone.splice(eIdx, 1)[0];
  const handIdx = p.hand.findIndex(predicate);
  if (handIdx !== -1) return p.hand.splice(handIdx, 1)[0];
  return null;
}

export function resolveInsanisCardEffect(
  state: DuelGameState,
  actorId: PlayerId,
  card: CardData,
  targetSlot = 0,
  chosenArchetypes?: string[]
) {
  const p = getPlayerState(state, actorId);
  const oppId = getOpponentId(actorId);
  const opp = getPlayerState(state, oppId);

  if (state.activePlayer === actorId && p.hasAttackedInCurrentTurn) {
    p.lockedFromAttackingThisTurn = true;
  }

  // Selena - Conceito da Criação (2025/0001/00212):
  // "Sempre que você usar uma carta com 12 de CT base, aumente o Ataque e Vida de todos os seus combatentes em +5 permanentemente."
  if (
    card.ct === 12 &&
    p.frontline.some((f) => f !== null && f.card.code === '2025/0001/00212')
  ) {
    for (const ally of p.frontline) {
      if (ally) {
        ally.permAtkBonus += 5;
        ally.permHpBonus += 5;
        ally.currentHp += 5;
        ally.maxHp += 5;
      }
    }
    addLog(
      state,
      actorId,
      `🌙 «Selena - Conceito da Criação»: Todos os combatentes de ${p.name} receberam +5/+5 pelo uso de uma carta de CT 12!`,
      'life_gain'
    );
  }

  // Vellret - Escolhido de Salazar (2025/0001/00062):
  // "Sempre que uma carta com «Manga» no nome for usada, cause 3 de dano na vida do jogador inimigo."
  if (
    card.name.includes('Manga') &&
    p.frontline.some((f) => f !== null && f.card.code === '2025/0001/00062')
  ) {
    dealDamageToPlayer(state, oppId, actorId, 3, '«Vellret - Escolhido de Salazar» (Uso de Manga)');
  }

  // Equilíbrio Imperfeito Mahina (2025/0001/00092):
  // "Sempre que uma carta com «Cristal» ou «Gema» no nome for usada, ganha +5 de Ataque e +5 de Vida."
  if (card.name.includes('Cristal') || card.name.includes('Gema')) {
    for (const ally of p.frontline) {
      if (ally && ally.card.code === '2025/0001/00092') {
        ally.permAtkBonus += 5;
        ally.permHpBonus += 5;
        ally.currentHp += 5;
        ally.maxHp += 5;
        addLog(
          state,
          actorId,
          `👑 «Equilíbrio Imperfeito Mahina» recebeu +5/+5 pelo uso de «${card.name}»!`,
          'life_gain'
        );
      }
    }
  }

  if (card.type === 'Combatente' || card.type === 'Herói') {
    if (card.code === '2026/0001/00314') {
      const hpToSpend = Math.max(1, Math.min(5, Math.floor((p.hp - 1) / 2)));
      summonFloquinhoCaoticaWithHp(state, actorId, card, targetSlot, hpToSpend);
      return;
    }
    summonFighterToSlot(state, actorId, card, targetSlot);
    return;
  }

  // Equipamentos de Jogador (Camadas do Véu, Conceito Fogo 1/2/3, Base ARC) e Suportes Contínuos
  if (isContinuousBackrowCard(card)) {
    const placed = equipSupportOrCamadaToBackrow(state, actorId, card, targetSlot);
    if (!placed) {
      discardCardDirectlyToZone(state, actorId, card, false);
      return;
    }

    if (card.code === '2026/0002/00315') {
      const camadaCandidates = getCamadaCandidatesForPlayer(p);
      if (camadaCandidates.length > 0) {
        if (actorId === 'player') {
          state.pendingChoiceQueue.push({
            title: '«Apoteose do Véu» — Escolha qual «Camada» colocar em campo',
            description: 'Selecione qual carta com «Camada» no nome (do seu Deck, Mão ou Zonas) deseja colocar em campo:',
            candidates: camadaCandidates,
            minSelect: 1,
            maxSelect: 1,
            effectKind: 'APOTEOSE_CAMADA'
          });
        } else {
          const equipped = pullAndEquipCamadaFromAnywhere(state, actorId);
          if (equipped) {
            addLog(
              state,
              actorId,
              `✨ «Apoteose do Véu»: Colocou «${equipped.name}» em campo ao ser ativada!`,
              'effect'
            );
          }
        }
      }
    }

    // Coroa Lúmeni (2025/0001/00110): Invoca Mahina - O Herdeiro de Lúmeni se disponível!
    if (card.code === '2025/0001/00110') {
      const mahinaHero = pullHeroByCodeOrPredicate(p, (c) => c.code === '2025/0001/00091');
      const freeSlot = p.frontline.findIndex((s) => s === null);
      if (mahinaHero && freeSlot !== -1) {
        addLog(
          state,
          actorId,
          `👑 «Coroa Lúmeni»: Invocou o Herói «${mahinaHero.name}» em campo!`,
          'summon'
        );
        summonFighterToSlot(state, actorId, mahinaHero, freeSlot);
      }
    }

    const totalCamadasInField = countCamadasOnField(p) + countCamadasOnField(opp);

    if (hasActiveCamada(p, '2026/0002/00330') && totalCamadasInField >= 7) {
      let discardedCamadas = 0;
      const discardCamadasFromBackrow = (owner: PlayerDuelState) => {
        for (let idx = 0; idx < 6; idx++) {
          const sup = owner.backrow[idx];
          if (!sup || discardedCamadas >= 7) continue;
          const remaining: CardData[] = [];
          const allCards = getAllSupportCardsInSlot(sup);
          for (const c of allCards) {
            if (isCamadaCard(c) && discardedCamadas < 7) {
              owner.erasedZone.push(c);
              discardedCamadas++;
            } else {
              remaining.push(c);
            }
          }
          if (remaining.length === 0) {
            owner.backrow[idx] = null;
          } else {
            sup.card = remaining[remaining.length - 1];
            sup.stackedCards = remaining.slice(0, -1);
          }
        }
      };

      discardCamadasFromBackrow(p);
      discardCamadasFromBackrow(opp);

      let sentEnemyCards = 0;
      for (let slot = 0; slot < 6; slot++) {
        if (opp.frontline[slot]) {
          sendFighterFromFieldToZone(state, oppId, slot, false, false, true);
          sentEnemyCards++;
        }
        if (opp.backrow[slot]) {
          const allCards = getAllSupportCardsInSlot(opp.backrow[slot]);
          for (const sc of allCards) {
            opp.deadZone.push(sc);
            sentEnemyCards++;
          }
          opp.backrow[slot] = null;
        }
      }
      while (opp.hand.length > 0) {
        opp.deadZone.push(opp.hand.pop()!);
        sentEnemyCards++;
      }

      addLog(
        state,
        actorId,
        `🌌 «Sétima Camada» ATIVADA! 7 Camadas foram enviadas à Zona Apagada e todas as ${sentEnemyCards} cartas do campo e mão de ${opp.name} foram enviadas à Zona Morta sem ativar efeitos!`,
        'effect'
      );

      if (countVeuFightersOnField(state, p) >= 3 && sentEnemyCards > 0) {
        const burnDmg = sentEnemyCards * 3;
        dealDamageToPlayer(state, oppId, actorId, burnDmg, '«Sétima Camada» (3+ combatentes Véu)');
      }
    }
    return;
  }

  if (card.type === 'Equipamento') {
    const fighter = p.frontline[targetSlot] || p.frontline.find((f) => f !== null);
    if (!fighter) {
      p.deadZone.push(card);
      return;
    }

    const grantedArchs =
      card.code === '2025/0001/00013'
        ? chosenArchetypes && chosenArchetypes.length === 3
          ? chosenArchetypes
          : ['Caos', 'Lúmen', 'Darkus']
        : undefined;

    fighter.equipments.push({
      instanceId: nextUid('eq'),
      card,
      grantedArchetypes: grantedArchs
    });

    const hpMatch = (card.description || '').match(/\+(\d+)\s*de\s*(?:Vida|Defesa)/i);
    if (hpMatch) {
      const bonusHp = parseInt(hpMatch[1], 10);
      fighter.permHpBonus += bonusHp;
      fighter.currentHp += bonusHp;
      fighter.maxHp += bonusHp;
    }

    addLog(
      state,
      actorId,
      `${p.name} equipou «${card.name}» em «${fighter.card.name}» (Coluna ${fighter.slotIndex + 1})${
        grantedArchs ? ` concedendo [${grantedArchs.join(', ')}]` : ''
      }.`,
      'effect'
    );
    return;
  }

  switch (card.code) {
    // =====================================================================
    // CARTAS OFICIAIS DE INVOCAÇÃO DE HERÓIS DOS DECKS ESTRUTURAIS
    // =====================================================================
    case '2025/0001/00079': { // Mensagem Final -> Invoca Spear Vellret (2025/0001/00061)
      p.deadZone.push(card);
      const kiaraInZones =
        p.deadZone.some((c) => c.name.includes('Kiara')) ||
        p.erasedZone.some((c) => c.name.includes('Kiara'));
      if (!kiaraInZones) {
        const kiaraFieldSlot = p.frontline.findIndex((f) => f !== null && f.card.name.includes('Kiara'));
        if (kiaraFieldSlot !== -1) {
          sendFighterFromFieldToZone(state, actorId, kiaraFieldSlot, false, false);
        } else {
          const kiaraHandIdx = p.hand.findIndex((c) => c.name.includes('Kiara'));
          if (kiaraHandIdx !== -1) p.deadZone.push(p.hand.splice(kiaraHandIdx, 1)[0]);
        }
      }
      const hero = pullHeroByCodeOrPredicate(p, (c) => c.code === '2025/0001/00061');
      const freeSlot = p.frontline.findIndex((s) => s === null);
      if (hero && freeSlot !== -1) {
        summonFighterToSlot(state, actorId, hero, freeSlot);
      }
      break;
    }

    case '2025/0001/00082': { // Destruidor de Realidades -> Invoca Vellret - Escolhido de Salazar (2025/0001/00062)
      p.deadZone.push(card);
      const hero = pullHeroByCodeOrPredicate(p, (c) => c.code === '2025/0001/00062');
      const freeSlot = p.frontline.findIndex((s) => s === null);
      if (hero && freeSlot !== -1) {
        summonFighterToSlot(state, actorId, hero, freeSlot);
      }
      break;
    }

    case '2025/0001/00083': { // Pela Família -> Invoca Vellret - Condenado do Jim (2025/0001/00063)
      p.deadZone.push(card);
      const hero = pullHeroByCodeOrPredicate(p, (c) => c.code === '2025/0001/00063');
      const freeSlot = p.frontline.findIndex((s) => s === null);
      if (hero && freeSlot !== -1) {
        summonFighterToSlot(state, actorId, hero, freeSlot);
      }
      break;
    }

    case '2025/0001/00108': { // Sacrificio Maior -> Invoca Equilíbrio Imperfeito Mahina (2025/0001/00092)
      p.deadZone.push(card);
      const hero = pullHeroByCodeOrPredicate(p, (c) => c.code === '2025/0001/00092');
      const freeSlot = p.frontline.findIndex((s) => s === null);
      if (hero && freeSlot !== -1) {
        summonFighterToSlot(state, actorId, hero, freeSlot);
      }
      break;
    }

    case '2025/0001/00109': { // Mestre Manipulador -> Invoca Estrategista Mahina (2025/0001/00093)
      p.deadZone.push(card);
      const hero = pullHeroByCodeOrPredicate(p, (c) => c.code === '2025/0001/00093');
      const freeSlot = p.frontline.findIndex((s) => s === null);
      if (hero && freeSlot !== -1) {
        summonFighterToSlot(state, actorId, hero, freeSlot);
      }
      break;
    }

    case '2025/0001/00142': { // Mundo em Chamas -> Invoca um Herói com «Donnie» em seu nome
      p.deadZone.push(card);
      const hero = pullHeroByCodeOrPredicate(p, (c) => c.type === 'Herói' && c.name.includes('Donnie'));
      const freeSlot = p.frontline.findIndex((s) => s === null);
      if (hero && freeSlot !== -1) {
        summonFighterToSlot(state, actorId, hero, freeSlot);
      }
      break;
    }

    case '2025/0001/00176': { // Ritos da Corrupção -> Descarta 5 do topo do Deck para a Zona Apagada e invoca Otto (2025/0001/00151)
      p.deadZone.push(card);
      const milled = p.deck.splice(0, Math.min(5, p.deck.length));
      p.erasedZone.push(...milled);
      addLog(
        state,
        actorId,
        `💀 «Ritos da Corrupção»: Enviou ${milled.length} cartas do topo do Deck para a Zona Apagada!`,
        'effect'
      );
      const hero = pullHeroByCodeOrPredicate(p, (c) => c.code === '2025/0001/00151');
      const freeSlot = p.frontline.findIndex((s) => s === null);
      if (hero && freeSlot !== -1) {
        summonFighterToSlot(state, actorId, hero, freeSlot);
      }
      break;
    }

    case '2025/0001/00197': { // Invocação do Escolhido -> Invoca Salazar Guia (00181) ou Poderoso Líder (00182)
      p.deadZone.push(card);
      const hero = pullHeroByCodeOrPredicate(
        p,
        (c) => c.code === '2025/0001/00181' || c.code === '2025/0001/00182'
      );
      const freeSlot = p.frontline.findIndex((s) => s === null);
      if (hero && freeSlot !== -1) {
        summonFighterToSlot(state, actorId, hero, freeSlot);
      }
      break;
    }

    case '2025/0001/00202': { // Pelo Bem Maior -> Descarta até 3 combatentes do campo e invoca um Salazar
      p.deadZone.push(card);
      let discarded = 0;
      for (let i = 0; i < 6 && discarded < 3; i++) {
        if (p.frontline[i] && !p.frontline[i]!.isHero) {
          sendFighterFromFieldToZone(state, actorId, i, false, false);
          discarded++;
        }
      }
      const hero = pullHeroByCodeOrPredicate(p, (c) => c.type === 'Herói' && c.name.includes('Salazar'));
      const freeSlot = p.frontline.findIndex((s) => s === null);
      if (hero && freeSlot !== -1) {
        summonFighterToSlot(state, actorId, hero, freeSlot);
      }
      break;
    }

    case '2025/0001/00205': { // Não Existe Paz Verdadeira -> Invoca Salazar - O Falho (2025/0001/00184)
      p.deadZone.push(card);
      const hero = pullHeroByCodeOrPredicate(p, (c) => c.code === '2025/0001/00184');
      const freeSlot = p.frontline.findIndex((s) => s === null);
      if (hero && freeSlot !== -1) {
        summonFighterToSlot(state, actorId, hero, freeSlot);
      }
      break;
    }

    case '2025/0001/00292': { // Luto Eterno -> Invoca Selena - Mãe dos Guerreiros (2025/0001/00213)
      p.deadZone.push(card);
      const hero = pullHeroByCodeOrPredicate(p, (c) => c.code === '2025/0001/00213');
      const freeSlot = p.frontline.findIndex((s) => s === null);
      if (hero && freeSlot !== -1) {
        summonFighterToSlot(state, actorId, hero, freeSlot);
      }
      break;
    }

    case '2025/0001/00018': { // Lamento do Rei
      p.deadZone.push(card);
      if (actorId === 'player') {
        const candidates: ChoiceCandidate[] = [
          ...p.deadZone
            .map((c, idx) => ({ c, idx }))
            .filter((item) => isJimCard(item.c) && item.c.type === 'Combatente')
            .map((item) => ({
              id: `lamento_dead_${item.idx}`,
              card: item.c,
              sourceZone: 'deadZone' as const,
              sourceIndex: item.idx,
              subtitle: 'Zona Morta'
            })),
          ...p.erasedZone
            .map((c, idx) => ({ c, idx }))
            .filter((item) => isJimCard(item.c) && item.c.type === 'Combatente')
            .map((item) => ({
              id: `lamento_erased_${item.idx}`,
              card: item.c,
              sourceZone: 'erasedZone' as const,
              sourceIndex: item.idx,
              subtitle: 'Zona Apagada'
            }))
        ];
        const emptySlotsCount = p.frontline.filter((s) => s === null).length;
        if (candidates.length > 0 && emptySlotsCount > 0) {
          state.pendingChoiceQueue.push({
            title: '«Lamento do Rei» — Escolha até ' + Math.min(6, emptySlotsCount) + ' «Jim»',
            description: 'Selecione quais variantes de «Jim» das suas Zonas deseja invocar para o campo:',
            candidates,
            minSelect: 1,
            maxSelect: Math.min(6, emptySlotsCount, candidates.length),
            effectKind: 'LAMENTO_DO_REI'
          });
        }
      } else {
        const candidates = [
          ...p.deadZone.filter((c) => isJimCard(c) && c.type === 'Combatente'),
          ...p.erasedZone.filter((c) => isJimCard(c) && c.type === 'Combatente')
        ];
        for (let slot = 0; slot < 6; slot++) {
          if (p.frontline[slot] === null && candidates.length > 0) {
            const nextJim = candidates.shift()!;
            const deadIdx = p.deadZone.indexOf(nextJim);
            if (deadIdx !== -1) p.deadZone.splice(deadIdx, 1);
            else {
              const erasedIdx = p.erasedZone.indexOf(nextJim);
              if (erasedIdx !== -1) p.erasedZone.splice(erasedIdx, 1);
            }
            summonFighterToSlot(state, actorId, nextJim, slot);
          }
        }
      }
      break;
    }

    case '2025/0001/00019': { // Insanidade
      const fighter = p.frontline[targetSlot] || p.frontline.find((f) => f !== null);
      if (fighter) {
        const dmg = getFighterEffectiveAtk(state, fighter, true);
        addLog(
          state,
          actorId,
          `⚔️ «Insanidade»: «${fighter.card.name}» atacou diretamente ${opp.name} causando ${dmg} de dano e foi enviado para a Zona Apagada!`,
          'attack'
        );
        dealDamageToPlayer(state, oppId, actorId, dmg, `Ataque Direto via «Insanidade»`);
        sendFighterFromFieldToZone(state, actorId, fighter.slotIndex, true, false);
      }
      p.deadZone.push(card);
      break;
    }

    case '2025/0001/00020': { // Fragmentar
      p.deadZone.push(card);
      const sacrifice = p.frontline[targetSlot] || p.frontline.find((f) => f !== null);
      if (sacrifice) {
        const maxCtBudget = sacrifice.card.ct;
        sendFighterFromFieldToZone(state, actorId, sacrifice.slotIndex, true, false);

        if (actorId === 'player') {
          const candidates: ChoiceCandidate[] = [
            ...p.hand
              .map((c, idx) => ({ c, idx }))
              .filter((item) => item.c.type === 'Combatente' && item.c.ct <= maxCtBudget)
              .map((item) => ({
                id: `frag_hand_${item.idx}`,
                card: item.c,
                sourceZone: 'hand' as const,
                sourceIndex: item.idx,
                subtitle: `Mão • CT ${item.c.ct}`
              })),
            ...p.deadZone
              .map((c, idx) => ({ c, idx }))
              .filter((item) => item.c.type === 'Combatente' && item.c.ct <= maxCtBudget)
              .map((item) => ({
                id: `frag_dead_${item.idx}`,
                card: item.c,
                sourceZone: 'deadZone' as const,
                sourceIndex: item.idx,
                subtitle: `Zona Morta • CT ${item.c.ct}`
              }))
          ];
          const emptyCount = p.frontline.filter((s) => s === null).length;
          if (candidates.length > 0 && emptyCount > 0) {
            state.pendingChoiceQueue.push({
              title: `«Fragmentar» (Orçamento máximo: CT ${maxCtBudget})`,
              description: `Escolha combatentes da sua Mão ou Zona Morta cuja soma de CT seja ≤ ${maxCtBudget}:`,
              candidates,
              minSelect: 1,
              maxSelect: emptyCount,
              maxTotalCt: maxCtBudget,
              effectKind: 'FRAGMENTAR'
            });
          }
        } else {
          let remainingBudget = maxCtBudget;
          const pool = [
            ...p.deadZone
              .filter((c) => c.type === 'Combatente' && c.ct <= remainingBudget)
              .map((c) => ({ card: c, from: 'dead' as const })),
            ...p.hand
              .filter((c) => c.type === 'Combatente' && c.ct <= remainingBudget)
              .map((c) => ({ card: c, from: 'hand' as const }))
          ].sort((a, b) => b.card.ct - a.card.ct);

          for (const item of pool) {
            const freeSlot = p.frontline.findIndex((s) => s === null);
            if (freeSlot === -1) break;
            if (item.card.ct <= remainingBudget) {
              remainingBudget -= item.card.ct;
              if (item.from === 'dead') {
                const idx = p.deadZone.indexOf(item.card);
                if (idx !== -1) p.deadZone.splice(idx, 1);
              } else {
                const idx = p.hand.indexOf(item.card);
                if (idx !== -1) p.hand.splice(idx, 1);
              }
              summonFighterToSlot(state, actorId, item.card, freeSlot);
            }
          }
        }
      }
      break;
    }

    case '2025/0001/00021': { // Portal dos Variantes
      p.deadZone.push(card);
      const freeSlot =
        p.frontline[targetSlot] === null ? targetSlot : p.frontline.findIndex((s) => s === null);
      if (freeSlot !== -1) {
        if (actorId === 'player') {
          const candidates: ChoiceCandidate[] = p.hand
            .map((c, idx) => ({ c, idx }))
            .filter((item) => isJimCard(item.c) && item.c.type === 'Combatente')
            .map((item) => ({
              id: `portal_hand_${item.idx}`,
              card: item.c,
              sourceZone: 'hand',
              sourceIndex: item.idx,
              subtitle: 'Na sua Mão'
            }));
          if (candidates.length > 0) {
            state.pendingChoiceQueue.push({
              title: '«Portal dos Variantes»',
              description: `Escolha qual combatente «Jim» da sua mão deseja invocar na Coluna ${freeSlot + 1}:`,
              candidates,
              minSelect: 1,
              maxSelect: 1,
              targetSlotForChosenCard: freeSlot,
              effectKind: 'PORTAL_VARIANTES'
            });
          }
        } else {
          const jimIdx = p.hand.findIndex((c) => isJimCard(c) && c.type === 'Combatente');
          if (jimIdx !== -1) {
            const [jimCard] = p.hand.splice(jimIdx, 1);
            summonFighterToSlot(state, actorId, jimCard, freeSlot);
          }
        }
      }
      break;
    }

    case '2025/0001/00022': { // Pacto Forçado
      p.ctReductionThisRound += 3;
      p.pendingPactoLifeLossNextRound += 5;
      p.deadZone.push(card);
      addLog(
        state,
        actorId,
        `«Pacto Forçado»: Todas as cartas de ${p.name} têm -3 de CT nesta rodada! Na próxima rodada, perderá 5 PV.`,
        'effect'
      );
      break;
    }

    case '2025/0001/00025': { // Vingança Satisfatória
      const enemyTarget =
        opp.frontline[targetSlot] || opp.frontline.find((f) => f !== null);
      if (enemyTarget) {
        applyEffectDamageToFighter(
          state,
          actorId,
          oppId,
          enemyTarget.slotIndex,
          5,
          card,
          getCardAuthorityCt(p, card)
        );
      }
      p.deadZone.push(card);
      break;
    }

    case '2025/0001/00026': { // Manipulação das Realidades
      opp.skipDrawsUntilGlobalTurn = state.globalTurn + 2;
      p.deadZone.push(card);
      addLog(
        state,
        actorId,
        `«Manipulação das Realidades»: ${opp.name} está impedido de comprar cartas até o fim do seu próximo turno!`,
        'effect'
      );
      break;
    }

    case '2025/0001/00027': { // Chamado da Variante
      p.deadZone.push(card);
      const freeSlot =
        p.frontline[targetSlot] === null ? targetSlot : p.frontline.findIndex((s) => s === null);
      if (freeSlot !== -1) {
        if (actorId === 'player') {
          const candidates: ChoiceCandidate[] = [
            ...p.hand
              .map((c, idx) => ({ c, idx }))
              .filter((item) => isJimCard(item.c) && item.c.type === 'Combatente')
              .map((item) => ({
                id: `chamado_hand_${item.idx}`,
                card: item.c,
                sourceZone: 'hand' as const,
                sourceIndex: item.idx,
                subtitle: 'Na sua Mão'
              })),
            ...p.deadZone
              .map((c, idx) => ({ c, idx }))
              .filter((item) => isJimCard(item.c) && item.c.type === 'Combatente')
              .map((item) => ({
                id: `chamado_dead_${item.idx}`,
                card: item.c,
                sourceZone: 'deadZone' as const,
                sourceIndex: item.idx,
                subtitle: 'Na Zona Morta'
              }))
          ];
          if (candidates.length > 0) {
            state.pendingChoiceQueue.push({
              title: '«Chamado da Variante»',
              description: `Escolha 1 combatente «Jim» da sua Mão ou Zona Morta para invocar na Coluna ${freeSlot + 1}:`,
              candidates,
              minSelect: 1,
              maxSelect: 1,
              targetSlotForChosenCard: freeSlot,
              effectKind: 'CHAMADO_VARIANTE'
            });
          }
        } else {
          const deadJimIdx = p.deadZone.findIndex((c) => isJimCard(c) && c.type === 'Combatente');
          if (deadJimIdx !== -1) {
            const [jimCard] = p.deadZone.splice(deadJimIdx, 1);
            summonFighterToSlot(state, actorId, jimCard, freeSlot);
          } else {
            const handJimIdx = p.hand.findIndex((c) => isJimCard(c) && c.type === 'Combatente');
            if (handJimIdx !== -1) {
              const [jimCard] = p.hand.splice(handJimIdx, 1);
              summonFighterToSlot(state, actorId, jimCard, freeSlot);
            }
          }
        }
      }
      break;
    }

    case '2025/0001/00030': { // Destruição das Variantes
      p.hp = Math.max(0, p.hp - 8);
      discardCardDirectlyToZone(state, actorId, card, false);
      addLog(
        state,
        actorId,
        `💔 «Destruição das Variantes»: ${p.name} pagou 8 PV (Vida restante: ${p.hp} PV)!`,
        'life_loss'
      );
      if (checkWinCondition(state)) break;

      if (actorId === 'player') {
        const deckJims: ChoiceCandidate[] = p.deck
          .map((c, idx) => ({ c, idx }))
          .filter((item) => isJimCard(item.c) && item.c.type === 'Combatente')
          .map((item) => ({
            id: `destr_deck_${item.idx}`,
            card: item.c,
            sourceZone: 'deck',
            sourceIndex: item.idx,
            subtitle: `Deck • ATK ${item.c.attack} / HP ${item.c.defense}`
          }));
        if (deckJims.length > 0) {
          state.pendingChoiceQueue.push({
            title: '«Destruição das Variantes» — Escolha até 4 «Jim» do Deck',
            description:
              'Selecione até 4 combatentes «Jim» do seu Deck para enviar diretamente para a sua Zona Apagada:',
            candidates: deckJims,
            minSelect: 1,
            maxSelect: Math.min(4, deckJims.length),
            effectKind: 'DESTRUICAO_VARIANTES'
          });
        }
      } else {
        const sentNames: string[] = [];
        for (let i = 0; i < 4; i++) {
          const idx = p.deck.findIndex((c) => isJimCard(c) && c.type === 'Combatente');
          if (idx !== -1) {
            const [jim] = p.deck.splice(idx, 1);
            p.erasedZone.push(jim);
            sentNames.push(jim.name);
          }
        }
        addLog(
          state,
          actorId,
          `«Destruição das Variantes»: Bot enviou ${sentNames.length} «Jim» do Deck para a Zona Apagada (${sentNames.join(', ')})!`,
          'effect'
        );
      }
      break;
    }

    // =====================================================================
    // ALTERAÇÃO DE REALIDADE (2025/0001/00116)
    // "Todas as suas cartas (usadas ou não) têm -3 de CT pelo resto da partida."
    // =====================================================================
    case '2025/0001/00116': {
      p.permCtReduction = (p.permCtReduction || 0) + 3;
      discardCardDirectlyToZone(state, actorId, card, false);
      addLog(
        state,
        actorId,
        `🌀 «Alteração de Realidade»: Todas as cartas de ${p.name} (usadas ou não) têm -3 de CT permanente pelo resto da partida (Redução permanente total: -${p.permCtReduction} CT)!`,
        'effect'
      );
      break;
    }

    // =====================================================================
    // CARTAS DE EFEITO DO DECK INVASÃO DO CAOS (VÉU)
    // =====================================================================
    case '2026/0002/00316': { // AQUI FOI...
      // "Cause 3 de dano para cada 1 de vida de jogador perdida a todos os combatentes inimigos em campo.
      //  Caso «Floquinho Caótica» esteja em seu lado do campo, ganhe 3 Runas para cada combatente enviado às Zonas por este efeito."
      discardCardDirectlyToZone(state, actorId, card, false);
      const hpLost = Math.max(0, 20 - p.hp);
      const dmgPerEnemy = hpLost * 3;
      if (dmgPerEnemy > 0) {
        addLog(
          state,
          actorId,
          `💥 «AQUI FOI...»: ${p.name} perdeu ${hpLost} de Vida (20 -> ${p.hp} PV) e causará ${dmgPerEnemy} de dano (${hpLost} x 3) a TODOS os combatentes de ${opp.name}!`,
          'effect'
        );
        const killedCount = applyAoEEffectDamageToEnemyFighters(
          state,
          actorId,
          oppId,
          dmgPerEnemy,
          card,
          getCardAuthorityCt(p, card)
        );
        const hasFloquinhoCaoticaOnField = p.frontline.some(
          (f) => f !== null && f.card.name.includes('Floquinho Caótica')
        );
        if (hasFloquinhoCaoticaOnField && killedCount > 0) {
          const gainedRunes = killedCount * 3;
          p.runes += gainedRunes;
          addLog(
            state,
            actorId,
            `🔮 «AQUI FOI...» + «Floquinho Caótica»: ${p.name} ganhou +${gainedRunes} Runas por enviar ${killedCount} combatente(s) inimigo(s) às Zonas (Total: ${p.runes} Runas)!`,
            'effect'
          );
        }
      }
      break;
    }

    case '2026/0002/00318': { // O Papai Chegou
      // "O jogador com o combatente de maior custo em campo compra 5 cartas.
      //  O jogador com o combatente de menor custo em campo retorna 1 combatente de qualquer Zona para o campo.
      //  Em caso de empate em qualquer um dos efeitos, nenhum efeito acontece."
      discardCardDirectlyToZone(state, actorId, card, false);

      const getFighterCost = (owner: PlayerDuelState, f: FieldFighter) =>
        Math.max(0, (f.card.ct || 0) + (f.summonHpSpentBonusCt || 0) - (owner.permCtReduction || 0));

      const playerCosts = state.player.frontline
        .filter((f): f is FieldFighter => f !== null)
        .map((f) => getFighterCost(state.player, f));
      const botCosts = state.bot.frontline
        .filter((f): f is FieldFighter => f !== null)
        .map((f) => getFighterCost(state.bot, f));

      const pMax = playerCosts.length > 0 ? Math.max(...playerCosts) : -1;
      const bMax = botCosts.length > 0 ? Math.max(...botCosts) : -1;

      if (pMax === bMax) {
        addLog(
          state,
          actorId,
          `⚖️ «O Papai Chegou» (Maior Custo): Empate no maior custo em campo (${pMax === -1 ? 'nenhum' : pMax + ' CT'}) — ninguém compra 5 cartas.`,
          'info'
        );
      } else {
        const highWinnerId: PlayerId = pMax > bMax ? 'player' : 'bot';
        const highWinner = getPlayerState(state, highWinnerId);
        let drawn = 0;
        for (let i = 0; i < 5; i++) {
          if (highWinner.deck.length > 0) {
            highWinner.hand.push(highWinner.deck.shift()!);
            drawn++;
          }
        }
        addLog(
          state,
          highWinnerId,
          `🃏 «O Papai Chegou» (Maior Custo: ${Math.max(pMax, bMax)} CT): ${highWinner.name} comprou ${drawn} carta(s)!`,
          'effect'
        );
      }

      const pMin = playerCosts.length > 0 ? Math.min(...playerCosts) : 999;
      const bMin = botCosts.length > 0 ? Math.min(...botCosts) : 999;

      if (pMin === bMin) {
        addLog(
          state,
          actorId,
          `⚖️ «O Papai Chegou» (Menor Custo): Empate no menor custo em campo (${pMin === 999 ? 'nenhum' : pMin + ' CT'}) — ninguém retorna combatente das Zonas.`,
          'info'
        );
      } else {
        const lowWinnerId: PlayerId = pMin < bMin ? 'player' : 'bot';
        const lowWinner = getPlayerState(state, lowWinnerId);
        const freeSlot = lowWinner.frontline.findIndex((s) => s === null);
        if (freeSlot !== -1) {
          if (lowWinnerId === 'player') {
            const zoneCandidates: ChoiceCandidate[] = [
              ...lowWinner.deadZone
                .map((c, idx) => ({ c, idx }))
                .filter((item) => item.c.type === 'Combatente')
                .map((item) => ({
                  id: `papai_dead_${item.idx}`,
                  card: item.c,
                  sourceZone: 'deadZone' as const,
                  sourceIndex: item.idx,
                  subtitle: `Zona Morta • CT ${item.c.ct}`
                })),
              ...lowWinner.erasedZone
                .map((c, idx) => ({ c, idx }))
                .filter((item) => item.c.type === 'Combatente')
                .map((item) => ({
                  id: `papai_erased_${item.idx}`,
                  card: item.c,
                  sourceZone: 'erasedZone' as const,
                  sourceIndex: item.idx,
                  subtitle: `Zona Apagada • CT ${item.c.ct}`
                }))
            ];
            if (zoneCandidates.length > 0) {
              state.pendingChoiceQueue.push({
                title: '«O Papai Chegou» — Menor Custo em Campo',
                description:
                  'Você possui o combatente de menor custo! Escolha 1 combatente de qualquer Zona para retornar ao seu campo:',
                candidates: zoneCandidates,
                minSelect: 1,
                maxSelect: 1,
                targetSlotForChosenCard: freeSlot,
                effectKind: 'O_PAPAI_CHEGOU'
              });
            }
          } else {
            const deadIdx = lowWinner.deadZone.findIndex((c) => c.type === 'Combatente');
            if (deadIdx !== -1) {
              const [revived] = lowWinner.deadZone.splice(deadIdx, 1);
              summonFighterToSlot(state, 'bot', revived, freeSlot);
            } else {
              const erasedIdx = lowWinner.erasedZone.findIndex((c) => c.type === 'Combatente');
              if (erasedIdx !== -1) {
                const [revived] = lowWinner.erasedZone.splice(erasedIdx, 1);
                summonFighterToSlot(state, 'bot', revived, freeSlot);
              }
            }
          }
        }
      }
      break;
    }

    case '2026/0002/00319': { // Ritos do Festival
      // "Selecione um combatente (não-Herói) do seu Deck e envie para a Zona Morta.
      //  Após 2 rodadas, invoque-o em seu lado do campo, imune a efeitos de cartas na rodada em que for invocado."
      discardCardDirectlyToZone(state, actorId, card, false);
      if (actorId === 'player') {
        const candidates: ChoiceCandidate[] = p.deck
          .map((c, idx) => ({ c, idx }))
          .filter((item) => item.c.type === 'Combatente' && !isTreatedAsHeroCard(p, item.c))
          .map((item) => ({
            id: `ritos_deck_${item.idx}`,
            card: item.c,
            sourceZone: 'deck' as const,
            sourceIndex: item.idx,
            subtitle: `Deck • ATK ${item.c.attack} / HP ${item.c.defense}`
          }));
        if (candidates.length > 0) {
          state.pendingChoiceQueue.push({
            title: '«Ritos do Festival» — Escolha 1 Combatente do Deck',
            description:
              'Selecione 1 combatente (não-Herói) do seu Deck para enviar à Zona Morta. Após 2 rodadas, ele será invocado imune a efeitos de cartas:',
            candidates,
            minSelect: 1,
            maxSelect: 1,
            effectKind: 'RITOS_DO_FESTIVAL'
          });
        }
      } else {
        const deckFighters = p.deck
          .map((c, idx) => ({ c, idx }))
          .filter((item) => item.c.type === 'Combatente' && !isTreatedAsHeroCard(p, item.c))
          .sort((a, b) => scoreJimFighterForBot(state, b.c) - scoreJimFighterForBot(state, a.c));
        if (deckFighters.length > 0) {
          const chosenIdx = deckFighters[0].idx;
          const [chosenCard] = p.deck.splice(chosenIdx, 1);
          discardCardDirectlyToZone(state, 'bot', chosenCard, false);
          p.pendingRitosFestival.push({
            card: chosenCard,
            summonOnRound: state.round + 2
          });
          addLog(
            state,
            'bot',
            `🕯️ «Ritos do Festival»: Bot enviou «${chosenCard.name}» do Deck para a Zona Morta (será invocado na Rodada ${state.round + 2} imune a efeitos)!`,
            'effect'
          );
        }
      }
      break;
    }

    case '2026/0002/00320': { // Ato Final
      // "Envie seu Herói para as Zonas e cause 5 de Dano Primordial no Deck inimigo.
      //  Caso o Herói possua «Mahina» em seu nome, retorne-o ao Deck de Herói na próxima rodada."
      discardCardDirectlyToZone(state, actorId, card, false);
      let sacrificedHero: CardData | null = null;

      const fieldHeroSlot = p.frontline.findIndex((f) => f !== null && f.isHero);
      if (fieldHeroSlot !== -1 && p.frontline[fieldHeroSlot]) {
        sacrificedHero = p.frontline[fieldHeroSlot]!.card;
        sendFighterFromFieldToZone(state, actorId, fieldHeroSlot, false, false);
      } else if (p.heroDeck.length > 0) {
        sacrificedHero = p.heroDeck.shift()!;
        discardCardDirectlyToZone(state, actorId, sacrificedHero, false);
      } else {
        const handHeroIdx = p.hand.findIndex((c) => c.type === 'Herói' || isTreatedAsHeroCard(p, c));
        if (handHeroIdx !== -1) {
          sacrificedHero = p.hand.splice(handHeroIdx, 1)[0];
          discardCardDirectlyToZone(state, actorId, sacrificedHero, false);
        } else {
          const deckHeroIdx = p.deck.findIndex((c) => c.type === 'Herói' || isTreatedAsHeroCard(p, c));
          if (deckHeroIdx !== -1) {
            sacrificedHero = p.deck.splice(deckHeroIdx, 1)[0];
            discardCardDirectlyToZone(state, actorId, sacrificedHero, false);
          }
        }
      }

      if (sacrificedHero) {
        addLog(
          state,
          actorId,
          `🌑 «Ato Final»: ${p.name} enviou o Herói «${sacrificedHero.name}» para as Zonas!`,
          'effect'
        );
        dealPrimordialDamageToDeck(state, actorId, oppId, 5, '«Ato Final»');

        if (sacrificedHero.name.includes('Mahina')) {
          p.pendingAtoFinalMahinaReturnRound = state.round + 1;
          addLog(
            state,
            actorId,
            `👑 «Ato Final»: Como «${sacrificedHero.name}» possui «Mahina» no nome, retornará ao Deck de Herói na Rodada ${state.round + 1}!`,
            'info'
          );
        }
      }
      break;
    }

    case '2026/0002/00321': { // Festival de Sangue
      // "Invoque 1 combatente «Véu» das suas Zonas ignorando custos. Ele ganha +5 de Ataque nesta rodada e é enviado para a Zona Apagada no fim do turno."
      discardCardDirectlyToZone(state, actorId, card, false);
      const freeSlot =
        p.frontline[targetSlot] === null ? targetSlot : p.frontline.findIndex((s) => s === null);
      if (freeSlot !== -1) {
        const deadIdx = p.deadZone.findIndex(
          (c) => c.type === 'Combatente' && (c.name.includes('Véu') || (c.archetype || '').includes('Véu'))
        );
        const erasedIdx = p.erasedZone.findIndex(
          (c) => c.type === 'Combatente' && (c.name.includes('Véu') || (c.archetype || '').includes('Véu'))
        );
        let revived: CardData | null = null;
        if (deadIdx !== -1) revived = p.deadZone.splice(deadIdx, 1)[0];
        else if (erasedIdx !== -1) revived = p.erasedZone.splice(erasedIdx, 1)[0];

        if (revived) {
          summonFighterToSlot(state, actorId, revived, freeSlot);
          const summoned = p.frontline[freeSlot];
          if (summoned) {
            summoned.tempAtkBonus += 5;
            addLog(
              state,
              actorId,
              `🩸 «Festival de Sangue»: Invocou «${revived.name}» com +5 de Ataque nesta rodada!`,
              'summon'
            );
          }
        }
      }
      break;
    }

    case '2026/0002/00323': { // Olho por Olho
      // "Pague 5 de Vida de Jogador. Envie 1 combatente inimigo de custo igual ou menor que o número de cartas «Véu» em suas Zonas para a Zona Apagada."
      discardCardDirectlyToZone(state, actorId, card, false);
      if (p.hp > 5) {
        p.hp -= 5;
        const veuInZones =
          p.deadZone.filter((c) => c.name.includes('Véu') || (c.archetype || '').includes('Véu')).length +
          p.erasedZone.filter((c) => c.name.includes('Véu') || (c.archetype || '').includes('Véu')).length;
        const enemyTarget =
          opp.frontline[targetSlot] ||
          opp.frontline.find((f) => f !== null && !f.isHero && f.card.ct <= Math.max(8, veuInZones * 2)) ||
          opp.frontline.find((f) => f !== null && !f.isHero);
        if (enemyTarget) {
          addLog(
            state,
            actorId,
            `👁️ «Olho por Olho»: ${p.name} pagou 5 PV e enviou «${enemyTarget.card.name}» de ${opp.name} para a Zona Apagada!`,
            'effect'
          );
          sendFighterFromFieldToZone(state, oppId, enemyTarget.slotIndex, true, false);
        }
      }
      break;
    }

    default: {
      discardCardDirectlyToZone(state, actorId, card, false);
      const desc = card.description || '';
      const lower = desc.toLowerCase();
      let triggeredAny = false;

      if (desc.includes('Camada')) {
        const equipped = pullAndEquipCamadaFromAnywhere(state, actorId);
        if (equipped) {
          triggeredAny = true;
          addLog(
            state,
            actorId,
            `«${card.name}»: Colocou «${equipped.name}» em campo!`,
            'effect'
          );
        }
      }

      if (lower.includes('invoque') && p.frontline.some((s) => s === null)) {
        const freeSlot =
          p.frontline[targetSlot] === null
            ? targetSlot
            : p.frontline.findIndex((s) => s === null);
        if (freeSlot !== -1) {
          const deadFighterIdx = p.deadZone.findIndex((c) => c.type === 'Combatente');
          if (deadFighterIdx !== -1) {
            const [revived] = p.deadZone.splice(deadFighterIdx, 1);
            summonFighterToSlot(state, actorId, revived, freeSlot);
            triggeredAny = true;
          } else {
            const deckFighterIdx = p.deck.findIndex((c) => c.type === 'Combatente');
            if (deckFighterIdx !== -1 && (lower.includes('deck') || lower.includes('qualquer lugar'))) {
              const [tutored] = p.deck.splice(deckFighterIdx, 1);
              summonFighterToSlot(state, actorId, tutored, freeSlot);
              triggeredAny = true;
            }
          }
        }
      }

      // Donnie - Grande General (2025/0001/00122): "Suas cartas de efeito que causam dano causam +3 de dano."
      const hasDonnieGeneral = p.frontline.some(
        (f) => f !== null && f.card.code === '2025/0001/00122'
      );

      const dmgMatch = desc.match(/cause\s+(\d+)\s+de\s+dano/i);
      if (dmgMatch) {
        const dmgVal = parseInt(dmgMatch[1], 10) + (hasDonnieGeneral ? 3 : 0);
        const enemyTarget =
          opp.frontline[targetSlot] ||
          opp.frontline
            .filter((f): f is FieldFighter => f !== null)
            .sort((a, b) => b.currentHp - a.currentHp)[0];
        if (enemyTarget && !lower.includes('vida do jogador')) {
          applyEffectDamageToFighter(
            state,
            actorId,
            oppId,
            enemyTarget.slotIndex,
            dmgVal,
            card,
            getCardAuthorityCt(p, card)
          );
          triggeredAny = true;
        } else if (lower.includes('oponente') || lower.includes('jogador') || lower.includes('inimigo')) {
          dealDamageToPlayer(state, oppId, actorId, dmgVal, `«${card.name}»`);
          triggeredAny = true;
        }
      }

      const drawMatch = desc.match(/compre\s+(\d+)\s+carta/i);
      if (drawMatch) {
        const count = Math.min(3, parseInt(drawMatch[1], 10));
        let drawn = 0;
        for (let i = 0; i < count; i++) {
          if (p.deck.length > 0) {
            p.hand.push(p.deck.shift()!);
            drawn++;
          }
        }
        if (drawn > 0) {
          addLog(state, actorId, `«${card.name}»: ${p.name} comprou ${drawn} carta(s)!`, 'effect');
          triggeredAny = true;
        }
      }

      const healMatch = desc.match(/(?:recupere|receba)\s+(\d+)\s+de\s+vida/i);
      if (healMatch) {
        const healVal = parseInt(healMatch[1], 10);
        p.hp += healVal;
        // Jenos Destinado (2025/0001/00033): "Sempre que o jogador recuperar vida, ganha +5 de Vida."
        for (const f of p.frontline) {
          if (f && f.card.code === '2025/0001/00033') {
            f.permHpBonus += 5;
            f.currentHp += 5;
            f.maxHp += 5;
          }
        }
        addLog(
          state,
          actorId,
          `💚 «${card.name}»: ${p.name} recebeu +${healVal} PV (Vida: ${p.hp} PV)!`,
          'life_gain'
        );
        triggeredAny = true;
      }

      const buffMatch = desc.match(/\+(\d+)\s+de\s+Ataque/i);
      if (buffMatch) {
        const buffVal = parseInt(buffMatch[1], 10);
        for (const ally of p.frontline) {
          if (ally) {
            ally.permAtkBonus += buffVal;
          }
        }
        addLog(
          state,
          actorId,
          `⚔️ «${card.name}»: Combatentes de ${p.name} receberam +${buffVal} de Ataque!`,
          'effect'
        );
        triggeredAny = true;
      }

      if (!triggeredAny) {
        addLog(
          state,
          actorId,
          `«${card.name}» ativada por ${p.name}.`,
          'effect'
        );
      }
      break;
    }
  }
}

export function getAvailableReactions(
  state: DuelGameState,
  responderId: PlayerId,
  windowType: 'CARD_PLAYED' | 'ATTACK_DECLARED',
  triggerAuthorityCt = 0,
  attackerIsSolador = false,
  onlyNegatableByHero = false
): {
  handCards: CardData[];
  canUseJimMagoFieldNegate: boolean;
  canUseMahinaVeuFieldNegate: boolean;
  canUseQuintaCamadaNegate: boolean;
  canSummonHeroJimLord: boolean;
} {
  const resp = getPlayerState(state, responderId);

  if (windowType === 'ATTACK_DECLARED' && attackerIsSolador) {
    return {
      handCards: [],
      canUseJimMagoFieldNegate: false,
      canUseMahinaVeuFieldNegate: false,
      canUseQuintaCamadaNegate: false,
      canSummonHeroJimLord: false
    };
  }

  const handCards: CardData[] = [];

  if (!onlyNegatableByHero) {
    for (const c of resp.hand) {
      const effCt = getEffectiveCt(resp, c, true);

      // Selamento Verdadeiro (2025/0001/00029): paga Vida equivalente ao CT da carta inimiga
      if (c.code === '2025/0001/00029' && windowType === 'CARD_PLAYED') {
        if (resp.hp > triggerAuthorityCt) {
          handCards.push(c);
        }
        continue;
      }

      if (resp.mana < effCt) continue;

      if (windowType === 'ATTACK_DECLARED') {
        if (c.code === '2025/0001/00023') {
          const fightersCount = resp.frontline.filter((f) => f !== null).length;
          if (fightersCount >= 2) handCards.push(c);
        } else if (
          c.code === '2025/0001/00024' || // Barreira Dimensional
          c.code === '2025/0001/00112' || // Férias
          c.code === '2026/0002/00317' || // Coragem ao Contrário
          c.code === '2025/0001/00285'    // Sedução de Afrodite
        ) {
          handCards.push(c);
        } else if (c.code === '2025/0001/00028') {
          const hasSwapCandidate =
            resp.hand.some((hc) => hc.type === 'Combatente') ||
            resp.erasedZone.some((ec) => ec.type === 'Combatente');
          if (hasSwapCandidate) handCards.push(c);
        }
      } else {
        // CARD_PLAYED reactions
        if (
          c.code === '2026/0002/00322' || // Como Planejado
          c.code === '2025/0001/00201'    // Negar na Base do Soco
        ) {
          handCards.push(c);
        } else {
          const check = canPlayCardInMainPhase(state, responderId, c);
          if (check.allowed) {
            handCards.push(c);
          }
        }
      }
    }
  }

  const canUseJimMagoFieldNegate =
    !onlyNegatableByHero &&
    windowType === 'CARD_PLAYED' &&
    triggerAuthorityCt <= 8 &&
    resp.frontline.some((f) => f !== null && f.card.code === '2025/0001/00003');

  // Mahina - O Arauto do Véu (2026/0001/00301):
  // "A Qualquer Momento, você pode descartar uma carta com «Véu» em seu nome do seu lado do campo para a Zona Apagada para negar o uso de uma carta."
  const hasMahinaVeuHeroOnField = resp.frontline.some(
    (f) => f !== null && f.card.code === '2026/0001/00301'
  );
  const hasVeuCardOnFieldToDiscard =
    resp.frontline.some(
      (f) => f !== null && (f.card.name.includes('Véu') || hasArchetype(state, f, 'Véu'))
    ) ||
    resp.backrow.some((s) =>
      getAllSupportCardsInSlot(s).some(
        (c) => c.name.includes('Véu') || (c.archetype || '').includes('Véu')
      )
    );
  const canUseMahinaVeuFieldNegate =
    windowType === 'CARD_PLAYED' && hasMahinaVeuHeroOnField && hasVeuCardOnFieldToDiscard;

  // Quinta Camada (2026/0002/00328):
  // "Gaste 3 Runas para negar o uso de uma carta inimiga."
  const canUseQuintaCamadaNegate =
    !onlyNegatableByHero &&
    windowType === 'CARD_PLAYED' &&
    hasActiveCamada(resp, '2026/0002/00328') &&
    resp.runes >= 3;

  // APENAS «Jim - O Senhor do Macroverso» (2025/0001/00001) pode ser invocado "A Qualquer Momento" / em Reação!
  const heroCard = resp.heroDeck[0];
  const canSummonHeroJimLord =
    Boolean(heroCard) && canSummonHeroDirectly(state, responderId, heroCard, true).allowed;

  return {
    handCards,
    canUseJimMagoFieldNegate,
    canUseMahinaVeuFieldNegate,
    canUseQuintaCamadaNegate,
    canSummonHeroJimLord
  };
}

export function performBotSmartMulligan(state: DuelGameState) {
  const bot = state.bot;
  const lowCtFighters = bot.hand.filter((c) => c.type === 'Combatente' && c.ct <= 5).length;
  const hasEngineStarter = bot.hand.some(
    (c) =>
      isContinuousBackrowCard(c) ||
      c.code === '2025/0001/00030' || // Destruição das Variantes
      c.code === '2025/0001/00016' || // Ascensão do Rei
      c.code === '2025/0001/00017' || // Busca Pela Eternidade
      c.code === '2025/0001/00005' || // Jim - Rei Elfo
      c.code === '2025/0001/00022'    // Pacto Forçado
  );

  if (lowCtFighters === 0 && !hasEngineStarter) {
    const oldHand = [...bot.hand];
    bot.deck = shuffleCards(bot.deck);
    const newHand = bot.deck.splice(0, 5);
    bot.deck.push(...oldHand);
    bot.deck = shuffleCards(bot.deck);
    bot.hand = newHand;
    addLog(
      state,
      'bot',
      `Mulligan do Bot: O Bot trocou todas as 5 cartas iniciais para buscar uma mão de combo mais forte!`,
      'info'
    );
  } else {
    addLog(state, 'bot', `Mulligan do Bot: O Bot manteve as 5 cartas iniciais.`, 'info');
  }
}

function scoreJimFighterForBot(state: DuelGameState, card: CardData): number {
  const bot = state.bot;
  const player = state.player;
  const erasedCount = countJimsInErasedZone(bot);
  const enemyHasFighters = player.frontline.some((f) => f !== null);
  const enemyCardsCount =
    player.frontline.filter((f) => f !== null).length +
    player.backrow.filter((s) => s !== null).length;

  switch (card.code) {
    // Deck Insanis
    case '2025/0001/00010': // Jim - Ancião
      return 135;
    case '2025/0001/00005': // Jim - Rei Elfo
      return state.round <= 3 ? 130 : 85;
    case '2025/0001/00004': // Jim - Assassino
      return 95 + erasedCount * 12;
    case '2025/0001/00002': // Jim - Guerreiro
      return enemyHasFighters ? 115 : 95;
    case '2025/0001/00007': // Jim - Herói
      return 110;
    case '2025/0001/00006': // Jim - Paladina
      return state.round >= 2 && enemyHasFighters ? 120 : 88;
    case '2025/0001/00003': // Jim - Mago
      return 105;
    case '2025/0001/00008': // Jim - Arqueira
      return 100;
    case '2025/0001/00009': // Jim - Feiticeira
      return state.round >= 2 ? 102 : 70;
    case '2025/0001/0011': // Jim - Necromante
      return bot.deadZone.some((c) => isJimCard(c)) ? 125 : 75;

    // Deck Véu (Invasão do Caos — cartas reais de invasaoDoCaosCards.ts)
    case '2026/0001/00304': // Eizen do Véu (invoca 1 combatente Véu de qualquer lugar no começo da rodada)
      return 155;
    case '2026/0001/00302': // Arthemiel do Véu (10/15 + recupera 7 PV por rodada)
      return 150;
    case '2026/0001/00306': // Crystal Caótica do Véu (+5 ATK por carta no campo inimigo)
      return 125 + enemyCardsCount * 12;
    case '2026/0001/00305': // Três do Véu (9/9 + 3D6 início da rodada)
      return 135;
    case '2026/0001/00307': // Zwey (zera ATK de um combatente não-Herói e gera +3 Mana no começo do turno)
      return enemyHasFighters ? 140 : 115;
    case '2026/0001/00303': // Atropos do Véu (causa 5 de dano na vida do oponente no começo da rodada)
      return 130;
    case '2026/0001/00309': // RYURAN (+3 ATK por Véu no campo/Zonas)
      return 120;
    case '2026/0001/00312': // A SENHORA DO VÉU (invoca O Horror do Véu se o Herói Véu sair do campo)
      return bot.frontline.some((f) => f !== null && f.isHero && f.card.name.includes('Véu')) ? 132 : 75;
    case '2026/0001/00308': // LUNALLY (dobra custo da 1ª reação do inimigo)
      return 118;
    case '2026/0001/00311': // Rebirth do Véu (busca Floquinho após 1 rodada)
      return 115;

    default: {
      // Avaliação universal para qualquer Combatente de qualquer Deck Estrutural
      const atk = card.attack || 0;
      const hp = card.defense || 1;
      const archBonus =
        ((card.archetype || '').includes('Solador') ? 22 : 0) +
        ((card.archetype || '').includes('Véu') ? 18 : 0) +
        ((card.archetype || '').includes('Furtivo') ? 16 : 0) +
        ((card.archetype || '').includes('Lúmen') ? 12 : 0) +
        ((card.archetype || '').includes('Caos') ? 12 : 0);
      return atk * 8 + hp * 6 + card.ct * 5 + archBonus;
    }
  }
}

// ============================================================================
// FUNÇÃO DE AVALIAÇÃO MATEMÁTICA HEURÍSTICA DO TABULEIRO (NOTA DE 0 A 100)
// ============================================================================

/**
 * Pesos individuais de Efeito Passivo/Ativo para cada Combatente «Jim» no campo
 */
const FIGHTER_INTRINSIC_EFFECT_WEIGHTS: Record<string, number> = {
  '2025/0001/00001': 35, // Jim - O Senhor do Macroverso (Herói Chefe + Escalonamento da Zona Apagada)
  '2025/0001/00010': 28, // Jim - Ancião (Imunidade a dano de combate para todos os outros Jims!)
  '2025/0001/00005': 24, // Jim - Rei Elfo (Invocação gratuita do Deck na rodada seguinte)
  '2025/0001/00003': 22, // Jim - Mago (Negação de carta até CT 8 diretamente do campo)
  '2025/0001/00006': 20, // Jim - Paladina (+8 ATK em combate + Solador nativo)
  '2025/0001/00004': 18, // Jim - Assassino (Furtivo + Escalonamento +2 ATK por Jim Apagado)
  '2025/0001/00002': 17, // Jim - Guerreiro (5 de dano splash ao abater um inimigo)
  '2025/0001/00007': 16, // Jim - Herói (Cura +1 PV por rodada + Lúmen tanque)
  '2025/0001/00009': 15, // Jim - Feiticeira (Caos + Bomba de 8 de dano ao morrer)
  '2025/0001/00008': 14, // Jim - Arqueira (Drena 1D4 de mana do oponente no início do turno)
  '2025/0001/0011': 12   // Jim - Necromante (Já cumpriu efeito de entrada, corpo 4/1)
};

/**
 * Pesos de cada Arquétipo ativo em um Combatente no campo
 */
const ARCHETYPE_HEURISTIC_WEIGHTS: Record<string, number> = {
  Solador: 14,   // Ignora reações, Lúmen e efeitos defensivos no combate
  Furtivo: 12,   // Ataca sem receber contra-ataque (troca infinita)
  Divindade: 11, // Dobra bônus de Lúmen (+6 red) e Darkus (+4 ATK) de equipamentos
  Lúmen: 9,      // Reduz todo dano recebido em 3 por acúmulo
  Caos: 8,       // Dano excedente perfura direto nos Pontos de Vida do oponente
  Darkus: 7,     // +2 ATK ofensivo adicional
  Véu: 10,       // Anula arquétipos do inimigo na mesma coluna
  Insano: 6      // Causa 5 de dano de retorno a quem o destruir em combate
};

/**
 * Pesos de Equipamentos acoplados a um Combatente
 */
const EQUIPMENT_HEURISTIC_WEIGHTS: Record<string, number> = {
  '2025/0001/00012': 26, // Crueldade (1D4 arquétipos por turno + dobra todos os arquétipos se tiver 4+)
  '2025/0001/00014': 24, // Gema do Macroverso 2 (Compra 1 carta extra por rodada de graça)
  '2025/0001/00013': 22, // Gema do Macroverso 1 (Concede 3 arquétipos escolhidos ao portador)
  '2025/0001/00015': 20  // Gema do Macroverso 3 (Imunidade a efeitos de cartas de CT <= 6)
};

const BOT_MEMORY_STORAGE_KEY = 'ld_bot_universal_adaptive_memory_v2';

export function getDefaultBotAdaptiveMemory(): BotAdaptiveMemory {
  return {
    generation: 1,
    matchesPlayed: 0,
    botWins: 0,
    botLosses: 0,
    weights: {
      lifeAsResourceCautionMultiplier: 1.0,
      minSafeHpForLifeCost: 10,
      winconTimingThresholdScale: 1.0,
      synergyEnginePriorityMultiplier: 1.0,
      interactionAndRemovalDiscipline: 1.0,
      boardTempoAndDefenseMultiplier: 1.0,
      cardAdvantageAndDrawMultiplier: 1.0
    },
    lastMatchAutopsy: []
  };
}

export function loadBotAdaptiveMemory(): BotAdaptiveMemory {
  try {
    const raw = localStorage.getItem(BOT_MEMORY_STORAGE_KEY);
    if (!raw) return getDefaultBotAdaptiveMemory();
    const parsed = JSON.parse(raw) as BotAdaptiveMemory;
    if (
      !parsed ||
      !parsed.weights ||
      typeof parsed.weights.lifeAsResourceCautionMultiplier !== 'number'
    ) {
      return getDefaultBotAdaptiveMemory();
    }
    return parsed;
  } catch {
    return getDefaultBotAdaptiveMemory();
  }
}

export function saveBotAdaptiveMemory(mem: BotAdaptiveMemory): void {
  try {
    localStorage.setItem(BOT_MEMORY_STORAGE_KEY, JSON.stringify(mem));
  } catch {
    // ignore storage errors
  }
}

export function resetBotAdaptiveMemory(): BotAdaptiveMemory {
  const def = getDefaultBotAdaptiveMemory();
  saveBotAdaptiveMemory(def);
  return def;
}

/**
 * Realiza a autópsia matemática universal pós-partida (agnóstica de arquétipo/deck),
 * avaliando os 6 Pilares Fundamentais de TCG para diagnosticar a derrota e recalibrar
 * os pesos heurísticos do Bot para qualquer matchup futura.
 */
export function analyzeMatchAndLearn(state: DuelGameState): BotAdaptiveMemory {
  const mem = loadBotAdaptiveMemory();
  mem.matchesPlayed += 1;
  mem.generation += 1;
  const autopsy: BotLossDiagnosisEntry[] = [];

  if (state.winner === 'bot') {
    mem.botWins += 1;
    autopsy.push({
      causeCode: 'BOT_VICTORY_REINFORCEMENT',
      pillarLabel: 'Estabilização de Pesos (Vitória)',
      title: 'Reforço Positivo de Estratégia',
      analysis: `O Bot venceu na Rodada ${state.round} mantendo ${state.bot.hp} PV, ${
        state.bot.frontline.filter((f) => f !== null).length
      } combatentes em campo e ${state.bot.hand.length} cartas na mão.`,
      adjustmentSummary: `Calibragem tática validada e mantida para a Geração #${mem.generation}.`
    });
    mem.lastMatchAutopsy = autopsy;
    saveBotAdaptiveMemory(mem);
    return mem;
  }

  mem.botLosses += 1;

  // =========================================================================
  // PILAR 1: GESTÃO DE VIDA COMO RECURSO (Self-Burn / Custos em PV)
  // =========================================================================
  const botSelfLifeLossLogs = state.logs.filter(
    (l) =>
      l.actor === 'bot' &&
      (l.type === 'life_loss' ||
        l.text.includes('pagou') ||
        l.text.includes('perdeu 5 PV') ||
        l.text.includes('Pacto Forçado'))
  );
  if (botSelfLifeLossLogs.length > 0) {
    mem.weights.lifeAsResourceCautionMultiplier =
      Math.round(Math.min(2.2, mem.weights.lifeAsResourceCautionMultiplier + 0.2) * 100) / 100;
    mem.weights.minSafeHpForLifeCost = Math.min(14, mem.weights.minSafeHpForLifeCost + 1);
    autopsy.push({
      causeCode: 'LIFE_AS_RESOURCE_OVEREXTENSION',
      pillarLabel: 'Pilar 1 • Gestão de Vida como Recurso',
      title: 'Excesso de Conversão de Vida em Recurso',
      analysis: `O Bot utilizou efeitos que consomem os próprios Pontos de Vida (${botSelfLifeLossLogs.length}x na partida), reduzindo sua margem de sobrevivência contra o dano letal do oponente.`,
      adjustmentSummary: `Cautela de Vida subiu para ${mem.weights.lifeAsResourceCautionMultiplier}x | Limite seguro para pagar custos em PV subiu para ${mem.weights.minSafeHpForLifeCost} PV.`
    });
  }

  // =========================================================================
  // PILAR 2: TIMING DE CONDIÇÃO DE VITÓRIA / HERÓI RETIDO
  // =========================================================================
  if (state.bot.heroDeck.length > 0) {
    mem.weights.winconTimingThresholdScale =
      Math.round(Math.max(0.6, mem.weights.winconTimingThresholdScale - 0.15) * 100) / 100;
    autopsy.push({
      causeCode: 'WINCON_AND_HERO_TIMING_DELAY',
      pillarLabel: 'Pilar 2 • Timing de Win Condition / Herói',
      title: 'Condição de Vitória / Herói Retido por Tempo Demais',
      analysis: `O Bot foi derrotado na Rodada ${state.round} ainda segurando seu Herói na Zona do Herói por aguardar um estado de escalonamento ideal que nunca chegou.`,
      adjustmentSummary: `Gatilho de entrada do Herói / Wincon antecipado (Escala de exigência reduzida para ${Math.round(
        mem.weights.winconTimingThresholdScale * 100
      )}%).`
    });
  }

  // =========================================================================
  // PILAR 3: VELOCIDADE DE MOTOR DE SINERGIA & ZONAS AUXILIARES
  // =========================================================================
  const playerSynergyPool =
    state.player.erasedZone.length +
    state.player.deadZone.length +
    state.player.backrow.filter((s) => s !== null).length * 2;
  const botSynergyPool =
    state.bot.erasedZone.length +
    state.bot.deadZone.length +
    state.bot.backrow.filter((s) => s !== null).length * 2;
  const playerHeroActive = state.player.frontline.some((f) => f !== null && f.isHero);

  if (playerHeroActive || playerSynergyPool >= botSynergyPool + 3) {
    mem.weights.synergyEnginePriorityMultiplier =
      Math.round(Math.min(2.2, mem.weights.synergyEnginePriorityMultiplier + 0.18) * 100) / 100;
    autopsy.push({
      causeCode: 'SYNERGY_AND_ENGINE_SCALING_GAP',
      pillarLabel: 'Pilar 3 • Velocidade de Motor e Sinergia',
      title: 'Superado na Velocidade de Setup e Escalonamento de Arquétipo',
      analysis: `O oponente construiu um motor de sinergia superior (Zonas Auxiliares/Suportes: ${playerSynergyPool} vs ${botSynergyPool} do Bot${
        playerHeroActive ? ' + Herói dominante em campo' : ''
      }), gerando mais valor composto por turno.`,
      adjustmentSummary: `Prioridade de Motores Contínuos, Tutores e Alimentação de Zonas subiu para ${mem.weights.synergyEnginePriorityMultiplier}x.`
    });
  }

  // =========================================================================
  // PILAR 4: DISCIPLINA DE INTERAÇÃO, REAÇÕES E REMOÇÃO DE PEÇAS-CHAVE
  // =========================================================================
  const playerReactionLogs = state.logs.filter(
    (l) => l.actor === 'player' && l.type === 'reaction'
  ).length;
  const highValueEnemyUnits = state.player.frontline.filter(
    (f) => f !== null && (f.isHero || f.equipments.length > 0 || f.card.ct >= 5)
  ).length;

  if (playerReactionLogs >= 1 || highValueEnemyUnits >= 1) {
    mem.weights.interactionAndRemovalDiscipline =
      Math.round(Math.min(2.3, mem.weights.interactionAndRemovalDiscipline + 0.2) * 100) / 100;
    autopsy.push({
      causeCode: 'INTERACTION_AND_COUNTERPLAY_DEFICIT',
      pillarLabel: 'Pilar 4 • Interação, Reações e Remoção',
      title: 'Déficit de Resposta a Ameaças e Correntes de Reação',
      analysis: `O oponente manteve ${highValueEnemyUnits} unidade(s) de alto impacto/equipadas em campo e executou ${playerReactionLogs} reação(ões) decisiva(s) sem que o Bot neutralizasse a peça central.`,
      adjustmentSummary: `Disciplina de Remoção Prioritária e Conservação de Respostas/Contra-Negações subiu para ${mem.weights.interactionAndRemovalDiscipline}x.`
    });
  }

  // =========================================================================
  // PILAR 5: TEMPO DE MESA, TROCAS DE COMBATE E DEFESA CONTRA AGGRO
  // =========================================================================
  const playerBoardCount = state.player.frontline.filter((f) => f !== null).length;
  const botBoardCount = state.bot.frontline.filter((f) => f !== null).length;
  if (state.round <= 3 || playerBoardCount > botBoardCount) {
    mem.weights.boardTempoAndDefenseMultiplier =
      Math.round(Math.min(2.2, mem.weights.boardTempoAndDefenseMultiplier + 0.2) * 100) / 100;
    autopsy.push({
      causeCode: 'BOARD_TEMPO_AND_DEFENSIVE_STABILIZATION',
      pillarLabel: 'Pilar 5 • Tempo de Mesa e Estabilização Defensiva',
      title: 'Perda de Controle de Linha de Frente / Pressão de Tempo',
      analysis: `O oponente finalizou a partida na Rodada ${state.round} com vantagem de presença de campo (${playerBoardCount} combatentes contra ${botBoardCount} do Bot), abrindo espaço para dano direto.`,
      adjustmentSummary: `Peso de Presença de Mesa, Bloqueadores e Trocas Favoráveis subiu para ${mem.weights.boardTempoAndDefenseMultiplier}x.`
    });
  }

  // =========================================================================
  // PILAR 6: VANTAGEM DE CARTAS (CARD ADVANTAGE) E ECONOMIA DE MÃO
  // =========================================================================
  if (state.bot.hand.length <= 1 && state.player.hand.length >= state.bot.hand.length + 2) {
    mem.weights.cardAdvantageAndDrawMultiplier =
      Math.round(Math.min(2.2, mem.weights.cardAdvantageAndDrawMultiplier + 0.18) * 100) / 100;
    autopsy.push({
      causeCode: 'CARD_ADVANTAGE_AND_HAND_SUSTAIN',
      pillarLabel: 'Pilar 6 • Vantagem de Cartas (Card Advantage)',
      title: 'Exaustão Prematura de Recursos na Mão',
      analysis: `O Bot ficou sem gás no final da partida (${state.bot.hand.length} carta na mão contra ${state.player.hand.length} do oponente), perdendo capacidade de reação e reconstrução.`,
      adjustmentSummary: `Valorização de Compras, Buscas e Economia de Mão subiu para ${mem.weights.cardAdvantageAndDrawMultiplier}x.`
    });
  }

  mem.lastMatchAutopsy = autopsy;
  saveBotAdaptiveMemory(mem);
  return mem;
}

/**
 * Calcula a pontuação bruta (Raw Points) de um dos lados do tabuleiro (Bot ou Player)
 * ponderada pelos 6 Pilares Universais aprendidos pelo Bot.
 */
function evaluatePlayerSideRaw(
  state: DuelGameState,
  sideId: PlayerId
): PlayerSideHeuristic {
  const p = getPlayerState(state, sideId);
  const opp = getPlayerState(state, getOpponentId(sideId));
  const adaptiveWeights = loadBotAdaptiveMemory().weights;

  // 1. PONTUAÇÃO DE VIDA (Pilar 1: Gestão de Vida como Recurso)
  let lifeScore = p.hp * 2.5 * adaptiveWeights.lifeAsResourceCautionMultiplier;
  if (p.hp <= 5) {
    lifeScore -= (6 - p.hp) * 14 * adaptiveWeights.lifeAsResourceCautionMultiplier;
  } else if (p.hp <= 10) {
    lifeScore -= (11 - p.hp) * 5 * adaptiveWeights.lifeAsResourceCautionMultiplier;
  }

  // 2. PONTUAÇÃO DE COMBATENTES EM CAMPO (Pilar 5: Tempo de Mesa e Estabilização)
  let boardFightersScore = 0;
  const activeFighters = p.frontline.filter((f): f is FieldFighter => f !== null);
  const hasAnciaoOnBoard = activeFighters.some((f) => f.card.code === '2025/0001/00010');

  for (const f of activeFighters) {
    const effAtk = getFighterEffectiveAtk(state, f, true);
    const effHp = f.currentHp;
    const intrinsicBonus = FIGHTER_INTRINSIC_EFFECT_WEIGHTS[f.card.code] ?? 10;

    let unitScore = effAtk * 2.2 + effHp * 1.8 + intrinsicBonus;

    if (f.card.code === '2025/0001/00005' && state.round === f.summonedRound) {
      unitScore += 18;
    }

    const effArchs = getEffectiveArchetypes(state, f);
    for (const arch of effArchs) {
      unitScore += ARCHETYPE_HEURISTIC_WEIGHTS[arch] ?? 5;
    }

    if (hasAnciaoOnBoard && isJimCard(f.card) && f.card.code !== '2025/0001/00010') {
      unitScore += 10;
    }

    boardFightersScore += unitScore * adaptiveWeights.boardTempoAndDefenseMultiplier;
  }

  // 3. PONTUAÇÃO DE SUPORTES CONTÍNUOS E EQUIPAMENTOS (Pilar 3: Motores Contínuos)
  let backrowAndEquipScore = 0;
  for (const f of activeFighters) {
    for (const eq of f.equipments) {
      const baseEqWeight = EQUIPMENT_HEURISTIC_WEIGHTS[eq.card.code] ?? 15;
      const durabilityMultiplier = f.isHero || f.currentHp >= 10 ? 1.35 : 1.0;
      backrowAndEquipScore +=
        baseEqWeight * durabilityMultiplier * adaptiveWeights.synergyEnginePriorityMultiplier;
    }
  }
  for (const sup of p.backrow) {
    if (!sup) continue;
    const baseSupWeight = sup.card.code === '2025/0001/00017' ? 28 : 22;
    backrowAndEquipScore += baseSupWeight * adaptiveWeights.synergyEnginePriorityMultiplier;
  }

  // 4. PONTUAÇÃO DE ESCALONAMENTO DE ZONAS AUXILIARES / SINERGIA (Pilar 3)
  const jimsErased = countJimsInErasedZone(p);
  let erasedZoneSynergyScore = jimsErased * 5.5;
  if (jimsErased >= 1) erasedZoneSynergyScore += 6;
  if (jimsErased >= 3) erasedZoneSynergyScore += 10;
  if (jimsErased >= 5) erasedZoneSynergyScore += 18;
  if (jimsErased >= 7) erasedZoneSynergyScore += 24;
  if (jimsErased >= 9) erasedZoneSynergyScore += 35;
  erasedZoneSynergyScore *= adaptiveWeights.synergyEnginePriorityMultiplier;

  // 5. PONTUAÇÃO DE MÃO, MANA, RUNAS E RESERVA DE WINCON (Pilares 4 e 6)
  let handAndTempoScore =
    p.hand.length * 6.5 * adaptiveWeights.cardAdvantageAndDrawMultiplier +
    p.mana * 1.8 +
    p.runes * 2.5;
  if (p.heroDeck.length > 0) {
    handAndTempoScore += 20 + Math.min(9, jimsErased) * 3;
  }
  if (p.ctReductionThisRound > 0) {
    handAndTempoScore += p.ctReductionThisRound * 5;
  }

  // Valor de cartas de Reação/Interação na mão ponderado pelo Pilar 4 (Disciplina de Interação)
  for (const c of p.hand) {
    if (c.code === '2025/0001/00029' && p.hp >= 10) {
      handAndTempoScore += 14 * adaptiveWeights.interactionAndRemovalDiscipline;
    }
    if (c.code === '2025/0001/00028') {
      handAndTempoScore += 9 * adaptiveWeights.interactionAndRemovalDiscipline;
    }
    if (c.code === '2025/0001/00024') {
      handAndTempoScore += 8 * adaptiveWeights.interactionAndRemovalDiscipline;
    }
    if (c.code === '2025/0001/00023') {
      handAndTempoScore += 6 * adaptiveWeights.interactionAndRemovalDiscipline;
    }
  }

  // 6. BÔNUS DE COMBOS E SINERGIAS ATIVAS
  let comboSynergyBonus = 0;

  if (hasAnciaoOnBoard && activeFighters.length >= 2) {
    comboSynergyBonus += (activeFighters.length - 1) * 14;
  }

  const heroOnField = activeFighters.find((f) => f.isHero);
  if (heroOnField) {
    if (jimsErased >= 5) comboSynergyBonus += 25;
    if (jimsErased >= 7) comboSynergyBonus += 25;
    if (jimsErased >= 9) comboSynergyBonus += 35;
  }

  for (const f of activeFighters) {
    const hasCrueldade = f.equipments.some((e) => e.card.code === '2025/0001/00012');
    if (hasCrueldade && f.archetypes.length >= 4) {
      comboSynergyBonus += 30;
    }
  }

  const hasPactoInHand = p.hand.some((c) => c.code === '2025/0001/00022');
  if (hasPactoInHand && p.hp >= adaptiveWeights.minSafeHpForLifeCost && p.hand.length >= 3) {
    comboSynergyBonus += 18;
  }

  const hasErasedTurboInHand = p.hand.some(
    (c) => c.code === '2025/0001/00030' || c.code === '2025/0001/0011'
  );
  if (hasErasedTurboInHand && p.heroDeck.length > 0 && jimsErased < 5) {
    comboSynergyBonus += 20 * adaptiveWeights.synergyEnginePriorityMultiplier;
  }

  const oppFightersCount = opp.frontline.filter((f) => f !== null).length;
  const totalReadyAtk = activeFighters
    .filter((f) => !f.hasAttackedThisTurn)
    .reduce((sum, f) => sum + getFighterEffectiveAtk(state, f, true), 0);
  if (state.round >= 2 && oppFightersCount === 0 && totalReadyAtk >= opp.hp) {
    comboSynergyBonus += 120;
  }

  const totalRawPoints =
    lifeScore +
    boardFightersScore +
    backrowAndEquipScore +
    erasedZoneSynergyScore +
    handAndTempoScore +
    comboSynergyBonus;

  return {
    lifeScore: Math.round(lifeScore * 10) / 10,
    boardFightersScore: Math.round(boardFightersScore * 10) / 10,
    backrowAndEquipScore: Math.round(backrowAndEquipScore * 10) / 10,
    erasedZoneSynergyScore: Math.round(erasedZoneSynergyScore * 10) / 10,
    handAndTempoScore: Math.round(handAndTempoScore * 10) / 10,
    comboSynergyBonus: Math.round(comboSynergyBonus * 10) / 10,
    totalRawPoints: Math.round(totalRawPoints * 10) / 10
  };
}

/**
 * Avalia matematicamente o estado completo do tabuleiro e retorna uma nota de 0 a 100
 * sob a perspectiva do Bot (50 = Equilíbrio Perfeito, >50 Vantagem Bot, <50 Vantagem Jogador).
 * Usa uma função Logística/Sigmoide: Score = 100 / (1 + e^(-Delta / K))
 */
export function evaluateBoardHeuristic(state: DuelGameState): HeuristicEvaluationResult {
  if (state.winner === 'bot') {
    const b = evaluatePlayerSideRaw(state, 'bot');
    const p = evaluatePlayerSideRaw(state, 'player');
    return {
      score0to100: 100,
      rawDelta: 999,
      posture: 'LETHAL_PUSH',
      botBreakdown: b,
      playerBreakdown: p
    };
  }
  if (state.winner === 'player') {
    const b = evaluatePlayerSideRaw(state, 'bot');
    const p = evaluatePlayerSideRaw(state, 'player');
    return {
      score0to100: 0,
      rawDelta: -999,
      posture: 'CRITICAL_SURVIVAL',
      botBreakdown: b,
      playerBreakdown: p
    };
  }

  const botBreakdown = evaluatePlayerSideRaw(state, 'bot');
  const playerBreakdown = evaluatePlayerSideRaw(state, 'player');
  const rawDelta = Math.round((botBreakdown.totalRawPoints - playerBreakdown.totalRawPoints) * 10) / 10;

  // Constante de escala K = 85 (uma vantagem de ~85 pontos brutos leva a nota para ~73/100; ~170 pts leva para ~88/100)
  const K = 85;
  const sigmoid = 100 / (1 + Math.exp(-rawDelta / K));
  const score0to100 = Math.max(1, Math.min(99, Math.round(sigmoid)));

  let posture: HeuristicEvaluationResult['posture'] = 'BALANCED';
  if (score0to100 >= 78 || state.player.hp <= 8) {
    posture = 'LETHAL_PUSH';
  } else if (score0to100 >= 60) {
    posture = 'DOMINATING';
  } else if (score0to100 <= 25 || state.bot.hp <= 7) {
    posture = 'CRITICAL_SURVIVAL';
  } else if (score0to100 <= 42) {
    posture = 'DEFENSIVE_RECOVERY';
  }

  return {
    score0to100,
    rawDelta,
    posture,
    botBreakdown,
    playerBreakdown
  };
}

export function executeBotTurnStep(
  state: DuelGameState,
  deferAttackResolution = false
): {
  acted: boolean;
  triggeredReactionWindow: boolean;
  deferredBotAttack?: { attackerSlot: number; targetSlot: number };
} {
  if (state.phase !== 'MAIN_PHASE' || state.activePlayer !== 'bot') {
    return { acted: false, triggeredReactionWindow: false };
  }

  const bot = state.bot;
  const player = state.player;
  const heuristic = evaluateBoardHeuristic(state);

  // =========================================================================
  // STEP 1: PRE-COMBAT COMBOS, SETUP & SUMMONS
  // =========================================================================
  if (!bot.hasAttackedInCurrentTurn) {
    // 1A. Free "A Qualquer Momento" Engine Actions first (Busca Pela Eternidade, Jim - Herói, Hero Tier 9 Gem)
    for (const sup of bot.backrow) {
      if (sup && sup.card.code === '2025/0001/00017' && !sup.usedOncePerRound) {
        const candidates = bot.deck
          .map((c, idx) => ({ c, idx }))
          .filter((item) => item.c.ct === bot.runes);

        if (candidates.length > 0) {
          // Prioritize tutoring the best tactical card for current Runes count
          candidates.sort((a, b) => {
            const priority = (c: CardData) => {
              if (c.code === '2025/0001/00029') return 200; // Selamento Verdadeiro (CT 0)
              if (c.code === '2025/0001/00030' && bot.hp >= 11) return 190; // Destruição das Variantes (CT 3)
              if (c.code === '2025/0001/00016') return 180; // Ascensão do Rei (CT 1)
              if (c.code === '2025/0001/00018' && bot.frontline.some((f) => f?.isHero)) return 175; // Lamento do Rei (CT 1)
              if (c.code === '2025/0001/00023') return 165; // Ligação das Variantes (CT 1)
              if (c.code === '2025/0001/00012' && bot.frontline.some((f) => f && f.currentHp >= 6)) return 170; // Crueldade (CT 5)
              if (c.code === '2025/0001/00022' && bot.hp >= 10) return 160; // Pacto Forçado (CT 5)
              if (c.code === '2025/0001/00010') return 160; // Jim - Ancião (CT 6)
              if (c.code === '2025/0001/00004') return 155; // Jim - Assassino (CT 4)
              if (c.code === '2025/0001/00024') return 150; // Sobrevivência Covarde (CT 3)
              return c.type === 'Combatente' ? 120 : 100;
            };
            return priority(b.c) - priority(a.c);
          });

          sup.usedOncePerRound = true;
          const chosen = candidates[0];
          const [found] = bot.deck.splice(chosen.idx, 1);
          bot.hand.push(found);
          addLog(
            state,
            'bot',
            `Bot ativou «Busca Pela Eternidade» (${bot.runes} Runas) e buscou estrategicamente «${found.name}» (CT ${found.ct}) do Deck!`,
            'effect'
          );
          return { acted: true, triggeredReactionWindow: false };
        }
      }
    }

    for (const f of bot.frontline) {
      if (f && f.card.code === '2025/0001/00007' && !f.usedOncePerRoundAbility) {
        f.usedOncePerRoundAbility = true;
        bot.hp += 1;
        addLog(
          state,
          'bot',
          `💚 Bot ativou habilidade de «Jim - Herói»: Recuperou +1 PV (Vida: ${bot.hp} PV).`,
          'life_gain'
        );
        return { acted: true, triggeredReactionWindow: false };
      }
    }

    for (const f of bot.frontline) {
      if (
        f &&
        f.card.code === '2025/0001/00001' &&
        !f.jimLordTier9GemUsedThisRound &&
        countJimsInErasedZone(bot) >= 9
      ) {
        const gemLoader = (): CardData | null => {
          const priorityGems = ['2025/0001/00014', '2025/0001/00013', '2025/0001/00015'];
          for (const gCode of priorityGems) {
            const dIdx = bot.deck.findIndex((c) => c.code === gCode);
            if (dIdx !== -1) return bot.deck.splice(dIdx, 1)[0];
            const zIdx = bot.deadZone.findIndex((c) => c.code === gCode);
            if (zIdx !== -1) return bot.deadZone.splice(zIdx, 1)[0];
            const eIdx = bot.erasedZone.findIndex((c) => c.code === gCode);
            if (eIdx !== -1) return bot.erasedZone.splice(eIdx, 1)[0];
            const hIdx = bot.hand.findIndex((c) => c.code === gCode);
            if (hIdx !== -1) return bot.hand.splice(hIdx, 1)[0];
          }
          return null;
        };
        const gem = gemLoader();
        if (gem) {
          f.jimLordTier9GemUsedThisRound = true;
          f.equipments.push({
            instanceId: nextUid('eq'),
            card: gem,
            grantedArchetypes:
              gem.code === '2025/0001/00013' ? ['Solador', 'Furtivo', 'Divindade'] : undefined
          });
          addLog(
            state,
            'bot',
            `«Jim - O Senhor do Macroverso» [9+ Jim] buscou e equipou «${gem.name}» automaticamente!`,
            'effect'
          );
          return { acted: true, triggeredReactionWindow: false };
        }
      }
    }

    // 1B. COMBO STARTER: «Pacto Forçado» (2025/0001/00022) — Reduces CT of all cards by 3 this round!
    const adaptiveMem = loadBotAdaptiveMemory();
    const minSafeHp = adaptiveMem.weights.minSafeHpForLifeCost;
    const pactoIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00022');
    if (
      pactoIdx !== -1 &&
      bot.hp >= Math.max(8, minSafeHp - 1) &&
      canPlayCardInMainPhase(state, 'bot', bot.hand[pactoIdx]).allowed
    ) {
      const pactoCost = getEffectiveCt(bot, bot.hand[pactoIdx]);
      const otherPlayableCount = bot.hand.filter(
        (c, i) =>
          i !== pactoIdx &&
          c.code !== '2025/0001/00029' &&
          c.code !== '2025/0001/00023' &&
          c.code !== '2025/0001/00024' &&
          c.code !== '2025/0001/00028' &&
          c.ct > 0
      ).length;
      if (otherPlayableCount >= 2 && bot.mana >= pactoCost + 2) {
        const [card] = bot.hand.splice(pactoIdx, 1);
        bot.mana -= pactoCost;
        return queueBotCardWithReactionCheck(state, card, 0, pactoCost);
      }
    }

    // 1C. CONTINUOUS BACKROW ENGINE & PLAYER EQUIPMENTS (Camadas do Véu, Apoteose do Véu, Conceito Fogo, Ascensão, Busca, etc.)
    const continuousIdx = bot.hand.findIndex(
      (c) =>
        isContinuousBackrowCard(c) &&
        canPlayCardInMainPhase(state, 'bot', c).allowed &&
        (c.code !== '2026/0002/00315' || bot.hp >= Math.max(9, minSafeHp))
    );
    if (continuousIdx !== -1) {
      const [card] = bot.hand.splice(continuousIdx, 1);
      const cost = getEffectiveCt(bot, card);
      bot.mana -= cost;
      const backSlot = bot.backrow.findIndex((s) => s === null);
      return queueBotCardWithReactionCheck(state, card, backSlot !== -1 ? backSlot : 0, cost);
    }

    // 1D. ERASED ZONE TURBO COMBO: «Destruição das Variantes» (00030) & «Jim - Necromante» (0011)
    // Always feed the Erased Zone BEFORE considering summoning the Hero!
    const destrIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00030');
    if (
      destrIdx !== -1 &&
      bot.hp >= minSafeHp &&
      bot.deck.some((c) => isJimCard(c) && c.type === 'Combatente') &&
      canPlayCardInMainPhase(state, 'bot', bot.hand[destrIdx]).allowed
    ) {
      const [card] = bot.hand.splice(destrIdx, 1);
      const cost = getEffectiveCt(bot, card);
      bot.mana -= cost;
      return queueBotCardWithReactionCheck(state, card, 0, cost);
    }

    const necroIdx = bot.hand.findIndex((c) => c.code === '2025/0001/0011');
    if (
      necroIdx !== -1 &&
      (bot.deadZone.some((c) => isJimCard(c)) || bot.hand.filter((c) => isJimCard(c) && c.type === 'Combatente').length >= 2) &&
      canPlayCardInMainPhase(state, 'bot', bot.hand[necroIdx]).allowed
    ) {
      const [card] = bot.hand.splice(necroIdx, 1);
      const cost = getEffectiveCt(bot, card);
      bot.mana -= cost;
      const slot = chooseBestBotSummonSlot(state, card);
      return queueBotCardWithReactionCheck(state, card, slot, cost);
    }

    // 1E. SMART HERO / WINCON TIMING (Direct Hero Summon + Hero-Summoning Spells)
    // First: Check if Bot holds an active Hero-Summoning Spell in hand that meets all requirements!
    const heroSummonSpellCodes = [
      '2025/0001/00176', // Ritos da Corrupção (invoca Otto - Arauto da Corrupção)
      '2025/0001/00142', // Mundo em Chamas (invoca um Herói Donnie)
      '2025/0001/00197', // Invocação do Escolhido (invoca Salazar Guia / Poderoso Líder)
      '2025/0001/00202', // Pelo Bem Maior (descarta 3 combatentes e invoca um Herói Salazar)
      '2025/0001/00205', // Não Existe Paz Verdadeira (invoca Salazar - O Falho)
      '2025/0001/00079', // Mensagem Final (invoca Spear Vellret)
      '2025/0001/00082', // Destruidor de Realidades (invoca Vellret - Escolhido de Salazar)
      '2025/0001/00083', // Pela Família (invoca Vellret - Condenado do Jim)
      '2025/0001/00108', // Sacrificio Maior (invoca Equilíbrio Imperfeito Mahina)
      '2025/0001/00109', // Mestre Manipulador (invoca Estrategista Mahina)
      '2025/0001/00110', // Coroa Lúmeni (coloca em campo e invoca Mahina - O Herdeiro de Lúmeni)
      '2025/0001/00292'  // Luto Eterno (invoca Selena - Mãe dos Guerreiros)
    ];
    for (const hCode of heroSummonSpellCodes) {
      const hIdx = bot.hand.findIndex((c) => c.code === hCode);
      if (hIdx !== -1 && canPlayCardInMainPhase(state, 'bot', bot.hand[hIdx]).allowed) {
        const [card] = bot.hand.splice(hIdx, 1);
        const cost = getEffectiveCt(bot, card);
        bot.mana -= cost;
        const slot = chooseBestBotSummonSlot(state);
        return queueBotCardWithReactionCheck(state, card, slot, cost);
      }
    }

    // Second: Direct Hero Summon from Hero Zone (strictly validating canSummonHeroDirectly!)
    if (bot.heroDeck.length > 0) {
      const summonableHeroIdx = bot.heroDeck.findIndex(
        (h) => canSummonHeroDirectly(state, 'bot', h, false).allowed
      );
      if (summonableHeroIdx !== -1) {
        const nextHero = bot.heroDeck[summonableHeroIdx];
        const isJimHero = nextHero.code === '2025/0001/00001';

        let shouldSummonHeroNow = false;
        if (isJimHero) {
          const jimsErased = countJimsInErasedZone(bot);
          const learnedThreshold = Math.max(
            3,
            Math.round(5 * adaptiveMem.weights.winconTimingThresholdScale)
          );
          shouldSummonHeroNow =
            jimsErased >= learnedThreshold ||
            (state.round >= 3 && jimsErased >= Math.max(2, learnedThreshold - 2)) ||
            bot.hp <= 10 ||
            heuristic.posture === 'CRITICAL_SURVIVAL' ||
            (state.round >= 2 &&
              !player.frontline.some((f) => f !== null) &&
              15 + (jimsErased >= 5 ? 15 : 0) + (jimsErased >= 8 ? 15 : 0) >= player.hp);
        } else {
          // Para qualquer outro Herói cujos requisitos oficiais de invocação já foram cumpridos
          // («Mahina - O Arauto do Véu» com 4+ cartas Véu em campo, «Jenos», «Salazar» com 12 Runas, etc.):
          shouldSummonHeroNow = true;
        }

        if (shouldSummonHeroNow) {
          const [heroCard] = bot.heroDeck.splice(summonableHeroIdx, 1);
          payDirectHeroSummonCost(state, 'bot', heroCard);
          const slot = chooseBestBotSummonSlot(state, heroCard);
          return queueBotCardWithReactionCheck(state, heroCard, slot, heroCard.ct);
        }
      }
    }

    // 1F. «Lamento do Rei» (00018) if Hero died this turn
    const lamentoIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00018');
    if (lamentoIdx !== -1 && canPlayCardInMainPhase(state, 'bot', bot.hand[lamentoIdx]).allowed) {
      const [card] = bot.hand.splice(lamentoIdx, 1);
      const cost = getEffectiveCt(bot, card);
      bot.mana -= cost;
      const slot = chooseBestBotSummonSlot(state);
      return queueBotCardWithReactionCheck(state, card, slot, cost);
    }

    // 1G. «Chamado da Variante» (00027) — Prioritize resurrecting a strong Jim from Dead Zone!
    const chamadoIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00027');
    if (
      chamadoIdx !== -1 &&
      bot.deadZone.some((c) => isJimCard(c) && c.type === 'Combatente') &&
      canPlayCardInMainPhase(state, 'bot', bot.hand[chamadoIdx]).allowed
    ) {
      const [card] = bot.hand.splice(chamadoIdx, 1);
      const cost = getEffectiveCt(bot, card);
      bot.mana -= cost;
      const slot = chooseBestBotSummonSlot(state);
      return queueBotCardWithReactionCheck(state, card, slot, cost);
    }

    // 1H. SUMMON BEST FIGHTERS FROM HAND
    // Reserve 1–3 mana for Combat Reactions if Bot already has 2+ fighters on board and holds a reaction card
    const hasCombatReactionInHand = bot.hand.some(
      (c) =>
        c.code === '2025/0001/00023' ||
        c.code === '2025/0001/00024' ||
        c.code === '2025/0001/00028'
    );
    const botBoardCount = bot.frontline.filter((f) => f !== null).length;
    const manaReserve =
      botBoardCount >= 2 && hasCombatReactionInHand
        ? Math.min(
            ...bot.hand
              .filter(
                (c) =>
                  c.code === '2025/0001/00023' ||
                  c.code === '2025/0001/00024' ||
                  c.code === '2025/0001/00028'
              )
              .map((c) => getEffectiveCt(bot, c))
          )
        : 0;

    const playableFighters = bot.hand
      .map((c, idx) => ({ c, idx, cost: getEffectiveCt(bot, c) }))
      .filter(
        (item) =>
          item.c.type === 'Combatente' &&
          item.cost <= bot.mana - (botBoardCount >= 3 ? manaReserve : 0) &&
          bot.frontline.some((s) => s === null)
      );

    if (playableFighters.length > 0) {
      playableFighters.sort(
        (a, b) => scoreJimFighterForBot(state, b.c) - scoreJimFighterForBot(state, a.c)
      );

      const chosen = playableFighters[0];
      bot.hand.splice(chosen.idx, 1);
      bot.mana -= chosen.cost;
      const slot = chooseBestBotSummonSlot(state, chosen.c);
      return queueBotCardWithReactionCheck(state, chosen.c, slot, chosen.cost);
    }

    // 1I. «Portal dos Variantes» (00021) & «Chamado da Variante» (00027 from hand)
    for (const code of ['2025/0001/00021', '2025/0001/00027']) {
      const idx = bot.hand.findIndex((c) => c.code === code);
      if (idx !== -1 && canPlayCardInMainPhase(state, 'bot', bot.hand[idx]).allowed) {
        const [card] = bot.hand.splice(idx, 1);
        const cost = getEffectiveCt(bot, card);
        bot.mana -= cost;
        const slot = chooseBestBotSummonSlot(state);
        return queueBotCardWithReactionCheck(state, card, slot, cost);
      }
    }

    // 1J. «Fragmentar» (00020) Combo — Sacrifice a low-HP / high-CT fighter to feed Erased Zone & swarm 2+ fighters!
    const fragIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00020');
    if (fragIdx !== -1 && canPlayCardInMainPhase(state, 'bot', bot.hand[fragIdx]).allowed) {
      const sacrificeCandidates = bot.frontline.filter(
        (f): f is FieldFighter =>
          f !== null &&
          !f.isHero &&
          f.card.code !== '2025/0001/00010' && // Don't sacrifice Ancião unless dying
          (f.currentHp <= 2 || f.card.ct >= 5)
      );
      if (sacrificeCandidates.length > 0) {
        const sac = sacrificeCandidates[0];
        const summonPool = [
          ...bot.deadZone.filter((c) => c.type === 'Combatente' && c.ct <= sac.card.ct),
          ...bot.hand.filter((c) => c.type === 'Combatente' && c.ct <= sac.card.ct)
        ];
        if (summonPool.length >= 2 || (countJimsInErasedZone(bot) === 4 && bot.heroDeck.length > 0)) {
          const [card] = bot.hand.splice(fragIdx, 1);
          const cost = getEffectiveCt(bot, card);
          bot.mana -= cost;
          return queueBotCardWithReactionCheck(state, card, sac.slotIndex, cost);
        }
      }
    }

    // 1K. EQUIPMENTS: Fighter Equipments («Crueldade», «Gemas Macroversais», Armas/Armaduras dos Estruturais)
    const playableEquips = bot.hand
      .map((c, idx) => ({ c, idx, cost: getEffectiveCt(bot, c) }))
      .filter(
        (item) =>
          item.c.type === 'Equipamento' &&
          !isContinuousBackrowCard(item.c) &&
          canPlayCardInMainPhase(state, 'bot', item.c).allowed
      );

    if (playableEquips.length > 0) {
      const chosen = playableEquips[0];
      let targetSlot = 0;
      if (chosen.c.name.includes('Gema Macroversal')) {
        const heroF = bot.frontline.find((f) => f !== null && f.isHero);
        if (heroF) targetSlot = heroF.slotIndex;
      } else {
        // Equip on highest-HP fighter (Hero or strongest unit)
        const sortedByHp = bot.frontline
          .filter((f): f is FieldFighter => f !== null)
          .sort((a, b) => b.currentHp - a.currentHp);
        if (sortedByHp.length > 0) targetSlot = sortedByHp[0].slotIndex;
      }
      bot.hand.splice(chosen.idx, 1);
      bot.mana -= chosen.cost;
      return queueBotCardWithReactionCheck(state, chosen.c, targetSlot, chosen.cost);
    }

    // 1L. «Manipulação das Realidades» (00026) — Lock Player's next draw!
    const manipIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00026');
    if (
      manipIdx !== -1 &&
      player.skipDrawsUntilGlobalTurn <= state.globalTurn &&
      canPlayCardInMainPhase(state, 'bot', bot.hand[manipIdx]).allowed
    ) {
      const [card] = bot.hand.splice(manipIdx, 1);
      const cost = getEffectiveCt(bot, card);
      bot.mana -= cost;
      return queueBotCardWithReactionCheck(state, card, 0, cost);
    }

    // 1M. CARTAS DE EFEITO DO DECK VÉU E DEMAIS ESTRUTURAIS (Compras, Buscas de Camada, Dano e Buffs)
    const genericEffectIdx = bot.hand.findIndex((c) => {
      if (c.type !== 'Efeito') return false;
      if (isContinuousBackrowCard(c)) return false;
      // Não gasta cartas exclusivamente de reação/pós-combate aqui
      if (
        c.code === '2025/0001/00018' ||
        c.code === '2025/0001/00019' ||
        c.code === '2025/0001/00020' ||
        c.code === '2025/0001/00021' ||
        c.code === '2025/0001/00022' ||
        c.code === '2025/0001/00023' ||
        c.code === '2025/0001/00024' ||
        c.code === '2025/0001/00025' ||
        c.code === '2025/0001/00026' ||
        c.code === '2025/0001/00027' ||
        c.code === '2025/0001/00028' ||
        c.code === '2025/0001/00029' ||
        c.code === '2025/0001/00030' ||
        c.code === '2025/0001/00112'
      ) {
        return false;
      }
      const desc = (c.description || '').toLowerCase();
      if (desc.includes('reação') || desc.includes('negue')) return false;
      if (desc.includes('cause') && !player.frontline.some((f) => f !== null) && state.round === 1) {
        return false;
      }
      return canPlayCardInMainPhase(state, 'bot', c).allowed;
    });

    if (genericEffectIdx !== -1) {
      const [card] = bot.hand.splice(genericEffectIdx, 1);
      const cost = getEffectiveCt(bot, card);
      bot.mana -= cost;
      const targetEnemy = player.frontline.find((f) => f !== null);
      return queueBotCardWithReactionCheck(
        state,
        card,
        targetEnemy ? targetEnemy.slotIndex : 0,
        cost
      );
    }
  }

  // =========================================================================
  // STEP 2: TACTICAL COMBAT PHASE (Round 2+ only!)
  // =========================================================================
  if (state.round >= 2 && !bot.lockedFromAttackingThisTurn) {
    const attackDecision = chooseBestBotAttack(state);
    if (attackDecision) {
      return queueBotAttackWithReactionCheck(
        state,
        attackDecision.attackerSlot,
        attackDecision.targetSlot,
        deferAttackResolution
      );
    }
  }

  // =========================================================================
  // STEP 3: POST-COMBAT FINISHER («Insanidade» 00019 & «Vingança Satisfatória» 00025)
  // =========================================================================
  if (state.round >= 2) {
    const insanidadeIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00019');
    if (insanidadeIdx !== -1 && canPlayCardInMainPhase(state, 'bot', bot.hand[insanidadeIdx]).allowed) {
      const finisherCandidate = bot.frontline
        .filter((f): f is FieldFighter => f !== null && !f.isHero)
        .sort(
          (a, b) =>
            getFighterEffectiveAtk(state, b, true) - getFighterEffectiveAtk(state, a, true)
        )[0];

      if (
        finisherCandidate &&
        (getFighterEffectiveAtk(state, finisherCandidate, true) >= player.hp ||
          (finisherCandidate.hasAttackedThisTurn &&
            getFighterEffectiveAtk(state, finisherCandidate, true) >= 8))
      ) {
        const [card] = bot.hand.splice(insanidadeIdx, 1);
        const cost = getEffectiveCt(bot, card);
        bot.mana -= cost;
        return queueBotCardWithReactionCheck(state, card, finisherCandidate.slotIndex, cost);
      }
    }
  }

  const vingancaIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00025');
  if (vingancaIdx !== -1 && canPlayCardInMainPhase(state, 'bot', bot.hand[vingancaIdx]).allowed) {
    const [card] = bot.hand.splice(vingancaIdx, 1);
    const cost = getEffectiveCt(bot, card);
    bot.mana -= cost;
    // Target enemy fighter that dies to 5 dmg or has highest ATK
    const enemies = player.frontline.filter((f): f is FieldFighter => f !== null);
    enemies.sort((a, b) => {
      const aKill = a.currentHp <= 5 ? 1 : 0;
      const bKill = b.currentHp <= 5 ? 1 : 0;
      if (aKill !== bKill) return bKill - aKill;
      return getFighterEffectiveAtk(state, b, true) - getFighterEffectiveAtk(state, a, true);
    });
    const enemyTarget = enemies[0];
    return queueBotCardWithReactionCheck(
      state,
      card,
      enemyTarget ? enemyTarget.slotIndex : 0,
      cost
    );
  }

  return { acted: false, triggeredReactionWindow: false };
}

function chooseBestBotAttack(
  state: DuelGameState
): { attackerSlot: number; targetSlot: number } | null {
  const bot = state.bot;
  const player = state.player;

  const readyAttackers = bot.frontline.filter(
    (f): f is FieldFighter =>
      f !== null &&
      f.attacksUsedThisTurn < getMaxAttacksPerTurn(state, bot, f) &&
      getFighterEffectiveAtk(state, f, true) > 0
  );
  if (readyAttackers.length === 0) return null;

  const playerFighters = player.frontline.filter((f): f is FieldFighter => f !== null);

  // If Player field is empty, attack directly with the highest-ATK ready fighter!
  if (playerFighters.length === 0) {
    readyAttackers.sort(
      (a, b) => getFighterEffectiveAtk(state, b, true) - getFighterEffectiveAtk(state, a, true)
    );
    return { attackerSlot: readyAttackers[0].slotIndex, targetSlot: -1 };
  }

  const botHasAnciao = bot.frontline.some(
    (f) => f !== null && f.card.code === '2025/0001/00010'
  );
  const playerAnciao = player.frontline.find(
    (f) => f !== null && f.card.code === '2025/0001/00010'
  );

  // Evaluate every (attacker, defender) pair
  let bestPair: { attackerSlot: number; targetSlot: number; score: number } | null = null;

  for (const atk of readyAttackers) {
    const atkVal = getFighterEffectiveAtk(state, atk, true);
    const atkIsSolador = hasArchetype(state, atk, 'Solador');
    const atkIsFurtivo = hasArchetype(state, atk, 'Furtivo');
    const atkIsCaos = hasArchetype(state, atk, 'Caos');
    const atkProtectedByAnciao =
      botHasAnciao && isJimCard(atk.card) && atk.card.code !== '2025/0001/00010';
    const atkLumenRed = countArchetypeStacks(state, atk, 'Lúmen') * 3;

    const isProtectedUtility =
      (atk.card.code === '2025/0001/00005' && state.round === atk.summonedRound) ||
      atk.card.code === '2025/0001/00010' ||
      atk.card.code === '2025/0001/00003';

    for (const def of playerFighters) {
      const defProtectedByPlayerAnciao =
        !atkIsSolador &&
        playerAnciao !== undefined &&
        playerAnciao.instanceId !== def.instanceId &&
        isJimCard(def.card);

      if (defProtectedByPlayerAnciao) {
        continue;
      }

      // [Solador] ignora todas as outras cartas inimigas fora a carta alvo (como equipamentos acoplados ao alvo ou suporte),
      // mas NÃO ignora os arquétipos da própria carta alvo (como [Lúmen] ou [Insano] da carta alvo)!
      const defLumenRed =
        countArchetypeStacks(state, def, 'Lúmen', atkIsSolador, atk.slotIndex) * 3;
      const netDmgToDef = Math.max(0, atkVal - defLumenRed);
      if (netDmgToDef === 0) continue;

      const killsDef = netDmgToDef >= def.currentHp;
      const defAtkVal = getFighterEffectiveAtk(state, def, true, atkIsSolador);
      const netRetaliationDmg =
        atkIsFurtivo || atkProtectedByAnciao ? 0 : Math.max(0, defAtkVal - atkLumenRed);
      const insanoBacklash =
        killsDef && hasArchetype(state, def, 'Insano', atkIsSolador, atk.slotIndex) ? 5 : 0;
      const atkSurvives = atk.currentHp > netRetaliationDmg + insanoBacklash;

      if (isProtectedUtility && !atkSurvives) continue;

      let score = 0;

      if (atkIsCaos && netDmgToDef > def.currentHp) {
        const pierce = netDmgToDef - def.currentHp;
        if (pierce >= player.hp) score += 10000;
        else score += pierce * 25;
      }

      if (killsDef && atkSurvives) {
        score += 500 + def.card.ct * 25 + defAtkVal * 15;
        if (def.card.code === '2025/0001/00010') score += 300;
        if (def.isHero) score += 400;
        if (atk.card.code === '2025/0001/00002') score += 180;
      } else if (killsDef && !atkSurvives) {
        const isFeiticeiraBomb = atk.card.code === '2025/0001/00009';
        const defValue = def.isHero ? 500 : def.card.ct * 30 + defAtkVal * 12;
        const atkValue = atk.isHero ? 900 : atk.card.ct * 25 + atkVal * 10;
        if (isFeiticeiraBomb || defValue >= atkValue) {
          score += 250 + (defValue - atkValue) + (isFeiticeiraBomb ? 200 : 0);
        } else {
          score -= 200;
        }
      } else if (netRetaliationDmg === 0) {
        score += 150 + netDmgToDef * 15;
      } else if (atkSurvives) {
        score += 60 + netDmgToDef * 10 - netRetaliationDmg * 8;
      } else {
        if (atk.card.code === '2025/0001/00009' && netDmgToDef + 8 >= def.currentHp) {
          score += 220;
        } else {
          score -= 500;
        }
      }

      if (score > 0 && (!bestPair || score > bestPair.score)) {
        bestPair = { attackerSlot: atk.slotIndex, targetSlot: def.slotIndex, score };
      }
    }
  }

  return bestPair ? { attackerSlot: bestPair.attackerSlot, targetSlot: bestPair.targetSlot } : null;
}

function chooseBestBotSummonSlot(state: DuelGameState, cardToSummon?: CardData): number {
  const bot = state.bot;
  const player = state.player;

  if (cardToSummon && (cardToSummon.archetype || '').includes('Véu')) {
    const enemyTargets = player.frontline
      .filter((f): f is FieldFighter => f !== null && bot.frontline[f.slotIndex] === null)
      .sort((a, b) => b.card.ct - a.card.ct);
    if (enemyTargets.length > 0) return enemyTargets[0].slotIndex;
  }

  for (let i = 0; i < 6; i++) {
    if (bot.frontline[i] === null) {
      const oppF = player.frontline[i];
      if (!oppF || !oppF.archetypes.includes('Véu')) {
        return i;
      }
    }
  }
  return bot.frontline.findIndex((s) => s === null);
}

function queueBotCardWithReactionCheck(
  state: DuelGameState,
  card: CardData,
  targetSlot: number,
  authorityCt: number
): { acted: boolean; triggeredReactionWindow: boolean } {
  const isHero = card.type === 'Herói';
  const isFighter = card.type === 'Combatente';
  addLog(
    state,
    'bot',
    isHero
      ? `👑 Bot declarou a invocação do Herói «${card.name}» na Coluna ${targetSlot + 1} (Autoridade CT ${card.ct})!`
      : isFighter
      ? `Bot declarou a invocação de «${card.name}» (CT ${authorityCt}) na Coluna ${targetSlot + 1}!`
      : `Bot declarou o uso de «${card.name}» (CT ${authorityCt}).`,
    isHero || isFighter ? 'summon' : 'effect'
  );

  // Apoteose do Véu (2026/0002/00315): "Apenas efeitos de Heróis podem negar esta carta."
  const onlyNegatableByHero = card.code === '2026/0002/00315';

  const playerReactions = getAvailableReactions(
    state,
    'player',
    'CARD_PLAYED',
    authorityCt,
    false,
    onlyNegatableByHero
  );

  const hasAnyPlayerReaction =
    playerReactions.handCards.length > 0 ||
    playerReactions.canUseJimMagoFieldNegate ||
    playerReactions.canUseMahinaVeuFieldNegate ||
    playerReactions.canUseQuintaCamadaNegate ||
    playerReactions.canSummonHeroJimLord;

  if (hasAnyPlayerReaction) {
    state.phase = 'CARD_REACTION';
    state.reactionWindow = {
      type: 'CARD_PLAYED',
      sourceActor: 'bot',
      responder: 'player',
      triggerCard: card,
      triggerActionLabel: isHero
        ? `Bot está invocando o Herói «${card.name}» na Coluna ${targetSlot + 1} (CT ${card.ct})`
        : isFighter
        ? `Bot está invocando «${card.name}» na Coluna ${targetSlot + 1} (CT ${authorityCt})`
        : `Bot ativou «${card.name}» (CT ${authorityCt})`,
      effectiveCtOfTrigger: authorityCt,
      canBeNegatedByMaxCt: card.code === '2025/0001/00001' ? 12 : undefined,
      onlyNegatableByHero,
      pendingPayload: (activeState: DuelGameState) => {
        resolveInsanisCardEffect(activeState, 'bot', card, targetSlot);
      }
    };
    return { acted: true, triggeredReactionWindow: true };
  }

  resolveInsanisCardEffect(state, 'bot', card, targetSlot);
  return { acted: true, triggeredReactionWindow: false };
}

function queueBotAttackWithReactionCheck(
  state: DuelGameState,
  attackerSlot: number,
  targetSlot: number,
  deferAttackResolution = false
): {
  acted: boolean;
  triggeredReactionWindow: boolean;
  deferredBotAttack?: { attackerSlot: number; targetSlot: number };
} {
  const attacker = state.bot.frontline[attackerSlot]!;
  const targetName =
    targetSlot === -1
      ? 'Você (Ataque Direto)'
      : `«${state.player.frontline[targetSlot]?.card.name || 'Alvo'}» (Coluna ${targetSlot + 1})`;

  const attackerIsSolador = hasArchetype(
    state,
    attacker,
    'Solador',
    false,
    targetSlot >= 0 ? targetSlot : undefined
  );

  addLog(
    state,
    'bot',
    `⚔️ Bot declarou ataque com «${attacker.card.name}» (Coluna ${attackerSlot + 1}) contra ${targetName}!`,
    'attack'
  );

  const playerReactions = getAvailableReactions(
    state,
    'player',
    'ATTACK_DECLARED',
    0,
    attackerIsSolador
  );

  const hasAnyPlayerReaction =
    playerReactions.handCards.length > 0 || playerReactions.canSummonHeroJimLord;

  if (hasAnyPlayerReaction) {
    state.phase = 'COMBAT_REACTION';
    state.reactionWindow = {
      type: 'ATTACK_DECLARED',
      sourceActor: 'bot',
      responder: 'player',
      triggerCard: attacker.card,
      triggerActionLabel: `«${attacker.card.name}» (ATK ${getFighterEffectiveAtk(state, attacker, true)}) atacando ${targetName}`,
      attackerSlot,
      targetSlot,
      pendingPayload: (activeState: DuelGameState) => {
        executeCombatResolution(activeState, 'bot', attackerSlot, targetSlot);
      }
    };
    return { acted: true, triggeredReactionWindow: true };
  }

  if (deferAttackResolution) {
    return {
      acted: true,
      triggeredReactionWindow: false,
      deferredBotAttack: { attackerSlot, targetSlot }
    };
  }

  executeCombatResolution(state, 'bot', attackerSlot, targetSlot);
  return { acted: true, triggeredReactionWindow: false };
}

/**
 * Checks if the Player can Counter-Negate a Bot reaction/negation card on the Chain ("Corrente de Reação").
 */
function canPlayerCounterNegateBotReaction(
  state: DuelGameState,
  botReactionCard: CardData,
  botReactionAuthorityCt: number,
  isBotSelamento = false,
  botSelamentoLifePaid = 0
): boolean {
  const p = state.player;

  if (isBotSelamento) {
    const doubleCost = Math.max(2, botSelamentoLifePaid * 2);
    return p.hp > doubleCost;
  }

  if (p.hand.some((c) => c.code === '2025/0001/00029') && p.hp > botReactionAuthorityCt) {
    return true;
  }

  if (
    p.hand.some((c) => c.code === '2026/0002/00322' && p.mana >= getEffectiveCt(p, c, true))
  ) {
    return true;
  }

  if (
    botReactionCard.type === 'Efeito' &&
    botReactionAuthorityCt <= 8 &&
    p.frontline.some((f) => f !== null && f.card.code === '2025/0001/00003')
  ) {
    return true;
  }

  if (
    p.frontline.some((f) => f !== null && f.card.code === '2026/0001/00301') &&
    (p.frontline.some((f) => f !== null && (f.card.name.includes('Véu') || hasArchetype(state, f, 'Véu'))) ||
      p.backrow.some((s) =>
        getAllSupportCardsInSlot(s).some(
          (c) => c.name.includes('Véu') || (c.archetype || '').includes('Véu')
        )
      ))
  ) {
    return true;
  }

  if (hasActiveCamada(p, '2026/0002/00328') && p.runes >= 3) {
    return true;
  }

  return false;
}

export function evaluateBotReactionToPlayerAction(
  state: DuelGameState,
  windowType: 'CARD_PLAYED' | 'ATTACK_DECLARED',
  playerCard: CardData,
  playerCardAuthorityCt: number,
  attackerSlot?: number,
  targetSlot?: number,
  onPlayerActionResolvedIfCountered?: (activeState: DuelGameState) => void
): { botNegatedPlayerAction: boolean; openedCounterChainWindow?: boolean } {
  const bot = state.bot;

  // 0. «Jim - Herói» (2025/0001/00007) — Uma vez por rodada, «A Qualquer Momento», recupera 1 de vida de jogador
  for (const f of bot.frontline) {
    if (f && f.card.code === '2025/0001/00007' && !f.usedOncePerRoundAbility) {
      f.usedOncePerRoundAbility = true;
      bot.hp += 1;
      addLog(
        state,
        'bot',
        `💚 «Jim - Herói» (A Qualquer Momento • 1x por Rodada): Bot recuperou +1 de Vida (Vida atual: ${bot.hp} PV)!`,
        'life_gain'
      );
    }
  }

  if (windowType === 'CARD_PLAYED') {
    const onlyHeroCanNegate = playerCard.code === '2026/0002/00315'; // Apoteose do Véu

    // 1A. «Mahina - O Arauto do Véu» (2026/0001/00301) em campo do Bot:
    // "A Qualquer Momento, você pode descartar uma carta com «Véu» em seu nome do seu lado do campo para a Zona Apagada para negar o uso de uma carta."
    const mahinaHeroOnBotField = bot.frontline.find(
      (f) => f !== null && f.card.code === '2026/0001/00301'
    );
    const nonHeroVeuFighterSlot = bot.frontline.findIndex(
      (f) =>
        f !== null &&
        !f.isHero &&
        (f.card.name.includes('Véu') || hasArchetype(state, f, 'Véu'))
    );
    if (
      mahinaHeroOnBotField &&
      nonHeroVeuFighterSlot !== -1 &&
      (playerCard.type === 'Herói' || playerCardAuthorityCt >= 4 || isContinuousBackrowCard(playerCard))
    ) {
      const sacrificedVeu = bot.frontline[nonHeroVeuFighterSlot]!.card;
      sendFighterFromFieldToZone(state, 'bot', nonHeroVeuFighterSlot, true, false);
      addLog(
        state,
        'bot',
        `🛡️ Reação «A Qualquer Momento» do Bot! «Mahina - O Arauto do Véu» descartou «${sacrificedVeu.name}» do campo para a Zona Apagada para NEGAR «${playerCard.name}»!`,
        'reaction'
      );
      return { botNegatedPlayerAction: true };
    }

    if (!onlyHeroCanNegate) {
      // 1B. «Quinta Camada» (2026/0002/00328) em campo do Bot: Gasta 3 Runas para negar carta inimiga
      if (
        hasActiveCamada(bot, '2026/0002/00328') &&
        bot.runes >= 3 &&
        (playerCard.type === 'Herói' || playerCardAuthorityCt >= 4 || isContinuousBackrowCard(playerCard))
      ) {
        bot.runes -= 3;
        addLog(
          state,
          'bot',
          `🛡️ Reação do Bot! Bot gastou 3 Runas com «Quinta Camada» para NEGAR «${playerCard.name}» (Runas restantes: ${bot.runes})!`,
          'reaction'
        );
        return { botNegatedPlayerAction: true };
      }

      // 1C. «Jim - Mago» (00003) on Bot's field: sacrifice to Erased Zone to negate Player Effect card (CT <= 8)
      const highValueEffectCodes = new Set([
        '2025/0001/00016', // Ascensão do Rei
        '2025/0001/00017', // Busca Pela Eternidade
        '2025/0001/00018', // Lamento do Rei
        '2025/0001/00019', // Insanidade
        '2025/0001/00020', // Fragmentar
        '2025/0001/00021', // Portal dos Variantes
        '2025/0001/00022', // Pacto Forçado
        '2025/0001/00025', // Vingança Satisfatória
        '2025/0001/00026', // Manipulação das Realidades
        '2025/0001/00027', // Chamado da Variante
        '2025/0001/00030', // Destruição das Variantes
        '2025/0001/00116', // Alteração de Realidade
        '2026/0002/00316', // AQUI FOI...
        '2026/0002/00318', // O Papai Chegou
        '2026/0002/00319', // Ritos do Festival
        '2026/0002/00320'  // Ato Final
      ]);

      if (
        playerCard.type === 'Efeito' &&
        playerCard.code !== '2025/0001/00029' &&
        playerCardAuthorityCt <= 8 &&
        (highValueEffectCodes.has(playerCard.code) || playerCardAuthorityCt >= 3)
      ) {
        const magoSlot = bot.frontline.findIndex(
          (f) => f !== null && f.card.code === '2025/0001/00003'
        );
        if (magoSlot !== -1) {
          const magoCard = bot.frontline[magoSlot]!.card;
          sendFighterFromFieldToZone(state, 'bot', magoSlot, true, false);
          addLog(
            state,
            'bot',
            `🛡️ Reação do Bot! Bot descartou «Jim - Mago» do campo para a Zona Apagada para NEGAR «${playerCard.name}»!`,
            'reaction'
          );

          if (
            onPlayerActionResolvedIfCountered &&
            canPlayerCounterNegateBotReaction(state, magoCard, magoCard.ct, false, 0)
          ) {
            state.phase = 'CARD_REACTION';
            state.reactionWindow = {
              type: 'CARD_PLAYED',
              sourceActor: 'bot',
              responder: 'player',
              triggerCard: magoCard,
              triggerActionLabel: `⛓️ CORRENTE: Bot ativou «Jim - Mago» (CT ${magoCard.ct}) para negar «${playerCard.name}»!`,
              effectiveCtOfTrigger: magoCard.ct,
              isCounterChain: true,
              pendingPayload: (activeState: DuelGameState) => {
                sendCardToDeadOrErasedZone(activeState, 'player', playerCard);
                addLog(
                  activeState,
                  'bot',
                  `⛓️ Corrente encerrada: A negação de «Jim - Mago» do Bot prevaleceu e «${playerCard.name}» foi negada!`,
                  'reaction'
                );
              },
              onNegatedPayload: (activeState: DuelGameState) => {
                addLog(
                  activeState,
                  'player',
                  `⛓️ CONTRA-NEGAÇÃO! Você anulou «Jim - Mago» do Bot na corrente! «${playerCard.name}» resolve normalmente!`,
                  'reaction'
                );
                onPlayerActionResolvedIfCountered(activeState);
              }
            };
            return { botNegatedPlayerAction: false, openedCounterChainWindow: true };
          }

          return { botNegatedPlayerAction: true };
        }
      }

      // 2A. «Como Planejado» (2026/0002/00322, CT 6) na mão do Bot:
      // "Negue o uso de uma carta e envie-a para a sua Zona Apagada. Na próxima rodada, use-a sem pagar custos."
      const comoPlanejadoIdx = bot.hand.findIndex((c) => c.code === '2026/0002/00322');
      if (comoPlanejadoIdx !== -1) {
        const cpCard = bot.hand[comoPlanejadoIdx];
        const cpCost = getEffectiveCt(bot, cpCard, true);
        const worthStealing =
          playerCard.type === 'Herói' ||
          isContinuousBackrowCard(playerCard) ||
          playerCardAuthorityCt >= 3;
        if (bot.mana >= cpCost && worthStealing) {
          bot.hand.splice(comoPlanejadoIdx, 1);
          bot.mana -= cpCost;
          discardCardDirectlyToZone(state, 'bot', cpCard, false);

          // Envia a carta negada do jogador para a Zona Apagada do Bot e agenda para a próxima rodada!
          bot.erasedZone.push(playerCard);
          bot.pendingComoPlanejadoCards.push({
            card: playerCard,
            readyOnRound: state.round + 1
          });

          addLog(
            state,
            'bot',
            `🛡️ Reação do Bot! Bot ativou «Como Planejado» (CT ${cpCost}) para NEGAR «${playerCard.name}», enviou-a para a Zona Apagada do Bot e irá usá-la sem custos na Rodada ${state.round + 1}!`,
            'reaction'
          );
          return { botNegatedPlayerAction: true };
        }
      }

      // 2B. «Selamento Verdadeiro» (00029) in Bot's hand: pay life equal to Player's card CT to negate!
      const selamentoIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00029');
      const isCriticalCardToNegate =
        playerCard.type === 'Herói' ||
        isContinuousBackrowCard(playerCard) ||
        playerCard.code === '2025/0001/00019' || // Insanidade
        playerCard.code === '2025/0001/00030' || // Destruição das Variantes
        playerCard.code === '2025/0001/00018' || // Lamento do Rei
        playerCard.code === '2025/0001/00012' || // Crueldade
        playerCard.code === '2025/0001/00022' || // Pacto Forçado
        playerCard.code === '2025/0001/00026' || // Manipulação das Realidades
        playerCard.code === '2025/0001/00116' || // Alteração de Realidade
        playerCard.code === '2026/0002/00316' || // AQUI FOI...
        playerCard.code === '2026/0002/00318' || // O Papai Chegou
        playerCard.code === '2026/0002/00320' || // Ato Final
        playerCardAuthorityCt >= 4;

      if (
        selamentoIdx !== -1 &&
        isCriticalCardToNegate &&
        bot.hp > playerCardAuthorityCt + 3
      ) {
        const [selamento] = bot.hand.splice(selamentoIdx, 1);
        bot.hp -= playerCardAuthorityCt;
        addLog(
          state,
          'bot',
          `🛡️ Reação «A Qualquer Momento» do Bot! Bot ativou «Selamento Verdadeiro» pagando ${playerCardAuthorityCt} PV para NEGAR «${playerCard.name}»!`,
          'reaction'
        );

        if (
          onPlayerActionResolvedIfCountered &&
          canPlayerCounterNegateBotReaction(state, selamento, 0, true, playerCardAuthorityCt)
        ) {
          const doubleLifeCost = Math.max(2, playerCardAuthorityCt * 2);
          state.phase = 'CARD_REACTION';
          state.reactionWindow = {
            type: 'CARD_PLAYED',
            sourceActor: 'bot',
            responder: 'player',
            triggerCard: selamento,
            triggerActionLabel: `⛓️ CORRENTE: Bot usou «Selamento Verdadeiro» (pagou ${playerCardAuthorityCt} PV) para negar «${playerCard.name}»!`,
            effectiveCtOfTrigger: 0,
            isSelamentoTrigger: true,
            selamentoLifePaid: playerCardAuthorityCt,
            selamentoDoubleLifeCost: doubleLifeCost,
            isCounterChain: true,
            pendingPayload: (activeState: DuelGameState) => {
              discardCardDirectlyToZone(activeState, 'bot', selamento, false);
              sendCardToDeadOrErasedZone(activeState, 'player', playerCard);
              addLog(
                activeState,
                'bot',
                `⛓️ Corrente encerrada: «Selamento Verdadeiro» do Bot prevaleceu e «${playerCard.name}» foi negada!`,
                'reaction'
              );
            },
            onNegatedPayload: (activeState: DuelGameState) => {
              discardCardDirectlyToZone(activeState, 'bot', selamento, false);
              addLog(
                activeState,
                'player',
                `⛓️ CONTRA-NEGAÇÃO! Você anulou o «Selamento Verdadeiro» do Bot na corrente! «${playerCard.name}» resolve normalmente!`,
                'reaction'
              );
              onPlayerActionResolvedIfCountered(activeState);
            }
          };
          return { botNegatedPlayerAction: false, openedCounterChainWindow: true };
        }

        discardCardDirectlyToZone(state, 'bot', selamento, false);
        return { botNegatedPlayerAction: true };
      }
    }

    // 3. Reactive Hero Summon ("A Qualquer Momento") — APENAS «Jim - O Senhor do Macroverso» (2025/0001/00001) possui "Invoque a qualquer momento"!
    if (
      bot.heroDeck.length > 0 &&
      canSummonHeroDirectly(state, 'bot', bot.heroDeck[0], true).allowed &&
      (countJimsInErasedZone(bot) >= 5 || (playerCard.type === 'Herói' && countJimsInErasedZone(bot) >= 4))
    ) {
      const botHero = bot.heroDeck.shift()!;
      const slot = chooseBestBotSummonSlot(state, botHero);
      addLog(
        state,
        'bot',
        `🛡️ Reação «A Qualquer Momento» do Bot! Com ${countJimsInErasedZone(bot)} «Jim» na Zona Apagada, o Bot invocou «${botHero.name}» na Coluna ${slot + 1}!`,
        'reaction'
      );
      summonFighterToSlot(state, 'bot', botHero, slot);
    }
  }

  if (windowType === 'ATTACK_DECLARED') {
    const attacker =
      attackerSlot !== undefined ? state.player.frontline[attackerSlot] : null;
    const attackerIsSolador = attacker ? hasArchetype(state, attacker, 'Solador') : false;

    // 1. Reactive Hero Summon ("A Qualquer Momento") — APENAS «Jim - O Senhor do Macroverso» (2025/0001/00001) pode entrar em reação ao ataque!
    if (
      bot.heroDeck.length > 0 &&
      canSummonHeroDirectly(state, 'bot', bot.heroDeck[0], true).allowed &&
      (targetSlot === -1 || countJimsInErasedZone(bot) >= 5)
    ) {
      const botHero = bot.heroDeck.shift()!;
      const slot = chooseBestBotSummonSlot(state, botHero);
      addLog(
        state,
        'bot',
        `🛡️ Reação «A Qualquer Momento» do Bot! O Bot invocou o Herói «${botHero.name}» na Coluna ${slot + 1} em resposta ao seu ataque!`,
        'reaction'
      );
      summonFighterToSlot(state, 'bot', botHero, slot);
      if (targetSlot === -1) {
        return { botNegatedPlayerAction: true };
      }
    }

    // 1B. «Coragem ao Contrário» (2026/0002/00317, CT 3) ou «Férias» (2025/0001/00112, CT 4) em resposta a ataque letal ou direto!
    if (!attackerIsSolador && attacker) {
      const coragemIdx = bot.hand.findIndex((c) => c.code === '2026/0002/00317');
      if (coragemIdx !== -1) {
        const cost = getEffectiveCt(bot, bot.hand[coragemIdx], true);
        const defender = targetSlot !== undefined && targetSlot >= 0 ? bot.frontline[targetSlot] : null;
        const incomingDmg = getFighterEffectiveAtk(state, attacker, true);
        if (
          bot.mana >= cost &&
          (targetSlot === -1 || (defender && incomingDmg >= defender.currentHp))
        ) {
          const [coragem] = bot.hand.splice(coragemIdx, 1);
          bot.mana -= cost;
          discardCardDirectlyToZone(state, 'bot', coragem, false);
          if (defender && !defender.isHero) {
            bot.frontline[defender.slotIndex] = null;
            for (const eq of defender.equipments) discardCardDirectlyToZone(state, 'bot', eq.card, false);
            bot.hand.push(defender.card);
          }
          const drawn = bot.deck.shift();
          if (drawn) bot.hand.push(drawn);
          attacker.attacksUsedThisTurn += 1;
          attacker.hasAttackedThisTurn =
            attacker.attacksUsedThisTurn >= getMaxAttacksPerTurn(state, state.player, attacker);
          state.player.hasAttackedInCurrentTurn = true;
          addLog(
            state,
            'bot',
            `🛡️ Reação de Combate do Bot! Bot ativou «Coragem ao Contrário» (CT ${cost}), cancelou o ataque de «${attacker.card.name}» e comprou 1 carta!`,
            'reaction'
          );
          return { botNegatedPlayerAction: true };
        }
      }

      const feriasIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00112');
      if (feriasIdx !== -1) {
        const cost = getEffectiveCt(bot, bot.hand[feriasIdx], true);
        const defender = targetSlot !== undefined && targetSlot >= 0 ? bot.frontline[targetSlot] : null;
        const incomingDmg = getFighterEffectiveAtk(state, attacker, true);
        if (
          bot.mana >= cost &&
          (targetSlot === -1 || (defender && incomingDmg >= defender.currentHp))
        ) {
          const [ferias] = bot.hand.splice(feriasIdx, 1);
          bot.mana -= cost;
          discardCardDirectlyToZone(state, 'bot', ferias, false);
          attacker.attacksUsedThisTurn += 1;
          attacker.hasAttackedThisTurn =
            attacker.attacksUsedThisTurn >= getMaxAttacksPerTurn(state, state.player, attacker);
          state.player.hasAttackedInCurrentTurn = true;
          addLog(
            state,
            'bot',
            `🛡️ Reação de Combate do Bot! Bot ativou «Férias» (CT ${cost}) e negou o ataque de «${attacker.card.name}»!`,
            'reaction'
          );
          return { botNegatedPlayerAction: true };
        }
      }
    }

    if (targetSlot !== undefined && targetSlot >= 0 && attacker && !attackerIsSolador) {
      const defender = bot.frontline[targetSlot];
      if (defender) {
        const incomingDmg = getFighterEffectiveAtk(state, attacker, true);
        const defLumenRed = countArchetypeStacks(state, defender, 'Lúmen') * 3;
        const netIncoming = Math.max(0, incomingDmg - defLumenRed);

        if (netIncoming >= defender.currentHp) {
          // 2A. «Ligação das Variantes» (2025/0001/00023, CT 1)
          const ligacaoIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00023');
          if (ligacaoIdx !== -1) {
            const cost = getEffectiveCt(bot, bot.hand[ligacaoIdx], true);
            const tankAlly = bot.frontline.find(
              (f) =>
                f !== null &&
                f.slotIndex !== targetSlot &&
                f.currentHp > incomingDmg
            );
            if (bot.mana >= cost && tankAlly) {
              const [ligacao] = bot.hand.splice(ligacaoIdx, 1);
              bot.mana -= cost;
              discardCardDirectlyToZone(state, 'bot', ligacao, false);
              const fA = bot.frontline[targetSlot]!;
              const fB = bot.frontline[tankAlly.slotIndex]!;
              bot.frontline[targetSlot] = { ...fB, slotIndex: targetSlot };
              bot.frontline[tankAlly.slotIndex] = { ...fA, slotIndex: tankAlly.slotIndex };
              addLog(
                state,
                'bot',
                `🛡️ Reação de Combate do Bot! Bot usou «Ligação das Variantes» (CT ${cost}) e trocou «${fA.card.name}» por «${fB.card.name}» para absorver o ataque!`,
                'reaction'
              );
              return { botNegatedPlayerAction: false };
            }
          }

          // 2B. «Disfarce de Mestre» (2025/0001/00028, CT 7)
          const disfarceIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00028');
          if (disfarceIdx !== -1 && !defender.isHero) {
            const cost = getEffectiveCt(bot, bot.hand[disfarceIdx], true);
            if (bot.mana >= cost) {
              const swapCandidates = [
                ...bot.erasedZone
                  .filter((c) => c.type === 'Combatente' && c.defense > defender.currentHp)
                  .map((c) => ({ card: c, zone: 'erased' as const })),
                ...bot.hand
                  .filter(
                    (c, i) =>
                      i !== disfarceIdx &&
                      c.type === 'Combatente' &&
                      c.defense > defender.currentHp
                  )
                  .map((c) => ({ card: c, zone: 'hand' as const }))
              ].sort((a, b) => b.card.defense + b.card.attack - (a.card.defense + a.card.attack));

              if (swapCandidates.length > 0) {
                const [disfarce] = bot.hand.splice(disfarceIdx, 1);
                bot.mana -= cost;
                discardCardDirectlyToZone(state, 'bot', disfarce, false);
                const chosen = swapCandidates[0];
                if (chosen.zone === 'erased') {
                  const eIdx = bot.erasedZone.indexOf(chosen.card);
                  if (eIdx !== -1) bot.erasedZone.splice(eIdx, 1);
                } else {
                  const hIdx = bot.hand.indexOf(chosen.card);
                  if (hIdx !== -1) bot.hand.splice(hIdx, 1);
                }
                sendFighterFromFieldToZone(state, 'bot', targetSlot, true, false);
                summonFighterToSlot(state, 'bot', chosen.card, targetSlot);
                addLog(
                  state,
                  'bot',
                  `🛡️ Reação de Combate do Bot! Bot ativou «Disfarce de Mestre» (CT ${cost}) e substituiu «${defender.card.name}» por «${chosen.card.name}» na Coluna ${targetSlot + 1}!`,
                  'reaction'
                );
                return { botNegatedPlayerAction: false };
              }
            }
          }

          // 2C. «Sobrevivência Covarde» (2025/0001/00024, CT 3)
          const sobrevIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00024');
          if (sobrevIdx !== -1 && !defender.isHero) {
            const cost = getEffectiveCt(bot, bot.hand[sobrevIdx], true);
            if (bot.mana >= cost) {
              const [sobrev] = bot.hand.splice(sobrevIdx, 1);
              bot.mana -= cost;

              const executeSobrevivencia = (activeState: DuelGameState) => {
                discardCardDirectlyToZone(activeState, 'bot', sobrev, false);
                const curDef = activeState.bot.frontline[targetSlot];
                if (curDef) {
                  activeState.bot.frontline[targetSlot] = null;
                  for (const eq of curDef.equipments) {
                    discardCardDirectlyToZone(activeState, 'bot', eq.card, false);
                  }
                  activeState.bot.deck.push(curDef.card);
                  activeState.bot.deck = shuffleCards(activeState.bot.deck);
                }
                if (attackerSlot !== undefined && activeState.player.frontline[attackerSlot]) {
                  const attF = activeState.player.frontline[attackerSlot]!;
                  attF.attacksUsedThisTurn += 1;
                  attF.hasAttackedThisTurn =
                    attF.attacksUsedThisTurn >=
                    getMaxAttacksPerTurn(activeState, activeState.player, attF);
                  activeState.player.hasAttackedInCurrentTurn = true;
                }
              };

              addLog(
                state,
                'bot',
                `🛡️ Reação de Combate do Bot! Bot ativou «Sobrevivência Covarde» (CT ${cost}) para negar seu ataque e retornar «${defender.card.name}» ao Deck!`,
                'reaction'
              );

              if (
                onPlayerActionResolvedIfCountered &&
                canPlayerCounterNegateBotReaction(state, sobrev, cost, false, 0)
              ) {
                state.phase = 'CARD_REACTION';
                state.reactionWindow = {
                  type: 'CARD_PLAYED',
                  sourceActor: 'bot',
                  responder: 'player',
                  triggerCard: sobrev,
                  triggerActionLabel: `⛓️ CORRENTE: Bot ativou «Sobrevivência Covarde» (CT ${cost}) para negar o ataque de «${attacker.card.name}»!`,
                  effectiveCtOfTrigger: cost,
                  isCounterChain: true,
                  pendingPayload: (activeState: DuelGameState) => {
                    executeSobrevivencia(activeState);
                    addLog(
                      activeState,
                      'bot',
                      `⛓️ Corrente encerrada: «Sobrevivência Covarde» do Bot negou o ataque e salvou «${defender.card.name}»!`,
                      'reaction'
                    );
                  },
                  onNegatedPayload: (activeState: DuelGameState) => {
                    discardCardDirectlyToZone(activeState, 'bot', sobrev, false);
                    addLog(
                      activeState,
                      'player',
                      `⛓️ CONTRA-NEGAÇÃO! Você anulou «Sobrevivência Covarde» do Bot na corrente! O seu ataque prossegue normalmente!`,
                      'reaction'
                    );
                    onPlayerActionResolvedIfCountered(activeState);
                  }
                };
                return { botNegatedPlayerAction: false, openedCounterChainWindow: true };
              }

              executeSobrevivencia(state);
              return { botNegatedPlayerAction: true };
            }
          }
        }
      }
    }
  }

  return { botNegatedPlayerAction: false };
}
