import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Layers,
  Plus,
  Search,
  Check,
  Trash2,
  User as UserIcon,
  Tag,
  MapPin,
  Eye,
  X,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Edit3,
  Star,
  MessageCircle,
  ExternalLink,
  ThumbsUp,
  Award,
  Truck
} from 'lucide-react';
import {
  CardCondition,
  CardData,
  MarketplaceCardEntry,
  MarketplaceListing,
  MarketplaceListingType,
  MarketplaceSellerReview
} from '../types';
import {
  createMarketplaceListing,
  createMarketplaceSellerReview,
  deleteMarketplaceListing,
  deleteMarketplaceSellerReview,
  formatBRL,
  formatCep,
  formatPhone,
  parseBRLPrice,
  subscribeMarketplaceSellerReviews,
  updateMarketplaceListing
} from '../storeService';

interface CommunityMarketplaceViewProps {
  listings: MarketplaceListing[];
  allCards: CardData[];
  user: any;
  isAdmin?: boolean;
  onOpenAuth?: () => void;
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
  onOpenAuth
}) => {
  const [subTab, setSubTab] = useState<'explore' | 'sell' | 'my_listings' | 'sellers_reputation'>('explore');

  // Seller Reviews from Firestore
  const [reviews, setReviews] = useState<MarketplaceSellerReview[]>([]);

  useEffect(() => {
    const unsub = subscribeMarketplaceSellerReviews((list) => {
      setReviews(list);
    });
    return () => unsub();
  }, []);

  // Filter states for Explore
  const [typeFilter, setTypeFilter] = useState<'all' | MarketplaceListingType>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');
  const [onlyFoil, setOnlyFoil] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'price-asc' | 'price-desc' | 'rating-desc'>('recent');
  const [inspectListing, setInspectListing] = useState<MarketplaceListing | null>(null);

  // Seller Reviews Modal State
  const [reviewModalSeller, setReviewModalSeller] = useState<{
    sellerId: string;
    sellerName: string;
    sellerAvatar?: string;
    defaultListingId?: string;
    defaultListingTitle?: string;
  } | null>(null);
  const [newRating, setNewRating] = useState<number>(5);
  const [newRecommend, setNewRecommend] = useState<boolean>(true);
  const [newComment, setNewComment] = useState<string>('');
  const [newReviewListingTitle, setNewReviewListingTitle] = useState<string>('');
  const [reviewError, setReviewError] = useState<string>('');
  const [reviewSuccess, setReviewSuccess] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

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

  // Seller Direct Contact & Shipping Notes
  const [sellerWhatsapp, setSellerWhatsapp] = useState('');
  const [sellerExternalLink, setSellerExternalLink] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('Envio via Correios (Carta Registrada / PAC / SEDEX) por conta do comprador');
  const [sellerCep, setSellerCep] = useState('');
  const [sellerCity, setSellerCity] = useState('');
  const [sellerState, setSellerState] = useState('');

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const parsedPrice = useMemo(() => parseBRLPrice(priceInput), [priceInput]);

  // Aggregate seller stats map: sellerId -> { average, count, recommendPct, reviews }
  const sellerStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        sellerId: string;
        sellerName: string;
        average: number;
        count: number;
        recommendPct: number;
        reviews: MarketplaceSellerReview[];
      }
    >();

    for (const r of reviews) {
      if (!r.sellerId) continue;
      const current = map.get(r.sellerId) || {
        sellerId: r.sellerId,
        sellerName: r.sellerName || 'Vendedor',
        average: 0,
        count: 0,
        recommendPct: 100,
        reviews: []
      };
      current.reviews.push(r);
      map.set(r.sellerId, current);
    }

    map.forEach((val) => {
      const count = val.reviews.length;
      if (count > 0) {
        const sum = val.reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
        const recCount = val.reviews.filter((r) => r.recommendSeller !== false).length;
        val.count = count;
        val.average = Math.round((sum / count) * 10) / 10;
        val.recommendPct = Math.round((recCount / count) * 100);
      }
    });

    return map;
  }, [reviews]);

  const getSellerStats = (sellerId: string) => {
    return (
      sellerStatsMap.get(sellerId) || {
        sellerId,
        sellerName: '',
        average: 0,
        count: 0,
        recommendPct: 100,
        reviews: []
      }
    );
  };

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
          item.sellerCity || ''
        } ${(item.includedCards || []).map((c) => c.cardName).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'rating-desc') {
        const rA = getSellerStats(a.sellerId).average;
        const rB = getSellerStats(b.sellerId).average;
        if (rB !== rA) return rB - rA;
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    return list;
  }, [listings, typeFilter, conditionFilter, onlyFoil, searchQuery, sortBy, sellerStatsMap]);

  const myListings = useMemo(() => {
    if (!user) return [];
    return (listings || []).filter(
      (item) => item.sellerId === user.uid || item.sellerEmail === user.email || isAdmin
    );
  }, [listings, user, isAdmin]);

  // All unique sellers with listings or reviews
  const allSellersDirectory = useMemo(() => {
    const map = new Map<
      string,
      {
        sellerId: string;
        sellerName: string;
        sellerAvatar?: string;
        sellerCity?: string;
        sellerState?: string;
        activeListingsCount: number;
      }
    >();

    for (const item of listings) {
      const existing = map.get(item.sellerId) || {
        sellerId: item.sellerId,
        sellerName: item.sellerName,
        sellerAvatar: item.sellerAvatar,
        sellerCity: item.sellerCity,
        sellerState: item.sellerState,
        activeListingsCount: 0
      };
      if (item.status === 'active' && item.stockQuantity > 0) {
        existing.activeListingsCount += 1;
      }
      map.set(item.sellerId, existing);
    }

    for (const r of reviews) {
      if (!map.has(r.sellerId)) {
        map.set(r.sellerId, {
          sellerId: r.sellerId,
          sellerName: r.sellerName || 'Vendedor',
          activeListingsCount: 0
        });
      }
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      const stA = getSellerStats(a.sellerId);
      const stB = getSellerStats(b.sellerId);
      if (stB.average !== stA.average) return stB.average - stA.average;
      return stB.count - stA.count;
    });
    return arr;
  }, [listings, reviews, sellerStatsMap]);

  const buildSellerWhatsAppUrl = (item: MarketplaceListing) => {
    const cleanPhone = (item.sellerWhatsapp || '').replace(/\D/g, '');
    if (!cleanPhone) return null;
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const msg = `Olá ${item.sellerName}! Vi seu anúncio *"${item.title}"* (${formatBRL(
      item.price
    )}) no Mercado de Jogadores do *Light Dark TCG* e tenho interesse em negociar!`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  };

  const openSellerReviewsModal = (
    sellerId: string,
    sellerName: string,
    sellerAvatar?: string,
    defaultListingId?: string,
    defaultListingTitle?: string
  ) => {
    setReviewModalSeller({
      sellerId,
      sellerName,
      sellerAvatar,
      defaultListingId,
      defaultListingTitle
    });
    setNewRating(5);
    setNewRecommend(true);
    setNewComment('');
    setNewReviewListingTitle(defaultListingTitle || '');
    setReviewError('');
    setReviewSuccess('');
  };

  const handleSubmitSellerReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError('');
    setReviewSuccess('');

    if (!user) {
      setReviewError('Faça login para avaliar este vendedor.');
      return;
    }

    if (!reviewModalSeller) return;

    if (user.uid === reviewModalSeller.sellerId) {
      setReviewError('Você não pode avaliar a si mesmo.');
      return;
    }

    if (!newComment.trim()) {
      setReviewError('Escreva um breve comentário sobre como foi a negociação e a entrega.');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const reviewId = `REV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const payload: MarketplaceSellerReview = {
        id: reviewId,
        sellerId: reviewModalSeller.sellerId,
        sellerName: reviewModalSeller.sellerName,
        buyerId: user.uid,
        buyerName: user.displayName || user.email?.split('@')[0] || 'Comprador',
        buyerEmail: user.email || '',
        buyerAvatar: user.photoURL || '',
        listingId: reviewModalSeller.defaultListingId,
        listingTitle: newReviewListingTitle.trim() || reviewModalSeller.defaultListingTitle || 'Negociação no Mercado',
        rating: newRating,
        comment: newComment.trim(),
        recommendSeller: newRecommend,
        createdAt: new Date().toISOString()
      };

      await createMarketplaceSellerReview(payload);
      setNewComment('');
      setReviewSuccess('Avaliação publicada com sucesso! Obrigado por ajudar a comunidade.');
    } catch (err: any) {
      setReviewError(err.message || 'Erro ao enviar avaliação.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

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
    setSellerWhatsapp(item.sellerWhatsapp || '');
    setSellerExternalLink(item.sellerExternalLink || '');
    setDeliveryNotes(
      item.deliveryNotes ||
        'Envio via Correios (Carta Registrada / PAC / SEDEX) por conta do comprador'
    );
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

    if (parsedPrice <= 0) {
      setFormError('Informe um valor válido para o anúncio.');
      return;
    }

    if (!sellerWhatsapp.trim() && !sellerExternalLink.trim()) {
      setFormError(
        'Informe seu WhatsApp ou um Link Externo para que os compradores possam negociar diretamente com você.'
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
        sellerExternalLink: sellerExternalLink.trim() || undefined,
        deliveryNotes: deliveryNotes.trim() || undefined,
        sellerCep: sellerCep.trim(),
        sellerCity: sellerCity.trim(),
        sellerState: sellerState.trim().toUpperCase(),
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
      }, 1200);
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
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
            <Sparkles size={13} />
            <span>Comércio Livre entre Jogadores · 0% de Taxa</span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Mercado da Galera: Cartas Avulsas, Decks e Coleções
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Negociação e entrega feitas <strong className="text-white">diretamente entre comprador e vendedor</strong>, sem taxas ou intermediação do site. Confira sempre as{' '}
            <strong className="text-amber-300">avaliações de outros compradores</strong> antes de fechar negócio e avalie o vendedor após receber suas cartas!
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
            onClick={() => setSubTab('sellers_reputation')}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              subTab === 'sellers_reputation'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30'
            }`}
          >
            <Star size={14} className={subTab === 'sellers_reputation' ? 'fill-slate-950' : 'fill-amber-400'} />
            <span>Avaliações de Vendedores ({reviews.length})</span>
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

            {/* Free Trade & Buyer Rating Info Box */}
            <div className="bg-[#0e0e14] border border-amber-500/30 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <Award size={16} />
                <span>Reputação por Comprador</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                O comércio é livre entre os jogadores (sem taxas). Clique nas estrelas de qualquer vendedor para ler relatos de quem já comprou ou deixar sua avaliação!
              </p>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setSubTab('sell');
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
              >
                + Anunciar Grátis
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
                  placeholder="Buscar carta avulsa, coleção, vendedor, cidade..."
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
                  <option value="rating-desc">Melhor Avaliação do Vendedor</option>
                  <option value="price-asc">Menor Preço</option>
                  <option value="price-desc">Maior Preço</option>
                </select>
              </div>
            </div>

            {activeListings.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {activeListings.map((item) => {
                  const sellerStats = getSellerStats(item.sellerId);
                  const waUrl = buildSellerWhatsAppUrl(item);

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
                              <span>Ver Detalhes</span>
                            </span>
                          </div>
                        </div>

                        {/* Body */}
                        <div className="p-4 space-y-2.5">
                          {/* Seller & Buyer Rating Row */}
                          <div className="flex items-center justify-between gap-2 bg-slate-950/90 border border-slate-800/80 rounded-xl px-2.5 py-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {item.sellerAvatar ? (
                                <img
                                  src={item.sellerAvatar}
                                  alt={item.sellerName}
                                  className="w-5 h-5 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <UserIcon size={12} className="text-purple-400 shrink-0" />
                              )}
                              <span className="text-xs font-bold text-slate-200 truncate">
                                {item.sellerName}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                openSellerReviewsModal(
                                  item.sellerId,
                                  item.sellerName,
                                  item.sellerAvatar,
                                  item.id,
                                  item.title
                                )
                              }
                              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold transition shrink-0 cursor-pointer"
                              title="Ver avaliações de compradores ou avaliar este vendedor"
                            >
                              <Star size={11} className="fill-amber-400 text-amber-400" />
                              {sellerStats.count > 0 ? (
                                <span>
                                  {sellerStats.average.toFixed(1)} ({sellerStats.count})
                                </span>
                              ) : (
                                <span>Avaliar</span>
                              )}
                            </button>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            {item.sellerCity && item.sellerState ? (
                              <span className="flex items-center gap-1 text-slate-400">
                                <MapPin size={11} className="text-emerald-400" />
                                {item.sellerCity}/{item.sellerState}
                              </span>
                            ) : (
                              <span>Envio direto com vendedor</span>
                            )}
                            <span className="font-mono text-amber-300">
                              {item.stockQuantity} disp.
                            </span>
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

                      {/* Footer Price & Direct Negotiation */}
                      <div className="p-4 pt-3 border-t border-slate-800/80 bg-slate-950/40 space-y-2.5">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 block">
                              Valor pedido pelo jogador
                            </span>
                            <span className="text-lg font-black text-emerald-400 font-mono tabular-nums">
                              {formatBRL(item.price)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              openSellerReviewsModal(
                                item.sellerId,
                                item.sellerName,
                                item.sellerAvatar,
                                item.id,
                                item.title
                              )
                            }
                            className="text-[11px] text-amber-300 hover:text-amber-200 underline cursor-pointer"
                          >
                            Avaliar Vendedor
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {waUrl ? (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/50"
                            >
                              <MessageCircle size={14} />
                              <span>Negociar no WhatsApp</span>
                            </a>
                          ) : item.sellerExternalLink ? (
                            <a
                              href={item.sellerExternalLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
                            >
                              <ExternalLink size={14} />
                              <span>Acessar Link do Anúncio</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setInspectListing(item)}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Eye size={14} />
                              <span>Ver Contato</span>
                            </button>
                          )}
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
                    Seja o primeiro a anunciar gratuitamente uma carta avulsa ou coleção completa no Mercado da Comunidade!
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
                  + Criar Primeiro Anúncio Grátis
                </button>
              </div>
            )}
          </main>
        </div>
      )}

      {/* ================= TAB 2: SELL CARD OR COLLECTION FORM (FREE PEER-TO-PEER) ================= */}
      {subTab === 'sell' && (
        <div className="bg-[#0e0e14] border border-slate-800/90 rounded-2xl p-5 sm:p-7 max-w-5xl mx-auto">
          {!user ? (
            <div className="text-center py-12 space-y-4">
              <UserIcon size={44} className="mx-auto text-purple-400" />
              <h3 className="text-lg font-bold text-white">
                Faça login para anunciar suas cartas e coleções
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Conecte-se à sua conta Light Dark para publicar seus anúncios gratuitamente e construir sua reputação de vendedor com avaliações dos compradores.
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
                      : 'Anunciar Carta Avulsa ou Coleção (100% Grátis)'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Comércio livre entre jogadores · Sem taxas do site · Você negocia pagamento e entrega diretamente com o comprador.
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
                        Descrição Detalhada (estado das bordas, sleeves inclusos, lista de cartas, etc.)
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

                {/* Right Column: Price & Direct Negotiation / Delivery Details (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-4 space-y-3">
                    <label className="text-xs font-bold text-white block">
                      Preço Pedido (R$) *
                    </label>
                    <input
                      type="text"
                      required
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      placeholder="Ex: 49,90"
                      className="w-full bg-slate-900 border border-emerald-500/50 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-base font-black font-mono text-emerald-300 outline-none"
                    />
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      <strong className="text-emerald-300">0% de taxa:</strong> Você recebe 100% do valor combinado diretamente com o comprador.
                    </p>
                  </div>

                  {/* Direct Contact & Delivery Info */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-purple-300">
                      Contato Direto & Forma de Entrega
                    </h4>

                    <div>
                      <label className="text-[11px] text-slate-300 font-bold block mb-1">
                        WhatsApp para Negociação *
                      </label>
                      <input
                        type="text"
                        value={sellerWhatsapp}
                        onChange={(e) => setSellerWhatsapp(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Link Externo Opcional (Mercado Livre, Shopee, MYP Cards, OLX, etc.)
                      </label>
                      <input
                        type="url"
                        value={sellerExternalLink}
                        onChange={(e) => setSellerExternalLink(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-lg px-3 py-2 text-xs text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Como você combina a entrega / envio?
                      </label>
                      <input
                        type="text"
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        placeholder="Ex: Carta Registrada, Correios, ou entrega em mãos"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">CEP</label>
                        <input
                          type="text"
                          value={sellerCep}
                          onChange={(e) => setSellerCep(formatCep(e.target.value))}
                          placeholder="00000-000"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white font-mono outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">Cidade</label>
                        <input
                          type="text"
                          value={sellerCity}
                          onChange={(e) => setSellerCity(e.target.value)}
                          placeholder="São Paulo"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white outline-none"
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
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white uppercase outline-none"
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
                        : 'Publicar Anúncio Grátis'}
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
                Gerencie preços, disponibilidade e status dos seus anúncios de cartas e coleções.
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
              {myListings.map((item) => {
                const sellerStats = getSellerStats(item.sellerId);
                return (
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
                          Valor: <strong className="text-emerald-400 font-mono">{formatBRL(item.price)}</strong> · Condição: <strong className="text-white">{item.condition}</strong>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>Vendedor: {item.sellerName}</span>
                          <span>·</span>
                          <span className="text-amber-300 flex items-center gap-1">
                            <Star size={11} className="fill-amber-400 text-amber-400" />
                            {sellerStats.count > 0
                              ? `${sellerStats.average.toFixed(1)} (${sellerStats.count} avaliações)`
                              : 'Sem avaliações ainda'}
                          </span>
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
                            <span>Marcar Vendido / Pausar</span>
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
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 4: SELLERS REPUTATION & BUYER REVIEWS ================= */}
      {subTab === 'sellers_reputation' && (
        <div className="bg-[#0e0e14] border border-slate-800/90 rounded-2xl p-5 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Star size={18} className="fill-amber-400 text-amber-400" />
                <span>Reputação de Vendedores & Avaliações por Comprador</span>
              </h3>
              <p className="text-xs text-slate-400">
                Consulte a nota e os comentários deixados por compradores reais da comunidade ou avalie um vendedor com quem você negociou.
              </p>
            </div>
          </div>

          {allSellersDirectory.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Star size={36} className="mx-auto text-slate-600" />
              <p className="text-xs text-slate-400">
                Ainda não há vendedores avaliados no Mercado da Comunidade.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allSellersDirectory.map((seller) => {
                const st = getSellerStats(seller.sellerId);
                return (
                  <div
                    key={seller.sellerId}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {seller.sellerAvatar ? (
                            <img
                              src={seller.sellerAvatar}
                              alt={seller.sellerName}
                              className="w-9 h-9 rounded-full object-cover border border-purple-500/40"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-purple-950 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold text-sm">
                              {(seller.sellerName || 'V')[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-white truncate">
                              {seller.sellerName}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {seller.activeListingsCount} anúncio(s) ativo(s)
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1 justify-end text-amber-400 font-black text-sm">
                            <Star size={14} className="fill-amber-400" />
                            <span>{st.count > 0 ? st.average.toFixed(1) : 'Novo'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {st.count} {st.count === 1 ? 'avaliação' : 'avaliações'}
                          </div>
                        </div>
                      </div>

                      {st.count > 0 && (
                        <div className="text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                          <ThumbsUp size={12} />
                          <span>{st.recommendPct}% dos compradores recomendam este vendedor</span>
                        </div>
                      )}

                      {st.reviews.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {st.reviews.slice(0, 2).map((rev) => (
                            <div
                              key={rev.id}
                              className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-2 text-[11px] space-y-1"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-200">{rev.buyerName}</span>
                                <span className="text-amber-400 font-bold">
                                  {'★'.repeat(rev.rating)}
                                </span>
                              </div>
                              <p className="text-slate-400 line-clamp-2">"{rev.comment}"</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openSellerReviewsModal(
                          seller.sellerId,
                          seller.sellerName,
                          seller.sellerAvatar
                        )
                      }
                      className="w-full py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs transition cursor-pointer"
                    >
                      Ver Todas as Avaliações / Avaliar Vendedor
                    </button>
                  </div>
                );
              })}
            </div>
          )}
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
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Vendedor:</span>
                    <span className="font-bold text-white">{inspectListing.sellerName}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Reputação:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const target = inspectListing;
                        setInspectListing(null);
                        openSellerReviewsModal(
                          target.sellerId,
                          target.sellerName,
                          target.sellerAvatar,
                          target.id,
                          target.title
                        );
                      }}
                      className="text-amber-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      <span>
                        {getSellerStats(inspectListing.sellerId).count > 0
                          ? `${getSellerStats(inspectListing.sellerId).average.toFixed(1)} (${
                              getSellerStats(inspectListing.sellerId).count
                            } avaliações)`
                          : 'Ver / Avaliar Vendedor'}
                      </span>
                    </button>
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

                  {inspectListing.sellerCity && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Localização:</span>
                      <span className="text-slate-200">
                        {inspectListing.sellerCity}/{inspectListing.sellerState}
                      </span>
                    </div>
                  )}

                  {inspectListing.deliveryNotes && (
                    <div className="pt-1.5 border-t border-slate-800 text-[11px] text-slate-300 flex items-start gap-1.5">
                      <Truck size={13} className="text-purple-400 shrink-0 mt-0.5" />
                      <span>{inspectListing.deliveryNotes}</span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {inspectListing.description}
                </p>

                <div className="pt-2 border-t border-slate-800">
                  <div className="text-xs text-slate-400">Valor pedido pelo vendedor:</div>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    {formatBRL(inspectListing.price)}
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  {buildSellerWhatsAppUrl(inspectListing) && (
                    <a
                      href={buildSellerWhatsAppUrl(inspectListing)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
                    >
                      <MessageCircle size={15} />
                      <span>Chamar Vendedor no WhatsApp ({inspectListing.sellerWhatsapp})</span>
                    </a>
                  )}

                  {inspectListing.sellerExternalLink && (
                    <a
                      href={inspectListing.sellerExternalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={14} />
                      <span>Abrir Link Externo do Vendedor</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const target = inspectListing;
                      setInspectListing(null);
                      openSellerReviewsModal(
                        target.sellerId,
                        target.sellerName,
                        target.sellerAvatar,
                        target.id,
                        target.title
                      );
                    }}
                    className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Star size={13} className="fill-amber-400 text-amber-400" />
                    <span>Avaliar este Vendedor / Ler Avaliações</span>
                  </button>
                </div>
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

      {/* ================= SELLER REVIEWS & BUYER RATING MODAL ================= */}
      {reviewModalSeller && (
        <div
          className="fixed inset-0 z-[98] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setReviewModalSeller(null)}
        >
          <div
            className="bg-[#0e0e14] border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black">
                  <Star size={20} className="fill-amber-400" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Avaliações do Vendedor: {reviewModalSeller.sellerName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sistema de reputação comunitária por comprador
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalSeller(null)}
                className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Seller Summary Strip */}
            {(() => {
              const st = getSellerStats(reviewModalSeller.sellerId);
              return (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-black font-mono text-amber-400">
                      {st.count > 0 ? st.average.toFixed(1) : '—'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-amber-400">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            size={14}
                            className={
                              st.count > 0 && n <= Math.round(st.average)
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-slate-700'
                            }
                          />
                        ))}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {st.count} {st.count === 1 ? 'avaliação de comprador' : 'avaliações de compradores'}
                      </div>
                    </div>
                  </div>

                  {st.count > 0 && (
                    <div className="px-3 py-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                      <ThumbsUp size={14} />
                      <span>{st.recommendPct}% recomendam</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Form to Submit Buyer Review */}
            <div className="bg-slate-950 border border-purple-500/30 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-purple-300">
                Comprou com {reviewModalSeller.sellerName}? Deixe sua Avaliação!
              </h4>

              {!user ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-400">
                    Faça login para avaliar este vendedor como comprador.
                  </p>
                  {onOpenAuth && (
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Entrar
                    </button>
                  )}
                </div>
              ) : user.uid === reviewModalSeller.sellerId ? (
                <p className="text-xs text-slate-400">
                  Este é o seu próprio perfil de vendedor. Apenas outros jogadores compradores podem deixar avaliações aqui.
                </p>
              ) : (
                <form onSubmit={handleSubmitSellerReview} className="space-y-3">
                  {reviewError && (
                    <div className="p-2.5 rounded-lg bg-red-950/70 border border-red-600/50 text-red-200 text-xs">
                      {reviewError}
                    </div>
                  )}
                  {reviewSuccess && (
                    <div className="p-2.5 rounded-lg bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs font-bold">
                      {reviewSuccess}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Sua Nota para o Vendedor:
                      </label>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewRating(star)}
                            className="p-1 cursor-pointer transition hover:scale-110"
                          >
                            <Star
                              size={22}
                              className={
                                star <= newRating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-700'
                              }
                            />
                          </button>
                        ))}
                        <span className="ml-2 text-xs font-bold text-amber-300">
                          {newRating} de 5 estrelas
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Você recomenda este vendedor?
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setNewRecommend(true)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                            newRecommend
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          👍 Sim, recomendo
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewRecommend(false)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                            !newRecommend
                              ? 'bg-red-600 text-white border-red-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          👎 Não recomendo
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Qual carta ou coleção você comprou?
                    </label>
                    <input
                      type="text"
                      value={newReviewListingTitle}
                      onChange={(e) => setNewReviewListingTitle(e.target.value)}
                      placeholder="Ex: Carta Avulsa Mahina Foil / Lote 30 Cartas"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Relato da Compra (entrega, embalagem, estado real das cartas) *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Conte para outros compradores como foi negociar com este vendedor..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-purple-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer"
                  >
                    {isSubmittingReview ? 'Publicando Avaliação...' : 'Publicar Avaliação de Comprador'}
                  </button>
                </form>
              )}
            </div>

            {/* Existing Buyer Reviews List */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                Histórico de Avaliações ({getSellerStats(reviewModalSeller.sellerId).count})
              </h4>

              {getSellerStats(reviewModalSeller.sellerId).reviews.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Este vendedor ainda não recebeu avaliações de compradores.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {getSellerStats(reviewModalSeller.sellerId).reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{rev.buyerName}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              rev.recommendSeller !== false
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                : 'bg-red-950 text-red-300 border border-red-500/30'
                            }`}
                          >
                            {rev.recommendSeller !== false ? '👍 Recomenda' : '👎 Não recomenda'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold">
                            {'★'.repeat(rev.rating)}
                            {'☆'.repeat(Math.max(0, 5 - rev.rating))}
                          </span>
                          {(isAdmin || (user && user.uid === rev.buyerId)) && (
                            <button
                              type="button"
                              onClick={() => deleteMarketplaceSellerReview(rev.id)}
                              className="text-slate-500 hover:text-red-400"
                              title="Remover avaliação"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {rev.listingTitle && (
                        <div className="text-[11px] text-purple-300 font-semibold">
                          Item negociado: {rev.listingTitle}
                        </div>
                      )}

                      <p className="text-slate-300 leading-relaxed">{rev.comment}</p>

                      <div className="text-[10px] text-slate-500">
                        {new Date(rev.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
