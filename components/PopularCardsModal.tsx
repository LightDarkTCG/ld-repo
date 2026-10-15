import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  X, 
  Flame, 
  Crown, 
  Sword, 
  Shield, 
  Sparkles, 
  RefreshCw, 
  Search, 
  Copy, 
  Check, 
  Eye, 
  Layers, 
  TrendingUp,
  BarChart3,
  Zap,
  Info
} from 'lucide-react';
import { CardData, CardType } from '../types';
import { 
  fetchCommunityDecks, 
  computePopularCards, 
  PopularCardStat, 
  PopularCardsReport 
} from '../popularCardsService';

interface PopularCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allCards: CardData[];
  onSelectCard?: (card: CardData) => void;
  onOpenDeckBuilder?: () => void;
}

type TabType = 'overview' | 'heroi' | 'combatente' | 'equipamento' | 'efeito';

export const PopularCardsModal: React.FC<PopularCardsModalProps> = ({
  isOpen,
  onClose,
  allCards,
  onSelectCard,
  onOpenDeckBuilder
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [report, setReport] = useState<PopularCardsReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const allCardsRef = useRef(allCards);
  allCardsRef.current = allCards;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const decks = await fetchCommunityDecks();
      const calculated = computePopularCards(decks, allCardsRef.current || []);
      setReport(calculated);
    } catch (err) {
      console.error('Erro ao calcular cartas populares:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filterCards = (list: PopularCardStat[]) => {
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(item => 
      item.card.name.toLowerCase().includes(term) ||
      (item.card.archetype && item.card.archetype.toLowerCase().includes(term)) ||
      (item.card.collection && item.card.collection.toLowerCase().includes(term)) ||
      item.code.toLowerCase().includes(term)
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-slate-950 border border-purple-500/30 w-full max-w-6xl max-h-[92vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* CABEÇALHO */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-purple-950/40 to-slate-950 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-red-950/60 shrink-0">
              <Flame size={26} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Cartas Populares
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-red-950/80 border border-red-500/50 text-red-300">
                  Últimos 30 Dias
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Top 10 cartas dos decks de contas com e-mail nos últimos 30 dias (priorizando Moldura Moderna)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-bold disabled:opacity-50"
              title="Recarregar estatísticas da comunidade"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin text-purple-400' : ''} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* BARRA DE ESTATÍSTICAS RÁPIDAS & FILTROS */}
        <div className="px-4 sm:px-6 py-3 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
            <div className="flex items-center gap-2 text-slate-300">
              <BarChart3 size={15} className="text-purple-400" />
              <span>Decks Analisados:</span>
              <strong className="text-white font-mono bg-purple-950/80 px-2 py-0.5 rounded border border-purple-500/40">
                {report ? report.totalDecksAnalyzed : '...'}
              </strong>
            </div>

            {report?.topOverallCard && (
              <div className="hidden md:flex items-center gap-2 text-slate-300">
                <Crown size={15} className="text-amber-400" />
                <span>#1 Mais Usada do Meta:</span>
                <span className="text-amber-300 font-bold">
                  {report.topOverallCard.card.name}
                </span>
                <span className="text-slate-500 text-[11px]">
                  ({report.topOverallCard.usagePercentage}%)
                </span>
              </div>
            )}
          </div>

          {/* Busca rápida */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Filtrar por nome ou arquétipo..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-600 outline-none transition"
            />
          </div>
        </div>

        {/* ABAS POR CATEGORIA */}
        <div className="px-4 sm:px-6 pt-3 border-b border-slate-800/80 flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none bg-slate-950">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 sm:px-4 py-2 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap border-b-2 ${
              activeTab === 'overview'
                ? 'border-purple-500 text-purple-300 bg-purple-950/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp size={14} />
            <span>Visão Geral</span>
          </button>

          <button
            onClick={() => setActiveTab('heroi')}
            className={`px-3 sm:px-4 py-2 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap border-b-2 ${
              activeTab === 'heroi'
                ? 'border-amber-500 text-amber-300 bg-amber-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Crown size={14} />
            <span>Heróis (Top 10)</span>
          </button>

          <button
            onClick={() => setActiveTab('combatente')}
            className={`px-3 sm:px-4 py-2 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap border-b-2 ${
              activeTab === 'combatente'
                ? 'border-red-500 text-red-300 bg-red-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sword size={14} />
            <span>Combatentes (Top 10)</span>
          </button>

          <button
            onClick={() => setActiveTab('equipamento')}
            className={`px-3 sm:px-4 py-2 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap border-b-2 ${
              activeTab === 'equipamento'
                ? 'border-blue-500 text-blue-300 bg-blue-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield size={14} />
            <span>Equipamentos (Top 10)</span>
          </button>

          <button
            onClick={() => setActiveTab('efeito')}
            className={`px-3 sm:px-4 py-2 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap border-b-2 ${
              activeTab === 'efeito'
                ? 'border-emerald-500 text-emerald-300 bg-emerald-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles size={14} />
            <span>Efeitos (Top 10)</span>
          </button>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#08080c] space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw size={28} className="animate-spin text-purple-500" />
              <span className="text-sm font-semibold">Calculando cartas mais usadas nos decks da comunidade...</span>
            </div>
          ) : !report ? (
            <div className="py-20 text-center text-slate-500 text-sm">
              Não foi possível carregar as cartas populares.
            </div>
          ) : activeTab === 'overview' ? (
            /* VISÃO GERAL: PÓDIOS DAS 4 CATEGORIAS */
            <div className="space-y-6">
              {report.totalDecksAnalyzed === 0 && (
                <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/50 via-slate-900 to-purple-950/50 border border-purple-500/40 text-center flex flex-col items-center justify-center gap-2.5">
                  <div className="w-11 h-11 rounded-2xl bg-purple-900/60 border border-purple-500/50 flex items-center justify-center text-purple-300">
                    <Flame size={22} />
                  </div>
                  <h3 className="text-base font-bold text-white">Ranking Resetado (Ciclo dos Últimos 30 Dias)</h3>
                  <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                    A lista de cartas populares foi resetada e agora contabiliza exclusivamente os decks salvos nos <strong>últimos 30 dias</strong> por jogadores com <strong>conta de e-mail e senha cadastrada</strong>.
                  </p>
                  <p className="text-xs text-purple-300">
                    Cartas com molduras legadas e modernas serão exibidas exclusivamente na sua versão <strong>Moderna</strong>. Salve seus decks para definir o novo meta!
                  </p>
                  {onOpenDeckBuilder && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenDeckBuilder();
                      }}
                      className="mt-1 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-lg shadow-purple-950/50"
                    >
                      Montar e Salvar Deck
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Heróis */}
                <CategoryPodiumCard
                  title="Heróis mais Usados"
                  icon={<Crown size={18} className="text-amber-400" />}
                  badgeColor="bg-amber-950/60 border-amber-500/40 text-amber-300"
                  cards={report.herois.slice(0, 3)}
                  onSelectTab={() => setActiveTab('heroi')}
                  onSelectCard={onSelectCard}
                  onCopyCode={handleCopyCode}
                  copiedCode={copiedCode}
                />

                {/* Combatentes */}
                <CategoryPodiumCard
                  title="Combatentes mais Usados"
                  icon={<Sword size={18} className="text-red-400" />}
                  badgeColor="bg-red-950/60 border-red-500/40 text-red-300"
                  cards={report.combatentes.slice(0, 3)}
                  onSelectTab={() => setActiveTab('combatente')}
                  onSelectCard={onSelectCard}
                  onCopyCode={handleCopyCode}
                  copiedCode={copiedCode}
                />

                {/* Equipamentos */}
                <CategoryPodiumCard
                  title="Equipamentos mais Usados"
                  icon={<Shield size={18} className="text-blue-400" />}
                  badgeColor="bg-blue-950/60 border-blue-500/40 text-blue-300"
                  cards={report.equipamentos.slice(0, 3)}
                  onSelectTab={() => setActiveTab('equipamento')}
                  onSelectCard={onSelectCard}
                  onCopyCode={handleCopyCode}
                  copiedCode={copiedCode}
                />

                {/* Efeitos */}
                <CategoryPodiumCard
                  title="Efeitos mais Usados"
                  icon={<Sparkles size={18} className="text-emerald-400" />}
                  badgeColor="bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                  cards={report.efeitos.slice(0, 3)}
                  onSelectTab={() => setActiveTab('efeito')}
                  onSelectCard={onSelectCard}
                  onCopyCode={handleCopyCode}
                  copiedCode={copiedCode}
                />
              </div>

              {/* Dica informativa */}
              <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-900/40 border border-purple-500/50 flex items-center justify-center text-purple-300 shrink-0">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      Monte ou aprimore seu deck com as cartas mais fortes
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-400">
                      Clique em qualquer carta para ver seus efeitos detalhados ou copie seu código para adicionar diretamente ao seu deck.
                    </p>
                  </div>
                </div>

                {onOpenDeckBuilder && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenDeckBuilder();
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-lg shadow-purple-950/80 active:scale-95 flex items-center gap-2 shrink-0"
                  >
                    <Layers size={14} />
                    <span>Ir para Monte seu Deck</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* TAB ESPECÍFICA: TOP 10 COMPLETO */
            <div>
              {activeTab === 'heroi' && (
                <Top10List
                  categoryTitle="Top 10 Heróis da Comunidade"
                  categoryIcon={<Crown size={20} className="text-amber-400" />}
                  cards={filterCards(report.herois)}
                  onSelectCard={onSelectCard}
                  onCopyCode={handleCopyCode}
                  copiedCode={copiedCode}
                />
              )}
              {activeTab === 'combatente' && (
                <Top10List
                  categoryTitle="Top 10 Combatentes da Comunidade"
                  categoryIcon={<Sword size={20} className="text-red-400" />}
                  cards={filterCards(report.combatentes)}
                  onSelectCard={onSelectCard}
                  onCopyCode={handleCopyCode}
                  copiedCode={copiedCode}
                />
              )}
              {activeTab === 'equipamento' && (
                <Top10List
                  categoryTitle="Top 10 Equipamentos da Comunidade"
                  categoryIcon={<Shield size={20} className="text-blue-400" />}
                  cards={filterCards(report.equipamentos)}
                  onSelectCard={onSelectCard}
                  onCopyCode={handleCopyCode}
                  copiedCode={copiedCode}
                />
              )}
              {activeTab === 'efeito' && (
                <Top10List
                  categoryTitle="Top 10 Efeitos da Comunidade"
                  categoryIcon={<Sparkles size={20} className="text-emerald-400" />}
                  cards={filterCards(report.efeitos)}
                  onSelectCard={onSelectCard}
                  onCopyCode={handleCopyCode}
                  copiedCode={copiedCode}
                />
              )}
            </div>
          )}
        </div>

        {/* RODAPÉ */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
          <span>
            Estatísticas calculadas a partir de todos os decks salvos na nuvem pelos jogadores.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

/* Componente de Pódio (Top 3 de cada categoria) */
const CategoryPodiumCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  badgeColor: string;
  cards: PopularCardStat[];
  onSelectTab: () => void;
  onSelectCard?: (card: CardData) => void;
  onCopyCode: (code: string) => void;
  copiedCode: string | null;
}> = ({ title, icon, badgeColor, cards, onSelectTab, onSelectCard, onCopyCode, copiedCode }) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-lg hover:border-slate-700 transition">
      <div>
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-xs sm:text-sm font-bold text-white">{title}</h3>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${badgeColor}`}>
            Top 3
          </span>
        </div>

        <div className="space-y-2.5">
          {cards.length === 0 ? (
            <div className="py-7 text-center text-slate-500 text-xs italic">
              Aguardando decks nos últimos 30 dias.
            </div>
          ) : (
            cards.map((item, idx) => (
              <div 
                key={`${item.code}-${item.rank}-${idx}`}
                className="p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-purple-500/40 transition flex items-center gap-2.5 group cursor-pointer"
                onClick={() => onSelectCard && onSelectCard(item.card)}
              >
              {/* Badge Rank */}
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                item.rank === 1 ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30' :
                item.rank === 2 ? 'bg-slate-300 text-slate-950' :
                'bg-amber-800 text-amber-100'
              }`}>
                #{item.rank}
              </div>

              {/* Miniatura */}
              <div className="w-9 h-12 rounded bg-slate-800 overflow-hidden shrink-0 border border-slate-700">
                {item.card.imageUrl ? (
                  <img src={item.card.imageUrl} alt={item.card.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center text-[8px] text-slate-500">TCG</div>
                )}
              </div>

              {/* Informações */}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition">
                  {item.card.name}
                </h4>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                  <span className="text-purple-300 font-semibold">{item.usagePercentage}%</span>
                </div>
              </div>

              {/* Copiar */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyCode(item.code);
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition"
                title="Copiar Código"
              >
                {copiedCode === item.code ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            </div>
          ))
        )}
      </div>
    </div>

      <button
        onClick={onSelectTab}
        className="mt-4 w-full py-2 rounded-xl bg-slate-800/80 hover:bg-purple-900/40 text-purple-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-700 hover:border-purple-500/50"
      >
        <span>Ver Todas as 10 Cartas</span>
        <span>→</span>
      </button>
    </div>
  );
};

/* Componente Lista Top 10 Detalhada */
const Top10List: React.FC<{
  categoryTitle: string;
  categoryIcon: React.ReactNode;
  cards: PopularCardStat[];
  onSelectCard?: (card: CardData) => void;
  onCopyCode: (code: string) => void;
  copiedCode: string | null;
}> = ({ categoryTitle, categoryIcon, cards, onSelectCard, onCopyCode, copiedCode }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          {categoryIcon}
          <h3 className="text-base sm:text-lg font-black text-white">{categoryTitle}</h3>
        </div>
        <span className="text-xs text-slate-400 font-medium">
          {cards.length} cartas encontradas
        </span>
      </div>

      {cards.length === 0 ? (
        <div className="py-14 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-1.5">
          <p className="font-semibold text-slate-400">Nenhuma carta encontrada para esta categoria nos últimos 30 dias.</p>
          <p className="text-[11px] text-slate-500">Salve decks com sua conta registrada por e-mail e senha para compor o Top 10!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cards.map((item, idx) => {
            const isTop3 = item.rank <= 3;

            return (
              <div
                key={`${item.code}-${item.rank}-${idx}`}
                onClick={() => onSelectCard && onSelectCard(item.card)}
                className={`p-3 sm:p-4 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 group cursor-pointer ${
                  item.rank === 1
                    ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/50 shadow-lg shadow-amber-950/30 hover:border-amber-400'
                    : item.rank === 2
                    ? 'bg-slate-900/90 border-slate-600/60 hover:border-slate-400'
                    : item.rank === 3
                    ? 'bg-slate-900/90 border-amber-800/60 hover:border-amber-600'
                    : 'bg-slate-900/70 border-slate-800 hover:border-purple-500/40'
                }`}
              >
                {/* Ranking Badge */}
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-md ${
                  item.rank === 1
                    ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                    : item.rank === 2
                    ? 'bg-slate-300 text-slate-950 ring-2 ring-slate-200'
                    : item.rank === 3
                    ? 'bg-amber-700 text-amber-100 ring-2 ring-amber-600'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}>
                  #{item.rank}
                </div>

                {/* Imagem da carta */}
                <div className="w-12 h-16 sm:w-14 sm:h-20 rounded-lg bg-slate-950 overflow-hidden shrink-0 border border-slate-700/80 shadow-md group-hover:scale-105 transition-transform">
                  {item.card.imageUrl ? (
                    <img 
                      src={item.card.imageUrl} 
                      alt={item.card.name} 
                      className="w-full h-full object-cover" 
                      loading="lazy" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-500 font-bold">TCG</div>
                  )}
                </div>

                {/* Dados da carta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-black text-white truncate group-hover:text-purple-300 transition">
                      {item.card.name}
                    </h4>
                    {isTop3 && (
                      <Crown size={13} className={item.rank === 1 ? 'text-amber-400' : 'text-slate-400'} />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400 mt-0.5">
                    <span className="font-mono text-slate-300">{item.code}</span>
                    <span>•</span>
                    <span className="text-purple-400 font-semibold">{item.card.archetype || 'Sem arquétipo'}</span>
                    {item.card.ct !== undefined && (
                      <>
                        <span>•</span>
                        <span className="text-pink-300 font-bold">CT {item.card.ct}</span>
                      </>
                    )}
                    {item.card.attack !== undefined && (
                      <span className="text-red-300 font-bold">ATK {item.card.attack}</span>
                    )}
                    {item.card.defense !== undefined && (
                      <span className="text-blue-300 font-bold">DEF {item.card.defense}</span>
                    )}
                  </div>

                  {/* Barra de popularidade */}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-medium">Presença nos Decks:</span>
                      <span className="font-bold text-purple-300">{item.usagePercentage}%</span>
                    </div>
                    <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.rank === 1 ? 'bg-gradient-to-r from-amber-500 to-red-500' :
                          item.rank <= 3 ? 'bg-gradient-to-r from-purple-500 to-indigo-500' :
                          'bg-purple-600'
                        }`}
                        style={{ width: `${Math.max(8, Math.min(100, item.usagePercentage))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectCard) onSelectCard(item.card);
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white transition shadow-sm"
                    title="Ver Detalhes da Carta"
                  >
                    <Eye size={15} />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyCode(item.code);
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shadow-sm"
                    title="Copiar Código"
                  >
                    {copiedCode === item.code ? (
                      <Check size={15} className="text-emerald-400" />
                    ) : (
                      <Copy size={15} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
