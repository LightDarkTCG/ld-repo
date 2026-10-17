import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  BookOpen, 
  CheckCircle2, 
  Layers, 
  Plus, 
  Minus, 
  Sparkles, 
  LogIn,
  Crown,
  Star,
  Shield,
  Award,
  PackagePlus,
  RefreshCw,
  Check,
  Trash2,
  Trophy,
  Heart
} from 'lucide-react';
import { CardData } from '../types';
import { useCards, cleanCardCode } from '../CardContext';
import { useAuth } from '../authService';
import { useUserAlbum, normalizeAlbumKey, FOIL_TYPES, FoilTypeInfo } from '../albumService';
import { compareCardCodes } from '../deckUtils';
import { syncUserCollectorStats } from '../collectorsService';
import { useUserWishlist } from '../wishlistService';

interface AlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCard?: (card: CardData) => void;
  onOpenAuth?: () => void;
  onOpenRanking?: () => void;
  onOpenWishlist?: () => void;
}

export type AlbumEdition = 'legado' | 'moderno' | 'all';

/**
 * Metadados informativos para cada coleção / deck do jogo
 */
export const COLLECTION_METADATA: Record<string, { subtitle: string; heroName: string; category: 'deck' | 'booster' }> = {
  'Insanis': { subtitle: 'Deck Estrutural de Jim - O Senhor do Macroverso', heroName: 'Jim - O Senhor do Macroverso', category: 'deck' },
  'Príncipe do Macroverso': { subtitle: 'Deck Estrutural de Jenos', heroName: 'Jenos Senhor do Macroverso', category: 'deck' },
  'Mechs e Mangas': { subtitle: 'Deck Estrutural de Vellret', heroName: 'Spear Vellret', category: 'deck' },
  'Herdeiro do Caos': { subtitle: 'Deck Estrutural de Mahina', heroName: 'Mahina - O Herdeiro de Lúmeni', category: 'deck' },
  'Mundo em Chamas': { subtitle: 'Deck Estrutural de Donnie', heroName: 'Donnie - Samurai das Chamas', category: 'deck' },
  'Corruptor Profano': { subtitle: 'Deck Estrutural de Otto', heroName: 'Otto - Arauto da Corrupção', category: 'deck' },
  'O Escolhido': { subtitle: 'Deck Estrutural de Salazar', heroName: 'Salazar - Guia dos Escolhidos', category: 'deck' },
  'Deusa da Lua': { subtitle: 'Deck Estrutural de Selena', heroName: 'Selena - Deusa da Lua', category: 'deck' },
  'Invasão do Caos': { subtitle: 'Expansão & Deck Invasão do Caos', heroName: 'Mahina - O Arauto do Véu', category: 'deck' },
  'Booster Pack 1': { subtitle: 'Pacote de Expansão Clássico', heroName: '', category: 'booster' },
  'Booster Pack 2': { subtitle: 'Pacote de Expansão Série 2', heroName: '', category: 'booster' },
};

/**
 * Identifica se a carta pertence ao formato / era Legado
 */
export const isLegacyCard = (c: CardData): boolean => {
  if (c.frame === 'Moderno') return false;
  if (c.code && c.code.endsWith('-M')) return false;
  if (c.collection === 'Invasão do Caos' || c.collection === 'Booster Invasão do Caos' || c.collection === 'Reforço Macroversal') return false;
  return true;
};

/**
 * Identifica se a carta é Especial (Limitadas, Raras, Eventos, Promos e Colecionador)
 */
export const isSpecialCard = (c: CardData): boolean => {
  const r = (c.rarity || '').toLowerCase();
  return (
    r === 'limitadas' ||
    r === 'limitada' ||
    r === 'rara' ||
    r === 'evento' ||
    r === 'especial' ||
    r === 'promo' ||
    c.isVariation === true ||
    (c.collection || '').toLowerCase().includes('especial')
  );
};

