import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Truck,
  Package,
  Box,
  ShieldCheck,
  Copy,
  Heart
} from 'lucide-react';
import {
  CardCondition,
  CardData,
  ExclusiveProduct,
  MarketplaceCardEntry,
  MarketplaceListing,
  MarketplaceListingType,
  MarketplaceSellerReview,
  StoreProductCategory
} from '../types';
import {
  convertMarketplaceListingToOfficialProduct,
  createMarketplaceListing,
  createMarketplaceSellerReview,
  deleteMarketplaceListing,
  deleteMarketplaceSellerReview,
  formatBRL,
  formatCep,
  formatPhone,
  parseBRLPrice,
  saveOfficialProductToStore,
  subscribeMarketplaceSellerReviews,
  updateMarketplaceListing
} from '../storeService';
import { encodeDeckCode, parseDeckFromCode } from '../deckUtils';
import { useUserWishlist } from '../wishlistService';

interface CommunityMarketplaceViewProps {
  listings: MarketplaceListing[];
  allCards: CardData[];
  user: any;
  isAdmin?: boolean;
  initialSubTab?: 'explore' | 'sell' | 'my_listings' | 'sellers_reputation';
  openSellTrigger?: number;
  onOfficialProductCreated?: () => void;
  onOpenAuth?: () => void;
}

const CARD_CONDITIONS: CardCondition[] = [
  'Mint',
  'Near Mint (NM)',
  'Slightly Played (SP)',
  'Moderately Played (MP)',
  'Heavily Played (HP)'
];

type CreationMode = 'deck_code' | 'booster_collection' | 'single_card' | 'manual_collection';

