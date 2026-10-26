import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Layers,
  Plus,
  Search,
  ShoppingCart,
  Check,
  Trash2,
  User as UserIcon,
  ShieldCheck,
  Percent,
  Tag,
  MapPin,
  Eye,
  X,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Edit3,
  Info,
  HelpCircle,
  Wallet
} from 'lucide-react';
import {
  CardCondition,
  CardData,
  MarketplaceCardEntry,
  MarketplaceListing,
  MarketplaceListingType
} from '../types';
import {
  addMarketplaceListingToCart,
  calculatePlatformCommission,
  createMarketplaceListing,
  deleteMarketplaceListing,
  formatBRL,
  formatCep,
  formatPhone,
  parseBRLPrice,
  PLATFORM_FEE_PERCENT,
  updateMarketplaceListing
} from '../storeService';

interface CommunityMarketplaceViewProps {
  listings: MarketplaceListing[];
  allCards: CardData[];
  user: any;
  isAdmin?: boolean;
  onOpenAuth?: () => void;
  onOpenCartDrawer: () => void;
}

const CARD_CONDITIONS: CardCondition[] = [
  'Mint',
  'Near Mint (NM)',
  'Slightly Played (SP)',
  'Moderately Played (MP)',
  'Heavily Played (HP)'
];

export const CommunityMarketplaceView: React.FC<CommunityMarketplaceViewProps> = ({
  listings,
  allCards,
  user,
  isAdmin,
  onOpenAuth,
  onOpenCartDrawer
}) => {
  const [subTab, setSubTab] = useState<'explore' | 'sell' | 'my_listings' | 'how_it_works'>('explore');

  // Filter states for Explore
  const [typeFilter, setTypeFilter] = useState<'all' | MarketplaceListingType>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');
  const [onlyFoil, setOnlyFoil] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'price-asc' | 'price-desc'>('recent');
  const [addedId, setAddedId] = useState<string | null>(null);
  const [inspectListing, setInspectListing] = useState<MarketplaceListing | null>(null);

  // Create / Edit Listing Form State
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [listingType, setListingType] = useState<MarketplaceListingType>('single_card');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceInput, setPriceInput] = useState('49,90');
  const [stockQuantity, setStockQuantity] = useState(1);
  const [condition, setCondition] = useState<CardCondition>('Near Mint (NM)');
  const [isFoil, setIsFoil] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [selectedCardCode, setSelectedCardCode] = useState('');
  const [cardSearchTerm, setCardSearchTerm] = useState('');
  const [includedCards, setIncludedCards] = useState<MarketplaceCardEntry[]>([]);

  // Seller Payout & Location Info
  const [sellerPixKeyType, setSellerPixKeyType] = useState<'cpf' | 'email' | 'phone' | 'random'>('cpf');
  const [sellerPixKey, setSellerPixKey] = useState('');
  const [sellerWhatsapp, setSellerWhatsapp] = useState('');
  const [sellerCep, setSellerCep] = useState('');
  const [sellerCity, setSellerCity] = useState('');
  const [sellerState, setSellerState] = useState('');

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Live 10% commission breakdown for current priceInput
  const parsedPrice = useMemo(() => parseBRLPrice(priceInput), [priceInput]);
  const commissionBreakdown = useMemo(
    () => calculatePlatformCommission(parsedPrice),
    [parsedPrice]
  );

  // Official catalog cards for picker
  const catalogCards = useMemo(() => {
    return (allCards || []).filter((c) => c && !c.deleted && !c.isHidden);
  }, [allCards]);

  const filteredCatalogCards = useMemo(() => {
    const q = cardSearchTerm.toLowerCase().trim();
    if (!q) return catalogCards.slice(0, 24);
    return catalogCards
      .filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.code || '').toLowerCase().includes(q) ||
          (c.collection || '').toLowerCase().includes(q) ||
          (c.archetype || '').toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [catalogCards, cardSearchTerm]);

  // Active community listings for Explore
  const activeListings = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = (listings || []).filter((item) => {
      if (item.status !== 'active' || item.stockQuantity <= 0) return false;
      if (typeFilter !== 'all' && item.listingType !== typeFilter) return false;
      if (conditionFilter !== 'all' && item.condition !== conditionFilter) return false;
      if (onlyFoil && !item.isFoil) return false;
      if (q) {
        const hay = `${item.title} ${item.description} ${item.cardName || ''} ${item.sellerName || ''} ${
          (item.includedCards || []).map((c) => c.cardName).join(' ')
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    return list;
  }, [listings, typeFilter, conditionFilter, onlyFoil, searchQuery, sortBy]);

  const myListings = useMemo(() => {
    if (!user) return [];
    return (listings || []).filter(
      (item) => item.sellerId === user.uid || item.sellerEmail === user.email || isAdmin
    );
  }, [listings, user, isAdmin]);

  const handleSelectSingleCardFromCatalog = (card: CardData) => {
    const coverImg = card.catalogCoverImageUrl || card.imageUrl || '';
    setSelectedCardCode(card.code);
    if (!title || title.startsWith('Carta:')) {
      setTitle(`${card.name} (${card.code})`);
    }
    if (coverImg && !imageUrl) {
      setImageUrl(coverImg);
    }
    if (!description) {
      setDescription(
        `Carta original Light Dark TCG • Coleção: ${card.collection || 'Oficial'} • Raridade: ${
          card.rarity || 'Padrão'
        }`
      );
    }
  };

  const handleAddCardToCollection = (card: CardData) => {
    const coverImg = card.catalogCoverImageUrl || card.imageUrl || '';
    setIncludedCards((prev) => {
      const idx = prev.findIndex((c) => c.cardId === card.code);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          cardId: card.code,
          cardName: card.name,
          cardType: card.type,
          cardImageUrl: coverImg,
          quantity: 1,
          condition: condition
        }
      ];
    });
    if (!imageUrl && coverImg) {
      setImageUrl(coverImg);
    }
  };

  const handleUpdateCollectionCardQty = (cardId: string, delta: number) => {
    setIncludedCards((prev) =>
      prev
        .map((c) => (c.cardId === cardId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const resetForm = () => {
    setEditingListingId(null);
    setListingType('single_card');
    setTitle('');
    setDescription('');
    setPriceInput('49,90');
    setStockQuantity(1);
    setCondition('Near Mint (NM)');
    setIsFoil(false);
    setImageUrl('');
    setSelectedCardCode('');
    setIncludedCards([]);
    setFormError('');
  };

  const handleStartEdit = (item: MarketplaceListing) => {
    setEditingListingId(item.id);
    setListingType(item.listingType);
    setTitle(item.title);
    setDescription(item.description);
    setPriceInput(item.price.toFixed(2).replace('.', ','));
    setStockQuantity(item.stockQuantity || 1);
    setCondition(item.condition);
    setIsFoil(Boolean(item.isFoil));
    setImageUrl(item.imageUrl || '');
    setSelectedCardCode(item.cardId || '');
    setIncludedCards(item.includedCards || []);
    setSellerPixKeyType(item.sellerPixKeyType || 'cpf');
    setSellerPixKey(item.sellerPixKey || '');
    setSellerWhatsapp(item.sellerWhatsapp || '');
    setSellerCep(item.sellerCep || '');
    setSellerCity(item.sellerCity || '');
    setSellerState(item.sellerState || '');
    setFormError('');
    setFormSuccess('');
    setSubTab('sell');
  };

  const handleSubmitListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!user) {
      setFormError('Faça login na sua conta para anunciar cartas ou coleções no Mercado.');
      return;
    }

    if (!title.trim()) {
      setFormError('Informe um título para o seu anúncio.');
      return;
    }

    if (parsedPrice < 2) {
      setFormError('O valor mínimo para anunciar no Mercado é R$ 2,00.');
      return;
    }

    if (!sellerPixKey.trim()) {
      setFormError(
        'Informe sua Chave PIX para receber os 90% líquidos quando sua carta ou coleção for vendida.'
      );
      return;
    }

    const totalCardsInCollection = includedCards.reduce((acc, c) => acc + c.quantity, 0);

    setIsSaving(true);
    try {
      const matchedCatalogCard = catalogCards.find((c) => c.code === selectedCardCode);
      const finalImage =
        imageUrl.trim() ||
        matchedCatalogCard?.catalogCoverImageUrl ||
        matchedCatalogCard?.imageUrl ||
        includedCards[0]?.cardImageUrl ||
        'https://i.imgur.com/cDLxOtO.png';

      const id = editingListingId || `MKT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const listingPayload: MarketplaceListing = {
        id,
        listingType,
        title: title.trim(),
        description:
          description.trim() ||
          (listingType === 'single_card'
            ? 'Carta avulsa anunciada por jogador da comunidade.'
            : 'Coleção / Lote anunciado por jogador da comunidade.'),
        price: parsedPrice,
        formattedPrice: formatBRL(parsedPrice),
        platformFeePercent: PLATFORM_FEE_PERCENT,
        platformFeeAmount: commissionBreakdown.platformFeeAmount,
        sellerNetAmount: commissionBreakdown.sellerNetAmount,
        stockQuantity: Math.max(1, Number(stockQuantity) || 1),
        condition,
        isFoil: listingType === 'single_card' ? isFoil : false,
        imageUrl: finalImage,
        cardId: listingType === 'single_card' ? selectedCardCode || undefined : undefined,
        cardName:
          listingType === 'single_card'
            ? matchedCatalogCard?.name || title.trim()
            : undefined,
        cardRarity: matchedCatalogCard?.rarity || undefined,
        includedCards: listingType === 'collection' ? includedCards : undefined,
        totalCardsCount:
          listingType === 'collection' ? Math.max(1, totalCardsInCollection) : 1,
        sellerId: user.uid,
        sellerName: user.displayName || user.email?.split('@')[0] || 'Duelista',
        sellerEmail: user.email || '',
        sellerAvatar: user.photoURL || '',
        sellerWhatsapp: sellerWhatsapp.trim(),
        sellerCep: sellerCep.trim(),
        sellerCity: sellerCity.trim(),
        sellerState: sellerState.trim().toUpperCase(),
        sellerPixKey: sellerPixKey.trim(),
        sellerPixKeyType,
        weightGrams: listingType === 'single_card' ? 40 : Math.max(150, totalCardsInCollection * 5),
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (editingListingId) {
        await updateMarketplaceListing(editingListingId, listingPayload);
        setFormSuccess('Anúncio atualizado com sucesso no Mercado!');
      } else {
        await createMarketplaceListing(listingPayload);
        setFormSuccess('Seu anúncio foi publicado no Mercado da Comunidade!');
      }

      resetForm();
      setTimeout(() => {
        setFormSuccess('');
        setSubTab('explore');
      }, 1400);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao publicar anúncio.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ================= TOP BANNER & SUB-NAVIGATION ================= */}
      <div className="bg-gradient-to-r from-purple-950/70 via-[#12111c] to-emerald-950/50 border border-purple-500/30 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
            <ShieldCheck size={13} />
            <span>Mercado da Comunidade · Compra & Venda entre Jogadores</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Compre e Venda Cartas Avulsas, Decks e Coleções Completas
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Anuncie suas cartas ou coleções gratuitamente. O comprador paga com segurança via{' '}
            <strong className="text-white">PIX ou Cartão (Mercado Pago)</strong>, o site retém{' '}
            <strong className="text-amber-300">10% de taxa de intermediação</strong> e repassa{' '}
            <strong className="text-emerald-400">90% do valor direto para o seu PIX</strong>.
          </p>
        </div>

        {/* Action Sub-tabs */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('explore')}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              subTab === 'explore'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/50'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Sparkles size={14} />
            <span>Explorar ({activeListings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetForm();
              setSubTab('sell');
            }}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              subTab === 'sell'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            <Plus size={15} />
            <span>Anunciar Carta / Coleção</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('my_listings')}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              subTab === 'my_listings'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <UserIcon size={14} />
            <span>Meus Anúncios ({myListings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('how_it_works')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              subTab === 'how_it_works'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30'
            }`}
            title="Entenda como funciona a taxa de 10% e o repasse via PIX"
          >
            <HelpCircle size={14} />
            <span>Como Funciona (Taxa 10%)</span>
          </button>
        </div>
      </div>

      {/* ================= TAB 1: EXPLORE COMMUNITY LISTINGS ================= */}
      {subTab === 'explore' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Filter Sidebar */}
          <aside className="lg:col-span-3 space-y-4">
            <div className="bg-[#0e0e14] border border-slate-800/90 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
                Tipo de Anúncio
              </h3>
              <div className="space-y-1">
                {[
                  { id: 'all', label: 'Todos os Anúncios', icon: <Sparkles size={14} /> },
                  { id: 'single_card', label: 'Cartas Avulsas (Singles)', icon: <Tag size={14} /> },
                  { id: 'collection', label: 'Coleções, Lotes & Decks', icon: <Layers size={14} /> }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTypeFilter(t.id as any)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      typeFilter === t.id
                        ? 'bg-purple-600/20 text-purple-300 border border-purple-500/50'
                        : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#0e0e14] border border-slate-800/90 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
                Estado de Conservação
              </h3>
              <select
                value={conditionFilter}
                onChange={(e) => setConditionFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-semibold outline-none"
              >
                <option value="all">Qualquer Condição</option>
                {CARD_CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </select>

              <label className="flex items-center justify-between gap-2 text-xs text-slate-300 cursor-pointer pt-1">
                <span>Apenas Cartas Foil / Brilhantes</span>
                <input
                  type="checkbox"
                  checked={onlyFoil}
                  onChange={(e) => setOnlyFoil(e.target.checked)}
                  className="accent-purple-500 w-4 h-4 rounded"
                />
              </label>
            </div>

            {/* Sell Call-to-Action Card */}
            <div className="bg-[#0e0e14] border border-emerald-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <Wallet size={16} />
                <span>Tem cartas repetidas ou uma coleção?</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Publique seu anúncio em segundos e receba <strong className="text-white">90% do valor</strong> direto no seu PIX (apenas 10% de comissão do site).
              </p>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setSubTab('sell');
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
              >
                + Vender Minha Carta / Coleção
              </button>
            </div>
          </aside>

          {/* Right Listings Grid */}
          <main className="lg:col-span-9 space-y-4">
            {/* Search & Sort Bar */}
            <div className="bg-[#0e0e14] border border-slate-800/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar carta avulsa, coleção, vendedor, raridade..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl pl-9 pr-4 py-2 text-xs text-white outline-none"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-400">Ordenar:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none"
                >
                  <option value="recent">Mais Recentes</option>
                  <option value="price-asc">Menor Preço</option>
                  <option value="price-desc">Maior Preço</option>
                </select>
              </div>
            </div>

            {activeListings.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {activeListings.map((item) => {
                  const isAdded = addedId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="bg-[#0e0e14] border border-slate-800/90 hover:border-purple-500/50 rounded-2xl overflow-hidden flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5 shadow-lg"
                    >
                      <div>
                        {/* Image Header */}
                        <div
                          onClick={() => setInspectListing(item)}
                          className="relative aspect-[4/3] bg-black overflow-hidden cursor-pointer group"
                        >
                          <img
                            src={item.imageUrl || 'https://i.imgur.com/cDLxOtO.png'}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain bg-slate-950 group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />

                          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                                item.listingType === 'single_card'
                                  ? 'bg-purple-950/90 text-purple-200 border-purple-500/40'
                                  : 'bg-amber-950/90 text-amber-200 border-amber-500/40'
                              }`}
                            >
                              {item.listingType === 'single_card'
                                ? 'Carta Avulsa'
                                : `Coleção (${item.totalCardsCount || item.includedCards?.length || 1} cartas)`}
                            </span>

                            {item.isFoil && (
                              <span className="text-[10px] font-black uppercase bg-gradient-to-r from-amber-400 to-purple-400 text-slate-950 px-2 py-0.5 rounded-md">
                                ✨ FOIL
                              </span>
                            )}
                          </div>

                          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-emerald-300 font-semibold">
                              {item.condition}
                            </span>
                            <span className="bg-black/80 px-2 py-0.5 rounded text-slate-200 flex items-center gap-1 border border-white/10">
                              <Eye size={11} />
                              <span>Detalhes</span>
                            </span>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="p-4 space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="flex items-center gap-1 truncate">
                              <UserIcon size={11} className="text-purple-400 shrink-0" />
                              <strong className="text-slate-200 truncate">{item.sellerName}</strong>
                            </span>
                            {item.sellerCity && item.sellerState && (
                              <span className="flex items-center gap-0.5 text-[10px] text-slate-400 shrink-0">
                                <MapPin size={10} />
                                {item.sellerCity}/{item.sellerState}
                              </span>
                            )}
                          </div>

                          <h3
                            onClick={() => setInspectListing(item)}
                            className="text-sm sm:text-base font-bold text-white leading-snug hover:text-purple-300 cursor-pointer line-clamp-1"
                          >
                            {item.title}
                          </h3>

                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>

                          {item.listingType === 'collection' &&
                            item.includedCards &&
                            item.includedCards.length > 0 && (
                              <div className="pt-1 flex flex-wrap gap-1">
                                {item.includedCards.slice(0, 3).map((c) => (
                                  <span
                                    key={c.cardId}
                                    className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded"
                                  >
                                    {c.quantity}x {c.cardName}
                                  </span>
                                ))}
                                {item.includedCards.length > 3 && (
                                  <span className="text-[10px] text-purple-300 font-semibold px-1.5 py-0.5">
                                    +{item.includedCards.length - 3} cartas
                                  </span>
                                )}
                              </div>
                            )}
                        </div>
                      </div>

                      {/* Footer Price & Buy */}
                      <div className="p-4 pt-3 border-t border-slate-800/80 bg-slate-950/40 space-y-2.5">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 block">
                              Compra Garantida via Mercado Pago
                            </span>
                            <span className="text-lg font-black text-emerald-400 font-mono tabular-nums">
                              {formatBRL(item.price)}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-amber-300 tabular-nums">
                            {item.stockQuantity} disp.
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              addMarketplaceListingToCart(item, 1);
                              setAddedId(item.id);
                              setTimeout(() => setAddedId(null), 1400);
                            }}
                            className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1 border cursor-pointer ${
                              isAdded
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-700'
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <Check size={13} />
                                <span>Adicionado!</span>
                              </>
                            ) : (
                              <>
                                <Plus size={13} />
                                <span>Por no Carrinho</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              addMarketplaceListingToCart(item, 1);
                              onOpenCartDrawer();
                            }}
                            className="flex-1 py-2 px-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center justify-center gap-1 shadow-md shadow-purple-950/50 cursor-pointer"
                          >
                            <ShoppingCart size={13} />
                            <span>Comprar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#0e0e14] border border-slate-800/90 rounded-2xl p-10 text-center space-y-4">
                <Sparkles size={40} className="mx-auto text-purple-400" />
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Nenhum anúncio de jogador encontrado
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Seja o primeiro a anunciar uma carta avulsa ou coleção completa no Mercado Light Dark!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setSubTab('sell');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  + Criar Primeiro Anúncio
                </button>
              </div>
            )}
          </main>
        </div>
      )}

      {/* ================= TAB 2: SELL CARD OR COLLECTION FORM ================= */}
      {subTab === 'sell' && (
        <div className="bg-[#0e0e14] border border-slate-800/90 rounded-2xl p-5 sm:p-7 max-w-5xl mx-auto">
          {!user ? (
            <div className="text-center py-12 space-y-4">
              <UserIcon size={44} className="mx-auto text-purple-400" />
              <h3 className="text-lg font-bold text-white">
                Faça login para vender suas cartas e coleções
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Você precisa estar conectado à sua conta Light Dark para cadastrar anúncios, gerenciar seu estoque e informar sua chave PIX de recebimento.
              </p>
              {onOpenAuth && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer"
                >
                  Entrar / Criar Conta
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmitListing} className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-black text-white">
                    {editingListingId
                      ? 'Editar Anúncio no Mercado'
                      : 'Anunciar Carta Avulsa ou Coleção'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Anúncio gratuito · Taxa de apenas 10% somente quando a venda for concluída.
                  </p>
                </div>

                {/* Switch Single Card vs Collection */}
                <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setListingType('single_card')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      listingType === 'single_card'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Tag size={13} />
                    <span>Carta Avulsa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setListingType('collection')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      listingType === 'collection'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers size={13} />
                    <span>Coleção / Lote / Deck</span>
                  </button>
                </div>
              </div>

              {formError && (
                <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-600/60 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/60 text-emerald-200 text-xs flex items-center gap-2 font-bold">
                  <Check size={16} className="shrink-0 text-emerald-400" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Card/Collection Picker & Details (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Official Catalog Card Selector */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-purple-300">
                        {listingType === 'single_card'
                          ? '1. Selecionar Carta do Catálogo Oficial (Opcional)'
                          : '1. Adicionar Cartas à sua Coleção / Lote'}
                      </label>
                      <span className="text-[11px] text-slate-400">
                        Preenche foto e dados automaticamente
                      </span>
                    </div>

                    <div className="relative">
                      <Search
                        size={14}
                        className="text-slate-500 absolute left-3 top-1/2 -translate-y-1/2"
                      />
                      <input
                        type="text"
                        value={cardSearchTerm}
                        onChange={(e) => setCardSearchTerm(e.target.value)}
                        placeholder="Buscar carta pelo nome, código ou coleção..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="max-h-44 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1 custom-scrollbar">
                      {filteredCatalogCards.map((card) => {
                        const cover = card.catalogCoverImageUrl || card.imageUrl;
                        const isSelected =
                          listingType === 'single_card'
                            ? selectedCardCode === card.code
                            : includedCards.some((c) => c.cardId === card.code);
                        return (
                          <button
                            key={card.code}
                            type="button"
                            onClick={() =>
                              listingType === 'single_card'
                                ? handleSelectSingleCardFromCatalog(card)
                                : handleAddCardToCollection(card)
                            }
                            className={`p-2 rounded-lg border text-left transition flex items-center gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-purple-950/70 border-purple-500 text-white'
                                : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            {cover && (
                              <img
                                src={cover}
                                alt={card.name}
                                referrerPolicy="no-referrer"
                                className="w-8 h-10 object-cover rounded shrink-0 bg-black"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-bold truncate">{card.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate">
                                {card.code}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected Cards List for Collection */}
                    {listingType === 'collection' && includedCards.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 space-y-2">
                        <div className="text-xs font-bold text-amber-300">
                          Cartas incluídas nesta Coleção ({includedCards.reduce((a, b) => a + b.quantity, 0)} cartas):
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                          {includedCards.map((c) => (
                            <div
                              key={c.cardId}
                              className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded-lg text-xs"
                            >
                              <span className="truncate font-semibold text-white">
                                {c.cardName}{' '}
                                <span className="text-slate-500 font-mono">({c.cardId})</span>
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCollectionCardQty(c.cardId, -1)}
                                  className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                                >
                                  -
                                </button>
                                <span className="font-mono font-bold text-emerald-400 w-5 text-center">
                                  {c.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCollectionCardQty(c.cardId, 1)}
                                  className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Listing Title & Description */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        Título do Anúncio *
                      </label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={
                          listingType === 'single_card'
                            ? 'Ex: Mahina - Herdeiro do Caos (Foil Mint)'
                            : 'Ex: Coleção Completa Fallen Gods (45 Cartas + Foils)'
                        }
                        className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">
                          Condição *
                        </label>
                        <select
                          value={condition}
                          onChange={(e) => setCondition(e.target.value as CardCondition)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-semibold outline-none"
                        >
                          {CARD_CONDITIONS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">
                          Quantidade Disponível *
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={stockQuantity}
                          onChange={(e) => setStockQuantity(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none"
                        />
                      </div>

                      {listingType === 'single_card' && (
                        <div className="flex items-end pb-2">
                          <label className="flex items-center gap-2 text-xs font-bold text-amber-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isFoil}
                              onChange={(e) => setIsFoil(e.target.checked)}
                              className="accent-amber-400 w-4 h-4 rounded"
                            />
                            <span>✨ Versão Foil / Holográfica</span>
                          </label>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        URL da Foto da Carta ou Coleção (ou deixe a imagem oficial selecionada)
                      </label>
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://... (foto real da sua carta/coleção ou arte do catálogo)"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        Descrição Detalhada (sleeves inclusos, estado das bordas, tiragem, etc.)
                      </label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descreva os detalhes da carta ou a lista de cartas da sua coleção..."
                        className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-xs text-white outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Live 10% Fee Calculator & Seller PIX Payout Info (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Live 10% Commission Box */}
                  <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-4 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Percent size={14} />
                        <span>Preço & Simulador de Repasse (90% / 10%)</span>
                      </span>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-white block mb-1">
                        Preço de Venda do Anúncio (R$) *
                      </label>
                      <input
                        type="text"
                        required
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        placeholder="Ex: 89,90"
                        className="w-full bg-slate-900 border border-emerald-500/50 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-base font-black font-mono text-emerald-300 outline-none"
                      />
                    </div>

                    {/* Breakdown Table */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Valor Pago pelo Comprador:</span>
                        <span className="font-mono font-bold tabular-nums">
                          {formatBRL(commissionBreakdown.grossAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-amber-300">
                        <span>Taxa do Mercado Light Dark ({PLATFORM_FEE_PERCENT}%):</span>
                        <span className="font-mono font-bold tabular-nums">
                          - {formatBRL(commissionBreakdown.platformFeeAmount)}
                        </span>
                      </div>
                      <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-sm font-black text-emerald-400">
                        <span>Você Recebe no seu PIX (90%):</span>
                        <span className="font-mono tabular-nums">
                          {formatBRL(commissionBreakdown.sellerNetAmount)}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      O comprador paga pelo Mercado Pago (PIX ou Cartão). O valor de{' '}
                      <strong className="text-emerald-300">
                        {formatBRL(commissionBreakdown.sellerNetAmount)}
                      </strong>{' '}
                      é transferido para a sua Chave PIX abaixo após a confirmação do envio.
                    </p>
                  </div>

                  {/* Seller PIX Key & Contact Info */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-purple-300">
                      Dados para Recebimento (PIX) e Envio
                    </h4>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="text-[11px] text-slate-400 block mb-1">Tipo PIX *</label>
                        <select
                          value={sellerPixKeyType}
                          onChange={(e) => setSellerPixKeyType(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-2 text-xs text-white outline-none"
                        >
                          <option value="cpf">CPF/CNPJ</option>
                          <option value="email">E-mail</option>
                          <option value="phone">Celular</option>
                          <option value="random">Aleatória</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] text-slate-400 block mb-1">
                          Sua Chave PIX (para receber os 90%) *
                        </label>
                        <input
                          type="text"
                          required
                          value={sellerPixKey}
                          onChange={(e) => setSellerPixKey(e.target.value)}
                          placeholder="Digite sua chave PIX..."
                          className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          WhatsApp de Contato
                        </label>
                        <input
                          type="text"
                          value={sellerWhatsapp}
                          onChange={(e) => setSellerWhatsapp(formatPhone(e.target.value))}
                          placeholder="(11) 99999-9999"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">
                          CEP de Origem
                        </label>
                        <input
                          type="text"
                          value={sellerCep}
                          onChange={(e) => setSellerCep(formatCep(e.target.value))}
                          placeholder="00000-000"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="text-[11px] text-slate-400 block mb-1">Cidade</label>
                        <input
                          type="text"
                          value={sellerCity}
                          onChange={(e) => setSellerCity(e.target.value)}
                          placeholder="Ex: São Paulo"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">UF</label>
                        <input
                          type="text"
                          maxLength={2}
                          value={sellerState}
                          onChange={(e) => setSellerState(e.target.value.toUpperCase())}
                          placeholder="SP"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white uppercase outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    {editingListingId && (
                      <button
                        type="button"
                        onClick={() => {
                          resetForm();
                          setSubTab('my_listings');
                        }}
                        className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm transition shadow-lg shadow-emerald-950/60 cursor-pointer"
                    >
                      {isSaving
                        ? 'Salvando Anúncio...'
                        : editingListingId
                        ? 'Salvar Alterações no Anúncio'
                        : 'Publicar Anúncio no Mercado'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ================= TAB 3: MY LISTINGS ================= */}
      {subTab === 'my_listings' && (
        <div className="bg-[#0e0e14] border border-slate-800/90 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white">
                {isAdmin ? 'Todos os Anúncios da Comunidade (Visão Admin)' : 'Meus Anúncios Publicados'}
              </h3>
              <p className="text-xs text-slate-400">
                Gerencie preços, estoque e status dos seus anúncios de cartas e coleções.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setSubTab('sell');
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
            >
              + Novo Anúncio
            </button>
          </div>

          {myListings.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Layers size={36} className="mx-auto text-slate-600" />
              <p className="text-xs text-slate-400">
                Você ainda não possui cartas ou coleções anunciadas no Mercado.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {myListings.map((item) => (
                <div
                  key={item.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={item.imageUrl || 'https://i.imgur.com/cDLxOtO.png'}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-xl object-contain bg-black border border-slate-800 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">{item.title}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            item.status === 'active'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/40'
                              : 'bg-amber-950 text-amber-300 border border-amber-600/40'
                          }`}
                        >
                          {item.status === 'active' ? 'Ativo' : 'Pausado / Vendido'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Preço: <strong className="text-white font-mono">{formatBRL(item.price)}</strong> · Taxa 10%: <strong className="text-amber-300 font-mono">{formatBRL(item.platformFeeAmount)}</strong> · Você recebe (90%): <strong className="text-emerald-400 font-mono">{formatBRL(item.sellerNetAmount)}</strong>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Vendedor: {item.sellerName} · PIX ({item.sellerPixKeyType}): {item.sellerPixKey}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        updateMarketplaceListing(item.id, {
                          status: item.status === 'active' ? 'paused' : 'active'
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      {item.status === 'active' ? (
                        <>
                          <PauseCircle size={13} />
                          <span>Pausar</span>
                        </>
                      ) : (
                        <>
                          <PlayCircle size={13} />
                          <span>Reativar</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEdit(item)}
                      className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-xs text-purple-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 size={13} />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteMarketplaceListing(item.id)}
                      className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/70 border border-red-700/50 text-red-300 cursor-pointer"
                      title="Excluir anúncio"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 4: HOW THE 10% COMMISSION WORKS ================= */}
      {subTab === 'how_it_works' && (
        <div className="bg-[#0e0e14] border border-slate-800/90 rounded-2xl p-6 max-w-4xl mx-auto space-y-6">
          <div className="space-y-1 border-b border-slate-800 pb-4">
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <ShieldCheck size={20} className="text-emerald-400" />
              <span>Como Funciona o Mercado da Comunidade e a Taxa de 10%</span>
            </h3>
            <p className="text-xs text-slate-400">
              Transparência total para compradores, vendedores e administração do site Light Dark TCG.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 font-black text-sm">
                1
              </div>
              <h4 className="text-sm font-bold text-white">Anúncio Gratuito</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                O jogador cadastra sua Carta Avulsa ou Coleção gratuitamente e informa o preço desejado e sua Chave PIX. O sistema já mostra na hora os 10% de comissão do site e os 90% líquidos.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-black text-sm">
                2
              </div>
              <h4 className="text-sm font-bold text-white">Pagamento Seguro (Escrow)</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                O comprador paga 100% do pedido via PIX ou Cartão pelo Mercado Pago oficial do site. O pagamento fica retido com segurança na conta Mercado Pago da plataforma.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-black text-sm">
                3
              </div>
              <h4 className="text-sm font-bold text-white">Retenção de 10% e Repasse 90%</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Assim que o envio é confirmado, o site mantém automaticamente seus <strong>10% de comissão</strong> na conta Mercado Pago e transfere os <strong>90% líquidos</strong> para a Chave PIX do vendedor.
              </p>
            </div>
          </div>

          <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-black text-emerald-300 uppercase">
                Exemplo Prático de Venda de R$ 100,00
              </div>
              <p className="text-xs text-slate-300">
                • Comprador paga: <strong className="text-white">R$ 100,00</strong> (+ frete) via Mercado Pago.<br />
                • Comissão retida pelo site (10%): <strong className="text-amber-300">R$ 10,00</strong> (já fica na sua conta Mercado Pago).<br />
                • Repasse ao vendedor (90%): <strong className="text-emerald-400">R$ 90,00</strong> enviados via PIX pelo painel Admin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setSubTab('sell');
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 cursor-pointer"
            >
              Anunciar Agora
            </button>
          </div>
        </div>
      )}

      {/* ================= INSPECT LISTING MODAL ================= */}
      {inspectListing && (
        <div
          className="fixed inset-0 z-[95] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setInspectListing(null)}
        >
          <div
            className="bg-[#0e0e14] border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/40">
                  {inspectListing.listingType === 'single_card'
                    ? 'Carta Avulsa de Jogador'
                    : 'Coleção / Lote de Jogador'}
                </span>
                <h3 className="text-lg font-black text-white mt-1">{inspectListing.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectListing(null)}
                className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-black rounded-xl border border-slate-800 p-3 flex items-center justify-center">
                <img
                  src={inspectListing.imageUrl || 'https://i.imgur.com/cDLxOtO.png'}
                  alt={inspectListing.title}
                  referrerPolicy="no-referrer"
                  className="max-h-72 object-contain rounded"
                />
              </div>

              <div className="space-y-3">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vendedor:</span>
                    <span className="font-bold text-white">{inspectListing.sellerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Condição:</span>
                    <span className="font-bold text-emerald-400">{inspectListing.condition}</span>
                  </div>
                  {inspectListing.isFoil && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Acabamento:</span>
                      <span className="font-bold text-amber-300">✨ Foil / Holográfica</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Disponível:</span>
                    <span className="font-mono text-white">{inspectListing.stockQuantity} un.</span>
                  </div>
                  {inspectListing.sellerCity && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Localização:</span>
                      <span className="text-slate-200">
                        {inspectListing.sellerCity}/{inspectListing.sellerState}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {inspectListing.description}
                </p>

                <div className="pt-2 border-t border-slate-800">
                  <div className="text-xs text-slate-400">Valor no Mercado:</div>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    {formatBRL(inspectListing.price)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    addMarketplaceListingToCart(inspectListing, 1);
                    setInspectListing(null);
                    onOpenCartDrawer();
                  }}
                  className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <ShoppingCart size={15} />
                  <span>Adicionar ao Carrinho e Comprar</span>
                </button>
              </div>
            </div>

            {inspectListing.includedCards && inspectListing.includedCards.length > 0 && (
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Cartas Incluídas nesta Coleção ({inspectListing.totalCardsCount} cartas):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {inspectListing.includedCards.map((c) => (
                    <div
                      key={c.cardId}
                      className="flex items-center gap-2.5 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs"
                    >
                      {c.cardImageUrl && (
                        <img
                          src={c.cardImageUrl}
                          alt={c.cardName}
                          referrerPolicy="no-referrer"
                          className="w-8 h-10 object-cover rounded bg-black shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white truncate">
                          {c.quantity}x {c.cardName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{c.cardId}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
