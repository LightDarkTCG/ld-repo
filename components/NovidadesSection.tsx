import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Eye,
  Calendar,
  X,
  Plus,
  Trash2,
  Upload,
  Search,
  Check,
  Settings,
  ArrowUp,
  ArrowDown,
  Crown,
  Package
} from 'lucide-react';
import {
  ExclusiveProduct,
  CardData,
  ProductMediaItem,
  FeaturedRareCardsConfig,
  FeaturedRareCardItem
} from '../types';
import { parseDeckFromCode } from '../deckUtils';
import { uploadMarketplaceImage } from '../storeService';
import { ArcaneCyberTextureLayer, CyberArcaneCornerFrame, ThemeTextureSlot } from './ArcaneCyberTheme';

interface NovidadesSectionProps {
  products: ExclusiveProduct[];
  onOpenProductModal: (product: ExclusiveProduct, variationIndex?: number) => void;
  onOpenStoreCheckout?: (product: ExclusiveProduct, variationIndex?: number) => void;
  allCards: CardData[];
  textureSlot?: ThemeTextureSlot;
  showPlaceholderBadge?: boolean;
  onConfigureTexture?: (slotId: string) => void;
  rareCardsConfig?: FeaturedRareCardsConfig;
  isAdmin?: boolean;
  onSaveRareCardsConfig?: (config: FeaturedRareCardsConfig) => Promise<void>;
  onSaveProducts?: (nextProducts: ExclusiveProduct[]) => Promise<void>;
  onOpenCatalog?: () => void;
  externalOpenManagerSignal?: number;
}

type CarouselSlide =
  | { kind: 'product'; product: ExclusiveProduct; productIndex: number }
  | { kind: 'rare_showcase'; cards: FeaturedRareCardItem[]; focusStartIndex: number; occurrenceIndex: number };

const isCardConsideredRare = (rarity?: string, isRarePrint?: boolean): boolean => {
  if (isRarePrint) return true;
  if (!rarity) return false;
  const r = rarity.toLowerCase();
  if (r.includes('comum') && !r.includes('incomum')) return false;
  return (
    r.includes('rara') ||
    r.includes('rare') ||
    r.includes('ultra') ||
    r.includes('secreta') ||
    r.includes('secret') ||
    r.includes('mítica') ||
    r.includes('mitica') ||
    r.includes('lendária') ||
    r.includes('lendaria') ||
    r.includes('promo') ||
    r.includes('especial') ||
    r.includes('exclusiva') ||
    r.includes('limitada') ||
    r.includes('macroversal') ||
    r.includes('evento') ||
    r.includes('colecionador') ||
    r.includes('foil') ||
    r.includes('holo') ||
    r.includes('dourada') ||
    r.includes('gold') ||
    r.includes('épica') ||
    r.includes('epica')
  );
};