export const CommunityMarketplaceView: React.FC<CommunityMarketplaceViewProps> = ({
  listings,
  allCards,
  user,
  isAdmin,
  initialSubTab = 'explore',
  openSellTrigger,
  onOfficialProductCreated,
  onOpenAuth
}) => {
  const isOfficialAccount = Boolean(
    isAdmin || user?.email?.toLowerCase() === 'viniciuspdiasuzumaki@gmail.com'
  );

  const [subTab, setSubTab] = useState<'explore' | 'sell' | 'my_listings' | 'sellers_reputation'>(
    initialSubTab
  );

  useEffect(() => {
    if (openSellTrigger && openSellTrigger > 0) {
      setSubTab('sell');
    }
  }, [openSellTrigger]);

  // Seller Reviews from Firestore
  const [reviews, setReviews] = useState<MarketplaceSellerReview[]>([]);

  useEffect(() => {
    const unsub = subscribeMarketplaceSellerReviews((list) => {
      setReviews(list);
    });
    return () => unsub();
  }, []);

  // Auto-convert any resale listing accidentally created by the official admin account into an Official Product
  const autoConvertedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isOfficialAccount || !listings || listings.length === 0) return;
    const officialResaleListings = listings.filter(
      (item) =>
        item.sellerEmail?.toLowerCase() === 'viniciuspdiasuzumaki@gmail.com' &&
        !autoConvertedIdsRef.current.has(item.id)
    );
    if (officialResaleListings.length === 0) return;

    officialResaleListings.forEach((item) => {
      autoConvertedIdsRef.current.add(item.id);
      convertMarketplaceListingToOfficialProduct(item).catch((err) => {
        console.warn('Falha ao converter produto oficial automaticamente:', err);
      });
    });
  }, [isOfficialAccount, listings]);

  // Filter states for Explore
  const [typeFilter, setTypeFilter] = useState<'all' | MarketplaceListingType>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');
  const [onlyFoil, setOnlyFoil] = useState(false);
  const [onlyWanted, setOnlyWanted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'price-asc' | 'price-desc' | 'rating-desc'>('recent');
  const [inspectListing, setInspectListing] = useState<MarketplaceListing | null>(null);
  const [copiedDeckCode, setCopiedDeckCode] = useState(false);

  const { wishlist } = useUserWishlist(user?.uid, user);
  const wantedCardLookup = useMemo(() => {
    const codes = new Set<string>();
    const names = new Set<string>();
    Object.values(wishlist || {}).forEach((w: any) => {
      if (w?.cardCode) codes.add(String(w.cardCode).trim().toUpperCase());
      if (w?.cardName) names.add(String(w.cardName).trim().toLowerCase());
    });
    return { codes, names, hasAny: codes.size > 0 || names.size > 0 };
  }, [wishlist]);

  const doesListingMatchWishlist = (item: MarketplaceListing): boolean => {
    if (!wantedCardLookup.hasAny) return false;
    if (item.cardId && wantedCardLookup.codes.has(item.cardId.trim().toUpperCase())) return true;
    if (item.cardName && wantedCardLookup.names.has(item.cardName.trim().toLowerCase())) return true;
    if (item.includedCards && item.includedCards.length > 0) {
      return item.includedCards.some(
        ic =>
          (ic.cardId && wantedCardLookup.codes.has(ic.cardId.trim().toUpperCase())) ||
          (ic.cardName && wantedCardLookup.names.has(ic.cardName.trim().toLowerCase()))
      );
    }
    return false;
  };

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
  const [creationMode, setCreationMode] = useState<CreationMode>('deck_code');
  const [listingType, setListingType] = useState<MarketplaceListingType>('collection');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceInput, setPriceInput] = useState('49,90');
  const [originalPriceInput, setOriginalPriceInput] = useState('');
  const [stockQuantity, setStockQuantity] = useState(10);
  const [condition, setCondition] = useState<CardCondition>('Near Mint (NM)');
  const [isFoil, setIsFoil] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [selectedCardCode, setSelectedCardCode] = useState('');
  const [cardSearchTerm, setCardSearchTerm] = useState('');
  const [includedCards, setIncludedCards] = useState<MarketplaceCardEntry[]>([]);

  // Bulk Deck Code & Entire Booster Collection States
  const [deckCodeInput, setDeckCodeInput] = useState('');
  const [selectedBoosterCollection, setSelectedBoosterCollection] = useState('');
  const [boosterFrameFilter, setBoosterFrameFilter] = useState<'all' | 'Moderno' | 'Legado'>('all');
  const [boosterCopiesPerCard, setBoosterCopiesPerCard] = useState<number>(1);

  // Official Account Specific States
  const [officialStoreCategory, setOfficialStoreCategory] = useState<StoreProductCategory>('decks');
  const [officialBadge, setOfficialBadge] = useState('OFICIAL LIGHT DARK');
  const [officialIsPreOrder, setOfficialIsPreOrder] = useState(false);
  const [officialPreOrderDate, setOfficialPreOrderDate] = useState('');

  // Seller Direct Contact & Shipping Notes (for regular players)
  const [sellerWhatsapp, setSellerWhatsapp] = useState('');
  const [sellerExternalLink, setSellerExternalLink] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState(
    'Envio via Correios (Carta Registrada / PAC / SEDEX) por conta do comprador'
  );
  const [sellerCep, setSellerCep] = useState('');
  const [sellerCity, setSellerCity] = useState('');
  const [sellerState, setSellerState] = useState('');

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const parsedPrice = useMemo(() => parseBRLPrice(priceInput), [priceInput]);

  // Official catalog cards for picker
  const catalogCards = useMemo(() => {
    return (allCards || []).filter((c) => c && !c.deleted && !c.isHidden);
  }, [allCards]);

  // Available Booster Collections derived from catalogCards
  const availableBoosterCollections = useMemo(() => {
    const map = new Map<string, CardData[]>();
    for (const card of catalogCards) {
      const colName = (card.collection || '').trim();
      if (!colName) continue;
      const list = map.get(colName) || [];
      list.push(card);
      map.set(colName, list);
    }
    return Array.from(map.entries())
      .map(([name, cards]) => ({
        name,
        cards,
        count: cards.length
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [catalogCards]);

  // Live Deck Preview from deckCodeInput
  const parsedDeckPreview = useMemo(() => {
    return parseDeckFromCode(deckCodeInput, catalogCards);
  }, [deckCodeInput, catalogCards]);

  // Sync creationMode with listingType and officialStoreCategory
  const handleSelectCreationMode = (mode: CreationMode) => {
    setCreationMode(mode);
    if (mode === 'single_card') {
      setListingType('single_card');
      setOfficialStoreCategory('cartas_avulsas');
      setOfficialBadge('CARTA AVULSA OFICIAL');
    } else if (mode === 'deck_code') {
      setListingType('collection');
      setOfficialStoreCategory('decks');
      setOfficialBadge('DECK PERSONALIZADO');
    } else if (mode === 'booster_collection') {
      setListingType('collection');
      setOfficialStoreCategory('kits');
      setOfficialBadge('COLEÇÃO BOOSTER COMPLETA');
    } else {
      setListingType('collection');
      setOfficialStoreCategory('kits');
      setOfficialBadge('LOTE / COLEÇÃO OFICIAL');
    }
  };

  // Apply parsed deck code into includedCards + cover image
  const handleApplyDeckCode = (rawCode: string) => {
    setDeckCodeInput(rawCode);
    const preview = parseDeckFromCode(rawCode, catalogCards);
    if (!preview.isValid) return;

    const mergedMap = new Map<string, MarketplaceCardEntry>();
    const allEntries = [...preview.mainDeck, ...preview.sideDeck];

    let heroOrFirstImage = '';
    let heroName = '';

    for (const entry of allEntries) {
      const card = entry.card;
      const code = card?.code || entry.code;
      const name = card?.name || entry.code;
      const cover = card?.catalogCoverImageUrl || card?.imageUrl || '';

      if (card && !heroOrFirstImage && cover) {
        heroOrFirstImage = cover;
      }
      if (
        card &&
        (card.type?.toLowerCase().includes('herói') || card.type?.toLowerCase().includes('heroi'))
      ) {
        if (cover) heroOrFirstImage = cover;
        if (!heroName) heroName = card.name;
      }

      const existing = mergedMap.get(code);
      if (existing) {
        existing.quantity += entry.qty;
      } else {
        mergedMap.set(code, {
          cardId: code,
          cardName: name,
          cardType: card?.type,
          cardImageUrl: cover,
          quantity: entry.qty,
          condition
        });
      }
    }

    const entriesArray = Array.from(mergedMap.values());
    setIncludedCards(entriesArray);
    setListingType('collection');

    if (heroOrFirstImage && !imageUrl) {
      setImageUrl(heroOrFirstImage);
    }
    if (!title.trim()) {
      setTitle(
        heroName
          ? `Deck Personalizado: ${heroName} (${preview.totalCount} Cartas)`
          : `Deck Personalizado (${preview.totalCount} Cartas)`
      );
    }
    if (!description.trim()) {
      setDescription(
        `Deck completo pronto para jogar com ${preview.totalCount} cartas (${preview.totalMainCount} no Deck Principal${
          preview.totalSideCount > 0 ? ` + ${preview.totalSideCount} no Side Deck` : ''
        }).`
      );
    }
  };

  // Load an entire Booster Collection in 1 click without adding card by card
  const handleApplyBoosterCollection = (
    colName: string,
    frameFilter: 'all' | 'Moderno' | 'Legado' = boosterFrameFilter,
    copies: number = boosterCopiesPerCard
  ) => {
    setSelectedBoosterCollection(colName);
    if (!colName) return;

    const foundCol = availableBoosterCollections.find((c) => c.name === colName);
    if (!foundCol) return;

    // Filter by frame if requested, and deduplicate by card code if 'all' is selected so we don't duplicate Moderno + Legado unless desired
    let cardsToInclude = foundCol.cards.filter((c) => {
      if (frameFilter === 'Moderno') {
        return c.frame === 'Moderno' || (c.id && c.id.includes('-MOD'));
      }
      if (frameFilter === 'Legado') {
        return c.frame !== 'Moderno' && !(c.id && c.id.includes('-MOD'));
      }
      return true;
    });

    // Deduplicate by card.code when 'all' is chosen so each unique card of the booster appears once (multiplied by copies)
    const uniqueByCode = new Map<string, CardData>();
    for (const c of cardsToInclude) {
      const key = c.code || c.id;
      if (!uniqueByCode.has(key)) {
        uniqueByCode.set(key, c);
      }
    }
    cardsToInclude = Array.from(uniqueByCode.values());

    if (cardsToInclude.length === 0) {
      setFormError('Nenhuma carta encontrada nesta coleção com o filtro selecionado.');
      return;
    }

    const safeCopies = Math.max(1, Math.min(4, Number(copies) || 1));
    const entries: MarketplaceCardEntry[] = cardsToInclude.map((card) => ({
      cardId: card.code,
      cardName: card.name,
      cardType: card.type,
      cardImageUrl: card.catalogCoverImageUrl || card.imageUrl || '',
      quantity: safeCopies,
      condition
    }));

    // Also build encoded deck code so Official Products and ProductDetailModal display all cards seamlessly
    const expandedDeckCards: CardData[] = [];
    for (const card of cardsToInclude) {
      for (let i = 0; i < safeCopies; i++) {
        expandedDeckCards.push(card);
      }
    }
    const generatedCode = encodeDeckCode(expandedDeckCards, []);
    setDeckCodeInput(generatedCode);
    setIncludedCards(entries);
    setListingType('collection');

    const totalCards = entries.reduce((acc, item) => acc + item.quantity, 0);
    const firstCover =
      cardsToInclude.find((c) => c.catalogCoverImageUrl || c.imageUrl)?.catalogCoverImageUrl ||
      cardsToInclude.find((c) => c.imageUrl)?.imageUrl ||
      '';

    if (firstCover && !imageUrl) {
      setImageUrl(firstCover);
    }

    setTitle(
      safeCopies > 1
        ? `Coleção Completa Booster: ${colName} (${safeCopies}x de cada · ${totalCards} Cartas)`
        : `Coleção Completa Booster: ${colName} (${totalCards} Cartas)`
    );
    setDescription(
      `Coleção completa oficial do booster "${colName}" contendo todas as ${cardsToInclude.length} cartas da expansão (${totalCards} cartas no total).`
    );
    setFormError('');
  };

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
      if (onlyWanted && !doesListingMatchWishlist(item)) return false;
      if (q) {
        const hay = `${item.title} ${item.description} ${item.cardName || ''} ${
          item.collectionName || ''
        } ${item.sellerName || ''} ${item.sellerCity || ''} ${(item.includedCards || [])
          .map((c) => c.cardName)
          .join(' ')}`.toLowerCase();
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
  }, [listings, typeFilter, conditionFilter, onlyFoil, onlyWanted, searchQuery, sortBy, sellerStatsMap, wantedCardLookup]);

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
        listingTitle:
          newReviewListingTitle.trim() ||
          reviewModalSeller.defaultListingTitle ||
          'Negociação no Mercado',
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
    setCreationMode('deck_code');
    setListingType('collection');
    setTitle('');
    setDescription('');
    setPriceInput('49,90');
    setOriginalPriceInput('');
    setStockQuantity(isOfficialAccount ? 25 : 1);
    setCondition('Near Mint (NM)');
    setIsFoil(false);
    setImageUrl('');
    setSelectedCardCode('');
    setIncludedCards([]);
    setDeckCodeInput('');
    setSelectedBoosterCollection('');
    setOfficialStoreCategory('decks');
    setOfficialBadge('OFICIAL LIGHT DARK');
    setOfficialIsPreOrder(false);
    setOfficialPreOrderDate('');
    setFormError('');
  };

  const handleStartEdit = (item: MarketplaceListing) => {
    setEditingListingId(item.id);
    setListingType(item.listingType);
    if (item.listingType === 'single_card') {
      setCreationMode('single_card');
    } else if (item.collectionName) {
      setCreationMode('booster_collection');
      setSelectedBoosterCollection(item.collectionName);
    } else if (item.deckCode) {
      setCreationMode('deck_code');
      setDeckCodeInput(item.deckCode);
    } else {
      setCreationMode('manual_collection');
    }
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

  const buildCardCodesStringFromState = (): string => {
    if (deckCodeInput.trim()) {
      return deckCodeInput.trim();
    }
    if (creationMode === 'single_card' && selectedCardCode) {
      return selectedCardCode;
    }
    if (includedCards.length > 0) {
      const matchedCards: CardData[] = [];
      const fallbackCodes: string[] = [];
      for (const entry of includedCards) {
        const found = catalogCards.find((c) => c.code === entry.cardId);
        const qty = Math.max(1, Number(entry.quantity) || 1);
        for (let i = 0; i < qty; i++) {
          if (found) matchedCards.push(found);
          fallbackCodes.push(entry.cardId);
        }
      }
      if (matchedCards.length > 0) {
        return encodeDeckCode(matchedCards, []);
      }
      return fallbackCodes.join(', ');
    }
    return '';
  };

  const handleSubmitListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!user) {
      setFormError('Faça login na sua conta para publicar no Mercado.');
      return;
    }

    if (!title.trim()) {
      setFormError('Informe um título para o produto/anúncio.');
      return;
    }

    if (parsedPrice <= 0) {
      setFormError('Informe um valor válido em R$.');
      return;
    }

    const finalCardCodes = buildCardCodesStringFromState();
    const matchedCatalogCard = catalogCards.find((c) => c.code === selectedCardCode);
    const previewFromDeckCode = parseDeckFromCode(finalCardCodes, catalogCards);
    const firstDeckCardImage =
      previewFromDeckCode.mainDeck[0]?.card?.catalogCoverImageUrl ||
      previewFromDeckCode.mainDeck[0]?.card?.imageUrl ||
      '';

    const finalImage =
      imageUrl.trim() ||
      matchedCatalogCard?.catalogCoverImageUrl ||
      matchedCatalogCard?.imageUrl ||
      includedCards[0]?.cardImageUrl ||
      firstDeckCardImage ||
      'https://i.imgur.com/cDLxOtO.png';

    // =========================================================================
    // REGRA OFICIAL: SE CONTA OFICIAL ESTÁ LOGADA -> SALVA COMO PRODUTO OFICIAL!
    // =========================================================================
    if (isOfficialAccount && !editingListingId) {
      setIsSaving(true);
      try {
        const parsedOrig = parseBRLPrice(originalPriceInput);
        const categoryLabel =
          officialStoreCategory === 'decks'
            ? 'Deck Oficial'
            : officialStoreCategory === 'kits'
            ? selectedBoosterCollection
              ? `Coleção Booster · ${selectedBoosterCollection}`
              : 'Coleção / Booster Oficial'
            : officialStoreCategory === 'cartas_avulsas'
            ? 'Carta Avulsa Oficial'
            : officialStoreCategory === 'playmats'
            ? 'Playmat Oficial'
            : officialStoreCategory === 'pre_venda'
            ? 'Pré-Venda Oficial'
            : 'Promoção Oficial';

        const newOfficialProduct: ExclusiveProduct = {
          isActive: true,
          title: title.trim(),
          category: categoryLabel,
          storeCategory: officialStoreCategory,
          description:
            description.trim() ||
            (creationMode === 'deck_code'
              ? 'Deck oficial pronto para jogar com cartas oficiais Light Dark TCG.'
              : creationMode === 'booster_collection'
              ? `Coleção completa oficial do booster ${selectedBoosterCollection || 'Light Dark TCG'}.`
              : 'Produto físico oficial Light Dark TCG.'),
          price: formatBRL(parsedPrice),
          originalPrice: parsedOrig > parsedPrice ? formatBRL(parsedOrig) : '',
          mediaType: 'image',
          mediaUrl: finalImage,
          mediaList: [{ url: finalImage, type: 'image' }],
          buttonText: officialIsPreOrder ? 'Garantir Pré-Venda' : 'Comprar Agora',
          buttonLink: '', // Carrinho Interno + Mercado Pago Oficial
          badge:
            officialBadge.trim() ||
            (isFoil ? 'FOIL OFICIAL' : 'OFICIAL LIGHT DARK'),
          cardCodes: finalCardCodes,
          isPreOrder: officialIsPreOrder || officialStoreCategory === 'pre_venda',
          preOrderReleaseDate: officialPreOrderDate.trim() || '',
          isPromotion: parsedOrig > parsedPrice || officialStoreCategory === 'promocoes',
          stockCount: Math.max(1, Number(stockQuantity) || 25),
          weightGrams: creationMode === 'single_card' ? 50 : 250
        };

        await saveOfficialProductToStore(newOfficialProduct);
        setFormSuccess(
          '✓ Produto Oficial publicado com sucesso no catálogo de Produtos Oficiais (com Carrinho + Mercado Pago)!'
        );
        resetForm();
        setTimeout(() => {
          setFormSuccess('');
          if (onOfficialProductCreated) {
            onOfficialProductCreated();
          } else {
            setSubTab('explore');
          }
        }, 900);
      } catch (err: any) {
        setFormError(err.message || 'Erro ao publicar produto oficial.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Caso seja um jogador comum (ou edição de anúncio comunitário existente)
    if (!sellerWhatsapp.trim() && !sellerExternalLink.trim()) {
      setFormError(
        'Informe seu WhatsApp ou um Link Externo para que os compradores possam negociar diretamente com você.'
      );
      return;
    }

    const totalCardsInCollection =
      includedCards.reduce((acc, c) => acc + c.quantity, 0) ||
      previewFromDeckCode.totalCount ||
      1;

    setIsSaving(true);
    try {
      const id = editingListingId || `MKT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const listingPayload: MarketplaceListing = {
        id,
        listingType: creationMode === 'single_card' ? 'single_card' : 'collection',
        title: title.trim(),
        description:
          description.trim() ||
          (creationMode === 'single_card'
            ? 'Carta avulsa anunciada por jogador da comunidade.'
            : 'Deck / Coleção anunciada por jogador da comunidade.'),
        price: parsedPrice,
        formattedPrice: formatBRL(parsedPrice),
        stockQuantity: Math.max(1, Number(stockQuantity) || 1),
        condition,
        isFoil: creationMode === 'single_card' ? isFoil : false,
        imageUrl: finalImage,
        cardId: creationMode === 'single_card' ? selectedCardCode || undefined : undefined,
        cardName:
          creationMode === 'single_card'
            ? matchedCatalogCard?.name || title.trim()
            : undefined,
        cardRarity: matchedCatalogCard?.rarity || undefined,
        includedCards:
          creationMode !== 'single_card' && includedCards.length > 0 ? includedCards : undefined,
        totalCardsCount:
          creationMode !== 'single_card' ? Math.max(1, totalCardsInCollection) : 1,
        deckCode: finalCardCodes || undefined,
        collectionName: selectedBoosterCollection || undefined,
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
          {isOfficialAccount ? (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[11px] font-black uppercase tracking-wider">
              <ShieldCheck size={14} />
              <span>Conta Oficial Logada · Seus cadastros vão para Produtos Oficiais</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles size={13} />
              <span>Comércio Livre entre Jogadores · 0% de Taxa</span>
            </div>
          )}
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
            Mercado da Galera: Cartas Avulsas, Decks Personalizados e Coleções
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {isOfficialAccount ? (
              <>
                Você está logado com sua <strong className="text-amber-300">Conta Oficial</strong>. Qualquer produto, Deck por Código ou Coleção de Booster que você adicionar aqui será publicado automaticamente em{' '}
                <strong className="text-white">Produtos Oficiais</strong> (e nunca como revenda).
              </>
            ) : (
              <>
                Negociação e entrega feitas <strong className="text-white">diretamente entre comprador e vendedor</strong>, sem taxas ou intermediação do site. Você pode anunciar uma carta avulsa, colar um <strong className="text-purple-300">Código de Deck</strong> ou carregar uma <strong className="text-emerald-300">Coleção Inteira de Booster</strong>!
              </>
            )}
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
                ? isOfficialAccount
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-950/50'
                  : 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                : isOfficialAccount
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50'
                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            <Plus size={15} />
            <span>
              {isOfficialAccount
                ? 'Adicionar Produto Oficial (Deck / Booster / Carta)'
                : 'Anunciar Carta / Deck / Coleção'}
            </span>
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
            <span>
              {isOfficialAccount
                ? `Gerenciar Anúncios (${myListings.length})`
                : `Meus Anúncios (${myListings.length})`}
            </span>
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
            <Star
              size={14}
              className={subTab === 'sellers_reputation' ? 'fill-slate-950' : 'fill-amber-400'}
            />
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
                  { id: 'collection', label: 'Decks, Boosters & Coleções', icon: <Layers size={14} /> }
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

              <label className="flex items-center justify-between gap-2 text-xs text-pink-300 font-semibold cursor-pointer pt-1 border-t border-slate-800/80">
                <span className="flex items-center gap-1.5">
                  <Heart size={12} className="fill-pink-400 text-pink-400" />
                  <span>Na Minha Lista de Desejos</span>
                </span>
                <input
                  type="checkbox"
                  checked={onlyWanted}
                  onChange={(e) => setOnlyWanted(e.target.checked)}
                  className="accent-pink-500 w-4 h-4 rounded"
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
                {isOfficialAccount ? '+ Novo Produto Oficial' : '+ Anunciar Grátis'}
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
                  placeholder="Buscar carta avulsa, deck, coleção, vendedor, cidade..."
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
                                : item.collectionName
                                ? `Coleção Booster (${item.totalCardsCount || 1} cartas)`
                                : item.deckCode
                                ? `Deck (${item.totalCardsCount || 1} cartas)`
                                : `Coleção (${item.totalCardsCount || item.includedCards?.length || 1} cartas)`}
                            </span>

                            {item.isFoil && (
                              <span className="text-[10px] font-black uppercase bg-gradient-to-r from-amber-400 to-purple-400 text-slate-950 px-2 py-0.5 rounded-md">
                                ✨ FOIL
                              </span>
                            )}
                            {doesListingMatchWishlist(item) && (
                              <span className="text-[10px] font-black uppercase bg-pink-600 text-white border border-pink-300 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md">
                                <Heart size={10} className="fill-white" />
                                <span>Na sua Lista de Desejos</span>
                              </span>
                            )}
                          </div>

                          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-emerald-300 font-semibold">
                              {item.condition}
                            </span>
                            <span className="bg-black/80 px-2 py-0.5 rounded text-slate-200 flex items-center gap-1 border border-white/10">
                              <Eye size={11} />
                              <span>Ver Cartas / Detalhes</span>
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
                    Nenhum anúncio de revenda encontrado
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {isOfficialAccount
                      ? 'Como você está na sua Conta Oficial, todos os seus produtos ficam na aba "Produtos Oficiais".'
                      : 'Seja o primeiro a anunciar gratuitamente uma carta avulsa, deck por código ou coleção completa no Mercado da Comunidade!'}
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
                  {isOfficialAccount
                    ? '+ Adicionar Produto Oficial (Deck / Booster / Carta)'
                    : '+ Criar Primeiro Anúncio Grátis'}
                </button>
              </div>
            )}
          </main>
        </div>
      )}

      {/* ================= TAB 2: SELL FORM (OFFICIAL PRODUCT FOR ADMIN / FREE P2P FOR PLAYERS) ================= */}
      {subTab === 'sell' && (
        <div className="bg-[#0e0e14] border border-slate-800/90 rounded-2xl p-5 sm:p-7 max-w-5xl mx-auto">
          {!user ? (
            <div className="text-center py-12 space-y-4">
              <UserIcon size={44} className="mx-auto text-purple-400" />
              <h3 className="text-lg font-bold text-white">
                Faça login para anunciar cartas, decks e coleções
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Conecte-se à sua conta Light Dark para publicar seus anúncios gratuitamente usando Código de Deck ou Coleção de Booster.
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
              {/* Official Account Notice Banner */}
              {isOfficialAccount && !editingListingId && (
                <div className="bg-gradient-to-r from-amber-950/80 via-purple-950/70 to-slate-950 border border-amber-500/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wider">
                      <ShieldCheck size={16} />
                      <span>Modo Conta Oficial Ativo · Produto Oficial (Não é Revenda)</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      Enquanto sua conta oficial estiver logada, tudo o que você adicionar aqui vai direto para <strong className="text-amber-300">Produtos Oficiais</strong> com Checkout Oficial (Carrinho + Mercado Pago).
                    </p>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shrink-0 self-start sm:self-center">
                    PRODUTO OFICIAL
                  </span>
                </div>
              )}

              {/* Form Header & 4 Creation Mode Tabs */}
              <div className="space-y-4 border-b border-slate-800 pb-5">
                <div>
                  <h3 className="text-lg font-black text-white">
                    {editingListingId
                      ? 'Editar Anúncio no Mercado'
                      : isOfficialAccount
                      ? 'Cadastrar Novo Produto Oficial (Deck por Código, Coleção Booster ou Carta)'
                      : 'Anunciar no Mercado (Deck por Código, Coleção de Booster ou Carta)'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Escolha abaixo como deseja montar o produto sem precisar adicionar carta por carta:
                  </p>
                </div>

                {/* 4 Mode Buttons: Deck Code | Entire Booster Collection | Single Card | Manual Bundle */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSelectCreationMode('deck_code')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                      creationMode === 'deck_code'
                        ? 'bg-purple-600/25 border-purple-500 text-white shadow-lg shadow-purple-950/40'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-black text-xs text-purple-300">
                      <Layers size={15} />
                      <span>1. Código de Deck</span>
                    </div>
                    <span className="text-[11px] text-slate-400 leading-snug">
                      Cole o código do Criador de Deck para vender como Deck Personalizado
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectCreationMode('booster_collection')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                      creationMode === 'booster_collection'
                        ? 'bg-emerald-600/25 border-emerald-500 text-white shadow-lg shadow-emerald-950/40'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-black text-xs text-emerald-300">
                      <Box size={15} />
                      <span>2. Coleção de Booster</span>
                    </div>
                    <span className="text-[11px] text-slate-400 leading-snug">
                      Selecione uma coleção inteira de booster de uma só vez (sem ir carta a carta)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectCreationMode('single_card')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                      creationMode === 'single_card'
                        ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-950/40'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-black text-xs text-amber-300">
                      <Tag size={15} />
                      <span>3. Carta Avulsa</span>
                    </div>
                    <span className="text-[11px] text-slate-400 leading-snug">
                      Vender uma única carta específica (Single / Foil / Promo)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectCreationMode('manual_collection')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                      creationMode === 'manual_collection'
                        ? 'bg-cyan-600/20 border-cyan-500 text-white shadow-lg shadow-cyan-950/40'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-black text-xs text-cyan-300">
                      <Package size={15} />
                      <span>4. Lote Manual / Outro</span>
                    </div>
                    <span className="text-[11px] text-slate-400 leading-snug">
                      Escolher cartas manualmente ou cadastrar Playmat / Acessório
                    </span>
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
                {/* Left Column: Bulk Deck / Booster / Card Selector & Details (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* MODE 1: DECK CODE IMPORTER */}
                  {creationMode === 'deck_code' && (
                    <div className="bg-slate-950 border border-purple-500/40 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                          <Layers size={15} />
                          <span>Código do Deck Personalizado (Criador de Deck)</span>
                        </label>
                        {parsedDeckPreview.isValid && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                            ✓ {parsedDeckPreview.totalCount} cartas identificadas
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed">
                        Cole abaixo o <strong className="text-white">código gerado no Criador de Deck</strong> (ex: <code className="text-purple-300">LDT:...</code>). Todas as cartas do Deck Principal e Side Deck serão carregadas automaticamente na venda!
                      </p>

                      <textarea
                        rows={3}
                        value={deckCodeInput}
                        onChange={(e) => handleApplyDeckCode(e.target.value)}
                        placeholder="Cole aqui o código do deck (ex: LDT:1,2,3,4... ou código Base64 do Criador de Deck)"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-xs font-mono text-white outline-none resize-y"
                      />

                      {deckCodeInput.trim() && (
                        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                          {parsedDeckPreview.isValid ? (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                  <Check size={14} />
                                  Deck carregado automaticamente ({parsedDeckPreview.totalCount} cartas)
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {parsedDeckPreview.totalMainCount} Principal
                                  {parsedDeckPreview.totalSideCount > 0
                                    ? ` + ${parsedDeckPreview.totalSideCount} Side`
                                    : ''}
                                </span>
                              </div>
                              <div className="max-h-36 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1 pr-1">
                                {[...parsedDeckPreview.mainDeck, ...parsedDeckPreview.sideDeck].map(
                                  (entry, idx) => (
                                    <div
                                      key={`${entry.code}-${idx}`}
                                      className="flex items-center gap-1.5 bg-slate-950 border border-slate-800/80 rounded-lg px-2 py-1 text-[11px]"
                                    >
                                      {entry.card &&
                                        (entry.card.catalogCoverImageUrl || entry.card.imageUrl) && (
                                          <img
                                            src={
                                              entry.card.catalogCoverImageUrl || entry.card.imageUrl
                                            }
                                            alt={entry.card.name}
                                            referrerPolicy="no-referrer"
                                            className="w-6 h-8 object-cover rounded shrink-0 bg-black"
                                          />
                                        )}
                                      <span className="truncate text-slate-200 font-semibold">
                                        <strong className="text-emerald-400">{entry.qty}x</strong>{' '}
                                        {entry.card?.name || entry.code}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-amber-400">
                              Nenhuma carta encontrada para este código. Verifique se copiou o código completo no Criador de Deck.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* MODE 2: ENTIRE BOOSTER COLLECTION SELECTOR */}
                  {creationMode === 'booster_collection' && (
                    <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-4 space-y-3.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                          <Box size={15} />
                          <span>Selecionar Coleção Inteira de Booster (1 Clique)</span>
                        </label>
                        {includedCards.length > 0 && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                            ✓ {includedCards.reduce((a, b) => a + b.quantity, 0)} cartas na coleção
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed">
                        Escolha qualquer <strong className="text-white">Coleção / Expansão de Booster</strong> abaixo para incluir todas as cartas dela automaticamente, sem precisar adicionar carta por carta:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-bold text-slate-300 block mb-1">
                            Coleção / Booster *
                          </label>
                          <select
                            value={selectedBoosterCollection}
                            onChange={(e) =>
                              handleApplyBoosterCollection(
                                e.target.value,
                                boosterFrameFilter,
                                boosterCopiesPerCard
                              )
                            }
                            className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-xs text-white font-bold outline-none"
                          >
                            <option value="">-- Escolha uma Coleção de Booster --</option>
                            {availableBoosterCollections.map((col) => (
                              <option key={col.name} value={col.name}>
                                {col.name} ({col.count} cartas registradas)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-300 block mb-1">
                            Cópias por Carta
                          </label>
                          <select
                            value={boosterCopiesPerCard}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 1;
                              setBoosterCopiesPerCard(val);
                              if (selectedBoosterCollection) {
                                handleApplyBoosterCollection(
                                  selectedBoosterCollection,
                                  boosterFrameFilter,
                                  val
                                );
                              }
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-bold outline-none"
                          >
                            <option value={1}>1x de cada carta</option>
                            <option value={2}>2x de cada carta</option>
                            <option value={3}>3x de cada (Playset)</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">Versão das Cartas:</span>
                          {(['all', 'Moderno', 'Legado'] as const).map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => {
                                setBoosterFrameFilter(f);
                                if (selectedBoosterCollection) {
                                  handleApplyBoosterCollection(
                                    selectedBoosterCollection,
                                    f,
                                    boosterCopiesPerCard
                                  );
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                                boosterFrameFilter === f
                                  ? 'bg-emerald-600 text-white border-emerald-500'
                                  : 'bg-slate-900 text-slate-400 border-slate-800'
                              }`}
                            >
                              {f === 'all' ? 'Todas Únicas' : `Frame ${f}`}
                            </button>
                          ))}
                        </div>

                        {selectedBoosterCollection && (
                          <button
                            type="button"
                            onClick={() =>
                              handleApplyBoosterCollection(
                                selectedBoosterCollection,
                                boosterFrameFilter,
                                boosterCopiesPerCard
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer"
                          >
                            Recarregar Coleção Completa
                          </button>
                        )}
                      </div>

                      {includedCards.length > 0 && (
                        <div className="pt-2 border-t border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-300">
                              Cartas carregadas da coleção ({includedCards.reduce((a, b) => a + b.quantity, 0)} cartas):
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setIncludedCards([]);
                                setDeckCodeInput('');
                              }}
                              className="text-[11px] text-red-400 hover:underline cursor-pointer"
                            >
                              Limpar lista
                            </button>
                          </div>
                          <div className="max-h-40 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5 pr-1">
                            {includedCards.map((c) => (
                              <div
                                key={c.cardId}
                                className="flex items-center justify-between bg-slate-900 px-2 py-1.5 rounded-lg text-[11px] gap-1"
                              >
                                <span className="truncate text-white font-semibold">
                                  <strong className="text-emerald-400">{c.quantity}x</strong> {c.cardName}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCollectionCardQty(c.cardId, -c.quantity)}
                                  className="text-slate-500 hover:text-red-400 shrink-0"
                                  title="Remover carta da coleção"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* MODE 3 & 4: SINGLE CARD OR MANUAL BUNDLE PICKER */}
                  {(creationMode === 'single_card' || creationMode === 'manual_collection') && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-purple-300">
                          {creationMode === 'single_card'
                            ? 'Selecionar Carta Avulsa do Catálogo Oficial'
                            : 'Selecionar Cartas para o Lote (Opcional)'}
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
                            creationMode === 'single_card'
                              ? selectedCardCode === card.code
                              : includedCards.some((c) => c.cardId === card.code);
                          return (
                            <button
                              key={card.code}
                              type="button"
                              onClick={() =>
                                creationMode === 'single_card'
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

                      {creationMode === 'manual_collection' && includedCards.length > 0 && (
                        <div className="pt-2 border-t border-slate-800 space-y-2">
                          <div className="text-xs font-bold text-amber-300">
                            Cartas incluídas ({includedCards.reduce((a, b) => a + b.quantity, 0)} cartas):
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
                  )}

                  {/* Product / Listing Title, Photo & Description */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        Título do Produto / Anúncio *
                      </label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={
                          creationMode === 'deck_code'
                            ? 'Ex: Deck Personalizado Fallen Gods (45 Cartas)'
                            : creationMode === 'booster_collection'
                            ? 'Ex: Coleção Completa Booster Claire de Lune'
                            : 'Ex: Mahina - Herdeiro do Caos (Foil Mint)'
                        }
                        className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {!isOfficialAccount && (
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
                      )}

                      <div>
                        <label className="text-xs font-bold text-slate-300 block mb-1">
                          Estoque Disponível *
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={stockQuantity}
                          onChange={(e) => setStockQuantity(Math.max(1, Number(e.target.value)))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none"
                        />
                      </div>

                      {creationMode === 'single_card' && (
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
                        URL da Imagem de Capa (preenchida automaticamente pelo Deck/Coleção ou cole a sua)
                      </label>
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://... (deixe em branco para usar a arte oficial do Deck/Carta)"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        Descrição Detalhada
                      </label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Detalhes sobre o deck personalizado, coleção completa de booster ou estado das cartas..."
                        className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-xs text-white outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Official Store Config (if Admin) OR Direct Contact (if Player) (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-4 space-y-3">
                    <label className="text-xs font-bold text-white block">
                      Preço de Venda (R$) *
                    </label>
                    <input
                      type="text"
                      required
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      placeholder="Ex: 89,90"
                      className="w-full bg-slate-900 border border-emerald-500/50 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-base font-black font-mono text-emerald-300 outline-none"
                    />
                    {isOfficialAccount && !editingListingId ? (
                      <div className="pt-1">
                        <label className="text-[11px] text-slate-400 block mb-1">
                          Preço Original Riscado Opcional (p/ Promoção)
                        </label>
                        <input
                          type="text"
                          value={originalPriceInput}
                          onChange={(e) => setOriginalPriceInput(e.target.value)}
                          placeholder="Ex: 119,90 (opcional)"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 outline-none"
                        />
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        <strong className="text-emerald-300">0% de taxa:</strong> Você recebe 100% do valor combinado diretamente com o comprador.
                      </p>
                    )}
                  </div>

                  {isOfficialAccount && !editingListingId ? (
                    <div className="bg-slate-950 border border-amber-500/40 rounded-2xl p-4 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <ShieldCheck size={15} />
                        <span>Configurações do Produto Oficial</span>
                      </h4>

                      <div>
                        <label className="text-[11px] text-slate-300 font-bold block mb-1">
                          Categoria na Vitrine Oficial *
                        </label>
                        <select
                          value={officialStoreCategory}
                          onChange={(e) =>
                            setOfficialStoreCategory(e.target.value as StoreProductCategory)
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold outline-none"
                        >
                          <option value="decks">Decks (Decks Personalizados & Estruturais)</option>
                          <option value="kits">Kits (Coleções de Booster & Boxes)</option>
                          <option value="cartas_avulsas">Cartas Avulsas Oficiais</option>
                          <option value="playmats">Playmats</option>
                          <option value="pre_venda">Pré-venda</option>
                          <option value="promocoes">Promoções</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-300 font-bold block mb-1">
                          Selo de Destaque (Badge)
                        </label>
                        <input
                          type="text"
                          value={officialBadge}
                          onChange={(e) => setOfficialBadge(e.target.value)}
                          placeholder="Ex: DECK PERSONALIZADO / COLEÇÃO COMPLETA"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                        />
                      </div>

                      <div className="pt-1 space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-purple-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={officialIsPreOrder}
                            onChange={(e) => setOfficialIsPreOrder(e.target.checked)}
                            className="accent-purple-500 w-4 h-4 rounded"
                          />
                          <span>Produto em Pré-Venda Oficial</span>
                        </label>

                        {officialIsPreOrder && (
                          <input
                            type="text"
                            value={officialPreOrderDate}
                            onChange={(e) => setOfficialPreOrderDate(e.target.value)}
                            placeholder="Previsão de envio (ex: Lançamento em Novembro)"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none"
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Direct Contact & Delivery Info for Community Players */
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
                  )}

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
                      className={`flex-1 py-3.5 px-5 rounded-xl disabled:opacity-50 font-black text-xs sm:text-sm transition shadow-lg cursor-pointer ${
                        isOfficialAccount && !editingListingId
                          ? 'bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white shadow-purple-950/60'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60'
                      }`}
                    >
                      {isSaving
                        ? 'Salvando...'
                        : editingListingId
                        ? 'Salvar Alterações no Anúncio'
                        : isOfficialAccount
                        ? '👑 Publicar como Produto Oficial'
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
                {isAdmin
                  ? 'Todos os Anúncios da Comunidade (Visão Admin)'
                  : 'Meus Anúncios Publicados'}
              </h3>
              <p className="text-xs text-slate-400">
                Gerencie preços, disponibilidade e status dos anúncios.
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
              {isOfficialAccount ? '+ Novo Produto Oficial' : '+ Novo Anúncio'}
            </button>
          </div>

          {myListings.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Layers size={36} className="mx-auto text-slate-600" />
              <p className="text-xs text-slate-400">
                Nenhum anúncio de revenda listado aqui.
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
                          Valor:{' '}
                          <strong className="text-emerald-400 font-mono">
                            {formatBRL(item.price)}
                          </strong>{' '}
                          · Condição: <strong className="text-white">{item.condition}</strong>
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

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {isOfficialAccount && (
                        <button
                          type="button"
                          onClick={async () => {
                            await convertMarketplaceListingToOfficialProduct(item);
                            if (onOfficialProductCreated) onOfficialProductCreated();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-xs font-bold text-amber-300 flex items-center gap-1 cursor-pointer"
                          title="Mover para Produtos Oficiais e remover da revenda"
                        >
                          <ShieldCheck size={13} />
                          <span>Mover p/ Produtos Oficiais</span>
                        </button>
                      )}

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
                    : inspectListing.collectionName
                    ? `Coleção Completa Booster · ${inspectListing.collectionName}`
                    : inspectListing.deckCode
                    ? 'Deck Personalizado de Jogador'
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

                  {inspectListing.deckCode && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(inspectListing.deckCode || '');
                        setCopiedDeckCode(true);
                        setTimeout(() => setCopiedDeckCode(false), 2000);
                      }}
                      className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-purple-500/40 text-purple-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedDeckCode ? <Check size={13} /> : <Copy size={13} />}
                      <span>
                        {copiedDeckCode
                          ? 'Código do Deck Copiado!'
                          : 'Copiar Código para o Criador de Deck'}
                      </span>
                    </button>
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

            {(() => {
              const displayCards: MarketplaceCardEntry[] =
                inspectListing.includedCards && inspectListing.includedCards.length > 0
                  ? inspectListing.includedCards
                  : inspectListing.deckCode
                  ? (() => {
                      const parsed = parseDeckFromCode(inspectListing.deckCode, catalogCards);
                      return [...parsed.mainDeck, ...parsed.sideDeck].map((e) => ({
                        cardId: e.card?.code || e.code,
                        cardName: e.card?.name || e.code,
                        cardImageUrl: e.card?.catalogCoverImageUrl || e.card?.imageUrl || '',
                        quantity: e.qty
                      }));
                    })()
                  : [];

              if (displayCards.length === 0) return null;

              const totalCount = displayCards.reduce((acc, c) => acc + c.quantity, 0);
              return (
                <div className="border-t border-slate-800 pt-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Cartas Incluídas ({totalCount} cartas):
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                    {displayCards.map((c, idx) => (
                      <div
                        key={`${c.cardId}-${idx}`}
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
              );
            })()}
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
                        {st.count}{' '}
                        {st.count === 1 ? 'avaliação de comprador' : 'avaliações de compradores'}
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
                    {isSubmittingReview
                      ? 'Publicando Avaliação...'
                      : 'Publicar Avaliação de Comprador'}
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
