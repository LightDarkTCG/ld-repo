import { CardData } from '../types';

export type PlayerId = 'player' | 'bot';

export type StructuralDeckId =
  | 'Insanis'
  | 'Invasão do Caos'
  | 'Príncipe do Macroverso'
  | 'Mechs e Mangas'
  | 'Herdeiro do Caos'
  | 'Mundo em Chamas'
  | 'Corruptor Profano'
  | 'O Escolhido'
  | 'Deusa da Lua';

export type BotDeckSelection = StructuralDeckId | 'random';

export type DuelPhase =
  | 'INITIATIVE'
  | 'MULLIGAN'
  | 'PRE_DRAW_WINDOW'
  | 'MAIN_PHASE'
  | 'COMBAT_REACTION'
  | 'CARD_REACTION'
  | 'GAME_OVER';

export interface AttachedEquipment {
  instanceId: string;
  card: CardData;
  grantedArchetypes?: string[];
}

export interface FieldFighter {
  instanceId: string;
  card: CardData;
  slotIndex: number; // 0 to 5
  owner: PlayerId;
  baseAtk: number;
  baseHp: number;
  currentHp: number;
  maxHp: number;
  permAtkBonus: number;
  permHpBonus: number;
  tempAtkBonus: number;
  archetypes: string[];
  equipments: AttachedEquipment[];
  summonedRound: number;
  summonedTurnGlobal: number;
  hasAttackedThisTurn: boolean;
  usedOncePerRoundAbility: boolean;
  macroversalUsedThisRound: boolean;
  azaradoUsedThisRound: boolean;
  isHero: boolean;
  jimLordTier5Plus?: boolean;
  jimLordTier6Mana?: boolean;
  jimLordTier9GemUsedThisRound?: boolean;
  attacksThisTurnCount?: number;
  immuneToCardEffectsRound?: number;
  rebirthVeuTriggered?: boolean;
}

export interface FieldSupport {
  instanceId: string;
  card: CardData;
  slotIndex: number; // 0 to 5
  owner: PlayerId;
  usedOncePerRound: boolean;
  stackedCards?: CardData[]; // Permite empilhar Camadas / equipamentos de jogador no mesmo espaço
}

export type DuelLogType =
  | 'life_loss'
  | 'life_gain'
  | 'attack'
  | 'reaction'
  | 'summon'
  | 'effect'
  | 'info';

export interface DuelLogEntry {
  id: string;
  round: number;
  turn: number;
  actor: PlayerId | 'system';
  text: string;
  type: DuelLogType;
}

export interface PlayerDuelState {
  id: PlayerId;
  name: string;
  deckId: StructuralDeckId;
  hp: number;
  mana: number;
  maxManaCap: number;
  runes: number;
  hand: CardData[];
  deck: CardData[];
  heroDeck: CardData[];
  deadZone: CardData[]; // Zona Morta
  erasedZone: CardData[]; // Zona Apagada
  frontline: (FieldFighter | null)[]; // 6 slots (0..5)
  backrow: (FieldSupport | null)[]; // 6 slots (0..5)
  ctReductionThisRound: number;
  permCtReduction?: number;
  permCtPenalty?: number;
  pendingPactoLifeLossNextRound: number;
  skipDrawsUntilGlobalTurn: number;
  hasAttackedInCurrentTurn: boolean;
  lockedFromAttackingThisTurn: boolean; // true if summoned/played after attacking
  lostFighterInBattleThisTurn: boolean;
  heroDiedThisTurn: boolean;
  damageDealtToEnemyPlayerThisRound: number;
  alliedFightersLostWhileSelenaLuaActive: number;
  pendingRitosFestival?: Array<{ card: CardData; summonOnRound: number }>;
  pendingAtoFinalMahinaReturnRound?: number;
  pendingComoPlanejadoCards?: CardData[];
  floquinhoTreatedAsHeroCodes?: string[];
}

export interface PendingReactionWindow {
  type: 'CARD_PLAYED' | 'ATTACK_DECLARED';
  sourceActor: PlayerId;
  responder: PlayerId;
  triggerCard?: CardData;
  triggerActionLabel: string;
  effectiveCtOfTrigger?: number;
  canBeNegatedByMaxCt?: number;
  minCtToNegate?: number;
  onlyNegatableByHero?: boolean;
  isSelamentoTrigger?: boolean;
  selamentoLifePaid?: number;
  selamentoDoubleLifeCost?: number;
  isCounterChain?: boolean;
  attackerSlot?: number;
  targetSlot?: number; // -1 for direct attack
  pendingPayload: (activeState: DuelGameState) => void;
  onNegatedPayload?: (activeState: DuelGameState) => void;
}

export interface ChoiceCandidate {
  id: string;
  card: CardData;
  sourceZone: 'deck' | 'hand' | 'deadZone' | 'erasedZone';
  sourceIndex: number;
  subtitle?: string;
}

