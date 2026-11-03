import React, { useState, useMemo, useEffect } from 'react';
import {
  GitCompare,
  Layers,
  Cloud,
  Sparkles,
  CheckCircle2,
  Eye,
  ArrowRight,
  Download,
  BarChart3,
  Shield,
  Sword,
  Zap
} from 'lucide-react';
import { CardData } from '../types';
import { cleanCardCode } from '../CardContext';
import { decodeDeckCode, getStructuralDeck, compareCardCodes } from '../deckUtils';
import { useAuth } from '../authService';
import { useSavedDecks, UserSavedDeck } from '../savedDecksService';

interface DeckComparatorProps {
  currentMainDeck: CardData[];
  currentSideDeck: CardData[];
  allCards: CardData[];
  onInspectCard: (card: CardData) => void;
  onLoadDeckIntoBuilder: (main: CardData[], side: CardData[]) => void;
}

interface ComparedDeckState {
  title: string;
  main: CardData[];
  side: CardData[];
}

const STRUCTURAL_OPTIONS = [
  'Insanis',
  'Príncipe do Macroverso',
  'Herdeiro do Caos',
  'Mechs e Mangas',
  'Mundo em Chamas',
  'Corruptor Profano',
  'O Escolhido',
  'Deusa da Lua',
  'Invasão do Caos'
];

