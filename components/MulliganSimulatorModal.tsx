import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Shuffle,
  Plus,
  RotateCcw,
  Sparkles,
  Percent,
  Layers,
  Crown,
  Sword,
  Zap,
  Scale,
  Eye,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { CardData } from '../types';
import { CardDetailModal } from './CardDetailModal';

interface MulliganSimulatorProps {
  isOpen?: boolean;
  deck: CardData[];
  sideDeck?: CardData[];
  deckTitle?: string;
  isEmbedded?: boolean;
  onClose?: () => void;
  onInspectCard?: (card: CardData) => void;
}

/**
 * Combinatorial helper C(n, k) for exact hypergeometric probability calculations
 */
function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - i + 1)) / i;
  }
  return result;
}

/**
 * Probability of drawing at least `minSuccesses` copies when drawing `sampleSize` cards
 * from a population of `populationSize` containing `successesInPopulation` target cards.
 */
function hypergeometricAtLeast(
  populationSize: number,
  successesInPopulation: number,
  sampleSize: number,
  minSuccesses: number = 1
): number {
  if (populationSize <= 0 || successesInPopulation <= 0 || sampleSize <= 0) return 0;
  const actualSample = Math.min(sampleSize, populationSize);
  const totalWays = combinations(populationSize, actualSample);
  if (totalWays === 0) return 0;

  let probLess = 0;
  for (let x = 0; x < minSuccesses; x++) {
    const waysSuccess = combinations(successesInPopulation, x);
    const waysFail = combinations(populationSize - successesInPopulation, actualSample - x);
    probLess += (waysSuccess * waysFail) / totalWays;
  }

  return Math.max(0, Math.min(100, (1 - probLess) * 100));
}

