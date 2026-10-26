import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Users,
  Heart,
  Copy,
  Check,
  Play,
  Shuffle,
  Sparkles,
  Search,
  Plus,
  Trash2,
  Eye,
  Layers,
  Crown,
  ShieldCheck,
  BookOpen
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { CardData } from '../types';
import { useAuth } from '../authService';
import { cleanCardCode } from '../CardContext';
import { decodeDeckCode, encodeDeckCode, parseDeckFromCode } from '../deckUtils';
import { MulliganSimulator } from './MulliganSimulatorModal';
import { CardDetailModal } from './CardDetailModal';

export interface PublicCommunityDeck {
  id: string;
  name: string;
  heroName?: string;
  archetype?: string;
  strategyGuide?: string;
  deckCode?: string;
  mainDeckCodes: string[];
  sideDeckCodes: string[];
  cardCount: number;
  coverImageUrl?: string;
  userId?: string;
  authorName?: string;
  authorAvatar?: string;
  userEmail?: string;
  isOfficialMeta?: boolean;
  likesCount?: number;
  likedBy?: string[];
  createdAt?: any;
  updatedAt?: any;
}

interface CommunityDecksModalProps {
  isOpen: boolean;
  onClose: () => void;
  allCards: CardData[];
  currentMainDeck?: CardData[];
  currentSideDeck?: CardData[];
  onLoadDeck?: (mainDeck: CardData[], sideDeck: CardData[]) => void;
  onOpenAuth?: () => void;
}