export interface PendingCardChoiceModal {
  title: string;
  description: string;
  candidates: ChoiceCandidate[];
  minSelect: number;
  maxSelect: number;
  maxTotalCt?: number; // Used by Fragmentar
  allowConfirmAllFromDeadZoneOption?: boolean; // Used by Jim - Necromante
  deadZoneJimCount?: number;
  needsSlotPlacementAfterChoice?: boolean;
  targetSlotForChosenCard?: number;
  effectKind:
    | 'DESTRUICAO_VARIANTES'
    | 'ASCENSAO_DO_REI'
    | 'NECROMANTE'
    | 'BUSCA_ETERNIDADE'
    | 'JIM_LORD_GEMA'
    | 'CHAMADO_VARIANTE'
    | 'PORTAL_VARIANTES'
    | 'DISFARCE_MESTRE'
    | 'FRAGMENTAR'
    | 'LAMENTO_DO_REI'
    | 'REI_ELFO'
    | 'APOTEOSE_CAMADA'
    | 'APOTEOSE_ROUND_START'
    | 'MAHINA_VEU_ZONES'
    | 'MAHINA_VEU_COMBAT_ARCHETYPE'
    | 'RITOS_DO_FESTIVAL'
    | 'O_PAPAI_CHEGOU'
    | 'FLOQUINHO_VEU_HP_SPEND';
  reiElfoSourceSlot?: number;
  disfarceTargetSlot?: number;
  mahinaCombatSlot?: number;
  floquinhoTargetSlot?: number;
  floquinhoHandIdx?: number;
}

export interface DuelGameState {
  round: number;
  turnInRound: 1 | 2;
  globalTurn: number;
  firstPlayerOfRound: PlayerId;
  activePlayer: PlayerId;
  phase: DuelPhase;
  winner: PlayerId | 'draw' | null;
  winReason: string | null;
  initiativeRoll: {
    playerRoll: number;
    botRoll: number;
    winner: PlayerId | null;
  };
  mulliganDone: boolean;
  player: PlayerDuelState;
  bot: PlayerDuelState;
  reactionWindow: PendingReactionWindow | null;
  pendingChoiceQueue: PendingCardChoiceModal[];
  pendingGuerreiroSplashDamage: boolean;
  logs: DuelLogEntry[];
  deckMode: 'structural_29' | 'optimized_40';
  playerDeckId: StructuralDeckId;
  botDeckId: StructuralDeckId;
}

export interface PlayerSideHeuristic {
  lifeScore: number;
  boardFightersScore: number;
  backrowAndEquipScore: number;
  erasedZoneSynergyScore: number;
  handAndTempoScore: number;
  comboSynergyBonus: number;
  totalRawPoints: number;
}

export interface HeuristicEvaluationResult {
  /** Nota normalizada de 0 a 100 (50 = Equilíbrio Perfeito, >50 Vantagem Bot, <50 Vantagem Jogador) */
  score0to100: number;
  /** Diferença bruta (Raw_Bot - Raw_Player) antes da função Sigmoide */
  rawDelta: number;
  /** Classificação tática da situação para ajustar postura do Bot (AGRESSIVA, EQUILIBRADA, DEFENSIVA, LETAL) */
  posture: 'LETHAL_PUSH' | 'DOMINATING' | 'BALANCED' | 'DEFENSIVE_RECOVERY' | 'CRITICAL_SURVIVAL';
  botBreakdown: PlayerSideHeuristic;
  playerBreakdown: PlayerSideHeuristic;
}

export type UniversalFailurePillar =
  | 'LIFE_AS_RESOURCE_OVEREXTENSION'
  | 'WINCON_AND_HERO_TIMING_DELAY'
  | 'SYNERGY_AND_ENGINE_SCALING_GAP'
  | 'INTERACTION_AND_COUNTERPLAY_DEFICIT'
  | 'BOARD_TEMPO_AND_DEFENSIVE_STABILIZATION'
  | 'CARD_ADVANTAGE_AND_HAND_SUSTAIN'
  | 'BOT_VICTORY_REINFORCEMENT';

export interface BotLossDiagnosisEntry {
  causeCode: UniversalFailurePillar;
  pillarLabel: string;
  title: string;
  analysis: string;
  adjustmentSummary: string;
}

export interface BotAdaptiveMemory {
  generation: number;
  matchesPlayed: number;
  botWins: number;
  botLosses: number;
  weights: {
    /** 1. Gestão de Vida como Recurso (cautela ao pagar PV em efeitos) */
    lifeAsResourceCautionMultiplier: number;
    minSafeHpForLifeCost: number;
    /** 2. Agressividade no Timing de Herói / Condição de Vitória (0.6 a 1.5, menor = desce mais cedo) */
    winconTimingThresholdScale: number;
    /** 3. Prioridade de Motores de Sinergia, Setup e Zonas Auxiliares (Morta/Apagada/Suportes) */
    synergyEnginePriorityMultiplier: number;
    /** 4. Disciplina de Interação, Reações, Contra-Negações e Remoção de Peças-Chave */
    interactionAndRemovalDiscipline: number;
    /** 5. Tempo de Mesa, Presença de Linha de Frente e Estabilização contra Aggro */
    boardTempoAndDefenseMultiplier: number;
    /** 6. Vantagem de Cartas (Card Advantage), Compras e Sustentação de Mão */
    cardAdvantageAndDrawMultiplier: number;
  };
  lastMatchAutopsy: BotLossDiagnosisEntry[];
}