export const MulliganSimulator: React.FC<MulliganSimulatorProps> = ({
  deck,
  sideDeck = [],
  deckTitle,
  isEmbedded = false,
  onClose
}) => {
  // Separate Heroes (which stay in the Hero Zone according to Light Dark TCG rules) vs Main Draw Deck
  const [separateHeroesFromDraw, setSeparateHeroesFromDraw] = useState(true);
  const [hand, setHand] = useState<CardData[]>([]);
  const [remainingDeck, setRemainingDeck] = useState<CardData[]>([]);
  const [hasUsedMulligan, setHasUsedMulligan] = useState(false);
  const [turnCount, setTurnCount] = useState(1);
  const [mulliganHistoryCount, setMulliganHistoryCount] = useState(0);
  const [inspectCard, setInspectCard] = useState<CardData | null>(null);
  const [selectedTargetCardName, setSelectedTargetCardName] = useState<string>('');

  const heroCards = useMemo(() => deck.filter((c) => c.type === 'Herói'), [deck]);

  const drawPool = useMemo(() => {
    if (separateHeroesFromDraw) {
      return deck.filter((c) => c.type !== 'Herói');
    }
    return [...deck];
  }, [deck, separateHeroesFromDraw]);

  // Shuffle & deal opening hand of 5 cards
  const dealOpeningHand = (isMulliganAction: boolean = false) => {
    const pool = [...drawPool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const initialFive = pool.slice(0, 5);
    const rest = pool.slice(5);

    setHand(initialFive);
    setRemainingDeck(rest);
    if (isMulliganAction) {
      setHasUsedMulligan(true);
      setMulliganHistoryCount((prev) => prev + 1);
    } else {
      setHasUsedMulligan(false);
      setTurnCount(1);
    }
  };

  useEffect(() => {
    if (drawPool.length > 0) {
      dealOpeningHand(false);
    } else {
      setHand([]);
      setRemainingDeck([]);
    }
  }, [drawPool.length, separateHeroesFromDraw]);

  const handleDrawNextCard = () => {
    if (remainingDeck.length === 0) return;
    const nextCard = remainingDeck[0];
    setHand((prev) => [...prev, nextCard]);
    setRemainingDeck((prev) => prev.slice(1));
    setTurnCount((prev) => prev + 1);
  };

  // Probability Calculations
  const probabilities = useMemo(() => {
    const N = drawPool.length;
    const combatentes = drawPool.filter((c) => c.type === 'Combatente').length;
    const efeitos = drawPool.filter((c) => c.type === 'Efeito').length;
    const equipamentos = drawPool.filter((c) => c.type === 'Equipamento').length;
    const lowCostCards = drawPool.filter((c) => (c.ct || 0) <= 4).length;

    const probCombatente5 = hypergeometricAtLeast(N, combatentes, 5, 1);
    const probCombatenteWithMulligan =
      100 - ((100 - probCombatente5) / 100) * ((100 - probCombatente5) / 100) * 100;

    const probEfeito5 = hypergeometricAtLeast(N, efeitos, 5, 1);
    const probEquip5 = hypergeometricAtLeast(N, equipamentos, 5, 1);
    const probLowCost5 = hypergeometricAtLeast(N, lowCostCards, 5, 1);

    // Specific card probability (1 copy in singleton format, or multiple if booster/custom)
    const targetCount = selectedTargetCardName
      ? drawPool.filter((c) => c.name === selectedTargetCardName).length
      : 1;

    const singleCardOpen5 = hypergeometricAtLeast(N, targetCount, 5, 1);
    const singleCardAfterMulligan =
      100 - ((100 - singleCardOpen5) / 100) * ((100 - singleCardOpen5) / 100) * 100;
    const singleCardByTurn2 = hypergeometricAtLeast(N, targetCount, 6, 1);
    const singleCardByTurn3 = hypergeometricAtLeast(N, targetCount, 7, 1);

    return {
      N,
      combatentes,
      efeitos,
      equipamentos,
      lowCostCards,
      probCombatente5,
      probCombatenteWithMulligan,
      probEfeito5,
      probEquip5,
      probLowCost5,
      singleCardOpen5,
      singleCardAfterMulligan,
      singleCardByTurn2,
      singleCardByTurn3
    };
  }, [drawPool, selectedTargetCardName]);

  // Hand evaluation summary
  const handStats = useMemo(() => {
    const totalCt = hand.reduce((acc, c) => acc + (Number(c.ct) || 0), 0);
    const combatentesInHand = hand.filter((c) => c.type === 'Combatente').length;
    const efeitosInHand = hand.filter((c) => c.type === 'Efeito').length;
    const equipInHand = hand.filter((c) => c.type === 'Equipamento').length;
    return {
      totalCt,
      combatentesInHand,
      efeitosInHand,
      equipInHand
    };
  }, [hand]);

  const content = (
    <div className="space-y-6">
      <CardDetailModal card={inspectCard} onClose={() => setInspectCard(null)} />

      {/* Top Controls Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-600/20 text-purple-300 border border-purple-500/40">
              <Sparkles size={12} />
              <span>Simulador Oficial de Mão Inicial & Mulligan</span>
            </span>
            {deckTitle && (
              <span className="text-xs font-bold text-slate-300">• {deckTitle}</span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Regra Light Dark TCG: Compra inicial de <strong className="text-white">5 cartas</strong>. Direito a <strong className="text-amber-300">1 Mulligan completo</strong> (devolve as 5 e compra 5 novas). Mana por rodada: <strong className="text-cyan-300">12 pontos</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={separateHeroesFromDraw}
              onChange={(e) => setSeparateHeroesFromDraw(e.target.checked)}
              className="accent-purple-500 w-3.5 h-3.5 rounded"
            />
            <span>Separar Herói na Zona de Herói</span>
          </label>

          <button
            type="button"
            onClick={() => dealOpeningHand(false)}
            disabled={drawPool.length === 0}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-purple-950/50"
          >
            <RotateCcw size={14} />
            <span>Nova Partida (5 Cartas)</span>
          </button>

          <button
            type="button"
            onClick={() => dealOpeningHand(true)}
            disabled={drawPool.length === 0 || hasUsedMulligan}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer ${
              hasUsedMulligan
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-950/40'
            }`}
            title="Regra de Mulligan: Retorne todas as 5 cartas e compre 5 novas uma única vez"
          >
            <Shuffle size={14} />
            <span>{hasUsedMulligan ? 'Mulligan Usado (1/1)' : 'Fazer Mulligan (1x)'}</span>
          </button>

          <button
            type="button"
            onClick={handleDrawNextCard}
            disabled={remainingDeck.length === 0}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-950/50"
          >
            <Plus size={14} />
            <span>Comprar +1 Carta (Rodada {turnCount + 1})</span>
          </button>
        </div>
      </div>

      {drawPool.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Layers size={40} className="mx-auto text-slate-600" />
          <h4 className="text-base font-bold text-white">
            Adicione cartas ao Deck para simular a Mão Inicial
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Assim que seu deck tiver cartas no Construtor, você poderá testar mãos de 5 cartas, fazer Mulligan e analisar as probabilidades de abertura.
          </p>
        </div>
      ) : (
        <>
          {/* Hero Zone + Hand Display */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Hero Zone (if separateHeroesFromDraw and heroCards.length > 0) */}
            {separateHeroesFromDraw && heroCards.length > 0 && (
              <div className="lg:col-span-3 bg-gradient-to-b from-red-950/40 to-slate-950 border border-red-500/30 rounded-2xl p-4 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between border-b border-red-500/20 pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-red-300 flex items-center gap-1.5">
                    <Crown size={14} />
                    <span>Zona de Herói ({heroCards.length})</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 text-red-200 border border-red-500/30">
                    Fora do Deck
                  </span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5 my-auto">
                  {heroCards.slice(0, 2).map((hero, idx) => (
                    <div
                      key={`${hero.code}-${idx}`}
                      onClick={() => setInspectCard(hero)}
                      className="group relative bg-black rounded-xl border border-red-500/40 overflow-hidden cursor-pointer hover:border-red-400 transition flex items-center gap-2.5 p-2"
                    >
                      {hero.imageUrl && (
                        <img
                          src={hero.imageUrl}
                          alt={hero.name}
                          referrerPolicy="no-referrer"
                          className="w-12 h-16 object-cover rounded-lg shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold text-red-400 uppercase">Herói</div>
                        <div className="text-xs font-black text-white truncate">{hero.name}</div>
                        <div className="text-[10px] font-mono text-amber-300 mt-0.5">
                          CT {hero.ct || 0} • ATK {hero.attack ?? '-'} / VIDA {hero.defense ?? '-'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-[11px] text-slate-400 leading-snug">
                  O Herói inicia em sua própria zona e não ocupa espaço nas 5 cartas compradas na mão inicial.
                </div>
              </div>
            )}

            {/* Opening Hand Cards */}
            <div
              className={`${
                separateHeroesFromDraw && heroCards.length > 0 ? 'lg:col-span-9' : 'lg:col-span-12'
              } bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <h4 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    <span>Sua Mão Atual ({hand.length} cartas)</span>
                  </h4>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-purple-300">
                    Rodada {turnCount} • Restam {remainingDeck.length} no Deck
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-950/60 border border-blue-700/40 text-blue-300 font-bold">
                    {handStats.combatentesInHand} Combatente(s)
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-700/40 text-purple-300 font-bold">
                    {handStats.efeitosInHand} Efeito(s)
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/40 text-emerald-300 font-bold">
                    {handStats.equipInHand} Equip.
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-lg font-mono font-bold border ${
                      handStats.totalCt <= 12
                        ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                        : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                    }`}
                    title="Soma do Custo (CT) de todas as cartas da mão comparado aos 12 de Mana da rodada"
                  >
                    CT Total da Mão: {handStats.totalCt} / 12 Mana
                  </span>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {hand.map((card, idx) => {
                  const isDrawnLater = idx >= 5;
                  return (
                    <div
                      key={`${card.code}-${idx}`}
                      onClick={() => setInspectCard(card)}
                      className="group relative bg-slate-950 border border-slate-800 hover:border-purple-500 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 shadow-lg flex flex-col justify-between"
                    >
                      {isDrawnLater && (
                        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black uppercase shadow">
                          Compra R{idx - 3}
                        </div>
                      )}
                      <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded bg-black/85 border border-yellow-500/40 text-yellow-400 text-[10px] font-mono font-black">
                        CT {card.ct || 0}
                      </div>

                      <div className="aspect-[3/4] bg-black overflow-hidden relative">
                        {card.imageUrl ? (
                          <img
                            src={card.imageUrl}
                            alt={card.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs p-2 text-center">
                            {card.name}
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 space-y-1 bg-slate-950">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase">
                          <span
                            className={
                              card.type === 'Combatente'
                                ? 'text-blue-400'
                                : card.type === 'Efeito'
                                ? 'text-purple-400'
                                : card.type === 'Equipamento'
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }
                          >
                            {card.type}
                          </span>
                          {(card.attack !== undefined || card.defense !== undefined) && (
                            <span className="font-mono text-slate-400">
                              {card.attack ?? 0}/{card.defense ?? 0}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-bold text-white truncate" title={card.name}>
                          {card.name}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Hypergeometric Probability Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
                  <Percent size={15} />
                  <span>Probabilidade Matemática de Abertura (5 Cartas)</span>
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  Baralho de Compra: {probabilities.N} cartas
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-300 font-bold flex items-center gap-1.5">
                      <Sword size={13} /> ≥ 1 Combatente na Mão (5 cartas)
                    </span>
                    <span className="font-mono font-black text-white text-sm">
                      {probabilities.probCombatente5.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${probabilities.probCombatente5}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 flex justify-between pt-0.5">
                    <span>{probabilities.combatentes} combatentes no deck</span>
                    <span className="text-emerald-400 font-semibold">
                      C/ Mulligan: {probabilities.probCombatenteWithMulligan.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-purple-300 font-bold flex items-center gap-1.5">
                      <Zap size={13} /> ≥ 1 Carta de Efeito (5 cartas)
                    </span>
                    <span className="font-mono font-black text-white text-sm">
                      {probabilities.probEfeito5.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500"
                      style={{ width: `${probabilities.probEfeito5}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {probabilities.efeitos} cartas de efeito no deck
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                      <Scale size={13} /> ≥ 1 Equipamento (5 cartas)
                    </span>
                    <span className="font-mono font-black text-white text-sm">
                      {probabilities.probEquip5.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${probabilities.probEquip5}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {probabilities.equipamentos} equipamentos no deck
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-300 font-bold flex items-center gap-1.5">
                      <CheckCircle2 size={13} /> ≥ 1 Carta de Custo Baixo (CT ≤ 4)
                    </span>
                    <span className="font-mono font-black text-white text-sm">
                      {probabilities.probLowCost5.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500"
                      style={{ width: `${probabilities.probLowCost5}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {probabilities.lowCostCards} cartas com CT ≤ 4 no deck
                  </div>
                </div>
              </div>
            </div>

            {/* Specific Card Draw Chance Calculator */}
            <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
              <div className="border-b border-slate-800 pb-2.5">
                <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <HelpCircle size={15} />
                  <span>Chance de Comprar uma Carta Específica</span>
                </h4>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Selecione qualquer carta do seu deck para ver a chance de comprá-la:
                </label>
                <select
                  value={selectedTargetCardName}
                  onChange={(e) => setSelectedTargetCardName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-amber-500"
                >
                  <option value="">Qualquer carta única do deck (1 cópia)</option>
                  {Array.from(new Set(drawPool.map((c) => c.name))).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-400">Na Mão Inicial (5 cartas)</div>
                  <div className="text-base font-black font-mono text-white">
                    {probabilities.singleCardOpen5.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-2.5">
                  <div className="text-[10px] text-amber-300 font-bold">
                    Buscando no Mulligan (5+5)
                  </div>
                  <div className="text-base font-black font-mono text-amber-300">
                    {probabilities.singleCardAfterMulligan.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-400">Até a Rodada 2 (6 cartas)</div>
                  <div className="text-base font-black font-mono text-emerald-400">
                    {probabilities.singleCardByTurn2.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-400">Até a Rodada 3 (7 cartas)</div>
                  <div className="text-base font-black font-mono text-cyan-300">
                    {probabilities.singleCardByTurn3.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (isEmbedded) {
    return <div className="p-3 sm:p-6 overflow-y-auto w-full">{content}</div>;
  }

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#0b0e17] border border-purple-500/40 rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shuffle size={20} className="text-purple-400" />
            <h3 className="text-base sm:text-lg font-black text-white">
              Simulador de Mão Inicial & Probabilidade {deckTitle ? `— ${deckTitle}` : ''}
            </h3>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{content}</div>
      </div>
    </div>
  );
};

export const MulliganSimulatorModal = MulliganSimulator;

