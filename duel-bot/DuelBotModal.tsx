import React, { useEffect, useState } from 'react';
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
  PanelRightClose,
  PanelRightOpen,
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
  evaluateBoardHeuristic,
  evaluateBotReactionToPlayerAction,
  executeBotTurnStep,
  executeCombatResolution,
  getAvailableReactions,
  getCardAuthorityCt,
  getEffectiveArchetypes,
  getEffectiveCt,
  getFighterEffectiveAtk,
  isContinuousBackrowCard,
  isJimCard,
  loadBotAdaptiveMemory,
  payDirectHeroSummonCost,
  performBotSmartMulligan,
  processStartOfTurn,
  resetBotAdaptiveMemory,
  resolveInsanisCardEffect,
  resolveModernCardVersion,
  sendCardToDeadOrErasedZone,
  sendFighterFromFieldToZone,
  shuffleCards,
  summonFighterToSlot
} from './insanisEngine';

interface DuelBotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GEMA_1_ARCHETYPE_POOL = [
  'Caos',
  'Ordem',
  'Lúmen',
  'Darkus',
  'Conceito',
  'Furtivo',
  'Reativo',
  'Insano',
  'Sortudo',
  'Azarado',
  'Cósmico',
  'Escolhido'
];

export const DuelBotModal: React.FC<DuelBotModalProps> = ({ isOpen, onClose }) => {
  const { cards: liveCards } = useCards();
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
  // Inspect card modal
  const [inspectedCard, setInspectedCard] = useState<CardData | null>(null);
  const [inspectedFighter, setInspectedFighter] = useState<FieldFighter | null>(null);
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

  // Retractable Combat Log state
  const [isLogOpen, setIsLogOpen] = useState<boolean>(true);

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
        backrow: p.backrow.map((s) => (s ? { ...s, card: upgradeCard(s.card) } : null))
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

  // Bot automated turn loop
  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    if (gameState.phase !== 'MAIN_PHASE' || gameState.activePlayer !== 'bot') return;
    if (gameState.pendingChoiceQueue.length > 0 || gameState.pendingGuerreiroSplashDamage) return;

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
            backrow: prev.player.backrow.map((s) => (s ? { ...s } : null))
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
            backrow: prev.bot.backrow.map((s) => (s ? { ...s } : null))
          },
          pendingChoiceQueue: [...prev.pendingChoiceQueue],
          logs: [...prev.logs]
        };

        const step = executeBotTurnStep(next);
        if (!step.acted && !step.triggeredReactionWindow && next.phase === 'MAIN_PHASE') {
          addLog(next, 'bot', `Bot encerrou seu turno.`, 'info');
          advanceTurn(next);
        }
        return next;
      });
    }, 850);

    return () => clearTimeout(timer);
  }, [
    isOpen,
    isAuthenticated,
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
      backrow: prev.player.backrow.map((s) => (s ? { ...s } : null))
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
      backrow: prev.bot.backrow.map((s) => (s ? { ...s } : null))
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
        sendCardToDeadOrErasedZone(next, 'player', card);
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
        sendCardToDeadOrErasedZone(next, 'player', heroCard);
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
        next.player.deadZone.push(card);

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

        // Check if Bot counter-chains on top of Player's Selamento Verdadeiro!
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

      if (rw.type === 'ATTACK_DECLARED') {
        const effCt = getEffectiveCt(next.player, card);
        const authorityCt = getCardAuthorityCt(next.player, card);
        next.player.mana -= effCt;
        next.player.hand.splice(handIdx, 1);
        next.player.deadZone.push(card);

        const executePlayerCombatReactionEffect = (activeState: DuelGameState) => {
          if (card.code === '2025/0001/00024') {
            const defFighter = activeState.player.frontline[chosenSlot];
            if (defFighter) {
              activeState.player.frontline[chosenSlot] = null;
              for (const eq of defFighter.equipments) {
                activeState.player.deadZone.push(eq.card);
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
              activeState.bot.frontline[rw.attackerSlot]!.hasAttackedThisTurn = true;
              activeState.bot.hasAttackedInCurrentTurn = true;
            }
            return;
          }

          if (card.code === '2025/0001/00028') {
            if (rw.attackerSlot !== undefined && activeState.bot.frontline[rw.attackerSlot]) {
              activeState.bot.frontline[rw.attackerSlot]!.hasAttackedThisTurn = true;
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

        // Check if Bot chains a counter-negation on top of Player's Combat Reaction!
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

      const myCt = getEffectiveCt(next.player, card);
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
      card.code === '2025/0001/00027'
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

    if (
      card.code === '2025/0001/00018' ||
      card.code === '2025/0001/00022' ||
      card.code === '2025/0001/00026' ||
      card.code === '2025/0001/00030' ||
      (!doesCardNeedSlotSelection(card, false) && card.type === 'Efeito')
    ) {
      executePlayerCardPlay(idx, 0);
      return;
    }

    setSelectedHandIndex(idx);
  };

  // Click on Player Frontline Slot (0..5)
  const handlePlayerFrontSlotClick = (slotIndex: number) => {
    const slotFighter = gameState.player.frontline[slotIndex];

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
            reactCard.code === '2025/0001/00027') &&
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
        (card.code === '2025/0001/00021' || card.code === '2025/0001/00027') &&
        slotFighter === null
      ) {
        executePlayerCardPlay(selectedHandIndex, slotIndex);
        return;
      }
    }

    if (slotFighter) {
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
    if (gameState.phase === 'CARD_REACTION' && pendingReactionHandIndex !== null) {
      const reactCard = gameState.player.hand[pendingReactionHandIndex];
      if (!reactCard) return;

      if (isContinuousBackrowCard(reactCard) && gameState.player.backrow[slotIndex] === null) {
        executePlayerReactionCardOnSlot(pendingReactionHandIndex, slotIndex);
        return;
      }

      if (
        reactCard.type === 'Equipamento' &&
        !isContinuousBackrowCard(reactCard) &&
        gameState.player.frontline[slotIndex] !== null
      ) {
        handlePlayerFrontSlotClick(slotIndex);
        return;
      }
      return;
    }

    if (gameState.phase !== 'MAIN_PHASE' || gameState.activePlayer !== 'player') return;
    if (selectedHandIndex === null) return;

    const card = gameState.player.hand[selectedHandIndex];
    if (!card) return;

    if (isContinuousBackrowCard(card) && gameState.player.backrow[slotIndex] === null) {
      executePlayerCardPlay(selectedHandIndex, slotIndex);
      return;
    }

    if (
      card.type === 'Equipamento' &&
      !isContinuousBackrowCard(card) &&
      gameState.player.frontline[slotIndex] !== null
    ) {
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

    // «Salazar - Grande Mestre da Dualidade» (00183): "Uma vez por rodada, a qualquer momento, coloque em campo «Salazar - Guia dos Escolhidos» ou «Salazar - O Poderoso Líder» (podendo ter mais de um Herói em campo)."
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
          subtitle: `Deck • CT ${item.c.ct}`
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
        title: `«Busca Pela Eternidade» (Suas Runas: ${exactRuneCt} → CT = ${exactRuneCt})`,
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
          (reactCard.type === 'Efeito' && reactCard.description.toLowerCase().includes('cause')))
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
          (card.type === 'Efeito' && card.description.toLowerCase().includes('cause'))) &&
        enemyFighter
      ) {
        executePlayerCardPlay(selectedHandIndex, botSlotIndex);
        return;
      }
    }

    if (selectedAttackerSlot !== null && enemyFighter) {
      handleDeclarePlayerAttack(selectedAttackerSlot, botSlotIndex);
    }
  };

  // Declare Player Attack
  const handleDeclarePlayerAttack = (attackerSlot: number, targetSlot: number) => {
    setGameState((prev) => {
      const next = cloneState(prev);
      const attacker = next.player.frontline[attackerSlot];
      if (!attacker) return prev;

      if (next.round === 1) {
        addLog(
          next,
          'system',
          `Regra Geral: Não é permitido declarar ataques na 1ª Rodada!`,
          'info'
        );
        return next;
      }

      if (next.player.lockedFromAttackingThisTurn) {
        addLog(
          next,
          'system',
          `Regra Geral: Você já atacou e depois baixou cartas neste turno, portanto não pode declarar novos ataques.`,
          'info'
        );
        return next;
      }

      if (attacker.hasAttackedThisTurn) {
        addLog(next, 'system', `«${attacker.card.name}» já atacou neste turno!`, 'info');
        return next;
      }

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
        attacker.hasAttackedThisTurn = true;
        next.player.hasAttackedInCurrentTurn = true;
        return next;
      }

      executeCombatResolution(next, 'player', attackerSlot, targetSlot);
      return next;
    });

    setSelectedAttackerSlot(null);
  };

  const handlePassReaction = () => {
    setPendingReactionHandIndex(null);
    setTrocaFirstSlot(null);
    setSelectingSlotForHero(false);
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

      // Check if Bot counter-chains on top of Player's Jim - Mago!
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

  const availablePlayerReactions =
    (gameState.phase === 'CARD_REACTION' || gameState.phase === 'COMBAT_REACTION') &&
    gameState.reactionWindow
      ? getAvailableReactions(
          gameState,
          'player',
          gameState.reactionWindow.type,
          gameState.reactionWindow.effectiveCtOfTrigger ?? 0,
          false
        )
      : { handCards: [], canUseJimMagoFieldNegate: false, canSummonHeroJimLord: false };

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
    <div className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-xl flex flex-col overflow-hidden text-slate-100 select-none">
      {/* TOP HEADER BAR */}
      <div className="min-h-14 py-1.5 border-b border-purple-500/20 bg-slate-900/90 px-4 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-inner">
            <Bot size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display font-black text-sm tracking-wider uppercase text-white">
                Simulador Oficial • Duelo vs Bot (Nível 3)
              </span>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {gameState.playerDeckId} vs {gameState.botDeckId}
              </span>
              <span
                title="Memória Neural Adaptativa: o Bot analisa cada derrota nos 6 Pilares Universais de TCG e recalibra seus pesos matemáticos"
                className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
              >
                IA Gen #{botMemory.generation} (V:{botMemory.botWins} / D:{botMemory.botLosses})
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Rodada <strong className="text-white">{gameState.round}</strong> • Turno{' '}
              <strong className="text-white">{gameState.turnInRound}/2</strong> • Iniciativa da
              Rodada:{' '}
              <strong className="text-amber-400">
                {gameState.firstPlayerOfRound === 'player' ? 'Você' : 'Bot'}
              </strong>
            </p>
          </div>
        </div>

        {/* Deck Selectors + Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seu Deck Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-purple-500/30 rounded-lg px-2 py-1">
            <span className="text-[10px] font-black uppercase text-purple-300">Seu Deck:</span>
            <select
              value={playerDeckId}
              onChange={(e) => {
                const nextDeck = e.target.value as StructuralDeckId;
                handleRestartDuel(deckMode, nextDeck, botDeckSelection);
              }}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              {STRUCTURAL_DECK_OPTIONS.map((opt) => (
                <option key={`p_deck_${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Deck do Bot Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950/90 border border-rose-500/30 rounded-lg px-2 py-1">
            <span className="text-[10px] font-black uppercase text-rose-300">Deck Bot:</span>
            <select
              value={botDeckSelection}
              onChange={(e) => {
                const nextBotDeck = e.target.value as BotDeckSelection;
                handleRestartDuel(deckMode, playerDeckId, nextBotDeck);
              }}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              <option value="random" className="bg-slate-900 text-amber-300">
                🎲 Aleatório (Qualquer Estrutural)
              </option>
              {STRUCTURAL_DECK_OPTIONS.map((opt) => (
                <option key={`b_deck_${opt.id}`} value={opt.id} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {(() => {
            const h = evaluateBoardHeuristic(gameState);
            const scoreColor =
              h.score0to100 >= 60
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                : h.score0to100 <= 40
                ? 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                : 'bg-amber-950/70 border-amber-500/40 text-amber-300';
            return (
              <div
                className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-black ${scoreColor}`}
                title={`Avaliação Matemática do Bot: ${h.score0to100}/100 (Δ ${h.rawDelta > 0 ? '+' : ''}${h.rawDelta} pts)\nBot: ${h.botBreakdown.totalRawPoints} pts (Campo ${h.botBreakdown.boardFightersScore}, Zona Apagada ${h.botBreakdown.erasedZoneSynergyScore}, Combos ${h.botBreakdown.comboSynergyBonus})\nVocê: ${h.playerBreakdown.totalRawPoints} pts\nPostura IA: ${h.posture}`}
              >
                <span>Heurística IA: {h.score0to100}/100</span>
                <span className="opacity-75 text-[10px]">({h.posture})</span>
              </div>
            );
          })()}

          <button
            onClick={() => setShowRulesModal(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <HelpCircle size={14} className="text-purple-400" />
            <span className="hidden sm:inline">Regras</span>
          </button>

          <button
            onClick={() => handleRestartDuel(deckMode, playerDeckId, botDeckSelection)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <RotateCcw size={14} />
            <span className="hidden sm:inline">Reiniciar</span>
          </button>

          <button
            onClick={() => setIsLogOpen((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors ${
              isLogOpen
                ? 'bg-purple-600/20 border-purple-500/40 text-purple-200 hover:bg-purple-600/30'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title={isLogOpen ? 'Recolher Log do Duelo' : 'Abrir Log do Duelo'}
          >
            {isLogOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
            <span className="hidden sm:inline">{isLogOpen ? 'Ocultar Log' : 'Ver Log'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
            title="Fechar Simulador"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* MAIN DUEL TABLE + RETRACTABLE LOG SIDEBAR */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT / CENTER: THE BATTLEFIELD */}
        <div className="flex-1 flex flex-col justify-between p-2 sm:p-3 overflow-y-auto bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-950/20 via-slate-950 to-slate-950 relative">
          {/* ============================================================
              BOT STATUS BAR & ZONES (TOP)
             ============================================================ */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-rose-950 border border-rose-500/40 flex items-center justify-center text-rose-400 font-black text-xs">
                  IA
                </div>
                {gameState.activePlayer === 'bot' && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-ping" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs sm:text-sm text-white">
                    {gameState.bot.name}
                  </span>
                  {gameState.activePlayer === 'bot' && (
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Jogando...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs mt-0.5">
                  <span className="flex items-center gap-1 text-rose-400 font-black">
                    <Heart size={13} className="fill-rose-500 text-rose-500" />
                    {gameState.bot.hp} PV
                  </span>
                  <span className="flex items-center gap-1 text-cyan-400 font-black">
                    <Zap size={13} className="fill-cyan-400 text-cyan-400" />
                    {gameState.bot.mana} Mana
                  </span>
                  <span className="flex items-center gap-1 text-amber-300 font-bold">
                    <Sparkles size={12} />
                    {gameState.bot.runes} Runas
                  </span>
                </div>
              </div>
            </div>

            {/* Bot Zones & Direct Attack Button */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {canDirectAttackBot && (
                <button
                  onClick={() => handleDeclarePlayerAttack(selectedAttackerSlot!, -1)}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/30 animate-pulse flex items-center gap-1.5"
                >
                  <Swords size={14} />
                  Ataque Direto ao Bot!
                </button>
              )}

              <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                Mão: <strong className="text-white">{gameState.bot.hand.length}</strong>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                Deck: <strong className="text-white">{gameState.bot.deck.length}</strong>
              </div>
              <button
                onClick={() =>
                  setZoneViewer({
                    title: `Zona Morta do Bot (${gameState.bot.deadZone.length})`,
                    cards: gameState.bot.deadZone
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1 transition-colors"
              >
                <Skull size={12} className="text-slate-400" />
                Morta: <strong className="text-white">{gameState.bot.deadZone.length}</strong>
              </button>
              <button
                onClick={() =>
                  setZoneViewer({
                    title: `Zona Apagada do Bot (${gameState.bot.erasedZone.length} cartas | ${countJimsInErasedZone(
                      gameState.bot
                    )} «Jim»)`,
                    cards: gameState.bot.erasedZone
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/40 text-[11px] text-purple-200 flex items-center gap-1 transition-colors"
              >
                <Flame size={12} className="text-purple-400" />
                Apagada: <strong className="text-white">{gameState.bot.erasedZone.length}</strong> (
                {countJimsInErasedZone(gameState.bot)} Jim)
              </button>
            </div>
          </div>

          {/* ============================================================
              BOT BACKROW (6 Support Zones) & FRONTLINE (6 Fighter Zones)
             ============================================================ */}
          <div className="space-y-1.5 my-1">
            {/* Bot Backrow (Support & Equipped Items) */}
            <div className="grid grid-cols-6 gap-1.5">
              {gameState.bot.backrow.map((sup, idx) => {
                const botFrontFighter = gameState.bot.frontline[idx];
                const botEquips = botFrontFighter?.equipments ?? [];
                const hasContent = sup !== null || botEquips.length > 0;

                return (
                  <div
                    key={`bot_back_${idx}`}
                    onClick={() => {
                      if (sup) setInspectedCard(sup.card);
                      else if (botEquips.length > 0) setInspectedCard(botEquips[0].card);
                    }}
                    className={`h-14 rounded-lg border flex items-center justify-center p-1 text-center transition-all overflow-hidden relative ${
                      hasContent
                        ? 'bg-indigo-950/60 border-indigo-500/50 cursor-pointer hover:border-indigo-400'
                        : 'bg-slate-900/30 border-slate-800/60 text-slate-600'
                    }`}
                  >
                    {hasContent ? (
                      <div className="flex items-center gap-1 w-full px-0.5 overflow-x-auto">
                        {sup && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectedCard(sup.card);
                            }}
                            className="flex items-center gap-1 min-w-0 flex-1"
                            title={`Suporte: ${sup.card.name}`}
                          >
                            {getModernImage(sup.card) && (
                              <img
                                src={getModernImage(sup.card)}
                                alt={sup.card.name}
                                className="w-7 h-10 object-cover rounded border border-indigo-400/50 shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1 text-left">
                              <span className="text-[8px] font-black uppercase text-indigo-200 truncate block">
                                {sup.card.name}
                              </span>
                              <span className="text-[7px] text-slate-400 block">Efeito</span>
                            </div>
                          </div>
                        )}
                        {botEquips.map((eq) => {
                          const eqImg = getModernImage(eq.card);
                          return (
                            <div
                              key={eq.instanceId}
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectedCard(eq.card);
                              }}
                              className="flex items-center gap-1 min-w-0 flex-1 bg-amber-950/40 border border-amber-500/40 rounded p-0.5"
                              title={`Equipado em ${botFrontFighter?.card.name}: ${eq.card.name}`}
                            >
                              {eqImg && (
                                <img
                                  src={eqImg}
                                  alt={eq.card.name}
                                  className="w-7 h-10 object-cover rounded border border-amber-400/60 shrink-0"
                                />
                              )}
                              <div className="min-w-0 flex-1 text-left">
                                <span className="text-[8px] font-black uppercase text-amber-200 truncate block">
                                  {eq.card.name}
                                </span>
                                <span className="text-[7px] text-amber-300/80 block">
                                  🛡️ Equip.
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[9px] uppercase font-bold tracking-wider">
                        Sup {idx + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bot Frontline (6 Fighters) */}
            <div className="grid grid-cols-6 gap-1.5">
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
                const effArchs = fighter ? getEffectiveArchetypes(gameState, fighter) : [];
                const imgUrl = fighter ? getModernImage(fighter.card) : undefined;

                return (
                  <div
                    key={`bot_front_${idx}`}
                    onClick={() => handleBotFrontSlotClick(idx)}
                    className={`h-32 sm:h-36 rounded-xl border p-1.5 flex flex-col justify-between relative overflow-hidden transition-all ${
                      fighter
                        ? isAttackTargetable || isVingancaTargetable || isGuerreiroSplashTarget
                          ? 'bg-rose-950/80 border-rose-400 ring-2 ring-rose-500/70 cursor-pointer scale-[1.02]'
                          : 'bg-slate-900/95 border-rose-500/40 hover:border-rose-400 cursor-pointer'
                        : 'bg-slate-900/30 border-slate-800/70 text-slate-600 items-center justify-center'
                    }`}
                  >
                    {fighter ? (
                      <>
                        {imgUrl && (
                          <div className="absolute inset-0 opacity-30 pointer-events-none">
                            <img
                              src={imgUrl}
                              alt={fighter.card.name}
                              className="w-full h-full object-cover object-top"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/30" />
                          </div>
                        )}

                        <div className="relative z-10 flex items-start justify-between gap-1">
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase truncate ${
                              fighter.isHero
                                ? 'bg-amber-500/30 text-amber-200 border border-amber-400/50'
                                : 'bg-rose-500/30 text-rose-200'
                            }`}
                          >
                            {fighter.isHero ? '👑 Herói' : `CT ${fighter.card.ct}`}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectedFighter(fighter);
                              setInspectedCard(fighter.card);
                            }}
                            className="p-0.5 rounded bg-slate-950/90 text-slate-300 hover:text-white border border-slate-700"
                            title="Inspecionar Carta"
                          >
                            <Eye size={11} />
                          </button>
                        </div>

                        <div className="relative z-10 my-auto flex items-center gap-1.5">
                          {imgUrl && (
                            <img
                              src={imgUrl}
                              alt={fighter.card.name}
                              className="w-10 h-14 object-cover rounded border border-white/20 shadow-md shrink-0 hidden sm:block"
                            />
                          )}
                          <div className="min-w-0 flex-1 text-left">
                            <p className="font-bold text-[10px] sm:text-[11px] text-white leading-tight line-clamp-2 drop-shadow">
                              {fighter.card.name}
                            </p>
                            {effArchs.length > 0 && (
                              <p className="text-[8px] text-purple-300 truncate mt-0.5">
                                [{effArchs.join('•')}]
                              </p>
                            )}
                            {fighter.equipments.length > 0 && (
                              <p className="text-[8px] text-amber-300 font-bold mt-0.5">
                                🛡️ {fighter.equipments.length} Equip.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="relative z-10 flex items-center justify-between text-[11px] font-black bg-slate-950/95 px-2 py-0.5 rounded-lg border border-slate-800">
                          <span className="text-amber-400 flex items-center gap-0.5">
                            ⚔️ {effAtk}
                          </span>
                          <span className="text-emerald-400 flex items-center gap-0.5">
                            ❤️ {fighter.currentHp}
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        Col {idx + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ============================================================
              CENTER BATTLEFIELD DIVIDER / IN-PLACE REACTION BANNER
             ============================================================ */}
          <div className="my-1 flex items-center justify-center">
            {gameState.pendingGuerreiroSplashDamage ? (
              <div className="w-full max-w-2xl px-4 py-2 rounded-xl bg-amber-950/90 border-2 border-amber-400 text-amber-100 flex items-center justify-between gap-3 shadow-lg animate-pulse">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Swords size={16} className="text-amber-300 shrink-0" />
                  <span>
                    <strong>Efeito de «Jim - Guerreiro»:</strong> Clique em qualquer combatente no
                    campo para causar <strong>5 de dano</strong>!
                  </span>
                </div>
              </div>
            ) : isReactionPhase && gameState.reactionWindow ? (
              <div className="w-full max-w-4xl px-3.5 py-2 rounded-xl bg-cyan-950/95 border-2 border-cyan-400 text-cyan-100 flex flex-wrap items-center justify-between gap-3 shadow-xl">
                <div className="flex items-center gap-2.5">
                  <Shield size={18} className="text-cyan-300 shrink-0 animate-bounce" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/30 text-cyan-200 border border-cyan-400/40">
                        {gameState.reactionWindow.isCounterChain
                          ? '⛓️ Corrente de Reação (Contra-Negação)'
                          : gameState.phase === 'COMBAT_REACTION'
                          ? 'Janela de Reação ao Ataque'
                          : 'Janela de Reação à Carta'}
                      </span>
                      <span className="text-xs font-black text-white">
                        {gameState.reactionWindow.triggerActionLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-cyan-200 mt-0.5">
                      {pendingReactionHandIndex !== null && selectedReactionCard ? (
                        trocaFirstSlot !== null ? (
                          <span>
                            Carta selecionada: <strong>«{selectedReactionCard.name}»</strong> —
                            Agora clique no <strong>2º combatente</strong> no seu campo para trocar!
                          </span>
                        ) : (
                          <span>
                            Carta selecionada: <strong>«{selectedReactionCard.name}»</strong> —
                            Agora <strong>clique diretamente na Coluna do campo</strong> onde deseja
                            invocar/aplicar!
                          </span>
                        )
                      ) : selectingSlotForHero ? (
                        <span>
                          <strong>Invocar Herói em Reação:</strong> Clique em qualquer{' '}
                          <strong>Coluna vazia (Col 1–6)</strong> no seu campo!
                        </span>
                      ) : gameState.reactionWindow.isCounterChain ? (
                        <span>
                          O Bot reagiu à sua jogada! Você pode{' '}
                          <strong className="text-amber-300 underline">
                            criar uma Corrente (Contra-Negar)
                          </strong>{' '}
                          usando uma carta destacada na mão, «Jim - Mago» no campo, ou aceitar a
                          reação do Bot:
                        </span>
                      ) : (
                        <span>
                          As cartas da sua mão que podem reagir estão{' '}
                          <strong className="text-cyan-300 underline">destacadas abaixo</strong>.
                          Clique em uma miniatura destacada na mão ou passe a reação:
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {gameState.reactionWindow.isSelamentoTrigger &&
                    (gameState.reactionWindow.selamentoDoubleLifeCost ?? 0) > 0 &&
                    gameState.player.hp >
                      (gameState.reactionWindow.selamentoDoubleLifeCost ?? 0) && (
                      <button
                        onClick={handlePayDoubleToCounterSelamento}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow border border-rose-400/50"
                      >
                        ⛓️ Anular Selamento (Pagar Dobro:{' '}
                        {gameState.reactionWindow.selamentoDoubleLifeCost} PV)
                      </button>
                    )}
                  {availablePlayerReactions.canUseJimMagoFieldNegate && (
                    <button
                      onClick={handleReactWithJimMago}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center gap-1.5 shadow"
                    >
                      <Wand2 size={14} />
                      {gameState.reactionWindow.isCounterChain
                        ? 'Contra-Negar com «Jim - Mago»'
                        : 'Negar com «Jim - Mago»'}
                    </button>
                  )}
                  {(() => {
                    const jimHeroiSlot = gameState.player.frontline.findIndex(
                      (f) => f !== null && f.card.code === '2025/0001/00007' && !f.usedOncePerRoundAbility
                    );
                    if (jimHeroiSlot === -1) return null;
                    return (
                      <button
                        onClick={() => handleActivateFieldFighterAbility(jimHeroiSlot)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow border border-emerald-400/50"
                      >
                        💚 «Jim - Herói»: +1 Vida (1x/Rodada)
                      </button>
                    );
                  })()}
                  <button
                    onClick={handlePassReaction}
                    className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-black text-xs border border-cyan-400/50 transition-colors"
                  >
                    {gameState.reactionWindow.isCounterChain
                      ? 'Não Contra-Negar (Aceitar Reação)'
                      : 'Passar Reação (Não Reagir)'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-1 rounded-full bg-slate-900/90 border border-purple-500/30 text-[11px] font-bold text-slate-300 flex items-center gap-2 shadow">
                {selectingSlotForHero ? (
                  <span className="text-amber-300 font-black">
                    👑 Invocação de Herói: Clique em qual Coluna (1 a 6) deseja posicionar o seu
                    Herói!
                  </span>
                ) : selectedHandCard ? (
                  <span className="text-purple-300">
                    Carta selecionada: <strong>«{selectedHandCard.name}»</strong> — Clique na Coluna
                    correspondente do campo para jogar!
                  </span>
                ) : selectedAttackerSlot !== null ? (
                  <span className="text-amber-300">
                    Atacante selecionado na Coluna {selectedAttackerSlot + 1} — Clique em um
                    combatente inimigo {canDirectAttackBot ? 'ou em "Ataque Direto"' : ''}!
                  </span>
                ) : (
                  <span>
                    ⬆️ Colunas Alinhadas (1 a 6) — Arquétipo <strong>[Véu]</strong> anula arquétipos
                    do combatente na mesma coluna ⬆️
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ============================================================
              PLAYER FRONTLINE (6 Fighter Zones) & BACKROW (6 Support Zones)
             ============================================================ */}
          <div className="space-y-1.5 my-1">
            {/* Player Frontline */}
            <div className="grid grid-cols-6 gap-1.5">
              {gameState.player.frontline.map((fighter, idx) => {
                const isSelectedAttacker = selectedAttackerSlot === idx;

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
                const effArchs = fighter ? getEffectiveArchetypes(gameState, fighter) : [];
                const imgUrl = fighter ? getModernImage(fighter.card) : undefined;

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
                  [...gameState.player.heroDeck, ...gameState.player.deadZone, ...gameState.player.erasedZone].some(
                    (c) => c.code === '2025/0001/00181' || c.code === '2025/0001/00182'
                  );

                const canUseAnytimeAbility =
                  fighter &&
                  ((fighter.card.code === '2025/0001/00007' && !fighter.usedOncePerRoundAbility) ||
                    canUseSalazarSwap ||
                    canUseMestreDualidadeSummon ||
                    (fighter.card.code === '2025/0001/00001' &&
                      !fighter.jimLordTier9GemUsedThisRound &&
                      countJimsInErasedZone(gameState.player) >= 9));

                return (
                  <div
                    key={`player_front_${idx}`}
                    onClick={() => handlePlayerFrontSlotClick(idx)}
                    className={`h-32 sm:h-36 rounded-xl border p-1.5 flex flex-col justify-between relative overflow-hidden transition-all cursor-pointer ${
                      fighter
                        ? isSelectedAttacker
                          ? 'bg-amber-950/70 border-amber-400 ring-2 ring-amber-400/70 scale-[1.02]'
                          : isEquipOrAllyTargetMain || isHeroSlotTarget || isReactionSlotTarget
                          ? 'bg-cyan-950/70 border-cyan-400 ring-2 ring-cyan-400/80 scale-[1.02]'
                          : 'bg-slate-900/95 border-purple-500/40 hover:border-purple-400'
                        : isSummonTargetMain || isHeroSlotTarget || isReactionSlotTarget
                        ? 'bg-emerald-950/50 border-emerald-400 border-dashed ring-2 ring-emerald-400/60 items-center justify-center animate-pulse'
                        : 'bg-slate-900/30 border-slate-800/70 text-slate-600 items-center justify-center'
                    }`}
                  >
                    {fighter ? (
                      <>
                        {imgUrl && (
                          <div className="absolute inset-0 opacity-30 pointer-events-none">
                            <img
                              src={imgUrl}
                              alt={fighter.card.name}
                              className="w-full h-full object-cover object-top"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/30" />
                          </div>
                        )}

                        <div className="relative z-10 flex items-start justify-between gap-1">
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase truncate ${
                              fighter.isHero
                                ? 'bg-amber-500/30 text-amber-200 border border-amber-400/50'
                                : 'bg-purple-500/30 text-purple-200'
                            }`}
                          >
                            {fighter.isHero ? '👑 Herói' : `CT ${fighter.card.ct}`}
                          </span>
                          <div className="flex items-center gap-1">
                            {fighter.hasAttackedThisTurn && (
                              <span
                                className="text-[8px] px-1 rounded bg-slate-800 text-slate-400"
                                title="Já atacou neste turno"
                              >
                                Atacou
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectedFighter(fighter);
                                setInspectedCard(fighter.card);
                              }}
                              className="p-0.5 rounded bg-slate-950/90 text-slate-300 hover:text-white border border-slate-700"
                              title="Inspecionar Carta"
                            >
                              <Eye size={11} />
                            </button>
                          </div>
                        </div>

                        <div className="relative z-10 my-auto flex items-center gap-1.5">
                          {imgUrl && (
                            <img
                              src={imgUrl}
                              alt={fighter.card.name}
                              className="w-10 h-14 object-cover rounded border border-white/20 shadow-md shrink-0 hidden sm:block"
                            />
                          )}
                          <div className="min-w-0 flex-1 text-left">
                            <p className="font-bold text-[10px] sm:text-[11px] text-white leading-tight line-clamp-2 drop-shadow">
                              {fighter.card.name}
                            </p>
                            {effArchs.length > 0 && (
                              <p className="text-[8px] text-purple-300 truncate mt-0.5">
                                [{effArchs.join('•')}]
                              </p>
                            )}
                            {fighter.equipments.length > 0 && (
                              <p className="text-[8px] text-amber-300 font-bold truncate mt-0.5">
                                🛡️ {fighter.equipments.map((e) => e.card.name).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>

                        {canUseAnytimeAbility && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActivateFieldFighterAbility(idx);
                            }}
                            className={`relative z-10 w-full py-0.5 mb-0.5 rounded font-black text-[9px] uppercase tracking-wider transition-colors ${
                              fighter.card.code === '2025/0001/00007'
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            }`}
                          >
                            {fighter.card.code === '2025/0001/00007'
                              ? '💚 +1 Vida (1x/Rodada)'
                              : canUseSalazarSwap
                              ? '👑 Trocar Salazar (+1 Runa)'
                              : canUseMestreDualidadeSummon
                              ? '👑 Invocar Guia/Líder (1x/Rodada)'
                              : '⚡ Buscar Gema [9+ Jim]'}
                          </button>
                        )}

                        <div className="relative z-10 flex items-center justify-between text-[11px] font-black bg-slate-950/95 px-2 py-0.5 rounded-lg border border-slate-800">
                          <span className="text-amber-400 flex items-center gap-0.5">
                            ⚔️ {effAtk}
                          </span>
                          <span className="text-emerald-400 flex items-center gap-0.5">
                            ❤️ {fighter.currentHp}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider block">
                          Col {idx + 1}
                        </span>
                        {(isSummonTargetMain || isHeroSlotTarget || isReactionSlotTarget) && (
                          <span className="text-[9px] text-emerald-300 font-black uppercase">
                            Clique p/ Invocar
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Player Backrow (6 Support & Equipment Zones) */}
            <div className="grid grid-cols-6 gap-1.5">
              {gameState.player.backrow.map((sup, idx) => {
                const frontFighter = gameState.player.frontline[idx];
                const equippedList = frontFighter?.equipments ?? [];
                const hasContent = sup !== null || equippedList.length > 0;

                const isSupportTarget =
                  ((gameState.phase === 'MAIN_PHASE' &&
                    selectedHandCard &&
                    isContinuousBackrowCard(selectedHandCard)) ||
                    (gameState.phase === 'CARD_REACTION' &&
                      selectedReactionCard &&
                      isContinuousBackrowCard(selectedReactionCard))) &&
                  sup === null;

                const isEquipSupportTarget =
                  frontFighter !== null &&
                  ((gameState.phase === 'MAIN_PHASE' &&
                    selectedHandCard?.type === 'Equipamento' &&
                    !isContinuousBackrowCard(selectedHandCard)) ||
                    (gameState.phase === 'CARD_REACTION' &&
                      selectedReactionCard?.type === 'Equipamento' &&
                      !isContinuousBackrowCard(selectedReactionCard)));

                const canUseBusca =
                  sup &&
                  sup.card.code === '2025/0001/00017' &&
                  !sup.usedOncePerRound &&
                  gameState.player.deck.some((c) => c.ct === gameState.player.runes);

                return (
                  <div
                    key={`player_back_${idx}`}
                    onClick={() => {
                      if (isSupportTarget || isEquipSupportTarget) {
                        handlePlayerSupportSlotClick(idx);
                      } else if (sup) {
                        setInspectedCard(sup.card);
                      } else if (equippedList.length > 0) {
                        setInspectedCard(equippedList[0].card);
                      } else {
                        handlePlayerSupportSlotClick(idx);
                      }
                    }}
                    className={`h-16 rounded-lg border flex items-center justify-center p-1 text-center transition-all overflow-hidden ${
                      isSupportTarget || isEquipSupportTarget
                        ? 'bg-emerald-950/60 border-emerald-400 border-dashed ring-2 ring-emerald-400/70 cursor-pointer animate-pulse'
                        : hasContent
                        ? 'bg-indigo-950/60 border-indigo-500/50 cursor-pointer hover:border-indigo-400'
                        : 'bg-slate-900/30 border-slate-800/60 text-slate-600'
                    }`}
                  >
                    {hasContent ? (
                      <div className="flex items-center gap-1 w-full px-0.5 overflow-x-auto">
                        {sup && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isSupportTarget || isEquipSupportTarget) {
                                handlePlayerSupportSlotClick(idx);
                              } else {
                                setInspectedCard(sup.card);
                              }
                            }}
                            className="flex items-center gap-1.5 min-w-0 flex-1"
                            title={`Efeito Contínuo: ${sup.card.name}`}
                          >
                            {getModernImage(sup.card) && (
                              <img
                                src={getModernImage(sup.card)}
                                alt={sup.card.name}
                                className="w-8 h-11 object-cover rounded border border-indigo-400/50 shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1 text-left">
                              <span className="text-[9px] font-black uppercase text-indigo-200 truncate block">
                                {sup.card.name}
                              </span>
                              {canUseBusca ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleActivateBuscaEternidade(idx);
                                  }}
                                  className="mt-0.5 px-1.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[8px] uppercase"
                                >
                                  Buscar (CT {gameState.player.runes})
                                </button>
                              ) : (
                                <span className="text-[8px] text-slate-400 block">
                                  {sup.card.code === '2025/0001/00017'
                                    ? sup.usedOncePerRound
                                      ? 'Usado na rodada'
                                      : `Runas: ${gameState.player.runes}`
                                    : 'Efeito Ativo'}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {equippedList.map((eq) => {
                          const eqImg = getModernImage(eq.card);
                          return (
                            <div
                              key={eq.instanceId}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isEquipSupportTarget) {
                                  handlePlayerSupportSlotClick(idx);
                                } else {
                                  setInspectedCard(eq.card);
                                }
                              }}
                              className="flex items-center gap-1 min-w-0 flex-1 bg-amber-950/50 border border-amber-500/50 rounded p-0.5"
                              title={`Equipado em «${frontFighter?.card.name}»: ${eq.card.name}`}
                            >
                              {eqImg && (
                                <img
                                  src={eqImg}
                                  alt={eq.card.name}
                                  className="w-8 h-11 object-cover rounded border border-amber-400/70 shrink-0"
                                />
                              )}
                              <div className="min-w-0 flex-1 text-left">
                                <span className="text-[8px] font-black uppercase text-amber-200 truncate block">
                                  {eq.card.name}
                                </span>
                                <span className="text-[7px] text-amber-300 font-bold truncate block">
                                  🛡️ Equipado
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center">
                        <span className="text-[9px] uppercase font-bold tracking-wider block">
                          Sup {idx + 1}
                        </span>
                        {(isSupportTarget || isEquipSupportTarget) && (
                          <span className="text-[8px] text-emerald-300 font-black uppercase block">
                            {isEquipSupportTarget ? 'Equipar' : 'Ativar'}
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
              PLAYER STATUS BAR, HERO MINIATURE & HAND MINIATURES (BOTTOM)
             ============================================================ */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-2.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Player Stats */}
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-300 font-black text-xs">
                  <Heart size={14} className="fill-rose-500 text-rose-500" />
                  {gameState.player.hp} PV
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-black text-xs">
                  <Zap size={14} className="fill-cyan-400 text-cyan-400" />
                  {gameState.player.mana} Mana
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-500/30 text-amber-300 font-bold text-xs">
                  <Sparkles size={13} />
                  {gameState.player.runes} Runas
                </div>
                {gameState.player.ctReductionThisRound > 0 && (
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-black">
                    -{gameState.player.ctReductionThisRound} CT nesta rodada
                  </span>
                )}
              </div>

              {/* Player Zones & Hero Summon (Enforcing Official Requirements per Hero) & End Turn */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {gameState.player.heroDeck.length > 0 &&
                  (() => {
                    const isAnytimeWindow =
                      isReactionPhase || gameState.phase === 'PRE_DRAW_WINDOW';
                    const summonableHero = gameState.player.heroDeck.find(
                      (h) => canSummonHeroDirectly(gameState, 'player', h, isAnytimeWindow).allowed
                    );
                    const displayHero = summonableHero || gameState.player.heroDeck[0];
                    const heroCheck = canSummonHeroDirectly(
                      gameState,
                      'player',
                      displayHero,
                      isAnytimeWindow
                    );
                    const canClickSummon =
                      heroCheck.allowed &&
                      (isAnytimeWindow ||
                        (gameState.phase === 'MAIN_PHASE' &&
                          gameState.activePlayer === 'player'));

                    return (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (!canClickSummon) {
                              if (gameState.player.heroDeck.length > 1) {
                                setZoneViewer({
                                  title: `Sua Zona do Herói (${gameState.player.heroDeck.length} Heróis)`,
                                  cards: gameState.player.heroDeck
                                });
                              } else {
                                setInspectedFighter(null);
                                setInspectedCard(displayHero);
                              }
                              return;
                            }
                            setSelectedHandIndex(null);
                            setSelectedAttackerSlot(null);
                            setPendingReactionHandIndex(null);
                            setSelectedHeroCodeToSummon(displayHero.code);
                            setSelectingSlotForHero((prev) => !prev);
                          }}
                          className={`px-3 py-1 rounded-lg font-black text-xs flex items-center gap-2 shadow-lg transition-all ${
                            selectingSlotForHero
                              ? 'bg-emerald-500 text-slate-950 ring-2 ring-white'
                              : canClickSummon && isReactionPhase
                              ? 'bg-gradient-to-r from-cyan-400 to-amber-400 text-slate-950 ring-2 ring-cyan-300 animate-pulse'
                              : canClickSummon
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-amber-500/20'
                              : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700'
                          }`}
                          title={
                            canClickSummon
                              ? `Invocar «${displayHero.name}» (${heroCheck.badgeText})`
                              : `${displayHero.name} — ${
                                  heroCheck.reason || 'Aguardando seu turno ou requisito'
                                } (Clique para inspecionar)`
                          }
                        >
                          {getModernImage(displayHero) && (
                            <img
                              src={getModernImage(displayHero)}
                              alt="Herói"
                              className="w-5 h-7 object-cover rounded border border-slate-900"
                            />
                          )}
                          {canClickSummon ? <Crown size={14} /> : <Lock size={13} />}
                          {selectingSlotForHero
                            ? 'Cancelar Seleção de Coluna'
                            : canClickSummon
                            ? `Invocar «${displayHero.name}» (${heroCheck.badgeText})`
                            : `Herói (${gameState.player.heroDeck.length}): ${heroCheck.badgeText}`}
                        </button>
                        {gameState.player.heroDeck.length > 1 && (
                          <button
                            onClick={() =>
                              setZoneViewer({
                                title: `Sua Zona do Herói (${gameState.player.heroDeck.length} Heróis)`,
                                cards: gameState.player.heroDeck
                              })
                            }
                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-amber-500/40 text-amber-300"
                            title="Ver todos os Heróis na sua Zona do Herói e seus requisitos"
                          >
                            <Eye size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })()}

                <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                  Deck: <strong className="text-white">{gameState.player.deck.length}</strong>
                </div>

                <button
                  onClick={() =>
                    setZoneViewer({
                      title: `Sua Zona Morta (${gameState.player.deadZone.length})`,
                      cards: gameState.player.deadZone
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1 transition-colors"
                >
                  <Skull size={12} className="text-slate-400" />
                  Morta: <strong className="text-white">{gameState.player.deadZone.length}</strong>
                </button>

                <button
                  onClick={() =>
                    setZoneViewer({
                      title: `Sua Zona Apagada (${
                        gameState.player.erasedZone.length
                      } cartas | ${countJimsInErasedZone(gameState.player)} «Jim»)`,
                      cards: gameState.player.erasedZone
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/40 text-[11px] text-purple-200 flex items-center gap-1 transition-colors"
                >
                  <Flame size={12} className="text-purple-400" />
                  Apagada:{' '}
                  <strong className="text-white">{gameState.player.erasedZone.length}</strong> (
                  {countJimsInErasedZone(gameState.player)} Jim)
                </button>

                {gameState.phase === 'MAIN_PHASE' && gameState.activePlayer === 'player' && (
                  <button
                    onClick={handleEndPlayerTurn}
                    className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 transition-all"
                  >
                    Passar Turno
                  </button>
                )}
              </div>
            </div>

            {/* PLAYER HAND MINIATURES (MODERNO FRAME THUMBNAILS VISIBLE!) */}
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 pt-2 px-1">
              {gameState.player.hand.length === 0 ? (
                <div className="w-full py-4 text-center text-xs text-slate-500 italic">
                  Sua mão está vazia.
                </div>
              ) : (
                gameState.player.hand.map((card, idx) => {
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
                      className={`group w-28 sm:w-32 shrink-0 rounded-xl border overflow-hidden transition-all relative flex flex-col bg-slate-950 ${
                        isSelected
                          ? 'border-amber-400 ring-2 ring-amber-400 -translate-y-2.5 shadow-2xl shadow-amber-500/30 cursor-pointer'
                          : isPlayableInReaction
                          ? 'border-cyan-400 ring-2 ring-cyan-400 -translate-y-2 shadow-xl shadow-cyan-500/30 cursor-pointer animate-pulse'
                          : isPlayableInMain
                          ? 'border-purple-500/50 hover:border-purple-400 hover:-translate-y-1.5 shadow-lg cursor-pointer'
                          : 'border-slate-800 opacity-55 cursor-not-allowed'
                      }`}
                    >
                      {/* Reaction Badge */}
                      {isPlayableInReaction && (
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950 font-black text-[8px] uppercase tracking-wider shadow-md whitespace-nowrap">
                          ⚡ Reagir
                        </div>
                      )}

                      {/* Moderno Card Miniature Image */}
                      <div className="relative w-full aspect-[704/987] bg-slate-900 overflow-hidden">
                        {modernImg ? (
                          <img
                            src={modernImg}
                            alt={card.name}
                            className="w-full h-full object-cover select-none pointer-events-none group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 p-2 text-center">
                            {card.name}
                          </div>
                        )}

                        {/* Top-left CT pill & Top-right Inspect Eye */}
                        <div className="absolute top-1.5 inset-x-1.5 flex items-center justify-between z-10">
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-950/90 backdrop-blur-sm text-cyan-300 border border-cyan-500/40 font-black text-[10px] shadow">
                            CT {effCt}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectedFighter(null);
                              setInspectedCard(card);
                            }}
                            className="p-1 rounded-md bg-slate-950/90 backdrop-blur-sm text-slate-200 hover:text-white border border-white/15 shadow"
                            title="Ampliar Carta (Frame Moderno)"
                          >
                            <Eye size={12} />
                          </button>
                        </div>

                        {/* Bottom overlay with Card Name & ATK/HP */}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent pt-4 pb-1.5 px-1.5">
                          <p className="font-bold text-[10px] text-white truncate text-center drop-shadow">
                            {card.name}
                          </p>
                          {card.type === 'Combatente' || card.type === 'Herói' ? (
                            <div className="flex items-center justify-between text-[10px] font-black mt-0.5 px-1">
                              <span className="text-amber-400">⚔️ {card.attack}</span>
                              <span className="text-emerald-400">❤️ {card.defense}</span>
                            </div>
                          ) : (
                            <p className="text-[8px] font-bold uppercase text-purple-300 text-center">
                              {card.type}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ============================================================
            RIGHT SIDEBAR: RETRACTABLE COLOR-CODED COMBAT LOG
           ============================================================ */}
        <div
          className={`border-l border-slate-800 bg-slate-900/95 flex flex-col shrink-0 transition-all duration-300 overflow-hidden ${
            isLogOpen ? 'w-72 sm:w-80' : 'w-0 border-l-0'
          }`}
        >
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScrollText size={16} className="text-purple-400" />
              <span className="font-display font-bold text-xs uppercase tracking-wider text-white">
                Log do Duelo
              </span>
            </div>
            <button
              onClick={() => setIsLogOpen(false)}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
              title="Recolher Log"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="px-2.5 py-1.5 border-b border-slate-800/80 bg-slate-950/60 flex flex-wrap gap-1">
            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
              💔 Vida -
            </span>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              💚 Vida +
            </span>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
              ⚔️ Ataque
            </span>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              🛡️ Reação
            </span>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
              ✨ Invocação
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2 text-xs">
            {gameState.logs.map((entry) => {
              const style = getLogStyle(entry.type);
              return (
                <div
                  key={entry.id}
                  className={`p-2 rounded-lg border leading-relaxed ${style.container}`}
                >
                  <div className="flex items-center justify-between text-[9px] font-bold uppercase mb-1">
                    <span className={`px-1.5 py-0.5 rounded border ${style.badge}`}>
                      {style.label}
                    </span>
                    <span className="opacity-75">
                      R{entry.round}•T{entry.turn} (
                      {entry.actor === 'player'
                        ? 'Você'
                        : entry.actor === 'bot'
                        ? 'Bot'
                        : 'Sistema'}
                      )
                    </span>
                  </div>
                  <p className="text-[11px] font-medium">{entry.text}</p>
                </div>
              );
            })}
          </div>
        </div>

        {!isLogOpen && (
          <button
            onClick={() => setIsLogOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-slate-900/95 hover:bg-purple-950 border border-r-0 border-purple-500/40 rounded-l-xl px-2 py-3 text-purple-300 shadow-xl flex flex-col items-center gap-1"
            title="Abrir Log do Duelo"
          >
            <ChevronLeft size={16} />
            <ScrollText size={14} />
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
          OVERLAY 2: ALL-OR-NOTHING MULLIGAN WITH MODERNO THUMBNAILS
         ============================================================ */}
      {gameState.phase === 'MULLIGAN' && (
        <div className="fixed inset-0 z-[130] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl">
            <div className="text-center">
              <h2 className="font-display font-black text-xl uppercase text-white">
                Fase de Mulligan (5 Cartas Iniciais • Frame Moderno)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Regra Oficial de Mulligan: Você deve escolher entre{' '}
                <strong className="text-emerald-400">MANTER TODAS as 5 cartas</strong> ou{' '}
                <strong className="text-amber-400">TROCAR TODAS as 5 cartas</strong> por 5 novas do
                seu Deck.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {gameState.player.hand.map((card, idx) => {
                const modernImg = getModernImage(card);
                return (
                  <div
                    key={`mulligan_${idx}`}
                    onClick={() => setInspectedCard(card)}
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
                    </div>
                    <div className="p-2 text-center bg-slate-950">
                      <p className="font-bold text-xs text-white truncate">{card.name}</p>
                      <span className="text-[10px] text-cyan-400 font-bold">
                        CT {card.ct} • {card.type}
                      </span>
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
          OVERLAY 3: INTERACTIVE CARD SELECTION MODAL WITH MODERNO THUMBNAILS
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
                Palavra-Chave Mais Forte: «A Qualquer Momento»
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
                    className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {arch}
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
          OVERLAY 5: GAME OVER MODAL
         ============================================================ */}
      {gameState.phase === 'GAME_OVER' && (
        <div className="fixed inset-0 z-[150] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-lg w-full p-6 text-center space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
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
                  ? 'Vitória Macroversal!'
                  : gameState.winner === 'bot'
                  ? 'Vitória do Bot Insanis'
                  : 'Empate!'}
              </h2>
              <p className="text-xs text-slate-300 mt-2">{gameState.winReason}</p>
            </div>

            {/* AUTÓPSIA UNIVERSAL PÓS-PARTIDA E REFORÇO HEURÍSTICO DA IA (6 PILARES TCG) */}
            <div className="text-left bg-slate-950/90 border border-cyan-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Bot size={16} className="text-cyan-400" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
                    Autópsia Universal de TCG & Aprendizado (Gen #{botMemory.generation})
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  Histórico IA: {botMemory.botWins}V / {botMemory.botLosses}D
                </span>
              </div>

              {botMemory.lastMatchAutopsy.length > 0 ? (
                <div className="space-y-2">
                  {botMemory.lastMatchAutopsy.map((entry, idx) => (
                    <div
                      key={idx}
                      className="text-[11px] bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 space-y-1 leading-relaxed"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          {entry.pillarLabel}
                        </span>
                      </div>
                      <p className="font-bold text-amber-300">{entry.title}</p>
                      <p className="text-slate-300">{entry.analysis}</p>
                      <p className="text-[10px] text-emerald-300 font-semibold">
                        ↳ Ajuste: {entry.adjustmentSummary}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-emerald-300">
                  • O Bot consolidou seus pesos táticos universais para o próximo duelo.
                </p>
              )}

              <div className="pt-1 border-t border-slate-800/80">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Matriz Universal de 6 Pilares do Bot (Salva para Qualquer Deck/Matchup):
                </p>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="bg-slate-900/80 border border-slate-800 rounded px-2 py-1 flex justify-between">
                    <span className="text-slate-400">1. Vida como Recurso:</span>
                    <strong className="text-cyan-300">
                      {botMemory.weights.lifeAsResourceCautionMultiplier.toFixed(2)}x (≥{botMemory.weights.minSafeHpForLifeCost} PV)
                    </strong>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded px-2 py-1 flex justify-between">
                    <span className="text-slate-400">2. Timing Wincon/Herói:</span>
                    <strong className="text-amber-300">
                      {Math.round(botMemory.weights.winconTimingThresholdScale * 100)}% Exigência
                    </strong>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded px-2 py-1 flex justify-between">
                    <span className="text-slate-400">3. Motor de Sinergia:</span>
                    <strong className="text-purple-300">
                      {botMemory.weights.synergyEnginePriorityMultiplier.toFixed(2)}x
                    </strong>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded px-2 py-1 flex justify-between">
                    <span className="text-slate-400">4. Interação/Remoção:</span>
                    <strong className="text-emerald-300">
                      {botMemory.weights.interactionAndRemovalDiscipline.toFixed(2)}x
                    </strong>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded px-2 py-1 flex justify-between">
                    <span className="text-slate-400">5. Tempo/Defesa Mesa:</span>
                    <strong className="text-rose-300">
                      {botMemory.weights.boardTempoAndDefenseMultiplier.toFixed(2)}x
                    </strong>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded px-2 py-1 flex justify-between">
                    <span className="text-slate-400">6. Vantagem de Cartas:</span>
                    <strong className="text-indigo-300">
                      {botMemory.weights.cardAdvantageAndDrawMultiplier.toFixed(2)}x
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handleRestartDuel(deckMode)}
                className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 flex items-center gap-2"
              >
                <RotateCcw size={15} />
                Jogar Novamente (IA Evoluída)
              </button>
              <button
                onClick={() => {
                  const fresh = resetBotAdaptiveMemory();
                  setBotMemory(fresh);
                }}
                title="Zerar aprendizado e restaurar pesos originais de fábrica"
                className="px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-[11px] uppercase border border-slate-700"
              >
                Resetar IA
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
          OVERLAY 6: CARD / FIGHTER INSPECTOR MODAL (MODERNO FRAME)
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
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                    {inspectedCard.type} • CT {inspectedCard.ct} • Frame Moderno
                  </span>
                  <h3 className="font-display font-black text-lg text-white mt-1">
                    {inspectedCard.name}
                  </h3>
                  {inspectedCard.archetype && (
                    <p className="text-xs text-purple-400 font-bold">[{inspectedCard.archetype}]</p>
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
                {inspectedCard.description}
              </p>

              {inspectedFighter && (
                <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-1 text-xs">
                  <p className="font-bold text-purple-200">Status em Campo:</p>
                  <p>
                    ATK Efetivo: <strong>{getFighterEffectiveAtk(gameState, inspectedFighter)}</strong>{' '}
                    | Vida Atual: <strong>{inspectedFighter.currentHp}</strong>
                  </p>
                  <p>
                    Arquétipos Ativos:{' '}
                    <strong>
                      {getEffectiveArchetypes(gameState, inspectedFighter).join(', ') || 'Nenhum'}
                    </strong>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          OVERLAY 7: ZONE VIEWER MODAL WITH MODERNO THUMBNAILS
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
                  const isPlayerHeroZone = zoneViewer.title.startsWith('Sua Zona do Herói');
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
                      onClick={() => setInspectedCard(c)}
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
                        {heroStatus && (
                          <div
                            className={`absolute top-1.5 inset-x-1.5 px-1.5 py-0.5 rounded text-[9px] font-black text-center shadow ${
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
                            CT {c.ct} • {c.type}
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
          OVERLAY 8: INSANIS RULES SUMMARY MODAL
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
                Regras Oficiais Programadas • Deck Insanis
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
                <strong>Vida e Mana:</strong> 20 Pontos de Vida iniciais. 12 de Mana no início de
                cada Rodada (não acumula entre rodadas). A partir do 2º turno global, ambos os
                jogadores compram 1 carta no começo de cada turno.
              </li>
              <li>
                <strong>Escolha Manual de Cartas e Colunas:</strong> Todas as cartas que enviam,
                descartam, buscam ou invocam cartas do Deck, Mão ou Zonas abrem seleção com as
                miniaturas das cartas no Frame Moderno para você escolher exatamente quais usar.
              </li>
              <li>
                <strong>Reação Direta nas Miniaturas da Mão:</strong> Quando o Bot joga uma carta ou
                declara ataque, as miniaturas das cartas da sua mão que podem reagir ficam
                destacadas com brilho ciano diretamente na mão!
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
