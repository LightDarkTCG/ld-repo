import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  Crown, 
  Sparkles, 
  Medal, 
  X, 
  Layers, 
  Star, 
  RefreshCw, 
  Shield, 
  LogIn, 
  CheckCircle2, 
  BookmarkCheck,
  TrendingUp,
  User as UserIcon,
  Flame,
  Heart,
  Award,
  Search,
  UserCheck,
  UserX,
  AlertCircle
} from 'lucide-react';
import { useAuth, isUserAdmin } from '../authService';
import { useCards } from '../CardContext';
import { useUserAlbum } from '../albumService';
import { 
  CollectorRankEntry, 
  CollectorSortCriteria, 
  subscribeCollectorsRanking, 
  sortCollectors, 
  syncUserCollectorStats,
  setCollectorAmbassadorStatus,
  getCatalogueUniverse,
  repairAllRankingDocs
} from '../collectorsService';

interface CollectorsRankingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAlbum?: () => void;
  onOpenAuth?: () => void;
  onOpenUserProfile?: (profile: { 
    userId: string; 
    displayName: string; 
    photoURL?: string; 
    email?: string;
    isAmbassador?: boolean;
    ambassadorRole?: string;
  }) => void;
  onOpenMostWanted?: () => void;
}

export const CollectorsRankingModal: React.FC<CollectorsRankingModalProps> = ({
  isOpen,
  onClose,
  onOpenAlbum,
  onOpenAuth,
  onOpenUserProfile,
  onOpenMostWanted
}) => {
  const { user } = useAuth();
  const { cards: allCards } = useCards();
  const { album } = useUserAlbum(user?.uid);

  const [collectors, setCollectors] = useState<CollectorRankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [criteria, setCriteria] = useState<CollectorSortCriteria>('unique');
  const [isSyncing, setIsSyncing] = useState(false);

  // Aba ativa: 'players' (Ranking Geral de Jogadores) ou 'ambassadors' (Embaixadores do Jogo)
  const [rankingTab, setRankingTab] = useState<'players' | 'ambassadors'>('players');

  // Estados para ações de administração
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [adminSearchTerm, setAdminSearchTerm] = useState('');

  const isAdmin = isUserAdmin(user);

  // Escuta ranking de colecionadores em tempo real
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const unsubscribe = subscribeCollectorsRanking((entries) => {
      setCollectors(entries);
      setLoading(false);
    }, (err) => {
      console.warn('Erro ao carregar ranking:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  // Sincroniza os dados do usuário atual assim que abre o modal
  useEffect(() => {
    if (isOpen && user && user.uid && album && Object.keys(album).length > 0 && allCards.length > 0) {
      setIsSyncing(true);
      syncUserCollectorStats(user.uid, user, album, allCards).finally(() => {
        setIsSyncing(false);
      });
    }
  }, [isOpen, user?.uid, album, allCards.length]);

  // Universo dinâmico do catálogo exatamente idêntico ao Álbum Geral
  const catalogueStats = useMemo(() => {
    return getCatalogueUniverse(allCards);
  }, [allCards]);

  // Se for Administrador, audita e sincroniza todos os documentos de ranking no Firestore
  useEffect(() => {
    if (isOpen && isAdmin && allCards.length > 0) {
      repairAllRankingDocs(allCards);
    }
  }, [isOpen, isAdmin, allCards.length]);

  // Ordena todos os colecionadores pelo critério selecionado
  const sortedAllCollectors = useMemo(() => {
    return sortCollectors(collectors, criteria);
  }, [collectors, criteria]);

  // SEPARAÇÃO ESTRITA:
  // 1. Jogadores regulares (não-embaixadores) competem no Ranking Geral
  const regularCollectors = useMemo(() => {
    return sortedAllCollectors.filter(c => !c.isAmbassador);
  }, [sortedAllCollectors]);

  // 2. Embaixadores Oficiais do Jogo ficam na Galeria de Honra Exclusiva
  const ambassadorCollectors = useMemo(() => {
    return sortedAllCollectors.filter(c => !!c.isAmbassador);
  }, [sortedAllCollectors]);

  // Lista Top 10 para o Ranking de Jogadores
  const top10Regular = useMemo(() => {
    return regularCollectors.slice(0, 10);
  }, [regularCollectors]);

  const top1 = top10Regular[0] || null;
  const top2 = top10Regular[1] || null;
  const top3 = top10Regular[2] || null;
  const others = top10Regular.slice(3);

  // Identificação do usuário logado e sua categoria
  const currentUserEntry = useMemo(() => {
    if (!user) return null;
    return collectors.find(c => c.userId === user.uid) || null;
  }, [collectors, user]);

  const isCurrentUserAmbassador = Boolean(currentUserEntry?.isAmbassador);

  const currentUserRank = useMemo(() => {
    if (!user) return null;
    if (isCurrentUserAmbassador) {
      const idx = ambassadorCollectors.findIndex(c => c.userId === user.uid);
      return {
        position: idx + 1,
        entry: currentUserEntry,
        isAmbassador: true
      };
    }
    const index = regularCollectors.findIndex(c => c.userId === user.uid);
    if (index === -1) {
      return {
        position: regularCollectors.length + 1,
        entry: currentUserEntry,
        isAmbassador: false
      };
    }
    return {
      position: index + 1,
      entry: regularCollectors[index],
      isAmbassador: false
    };
  }, [regularCollectors, ambassadorCollectors, currentUserEntry, isCurrentUserAmbassador, user]);

  const handleManualSync = async () => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    setIsSyncing(true);
    await syncUserCollectorStats(user.uid, user, album, allCards);
    if (isAdmin) {
      await repairAllRankingDocs(allCards);
    }
    setIsSyncing(false);
  };

  // Ação exclusiva de Administrador: Nomear ou Remover Embaixador
  const handleToggleAmbassador = async (entry: CollectorRankEntry) => {
    if (!user || !isAdmin) return;

    const nextStatus = !entry.isAmbassador;
    const confirmMsg = nextStatus
      ? `Deseja nomear "${entry.displayName}" como Embaixador Oficial de Light Dark TCG?\n\nEle será movido para a aba exclusiva de Embaixadores, garantindo total justiça e equidade competitiva no ranking geral dos demais jogadores.`
      : `Deseja remover o status de Embaixador de "${entry.displayName}"?\n\nEle retornará à disputa do ranking geral de jogadores.`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(entry.userId);
    try {
      await setCollectorAmbassadorStatus(
        entry.userId,
        nextStatus,
        user.email || undefined,
        'Embaixador Oficial'
      );
    } catch (err) {
      console.error('Erro ao alterar status de embaixador:', err);
      alert('Não foi possível alterar o status de embaixador.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtragem de jogadores para a busca rápida do Administrador na aba de Embaixadores
  const filteredCandidatesForAdmin = useMemo(() => {
    if (!adminSearchTerm.trim()) return [];
    const term = adminSearchTerm.toLowerCase().trim();
    return regularCollectors.filter(c => 
      c.displayName.toLowerCase().includes(term) ||
      (c.email && c.email.toLowerCase().includes(term))
    ).slice(0, 8);
  }, [regularCollectors, adminSearchTerm]);

  if (!isOpen) return null;

  const getMetricLabel = (entry: CollectorRankEntry) => {
    switch (criteria) {
      case 'total':
        return `${entry.totalCopies} cópias físicas`;
      case 'legado':
        return `${entry.uniqueLegado} cartas Legado`;
      case 'moderno':
        return `${entry.uniqueModerno} cartas Moderno`;
      case 'special':
        return `${entry.specialCards} cartas especiais`;
      case 'unique':
      default: {
        const pct = catalogueStats.totalCount > 0 
          ? Math.min(100, Math.round((entry.uniqueCards / catalogueStats.totalCount) * 100))
          : entry.completionPercentage;
        return `${entry.uniqueCards} de ${catalogueStats.totalCount} cartas únicas (${pct}%)`;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[140] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-[#0b0f19] border border-amber-500/40 w-full max-w-5xl max-h-[92vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER PRINCIPAL */}
        <div className="p-4 sm:p-6 border-b border-amber-500/30 bg-gradient-to-r from-amber-950/70 via-slate-950 to-purple-950/70 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-950/80 shrink-0 border border-amber-300">
              <Trophy size={26} className="fill-current text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  Hall da Fama dos Colecionadores
                </h3>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 items-center gap-1">
                  <Crown size={11} className="fill-amber-300" /> Oficial Light Dark
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Os maiores acervos físicos, variantes e embaixadores da comunidade de Light Dark TCG
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenMostWanted && (
              <button
                onClick={() => {
                  onClose();
                  onOpenMostWanted();
                }}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white border border-amber-400/80 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-amber-950/40"
                title="Ver cartas mais procuradas da comunidade"
              >
                <Flame size={14} className="fill-white" />
                <span>Cartas Mais Procuradas</span>
              </button>
            )}

            {user && (
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                title="Sincronizar meu acervo com o ranking"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin text-amber-400' : 'text-slate-400'} />
                <span className="hidden sm:inline">Sincronizar Álbum</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Fechar Ranking"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* BANNER DINÂMICO DO CATÁLOGO DE CARTAS (FÓRMULA OFICIAL) */}
        <div className="px-4 py-2 bg-gradient-to-r from-purple-950/70 via-slate-900 to-amber-950/60 border-b border-purple-900/30 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles size={14} className="text-amber-400 shrink-0" />
            <span className="font-bold text-white">Catálogo do Jogo:</span>
            <span className="font-mono text-amber-300 font-bold">{catalogueStats.totalCount} cartas possíveis</span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-slate-400">Legado: <strong className="text-slate-200">{catalogueStats.legacyCount}</strong></span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-slate-400">Modernas: <strong className="text-purple-300">{catalogueStats.modernCount}</strong></span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-slate-400">Especiais & Variações: <strong className="text-pink-300">{catalogueStats.specialCount}</strong></span>
          </div>
          <span className="text-[11px] text-slate-400 hidden md:inline">O total máximo segue o catálogo automaticamente</span>
        </div>

        {/* ABAS DO RANKING: RANKING DE JOGADORES VS EMBAIXADORES DO JOGO */}
        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 overflow-x-auto scrollbar-thin shrink-0">
          <div className="flex items-center gap-2">
            {/* Aba 1: Ranking Geral de Jogadores */}
            <button
              onClick={() => setRankingTab('players')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 shadow-sm ${
                rankingTab === 'players'
                  ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-slate-950 shadow-amber-950/50'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Trophy size={14} className={rankingTab === 'players' ? 'fill-slate-950' : 'text-amber-400'} />
              <span>Ranking Geral de Jogadores</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                rankingTab === 'players' ? 'bg-slate-950/30 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'
              }`}>
                {regularCollectors.length}
              </span>
            </button>

            {/* Aba 2: Embaixadores do Jogo (Separados do Ranking Oficial) */}
            <button
              onClick={() => setRankingTab('ambassadors')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 shadow-sm ${
                rankingTab === 'ambassadors'
                  ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white shadow-purple-950/50'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Crown size={14} className={rankingTab === 'ambassadors' ? 'fill-white' : 'text-amber-400'} />
              <span>Embaixadores do Jogo</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                rankingTab === 'ambassadors' ? 'bg-black/40 text-amber-300' : 'bg-slate-800 text-slate-300'
              }`}>
                {ambassadorCollectors.length}
              </span>
            </button>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-950/70 border border-purple-500/60 text-[11px] font-bold text-purple-200 shrink-0 shadow-sm">
              <Crown size={12} className="text-yellow-400" />
              <span>Modo Administrador Ativo</span>
            </div>
          )}
        </div>

        {/* BARRA DE CRITÉRIOS DE ORDENAÇÃO */}
        <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between gap-3 overflow-x-auto scrollbar-thin shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mr-1 flex items-center gap-1 shrink-0">
              <TrendingUp size={12} className="text-amber-400" /> Ordenar por:
            </span>

            <button
              onClick={() => setCriteria('unique')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                criteria === 'unique'
                  ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-slate-950 font-black shadow-md border border-amber-300'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Crown size={13} className={criteria === 'unique' ? 'fill-slate-950' : 'text-amber-400'} />
              <span>Cartas Únicas (Variedade)</span>
            </button>

            <button
              onClick={() => setCriteria('total')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                criteria === 'total'
                  ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-slate-950 font-black shadow-md border border-amber-300'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Layers size={13} />
              <span>Volume Total (Cópias)</span>
            </button>

            <button
              onClick={() => setCriteria('legado')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                criteria === 'legado'
                  ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-slate-950 font-black shadow-md border border-amber-300'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Shield size={13} />
              <span>Era Legado</span>
            </button>

            <button
              onClick={() => setCriteria('moderno')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                criteria === 'moderno'
                  ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-slate-950 font-black shadow-md border border-amber-300'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Sparkles size={13} />
              <span>Era Moderna</span>
            </button>

            <button
              onClick={() => setCriteria('special')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                criteria === 'special'
                  ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-slate-950 font-black shadow-md border border-amber-300'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Star size={13} />
              <span>Especiais & Raras</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 shrink-0 font-medium hidden md:inline">
            {rankingTab === 'players' 
              ? `${regularCollectors.length} duelistas no ranking` 
              : `${ambassadorCollectors.length} embaixadores na galeria`}
          </span>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#07090e] space-y-6 custom-scrollbar">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <RefreshCw size={36} className="animate-spin text-amber-400 mb-3" />
              <p className="text-slate-300 font-bold text-sm">Carregando acervos e ranking...</p>
            </div>
          ) : rankingTab === 'players' ? (
            /* ==============================================================
               ABA 1: RANKING GERAL DE JOGADORES (APENAS NÃO-EMBAIXADORES)
               ============================================================== */
            <>
              {/* BANNER INFORMATIVO DE EQUIDADE COMPETITIVA */}
              <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 flex items-start gap-3">
                <Shield size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-amber-300 font-bold block mb-0.5">Disputa Oficial e Equilibrada entre Jogadores</strong>
                  Este ranking reúne todos os duelistas da comunidade em igualdade de condições. Os <strong>Embaixadores do Jogo</strong> contam com uma Galeria de Honra própria na aba ao lado, garantindo que o pódio e as colocações gerais permaneçam 100% justos para todos os colecionadores.
                </div>
              </div>

              {top10Regular.length === 0 ? (
                <div className="py-16 text-center max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-3xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4">
                    <Trophy size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">Nenhum Jogador Registrado Ainda</h4>
                  <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                    Seja o primeiro a marcar presença no Hall da Fama! Abra seu Álbum de Coleção, adicione suas cartas físicas e conquiste o 1º Lugar no ranking!
                  </p>
                  {onOpenAlbum && (
                    <button
                      onClick={() => { onClose(); onOpenAlbum(); }}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-950/60 active:scale-95"
                    >
                      Abrir Meu Álbum Agora
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* PÓDIO DOS 3 PRIMEIROS COLOCADOS (OURO, PRATA, BRONZE) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-6 pb-2">
                    {/* 2º LUGAR (PRATA) */}
                    {top2 ? (
                      <div className="order-2 md:order-1 bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-400/40 rounded-2xl p-4 text-center relative shadow-lg flex flex-col items-center">
                        <div className="absolute -top-3.5 px-3 py-0.5 rounded-full bg-slate-300 text-slate-950 font-black text-[11px] shadow-md flex items-center gap-1 border border-white">
                          <Medal size={12} className="fill-slate-950" /> 2º Lugar
                        </div>

                        <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-300 overflow-hidden mt-2 mb-3 shadow-md flex items-center justify-center">
                          {top2.photoURL ? (
                            <img src={top2.photoURL} alt={top2.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-slate-700 flex items-center justify-center text-xl font-black text-white">
                              {top2.displayName[0]?.toUpperCase() || 'C'}
                            </div>
                          )}
                        </div>

                        <h4 className="text-sm font-black text-white truncate max-w-full flex items-center gap-1">
                          {top2.displayName}
                          {user && user.uid === top2.userId && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-600 text-white font-bold">Você</span>
                          )}
                        </h4>

                        <span className="text-xs font-mono font-bold text-slate-300 mt-1">
                          {getMetricLabel(top2)}
                        </span>

                        <div className="w-full mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-around text-[10px] text-slate-400">
                          <div>
                            <span className="block text-slate-200 font-bold">{top2.uniqueCards}</span>
                            <span>Únicas</span>
                          </div>
                          <div>
                            <span className="block text-slate-200 font-bold">{top2.totalCopies}</span>
                            <span>Cópias</span>
                          </div>
                          <div>
                            <span className="block text-slate-200 font-bold">{top2.specialCards}</span>
                            <span>Especiais</span>
                          </div>
                        </div>

                        <div className="mt-2.5 flex items-center gap-1.5 w-full justify-center flex-wrap">
                          {onOpenUserProfile && (
                            <button
                              onClick={() => {
                                onClose();
                                onOpenUserProfile({
                                  userId: top2.userId,
                                  displayName: top2.displayName,
                                  photoURL: top2.photoURL,
                                  email: top2.email,
                                  isAmbassador: false
                                });
                              }}
                              className="px-3 py-1 rounded-xl bg-slate-800/80 hover:bg-purple-950 border border-slate-700 hover:border-purple-600/60 text-[11px] font-bold text-slate-300 hover:text-purple-200 transition flex items-center gap-1.5"
                              title="Ver cartas que este jogador procura"
                            >
                              <Heart size={11} className="text-pink-400" />
                              <span>Cartas que Procura</span>
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              onClick={() => handleToggleAmbassador(top2)}
                              disabled={actionLoadingId === top2.userId}
                              className="px-2.5 py-1 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-500/60 text-amber-300 text-[10px] font-bold transition flex items-center gap-1"
                              title="Admin: Marcar como Embaixador do Jogo"
                            >
                              <Crown size={10} className="text-amber-400" />
                              <span>{actionLoadingId === top2.userId ? '...' : '⭐ Nomear'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="order-2 md:order-1 h-36 border border-dashed border-slate-800 rounded-2xl flex items-center justify-center text-xs text-slate-600 font-bold">
                        2º Lugar Disponível
                      </div>
                    )}

                    {/* 1º LUGAR (OURO - CAMPEÃO DO RANKING GERAL) */}
                    {top1 ? (
                      <div className="order-1 md:order-2 bg-gradient-to-b from-amber-950/70 via-slate-900 to-slate-950 border-2 border-amber-400/80 rounded-2xl sm:rounded-3xl p-5 text-center relative shadow-2xl shadow-amber-950/40 flex flex-col items-center scale-100 sm:scale-105 z-10">
                        <div className="absolute -top-4 px-4 py-1 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs shadow-xl flex items-center gap-1.5 border border-yellow-200 animate-pulse">
                          <Crown size={14} className="fill-slate-950" /> 1º Campeão Colecionador
                        </div>

                        <div className="w-20 h-20 rounded-full bg-amber-950 border-4 border-amber-300 overflow-hidden mt-3 mb-3 shadow-xl shadow-amber-500/20 flex items-center justify-center">
                          {top1.photoURL ? (
                            <img src={top1.photoURL} alt={top1.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-2xl font-black text-slate-950">
                              {top1.displayName[0]?.toUpperCase() || '1'}
                            </div>
                          )}
                        </div>

                        <h4 className="text-base font-black text-white truncate max-w-full flex items-center gap-1.5">
                          {top1.displayName}
                          {user && user.uid === top1.userId && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-600 text-white font-bold">Você</span>
                          )}
                        </h4>

                        <div className="text-xs font-mono font-black text-amber-300 mt-1 flex items-center gap-1">
                          <Sparkles size={12} className="text-yellow-400" />
                          <span>{getMetricLabel(top1)}</span>
                        </div>

                        {/* Barra de Conclusão */}
                        <div className="w-full mt-3 max-w-[200px]">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-slate-400">Progresso do Jogo:</span>
                            <span className="font-bold text-amber-300">
                              {catalogueStats.totalCount > 0 ? Math.min(100, Math.round((top1.uniqueCards / catalogueStats.totalCount) * 100)) : top1.completionPercentage}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-amber-500/30">
                            <div 
                              className="bg-gradient-to-r from-amber-500 to-yellow-300 h-full rounded-full transition-all duration-500"
                              style={{ width: `${catalogueStats.totalCount > 0 ? Math.min(100, Math.round((top1.uniqueCards / catalogueStats.totalCount) * 100)) : top1.completionPercentage}%` }}
                            />
                          </div>
                        </div>

                        <div className="w-full mt-4 pt-3 border-t border-amber-500/20 flex items-center justify-around text-[10px] text-slate-400">
                          <div>
                            <span className="block text-amber-200 font-bold text-xs">{top1.uniqueCards}</span>
                            <span>Únicas</span>
                          </div>
                          <div>
                            <span className="block text-amber-200 font-bold text-xs">{top1.totalCopies}</span>
                            <span>Cópias</span>
                          </div>
                          <div>
                            <span className="block text-amber-200 font-bold text-xs">{top1.specialCards}</span>
                            <span>Especiais</span>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2 w-full justify-center flex-wrap">
                          {onOpenUserProfile && (
                            <button
                              onClick={() => {
                                onClose();
                                onOpenUserProfile({
                                  userId: top1.userId,
                                  displayName: top1.displayName,
                                  photoURL: top1.photoURL,
                                  email: top1.email,
                                  isAmbassador: false
                                });
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-purple-950/60"
                              title="Ver perfil e cartas que o Campeão procura"
                            >
                              <Heart size={12} className="fill-white" />
                              <span>Ver Cartas que Procura</span>
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              onClick={() => handleToggleAmbassador(top1)}
                              disabled={actionLoadingId === top1.userId}
                              className="px-3 py-1.5 rounded-xl bg-amber-950 hover:bg-amber-900 border border-amber-500/80 text-amber-300 text-xs font-bold transition flex items-center gap-1 shadow-md"
                              title="Admin: Nomear como Embaixador do Jogo"
                            >
                              <Crown size={12} className="text-amber-400" />
                              <span>{actionLoadingId === top1.userId ? '...' : '⭐ Nomear Embaixador'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="order-1 md:order-2 h-44 border-2 border-dashed border-amber-500/40 rounded-3xl flex items-center justify-center text-xs text-amber-400 font-bold">
                        1º Lugar Disponível
                      </div>
                    )}

                    {/* 3º LUGAR (BRONZE) */}
                    {top3 ? (
                      <div className="order-3 bg-gradient-to-b from-slate-900/90 to-slate-950 border border-amber-800/40 rounded-2xl p-4 text-center relative shadow-lg flex flex-col items-center">
                        <div className="absolute -top-3.5 px-3 py-0.5 rounded-full bg-amber-700 text-white font-black text-[11px] shadow-md flex items-center gap-1 border border-amber-500">
                          <Medal size={12} className="fill-white" /> 3º Lugar
                        </div>

                        <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-amber-600 overflow-hidden mt-2 mb-3 shadow-md flex items-center justify-center">
                          {top3.photoURL ? (
                            <img src={top3.photoURL} alt={top3.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-amber-900 flex items-center justify-center text-xl font-black text-amber-200">
                              {top3.displayName[0]?.toUpperCase() || 'C'}
                            </div>
                          )}
                        </div>

                        <h4 className="text-sm font-black text-white truncate max-w-full flex items-center gap-1">
                          {top3.displayName}
                          {user && user.uid === top3.userId && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-600 text-white font-bold">Você</span>
                          )}
                        </h4>

                        <span className="text-xs font-mono font-bold text-amber-200/90 mt-1">
                          {getMetricLabel(top3)}
                        </span>

                        <div className="w-full mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-around text-[10px] text-slate-400">
                          <div>
                            <span className="block text-slate-200 font-bold">{top3.uniqueCards}</span>
                            <span>Únicas</span>
                          </div>
                          <div>
                            <span className="block text-slate-200 font-bold">{top3.totalCopies}</span>
                            <span>Cópias</span>
                          </div>
                          <div>
                            <span className="block text-slate-200 font-bold">{top3.specialCards}</span>
                            <span>Especiais</span>
                          </div>
                        </div>

                        <div className="mt-2.5 flex items-center gap-1.5 w-full justify-center flex-wrap">
                          {onOpenUserProfile && (
                            <button
                              onClick={() => {
                                onClose();
                                onOpenUserProfile({
                                  userId: top3.userId,
                                  displayName: top3.displayName,
                                  photoURL: top3.photoURL,
                                  email: top3.email,
                                  isAmbassador: false
                                });
                              }}
                              className="px-3 py-1 rounded-xl bg-slate-800/80 hover:bg-purple-950 border border-slate-700 hover:border-purple-600/60 text-[11px] font-bold text-slate-300 hover:text-purple-200 transition flex items-center gap-1.5"
                              title="Ver cartas que este jogador procura"
                            >
                              <Heart size={11} className="text-pink-400" />
                              <span>Cartas que Procura</span>
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              onClick={() => handleToggleAmbassador(top3)}
                              disabled={actionLoadingId === top3.userId}
                              className="px-2.5 py-1 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-500/60 text-amber-300 text-[10px] font-bold transition flex items-center gap-1"
                              title="Admin: Marcar como Embaixador do Jogo"
                            >
                              <Crown size={10} className="text-amber-400" />
                              <span>{actionLoadingId === top3.userId ? '...' : '⭐ Nomear'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="order-3 h-36 border border-dashed border-slate-800 rounded-2xl flex items-center justify-center text-xs text-slate-600 font-bold">
                        3º Lugar Disponível
                      </div>
                    )}
                  </div>

                  {/* LISTA DO 4º AO 10º LUGAR DO RANKING GERAL */}
                  {others.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1 flex items-center gap-1.5">
                        <Trophy size={13} className="text-amber-400" /> Do 4º ao 10º Lugar no Ranking
                      </h4>

                      <div className="grid grid-cols-1 gap-2">
                        {others.map((entry, idx) => {
                          const pos = idx + 4;
                          const isMe = user && user.uid === entry.userId;

                          return (
                            <div
                              key={entry.userId}
                              className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                                isMe
                                  ? 'bg-purple-950/40 border-purple-500/60 shadow-md'
                                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {/* Posição */}
                                <span className="w-7 h-7 rounded-lg bg-slate-950 font-mono font-black text-xs text-slate-300 flex items-center justify-center border border-slate-800 shrink-0">
                                  #{pos}
                                </span>

                                {/* Avatar */}
                                <div className="w-9 h-9 rounded-full bg-slate-800 overflow-hidden shrink-0 border border-slate-700 flex items-center justify-center">
                                  {entry.photoURL ? (
                                    <img src={entry.photoURL} alt={entry.displayName} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="font-bold text-xs text-slate-400">
                                      {entry.displayName[0]?.toUpperCase() || 'C'}
                                    </span>
                                  )}
                                </div>

                                {/* Informações */}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-xs sm:text-sm text-white truncate">
                                      {entry.displayName}
                                    </span>
                                    {isMe && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-600 text-white font-bold">
                                        Você
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] font-mono text-slate-400">
                                    {getMetricLabel(entry)}
                                  </span>
                                </div>
                              </div>

                              {/* Estatísticas resumidas e Ações */}
                              <div className="flex items-center gap-2 sm:gap-3 text-right shrink-0">
                                <div className="hidden sm:block">
                                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Progresso</span>
                                  <span className="font-bold text-xs text-emerald-400 font-mono">
                                    {catalogueStats.totalCount > 0 ? Math.min(100, Math.round((entry.uniqueCards / catalogueStats.totalCount) * 100)) : entry.completionPercentage}%
                                  </span>
                                </div>

                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Únicas</span>
                                  <span className="font-black text-xs sm:text-sm text-amber-300 font-mono">{entry.uniqueCards}</span>
                                </div>

                                <div>
                                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Cópias</span>
                                  <span className="font-bold text-xs text-slate-200 font-mono">{entry.totalCopies}</span>
                                </div>

                                {onOpenUserProfile && (
                                  <button
                                    onClick={() => {
                                      onClose();
                                      onOpenUserProfile({
                                        userId: entry.userId,
                                        displayName: entry.displayName,
                                        photoURL: entry.photoURL,
                                        email: entry.email,
                                        isAmbassador: false
                                      });
                                    }}
                                    className="p-2 rounded-xl bg-slate-800 hover:bg-purple-900 border border-slate-700 hover:border-purple-600/50 text-slate-300 hover:text-white transition"
                                    title="Ver cartas que este duelista procura"
                                  >
                                    <Heart size={14} className="text-pink-400" />
                                  </button>
                                )}

                                {isAdmin && (
                                  <button
                                    onClick={() => handleToggleAmbassador(entry)}
                                    disabled={actionLoadingId === entry.userId}
                                    className="px-2 py-1.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-500/70 text-amber-300 text-[10px] font-bold transition flex items-center gap-1 shadow-sm"
                                    title="Admin: Nomear como Embaixador"
                                  >
                                    <Crown size={11} className="text-amber-400" />
                                    <span className="hidden sm:inline">Nomear</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            /* ==============================================================
               ABA 2: GALERIA DE EMBAIXADORES DO JOGO (SEPARADOS DO RANKING GERAL)
               ============================================================== */
            <div className="space-y-5">
              {/* BANNER INSTITUCIONAL DOS EMBAIXADORES */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-950/50 via-slate-900 to-amber-950/50 border border-purple-500/40 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-xl shadow-amber-950/60 shrink-0">
                      <Crown size={24} className="fill-slate-950" />
                    </div>
                    <div>
                      <h4 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                        Galeria de Honra dos Embaixadores
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                          Exclusivo
                        </span>
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                        Os <strong>Embaixadores Oficiais</strong> são duelistas, criadores de conteúdo e líderes de comunidade dedicados à expansão e divulgação de <strong>Light Dark TCG</strong>. Por contarem com apoios ou participações oficiais, eles possuem este espaço distinto de honra e <strong>não ocupam as vagas do ranking geral de jogadores</strong>, mantendo a competição plenamente justa e transparente.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PAINEL RÁPIDO DO ADMINISTRADOR PARA NOMEAR NOVO EMBAIXADOR */}
              {isAdmin && (
                <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-600/50 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                      <Crown size={14} className="text-yellow-400" />
                      Gerenciar Embaixadores (Opção de Administrador)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      viniciuspdiasuzumaki@gmail.com
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">
                    Busque qualquer colecionador cadastrado pelo nome ou e-mail para promovê-lo a Embaixador Oficial:
                  </p>

                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={adminSearchTerm}
                      onChange={e => setAdminSearchTerm(e.target.value)}
                      placeholder="Buscar jogador cadastrado para nomear como embaixador..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-purple-700/60 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {filteredCandidatesForAdmin.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      {filteredCandidatesForAdmin.map(candidate => (
                        <div 
                          key={candidate.userId}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                        >
                          <div className="truncate min-w-0 mr-2">
                            <span className="font-bold text-white block truncate">{candidate.displayName}</span>
                            <span className="text-[10px] text-slate-400 font-mono truncate">{candidate.uniqueCards} cartas únicas</span>
                          </div>
                          <button
                            onClick={() => handleToggleAmbassador(candidate)}
                            disabled={actionLoadingId === candidate.userId}
                            className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold text-[11px] shrink-0 hover:brightness-110 transition shadow-sm"
                          >
                            {actionLoadingId === candidate.userId ? '...' : '+ Nomear'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* LISTA DE EMBAIXADORES CADASTRADOS */}
              {ambassadorCollectors.length === 0 ? (
                <div className="py-16 text-center max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-3xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto mb-4">
                    <Crown size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">Nenhum Embaixador Cadastrado Ainda</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Os embaixadores oficiais serão exibidos com destaque exclusivo aqui assim que forem nomeados pelo administrador.
                  </p>
                  {isAdmin && (
                    <p className="text-xs text-amber-300 font-medium">
                      💡 Como administrador, você pode promover qualquer jogador no ranking geral clicando em <strong>"Nomear Embaixador"</strong> ou utilizando a busca rápida acima.
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {ambassadorCollectors.map((ambassador) => {
                    const isMe = user && user.uid === ambassador.userId;

                    return (
                      <div
                        key={ambassador.userId}
                        className={`p-4 rounded-2xl border transition relative overflow-hidden flex flex-col justify-between ${
                          isMe
                            ? 'bg-gradient-to-br from-purple-950/60 via-slate-900 to-slate-950 border-purple-500 shadow-xl shadow-purple-950/50'
                            : 'bg-gradient-to-br from-slate-900/90 to-slate-950 border-amber-500/40 hover:border-amber-400'
                        }`}
                      >
                        {/* Brilho e Insígnia */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-amber-500/20 border border-amber-500/50 text-[10px] font-black text-amber-300 shadow-sm">
                            <Crown size={11} className="text-amber-400 fill-amber-400" />
                            <span>{ambassador.ambassadorRole || 'Embaixador Oficial'}</span>
                          </div>

                          {isMe && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-600 text-white font-bold">
                              Você
                            </span>
                          )}
                        </div>

                        {/* Avatar e Nome */}
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-amber-400/80 overflow-hidden shrink-0 shadow-lg shadow-amber-950/40 flex items-center justify-center">
                            {ambassador.photoURL ? (
                              <img src={ambassador.photoURL} alt={ambassador.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-amber-500 to-purple-600 flex items-center justify-center text-lg font-black text-white">
                                {ambassador.displayName[0]?.toUpperCase() || 'E'}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-white truncate">
                              {ambassador.displayName}
                            </h4>
                            <span className="text-[11px] font-mono text-amber-300/90 block">
                              {getMetricLabel(ambassador)}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {catalogueStats.totalCount > 0 ? Math.min(100, Math.round((ambassador.uniqueCards / catalogueStats.totalCount) * 100)) : ambassador.completionPercentage}% do jogo completo ({ambassador.uniqueCards} de {catalogueStats.totalCount})
                            </span>
                          </div>
                        </div>

                        {/* Métricas do Embaixador */}
                        <div className="w-full mt-3.5 pt-2.5 border-t border-slate-800 flex items-center justify-around text-[10px] text-slate-400">
                          <div>
                            <span className="block text-slate-200 font-bold text-xs">{ambassador.uniqueCards}</span>
                            <span>Únicas</span>
                          </div>
                          <div>
                            <span className="block text-slate-200 font-bold text-xs">{ambassador.totalCopies}</span>
                            <span>Cópias</span>
                          </div>
                          <div>
                            <span className="block text-slate-200 font-bold text-xs">{ambassador.specialCards}</span>
                            <span>Especiais</span>
                          </div>
                        </div>

                        {/* Botões de Ação */}
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          {onOpenUserProfile && (
                            <button
                              onClick={() => {
                                onClose();
                                onOpenUserProfile({
                                  userId: ambassador.userId,
                                  displayName: ambassador.displayName,
                                  photoURL: ambassador.photoURL,
                                  email: ambassador.email,
                                  isAmbassador: true,
                                  ambassadorRole: ambassador.ambassadorRole || 'Embaixador Oficial'
                                });
                              }}
                              className="flex-1 py-1.5 px-2.5 rounded-xl bg-purple-950/70 hover:bg-purple-900 border border-purple-700/50 hover:border-purple-500 text-purple-200 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                              title="Ver perfil e cartas que o embaixador procura"
                            >
                              <Heart size={12} className="text-pink-400 fill-pink-400/40" />
                              <span>Cartas que Procura</span>
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              onClick={() => handleToggleAmbassador(ambassador)}
                              disabled={actionLoadingId === ambassador.userId}
                              className="py-1.5 px-2.5 rounded-xl bg-red-950/70 hover:bg-red-900 border border-red-700/60 text-red-200 text-xs font-bold transition flex items-center gap-1 shadow-sm shrink-0"
                              title="Admin: Remover status de embaixador (ele voltará ao ranking geral)"
                            >
                              <UserX size={12} />
                              <span>{actionLoadingId === ambassador.userId ? '...' : 'Remover'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER: STATUS PESSOAL & AÇÕES */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-900/60 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 font-bold">
                {isCurrentUserAmbassador ? (
                  <Crown size={16} className="text-amber-400" />
                ) : (
                  currentUserRank && currentUserRank.position <= 10 ? `#${currentUserRank.position}` : '—'
                )}
              </div>
              <div>
                <span className="text-white font-bold block">
                  {isCurrentUserAmbassador ? (
                    '🎖️ Você é um Embaixador Oficial de Light Dark TCG (Galeria de Honra)'
                  ) : currentUserRank?.entry ? (
                    `Sua posição no Ranking Geral: #${currentUserRank.position} (${currentUserRank.entry.uniqueCards} cartas únicas)`
                  ) : (
                    'Você ainda não registrou cartas no seu Álbum'
                  )}
                </span>
                <span className="text-[11px] text-slate-400">
                  {isCurrentUserAmbassador ? (
                    'Seu perfil está em destaque especial sem ocupar posições no ranking geral dos jogadores.'
                  ) : currentUserRank?.entry ? (
                    `${currentUserRank.entry.totalCopies} cópias físicas no acervo • ${currentUserRank.entry.uniqueCards} de ${catalogueStats.totalCount} cartas (${catalogueStats.totalCount > 0 ? Math.min(100, Math.round((currentUserRank.entry.uniqueCards / catalogueStats.totalCount) * 100)) : currentUserRank.entry.completionPercentage}% do jogo)`
                  ) : (
                    'Adicione cartas físicas ou decks no Álbum para disputar o Top 10 com outros jogadores!'
                  )}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <LogIn size={15} className="text-amber-400" />
              <span>Conecte sua conta para concorrer no Ranking dos Jogadores!</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {!user && onOpenAuth && (
              <button
                onClick={() => { onClose(); onOpenAuth(); }}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-sm"
              >
                Entrar na Conta
              </button>
            )}

            {onOpenAlbum && (
              <button
                onClick={() => { onClose(); onOpenAlbum(); }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
              >
                <BookmarkCheck size={15} />
                <span>Abrir Meu Álbum</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
            >
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