export const AlbumModal: React.FC<AlbumModalProps> = ({ isOpen, onClose, onSelectCard, onOpenAuth, onOpenRanking, onOpenWishlist }) => {
  const { user } = useAuth();
  const { cards: allCards } = useCards();
  const { 
    album,
    getQuantity, 
    getCardFoils,
    hasFoil,
    toggleCardFoil,
    incrementCard, 
    decrementCard, 
    addCollectionCards, 
    removeCollectionCards 
  } = useUserAlbum(user?.uid);

  // Cartas que procuro (Wishlist)
  const { isCardWanted, addCard: addWantedCard, removeCard: removeWantedCard } = useUserWishlist(user?.uid, user);

  // Sincroniza estatísticas de colecionador na nuvem sempre que o acervo mudar
  React.useEffect(() => {
    if (user && user.uid && album && Object.keys(album).length > 0 && allCards.length > 0) {
      syncUserCollectorStats(user.uid, user, album, allCards);
    }
  }, [album, user?.uid, allCards.length]);

  // Edição do Álbum (Padrão: Legado conforme solicitação do usuário)
  const [albumEdition, setAlbumEdition] = useState<AlbumEdition>('legado');
  const [onlySpecials, setOnlySpecials] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('Todas');
  const [filterMode, setFilterMode] = useState<'all' | 'owned' | 'missing'>('all');
  const [selectedFoilFilter, setSelectedFoilFilter] = useState<'all' | 'any_foil' | string>('all');
  const [cardForFoilModal, setCardForFoilModal] = useState<CardData | null>(null);

  // Estados para inserção de coleções completas em lote
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMode, setBulkMode] = useState<'add' | 'ensure_at_least'>('add');
  const [bulkTab, setBulkTab] = useState<'all' | 'deck' | 'booster'>('all');
  const [bulkLoadingName, setBulkLoadingName] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Lista estruturada de coleções disponíveis com contagem de posse para inserção em lote
  const collectionsSummary = useMemo(() => {
    // Determinar as cartas com base no álbum ativo (Legado, Moderno ou Todos)
    let poolCards: CardData[] = [];
    if (albumEdition === 'legado') {
      poolCards = allCards.filter(isLegacyCard);
    } else if (albumEdition === 'moderno') {
      poolCards = allCards.filter(c => !isLegacyCard(c));
    } else {
      poolCards = allCards;
    }

    const map = new Map<string, CardData[]>();
    for (const card of poolCards) {
      if (!card || !card.collection) continue;
      if (!map.has(card.collection)) {
        map.set(card.collection, []);
      }
      map.get(card.collection)!.push(card);
    }

    return Array.from(map.entries()).map(([name, cards]) => {
      // Deduplicar cartas pela chave única independente do álbum
      const uniqueMap = new Map<string, CardData>();
      cards.forEach(c => {
        const key = normalizeAlbumKey(c);
        if (key && !uniqueMap.has(key)) {
          uniqueMap.set(key, c);
        }
      });
      const uniqueCards = Array.from(uniqueMap.values());
      
      let ownedCount = 0;
      let totalCopies = 0;
      uniqueCards.forEach(c => {
        const q = getQuantity(c);
        if (q > 0) {
          ownedCount++;
          totalCopies += q;
        }
      });

      const meta = COLLECTION_METADATA[name] || {
        subtitle: 'Coleção de cartas do jogo',
        heroName: '',
        category: (uniqueCards.length <= 35 ? 'deck' : 'booster') as 'deck' | 'booster'
      };

      const heroCard = meta.heroName 
        ? uniqueCards.find(c => c.name.toLowerCase().includes(meta.heroName.toLowerCase())) || uniqueCards[0]
        : uniqueCards[0];

      return {
        name,
        subtitle: meta.subtitle,
        category: meta.category,
        totalCards: uniqueCards.length,
        ownedCount,
        totalCopies,
        percent: uniqueCards.length > 0 ? Math.round((ownedCount / uniqueCards.length) * 100) : 0,
        cards: uniqueCards,
        coverImage: heroCard?.imageUrl
      };
    }).sort((a, b) => {
      if (a.category !== b.category) {
        return a.category === 'deck' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [allCards, albumEdition, getQuantity]);

  // Coleção atualmente selecionada no filtro (se for uma coleção real)
  const currentCollectionData = useMemo(() => {
    if (selectedCollection === 'Todas' || selectedCollection.startsWith('★')) return null;
    return collectionsSummary.find(c => c.name === selectedCollection) || null;
  }, [collectionsSummary, selectedCollection]);

  const handleAddCollection = async (collectionName: string, mode: 'add' | 'ensure_at_least' = bulkMode) => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      else alert('Faça login com sua conta para salvar suas cartas no álbum.');
      return;
    }

    const col = collectionsSummary.find(c => c.name === collectionName);
    if (!col || col.cards.length === 0) return;

    setBulkLoadingName(collectionName);
    try {
      // Passa a lista completa de CardData para manter cada frame independente
      const count = await addCollectionCards(col.cards, mode, 1);
      const actionText = mode === 'add' ? 'adicionadas (+1 cópia de cada)' : 'completadas com sucesso';
      setToastMessage(`${count} cartas de "${collectionName}" foram ${actionText}!`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error('Erro ao adicionar coleção:', err);
      alert('Houve um erro ao atualizar o álbum. Tente novamente.');
    } finally {
      setBulkLoadingName(null);
    }
  };

  const handleRemoveCollection = async (collectionName: string) => {
    if (!user) return;
    const col = collectionsSummary.find(c => c.name === collectionName);
    if (!col || col.cards.length === 0) return;

    if (!window.confirm(`Deseja realmente zerar a quantidade de todas as cartas de "${collectionName}" no seu álbum?`)) {
      return;
    }

    setBulkLoadingName(collectionName);
    try {
      await removeCollectionCards(col.cards);
      setToastMessage(`Cartas de "${collectionName}" foram zeradas no seu álbum.`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error('Erro ao remover coleção:', err);
    } finally {
      setBulkLoadingName(null);
    }
  };

  // Pool de cartas conforme o Álbum selecionado
  const albumPoolCards = useMemo(() => {
    let pool: CardData[] = [];
    if (albumEdition === 'legado') {
      pool = allCards.filter(isLegacyCard);
    } else if (albumEdition === 'moderno') {
      pool = allCards.filter(c => !isLegacyCard(c));
    } else {
      pool = allCards;
    }

    // Deduplicação pela chave canônica do álbum para preservar variantes especiais e frames independentes
    const seen = new Set<string>();
    const list: CardData[] = [];

    for (const card of pool) {
      const codeKey = normalizeAlbumKey(card);
      if (seen.has(codeKey)) continue;
      seen.add(codeKey);
      list.push(card);
    }

    return list.sort((a, b) => compareCardCodes(a.code, b.code));
  }, [allCards, albumEdition]);

  // Coleções disponíveis no álbum atual
  const availableCollections = useMemo(() => {
    const cols = new Set<string>();
    albumPoolCards.forEach(c => {
      if (c.collection) cols.add(c.collection);
    });
    return Array.from(cols).sort();
  }, [albumPoolCards]);

  // Contagem de cartas especiais deste álbum
  const specialCardsCount = useMemo(() => {
    return albumPoolCards.filter(isSpecialCard).length;
  }, [albumPoolCards]);

  // Estatísticas de posse do Álbum ativo
  const stats = useMemo(() => {
    let totalUniqueOwned = 0;
    let totalCopies = 0;

    const baseCards = onlySpecials 
      ? albumPoolCards.filter(isSpecialCard) 
      : albumPoolCards;

    baseCards.forEach(card => {
      const qty = getQuantity(card);
      if (qty > 0) {
        totalUniqueOwned++;
        totalCopies += qty;
      }
    });

    const percent = baseCards.length > 0 
      ? Math.round((totalUniqueOwned / baseCards.length) * 100) 
      : 0;

    return {
      totalCards: baseCards.length,
      totalUniqueOwned,
      totalCopies,
      percent
    };
  }, [albumPoolCards, onlySpecials, getQuantity]);

  // Cartas filtradas para exibição no grid
  const filteredCards = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return albumPoolCards.filter(card => {
      const qty = getQuantity(card);
      const isOwned = qty > 0;
      const cardSpecial = isSpecialCard(card);

      // Filtro rápido de somente especiais
      if (onlySpecials && !cardSpecial) return false;

      // Filtro de posse
      if (filterMode === 'owned' && !isOwned) return false;
      if (filterMode === 'missing' && isOwned) return false;

      // Filtro de coleção
      if (selectedCollection === '★ Especiais' && !cardSpecial) {
        return false;
      } else if (selectedCollection === '★ Limitadas' && !(card.rarity || '').toLowerCase().includes('limitad')) {
        return false;
      } else if (selectedCollection === '★ Raras' && !(card.rarity || '').toLowerCase().includes('rara')) {
        return false;
      } else if (selectedCollection === '★ Eventos' && !(card.rarity || '').toLowerCase().includes('evento')) {
        return false;
      } else if (selectedCollection !== 'Todas' && !selectedCollection.startsWith('★') && card.collection !== selectedCollection) {
        return false;
      }

      // Filtro de Foil
      if (selectedFoilFilter === 'any_foil' && !hasFoil(card)) return false;
      if (selectedFoilFilter !== 'all' && selectedFoilFilter !== 'any_foil' && !hasFoil(card, selectedFoilFilter)) return false;

      // Filtro de busca textual
      if (term) {
        const nameMatch = (card.name || '').toLowerCase().includes(term);
        const codeMatch = (card.code || '').toLowerCase().includes(term);
        const typeMatch = (card.type || '').toLowerCase().includes(term);
        const archetypeMatch = (card.archetype || '').toLowerCase().includes(term);
        const rarityMatch = (card.rarity || '').toLowerCase().includes(term);
        if (!nameMatch && !codeMatch && !typeMatch && !archetypeMatch && !rarityMatch) return false;
      }

      return true;
    });
  }, [albumPoolCards, searchTerm, selectedCollection, filterMode, onlySpecials, selectedFoilFilter, getQuantity, hasFoil]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b0f19] w-full max-w-7xl h-[94vh] rounded-2xl border border-purple-900/40 shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-slate-950 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-950">
              <BookOpen size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide flex items-center gap-2">
                  Meu Álbum de Coleção
                </h2>
                {user && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700/50 font-mono hidden sm:inline-block">
                    Sincronizado na Nuvem
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                {albumEdition === 'legado' 
                  ? 'Álbum Legado: Coleções estruturais clássicas, Booster Packs 1 & 2 e cartas especiais.' 
                  : albumEdition === 'moderno'
                  ? 'Álbum Moderno: Cartas do novo frame e expansão Invasão do Caos.'
                  : 'Catálogo Geral: Visualizando todos os cards registrados.'}
              </p>
            </div>
          </div>

          {/* SELETOR DE EDIÇÃO DO ÁLBUM (LEGADO vs MODERNO vs TODOS) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl shadow-inner">
            <button
              onClick={() => {
                setAlbumEdition('legado');
                setSelectedCollection('Todas');
                setOnlySpecials(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                albumEdition === 'legado'
                  ? 'bg-gradient-to-r from-amber-600 to-purple-600 text-white shadow-md shadow-amber-950/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield size={14} className={albumEdition === 'legado' ? 'text-amber-200' : 'text-slate-400'} />
              <span>Álbum Legado</span>
            </button>

            <button
              onClick={() => {
                setAlbumEdition('moderno');
                setSelectedCollection('Todas');
                setOnlySpecials(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                albumEdition === 'moderno'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles size={14} className={albumEdition === 'moderno' ? 'text-purple-300' : 'text-slate-400'} />
              <span>Álbum Moderno</span>
            </button>

            <button
              onClick={() => {
                setAlbumEdition('all');
                setSelectedCollection('Todas');
                setOnlySpecials(false);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                albumEdition === 'all'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Todos</span>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* BOTÃO PARA VISUALIZAR RANKING TOP 10 COLECIONADORES */}
            {onOpenRanking && (
              <button
                onClick={onOpenRanking}
                className="px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                title="Visualizar Ranking Top 10 dos Maiores Colecionadores"
              >
                <Trophy size={16} className="text-amber-400 fill-amber-400/20" />
                <span className="hidden sm:inline">Hall da Fama</span>
                <span className="sm:hidden">Hall da Fama</span>
              </button>
            )}

            {/* BOTÃO PARA INSERIR COLEÇÕES / DECKS COMPLETOS */}
            <button
              onClick={() => setShowBulkModal(true)}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 active:scale-95 shrink-0"
              title="Adicionar Decks Estruturais ou Coleções inteiras de uma só vez ao seu álbum"
            >
              <PackagePlus size={16} />
              <span className="hidden sm:inline">Inserir Coleção / Deck</span>
              <span className="sm:hidden">+ Coleção</span>
            </button>

            {!user ? (
              <button
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white transition flex items-center gap-2 shadow-lg shadow-purple-900/40 active:scale-95"
              >
                <LogIn size={16} />
                <span>Entrar na Conta</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/60 px-3 py-1.5 rounded-xl">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'Usuário'} className="w-6 h-6 rounded-full border border-purple-400/50" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-purple-700 flex items-center justify-center text-xs font-bold text-white">
                    {(user.displayName || 'J')[0]}
                  </div>
                )}
                <span className="text-xs font-semibold text-slate-200 max-w-[120px] truncate">
                  {user.displayName || user.email}
                </span>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Fechar Álbum"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* PROGRESS BANNER */}
        <div className="px-4 sm:px-6 py-3 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-8 flex-wrap">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
                {albumEdition === 'legado' ? 'Progresso Álbum Legado' : albumEdition === 'moderno' ? 'Progresso Álbum Moderno' : 'Progresso Total'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-black text-purple-400">{stats.percent}%</span>
                <span className="text-xs text-slate-500 font-medium">({stats.totalUniqueOwned}/{stats.totalCards} únicas)</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">Total de Cópias</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-black text-emerald-400">{stats.totalCopies}</span>
                <span className="text-xs text-slate-500 font-medium">cartas físicas</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">Faltando</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-black text-amber-400">{stats.totalCards - stats.totalUniqueOwned}</span>
                <span className="text-xs text-slate-500 font-medium">para completar</span>
              </div>
            </div>

            {specialCardsCount > 0 && (
              <div>
                <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold block">Cartas Especiais</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg sm:text-xl font-black text-amber-300">
                    {albumPoolCards.filter(c => isSpecialCard(c) && getQuantity(c) > 0).length}/{specialCardsCount}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">no álbum</span>
                </div>
              </div>
            )}
          </div>

          {/* BARRA DE PROGRESSO */}
          <div className="w-full sm:w-64">
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/50">
              <div 
                className="bg-gradient-to-r from-purple-600 to-emerald-400 h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* FILTROS E BUSCA */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-1.5 focus-within:border-purple-500 transition">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nome, código ou arquétipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none w-full"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-white text-xs">
                Limpar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* BOTÃO DE FILTRO DE ESPECIAIS (REQUISITO EXPLÍCITO) */}
            {specialCardsCount > 0 && (
              <button
                onClick={() => setOnlySpecials(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border active:scale-95 ${
                  onlySpecials
                    ? 'bg-gradient-to-r from-amber-600 to-purple-600 text-white border-amber-300 shadow-md shadow-amber-950/50'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-amber-300 hover:border-amber-700/60'
                }`}
                title="Filtrar apenas as cartas especiais deste álbum (Limitadas, Raras e Eventos)"
              >
                <Crown size={14} className={onlySpecials ? 'text-amber-200 fill-amber-300' : 'text-amber-400'} />
                <span>★ Especiais ({specialCardsCount})</span>
              </button>
            )}

            {/* MODO DE POSSE */}
            <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterMode === 'all' 
                    ? 'bg-purple-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todas ({albumPoolCards.length})
              </button>
              <button
                onClick={() => setFilterMode('owned')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterMode === 'owned' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tenho ({stats.totalUniqueOwned})
              </button>
              <button
                onClick={() => setFilterMode('missing')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterMode === 'missing' 
                    ? 'bg-amber-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Faltando ({stats.totalCards - stats.totalUniqueOwned})
              </button>
            </div>

            {/* FILTRO DE ACABAMENTO FOIL */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <Sparkles size={14} className="text-yellow-400" />
              <select
                value={selectedFoilFilter}
                onChange={(e) => setSelectedFoilFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer font-medium max-w-[150px] truncate"
              >
                <option value="all" className="bg-slate-900">Todos os Acabamentos</option>
                <option value="any_foil" className="bg-slate-900 text-yellow-300 font-bold">✨ Apenas Foils</option>
                <optgroup label="11 Tipos de Foil" className="bg-slate-900 text-purple-300">
                  {FOIL_TYPES.map(foil => (
                    <option key={foil.id} value={foil.id} className="bg-slate-900 text-slate-200">
                      Foil {foil.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* SELEÇÃO DE COLEÇÃO */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <Layers size={14} className="text-purple-400" />
              <select
                value={selectedCollection}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCollection(val);
                  if (val === '★ Especiais') {
                    setOnlySpecials(true);
                  } else {
                    setOnlySpecials(false);
                  }
                }}
                className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer font-medium max-w-[170px] truncate"
              >
                <option value="Todas" className="bg-slate-900">
                  {albumEdition === 'legado' ? 'Todas do Álbum Legado' : albumEdition === 'moderno' ? 'Todas do Álbum Moderno' : 'Todas as Coleções'}
                </option>
                {specialCardsCount > 0 && (
                  <optgroup label="Especiais do Álbum" className="bg-slate-900 text-amber-400 font-bold">
                    <option value="★ Especiais" className="bg-slate-900 text-amber-400">
                      ★ Todas as Especiais ({specialCardsCount})
                    </option>
                    <option value="★ Limitadas" className="bg-slate-900 text-amber-300">
                      ★ Limitadas ({albumPoolCards.filter(c => (c.rarity || '').toLowerCase().includes('limitad')).length})
                    </option>
                    <option value="★ Raras" className="bg-slate-900 text-amber-300">
                      ★ Raras ({albumPoolCards.filter(c => (c.rarity || '').toLowerCase().includes('rara')).length})
                    </option>
                    <option value="★ Eventos" className="bg-slate-900 text-amber-300">
                      ★ Eventos ({albumPoolCards.filter(c => (c.rarity || '').toLowerCase().includes('evento')).length})
                    </option>
                  </optgroup>
                )}
                <optgroup label="Coleções do Álbum" className="bg-slate-900 text-purple-300">
                  {availableCollections.map(col => (
                    <option key={col} value={col} className="bg-slate-900 text-slate-200">{col}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* BOTAO PARA ABRIR CARTAS QUE PROCURO */}
            {onOpenWishlist && (
              <button
                onClick={() => {
                  onClose();
                  onOpenWishlist();
                }}
                className="px-3 py-1.5 rounded-xl bg-pink-950/70 hover:bg-pink-900 border border-pink-700/60 text-pink-200 text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                title="Abrir minha lista de Cartas que Procuro"
              >
                <Heart size={14} className="fill-pink-400 text-pink-400" />
                <span>Cartas que Procuro</span>
              </button>
            )}
          </div>
        </div>

        {/* BARRA HORIZONTAL DE COLEÇÕES E ESPECIAIS (ACESSO RÁPIDO) */}
        <div className="px-4 py-2 bg-slate-950 border-b border-slate-800/70 flex items-center gap-1.5 overflow-x-auto scrollbar-thin shrink-0">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Layers size={11} className="text-purple-400" /> Coleções:
          </span>
          <button
            onClick={() => { setSelectedCollection('Todas'); setOnlySpecials(false); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 ${
              selectedCollection === 'Todas' && !onlySpecials
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Todas ({albumPoolCards.length})
          </button>

          {specialCardsCount > 0 && (
            <button
              onClick={() => { setSelectedCollection('★ Especiais'); setOnlySpecials(true); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition whitespace-nowrap shrink-0 flex items-center gap-1 border ${
                selectedCollection === '★ Especiais' || onlySpecials
                  ? 'bg-gradient-to-r from-amber-600 to-purple-600 text-white border-amber-300 shadow-md shadow-amber-950/40'
                  : 'bg-slate-900 text-amber-300 border-amber-600/40 hover:bg-slate-800'
              }`}
            >
              <Crown size={12} className="fill-amber-300" />
              <span>★ Especiais ({specialCardsCount})</span>
            </button>
          )}

          {availableCollections.map(col => {
            const count = albumPoolCards.filter(c => c.collection === col).length;
            const isSelected = selectedCollection === col && !onlySpecials;
            return (
              <button
                key={col}
                onClick={() => { setSelectedCollection(col); setOnlySpecials(false); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {col} <span className="opacity-60 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>

        {/* LISTA / GRID DE CARTAS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#070a12]">
          {/* BANNER DE INSERÇÃO RÁPIDA QUANDO UMA COLEÇÃO ESPECÍFICA ESTÁ SELECIONADA */}
          {currentCollectionData && (
            <div className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-950 border border-purple-500/40 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-900/60 border border-purple-500/50 flex items-center justify-center text-purple-300 shrink-0">
                  <PackagePlus size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      Coleção: {currentCollectionData.name}
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-purple-300 font-semibold border border-purple-700/40">
                      {currentCollectionData.ownedCount}/{currentCollectionData.totalCards} no seu álbum ({currentCollectionData.percent}%)
                    </span>
                    {currentCollectionData.ownedCount >= currentCollectionData.totalCards && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-semibold border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Completa
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {currentCollectionData.subtitle} • Já possui esse deck ou coleção física? Insira todas as {currentCollectionData.totalCards} cartas de uma vez sem precisar clicar uma a uma.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleAddCollection(currentCollectionData.name, 'add')}
                  disabled={bulkLoadingName === currentCollectionData.name}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-emerald-950/40 active:scale-95 disabled:opacity-50"
                  title="Adicionar 1 cópia de cada carta desta coleção ao seu álbum"
                >
                  {bulkLoadingName === currentCollectionData.name ? (
                    <RefreshCw size={14} className="animate-spin text-white" />
                  ) : (
                    <Plus size={14} />
                  )}
                  <span>Inserir Deck Completo (+1 cada)</span>
                </button>

                <button
                  onClick={() => handleAddCollection(currentCollectionData.name, 'ensure_at_least')}
                  disabled={bulkLoadingName === currentCollectionData.name}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-indigo-950/40 active:scale-95 disabled:opacity-50"
                  title="Preencher as cartas faltantes desta coleção"
                >
                  <CheckCircle2 size={14} />
                  <span>Completar Faltantes</span>
                </button>
              </div>
            </div>
          )}

          {/* BANNER PROMINENTE PARA INSERIR COLEÇÕES COMPLETAS QUANDO EM TODAS */}
          {!currentCollectionData && (
            <div className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-950 border border-purple-500/30 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <PackagePlus size={20} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    Possui Decks Estruturais ou Coleções Físicas?
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Insira todas as cartas de um deck inteiro (Corruptor Profano, O Escolhido, Deusa da Lua, etc.) de uma vez só no seu álbum!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowBulkModal(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-950/40 active:scale-95"
              >
                <PackagePlus size={15} />
                <span>Inserir Coleções & Decks Completos</span>
              </button>
            </div>
          )}

          {filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-slate-400 text-base mb-2">Nenhuma carta encontrada com os filtros selecionados.</p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCollection('Todas');
                  setOnlySpecials(false);
                  setFilterMode('all');
                }}
                className="text-xs text-purple-400 hover:underline font-bold"
              >
                Redefinir Filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredCards.map((card) => {
                const qty = getQuantity(card);
                const isOwned = qty > 0;
                const cardSpecial = isSpecialCard(card);
                const cardFoils = getCardFoils(card);
                const hasAnyFoil = cardFoils.length > 0;
                const isWanted = isCardWanted(card);

                return (
                  <div
                    key={normalizeAlbumKey(card)}
                    className={`relative rounded-xl transition-all duration-200 group flex flex-col items-center p-2 border ${
                      hasAnyFoil
                        ? 'bg-slate-900/95 border-pink-500/80 shadow-lg shadow-pink-950/40 foil-card-rainbow'
                        : cardSpecial
                        ? isOwned
                          ? 'bg-slate-900/95 border-amber-500/70 shadow-lg shadow-amber-950/30'
                          : 'bg-slate-950/70 border-amber-600/40 opacity-80 hover:opacity-100'
                        : isOwned 
                        ? 'bg-slate-900/90 border-purple-500/50 shadow-md shadow-purple-950/30' 
                        : 'bg-slate-950/60 border-slate-800/80 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {/* BOTOES DE TOPO (QUANTIDADE, ESPECIAL E WISHLIST) */}
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                      {/* Botão de Lista de Desejos (Cartas que Procuro) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!user) {
                            if (onOpenAuth) onOpenAuth();
                            return;
                          }
                          if (isWanted) {
                            removeWantedCard(card);
                          } else {
                            addWantedCard(card, 'qualquer', '', 1, 'media');
                          }
                        }}
                        className={`p-1 rounded-full transition shadow-md ${
                          isWanted
                            ? 'bg-pink-600 text-white border border-pink-400'
                            : 'bg-slate-950/80 text-slate-400 hover:text-pink-400 hover:bg-slate-900 border border-slate-800'
                        }`}
                        title={isWanted ? 'Remover das Cartas que Procuro' : 'Adicionar às Cartas que Procuro'}
                      >
                        <Heart size={11} className={isWanted ? 'fill-white' : ''} />
                      </button>

                      {/* Quantidade */}
                      {isOwned ? (
                        <div className="bg-emerald-600 text-white font-black text-xs px-2 py-0.5 rounded-full shadow-lg border border-emerald-400 font-mono flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          <span>x{qty}</span>
                        </div>
                      ) : (
                        <div className="bg-slate-800/90 text-slate-400 font-bold text-[10px] px-2 py-0.5 rounded-full border border-slate-700">
                          Falta
                        </div>
                      )}
                    </div>

                    {/* BADGE DE CARTA ESPECIAL (LIMITADA, EVENTO, RARA) */}
                    {cardSpecial && (
                      <div className="absolute top-3 left-3 z-10">
                        <div className={`text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg border flex items-center gap-1 ${
                          (card.rarity || '').toLowerCase().includes('limitad') 
                            ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-amber-950/70'
                            : (card.rarity || '').toLowerCase() === 'evento'
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-pink-300 shadow-pink-950/70'
                            : 'bg-cyan-600 text-white border-cyan-300 shadow-cyan-950/70'
                        }`}>
                          <Star size={10} className="fill-current" />
                          <span>{card.rarity || 'Especial'}</span>
                        </div>
                      </div>
                    )}

                    {/* MINIATURA DA CARTA */}
                    <div 
                      className={`w-full aspect-[2.5/3.5] rounded-lg overflow-hidden bg-slate-950 relative flex items-center justify-center cursor-pointer transition-transform ${
                        !isOwned ? 'grayscale-[50%] group-hover:grayscale-0' : ''
                      }`}
                      onClick={() => onSelectCard && onSelectCard(card)}
                    >
                      {card.imageUrl ? (
                        <img 
                          src={card.imageUrl} 
                          alt={card.name} 
                          className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                          loading="lazy" 
                        />
                      ) : (
                        <div className="p-3 text-center">
                          <span className="text-xs font-bold text-slate-300 block mb-1">{card.name}</span>
                          <span className="text-[10px] text-purple-400 font-mono">{card.code}</span>
                        </div>
                      )}
                    </div>

                    {/* INFORMAÇÕES DA CARTA */}
                    <div className="w-full mt-2 text-left">
                      <div className="truncate text-xs font-bold text-slate-200 group-hover:text-purple-300 transition" title={card.name}>
                        {card.name}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5 font-mono">
                        <span>{card.code}</span>
                        <span className="text-purple-400 truncate max-w-[85px]" title={card.collection}>{card.collection}</span>
                      </div>
                    </div>

                    {/* SELETOR E STATUS DE FOIL */}
                    <div className="w-full mt-1.5 pt-1.5 border-t border-slate-800/70">
                      {hasAnyFoil ? (
                        <button
                          type="button"
                          onClick={() => setCardForFoilModal(card)}
                          className="w-full py-1 px-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-between bg-gradient-to-r from-pink-950/80 via-purple-950/80 to-amber-950/80 border border-purple-500/70 text-purple-100 hover:border-pink-400 shadow-sm"
                          title="Clique para ver ou alterar os acabamentos Foil desta carta"
                        >
                          <span className="flex items-center gap-1 truncate">
                            <Sparkles size={11} className="text-yellow-400 animate-pulse shrink-0" />
                            <span className="truncate">
                              {cardFoils.map(f => FOIL_TYPES.find(ft => ft.id === f)?.shortName || f).join(', ')}
                            </span>
                          </span>
                          <span className="text-[9px] px-1 py-0.2 bg-black/50 text-amber-300 rounded font-mono shrink-0 ml-1">
                            {cardFoils.length} {cardFoils.length === 1 ? 'foil' : 'foils'}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCardForFoilModal(card)}
                          className="w-full py-1 px-1.5 rounded-lg text-[10px] font-semibold transition flex items-center justify-center gap-1 bg-slate-900/80 hover:bg-purple-950/70 border border-slate-800 hover:border-purple-600/60 text-slate-400 hover:text-purple-300"
                          title="Marcar acabamentos Foil (Arco-íris, Estilhaço, Ouro, etc.)"
                        >
                          <Sparkles size={11} className="text-slate-500" />
                          <span>+ Tipo Foil</span>
                        </button>
                      )}
                    </div>

                    {/* CONTROLES DE QUANTIDADE (+ / -) */}
                    <div className="w-full mt-1.5 pt-1.5 border-t border-slate-800/70 flex items-center justify-between gap-1">
                      <button
                        onClick={() => decrementCard(card)}
                        disabled={qty <= 0}
                        className={`flex-1 py-1 rounded-lg flex items-center justify-center transition text-xs font-bold ${
                          qty > 0 
                            ? 'bg-slate-800 hover:bg-red-950/80 hover:text-red-400 text-slate-300 border border-slate-700/60' 
                            : 'bg-slate-900/40 text-slate-600 cursor-not-allowed border border-transparent'
                        }`}
                        title="Diminuir quantidade"
                      >
                        <Minus size={13} />
                      </button>

                      <span className="px-2 font-mono font-bold text-xs text-slate-200">
                        {qty}
                      </span>

                      <button
                        onClick={() => incrementCard(card)}
                        className="flex-1 py-1 rounded-lg flex items-center justify-center transition text-xs font-bold bg-purple-950/70 hover:bg-purple-800 text-purple-200 border border-purple-700/50"
                        title="Aumentar quantidade"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" />
            <span>
              {albumEdition === 'legado' 
                ? 'Exibindo Álbum Legado com coleções clássicas e edições especiais.' 
                : albumEdition === 'moderno' 
                ? 'Exibindo Álbum Moderno com a era Invasão do Caos.' 
                : 'Exibindo Coleção Completa.'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
          >
            Fechar Álbum
          </button>
        </div>

        {/* TOAST FLUTUANTE DE SUCESSO */}
        {toastMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl bg-emerald-600/95 text-white font-bold text-xs sm:text-sm shadow-2xl flex items-center gap-2.5 border border-emerald-400 backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-200">
            <CheckCircle2 size={18} className="text-white shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

      </div>

      {/* MODAL DE INSERÇÃO DE COLEÇÕES / DECKS COMPLETOS */}
      {showBulkModal && (
        <div className="fixed inset-0 z-[160] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div 
            className="bg-[#0b0f19] border border-purple-500/40 w-full max-w-4xl max-h-[90vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
            onClick={e => e.stopPropagation()}
          >
            {/* HEADER DO MODAL */}
            <div className="p-4 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-purple-950/40 to-slate-950 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60 shrink-0">
                  <PackagePlus size={24} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                    Inserir Coleções & Decks Completos
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    Adicione todas as cartas de um Deck Estrutural ou Coleção de uma só vez ao seu álbum!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* BARRA DE CONFIGURAÇÕES (MODO + ABAS) */}
            <div className="p-3 sm:p-4 bg-slate-900/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Ação:</span>
                <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setBulkMode('add')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 text-xs ${
                      bulkMode === 'add'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Plus size={13} />
                    <span>+1 Cópia de Cada Carta</span>
                  </button>
                  <button
                    onClick={() => setBulkMode('ensure_at_least')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 text-xs ${
                      bulkMode === 'ensure_at_least'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    <span>Completar Faltantes (ao menos 1)</span>
                  </button>
                </div>
              </div>

              {/* ABAS */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setBulkTab('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition text-xs ${
                    bulkTab === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todas ({collectionsSummary.length})
                </button>
                <button
                  onClick={() => setBulkTab('deck')}
                  className={`px-3 py-1 rounded-lg font-bold transition text-xs flex items-center gap-1 ${
                    bulkTab === 'deck' ? 'bg-amber-950/80 text-amber-300 border border-amber-600/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Shield size={12} />
                  <span>Decks ({collectionsSummary.filter(c => c.category === 'deck').length})</span>
                </button>
                <button
                  onClick={() => setBulkTab('booster')}
                  className={`px-3 py-1 rounded-lg font-bold transition text-xs flex items-center gap-1 ${
                    bulkTab === 'booster' ? 'bg-purple-950/80 text-purple-300 border border-purple-600/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles size={12} />
                  <span>Boosters ({collectionsSummary.filter(c => c.category === 'booster').length})</span>
                </button>
              </div>
            </div>

            {/* LISTA DE CARDS DAS COLEÇÕES */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#08080c] space-y-3.5 custom-scrollbar">
              {collectionsSummary
                .filter(col => bulkTab === 'all' || col.category === bulkTab)
                .map(col => {
                  const isLoading = bulkLoadingName === col.name;
                  const isComplete = col.ownedCount >= col.totalCards;

                  return (
                    <div
                      key={col.name}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                        isComplete
                          ? 'bg-slate-900/70 border-emerald-500/40 shadow-sm'
                          : 'bg-slate-900/40 border-slate-800 hover:border-purple-500/40'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <div className="w-12 h-16 sm:w-14 sm:h-20 rounded-xl bg-slate-950 overflow-hidden shrink-0 border border-slate-700/80 shadow-md flex items-center justify-center">
                          {col.coverImage ? (
                            <img src={col.coverImage} alt={col.name} className="w-full h-full object-cover" />
                          ) : (
                            <Layers size={22} className="text-purple-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm sm:text-base font-black text-white">
                              {col.name}
                            </h4>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                              col.category === 'deck' 
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-600/40' 
                                : 'bg-purple-950/80 text-purple-300 border border-purple-600/40'
                            }`}>
                              {col.category === 'deck' ? 'Deck Estrutural (30)' : 'Booster Pack'}
                            </span>
                            {isComplete && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                <CheckCircle2 size={11} /> Completo
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {col.subtitle} • {col.totalCards} cartas registradas
                          </p>

                          {/* Progresso no Álbum */}
                          <div className="mt-2 space-y-1 max-w-md">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Posse no Álbum:</span>
                              <span className="font-bold text-slate-200">
                                {col.ownedCount} de {col.totalCards} únicas ({col.percent}%) • {col.totalCopies} cópias
                              </span>
                            </div>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isComplete ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-purple-600 to-indigo-500'
                                }`}
                                style={{ width: `${col.percent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                        {col.ownedCount > 0 && (
                          <button
                            onClick={() => handleRemoveCollection(col.name)}
                            disabled={isLoading}
                            className="p-2.5 rounded-xl bg-slate-900 hover:bg-red-950/80 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-700/60 transition text-xs font-bold"
                            title="Zerar cópias desta coleção no álbum"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}

                        <button
                          onClick={() => handleAddCollection(col.name)}
                          disabled={isLoading}
                          className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950/40 active:scale-95 disabled:opacity-50"
                        >
                          {isLoading ? (
                            <>
                              <RefreshCw size={15} className="animate-spin" />
                              <span>Salvando...</span>
                            </>
                          ) : (
                            <>
                              <Plus size={15} />
                              <span>
                                {bulkMode === 'add'
                                  ? `Inserir Coleção (+1 cada)`
                                  : `Completar Faltantes`}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* FOOTER DO MODAL */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Sincronizado automaticamente com a sua conta na nuvem.</span>
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GERENCIAMENTO DE TIPOS FOIL DA CARTA */}
      {cardForFoilModal && (
        <div className="fixed inset-0 z-[170] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div 
            className="bg-[#0e111c] border border-purple-500/50 w-full max-w-2xl max-h-[90vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-purple-900/40 bg-gradient-to-r from-pink-950/60 via-purple-950/50 to-slate-950 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-pink-950/60 shrink-0">
                  <Sparkles size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    Acabamentos Foil da Carta
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {cardForFoilModal.name} <span className="font-mono text-purple-400">({cardForFoilModal.code})</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCardForFoilModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
              {/* Preview e Resumo */}
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-14 bg-slate-950 rounded-lg overflow-hidden shrink-0 border border-slate-700">
                    {cardForFoilModal.imageUrl ? (
                      <img src={cardForFoilModal.imageUrl} alt={cardForFoilModal.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px] font-bold">LDT</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white block truncate">{cardForFoilModal.name}</span>
                    <span className="text-xs text-slate-400 font-mono">
                      {cardForFoilModal.collection} • Posse: <strong className="text-emerald-400 font-bold">{getQuantity(cardForFoilModal)}x</strong>
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Foils Ativas:</span>
                  <span className="text-xs font-bold text-yellow-300 font-mono">
                    {getCardFoils(cardForFoilModal).length} de 11 tipos
                  </span>
                </div>
              </div>

              {/* Botões Rápidos */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-purple-400" />
                  Selecione os Tipos Foil que possui:
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        if (onOpenAuth) onOpenAuth();
                        return;
                      }
                      FOIL_TYPES.forEach(f => {
                        if (!hasFoil(cardForFoilModal, f.id)) {
                          toggleCardFoil(cardForFoilModal, f.id);
                        }
                      });
                    }}
                    className="text-[11px] text-purple-400 hover:text-purple-300 font-bold px-2 py-1 rounded bg-purple-950/50 hover:bg-purple-900 border border-purple-800/60 transition"
                  >
                    Marcar Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        if (onOpenAuth) onOpenAuth();
                        return;
                      }
                      FOIL_TYPES.forEach(f => {
                        if (hasFoil(cardForFoilModal, f.id)) {
                          toggleCardFoil(cardForFoilModal, f.id);
                        }
                      });
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-200 font-bold px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* Grid dos 11 Tipos de Foil */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {FOIL_TYPES.map((foil) => {
                  const isActive = hasFoil(cardForFoilModal, foil.id);

                  return (
                    <button
                      key={foil.id}
                      type="button"
                      onClick={() => {
                        if (!user) {
                          if (onOpenAuth) onOpenAuth();
                          return;
                        }
                        toggleCardFoil(cardForFoilModal, foil.id);
                      }}
                      className={`p-3 rounded-2xl border text-left transition duration-200 flex items-start justify-between gap-3 group ${
                        isActive
                          ? `${foil.badgeBg} border-2 ${foil.border} shadow-lg shadow-purple-950/50`
                          : 'bg-slate-900/60 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-black tracking-wide ${isActive ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                            Foil {foil.name}
                          </span>
                          <span className="text-[10px] text-purple-300 font-mono">
                            ({foil.id})
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                          {foil.description}
                        </p>
                      </div>

                      {/* Checkbox visual */}
                      <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition ${
                        isActive 
                          ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-md' 
                          : 'border border-slate-700 bg-slate-950/70 text-transparent'
                      }`}>
                        <Check size={13} className={isActive ? 'opacity-100' : 'opacity-0'} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span>As alterações de Foil são salvas automaticamente na nuvem.</span>
              <button
                type="button"
                onClick={() => setCardForFoilModal(null)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-md"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