export const DeckComparatorView: React.FC<DeckComparatorProps> = ({
  currentMainDeck,
  currentSideDeck,
  allCards,
  onInspectCard,
  onLoadDeckIntoBuilder
}) => {
  const { user } = useAuth();
  const { decks: cloudDecks } = useSavedDecks(user?.uid);

  const [deckA, setDeckA] = useState<ComparedDeckState>({
    title: 'Deck A (Em Montagem)',
    main: currentMainDeck,
    side: currentSideDeck
  });

  const [deckB, setDeckB] = useState<ComparedDeckState>(() => {
    const struct = getStructuralDeck('Insanis', allCards);
    return {
      title: 'Deck B (Estrutural: Insanis)',
      main: struct.mainDeck,
      side: struct.sideDeck
    };
  });

  const [codeInputA, setCodeInputA] = useState('');
  const [codeInputB, setCodeInputB] = useState('');

  // Se o deckA estava vazio quando abriu e o usuário tem cartas no construtor, sincroniza
  useEffect(() => {
    if (deckA.main.length === 0 && currentMainDeck.length > 0) {
      setDeckA({
        title: 'Deck Atual em Montagem',
        main: currentMainDeck,
        side: currentSideDeck
      });
    }
  }, [currentMainDeck, currentSideDeck]);

  const reconstructFromSaved = (saved: UserSavedDeck): { main: CardData[]; side: CardData[] } => {
    const mainList: CardData[] = [];
    (saved.mainDeckCodes || []).forEach((code) => {
      const cleanTarget = cleanCardCode(code).toLowerCase();
      const match =
        allCards.find((c) => !c.isVariation && cleanCardCode(c.code).toLowerCase() === cleanTarget) ||
        allCards.find((c) => cleanCardCode(c.code).toLowerCase() === cleanTarget);
      if (match) mainList.push(match);
    });
    const sideList: CardData[] = [];
    (saved.sideDeckCodes || []).forEach((code) => {
      const cleanTarget = cleanCardCode(code).toLowerCase();
      const match =
        allCards.find((c) => !c.isVariation && cleanCardCode(c.code).toLowerCase() === cleanTarget) ||
        allCards.find((c) => cleanCardCode(c.code).toLowerCase() === cleanTarget);
      if (match) sideList.push(match);
    });
    mainList.sort((a, b) => compareCardCodes(a.code, b.code));
    sideList.sort((a, b) => compareCardCodes(a.code, b.code));
    return { main: mainList, side: sideList };
  };

  const handleLoadCode = (target: 'A' | 'B') => {
    const raw = target === 'A' ? codeInputA : codeInputB;
    if (!raw.trim()) return;
    const decoded = decodeDeckCode(raw, allCards);
    if (!decoded.isValid && decoded.main.length === 0) return;

    const hero = decoded.main.find((c) => c.type === 'Herói');
    const newTitle = hero ? `Deck ${hero.name.split(' - ')[0]}` : `Deck Importado ${target}`;

    if (target === 'A') {
      setDeckA({ title: newTitle, main: decoded.main, side: decoded.side });
      setCodeInputA('');
    } else {
      setDeckB({ title: newTitle, main: decoded.main, side: decoded.side });
      setCodeInputB('');
    }
  };

  // Estatísticas e Comparação
  const analysis = useMemo(() => {
    const mapA = new Map<string, CardData>();
    deckA.main.forEach((c) => mapA.set(c.name.toLowerCase().trim(), c));

    const mapB = new Map<string, CardData>();
    deckB.main.forEach((c) => mapB.set(c.name.toLowerCase().trim(), c));

    const onlyA: CardData[] = [];
    const common: CardData[] = [];
    const onlyB: CardData[] = [];

    deckA.main.forEach((c) => {
      const key = c.name.toLowerCase().trim();
      if (mapB.has(key)) {
        common.push(c);
      } else {
        onlyA.push(c);
      }
    });

    deckB.main.forEach((c) => {
      const key = c.name.toLowerCase().trim();
      if (!mapA.has(key)) {
        onlyB.push(c);
      }
    });

    const maxLen = Math.max(deckA.main.length, deckB.main.length, 1);
    const similarityPct = Math.round((common.length / maxLen) * 100);

    const calcStats = (list: CardData[]) => {
      const counts = { Herói: 0, Combatente: 0, Equipamento: 0, Efeito: 0, Token: 0 };
      const ctCurve: number[] = Array(13).fill(0);
      let ctSum = 0;
      let atkSum = 0;
      let defSum = 0;
      let unitCount = 0;

      list.forEach((c) => {
        if (c.type in counts) counts[c.type as keyof typeof counts]++;
        const ct = Math.min(12, Math.max(0, c.ct || 0));
        ctCurve[ct]++;
        ctSum += c.ct || 0;
        if (c.type === 'Herói' || c.type === 'Combatente') {
          atkSum += c.attack || 0;
          defSum += c.defense || 0;
          unitCount++;
        }
      });

      return {
        counts,
        ctCurve,
        avgCt: list.length > 0 ? (ctSum / list.length).toFixed(1) : '0.0',
        avgAtk: unitCount > 0 ? (atkSum / unitCount).toFixed(1) : '0.0',
        avgDef: unitCount > 0 ? (defSum / unitCount).toFixed(1) : '0.0',
        hero: list.find((c) => c.type === 'Herói') || null
      };
    };

    return {
      onlyA,
      common,
      onlyB,
      similarityPct,
      statsA: calcStats(deckA.main),
      statsB: calcStats(deckB.main)
    };
  }, [deckA, deckB]);

  const renderMiniCardRow = (card: CardData, accentBorder: string) => {
    const typeBadgeColor =
      card.type === 'Herói'
        ? 'text-red-400 bg-red-950/70 border-red-700/50'
        : card.type === 'Combatente'
        ? 'text-blue-400 bg-blue-950/70 border-blue-700/50'
        : card.type === 'Equipamento'
        ? 'text-green-400 bg-green-950/70 border-green-700/50'
        : card.type === 'Token'
        ? 'text-yellow-400 bg-yellow-950/70 border-yellow-600/50'
        : 'text-purple-400 bg-purple-950/70 border-purple-700/50';

    return (
      <div
        key={`${card.code}_${card.name}`}
        onClick={() => onInspectCard(card)}
        className={`p-2 rounded-xl bg-slate-900/90 border ${accentBorder} hover:brightness-110 transition cursor-pointer flex items-center justify-between gap-2 group`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-12 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden shrink-0">
            {card.imageUrl ? (
              <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-yellow-400">
                {card.type.slice(0, 3)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition">
              {card.name}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${typeBadgeColor}`}>
                {card.type}
              </span>
              <span className="text-[10px] font-mono text-yellow-400 font-bold">CT {card.ct ?? 0}</span>
            </div>
          </div>
        </div>
        <Eye size={14} className="text-slate-500 group-hover:text-white shrink-0" />
      </div>
    );
  };

  return (
    <div className="w-full h-full overflow-y-auto p-3 sm:p-6 bg-[#0a0a0f] space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Topo Explicativo */}
        <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-cyan-950/60 border border-purple-500/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-300">
              <GitCompare size={24} />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">
                Comparador Oficial de Decks
              </h3>
              <p className="text-xs text-slate-300">
                Compare dois decks lado a lado: analise cartas em comum, diferenças exclusivas, curva de CT e proporção de tipos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl">
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                Semelhança entre as Listas
              </span>
              <span className="text-lg font-black text-emerald-400 font-mono">
                {analysis.similarityPct}% ({analysis.common.length} cartas em comum)
              </span>
            </div>
          </div>
        </div>

        {/* Seletores Lado a Lado: Deck A vs Deck B */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* SELETOR DECK A */}
          <div className="bg-slate-900/90 border border-purple-500/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-purple-600 text-white text-xs font-black">
                  DECK A
                </span>
                <h4 className="font-bold text-white text-sm truncate">{deckA.title}</h4>
              </div>
              <button
                type="button"
                disabled={deckA.main.length === 0}
                onClick={() => onLoadDeckIntoBuilder(deckA.main, deckA.side)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-purple-950 hover:bg-purple-800 text-purple-200 border border-purple-600/40 transition"
              >
                Editar no Construtor
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  setDeckA({
                    title: 'Deck Atual em Montagem',
                    main: currentMainDeck,
                    side: currentSideDeck
                  })
                }
                className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-purple-300 flex items-center justify-center gap-1.5 transition"
              >
                <Layers size={13} />
                <span>Usar Deck Atual ({currentMainDeck.length})</span>
              </button>

              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const saved = cloudDecks.find((d) => d.id === val);
                  if (saved) {
                    const rec = reconstructFromSaved(saved);
                    setDeckA({ title: saved.name, main: rec.main, side: rec.side });
                  }
                }}
                className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white outline-none"
              >
                <option value="">Meus Decks na Nuvem...</option>
                {cloudDecks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.cardCount})
                  </option>
                ))}
              </select>

              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const st = getStructuralDeck(val, allCards);
                  setDeckA({ title: `Estrutural: ${val}`, main: st.mainDeck, side: st.sideDeck });
                }}
                className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white outline-none"
              >
                <option value="">Deck Estrutural...</option>
                {STRUCTURAL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={codeInputA}
                onChange={(e) => setCodeInputA(e.target.value)}
                placeholder="Ou cole um código LDT:... para o Deck A"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={() => handleLoadCode('A')}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
              >
                Carregar
              </button>
            </div>
          </div>

          {/* SELETOR DECK B */}
          <div className="bg-slate-900/90 border border-cyan-500/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-cyan-600 text-slate-950 text-xs font-black">
                  DECK B
                </span>
                <h4 className="font-bold text-white text-sm truncate">{deckB.title}</h4>
              </div>
              <button
                type="button"
                disabled={deckB.main.length === 0}
                onClick={() => onLoadDeckIntoBuilder(deckB.main, deckB.side)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-800 text-cyan-200 border border-cyan-600/40 transition"
              >
                Editar no Construtor
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  setDeckB({
                    title: 'Deck Atual em Montagem',
                    main: currentMainDeck,
                    side: currentSideDeck
                  })
                }
                className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-cyan-300 flex items-center justify-center gap-1.5 transition"
              >
                <Layers size={13} />
                <span>Usar Deck Atual ({currentMainDeck.length})</span>
              </button>

              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const saved = cloudDecks.find((d) => d.id === val);
                  if (saved) {
                    const rec = reconstructFromSaved(saved);
                    setDeckB({ title: saved.name, main: rec.main, side: rec.side });
                  }
                }}
                className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white outline-none"
              >
                <option value="">Meus Decks na Nuvem...</option>
                {cloudDecks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.cardCount})
                  </option>
                ))}
              </select>

              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const st = getStructuralDeck(val, allCards);
                  setDeckB({ title: `Estrutural: ${val}`, main: st.mainDeck, side: st.sideDeck });
                }}
                className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white outline-none"
              >
                <option value="">Deck Estrutural...</option>
                {STRUCTURAL_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={codeInputB}
                onChange={(e) => setCodeInputB(e.target.value)}
                placeholder="Ou cole um código LDT:... para o Deck B"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => handleLoadCode('B')}
                className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-black"
              >
                Carregar
              </button>
            </div>
          </div>
        </div>

        {/* Painel de Métricas e Curva de CT Comparada */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Resumo Numérico */}
          <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <BarChart3 size={15} className="text-purple-400" />
              <span>Comparativo de Estrutura</span>
            </h4>

            <div className="space-y-2 text-xs">
              {[
                {
                  label: 'Herói Principal',
                  valA: analysis.statsA.hero?.name || 'Nenhum',
                  valB: analysis.statsB.hero?.name || 'Nenhum'
                },
                {
                  label: 'Total Principal / Side',
                  valA: `${deckA.main.length} / ${deckA.side.length}`,
                  valB: `${deckB.main.length} / ${deckB.side.length}`
                },
                {
                  label: 'Custo Médio (CT)',
                  valA: analysis.statsA.avgCt,
                  valB: analysis.statsB.avgCt
                },
                {
                  label: 'Média ATK / VIDA (Unidades)',
                  valA: `${analysis.statsA.avgAtk} ATK / ${analysis.statsA.avgDef} VIDA`,
                  valB: `${analysis.statsB.avgAtk} ATK / ${analysis.statsB.avgDef} VIDA`
                },
                {
                  label: 'Combatentes',
                  valA: analysis.statsA.counts.Combatente,
                  valB: analysis.statsB.counts.Combatente
                },
                {
                  label: 'Equipamentos',
                  valA: analysis.statsA.counts.Equipamento,
                  valB: analysis.statsB.counts.Equipamento
                },
                {
                  label: 'Cartas de Efeito',
                  valA: analysis.statsA.counts.Efeito,
                  valB: analysis.statsB.counts.Efeito
                },
                {
                  label: 'Tokens',
                  valA: analysis.statsA.counts.Token,
                  valB: analysis.statsB.counts.Token
                }
              ].map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 items-center bg-slate-950/70 border border-slate-800/80 rounded-xl px-3 py-2"
                >
                  <span className="col-span-4 font-bold text-purple-300 truncate">{row.valA}</span>
                  <span className="col-span-4 text-center text-[11px] text-slate-400 font-semibold">
                    {row.label}
                  </span>
                  <span className="col-span-4 font-bold text-cyan-300 text-right truncate">{row.valB}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Curva de CT Dupla */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                Curva de Custo (CT) Lado a Lado
              </h4>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-purple-300">
                  <span className="w-3 h-3 rounded-xs bg-purple-500 inline-block" /> Deck A
                </span>
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <span className="w-3 h-3 rounded-xs bg-cyan-400 inline-block" /> Deck B
                </span>
              </div>
            </div>

            <div className="h-48 flex items-end gap-1.5 sm:gap-2 pt-6 pb-2 px-2">
              {[...Array(13)].map((_, ctIdx) => {
                const cA = analysis.statsA.ctCurve[ctIdx] || 0;
                const cB = analysis.statsB.ctCurve[ctIdx] || 0;
                const maxVal = Math.max(
                  ...analysis.statsA.ctCurve,
                  ...analysis.statsB.ctCurve,
                  1
                );
                const hA = (cA / maxVal) * 100;
                const hB = (cB / maxVal) * 100;

                return (
                  <div key={ctIdx} className="flex-1 flex flex-col items-center h-full justify-end">
                    <div className="w-full flex-1 flex items-end justify-center gap-0.5 bg-slate-950/60 rounded-t-md p-0.5">
                      <div className="flex-1 h-full flex flex-col justify-end items-center relative">
                        {cA > 0 && (
                          <span className="text-[9px] font-mono font-bold text-purple-300 mb-0.5">
                            {cA}
                          </span>
                        )}
                        <div
                          className="w-full bg-purple-500 rounded-t-xs transition-all"
                          style={{ height: `${Math.max(cA > 0 ? 6 : 0, hA)}%` }}
                        />
                      </div>
                      <div className="flex-1 h-full flex flex-col justify-end items-center relative">
                        {cB > 0 && (
                          <span className="text-[9px] font-mono font-bold text-cyan-300 mb-0.5">
                            {cB}
                          </span>
                        )}
                        <div
                          className="w-full bg-cyan-400 rounded-t-xs transition-all"
                          style={{ height: `${Math.max(cB > 0 ? 6 : 0, hB)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 mt-1.5 border-t border-slate-800 w-full text-center pt-1">
                      {ctIdx === 12 ? '12+' : ctIdx}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3 Colunas de Cartas: Exclusivas Deck A | Núcleo em Comum | Exclusivas Deck B */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Exclusivas A */}
          <div className="bg-slate-900/70 border border-purple-500/30 rounded-2xl p-4 flex flex-col max-h-[540px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div>
                <h4 className="text-sm font-black text-purple-300 uppercase">
                  Exclusivas do Deck A
                </h4>
                <p className="text-[11px] text-slate-400">Cartas ausentes no Deck B</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-purple-950 border border-purple-500/40 text-purple-200 font-mono font-bold text-xs">
                {analysis.onlyA.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {analysis.onlyA.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-8 text-center">
                  Nenhuma carta exclusiva no Deck A.
                </p>
              ) : (
                analysis.onlyA.map((c) => renderMiniCardRow(c, 'border-purple-800/50'))
              )}
            </div>
          </div>

          {/* Em Comum */}
          <div className="bg-slate-900/70 border border-emerald-500/30 rounded-2xl p-4 flex flex-col max-h-[540px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div>
                <h4 className="text-sm font-black text-emerald-300 uppercase flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span>Cartas em Comum</span>
                </h4>
                <p className="text-[11px] text-slate-400">Núcleo compartilhado pelos dois decks</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-200 font-mono font-bold text-xs">
                {analysis.common.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {analysis.common.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-8 text-center">
                  Os dois decks não possuem cartas em comum.
                </p>
              ) : (
                analysis.common.map((c) => renderMiniCardRow(c, 'border-emerald-800/50'))
              )}
            </div>
          </div>

          {/* Exclusivas B */}
          <div className="bg-slate-900/70 border border-cyan-500/30 rounded-2xl p-4 flex flex-col max-h-[540px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div>
                <h4 className="text-sm font-black text-cyan-300 uppercase">
                  Exclusivas do Deck B
                </h4>
                <p className="text-[11px] text-slate-400">Cartas ausentes no Deck A</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-200 font-mono font-bold text-xs">
                {analysis.onlyB.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {analysis.onlyB.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-8 text-center">
                  Nenhuma carta exclusiva no Deck B.
                </p>
              ) : (
                analysis.onlyB.map((c) => renderMiniCardRow(c, 'border-cyan-800/50'))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
