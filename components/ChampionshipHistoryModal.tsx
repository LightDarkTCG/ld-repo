import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Crown, 
  Medal, 
  X, 
  Sparkles, 
  Calendar, 
  Users, 
  ExternalLink, 
  ShieldCheck, 
  Swords, 
  LogIn, 
  RefreshCw 
} from 'lucide-react';
import { useAuth } from '../authService';
import { UserChampionshipHistoryEntry, fetchUserChampionshipHistory } from '../tournamentService';

interface ChampionshipHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTournament?: (tournamentId: string) => void;
  onOpenAuth?: () => void;
}

export const ChampionshipHistoryModal: React.FC<ChampionshipHistoryModalProps> = ({
  isOpen,
  onClose,
  onOpenTournament,
  onOpenAuth
}) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<UserChampionshipHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    if (!user) {
      setHistory([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchUserChampionshipHistory(user.uid);
      setHistory(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, user?.uid]);

  if (!isOpen) return null;

  // Estatísticas do jogador
  const championshipsCount = history.length;
  const titlesCount = history.filter(h => h.rank === 1).length;
  const runnerUpCount = history.filter(h => h.rank === 2).length;
  const podiumCount = history.filter(h => h.rank <= 3).length;
  const officialCount = history.filter(h => h.isOfficial).length;

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-[#0b0e17] border border-amber-500/40 w-full max-w-4xl max-h-[92vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-amber-950/40 to-slate-950 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-950/80 shrink-0 border border-amber-300">
              <Trophy size={26} className="fill-current text-slate-950" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Histórico de Campeonatos
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Seus títulos, pódios e participações em torneios de Light Dark TCG
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={loadHistory}
                disabled={loading}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition"
                title="Recarregar histórico"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin text-amber-400' : ''} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Fechar"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* RESUMO DE CONQUISTAS (TROPHY ROOM) */}
        {user && (
          <div className="p-4 bg-slate-950/90 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4 shrink-0">
            <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-3 text-center">
              <span className="text-[10px] text-amber-400 uppercase font-black tracking-wider block">Títulos (1º Lugar)</span>
              <div className="text-xl sm:text-2xl font-black text-amber-300 font-mono mt-0.5 flex items-center justify-center gap-1">
                <Crown size={18} className="fill-amber-400 text-amber-400" />
                <span>{titlesCount}</span>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3 text-center">
              <span className="text-[10px] text-slate-300 uppercase font-black tracking-wider block">Vice-Campeão</span>
              <div className="text-xl sm:text-2xl font-black text-slate-200 font-mono mt-0.5 flex items-center justify-center gap-1">
                <Medal size={18} className="fill-slate-300 text-slate-300" />
                <span>{runnerUpCount}</span>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-purple-500/30 rounded-xl p-3 text-center">
              <span className="text-[10px] text-purple-300 uppercase font-black tracking-wider block">Pódios (Top 3)</span>
              <div className="text-xl sm:text-2xl font-black text-purple-300 font-mono mt-0.5">
                {podiumCount}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Torneios Oficiais</span>
              <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono mt-0.5 flex items-center justify-center gap-1">
                <ShieldCheck size={18} />
                <span>{officialCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* LISTA DE CAMPEONATOS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#07090e] space-y-3.5 custom-scrollbar">
          {!user ? (
            <div className="py-20 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto mb-4">
                <LogIn size={32} />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Conecte sua Conta</h4>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Entre com sua conta Google para salvar e visualizar todo o seu histórico oficial de torneios e títulos de Light Dark TCG!
              </p>
              {onOpenAuth && (
                <button
                  onClick={() => { onOpenAuth(); }}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-lg shadow-purple-950/60 active:scale-95"
                >
                  Entrar na Minha Conta
                </button>
              )}
            </div>
          ) : loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <RefreshCw size={36} className="animate-spin text-amber-400 mb-3" />
              <p className="text-slate-300 font-bold text-sm">Carregando histórico de torneios...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-20 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto mb-4">
                <Swords size={32} />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Nenhum Torneio Registrado Ainda</h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Participe de torneios, vincule sua conta ao seu participante e quando o campeonato for finalizado, seu resultado será gravado aqui automaticamente!
              </p>
            </div>
          ) : (
            history.map((entry) => {
              const isChamp = entry.rank === 1;
              const isVice = entry.rank === 2;
              const isThird = entry.rank === 3;

              return (
                <div
                  key={entry.id}
                  className={`p-4 sm:p-5 rounded-2xl transition border relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    entry.isOfficial
                      ? 'bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-950 border-2 border-amber-400/80 shadow-xl shadow-amber-950/30'
                      : isChamp
                      ? 'bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/60 shadow-lg'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* BADGE DESTAQUE OFICIAL */}
                  {entry.isOfficial && (
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-yellow-500 text-slate-950 text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-bl-xl flex items-center gap-1 shadow-md">
                      <Crown size={11} className="fill-slate-950" /> TORNEIO OFICIAL
                    </div>
                  )}

                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    {/* Medalha / Posição */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                      isChamp
                        ? 'bg-gradient-to-br from-amber-500 to-yellow-500 text-slate-950 border-amber-300 shadow-md shadow-amber-950/60'
                        : isVice
                        ? 'bg-slate-300 text-slate-950 border-white shadow-md'
                        : isThird
                        ? 'bg-amber-800 text-white border-amber-600'
                        : 'bg-slate-800 text-slate-400 border-slate-700 font-mono font-bold'
                    }`}>
                      {isChamp ? (
                        <Crown size={22} className="fill-current" />
                      ) : isVice || isThird ? (
                        <Medal size={22} className="fill-current" />
                      ) : (
                        <span className="text-sm">#{entry.rank}</span>
                      )}
                    </div>

                    {/* Detalhes do Torneio */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm sm:text-base font-black text-white truncate max-w-sm">
                          {entry.tournamentName}
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isChamp 
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {entry.rankLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap font-medium">
                        <span className="flex items-center gap-1">
                          <Users size={12} className="text-slate-500" />
                          <span>{entry.totalParticipants} participantes</span>
                        </span>
                        <span>•</span>
                        <span>{entry.wins}V - {entry.losses}D - {entry.ties}E</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-slate-500" />
                          <span>
                            {entry.completedAt ? new Date(entry.completedAt).toLocaleDateString('pt-BR') : 'Recente'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ação */}
                  {onOpenTournament && (
                    <button
                      onClick={() => { onOpenTournament(entry.tournamentId); }}
                      className="self-end sm:self-center px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 shrink-0"
                    >
                      <ExternalLink size={13} />
                      <span>Ver Chave</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
          <span>Total de participações: <b className="text-white">{championshipsCount}</b></span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