export const CommunityDecksModal: React.FC<CommunityDecksModalProps> = ({
  isOpen,
  onClose,
  allCards,
  currentMainDeck = [],
  currentSideDeck = [],
  onLoadDeck,
  onOpenAuth
}) => {
  const { user, isAdmin } = useAuth();
  const [decks, setDecks] = useState<PublicCommunityDeck[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<'browse' | 'publish'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'likes' | 'recent'>('likes');
  const [onlyOfficial, setOnlyOfficial] = useState(false);

  const [selectedDeck, setSelectedDeck] = useState<PublicCommunityDeck | null>(null);
  const [mulliganTestDeck, setMulliganTestDeck] = useState<{
    main: CardData[];
    side: CardData[];
    title: string;
  } | null>(null);
  const [inspectCard, setInspectCard] = useState<CardData | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Publish Form State
  const [deckName, setDeckName] = useState('');
  const [deckArchetype, setDeckArchetype] = useState('');
  const [strategyGuide, setStrategyGuide] = useState('');
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [useBuilderDeck, setUseBuilderDeck] = useState(true);
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, 'communityDecks'),
      (snap) => {
        const list: PublicCommunityDeck[] = [];
        snap.forEach((d) => {
          const data = d.data() as PublicCommunityDeck;
          if (data && Array.isArray(data.mainDeckCodes) && data.mainDeckCodes.length > 0) {
            list.push({ ...data, id: d.id });
          }
        });
        setDecks(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Erro ao carregar communityDecks:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [isOpen]);

  // Helper to resolve CardData[] from a PublicCommunityDeck
  const resolveDeckCards = (pubDeck: PublicCommunityDeck) => {
    if (pubDeck.deckCode) {
      const decoded = decodeDeckCode(pubDeck.deckCode, allCards);
      if (decoded.main.length > 0) {
        return { main: decoded.main, side: decoded.side };
      }
    }
    const main: CardData[] = [];
    (pubDeck.mainDeckCodes || []).forEach((code) => {
      const cleanTarget = cleanCardCode(code).toLowerCase();
      const match =
        allCards.find((c) => !c.isVariation && cleanCardCode(c.code).toLowerCase() === cleanTarget) ||
        allCards.find((c) => cleanCardCode(c.code).toLowerCase() === cleanTarget);
      if (match) main.push(match);
    });

    const side: CardData[] = [];
    (pubDeck.sideDeckCodes || []).forEach((code) => {
      const cleanTarget = cleanCardCode(code).toLowerCase();
      const match =
        allCards.find((c) => !c.isVariation && cleanCardCode(c.code).toLowerCase() === cleanTarget) ||
        allCards.find((c) => cleanCardCode(c.code).toLowerCase() === cleanTarget);
      if (match) side.push(match);
    });

    return { main, side };
  };

  const filteredDecks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = decks.filter((d) => {
      if (onlyOfficial && !d.isOfficialMeta && d.userEmail !== 'viniciuspdiasuzumaki@gmail.com') {
        return false;
      }
      if (q) {
        const hay = `${d.name || ''} ${d.heroName || ''} ${d.archetype || ''} ${
          d.authorName || ''
        } ${d.strategyGuide || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'likes') {
        const lA = a.likesCount || (a.likedBy ? a.likedBy.length : 0);
        const lB = b.likesCount || (b.likedBy ? b.likedBy.length : 0);
        if (lB !== lA) return lB - lA;
      }
      const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
      const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
      return tB - tA;
    });

    return list;
  }, [decks, searchQuery, sortBy, onlyOfficial]);

  const handleToggleLike = async (pubDeck: PublicCommunityDeck) => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    const likedBy = Array.isArray(pubDeck.likedBy) ? [...pubDeck.likedBy] : [];
    const alreadyLiked = likedBy.includes(user.uid);
    const nextLikedBy = alreadyLiked
      ? likedBy.filter((id) => id !== user.uid)
      : [...likedBy, user.uid];

    try {
      await updateDoc(doc(db, 'communityDecks', pubDeck.id), {
        likedBy: nextLikedBy,
        likesCount: nextLikedBy.length
      });
      if (selectedDeck && selectedDeck.id === pubDeck.id) {
        setSelectedDeck({
          ...selectedDeck,
          likedBy: nextLikedBy,
          likesCount: nextLikedBy.length
        });
      }
    } catch (e) {
      console.error('Erro ao curtir deck:', e);
    }
  };

  const handleCopyCode = (pubDeck: PublicCommunityDeck) => {
    const { main, side } = resolveDeckCards(pubDeck);
    const code = pubDeck.deckCode || encodeDeckCode(main, side);
    navigator.clipboard.writeText(code);
    setCopiedId(pubDeck.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePublishDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishError('');
    setPublishSuccess('');

    if (!user) {
      setPublishError('Faça login para publicar seu deck no Mural da Comunidade.');
      return;
    }

    let targetMain: CardData[] = [];
    let targetSide: CardData[] = [];

    if (useBuilderDeck && currentMainDeck.length > 0) {
      targetMain = currentMainDeck;
      targetSide = currentSideDeck;
    } else if (customCodeInput.trim()) {
      const decoded = decodeDeckCode(customCodeInput.trim(), allCards);
      targetMain = decoded.main;
      targetSide = decoded.side;
    }

    if (targetMain.length === 0) {
      setPublishError(
        'Monte um deck no Construtor ou cole um Código de Deck (LDT:...) válido para publicar.'
      );
      return;
    }

    if (!deckName.trim()) {
      setPublishError('Informe um título para a sua Decklist.');
      return;
    }

    const heroCard = targetMain.find((c) => c.type === 'Herói') || targetMain[0];
    const generatedCode = encodeDeckCode(targetMain, targetSide);
    const id = `pub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    setIsPublishing(true);
    try {
      const payload: PublicCommunityDeck = {
        id,
        name: deckName.trim(),
        heroName: heroCard?.name || '',
        archetype: deckArchetype.trim() || heroCard?.archetype || 'Misto',
        strategyGuide:
          strategyGuide.trim() ||
          'Decklist compartilhada no Mural da Comunidade Light Dark TCG.',
        deckCode: generatedCode,
        mainDeckCodes: targetMain.map((c) => cleanCardCode(c.code)),
        sideDeckCodes: targetSide.map((c) => cleanCardCode(c.code)),
        cardCount: targetMain.length,
        coverImageUrl: heroCard?.catalogCoverImageUrl || heroCard?.imageUrl || '',
        userId: user.uid,
        authorName: user.displayName || user.email?.split('@')[0] || 'Duelista',
        authorAvatar: user.photoURL || '',
        userEmail: user.email || '',
        isOfficialMeta: Boolean(
          isAdmin || user.email?.toLowerCase() === 'viniciuspdiasuzumaki@gmail.com'
        ),
        likesCount: 0,
        likedBy: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'communityDecks', id), JSON.parse(JSON.stringify(payload)));
      setPublishSuccess('Decklist publicada com sucesso no Mural da Comunidade!');
      setDeckName('');
      setDeckArchetype('');
      setStrategyGuide('');
      setCustomCodeInput('');
      setTimeout(() => {
        setPublishSuccess('');
        setTab('browse');
      }, 1000);
    } catch (err: any) {
      setPublishError(err.message || 'Erro ao publicar decklist.');
    } finally {
      setIsPublishing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <CardDetailModal card={inspectCard} onClose={() => setInspectCard(null)} />

      {mulliganTestDeck && (
        <MulliganSimulator
          deck={mulliganTestDeck.main}
          sideDeck={mulliganTestDeck.side}
          deckTitle={mulliganTestDeck.title}
          onClose={() => setMulliganTestDeck(null)}
        />
      )}

      <div
        className="bg-[#0b0e17] border border-purple-500/40 rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Users size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span>Mural da Comunidade de Decks</span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/40">
                  {decks.length} Decklists Públicas
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Explore listas públicas, leia guias de combo, teste a Mão Inicial (Mulligan) ou carregue direto no Construtor!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('browse')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                tab === 'browse'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-900 text-slate-300 border border-slate-800'
              }`}
            >
              Explorar Decks ({decks.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setUseBuilderDeck(currentMainDeck.length > 0);
                setTab('publish');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                tab === 'publish'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25'
              }`}
            >
              <Plus size={14} />
              <span>Publicar Decklist</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === 'browse' ? (
            <div className="space-y-5">
              {/* Filter Bar */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search
                    size={15}
                    className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar deck por nome, Herói, arquétipo ou criador..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-amber-300 font-bold bg-slate-950 border border-amber-500/30 px-3 py-2 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyOfficial}
                      onChange={(e) => setOnlyOfficial(e.target.checked)}
                      className="accent-amber-400 w-3.5 h-3.5 rounded"
                    />
                    <span>Apenas Decks Oficiais</span>
                  </label>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none"
                  >
                    <option value="likes">Mais Curtidos pela Comunidade</option>
                    <option value="recent">Mais Recentes</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Carregando Mural da Comunidade...
                </div>
              ) : filteredDecks.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                  <Layers size={40} className="mx-auto text-slate-600" />
                  <h4 className="text-base font-bold text-white">
                    Nenhuma decklist encontrada
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Publique o primeiro deck no Mural da Comunidade para compartilhar sua estratégia com outros jogadores!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDecks.map((pubDeck) => {
                    const isOfficial =
                      pubDeck.isOfficialMeta ||
                      pubDeck.userEmail === 'viniciuspdiasuzumaki@gmail.com';
                    const likes =
                      pubDeck.likesCount ?? (pubDeck.likedBy ? pubDeck.likedBy.length : 0);
                    const isLiked = Boolean(user && pubDeck.likedBy?.includes(user.uid));

                    return (
                      <div
                        key={pubDeck.id}
                        className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 rounded-2xl overflow-hidden flex flex-col justify-between transition shadow-lg"
                      >
                        <div>
                          {/* Cover Banner */}
                          <div
                            onClick={() => setSelectedDeck(pubDeck)}
                            className="relative h-36 bg-black overflow-hidden cursor-pointer group"
                          >
                            {pubDeck.coverImageUrl ? (
                              <img
                                src={pubDeck.coverImageUrl}
                                alt={pubDeck.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-950 to-slate-950">
                                <Layers size={36} className="text-purple-400/50" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                            <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between gap-2">
                              {isOfficial ? (
                                <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black uppercase flex items-center gap-1">
                                  <ShieldCheck size={11} /> Deck Oficial
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-purple-950/90 border border-purple-500/40 text-purple-200 text-[10px] font-bold">
                                  {pubDeck.archetype || 'Deck da Comunidade'}
                                </span>
                              )}

                              <span className="px-2 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono font-bold border border-white/10">
                                {pubDeck.cardCount || pubDeck.mainDeckCodes?.length || 30} cartas
                              </span>
                            </div>

                            <div className="absolute bottom-2.5 left-3 right-3">
                              <h3 className="text-sm sm:text-base font-black text-white truncate">
                                {pubDeck.name}
                              </h3>
                              {pubDeck.heroName && (
                                <div className="text-[11px] text-amber-300 font-bold flex items-center gap-1 truncate">
                                  <Crown size={11} />
                                  <span>Herói: {pubDeck.heroName}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Body */}
                          <div className="p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400 truncate">
                                Por:{' '}
                                <strong className="text-slate-200">
                                  {pubDeck.authorName ||
                                    pubDeck.userEmail?.split('@')[0] ||
                                    'Duelista'}
                                </strong>
                              </span>

                              <button
                                type="button"
                                onClick={() => handleToggleLike(pubDeck)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border transition cursor-pointer ${
                                  isLiked
                                    ? 'bg-pink-600/20 border-pink-500 text-pink-300'
                                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-pink-300'
                                }`}
                              >
                                <Heart
                                  size={12}
                                  className={isLiked ? 'fill-pink-400 text-pink-400' : ''}
                                />
                                <span>{likes}</span>
                              </button>
                            </div>

                            {pubDeck.strategyGuide && (
                              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                                {pubDeck.strategyGuide}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="p-3.5 pt-2.5 border-t border-slate-800/80 bg-slate-950/50 grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedDeck(pubDeck)}
                            className="py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Eye size={12} />
                            <span>Ver Lista</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const resolved = resolveDeckCards(pubDeck);
                              setMulliganTestDeck({
                                main: resolved.main,
                                side: resolved.side,
                                title: pubDeck.name
                              });
                            }}
                            className="py-2 px-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                            title="Simular Mão Inicial de 5 Cartas e Mulligan"
                          >
                            <Shuffle size={12} />
                            <span>Testar Mão</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (onLoadDeck) {
                                const resolved = resolveDeckCards(pubDeck);
                                onLoadDeck(resolved.main, resolved.side);
                                onClose();
                              } else {
                                handleCopyCode(pubDeck);
                              }
                            }}
                            className="py-2 px-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            {copiedId === pubDeck.id ? (
                              <>
                                <Check size={12} />
                                <span>Copiado</span>
                              </>
                            ) : onLoadDeck ? (
                              <>
                                <Play size={12} />
                                <span>Usar Deck</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Código</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* PUBLISH DECK FORM */
            <form onSubmit={handlePublishDeck} className="max-w-2xl mx-auto space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-base font-black text-white">
                  Publicar Decklist no Mural da Comunidade
                </h3>

                {publishError && (
                  <div className="p-3 rounded-xl bg-red-950/70 border border-red-600/50 text-red-200 text-xs">
                    {publishError}
                  </div>
                )}
                {publishSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs font-bold">
                    {publishSuccess}
                  </div>
                )}

                {currentMainDeck.length > 0 && (
                  <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setUseBuilderDeck(true)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                        useBuilderDeck
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Usar Deck Atual do Construtor ({currentMainDeck.length} cartas)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseBuilderDeck(false)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                        !useBuilderDeck
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Colar Código de Deck (LDT:...)
                    </button>
                  </div>
                )}

                {(!useBuilderDeck || currentMainDeck.length === 0) && (
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Código do Deck (Gerado no Criador de Deck) *
                    </label>
                    <textarea
                      rows={2}
                      value={customCodeInput}
                      onChange={(e) => setCustomCodeInput(e.target.value)}
                      placeholder="Cole aqui o código LDT:... do seu deck"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-white outline-none focus:border-purple-500"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Nome do Deck *
                    </label>
                    <input
                      type="text"
                      required
                      value={deckName}
                      onChange={(e) => setDeckName(e.target.value)}
                      placeholder="Ex: Mahina Controle de Véu"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Arquétipo / Estilo de Jogo
                    </label>
                    <input
                      type="text"
                      value={deckArchetype}
                      onChange={(e) => setDeckArchetype(e.target.value)}
                      placeholder="Ex: Lúmen / Caos / Aggro / Controle"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Guia Rápido de Estratégia & Combos Principais
                  </label>
                  <textarea
                    rows={4}
                    value={strategyGuide}
                    onChange={(e) => setStrategyGuide(e.target.value)}
                    placeholder="Explique como o deck funciona, qual a condição de vitória e quais cartas buscar no Mulligan..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-purple-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPublishing}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm transition cursor-pointer"
                >
                  {isPublishing ? 'Publicando...' : 'Publicar Deck no Mural da Comunidade'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Inspect Decklist Modal */}
      {selectedDeck && (
        <div
          className="fixed inset-0 z-[115] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={() => setSelectedDeck(null)}
        >
          <div
            className="bg-[#0e111d] border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[88vh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const resolved = resolveDeckCards(selectedDeck);
              return (
                <>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg sm:text-xl font-black text-white">
                          {selectedDeck.name}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-500/40 text-xs font-bold">
                          {resolved.main.length} Principal
                          {resolved.side.length > 0 ? ` + ${resolved.side.length} Side` : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Criado por{' '}
                        <strong className="text-white">
                          {selectedDeck.authorName || 'Duelista'}
                        </strong>{' '}
                        • Herói: <strong className="text-amber-300">{selectedDeck.heroName || 'Livre'}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {(isAdmin || (user && user.uid === selectedDeck.userId)) && (
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteDoc(doc(db, 'communityDecks', selectedDeck.id));
                            setSelectedDeck(null);
                          }}
                          className="p-2 rounded-xl bg-red-950/70 text-red-300 hover:bg-red-900 border border-red-700/50 cursor-pointer"
                          title="Excluir decklist"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedDeck(null)}
                        className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {selectedDeck.strategyGuide && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1.5">
                      <div className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                        <BookOpen size={14} />
                        <span>Guia de Estratégia & Combos</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                        {selectedDeck.strategyGuide}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setMulliganTestDeck({
                          main: resolved.main,
                          side: resolved.side,
                          title: selectedDeck.name
                        })
                      }
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Shuffle size={14} />
                      <span>Simular Mão Inicial & Probabilidade</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyCode(selectedDeck)}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedId === selectedDeck.id ? <Check size={14} /> : <Copy size={14} />}
                      <span>
                        {copiedId === selectedDeck.id ? 'Código LDT Copiado!' : 'Copiar Código LDT'}
                      </span>
                    </button>

                    {onLoadDeck && (
                      <button
                        type="button"
                        onClick={() => {
                          onLoadDeck(resolved.main, resolved.side);
                          setSelectedDeck(null);
                          onClose();
                        }}
                        className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Play size={14} />
                        <span>Abrir no Construtor de Deck</span>
                      </button>
                    )}
                  </div>

                  {/* Cards Grid */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                      Cartas do Deck Principal ({resolved.main.length})
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                      {resolved.main.map((card, i) => (
                        <div
                          key={`${card.code}-${i}`}
                          onClick={() => setInspectCard(card)}
                          className="bg-slate-950 border border-slate-800 hover:border-purple-500 rounded-xl p-2 cursor-pointer transition flex flex-col gap-1.5"
                        >
                          {card.imageUrl && (
                            <img
                              src={card.imageUrl}
                              alt={card.name}
                              referrerPolicy="no-referrer"
                              className="w-full aspect-[3/4] object-cover rounded-lg bg-black"
                            />
                          )}
                          <div className="text-[11px] font-bold text-white truncate">
                            {card.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex justify-between">
                            <span>{card.type}</span>
                            <span className="text-yellow-400">CT {card.ct || 0}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
