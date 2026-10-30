import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Dices,
  Eye,
  Flame,
  Heart,
  HelpCircle,
  Lock,
  Play,
  RotateCcw,
  ScrollText,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Wand2,
  X,
  Zap
} from 'lucide-react';
import { useCards } from '../CardContext';
import { allCards, archetypesList } from '../data';
import { CardData } from '../types';
import {
  BotAdaptiveMemory,
  BotDeckSelection,
  ChoiceCandidate,
  DuelGameState,
  DuelLogType,
  FieldFighter,
  PendingCardChoiceModal,
  StructuralDeckId
} from './botTypes';
import {
  ALL_OFFICIAL_ARCHETYPES,
  STRUCTURAL_DECK_OPTIONS,
  addLog,
  advanceTurn,
  analyzeMatchAndLearn,
  applyEffectDamageToFighter,
  canPlayCardInMainPhase,
  canSummonHeroDirectly,
  checkWinCondition,
  countJimsInErasedZone,
  createInitialDuelState,
  discardCardDirectlyToZone,
  equipSupportOrCamadaToBackrow,
  evaluateBotReactionToPlayerAction,
  executeBotTurnStep,
  executeCombatResolution,
  executeFriendlyAttackOnAquaCaotica,
  getAllSupportCardsInSlot,
  getAvailableReactions,
  getCardAuthorityCt,
  getEffectiveArchetypes,
  getEffectiveCt,
  getFighterEffectiveAtk,
  getMaxAttacksPerTurn,
  hasActiveCamada,
  hasArchetype,
  isCamadaCard,
  isContinuousBackrowCard,
  isJimCard,
  isPlayerEquipmentCard,
  loadBotAdaptiveMemory,
  payDirectHeroSummonCost,
  performBotSmartMulligan,
  processStartOfTurn,
  resolveInsanisCardEffect,
  resolveModernCardVersion,
  sendCardToDeadOrErasedZone,
  sendFighterFromFieldToZone,
  shuffleCards,
  summonFighterToSlot,
  summonFloquinhoCaoticaWithHp
} from './insanisEngine';

interface DuelBotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GEMA_1_ARCHETYPE_POOL = [...ALL_OFFICIAL_ARCHETYPES];

