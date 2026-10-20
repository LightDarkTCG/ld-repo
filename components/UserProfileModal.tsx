import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  User as UserIcon, 
  Heart, 
  Search, 
  Plus, 
  Trash2, 
  Sparkles, 
  Trophy, 
  BookmarkCheck, 
  Flame, 
  Crown, 
  Layers, 
  ExternalLink,
  MessageSquare,
  Tag,
  Star,
  CheckCircle2,
  AlertCircle,
  Share2,
  Copy,
  Check,
  ShieldAlert,
  Award,
  Bell,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { User } from 'firebase/auth';
import { useAuth, isUserAdmin } from '../authService';
import { useCards, cleanCardCode } from '../CardContext';
import { useUserAlbum, FOIL_TYPES, FoilTypeInfo } from '../albumService';
import { setCollectorAmbassadorStatus } from '../collectorsService';
import { 
  WantedCardItem, 
  MostWantedCardSummary,
  useUserWishlist, 
  subscribeCommunityWishlists, 
  aggregateMostWantedCards,
  UserWishlistDoc
} from '../wishlistService';
import { CardData, AlbumVerificationRequest } from '../types';
import { 
  subscribePendingVerificationRequests, 
  subscribeAllVerificationRequests, 
  subscribeUserVerificationRequests,
  approveVerificationRequest, 
  rejectVerificationRequest, 
  deleteVerificationRequest 
} from '../rarePrintService';
import { LazyCardImage } from './LazyCardImage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface TargetUserProfile {
  userId: string;
  displayName: string;
  photoURL?: string;
  email?: string;
  isAmbassador?: boolean;
  ambassadorRole?: string;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetProfile?: TargetUserProfile | null;
  initialTab?: 'wishlist' | 'most_wanted' | 'stats';
  onOpenCardDetail?: (card: CardData) => void;
  onOpenAlbum?: () => void;
  onOpenAuth?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  targetProfile,
  initialTab = 'wishlist',
  onOpenCardDetail,
  onOpenAlbum,
  onOpenAuth
}) => {
  const { user: currentUser } = useAuth();
  const { cards: allCards } = useCards();

  // Se targetProfile for fornecido e diferente do currentUser, visualiza outro jogador
  const isMe = !targetProfile || (currentUser && targetProfile.userId === currentUser.uid);
  const activeUserId = isMe ? currentUser?.uid : targetProfile?.userId;
  const activeDisplayName = isMe 
    ? (currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Meu Perfil')
    : (targetProfile?.displayName || 'Jogador');
  const activePhotoURL = isMe ? currentUser?.photoURL : targetProfile?.photoURL;
  const activeEmail = isMe ? currentUser?.email : undefined;

  // Álbum do usuário logado (para saber se o usuário possui a carta que o outro procura)
  const { album: myAlbum, getQuantity: getMyQuantity } = useUserAlbum(currentUser?.uid);

  // Tab ativa
  const [activeTab, setActiveTab] = useState<'wishlist' | 'most_wanted' | 'stats' | 'verifications'>(initialTab);

  // Verificações de Tiragem Rara (Admin e Jogador)
  const [adminPendingRequests, setAdminPendingRequests] = useState<AlbumVerificationRequest[]>([]);
  const [adminAllRequests, setAdminAllRequests] = useState<AlbumVerificationRequest[]>([]);
  const [userRequests, setUserRequests] = useState<AlbumVerificationRequest[]>([]);
  const [verificationsFilter, setVerificationsFilter] = useState<'pending' | 'all'>('pending');
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);
  const [rejectPrompt, setRejectPrompt] = useState<{ id: string; cardName: string; userName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (isUserAdmin(currentUser)) {
      const unsubPending = subscribePendingVerificationRequests((reqs) => {
        setAdminPendingRequests(reqs);
      });
      const unsubAll = subscribeAllVerificationRequests((reqs) => {
        setAdminAllRequests(reqs);
      });
      return () => {
        unsubPending();
        unsubAll();
      };
    } else if (currentUser?.uid) {
      const unsubUser = subscribeUserVerificationRequests(currentUser.uid, (reqs) => {
        setUserRequests(reqs);
      });
      return () => unsubUser();
    }
  }, [isOpen, currentUser]);

  const handleApproveRequest = async (req: AlbumVerificationRequest) => {
    try {
      setProcessingReqId(req.id);
      await approveVerificationRequest(req, currentUser?.email || 'admin@lightdark.tcg');
      setVerificationFeedback(`Carta "${req.cardName}" aprovada e adicionada ao álbum de ${req.userName}!`);
      setTimeout(() => setVerificationFeedback(null), 4000);
    } catch (e: any) {
      console.error(e);
      alert('Erro ao aprovar solicitação: ' + e.message);
    } finally {
      setProcessingReqId(null);
    }
  };

  const handleRejectRequest = async () => {
    if (!rejectPrompt) return;
    try {
      setProcessingReqId(rejectPrompt.id);
      await rejectVerificationRequest(rejectPrompt.id, rejectReason, currentUser?.email || 'admin@lightdark.tcg');
      setVerificationFeedback(`Solicitação de ${rejectPrompt.userName} recusada.`);
      setTimeout(() => setVerificationFeedback(null), 4000);
      setRejectPrompt(null);
      setRejectReason('');
    } catch (e: any) {
      console.error(e);
      alert('Erro ao recusar solicitação: ' + e.message);
    } finally {
      setProcessingReqId(null);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!window.confirm('Excluir esta solicitação permanentemente?')) return;
    try {
      setProcessingReqId(id);
      await deleteVerificationRequest(id);
    } catch (e: any) {
      console.error(e);
      alert('Erro ao excluir solicitação: ' + e.message);
    } finally {
      setProcessingReqId(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab, targetProfile?.userId]);

  // Wishlist do usuário visualizado
  const { 
    wishlist: myWishlist, 
    addCard: addMyWishlistCard, 
    removeCard: removeMyWishlistCard 
  } = useUserWishlist(currentUser?.uid, currentUser);

  const [targetWishlist, setTargetWishlist] = useState<WantedCardItem[]>([]);
  const [loadingTargetWishlist, setLoadingTargetWishlist] = useState(false);

  // Status de Embaixador do Jogador
  const [isAmbassador, setIsAmbassador] = useState<boolean>(Boolean(targetProfile?.isAmbassador));
  const [ambassadorRole, setAmbassadorRole] = useState<string>(targetProfile?.ambassadorRole || 'Embaixador Oficial');
  const [isUpdatingAmbassador, setIsUpdatingAmbassador] = useState(false);

  useEffect(() => {
    if (!isOpen || !activeUserId) return;
    setIsAmbassador(Boolean(targetProfile?.isAmbassador));
    if (targetProfile?.ambassadorRole) {
      setAmbassadorRole(targetProfile.ambassadorRole);
    }
    const rankDocRef = doc(db, 'collectorsRanking', activeUserId);
    getDoc(rankDocRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setIsAmbassador(Boolean(data.isAmbassador));
        if (data.ambassadorRole) {
          setAmbassadorRole(data.ambassadorRole);
        }
      }
    }).catch(err => {
      console.warn('Erro ao carregar status de embaixador:', err);
    });
  }, [isOpen, activeUserId, targetProfile?.isAmbassador, targetProfile?.ambassadorRole]);

  // Carrega a wishlist de outro jogador caso não seja o usuário logado
  useEffect(() => {
    if (!isOpen || isMe || !activeUserId) return;
    setLoadingTargetWishlist(true);
    const docRef = doc(db, 'communityWishlists', activeUserId);
    getDoc(docRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setTargetWishlist(Array.isArray(data.cards) ? data.cards : []);
      } else {
        setTargetWishlist([]);
      }
    }).catch(err => {
      console.warn('Erro ao carregar wishlist do jogador:', err);
    }).finally(() => {
      setLoadingTargetWishlist(false);
    });
  }, [isOpen, isMe, activeUserId]);

  const displayedWishlist = isMe ? myWishlist : targetWishlist;

  // Comunidade: Cartas mais procuradas
  const [communityWishlists, setCommunityWishlists] = useState<UserWishlistDoc[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingCommunity(true);
    const unsubscribe = subscribeCommunityWishlists((list) => {
      setCommunityWishlists(list);
      setLoadingCommunity(false);
    }, () => {
      setLoadingCommunity(false);
    });
    return () => unsubscribe();
  }, [isOpen]);

  const mostWantedCards = useMemo(() => {
    return aggregateMostWantedCards(communityWishlists, allCards);
  }, [communityWishlists, allCards]);

  // Estados para modal interno "Adicionar Carta que Procuro"
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [searchCardTerm, setSearchCardTerm] = useState('');
  const [selectedCardToAdd, setSelectedCardToAdd] = useState<CardData | null>(null);
  const [foilPreference, setFoilPreference] = useState<string>('qualquer');
  const [notesInput, setNotesInput] = useState<string>('');
  const [priorityInput, setPriorityInput] = useState<'alta' | 'media' | 'baixa'>('media');
  const [quantityInput, setQuantityInput] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Filtro de cartas no modal de adição
  const filteredAvailableCards = useMemo(() => {
    if (!searchCardTerm.trim()) return allCards.slice(0, 40);
    const term = searchCardTerm.toLowerCase().trim();
    return allCards.filter(c => 
      c.name.toLowerCase().includes(term) || 
      (c.code && c.code.toLowerCase().includes(term)) ||
      (c.collection && c.collection.toLowerCase().includes(term)) ||
      (c.archetype && c.archetype.toLowerCase().includes(term))
    ).slice(0, 60);
  }, [allCards, searchCardTerm]);

  if (!isOpen) return null;

  const handleSaveWantedCard = async () => {
    if (!selectedCardToAdd || !currentUser) return;
    setIsSubmitting(true);
    try {
      await addMyWishlistCard(
        selectedCardToAdd,
        foilPreference,
        notesInput,
        quantityInput,
        priorityInput
      );
      setShowAddCardModal(false);
      setSelectedCardToAdd(null);
      setNotesInput('');
      setFoilPreference('qualquer');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyProfileWishlist = () => {
    const text = displayedWishlist.map((c, i) => 
      `${i + 1}. ${c.cardName} (${c.cardCode}) - ${c.foilWanted ? `Foil: ${c.foilWanted}` : 'Qualquer versão'}${c.notes ? ` [Obs: ${c.notes}]` : ''}`
    ).join('\n');
    navigator.clipboard.writeText(`Lista de Cartas que ${activeDisplayName} Procura:\n${text}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const getFoilBadge = (foilId?: string) => {
    if (!foilId || foilId === 'qualquer') {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
          Qualquer Versão
        </span>
      );
    }
    if (foilId === 'normal') {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
          Versão Comum (Não-Foil)
        </span>
      );
    }
    const found = FOIL_TYPES.find(f => f.id === foilId.toLowerCase());
    if (found) {
      return (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-1 ${found.badgeBg}`}>
          <Sparkles size={10} />
          Foil {found.name}
        </span>
      );
    }
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-200 border border-purple-700 font-bold">
        Foil {foilId}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[145] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-[#0b0d14] border border-purple-500/40 w-full max-w-5xl max-h-[92vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* HEADER DO PERFIL */}
        <div className="relative bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 p-4 sm:p-6 border-b border-purple-800/40 shrink-0">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 rounded-full transition z-10"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 p-0.5 shadow-xl shrink-0 overflow-hidden relative">
              {activePhotoURL ? (
                <img src={activePhotoURL} alt={activeDisplayName} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center text-2xl font-black text-purple-300">
                  {activeDisplayName[0]?.toUpperCase() || <UserIcon size={28} />}
                </div>
              )}
              {isMe && (
                <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full" title="Online" />
              )}
            </div>

            {/* Informações do Jogador */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white truncate max-w-md">
                  {activeDisplayName}
                </h2>
                {isMe ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-600/80 text-white font-bold border border-purple-400/50">
                    Sua Conta
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 font-bold border border-indigo-700/50">
                    Jogador da Comunidade
                  </span>
                )}

                {/* BADGE DE EMBAIXADOR OFICIAL */}
                {isAmbassador && (
                  <div 
                    className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500/25 via-yellow-500/25 to-amber-500/25 text-amber-300 border border-amber-400/60 text-xs font-black shadow-lg shadow-amber-950/40 animate-pulse"
                    title="Embaixador Oficial de Light Dark TCG (Galeria de Honra Exclusiva)"
                  >
                    <Crown size={12} className="text-amber-400 fill-amber-400" />
                    <span>{ambassadorRole || 'Embaixador Oficial'}</span>
                  </div>
                )}

                {/* BOTÃO EXCLUSIVO DE ADMINISTRADOR: NOMEAR / REMOVER EMBAIXADOR */}
                {isUserAdmin(currentUser) && activeUserId && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (isUpdatingAmbassador) return;
                      const nextStatus = !isAmbassador;
                      const confirmed = window.confirm(
                        nextStatus 
                          ? `Deseja nomear "${activeDisplayName}" como Embaixador Oficial do jogo?\n\nEle receberá a insígnia oficial e será movido para a Galeria de Embaixadores, sem disputar o pódio do ranking geral para garantir a justiça competitiva com os outros jogadores.`
                          : `Deseja remover o status de Embaixador de "${activeDisplayName}"? Ele retornará ao ranking geral de jogadores.`
                      );
                      if (!confirmed) return;
                      setIsUpdatingAmbassador(true);
                      try {
                        await setCollectorAmbassadorStatus(activeUserId, nextStatus, currentUser?.email || undefined);
                        setIsAmbassador(nextStatus);
                      } catch (e) {
                        console.error(e);
                        alert('Erro ao atualizar status de embaixador.');
                      } finally {
                        setIsUpdatingAmbassador(false);
                      }
                    }}
                    disabled={isUpdatingAmbassador}
                    className={`px-2.5 py-0.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 border shadow-sm ${
                      isAmbassador
                        ? 'bg-red-950/80 hover:bg-red-900 text-red-200 border-red-700/70'
                        : 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border-amber-500/70'
                    }`}
                    title="Função exclusiva do administrador: alternar status de Embaixador do jogo"
                  >
                    <Crown size={11} className={isAmbassador ? 'text-red-400' : 'text-amber-400'} />
                    <span>
                      {isUpdatingAmbassador 
                        ? 'Salvando...' 
                        : isAmbassador 
                        ? 'Remover Embaixador' 
                        : '⭐ Nomear Embaixador'}
                    </span>
                  </button>
                )}
              </div>

              {/* Descrição de Embaixador se ativo */}
              {isAmbassador && (
                <p className="text-[11px] text-amber-300/90 mt-1 font-medium flex items-center gap-1 justify-center sm:justify-start">
                  <Award size={12} className="text-amber-400 shrink-0" />
                  <span>Membro da Galeria de Honra dos Embaixadores de Light Dark TCG</span>
                </p>
              )}

              {activeEmail && (
                <p className="text-xs text-slate-400 mt-0.5 truncate">{activeEmail}</p>
              )}

              {/* Badges / Destaques do Perfil */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2.5">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-950/60 border border-purple-700/50 text-xs text-purple-200">
                  <Heart size={13} className="text-pink-400 fill-pink-400/40" />
                  <span className="font-bold">{displayedWishlist.length}</span>
                  <span className="text-[11px] text-purple-300/80">cartas procuradas</span>
                </div>

                {isMe && onOpenAlbum && (
                  <button
                    onClick={() => { onClose(); onOpenAlbum(); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 transition"
                  >
                    <BookmarkCheck size={13} className="text-emerald-400" />
                    <span>Ver Meu Álbum</span>
                  </button>
                )}

                {displayedWishlist.length > 0 && (
                  <button
                    onClick={handleCopyProfileWishlist}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition"
                    title="Copiar lista de cartas procuradas"
                  >
                    {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copiedLink ? 'Copiado!' : 'Copiar Lista'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* BANNER DE ALERTA DO ADMINISTRADOR: SOLICITAÇÕES PENDENTES */}
          {isUserAdmin(currentUser) && isMe && adminPendingRequests.length > 0 && (
            <div 
              onClick={() => setActiveTab('verifications')}
              className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/90 via-red-950/70 to-purple-950/90 border border-amber-500/60 flex items-center justify-between cursor-pointer hover:border-amber-400 transition shadow-xl group animate-in fade-in"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/60 flex items-center justify-center text-amber-300 shadow-md">
                  <ShieldAlert size={20} className="animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-black text-white group-hover:text-amber-200 transition flex items-center gap-1.5">
                    <span>
                      {adminPendingRequests.length === 1 
                        ? '1 solicitação de posse de tiragem rara aguarda sua conferência!' 
                        : `${adminPendingRequests.length} solicitações de posse de tiragem rara aguardam sua conferência!`}
                    </span>
                    <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-mono">
                      {adminPendingRequests.length}
                    </span>
                  </p>
                  <p className="text-[11px] text-amber-300/80">
                    Clique aqui para aprovar e ativar as cópias no álbum dos jogadores.
                  </p>
                </div>
              </div>
              <span className="text-xs font-black text-slate-950 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 rounded-xl shadow-md group-hover:brightness-110 transition flex items-center gap-1">
                <span>Verificar</span>
                <span>→</span>
              </span>
            </div>
          )}

          {/* Feedback de ação de verificação */}
          {verificationFeedback && (
            <div className="mt-3 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle size={16} className="text-emerald-400 shrink-0" />
              <span>{verificationFeedback}</span>
            </div>
          )}

          {/* ABAS DO PERFIL */}
          <div className="flex items-center gap-2 mt-5 border-t border-purple-900/30 pt-3 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab('wishlist')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition shrink-0 ${
                activeTab === 'wishlist'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg shadow-pink-950/40'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              <Heart size={14} className={activeTab === 'wishlist' ? 'fill-white' : 'text-pink-400'} />
              <span>{isMe ? 'Cartas que Procuro' : `Cartas que ${activeDisplayName.split(' ')[0]} Procura`}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 font-mono">
                {displayedWishlist.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('most_wanted')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition shrink-0 ${
                activeTab === 'most_wanted'
                  ? 'bg-gradient-to-r from-amber-600 to-red-600 text-white shadow-lg shadow-amber-950/40'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              <Flame size={14} className={activeTab === 'most_wanted' ? 'fill-white' : 'text-amber-400'} />
              <span>Cartas Mais Procuradas</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950/80 text-amber-300 border border-amber-600/40 font-mono">
                Geral
              </span>
            </button>

            {/* ABA DE VERIFICAÇÃO DE TIRAGENS RARAS */}
            {isMe && (
              <button
                onClick={() => setActiveTab('verifications')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition shrink-0 relative ${
                  activeTab === 'verifications'
                    ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-slate-950 font-black shadow-lg shadow-amber-950/50'
                    : isUserAdmin(currentUser)
                    ? 'bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-500/50'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                <ShieldAlert size={15} className={adminPendingRequests.length > 0 ? 'text-amber-300 animate-pulse' : ''} />
                <span>{isUserAdmin(currentUser) ? 'Verificações de Tiragem Rara' : 'Minhas Verificações'}</span>
                {isUserAdmin(currentUser) ? (
                  adminPendingRequests.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-black">
                      {adminPendingRequests.length}
                    </span>
                  )
                ) : (
                  userRequests.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px]">
                      {userRequests.length}
                    </span>
                  )
                )}
              </button>
            )}
          </div>
        </div>

        {/* CONTEÚDO DA ABA SELECIONADA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {/* TAB 1: CARTAS QUE PROCURO */}
          {activeTab === 'wishlist' && (
            <div>
              {/* Barra superior de ações */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Heart size={18} className="text-pink-400 fill-pink-400/30" />
                    <span>{isMe ? 'Minha Lista de Desejos (Cartas que Procuro)' : `Cartas que ${activeDisplayName} procura`}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isMe 
                      ? 'Adicione cartas que você deseja trocar ou comprar da comunidade, especificando o acabamento Foil se desejar.'
                      : 'Veja o que este jogador está buscando para propor trocas ou negociar cartas!'}
                  </p>
                </div>

                {isMe && currentUser && (
                  <button
                    onClick={() => {
                      setSelectedCardToAdd(null);
                      setSearchCardTerm('');
                      setShowAddCardModal(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-pink-950/40 transition"
                  >
                    <Plus size={16} />
                    <span>Adicionar Carta</span>
                  </button>
                )}
              </div>

              {/* LISTA DE CARTAS QUE PROCURO */}
              {loadingTargetWishlist ? (
                <div className="py-20 text-center text-slate-400 text-sm">Carregando cartas procuradas...</div>
              ) : displayedWishlist.length === 0 ? (
                <div className="py-16 px-4 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/30 flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-pink-950/50 border border-pink-700/40 flex items-center justify-center text-pink-400 mb-3">
                    <Heart size={26} />
                  </div>
                  <h4 className="text-base font-bold text-white mb-1">
                    {isMe ? 'Você ainda não adicionou cartas que procura' : `${activeDisplayName} ainda não listou cartas que procura`}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mb-4">
                    {isMe 
                      ? 'Monte sua wishlist para que outros duelistas saibam o que você precisa para completar seu deck ou coleção!'
                      : 'Este jogador ainda não adicionou itens na wishlist pessoal.'}
                  </p>
                  {isMe && (
                    <button
                      onClick={() => {
                        setSelectedCardToAdd(null);
                        setSearchCardTerm('');
                        setShowAddCardModal(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
                    >
                      <Plus size={14} /> Adicionar Minha Primeira Carta
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {displayedWishlist.map((item, idx) => {
                    const cardCode = item.cardCode;
                    const officialCard = allCards.find(c => c.code === cardCode || c.id === cardCode);
                    const isOwnedByMe = isMe ? false : (getMyQuantity(officialCard || cardCode) > 0);

                    return (
                      <div 
                        key={`${item.cardCode}-${idx}`}
                        className="bg-slate-900/80 border border-slate-800 hover:border-purple-600/50 rounded-2xl p-3 flex flex-col justify-between transition group relative shadow-md"
                      >
                        {/* Imagem e Detalhes */}
                        <div>
                          <div 
                            className="aspect-[5/7] w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 mb-2.5 relative cursor-pointer"
                            onClick={() => {
                              if (officialCard && onOpenCardDetail) onOpenCardDetail(officialCard);
                            }}
                          >
                            {item.imageUrl || officialCard?.imageUrl ? (
                              <LazyCardImage 
                                src={item.imageUrl || officialCard?.imageUrl || ''} 
                                alt={item.cardName} 
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-xs text-slate-400">
                                <span className="font-bold">{item.cardName}</span>
                                <span className="text-[10px] text-purple-400">{item.cardCode}</span>
                              </div>
                            )}

                            {/* Badge se o jogador atual possui para trocar */}
                            {!isMe && isOwnedByMe && (
                              <div className="absolute top-2 left-2 bg-emerald-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-md flex items-center gap-1 border border-emerald-400/50">
                                <CheckCircle2 size={11} /> Você tem no álbum!
                              </div>
                            )}

                            {/* Prioridade */}
                            {item.priority === 'alta' && (
                              <div className="absolute top-2 right-2 bg-red-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-md">
                                Urgente
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <h4 
                              className="font-bold text-sm text-white truncate cursor-pointer hover:text-purple-300 transition"
                              onClick={() => {
                                if (officialCard && onOpenCardDetail) onOpenCardDetail(officialCard);
                              }}
                              title={item.cardName}
                            >
                              {item.cardName}
                            </h4>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mt-0.5">
                              <span>{item.cardCode}</span>
                              {item.cardCollection && (
                                <span className="text-purple-400 truncate max-w-[100px]">{item.cardCollection}</span>
                              )}
                            </div>
                          </div>

                          {/* Acabamento Foil desejado */}
                          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-400">Deseja:</span>
                            {getFoilBadge(item.foilWanted)}
                          </div>

                          {/* Notas / Observação de troca */}
                          {item.notes && (
                            <div className="mt-2 p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-1.5">
                              <MessageSquare size={12} className="text-purple-400 mt-0.5 shrink-0" />
                              <span className="italic leading-relaxed break-words">{item.notes}</span>
                            </div>
                          )}
                        </div>

                        {/* Botão de remoção (se for o dono) */}
                        {isMe && (
                          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-end">
                            <button
                              onClick={() => removeMyWishlistCard(item.cardCode)}
                              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/50 px-2 py-1 rounded-lg transition flex items-center gap-1 font-bold"
                              title="Remover das cartas que procuro"
                            >
                              <Trash2 size={12} /> Remover
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CARTAS MAIS PROCURADAS (COMUNIDADE) */}
          {activeTab === 'most_wanted' && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Flame size={20} className="text-amber-400 fill-amber-400/30" />
                    <span>Cartas Mais Procuradas da Comunidade</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Descubra quais cartas estão em maior demanda entre todos os jogadores. Veja quem está buscando cada carta para realizar trocas!
                  </p>
                </div>

                <div className="text-xs font-mono text-amber-300 bg-amber-950/60 border border-amber-600/40 px-3 py-1.5 rounded-xl">
                  {mostWantedCards.length} cartas em busca ativa
                </div>
              </div>

              {loadingCommunity ? (
                <div className="py-20 text-center text-slate-400 text-sm">Carregando cartas mais procuradas...</div>
              ) : mostWantedCards.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/30">
                  <Flame size={32} className="mx-auto text-amber-500 mb-2" />
                  <p className="text-slate-300 font-bold">Nenhuma carta procurada ainda na comunidade</p>
                  <p className="text-xs text-slate-500 mt-1">Seja o primeiro a adicionar uma carta que procura na sua aba de perfil!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {mostWantedCards.map((summary, idx) => {
                    const officialCard = allCards.find(c => c.code === summary.cardCode || c.id === summary.cardCode);
                    const rank = idx + 1;

                    return (
                      <div
                        key={summary.cardCode}
                        className={`p-3 sm:p-4 rounded-2xl border transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                          rank === 1 
                            ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/20 border-amber-500/50 shadow-lg' 
                            : rank <= 3 
                            ? 'bg-slate-900/90 border-amber-800/40' 
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Imagem + Informações da Carta */}
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                          {/* Posição no Ranking de Procura */}
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black font-mono text-xs shrink-0 ${
                            rank === 1 ? 'bg-amber-500 text-slate-950' : rank === 2 ? 'bg-slate-300 text-slate-950' : rank === 3 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}>
                            #{rank}
                          </div>

                          {/* Miniatura da Carta */}
                          <div 
                            className="w-12 h-16 sm:w-14 sm:h-20 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shrink-0 cursor-pointer shadow-md"
                            onClick={() => {
                              if (officialCard && onOpenCardDetail) onOpenCardDetail(officialCard);
                            }}
                          >
                            {summary.imageUrl ? (
                              <LazyCardImage src={summary.imageUrl} alt={summary.cardName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 text-center p-1 font-bold">
                                {summary.cardName}
                              </div>
                            )}
                          </div>

                          {/* Texto */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 
                                className="font-bold text-sm sm:text-base text-white hover:text-amber-300 transition cursor-pointer truncate"
                                onClick={() => {
                                  if (officialCard && onOpenCardDetail) onOpenCardDetail(officialCard);
                                }}
                              >
                                {summary.cardName}
                              </h4>
                              {summary.type && (
                                <span className="text-[10px] px-2 py-0.2 rounded-md bg-purple-950/60 border border-purple-800/60 text-purple-300">
                                  {summary.type}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                              <span>{summary.cardCode}</span>
                              {summary.cardCollection && (
                                <span>• <span className="text-slate-300">{summary.cardCollection}</span></span>
                              )}
                            </div>

                            {/* Demanda badge */}
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs font-bold text-amber-300 flex items-center gap-1 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-600/40">
                                <Flame size={12} className="fill-amber-400" />
                                {summary.wantedCount} {summary.wantedCount === 1 ? 'duelista procurando' : 'duelistas procurando'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Jogadores Interessados (Quem Procura) */}
                        <div className="w-full md:w-auto md:max-w-md bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 shrink-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1">
                            <UserIcon size={11} className="text-purple-400" /> Jogadores interessados:
                          </span>

                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                            {summary.interestedPlayers.map((player, pIdx) => (
                              <div
                                key={`${player.userId}-${pIdx}`}
                                className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5"
                                title={player.notes ? `Observação: ${player.notes}` : undefined}
                              >
                                <span className="font-bold text-white">{player.userName}</span>
                                {player.foilWanted && player.foilWanted !== 'qualquer' && (
                                  <span className="text-[9px] text-pink-300 bg-pink-950/70 px-1 py-0.2 rounded">
                                    {player.foilWanted}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Ações */}
                        {currentUser && (
                          <div className="shrink-0 flex items-center gap-2">
                            <button
                              onClick={() => {
                                if (officialCard) {
                                  addMyWishlistCard(officialCard, 'qualquer', '', 1, 'media');
                                }
                              }}
                              className="px-3 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-800 text-purple-200 border border-purple-700/60 text-xs font-bold transition flex items-center gap-1"
                              title="Adicionar também à minha lista de desejos"
                            >
                              <Heart size={12} className="text-pink-400" />
                              <span>Eu Também Quero</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VERIFICAÇÕES DE TIRAGEM RARA */}
          {activeTab === 'verifications' && (
            <div>
              {/* Top Banner & Info */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <ShieldAlert size={20} className="text-amber-400" />
                    <span>
                      {isUserAdmin(currentUser) 
                        ? 'Painel de Verificação de Tiragens Raras (1/1 e Limitadas)' 
                        : 'Minhas Solicitações de Verificação de Tiragem Rara'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
                    {isUserAdmin(currentUser)
                      ? 'Cartas com tiragem limitada ou cópias únicas (1/1) exigem sua conferência física antes de serem ativadas no álbum dos jogadores. Ao aprovar, a carta é creditada automaticamente no perfil do usuário.'
                      : 'Cartas com tiragem limitada exigem que o Administrador confirme a posse física antes de liberar as cópias no seu álbum.'}
                  </p>
                </div>

                {/* Filtro para Admin: Pendentes vs Todas */}
                {isUserAdmin(currentUser) && (
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setVerificationsFilter('pending')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        verificationsFilter === 'pending'
                          ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>Pendentes</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        verificationsFilter === 'pending' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {adminPendingRequests.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVerificationsFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        verificationsFilter === 'all'
                          ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>Histórico Geral</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        verificationsFilter === 'all' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {adminAllRequests.length}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Lista de Requisições */}
              {(() => {
                const listToDisplay = isUserAdmin(currentUser)
                  ? (verificationsFilter === 'pending' ? adminPendingRequests : adminAllRequests)
                  : userRequests;

                if (listToDisplay.length === 0) {
                  return (
                    <div className="py-16 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/30 flex flex-col items-center">
                      <div className="w-14 h-14 rounded-full bg-amber-950/40 border border-amber-600/40 flex items-center justify-center text-amber-400 mb-3 shadow-lg">
                        <ShieldAlert size={28} />
                      </div>
                      <h4 className="text-base font-bold text-white mb-1">
                        {isUserAdmin(currentUser)
                          ? (verificationsFilter === 'pending' ? 'Nenhuma solicitação pendente no momento!' : 'Nenhuma solicitação registrada')
                          : 'Você não tem solicitações de tiragem rara'}
                      </h4>
                      <p className="text-xs text-slate-400 max-w-md">
                        {isUserAdmin(currentUser)
                          ? 'Quando jogadores tentarem adicionar cartas de tiragem rara ao álbum, a notificação com os dados aparecerá aqui instantaneamente.'
                          : 'Ao tentar adicionar uma carta com tiragem única ou limitada no catálogo, você poderá solicitar a verificação por aqui.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {listToDisplay.map((req) => {
                      const officialCard = allCards.find(c => c.code === req.cardCode || c.id === req.cardCode);
                      const isPending = req.status === 'pending';
                      const isApproved = req.status === 'approved';
                      const isRejected = req.status === 'rejected';

                      return (
                        <div
                          key={req.id}
                          className={`p-4 rounded-2xl border transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                            isPending
                              ? 'bg-amber-950/20 border-amber-500/50 shadow-lg shadow-amber-950/30'
                              : isApproved
                              ? 'bg-emerald-950/20 border-emerald-600/40'
                              : 'bg-red-950/20 border-red-800/40'
                          }`}
                        >
                          {/* Card & Requester Info */}
                          <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                            {/* Card Thumbnail */}
                            <div
                              className="w-14 h-20 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 cursor-pointer shadow-md relative"
                              onClick={() => {
                                if (officialCard && onOpenCardDetail) onOpenCardDetail(officialCard);
                              }}
                            >
                              {req.cardImageUrl ? (
                                <LazyCardImage src={req.cardImageUrl} alt={req.cardName} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 text-center p-1 font-bold">
                                  {req.cardName}
                                </div>
                              )}
                              <div className="absolute top-1 right-1 bg-amber-500 text-slate-950 text-[9px] font-black px-1 rounded shadow">
                                {req.maxPrintCopies === 1 ? '1/1' : `${req.maxPrintCopies || 1}ex`}
                              </div>
                            </div>

                            {/* Details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4
                                  className="font-bold text-sm sm:text-base text-white hover:text-amber-300 transition cursor-pointer truncate"
                                  onClick={() => {
                                    if (officialCard && onOpenCardDetail) onOpenCardDetail(officialCard);
                                  }}
                                >
                                  {req.cardName}
                                </h4>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                                  {req.maxPrintCopies === 1 ? 'Cópia Única Impressa' : `Tiragem Limitada (${req.maxPrintCopies || 1})`}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5 flex-wrap">
                                <span>{req.cardCode}</span>
                                {req.cardCollection && (
                                  <span>• <span className="text-slate-300">{req.cardCollection}</span></span>
                                )}
                                <span>• Frame {req.cardFrame || 'Moderno'}</span>
                              </div>

                              {/* Solicitante */}
                              <div className="mt-2 flex items-center gap-2 text-xs text-slate-300 bg-slate-950/70 px-2.5 py-1.5 rounded-xl border border-slate-800/80 w-fit">
                                <UserIcon size={12} className="text-purple-400 shrink-0" />
                                <span>Jogador: <strong className="text-white">{req.userName}</strong> ({req.userEmail})</span>
                              </div>

                              {/* Prova / Observação */}
                              {req.proofNote && (
                                <p className="mt-1.5 text-xs text-amber-200/90 italic bg-amber-950/40 border border-amber-900/50 rounded-lg p-2 max-w-xl">
                                  <strong>Observação do Jogador:</strong> "{req.proofNote}"
                                </p>
                              )}

                              {/* Data de envio */}
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500">
                                <Clock size={11} />
                                <span>Solicitado em: {new Date(req.requestedAt).toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                          </div>

                          {/* Status & Action Buttons */}
                          <div className="shrink-0 flex flex-col sm:flex-row md:flex-col items-end gap-2 w-full md:w-auto">
                            {/* Status Badge */}
                            <div>
                              {isPending && (
                                <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/50 text-xs font-bold flex items-center gap-1.5">
                                  <Clock size={13} className="animate-spin text-amber-400" />
                                  <span>Aguardando Verificação</span>
                                </span>
                              )}
                              {isApproved && (
                                <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 text-xs font-bold flex items-center gap-1.5">
                                  <CheckCircle size={13} />
                                  <span>Aprovado no Álbum</span>
                                </span>
                              )}
                              {isRejected && (
                                <span className="px-3 py-1 rounded-xl bg-red-500/20 text-red-300 border border-red-500/50 text-xs font-bold flex items-center gap-1.5" title={req.rejectReason || undefined}>
                                  <XCircle size={13} />
                                  <span>Recusado {req.rejectReason ? `(${req.rejectReason})` : ''}</span>
                                </span>
                              )}
                            </div>

                            {/* Admin Actions */}
                            {isUserAdmin(currentUser) && isPending && (
                              <div className="flex items-center gap-2 mt-1">
                                <button
                                  type="button"
                                  onClick={() => handleApproveRequest(req)}
                                  disabled={processingReqId === req.id}
                                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/60 transition flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  <Check size={14} />
                                  <span>{processingReqId === req.id ? 'Aprovando...' : 'Aprovar Carta'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRejectPrompt({ id: req.id, cardName: req.cardName, userName: req.userName })}
                                  disabled={processingReqId === req.id}
                                  className="px-3 py-1.5 rounded-xl bg-red-950 hover:bg-red-900 text-red-300 border border-red-700/60 text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                                >
                                  <X size={14} />
                                  <span>Recusar</span>
                                </button>
                              </div>
                            )}

                            {/* Excluir registro do histórico */}
                            {isUserAdmin(currentUser) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteRequest(req.id)}
                                disabled={processingReqId === req.id}
                                className="text-[11px] text-slate-500 hover:text-red-400 transition flex items-center gap-1 mt-1"
                                title="Excluir este registro permanentemente"
                              >
                                <Trash2 size={12} />
                                <span>Remover Registro</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" />
            <span>As listas de cartas procuradas sincronizam em tempo real entre todos os duelistas.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* MODAL INTERNO: ADICIONAR CARTA QUE PROCURO */}
      {showAddCardModal && (
        <div className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3">
          <div 
            className="bg-[#121520] border border-pink-500/40 w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 bg-gradient-to-r from-pink-950 to-purple-950 border-b border-pink-800/40 flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Heart size={18} className="text-pink-400 fill-pink-400" />
                <span>Adicionar Carta às "Cartas que Procuro"</span>
              </h3>
              <button onClick={() => setShowAddCardModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-4">
              {/* Passo 1: Selecionar a carta */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  1. Selecione a Carta:
                </label>
                <div className="relative mb-2">
                  <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar pelo nome, código ou coleção..."
                    value={searchCardTerm}
                    onChange={e => setSearchCardTerm(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-pink-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto custom-scrollbar border border-slate-800 rounded-xl p-2 bg-slate-950">
                  {filteredAvailableCards.map((card) => {
                    const isSelected = selectedCardToAdd?.code === card.code;
                    return (
                      <button
                        key={card.code}
                        type="button"
                        onClick={() => setSelectedCardToAdd(card)}
                        className={`p-2 rounded-lg text-left transition border flex items-center gap-2 ${
                          isSelected
                            ? 'bg-pink-950 border-pink-500 text-white shadow-md'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="w-8 h-11 bg-slate-800 rounded overflow-hidden shrink-0">
                          {card.imageUrl ? (
                            <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] font-bold">LDT</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate leading-tight">{card.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">{card.code}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedCardToAdd && (
                <div className="p-3 bg-purple-950/40 border border-purple-600/40 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-14 bg-slate-900 rounded overflow-hidden shrink-0 border border-purple-500/40">
                    {selectedCardToAdd.imageUrl && (
                      <img src={selectedCardToAdd.imageUrl} alt={selectedCardToAdd.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-pink-300 font-bold uppercase tracking-wider block">Carta Selecionada:</span>
                    <span className="font-bold text-sm text-white block truncate">{selectedCardToAdd.name}</span>
                    <span className="text-xs text-slate-400 font-mono">{selectedCardToAdd.code} • {selectedCardToAdd.collection}</span>
                  </div>
                </div>
              )}

              {/* Passo 2: Preferência de Foil */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1.5 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-yellow-400" />
                  <span>2. Preferência de Acabamento Foil (Opcional):</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFoilPreference('qualquer')}
                    className={`p-2 rounded-xl text-xs font-bold border transition text-left ${
                      foilPreference === 'qualquer'
                        ? 'bg-purple-600 border-purple-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    Qualquer Acabamento
                  </button>
                  <button
                    type="button"
                    onClick={() => setFoilPreference('normal')}
                    className={`p-2 rounded-xl text-xs font-bold border transition text-left ${
                      foilPreference === 'normal'
                        ? 'bg-purple-600 border-purple-400 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    Apenas Comum (Não-Foil)
                  </button>
                  {FOIL_TYPES.map(foil => (
                    <button
                      key={foil.id}
                      type="button"
                      onClick={() => setFoilPreference(foil.id)}
                      className={`p-2 rounded-xl text-xs font-bold border transition text-left flex items-center justify-between ${
                        foilPreference === foil.id
                          ? `${foil.badgeBg} border-2 ${foil.border} text-white shadow-md`
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>Foil {foil.name}</span>
                      <Sparkles size={11} className={foil.color} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Passo 3: Observações de Troca */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  3. Observação para Negociação / Troca (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ex: Troco por cópias de Mahina, pago no Pix, preciso urgente..."
                  value={notesInput}
                  onChange={e => setNotesInput(e.target.value)}
                  maxLength={120}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-pink-500 outline-none"
                />
              </div>

              {/* Prioridade */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-300 block mb-1">Prioridade:</label>
                  <select
                    value={priorityInput}
                    onChange={e => setPriorityInput(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="alta">Alta (Preciso muito / Urgente)</option>
                    <option value="media">Média (Interesse padrão)</option>
                    <option value="baixa">Baixa (Se alguém tiver disponível)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddCardModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveWantedCard}
                disabled={!selectedCardToAdd || isSubmitting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg transition flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>{isSubmitting ? 'Salvando...' : 'Adicionar à Lista'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RECUSA COM MOTIVO */}
      {rejectPrompt && (
        <div className="fixed inset-0 z-[160] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-[#121520] border border-red-500/50 w-full max-w-md rounded-2xl shadow-2xl p-5 flex flex-col gap-4 text-white">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-700/50 flex items-center justify-center">
                <XCircle size={22} />
              </div>
              <div>
                <h4 className="text-base font-black text-white">Recusar Solicitação de Posse</h4>
                <p className="text-xs text-slate-400">
                  {rejectPrompt.cardName} para {rejectPrompt.userName}
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Motivo da recusa (opcional para o jogador):
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex: Foto do card físico não enviada, número de série não confere, etc."
                className="w-full h-24 bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setRejectPrompt(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRejectRequest}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-950/60 transition"
              >
                Confirmar Recusa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
