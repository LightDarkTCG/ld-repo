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
  Award
} from 'lucide-react';
import { CardData } from '../types';
import { useCards, cleanCardCode } from '../CardContext';
import { useAuth } from '../authService';
import { useUserAlbum } from '../albumService';
import { compareCardCodes } from '../deckUtils';

interface AlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCard?: (card: CardData) => void;
}

export type AlbumEdition = 'legado' | 'moderno' | 'all';

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

export const AlbumModal: React.FC<AlbumModalProps> = ({ isOpen, onClose, onSelectCard }) => {
  const { user, loginWithGoogle } = useAuth();
  const { cards: allCards } = useCards();
  const { getQuantity, incrementCard, decrementCard } = useUserAlbum(user?.uid);

  // Edição do Álbum (Padrão: Legado conforme solicitação do usuário)
  const [albumEdition, setAlbumEdition] = useState<AlbumEdition>('legado');
  const [onlySpecials, setOnlySpecials] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('Todas');
  const [filterMode, setFilterMode] = useState<'all' | 'owned' | 'missing'>('all');

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

    // Deduplicação pelo código canônico + coleção + raridade para preservar variantes especiais
    const seen = new Set<string>();
    const list: CardData[] = [];

    for (const card of pool) {
      const codeKey = `${cleanCardCode(card.code)}_${card.collection || ''}_${card.rarity || ''}_${card.frame || ''}`;
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
      const qty = getQuantity(card.code);
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
      const qty = getQuantity(card.code);
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
  }, [albumPoolCards, searchTerm, selectedCollection, filterMode, onlySpecials, getQuantity]);

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

          <div className="flex items-center gap-3">
            {!user ? (
              <button
                onClick={loginWithGoogle}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white transition flex items-center gap-2 shadow-lg shadow-purple-900/40 active:scale-95"
              >
                <LogIn size={16} />
                <span>Entrar com Google</span>
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
                    {albumPoolCards.filter(c => isSpecialCard(c) && getQuantity(c.code) > 0).length}/{specialCardsCount}
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
                const qty = getQuantity(card.code);
                const isOwned = qty > 0;
                const cardSpecial = isSpecialCard(card);

                return (
                  <div
                    key={`${card.code}_${card.collection || ''}_${card.rarity || ''}`}
                    className={`relative rounded-xl transition-all duration-200 group flex flex-col items-center p-2 border ${
                      cardSpecial
                        ? isOwned
                          ? 'bg-slate-900/95 border-amber-500/70 shadow-lg shadow-amber-950/30'
                          : 'bg-slate-950/70 border-amber-600/40 opacity-80 hover:opacity-100'
                        : isOwned 
                        ? 'bg-slate-900/90 border-purple-500/50 shadow-md shadow-purple-950/30' 
                        : 'bg-slate-950/60 border-slate-800/80 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {/* BADGE DE QUANTIDADE / STATUS */}
                    <div className="absolute top-3 right-3 z-10">
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

                    {/* CONTROLES DE QUANTIDADE (+ / -) */}
                    <div className="w-full mt-2 pt-2 border-t border-slate-800/70 flex items-center justify-between gap-1">
                      <button
                        onClick={() => decrementCard(card.code)}
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
                        onClick={() => incrementCard(card.code)}
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

      </div>
    </div>
  );
};