export const DuelBotModal: React.FC<DuelBotModalProps> = ({ isOpen, onClose }) => {
  const { cards: liveCards, archetypes: liveArchetypes } = useCards();
  const [deckMode, setDeckMode] = useState<'structural_29' | 'optimized_40'>('structural_29');
  const [playerDeckId, setPlayerDeckId] = useState<StructuralDeckId>('Insanis');
  const [botDeckSelection, setBotDeckSelection] = useState<BotDeckSelection>('Invasão do Caos');
  const [gameState, setGameState] = useState<DuelGameState>(() =>
    createInitialDuelState('structural_29', liveCards, 'Insanis', 'Invasão do Caos')
  );

  // Selected card from Player Hand in MAIN_PHASE
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  // Selected Player Fighter slot for attacking
  const [selectedAttackerSlot, setSelectedAttackerSlot] = useState<number | null>(null);
  // Inspect card modal (full-screen zoom)
  const [inspectedCard, setInspectedCard] = useState<CardData | null>(null);
  const [inspectedFighter, setInspectedFighter] = useState<FieldFighter | null>(null);
  // Center Panel Card Preview (shows card when used by Bot/Player, in Reaction, or when clicked)
  const [previewCard, setPreviewCard] = useState<CardData | null>(null);
  const [previewFighter, setPreviewFighter] = useState<FieldFighter | null>(null);
  const [previewBannerLabel, setPreviewBannerLabel] = useState<string>('Carta em Destaque');
  const [previewSlotCards, setPreviewSlotCards] = useState<CardData[]>([]);
  const lastAutoReactionKeyRef = useRef<string | null>(null);
  // Zone viewer modal
  const [zoneViewer, setZoneViewer] = useState<{
    title: string;
    cards: CardData[];
  } | null>(null);
  // Gema Macroversal 1 archetype picker
  const [pendingGema1Play, setPendingGema1Play] = useState<{
    handIndex: number;
    targetSlot: number;
    selectedArchs: string[];
    isReaction?: boolean;
  } | null>(null);

  // When player clicks Invocar Herói (in Main Phase, Pre-Draw, or Reaction)
  const [selectingSlotForHero, setSelectingSlotForHero] = useState<boolean>(false);
  const [selectedHeroCodeToSummon, setSelectedHeroCodeToSummon] = useState<string | null>(null);

  // When player clicks a card in hand during CARD_REACTION or COMBAT_REACTION that requires choosing a column/slot
  const [pendingReactionHandIndex, setPendingReactionHandIndex] = useState<number | null>(null);
  // For Troca de Variantes (2025/0001/00023): pick 1st fighter then 2nd fighter
  const [trocaFirstSlot, setTrocaFirstSlot] = useState<number | null>(null);

  // Selected candidate IDs inside PendingCardChoiceModal
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<string[]>([]);

  // Quick Rules helper modal
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Retractable Combat Log state (starts retracted on right edge per reference layout)
  const [isLogOpen, setIsLogOpen] = useState<boolean>(false);

  // Pacing / Speed Control ('lento' | 'normal' | 'rapido')
  const [duelSpeed, setDuelSpeed] = useState<'lento' | 'normal' | 'rapido'>('normal');

  const SPEED_CONFIG = {
    lento: {
      label: '🐢 Lento',
      botStepMs: 2400,
      attackWindupMs: 1250,
      spotlightMs: 1800
    },
    normal: {
      label: '⚔️ Normal',
      botStepMs: 1650,
      attackWindupMs: 900,
      spotlightMs: 1350
    },
    rapido: {
      label: '⚡ Rápido',
      botStepMs: 950,
      attackWindupMs: 520,
      spotlightMs: 850
    }
  } as const;

  // Active Combat Attack Arrow & Lunge Animation state
  const [activeAttackAnim, setActiveAttackAnim] = useState<{
    attackerSide: 'player' | 'bot';
    attackerSlot: number;
    targetSide: 'player' | 'bot';
    targetSlot: number; // 0..5, or -1 for Direct Attack
    attackerName: string;
    targetName: string;
    atkValue: number;
    isSolador?: boolean;
    isAquaRedirect?: boolean;
    aquaEnemySlot?: number;
  } | null>(null);

  // Hovered target when Player has selected an attacker (for live preview Attack Arrow)
  const [hoveredAttackTarget, setHoveredAttackTarget] = useState<{
    side: 'bot' | 'player';
    slot: number; // 0..5 or -1 for Direct Attack
    isAquaRedirect?: boolean;
  } | null>(null);

  // Floating Damage / Heal / Status Popups over slots and HP bars
  const [floatingPopups, setFloatingPopups] = useState<
    Array<{
      id: string;
      targetKey: string; // 'bot_slot_0'..'bot_slot_5', 'player_slot_0'..'player_slot_5', 'bot_hp', 'player_hp'
      text: string;
      variant: 'damage' | 'heal' | 'ko' | 'summon' | 'effect';
    }>
  >([]);

  // Slot visual impact states ('hit' | 'summon' | 'heal')
  const [slotImpacts, setSlotImpacts] = useState<Record<string, 'hit' | 'summon' | 'heal'>>({});

  // Center-screen Action Spotlight toast for readability
  const [actionSpotlight, setActionSpotlight] = useState<{
    id: string;
    actor: 'player' | 'bot' | 'system';
    text: string;
    type: DuelLogType;
  } | null>(null);

  // DOM Refs for computing exact SVG Attack Arrow coordinates
  const battlefieldRef = useRef<HTMLDivElement | null>(null);
  const botSlotRefs = useRef<Array<HTMLDivElement | null>>([null, null, null, null, null, null]);
  const playerSlotRefs = useRef<Array<HTMLDivElement | null>>([null, null, null, null, null, null]);
  const botHpRef = useRef<HTMLDivElement | null>(null);
  const playerHpRef = useRef<HTMLDivElement | null>(null);

  const [arrowCoords, setArrowCoords] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x3?: number;
    y3?: number;
    attackerSide: 'player' | 'bot';
    atkValue: number;
    attackerName: string;
    targetName: string;
    isSolador?: boolean;
    isPreview?: boolean;
    isReactionLock?: boolean;
    isAquaRedirect?: boolean;
  } | null>(null);

  const prevSnapshotRef = useRef<{
    botHp: number;
    playerHp: number;
    botFront: Array<{ instanceId: string; hp: number; name: string } | null>;
    playerFront: Array<{ instanceId: string; hp: number; name: string } | null>;
    lastLogId: string | null;
  } | null>(null);

  // Adaptive Bot Memory & Post-Match Autopsy
  const [botMemory, setBotMemory] = useState<BotAdaptiveMemory>(() => loadBotAdaptiveMemory());
  const [hasAnalyzedCurrentMatch, setHasAnalyzedCurrentMatch] = useState<boolean>(false);

  // Beta Tester Access Gate (Username & Password)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('ld_duel_bot_beta_auth') === 'true';
    } catch {
      return false;
    }
  });
  const [loginUser, setLoginUser] = useState<string>('');
  const [loginPass, setLoginPass] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  const handleBetaLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = loginUser.trim().toLowerCase();
    const p = loginPass.trim();

    if (
      (u === 'tester' || u === 'insanis' || u === 'admin') &&
      (p === 'insanis2025' || p === 'lightdark')
    ) {
      setIsAuthenticated(true);
      setLoginError('');
      try {
        sessionStorage.setItem('ld_duel_bot_beta_auth', 'true');
      } catch {
        // ignore storage errors
      }
    } else {
      setLoginError('Usuário ou senha inválidos para o Beta Fechado.');
    }
  };

  // Whenever liveCards from Firestore/CardContext finishes loading or updates, upgrade all cards in state to Moderno frame!
  useEffect(() => {
    if (!liveCards || liveCards.length === 0) return;
    setGameState((prev) => {
      const upgradeCard = (c: CardData) => resolveModernCardVersion(c, liveCards);
      const upgradePlayer = (p: typeof prev.player) => ({
        ...p,
        hand: p.hand.map(upgradeCard),
        deck: p.deck.map(upgradeCard),
        heroDeck: p.heroDeck.map(upgradeCard),
        deadZone: p.deadZone.map(upgradeCard),
        erasedZone: p.erasedZone.map(upgradeCard),
        frontline: p.frontline.map((f) =>
          f
            ? {
                ...f,
                card: upgradeCard(f.card),
                equipments: f.equipments.map((eq) => ({
                  ...eq,
                  card: upgradeCard(eq.card)
                }))
              }
            : null
        ),
        backrow: p.backrow.map((s) =>
          s
            ? {
                ...s,
                card: upgradeCard(s.card),
                stackedCards: (s.stackedCards || []).map(upgradeCard)
              }
            : null
        )
      });

      return {
        ...prev,
        player: upgradePlayer(prev.player),
        bot: upgradePlayer(prev.bot),
        pendingChoiceQueue: prev.pendingChoiceQueue.map((q) => ({
          ...q,
          candidates: q.candidates.map((cand) => ({
            ...cand,
            card: upgradeCard(cand.card)
          }))
        }))
      };
    });
  }, [liveCards]);

  const activePendingChoice: PendingCardChoiceModal | null =
    gameState.pendingChoiceQueue.length > 0 ? gameState.pendingChoiceQueue[0] : null;

  // Reset selectedChoiceIds whenever the active choice modal changes
  useEffect(() => {
    setSelectedChoiceIds([]);
  }, [activePendingChoice?.title, activePendingChoice?.effectKind]);

  // Reset reaction selection when leaving reaction phase
  useEffect(() => {
    if (gameState.phase !== 'CARD_REACTION' && gameState.phase !== 'COMBAT_REACTION') {
      setPendingReactionHandIndex(null);
      setTrocaFirstSlot(null);
    }
  }, [gameState.phase]);

  // Trigger Post-Match Autopsy & Adaptive Learning when match ends
  useEffect(() => {
    if (gameState.phase === 'GAME_OVER' && !hasAnalyzedCurrentMatch) {
      const updatedMem = analyzeMatchAndLearn(gameState);
      setBotMemory(updatedMem);
      setHasAnalyzedCurrentMatch(true);
    }
  }, [gameState.phase, hasAnalyzedCurrentMatch, gameState]);

  // Clear hovered target when attacker selection is cleared
  useEffect(() => {
    if (selectedAttackerSlot === null) {
      setHoveredAttackTarget(null);
    }
  }, [selectedAttackerSlot]);

  // Detect HP changes, fighter hits, KOs, summons, and new log actions to trigger floating popups & spotlight
  useEffect(() => {
    const snap = {
      botHp: gameState.bot.hp,
      playerHp: gameState.player.hp,
      botFront: gameState.bot.frontline.map((f) =>
        f ? { instanceId: f.instanceId, hp: f.currentHp, name: f.card.name } : null
      ),
      playerFront: gameState.player.frontline.map((f) =>
        f ? { instanceId: f.instanceId, hp: f.currentHp, name: f.card.name } : null
      ),
      lastLogId: gameState.logs[0]?.id ?? null
    };

    const prev = prevSnapshotRef.current;
    prevSnapshotRef.current = snap;
    if (!prev) return;

    const newPopups: Array<{
      id: string;
      targetKey: string;
      text: string;
      variant: 'damage' | 'heal' | 'ko' | 'summon' | 'effect';
    }> = [];
    const newImpacts: Record<string, 'hit' | 'summon' | 'heal'> = {};
    const nowId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Check Bot HP diff
    if (snap.botHp < prev.botHp) {
      newPopups.push({
        id: `${nowId}_bot_hp_dmg`,
        targetKey: 'bot_hp',
        text: `-${prev.botHp - snap.botHp} PV`,
        variant: 'damage'
      });
    } else if (snap.botHp > prev.botHp) {
      newPopups.push({
        id: `${nowId}_bot_hp_heal`,
        targetKey: 'bot_hp',
        text: `+${snap.botHp - prev.botHp} PV`,
        variant: 'heal'
      });
    }

    // Check Player HP diff
    if (snap.playerHp < prev.playerHp) {
      newPopups.push({
        id: `${nowId}_player_hp_dmg`,
        targetKey: 'player_hp',
        text: `-${prev.playerHp - snap.playerHp} PV`,
        variant: 'damage'
      });
    } else if (snap.playerHp > prev.playerHp) {
      newPopups.push({
        id: `${nowId}_player_hp_heal`,
        targetKey: 'player_hp',
        text: `+${snap.playerHp - prev.playerHp} PV`,
        variant: 'heal'
      });
    }

    // Check Bot & Player frontline slots
    const checkSideSlots = (
      side: 'bot' | 'player',
      prevArr: typeof prev.botFront,
      currArr: typeof snap.botFront
    ) => {
      for (let i = 0; i < 6; i++) {
        const pSlot = prevArr[i];
        const cSlot = currArr[i];
        const key = `${side}_slot_${i}`;

        if (!pSlot && cSlot) {
          newImpacts[key] = 'summon';
          newPopups.push({
            id: `${nowId}_${key}_sum`,
            targetKey: key,
            text: `✨ INVOCADO`,
            variant: 'summon'
          });
        } else if (pSlot && !cSlot) {
          newImpacts[key] = 'hit';
          newPopups.push({
            id: `${nowId}_${key}_ko`,
            targetKey: key,
            text: `💥 ABATIDO!`,
            variant: 'ko'
          });
        } else if (pSlot && cSlot) {
          if (pSlot.instanceId !== cSlot.instanceId) {
            newImpacts[key] = 'summon';
            newPopups.push({
              id: `${nowId}_${key}_swap`,
              targetKey: key,
              text: `✨ ${cSlot.name}`,
              variant: 'summon'
            });
          } else if (cSlot.hp < pSlot.hp) {
            newImpacts[key] = 'hit';
            newPopups.push({
              id: `${nowId}_${key}_dmg`,
              targetKey: key,
              text: `💥 -${pSlot.hp - cSlot.hp}`,
              variant: 'damage'
            });
          } else if (cSlot.hp > pSlot.hp) {
            newImpacts[key] = 'heal';
            newPopups.push({
              id: `${nowId}_${key}_heal`,
              targetKey: key,
              text: `💚 +${cSlot.hp - pSlot.hp}`,
              variant: 'heal'
            });
          }
        }
      }
    };

    checkSideSlots('bot', prev.botFront, snap.botFront);
    checkSideSlots('player', prev.playerFront, snap.playerFront);

    if (newPopups.length > 0) {
      setFloatingPopups((curr) => [...curr, ...newPopups]);
      const popupIds = new Set(newPopups.map((p) => p.id));
      setTimeout(() => {
        setFloatingPopups((curr) => curr.filter((p) => !popupIds.has(p.id)));
      }, 1550);
    }

    if (Object.keys(newImpacts).length > 0) {
      setSlotImpacts((curr) => ({ ...curr, ...newImpacts }));
      setTimeout(() => {
        setSlotImpacts((curr) => {
          const copy = { ...curr };
          for (const k of Object.keys(newImpacts)) {
            delete copy[k];
          }
          return copy;
        });
      }, 900);
    }

    // Auto-populate Center Card Inspector / Reaction Panel when a NEW Reaction Window opens with a triggerCard
    if (gameState.reactionWindow?.triggerCard) {
      const rwKey = `${gameState.round}_${gameState.turnInRound}_${gameState.phase}_${gameState.reactionWindow.triggerCard.code}_${gameState.reactionWindow.triggerActionLabel}`;
      if (lastAutoReactionKeyRef.current !== rwKey) {
        lastAutoReactionKeyRef.current = rwKey;
        setPreviewCard(gameState.reactionWindow.triggerCard);
        setPreviewFighter(null);
        setPreviewSlotCards([gameState.reactionWindow.triggerCard]);
        setPreviewBannerLabel(
          gameState.reactionWindow.sourceActor === 'bot'
            ? 'Carta Usada pelo Bot'
            : 'Carta em Reação'
        );
      }
    } else {
      lastAutoReactionKeyRef.current = null;
    }

    // Action Spotlight Banner & Auto Card Preview for latest log entry
    const latestLog = gameState.logs[0];
    if (
      latestLog &&
      latestLog.id !== prev.lastLogId &&
      (latestLog.type === 'attack' ||
        latestLog.type === 'summon' ||
        latestLog.type === 'reaction' ||
        latestLog.type === 'effect')
    ) {
      setActionSpotlight({
        id: latestLog.id,
        actor: latestLog.actor,
        text: latestLog.text,
        type: latestLog.type
      });

      // Extract card name «...» from log to show in Left Card Inspector Panel when Bot or Player uses a card
      const matchCardName = latestLog.text.match(/«([^»]+)»/);
      if (matchCardName && matchCardName[1]) {
        const targetName = matchCardName[1].trim().toLowerCase();
        const foundCard =
          liveCards.find((c) => c.name.trim().toLowerCase() === targetName) ||
          allCards.find((c) => c.name.trim().toLowerCase() === targetName);
        if (foundCard) {
          setPreviewCard(foundCard);
          setPreviewFighter(null);
          setPreviewSlotCards([foundCard]);
          setPreviewBannerLabel(
            latestLog.actor === 'bot' ? 'Carta Usada pelo Bot' : 'Carta em Uso'
          );
        }
      }
    }
  }, [gameState, liveCards]);

  useEffect(() => {
    if (!actionSpotlight) return;
    const t = setTimeout(() => {
      setActionSpotlight((curr) => (curr?.id === actionSpotlight.id ? null : curr));
    }, SPEED_CONFIG[duelSpeed].spotlightMs);
    return () => clearTimeout(t);
  }, [actionSpotlight, duelSpeed]);

  // Compute SVG Attack Arrow coordinates whenever activeAttackAnim, COMBAT_REACTION, or hover preview changes
  useEffect(() => {
    const computeCoords = () => {
      const container = battlefieldRef.current;
      if (!container) {
        setArrowCoords(null);
        return;
      }
      const cRect = container.getBoundingClientRect();
      const getCenter = (el: HTMLElement | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: r.left - cRect.left + r.width / 2,
          y: r.top - cRect.top + r.height / 2
        };
      };

      // Priority 1: Active staged attack animation
      if (activeAttackAnim) {
        const startEl =
          activeAttackAnim.attackerSide === 'player'
            ? playerSlotRefs.current[activeAttackAnim.attackerSlot]
            : botSlotRefs.current[activeAttackAnim.attackerSlot];

        const endEl =
          activeAttackAnim.targetSlot === -1
            ? activeAttackAnim.targetSide === 'bot'
              ? botHpRef.current
              : playerHpRef.current
            : activeAttackAnim.targetSide === 'bot'
            ? botSlotRefs.current[activeAttackAnim.targetSlot]
            : playerSlotRefs.current[activeAttackAnim.targetSlot];

        const p1 = getCenter(startEl);
        const p2 = getCenter(endEl);
        if (p1 && p2) {
          let p3: { x: number; y: number } | null = null;
          if (
            activeAttackAnim.isAquaRedirect &&
            activeAttackAnim.aquaEnemySlot !== undefined
          ) {
            p3 = getCenter(botSlotRefs.current[activeAttackAnim.aquaEnemySlot]);
          }
          setArrowCoords({
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            x3: p3?.x,
            y3: p3?.y,
            attackerSide: activeAttackAnim.attackerSide,
            atkValue: activeAttackAnim.atkValue,
            attackerName: activeAttackAnim.attackerName,
            targetName: activeAttackAnim.targetName,
            isSolador: activeAttackAnim.isSolador,
            isAquaRedirect: activeAttackAnim.isAquaRedirect
          });
          return;
        }
      }

      // Priority 2: Bot attack waiting in COMBAT_REACTION window
      if (
        gameState.phase === 'COMBAT_REACTION' &&
        gameState.reactionWindow?.type === 'ATTACK_DECLARED' &&
        gameState.reactionWindow.attackerSlot !== undefined &&
        gameState.reactionWindow.targetSlot !== undefined
      ) {
        const atkSlot = gameState.reactionWindow.attackerSlot;
        const tgtSlot = gameState.reactionWindow.targetSlot;
        const botAtkFighter = gameState.bot.frontline[atkSlot];
        const startEl = botSlotRefs.current[atkSlot];
        const endEl = tgtSlot === -1 ? playerHpRef.current : playerSlotRefs.current[tgtSlot];
        const p1 = getCenter(startEl);
        const p2 = getCenter(endEl);
        if (p1 && p2 && botAtkFighter) {
          const tgtFighter = tgtSlot >= 0 ? gameState.player.frontline[tgtSlot] : null;
          const defIsSolador = tgtFighter ? hasArchetype(gameState, tgtFighter, 'Solador') : false;
          setArrowCoords({
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            attackerSide: 'bot',
            atkValue: getFighterEffectiveAtk(gameState, botAtkFighter, true, defIsSolador),
            attackerName: botAtkFighter.card.name,
            targetName: tgtSlot === -1 ? 'Ataque Direto a Você!' : tgtFighter?.card.name || 'Alvo',
            isSolador: hasArchetype(
              gameState,
              botAtkFighter,
              'Solador',
              false,
              tgtSlot >= 0 ? tgtSlot : undefined
            ),
            isReactionLock: true
          });
          return;
        }
      }

      // Priority 3: Player has selected an attacker and is hovering over a valid target
      if (
        selectedAttackerSlot !== null &&
        hoveredAttackTarget !== null &&
        gameState.phase === 'MAIN_PHASE' &&
        gameState.activePlayer === 'player'
      ) {
        const playerAtkFighter = gameState.player.frontline[selectedAttackerSlot];
        const startEl = playerSlotRefs.current[selectedAttackerSlot];
        const endEl =
          hoveredAttackTarget.slot === -1
            ? botHpRef.current
            : hoveredAttackTarget.side === 'bot'
            ? botSlotRefs.current[hoveredAttackTarget.slot]
            : playerSlotRefs.current[hoveredAttackTarget.slot];
        const p1 = getCenter(startEl);
        const p2 = getCenter(endEl);
        if (p1 && p2 && playerAtkFighter) {
          let p3: { x: number; y: number } | null = null;
          if (hoveredAttackTarget.isAquaRedirect) {
            p3 = getCenter(botSlotRefs.current[hoveredAttackTarget.slot]);
          }
          const tgtFighter =
            hoveredAttackTarget.side === 'bot' && hoveredAttackTarget.slot >= 0
              ? gameState.bot.frontline[hoveredAttackTarget.slot]
              : null;
          const defIsSolador = tgtFighter ? hasArchetype(gameState, tgtFighter, 'Solador') : false;
          const effAtk = getFighterEffectiveAtk(gameState, playerAtkFighter, true, defIsSolador);
          setArrowCoords({
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            x3: p3?.x,
            y3: p3?.y,
            attackerSide: 'player',
            atkValue: hoveredAttackTarget.isAquaRedirect ? effAtk * 2 : effAtk,
            attackerName: playerAtkFighter.card.name,
            targetName:
              hoveredAttackTarget.slot === -1
                ? 'Ataque Direto ao Bot!'
                : hoveredAttackTarget.isAquaRedirect
                ? 'Aqua Caótica (2x Dano Reflexo!)'
                : tgtFighter?.card.name || 'Alvo',
            isSolador: hasArchetype(
              gameState,
              playerAtkFighter,
              'Solador',
              false,
              hoveredAttackTarget.slot >= 0 ? hoveredAttackTarget.slot : undefined
            ),
            isPreview: true,
            isAquaRedirect: hoveredAttackTarget.isAquaRedirect
          });
          return;
        }
      }

      setArrowCoords(null);
    };

    computeCoords();
    window.addEventListener('resize', computeCoords);
    return () => window.removeEventListener('resize', computeCoords);
  }, [
    activeAttackAnim,
    hoveredAttackTarget,
    selectedAttackerSlot,
    gameState.phase,
    gameState.reactionWindow,
    gameState.bot.frontline,
    gameState.player.frontline,
    isLogOpen
  ]);

  // Bot automated turn loop (respecting duelSpeed and staged attack animations)
  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    if (activeAttackAnim !== null) return;
    if (gameState.phase !== 'MAIN_PHASE' || gameState.activePlayer !== 'bot') return;
    if (gameState.pendingChoiceQueue.length > 0 || gameState.pendingGuerreiroSplashDamage) return;

    const stepDelay = SPEED_CONFIG[duelSpeed].botStepMs;
    const windupDelay = SPEED_CONFIG[duelSpeed].attackWindupMs;

    const timer = setTimeout(() => {
      setGameState((prev) => {
        if (prev.phase !== 'MAIN_PHASE' || prev.activePlayer !== 'bot') return prev;
        const next: DuelGameState = {
          ...prev,
          player: {
            ...prev.player,
            hand: [...prev.player.hand],
            deck: [...prev.player.deck],
            heroDeck: [...prev.player.heroDeck],
            deadZone: [...prev.player.deadZone],
            erasedZone: [...prev.player.erasedZone],
            frontline: prev.player.frontline.map((f) =>
              f ? { ...f, equipments: [...f.equipments], archetypes: [...f.archetypes] } : null
            ),
            backrow: prev.player.backrow.map((s) =>
              s ? { ...s, stackedCards: [...(s.stackedCards || [])] } : null
            )
          },
          bot: {
            ...prev.bot,
            hand: [...prev.bot.hand],
            deck: [...prev.bot.deck],
            heroDeck: [...prev.bot.heroDeck],
            deadZone: [...prev.bot.deadZone],
            erasedZone: [...prev.bot.erasedZone],
            frontline: prev.bot.frontline.map((f) =>
              f ? { ...f, equipments: [...f.equipments], archetypes: [...f.archetypes] } : null
            ),
            backrow: prev.bot.backrow.map((s) =>
              s ? { ...s, stackedCards: [...(s.stackedCards || [])] } : null
            )
          },
          pendingChoiceQueue: [...prev.pendingChoiceQueue],
          logs: [...prev.logs]
        };

        const step = executeBotTurnStep(next, true);
        if (step.deferredBotAttack) {
          const { attackerSlot, targetSlot } = step.deferredBotAttack;
          const botAttacker = next.bot.frontline[attackerSlot];
          const playerDefender = targetSlot >= 0 ? next.player.frontline[targetSlot] : null;
          const defIsSolador = playerDefender
            ? hasArchetype(next, playerDefender, 'Solador')
            : false;
          const atkVal = botAttacker
            ? getFighterEffectiveAtk(next, botAttacker, true, defIsSolador)
            : 0;
          const atkIsSolador = botAttacker
            ? hasArchetype(
                next,
                botAttacker,
                'Solador',
                false,
                targetSlot >= 0 ? targetSlot : undefined
              )
            : false;

          setActiveAttackAnim({
            attackerSide: 'bot',
            attackerSlot,
            targetSide: 'player',
            targetSlot,
            attackerName: botAttacker?.card.name || 'Bot',
            targetName:
              targetSlot === -1 ? 'Você (Ataque Direto!)' : playerDefender?.card.name || 'Alvo',
            atkValue: atkVal,
            isSolador: atkIsSolador
          });

          setTimeout(() => {
            setGameState((afterWindup) => {
              const resolvedState = cloneState(afterWindup);
              executeCombatResolution(resolvedState, 'bot', attackerSlot, targetSlot);
              return resolvedState;
            });
            setTimeout(() => {
              setActiveAttackAnim(null);
            }, 320);
          }, windupDelay);

          return next;
        }

        if (!step.acted && !step.triggeredReactionWindow && next.phase === 'MAIN_PHASE') {
          addLog(next, 'bot', `Bot encerrou seu turno.`, 'info');
          advanceTurn(next);
        }
        return next;
      });
    }, stepDelay);

    return () => clearTimeout(timer);
  }, [
    isOpen,
    isAuthenticated,
    activeAttackAnim,
    duelSpeed,
    gameState.phase,
    gameState.activePlayer,
    gameState.logs.length,
    gameState.pendingChoiceQueue.length,
    gameState.pendingGuerreiroSplashDamage
  ]);

  if (!isOpen) return null;

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 text-slate-100 select-none">
        <div className="w-full max-w-md bg-slate-900 border-2 border-purple-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
            title="Fechar"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 mb-3 shadow-inner">
              <Lock size={28} />
            </div>
            <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 mb-2">
              Acesso Restrito • Beta Tester
            </span>
            <h2 className="font-display font-black text-xl text-white uppercase tracking-wide">
              Simulador Duelo vs IA
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Informe suas credenciais de teste para acessar o Duelo Automatizado (Deck Insanis).
            </p>
          </div>

          <form onSubmit={handleBetaLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1.5">
                Usuário
              </label>
              <input
                type="text"
                value={loginUser}
                onChange={(e) => {
                  setLoginUser(e.target.value);
                  setLoginError('');
                }}
                placeholder="Digite o usuário de teste..."
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 focus:outline-none text-sm text-white placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1.5">
                Senha
              </label>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => {
                  setLoginPass(e.target.value);
                  setLoginError('');
                }}
                placeholder="Digite a senha..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-500 focus:outline-none text-sm text-white placeholder-slate-500"
              />
            </div>

            {loginError && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs font-bold text-center">
                {loginError}
              </div>
            )}

            <div className="pt-2 flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 transition-colors"
              >
                Acessar Duelo vs IA
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Helper to always ensure any card rendered uses its Moderno frame image
  const getModernImage = (card: CardData): string | undefined => {
    const resolved = resolveModernCardVersion(card, liveCards);
    return resolved.imageUrl || card.imageUrl;
  };

  // Helper to resolve Archetype Icon URL from Manual (liveArchetypes / archetypesList)
  const getArchetypeIcon = (archName: string): string | undefined => {
    const normalized = archName
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const pool = liveArchetypes && liveArchetypes.length > 0 ? liveArchetypes : archetypesList;
    const found =
      pool.find(
        (a) =>
          a.name
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') === normalized
      ) ||
      archetypesList.find(
        (a) =>
          a.name
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') === normalized
      );
    return found?.icon;
  };

  // Sanitize card description: convert <br> tags to line breaks and remove developer notes
  const cleanCardDescription = (desc?: string): string => {
    if (!desc) return '';
    return desc
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\s*\(Nota de Dev:[^)]*\)/gi, '')
      .trim();
  };

  // Color rule for Fighter Attack & HP:
  // Normal (equal to base) = White ('text-white')
  // Loss (lower than base) = Red ('text-red-500')
  // Gain (higher than base) = Green ('text-emerald-400')
  const getStatColorClass = (currentVal: number, baseVal: number): string => {
    if (currentVal > baseVal) return 'text-emerald-400';
    if (currentVal < baseVal) return 'text-red-500';
    return 'text-white';
  };

  // Show any clicked or used card in the Center Card Inspector / Reaction Panel
  const showCardInPanel = (
    card: CardData,
    fighter: FieldFighter | null = null,
    label = 'Carta Selecionada',
    slotCards?: CardData[]
  ) => {
    setPreviewCard(card);
    setPreviewFighter(fighter);
    setPreviewBannerLabel(label);
    if (slotCards && slotCards.length > 0) {
      setPreviewSlotCards(slotCards);
    } else if (fighter && fighter.equipments.length > 0) {
      setPreviewSlotCards([card, ...fighter.equipments.map((e) => e.card)]);
    } else {
      setPreviewSlotCards([card]);
    }
  };

  const cloneState = (prev: DuelGameState): DuelGameState => ({
    ...prev,
    player: {
      ...prev.player,
      hand: [...prev.player.hand],
      deck: [...prev.player.deck],
      heroDeck: [...prev.player.heroDeck],
      deadZone: [...prev.player.deadZone],
      erasedZone: [...prev.player.erasedZone],
      frontline: prev.player.frontline.map((f) =>
        f ? { ...f, equipments: [...f.equipments], archetypes: [...f.archetypes] } : null
      ),
      backrow: prev.player.backrow.map((s) =>
        s ? { ...s, stackedCards: [...(s.stackedCards || [])] } : null
      )
    },
    bot: {
      ...prev.bot,
      hand: [...prev.bot.hand],
      deck: [...prev.bot.deck],
      heroDeck: [...prev.bot.heroDeck],
      deadZone: [...prev.bot.deadZone],
      erasedZone: [...prev.bot.erasedZone],
      frontline: prev.bot.frontline.map((f) =>
        f ? { ...f, equipments: [...f.equipments], archetypes: [...f.archetypes] } : null
      ),
      backrow: prev.bot.backrow.map((s) =>
        s ? { ...s, stackedCards: [...(s.stackedCards || [])] } : null
      )
    },
    pendingChoiceQueue: [...prev.pendingChoiceQueue],
    logs: [...prev.logs]
  });

  const handleRestartDuel = (
    newMode: 'structural_29' | 'optimized_40' = deckMode,
    newPlayerDeck: StructuralDeckId = playerDeckId,
    newBotDeck: BotDeckSelection = botDeckSelection
  ) => {
    setDeckMode(newMode);
    setPlayerDeckId(newPlayerDeck);
    setBotDeckSelection(newBotDeck);
    setSelectedHandIndex(null);
    setSelectedAttackerSlot(null);
    setSelectingSlotForHero(false);
    setPendingReactionHandIndex(null);
    setTrocaFirstSlot(null);
    setPendingGema1Play(null);
    setSelectedChoiceIds([]);
    setPreviewCard(null);
    setPreviewFighter(null);
    setHasAnalyzedCurrentMatch(false);
    setBotMemory(loadBotAdaptiveMemory());
    setGameState(createInitialDuelState(newMode, liveCards, newPlayerDeck, newBotDeck));
  };

  const handleProceedToMulligan = () => {
    setGameState((prev) => {
      const next = cloneState(prev);
      next.phase = 'MULLIGAN';
      addLog(
        next,
        'system',
        `Fase de Mulligan: Você deve escolher entre MANTER TODAS as 5 cartas ou TROCAR TODAS as 5 cartas.`,
        'info'
      );
      return next;
    });
  };

  // All-or-nothing Mulligan
  const handleConfirmMulligan = (replaceAll: boolean) => {
    setGameState((prev) => {
      const next = cloneState(prev);
      if (replaceAll) {
        const oldHand = [...next.player.hand];
        next.player.deck = shuffleCards(next.player.deck);
        const newCards = next.player.deck.splice(0, 5);
        next.player.deck.push(...oldHand);
        next.player.deck = shuffleCards(next.player.deck);
        next.player.hand = newCards;
        addLog(
          next,
          'player',
          `Mulligan: Você trocou todas as 5 cartas iniciais por 5 novas cartas.`,
          'info'
        );
      } else {
        addLog(next, 'player', `Mulligan: Você manteve todas as 5 cartas iniciais.`, 'info');
      }

      performBotSmartMulligan(next);

      next.mulliganDone = true;
      next.phase = 'MAIN_PHASE';
      addLog(
        next,
        'system',
        `=== RODADA 1 • Turno 1 (${
          next.activePlayer === 'player' ? 'Seu Turno' : 'Turno do Bot'
        }) ===`,
        'info'
      );
      processStartOfTurn(next);
      return next;
    });
  };

  // Resolve interactive card choice modal (`pendingChoiceQueue[0]`)
  const handleConfirmPendingChoice = (useSpecialDeadZoneAll = false) => {
    if (!activePendingChoice) return;

    setGameState((prev) => {
      const next = cloneState(prev);
      const modal = next.pendingChoiceQueue.shift();
      if (!modal) return next;

      const p = next.player;
      const chosenCandidates = modal.candidates.filter((c) => selectedChoiceIds.includes(c.id));

      const removeCardFromZone = (
        zone: 'deck' | 'hand' | 'deadZone' | 'erasedZone',
        cardToRemove: CardData
      ) => {
        const list = p[zone];
        const idx = list.findIndex((c) => c.code === cardToRemove.code && c.name === cardToRemove.name);
        if (idx !== -1) {
          list.splice(idx, 1);
          return true;
        }
        return false;
      };

      switch (modal.effectKind) {
        case 'DESTRUICAO_VARIANTES': {
          const sentNames: string[] = [];
          for (const cand of chosenCandidates) {
            if (removeCardFromZone('deck', cand.card)) {
              p.erasedZone.push(cand.card);
              sentNames.push(cand.card.name);
            }
          }
          addLog(
            next,
            'player',
            `«Destruição das Variantes»: Você escolheu e enviou ${sentNames.length} «Jim» do Deck para a Zona Apagada (${sentNames.join(
              ', '
            )})! Total na Zona Apagada: ${countJimsInErasedZone(p)}.`,
            'effect'
          );
          break;
        }

        case 'ASCENSAO_DO_REI': {
          const cand = chosenCandidates[0];
          if (cand && removeCardFromZone('deck', cand.card)) {
            p.erasedZone.push(cand.card);
            addLog(
              next,
              'player',
              `«Ascensão do Rei»: Você enviou «${cand.card.name}» do Deck para a Zona Apagada (${countJimsInErasedZone(
                p
              )} «Jim» na Zona Apagada).`,
              'effect'
            );
          }
          break;
        }

        case 'NECROMANTE': {
          if (useSpecialDeadZoneAll) {
            const deadJims = p.deadZone.filter((c) => isJimCard(c));
            p.deadZone = p.deadZone.filter((c) => !isJimCard(c));
            p.erasedZone.push(...deadJims);
            addLog(
              next,
              'player',
              `Efeito de «Jim - Necromante»: Você moveu todos os ${deadJims.length} «Jim» da Zona Morta para a Zona Apagada!`,
              'effect'
            );
          } else {
            const cand = chosenCandidates[0];
            if (cand && removeCardFromZone('hand', cand.card)) {
              p.erasedZone.push(cand.card);
              addLog(
                next,
                'player',
                `Efeito de «Jim - Necromante»: Você enviou «${cand.card.name}» da sua mão para a Zona Apagada!`,
                'effect'
              );
            }
          }
          break;
        }

        case 'BUSCA_ETERNIDADE': {
          const cand = chosenCandidates[0];
          if (cand && removeCardFromZone('deck', cand.card)) {
            p.hand.push(cand.card);
            p.deck = shuffleCards(p.deck);
            addLog(
              next,
              'player',
              `«Busca Pela Eternidade»: Você buscou «${cand.card.name}» do Deck para a sua mão!`,
              'effect'
            );
          }
          break;
        }

        case 'JIM_LORD_GEMA': {
          const cand = chosenCandidates[0];
          if (cand && removeCardFromZone(cand.sourceZone, cand.card)) {
            p.hand.push(cand.card);
            addLog(
              next,
              'player',
              `«Jim - O Senhor do Macroverso» [9+ Jim]: Você trouxe «${cand.card.name}» (${cand.subtitle}) para a sua mão!`,
              'effect'
            );
          }
          break;
        }

        case 'PORTAL_VARIANTES': {
          const cand = chosenCandidates[0];
          const slot =
            modal.targetSlotForChosenCard !== undefined &&
            p.frontline[modal.targetSlotForChosenCard] === null
              ? modal.targetSlotForChosenCard
              : p.frontline.findIndex((s) => s === null);
          if (cand && slot !== -1 && removeCardFromZone('hand', cand.card)) {
            summonFighterToSlot(next, 'player', cand.card, slot);
          }
          break;
        }

        case 'CHAMADO_VARIANTE': {
          const cand = chosenCandidates[0];
          const slot =
            modal.targetSlotForChosenCard !== undefined &&
            p.frontline[modal.targetSlotForChosenCard] === null
              ? modal.targetSlotForChosenCard
              : p.frontline.findIndex((s) => s === null);
          if (cand && slot !== -1 && removeCardFromZone(cand.sourceZone, cand.card)) {
            summonFighterToSlot(next, 'player', cand.card, slot);
          }
          break;
        }

        case 'FRAGMENTAR': {
          for (const cand of chosenCandidates) {
            const freeSlot = p.frontline.findIndex((s) => s === null);
            if (freeSlot === -1) break;
            if (removeCardFromZone(cand.sourceZone, cand.card)) {
              summonFighterToSlot(next, 'player', cand.card, freeSlot);
            }
          }
          break;
        }

        case 'LAMENTO_DO_REI': {
          for (const cand of chosenCandidates) {
            const freeSlot = p.frontline.findIndex((s) => s === null);
            if (freeSlot === -1) break;
            if (removeCardFromZone(cand.sourceZone, cand.card)) {
              summonFighterToSlot(next, 'player', cand.card, freeSlot);
            }
          }
          break;
        }

        case 'REI_ELFO': {
          const cand = chosenCandidates[0];
          const freeSlot = p.frontline.findIndex((s) => s === null);
          if (cand && freeSlot !== -1 && removeCardFromZone(cand.sourceZone, cand.card)) {
            summonFighterToSlot(next, 'player', cand.card, freeSlot);
            addLog(
              next,
              'player',
              `«Jim - Rei Elfo» (Rodada Seguinte): Invocou automaticamente «${cand.card.name}» do seu Deck na Coluna ${
                freeSlot + 1
              }!`,
              'summon'
            );
          }
          break;
        }

        case 'DISFARCE_MESTRE': {
          const cand = chosenCandidates[0];
          const targetSlot = modal.disfarceTargetSlot ?? 0;
          if (cand && removeCardFromZone(cand.sourceZone, cand.card)) {
            sendFighterFromFieldToZone(next, 'player', targetSlot, true, false);
            summonFighterToSlot(next, 'player', cand.card, targetSlot);
            addLog(
              next,
              'player',
              `🛡️ «Disfarce de Mestre»: Você substituiu o defensor por «${cand.card.name}» na Coluna ${
                targetSlot + 1
              } e encerrou o ataque inimigo!`,
              'reaction'
            );
          }
          break;
        }

        // =====================================================================
        // ESCOLHAS INTERATIVAS DO DECK INVASÃO DO CAOS (VÉU)
        // =====================================================================
        case 'APOTEOSE_CAMADA': {
          const cand = chosenCandidates[0];
          if (cand && removeCardFromZone(cand.sourceZone, cand.card)) {
            if (cand.sourceZone === 'deck') p.deck = shuffleCards(p.deck);
            equipSupportOrCamadaToBackrow(next, 'player', cand.card, -1);
            addLog(
              next,
              'player',
              `✨ «Apoteose do Véu»: Você escolheu e colocou «${cand.card.name}» (${cand.subtitle}) em campo!`,
              'effect'
            );
          }
          break;
        }

        case 'APOTEOSE_ROUND_START': {
          const cand = chosenCandidates[0];
          if (cand && p.hp > 5 && removeCardFromZone(cand.sourceZone, cand.card)) {
            p.hp -= 5;
            if (cand.sourceZone === 'deck') p.deck = shuffleCards(p.deck);
            equipSupportOrCamadaToBackrow(next, 'player', cand.card, -1);
            addLog(
              next,
              'player',
              `💔 «Apoteose do Véu» (Começo da Rodada): Você pagou 5 PV (Vida: ${p.hp} PV) e colocou «${cand.card.name}» em campo!`,
              'life_loss'
            );
          } else {
            addLog(
              next,
              'player',
              `«Apoteose do Véu»: Você optou por não pagar 5 PV no começo desta rodada.`,
              'info'
            );
          }
          break;
        }

        case 'MAHINA_VEU_ZONES': {
          const cand = chosenCandidates[0];
          if (cand && removeCardFromZone(cand.sourceZone, cand.card)) {
            p.hand.push(cand.card);
            addLog(
              next,
              'player',
              `👑 «Mahina - O Arauto do Véu» (Começo do Turno): Você trouxe «${cand.card.name}» (${cand.subtitle}) para a sua mão!`,
              'effect'
            );
          }
          break;
        }

        case 'MAHINA_VEU_COMBAT_ARCHETYPE': {
          const cand = chosenCandidates[0];
          const chosenArch = cand?.archetypeValue;
          const mahinaSlot = modal.targetSlotForChosenCard ?? 0;
          const mahinaF =
            p.frontline[mahinaSlot] && p.frontline[mahinaSlot]!.card.code === '2026/0001/00301'
              ? p.frontline[mahinaSlot]
              : p.frontline.find((f) => f !== null && f.card.code === '2026/0001/00301');
          if (mahinaF && chosenArch) {
            if (!mahinaF.archetypes.includes(chosenArch)) {
              mahinaF.archetypes.push(chosenArch);
            }
            addLog(
              next,
              'player',
              `👑 «Mahina - O Arauto do Véu»: Ganhou o arquétipo [${chosenArch}] após receber ataque e permanecer em campo!`,
              'effect'
            );
          }
          break;
        }

        case 'RITOS_DO_FESTIVAL': {
          const cand = chosenCandidates[0];
          if (cand && removeCardFromZone('deck', cand.card)) {
            p.deck = shuffleCards(p.deck);
            discardCardDirectlyToZone(next, 'player', cand.card, false);
            p.pendingRitosFestival.push({
              card: cand.card,
              summonOnRound: next.round + 2
            });
            addLog(
              next,
              'player',
              `🕯️ «Ritos do Festival»: Você enviou «${cand.card.name}» do seu Deck para a Zona Morta! Ele será invocado na Rodada ${
                next.round + 2
              } imune a efeitos de cartas!`,
              'effect'
            );
          }
          break;
        }

        case 'O_PAPAI_CHEGOU': {
          const cand = chosenCandidates[0];
          const slot =
            modal.targetSlotForChosenCard !== undefined &&
            p.frontline[modal.targetSlotForChosenCard] === null
              ? modal.targetSlotForChosenCard
              : p.frontline.findIndex((s) => s === null);
          if (cand && slot !== -1 && removeCardFromZone(cand.sourceZone, cand.card)) {
            summonFighterToSlot(next, 'player', cand.card, slot);
            addLog(
              next,
              'player',
              `🎉 «O Papai Chegou»: Você retornou «${cand.card.name}» (${cand.subtitle}) para o campo na Coluna ${
                slot + 1
              }!`,
              'summon'
            );
          }
          break;
        }

        case 'FLOQUINHO_VEU_HP_SPEND': {
          const cand = chosenCandidates[0];
          const hpSpent = cand?.hpSpendValue || 1;
          const slot =
            modal.targetSlotForChosenCard !== undefined &&
            p.frontline[modal.targetSlotForChosenCard] === null
              ? modal.targetSlotForChosenCard
              : p.frontline.findIndex((s) => s === null);
          const floqIdx = p.hand.findIndex((c) => c.code === '2026/0001/00314');
          if (floqIdx !== -1 && slot !== -1) {
            const [floqCard] = p.hand.splice(floqIdx, 1);
            const authorityCt = hpSpent * 3;
            const botReaction = evaluateBotReactionToPlayerAction(
              next,
              'CARD_PLAYED',
              floqCard,
              authorityCt,
              undefined,
              undefined,
              (activeState) => {
                summonFloquinhoCaoticaWithHp(activeState, 'player', floqCard, slot, hpSpent);
              }
            );
            if (next.reactionWindow?.isCounterChain) {
              return next;
            }
            if (botReaction.botNegatedPlayerAction) {
              sendCardToDeadOrErasedZone(next, 'player', floqCard);
              return next;
            }
            summonFloquinhoCaoticaWithHp(next, 'player', floqCard, slot, hpSpent);
          }
          break;
        }
      }

      return next;
    });
  };

  // Handle Guerreiro 5 splash damage target click
  const handleGuerreiroSplashTargetClick = (ownerId: 'player' | 'bot', slotIndex: number) => {
    setGameState((prev) => {
      if (!prev.pendingGuerreiroSplashDamage) return prev;
      const next = cloneState(prev);
      const targetOwner = ownerId === 'player' ? next.player : next.bot;
      const targetFighter = targetOwner.frontline[slotIndex];
      if (!targetFighter) return prev;

      next.pendingGuerreiroSplashDamage = false;
      const guerreiroFighter =
        next.player.frontline.find((f) => f && f.card.code === '2025/0001/00002') ||
        targetFighter;

      addLog(
        next,
        'player',
        `Efeito de «Jim - Guerreiro»: Causou 5 de dano em «${targetFighter.card.name}»!`,
        'life_loss'
      );
      applyEffectDamageToFighter(
        next,
        'player',
        ownerId,
        slotIndex,
        5,
        guerreiroFighter.card,
        guerreiroFighter.card.ct
      );
      checkWinCondition(next);
      return next;
    });
  };

  // Play a card from Player's hand in Main Phase
  const executePlayerCardPlay = (
    handIndex: number,
    targetSlot = 0,
    chosenArchetypes?: string[]
  ) => {
    setGameState((prev) => {
      const next = cloneState(prev);
      const card = next.player.hand[handIndex];
      if (!card) return prev;

      const check = canPlayCardInMainPhase(next, 'player', card);
      if (!check.allowed) {
        addLog(
          next,
          'system',
          `Jogada inválida para «${card.name}»: ${check.reason}`,
          'info'
        );
        return next;
      }

      // Floquinho Caótica do Véu (2026/0001/00314): abre modal para o jogador escolher quanta Vida gastar!
      if (card.code === '2026/0001/00314') {
        const maxHpSpend = Math.max(1, next.player.hp - 1);
        const hpCandidates: ChoiceCandidate[] = [];
        for (let hpVal = 1; hpVal <= maxHpSpend; hpVal++) {
          hpCandidates.push({
            id: `floq_hp_${hpVal}`,
            card: {
              ...card,
              name: `Gastar ${hpVal} PV → ${hpVal * 3}/${hpVal * 3} (CT ${hpVal * 3})`,
              ct: hpVal * 3,
              attack: hpVal * 3,
              defense: hpVal * 3
            },
            sourceZone: 'hand',
            sourceIndex: handIndex,
            subtitle: `Pagar ${hpVal} PV (Vida restante: ${next.player.hp - hpVal} PV)`,
            hpSpendValue: hpVal
          });
        }
        next.pendingChoiceQueue.push({
          title: '«Floquinho Caótica do Véu» — Escolha quanta Vida gastar na invocação',
          description:
            'Para cada 1 de Vida de Jogador gasto, «Floquinho Caótica do Véu» recebe +3 de Custo (CT), +3 de Ataque e +3 de Vida:',
          candidates: hpCandidates,
          minSelect: 1,
          maxSelect: 1,
          targetSlotForChosenCard: targetSlot,
          effectKind: 'FLOQUINHO_VEU_HP_SPEND'
        });
        return next;
      }

      const effCt = getEffectiveCt(next.player, card);
      const authorityCt = getCardAuthorityCt(next.player, card);
      next.player.mana -= effCt;
      next.player.hand.splice(handIndex, 1);

      addLog(
        next,
        'player',
        `Você jogou «${card.name}» (Custo pago: ${effCt} Mana | CT da carta: ${authorityCt}).`,
        card.type === 'Combatente' || card.type === 'Herói' ? 'summon' : 'effect'
      );

      const botReaction = evaluateBotReactionToPlayerAction(
        next,
        'CARD_PLAYED',
        card,
        authorityCt,
        undefined,
        undefined,
        (activeState) => {
          resolveInsanisCardEffect(activeState, 'player', card, targetSlot, chosenArchetypes);
        }
      );

      if (next.reactionWindow?.isCounterChain) {
        return next;
      }

      if (botReaction.botNegatedPlayerAction) {
        // Se o Bot usou Como Planejado, a carta já foi movida para a Zona Apagada do Bot
        if (!next.bot.erasedZone.includes(card)) {
          sendCardToDeadOrErasedZone(next, 'player', card);
        }
        return next;
      }

      resolveInsanisCardEffect(next, 'player', card, targetSlot, chosenArchetypes);
      return next;
    });

    setSelectedHandIndex(null);
    setPendingGema1Play(null);
  };

  // Summon Hero into a chosen slot (enforcing official summoning requirements per Hero!)
  const handleSummonHeroToSlot = (slotIndex: number) => {
    setGameState((prev) => {
      const next = cloneState(prev);
      const isAnytimeWindow =
        next.phase === 'CARD_REACTION' ||
        next.phase === 'COMBAT_REACTION' ||
        next.phase === 'PRE_DRAW_WINDOW';

      let summonableIdx = -1;
      if (selectedHeroCodeToSummon) {
        summonableIdx = next.player.heroDeck.findIndex(
          (h) =>
            h.code === selectedHeroCodeToSummon &&
            canSummonHeroDirectly(next, 'player', h, isAnytimeWindow).allowed
        );
      }
      if (summonableIdx === -1) {
        summonableIdx = next.player.heroDeck.findIndex(
          (h) => canSummonHeroDirectly(next, 'player', h, isAnytimeWindow).allowed
        );
      }
      if (summonableIdx === -1) {
        const firstHero =
          next.player.heroDeck.find((h) => h.code === selectedHeroCodeToSummon) ||
          next.player.heroDeck[0];
        if (firstHero) {
          const check = canSummonHeroDirectly(next, 'player', firstHero, isAnytimeWindow);
          addLog(
            next,
            'system',
            `Requisito de invocação de «${firstHero.name}» não cumprido: ${check.reason}`,
            'info'
          );
        }
        return next;
      }

      const [heroCard] = next.player.heroDeck.splice(summonableIdx, 1);
      payDirectHeroSummonCost(next, 'player', heroCard);
      const authorityCt = getCardAuthorityCt(next.player, heroCard);

      if (
        (next.phase === 'CARD_REACTION' || next.phase === 'COMBAT_REACTION') &&
        next.reactionWindow
      ) {
        const rw = next.reactionWindow;
        next.reactionWindow = null;
        next.phase = 'MAIN_PHASE';

        addLog(
          next,
          'player',
          `🛡️ Reação «A Qualquer Momento»! Você invocou «${heroCard.name}» na Coluna ${
            slotIndex + 1
          } antes da ação do Bot!`,
          'reaction'
        );
        summonFighterToSlot(next, 'player', heroCard, slotIndex);

        if (!checkWinCondition(next)) {
          rw.pendingPayload(next);
        }
        return next;
      }

      addLog(
        next,
        'player',
        `👑 Você declarou a invocação do Herói «${heroCard.name}» na Coluna ${
          slotIndex + 1
        }!`,
        'summon'
      );

      const botReact = evaluateBotReactionToPlayerAction(
        next,
        'CARD_PLAYED',
        heroCard,
        authorityCt,
        undefined,
        undefined,
        (activeState) => {
          summonFighterToSlot(activeState, 'player', heroCard, slotIndex);
        }
      );

      if (next.reactionWindow?.isCounterChain) {
        return next;
      }

      if (botReact.botNegatedPlayerAction) {
        if (!next.bot.erasedZone.includes(heroCard)) {
          sendCardToDeadOrErasedZone(next, 'player', heroCard);
        }
        return next;
      }

      summonFighterToSlot(next, 'player', heroCard, slotIndex);
      return next;
    });
    setSelectingSlotForHero(false);
    setSelectedHeroCodeToSummon(null);
  };

  // Resolve a Reaction Card played by the Player on a chosen slot (or immediately if no slot needed)
  const executePlayerReactionCardOnSlot = (
    handIdx: number,
    chosenSlot: number,
    secondSlot?: number,
    chosenArchs?: string[]
  ) => {
    setGameState((prev) => {
      if (!prev.reactionWindow) return prev;
      const next = cloneState(prev);
      const rw = next.reactionWindow!;
      const card = next.player.hand[handIdx];
      if (!card) return prev;

      next.reactionWindow = null;
      next.phase = 'MAIN_PHASE';

      if (card.code === '2025/0001/00029') {
        const lifeCost = rw.effectiveCtOfTrigger ?? 0;
        next.player.hand.splice(handIdx, 1);
        next.player.hp = Math.max(0, next.player.hp - lifeCost);
        discardCardDirectlyToZone(next, 'player', card, false);

        const triggerCt = rw.effectiveCtOfTrigger ?? 0;
        const myCt = getCardAuthorityCt(next.player, card);
        addLog(
          next,
          'player',
          `🛡️ Reação «A Qualquer Momento»! Você ativou «Selamento Verdadeiro» (CT ${myCt} vs CT ${triggerCt}), pagou ${lifeCost} PV e declarou NEGAÇÃO contra «${rw.triggerCard?.name}» do Bot!`,
          'reaction'
        );

        if (checkWinCondition(next)) {
          return next;
        }

        const botCounter = evaluateBotReactionToPlayerAction(
          next,
          'CARD_PLAYED',
          card,
          myCt,
          undefined,
          undefined,
          (activeState) => {
            if (rw.isCounterChain && rw.onNegatedPayload) {
              rw.onNegatedPayload(activeState);
            } else if (rw.triggerCard) {
              sendCardToDeadOrErasedZone(activeState, 'bot', rw.triggerCard);
            }
          }
        );

        if (next.reactionWindow?.isCounterChain) {
          return next;
        }

        if (botCounter.botNegatedPlayerAction) {
          addLog(
            next,
            'bot',
            `⛓️ Corrente de Reação! O Bot contra-negou seu «Selamento Verdadeiro» — a ação original do Bot prossegue!`,
            'reaction'
          );
          if (!checkWinCondition(next)) {
            rw.pendingPayload(next);
          }
          return next;
        }

        if (rw.isCounterChain && rw.onNegatedPayload) {
          rw.onNegatedPayload(next);
        } else if (rw.triggerCard) {
          sendCardToDeadOrErasedZone(next, 'bot', rw.triggerCard);
        }
        checkWinCondition(next);
        return next;
      }

      // Como Planejado (2026/0002/00322): "Negue o uso de uma carta e envie-a para a sua Zona Apagada. Na próxima rodada, use-a sem pagar custos."
      if (card.code === '2026/0002/00322' && rw.type === 'CARD_PLAYED') {
        const effCt = getEffectiveCt(next.player, card, true);
        const myCt = getCardAuthorityCt(next.player, card);
        next.player.mana -= effCt;
        next.player.hand.splice(handIdx, 1);
        discardCardDirectlyToZone(next, 'player', card, false);

        const finalizeComoPlanejado = (activeState: DuelGameState) => {
          if (rw.isCounterChain && rw.onNegatedPayload) {
            rw.onNegatedPayload(activeState);
          } else if (rw.triggerCard) {
            activeState.player.erasedZone.push(rw.triggerCard);
            activeState.player.pendingComoPlanejadoCards.push({
              card: rw.triggerCard,
              readyOnRound: activeState.round + 1
            });
            addLog(
              activeState,
              'player',
              `🛡️ «Como Planejado»: Você NEGOU «${rw.triggerCard.name}» do Bot, enviou-a para a sua Zona Apagada e irá usá-la sem pagar custos no começo da Rodada ${
                activeState.round + 1
              }!`,
              'reaction'
            );
          }
        };

        const botCounter = evaluateBotReactionToPlayerAction(
          next,
          'CARD_PLAYED',
          card,
          myCt,
          undefined,
          undefined,
          finalizeComoPlanejado
        );

        if (next.reactionWindow?.isCounterChain) {
          return next;
        }

        if (botCounter.botNegatedPlayerAction) {
          addLog(
            next,
            'bot',
            `⛓️ Corrente de Reação! O Bot negou seu «Como Planejado» — a ação original do Bot prossegue!`,
            'reaction'
          );
          if (!checkWinCondition(next)) {
            rw.pendingPayload(next);
          }
          return next;
        }

        finalizeComoPlanejado(next);
        checkWinCondition(next);
        return next;
      }

      // Negar na Base do Soco (2025/0001/00201)
      if (card.code === '2025/0001/00201' && rw.type === 'CARD_PLAYED') {
        const effCt = getEffectiveCt(next.player, card, true);
        next.player.mana -= effCt;
        next.player.hand.splice(handIdx, 1);
        discardCardDirectlyToZone(next, 'player', card, false);
        addLog(
          next,
          'player',
          `🛡️ Reação! Você ativou «${card.name}» (CT ${effCt}) e NEGOU «${rw.triggerCard?.name}» do Bot!`,
          'reaction'
        );
        if (rw.isCounterChain && rw.onNegatedPayload) {
          rw.onNegatedPayload(next);
        } else if (rw.triggerCard) {
          sendCardToDeadOrErasedZone(next, 'bot', rw.triggerCard);
        }
        checkWinCondition(next);
        return next;
      }

      if (rw.type === 'ATTACK_DECLARED') {
        const effCt = getEffectiveCt(next.player, card, true);
        const authorityCt = getCardAuthorityCt(next.player, card);
        next.player.mana -= effCt;
        next.player.hand.splice(handIdx, 1);
        discardCardDirectlyToZone(next, 'player', card, false);

        const executePlayerCombatReactionEffect = (activeState: DuelGameState) => {
          // Coragem ao Contrário (2026/0002/00317): Cancela ataque, retorna combatente aliado para a mão e compra 1 carta
          if (card.code === '2026/0002/00317') {
            const targetDefSlot =
              rw.targetSlot !== undefined && rw.targetSlot >= 0 ? rw.targetSlot : chosenSlot;
            const defFighter = activeState.player.frontline[targetDefSlot];
            if (defFighter && !defFighter.isHero) {
              activeState.player.frontline[targetDefSlot] = null;
              for (const eq of defFighter.equipments) {
                discardCardDirectlyToZone(activeState, 'player', eq.card, false);
              }
              activeState.player.hand.push(defFighter.card);
            }
            if (activeState.player.deck.length > 0) {
              activeState.player.hand.push(activeState.player.deck.shift()!);
            }
            if (rw.attackerSlot !== undefined && activeState.bot.frontline[rw.attackerSlot]) {
              const botAtt = activeState.bot.frontline[rw.attackerSlot]!;
              botAtt.attacksThisTurnCount = (botAtt.attacksThisTurnCount || 0) + 1;
              botAtt.hasAttackedThisTurn =
                botAtt.attacksThisTurnCount >= getMaxAttacksPerTurn(activeState, botAtt);
              activeState.bot.hasAttackedInCurrentTurn = true;
            }
            addLog(
              activeState,
              'player',
              `🛡️ Reação de Combate! «Coragem ao Contrário» cancelou o ataque do Bot${
                defFighter && !defFighter.isHero
                  ? `, retornou «${defFighter.card.name}» para a sua mão`
                  : ''
              } e você comprou 1 carta!`,
              'reaction'
            );
            return;
          }

          // Férias (2025/0001/00112) ou Sedução de Afrodite (2025/0001/00285)
          if (card.code === '2025/0001/00112' || card.code === '2025/0001/00285') {
            if (rw.attackerSlot !== undefined && activeState.bot.frontline[rw.attackerSlot]) {
              const botAtt = activeState.bot.frontline[rw.attackerSlot]!;
              botAtt.attacksThisTurnCount = (botAtt.attacksThisTurnCount || 0) + 1;
              botAtt.hasAttackedThisTurn =
                botAtt.attacksThisTurnCount >= getMaxAttacksPerTurn(activeState, botAtt);
              activeState.bot.hasAttackedInCurrentTurn = true;
            }
            addLog(
              activeState,
              'player',
              `🛡️ Reação de Combate! «${card.name}» NEGOU o ataque do Bot!`,
              'reaction'
            );
            return;
          }

          if (card.code === '2025/0001/00024') {
            const defFighter = activeState.player.frontline[chosenSlot];
            if (defFighter) {
              activeState.player.frontline[chosenSlot] = null;
              for (const eq of defFighter.equipments) {
                discardCardDirectlyToZone(activeState, 'player', eq.card, false);
              }
              activeState.player.deck.push(defFighter.card);
              activeState.player.deck = shuffleCards(activeState.player.deck);
              addLog(
                activeState,
                'player',
                `🛡️ Reação de Combate! «Sobrevivência Covarde» retornou «${defFighter.card.name}» (Coluna ${
                  chosenSlot + 1
                }) para o seu Deck e NEGOU o ataque do Bot!`,
                'reaction'
              );
            }
            if (rw.attackerSlot !== undefined && activeState.bot.frontline[rw.attackerSlot]) {
              const botAtt = activeState.bot.frontline[rw.attackerSlot]!;
              botAtt.attacksThisTurnCount = (botAtt.attacksThisTurnCount || 0) + 1;
              botAtt.hasAttackedThisTurn =
                botAtt.attacksThisTurnCount >= getMaxAttacksPerTurn(activeState, botAtt);
              activeState.bot.hasAttackedInCurrentTurn = true;
            }
            return;
          }

          if (card.code === '2025/0001/00028') {
            if (rw.attackerSlot !== undefined && activeState.bot.frontline[rw.attackerSlot]) {
              const botAtt = activeState.bot.frontline[rw.attackerSlot]!;
              botAtt.attacksThisTurnCount = (botAtt.attacksThisTurnCount || 0) + 1;
              botAtt.hasAttackedThisTurn =
                botAtt.attacksThisTurnCount >= getMaxAttacksPerTurn(activeState, botAtt);
              activeState.bot.hasAttackedInCurrentTurn = true;
            }

            const candidates: ChoiceCandidate[] = [
              ...activeState.player.hand
                .map((c, idx) => ({ c, idx }))
                .filter((item) => item.c.type === 'Combatente')
                .map((item) => ({
                  id: `disfarce_hand_${item.idx}`,
                  card: item.c,
                  sourceZone: 'hand' as const,
                  sourceIndex: item.idx,
                  subtitle: 'Na sua Mão'
                })),
              ...activeState.player.erasedZone
                .map((c, idx) => ({ c, idx }))
                .filter((item) => item.c.type === 'Combatente')
                .map((item) => ({
                  id: `disfarce_erased_${item.idx}`,
                  card: item.c,
                  sourceZone: 'erasedZone' as const,
                  sourceIndex: item.idx,
                  subtitle: 'Na Zona Apagada'
                }))
            ];

            if (candidates.length > 0) {
              activeState.pendingChoiceQueue.push({
                title: '«Disfarce de Mestre» — Escolha o Combatente Substituto',
                description: `Selecione qual combatente da sua Mão ou Zona Apagada entrará na Coluna ${
                  chosenSlot + 1
                } (o ataque inimigo foi encerrado):`,
                candidates,
                minSelect: 1,
                maxSelect: 1,
                disfarceTargetSlot: chosenSlot,
                effectKind: 'DISFARCE_MESTRE'
              });
            }
            return;
          }

          if (card.code === '2025/0001/00023' && secondSlot !== undefined) {
            const fA = activeState.player.frontline[chosenSlot];
            const fB = activeState.player.frontline[secondSlot];
            if (fA && fB) {
              activeState.player.frontline[chosenSlot] = { ...fB, slotIndex: chosenSlot };
              activeState.player.frontline[secondSlot] = { ...fA, slotIndex: secondSlot };
              addLog(
                activeState,
                'player',
                `🛡️ Reação de Combate! «Ligação das Variantes» trocou as colunas de «${fA.card.name}» (Coluna ${
                  chosenSlot + 1
                }) e «${fB.card.name}» (Coluna ${secondSlot + 1})!`,
                'reaction'
              );
            }
            rw.pendingPayload(activeState);
          }
        };

        const botCounter = evaluateBotReactionToPlayerAction(
          next,
          'CARD_PLAYED',
          card,
          authorityCt,
          undefined,
          undefined,
          executePlayerCombatReactionEffect
        );

        if (next.reactionWindow?.isCounterChain) {
          return next;
        }

        if (botCounter.botNegatedPlayerAction) {
          addLog(
            next,
            'bot',
            `⛓️ Corrente de Reação! O Bot negou sua reação de combate «${card.name}» — o ataque do Bot prossegue!`,
            'reaction'
          );
          rw.pendingPayload(next);
          return next;
        }

        executePlayerCombatReactionEffect(next);
        return next;
      }

      const myCt = getEffectiveCt(next.player, card, true);
      const authorityCt = getCardAuthorityCt(next.player, card);
      const triggerCt = rw.effectiveCtOfTrigger ?? 0;
      next.player.mana -= myCt;
      next.player.hand.splice(handIdx, 1);

      const playerResolvesFirst = authorityCt > triggerCt;

      addLog(
        next,
        'player',
        `🛡️ Reação Cruzada! Você reagiu com «${card.name}» (CT ${authorityCt}) na Coluna ${
          chosenSlot + 1
        } contra «${rw.triggerCard?.name || 'ação'}» do Bot (CT ${triggerCt}) → ${
          playerResolvesFirst
            ? 'Sua carta tem CT maior e resolve ANTES!'
            : 'CT menor ou igual ao do jogador do turno: a carta do Bot resolve antes.'
        }`,
        'reaction'
      );

      if (playerResolvesFirst) {
        resolveInsanisCardEffect(next, 'player', card, chosenSlot, chosenArchs);
        if (!checkWinCondition(next)) {
          rw.pendingPayload(next);
        }
      } else {
        rw.pendingPayload(next);
        if (!checkWinCondition(next)) {
          resolveInsanisCardEffect(next, 'player', card, chosenSlot, chosenArchs);
        }
      }

      return next;
    });

    setPendingReactionHandIndex(null);
    setTrocaFirstSlot(null);
    setPendingGema1Play(null);
  };

  const doesCardNeedSlotSelection = (card: CardData, isCombatReaction: boolean): boolean => {
    if (isCombatReaction) {
      return (
        card.code === '2025/0001/00024' ||
        card.code === '2025/0001/00028' ||
        card.code === '2025/0001/00023'
      );
    }
    // Cartas globais que NÃO exigem clique em slot no campo:
    if (
      card.code === '2025/0001/00018' || // Lamento do Rei
      card.code === '2025/0001/00022' || // Pacto Forçado
      card.code === '2025/0001/00026' || // Manipulação das Realidades
      card.code === '2025/0001/00029' || // Selamento Verdadeiro
      card.code === '2025/0001/00030' || // Destruição das Variantes
      card.code === '2025/0001/00112' || // Férias
      card.code === '2025/0001/00116' || // Alteração de Realidade
      card.code === '2025/0001/00201' || // Negar na Base do Soco
      card.code === '2026/0002/00316' || // AQUI FOI...
      card.code === '2026/0002/00317' || // Coragem ao Contrário
      card.code === '2026/0002/00318' || // O Papai Chegou
      card.code === '2026/0002/00319' || // Ritos do Festival
      card.code === '2026/0002/00320' || // Ato Final
      card.code === '2026/0002/00322'    // Como Planejado
    ) {
      return false;
    }
    if (card.type === 'Combatente' || card.type === 'Herói' || card.type === 'Equipamento') {
      return true;
    }
    if (isContinuousBackrowCard(card)) {
      return true;
    }
    if (
      card.code === '2025/0001/00016' ||
      card.code === '2025/0001/00017' ||
      card.code === '2025/0001/00019' ||
      card.code === '2025/0001/00020' ||
      card.code === '2025/0001/00021' ||
      card.code === '2025/0001/00025' ||
      card.code === '2025/0001/00027' ||
      card.code === '2026/0002/00321' || // Festival de Sangue
      card.code === '2026/0002/00323'    // Olho por Olho
    ) {
      return true;
    }
    if (card.type === 'Efeito' && card.description.toLowerCase().includes('cause')) {
      return true;
    }
    return false;
  };

  // When player clicks a card in their Hand bar
  const handleHandCardClick = (idx: number) => {
    const card = gameState.player.hand[idx];
    if (!card) return;

    // Always show clicked card in Left Card Inspector Panel
    showCardInPanel(card, null, 'Carta da Mão');

    if (gameState.phase === 'CARD_REACTION' || gameState.phase === 'COMBAT_REACTION') {
      const isPlayableReaction = availablePlayerReactions.handCards.some(
        (rc) => rc.code === card.code
      );
      if (!isPlayableReaction) return;

      if (pendingReactionHandIndex === idx) {
        setPendingReactionHandIndex(null);
        setTrocaFirstSlot(null);
        return;
      }

      const isCombatReaction = gameState.phase === 'COMBAT_REACTION';
      if (!doesCardNeedSlotSelection(card, isCombatReaction)) {
        executePlayerReactionCardOnSlot(idx, 0);
      } else {
        setSelectingSlotForHero(false);
        setPendingReactionHandIndex(idx);
        setTrocaFirstSlot(null);
      }
      return;
    }

    if (gameState.phase !== 'MAIN_PHASE' || gameState.activePlayer !== 'player') return;

    const check = canPlayCardInMainPhase(gameState, 'player', card);
    if (!check.allowed) return;

    setSelectedAttackerSlot(null);
    setSelectingSlotForHero(false);

    if (selectedHandIndex === idx) {
      setSelectedHandIndex(null);
      return;
    }

    if (!doesCardNeedSlotSelection(card, false) && card.type === 'Efeito') {
      executePlayerCardPlay(idx, 0);
      return;
    }

    setSelectedHandIndex(idx);
  };

  // Friendly attack on Aqua Caótica (2026/0001/00310):
  // "Aliados em seu lado do campo podem atacar «Aqua Caótica» para que o combatente inimigo à frente dela receba o dobro do dano que ela sofrer (ignorando arquétipos)."
  const handleFriendlyAttackAquaCaotica = (attackerSlot: number, aquaSlot: number) => {
    if (activeAttackAnim !== null) return;
    const attacker = gameState.player.frontline[attackerSlot];
    const aqua = gameState.player.frontline[aquaSlot];
    if (!attacker || !aqua) return;

    const effAtk = getFighterEffectiveAtk(gameState, attacker, true);
    const windupDelay = SPEED_CONFIG[duelSpeed].attackWindupMs;

    setSelectedAttackerSlot(null);
    setHoveredAttackTarget(null);
    setActiveAttackAnim({
      attackerSide: 'player',
      attackerSlot,
      targetSide: 'player',
      targetSlot: aquaSlot,
      attackerName: attacker.card.name,
      targetName: `Aqua Caótica → 2x Dano (${effAtk * 2})`,
      atkValue: effAtk * 2,
      isAquaRedirect: true,
      aquaEnemySlot: aquaSlot
    });

    setTimeout(() => {
      setGameState((prev) => {
        const next = cloneState(prev);
        executeFriendlyAttackOnAquaCaotica(next, 'player', attackerSlot, aquaSlot);
        return next;
      });
      setTimeout(() => {
        setActiveAttackAnim(null);
      }, 320);
    }, windupDelay);
  };

  // Click on Player Frontline Slot (0..5)
  const handlePlayerFrontSlotClick = (slotIndex: number) => {
    const slotFighter = gameState.player.frontline[slotIndex];
    if (slotFighter && selectedHandIndex === null && pendingReactionHandIndex === null && !selectingSlotForHero) {
      showCardInPanel(slotFighter.card, slotFighter, 'Combatente em Campo');
    }

    if (gameState.pendingGuerreiroSplashDamage && slotFighter) {
      handleGuerreiroSplashTargetClick('player', slotIndex);
      return;
    }

    if (selectingSlotForHero) {
      if (slotFighter === null || slotFighter.isHero) {
        handleSummonHeroToSlot(slotIndex);
      }
      return;
    }

    if (
      (gameState.phase === 'CARD_REACTION' || gameState.phase === 'COMBAT_REACTION') &&
      pendingReactionHandIndex !== null
    ) {
      const reactCard = gameState.player.hand[pendingReactionHandIndex];
      if (!reactCard) return;

      if (gameState.phase === 'COMBAT_REACTION') {
        if (
          (reactCard.code === '2025/0001/00024' || reactCard.code === '2025/0001/00028') &&
          slotFighter !== null
        ) {
          if (reactCard.code === '2025/0001/00024' && slotFighter.isHero) return;
          executePlayerReactionCardOnSlot(pendingReactionHandIndex, slotIndex);
          return;
        }
        if (reactCard.code === '2025/0001/00023' && slotFighter !== null) {
          if (trocaFirstSlot === null) {
            setTrocaFirstSlot(slotIndex);
          } else if (trocaFirstSlot !== slotIndex) {
            executePlayerReactionCardOnSlot(
              pendingReactionHandIndex,
              trocaFirstSlot,
              slotIndex
            );
          }
          return;
        }
      }

      if (gameState.phase === 'CARD_REACTION') {
        if (
          (reactCard.type === 'Combatente' ||
            reactCard.code === '2025/0001/00021' ||
            reactCard.code === '2025/0001/00027' ||
            reactCard.code === '2026/0002/00321') &&
          slotFighter === null
        ) {
          executePlayerReactionCardOnSlot(pendingReactionHandIndex, slotIndex);
          return;
        }
        if (
          reactCard.type === 'Equipamento' &&
          !isContinuousBackrowCard(reactCard) &&
          slotFighter !== null
        ) {
          const isMacroGem =
            reactCard.code === '2025/0001/00013' ||
            reactCard.code === '2025/0001/00014' ||
            reactCard.code === '2025/0001/00015';
          if (isMacroGem && !slotFighter.isHero) return;

          if (reactCard.code === '2025/0001/00013') {
            setPendingGema1Play({
              handIndex: pendingReactionHandIndex,
              targetSlot: slotIndex,
              selectedArchs: ['Caos', 'Lúmen', 'Darkus'],
              isReaction: true
            });
            return;
          }
          executePlayerReactionCardOnSlot(pendingReactionHandIndex, slotIndex);
          return;
        }
        if (
          (reactCard.code === '2025/0001/00019' || reactCard.code === '2025/0001/00020') &&
          slotFighter !== null
        ) {
          executePlayerReactionCardOnSlot(pendingReactionHandIndex, slotIndex);
          return;
        }
      }
      return;
    }

    if (gameState.phase !== 'MAIN_PHASE' || gameState.activePlayer !== 'player') return;

    if (selectedHandIndex !== null) {
      const card = gameState.player.hand[selectedHandIndex];
      if (!card) return;

      if (card.type === 'Combatente' || card.type === 'Herói') {
        if (slotFighter === null || (card.type === 'Herói' && slotFighter.isHero)) {
          executePlayerCardPlay(selectedHandIndex, slotIndex);
        }
        return;
      }

      if (card.type === 'Equipamento' && !isContinuousBackrowCard(card) && slotFighter !== null) {
        const isMacroGem =
          card.code === '2025/0001/00013' ||
          card.code === '2025/0001/00014' ||
          card.code === '2025/0001/00015';
        if (isMacroGem && !slotFighter.isHero) {
          setGameState((prev) => {
            const next = cloneState(prev);
            addLog(
              next,
              'system',
              `As Gemas Macroversais só podem ser equipadas em um Herói!`,
              'info'
            );
            return next;
          });
          return;
        }

        if (card.code === '2025/0001/00013') {
          setPendingGema1Play({
            handIndex: selectedHandIndex,
            targetSlot: slotIndex,
            selectedArchs: ['Caos', 'Lúmen', 'Darkus'],
            isReaction: false
          });
          return;
        }

        executePlayerCardPlay(selectedHandIndex, slotIndex);
        return;
      }

      if (
        (card.code === '2025/0001/00019' || card.code === '2025/0001/00020') &&
        slotFighter !== null
      ) {
        executePlayerCardPlay(selectedHandIndex, slotIndex);
        return;
      }

      if (
        (card.code === '2025/0001/00021' ||
          card.code === '2025/0001/00027' ||
          card.code === '2026/0002/00321') &&
        slotFighter === null
      ) {
        executePlayerCardPlay(selectedHandIndex, slotIndex);
        return;
      }
    }

    if (slotFighter) {
      // Se já houver um atacante aliado selecionado e o jogador clicar em «Aqua Caótica» aliada:
      if (
        selectedAttackerSlot !== null &&
        selectedAttackerSlot !== slotIndex &&
        slotFighter.card.code === '2026/0001/00310' &&
        gameState.round >= 2 &&
        gameState.bot.frontline[slotIndex] !== null
      ) {
        handleFriendlyAttackAquaCaotica(selectedAttackerSlot, slotIndex);
        return;
      }

      if (selectedAttackerSlot === slotIndex) {
        setSelectedAttackerSlot(null);
      } else {
        setSelectedAttackerSlot(slotIndex);
        setSelectedHandIndex(null);
      }
    }
  };

  // Click on Player Backrow Support / Equipment Slot (0..5)
  const handlePlayerSupportSlotClick = (slotIndex: number) => {
    const targetBackSlot = gameState.player.backrow[slotIndex];
    const targetFrontFighter = gameState.player.frontline[slotIndex];
    const hasFighterEquipInCol = (targetFrontFighter?.equipments.length ?? 0) > 0;

    if (gameState.phase === 'CARD_REACTION' && pendingReactionHandIndex !== null) {
      const reactCard = gameState.player.hand[pendingReactionHandIndex];
      if (!reactCard) return;

      if (isContinuousBackrowCard(reactCard)) {
        if (isPlayerEquipmentCard(reactCard)) {
          if (targetBackSlot !== null && !isPlayerEquipmentCard(targetBackSlot.card)) {
            setGameState((prev) => {
              const next = cloneState(prev);
              addLog(
                next,
                'system',
                'Equipamentos não podem ser colocados na mesma área que já possui uma Carta de Efeito!',
                'info'
              );
              return next;
            });
            return;
          }
        } else {
          if (targetBackSlot !== null || hasFighterEquipInCol) {
            setGameState((prev) => {
              const next = cloneState(prev);
              addLog(
                next,
                'system',
                'Cartas de Efeito não podem ser colocadas na mesma área que já possui uma carta de Equipamento ou Efeito!',
                'info'
              );
              return next;
            });
            return;
          }
        }
        executePlayerReactionCardOnSlot(pendingReactionHandIndex, slotIndex);
        return;
      }

      if (
        reactCard.type === 'Equipamento' &&
        !isContinuousBackrowCard(reactCard) &&
        targetFrontFighter !== null
      ) {
        if (targetBackSlot !== null && !isPlayerEquipmentCard(targetBackSlot.card)) {
          setGameState((prev) => {
            const next = cloneState(prev);
            addLog(
              next,
              'system',
              'Equipamentos não podem ser colocados na mesma área que já possui uma Carta de Efeito!',
              'info'
            );
            return next;
          });
          return;
        }
        handlePlayerFrontSlotClick(slotIndex);
        return;
      }
      return;
    }

    if (gameState.phase !== 'MAIN_PHASE' || gameState.activePlayer !== 'player') return;
    if (selectedHandIndex === null) return;

    const card = gameState.player.hand[selectedHandIndex];
    if (!card) return;

    if (isContinuousBackrowCard(card)) {
      if (isPlayerEquipmentCard(card)) {
        if (targetBackSlot !== null && !isPlayerEquipmentCard(targetBackSlot.card)) {
          setGameState((prev) => {
            const next = cloneState(prev);
            addLog(
              next,
              'system',
              'Equipamentos não podem ser colocados na mesma área que já possui uma Carta de Efeito!',
              'info'
            );
            return next;
          });
          return;
        }
      } else {
        if (targetBackSlot !== null || hasFighterEquipInCol) {
          setGameState((prev) => {
            const next = cloneState(prev);
            addLog(
              next,
              'system',
              'Cartas de Efeito não podem ser colocadas na mesma área que já possui uma carta de Equipamento ou Efeito!',
              'info'
            );
            return next;
          });
          return;
        }
      }
      executePlayerCardPlay(selectedHandIndex, slotIndex);
      return;
    }

    if (
      card.type === 'Equipamento' &&
      !isContinuousBackrowCard(card) &&
      targetFrontFighter !== null
    ) {
      if (targetBackSlot !== null && !isPlayerEquipmentCard(targetBackSlot.card)) {
        setGameState((prev) => {
          const next = cloneState(prev);
          addLog(
            next,
            'system',
            'Equipamentos não podem ser colocados na mesma área que já possui uma Carta de Efeito!',
            'info'
          );
          return next;
        });
        return;
      }
      handlePlayerFrontSlotClick(slotIndex);
      return;
    }
  };

  // Activate on-field active abilities
  const handleActivateFieldFighterAbility = (slotIndex: number) => {
    const fighter = gameState.player.frontline[slotIndex];
    if (!fighter) return;

    if (fighter.card.code === '2025/0001/00007' && !fighter.usedOncePerRoundAbility) {
      setGameState((prev) => {
        const next = cloneState(prev);
        const f = next.player.frontline[slotIndex];
        if (!f || f.usedOncePerRoundAbility) return prev;
        f.usedOncePerRoundAbility = true;
        next.player.hp += 1;
        addLog(
          next,
          'player',
          `💚 «Jim - Herói» (A Qualquer Momento • 1x por Rodada): Você recuperou +1 de Vida (Vida atual: ${next.player.hp} PV)!`,
          'life_gain'
        );
        return next;
      });
      return;
    }

    // «Salazar - Guia dos Escolhidos» (00181) <-> «Salazar - O Poderoso Líder» (00182) 1x por rodada
    if (
      (fighter.card.code === '2025/0001/00181' || fighter.card.code === '2025/0001/00182') &&
      !fighter.usedOncePerRoundAbility
    ) {
      const targetCode =
        fighter.card.code === '2025/0001/00181' ? '2025/0001/00182' : '2025/0001/00181';
      setGameState((prev) => {
        const next = cloneState(prev);
        const p = next.player;
        const curF = p.frontline[slotIndex];
        if (!curF || curF.usedOncePerRoundAbility) return prev;
        const hIdx = p.heroDeck.findIndex((c) => c.code === targetCode);
        if (hIdx === -1) return prev;
        const [newHero] = p.heroDeck.splice(hIdx, 1);
        p.heroDeck.push(curF.card);
        p.frontline[slotIndex] = null;
        summonFighterToSlot(next, 'player', newHero, slotIndex);
        if (p.frontline[slotIndex]) {
          p.frontline[slotIndex]!.usedOncePerRoundAbility = true;
        }
        p.runes = Math.min(12, p.runes + 1);
        addLog(
          next,
          'player',
          `👑 Dualidade de «Salazar»: Você trocou «${curF.card.name}» por «${newHero.name}» e recebeu +1 Runa (${p.runes} Runas)!`,
          'summon'
        );
        return next;
      });
      return;
    }

    // «Salazar - Grande Mestre da Dualidade» (00183)
    if (fighter.card.code === '2025/0001/00183' && !fighter.usedOncePerRoundAbility) {
      setGameState((prev) => {
        const next = cloneState(prev);
        const p = next.player;
        const curF = p.frontline[slotIndex];
        if (!curF || curF.usedOncePerRoundAbility) return prev;
        const freeSlot = p.frontline.findIndex((s) => s === null);
        if (freeSlot === -1) return prev;

        const isDualSalazar = (c: CardData) =>
          c.code === '2025/0001/00181' || c.code === '2025/0001/00182';
        let pulled: CardData | null = null;
        const hIdx = p.heroDeck.findIndex(isDualSalazar);
        const dIdx = p.deadZone.findIndex(isDualSalazar);
        const eIdx = p.erasedZone.findIndex(isDualSalazar);
        if (hIdx !== -1) pulled = p.heroDeck.splice(hIdx, 1)[0];
        else if (dIdx !== -1) pulled = p.deadZone.splice(dIdx, 1)[0];
        else if (eIdx !== -1) pulled = p.erasedZone.splice(eIdx, 1)[0];
        if (!pulled) return prev;

        curF.usedOncePerRoundAbility = true;
        summonFighterToSlot(next, 'player', pulled, freeSlot);
        addLog(
          next,
          'player',
          `👑 «Salazar - Grande Mestre da Dualidade»: Colocou «${pulled.name}» em campo na Coluna ${freeSlot + 1}!`,
          'summon'
        );
        return next;
      });
      return;
    }

    if (
      fighter.card.code === '2025/0001/00001' &&
      !fighter.jimLordTier9GemUsedThisRound &&
      countJimsInErasedZone(gameState.player) >= 9
    ) {
      setGameState((prev) => {
        const next = cloneState(prev);
        const p = next.player;
        const f = p.frontline[slotIndex];
        if (!f || f.jimLordTier9GemUsedThisRound) return prev;

        const isGema = (c: CardData) => c.name.includes('Gema Macroversal');
        const candidates: ChoiceCandidate[] = [
          ...p.deck
            .map((c, idx) => ({ c, idx }))
            .filter((item) => isGema(item.c))
            .map((item) => ({
              id: `gema_deck_${item.idx}`,
              card: item.c,
              sourceZone: 'deck' as const,
              sourceIndex: item.idx,
              subtitle: 'No Deck'
            })),
          ...p.deadZone
            .map((c, idx) => ({ c, idx }))
            .filter((item) => isGema(item.c))
            .map((item) => ({
              id: `gema_dead_${item.idx}`,
              card: item.c,
              sourceZone: 'deadZone' as const,
              sourceIndex: item.idx,
              subtitle: 'Na Zona Morta'
            })),
          ...p.erasedZone
            .map((c, idx) => ({ c, idx }))
            .filter((item) => isGema(item.c))
            .map((item) => ({
              id: `gema_erased_${item.idx}`,
              card: item.c,
              sourceZone: 'erasedZone' as const,
              sourceIndex: item.idx,
              subtitle: 'Na Zona Apagada'
            }))
        ];

        if (candidates.length === 0) {
          addLog(
            next,
            'system',
            `Nenhuma «Gema Macroversal» encontrada no Deck ou nas Zonas.`,
            'info'
          );
          return next;
        }

        f.jimLordTier9GemUsedThisRound = true;
        next.pendingChoiceQueue.push({
          title: '«Jim - O Senhor do Macroverso» [9+ Jim]',
          description:
            'Escolha 1 «Gema Macroversal» do seu Deck ou Zonas para adicionar à sua mão:',
          candidates,
          minSelect: 1,
          maxSelect: 1,
          effectKind: 'JIM_LORD_GEMA'
        });
        return next;
      });
    }
  };

  const handleActivateBuscaEternidade = (supportSlot: number) => {
    setGameState((prev) => {
      const next = cloneState(prev);
      const sup = next.player.backrow[supportSlot];
      if (!sup || sup.usedOncePerRound) return prev;

      const exactRuneCt = next.player.runes;
      const candidates: ChoiceCandidate[] = next.player.deck
        .map((c, idx) => ({ c, idx }))
        .filter((item) => item.c.ct === exactRuneCt)
        .map((item) => ({
          id: `busca_deck_${item.idx}`,
          card: item.c,
          sourceZone: 'deck' as const,
          sourceIndex: item.idx,
          subtitle: `Deck • ${item.c.ct}`
        }));

      if (candidates.length === 0) {
        addLog(
          next,
          'system',
          `«Busca Pela Eternidade»: Nenhuma carta com CT igual a ${exactRuneCt} (suas Runas atuais) encontrada no seu Deck.`,
          'info'
        );
        return next;
      }

      sup.usedOncePerRound = true;
      next.pendingChoiceQueue.push({
        title: `«Busca Pela Eternidade» (Suas Runas: ${exactRuneCt})`,
        description: `Escolha 1 carta com CT igual a ${exactRuneCt} do seu Deck para colocar na sua mão (suas Runas não são gastas):`,
        candidates,
        minSelect: 1,
        maxSelect: 1,
        effectKind: 'BUSCA_ETERNIDADE'
      });
      return next;
    });
  };

  // Click on Bot Frontline Slot (0..5)
  const handleBotFrontSlotClick = (botSlotIndex: number) => {
    const enemyFighter = gameState.bot.frontline[botSlotIndex];
    if (enemyFighter) {
      showCardInPanel(enemyFighter.card, enemyFighter, 'Combatente do Bot');
    }

    if (gameState.pendingGuerreiroSplashDamage && enemyFighter) {
      handleGuerreiroSplashTargetClick('bot', botSlotIndex);
      return;
    }

    if (
      gameState.phase === 'CARD_REACTION' &&
      pendingReactionHandIndex !== null &&
      enemyFighter
    ) {
      const reactCard = gameState.player.hand[pendingReactionHandIndex];
      if (
        reactCard &&
        (reactCard.code === '2025/0001/00025' ||
          reactCard.code === '2026/0002/00323' ||
          (reactCard.type === 'Efeito' &&
            doesCardNeedSlotSelection(reactCard, false) &&
            reactCard.description.toLowerCase().includes('cause')))
      ) {
        executePlayerReactionCardOnSlot(pendingReactionHandIndex, botSlotIndex);
        return;
      }
    }

    if (gameState.phase !== 'MAIN_PHASE' || gameState.activePlayer !== 'player') return;

    if (selectedHandIndex !== null) {
      const card = gameState.player.hand[selectedHandIndex];
      if (
        card &&
        (card.code === '2025/0001/00025' ||
          card.code === '2026/0002/00323' ||
          (card.type === 'Efeito' &&
            doesCardNeedSlotSelection(card, false) &&
            card.description.toLowerCase().includes('cause'))) &&
        enemyFighter
      ) {
        executePlayerCardPlay(selectedHandIndex, botSlotIndex);
        return;
      }
    }

    if (selectedAttackerSlot !== null) {
      if (enemyFighter) {
        handleDeclarePlayerAttack(selectedAttackerSlot, botSlotIndex);
      } else if (!gameState.bot.frontline.some((f) => f !== null)) {
        // Campo do Bot vazio: clicar em qualquer espaço de combatente do Bot realiza Ataque Direto!
        handleDeclarePlayerAttack(selectedAttackerSlot, -1);
      }
    }
  };

  // Declare Player Attack (with dynamic SVG Attack Arrow & Lunge animation)
  const handleDeclarePlayerAttack = (attackerSlot: number, targetSlot: number) => {
    if (activeAttackAnim !== null) return;
    const currentAttacker = gameState.player.frontline[attackerSlot];
    if (!currentAttacker) return;

    if (gameState.round === 1) {
      setGameState((prev) => {
        const next = cloneState(prev);
        addLog(
          next,
          'system',
          `Regra Geral: Não é permitido declarar ataques na 1ª Rodada!`,
          'info'
        );
        return next;
      });
      setSelectedAttackerSlot(null);
      return;
    }

    if (gameState.player.lockedFromAttackingThisTurn) {
      setGameState((prev) => {
        const next = cloneState(prev);
        addLog(
          next,
          'system',
          `Regra Geral: Você já atacou e depois baixou cartas neste turno, portanto não pode declarar novos ataques.`,
          'info'
        );
        return next;
      });
      setSelectedAttackerSlot(null);
      return;
    }

    const maxAttacks = getMaxAttacksPerTurn(gameState, currentAttacker);
    const usedAttacks = currentAttacker.attacksThisTurnCount || 0;
    if (currentAttacker.hasAttackedThisTurn || usedAttacks >= maxAttacks) {
      setGameState((prev) => {
        const next = cloneState(prev);
        addLog(
          next,
          'system',
          `«${currentAttacker.card.name}» já realizou todos os seus ataques neste turno (${usedAttacks}/${maxAttacks})!`,
          'info'
        );
        return next;
      });
      setSelectedAttackerSlot(null);
      return;
    }

    const botDefender = targetSlot >= 0 ? gameState.bot.frontline[targetSlot] : null;
    const defIsSolador = botDefender ? hasArchetype(gameState, botDefender, 'Solador') : false;
    const effAtk = getFighterEffectiveAtk(gameState, currentAttacker, true, defIsSolador);
    const atkIsSolador = hasArchetype(
      gameState,
      currentAttacker,
      'Solador',
      false,
      targetSlot >= 0 ? targetSlot : undefined
    );
    const windupDelay = SPEED_CONFIG[duelSpeed].attackWindupMs;

    setSelectedAttackerSlot(null);
    setHoveredAttackTarget(null);
    setActiveAttackAnim({
      attackerSide: 'player',
      attackerSlot,
      targetSide: 'bot',
      targetSlot,
      attackerName: currentAttacker.card.name,
      targetName: targetSlot === -1 ? 'Ataque Direto ao Bot!' : botDefender?.card.name || 'Alvo',
      atkValue: effAtk,
      isSolador: atkIsSolador
    });

    setTimeout(() => {
      setGameState((prev) => {
        const next = cloneState(prev);
        const attacker = next.player.frontline[attackerSlot];
        if (!attacker) return prev;

        const botReaction = evaluateBotReactionToPlayerAction(
          next,
          'ATTACK_DECLARED',
          attacker.card,
          attacker.card.ct,
          attackerSlot,
          targetSlot,
          (activeState) => {
            executeCombatResolution(activeState, 'player', attackerSlot, targetSlot);
          }
        );

        if (next.reactionWindow?.isCounterChain) {
          return next;
        }

        if (botReaction.botNegatedPlayerAction) {
          attacker.attacksThisTurnCount = (attacker.attacksThisTurnCount || 0) + 1;
          attacker.hasAttackedThisTurn =
            attacker.attacksThisTurnCount >= getMaxAttacksPerTurn(next, attacker);
          next.player.hasAttackedInCurrentTurn = true;
          return next;
        }

        executeCombatResolution(next, 'player', attackerSlot, targetSlot);
        return next;
      });

      setTimeout(() => {
        setActiveAttackAnim(null);
      }, 320);
    }, windupDelay);
  };

  const handlePassReaction = () => {
    setPendingReactionHandIndex(null);
    setTrocaFirstSlot(null);
    setSelectingSlotForHero(false);

    // If passing on a Bot attack reaction window, briefly animate the Bot's attack lunge before damage lands
    if (
      gameState.phase === 'COMBAT_REACTION' &&
      gameState.reactionWindow?.type === 'ATTACK_DECLARED' &&
      gameState.reactionWindow.attackerSlot !== undefined &&
      gameState.reactionWindow.targetSlot !== undefined
    ) {
      const atkSlot = gameState.reactionWindow.attackerSlot;
      const tgtSlot = gameState.reactionWindow.targetSlot;
      const botAttacker = gameState.bot.frontline[atkSlot];
      const playerDef = tgtSlot >= 0 ? gameState.player.frontline[tgtSlot] : null;
      const defIsSolador = playerDef ? hasArchetype(gameState, playerDef, 'Solador') : false;

      if (botAttacker) {
        setActiveAttackAnim({
          attackerSide: 'bot',
          attackerSlot: atkSlot,
          targetSide: 'player',
          targetSlot: tgtSlot,
          attackerName: botAttacker.card.name,
          targetName: tgtSlot === -1 ? 'Você (Ataque Direto!)' : playerDef?.card.name || 'Alvo',
          atkValue: getFighterEffectiveAtk(gameState, botAttacker, true, defIsSolador),
          isSolador: hasArchetype(
            gameState,
            botAttacker,
            'Solador',
            false,
            tgtSlot >= 0 ? tgtSlot : undefined
          )
        });
      }

      const resolveDelay = Math.round(SPEED_CONFIG[duelSpeed].attackWindupMs * 0.65);
      setTimeout(() => {
        setGameState((prev) => {
          if (!prev.reactionWindow) return prev;
          const next = cloneState(prev);
          const rw = next.reactionWindow!;
          next.reactionWindow = null;
          next.phase = 'MAIN_PHASE';
          rw.pendingPayload(next);
          return next;
        });
        setTimeout(() => {
          setActiveAttackAnim(null);
        }, 320);
      }, resolveDelay);
      return;
    }

    setGameState((prev) => {
      if (!prev.reactionWindow) return prev;
      const next = cloneState(prev);
      const rw = next.reactionWindow!;
      next.reactionWindow = null;
      next.phase = 'MAIN_PHASE';
      rw.pendingPayload(next);
      return next;
    });
  };

  const handlePayDoubleToCounterSelamento = () => {
    setPendingReactionHandIndex(null);
    setTrocaFirstSlot(null);
    setSelectingSlotForHero(false);
    setGameState((prev) => {
      if (!prev.reactionWindow || !prev.reactionWindow.isSelamentoTrigger) return prev;
      const next = cloneState(prev);
      const rw = next.reactionWindow!;
      const doubleCost = rw.selamentoDoubleLifeCost ?? 0;
      if (next.player.hp <= doubleCost) return prev;

      next.reactionWindow = null;
      next.phase = 'MAIN_PHASE';
      next.player.hp = Math.max(0, next.player.hp - doubleCost);

      addLog(
        next,
        'player',
        `⛓️ Contra-Negação! Você pagou o dobro de vida (${doubleCost} PV) para anular o «Selamento Verdadeiro» do Bot! Sua carta original resolve normalmente!`,
        'reaction'
      );

      if (!checkWinCondition(next) && rw.onNegatedPayload) {
        rw.onNegatedPayload(next);
      }
      return next;
    });
  };

  const handleReactWithJimMago = () => {
    setPendingReactionHandIndex(null);
    setGameState((prev) => {
      if (!prev.reactionWindow) return prev;
      const next = cloneState(prev);
      const rw = next.reactionWindow!;
      const magoSlot = next.player.frontline.findIndex(
        (f) => f !== null && f.card.code === '2025/0001/00003'
      );
      if (magoSlot === -1) return prev;
      const magoCard = next.player.frontline[magoSlot]!.card;
      const magoCt = getCardAuthorityCt(next.player, magoCard);

      next.reactionWindow = null;
      next.phase = 'MAIN_PHASE';

      sendFighterFromFieldToZone(next, 'player', magoSlot, true, false);
      addLog(
        next,
        'player',
        `🛡️ Reação! Você enviou «Jim - Mago» do campo para a Zona Apagada e declarou NEGAÇÃO contra o efeito de «${rw.triggerCard?.name}» do Bot!`,
        'reaction'
      );

      const botCounter = evaluateBotReactionToPlayerAction(
        next,
        'CARD_PLAYED',
        magoCard,
        magoCt,
        undefined,
        undefined,
        (activeState) => {
          if (rw.isCounterChain && rw.onNegatedPayload) {
            rw.onNegatedPayload(activeState);
          } else if (rw.triggerCard) {
            sendCardToDeadOrErasedZone(activeState, 'bot', rw.triggerCard);
          }
        }
      );

      if (next.reactionWindow?.isCounterChain) {
        return next;
      }

      if (botCounter.botNegatedPlayerAction) {
        addLog(
          next,
          'bot',
          `⛓️ Corrente de Reação! O Bot negou o efeito do seu «Jim - Mago» — a ação original do Bot prossegue!`,
          'reaction'
        );
        if (!checkWinCondition(next)) {
          rw.pendingPayload(next);
        }
        return next;
      }

      if (rw.isCounterChain && rw.onNegatedPayload) {
        rw.onNegatedPayload(next);
      } else if (rw.triggerCard) {
        sendCardToDeadOrErasedZone(next, 'bot', rw.triggerCard);
      }
      return next;
    });
  };

  // Negar com «Mahina - O Arauto do Véu» (2026/0001/00301): Descarta uma carta «Véu» do seu lado do campo para a Zona Apagada
  const handleReactWithMahinaVeu = () => {
    setPendingReactionHandIndex(null);
    setGameState((prev) => {
      if (!prev.reactionWindow) return prev;
      const next = cloneState(prev);
      const rw = next.reactionWindow!;
      const p = next.player;

      const hasMahinaHero = p.frontline.some(
        (f) => f !== null && f.card.code === '2026/0001/00301'
      );
      if (!hasMahinaHero) return prev;

      let sacrificedName = '';
      // Prioriza descartar combatente não-Herói com «Véu», depois suporte «Véu», depois o próprio Mahina se for o único
      const nonHeroVeuSlot = p.frontline.findIndex(
        (f) =>
          f !== null &&
          !f.isHero &&
          (f.card.name.includes('Véu') || hasArchetype(next, f, 'Véu'))
      );
      if (nonHeroVeuSlot !== -1) {
        sacrificedName = p.frontline[nonHeroVeuSlot]!.card.name;
        sendFighterFromFieldToZone(next, 'player', nonHeroVeuSlot, true, false);
      } else {
        const backrowVeuIdx = p.backrow.findIndex((s) =>
          getAllSupportCardsInSlot(s).some(
            (c) => c.name.includes('Véu') || (c.archetype || '').includes('Véu')
          )
        );
        if (backrowVeuIdx !== -1 && p.backrow[backrowVeuIdx]) {
          const sup = p.backrow[backrowVeuIdx]!;
          sacrificedName = sup.card.name;
          p.erasedZone.push(sup.card);
          if (sup.stackedCards && sup.stackedCards.length > 0) {
            sup.card = sup.stackedCards.pop()!;
          } else {
            p.backrow[backrowVeuIdx] = null;
          }
        } else {
          const mahinaSlot = p.frontline.findIndex(
            (f) => f !== null && f.card.code === '2026/0001/00301'
          );
          if (mahinaSlot === -1) return prev;
          sacrificedName = p.frontline[mahinaSlot]!.card.name;
          sendFighterFromFieldToZone(next, 'player', mahinaSlot, true, false);
        }
      }

      next.reactionWindow = null;
      next.phase = 'MAIN_PHASE';

      addLog(
        next,
        'player',
        `🛡️ Reação «A Qualquer Momento»! «Mahina - O Arauto do Véu» descartou «${sacrificedName}» do campo para a Zona Apagada e NEGOU «${rw.triggerCard?.name}» do Bot!`,
        'reaction'
      );

      if (rw.isCounterChain && rw.onNegatedPayload) {
        rw.onNegatedPayload(next);
      } else if (rw.triggerCard) {
        sendCardToDeadOrErasedZone(next, 'bot', rw.triggerCard);
      }
      return next;
    });
  };

  // Negar com «Quinta Camada» (2026/0002/00328): Gaste 3 Runas para negar o uso de uma carta inimiga
  const handleReactWithQuintaCamada = () => {
    setPendingReactionHandIndex(null);
    setGameState((prev) => {
      if (!prev.reactionWindow) return prev;
      const next = cloneState(prev);
      const rw = next.reactionWindow!;
      const p = next.player;

      if (!hasActiveCamada(p, '2026/0002/00328') || p.runes < 3) return prev;

      p.runes -= 3;
      next.reactionWindow = null;
      next.phase = 'MAIN_PHASE';

      addLog(
        next,
        'player',
        `🛡️ Reação! Você gastou 3 Runas com «Quinta Camada» e NEGOU «${rw.triggerCard?.name}» do Bot (Runas restantes: ${p.runes})!`,
        'reaction'
      );

      if (rw.isCounterChain && rw.onNegatedPayload) {
        rw.onNegatedPayload(next);
      } else if (rw.triggerCard) {
        sendCardToDeadOrErasedZone(next, 'bot', rw.triggerCard);
      }
      return next;
    });
  };

  const handleEndPlayerTurn = () => {
    if (gameState.phase !== 'MAIN_PHASE' || gameState.activePlayer !== 'player') return;
    setSelectedHandIndex(null);
    setSelectedAttackerSlot(null);
    setSelectingSlotForHero(false);
    setGameState((prev) => {
      const next = cloneState(prev);
      addLog(next, 'player', `Você encerrou o seu turno.`, 'info');
      advanceTurn(next);
      return next;
    });
  };

  const handleProceedFromPreDrawWindow = () => {
    if (gameState.phase !== 'PRE_DRAW_WINDOW') return;
    setSelectingSlotForHero(false);
    setGameState((prev) => {
      const next = cloneState(prev);
      advanceTurn(next, true);
      return next;
    });
  };

  const selectedHandCard =
    selectedHandIndex !== null ? gameState.player.hand[selectedHandIndex] : null;

  const selectedReactionCard =
    pendingReactionHandIndex !== null
      ? gameState.player.hand[pendingReactionHandIndex]
      : null;

  const canDirectAttackBot =
    gameState.phase === 'MAIN_PHASE' &&
    gameState.activePlayer === 'player' &&
    gameState.round >= 2 &&
    selectedAttackerSlot !== null &&
    !gameState.bot.frontline.some((f) => f !== null);

  const botAttackerInReaction =
    gameState.reactionWindow?.type === 'ATTACK_DECLARED' &&
    gameState.reactionWindow.attackerSlot !== undefined
      ? gameState.bot.frontline[gameState.reactionWindow.attackerSlot]
      : null;

  const availablePlayerReactions =
    (gameState.phase === 'CARD_REACTION' || gameState.phase === 'COMBAT_REACTION') &&
    gameState.reactionWindow
      ? getAvailableReactions(
          gameState,
          'player',
          gameState.reactionWindow.type,
          gameState.reactionWindow.effectiveCtOfTrigger ?? 0,
          botAttackerInReaction ? hasArchetype(gameState, botAttackerInReaction, 'Solador') : false,
          Boolean(gameState.reactionWindow.onlyNegatableByHero)
        )
      : {
          handCards: [],
          canUseJimMagoFieldNegate: false,
          canUseMahinaVeuFieldNegate: false,
          canUseQuintaCamadaNegate: false,
          canSummonHeroJimLord: false
        };

  const isReactionPhase =
    gameState.phase === 'CARD_REACTION' || gameState.phase === 'COMBAT_REACTION';

  const getLogStyle = (type: DuelLogType) => {
    switch (type) {
      case 'life_loss':
        return {
          container: 'border-rose-500/60 bg-rose-950/40 text-rose-100',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          label: 'PERDA DE VIDA'
        };
      case 'life_gain':
        return {
          container: 'border-emerald-500/60 bg-emerald-950/40 text-emerald-100',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          label: 'GANHO DE VIDA'
        };
      case 'attack':
        return {
          container: 'border-amber-500/60 bg-amber-950/40 text-amber-100',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          label: 'ATAQUE'
        };
      case 'reaction':
        return {
          container: 'border-cyan-500/60 bg-cyan-950/40 text-cyan-100',
          badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          label: 'REAÇÃO'
        };
      case 'summon':
        return {
          container: 'border-purple-500/60 bg-purple-950/40 text-purple-100',
          badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          label: 'INVOCAÇÃO'
        };
      case 'effect':
        return {
          container: 'border-indigo-500/40 bg-indigo-950/25 text-indigo-200',
          badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          label: 'EFEITO'
        };
      default:
        return {
          container: 'border-slate-800 bg-slate-900/50 text-slate-300',
          badge: 'bg-slate-800 text-slate-400 border-slate-700',
          label: 'INFO'
        };
    }
  };

  return (
    <div className="fixed inset-0 z-[120] h-screen w-screen bg-slate-950 flex flex-col overflow-hidden text-slate-100 select-none">
      {/* KEYFRAME ANIMATION FOR CARD PLACEMENT ON FIELD */}
      <style>{`
        @keyframes ldCardPlaceOnField {
          0% {
            opacity: 0;
            transform: translateY(-28px) scale(1.22) rotate(-3deg);
            filter: brightness(1.8) drop-shadow(0 0 18px rgba(168, 85, 247, 0.85));
          }
          65% {
            opacity: 1;
            transform: translateY(3px) scale(0.97) rotate(0deg);
            filter: brightness(1.25) drop-shadow(0 0 10px rgba(56, 189, 248, 0.6));
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1) rotate(0deg);
            filter: brightness(1);
          }
        }
        .animate-ld-card-place {
          animation: ldCardPlaceOnField 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>

      {/* COMPACT TOP HEADER BAR (No Developer Info) */}
      <div className="h-11 border-b border-purple-500/20 bg-slate-900/95 px-3 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
            <Bot size={16} />
          </div>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-display font-black text-xs tracking-wider uppercase text-white truncate">
              Duelo vs Bot
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-800 text-slate-300 border border-slate-700">
              Rodada <strong className="text-white">{gameState.round}</strong> • Turno{' '}
              <strong className="text-white">{gameState.turnInRound}/2</strong> • Iniciativa:{' '}
              <strong className="text-amber-400">
                {gameState.firstPlayerOfRound === 'player' ? 'Você' : 'Bot'}
              </strong>
            </span>
          </div>
        </div>

        {/* Deck Selectors + Speed + Quick Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-950/90 border border-purple-500/30 rounded-lg px-2 py-0.5">
            <span className="text-[9px] font-black uppercase text-purple-300">Seu Deck:</span>
            <select
              value={playerDeckId}
              onChange={(e) => {
                const nextDeck = e.target.value as StructuralDeckId;
                handleRestartDuel(deckMode, nextDeck, botDeckSelection);
              }}
              className="bg-transparent text-[11px] font-bold text-white focus:outline-none cursor-pointer"
            >
              {STRUCTURAL_DECK_OPTIONS.map((opt) => (
                <option key={`p_deck_${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-950/90 border border-rose-500/30 rounded-lg px-2 py-0.5">
            <span className="text-[9px] font-black uppercase text-rose-300">Deck Bot:</span>
            <select
              value={botDeckSelection}
              onChange={(e) => {
                const nextBotDeck = e.target.value as BotDeckSelection;
                handleRestartDuel(deckMode, playerDeckId, nextBotDeck);
              }}
              className="bg-transparent text-[11px] font-bold text-white focus:outline-none cursor-pointer"
            >
              <option value="random" className="bg-slate-900 text-amber-300">
                🎲 Aleatório
              </option>
              {STRUCTURAL_DECK_OPTIONS.map((opt) => (
                <option key={`b_deck_${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div
            className="hidden sm:flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[10px] font-bold"
            title="Velocidade do Duelo"
          >
            {(['lento', 'normal', 'rapido'] as DuelSpeed[]).map((spd) => (
              <button
                key={spd}
                onClick={() => setDuelSpeed(spd)}
                className={`px-1.5 py-0.5 rounded transition-all ${
                  duelSpeed === spd
                    ? 'bg-purple-600 text-white font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {SPEED_CONFIG[spd].label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowRulesModal(true)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 border border-slate-700"
          >
            <HelpCircle size={13} className="text-purple-400" />
            <span className="hidden md:inline">Regras</span>
          </button>

          <button
            onClick={() => handleRestartDuel(deckMode, playerDeckId, botDeckSelection)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 border border-slate-700"
          >
            <RotateCcw size={13} />
            <span className="hidden md:inline">Reiniciar</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-colors"
            title="Fechar Simulador"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* MAIN ZERO-SCROLL DUEL VIEWPORT + RIGHT RETRACTABLE LOG */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <div
          ref={battlefieldRef}
          className="flex-1 min-h-0 flex flex-col justify-between px-2 py-1.5 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-950/25 via-slate-950 to-slate-950 relative"
        >
        {/* ============================================================
            DYNAMIC SVG ATTACK ARROW OVERLAY
           ============================================================ */}
        {arrowCoords && (
          <div className="pointer-events-none absolute inset-0 z-40 overflow-visible">
            <svg className="w-full h-full overflow-visible">
              <defs>
                <marker
                  id="insanis-attack-arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="7"
                  refY="5"
                  orient="auto"
                >
                  <path
                    d="M 0 1 L 9 5 L 0 9 z"
                    fill={
                      arrowCoords.isAquaRedirect
                        ? '#e879f9'
                        : arrowCoords.isSolador
                        ? '#f59e0b'
                        : arrowCoords.isPreview
                        ? '#38bdf8'
                        : '#f43f5e'
                    }
                  />
                </marker>
                <filter id="insanis-arrow-glow" x="-25%" y="-25%" width="150%" height="150%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              <circle
                cx={arrowCoords.x1}
                cy={arrowCoords.y1}
                r="14"
                fill="none"
                stroke={
                  arrowCoords.isSolador
                    ? '#f59e0b'
                    : arrowCoords.isPreview
                    ? '#38bdf8'
                    : '#f43f5e'
                }
                strokeWidth="3"
                className="animate-ping opacity-60"
              />

              {arrowCoords.isAquaRedirect &&
              arrowCoords.midX !== undefined &&
              arrowCoords.midY !== undefined ? (
                <>
                  <line
                    x1={arrowCoords.x1}
                    y1={arrowCoords.y1}
                    x2={arrowCoords.midX}
                    y2={arrowCoords.midY}
                    stroke="#e879f9"
                    strokeWidth="4"
                    strokeDasharray="8 5"
                    filter="url(#insanis-arrow-glow)"
                  />
                  <line
                    x1={arrowCoords.midX}
                    y1={arrowCoords.midY}
                    x2={arrowCoords.x2}
                    y2={arrowCoords.y2}
                    stroke="#f43f5e"
                    strokeWidth="5"
                    markerEnd="url(#insanis-attack-arrowhead)"
                    filter="url(#insanis-arrow-glow)"
                  />
                </>
              ) : (
                <>
                  <line
                    x1={arrowCoords.x1}
                    y1={arrowCoords.y1}
                    x2={arrowCoords.x2}
                    y2={arrowCoords.y2}
                    stroke={
                      arrowCoords.isSolador
                        ? '#f59e0b'
                        : arrowCoords.isPreview
                        ? '#38bdf8'
                        : '#f43f5e'
                    }
                    strokeWidth={arrowCoords.isPreview ? '4' : '7'}
                    strokeOpacity="0.35"
                    filter="url(#insanis-arrow-glow)"
                  />
                  <line
                    x1={arrowCoords.x1}
                    y1={arrowCoords.y1}
                    x2={arrowCoords.x2}
                    y2={arrowCoords.y2}
                    stroke={
                      arrowCoords.isSolador
                        ? '#fbbf24'
                        : arrowCoords.isPreview
                        ? '#38bdf8'
                        : '#fb7185'
                    }
                    strokeWidth={arrowCoords.isPreview ? '3' : '4.5'}
                    strokeDasharray={arrowCoords.isPreview ? '8 6' : undefined}
                    markerEnd="url(#insanis-attack-arrowhead)"
                  />
                </>
              )}

              <circle
                cx={arrowCoords.x2}
                cy={arrowCoords.y2}
                r="18"
                fill="none"
                stroke={
                  arrowCoords.isAquaRedirect
                    ? '#e879f9'
                    : arrowCoords.isSolador
                    ? '#fbbf24'
                    : arrowCoords.isPreview
                    ? '#38bdf8'
                    : '#f43f5e'
                }
                strokeWidth="2.5"
                strokeDasharray="6 4"
                className="animate-spin"
              />
            </svg>

            <div
              style={{
                left: `${
                  arrowCoords.isAquaRedirect && arrowCoords.midX !== undefined
                    ? (arrowCoords.midX + arrowCoords.x2) / 2
                    : (arrowCoords.x1 + arrowCoords.x2) / 2
                }px`,
                top: `${
                  arrowCoords.isAquaRedirect && arrowCoords.midY !== undefined
                    ? (arrowCoords.midY + arrowCoords.y2) / 2
                    : (arrowCoords.y1 + arrowCoords.y2) / 2
                }px`
              }}
              className="-translate-x-1/2 -translate-y-1/2 absolute z-50 pointer-events-none"
            >
              <div
                className={`px-2.5 py-0.5 rounded-full border-2 shadow-2xl flex items-center gap-1.5 whitespace-nowrap text-[11px] font-black ${
                  arrowCoords.isAquaRedirect
                    ? 'bg-fuchsia-950/95 border-fuchsia-400 text-fuchsia-100'
                    : arrowCoords.isSolador
                    ? 'bg-amber-950/95 border-amber-400 text-amber-100'
                    : arrowCoords.isPreview
                    ? 'bg-sky-950/95 border-sky-400 text-sky-100'
                    : 'bg-rose-950/95 border-rose-400 text-white scale-105'
                }`}
              >
                <span>⚔️ {arrowCoords.atkValue} Dano</span>
                <span className="opacity-80 text-[10px] font-bold hidden sm:inline">
                  ({arrowCoords.attackerName} ➔ {arrowCoords.targetName})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            BOT TOP COMPACT BAR (HP, Mana, Runas, Zones & Direct Attack)
           ============================================================ */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-xl px-3 py-1 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-7 h-7 rounded-lg bg-rose-950 border border-rose-500/40 flex items-center justify-center text-rose-400 font-black text-[10px]">
                BOT
              </div>
              {gameState.activePlayer === 'bot' && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>
            <span className="font-bold text-xs text-white">{gameState.bot.name}</span>

            <div className="flex items-center gap-2 text-[11px]">
              <span
                ref={botHpRef}
                onMouseEnter={() => {
                  if (canDirectAttackBot) setHoveredAttackTarget({ side: 'bot', slot: -1 });
                }}
                onMouseLeave={() => {
                  if (hoveredAttackTarget?.side === 'bot' && hoveredAttackTarget.slot === -1) {
                    setHoveredAttackTarget(null);
                  }
                }}
                onClick={() => {
                  if (canDirectAttackBot && selectedAttackerSlot !== null) {
                    handleDeclarePlayerAttack(selectedAttackerSlot, -1);
                  }
                }}
                title={
                  canDirectAttackBot
                    ? 'Clique para atacar diretamente a Vida do Bot!'
                    : 'Vida do Bot'
                }
                className={`relative flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/90 border text-rose-300 font-black transition-all ${
                  canDirectAttackBot
                    ? 'border-amber-400 ring-2 ring-rose-500 cursor-pointer hover:scale-105 animate-pulse'
                    : 'border-rose-500/30'
                } ${
                  slotImpacts['bot_hp'] === 'hit'
                    ? 'ring-2 ring-rose-400 scale-110'
                    : slotImpacts['bot_hp'] === 'heal'
                    ? 'ring-2 ring-emerald-400 scale-110'
                    : ''
                }`}
              >
                <Heart size={11} className="fill-rose-500 text-rose-500" />
                {gameState.bot.hp}
                {floatingPopups
                  .filter((p) => p.targetKey === 'bot_hp')
                  .map((p) => (
                    <span
                      key={p.id}
                      className={`pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 z-50 px-1.5 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap shadow-lg animate-bounce ${
                        p.variant === 'damage'
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {p.text}
                    </span>
                  ))}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 font-black">
                <Zap size={11} className="fill-cyan-400 text-cyan-400" />
                {gameState.bot.mana}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/70 border border-amber-500/30 text-amber-300 font-bold">
                <Sparkles size={10} />
                {gameState.bot.runes}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {canDirectAttackBot && (
              <button
                onMouseEnter={() => setHoveredAttackTarget({ side: 'bot', slot: -1 })}
                onMouseLeave={() => setHoveredAttackTarget(null)}
                onClick={() => handleDeclarePlayerAttack(selectedAttackerSlot!, -1)}
                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-[11px] uppercase tracking-wider shadow-lg animate-pulse flex items-center gap-1"
              >
                <Swords size={12} />
                Ataque Direto ao Bot!
              </button>
            )}
            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300">
              Mão: <strong className="text-white">{gameState.bot.hand.length}</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300">
              Deck: <strong className="text-white">{gameState.bot.deck.length}</strong>
            </span>
            <button
              onClick={() =>
                setZoneViewer({
                  title: `Zona Morta do Bot (${gameState.bot.deadZone.length})`,
                  cards: gameState.bot.deadZone
                })
              }
              className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 flex items-center gap-1"
            >
              <Skull size={10} className="text-slate-400" />
              Morta: <strong className="text-white">{gameState.bot.deadZone.length}</strong>
            </button>
            <button
              onClick={() =>
                setZoneViewer({
                  title: `Zona Apagada do Bot (${gameState.bot.erasedZone.length})`,
                  cards: gameState.bot.erasedZone
                })
              }
              className="px-2 py-0.5 rounded bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/40 text-[10px] text-purple-200 flex items-center gap-1"
            >
              <Flame size={10} className="text-purple-400" />
              Apagada: <strong className="text-white">{gameState.bot.erasedZone.length}</strong>
            </button>
          </div>
        </div>

        {/* ============================================================
            MAIN BOARD AREA (3 COLUMNS MATCHING REFERENCE DIAGRAM 1 & 2):
            [LEFT: ZONA MORTA + DECK RELEVO] | [CENTER: 6-COL COMBATENTES & EFEITOS] | [RIGHT: ZONA APAGADA + DECK DE HERÓI]
           ============================================================ */}
        <div className="flex-1 min-h-0 flex items-stretch gap-2 my-1">
          {/* LEFT SIDE COLUMN: ZONA MORTA (TOP) + DECK COM RELEVO E CONTAGEM (BOTTOM) */}
          <div className="w-24 sm:w-28 shrink-0 flex flex-col gap-2">
            {/* ZONA MORTA */}
            <button
              onClick={() =>
                setZoneViewer({
                  title: `Sua Zona Morta (${gameState.player.deadZone.length})`,
                  cards: gameState.player.deadZone
                })
              }
              className="flex-1 rounded-xl border-2 border-slate-700/80 bg-slate-900/80 hover:border-slate-500 p-1.5 flex flex-col items-center justify-between text-center transition-all relative overflow-hidden group"
              title="Clique para abrir sua Zona Morta"
            >
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-300 z-10">
                Zona Morta
              </span>
              {gameState.player.deadZone.length > 0 ? (
                <div className="relative w-12 sm:w-14 aspect-[704/987] rounded border border-slate-600 overflow-hidden shadow-md my-auto">
                  {getModernImage(
                    gameState.player.deadZone[gameState.player.deadZone.length - 1]
                  ) && (
                    <img
                      src={getModernImage(
                        gameState.player.deadZone[gameState.player.deadZone.length - 1]
                      )}
                      alt="Zona Morta"
                      className="w-full h-full object-cover grayscale contrast-125 group-hover:grayscale-0 transition-all"
                    />
                  )}
                </div>
              ) : (
                <Skull size={22} className="text-slate-600 my-auto" />
              )}
              <span className="px-2 py-0.5 rounded-full bg-slate-950/90 border border-slate-700 text-[10px] font-black text-white z-10">
                {gameState.player.deadZone.length} cartas
              </span>
            </button>

            {/* DECK COM RELEVO 3D E NÚMERO DE CARTAS RESTANTES */}
            <div
              className="flex-1 rounded-xl border-2 border-slate-700/80 bg-slate-900/80 p-1.5 flex flex-col items-center justify-between text-center relative overflow-hidden"
              title={`Seu Deck Principal: ${gameState.player.deck.length} cartas restantes`}
            >
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-300 z-10">
                Deck
              </span>

              {/* 3D Stacked Card Relief (Relevo de Cartas com Verso Oficial) */}
              <div className="relative w-14 sm:w-16 aspect-[704/987] my-auto flex items-center justify-center">
                {gameState.player.deck.length > 6 && (
                  <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-lg overflow-hidden border border-amber-500/40 shadow-md brightness-50">
                    <img
                      src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0120804533.firebasestorage.app/o/cards%2FVERSO%20ARQUIVO%20FINAL%202.jpg?alt=media&token=e765f1d3-ea86-49d3-bad0-166285337cee"
                      alt="Verso do Deck"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {gameState.player.deck.length > 3 && (
                  <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-lg overflow-hidden border border-amber-400/60 shadow-md brightness-75">
                    <img
                      src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0120804533.firebasestorage.app/o/cards%2FVERSO%20ARQUIVO%20FINAL%202.jpg?alt=media&token=e765f1d3-ea86-49d3-bad0-166285337cee"
                      alt="Verso do Deck"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {gameState.player.deck.length > 0 ? (
                  <div className="relative inset-0 w-full h-full rounded-lg overflow-hidden border-2 border-amber-400/80 shadow-xl flex items-center justify-center">
                    <img
                      src="https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0120804533.firebasestorage.app/o/cards%2FVERSO%20ARQUIVO%20FINAL%202.jpg?alt=media&token=e765f1d3-ea86-49d3-bad0-166285337cee"
                      alt="Verso da Carta"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-600 font-bold">
                    0
                  </div>
                )}
              </div>

              <span className="px-2 py-0.5 rounded-full bg-purple-950/90 border border-purple-500/40 text-[10px] font-black text-purple-200 z-10">
                {gameState.player.deck.length} restantes
              </span>
            </div>
          </div>

          {/* CENTER 6-COLUMN BATTLEFIELD */}
          <div className="flex-1 min-w-0 flex flex-col justify-between gap-1">
            {/* BOT BACKROW (6 Green Effect/Equipment Slots) */}
            <div className="grid grid-cols-6 gap-1.5 h-11 sm:h-12 shrink-0">
              {gameState.bot.backrow.map((sup, idx) => {
                const botFrontFighter = gameState.bot.frontline[idx];
                const botEquips = botFrontFighter?.equipments ?? [];
                const botSupportCards = getAllSupportCardsInSlot(sup);
                const allBotSlotCards = [...botSupportCards, ...botEquips.map((e) => e.card)];
                const hasContent = allBotSlotCards.length > 0;

                return (
                  <div
                    key={`bot_back_${idx}`}
                    onClick={() => {
                      if (allBotSlotCards.length > 0) {
                        showCardInPanel(
                          allBotSlotCards[0],
                          null,
                          `Efeitos / Equipamentos do Bot (Coluna ${idx + 1})`,
                          allBotSlotCards
                        );
                        if (allBotSlotCards.length > 1) {
                          setZoneViewer({
                            title: `Efeitos / Equipamentos do Bot — Coluna ${idx + 1} (${allBotSlotCards.length})`,
                            cards: allBotSlotCards
                          });
                        }
                      }
                    }}
                    className={`h-11 sm:h-12 rounded-lg border flex items-center justify-center p-1 text-center transition-all overflow-hidden relative ${
                      hasContent
                        ? 'bg-emerald-950/60 border-emerald-500/60 cursor-pointer hover:border-emerald-400'
                        : 'bg-emerald-950/20 border-emerald-500/25 text-emerald-300/40'
                    }`}
                  >
                    {hasContent ? (
                      <div className="flex items-center gap-1 w-full px-0.5 overflow-hidden">
                        <div className="flex -space-x-1.5 shrink-0">
                          {allBotSlotCards.slice(0, 3).map((c, cIdx) => {
                            const cImg = getModernImage(c);
                            return cImg ? (
                              <img
                                key={`bot_back_img_${idx}_${cIdx}`}
                                src={cImg}
                                alt={c.name}
                                className="w-5 h-7 object-cover rounded border border-emerald-300/80 shadow"
                              />
                            ) : null;
                          })}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <span className="text-[8px] font-black uppercase text-emerald-100 truncate block">
                            {allBotSlotCards[allBotSlotCards.length - 1].name}
                          </span>
                          <span className="text-[7px] text-amber-300 font-bold block truncate">
                            {allBotSlotCards.length > 1
                              ? `📚 ${allBotSlotCards.length} cartas (Ver todas)`
                              : 'Ativo'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[7px] uppercase font-bold tracking-tight leading-none">
                        Área de Efeito / Equip.
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* BOT FRONTLINE (6 Blue Fighter Slots) */}
            <div className="grid grid-cols-6 gap-1.5 flex-1 min-h-0">
              {gameState.bot.frontline.map((fighter, idx) => {
                const isAttackTargetable =
                  gameState.phase === 'MAIN_PHASE' &&
                  gameState.activePlayer === 'player' &&
                  gameState.round >= 2 &&
                  selectedAttackerSlot !== null &&
                  fighter !== null;

                const isVingancaTargetable =
                  ((gameState.phase === 'MAIN_PHASE' &&
                    selectedHandCard?.code === '2025/0001/00025') ||
                    (gameState.phase === 'CARD_REACTION' &&
                      selectedReactionCard?.code === '2025/0001/00025')) &&
                  fighter !== null;

                const isGuerreiroSplashTarget =
                  gameState.pendingGuerreiroSplashDamage && fighter !== null;

                const effAtk = fighter ? getFighterEffectiveAtk(gameState, fighter) : 0;
                const printedBaseAtk = fighter
                  ? Number(fighter.card.attack ?? fighter.baseAtk ?? 0)
                  : 0;
                const printedBaseHp = fighter
                  ? Number(fighter.card.defense ?? fighter.baseHp ?? 1)
                  : 1;
                const atkColor = fighter ? getStatColorClass(effAtk, printedBaseAtk) : 'text-white';
                const hpColor = fighter
                  ? getStatColorClass(fighter.currentHp, printedBaseHp)
                  : 'text-white';

                const effArchs = fighter ? getEffectiveArchetypes(gameState, fighter) : [];
                const imgUrl = fighter ? getModernImage(fighter.card) : undefined;
                const botFighterCt = fighter
                  ? Math.max(
                      0,
                      Number(fighter.card.ct || 0) - Number(gameState.bot.permCtReduction || 0)
                    )
                  : 0;

                const isBotSlotAttackerAnim =
                  (activeAttackAnim?.attackerSide === 'bot' &&
                    activeAttackAnim.attackerSlot === idx) ||
                  (gameState.phase === 'COMBAT_REACTION' &&
                    gameState.combatPending?.attackerPlayer === 'bot' &&
                    gameState.combatPending.attackerSlot === idx);

                const isBotSlotTargetAnim =
                  activeAttackAnim?.targetSide === 'bot' && activeAttackAnim.targetSlot === idx;

                const botSlotImpact = slotImpacts[`bot_slot_${idx}`];
                const botSlotPopups = floatingPopups.filter(
                  (p) => p.targetKey === `bot_slot_${idx}`
                );

                return (
                  <div
                    key={`bot_front_${idx}`}
                    ref={(el) => {
                      botSlotRefs.current[idx] = el;
                    }}
                    onMouseEnter={() => {
                      if (isAttackTargetable) {
                        setHoveredAttackTarget({ side: 'bot', slot: idx });
                      } else if (canDirectAttackBot) {
                        setHoveredAttackTarget({ side: 'bot', slot: -1 });
                      }
                    }}
                    onMouseLeave={() => {
                      if (
                        hoveredAttackTarget?.side === 'bot' &&
                        (hoveredAttackTarget.slot === idx || hoveredAttackTarget.slot === -1)
                      ) {
                        setHoveredAttackTarget(null);
                      }
                    }}
                    onClick={() => handleBotFrontSlotClick(idx)}
                    className={`rounded-xl border-2 p-1 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
                      isBotSlotAttackerAnim
                        ? 'translate-y-2 scale-105 ring-4 ring-rose-500 border-rose-300 z-30 shadow-2xl bg-rose-950/90'
                        : isBotSlotTargetAnim || botSlotImpact === 'hit'
                        ? 'ring-4 ring-rose-500 border-rose-300 bg-rose-900/80 scale-95 z-20'
                        : fighter
                        ? isAttackTargetable || isVingancaTargetable || isGuerreiroSplashTarget
                          ? 'bg-sky-950/80 border-rose-400 ring-2 ring-rose-500/70 cursor-pointer scale-[1.02]'
                          : 'bg-sky-950/55 border-sky-400/60 hover:border-sky-300 cursor-pointer'
                        : canDirectAttackBot
                        ? 'bg-rose-950/40 border-rose-400 border-dashed ring-2 ring-rose-500/60 text-rose-200 items-center justify-center cursor-pointer hover:bg-rose-900/50'
                        : 'bg-sky-950/25 border-sky-500/30 text-sky-300/40 items-center justify-center'
                    }`}
                  >
                    {botSlotPopups.length > 0 && (
                      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-0.5">
                        {botSlotPopups.map((p) => (
                          <span
                            key={p.id}
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-black uppercase shadow-xl border animate-bounce ${
                              p.variant === 'damage' || p.variant === 'ko'
                                ? 'bg-rose-600 text-white border-rose-200'
                                : p.variant === 'heal'
                                ? 'bg-emerald-600 text-white border-emerald-200'
                                : 'bg-amber-500 text-slate-950 border-amber-200'
                            }`}
                          >
                            {p.text}
                          </span>
                        ))}
                      </div>
                    )}

                    {fighter ? (
                      <div
                        key={fighter.instanceId}
                        className="w-full h-full flex flex-col justify-between relative animate-ld-card-place"
                      >
                        {imgUrl && (
                          <div className="absolute inset-0 opacity-45 pointer-events-none rounded-lg overflow-hidden">
                            <img
                              src={imgUrl}
                              alt={fighter.card.name}
                              className="w-full h-full object-cover object-top"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
                          </div>
                        )}

                        {/* Top Bar: Numeric CT Circle + Archetype Icons */}
                        <div className="relative z-10 flex items-center justify-between gap-1">
                          {fighter.isHero ? (
                            <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center shadow border border-white/60">
                              👑
                            </span>
                          ) : (
                            <span
                              className="w-5 h-5 rounded-full bg-purple-700 text-white font-black text-[10px] flex items-center justify-center shadow border border-amber-300/80"
                              title="Custo de Tempo (CT)"
                            >
                              {botFighterCt}
                            </span>
                          )}

                          <div className="flex items-center gap-0.5 flex-wrap justify-end">
                            {effArchs.map((arch) => {
                              const iconUrl = getArchetypeIcon(arch);
                              return iconUrl ? (
                                <img
                                  key={arch}
                                  src={iconUrl}
                                  alt={arch}
                                  title={arch}
                                  className="w-4 h-4 object-contain rounded-full bg-slate-950/90 p-0.5 border border-purple-400/50 shadow"
                                />
                              ) : (
                                <span
                                  key={arch}
                                  className="text-[7px] px-1 rounded bg-slate-950/90 text-purple-200 font-bold"
                                >
                                  {arch}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Fighter Name & Bottom White/Green/Red ATK & HP */}
                        <div className="relative z-10 mt-auto">
                          <p className="font-bold text-[9px] sm:text-[10px] text-white truncate drop-shadow text-center mb-0.5">
                            {fighter.card.name}
                          </p>
                          <div className="flex items-center justify-between text-[11px] font-black bg-slate-950/90 px-1.5 py-0.5 rounded border border-slate-800">
                            <span className={`flex items-center gap-0.5 ${atkColor}`}>
                              ⚔️ {effAtk}
                            </span>
                            <span className={`flex items-center gap-0.5 ${hpColor}`}>
                              ❤️ {fighter.currentHp}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[8px] font-black uppercase tracking-wider text-center leading-tight px-1">
                        {canDirectAttackBot ? '⚔️ Ataque Direto!' : 'Área de Combatente'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ============================================================
                UNIFIED CENTER WINDOW BETWEEN FIELDS:
                CARD INFO (IMAGE + DESCRIPTION) & REACTION WINDOW WITH PASS OPTION
               ============================================================ */}
            <div className="my-0.5 flex items-center justify-center shrink-0">
              {gameState.pendingGuerreiroSplashDamage ? (
                <div className="w-full px-3 py-1.5 rounded-xl bg-amber-950 border-2 border-amber-400 text-amber-100 flex items-center justify-center gap-2 shadow-lg animate-pulse text-xs font-bold">
                  <Swords size={14} className="text-amber-300 shrink-0" />
                  <span>
                    <strong>Efeito de «Jim - Guerreiro»:</strong> Clique em qualquer combatente no
                    campo para causar <strong>5 de dano</strong>!
                  </span>
                </div>
              ) : (isReactionPhase && gameState.reactionWindow) || previewCard ? (
                (() => {
                  const activeCenterCard =
                    (isReactionPhase && gameState.reactionWindow?.triggerCard
                      ? previewCard || gameState.reactionWindow.triggerCard
                      : previewCard) || null;
                  const cardImg = activeCenterCard ? getModernImage(activeCenterCard) : undefined;
                  const archList = previewFighter
                    ? getEffectiveArchetypes(gameState, previewFighter)
                    : activeCenterCard?.archetype
                    ? activeCenterCard.archetype
                        .split(/[•,/]+/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                    : [];

                  return (
                    <div
                      className={`w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border-2 flex items-center justify-between gap-2.5 shadow-2xl ${
                        isReactionPhase && gameState.reactionWindow
                          ? 'border-cyan-400'
                          : 'border-amber-400/90'
                      }`}
                    >
                      {/* Left: Card Image + Fullscreen Zoom */}
                      {activeCenterCard && (
                        <div
                          onClick={() => {
                            setInspectedFighter(previewFighter);
                            setInspectedCard(activeCenterCard);
                          }}
                          className="relative w-12 sm:w-14 aspect-[704/987] rounded-lg overflow-hidden border border-amber-400/70 shadow-md cursor-pointer shrink-0 group bg-slate-900"
                          title="Clique na imagem para ampliar"
                        >
                          {cardImg ? (
                            <img
                              src={cardImg}
                              alt={activeCenterCard.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400 p-1 text-center">
                              {activeCenterCard.name}
                            </div>
                          )}
                          {activeCenterCard.type !== 'Herói' && (
                            <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-purple-700 border border-amber-300 text-white font-black text-[9px] flex items-center justify-center shadow">
                              {activeCenterCard.ct}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Center: Card Name, Multi-Equipment Switcher (if multiple in slot) & Full Description */}
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                              isReactionPhase && gameState.reactionWindow
                                ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50'
                                : 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                            }`}
                          >
                            {isReactionPhase && gameState.reactionWindow
                              ? gameState.reactionWindow.isCounterChain
                                ? '⛓️ Contra-Negação'
                                : gameState.phase === 'COMBAT_REACTION'
                                ? '⚡ Reação ao Ataque'
                                : '⚡ Reação à Carta'
                              : previewBannerLabel}
                          </span>

                          {activeCenterCard && (
                            <span className="text-xs font-black text-white truncate">
                              {activeCenterCard.name}
                            </span>
                          )}

                          {archList.map((arch) => {
                            const icon = getArchetypeIcon(arch);
                            return icon ? (
                              <img
                                key={arch}
                                src={icon}
                                alt={arch}
                                title={arch}
                                className="w-4 h-4 object-contain rounded-full bg-slate-900 p-0.5 border border-purple-400/50"
                              />
                            ) : null;
                          })}

                          {/* Multi-Equipment / Stacked Cards Switcher Pills */}
                          {previewSlotCards.length > 1 && (
                            <div className="flex items-center gap-1 flex-wrap ml-1">
                              {previewSlotCards.map((sc, sIdx) => {
                                const isCurrent = activeCenterCard?.code === sc.code;
                                return (
                                  <button
                                    key={`slot_switch_${sIdx}_${sc.code}`}
                                    type="button"
                                    onClick={() => setPreviewCard(sc)}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-black border transition-all ${
                                      isCurrent
                                        ? 'bg-amber-500 text-slate-950 border-amber-200'
                                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400'
                                    }`}
                                  >
                                    {sIdx + 1}. {sc.name}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() =>
                                  setZoneViewer({
                                    title: `${previewBannerLabel} (${previewSlotCards.length})`,
                                    cards: previewSlotCards
                                  })
                                }
                                className="px-1.5 py-0.5 rounded bg-purple-700 hover:bg-purple-600 text-white text-[9px] font-black border border-purple-400"
                              >
                                Ver Todos ({previewSlotCards.length})
                              </button>
                            </div>
                          )}
                        </div>

                        {isReactionPhase && gameState.reactionWindow && (
                          <p className="text-[10px] font-bold text-cyan-300 truncate mt-0.5">
                            {gameState.reactionWindow.triggerActionLabel}
                          </p>
                        )}

                        {activeCenterCard && (
                          <div className="mt-0.5 max-h-12 overflow-y-auto pr-1 text-[11px] text-slate-200 leading-snug whitespace-pre-line">
                            {cleanCardDescription(activeCenterCard.description) ||
                              'Sem efeito adicional.'}
                          </div>
                        )}
                      </div>

                      {/* Right: Reaction Options & Pass / Close Button */}
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        {isReactionPhase && gameState.reactionWindow ? (
                          <>
                            {gameState.reactionWindow.isSelamentoTrigger &&
                              (gameState.reactionWindow.selamentoDoubleLifeCost ?? 0) > 0 &&
                              gameState.player.hp >
                                (gameState.reactionWindow.selamentoDoubleLifeCost ?? 0) && (
                                <button
                                  onClick={handlePayDoubleToCounterSelamento}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] flex items-center gap-1 shadow"
                                >
                                  ⛓️ Anular Selamento (
                                  {gameState.reactionWindow.selamentoDoubleLifeCost} PV)
                                </button>
                              )}
                            {availablePlayerReactions.canUseJimMagoFieldNegate && (
                              <button
                                onClick={handleReactWithJimMago}
                                className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-[10px] flex items-center gap-1 shadow"
                              >
                                <Wand2 size={12} />
                                Negar («Jim - Mago»)
                              </button>
                            )}
                            {availablePlayerReactions.canUseMahinaVeuFieldNegate && (
                              <button
                                onClick={handleReactWithMahinaVeu}
                                className="px-2.5 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black text-[10px] flex items-center gap-1 shadow"
                              >
                                <Crown size={12} />
                                Negar («Mahina Véu»)
                              </button>
                            )}
                            {availablePlayerReactions.canUseQuintaCamadaNegate && (
                              <button
                                onClick={handleReactWithQuintaCamada}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] flex items-center gap-1 shadow"
                              >
                                <Shield size={12} />
                                Negar («Quinta Camada»)
                              </button>
                            )}
                            {(() => {
                              const jimHeroiSlot = gameState.player.frontline.findIndex(
                                (f) =>
                                  f !== null &&
                                  f.card.code === '2025/0001/00007' &&
                                  !f.usedOncePerRoundAbility
                              );
                              if (jimHeroiSlot === -1) return null;
                              return (
                                <button
                                  onClick={() => handleActivateFieldFighterAbility(jimHeroiSlot)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] flex items-center gap-1 shadow"
                                >
                                  💚 +1 Vida
                                </button>
                              );
                            })()}
                            <button
                              onClick={handlePassReaction}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider shadow-lg"
                            >
                              {gameState.reactionWindow.isCounterChain
                                ? 'Passar (Aceitar)'
                                : 'Passar'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setPreviewCard(null);
                              setPreviewFighter(null);
                              setPreviewSlotCards([]);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white font-black text-[10px] uppercase border border-slate-600 flex items-center gap-1"
                          >
                            Passar / Fechar
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center justify-center gap-2 w-full">
                  {selectingSlotForHero ? (
                    <span className="px-3 py-0.5 rounded-full bg-amber-950/90 border border-amber-400 text-[10px] text-amber-200 font-black">
                      👑 Invocação de Herói: Clique na Área de Combatente (Coluna 1 a 6) onde deseja
                      invocar!
                    </span>
                  ) : selectedHandCard ? (
                    <span className="px-3 py-0.5 rounded-full bg-purple-950/90 border border-purple-400 text-[10px] text-purple-200 font-bold">
                      Carta selecionada: <strong>«{selectedHandCard.name}»</strong> — Clique no
                      espaço correspondente do campo para colocá-la!
                    </span>
                  ) : selectedAttackerSlot !== null ? (
                    <span className="px-3 py-0.5 rounded-full bg-amber-950/90 border border-amber-400 text-[10px] text-amber-200 font-bold">
                      Atacante na Coluna {selectedAttackerSlot + 1} — Clique em um combatente
                      inimigo, em «Aqua Caótica» aliada (2x dano){' '}
                      {canDirectAttackBot ? 'ou em "Ataque Direto"' : ''}!
                    </span>
                  ) : actionSpotlight ? (
                    <span className="px-3 py-0.5 rounded-full bg-slate-900/95 border border-purple-500/40 text-[10px] font-bold text-purple-200">
                      {actionSpotlight.text}
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            {/* ============================================================
                PLAYER FRONTLINE (6 Blue AREA DE COMBATENTE — Equal 1:1 Height with Bot Frontline)
               ============================================================ */}
            <div className="grid grid-cols-6 gap-1.5 flex-1 min-h-0">
              {gameState.player.frontline.map((fighter, idx) => {
                const isSelectedAttacker = selectedAttackerSlot === idx;

                const isFriendlyAquaTarget =
                  gameState.phase === 'MAIN_PHASE' &&
                  gameState.activePlayer === 'player' &&
                  gameState.round >= 2 &&
                  selectedAttackerSlot !== null &&
                  selectedAttackerSlot !== idx &&
                  fighter !== null &&
                  fighter.card.code === '2026/0001/00310' &&
                  gameState.bot.frontline[idx] !== null;

                const isSummonTargetMain =
                  gameState.phase === 'MAIN_PHASE' &&
                  selectedHandCard &&
                  ((selectedHandCard.type === 'Combatente' && fighter === null) ||
                    (selectedHandCard.type === 'Herói' && (fighter === null || fighter.isHero)) ||
                    ((selectedHandCard.code === '2025/0001/00021' ||
                      selectedHandCard.code === '2025/0001/00027') &&
                      fighter === null));

                const isHeroSlotTarget =
                  selectingSlotForHero && (fighter === null || fighter.isHero);

                const isEquipOrAllyTargetMain =
                  gameState.phase === 'MAIN_PHASE' &&
                  selectedHandCard &&
                  fighter !== null &&
                  ((selectedHandCard.type === 'Equipamento' &&
                    !isContinuousBackrowCard(selectedHandCard)) ||
                    selectedHandCard.code === '2025/0001/00019' ||
                    selectedHandCard.code === '2025/0001/00020');

                const isReactionSlotTarget =
                  isReactionPhase &&
                  selectedReactionCard !== null &&
                  ((gameState.phase === 'CARD_REACTION' &&
                    (((selectedReactionCard.type === 'Combatente' ||
                      selectedReactionCard.code === '2025/0001/00021' ||
                      selectedReactionCard.code === '2025/0001/00027') &&
                      fighter === null) ||
                      (((selectedReactionCard.type === 'Equipamento' &&
                        !isContinuousBackrowCard(selectedReactionCard)) ||
                        selectedReactionCard.code === '2025/0001/00019' ||
                        selectedReactionCard.code === '2025/0001/00020') &&
                        fighter !== null))) ||
                    (gameState.phase === 'COMBAT_REACTION' &&
                      fighter !== null &&
                      (selectedReactionCard.code === '2025/0001/00028' ||
                        selectedReactionCard.code === '2025/0001/00023' ||
                        (selectedReactionCard.code === '2025/0001/00024' && !fighter.isHero))));

                const effAtk = fighter ? getFighterEffectiveAtk(gameState, fighter) : 0;
                const baseAtk = fighter ? fighter.card.attack ?? 0 : 0;
                const baseHp = fighter ? fighter.card.defense ?? fighter.maxHp : 0;
                const effArchs = fighter ? getEffectiveArchetypes(gameState, fighter) : [];
                const imgUrl = fighter ? getModernImage(fighter.card) : undefined;
                const displayCt = fighter
                  ? Math.max(
                      0,
                      Number(fighter.card.ct || 0) -
                        Number(gameState.player.permCtReduction || 0)
                    )
                  : 0;

                const canUseSalazarSwap =
                  fighter &&
                  gameState.phase === 'MAIN_PHASE' &&
                  gameState.activePlayer === 'player' &&
                  !fighter.usedOncePerRoundAbility &&
                  ((fighter.card.code === '2025/0001/00181' &&
                    gameState.player.heroDeck.some((c) => c.code === '2025/0001/00182')) ||
                    (fighter.card.code === '2025/0001/00182' &&
                      gameState.player.heroDeck.some((c) => c.code === '2025/0001/00181')));

                const canUseMestreDualidadeSummon =
                  fighter &&
                  fighter.card.code === '2025/0001/00183' &&
                  !fighter.usedOncePerRoundAbility &&
                  gameState.player.frontline.some((s) => s === null) &&
                  [
                    ...gameState.player.heroDeck,
                    ...gameState.player.deadZone,
                    ...gameState.player.erasedZone
                  ].some((c) => c.code === '2025/0001/00181' || c.code === '2025/0001/00182');

                const canUseAnytimeAbility =
                  fighter &&
                  ((fighter.card.code === '2025/0001/00007' && !fighter.usedOncePerRoundAbility) ||
                    canUseSalazarSwap ||
                    canUseMestreDualidadeSummon ||
                    (fighter.card.code === '2025/0001/00001' &&
                      !fighter.jimLordTier9GemUsedThisRound &&
                      countJimsInErasedZone(gameState.player) >= 9));

                const isPlayerSlotAttackerAnim =
                  activeAttackAnim?.attackerSide === 'player' &&
                  activeAttackAnim.attackerSlot === idx;

                const isPlayerSlotTargetAnim =
                  (activeAttackAnim?.targetSide === 'player' &&
                    activeAttackAnim.targetSlot === idx) ||
                  (gameState.phase === 'COMBAT_REACTION' &&
                    gameState.combatPending?.attackerPlayer === 'bot' &&
                    gameState.combatPending.targetSlot === idx);

                const playerSlotImpact = slotImpacts[`player_slot_${idx}`];
                const playerSlotPopups = floatingPopups.filter(
                  (p) => p.targetKey === `player_slot_${idx}`
                );

                return (
                  <div
                    key={`player_front_${idx}`}
                    ref={(el) => {
                      playerSlotRefs.current[idx] = el;
                    }}
                    onMouseEnter={() => {
                      if (isFriendlyAquaTarget) {
                        setHoveredAttackTarget({ side: 'player', slot: idx });
                      }
                    }}
                    onMouseLeave={() => {
                      if (
                        hoveredAttackTarget?.side === 'player' &&
                        hoveredAttackTarget.slot === idx
                      ) {
                        setHoveredAttackTarget(null);
                      }
                    }}
                    onClick={() => handlePlayerFrontSlotClick(idx)}
                    className={`rounded-xl border-2 p-1 flex flex-col justify-between relative overflow-hidden transition-all duration-300 cursor-pointer ${
                      isPlayerSlotAttackerAnim
                        ? '-translate-y-3 scale-105 ring-4 ring-amber-400 border-amber-300 z-30 shadow-2xl shadow-amber-500/50 bg-amber-950/90'
                        : isPlayerSlotTargetAnim || playerSlotImpact === 'hit'
                        ? 'ring-4 ring-rose-500 border-rose-300 bg-rose-950/85 scale-95 z-20'
                        : playerSlotImpact === 'summon'
                        ? 'ring-2 ring-amber-400 border-amber-300 bg-sky-900/95 scale-[1.03]'
                        : playerSlotImpact === 'heal'
                        ? 'ring-2 ring-emerald-400 border-emerald-300 bg-sky-900/95'
                        : fighter
                        ? isSelectedAttacker
                          ? 'bg-amber-950/80 border-amber-400 ring-2 ring-amber-400/80 scale-[1.02]'
                          : isFriendlyAquaTarget
                          ? 'bg-fuchsia-950/80 border-fuchsia-400 ring-2 ring-fuchsia-400/80 scale-[1.02] animate-pulse'
                          : isEquipOrAllyTargetMain || isHeroSlotTarget || isReactionSlotTarget
                          ? 'bg-cyan-950/80 border-cyan-400 ring-2 ring-cyan-400/80 scale-[1.02]'
                          : 'bg-sky-950/85 border-sky-400/70 hover:border-sky-300 shadow-inner'
                        : isSummonTargetMain || isHeroSlotTarget || isReactionSlotTarget
                        ? 'bg-emerald-950/60 border-emerald-400 border-dashed ring-2 ring-emerald-400/70 items-center justify-center animate-pulse'
                        : 'bg-sky-600/20 border-sky-500/40 text-sky-300/60 items-center justify-center'
                    }`}
                  >
                    {playerSlotPopups.length > 0 && (
                      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-0.5">
                        {playerSlotPopups.map((p) => (
                          <span
                            key={p.id}
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-xl border animate-bounce ${
                              p.variant === 'damage' || p.variant === 'ko'
                                ? 'bg-rose-600/95 text-white border-rose-200'
                                : p.variant === 'heal'
                                ? 'bg-emerald-600/95 text-white border-emerald-200'
                                : 'bg-amber-500/95 text-slate-950 border-amber-200'
                            }`}
                          >
                            {p.text}
                          </span>
                        ))}
                      </div>
                    )}

                    {fighter ? (
                      <div
                        key={fighter.instanceId}
                        className="animate-ld-card-place w-full h-full flex flex-col justify-between relative"
                      >
                        {imgUrl && (
                          <div className="absolute inset-0 opacity-45 pointer-events-none">
                            <img
                              src={imgUrl}
                              alt={fighter.card.name}
                              className="w-full h-full object-cover object-top"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/20" />
                          </div>
                        )}

                        {/* Top Row: Plain Numeric CT Circle + Archetype Icons */}
                        <div className="relative z-10 flex items-start justify-between gap-1">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border shadow-md shrink-0 ${
                              fighter.isHero
                                ? 'bg-amber-500 text-slate-950 border-amber-200'
                                : 'bg-purple-700 text-white border-purple-300'
                            }`}
                            title={fighter.isHero ? 'Herói' : `Custo de Turno: ${displayCt}`}
                          >
                            {displayCt}
                          </span>

                          <div className="flex items-center gap-0.5 flex-wrap justify-end">
                            {isFriendlyAquaTarget && (
                              <span className="text-[7px] px-1 rounded bg-fuchsia-500 text-white font-black uppercase">
                                2x
                              </span>
                            )}
                            {fighter.hasAttackedThisTurn && (
                              <span
                                className="text-[7px] px-1 rounded bg-slate-900/90 text-slate-400 border border-slate-700"
                                title="Já atacou neste turno"
                              >
                                ✓
                              </span>
                            )}
                            {effArchs.map((arch) => {
                              const iconUrl = getArchetypeIcon(arch);
                              return iconUrl ? (
                                <img
                                  key={arch}
                                  src={iconUrl}
                                  alt={arch}
                                  title={arch}
                                  className="w-4 h-4 rounded-full object-cover border border-white/40 bg-slate-950 shadow"
                                />
                              ) : null;
                            })}
                          </div>
                        </div>

                        {/* Center Name + Optional Active Ability Button */}
                        <div className="relative z-10 my-auto px-0.5 text-center">
                          <p className="font-bold text-[9px] sm:text-[10px] text-white leading-tight line-clamp-2 drop-shadow">
                            {fighter.card.name}
                          </p>
                          {fighter.equipments.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const eqCards = fighter.equipments.map((eq) => eq.card);
                                showCardInPanel(
                                  eqCards[0],
                                  fighter,
                                  `Equipamentos de ${fighter.card.name}`,
                                  eqCards
                                );
                                if (eqCards.length > 1) {
                                  setZoneViewer({
                                    title: `Equipamentos de «${fighter.card.name}» (${eqCards.length})`,
                                    cards: eqCards
                                  });
                                }
                              }}
                              className="text-[7px] px-1 py-0.2 rounded bg-amber-950/90 border border-amber-400/60 text-amber-300 hover:text-white font-bold truncate"
                              title="Clique para ver todos os equipamentos acoplados"
                            >
                              🛡️ {fighter.equipments.length} Equip.
                            </button>
                          )}
                        </div>

                        {canUseAnytimeAbility && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActivateFieldFighterAbility(idx);
                            }}
                            className="relative z-10 w-full py-0.5 mb-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[8px] uppercase truncate shadow"
                          >
                            {fighter.card.code === '2025/0001/00007'
                              ? '💚 +1 Vida'
                              : canUseSalazarSwap
                              ? '👑 Trocar Salazar'
                              : canUseMestreDualidadeSummon
                              ? '👑 Invocar Guia/Líder'
                              : '⚡ Buscar Gema'}
                          </button>
                        )}

                        {/* Bottom Bar: ATK & HP colored white (equal), green (gain), red (loss) */}
                        <div className="relative z-10 flex items-center justify-between text-[11px] font-black bg-slate-950/95 px-1.5 py-0.5 rounded border border-slate-800">
                          <span
                            className={`flex items-center gap-0.5 ${getStatColorClass(
                              effAtk,
                              baseAtk
                            )}`}
                            title={`Ataque Base: ${baseAtk} | Atual: ${effAtk}`}
                          >
                            ⚔️ {effAtk}
                          </span>
                          <span
                            className={`flex items-center gap-0.5 ${getStatColorClass(
                              fighter.currentHp,
                              baseHp
                            )}`}
                            title={`Vida Base: ${baseHp} | Atual: ${fighter.currentHp}`}
                          >
                            ❤️ {fighter.currentHp}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center px-1">
                        <span className="text-[8px] font-black uppercase tracking-wider leading-tight block">
                          AREA DE COMBATENTE
                        </span>
                        {(isSummonTargetMain || isHeroSlotTarget || isReactionSlotTarget) && (
                          <span className="text-[8px] text-emerald-300 font-black uppercase block mt-0.5">
                            Invocar
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Player Backrow (6 Green AREA DE EFEITO / EQUIPAMENTO slots) */}
            <div className="grid grid-cols-6 gap-1.5 h-11 sm:h-12 shrink-0">
              {gameState.player.backrow.map((sup, idx) => {
                const frontFighter = gameState.player.frontline[idx];
                const equippedList = frontFighter?.equipments ?? [];
                const supportCardsInSlot = getAllSupportCardsInSlot(sup);
                const allPlayerSlotCards = [
                  ...supportCardsInSlot,
                  ...equippedList.map((e) => e.card)
                ];
                const hasContent = allPlayerSlotCards.length > 0;

                const activeSupportCard =
                  gameState.phase === 'MAIN_PHASE'
                    ? selectedHandCard
                    : gameState.phase === 'CARD_REACTION'
                    ? selectedReactionCard
                    : null;

                // Equipamentos de jogador podem ser colocados em espaço vazio OU empilhados com outros Equipamentos de jogador.
                // Cartas de Efeito contínuas NUNCA podem ser colocadas na mesma área que já tem uma carta Equipamento ou Efeito!
                const isSupportTarget =
                  activeSupportCard !== null &&
                  isContinuousBackrowCard(activeSupportCard) &&
                  (isPlayerEquipmentCard(activeSupportCard)
                    ? sup === null || isPlayerEquipmentCard(sup.card)
                    : sup === null && equippedList.length === 0);

                const isEquipSupportTarget =
                  frontFighter !== null &&
                  (sup === null || isPlayerEquipmentCard(sup.card)) &&
                  ((gameState.phase === 'MAIN_PHASE' &&
                    selectedHandCard?.type === 'Equipamento' &&
                    !isContinuousBackrowCard(selectedHandCard)) ||
                    (gameState.phase === 'CARD_REACTION' &&
                      selectedReactionCard?.type === 'Equipamento' &&
                      !isContinuousBackrowCard(selectedReactionCard)));

                const canUseBusca =
                  sup &&
                  supportCardsInSlot.some((c) => c.code === '2025/0001/00017') &&
                  !sup.usedOncePerRound &&
                  gameState.player.deck.some((c) => c.ct === gameState.player.runes);

                return (
                  <div
                    key={`player_back_${idx}`}
                    onClick={() => {
                      if (isSupportTarget || isEquipSupportTarget) {
                        handlePlayerSupportSlotClick(idx);
                      } else if (allPlayerSlotCards.length > 0) {
                        showCardInPanel(
                          allPlayerSlotCards[allPlayerSlotCards.length - 1],
                          null,
                          `Seus Efeitos / Equipamentos (Coluna ${idx + 1})`,
                          allPlayerSlotCards
                        );
                        if (allPlayerSlotCards.length > 1) {
                          setZoneViewer({
                            title: `Seus Efeitos / Equipamentos — Coluna ${idx + 1} (${allPlayerSlotCards.length})`,
                            cards: allPlayerSlotCards
                          });
                        }
                      } else {
                        handlePlayerSupportSlotClick(idx);
                      }
                    }}
                    className={`rounded-lg border-2 flex items-center justify-center p-1 text-center transition-all overflow-hidden ${
                      isSupportTarget || isEquipSupportTarget
                        ? 'bg-emerald-900/70 border-emerald-300 border-dashed ring-2 ring-emerald-400/70 cursor-pointer animate-pulse'
                        : hasContent
                        ? 'bg-emerald-950/85 border-emerald-400/80 cursor-pointer hover:border-emerald-300'
                        : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300/60'
                    }`}
                  >
                    {hasContent ? (
                      <div className="animate-ld-card-place flex items-center gap-1 w-full px-0.5 overflow-hidden">
                        <div className="flex -space-x-1.5 shrink-0">
                          {allPlayerSlotCards.slice(0, 3).map((c, cIdx) => {
                            const cImg = getModernImage(c);
                            return cImg ? (
                              <img
                                key={`player_back_img_${idx}_${cIdx}`}
                                src={cImg}
                                alt={c.name}
                                className="w-5 h-7 object-cover rounded border border-emerald-300/80 shadow"
                              />
                            ) : null;
                          })}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <span className="text-[8px] font-black uppercase text-emerald-100 truncate block">
                            {allPlayerSlotCards[allPlayerSlotCards.length - 1].name}
                          </span>
                          {canUseBusca ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActivateBuscaEternidade(idx);
                              }}
                              className="px-1 py-0.2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[7px] uppercase"
                            >
                              Buscar (CT {gameState.player.runes})
                            </button>
                          ) : (
                            <span className="text-[7px] text-amber-300 font-bold block truncate">
                              {allPlayerSlotCards.length > 1
                                ? `📚 ${allPlayerSlotCards.length} cartas (Ver todas)`
                                : 'Ativo'}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <span className="text-[7px] uppercase font-black tracking-tight leading-tight block">
                          AREA DE EFEITO / EQUIPAMENTO
                        </span>
                        {(isSupportTarget || isEquipSupportTarget) && (
                          <span className="text-[7px] text-emerald-200 font-black uppercase block">
                            {isEquipSupportTarget ? 'Equipar' : 'Ativar / Empilhar'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

            {/* ============================================================
                RIGHT COLUMN: ZONA APAGADA (Top) & DECK DE HERÓI (Bottom)
               ============================================================ */}
            <div className="w-20 sm:w-24 shrink-0 flex flex-col gap-1.5">
              {/* ZONA APAGADA */}
              <button
                onClick={() =>
                  setZoneViewer({
                    title: `Sua Zona Apagada (${gameState.player.erasedZone.length})`,
                    cards: gameState.player.erasedZone
                  })
                }
                className="flex-1 rounded-xl border-2 border-purple-500/50 bg-slate-900/90 hover:border-purple-400 p-1.5 flex flex-col items-center justify-between text-center transition-all group relative overflow-hidden"
                title="Clique para abrir a Zona Apagada"
              >
                <span className="text-[9px] font-black uppercase tracking-wider text-purple-200 z-10">
                  ZONA APAGADA
                </span>
                {gameState.player.erasedZone.length > 0 ? (
                  <div className="relative w-12 h-16 rounded border border-purple-400/60 overflow-hidden shadow-md my-auto">
                    {getModernImage(
                      gameState.player.erasedZone[gameState.player.erasedZone.length - 1]
                    ) && (
                      <img
                        src={getModernImage(
                          gameState.player.erasedZone[gameState.player.erasedZone.length - 1]
                        )}
                        alt="Zona Apagada"
                        className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform"
                      />
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-purple-950/90 text-[10px] font-black text-white">
                      {gameState.player.erasedZone.length}
                    </span>
                  </div>
                ) : (
                  <Flame size={20} className="text-purple-700/60 my-auto" />
                )}
                <span className="text-[8px] font-bold text-purple-300 z-10">
                  Bot: {gameState.bot.erasedZone.length}
                </span>
              </button>

              {/* DECK DE HERÓI */}
              {(() => {
                const isAnytimeWindow =
                  isReactionPhase || gameState.phase === 'PRE_DRAW_WINDOW';
                const summonableHero = gameState.player.heroDeck.find(
                  (h) => canSummonHeroDirectly(gameState, 'player', h, isAnytimeWindow).allowed
                );
                const displayHero = summonableHero || gameState.player.heroDeck[0];
                const heroCheck = displayHero
                  ? canSummonHeroDirectly(gameState, 'player', displayHero, isAnytimeWindow)
                  : null;
                const canClickSummon =
                  Boolean(heroCheck?.allowed) &&
                  (isAnytimeWindow ||
                    (gameState.phase === 'MAIN_PHASE' && gameState.activePlayer === 'player'));

                return (
                  <div
                    onClick={() => {
                      if (!displayHero) return;
                      showCardInPanel(displayHero, null, 'DECK DE HERÓI');
                      if (canClickSummon) {
                        setSelectedHandIndex(null);
                        setSelectedAttackerSlot(null);
                        setPendingReactionHandIndex(null);
                        setSelectedHeroCodeToSummon(displayHero.code);
                        setSelectingSlotForHero((prev) => !prev);
                      } else if (gameState.player.heroDeck.length > 0) {
                        setZoneViewer({
                          title: `Deck de Herói (${gameState.player.heroDeck.length})`,
                          cards: gameState.player.heroDeck
                        });
                      }
                    }}
                    className={`flex-1 rounded-xl border-2 p-1.5 flex flex-col items-center justify-between text-center transition-all cursor-pointer relative overflow-hidden ${
                      selectingSlotForHero
                        ? 'border-emerald-400 bg-emerald-950/70 ring-2 ring-emerald-300'
                        : canClickSummon
                        ? 'border-amber-400 bg-amber-950/70 ring-2 ring-amber-400/70 animate-pulse'
                        : 'border-amber-500/40 bg-slate-900/90 hover:border-amber-400'
                    }`}
                    title={
                      displayHero
                        ? canClickSummon
                          ? `Clique para invocar «${displayHero.name}»`
                          : `Clique para ver os Heróis (${gameState.player.heroDeck.length})`
                        : 'Deck de Herói vazio'
                    }
                  >
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-200 leading-tight z-10">
                      DECK DE HERÓI
                    </span>

                    {displayHero ? (
                      <div className="relative w-12 h-16 rounded border border-amber-400/70 overflow-hidden shadow-md my-auto">
                        {getModernImage(displayHero) && (
                          <img
                            src={getModernImage(displayHero)}
                            alt={displayHero.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <span className="absolute inset-x-0 bottom-0 bg-slate-950/90 text-[8px] font-black text-amber-300 truncate px-0.5">
                          {selectingSlotForHero
                            ? 'Cancelar'
                            : canClickSummon
                            ? 'INVOCAR!'
                            : `${gameState.player.heroDeck.length} Herói(s)`}
                        </span>
                      </div>
                    ) : (
                      <Crown size={20} className="text-slate-700 my-auto" />
                    )}

                    <span className="text-[8px] font-bold text-amber-300/90 truncate w-full z-10">
                      {heroCheck ? heroCheck.badgeText : 'Em campo'}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ============================================================
              BOTTOM SECTION: STATUS BOXES + FANNED HAND (NO SCROLLBARS)
             ============================================================ */}
          <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
            {/* Status Row matching diagram: VIDA | MANA | SANIDADE | CUSTO | DANO PRIMORDIAL | RUNAS + Passar Turno */}
            <div className="w-full flex flex-wrap items-center justify-center gap-1.5 px-2">
              {/* VIDA */}
              <div
                ref={playerHpRef}
                className={`relative px-2.5 py-1 rounded-lg border-2 bg-slate-900/95 flex items-center gap-1.5 transition-all ${
                  slotImpacts['player_hp'] === 'hit'
                    ? 'border-rose-400 bg-rose-950 scale-105'
                    : slotImpacts['player_hp'] === 'heal'
                    ? 'border-emerald-400 bg-emerald-950 scale-105'
                    : 'border-slate-700'
                }`}
              >
                <span className="text-[9px] font-black uppercase text-slate-400">VIDA</span>
                <span
                  className={`text-xs font-black ${getStatColorClass(
                    gameState.player.hp,
                    20
                  )}`}
                >
                  {gameState.player.hp}
                </span>
                {floatingPopups
                  .filter((p) => p.targetKey === 'player_hp')
                  .map((p) => (
                    <span
                      key={p.id}
                      className={`pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 z-50 px-1.5 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap shadow-lg animate-bounce ${
                        p.variant === 'damage'
                          ? 'bg-rose-600 text-white border border-rose-300'
                          : 'bg-emerald-600 text-white border border-emerald-300'
                      }`}
                    >
                      {p.text}
                    </span>
                  ))}
              </div>

              {/* MANA */}
              <div className="px-2.5 py-1 rounded-lg border-2 border-slate-700 bg-slate-900/95 flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase text-slate-400">MANA</span>
                <span
                  className={`text-xs font-black ${getStatColorClass(
                    gameState.player.mana,
                    12
                  )}`}
                >
                  {gameState.player.mana}
                </span>
              </div>

              {/* SANIDADE */}
              <div className="px-2.5 py-1 rounded-lg border-2 border-slate-700 bg-slate-900/95 flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase text-slate-400">SANIDADE</span>
                <span className="text-xs font-black text-white">12</span>
              </div>

              {/* CUSTO (Modificador de CT) */}
              {(() => {
                const totalCtRed =
                  Number(gameState.player.ctReductionThisRound || 0) +
                  Number(gameState.player.permCtReduction || 0);
                const totalCtPen = Number(gameState.player.permCtPenalty || 0);
                const netCtDiff = totalCtPen - totalCtRed;
                return (
                  <div className="px-2.5 py-1 rounded-lg border-2 border-slate-700 bg-slate-900/95 flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase text-slate-400">CUSTO</span>
                    <span
                      className={`text-xs font-black ${
                        netCtDiff < 0
                          ? 'text-emerald-400'
                          : netCtDiff > 0
                          ? 'text-red-500'
                          : 'text-white'
                      }`}
                    >
                      {netCtDiff > 0 ? `+${netCtDiff}` : `${netCtDiff}`}
                    </span>
                  </div>
                );
              })()}

              {/* DANO PRIMORDIAL */}
              <div className="px-2.5 py-1 rounded-lg border-2 border-slate-700 bg-slate-900/95 flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase text-slate-400">
                  DANO PRIMORDIAL
                </span>
                <span className="text-xs font-black text-white">0</span>
              </div>

              {/* RUNAS */}
              <div className="px-2.5 py-1 rounded-lg border-2 border-slate-700 bg-slate-900/95 flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase text-slate-400">RUNAS</span>
                <span
                  className={`text-xs font-black ${
                    gameState.player.runes > 0 ? 'text-emerald-400' : 'text-white'
                  }`}
                >
                  {gameState.player.runes}
                </span>
              </div>

              {/* Passar Turno Button */}
              {gameState.phase === 'MAIN_PHASE' && gameState.activePlayer === 'player' && (
                <button
                  onClick={handleEndPlayerTurn}
                  className="px-3.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-[11px] uppercase tracking-wider shadow-lg shadow-purple-600/30 transition-all border border-purple-400/50"
                >
                  Passar Turno
                </button>
              )}
            </div>

            {/* FANNED HAND (CARTAS DA MÃO) - Zero Horizontal Scroll */}
            <div className="relative w-full h-28 sm:h-32 flex items-end justify-center overflow-visible select-none pb-1">
              {gameState.player.hand.length === 0 ? (
                <div className="my-auto text-xs text-slate-500 italic">Sua mão está vazia.</div>
              ) : (
                <div className="flex items-end justify-center">
                  {gameState.player.hand.map((card, idx) => {
                    const total = gameState.player.hand.length;
                    const mid = (total - 1) / 2;
                    const offset = idx - mid;
                    const angle = Math.max(-18, Math.min(18, offset * (total > 7 ? 3.2 : 4.8)));
                    const archY = Math.min(18, Math.abs(offset) * 3.2);

                    const effCt = getEffectiveCt(gameState.player, card);
                    const playCheck = canPlayCardInMainPhase(gameState, 'player', card);
                    const modernImg = getModernImage(card);

                    const isPlayableInMain =
                      gameState.phase === 'MAIN_PHASE' &&
                      gameState.activePlayer === 'player' &&
                      playCheck.allowed;

                    const isPlayableInReaction =
                      isReactionPhase &&
                      availablePlayerReactions.handCards.some((rc) => rc.code === card.code);

                    const isSelected =
                      selectedHandIndex === idx || pendingReactionHandIndex === idx;

                    return (
                      <div
                        key={`hand_${idx}_${card.code}`}
                        onClick={() => handleHandCardClick(idx)}
                        style={{
                          transform: `translateY(${isSelected ? -18 : archY}px) rotate(${
                            isSelected ? 0 : angle
                          }deg)`,
                          marginLeft: idx === 0 ? '0px' : total > 7 ? '-24px' : '-14px',
                          zIndex: isSelected ? 50 : 10 + idx
                        }}
                        className={`group w-20 sm:w-24 aspect-[704/987] shrink-0 rounded-lg border-2 overflow-hidden transition-all duration-200 relative flex flex-col bg-slate-950 hover:!z-50 hover:!-translate-y-5 hover:!rotate-0 hover:scale-110 ${
                          isSelected
                            ? 'border-amber-400 ring-2 ring-amber-400 shadow-2xl shadow-amber-500/40 cursor-pointer'
                            : isPlayableInReaction
                            ? 'border-cyan-400 ring-2 ring-cyan-400 shadow-xl shadow-cyan-500/40 cursor-pointer animate-pulse'
                            : isPlayableInMain
                            ? 'border-purple-400/80 hover:border-amber-300 shadow-xl cursor-pointer'
                            : 'border-slate-700 opacity-75 cursor-pointer'
                        }`}
                      >
                        {isPlayableInReaction && (
                          <div className="absolute top-0.5 left-1/2 -translate-x-1/2 z-20 px-1.5 py-0.2 rounded-full bg-cyan-400 text-slate-950 font-black text-[7px] uppercase tracking-wider shadow whitespace-nowrap">
                            ⚡ Reagir
                          </div>
                        )}

                        {modernImg ? (
                          <img
                            src={modernImg}
                            alt={card.name}
                            className="w-full h-full object-cover select-none pointer-events-none"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400 p-1 text-center">
                            {card.name}
                          </div>
                        )}

                        {/* Top-left Plain Numeric CT Circle */}
                        <span
                          className={`absolute top-1 left-1 z-10 w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] border shadow ${
                            effCt < (card.ct || 0)
                              ? 'bg-emerald-600 text-white border-emerald-200'
                              : effCt > (card.ct || 0)
                              ? 'bg-red-600 text-white border-red-200'
                              : 'bg-purple-700 text-white border-purple-300'
                          }`}
                        >
                          {effCt}
                        </span>

                        {/* Bottom Bar */}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pt-3 pb-0.5 px-1">
                          <p className="font-bold text-[8px] text-white truncate text-center">
                            {card.name}
                          </p>
                          {(card.type === 'Combatente' || card.type === 'Herói') && (
                            <div className="flex items-center justify-between text-[8px] font-black text-white px-0.5">
                              <span>⚔️ {card.attack}</span>
                              <span>❤️ {card.defense}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================
            RIGHT SIDEBAR: RETRACTABLE ESSENTIAL COMBAT LOG ("LOG RETRÁTIL")
            (100% Opaque, High Z-Index, Minimizable & Closable)
           ============================================================ */}
        {isLogOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-64 sm:w-72 z-[80] border-l-2 border-rose-500/70 bg-slate-950 shadow-[0_0_50px_rgba(0,0,0,0.98)] flex flex-col shrink-0 overflow-hidden"
          >
            <div className="p-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <div className="flex items-center gap-1.5">
                <ScrollText size={14} className="text-rose-400" />
                <span className="font-display font-black text-[11px] uppercase tracking-wider text-white">
                  Resumo do Duelo
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsLogOpen(false)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 hover:text-white text-[11px] font-black leading-none"
                  title="Minimizar Log"
                >
                  —
                </button>
                <button
                  type="button"
                  onClick={() => setIsLogOpen(false)}
                  className="px-1.5 py-0.5 rounded bg-rose-900 hover:bg-rose-700 border border-rose-500 text-white text-[10px] font-black flex items-center"
                  title="Fechar Log"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 text-xs bg-slate-950">
              {gameState.logs.map((entry) => {
                const style = getLogStyle(entry.type);
                return (
                  <div
                    key={entry.id}
                    className={`px-2 py-1.5 rounded-lg border leading-snug bg-slate-900 ${style.container}`}
                  >
                    <div className="flex items-center justify-between text-[8px] font-bold uppercase mb-0.5 opacity-80">
                      <span>{style.label}</span>
                      <span>
                        R{entry.round}•T{entry.turn}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold">{entry.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Red Vertical Tab "LOG (RETRÁTIL)" matching the second reference image */}
        {!isLogOpen && (
          <button
            onClick={() => setIsLogOpen(true)}
            className="w-7 shrink-0 bg-rose-600 hover:bg-rose-500 border-l-2 border-rose-300/60 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center shadow-xl transition-colors"
            title="Abrir Log Retrátil"
          >
            <span className="-rotate-90 whitespace-nowrap flex items-center gap-1.5">
              <ScrollText size={12} />
              LOG (RETRÁTIL)
            </span>
          </button>
        )}
      </div>

      {/* ============================================================
          OVERLAY 1: INITIATIVE 1D20 ROLL
         ============================================================ */}
      {gameState.phase === 'INITIATIVE' && (
        <div className="fixed inset-0 z-[130] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-md w-full p-6 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center mx-auto text-purple-400">
              <Dices size={36} />
            </div>
            <div>
              <h2 className="font-display font-black text-xl uppercase text-white">
                Rolagem de Iniciativa (1D20)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                No início do duelo de Light Dark, ambos os jogadores rolam 1D20 para definir quem
                inicia a Rodada 1.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30">
                <span className="text-xs text-slate-400 block">Sua Rolagem</span>
                <span className="font-display font-black text-3xl text-purple-400">
                  {gameState.initiativeRoll.playerRoll}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/30">
                <span className="text-xs text-slate-400 block">Rolagem do Bot</span>
                <span className="font-display font-black text-3xl text-rose-400">
                  {gameState.initiativeRoll.botRoll}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
              {gameState.firstPlayerOfRound === 'player'
                ? '🏆 Você venceu a iniciativa e começará jogando!'
                : '🤖 O Bot venceu a iniciativa e começará o Turno 1!'}
            </div>

            <button
              onClick={handleProceedToMulligan}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Play size={16} />
              Ir para o Mulligan (Mão Inicial)
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          OVERLAY 2: ALL-OR-NOTHING MULLIGAN
         ============================================================ */}
      {gameState.phase === 'MULLIGAN' && (
        <div className="fixed inset-0 z-[130] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl">
            <div className="text-center">
              <h2 className="font-display font-black text-xl uppercase text-white">
                Fase de Mulligan (5 Cartas Iniciais)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Escolha entre <strong className="text-emerald-400">MANTER TODAS as 5 cartas</strong>{' '}
                ou <strong className="text-amber-400">TROCAR TODAS as 5 cartas</strong> por 5 novas
                do seu Deck.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {gameState.player.hand.map((card, idx) => {
                const modernImg = getModernImage(card);
                return (
                  <div
                    key={`mulligan_${idx}`}
                    onClick={() => {
                      showCardInPanel(card, null, 'MÃO INICIAL');
                      setInspectedCard(card);
                    }}
                    className="rounded-xl border bg-slate-950 border-slate-800 hover:border-purple-500/60 cursor-pointer transition-all overflow-hidden flex flex-col group"
                  >
                    <div className="relative w-full aspect-[704/987] bg-slate-900 overflow-hidden">
                      {modernImg ? (
                        <img
                          src={modernImg}
                          alt={card.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 p-2">
                          {card.name}
                        </div>
                      )}
                      <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-purple-700 text-white border border-purple-300 flex items-center justify-center font-black text-xs shadow">
                        {card.ct}
                      </span>
                    </div>
                    <div className="p-2 text-center bg-slate-950">
                      <p className="font-bold text-xs text-white truncate">{card.name}</p>
                      <span className="text-[10px] text-cyan-400 font-bold">{card.type}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => handleConfirmMulligan(false)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30"
              >
                ✅ Manter Tudo (5 Cartas)
              </button>
              <button
                onClick={() => handleConfirmMulligan(true)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-600/30"
              >
                🔄 Trocar Tudo (Comprar 5 Novas)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          OVERLAY 3: INTERACTIVE CARD SELECTION MODAL
         ============================================================ */}
      {activePendingChoice && (
        <div className="fixed inset-0 z-[140] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-purple-500 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Escolha do Jogador
                </span>
                <h3 className="font-display font-black text-lg text-white mt-1">
                  {activePendingChoice.title}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">{activePendingChoice.description}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-black text-amber-300 block">
                  Selecionadas: {selectedChoiceIds.length} / {activePendingChoice.maxSelect}
                </span>
                {activePendingChoice.maxTotalCt !== undefined && (
                  <span className="text-[11px] text-cyan-300 font-bold block">
                    Soma de CT:{' '}
                    {activePendingChoice.candidates
                      .filter((c) => selectedChoiceIds.includes(c.id))
                      .reduce((sum, c) => sum + c.card.ct, 0)}{' '}
                    / {activePendingChoice.maxTotalCt}
                  </span>
                )}
              </div>
            </div>

            {activePendingChoice.allowConfirmAllFromDeadZoneOption && (
              <div className="p-3 rounded-xl bg-purple-950/50 border border-purple-500/40 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-purple-200">
                  <strong>Opção 1 (Zona Morta):</strong> Enviar todos os{' '}
                  <strong>{activePendingChoice.deadZoneJimCount} «Jim»</strong> da sua Zona Morta
                  diretamente para a Zona Apagada.
                </div>
                <button
                  onClick={() => handleConfirmPendingChoice(true)}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider shadow"
                >
                  Enviar Todos da Zona Morta ({activePendingChoice.deadZoneJimCount})
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 py-1">
              {activePendingChoice.candidates.map((cand) => {
                const isChecked = selectedChoiceIds.includes(cand.id);
                const currentSelectedCandidates = activePendingChoice.candidates.filter((c) =>
                  selectedChoiceIds.includes(c.id)
                );
                const currentCtSum = currentSelectedCandidates.reduce(
                  (sum, c) => sum + c.card.ct,
                  0
                );
                const wouldExceedCt =
                  !isChecked &&
                  activePendingChoice.maxTotalCt !== undefined &&
                  currentCtSum + cand.card.ct > activePendingChoice.maxTotalCt;

                const modernImg = getModernImage(cand.card);

                return (
                  <div
                    key={cand.id}
                    onClick={() => {
                      showCardInPanel(cand.card, null, 'CARTA SELECIONADA');
                      if (isChecked) {
                        setSelectedChoiceIds((prev) => prev.filter((id) => id !== cand.id));
                      } else {
                        if (wouldExceedCt) return;
                        if (activePendingChoice.maxSelect === 1) {
                          setSelectedChoiceIds([cand.id]);
                        } else if (selectedChoiceIds.length < activePendingChoice.maxSelect) {
                          setSelectedChoiceIds((prev) => [...prev, cand.id]);
                        }
                      }
                    }}
                    className={`rounded-xl border overflow-hidden flex flex-col justify-between transition-all cursor-pointer relative ${
                      isChecked
                        ? 'bg-purple-950/90 border-emerald-400 ring-2 ring-emerald-400 scale-[1.02]'
                        : wouldExceedCt
                        ? 'bg-slate-950/40 border-slate-800 opacity-40 cursor-not-allowed'
                        : 'bg-slate-950 border-slate-800 hover:border-purple-500/60'
                    }`}
                  >
                    {isChecked && (
                      <div className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow">
                        <Check size={14} />
                      </div>
                    )}

                    <div className="relative w-full aspect-[704/987] bg-slate-900 overflow-hidden">
                      {modernImg && (
                        <img
                          src={modernImg}
                          alt={cand.card.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-slate-950/90 text-amber-300 font-bold text-[9px] border border-white/10">
                        {cand.subtitle}
                      </div>
                    </div>

                    <div className="p-2 bg-slate-950 flex items-center justify-between gap-1">
                      <div className="min-w-0">
                        <p className="font-bold text-[11px] text-white truncate">
                          {cand.card.name}
                        </p>
                        <span className="text-[9px] text-cyan-400 font-bold">
                          CT {cand.card.ct}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectedCard(cand.card);
                        }}
                        className="p-1 rounded bg-slate-900 text-slate-300 hover:text-white shrink-0"
                        title="Ampliar Carta"
                      >
                        <Eye size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              {activePendingChoice.minSelect === 0 && (
                <button
                  onClick={() => {
                    setSelectedChoiceIds([]);
                    setTimeout(() => handleConfirmPendingChoice(false), 0);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider border border-slate-700 transition-colors"
                >
                  Não Ativar / Pular
                </button>
              )}
              <button
                disabled={selectedChoiceIds.length < Math.max(1, activePendingChoice.minSelect)}
                onClick={() => handleConfirmPendingChoice(false)}
                className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                  selectedChoiceIds.length >= Math.max(1, activePendingChoice.minSelect)
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                Confirmar Escolha ({selectedChoiceIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          OVERLAY 3.5: PRE-DRAW "A QUALQUER MOMENTO" WINDOW
         ============================================================ */}
      {gameState.phase === 'PRE_DRAW_WINDOW' && !selectingSlotForHero && (
        <div className="fixed inset-0 z-[135] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
              <Crown size={26} />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                «A Qualquer Momento»
              </span>
              <h3 className="font-display font-black text-lg text-white mt-2">
                Passagem de Turno (Antes da Compra de Cartas)
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                O turno anterior foi encerrado. Antes de comprar cartas e iniciar o próximo turno,
                deseja ativar alguma carta ou habilidade <strong>«A Qualquer Momento»</strong>?
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {gameState.player.heroDeck.length > 0 &&
                canSummonHeroDirectly(gameState, 'player', gameState.player.heroDeck[0], true)
                  .allowed && (
                  <button
                    onClick={() => setSelectingSlotForHero(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Crown size={15} />
                    Escolher Coluna p/ Invocar «Jim - O Senhor do Macroverso» (0 Mana •{' '}
                    {countJimsInErasedZone(gameState.player)} Jim Apagados)
                  </button>
                )}

              {gameState.player.frontline.map((f, slotIdx) => {
                if (!f) return null;
                if (f.card.code === '2025/0001/00007' && !f.usedOncePerRoundAbility) {
                  return (
                    <button
                      key={`predraw_heroi_${slotIdx}`}
                      onClick={() => handleActivateFieldFighterAbility(slotIdx)}
                      className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2"
                    >
                      💚 Ativar «Jim - Herói» (+1 de Vida de Jogador • 1x/Rodada)
                    </button>
                  );
                }
                return null;
              })}

              {gameState.player.backrow.map((s, supIdx) => {
                if (
                  s &&
                  s.card.code === '2025/0001/00017' &&
                  !s.usedOncePerRound &&
                  gameState.player.deck.some((c) => c.ct === gameState.player.runes)
                ) {
                  return (
                    <button
                      key={`predraw_busca_${supIdx}`}
                      onClick={() => handleActivateBuscaEternidade(supIdx)}
                      className="w-full py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2"
                    >
                      ⚡ Ativar «Busca Pela Eternidade» (Buscar carta com CT = {gameState.player.runes})
                    </button>
                  );
                }
                return null;
              })}
            </div>

            <button
              onClick={handleProceedFromPreDrawWindow}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider border border-slate-700 transition-colors"
            >
              Seguir para Compra de Cartas e Próximo Turno →
            </button>
          </div>
        </div>
      )}

      {/* ============================================================
          OVERLAY 4: GEMA MACROVERSAL 1 ARCHETYPE PICKER
         ============================================================ */}
      {pendingGema1Play && (
        <div className="fixed inset-0 z-[140] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-display font-black text-lg text-white">
              Gema Macroversal 1 • Escolha 3 Arquétipos
            </h3>
            <p className="text-xs text-slate-400">
              Escolha até 3 arquétipos (exceto Solador, Divindade, Apocalíptico e Véu) para conceder
              ao seu Herói:
            </p>

            <div className="grid grid-cols-3 gap-2">
              {GEMA_1_ARCHETYPE_POOL.map((arch) => {
                const isSelected = pendingGema1Play.selectedArchs.includes(arch);
                const iconUrl = getArchetypeIcon(arch);
                return (
                  <button
                    key={arch}
                    onClick={() => {
                      setPendingGema1Play((prev) => {
                        if (!prev) return null;
                        if (prev.selectedArchs.includes(arch)) {
                          return {
                            ...prev,
                            selectedArchs: prev.selectedArchs.filter((a) => a !== arch)
                          };
                        }
                        if (prev.selectedArchs.length >= 3) return prev;
                        return {
                          ...prev,
                          selectedArchs: [...prev.selectedArchs, arch]
                        };
                      });
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {iconUrl && (
                      <img
                        src={iconUrl}
                        alt={arch}
                        className="w-4 h-4 rounded-full object-cover"
                      />
                    )}
                    <span className="truncate">{arch}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setPendingGema1Play(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                disabled={pendingGema1Play.selectedArchs.length !== 3}
                onClick={() => {
                  if (pendingGema1Play.isReaction) {
                    executePlayerReactionCardOnSlot(
                      pendingGema1Play.handIndex,
                      pendingGema1Play.targetSlot,
                      undefined,
                      pendingGema1Play.selectedArchs
                    );
                  } else {
                    executePlayerCardPlay(
                      pendingGema1Play.handIndex,
                      pendingGema1Play.targetSlot,
                      pendingGema1Play.selectedArchs
                    );
                  }
                }}
                className={`px-5 py-2 rounded-lg text-xs font-black uppercase ${
                  pendingGema1Play.selectedArchs.length === 3
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                Equipar ({pendingGema1Play.selectedArchs.length}/3)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          OVERLAY 5: GAME OVER MODAL (Clean Player-Facing Summary)
         ============================================================ */}
      {gameState.phase === 'GAME_OVER' && (
        <div className="fixed inset-0 z-[150] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-md w-full p-6 text-center space-y-5 shadow-2xl">
            <div
              className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
                gameState.winner === 'player'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              }`}
            >
              <Crown size={36} />
            </div>
            <div>
              <h2 className="font-display font-black text-2xl uppercase text-white">
                {gameState.winner === 'player'
                  ? 'Vitória!'
                  : gameState.winner === 'bot'
                  ? 'Derrota!'
                  : 'Empate!'}
              </h2>
              <p className="text-xs text-slate-300 mt-2">{gameState.winReason}</p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => handleRestartDuel(deckMode)}
                className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 flex items-center gap-2"
              >
                <RotateCcw size={15} />
                Jogar Novamente
              </button>
              <button
                onClick={onClose}
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          OVERLAY 6: CARD / FIGHTER INSPECTOR MODAL
         ============================================================ */}
      {inspectedCard && (
        <div
          onClick={() => {
            setInspectedCard(null);
            setInspectedFighter(null);
          }}
          className="fixed inset-0 z-[160] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-lg w-full p-5 flex flex-col sm:flex-row gap-5 shadow-2xl"
          >
            {getModernImage(inspectedCard) && (
              <img
                src={getModernImage(inspectedCard)}
                alt={inspectedCard.name}
                className="w-48 aspect-[704/987] object-cover rounded-xl border border-slate-800 mx-auto sm:mx-0 shrink-0 shadow-xl"
              />
            )}
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-purple-700 text-white border border-purple-300 flex items-center justify-center text-xs font-black">
                      {inspectedCard.ct}
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                      {inspectedCard.type}
                    </span>
                  </div>
                  <h3 className="font-display font-black text-lg text-white mt-1.5">
                    {inspectedCard.name}
                  </h3>
                  {inspectedCard.archetype && (
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {inspectedCard.archetype
                        .split('/')
                        .map((a) => a.trim())
                        .filter(Boolean)
                        .map((arch) => {
                          const iconUrl = getArchetypeIcon(arch);
                          return (
                            <span
                              key={arch}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-bold text-purple-300"
                            >
                              {iconUrl && (
                                <img
                                  src={iconUrl}
                                  alt={arch}
                                  className="w-3.5 h-3.5 rounded-full object-cover"
                                />
                              )}
                              {arch}
                            </span>
                          );
                        })}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setInspectedCard(null);
                    setInspectedFighter(null);
                  }}
                  className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line bg-slate-950 p-3 rounded-xl border border-slate-800">
                {cleanCardDescription(inspectedCard.description)}
              </p>

              {inspectedFighter && (
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-1.5 text-xs">
                  <p className="font-bold text-purple-200">Status em Campo:</p>
                  <div className="flex items-center gap-4 font-black">
                    <span
                      className={getStatColorClass(
                        getFighterEffectiveAtk(gameState, inspectedFighter),
                        inspectedFighter.card.attack ?? 0
                      )}
                    >
                      ⚔️ ATK: {getFighterEffectiveAtk(gameState, inspectedFighter)}
                    </span>
                    <span
                      className={getStatColorClass(
                        inspectedFighter.currentHp,
                        inspectedFighter.card.defense ?? inspectedFighter.maxHp
                      )}
                    >
                      ❤️ Vida: {inspectedFighter.currentHp}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {getEffectiveArchetypes(gameState, inspectedFighter).map((arch) => {
                      const iconUrl = getArchetypeIcon(arch);
                      return (
                        <span
                          key={arch}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-bold text-white"
                        >
                          {iconUrl && (
                            <img
                              src={iconUrl}
                              alt={arch}
                              className="w-4 h-4 rounded-full object-cover"
                            />
                          )}
                          {arch}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          OVERLAY 7: ZONE VIEWER MODAL
         ============================================================ */}
      {zoneViewer && (
        <div
          onClick={() => setZoneViewer(null)}
          className="fixed inset-0 z-[155] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-5 space-y-4 max-h-[85vh] flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-black text-base uppercase text-white">
                {zoneViewer.title}
              </h3>
              <button
                onClick={() => setZoneViewer(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {zoneViewer.cards.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-8 text-center">
                Nenhuma carta nesta zona.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-y-auto pr-1">
                {zoneViewer.cards.map((c, i) => {
                  const modernImg = getModernImage(c);
                  const isPlayerHeroZone =
                    zoneViewer.title.startsWith('Sua Zona do Herói') ||
                    zoneViewer.title.startsWith('Deck de Herói');
                  const isAnytimeWindow =
                    isReactionPhase || gameState.phase === 'PRE_DRAW_WINDOW';
                  const heroStatus =
                    isPlayerHeroZone && c.type === 'Herói'
                      ? canSummonHeroDirectly(gameState, 'player', c, isAnytimeWindow)
                      : null;
                  const canSummonThisHeroNow =
                    Boolean(heroStatus?.allowed) &&
                    (isAnytimeWindow ||
                      (gameState.phase === 'MAIN_PHASE' &&
                        gameState.activePlayer === 'player'));

                  return (
                    <div
                      key={`${c.code}_${i}`}
                      onClick={() => {
                        showCardInPanel(c, null, zoneViewer.title);
                        setInspectedCard(c);
                      }}
                      className="rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 cursor-pointer overflow-hidden flex flex-col justify-between"
                    >
                      <div className="relative w-full aspect-[704/987] bg-slate-900">
                        {modernImg && (
                          <img
                            src={modernImg}
                            alt={c.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-purple-700 text-white border border-purple-300 flex items-center justify-center font-black text-xs shadow">
                          {c.ct}
                        </span>
                        {heroStatus && (
                          <div
                            className={`absolute bottom-1.5 inset-x-1.5 px-1.5 py-0.5 rounded text-[9px] font-black text-center shadow ${
                              heroStatus.allowed
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-slate-950/90 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {heroStatus.badgeText}
                          </div>
                        )}
                      </div>
                      <div className="p-2 text-center space-y-1.5">
                        <div>
                          <p className="font-bold text-xs text-white truncate">{c.name}</p>
                          <span className="text-[10px] text-cyan-400 font-bold block">
                            {c.type}
                          </span>
                        </div>
                        {heroStatus && (
                          <p className="text-[9px] text-slate-400 line-clamp-2 leading-tight">
                            {heroStatus.reason}
                          </p>
                        )}
                        {canSummonThisHeroNow && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setZoneViewer(null);
                              setSelectedHandIndex(null);
                              setSelectedAttackerSlot(null);
                              setPendingReactionHandIndex(null);
                              setSelectedHeroCodeToSummon(c.code);
                              setSelectingSlotForHero(true);
                            }}
                            className="w-full py-1 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider"
                          >
                            👑 Invocar este Herói
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          OVERLAY 8: RULES SUMMARY MODAL
         ============================================================ */}
      {showRulesModal && (
        <div
          onClick={() => setShowRulesModal(false)}
          className="fixed inset-0 z-[165] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-black text-lg uppercase text-white">
                Guia Rápido do Campo de Duelo
              </h3>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="space-y-2 text-xs text-slate-300 list-disc pl-4 leading-relaxed">
              <li>
                <strong>Vida e Mana:</strong> 20 Pontos de Vida iniciais e 12 de Mana no início de
                cada Rodada. A partir do 2º turno global, ambos os jogadores compram 1 carta no
                começo de cada turno.
              </li>
              <li>
                <strong>Painel da Carta (Esquerda):</strong> Sempre que o Bot usa uma carta ou você
                clica em qualquer carta, ela aparece em destaque na lateral esquerda com o texto
                completo do seu efeito logo abaixo.
              </li>
              <li>
                <strong>Cores dos Status:</strong> Ataque e Vida normais aparecem em{' '}
                <strong className="text-white">branco</strong>, ganhos de status em{' '}
                <strong className="text-emerald-400">verde</strong> e perdas de status em{' '}
                <strong className="text-red-500">vermelho</strong>.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