export const NovidadesSection: React.FC<NovidadesSectionProps> = ({
  products,
  onOpenProductModal,
  onOpenStoreCheckout,
  allCards,
  textureSlot,
  showPlaceholderBadge,
  onConfigureTexture,
  rareCardsConfig,
  isAdmin = false,
  onSaveRareCardsConfig,
  onSaveProducts,
  externalOpenManagerSignal
}) => {
  // Only products that are active, visible in store, AND have showInHomeCarousel !== false
  const activeCarouselProducts = useMemo(() => {
    return products.filter(
      p => p && p.isActive !== false && !p.isHiddenFromStore && p.showInHomeCarousel !== false
    );
  }, [products]);

  // Small fallback of 4 rare cards ONLY if admin hasn't saved a config yet
  const autoFallbackRareCards = useMemo<FeaturedRareCardItem[]>(() => {
    if (!allCards || allCards.length === 0) return [];
    const cardsWithImg = allCards.filter(c => c && c.imageUrl && c.imageUrl.trim() !== '');
    if (cardsWithImg.length === 0) return [];

    const rarePool = cardsWithImg.filter(c =>
      isCardConsideredRare(c.rarity, Boolean(c.isRarePrint || c.requiresAdminVerification))
    );
    const pool = rarePool.length > 0 ? rarePool : cardsWithImg;

    const collectionCounts = new Map<string, CardData[]>();
    pool.forEach(c => {
      const col = (c.collection || 'Coleção Atual').trim();
      if (!collectionCounts.has(col)) collectionCounts.set(col, []);
      collectionCounts.get(col)!.push(c);
    });

    const collectionsList = Array.from(collectionCounts.keys());
    const preferredCol = collectionsList[collectionsList.length - 1] || 'Coleção Atual';
    const selectedFromCol = collectionCounts.get(preferredCol) || pool;
    const chosen = (selectedFromCol.length >= 2 ? selectedFromCol : pool).slice(0, 4);

    return chosen.map((c, idx) => ({
      id: `auto_rare_${c.id || c.code || idx}`,
      source: 'catalog',
      name: c.name || 'Carta Rara',
      collection: c.collection || preferredCol,
      rarity: c.rarity || 'Rara',
      imageUrl: c.imageUrl
    }));
  }, [allCards]);

  const effectiveRareCards = useMemo<FeaturedRareCardItem[]>(() => {
    if (rareCardsConfig && Array.isArray(rareCardsConfig.cards)) {
      return rareCardsConfig.cards.filter(c => c && c.imageUrl);
    }
    return autoFallbackRareCards;
  }, [rareCardsConfig, autoFallbackRareCards]);

  const isRareShowcaseEnabled = rareCardsConfig?.isEnabled !== false;
  const rareShowcaseTitle = rareCardsConfig?.title?.trim() || 'Cartas Raras da Coleção Atual';
  const rareShowcaseCollection =
    rareCardsConfig?.collectionName?.trim() ||
    effectiveRareCards[0]?.collection ||
    'Coleção Atual';
  const frequencyMode = rareCardsConfig?.frequencyMode || 'high_interleaved';

  // Build carousel slides (bounded and clean — never creates hundreds of slides)
  const carouselSlides = useMemo<CarouselSlide[]>(() => {
    const slides: CarouselSlide[] = [];
    const hasRareSlide = isRareShowcaseEnabled && effectiveRareCards.length > 0;

    if (!hasRareSlide) {
      activeCarouselProducts.forEach((product, idx) => {
        slides.push({ kind: 'product', product, productIndex: idx });
      });
      return slides;
    }

    if (activeCarouselProducts.length === 0) {
      slides.push({
        kind: 'rare_showcase',
        cards: effectiveRareCards,
        focusStartIndex: 0,
        occurrenceIndex: 0
      });
      return slides;
    }

    if (frequencyMode === 'once_first') {
      slides.push({
        kind: 'rare_showcase',
        cards: effectiveRareCards,
        focusStartIndex: 0,
        occurrenceIndex: 0
      });
      activeCarouselProducts.forEach((product, idx) => {
        slides.push({ kind: 'product', product, productIndex: idx });
      });
      return slides;
    }

    // High or medium frequency: interleave the Rare Cards showcase slide between active carousel products
    const step = frequencyMode === 'medium_interleaved' ? 2 : 1;
    let rareOccurrence = 0;

    slides.push({
      kind: 'rare_showcase',
      cards: effectiveRareCards,
      focusStartIndex: 0,
      occurrenceIndex: rareOccurrence++
    });

    activeCarouselProducts.forEach((product, idx) => {
      slides.push({ kind: 'product', product, productIndex: idx });
      if ((idx + 1) % step === 0 && idx < activeCarouselProducts.length - 1) {
        const nextFocus =
          effectiveRareCards.length > 0
            ? (rareOccurrence * 3) % effectiveRareCards.length
            : 0;
        slides.push({
          kind: 'rare_showcase',
          cards: effectiveRareCards,
          focusStartIndex: nextFocus,
          occurrenceIndex: rareOccurrence++
        });
      }
    });

    return slides;
  }, [activeCarouselProducts, effectiveRareCards, isRareShowcaseEnabled, frequencyMode]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRareListModalOpen, setIsRareListModalOpen] = useState(false);
  const [inspectingRareCard, setInspectingRareCard] = useState<FeaturedRareCardItem | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [noticeProduct, setNoticeProduct] = useState<ExclusiveProduct | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Admin Manager Modal State
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [managerTab, setManagerTab] = useState<'carousel_items' | 'rare_list' | 'catalog' | 'upload'>('carousel_items');
  const [draftConfig, setDraftConfig] = useState<FeaturedRareCardsConfig>({
    isEnabled: true,
    title: 'Cartas Raras da Coleção Atual',
    collectionName: '',
    frequencyMode: 'high_interleaved',
    cards: []
  });
  const [draftProducts, setDraftProducts] = useState<ExclusiveProduct[]>([]);
  const [productsDirty, setProductsDirty] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Catalog picker filters in Manager Modal
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCollectionFilter, setCatalogCollectionFilter] = useState('Todas');
  const [catalogOnlyRare, setCatalogOnlyRare] = useState(false);
  const [catalogVisibleLimit, setCatalogVisibleLimit] = useState(60);

  // Custom card form in Manager Modal (ONLY Image + Collection!)
  const [customCardCollection, setCustomCardCollection] = useState('');
  const [customCardImageUrl, setCustomCardImageUrl] = useState('');
  const [isUploadingCustomImg, setIsUploadingCustomImg] = useState(false);

  const openManagerModal = (initialTab: 'carousel_items' | 'rare_list' | 'catalog' | 'upload' = 'carousel_items') => {
    const hasSavedConfig = Boolean(rareCardsConfig && Array.isArray(rareCardsConfig.cards));
    setDraftConfig({
      isEnabled: rareCardsConfig?.isEnabled !== false,
      title: rareCardsConfig?.title || 'Cartas Raras da Coleção Atual',
      collectionName:
        rareCardsConfig?.collectionName ||
        (hasSavedConfig ? rareCardsConfig!.cards[0]?.collection : '') ||
        'Coleção Atual',
      frequencyMode: rareCardsConfig?.frequencyMode === 'per_card_interleaved'
        ? 'high_interleaved'
        : (rareCardsConfig?.frequencyMode || 'high_interleaved'),
      cards: hasSavedConfig ? [...rareCardsConfig!.cards] : []
    });
    setDraftProducts(products.map(p => ({ ...p })));
    setProductsDirty(false);
    setSaveError(null);
    setCatalogVisibleLimit(60);
    setManagerTab(initialTab);
    setIsManagerOpen(true);
  };

  useEffect(() => {
    if (externalOpenManagerSignal && externalOpenManagerSignal > 0) {
      openManagerModal('carousel_items');
    }
  }, [externalOpenManagerSignal]);

  // Keep currentIndex in bounds
  useEffect(() => {
    if (currentIndex >= carouselSlides.length && carouselSlides.length > 0) {
      setCurrentIndex(0);
    }
  }, [carouselSlides.length, currentIndex]);

  const currentSlide = carouselSlides[currentIndex] || carouselSlides[0];

  // Auto slide every 10 seconds if 2 or more slides
  useEffect(() => {
    if (
      carouselSlides.length <= 1 ||
      isPaused ||
      isManagerOpen ||
      isRareListModalOpen ||
      Boolean(inspectingRareCard)
    ) {
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % carouselSlides.length);
    }, 10000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [carouselSlides.length, isPaused, currentIndex, isManagerOpen, isRareListModalOpen, inspectingRareCard]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % carouselSlides.length);
  };

  const availableCollections = useMemo(() => {
    const set = new Set<string>();
    allCards.forEach(c => {
      if (c.collection && c.collection.trim()) set.add(c.collection.trim());
      c.variants?.forEach(v => {
        if (v.collection && v.collection.trim()) set.add(v.collection.trim());
      });
    });
    return Array.from(set);
  }, [allCards]);

  const catalogPickerCandidates = useMemo(() => {
    const items: (FeaturedRareCardItem & { isRarePrint?: boolean })[] = [];
    const seenUrls = new Set<string>();

    allCards.forEach((c) => {
      const baseUrl = (c.imageUrl || '').trim();
      if (baseUrl && !seenUrls.has(baseUrl)) {
        seenUrls.add(baseUrl);
        items.push({
          id: `cat_${c.id || c.code}_${items.length}`,
          source: 'catalog',
          cardCode: c.code || '',
          name: c.name || 'Carta',
          collection: (c.collection || 'Coleção Geral').trim(),
          rarity: c.rarity || 'Comum',
          imageUrl: baseUrl,
          isRarePrint: Boolean(c.isRarePrint || c.requiresAdminVerification)
        });
      }
      if (c.variants && c.variants.length > 0) {
        c.variants.forEach((v, vIdx) => {
          const varUrl = (v.imageUrl || '').trim();
          if (varUrl && !seenUrls.has(varUrl)) {
            seenUrls.add(varUrl);
            items.push({
              id: `cat_var_${c.id || c.code}_${vIdx}_${items.length}`,
              source: 'catalog',
              cardCode: v.code || c.code || '',
              name: v.name && v.name !== 'Padrão' ? `${c.name} (${v.name})` : (c.name || 'Carta'),
              collection: (v.collection || c.collection || 'Coleção Geral').trim(),
              rarity: v.rarity || c.rarity || 'Rara',
              imageUrl: varUrl,
              isRarePrint: Boolean(v.isRarePrint || c.isRarePrint || c.requiresAdminVerification)
            });
          }
        });
      }
    });

    return items.filter(item => {
      if (catalogCollectionFilter !== 'Todas' && item.collection !== catalogCollectionFilter) {
        return false;
      }
      if (catalogOnlyRare && !isCardConsideredRare(item.rarity, Boolean(item.isRarePrint))) {
        return false;
      }
      if (catalogSearch.trim()) {
        const q = catalogSearch.trim().toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.collection.toLowerCase().includes(q) ||
          (item.cardCode || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allCards, catalogCollectionFilter, catalogOnlyRare, catalogSearch]);

  if (carouselSlides.length === 0 && !isAdmin) {
    return null;
  }

  const getProductMedias = (prod: ExclusiveProduct): ProductMediaItem[] => {
    if (prod.mediaList && Array.isArray(prod.mediaList) && prod.mediaList.length > 0) {
      const valid = prod.mediaList.filter(m => m && m.url && m.url.trim() !== '');
      if (valid.length > 0) return valid;
    }
    if (prod.mediaUrl && prod.mediaUrl.trim() !== '') {
      return [{ type: prod.mediaType || 'image', url: prod.mediaUrl }];
    }
    return [{ type: 'image', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe' }];
  };

  const getDeckCount = (prod: ExclusiveProduct) => {
    if (!prod.cardCodes || !prod.cardCodes.trim()) return 0;
    try {
      const parsed = parseDeckFromCode(prod.cardCodes, allCards);
      if (parsed.isValid) return parsed.totalCount;
    } catch {
      // Fallback
    }
    const entries = prod.cardCodes.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    let total = 0;
    for (const e of entries) {
      const match = e.match(/^(\d+)\s*[xX]?\s+/);
      total += match ? parseInt(match[1], 10) : 1;
    }
    return total;
  };

  const handleToggleCardInDraft = (item: FeaturedRareCardItem) => {
    const normalizedTargetUrl = (item.imageUrl || '').trim();
    if (!normalizedTargetUrl) return;
    setSaveError(null);
    setDraftConfig(prev => {
      const exists = prev.cards.some(c => (c.imageUrl || '').trim() === normalizedTargetUrl);
      if (exists) {
        return {
          ...prev,
          cards: prev.cards.filter(c => (c.imageUrl || '').trim() !== normalizedTargetUrl)
        };
      }
      const nextCollectionName =
        !prev.collectionName || prev.collectionName.trim() === '' || prev.collectionName === 'Coleção Atual'
          ? (item.collection || prev.collectionName || 'Coleção Atual')
          : prev.collectionName;
      return {
        ...prev,
        isEnabled: true,
        collectionName: nextCollectionName,
        cards: [
          ...prev.cards,
          {
            id: `rare_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            source: 'catalog',
            cardCode: item.cardCode || '',
            name: item.name,
            collection: item.collection,
            rarity: item.rarity,
            imageUrl: normalizedTargetUrl
          }
        ]
      };
    });
  };

  const handleUploadCustomCardFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingCustomImg(true);
    try {
      const colName =
        customCardCollection.trim() ||
        draftConfig.collectionName?.trim() ||
        'Coleção Atual';

      if (files.length === 1) {
        const url = await uploadMarketplaceImage(files[0], 'featured_rare_cards');
        setCustomCardImageUrl(url);
      } else {
        // Multi-upload straight into the rare cards list!
        const uploadedCards: FeaturedRareCardItem[] = [];
        for (let i = 0; i < files.length; i++) {
          const url = await uploadMarketplaceImage(files[i], 'featured_rare_cards');
          uploadedCards.push({
            id: `custom_rare_${Date.now()}_${i}`,
            source: 'custom',
            name: `Carta Rara #${i + 1}`,
            collection: colName,
            rarity: 'Rara',
            imageUrl: url
          });
        }
        setDraftConfig(prev => ({
          ...prev,
          cards: [...prev.cards, ...uploadedCards]
        }));
        setManagerTab('rare_list');
      }
    } catch (err) {
      console.error('Erro ao subir imagem da carta rara:', err);
    } finally {
      setIsUploadingCustomImg(false);
      e.target.value = '';
    }
  };

  const handleAddCustomCardToDraft = () => {
    if (!customCardImageUrl.trim()) return;
    const colName =
      customCardCollection.trim() ||
      draftConfig.collectionName?.trim() ||
      'Coleção Atual';
    const newCard: FeaturedRareCardItem = {
      id: `custom_rare_${Date.now()}`,
      source: 'custom',
      name: 'Carta Rara',
      collection: colName,
      rarity: 'Rara',
      imageUrl: customCardImageUrl.trim()
    };
    setDraftConfig(prev => ({
      ...prev,
      cards: [...prev.cards, newCard]
    }));
    setCustomCardImageUrl('');
    setManagerTab('rare_list');
  };

  const handleMoveDraftCard = (index: number, direction: -1 | 1) => {
    setDraftConfig(prev => {
      const next = [...prev.cards];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return { ...prev, cards: next };
    });
  };

  const handleRemoveDraftCard = (id: string) => {
    setDraftConfig(prev => ({
      ...prev,
      cards: prev.cards.filter(c => c.id !== id)
    }));
  };

  const handleSaveAllCarouselSettings = async () => {
    setIsSavingConfig(true);
    setSaveError(null);
    try {
      const configToSave: FeaturedRareCardsConfig = {
        ...draftConfig,
        isEnabled: draftConfig.isEnabled !== false,
        collectionName:
          draftConfig.collectionName?.trim() ||
          draftConfig.cards[0]?.collection ||
          'Coleção Atual',
        cards: draftConfig.cards.filter(c => c && c.imageUrl && c.imageUrl.trim() !== '')
      };

      if (onSaveRareCardsConfig) {
        await onSaveRareCardsConfig(configToSave);
      }
      if (productsDirty && onSaveProducts) {
        await onSaveProducts(draftProducts);
      }

      if (configToSave.isEnabled !== false && configToSave.cards.length > 0) {
        setCurrentIndex(0);
      }

      setIsManagerOpen(false);
      setSaveFeedback(
        `✓ Carrossel atualizado! (${configToSave.cards.length} carta(s) rara(s) ativa(s))`
      );
      setTimeout(() => setSaveFeedback(null), 4500);
    } catch (err: any) {
      console.error('Erro ao salvar configurações do carrossel:', err);
      setSaveError(
        err?.message || 'Não foi possível salvar no banco de dados. Tente novamente.'
      );
    } finally {
      setIsSavingConfig(false);
    }
  };

  // ============================================================================
  // SLIDE 1: PRODUCT SLIDE (STRICT FIXED HEIGHT: h-[460px] md:h-[390px])
  // ============================================================================
  const renderProductSlide = (product: ExclusiveProduct, slideIdx: number, totalSlides: number) => {
    const medias = getProductMedias(product);
    const mainMedia = medias[0];
    const deckCount = getDeckCount(product);
    const isButtonEnabled = product.isButtonActive !== false && product.isActive !== false;
    const buttonLink = product.buttonLink;
    const hasLink = Boolean(buttonLink && buttonLink.trim() !== '');
    const buttonText = product.buttonText || (hasLink ? 'Comprar Agora' : 'PRÉ-VENDA');

    return (
      <div
        onClick={() => onOpenProductModal(product)}
        className="cyber-arcane-box hover:border-amber-400/70 h-[460px] md:h-[390px] w-full overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.9)] transition-colors duration-300 cursor-pointer group flex flex-col md:flex-row relative"
      >
        <CyberArcaneCornerFrame accent="gold" />
        {/* Left Media: Fixed Height on Mobile, Full Height on Desktop */}
        <div className="relative h-[200px] md:h-full md:w-1/2 bg-black overflow-hidden flex items-center justify-center shrink-0 border-b md:border-b-0 md:border-r border-amber-500/20">
          {mainMedia.type === 'video' ? (
            <video
              key={mainMedia.url}
              src={mainMedia.url}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            <img
              key={mainMedia.url}
              src={mainMedia.url}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#05040a] via-transparent to-transparent opacity-85 pointer-events-none"></div>

          <div className="absolute top-3 left-3 flex flex-wrap gap-2 pointer-events-none">
            <span className="cyber-arcane-btn bg-purple-950/90 text-amber-300 text-[10px] sm:text-[11px] font-cinzel font-bold uppercase tracking-widest px-3 py-1 border border-amber-400/50 shadow-lg">
              {product.badge || 'Relíquia Oficial'}
            </span>
            {medias.length > 1 && (
              <span className="bg-black/80 backdrop-blur-sm text-cyan-300 text-[10px] font-mono font-bold px-2 py-1 border border-cyan-500/30 flex items-center gap-1">
                <ImageIcon size={11} /> +{medias.length - 1}
              </span>
            )}
          </div>

          <div className="absolute bottom-3 right-3 bg-[#07060e]/85 backdrop-blur-sm px-2.5 py-1 border border-cyan-500/35 text-[11px] text-cyan-300 font-cyber font-bold uppercase tracking-wider flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition">
            <Eye size={13} />
            <span>Ver Produto</span>
          </div>
        </div>

        {/* Right Info: Fixed Height & Clamped Content so height NEVER changes */}
        <div className="h-[260px] md:h-full md:w-1/2 p-4 sm:p-6 md:p-7 flex flex-col justify-between overflow-hidden relative z-10">
          <div className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 text-cyan-400 text-[11px] font-mono font-bold uppercase tracking-[0.18em] truncate">
                <Sparkles size={13} className="text-amber-400 shrink-0" />
                <span>
                  {totalSlides > 1
                    ? `DESTAQUE ${slideIdx + 1} DE ${totalSlides}`
                    : 'ARSENAL OFICIAL // DESTAQUE'}
                </span>
              </div>
              {totalSlides > 1 && (
                <span className="text-[10px] font-mono text-amber-300/90 bg-purple-950/70 border border-amber-500/30 px-2 py-0.5 shrink-0">
                  10s
                </span>
              )}
            </div>

            <h3 className="text-xl sm:text-2xl md:text-3xl font-cinzel font-black text-amber-50 group-hover:text-amber-300 transition-colors leading-tight mb-2 tracking-wide truncate">
              {product.title || 'Produto Exclusivo'}
            </h3>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed line-clamp-2 md:line-clamp-3 mb-3">
              {product.description}
            </p>

            {/* Single-row bounded badges/prices so height never expands */}
            <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
              {deckCount > 0 && (
                <div className="inline-flex items-center gap-1.5 bg-purple-950/80 border border-amber-500/40 px-2.5 py-1 text-amber-200 text-[11px] font-bold font-mono shrink-0">
                  <Layers size={12} className="text-amber-400" />
                  <span>{deckCount} CARTAS</span>
                </div>
              )}

              {product.priceVariations && product.priceVariations.length > 0 ? (
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {product.priceVariations.slice(0, 2).map((v, vIdx) => (
                    <button
                      key={vIdx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProductModal(product, vIdx);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold bg-purple-950/80 text-purple-200 border-purple-700/60 hover:border-amber-400 transition cursor-pointer shrink-0"
                    >
                      <span className="truncate max-w-[95px]">{v.name}:</span>
                      <span className="text-emerald-300 font-black">
                        {v.price.startsWith('R$') ? v.price : `R$ ${v.price}`}
                      </span>
                    </button>
                  ))}
                  {product.priceVariations.length > 2 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProductModal(product, 0);
                      }}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg border border-amber-500/50 bg-amber-500/15 text-amber-300 text-[11px] font-mono font-bold hover:bg-amber-500/25 transition cursor-pointer shrink-0"
                    >
                      +{product.priceVariations.length - 2} versões
                    </button>
                  )}
                </div>
              ) : (
                product.price &&
                product.price.trim() !== '' && (
                  <div className="inline-flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-500/50 px-3 py-1 rounded-lg text-emerald-300 font-mono font-black text-xs shadow-md shrink-0">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase">Preço:</span>
                    <span>
                      {product.price.startsWith('R$') ? product.price : `R$ ${product.price}`}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-3 border-t border-slate-800 shrink-0">
            <button
              onClick={() => onOpenProductModal(product)}
              className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 border border-slate-700 shrink-0"
            >
              <Eye size={15} />
              <span>Ver Detalhes</span>
            </button>

            {isButtonEnabled &&
              (product.priceVariations && product.priceVariations.length > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProductModal(product);
                  }}
                  className="flex-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 text-xs sm:text-sm cursor-pointer truncate"
                >
                  <ShoppingCart size={16} className="shrink-0" />
                  <span className="truncate">Escolher Versão & Comprar</span>
                </button>
              ) : onOpenStoreCheckout && product.allowInternalCheckout !== false ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenStoreCheckout(product, 0);
                  }}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 text-xs sm:text-sm cursor-pointer truncate"
                >
                  <ShoppingCart size={16} className="shrink-0" />
                  <span className="truncate">{buttonText}</span>
                </button>
              ) : hasLink ? (
                <a
                  href={buttonLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 text-xs sm:text-sm truncate"
                >
                  <ShoppingCart size={16} className="shrink-0" />
                  <span className="truncate">{buttonText}</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenStoreCheckout) {
                      onOpenStoreCheckout(product, 0);
                    } else {
                      setNoticeProduct(product);
                    }
                  }}
                  className="flex-1 bg-gradient-to-r from-amber-600 via-purple-600 to-indigo-600 hover:from-amber-500 hover:via-purple-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 text-xs sm:text-sm cursor-pointer truncate"
                >
                  <Calendar size={16} className="text-amber-300 shrink-0" />
                  <span className="truncate">{buttonText}</span>
                </button>
              ))}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // SLIDE 2: RARE CARDS SLIDE (STRICT FIXED HEIGHT: h-[460px] md:h-[390px])
  // SHOWS ALL SELECTED CARDS OVERLAPPED — CLICKING OPENS THE FULL LIST!
  // ONLY CARD IMAGES + COLLECTION NAME — NO DESCRIPTIONS OR EXTRA TEXT!
  // ============================================================================
  const renderRareShowcaseSlide = (cards: FeaturedRareCardItem[], slideIdx: number, totalSlides: number) => {
    const count = cards.length;
    const overlapCardClass =
      count <= 3
        ? 'h-[225px] sm:h-[260px] md:h-[265px] first:ml-0 -ml-6 sm:ml-4 md:ml-5'
        : count === 4
        ? 'h-[215px] sm:h-[250px] md:h-[255px] first:ml-0 -ml-12 sm:-ml-4 md:ml-3'
        : count <= 6
        ? 'h-[210px] sm:h-[245px] md:h-[250px] first:ml-0 -ml-16 sm:-ml-10 md:-ml-8'
        : count <= 8
        ? 'h-[205px] sm:h-[235px] md:h-[245px] first:ml-0 -ml-20 sm:-ml-16 md:-ml-16'
        : count <= 12
        ? 'h-[200px] sm:h-[230px] md:h-[235px] first:ml-0 -ml-24 sm:-ml-20 md:-ml-24'
        : 'h-[195px] sm:h-[220px] md:h-[225px] first:ml-0 -ml-24 sm:-ml-24 md:-ml-28';

    return (
      <div
        onClick={() => {
          if (cards.length > 0) setIsRareListModalOpen(true);
        }}
        className="cyber-arcane-box border-amber-400/60 hover:border-amber-300 h-[460px] md:h-[390px] w-full overflow-hidden shadow-[0_20px_70px_rgba(245,158,11,0.22)] transition-colors duration-300 flex flex-col justify-between p-4 sm:p-6 relative bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.16)_0%,rgba(88,28,135,0.22)_50%,rgba(5,4,10,0.98)_100%)] cursor-pointer group"
      >
        <CyberArcaneCornerFrame accent="gold" />

        {/* Top Header: ONLY Title + Collection Badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0 relative z-20">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="text-lg sm:text-xl md:text-2xl font-cinzel font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 tracking-wide">
              {rareShowcaseTitle}
            </h3>
            <span className="cyber-arcane-btn bg-gradient-to-r from-amber-500/90 via-yellow-500/90 to-amber-600/90 text-slate-950 text-[10px] sm:text-xs font-cinzel font-black uppercase tracking-widest px-3 py-1 border border-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.45)] flex items-center gap-1.5">
              <Crown size={13} className="text-slate-950" />
              <span>Coleção: {rareShowcaseCollection}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openManagerModal('catalog');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/70 text-amber-200 text-xs font-mono font-bold transition cursor-pointer"
              >
                <Plus size={13} />
                <span>Adicionar Cartas</span>
              </button>
            )}
            {totalSlides > 1 && (
              <span className="text-[10px] font-mono text-amber-300/90 bg-purple-950/70 border border-amber-500/30 px-2 py-0.5">
                {slideIdx + 1}/{totalSlides}
              </span>
            )}
          </div>
        </div>

        {/* Center Gallery: ALL Selected Cards Overlapped (Click anywhere to open full list) */}
        <div className="flex-1 flex items-center justify-center my-1 overflow-x-auto overflow-y-hidden relative z-10 px-4">
          {cards.length > 0 ? (
            <div className="flex items-center justify-center py-2 mx-auto">
              {cards.map((card, idx) => (
                <div
                  key={`${card.id}_${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsRareListModalOpen(true);
                  }}
                  className={`group/rc relative aspect-[63/88] rounded-xl overflow-hidden border-2 border-amber-400/80 hover:border-amber-200 shadow-[-6px_6px_22px_rgba(0,0,0,0.85),0_0_20px_rgba(245,158,11,0.28)] bg-slate-950 shrink-0 cursor-pointer transition-all duration-300 hover:-translate-y-3 hover:scale-105 hover:z-40 ${overlapCardClass}`}
                >
                  <img
                    src={card.imageUrl}
                    alt={card.collection || rareShowcaseCollection}
                    className="w-full h-full object-fill"
                  />
                  {/* Bottom badge with ONLY the Collection name */}
                  <div className="absolute bottom-1.5 inset-x-1.5 bg-black/85 backdrop-blur-md border border-amber-400/50 rounded-md px-1.5 py-0.5 text-center pointer-events-none">
                    <div className="text-[9px] sm:text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider truncate">
                      {card.collection || rareShowcaseCollection}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-amber-200 font-bold">
                Nenhuma carta adicionada ainda
              </p>
            </div>
          )}
        </div>

        {/* Bottom prompt: Click to view the full list */}
        <div className="h-6 flex items-center justify-center shrink-0 relative z-20">
          {cards.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsRareListModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-[11px] font-mono font-bold transition cursor-pointer"
            >
              <Eye size={12} />
              <span>
                Clique para ver todas as {cards.length} {cards.length === 1 ? 'carta' : 'cartas'}
              </span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <section
      id="novidades"
      className="-mt-12 sm:-mt-20 pt-4 pb-20 bg-gradient-to-b from-transparent via-[#05040a] to-[#05040a] relative z-20 overflow-hidden"
    >
      {textureSlot && (
        <ArcaneCyberTextureLayer
          slot={textureSlot}
          variant="cyber-grid"
          showPlaceholderBadge={showPlaceholderBadge}
          onOpenConfig={onConfigureTexture}
        />
      )}
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div
          className="max-w-5xl mx-auto w-full relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Admin Quick Bar above Carousel */}
          {isAdmin && (
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-3.5 py-2 rounded-xl bg-slate-950/90 border border-amber-500/40 shadow-lg">
              <div className="flex items-center gap-2 text-xs font-mono text-amber-300">
                <Crown size={15} className="text-amber-400" />
                <span>
                  <strong>CARROSSEL DA HOME:</strong> {carouselSlides.length} slides ativos ({activeCarouselProducts.length} produtos + {effectiveRareCards.length} cartas raras)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openManagerModal('carousel_items')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer"
                >
                  <Settings size={13} />
                  <span>Controlar Produtos do Carrossel</span>
                </button>
                <button
                  type="button"
                  onClick={() => openManagerModal('catalog')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs transition cursor-pointer"
                >
                  <Plus size={14} />
                  <span>+ Adicionar Cartas Raras</span>
                </button>
              </div>
            </div>
          )}

          {saveFeedback && (
            <div className="mb-3 px-4 py-2 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center justify-between shadow-lg">
              <span>{saveFeedback}</span>
              <button
                type="button"
                onClick={() => setSaveFeedback(null)}
                className="text-emerald-300 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Side Navigation Buttons if 2+ slides */}
          {carouselSlides.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute -left-2 sm:-left-5 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-3 bg-[#090714]/95 border border-amber-500/50 text-amber-200 hover:bg-purple-900 hover:text-white transition shadow-[0_0_20px_rgba(212,175,55,0.3)] backdrop-blur-md cursor-pointer"
                title="Destaque Anterior"
              >
                <ChevronLeft size={22} />
              </button>

              <button
                onClick={handleNext}
                className="absolute -right-2 sm:-right-5 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-3 bg-[#090714]/95 border border-amber-500/50 text-amber-200 hover:bg-purple-900 hover:text-white transition shadow-[0_0_20px_rgba(212,175,55,0.3)] backdrop-blur-md cursor-pointer"
                title="Próximo Destaque"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {/* Active Slide Content (Strict Fixed Height!) */}
          {currentSlide ? (
            currentSlide.kind === 'rare_showcase'
              ? renderRareShowcaseSlide(currentSlide.cards, currentIndex, carouselSlides.length)
              : renderProductSlide(currentSlide.product, currentIndex, carouselSlides.length)
          ) : (
            <div className="cyber-arcane-box h-[460px] md:h-[390px] w-full flex flex-col items-center justify-center p-6 text-center">
              <p className="text-sm text-slate-400 mb-3">
                Nenhum item ativo no carrossel no momento.
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => openManagerModal('carousel_items')}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs cursor-pointer"
                >
                  Configurar Carrossel
                </button>
              )}
            </div>
          )}

          {/* Single-line fixed-height Indicators (Never wraps or shifts height!) */}
          <div className="h-8 flex items-center justify-center gap-2 mt-3 overflow-hidden">
            {carouselSlides.length > 1 && carouselSlides.length <= 16 ? (
              carouselSlides.map((slide, idx) => {
                const isRare = slide.kind === 'rare_showcase';
                const isActive = currentIndex === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer shrink-0 ${
                      isActive
                        ? isRare
                          ? 'w-9 bg-gradient-to-r from-amber-400 to-yellow-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]'
                          : 'w-7 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                        : isRare
                        ? 'w-2.5 bg-amber-500/50 hover:bg-amber-400'
                        : 'w-2.5 bg-slate-700 hover:bg-slate-500'
                    }`}
                    title={
                      isRare
                        ? `${rareShowcaseTitle} (${idx + 1})`
                        : `${slide.product.title || 'Produto'} (${idx + 1})`
                    }
                  />
                );
              })
            ) : carouselSlides.length > 16 ? (
              <div className="flex items-center gap-3 text-xs font-mono text-amber-300 bg-slate-950/90 border border-amber-500/30 px-3.5 py-1 rounded-full">
                <span>
                  Slide <strong>{currentIndex + 1}</strong> de <strong>{carouselSlides.length}</strong>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Gradient transition divider at bottom */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10">
        <div className="h-28 bg-gradient-to-b from-transparent via-[#0a0a0c]/70 to-[#0a0a0c]"></div>
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"></div>
      </div>

      {/* Full Rare Cards List Modal (Opened when clicking the overlapped showcase) */}
      {isRareListModalOpen && effectiveRareCards.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsRareListModalOpen(false)}
        >
          <div
            className="bg-slate-950 border-2 border-amber-500/70 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-[0_0_70px_rgba(245,158,11,0.3)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-purple-950/60 to-slate-900 border-b border-amber-500/30 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/60 flex items-center justify-center text-amber-300 shrink-0">
                  <Crown size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-cinzel font-black text-amber-200">
                    {rareShowcaseTitle}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-amber-300/90">
                    <span>Coleção: {rareShowcaseCollection}</span>
                    <span>•</span>
                    <span>{effectiveRareCards.length} {effectiveRareCards.length === 1 ? 'carta' : 'cartas'}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRareListModalOpen(false)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-950">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {effectiveRareCards.map((card, idx) => (
                  <button
                    key={card.id || idx}
                    type="button"
                    onClick={() => setInspectingRareCard(card)}
                    className="group relative aspect-[63/88] rounded-xl overflow-hidden border-2 border-amber-400/60 hover:border-amber-300 bg-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.18)] hover:shadow-[0_0_28px_rgba(245,158,11,0.4)] transition-all duration-200 hover:scale-[1.03] cursor-pointer"
                  >
                    <img
                      src={card.imageUrl}
                      alt={card.collection || rareShowcaseCollection}
                      className="w-full h-full object-fill"
                    />
                    <div className="absolute bottom-1.5 inset-x-1.5 bg-black/85 backdrop-blur-md border border-amber-400/50 rounded-md px-2 py-0.5 text-center pointer-events-none">
                      <div className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider truncate">
                        {card.collection || rareShowcaseCollection}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal to Inspect a Rare Card: ONLY Image + Collection */}
      {inspectingRareCard && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setInspectingRareCard(null)}
        >
          <div
            className="bg-slate-950 border-2 border-amber-500/70 rounded-2xl max-w-md w-full p-5 shadow-[0_0_60px_rgba(245,158,11,0.35)] relative flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setInspectingRareCard(null)}
              className="absolute top-3 right-3 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-700 transition cursor-pointer z-10"
            >
              <X size={18} />
            </button>

            <span className="px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 text-xs font-cinzel font-black uppercase tracking-widest">
              Coleção: {inspectingRareCard.collection || rareShowcaseCollection}
            </span>

            <div className="w-72 sm:w-80 aspect-[63/88] rounded-xl overflow-hidden border-2 border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.4)] bg-slate-950">
              <img
                src={inspectingRareCard.imageUrl}
                alt={inspectingRareCard.collection || rareShowcaseCollection}
                className="w-full h-full object-fill"
              />
            </div>

            {effectiveRareCards.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1 px-2">
                {effectiveRareCards.map((c, idx) => (
                  <button
                    key={c.id || idx}
                    type="button"
                    onClick={() => setInspectingRareCard(c)}
                    className={`w-10 h-14 rounded overflow-hidden border transition cursor-pointer shrink-0 ${
                      c.imageUrl === inspectingRareCard.imageUrl
                        ? 'border-2 border-amber-400 scale-105'
                        : 'border-slate-700 opacity-50 hover:opacity-100'
                    }`}
                  >
                    <img src={c.imageUrl} alt={c.collection} className="w-full h-full object-fill" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin Modal: Gerenciador Completo do Carrossel & Cartas Raras */}
      {isManagerOpen && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsManagerOpen(false)}
        >
          <div
            className="bg-slate-950 border-2 border-amber-500/70 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-[0_0_70px_rgba(245,158,11,0.3)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-purple-950/60 to-slate-900 border-b border-amber-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/60 flex items-center justify-center text-amber-300">
                  <Crown size={22} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-cinzel font-black text-white">
                    Editar Carrossel de Destaques & Cartas Raras
                  </h3>
                  <p className="text-xs text-slate-400">
                    Escolha exatamente quais produtos entram no carrossel e adicione as imagens das Cartas Raras da Coleção Atual
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManagerOpen(false)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs Navigation */}
            <div className="px-4 pt-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setManagerTab('carousel_items')}
                className={`px-4 py-2.5 rounded-t-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 border-b-2 ${
                  managerTab === 'carousel_items'
                    ? 'bg-purple-600/25 text-purple-200 border-purple-400'
                    : 'bg-slate-900 text-slate-400 border-transparent hover:text-white'
                }`}
              >
                <Package size={14} />
                <span>
                  1. Produtos no Carrossel (
                  {draftProducts.filter(p => p && p.isActive !== false && !p.isHiddenFromStore && p.showInHomeCarousel !== false).length}
                  /{draftProducts.length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setManagerTab('rare_list')}
                className={`px-4 py-2.5 rounded-t-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 border-b-2 ${
                  managerTab === 'rare_list'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                    : 'bg-slate-900 text-slate-400 border-transparent hover:text-white'
                }`}
              >
                <Sparkles size={14} />
                <span>2. Cartas Raras Adicionadas ({draftConfig.cards.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setManagerTab('catalog')}
                className={`px-4 py-2.5 rounded-t-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 border-b-2 ${
                  managerTab === 'catalog'
                    ? 'bg-cyan-600/25 text-cyan-200 border-cyan-400'
                    : 'bg-slate-900 text-slate-400 border-transparent hover:text-white'
                }`}
              >
                <Search size={14} />
                <span>+ Escolher Cartas do Catálogo</span>
              </button>

              <button
                type="button"
                onClick={() => setManagerTab('upload')}
                className={`px-4 py-2.5 rounded-t-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 border-b-2 ${
                  managerTab === 'upload'
                    ? 'bg-emerald-600/25 text-emerald-200 border-emerald-400'
                    : 'bg-slate-900 text-slate-400 border-transparent hover:text-white'
                }`}
              >
                <Upload size={14} />
                <span>+ Subir Imagens de Cartas Raras</span>
              </button>
            </div>

            {/* Tab Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-950">
              {/* TAB 1: CONTROL WHICH PRODUCTS GO IN THE CAROUSEL */}
              {managerTab === 'carousel_items' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-white mb-0.5">
                        Controle de Produtos no Carrossel de Destaques
                      </h4>
                      <p className="text-xs text-slate-400">
                        Marque apenas os produtos que você quer exibir passando no carrossel da página inicial. Você também pode ativar/desativar isso lá na Loja em Gerenciar Produtos.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setProductsDirty(true);
                          setDraftProducts(prev =>
                            prev.map(p => ({ ...p, showInHomeCarousel: true }))
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/50 text-purple-200 text-xs font-bold transition cursor-pointer"
                      >
                        Marcar Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProductsDirty(true);
                          setDraftProducts(prev =>
                            prev.map(p => ({ ...p, showInHomeCarousel: false }))
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                      >
                        Desmarcar Todos
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {draftProducts.map((prod, idx) => {
                      const isHiddenInStore = prod.isActive === false || Boolean(prod.isHiddenFromStore);
                      const isInCarousel = !isHiddenInStore && prod.showInHomeCarousel !== false;
                      const thumb = getProductMedias(prod)[0]?.url || '';

                      return (
                        <label
                          key={prod.id || idx}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition cursor-pointer select-none ${
                            isInCarousel
                              ? 'bg-purple-950/30 border-purple-500/60'
                              : 'bg-slate-900/60 border-slate-800 opacity-70'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={thumb}
                              alt={prod.title}
                              className="w-12 h-12 rounded-lg object-cover bg-black border border-slate-700 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-black text-white truncate">
                                {prod.title || `Produto #${idx + 1}`}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {isHiddenInStore
                                  ? 'Oculto na Loja (não aparece no carrossel)'
                                  : isInCarousel
                                  ? 'Ativo no Carrossel da Home'
                                  : 'Fora do Carrossel (apenas na Loja)'}
                              </div>
                            </div>
                          </div>

                          <input
                            type="checkbox"
                            disabled={isHiddenInStore}
                            checked={prod.showInHomeCarousel !== false && !isHiddenInStore}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setProductsDirty(true);
                              setDraftProducts(prev =>
                                prev.map((p, i) =>
                                  i === idx ? { ...p, showInHomeCarousel: checked } : p
                                )
                              );
                            }}
                            className="w-5 h-5 accent-purple-500 rounded cursor-pointer shrink-0"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: RARE CARDS LIST & FREQUENCY */}
              {managerTab === 'rare_list' && (
                <div className="space-y-4">
                  {/* Top settings for Rare Cards slide */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-amber-300 mb-1">
                        Título do Slide
                      </label>
                      <input
                        type="text"
                        value={draftConfig.title || ''}
                        onChange={(e) =>
                          setDraftConfig(prev => ({ ...prev, title: e.target.value }))
                        }
                        placeholder="Cartas Raras da Coleção Atual"
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-amber-400 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-amber-300 mb-1">
                        Coleção Padrão
                      </label>
                      <input
                        type="text"
                        list="carousel-available-collections"
                        value={draftConfig.collectionName || ''}
                        onChange={(e) =>
                          setDraftConfig(prev => ({ ...prev, collectionName: e.target.value }))
                        }
                        placeholder="Ex: Invasão do Caos"
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-amber-400 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-amber-300 mb-1">
                        Frequência no Carrossel
                      </label>
                      <select
                        value={draftConfig.frequencyMode || 'high_interleaved'}
                        onChange={(e) =>
                          setDraftConfig(prev => ({
                            ...prev,
                            frequencyMode: e.target.value as FeaturedRareCardsConfig['frequencyMode']
                          }))
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-amber-500/50 text-amber-200 text-xs font-bold focus:border-amber-400 outline-none cursor-pointer"
                      >
                        <option value="high_interleaved">
                          Alta Frequência (Intercalar a cada 1 produto)
                        </option>
                        <option value="medium_interleaved">
                          Média Frequência (Intercalar a cada 2 produtos)
                        </option>
                        <option value="once_first">
                          Exibir 1x no Início do Carrossel
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-300">
                      Apenas a <strong>imagem da carta</strong> e a <strong>coleção</strong> são exibidas no destaque.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {draftConfig.cards.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setDraftConfig(prev => ({ ...prev, cards: [] }))}
                          className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-200 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 size={13} />
                          <span>Limpar Todas ({draftConfig.cards.length})</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setManagerTab('catalog')}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus size={14} />
                        <span>Escolher do Catálogo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setManagerTab('upload')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload size={14} />
                        <span>Subir Imagem do PC</span>
                      </button>
                    </div>
                  </div>

                  {draftConfig.cards.length === 0 ? (
                    <div className="p-10 rounded-2xl border-2 border-dashed border-slate-800 text-center">
                      <Sparkles size={36} className="text-amber-400 mx-auto mb-3" />
                      <h4 className="text-base font-bold text-white mb-1">
                        Nenhuma carta rara adicionada
                      </h4>
                      <p className="text-xs text-slate-400 mb-4">
                        Escolha cartas do catálogo ou envie as imagens das cartas raras do seu PC.
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setManagerTab('catalog')}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
                        >
                          Escolher do Catálogo
                        </button>
                        <button
                          type="button"
                          onClick={() => setManagerTab('upload')}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                        >
                          Subir Imagem do PC
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {draftConfig.cards.map((card, idx) => (
                        <div
                          key={card.id || idx}
                          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 flex flex-col gap-2"
                        >
                          <div className="relative aspect-[63/88] rounded-lg overflow-hidden bg-slate-950 border border-amber-500/30">
                            <img
                              src={card.imageUrl}
                              alt={card.collection}
                              className="w-full h-full object-fill"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono text-amber-300 uppercase mb-0.5">
                              Coleção
                            </label>
                            <input
                              type="text"
                              value={card.collection || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDraftConfig(prev => ({
                                  ...prev,
                                  cards: prev.cards.map((c, i) =>
                                    i === idx ? { ...c, collection: val } : c
                                  )
                                }));
                              }}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-bold text-white"
                              placeholder="Nome da Coleção"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-1 pt-1">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveDraftCard(idx, -1)}
                                disabled={idx === 0}
                                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 cursor-pointer"
                                title="Mover para trás"
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveDraftCard(idx, 1)}
                                disabled={idx === draftConfig.cards.length - 1}
                                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 cursor-pointer"
                                title="Mover para frente"
                              >
                                <ArrowDown size={13} />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveDraftCard(card.id)}
                              className="p-1.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 cursor-pointer flex items-center gap-1 text-[11px] font-bold px-2"
                              title="Remover carta"
                            >
                              <Trash2 size={12} />
                              <span>Remover</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PICK CARDS FROM SITE CATALOG */}
              {managerTab === 'catalog' && (
                <div className="space-y-3">
                  {/* Selection status & quick save bar */}
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/50 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-amber-200 font-bold">
                      <Sparkles size={15} className="text-amber-400 shrink-0" />
                      <span>
                        {draftConfig.cards.length > 0
                          ? `${draftConfig.cards.length} carta(s) selecionada(s) para o Carrossel. Clique nas cartas abaixo para marcar ou desmarcar e depois salve.`
                          : 'Clique nas cartas abaixo para adicionar ao Carrossel de Cartas Raras.'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {draftConfig.cards.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setManagerTab('rare_list')}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 text-xs font-bold transition cursor-pointer"
                        >
                          Ver Selecionadas ({draftConfig.cards.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveAllCarouselSettings}
                        disabled={isSavingConfig}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition cursor-pointer"
                      >
                        {isSavingConfig ? 'Salvando...' : 'Salvar no Carrossel'}
                      </button>
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 flex-1 min-w-[200px]">
                      <Search size={15} className="text-slate-400 mr-2" />
                      <input
                        type="text"
                        value={catalogSearch}
                        onChange={(e) => {
                          setCatalogSearch(e.target.value);
                          setCatalogVisibleLimit(60);
                        }}
                        placeholder="Buscar por nome, código ou coleção..."
                        className="w-full bg-transparent text-xs text-white outline-none"
                      />
                      {catalogSearch && (
                        <button
                          type="button"
                          onClick={() => setCatalogSearch('')}
                          className="text-slate-400 hover:text-white ml-1 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    <select
                      value={catalogCollectionFilter}
                      onChange={(e) => {
                        setCatalogCollectionFilter(e.target.value);
                        setCatalogVisibleLimit(60);
                      }}
                      className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="Todas">Todas as Coleções</option>
                      {availableCollections.map(col => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>

                    <label className="flex items-center gap-2 text-xs text-amber-300 font-bold cursor-pointer select-none px-3 py-2 rounded-lg bg-slate-950 border border-amber-500/40">
                      <input
                        type="checkbox"
                        checked={catalogOnlyRare}
                        onChange={(e) => {
                          setCatalogOnlyRare(e.target.checked);
                          setCatalogVisibleLimit(60);
                        }}
                        className="accent-amber-500"
                      />
                      <span>Apenas Raras</span>
                    </label>

                    <span className="text-[11px] font-mono text-slate-400">
                      {catalogPickerCandidates.length} carta(s)
                    </span>
                  </div>

                  {catalogPickerCandidates.length === 0 ? (
                    <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-400">
                      Nenhuma carta encontrada com os filtros atuais.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[46vh] overflow-y-auto pr-1">
                        {catalogPickerCandidates.slice(0, catalogVisibleLimit).map((item) => {
                          const normalizedUrl = (item.imageUrl || '').trim();
                          const isSelected = draftConfig.cards.some(
                            c => (c.imageUrl || '').trim() === normalizedUrl
                          );
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleToggleCardInDraft(item)}
                              className={`p-2 rounded-xl border-2 transition cursor-pointer flex flex-col text-left relative ${
                                isSelected
                                  ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.35)]'
                                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-500'
                              }`}
                            >
                              <div className="relative aspect-[63/88] w-full rounded-lg overflow-hidden bg-slate-950 mb-1.5">
                                <img
                                  src={item.imageUrl}
                                  alt={item.name || item.collection}
                                  loading="lazy"
                                  className="w-full h-full object-fill"
                                />
                                {isSelected && (
                                  <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md">
                                    <Check size={14} strokeWidth={3} />
                                  </div>
                                )}
                              </div>
                              <div className="text-[11px] font-bold text-white truncate w-full">
                                {item.name}
                              </div>
                              <div className="text-[10px] font-mono text-amber-300 truncate w-full mb-1.5">
                                {item.collection}
                              </div>
                              <div
                                className={`mt-auto w-full py-1 rounded-md text-center text-[10px] font-black uppercase tracking-wider ${
                                  isSelected
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {isSelected ? '✓ Selecionada' : '+ Adicionar'}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {catalogPickerCandidates.length > catalogVisibleLimit && (
                        <div className="flex justify-center pt-1">
                          <button
                            type="button"
                            onClick={() => setCatalogVisibleLimit(prev => prev + 60)}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                          >
                            Carregar mais cartas ({catalogVisibleLimit} de {catalogPickerCandidates.length})
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB 4: UPLOAD RARE CARD IMAGES (ONLY IMAGE + COLLECTION) */}
              {managerTab === 'upload' && (
                <div className="max-w-xl mx-auto bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
                  <h4 className="text-sm font-cinzel font-black text-amber-300 uppercase tracking-wider">
                    Subir Imagens de Cartas Raras (Apenas Imagem + Coleção)
                  </h4>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      Qual coleção elas fazem parte? *
                    </label>
                    <input
                      type="text"
                      list="carousel-available-collections"
                      value={customCardCollection}
                      onChange={(e) => setCustomCardCollection(e.target.value)}
                      placeholder={draftConfig.collectionName || 'Ex: Invasão do Caos'}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      Imagem da Carta (Subir 1 ou várias do PC, ou colar Link) *
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <label className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer inline-flex items-center justify-center gap-2 shrink-0">
                        <Upload size={15} />
                        <span>
                          {isUploadingCustomImg
                            ? 'Enviando...'
                            : 'Escolher Imagem(ns) do PC'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleUploadCustomCardFiles}
                          className="hidden"
                          disabled={isUploadingCustomImg}
                        />
                      </label>
                      <input
                        type="text"
                        value={customCardImageUrl}
                        onChange={(e) => setCustomCardImageUrl(e.target.value)}
                        placeholder="Ou cole a URL da imagem da carta..."
                        className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                      />
                    </div>
                  </div>

                  {customCardImageUrl && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-amber-500/40">
                      <img
                        src={customCardImageUrl}
                        alt="Preview"
                        className="w-16 h-22 object-contain rounded bg-black"
                      />
                      <div className="text-xs text-emerald-300 font-bold">
                        Imagem carregada! Clique abaixo para adicionar.
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddCustomCardToDraft}
                    disabled={!customCardImageUrl.trim()}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 text-slate-950 font-black text-xs uppercase tracking-wider transition cursor-pointer"
                  >
                    + Adicionar Carta Rara
                  </button>
                </div>
              )}
            </div>

            <datalist id="carousel-available-collections">
              {availableCollections.map(col => (
                <option key={col} value={col} />
              ))}
            </datalist>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col gap-2">
              {saveError && (
                <div className="px-3 py-2 rounded-lg bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-bold">
                  Erro ao salvar: {saveError}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftConfig.isEnabled !== false}
                    onChange={(e) =>
                      setDraftConfig(prev => ({ ...prev, isEnabled: e.target.checked }))
                    }
                    className="accent-amber-500 w-4 h-4"
                  />
                  <span>Exibir &ldquo;Cartas Raras da Coleção Atual&rdquo; no Carrossel ({draftConfig.cards.length} selecionada(s))</span>
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsManagerOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAllCarouselSettings}
                    disabled={isSavingConfig}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition cursor-pointer"
                  >
                    {isSavingConfig ? 'Salvando...' : 'Salvar Alterações do Carrossel'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notice modal if open */}
      {noticeProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setNoticeProduct(null)}
        >
          <div
            className="bg-slate-900 border-2 border-purple-500/70 rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-[0_0_50px_rgba(168,85,247,0.4)] text-center relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-purple-500 to-indigo-500"></div>

            <button
              onClick={() => setNoticeProduct(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-700 transition"
            >
              <X size={18} />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-purple-950/80 border border-purple-500/40 text-purple-300 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-950">
              <Calendar size={32} className="text-amber-400 animate-pulse" />
            </div>

            <div className="inline-block bg-purple-950/90 text-purple-300 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-purple-700/50 mb-2">
              Aviso de Lançamento
            </div>

            <h4 className="text-xl sm:text-2xl font-black text-white mb-2">
              {noticeProduct.title || 'Produto Oficial'}
            </h4>

            <div className="my-5 p-4 rounded-xl bg-slate-950 border border-purple-500/40 shadow-inner">
              <p className="text-lg sm:text-xl font-black text-amber-400 tracking-wide uppercase">
                {noticeProduct.noLinkMessage || 'PRÉ VENDA ABRE EM 15/10'}
              </p>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">
              Este item ainda não possui link de compra direta. Fique atento às nossas novidades para não perder a data de abertura!
            </p>

            <button
              onClick={() => setNoticeProduct(null)}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold transition shadow-lg shadow-purple-900/40"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </section>
  );
};


