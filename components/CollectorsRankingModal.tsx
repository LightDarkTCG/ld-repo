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
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../authService';
import { useCards } from '../CardContext';
import { useUserAlbum } from '../albumService';
import { 
  CollectorRankEntry, 
  CollectorSortCriteria, 
  subscribeCollectorsRanking, 
  sortCollectors, 
  syncUserCollectorStats 
} from '../collectorsService';

interface CollectorsRankingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAlbum?: () => void;
  onOpenAuth?: () => void;
}

export const CollectorsRankingModal: React.FC<CollectorsRankingModalProps> = ({
  isOpen,
  onClose,
  onOpenAlbum,
  onOpenAuth
}) => {
  const { user } = useAuth();
  const { cards: allCards } = useCards();
  const { album } = useUserAlbum(user?.uid);

  const [collectors, setCollectors] = useState<CollectorRankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [criteria, setCriteria] = useState<CollectorSortCriteria>('unique');
  const [isSyncing, setIsSyncing] = useState(false);

  // Escuta ranking de colecionadores em tempo real
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const unsubscribe = subscribeCollectorsRanking((entries) => {
      setCollectors(entries);
      setLoading(false);
    }, (err) => {
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

  // Ordena os colecionadores pelo critério selecionado
  const sortedCollectors = useMemo(() => {
    return sortCollectors(collectors, criteria);
  }, [collectors, criteria]);

  // Top 10 colecionadores
  const top10 = useMemo(() => {
    return sortedCollectors.slice(0, 10);
  }, [sortedCollectors]);

  // Posição do usuário logado no ranking
  const currentUserRank = useMemo(() => {
    if (!user) return null;
    const index = sortedCollectors.findIndex(c => c.userId === user.uid);
    if (index === -1) {
      // Se ainda não estiver na lista ou tem 0 cartas
      return {
        position: sortedCollectors.length + 1,
        entry: null
      };
    }
    return {
      position: index + 1,
      entry: sortedCollectors[index]
    };
  }, [sortedCollectors, user]);

  const handleManualSync = async () => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    setIsSyncing(true);
    await syncUserCollectorStats(user.uid, user, album, allCards);
    setIsSyncing(false);
  };

  if (!isOpen) return null;

  const top1 = top10[0] || null;
  const top2 = top10[1] || null;
  const top3 = top10[2] || null;
  const others = top10.slice(3);

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
      default:
        return `${entry.uniqueCards} cartas únicas (${entry.completionPercentage}%)`;
    }
  };

  return (
    <div className="fixed inset-0 z-[140] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-[#0a0c14] border border-amber-500/40 w-full max-w-5xl max-h-[92vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-amber-950/40 to-slate-950 flex flex-wrap items-center justify-between gap-4 shrink-0">
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
                  <Crown size={11} className="fill-amber-300" /> Top 10 Oficial
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Os jogadores com os maiores acervos físicos e variantes de Light Dark TCG
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

        {/* BARRA DE CRITÉRIOS DE ORDENAÇÃO */}
        <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between gap-3 overflow-x-auto scrollbar-thin shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mr-1 flex items-center gap-1 shrink-0">
              <TrendingUp size={12} className="text-amber-400" /> Critério:
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
            Total cadastrado: <b className="text-white">{collectors.length}</b> colecionadores
          </span>
        </div>

        {/* CONTEÚDO PRINCIPAL (PODIUM + LISTA) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#07090e] space-y-6 custom-scrollbar">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <RefreshCw size={36} className="animate-spin text-amber-400 mb-3" />
              <p className="text-slate-300 font-bold text-sm">Carregando ranking dos maiores colecionadores...</p>
            </div>
          ) : top10.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto mb-4">
                <Trophy size={32} />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Nenhum Colecionador Registrado Ainda</h4>
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
              {/* PODIUM (TOP 3) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 items-end pt-2 sm:pt-4">
                
                {/* 2º LUGAR (PRATA) */}
                {top2 ? (
                  <div className="order-2 md:order-1 bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-700/60 rounded-2xl p-4 text-center relative shadow-lg flex flex-col items-center">
                    <div className="absolute -top-3.5 px-3 py-0.5 rounded-full bg-slate-300 text-slate-950 font-black text-[11px] shadow-md flex items-center gap-1 border border-white">
                      <Medal size={12} className="fill-slate-950" /> 2º Lugar
                    </div>
                    
                    <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-300 overflow-hidden mt-2 mb-3 shadow-md flex items-center justify-center">
                      {top2.photoURL ? (
                        <img src={top2.photoURL} alt={top2.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-slate-700 flex items-center justify-center text-xl font-black text-slate-200">
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
                  </div>
                ) : (
                  <div className="order-2 md:order-1 h-36 border border-dashed border-slate-800 rounded-2xl flex items-center justify-center text-xs text-slate-600 font-bold">
                    2º Lugar Disponível
                  </div>
                )}

                {/* 1º LUGAR (OURO - CAMPEÃO) */}
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
                        <span className="font-bold text-amber-300">{top1.completionPercentage}%</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-amber-500/30">
                        <div 
                          className="bg-gradient-to-r from-amber-500 to-yellow-300 h-full rounded-full transition-all duration-500"
                          style={{ width: `${top1.completionPercentage}%` }}
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
                  </div>
                ) : (
                  <div className="order-3 h-36 border border-dashed border-slate-800 rounded-2xl flex items-center justify-center text-xs text-slate-600 font-bold">
                    3º Lugar Disponível
                  </div>
                )}

              </div>

              {/* LISTA DO 4º AO 10º LUGAR */}
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

                          {/* Estatísticas resumidas */}
                          <div className="flex items-center gap-3 sm:gap-6 text-right shrink-0">
                            <div className="hidden sm:block">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Progresso</span>
                              <span className="font-bold text-xs text-emerald-400 font-mono">{entry.completionPercentage}%</span>
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Únicas</span>
                              <span className="font-black text-xs sm:text-sm text-amber-300 font-mono">{entry.uniqueCards}</span>
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Cópias</span>
                              <span className="font-bold text-xs text-slate-200 font-mono">{entry.totalCopies}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER: SUA POSIÇÃO & AÇÕES */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-900/60 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 font-bold">
                {currentUserRank && currentUserRank.position <= 10 ? `#${currentUserRank.position}` : '—'}
              </div>
              <div>
                <span className="text-white font-bold block">
                  {currentUserRank?.entry 
                    ? `Sua posição: #${currentUserRank.position} no ranking (${currentUserRank.entry.uniqueCards} cartas únicas)`
                    : 'Você ainda não registrou cartas no seu Álbum'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {currentUserRank?.entry
                    ? `${currentUserRank.entry.totalCopies} cópias físicas no acervo • ${currentUserRank.entry.completionPercentage}% do jogo`
                    : 'Adicione cartas físicas ou decks no Álbum para aparecer no Top 10!'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400">
              <LogIn size={15} className="text-amber-400" />
              <span>Conecte sua conta para competir e figurar no Top 10 Colecionadores!</span>
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
