import { allCards } from '../data';
import { getBaseCardCode } from '../CardContext';
import { readBrowserCache } from '../firebase';
import { CardData } from '../types';
import {
  ChoiceCandidate,
  DuelGameState,
  DuelLogType,
  FieldFighter,
  HeuristicEvaluationResult,
  PlayerDuelState,
  PlayerId,
  PlayerSideHeuristic
} from './botTypes';

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

export function getInsanisCards(liveCards?: CardData[]): CardData[] {
  return allCards
    .filter((c) => c.collection === 'Insanis')
    .map((c) => resolveModernCardVersion(c, liveCards));
}

export function isJimCard(card: CardData): boolean {
  return card.name.includes('Jim');
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

export function parseBaseArchetypes(card: CardData): string[] {
  if (!card.archetype || !card.archetype.trim()) return [];
  return card.archetype
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function shuffleCards<T>(arr: T[]): T[] {
  const res = [...arr];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
}

export function buildInsanisDeck(
  _mode: 'structural_29' | 'optimized_40',
  liveCards?: CardData[]
): {
  mainDeck: CardData[];
  heroDeck: CardData[];
} {
  // Regra Oficial Light Dark TCG: Não vão cartas repetidas (1 cópia de cada) e máximo de 35 cartas contando com o Herói.
  const insanis = getInsanisCards(liveCards);
  const hero = insanis.find((c) => c.code === '2025/0001/00001');
  const uniqueMainCards: CardData[] = [];
  const seenCodes = new Set<string>();

  for (const card of insanis) {
    if (card.type === 'Herói') continue;
    if (!seenCodes.has(card.code) && uniqueMainCards.length < 34) {
      seenCodes.add(card.code);
      uniqueMainCards.push({ ...card });
    }
  }

  return {
    mainDeck: shuffleCards(uniqueMainCards),
    heroDeck: hero ? [{ ...hero }] : []
  };
}

export function createInitialPlayerState(
  id: PlayerId,
  name: string,
  deckMode: 'structural_29' | 'optimized_40',
  liveCards?: CardData[]
): PlayerDuelState {
  const { mainDeck, heroDeck } = buildInsanisDeck(deckMode, liveCards);
  const hand = mainDeck.slice(0, 5);
  const remainingDeck = mainDeck.slice(5);

  return {
    id,
    name,
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
    pendingPactoLifeLossNextRound: 0,
    skipDrawsUntilGlobalTurn: 0,
    hasAttackedInCurrentTurn: false,
    lockedFromAttackingThisTurn: false,
    lostFighterInBattleThisTurn: false,
    heroDiedThisTurn: false
  };
}

export function createInitialDuelState(
  deckMode: 'structural_29' | 'optimized_40' = 'structural_29',
  liveCards?: CardData[]
): DuelGameState {
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
    player: createInitialPlayerState('player', 'Você', deckMode, liveCards),
    bot: createInitialPlayerState('bot', 'Bot Insanis (Nível 3)', deckMode, liveCards),
    reactionWindow: null,
    pendingChoiceQueue: [],
    pendingGuerreiroSplashDamage: false,
    logs: [
      {
        id: nextUid('log'),
        round: 1,
        turn: 1,
        actor: 'system',
        text: `Rolagem de Iniciativa (1D20): Você tirou ${pRoll} vs Bot tirou ${bRoll}.`,
        type: 'info'
      }
    ],
    deckMode
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

export function getEffectiveCt(p: PlayerDuelState, card: CardData, extraReduction = 0): number {
  if (card.type === 'Herói') return 0;
  if (card.code === '2025/0001/00029') return 0;
  const raw = card.ct - p.ctReductionThisRound - extraReduction;
  return Math.max(0, raw);
}

export function getCardAuthorityCt(p: PlayerDuelState, card: CardData): number {
  if (card.type === 'Herói') return card.ct;
  return getEffectiveCt(p, card);
}

export function getEffectiveArchetypes(
  state: DuelGameState,
  fighter: FieldFighter
): string[] {
  const opp = getPlayerState(state, getOpponentId(fighter.owner));
  const oppositeFighter = opp.frontline[fighter.slotIndex];

  if (oppositeFighter) {
    const oppRawArchs = [
      ...oppositeFighter.archetypes,
      ...oppositeFighter.equipments.flatMap((e) => e.grantedArchetypes || [])
    ];
    if (oppRawArchs.includes('Véu')) {
      return [];
    }
  }

  const list = [...fighter.archetypes];
  const hasDivindade = list.includes('Divindade');

  for (const eq of fighter.equipments) {
    if (eq.grantedArchetypes && eq.grantedArchetypes.length > 0) {
      for (const a of eq.grantedArchetypes) {
        list.push(a);
        if (hasDivindade && (a === 'Lúmen' || a === 'Darkus')) {
          list.push(a);
        }
      }
    }
  }

  return list;
}

export function countArchetypeStacks(
  state: DuelGameState,
  fighter: FieldFighter,
  archName: string
): number {
  return getEffectiveArchetypes(state, fighter).filter((a) => a === archName).length;
}

export function hasArchetype(
  state: DuelGameState,
  fighter: FieldFighter,
  archName: string
): boolean {
  return countArchetypeStacks(state, fighter, archName) > 0;
}

export function getFighterEffectiveAtk(
  state: DuelGameState,
  fighter: FieldFighter,
  inCombat = false
): number {
  const ownerState = getPlayerState(state, fighter.owner);
  let atk = fighter.baseAtk + fighter.permAtkBonus + fighter.tempAtkBonus;

  if (fighter.card.code === '2025/0001/00004') {
    const erasedJimFighters = ownerState.erasedZone.filter(
      (c) => isJimCard(c) && (c.type === 'Combatente' || c.type === 'Herói')
    ).length;
    atk += erasedJimFighters * 2;
  }

  if (inCombat && fighter.card.code === '2025/0001/00006') {
    atk += 8;
  }

  return Math.max(0, atk);
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

export function checkWinCondition(state: DuelGameState): boolean {
  if (state.phase === 'GAME_OVER') return true;

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
    state.winReason = 'Seus Pontos de Vida chegaram a 0. Vitória do Bot Insanis!';
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
  target.hp = Math.max(0, target.hp - amount);
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

  return fighter;
}

export function applyEffectDamageToFighter(
  state: DuelGameState,
  sourcePlayerId: PlayerId,
  targetOwnerId: PlayerId,
  targetSlotIndex: number,
  rawDamage: number,
  sourceCard: CardData,
  sourceEffectiveCt: number
) {
  const targetOwner = getPlayerState(state, targetOwnerId);
  let actualSlot = targetSlotIndex;
  let targetFighter = targetOwner.frontline[actualSlot];
  if (!targetFighter) return;

  const isEnemyEffect = sourcePlayerId !== targetOwnerId;

  if (isEnemyEffect) {
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
    return;
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
    return;
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
  }
}

export function summonFighterToSlot(
  state: DuelGameState,
  ownerId: PlayerId,
  card: CardData,
  slotIndex: number
): FieldFighter {
  const owner = getPlayerState(state, ownerId);
  const opp = getPlayerState(state, getOpponentId(ownerId));
  const isHero = card.type === 'Herói';

  if (isHero) {
    const existingHeroSlot = owner.frontline.findIndex((f) => f !== null && f.isHero);
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
    `✨ ${owner.name} invocou «${card.name}» na Coluna ${slotIndex + 1} (ATK ${getFighterEffectiveAtk(state, fighter)} / Vida ${fighter.currentHp}).`,
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

  return fighter;
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

  attacker.hasAttackedThisTurn = true;
  atkOwner.hasAttackedInCurrentTurn = true;

  const attackerAtk = getFighterEffectiveAtk(state, attacker, true);
  const hasGema3 = attacker.equipments.some((e) => e.card.code === '2025/0001/00014');
  const isAttackerDivindade = hasArchetype(state, attacker, 'Divindade');
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
    dealDamageToPlayer(
      state,
      defOwnerId,
      attackerOwnerId,
      finalDirectDmg,
      `Ataque Direto de «${attacker.card.name}»`
    );
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

  const attackerIsSolador = hasArchetype(state, attacker, 'Solador');
  const defenderIsSolador = hasArchetype(state, defender, 'Solador');
  const anySolador = attackerIsSolador || defenderIsSolador;

  if (anySolador) {
    addLog(
      state,
      'system',
      `Arquétipo [Solador] ativo: Nenhuma carta, equipamento ou efeito externo pode interferir neste combate!`,
      'attack'
    );
  }

  const defenderAtk = getFighterEffectiveAtk(state, defender, true);

  let dmgToDefender = attackerAtk;
  if (isProtectedByJimAnciao(state, defender, attackerIsSolador)) {
    dmgToDefender = 0;
    addLog(
      state,
      defOwnerId,
      `Efeito de «Jim - Ancião»: Protegeu «${defender.card.name}» de todo o dano de combate!`,
      'effect'
    );
  } else {
    const defLumen = countArchetypeStacks(state, defender, 'Lúmen');
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
  if (hasArchetype(state, attacker, 'Furtivo')) {
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
    const atkLumen = countArchetypeStacks(state, attacker, 'Lúmen');
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

  const excessDamage = dmgToDefender - defenderHpBefore;
  if (excessDamage > 0) {
    if (hasArchetype(state, attacker, 'Caos')) {
      const caosDmg = excessDamage * playerDmgMultiplier;
      addLog(
        state,
        attackerOwnerId,
        `Arquétipo [Caos]: ${caosDmg} de dano excedente perfurou para a vida de ${defOwner.name}!`,
        'life_loss'
      );
      dealDamageToPlayer(
        state,
        defOwnerId,
        attackerOwnerId,
        caosDmg,
        `Dano Excedente [Caos] de «${attacker.card.name}»`
      );
    }
    if (hasArchetype(state, attacker, 'Ordem')) {
      atkOwner.hp += excessDamage;
      addLog(
        state,
        attackerOwnerId,
        `💚 Arquétipo [Ordem]: ${atkOwner.name} recuperou +${excessDamage} PV pelo dano excedente (Vida: ${atkOwner.hp} PV)!`,
        'life_gain'
      );
    }
  }

  const defenderDied = defender.currentHp <= 0;

  if (defenderDied) {
    const defHadInsano = hasArchetype(state, defender, 'Insano');
    const isFeiticeira = defender.card.code === '2025/0001/00009';

    sendFighterFromFieldToZone(state, defOwnerId, targetSlot, false, true);

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

    // Jim - Guerreiro (2025/0001/00002): "Sempre que este combatente eliminar outro combatente, cause 5 de dano a outro combatente no campo."
    if (attacker.card.code === '2025/0001/00002' && !anySolador) {
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
    const atkHadInsano = hasArchetype(state, attacker, 'Insano');
    const atkIsFeiticeira = attacker.card.code === '2025/0001/00009';

    sendFighterFromFieldToZone(state, attackerOwnerId, attackerSlot, false, true);

    if (atkHadInsano && defOwner.frontline[targetSlot]) {
      const survivingDef = defOwner.frontline[targetSlot]!;
      survivingDef.currentHp -= 5;
      addLog(
        state,
        attackerOwnerId,
        `💔 Arquétipo [Insano]: «${attacker.card.name}» causou 5 de dano direto em «${survivingDef.card.name}»!`,
        'life_loss'
      );
      if (survivingDef.currentHp <= 0) {
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

  if (!anySolador) {
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

        // «Jim - Rei Elfo» (2025/0001/00005): Invoca automaticamente 1 «Jim» do DECK na rodada seguinte à sua invocação!
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
        if (s.card.code === '2025/0001/00016') {
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
              p.erasedZone.push(sentJim);
              addLog(
                state,
                pid,
                `«Ascensão do Rei»: Bot enviou «${sentJim.name}» do Deck para a Zona Apagada (${countJimsInErasedZone(p)} «Jim» na Zona Apagada).`,
                'effect'
              );
            }
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
    `Início da Rodada ${state.round}: Mana de ambos os jogadores restaurada para 12!`,
    'info'
  );
}

export function hasPlayerAnytimeActionsAvailable(state: DuelGameState): boolean {
  const p = state.player;
  if (p.heroDeck.length > 0 && p.frontline.some((s) => s === null)) {
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
    if (f) f.hasAttackedThisTurn = false;
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
    const opp = getPlayerState(state, getOpponentId(pid));

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

      if (f.card.code === '2025/0001/00008' && pid === state.activePlayer) {
        const sortudoCount = p.frontline.filter(
          (ally) => ally !== null && hasArchetype(state, ally, 'Sortudo')
        ).length;
        let bestRoll = Math.floor(Math.random() * 4) + 1;
        for (let i = 0; i < sortudoCount; i++) {
          const extra = Math.floor(Math.random() * 4) + 1;
          if (extra > bestRoll) bestRoll = extra;
        }
        const removed = Math.min(opp.mana, bestRoll);
        opp.mana -= removed;
        addLog(
          state,
          pid,
          `«Jim - Arqueira» rolou 1D4 (${bestRoll}) e removeu ${removed} de Mana de ${opp.name} (Mana restante: ${opp.mana})!`,
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
    if (!p.frontline.some((s) => s === null) && !p.frontline.some((f) => f !== null && f.isHero)) {
      return { allowed: false, reason: 'Todas as 6 colunas estão ocupadas.' };
    }
    return { allowed: true };
  }

  if (p.mana < effCt) {
    return { allowed: false, reason: `Mana insuficiente (${p.mana}/${effCt} CT).` };
  }

  if (card.type === 'Combatente') {
    const hasEmptyFront = p.frontline.some((s) => s === null);
    if (!hasEmptyFront) {
      return { allowed: false, reason: 'Todas as 6 colunas de Combatentes estão ocupadas.' };
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
    case '2025/0001/00016':
    case '2025/0001/00017':
      if (!p.backrow.some((s) => s === null)) {
        return { allowed: false, reason: 'Suas 6 zonas de suporte atrás estão cheias.' };
      }
      return { allowed: true };

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
      return { allowed: true };

    case '2025/0001/00023':
    case '2025/0001/00024':
    case '2025/0001/00028':
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
      return { allowed: false, reason: '«Selamento Verdadeiro» é usado em reação para negar uma carta do oponente.' };

    case '2025/0001/00030':
      if (p.hp <= 8) {
        return { allowed: false, reason: 'Você precisa ter mais de 8 PV para pagar o custo de 8 de vida.' };
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
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

  if (card.type === 'Combatente' || card.type === 'Herói') {
    summonFighterToSlot(state, actorId, card, targetSlot);
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
    case '2025/0001/00016':
    case '2025/0001/00017': {
      const desiredSlot =
        p.backrow[targetSlot] === null
          ? targetSlot
          : p.backrow.findIndex((s) => s === null);
      if (desiredSlot !== -1) {
        p.backrow[desiredSlot] = {
          instanceId: nextUid('sup'),
          card,
          slotIndex: desiredSlot,
          owner: actorId,
          usedOncePerRound: false
        };
        addLog(
          state,
          actorId,
          `${p.name} ativou o efeito contínuo «${card.name}» na Zona de Suporte ${desiredSlot + 1}.`,
          'effect'
        );
      } else {
        p.deadZone.push(card);
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
      p.deadZone.push(card);
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

    default:
      p.deadZone.push(card);
      break;
  }
}

export function getAvailableReactions(
  state: DuelGameState,
  responderId: PlayerId,
  windowType: 'CARD_PLAYED' | 'ATTACK_DECLARED',
  triggerAuthorityCt = 0,
  attackerIsSolador = false
): {
  handCards: CardData[];
  canUseJimMagoFieldNegate: boolean;
  canSummonHeroJimLord: boolean;
} {
  const resp = getPlayerState(state, responderId);

  if (windowType === 'ATTACK_DECLARED' && attackerIsSolador) {
    return { handCards: [], canUseJimMagoFieldNegate: false, canSummonHeroJimLord: false };
  }

  const handCards: CardData[] = [];

  for (const c of resp.hand) {
    const effCt = getEffectiveCt(resp, c);

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
      } else if (c.code === '2025/0001/00024') {
        handCards.push(c);
      } else if (c.code === '2025/0001/00028') {
        const hasSwapCandidate =
          resp.hand.some((hc) => hc.type === 'Combatente') ||
          resp.erasedZone.some((ec) => ec.type === 'Combatente');
        if (hasSwapCandidate) handCards.push(c);
      }
    } else {
      const check = canPlayCardInMainPhase(state, responderId, c);
      if (check.allowed) {
        handCards.push(c);
      }
    }
  }

  const canUseJimMagoFieldNegate =
    windowType === 'CARD_PLAYED' &&
    triggerAuthorityCt <= 8 &&
    resp.frontline.some((f) => f !== null && f.card.code === '2025/0001/00003');

  const heroCard = resp.heroDeck[0];
  const canSummonHeroJimLord =
    Boolean(heroCard) && resp.frontline.some((s) => s === null);

  return {
    handCards,
    canUseJimMagoFieldNegate,
    canSummonHeroJimLord
  };
}

export function performBotSmartMulligan(state: DuelGameState) {
  const bot = state.bot;
  const lowCtFighters = bot.hand.filter((c) => c.type === 'Combatente' && c.ct <= 5).length;
  const hasEngineStarter = bot.hand.some(
    (c) =>
      c.code === '2025/0001/00030' || // Destruição das Variantes
      c.code === '2025/0001/00016' || // Ascensão do Rei
      c.code === '2025/0001/00017' || // Busca Pela Eternidade
      c.code === '2025/0001/00005' || // Jim - Rei Elfo
      c.code === '2025/0001/00022'    // Pacto Forçado
  );

  if (lowCtFighters === 0 || (lowCtFighters === 1 && !hasEngineStarter)) {
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

  switch (card.code) {
    case '2025/0001/00010': // Jim - Ancião (1/9 Lúmen/Darkus - protects all other Jims from combat dmg!)
      return 135;
    case '2025/0001/00005': // Jim - Rei Elfo (summons a Jim from Deck next round automatically!)
      return state.round <= 3 ? 130 : 85;
    case '2025/0001/00004': // Jim - Assassino (Furtivo +2 ATK per Erased Jim!)
      return 95 + erasedCount * 12;
    case '2025/0001/00002': // Jim - Guerreiro (5/6 + 5 splash dmg on kill)
      return enemyHasFighters ? 115 : 95;
    case '2025/0001/00007': // Jim - Herói (4/9 Lúmen + heals 1 PV/round)
      return 110;
    case '2025/0001/00006': // Jim - Paladina (Solador +8 ATK in combat = 9 ATK Solador)
      return state.round >= 2 && enemyHasFighters ? 120 : 88;
    case '2025/0001/00003': // Jim - Mago (spell negate up to CT 8 on field!)
      return 105;
    case '2025/0001/00008': // Jim - Arqueira (drains D4 mana at start of turn)
      return 100;
    case '2025/0001/00009': // Jim - Feiticeira (8/1 Caos + 8 dmg deathrattle)
      return state.round >= 2 ? 102 : 70;
    case '2025/0001/0011': // Jim - Necromante (4/1, sends Dead Zone Jims to Erased Zone)
      return bot.deadZone.some((c) => isJimCard(c)) ? 125 : 75;
    default:
      return card.ct * 12;
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

/**
 * Calcula a pontuação bruta (Raw Points) de um dos lados do tabuleiro (Bot ou Player)
 */
function evaluatePlayerSideRaw(
  state: DuelGameState,
  sideId: PlayerId
): PlayerSideHeuristic {
  const p = getPlayerState(state, sideId);
  const opp = getPlayerState(state, getOpponentId(sideId));

  // 1. PONTUAÇÃO DE VIDA (Não-linear: valoriza cada PV muito mais quando a vida está baixa!)
  // Base: 2.5 pts por PV + penalidade exponencial abaixo de 8 PV
  let lifeScore = p.hp * 2.5;
  if (p.hp <= 5) {
    lifeScore -= (6 - p.hp) * 14; // Zona crítica de letal
  } else if (p.hp <= 10) {
    lifeScore -= (11 - p.hp) * 5;
  }

  // 2. PONTUAÇÃO DE COMBATENTES EM CAMPO (Frontline Col 1-6)
  let boardFightersScore = 0;
  const activeFighters = p.frontline.filter((f): f is FieldFighter => f !== null);
  const hasAnciaoOnBoard = activeFighters.some((f) => f.card.code === '2025/0001/00010');

  for (const f of activeFighters) {
    const effAtk = getFighterEffectiveAtk(state, f, true);
    const effHp = f.currentHp;
    const intrinsicBonus = FIGHTER_INTRINSIC_EFFECT_WEIGHTS[f.card.code] ?? 10;

    // Valor base de status: ATK * 2.2 + HP * 1.8
    let unitScore = effAtk * 2.2 + effHp * 1.8 + intrinsicBonus;

    // Bônus se for Jim - Rei Elfo prestes a engatilhar na próxima rodada
    if (f.card.code === '2025/0001/00005' && state.round === f.summonedRound) {
      unitScore += 18;
    }

    // Valor dos Arquétipos efetivos
    const effArchs = getEffectiveArchetypes(state, f);
    for (const arch of effArchs) {
      unitScore += ARCHETYPE_HEURISTIC_WEIGHTS[arch] ?? 5;
    }

    // Bônus se estiver protegido pelo Jim - Ancião aliado
    if (hasAnciaoOnBoard && isJimCard(f.card) && f.card.code !== '2025/0001/00010') {
      unitScore += 10;
    }

    boardFightersScore += unitScore;
  }

  // 3. PONTUAÇÃO DE SUPORTES CONTÍNUOS E EQUIPAMENTOS (Backrow Sup 1-6)
  let backrowAndEquipScore = 0;
  for (const f of activeFighters) {
    for (const eq of f.equipments) {
      const baseEqWeight = EQUIPMENT_HEURISTIC_WEIGHTS[eq.card.code] ?? 15;
      // Equipamentos em unidades com muito HP ou no Herói valem mais pois permanecem em campo
      const durabilityMultiplier = f.isHero || f.currentHp >= 10 ? 1.35 : 1.0;
      backrowAndEquipScore += baseEqWeight * durabilityMultiplier;
    }
  }
  for (const sup of p.backrow) {
    if (!sup) continue;
    if (sup.card.code === '2025/0001/00016') {
      // Ascensão do Rei (Motor contínuo de Zona Apagada)
      backrowAndEquipScore += 22;
    } else if (sup.card.code === '2025/0001/00017') {
      // Busca Pela Eternidade (Tutor contínuo toda rodada!)
      backrowAndEquipScore += 28;
    }
  }

  // 4. PONTUAÇÃO DE ESCALONAMENTO DA ZONA APAGADA («Jim» Apagados)
  const jimsErased = countJimsInErasedZone(p);
  let erasedZoneSynergyScore = jimsErased * 5.5;
  // Limiares do Herói «Jim - O Senhor do Macroverso» (1+, 3+, 5+, 7+, 9+)
  if (jimsErased >= 1) erasedZoneSynergyScore += 6;
  if (jimsErased >= 3) erasedZoneSynergyScore += 10;
  if (jimsErased >= 5) erasedZoneSynergyScore += 18;
  if (jimsErased >= 7) erasedZoneSynergyScore += 24;
  if (jimsErased >= 9) erasedZoneSynergyScore += 35;

  // 5. PONTUAÇÃO DE MÃO, MANA, RUNAS E RESERVA DO HERÓI
  let handAndTempoScore = p.hand.length * 6.5 + p.mana * 1.8 + p.runes * 2.5;
  if (p.heroDeck.length > 0) {
    // Ter o Herói disponível no Extra Deck pronto para descer "A Qualquer Momento"
    handAndTempoScore += 20 + Math.min(9, jimsErased) * 3;
  }
  if (p.ctReductionThisRound > 0) {
    handAndTempoScore += p.ctReductionThisRound * 5;
  }

  // Valor de cartas de Reação na mão (segurança defensiva)
  for (const c of p.hand) {
    if (c.code === '2025/0001/00029' && p.hp >= 10) handAndTempoScore += 14; // Selamento Verdadeiro
    if (c.code === '2025/0001/00028') handAndTempoScore += 9; // Disfarce de Mestre
    if (c.code === '2025/0001/00024') handAndTempoScore += 8; // Sobrevivência Covarde
    if (c.code === '2025/0001/00023') handAndTempoScore += 6; // Ligação das Variantes
  }

  // 6. BÔNUS DE COMBOS E SINERGIAS ATIVAS (Combo Synergy Bonus)
  let comboSynergyBonus = 0;

  // Combo 1: «Jim - Ancião» protegendo múltiplos «Jim» no campo (Trava de Combate)
  if (hasAnciaoOnBoard && activeFighters.length >= 2) {
    comboSynergyBonus += (activeFighters.length - 1) * 14;
  }

  // Combo 2: «Jim - O Senhor do Macroverso» em campo com 5+ / 7+ / 9+ Jims na Zona Apagada
  const heroOnField = activeFighters.find((f) => f.card.code === '2025/0001/00001');
  if (heroOnField) {
    if (jimsErased >= 5) comboSynergyBonus += 25;
    if (jimsErased >= 7) comboSynergyBonus += 25;
    if (jimsErased >= 9) comboSynergyBonus += 35;
  }

  // Combo 3: «Crueldade» com 4+ arquétipos dobrando todos os arquétipos da unidade
  for (const f of activeFighters) {
    const hasCrueldade = f.equipments.some((e) => e.card.code === '2025/0001/00012');
    if (hasCrueldade && f.archetypes.length >= 4) {
      comboSynergyBonus += 30;
    }
  }

  // Combo 4: «Pacto Forçado» na mão + 2 ou mais cartas jogáveis para turno explosivo
  const hasPactoInHand = p.hand.some((c) => c.code === '2025/0001/00022');
  if (hasPactoInHand && p.hp >= 9 && p.hand.length >= 3) {
    comboSynergyBonus += 18;
  }

  // Combo 5: «Destruição das Variantes» ou «Jim - Necromante» na mão antes de invocar o Herói
  const hasErasedTurboInHand = p.hand.some(
    (c) => c.code === '2025/0001/00030' || c.code === '2025/0001/0011'
  );
  if (hasErasedTurboInHand && p.heroDeck.length > 0 && jimsErased < 5) {
    comboSynergyBonus += 20;
  }

  // Combo 6: Ameaça de Letal imediato em campo contra o oponente sem bloqueadores
  const oppFightersCount = opp.frontline.filter((f) => f !== null).length;
  const totalReadyAtk = activeFighters
    .filter((f) => !f.hasAttackedThisTurn)
    .reduce((sum, f) => sum + getFighterEffectiveAtk(state, f, true), 0);
  if (state.round >= 2 && oppFightersCount === 0 && totalReadyAtk >= opp.hp) {
    comboSynergyBonus += 120; // Letal garantido na mesa!
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

export function executeBotTurnStep(state: DuelGameState): {
  acted: boolean;
  triggeredReactionWindow: boolean;
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
    const pactoIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00022');
    if (pactoIdx !== -1 && bot.hp >= 8 && canPlayCardInMainPhase(state, 'bot', bot.hand[pactoIdx]).allowed) {
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

    // 1C. CONTINUOUS BACKROW ENGINE: «Ascensão do Rei» (00016) & «Busca Pela Eternidade» (00017)
    for (const supCode of ['2025/0001/00016', '2025/0001/00017']) {
      const supIdx = bot.hand.findIndex((c) => c.code === supCode);
      if (supIdx !== -1 && canPlayCardInMainPhase(state, 'bot', bot.hand[supIdx]).allowed) {
        const [card] = bot.hand.splice(supIdx, 1);
        const cost = getEffectiveCt(bot, card);
        bot.mana -= cost;
        const backSlot = bot.backrow.findIndex((s) => s === null);
        return queueBotCardWithReactionCheck(state, card, backSlot !== -1 ? backSlot : 0, cost);
      }
    }

    // 1D. ERASED ZONE TURBO COMBO: «Destruição das Variantes» (00030) & «Jim - Necromante» (0011)
    // Always feed the Erased Zone BEFORE considering summoning the Hero!
    const destrIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00030');
    if (
      destrIdx !== -1 &&
      bot.hp >= 10 &&
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

    // 1E. SMART HERO TIMING: «Jim - O Senhor do Macroverso» (2025/0001/00001)
    // Only summon when Erased Zone has >= 5 Jims (unlocking +15/+15, +5 Mana, Archetypes, etc.),
    // OR in Round 3+ with >= 3 Jims, OR when in danger (HP <= 10). Never waste at 0 Jims on Turn 1!
    if (bot.heroDeck.length > 0 && bot.frontline.some((s) => s === null)) {
      const jimsErased = countJimsInErasedZone(bot);
      const shouldSummonHeroNow =
        jimsErased >= 5 ||
        (state.round >= 3 && jimsErased >= 3) ||
        bot.hp <= 10 ||
        (state.round >= 2 &&
          !player.frontline.some((f) => f !== null) &&
          15 + (jimsErased >= 5 ? 15 : 0) + (jimsErased >= 8 ? 15 : 0) >= player.hp);

      if (shouldSummonHeroNow) {
        const heroCard = bot.heroDeck.shift()!;
        const slot = chooseBestBotSummonSlot(state, heroCard);
        return queueBotCardWithReactionCheck(state, heroCard, slot, heroCard.ct);
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

    // 1K. EQUIPMENTS: «Crueldade» (00012) & «Gemas Macroversais» (00013, 00014, 00015)
    const playableEquips = bot.hand
      .map((c, idx) => ({ c, idx, cost: getEffectiveCt(bot, c) }))
      .filter(
        (item) =>
          item.c.type === 'Equipamento' &&
          canPlayCardInMainPhase(state, 'bot', item.c).allowed
      );

    if (playableEquips.length > 0) {
      const chosen = playableEquips[0];
      let targetSlot = 0;
      if (chosen.c.name.includes('Gema Macroversal')) {
        const heroF = bot.frontline.find((f) => f !== null && f.isHero);
        if (heroF) targetSlot = heroF.slotIndex;
      } else {
        // Equip Crueldade on highest-HP fighter (Hero, Jim - Ancião, or Jim - Herói)
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
        attackDecision.targetSlot
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
      f !== null && !f.hasAttackedThisTurn && getFighterEffectiveAtk(state, f, true) > 0
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

    // Protect key utility units from suiciding:
    // - Jim - Rei Elfo waiting for next round summon
    // - Jim - Ancião (board protector)
    // - Jim - Mago (spell negator)
    const isProtectedUtility =
      (atk.card.code === '2025/0001/00005' && state.round === atk.summonedRound) ||
      atk.card.code === '2025/0001/00010' ||
      atk.card.code === '2025/0001/00003';

    for (const def of playerFighters) {
      // Check if defender is immune due to Player's Jim - Ancião
      const defProtectedByPlayerAnciao =
        !atkIsSolador &&
        playerAnciao !== undefined &&
        playerAnciao.instanceId !== def.instanceId &&
        isJimCard(def.card);

      if (defProtectedByPlayerAnciao) {
        continue; // Deals 0 damage — never waste an attack on an Ancião-protected target!
      }

      const defLumenRed = atkIsSolador ? 0 : countArchetypeStacks(state, def, 'Lúmen') * 3;
      const netDmgToDef = Math.max(0, atkVal - defLumenRed);
      if (netDmgToDef === 0) continue; // Deals 0 damage!

      const killsDef = netDmgToDef >= def.currentHp;
      const defAtkVal = getFighterEffectiveAtk(state, def, false);
      const netRetaliationDmg =
        atkIsFurtivo || atkProtectedByAnciao ? 0 : Math.max(0, defAtkVal - atkLumenRed);
      const insanoBacklash =
        killsDef && !atkIsSolador && hasArchetype(state, def, 'Insano') ? 5 : 0;
      const atkSurvives = atk.currentHp > netRetaliationDmg + insanoBacklash;

      // Never suicide utility units!
      if (isProtectedUtility && !atkSurvives) continue;

      let score = 0;

      // 1. Lethal on Player via Caos piercing!
      if (atkIsCaos && netDmgToDef > def.currentHp) {
        const pierce = netDmgToDef - def.currentHp;
        if (pierce >= player.hp) score += 10000;
        else score += pierce * 25;
      }

      // 2. Clean Kill (kills defender and attacker survives!)
      if (killsDef && atkSurvives) {
        score += 500 + def.card.ct * 25 + defAtkVal * 15;
        if (def.card.code === '2025/0001/00010') score += 300; // Killing Player's Ancião unlocks the board!
        if (def.isHero) score += 400;
        if (atk.card.code === '2025/0001/00002') score += 180; // Jim - Guerreiro triggers 5 splash damage on kill!
      }
      // 3. Favorable Trade (kills defender, attacker dies)
      else if (killsDef && !atkSurvives) {
        const isFeiticeiraBomb = atk.card.code === '2025/0001/00009'; // Deals 8 extra dmg on death!
        const defValue = def.isHero ? 500 : def.card.ct * 30 + defAtkVal * 12;
        const atkValue = atk.isHero ? 900 : atk.card.ct * 25 + atkVal * 10;
        if (isFeiticeiraBomb || defValue >= atkValue) {
          score += 250 + (defValue - atkValue) + (isFeiticeiraBomb ? 200 : 0);
        } else {
          score -= 200;
        }
      }
      // 4. Safe Chip Damage (attacker takes 0 damage via Furtivo / Ancião / 0 ATK defender)
      else if (netRetaliationDmg === 0) {
        score += 150 + netDmgToDef * 15;
      }
      // 5. Coordinated Team Kill / Chip on high-priority target when attacker survives
      else if (atkSurvives) {
        score += 60 + netDmgToDef * 10 - netRetaliationDmg * 8;
      } else {
        // Attacker dies and doesn't even kill defender -> Only do this with Jim - Feiticeira if it kills via 8 deathrattle!
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

  // If summoning a fighter with Véu, align directly in front of the strongest Player fighter!
  if (cardToSummon && cardToSummon.archetype.includes('Véu')) {
    const enemyTargets = player.frontline
      .filter((f): f is FieldFighter => f !== null && bot.frontline[f.slotIndex] === null)
      .sort((a, b) => b.card.ct - a.card.ct);
    if (enemyTargets.length > 0) return enemyTargets[0].slotIndex;
  }

  // Otherwise avoid columns where Player has a fighter with [Véu]
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
      ? `👑 Bot declarou a invocação do Herói «${card.name}» na Coluna ${targetSlot + 1} (Autoridade CT ${card.ct} • Custo 0 Mana)!`
      : isFighter
      ? `Bot declarou a invocação de «${card.name}» (CT ${authorityCt}) na Coluna ${targetSlot + 1}!`
      : `Bot declarou o uso de «${card.name}» (CT ${authorityCt}).`,
    isHero || isFighter ? 'summon' : 'effect'
  );

  const playerReactions = getAvailableReactions(
    state,
    'player',
    'CARD_PLAYED',
    authorityCt,
    false
  );

  const hasAnyPlayerReaction =
    playerReactions.handCards.length > 0 ||
    playerReactions.canUseJimMagoFieldNegate ||
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
  targetSlot: number
): { acted: boolean; triggeredReactionWindow: boolean } {
  const attacker = state.bot.frontline[attackerSlot]!;
  const targetName =
    targetSlot === -1
      ? 'Você (Ataque Direto)'
      : `«${state.player.frontline[targetSlot]?.card.name || 'Alvo'}» (Coluna ${targetSlot + 1})`;

  const attackerIsSolador = hasArchetype(state, attacker, 'Solador');

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

  // If Bot used Selamento Verdadeiro, Player can counter-negate if Player has Selamento Verdadeiro OR pays double life (2 * L)
  if (isBotSelamento) {
    const doubleCost = Math.max(2, botSelamentoLifePaid * 2);
    return p.hp > doubleCost;
  }

  // Player has Selamento Verdadeiro (00029) in hand and enough HP to pay botReactionAuthorityCt
  if (p.hand.some((c) => c.code === '2025/0001/00029') && p.hp > botReactionAuthorityCt) {
    return true;
  }

  // Player has Jim - Mago (00003) on field and Bot's reaction card is an Effect card with CT <= 8
  if (
    botReactionCard.type === 'Efeito' &&
    botReactionAuthorityCt <= 8 &&
    p.frontline.some((f) => f !== null && f.card.code === '2025/0001/00003')
  ) {
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
    // 1. «Jim - Mago» (00003) on Bot's field: sacrifice to Erased Zone to negate Player Effect card (CT <= 8)
    const highValueEffectCodes = new Set([
      '2025/0001/00016', // Ascensão do Rei
      '2025/0001/00017', // Busca Pela Eternidade
      '2025/0001/00018', // Lamento do Rei
      '2025/0001/00019', // Insanidade (if CT reduced <= 8)
      '2025/0001/00020', // Fragmentar
      '2025/0001/00021', // Portal dos Variantes
      '2025/0001/00022', // Pacto Forçado
      '2025/0001/00025', // Vingança Satisfatória
      '2025/0001/00026', // Manipulação das Realidades
      '2025/0001/00027', // Chamado da Variante
      '2025/0001/00030'  // Destruição das Variantes
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

    // 2. «Selamento Verdadeiro» (00029) in Bot's hand: pay life equal to Player's card CT to negate!
    const selamentoIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00029');
    const isCriticalCardToNegate =
      playerCard.type === 'Herói' ||
      playerCard.code === '2025/0001/00019' || // Insanidade
      playerCard.code === '2025/0001/00030' || // Destruição das Variantes
      playerCard.code === '2025/0001/00018' || // Lamento do Rei
      playerCard.code === '2025/0001/00012' || // Crueldade
      playerCard.code === '2025/0001/00022' || // Pacto Forçado
      playerCard.code === '2025/0001/00026' || // Manipulação das Realidades
      playerCardAuthorityCt >= 5;

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
            activeState.bot.deadZone.push(selamento);
            sendCardToDeadOrErasedZone(activeState, 'player', playerCard);
            addLog(
              activeState,
              'bot',
              `⛓️ Corrente encerrada: «Selamento Verdadeiro» do Bot prevaleceu e «${playerCard.name}» foi negada!`,
              'reaction'
            );
          },
          onNegatedPayload: (activeState: DuelGameState) => {
            activeState.bot.deadZone.push(selamento);
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

      bot.deadZone.push(selamento);
      return { botNegatedPlayerAction: true };
    }

    // 3. Reactive Hero Summon ("A Qualquer Momento") only when Bot has >= 5 Jims in Erased Zone or Player summoned Hero
    if (
      bot.heroDeck.length > 0 &&
      bot.frontline.some((s) => s === null) &&
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

    // 1. If Player declares a Direct Attack (targetSlot === -1), or Bot has 5+ Jims in Erased Zone, summon Hero to block!
    if (
      bot.heroDeck.length > 0 &&
      bot.frontline.some((s) => s === null) &&
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

    if (targetSlot !== undefined && targetSlot >= 0 && attacker && !attackerIsSolador) {
      const defender = bot.frontline[targetSlot];
      if (defender) {
        const incomingDmg = getFighterEffectiveAtk(state, attacker, true);
        const defLumenRed = countArchetypeStacks(state, defender, 'Lúmen') * 3;
        const netIncoming = Math.max(0, incomingDmg - defLumenRed);

        if (netIncoming >= defender.currentHp) {
          // 2A. «Ligação das Variantes» (2025/0001/00023, CT 1): Redirect attack to a tanky ally (Hero, Ancião, Jim - Herói)!
          const ligacaoIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00023');
          if (ligacaoIdx !== -1) {
            const cost = getEffectiveCt(bot, bot.hand[ligacaoIdx]);
            const tankAlly = bot.frontline.find(
              (f) =>
                f !== null &&
                f.slotIndex !== targetSlot &&
                f.currentHp > incomingDmg
            );
            if (bot.mana >= cost && tankAlly) {
              const [ligacao] = bot.hand.splice(ligacaoIdx, 1);
              bot.mana -= cost;
              bot.deadZone.push(ligacao);
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

          // 2B. «Disfarce de Mestre» (2025/0001/00028, CT 7): Swap defender with a strong Jim from Hand or Erased Zone!
          const disfarceIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00028');
          if (disfarceIdx !== -1 && !defender.isHero) {
            const cost = getEffectiveCt(bot, bot.hand[disfarceIdx]);
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
                bot.deadZone.push(disfarce);
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

          // 2C. «Sobrevivência Covarde» (2025/0001/00024, CT 3): Negate attack and return defender to Deck!
          const sobrevIdx = bot.hand.findIndex((c) => c.code === '2025/0001/00024');
          if (sobrevIdx !== -1 && !defender.isHero) {
            const cost = getEffectiveCt(bot, bot.hand[sobrevIdx]);
            if (bot.mana >= cost) {
              const [sobrev] = bot.hand.splice(sobrevIdx, 1);
              bot.mana -= cost;

              const executeSobrevivencia = (activeState: DuelGameState) => {
                activeState.bot.deadZone.push(sobrev);
                const curDef = activeState.bot.frontline[targetSlot];
                if (curDef) {
                  activeState.bot.frontline[targetSlot] = null;
                  for (const eq of curDef.equipments) activeState.bot.deadZone.push(eq.card);
                  activeState.bot.deck.push(curDef.card);
                  activeState.bot.deck = shuffleCards(activeState.bot.deck);
                }
                if (attackerSlot !== undefined && activeState.player.frontline[attackerSlot]) {
                  activeState.player.frontline[attackerSlot]!.hasAttackedThisTurn = true;
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
                    activeState.bot.deadZone.push(sobrev);
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
