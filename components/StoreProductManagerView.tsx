import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Upload,
  Film,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Search,
  Eye,
  EyeOff,
  Truck,
  MapPin,
  Copy,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Save,
  RefreshCw,
  Package,
  AlertCircle,
  Loader2,
  SlidersHorizontal,
  DollarSign,
  Calendar
} from 'lucide-react';
import {
  CardData,
  CardVariationItem,
  ExclusiveProduct,
  ProductIndividualCardItem,
  StoreSettings,
  SupplierOriginAddress
} from '../types';
import { useCards } from '../CardContext';
import {
  DEFAULT_STORE_SETTINGS,
  fetchStoreSettings,
  formatCep,
  isProductVisibleInStore,
  lookupCepAddress,
  optimizeBase64ImagesInProducts,
  saveStoreSettings,
  uploadMarketplaceImage
} from '../storeService';
import { encodeDeckCode, parseDeckFromCode } from '../deckUtils';

interface StoreProductManagerViewProps {
  products: ExclusiveProduct[];
  onChangeProducts: (nextProducts: ExclusiveProduct[]) => void;
  onSaveProducts: (productsToSave?: ExclusiveProduct[]) => Promise<void>;
  cards: CardData[];
  saving?: boolean;
  initialEditingIndex?: number | null;
  initialCreateNew?: boolean;
  initialCreateHidden?: boolean;
  onOpenShippingSettings?: () => void;
}

type ProductFilterMode =
  | 'all'
  | 'visible'
  | 'hidden'
  | 'in_stock'
  | 'out_of_stock'
  | 'pre_order'
  | 'custom_supplier';

type EditorSectionTab =
  | 'all_columns'
  | 'general'
  | 'stock_origin'
  | 'versions'
  | 'media'
  | 'cards';

export const StoreProductManagerView: React.FC<StoreProductManagerViewProps> = ({
  products,
  onChangeProducts,
  onSaveProducts,
  cards,
  saving = false,
  initialEditingIndex = null,
  initialCreateNew = false,
  initialCreateHidden = false,
  onOpenShippingSettings
}) => {
  const { saveCard, saveCollection, collections } = useCards();
  const [viewMode, setViewMode] = useState<'list' | 'editor'>(() =>
    initialEditingIndex !== null || initialCreateNew ? 'editor' : 'list'
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(initialEditingIndex);
  const [editorTab, setEditorTab] = useState<EditorSectionTab>('all_columns');

  const [filterMode, setFilterMode] = useState<ProductFilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingMediaKey, setUploadingMediaKey] = useState<string | null>(null);
  const [savedBannerMsg, setSavedBannerMsg] = useState<string | null>(null);
  const [defaultProductCardsCollection, setDefaultProductCardsCollection] = useState<string>('Natal Macroversal');
  const [syncingCardsToCatalog, setSyncingCardsToCatalog] = useState<boolean>(false);
  const [cardLinkSearchByIndex, setCardLinkSearchByIndex] = useState<Record<number, string>>({});

  // Store Settings (for Default Origin & Saved Third-Party Suppliers)
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [customCepLoading, setCustomCepLoading] = useState(false);
  const [quickVarName, setQuickVarName] = useState('');
  const [quickVarPrice, setQuickVarPrice] = useState('');
  const [catalogCardSearch, setCatalogCardSearch] = useState('');

  // Multi-Photo Batch Upload & Organizer State
  const [stagedPhotos, setStagedPhotos] = useState<
    Array<{
      id: string;
      url: string;
      name: string;
      destination: 'product_gallery' | 'variation';
      price: string;
    }>
  >([]);
  const [batchUploadProgress, setBatchUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    fetchStoreSettings().then(setStoreSettings);
  }, []);

  // Automatically optimize any heavy inline Base64 images in existing products
  const autoOptimizedRef = React.useRef(false);
  useEffect(() => {
    if (autoOptimizedRef.current || !Array.isArray(products) || products.length === 0) return;
    const hasBase64 = products.some(
      (p) =>
        p?.mediaUrl?.startsWith('data:image/') ||
        p?.mediaList?.some((m) => m?.url?.startsWith('data:image/')) ||
        p?.priceVariations?.some((v) => v?.imageUrl?.startsWith('data:image/'))
    );
    if (!hasBase64) return;
    autoOptimizedRef.current = true;
    optimizeBase64ImagesInProducts(products).then(({ nextProducts, changed }) => {
      if (changed) {
        onChangeProducts(nextProducts);
        onSaveProducts(nextProducts);
      }
    });
  }, [products]);

  // Handle initial create new product trigger
  useEffect(() => {
    if (initialCreateNew) {
      handleCreateNewProduct(initialCreateHidden);
    } else if (
      typeof initialEditingIndex === 'number' &&
      initialEditingIndex >= 0 &&
      initialEditingIndex < products.length
    ) {
      setEditingIndex(initialEditingIndex);
      setViewMode('editor');
    }
  }, [initialCreateNew, initialCreateHidden, initialEditingIndex]);

  const updateProductAt = (idx: number, updater: (prev: ExclusiveProduct) => ExclusiveProduct) => {
    if (idx < 0 || idx >= products.length) return;
    const next = [...products];
    next[idx] = updater({ ...next[idx] });
    onChangeProducts(next);
  };

  const handleSaveAndNotify = async (overrideList?: ExclusiveProduct[], customMsg?: string) => {
    if (
      !overrideList &&
      editingIndex !== null &&
      products[editingIndex] &&
      Array.isArray(products[editingIndex].productCards) &&
      products[editingIndex].productCards!.some((pc) => pc.imageUrl && !pc.syncedToCatalog)
    ) {
      await handleSyncProductCardsToCatalog(editingIndex, undefined, true);
    }
    await onSaveProducts(overrideList);
    setSavedBannerMsg(customMsg || '✓ Alterações nos produtos, cartas do catálogo e estoque salvas com sucesso!');
    setTimeout(() => setSavedBannerMsg(null), 3500);
  };

  const handleCreateNewProduct = (startHidden: boolean = false) => {
    const newProd: ExclusiveProduct = {
      id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: '',
      badge: 'Produto Oficial',
      category: 'Decks',
      storeCategory: 'decks',
      description: '',
      mediaType: 'image',
      mediaUrl: '',
      mediaList: [],
      cardCodes: '',
      productCards: [],
      buttonText: 'Comprar Agora',
      buttonLink: '',
      price: 'R$ 89,90',
      priceVariations: [],
      sameVariationPrice: false,
      noLinkMessage: 'PRÉ VENDA EM BREVE',
      isActive: !startHidden,
      isHiddenFromStore: startHidden,
      isButtonActive: true,
      stock: 20,
      weightGrams: 250,
      freeShipping: false,
      originAddressMode: 'store_default'
    };

    // Prepend at the TOP of the product list so the user never has to scroll to the bottom
    const next = [newProd, ...products];
    onChangeProducts(next);
    setEditingIndex(0);
    setEditorTab('all_columns');
    setViewMode('editor');
  };

  const handleInsertHalloweenTemplate = () => {
    const halloweenDeck: ExclusiveProduct = {
      id: `prod_halloween_${Date.now()}`,
      title: 'Deck Halloween - Invasão das Sombras',
      badge: 'Edição Especial Halloween',
      category: 'Decks',
      storeCategory: 'decks',
      description:
        'Deck temático de Halloween completo pronto para jogar com criaturas das trevas e magias sombrias.',
      mediaType: 'image',
      mediaUrl:
        'https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0120804533.firebasestorage.app/o/wb_images%2F1788736620932_Prancheta%2014.png?alt=media&token=efac4eed-1323-40d1-a15c-9687c910a9b2',
      mediaList: [
        {
          type: 'image',
          url: 'https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0120804533.firebasestorage.app/o/wb_images%2F1788736620932_Prancheta%2014.png?alt=media&token=efac4eed-1323-40d1-a15c-9687c910a9b2'
        }
      ],
      cardCodes: '',
      productCards: [],
      buttonText: 'Comprar Agora',
      buttonLink: '',
      price: 'R$ 89,90',
      priceVariations: [
        {
          name: 'Versão Normal',
          price: 'R$ 89,90',
          badge: 'Normal',
          description: 'Acabamento padrão não-foil, todas as cartas inclusas',
          buttonLink: '',
          isDefault: true,
          stock: 15
        },
        {
          name: 'Versão Full Foil',
          price: 'R$ 149,90',
          badge: 'Full Foil',
          description: 'Edição Especial: 100% das cartas com acabamento holográfico Full Foil',
          buttonLink: '',
          isDefault: false,
          stock: 10
        }
      ],
      noLinkMessage: 'PRÉ VENDA DE HALLOWEEN',
      isActive: true,
      isHiddenFromStore: false,
      isButtonActive: true,
      stock: 25,
      weightGrams: 250,
      originAddressMode: 'store_default'
    };

    const next = [halloweenDeck, ...products];
    onChangeProducts(next);
    setEditingIndex(0);
    setViewMode('editor');
  };

  const handleToggleVisibility = async (idx: number, hideFromStore: boolean) => {
    const next = [...products];
    next[idx] = {
      ...next[idx],
      isHiddenFromStore: hideFromStore,
      isActive: !hideFromStore
    };
    onChangeProducts(next);
    await handleSaveAndNotify(
      next,
      hideFromStore
        ? '✓ Produto marcado como OCULTO (não está mais à vista na loja).'
        : '✓ Produto desmarcado e colocado À VISTA na loja!'
    );
  };

  const handleToggleCarouselHighlight = async (idx: number, showInCarousel: boolean) => {
    const next = [...products];
    next[idx] = {
      ...next[idx],
      showInHomeCarousel: showInCarousel
    };
    onChangeProducts(next);
    await handleSaveAndNotify(
      next,
      showInCarousel
        ? '✓ Produto ATIVADO no Carrossel de Destaques da Página Inicial!'
        : '✓ Produto REMOVIDO do Carrossel de Destaques da Página Inicial.'
    );
  };

  const handleDuplicateProduct = (idx: number) => {
    const source = products[idx];
    if (!source) return;
    const copy: ExclusiveProduct = JSON.parse(
      JSON.stringify({
        ...source,
        id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: `${source.title || 'Produto'} (Cópia)`,
        isHiddenFromStore: true,
        isActive: false
      })
    );
    const next = [copy, ...products];
    onChangeProducts(next);
    setEditingIndex(0);
    setViewMode('editor');
  };

  const handleDeleteProduct = async (idx: number) => {
    const target = products[idx];
    if (!target) return;
    const next = products.filter((_, i) => i !== idx);
    onChangeProducts(next);
    if (editingIndex === idx) {
      setEditingIndex(null);
      setViewMode('list');
    }
    await handleSaveAndNotify(next, '✓ Produto removido da lista.');
  };

  const handleMoveProduct = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= products.length) return;
    const next = [...products];
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    onChangeProducts(next);
    if (editingIndex === idx) setEditingIndex(targetIdx);
  };

  // Upload Helpers
  const handleUploadMainMedia = async (prodIdx: number, file: File, mediaSlotIdx?: number) => {
    const key = `media-${prodIdx}-${mediaSlotIdx ?? 'new'}`;
    setUploadingMediaKey(key);
    try {
      const url = await uploadMarketplaceImage(file, 'products');
      const isVideo = file.type.startsWith('video/');
      const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image';

      updateProductAt(prodIdx, (prod) => {
        const list =
          prod.mediaList && Array.isArray(prod.mediaList)
            ? [...prod.mediaList]
            : prod.mediaUrl
            ? [{ type: prod.mediaType || 'image', url: prod.mediaUrl }]
            : [];

        if (typeof mediaSlotIdx === 'number' && mediaSlotIdx >= 0 && mediaSlotIdx < list.length) {
          list[mediaSlotIdx] = { type: mediaType, url };
        } else {
          list.push({ type: mediaType, url });
        }

        return {
          ...prod,
          mediaList: list,
          mediaUrl: list[0]?.url || url,
          mediaType: list[0]?.type || mediaType
        };
      });
    } finally {
      setUploadingMediaKey(null);
    }
  };

  const handleUploadVariationMedia = async (prodIdx: number, varIdx: number, file: File) => {
    const key = `var-${prodIdx}-${varIdx}`;
    setUploadingMediaKey(key);
    try {
      const url = await uploadMarketplaceImage(file, 'variations');
      updateProductAt(prodIdx, (prod) => {
        const vars = [...(prod.priceVariations || [])];
        if (vars[varIdx]) {
          vars[varIdx] = { ...vars[varIdx], imageUrl: url };
        }
        return { ...prod, priceVariations: vars };
      });
    } finally {
      setUploadingMediaKey(null);
    }
  };

  // Multi-Photo Batch Upload into the Organizer Tray
  const handleBatchUploadToOrganizer = async (
    prodIdx: number,
    files: FileList,
    defaultDestination: 'product_gallery' | 'variation'
  ) => {
    if (!files || files.length === 0) return;
    const targetProd = products[prodIdx];
    const basePrice = targetProd?.price || 'R$ 89,90';
    setUploadingMediaKey(`batch-${prodIdx}`);
    setBatchUploadProgress({ current: 0, total: files.length });

    try {
      const newStaged: Array<{
        id: string;
        url: string;
        name: string;
        destination: 'product_gallery' | 'variation';
        price: string;
      }> = [];

      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        setBatchUploadProgress({ current: fIdx + 1, total: files.length });
        const file = files[fIdx];
        const url = await uploadMarketplaceImage(file, 'products');
        const cleanName =
          file.name
            .replace(/\.[^/.]+$/, '')
            .replace(/[_-]+/g, ' ')
            .trim() || `Versão #${fIdx + 1}`;
        newStaged.push({
          id: `staged_${Date.now()}_${fIdx}`,
          url,
          name: cleanName,
          destination: defaultDestination,
          price: basePrice
        });
      }

      setStagedPhotos((prev) => [...prev, ...newStaged]);
    } finally {
      setUploadingMediaKey(null);
      setBatchUploadProgress(null);
    }
  };

  // Apply the organized staged photos into Product Gallery (mediaList) and/or Variations (priceVariations)
  const handleApplyStagedPhotos = (prodIdx: number) => {
    if (stagedPhotos.length === 0) return;

    updateProductAt(prodIdx, (prod) => {
      const currentGallery =
        prod.mediaList && prod.mediaList.length > 0
          ? [...prod.mediaList]
          : prod.mediaUrl
          ? [{ type: prod.mediaType || ('image' as const), url: prod.mediaUrl }]
          : [];
      const currentVars = [...(prod.priceVariations || [])];
      const basePrice = prod.price || 'R$ 89,90';

      for (const item of stagedPhotos) {
        if (item.destination === 'product_gallery') {
          if (!currentGallery.some((m) => m.url === item.url)) {
            currentGallery.push({ type: 'image', url: item.url });
          }
        } else {
          currentVars.push({
            id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: item.name.trim() || `Versão #${currentVars.length + 1}`,
            price: prod.sameVariationPrice ? basePrice : item.price.trim() || basePrice,
            imageUrl: item.url,
            badge: '',
            description: '',
            isDefault: currentVars.length === 0,
            stock: prod.stock
          });
          // If the product has no main cover photo yet, use the first variation photo as cover
          if (currentGallery.length === 0) {
            currentGallery.push({ type: 'image', url: item.url });
          }
        }
      }

      return {
        ...prod,
        mediaList: currentGallery,
        mediaUrl: currentGallery[0]?.url || prod.mediaUrl || '',
        mediaType: currentGallery[0]?.type || 'image',
        priceVariations: currentVars
      };
    });

    const count = stagedPhotos.length;
    setStagedPhotos([]);
    setSavedBannerMsg(
      `✓ ${count} foto(s) organizada(s) entre Fotos do Produto e Variações! Clique em "Salvar Alterações" para gravar.`
    );
    setTimeout(() => setSavedBannerMsg(null), 4000);
  };

  // Move or Convert an existing gallery photo into a Variation
  const handleConvertGalleryPhotoToVariation = (
    prodIdx: number,
    mediaIdx: number,
    removeFromGallery: boolean
  ) => {
    updateProductAt(prodIdx, (prod) => {
      const list =
        prod.mediaList && prod.mediaList.length > 0
          ? [...prod.mediaList]
          : prod.mediaUrl
          ? [{ type: prod.mediaType || ('image' as const), url: prod.mediaUrl }]
          : [];
      const targetMedia = list[mediaIdx];
      if (!targetMedia || !targetMedia.url) return prod;

      const vars = [...(prod.priceVariations || [])];
      const basePrice = prod.price || 'R$ 89,90';
      vars.push({
        id: `var_${Date.now()}_${vars.length}`,
        name: `Versão #${vars.length + 1}`,
        price: basePrice,
        imageUrl: targetMedia.url,
        badge: '',
        description: '',
        isDefault: vars.length === 0,
        stock: prod.stock
      });

      const nextList =
        removeFromGallery && list.length > 1
          ? list.filter((_, idx) => idx !== mediaIdx)
          : list;

      return {
        ...prod,
        mediaList: nextList,
        mediaUrl: nextList[0]?.url || targetMedia.url,
        mediaType: nextList[0]?.type || 'image',
        priceVariations: vars
      };
    });
  };

  // Move a variation's photo into the main Product Gallery (Fotos do Mesmo Produto)
  const handleMoveVariationPhotoToGallery = (
    prodIdx: number,
    varIdx: number,
    removeVariation: boolean
  ) => {
    updateProductAt(prodIdx, (prod) => {
      const vars = [...(prod.priceVariations || [])];
      const targetVar = vars[varIdx];
      if (!targetVar || !targetVar.imageUrl) return prod;

      const list =
        prod.mediaList && prod.mediaList.length > 0
          ? [...prod.mediaList]
          : prod.mediaUrl
          ? [{ type: prod.mediaType || ('image' as const), url: prod.mediaUrl }]
          : [];

      if (!list.some((m) => m.url === targetVar.imageUrl)) {
        list.push({ type: 'image', url: targetVar.imageUrl });
      }

      const nextVars = removeVariation
        ? vars.filter((_, idx) => idx !== varIdx)
        : vars;

      return {
        ...prod,
        mediaList: list,
        mediaUrl: list[0]?.url || targetVar.imageUrl,
        mediaType: list[0]?.type || 'image',
        priceVariations: nextVars
      };
    });
  };

  const findBestCatalogMatch = (rawName: string): CardData | undefined => {
    const clean = rawName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s/]/g, ' ')
      .trim();
    if (!clean || clean.length < 2) return undefined;

    // Se o arquivo for um TOKEN (ex: "TOKEN 01", "TOKEN13", "2026_0001_TOKEN14"), só vincula se o código exato do token já existir; nunca agrupa pelo nome genérico "TOKEN"!
    const tokenNumMatch = rawName.match(/TOKEN[-_\s]*(\d+)/i);
    if (tokenNumMatch || /^token$/i.test(clean)) {
      if (tokenNumMatch) {
        const tNum = tokenNumMatch[1].padStart(2, '0');
        const targetTokenCode = `TOKEN${tNum}`.toLowerCase();
        return cards.find((c) => (c.code || '').toLowerCase().endsWith(targetTokenCode));
      }
      return undefined;
    }

    // 1. Exact code match or exact name match
    const exact = cards.find((c) => {
      const cName = c.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
      if (cName === 'token' || c.type === 'Token') return false;
      const cCode = (c.code || '').toLowerCase();
      return cName === clean || cCode === clean || cCode.endsWith(clean);
    });
    if (exact) return exact;

    // 2. Prefix match (e.g. "Ikari" -> "Ikari - O Quebrado")
    const prefixMatch = cards.find((c) => {
      const cName = c.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
      if (cName === 'token' || c.type === 'Token') return false;
      const firstPart = cName.split(/\s*[-–:]\s*/)[0]?.trim() || '';
      return firstPart === clean || cName.startsWith(clean + ' ') || cName.startsWith(clean + '-');
    });
    if (prefixMatch) return prefixMatch;

    // 3. Substring match if at least 4 chars
    if (clean.length >= 4) {
      return cards.find((c) => {
        const cName = c.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();
        if (cName === 'token' || c.type === 'Token') return false;
        return cName.includes(clean);
      });
    }
    return undefined;
  };

  const getNextTokenCode = (offset: number = 0): string => {
    let maxNum = 0;
    for (const c of cards) {
      const m = (c.code || '').match(/TOKEN[-_]?(\d+)/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    const nextNum = String(maxNum + 1 + offset).padStart(2, '0');
    return `2026/0001/TOKEN${nextNum}`;
  };

  const handleUploadCustomCardFiles = async (prodIdx: number, files: FileList) => {
    const key = `pcard-${prodIdx}`;
    setUploadingMediaKey(key);
    const activeCollection = (defaultProductCardsCollection || 'Natal Macroversal').trim() || 'Natal Macroversal';
    try {
      const uploadedItems: ProductIndividualCardItem[] = [];
      let tokenAutoOffset = 0;
      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx];
        const url = await uploadMarketplaceImage(file, 'product_cards');
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
        const isTokenFile = /\btoken\b/i.test(cleanName) || /^token\d+/i.test(cleanName.replace(/\s+/g, ''));
        const explicitTokenMatch = file.name.match(/TOKEN[-_\s]*(\d+)/i);
        const matchedCatalogCard = findBestCatalogMatch(cleanName);

        if (matchedCatalogCard) {
          uploadedItems.push({
            id: `pcard_new_${Date.now()}_${fIdx}`,
            source: 'catalog',
            cardCode: matchedCatalogCard.code,
            name: matchedCatalogCard.name,
            imageUrl: url,
            type: matchedCatalogCard.type || 'Herói',
            rarity: matchedCatalogCard.rarity || 'Moderno Exclusiva',
            collection: activeCollection,
            frame: 'Moderno',
            syncedToCatalog: false,
            quantity: 1
          });
        } else if (isTokenFile) {
          const tokenCode = explicitTokenMatch
            ? `2026/0001/TOKEN${explicitTokenMatch[1].padStart(2, '0')}`
            : getNextTokenCode(tokenAutoOffset++);
          uploadedItems.push({
            id: `pcard_new_${Date.now()}_${fIdx}`,
            source: 'custom_new',
            cardCode: tokenCode,
            name: 'TOKEN',
            imageUrl: url,
            type: 'Token',
            rarity: 'Moderno Comum',
            collection: activeCollection,
            frame: 'Moderno',
            syncedToCatalog: false,
            quantity: 1
          });
        } else {
          uploadedItems.push({
            id: `pcard_new_${Date.now()}_${fIdx}`,
            source: 'custom_new',
            name: cleanName || `Carta Exclusiva #${fIdx + 1}`,
            imageUrl: url,
            type: 'Herói',
            rarity: 'Moderno Exclusiva',
            collection: activeCollection,
            frame: 'Moderno',
            syncedToCatalog: false,
            quantity: 1
          });
        }
      }

      updateProductAt(prodIdx, (prod) => ({
        ...prod,
        productCards: [...(prod.productCards || []), ...uploadedItems]
      }));
    } finally {
      setUploadingMediaKey(null);
    }
  };

  const handleSyncProductCardsToCatalog = async (
    prodIdx: number,
    specificCardIndex?: number,
    silent: boolean = false
  ) => {
    const targetProd = products[prodIdx];
    if (!targetProd || !Array.isArray(targetProd.productCards) || targetProd.productCards.length === 0) {
      return;
    }

    setSyncingCardsToCatalog(true);
    try {
      const updatedProductCards = [...targetProd.productCards];
      const collectionsToSave = new Set<string>();
      let syncedCount = 0;

      for (let idx = 0; idx < updatedProductCards.length; idx++) {
        if (specificCardIndex !== undefined && idx !== specificCardIndex) continue;
        const pc = updatedProductCards[idx];
        if (!pc.imageUrl) continue;

        const targetCollection = (pc.collection || defaultProductCardsCollection || 'Natal Macroversal').trim() || 'Natal Macroversal';
        const targetFrame: 'Moderno' | 'Legado' = pc.frame || 'Moderno';
        const targetRarity = pc.rarity && pc.rarity !== 'Nova / Exclusiva' ? pc.rarity : 'Moderno Exclusiva';
        collectionsToSave.add(targetCollection);

        const isTokenCard =
          pc.type === 'Token' ||
          (pc.name || '').trim().toUpperCase() === 'TOKEN' ||
          /TOKEN\d+/i.test(pc.cardCode || '');

        // Para TOKENs: só considera carta existente se o CÓDIGO exato (ex: 2026/0001/TOKEN14) já existir!
        // NUNCA junta tokens diferentes pelo nome "TOKEN", pois todos os tokens têm o mesmo nome "TOKEN" e códigos diferentes (2026/0001/TOKEN01, TOKEN02...).
        const existingCard = pc.cardCode
          ? cards.find((c) => c.code.toLowerCase() === pc.cardCode!.trim().toLowerCase())
          : isTokenCard
          ? undefined
          : cards.find((c) => c.name.toLowerCase() === (pc.name || '').toLowerCase());

        if (existingCard) {
          const existingVariants = Array.isArray(existingCard.variants) ? [...existingCard.variants] : [];
          // Ensure base image is preserved in variants if not already present
          if (
            existingCard.imageUrl &&
            !existingVariants.some((v) => v.imageUrl === existingCard.imageUrl)
          ) {
            existingVariants.unshift({
              id: `${existingCard.code.replace(/[\/\s-]/g, '_')}_base`,
              name: existingCard.collection || 'Padrão',
              code: existingCard.code,
              collection: existingCard.collection,
              frame: existingCard.frame || 'Moderno',
              rarity: existingCard.rarity || 'Moderno Comum',
              imageUrl: existingCard.imageUrl
            });
          }

          const varIdx = existingVariants.findIndex(
            (v) =>
              v.imageUrl === pc.imageUrl ||
              (v.collection && v.collection.toLowerCase() === targetCollection.toLowerCase() && v.imageUrl === pc.imageUrl)
          );

          const newVariantItem: CardVariationItem = {
            id: `var_${existingCard.code.replace(/[\/\s-]/g, '_')}_${targetCollection.replace(/[^a-zA-Z0-9]/g, '_')}`,
            name: targetCollection,
            code: existingCard.code,
            collection: targetCollection,
            frame: targetFrame,
            rarity: targetRarity,
            imageUrl: pc.imageUrl
          };

          if (varIdx >= 0) {
            existingVariants[varIdx] = {
              ...existingVariants[varIdx],
              ...newVariantItem
            };
          } else {
            existingVariants.push(newVariantItem);
          }

          await saveCard({
            ...existingCard,
            variants: existingVariants
          });

          updatedProductCards[idx] = {
            ...pc,
            source: 'catalog',
            cardCode: existingCard.code,
            name: existingCard.name,
            type: existingCard.type,
            collection: targetCollection,
            frame: targetFrame,
            rarity: targetRarity,
            syncedToCatalog: true
          };
          syncedCount++;
        } else {
          // Brand new standalone card in the catalog under targetCollection
          const generatedCode =
            pc.cardCode && pc.cardCode.trim()
              ? pc.cardCode.trim()
              : `2026/NATAL/C${String(cards.length + idx + 1).padStart(4, '0')}`;

          const validType = (['Herói', 'Combatente', 'Equipamento', 'Efeito', 'Token'].includes(pc.type || '')
            ? pc.type
            : 'Herói') as CardData['type'];

          const newCatalogCard: CardData = {
            code: generatedCode,
            name: pc.name || `Carta ${generatedCode}`,
            type: validType,
            archetype: 'Neutro',
            collection: targetCollection,
            frame: targetFrame,
            rarity: targetRarity,
            ct: 1,
            attack: validType === 'Herói' || validType === 'Combatente' ? 1 : undefined,
            defense: validType === 'Herói' || validType === 'Combatente' ? 1 : undefined,
            description: pc.description || `Carta da coleção ${targetCollection}.`,
            imageUrl: pc.imageUrl,
            variants: [
              {
                id: `var_${generatedCode.replace(/[\/\s-]/g, '_')}_base`,
                name: targetCollection,
                code: generatedCode,
                collection: targetCollection,
                frame: targetFrame,
                rarity: targetRarity,
                imageUrl: pc.imageUrl
              }
            ]
          };

          await saveCard(newCatalogCard);

          updatedProductCards[idx] = {
            ...pc,
            source: 'catalog',
            cardCode: generatedCode,
            collection: targetCollection,
            frame: targetFrame,
            rarity: targetRarity,
            syncedToCatalog: true
          };
          syncedCount++;
        }
      }

      for (const colName of collectionsToSave) {
        await saveCollection(colName);
      }

      const nextProducts = [...products];
      nextProducts[prodIdx] = {
        ...targetProd,
        productCards: updatedProductCards
      };
      onChangeProducts(nextProducts);

      if (!silent) {
        await onSaveProducts(nextProducts);
        const colsList = Array.from(collectionsToSave).join(', ');
        setSavedBannerMsg(
          `✓ ${syncedCount} carta(s) vinculada(s) e publicada(s) diretamente no Catálogo Oficial na coleção "${colsList}"!`
        );
        setTimeout(() => setSavedBannerMsg(null), 4500);
      }
    } catch (err: any) {
      console.error('Erro ao publicar cartas no catálogo:', err);
    } finally {
      setSyncingCardsToCatalog(false);
    }
  };

  const handleCustomOriginCepLookup = async (prodIdx: number, rawCep: string) => {
    const formatted = formatCep(rawCep);
    updateProductAt(prodIdx, (prod) => ({
      ...prod,
      originAddressMode: 'custom_supplier',
      customOriginCep: formatted
    }));

    const clean = formatted.replace(/\D/g, '');
    if (clean.length === 8) {
      setCustomCepLoading(true);
      try {
        const addr = await lookupCepAddress(clean);
        updateProductAt(prodIdx, (prod) => ({
          ...prod,
          originAddressMode: 'custom_supplier',
          customOriginCep: formatted,
          customOriginStreet: addr.street || prod.customOriginStreet || '',
          customOriginNeighborhood: addr.neighborhood || prod.customOriginNeighborhood || '',
          customOriginCity: addr.city || prod.customOriginCity || '',
          customOriginState: addr.state || prod.customOriginState || ''
        }));
      } catch {
        // allow manual typing
      } finally {
        setCustomCepLoading(false);
      }
    }
  };

  const handleSaveCurrentCustomOriginToGlobalSuppliers = async (prod: ExclusiveProduct) => {
    if (!prod.customOriginName?.trim() || (prod.customOriginCep || '').replace(/\D/g, '').length !== 8) {
      return;
    }
    const newSup: SupplierOriginAddress = {
      id: `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: prod.customOriginName.trim(),
      cep: formatCep(prod.customOriginCep || ''),
      street: prod.customOriginStreet || '',
      number: prod.customOriginNumber || 'S/N',
      complement: prod.customOriginComplement || undefined,
      neighborhood: prod.customOriginNeighborhood || '',
      city: prod.customOriginCity || '',
      state: (prod.customOriginState || '').toUpperCase()
    };
    const nextSettings: StoreSettings = {
      ...storeSettings,
      supplierOrigins: [...(storeSettings.supplierOrigins || []), newSup]
    };
    setStoreSettings(nextSettings);
    await saveStoreSettings(nextSettings);
    setSavedBannerMsg(`✓ Fornecedor "${newSup.name}" salvo na lista de fornecedores de frete!`);
    setTimeout(() => setSavedBannerMsg(null), 3500);
  };

  // KPI Metrics
  const stats = useMemo(() => {
    const total = products.length;
    const visible = products.filter((p) => isProductVisibleInStore(p)).length;
    const hidden = total - visible;
    const outOfStock = products.filter((p) => p.stock !== undefined && p.stock <= 0).length;
    const lowStock = products.filter(
      (p) => p.stock !== undefined && p.stock > 0 && p.stock <= 5
    ).length;
    const customSupplier = products.filter(
      (p) => p.originAddressMode === 'custom_supplier'
    ).length;
    return { total, visible, hidden, outOfStock, lowStock, customSupplier };
  }, [products]);

  // Filtered Products for Dashboard View
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products
      .map((prod, idx) => ({ prod, idx }))
      .filter(({ prod }) => {
        const isVisible = isProductVisibleInStore(prod);
        if (filterMode === 'visible' && !isVisible) return false;
        if (filterMode === 'hidden' && isVisible) return false;
        if (filterMode === 'in_stock' && prod.stock !== undefined && prod.stock <= 0) return false;
        if (
          filterMode === 'out_of_stock' &&
          (prod.stock === undefined || prod.stock > 5)
        ) {
          return false;
        }
        if (
          filterMode === 'pre_order' &&
          !prod.isPreOrder &&
          prod.storeCategory !== 'pre_venda'
        ) {
          return false;
        }
        if (
          filterMode === 'custom_supplier' &&
          prod.originAddressMode !== 'custom_supplier'
        ) {
          return false;
        }

        if (q) {
          const hay = [
            prod.title || '',
            prod.category || '',
            prod.badge || '',
            prod.description || '',
            prod.customOriginName || '',
            prod.customOriginCity || ''
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [products, filterMode, searchQuery]);

  const activeEditingProduct =
    editingIndex !== null && editingIndex >= 0 && editingIndex < products.length
      ? products[editingIndex]
      : null;

  const getProductPrimaryImage = (prod: ExclusiveProduct): string => {
    if (prod.mediaList && prod.mediaList.length > 0) {
      const firstImg = prod.mediaList.find((m) => m.type === 'image' && m.url);
      if (firstImg?.url) return firstImg.url;
    }
    if (prod.mediaUrl) return prod.mediaUrl;
    if (prod.priceVariations && prod.priceVariations[0]?.imageUrl) {
      return prod.priceVariations[0].imageUrl;
    }
    return '';
  };

  // ============================================================================
  // RENDER: DEDICATED FULL-PAGE PRODUCT EDITOR (VIEW B)
  // ============================================================================
  if (viewMode === 'editor' && activeEditingProduct && editingIndex !== null) {
    const i = editingIndex;
    const prod = activeEditingProduct;
    const isHidden = !isProductVisibleInStore(prod);
    const currentMediaList =
      prod.mediaList && Array.isArray(prod.mediaList)
        ? prod.mediaList
        : prod.mediaUrl
        ? [{ type: prod.mediaType || 'image', url: prod.mediaUrl }]
        : [];
    const deckPreview = parseDeckFromCode(prod.cardCodes, cards);

    return (
      <div className="space-y-6">
        {/* Sticky Top Bar of Dedicated Product Editor */}
        <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border border-purple-500/50 rounded-2xl p-4 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft size={15} />
              <span>Voltar para Lista & Estoque ({products.length})</span>
            </button>

            <div className="h-6 w-px bg-slate-800 hidden sm:block" />

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950/80 border border-purple-700/60 px-2.5 py-0.5 rounded-md">
                  Editando Produto #{i + 1}
                </span>
                <h3 className="text-base sm:text-lg font-black text-white truncate max-w-md">
                  {prod.title || 'Novo Produto (Sem Título)'}
                </h3>
                {isHidden ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1">
                    <EyeOff size={12} />
                    <span>Oculto da Loja (Não está à vista)</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1">
                    <Eye size={12} />
                    <span>À Vista na Loja</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Controls in Editor Top Bar: Visibility Checkbox + Add New + Save */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Checkbox to hide or show product in store */}
            <label
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition flex items-center gap-2 select-none ${
                isHidden
                  ? 'bg-amber-950/70 border-amber-500 text-amber-200 shadow-md shadow-amber-950/40'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
              }`}
              title="Se marcado, o produto fica salvo mas oculto dos clientes. Desmarque quando quiser deixá-lo à vista na loja."
            >
              <input
                type="checkbox"
                checked={isHidden}
                onChange={(e) => {
                  const hide = e.target.checked;
                  updateProductAt(i, (p) => ({
                    ...p,
                    isHiddenFromStore: hide,
                    isActive: !hide
                  }));
                }}
                className="w-4 h-4 accent-amber-500 rounded"
              />
              <span>Não deixar à vista na loja (Oculto)</span>
            </label>

            {/* Checkbox to toggle highlight in Home Carousel */}
            <label
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition flex items-center gap-2 select-none ${
                prod.showInHomeCarousel !== false
                  ? 'bg-purple-950/80 border-purple-500 text-purple-200 shadow-md shadow-purple-950/40'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
              title="Marque para exibir este produto no Carrossel de Destaques da Página Inicial."
            >
              <input
                type="checkbox"
                checked={prod.showInHomeCarousel !== false}
                onChange={(e) => {
                  const show = e.target.checked;
                  updateProductAt(i, (p) => ({
                    ...p,
                    showInHomeCarousel: show
                  }));
                }}
                className="w-4 h-4 accent-purple-500 rounded"
              />
              <span>Destaque no Carrossel da Home</span>
            </label>

            <button
              type="button"
              onClick={() => handleCreateNewProduct(false)}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-purple-500/40 text-purple-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>+ Novo Produto</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveAndNotify()}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
            >
              <Save size={15} />
              <span>{saving ? 'Salvando...' : 'Salvar Produto'}</span>
            </button>
          </div>
        </div>

        {savedBannerMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center justify-between">
            <span>{savedBannerMsg}</span>
            <button type="button" onClick={() => setSavedBannerMsg(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Section Navigation Tabs inside the Editor */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2 flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all_columns', label: 'Visão Completa (2 Colunas)', icon: <SlidersHorizontal size={14} /> },
            { id: 'general', label: '1. Dados Gerais & Visibilidade', icon: <Edit2 size={14} /> },
            { id: 'stock_origin', label: '2. Estoque, Frete & Endereço de Origem', icon: <Truck size={14} /> },
            { id: 'versions', label: `3. Versões & Preços (${(prod.priceVariations || []).length})`, icon: <Sparkles size={14} /> },
            { id: 'media', label: `4. Fotos & Vídeos (${currentMediaList.length})`, icon: <ImageIcon size={14} /> },
            { id: 'cards', label: `5. Cartas do Produto & Deck (${(prod.productCards || []).length})`, icon: <Layers size={14} /> }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setEditorTab(tab.id as EditorSectionTab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                editorTab === tab.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Dedicated Editor Workspace Grid */}
        <div
          className={
            editorTab === 'all_columns'
              ? 'grid grid-cols-1 xl:grid-cols-12 gap-6 items-start'
              : 'max-w-5xl mx-auto space-y-6'
          }
        >
          {/* LEFT / MAIN COLUMN */}
          <div className={editorTab === 'all_columns' ? 'xl:col-span-7 space-y-6' : 'space-y-6'}>
            {/* SECTION 1: DADOS GERAIS & VISIBILIDADE */}
            {(editorTab === 'all_columns' || editorTab === 'general') && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="text-sm font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
                    <Edit2 size={16} />
                    <span>1. Dados Gerais & Visibilidade na Loja</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(i)}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-red-950/40 transition"
                  >
                    <Trash2 size={14} />
                    <span>Excluir Produto</span>
                  </button>
                </div>

                {/* Visibility Box */}
                <div
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isHidden
                      ? 'bg-amber-950/30 border-amber-500/50'
                      : 'bg-emerald-950/20 border-emerald-500/40'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-black text-white flex items-center gap-2">
                      {isHidden ? (
                        <>
                          <EyeOff size={15} className="text-amber-400" />
                          <span className="text-amber-300">
                            PRODUTO OCULTO (Não está à vista para os clientes)
                          </span>
                        </>
                      ) : (
                        <>
                          <Eye size={15} className="text-emerald-400" />
                          <span className="text-emerald-300">
                            PRODUTO À VISTA NA LOJA (Visível na vitrine e catálogo)
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Você pode cadastrar e editar o produto inteiro sem deixá-lo à vista. Quando quiser publicá-lo, basta desmarcar a caixa ao lado.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-200 cursor-pointer bg-slate-950/90 border border-slate-700 px-3 py-2 rounded-xl">
                      <input
                        type="checkbox"
                        checked={isHidden}
                        onChange={(e) => {
                          const hide = e.target.checked;
                          updateProductAt(i, (p) => ({
                            ...p,
                            isHiddenFromStore: hide,
                            isActive: !hide
                          }));
                        }}
                        className="w-4 h-4 accent-amber-500 rounded"
                      />
                      <span>Não deixar à vista (Ocultar)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-purple-200 cursor-pointer bg-slate-950/90 border border-purple-500/40 px-3 py-2 rounded-xl">
                      <input
                        type="checkbox"
                        checked={prod.showInHomeCarousel !== false}
                        onChange={(e) =>
                          updateProductAt(i, (p) => ({
                            ...p,
                            showInHomeCarousel: e.target.checked
                          }))
                        }
                        className="w-4 h-4 accent-purple-500 rounded"
                      />
                      <span>Destaque no Carrossel da Home</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer px-1">
                      <input
                        type="checkbox"
                        checked={prod.isButtonActive !== false}
                        onChange={(e) =>
                          updateProductAt(i, (p) => ({
                            ...p,
                            isButtonActive: e.target.checked
                          }))
                        }
                        className="w-3.5 h-3.5 accent-purple-500 rounded"
                      />
                      <span>Botão de Compra Ativo</span>
                    </label>
                  </div>
                </div>

                {/* Title, Category & Badge */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-6">
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Título do Produto *
                    </label>
                    <input
                      type="text"
                      value={prod.title || ''}
                      onChange={(e) =>
                        updateProductAt(i, (p) => ({ ...p, title: e.target.value }))
                      }
                      placeholder="Ex: Deck Estrutural Invasão das Sombras"
                      className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl p-2.5 text-sm text-white font-bold outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-xs font-bold text-purple-300 block mb-1">
                      Categoria na Loja
                    </label>
                    <select
                      value={prod.storeCategory || 'decks'}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        const labels: Record<string, string> = {
                          decks: 'Decks',
                          cartas_avulsas: 'Cartas Avulsas',
                          playmats: 'Playmats',
                          promocoes: 'Promoções',
                          pre_venda: 'Pré-venda',
                          kits: 'Kits'
                        };
                        updateProductAt(i, (p) => ({
                          ...p,
                          storeCategory: val,
                          category: labels[val] || 'Decks',
                          isPreOrder: val === 'pre_venda' ? true : p.isPreOrder,
                          isPromotion: val === 'promocoes' ? true : p.isPromotion
                        }));
                      }}
                      className="w-full bg-slate-950 border border-purple-500/60 rounded-xl p-2.5 text-sm text-white font-bold outline-none"
                    >
                      <option value="decks">Decks</option>
                      <option value="cartas_avulsas">Cartas Avulsas</option>
                      <option value="playmats">Playmats</option>
                      <option value="promocoes">Promoções</option>
                      <option value="pre_venda">Pré-venda</option>
                      <option value="kits">Kits</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Etiqueta / Badge
                    </label>
                    <input
                      type="text"
                      value={prod.badge || ''}
                      onChange={(e) =>
                        updateProductAt(i, (p) => ({ ...p, badge: e.target.value }))
                      }
                      placeholder="Ex: Lançamento Oficial"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-sm text-amber-300 font-semibold outline-none"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Descrição Completa do Produto
                  </label>
                  <textarea
                    value={prod.description || ''}
                    onChange={(e) =>
                      updateProductAt(i, (p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="Descreva os detalhes do produto, conteúdo da caixa, bônus..."
                    className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl p-3 text-sm text-white h-28 resize-y outline-none"
                  />
                </div>

                {/* Pre-Order, Promotion & Button Config */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(prod.isPreOrder)}
                        onChange={(e) =>
                          updateProductAt(i, (p) => ({
                            ...p,
                            isPreOrder: e.target.checked
                          }))
                        }
                        className="accent-amber-500 w-4 h-4"
                      />
                      <span>Produto em Pré-Venda</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-pink-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(prod.isPromotion)}
                        onChange={(e) =>
                          updateProductAt(i, (p) => ({
                            ...p,
                            isPromotion: e.target.checked
                          }))
                        }
                        className="accent-pink-500 w-4 h-4"
                      />
                      <span>Em Promoção / Oferta</span>
                    </label>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Preço Antigo Riscado (Promo)
                    </label>
                    <input
                      type="text"
                      value={prod.originalPrice || ''}
                      onChange={(e) =>
                        updateProductAt(i, (p) => ({ ...p, originalPrice: e.target.value }))
                      }
                      placeholder="Ex: R$ 129,90"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-pink-300 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Previsão de Envio / Lote
                    </label>
                    <input
                      type="text"
                      value={prod.preOrderReleaseDate || ''}
                      onChange={(e) =>
                        updateProductAt(i, (p) => ({
                          ...p,
                          preOrderReleaseDate: e.target.value
                        }))
                      }
                      placeholder="Ex: Envios a partir de 15/12"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-amber-300 font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Texto do Botão de Compra
                    </label>
                    <input
                      type="text"
                      value={prod.buttonText || 'Comprar Agora'}
                      onChange={(e) =>
                        updateProductAt(i, (p) => ({ ...p, buttonText: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Link Externo Opcional (vazio = Carrinho + Mercado Pago)
                    </label>
                    <input
                      type="text"
                      value={prod.buttonLink || ''}
                      onChange={(e) =>
                        updateProductAt(i, (p) => ({ ...p, buttonLink: e.target.value }))
                      }
                      placeholder="Deixe vazio para usar o Checkout Interno"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: VERSÕES & PREÇOS DO PRODUTO */}
            {(editorTab === 'all_columns' || editorTab === 'versions') && (
              <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 space-y-4 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-400" />
                      <span>3. Versões do Produto & Preços (Coloque o Nome que Quiser)</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Defina o preço padrão ou crie quantas versões quiser digitando livremente o nome, valor, estoque e foto de cada versão.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <label className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md">
                      {uploadingMediaKey === `batch-${i}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      <span>
                        {uploadingMediaKey === `batch-${i}` && batchUploadProgress
                          ? `Subindo ${batchUploadProgress.current}/${batchUploadProgress.total}...`
                          : '+ Subir Várias Fotos (Organizar / Variações)'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleBatchUploadToOrganizer(i, e.target.files, 'variation');
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        updateProductAt(i, (p) => {
                          const vars = [...(p.priceVariations || [])];
                          vars.push({
                            name: '',
                            price: p.price || 'R$ 89,90',
                            badge: '',
                            description: '',
                            buttonLink: p.buttonLink || '',
                            isDefault: vars.length === 0,
                            stock: p.stock
                          });
                          return { ...p, priceVariations: vars };
                        });
                      }}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>+ Adicionar Versão</span>
                    </button>
                  </div>
                </div>

                {/* PAINEL ORGANIZADOR DE FOTOS SUBIDAS EM LOTE (GALERIA DO PRODUTO OU VARIAÇÕES) */}
                {stagedPhotos.length > 0 && (
                  <div className="bg-gradient-to-br from-purple-950/70 via-slate-950 to-amber-950/40 border-2 border-amber-400/70 rounded-2xl p-4 space-y-3.5 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
                      <div>
                        <h5 className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                          <Sparkles size={15} />
                          <span>
                            Organizar {stagedPhotos.length} Foto(s) Subida(s): Galeria do Produto ou Variações
                          </span>
                        </h5>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Escolha abaixo para cada foto (ou todas de uma vez) se ela será uma <strong className="text-purple-300">Foto do Mesmo Produto (Galeria)</strong> ou uma <strong className="text-amber-300">Foto de Variação</strong>.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setStagedPhotos((prev) =>
                              prev.map((item) => ({ ...item, destination: 'product_gallery' }))
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/60 text-purple-200 text-[11px] font-bold cursor-pointer transition"
                        >
                          Todas = Fotos do Mesmo Produto
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStagedPhotos((prev) =>
                              prev.map((item) => ({ ...item, destination: 'variation' }))
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/60 text-amber-200 text-[11px] font-bold cursor-pointer transition"
                        >
                          Todas = Fotos de Variações
                        </button>
                        <button
                          type="button"
                          onClick={() => setStagedPhotos([])}
                          className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-red-950/50 border border-slate-700 text-slate-400 hover:text-red-300 text-[11px] font-bold cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                      {stagedPhotos.map((sp, spIdx) => (
                        <div
                          key={sp.id}
                          className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                            sp.destination === 'variation'
                              ? 'bg-amber-950/25 border-amber-500/50'
                              : 'bg-purple-950/25 border-purple-500/50'
                          }`}
                        >
                          <img
                            src={sp.url}
                            alt={sp.name}
                            className="w-14 h-14 rounded-lg object-cover bg-black border border-slate-700 shrink-0"
                          />
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setStagedPhotos((prev) =>
                                    prev.map((item, idx) =>
                                      idx === spIdx
                                        ? { ...item, destination: 'product_gallery' }
                                        : item
                                    )
                                  )
                                }
                                className={`flex-1 py-1 px-2 rounded text-[10px] font-bold border transition cursor-pointer ${
                                  sp.destination === 'product_gallery'
                                    ? 'bg-purple-600 text-white border-purple-400'
                                    : 'bg-slate-900 text-slate-400 border-slate-800'
                                }`}
                              >
                                Foto do Produto
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setStagedPhotos((prev) =>
                                    prev.map((item, idx) =>
                                      idx === spIdx ? { ...item, destination: 'variation' } : item
                                    )
                                  )
                                }
                                className={`flex-1 py-1 px-2 rounded text-[10px] font-bold border transition cursor-pointer ${
                                  sp.destination === 'variation'
                                    ? 'bg-amber-500 text-slate-950 border-amber-300'
                                    : 'bg-slate-900 text-slate-400 border-slate-800'
                                }`}
                              >
                                Variação
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setStagedPhotos((prev) => prev.filter((_, idx) => idx !== spIdx))
                                }
                                className="p-1 text-slate-500 hover:text-red-400 cursor-pointer"
                                title="Remover da bandeja"
                              >
                                <X size={13} />
                              </button>
                            </div>

                            {sp.destination === 'variation' ? (
                              <div className="grid grid-cols-12 gap-1.5">
                                <input
                                  type="text"
                                  value={sp.name}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setStagedPhotos((prev) =>
                                      prev.map((item, idx) =>
                                        idx === spIdx ? { ...item, name: val } : item
                                      )
                                    );
                                  }}
                                  placeholder="Nome da versão..."
                                  className="col-span-7 bg-slate-900 border border-amber-500/40 rounded px-2 py-1 text-[11px] text-white font-bold outline-none"
                                />
                                <input
                                  type="text"
                                  value={sp.price}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setStagedPhotos((prev) =>
                                      prev.map((item, idx) =>
                                        idx === spIdx ? { ...item, price: val } : item
                                      )
                                    );
                                  }}
                                  placeholder="Preço"
                                  className="col-span-5 bg-slate-900 border border-emerald-500/40 rounded px-2 py-1 text-[11px] text-emerald-300 font-mono font-bold outline-none"
                                />
                              </div>
                            ) : (
                              <span className="text-[11px] text-purple-200 block truncate">
                                Vai para a Galeria de Fotos do mesmo produto
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
                      <span className="text-[11px] text-slate-300">
                        <strong className="text-purple-300">
                          {stagedPhotos.filter((s) => s.destination === 'product_gallery').length}
                        </strong>{' '}
                        p/ Galeria do Produto ·{' '}
                        <strong className="text-amber-300">
                          {stagedPhotos.filter((s) => s.destination === 'variation').length}
                        </strong>{' '}
                        p/ Variações
                      </span>

                      <button
                        type="button"
                        onClick={() => handleApplyStagedPhotos(i)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg cursor-pointer"
                      >
                        <Check size={14} />
                        <span>Aplicar Organização das Fotos</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Base Price Row + Quick Add Version Bar */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 items-end">
                  <div className="md:col-span-4">
                    <label className="text-xs font-bold text-emerald-300 block mb-1">
                      Preço Base / Padrão (R$)
                    </label>
                    <input
                      type="text"
                      value={prod.price || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateProductAt(i, (p) => ({
                          ...p,
                          price: val,
                          priceVariations: p.sameVariationPrice
                            ? (p.priceVariations || []).map((v) => ({ ...v, price: val }))
                            : p.priceVariations
                        }));
                      }}
                      placeholder="Ex: R$ 89,90"
                      className="w-full bg-slate-900 border border-emerald-500/60 rounded-lg p-2 text-sm text-emerald-300 font-mono font-bold outline-none"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="text-[11px] font-bold text-amber-200 block mb-1">
                      Criar Versão Rápida (Digite o nome que quiser)
                    </label>
                    <input
                      type="text"
                      value={quickVarName}
                      onChange={(e) => setQuickVarName(e.target.value)}
                      placeholder="Nome da versão..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-bold outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Preço da Versão
                    </label>
                    <input
                      type="text"
                      value={quickVarPrice}
                      onChange={(e) => setQuickVarPrice(e.target.value)}
                      placeholder={prod.price || 'R$ 89,90'}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-emerald-300 font-mono font-bold outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <button
                      type="button"
                      onClick={() => {
                        const nameToUse = quickVarName.trim();
                        const priceToUse = quickVarPrice.trim() || prod.price || 'R$ 89,90';
                        updateProductAt(i, (p) => {
                          const vars = [...(p.priceVariations || [])];
                          vars.push({
                            name: nameToUse,
                            price: priceToUse,
                            badge: '',
                            description: '',
                            isDefault: vars.length === 0,
                            stock: p.stock
                          });
                          return { ...p, priceVariations: vars };
                        });
                        setQuickVarName('');
                        setQuickVarPrice('');
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 border border-amber-500/50 text-amber-200 text-xs font-bold transition cursor-pointer"
                    >
                      Inserir Versão
                    </button>
                  </div>
                </div>

                {/* List of Variations */}
                {prod.priceVariations && prod.priceVariations.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 border border-slate-800 px-3.5 py-2 rounded-xl">
                      <span className="text-xs font-bold text-slate-300">
                        Modo de Preço das Versões:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateProductAt(i, (p) => {
                              const baseP = p.price || p.priceVariations?.[0]?.price || 'R$ 89,90';
                              return {
                                ...p,
                                sameVariationPrice: true,
                                price: baseP,
                                priceVariations: (p.priceVariations || []).map((v) => ({
                                  ...v,
                                  price: baseP
                                }))
                              };
                            })
                          }
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            prod.sameVariationPrice
                              ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          Mesmo Preço em Todas
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateProductAt(i, (p) => ({ ...p, sameVariationPrice: false }))
                          }
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            !prod.sameVariationPrice
                              ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          Preço Individual por Versão
                        </button>
                      </div>
                    </div>

                    {prod.priceVariations.map((v, vIdx) => (
                      <div
                        key={vIdx}
                        className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                          <span className="text-xs font-bold text-amber-300">
                            Versão #{vIdx + 1}: {v.name || '(Digite o nome abaixo)'}
                          </span>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                              <input
                                type="radio"
                                name={`def_var_${i}`}
                                checked={Boolean(v.isDefault)}
                                onChange={() =>
                                  updateProductAt(i, (p) => ({
                                    ...p,
                                    priceVariations: (p.priceVariations || []).map(
                                      (item, idx) => ({
                                        ...item,
                                        isDefault: idx === vIdx
                                      })
                                    )
                                  }))
                                }
                                className="accent-amber-500"
                              />
                              <span className="text-[11px] text-slate-400">Padrão</span>
                            </label>

                            <button
                              type="button"
                              onClick={() =>
                                updateProductAt(i, (p) => ({
                                  ...p,
                                  priceVariations: (p.priceVariations || []).filter(
                                    (_, idx) => idx !== vIdx
                                  )
                                }))
                              }
                              className="text-red-400 hover:text-red-300 p-1"
                              title="Remover versão"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                          <div className="sm:col-span-5">
                            <label className="text-[11px] text-slate-400 block mb-1">
                              Nome da Versão (Livre)
                            </label>
                            <input
                              type="text"
                              value={v.name || ''}
                              onChange={(e) =>
                                updateProductAt(i, (p) => {
                                  const vars = [...(p.priceVariations || [])];
                                  vars[vIdx] = { ...vars[vIdx], name: e.target.value };
                                  return { ...p, priceVariations: vars };
                                })
                              }
                              placeholder="Digite o nome da versão..."
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-bold"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label className="text-[11px] text-slate-400 block mb-1">
                              Preço (R$)
                            </label>
                            <input
                              type="text"
                              disabled={Boolean(prod.sameVariationPrice)}
                              value={
                                prod.sameVariationPrice
                                  ? prod.price || v.price || ''
                                  : v.price || ''
                              }
                              onChange={(e) =>
                                updateProductAt(i, (p) => {
                                  const vars = [...(p.priceVariations || [])];
                                  vars[vIdx] = { ...vars[vIdx], price: e.target.value };
                                  return { ...p, priceVariations: vars };
                                })
                              }
                              placeholder="R$ 89,90"
                              className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg p-2 text-xs text-emerald-300 font-mono font-bold disabled:opacity-60"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-[11px] text-slate-400 block mb-1">
                              Estoque Versão
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={v.stock !== undefined ? v.stock : ''}
                              onChange={(e) =>
                                updateProductAt(i, (p) => {
                                  const vars = [...(p.priceVariations || [])];
                                  vars[vIdx] = {
                                    ...vars[vIdx],
                                    stock:
                                      e.target.value === ''
                                        ? undefined
                                        : Number(e.target.value)
                                  };
                                  return { ...p, priceVariations: vars };
                                })
                              }
                              placeholder="Livre"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-[11px] text-slate-400 block mb-1">
                              Badge
                            </label>
                            <input
                              type="text"
                              value={v.badge || ''}
                              onChange={(e) =>
                                updateProductAt(i, (p) => {
                                  const vars = [...(p.priceVariations || [])];
                                  vars[vIdx] = { ...vars[vIdx], badge: e.target.value };
                                  return { ...p, priceVariations: vars };
                                })
                              }
                              placeholder="Opcional"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-amber-300"
                            />
                          </div>
                        </div>

                        {/* Variation Image & Description */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1">
                          <div className="sm:col-span-7 flex items-center gap-2">
                            <div className="w-10 h-10 rounded bg-black border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                              {v.imageUrl ? (
                                <img
                                  src={v.imageUrl}
                                  alt={v.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <ImageIcon size={15} className="text-slate-600" />
                              )}
                            </div>
                            <input
                              type="text"
                              value={v.imageUrl || ''}
                              onChange={(e) =>
                                updateProductAt(i, (p) => {
                                  const vars = [...(p.priceVariations || [])];
                                  vars[vIdx] = { ...vars[vIdx], imageUrl: e.target.value };
                                  return { ...p, priceVariations: vars };
                                })
                              }
                              placeholder="Foto específica desta versão (opcional)"
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                            />
                            <label className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold cursor-pointer shrink-0 flex items-center gap-1">
                              {uploadingMediaKey === `var-${i}-${vIdx}` ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Upload size={12} />
                              )}
                              <span>Foto</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    handleUploadVariationMedia(i, vIdx, e.target.files[0]);
                                    e.target.value = '';
                                  }
                                }}
                              />
                            </label>
                          </div>

                          <div className="sm:col-span-5 space-y-1.5">
                            <input
                              type="text"
                              value={v.description || ''}
                              onChange={(e) =>
                                updateProductAt(i, (p) => {
                                  const vars = [...(p.priceVariations || [])];
                                  vars[vIdx] = { ...vars[vIdx], description: e.target.value };
                                  return { ...p, priceVariations: vars };
                                })
                              }
                              placeholder="Resumo / detalhe desta versão (opcional)"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-slate-300"
                            />
                            <div className="flex flex-wrap items-center gap-1.5">
                              {v.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveVariationPhotoToGallery(i, vIdx, false)}
                                  className="px-2 py-1 rounded bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/40 text-purple-200 text-[10px] font-bold cursor-pointer transition"
                                  title="Copia esta foto para a Galeria de Fotos do Mesmo Produto"
                                >
                                  ↗ Enviar Foto p/ Galeria do Produto
                                </button>
                              )}
                              {v.imageUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleMoveVariationPhotoToGallery(i, vIdx, true)}
                                  className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-amber-200 text-[10px] font-bold cursor-pointer transition"
                                  title="Move a foto para a Galeria do Produto e remove esta variação"
                                >
                                  ⇄ Virar Foto do Produto (Remover Variação)
                                </button>
                              )}
                              {currentMediaList.length > 0 && (
                                <select
                                  value=""
                                  onChange={(e) => {
                                    const chosenUrl = e.target.value;
                                    if (!chosenUrl) return;
                                    updateProductAt(i, (p) => {
                                      const vars = [...(p.priceVariations || [])];
                                      vars[vIdx] = { ...vars[vIdx], imageUrl: chosenUrl };
                                      return { ...p, priceVariations: vars };
                                    });
                                  }}
                                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-cyan-300 font-bold outline-none cursor-pointer"
                                >
                                  <option value="">Usar foto da Galeria...</option>
                                  {currentMediaList
                                    .filter((m) => m.type !== 'video' && m.url)
                                    .map((m, mIdx) => (
                                      <option key={mIdx} value={m.url}>
                                        Foto #{mIdx + 1} da Galeria
                                      </option>
                                    ))}
                                </select>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SECTION 5: CARTAS INDIVIDUAIS DO PRODUTO & CÓDIGO DE DECK */}
            {(editorTab === 'all_columns' || editorTab === 'cards') && (
              <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 space-y-5 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                      <Layers size={16} className="text-cyan-400" />
                      <span>5. Imagens Individuais das Cartas & Sincronização Direta com o Catálogo</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Passo 1: Suba várias imagens de cartas de uma vez • Passo 2: Vincule à carta do catálogo e à coleção nova (ex: &quot;Natal Macroversal&quot;) para publicar direto no Catálogo Oficial.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/50">
                      {uploadingMediaKey === `pcard-${i}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      <span>
                        {uploadingMediaKey === `pcard-${i}`
                          ? 'Subindo Cartas...'
                          : '+ Subir Várias Imagens de Cartas de Uma Vez'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleUploadCustomCardFiles(i, e.target.files);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        updateProductAt(i, (p) => {
                          const list = [...(p.productCards || [])];
                          list.push({
                            id: `pcard_new_${Date.now()}`,
                            source: 'custom_new',
                            name: `Carta Nova #${list.length + 1}`,
                            imageUrl: '',
                            type: 'Herói',
                            rarity: 'Moderno Exclusiva',
                            collection: (defaultProductCardsCollection || 'Natal Macroversal').trim() || 'Natal Macroversal',
                            frame: 'Moderno',
                            syncedToCatalog: false,
                            quantity: 1
                          });
                          return { ...p, productCards: list };
                        })
                      }
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-xs font-bold transition cursor-pointer"
                    >
                      + Carta por URL
                    </button>
                  </div>
                </div>

                {/* Coleção Padrão das Cartas deste Produto + Botão de Publicar Todas no Catálogo */}
                <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[11px] font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                        <Sparkles size={13} className="text-emerald-400" />
                        <span>Selecionar Coleção Existente ou Digitar Nova Coleção:</span>
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <select
                          value={
                            Array.from(new Set(['Natal Macroversal', ...(collections || [])])).includes(
                              defaultProductCardsCollection
                            )
                              ? defaultProductCardsCollection
                              : '__CUSTOM__'
                          }
                          onChange={(e) => {
                            if (e.target.value !== '__CUSTOM__') {
                              setDefaultProductCardsCollection(e.target.value);
                            } else {
                              setDefaultProductCardsCollection('');
                            }
                          }}
                          className="bg-slate-950 border border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-emerald-300 font-bold outline-none focus:border-emerald-400"
                        >
                          <optgroup label="Coleções Existentes no Site">
                            {Array.from(new Set(['Natal Macroversal', ...(collections || [])])).map((col) => (
                              <option key={col} value={col}>
                                {col}
                              </option>
                            ))}
                          </optgroup>
                          <option value="__CUSTOM__">+ Digitar Nova Coleção...</option>
                        </select>

                        <input
                          type="text"
                          value={defaultProductCardsCollection}
                          onChange={(e) => setDefaultProductCardsCollection(e.target.value)}
                          placeholder="Ou digite o nome da coleção nova..."
                          className="flex-1 bg-slate-950 border border-emerald-500/50 rounded-lg px-3 py-2 text-xs text-white font-bold outline-none focus:border-emerald-400"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const colToApply = (defaultProductCardsCollection || 'Natal Macroversal').trim() || 'Natal Macroversal';
                            updateProductAt(i, (p) => ({
                              ...p,
                              productCards: (p.productCards || []).map((pc) => ({
                                ...pc,
                                collection: colToApply,
                                syncedToCatalog: false
                              }))
                            }));
                          }}
                          className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-emerald-500/40 text-emerald-200 text-[11px] font-bold transition cursor-pointer shrink-0"
                        >
                          Aplicar Coleção em Todas Abaixo
                        </button>
                      </div>
                    </div>

                    {Array.isArray(prod.productCards) && prod.productCards.length > 0 && (
                      <button
                        type="button"
                        disabled={syncingCardsToCatalog}
                        onClick={() => handleSyncProductCardsToCatalog(i)}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider shadow-lg transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
                      >
                        {syncingCardsToCatalog ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Publicando no Catálogo...</span>
                          </>
                        ) : (
                          <>
                            <Check size={14} />
                            <span>
                              Vincular &amp; Adicionar Todas no Catálogo ({prod.productCards.length})
                            </span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-200/80">
                    Escolha uma coleção existente na lista acima (ou digite uma nova) e clique em <strong>&quot;Vincular &amp; Adicionar Todas no Catálogo&quot;</strong>. Para cartas de <strong>TOKEN</strong>, todas podem usar o mesmo nome <strong>&quot;TOKEN&quot;</strong> com códigos diferentes (ex: <code>2026/0001/TOKEN01</code>, <code>2026/0001/TOKEN13</code>, <code>2026/0001/TOKEN14</code>) e aparecerão separadas no catálogo!
                  </p>
                </div>

                {/* Pick existing card from site catalog */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-purple-300">
                      Ou Puxar uma Carta que Já Está no Catálogo (com a arte atual dela):
                    </span>
                    <input
                      type="text"
                      value={catalogCardSearch}
                      onChange={(e) => setCatalogCardSearch(e.target.value)}
                      placeholder="Filtrar carta por nome ou código..."
                      className="w-full sm:w-64 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white outline-none"
                    />
                  </div>

                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const code = e.target.value;
                      if (!code) return;
                      const found = (cards || []).find((c) => c.code === code);
                      if (!found) return;
                      updateProductAt(i, (p) => {
                        const current = [...(p.productCards || [])];
                        const existingIdx = current.findIndex(
                          (item) => item.source === 'catalog' && item.cardCode === found.code
                        );
                        if (existingIdx >= 0) {
                          current[existingIdx] = {
                            ...current[existingIdx],
                            quantity: (current[existingIdx].quantity || 1) + 1
                          };
                        } else {
                          current.push({
                            id: `pcard_cat_${found.code}_${Date.now()}`,
                            source: 'catalog',
                            cardCode: found.code,
                            name: found.name,
                            imageUrl: found.catalogCoverImageUrl || found.imageUrl || '',
                            type: found.type || 'Herói',
                            rarity: found.rarity || 'Moderno Comum',
                            collection: found.collection || defaultProductCardsCollection || 'Natal Macroversal',
                            frame: found.frame || 'Moderno',
                            syncedToCatalog: true,
                            quantity: 1
                          });
                        }
                        return { ...p, productCards: current };
                      });
                      e.target.value = '';
                    }}
                    className="w-full bg-slate-900 border border-purple-500/40 rounded-lg p-2 text-xs text-white outline-none"
                  >
                    <option value="">
                      -- Selecione uma carta do catálogo do site para incluir a imagem individual --
                    </option>
                    {(cards || [])
                      .filter((c) => {
                        if (c.deleted || c.isHidden) return false;
                        if (!catalogCardSearch.trim()) return true;
                        const q = catalogCardSearch.toLowerCase();
                        return (
                          c.name.toLowerCase().includes(q) ||
                          c.code.toLowerCase().includes(q) ||
                          (c.collection || '').toLowerCase().includes(q)
                        );
                      })
                      .map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name} ({c.code}) — {c.collection || 'Oficial'}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Individual Product Cards Grid with Catalog Linker & Collection */}
                {Array.isArray(prod.productCards) && prod.productCards.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto pr-1">
                    {prod.productCards.map((pc, pcIdx) => {
                      const localSearch = (cardLinkSearchByIndex[pcIdx] || '').toLowerCase().trim();
                      const filteredCatalogOptions = (cards || []).filter((c) => {
                        if (c.deleted) return false;
                        if (pc.cardCode && c.code === pc.cardCode) return true;
                        if (!localSearch) return true;
                        return (
                          c.name.toLowerCase().includes(localSearch) ||
                          c.code.toLowerCase().includes(localSearch)
                        );
                      });
                      const allExistingCols = Array.from(
                        new Set(['Natal Macroversal', ...(collections || [])])
                      );
                      const currentCardCol =
                        pc.collection ?? defaultProductCardsCollection ?? 'Natal Macroversal';

                      return (
                        <div
                          key={pc.id || pcIdx}
                          className={`bg-slate-950 border rounded-xl p-3 flex items-start gap-3 transition ${
                            pc.syncedToCatalog
                              ? 'border-emerald-500/50'
                              : 'border-slate-800 hover:border-cyan-500/40'
                          }`}
                        >
                          {/* Full-frame TCG aspect ratio preview (no zoom cropping, no black bars) */}
                          <div className="w-20 aspect-[63/88] rounded-lg bg-slate-900 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center shadow-md">
                            {pc.imageUrl ? (
                              <img
                                src={pc.imageUrl}
                                alt={pc.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-fill"
                              />
                            ) : (
                              <ImageIcon size={18} className="text-slate-600" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                    pc.source === 'catalog' && pc.cardCode
                                      ? 'bg-purple-500/25 text-purple-300 border border-purple-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  }`}
                                >
                                  {pc.source === 'catalog' && pc.cardCode
                                    ? `Vinculada: ${pc.cardCode}`
                                    : pc.cardCode
                                    ? `Nova Carta (${pc.cardCode})`
                                    : 'Nova Carta Independente'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateProductAt(i, (p) => {
                                      const list = [...(p.productCards || [])];
                                      const nextCode =
                                        list[pcIdx].cardCode && /TOKEN\d+/i.test(list[pcIdx].cardCode!)
                                          ? list[pcIdx].cardCode
                                          : getNextTokenCode(pcIdx);
                                      list[pcIdx] = {
                                        ...list[pcIdx],
                                        source: 'custom_new',
                                        name: 'TOKEN',
                                        type: 'Token',
                                        cardCode: nextCode,
                                        syncedToCatalog: false
                                      };
                                      return { ...p, productCards: list };
                                    })
                                  }
                                  className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border border-cyan-500/40 cursor-pointer transition"
                                  title="Definir como TOKEN com nome 'TOKEN' e código 2026/0001/TOKENXX separado no catálogo"
                                >
                                  ⚡ Definir como TOKEN
                                </button>
                                {pc.syncedToCatalog && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/25 text-emerald-300 border border-emerald-500/40">
                                    ✓ No Catálogo
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  updateProductAt(i, (p) => ({
                                    ...p,
                                    productCards: (p.productCards || []).filter(
                                      (_, idx) => idx !== pcIdx
                                    )
                                  }))
                                }
                                className="text-red-400 hover:text-red-300 p-1"
                                title="Remover carta do produto"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            {/* Step 2A: Vincular à Carta do Catálogo */}
                            <div className="space-y-1 bg-slate-900/90 border border-slate-800 rounded-lg p-2">
                              <div className="flex items-center justify-between gap-2">
                                <label className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                                  Vincular à Carta do Catálogo:
                                </label>
                                <input
                                  type="text"
                                  value={cardLinkSearchByIndex[pcIdx] || ''}
                                  onChange={(e) =>
                                    setCardLinkSearchByIndex((prev) => ({
                                      ...prev,
                                      [pcIdx]: e.target.value
                                    }))
                                  }
                                  placeholder="Buscar carta..."
                                  className="w-28 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white outline-none"
                                />
                              </div>
                              <select
                                value={pc.source === 'catalog' ? pc.cardCode || '' : ''}
                                onChange={(e) => {
                                  const selectedCode = e.target.value;
                                  const matched = (cards || []).find((c) => c.code === selectedCode);
                                  updateProductAt(i, (p) => {
                                    const list = [...(p.productCards || [])];
                                    if (matched) {
                                      list[pcIdx] = {
                                        ...list[pcIdx],
                                        source: 'catalog',
                                        cardCode: matched.code,
                                        name: matched.name,
                                        type: matched.type || list[pcIdx].type,
                                        syncedToCatalog: false
                                      };
                                    } else {
                                      list[pcIdx] = {
                                        ...list[pcIdx],
                                        source: 'custom_new',
                                        syncedToCatalog: false
                                      };
                                    }
                                    return { ...p, productCards: list };
                                  });
                                }}
                                className="w-full bg-slate-950 border border-purple-500/40 rounded px-2 py-1 text-[11px] text-white outline-none"
                              >
                                <option value="">
                                  + Criar como Nova Carta / Novo TOKEN Separado no Catálogo
                                </option>
                                {filteredCatalogOptions.map((c) => (
                                  <option key={c.code} value={c.code}>
                                    {c.name} ({c.code})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Step 2B: Nome da Carta, Código (Ex: 2026/0001/TOKEN01) & Coleção */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                              <div>
                                <label className="text-[9px] font-bold uppercase text-slate-400 block mb-0.5">
                                  Nome da Carta:
                                </label>
                                <input
                                  type="text"
                                  value={pc.name || ''}
                                  onChange={(e) =>
                                    updateProductAt(i, (p) => {
                                      const list = [...(p.productCards || [])];
                                      list[pcIdx] = {
                                        ...list[pcIdx],
                                        name: e.target.value,
                                        syncedToCatalog: false
                                      };
                                      return { ...p, productCards: list };
                                    })
                                  }
                                  placeholder="Ex: TOKEN"
                                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-bold"
                                />
                              </div>

                              <div>
                                <label className="text-[9px] font-bold uppercase text-cyan-400 block mb-0.5">
                                  Código (Ex: 2026/0001/TOKEN01):
                                </label>
                                <input
                                  type="text"
                                  value={pc.cardCode || ''}
                                  onChange={(e) =>
                                    updateProductAt(i, (p) => {
                                      const list = [...(p.productCards || [])];
                                      list[pcIdx] = {
                                        ...list[pcIdx],
                                        cardCode: e.target.value,
                                        syncedToCatalog: false
                                      };
                                      return { ...p, productCards: list };
                                    })
                                  }
                                  placeholder="2026/0001/TOKEN01"
                                  className="w-full bg-slate-900 border border-cyan-500/40 rounded px-2 py-1 text-xs text-cyan-200 font-mono font-bold"
                                />
                              </div>

                              <div>
                                <label className="text-[9px] font-bold uppercase text-emerald-400 block mb-0.5">
                                  Coleção no Catálogo:
                                </label>
                                <select
                                  value={
                                    allExistingCols.includes(currentCardCol)
                                      ? currentCardCol
                                      : '__CUSTOM__'
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateProductAt(i, (p) => {
                                      const list = [...(p.productCards || [])];
                                      list[pcIdx] = {
                                        ...list[pcIdx],
                                        collection: val === '__CUSTOM__' ? '' : val,
                                        syncedToCatalog: false
                                      };
                                      return { ...p, productCards: list };
                                    });
                                  }}
                                  className="w-full bg-slate-900 border border-emerald-500/40 rounded px-2 py-1 text-xs text-emerald-200 font-bold outline-none"
                                >
                                  {allExistingCols.map((col) => (
                                    <option key={col} value={col}>
                                      {col}
                                    </option>
                                  ))}
                                  <option value="__CUSTOM__">+ Digitar Nova Coleção...</option>
                                </select>
                                {!allExistingCols.includes(currentCardCol) && (
                                  <input
                                    type="text"
                                    value={currentCardCol}
                                    onChange={(e) =>
                                      updateProductAt(i, (p) => {
                                        const list = [...(p.productCards || [])];
                                        list[pcIdx] = {
                                          ...list[pcIdx],
                                          collection: e.target.value,
                                          syncedToCatalog: false
                                        };
                                        return { ...p, productCards: list };
                                      })
                                    }
                                    placeholder="Digite a nova coleção..."
                                    className="w-full mt-1 bg-slate-900 border border-emerald-500/40 rounded px-2 py-1 text-xs text-emerald-200 font-bold"
                                  />
                                )}
                              </div>
                            </div>

                            {/* URL, Quantidade & Botão Individual de Publicar */}
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={pc.imageUrl || ''}
                                onChange={(e) =>
                                  updateProductAt(i, (p) => {
                                    const list = [...(p.productCards || [])];
                                    list[pcIdx] = {
                                      ...list[pcIdx],
                                      imageUrl: e.target.value,
                                      syncedToCatalog: false
                                    };
                                    return { ...p, productCards: list };
                                  })
                                }
                                placeholder="URL da imagem..."
                                className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300"
                              />
                              <input
                                type="number"
                                min={1}
                                max={99}
                                value={pc.quantity || 1}
                                onChange={(e) =>
                                  updateProductAt(i, (p) => {
                                    const list = [...(p.productCards || [])];
                                    list[pcIdx] = {
                                      ...list[pcIdx],
                                      quantity: Math.max(1, Number(e.target.value) || 1)
                                    };
                                    return { ...p, productCards: list };
                                  })
                                }
                                title="Quantidade desta carta no produto"
                                className="w-12 bg-slate-900 border border-slate-800 rounded px-1.5 py-1 text-xs text-emerald-300 font-mono font-bold text-center"
                              />
                              <button
                                type="button"
                                disabled={syncingCardsToCatalog || !pc.imageUrl}
                                onClick={() => handleSyncProductCardsToCatalog(i, pcIdx)}
                                className="px-2.5 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-emerald-200 text-[10px] font-black uppercase tracking-wider transition cursor-pointer shrink-0"
                                title="Publicar esta carta e coleção imediatamente no Catálogo"
                              >
                                {pc.syncedToCatalog ? 'Atualizar' : 'Publicar'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Deck Code & Booster Collection Loader */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-purple-300">
                      Código do Criador de Deck ou Coleção Inteira de Booster:
                    </span>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const colName = e.target.value;
                        if (!colName) return;
                        const colCards = (cards || []).filter(
                          (c) =>
                            !c.deleted &&
                            !c.isHidden &&
                            (c.collection || '').trim() === colName
                        );
                        const uniqueMap = new Map<string, CardData>();
                        colCards.forEach((c) => {
                          const k = c.code || c.id || c.name;
                          if (!uniqueMap.has(k)) uniqueMap.set(k, c);
                        });
                        const uniqueList = Array.from(uniqueMap.values());
                        if (uniqueList.length === 0) return;
                        const encoded = encodeDeckCode(uniqueList, []);
                        updateProductAt(i, (p) => ({
                          ...p,
                          cardCodes: encoded,
                          title:
                            p.title ||
                            `Coleção Completa Booster: ${colName} (${uniqueList.length} Cartas)`
                        }));
                        e.target.value = '';
                      }}
                      className="bg-slate-900 border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-bold outline-none"
                    >
                      <option value="">-- Carregar Coleção de Booster Inteira --</option>
                      {Array.from(
                        new Set(
                          (cards || [])
                            .filter((c) => !c.deleted && !c.isHidden && c.collection)
                            .map((c) => (c.collection || '').trim())
                            .filter(Boolean)
                        )
                      ).map((colName) => (
                        <option key={colName} value={colName}>
                          Carregar coleção: {colName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    value={prod.cardCodes || ''}
                    onChange={(e) =>
                      updateProductAt(i, (p) => ({ ...p, cardCodes: e.target.value }))
                    }
                    placeholder="Cole o código exportado no Criador de Deck..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white font-mono h-20 resize-y outline-none"
                  />

                  {prod.cardCodes && prod.cardCodes.trim() && (
                    <div className="text-xs text-emerald-400 font-bold">
                      {deckPreview.isValid
                        ? `✓ Deck identificado: ${deckPreview.totalCount} cartas (${deckPreview.mainDeck.length + deckPreview.sideDeck.length} tipos únicos)`
                        : '⚠️ Código de deck não identificado.'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN IN FULL EDITOR: STOCK, ORIGIN ADDRESS (SUPPLIER) & MEDIA */}
          <div className={editorTab === 'all_columns' ? 'xl:col-span-5 space-y-6' : 'space-y-6'}>
            {/* SECTION 2: ESTOQUE, PESO & ENDEREÇO DE ORIGEM / FORNECEDOR TERCEIRO */}
            {(editorTab === 'all_columns' || editorTab === 'stock_origin') && (
              <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-5 space-y-5 shadow-lg">
                <div className="border-b border-slate-800 pb-3">
                  <h4 className="text-sm font-black uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                    <Truck size={16} className="text-emerald-400" />
                    <span>2. Controle de Estoque, Frete & Endereço de Origem</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Gerencie a quantidade disponível e escolha se o produto sai do seu endereço padrão ou do endereço de um fornecedor terceiro.
                  </p>
                </div>

                {/* Stock, Weight & Free Shipping Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/90 border border-slate-800 rounded-xl p-4">
                  <div>
                    <label className="text-xs font-bold text-emerald-300 block mb-1.5">
                      Quantidade em Estoque Geral
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateProductAt(i, (p) => ({
                            ...p,
                            stock: Math.max(0, (p.stock ?? 1) - 1)
                          }))
                        }
                        className="w-9 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-black text-base flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={prod.stock !== undefined ? prod.stock : ''}
                        onChange={(e) =>
                          updateProductAt(i, (p) => ({
                            ...p,
                            stock:
                              e.target.value === '' ? undefined : Number(e.target.value)
                          }))
                        }
                        placeholder="Ilimitado"
                        className="flex-1 bg-slate-900 border border-emerald-500/50 rounded-lg p-2 text-center text-sm text-white font-mono font-black outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateProductAt(i, (p) => ({
                            ...p,
                            stock: (p.stock ?? 0) + 1
                          }))
                        }
                        className="w-9 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-black text-base flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-slate-400">
                        {prod.stock === undefined
                          ? 'Estoque livre / ilimitado'
                          : prod.stock === 0
                          ? '⚠️ Produto Esgotado'
                          : `${prod.stock} un. disponíveis`}
                      </span>
                      {prod.stock !== undefined && (
                        <button
                          type="button"
                          onClick={() =>
                            updateProductAt(i, (p) => ({ ...p, stock: undefined }))
                          }
                          className="text-[10px] text-purple-400 hover:underline"
                        >
                          Deixar ilimitado
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">
                        Peso para Cálculo de Frete (gramas)
                      </label>
                      <input
                        type="number"
                        min={50}
                        step={50}
                        value={prod.weightGrams || 250}
                        onChange={(e) =>
                          updateProductAt(i, (p) => ({
                            ...p,
                            weightGrams: Number(e.target.value) || 250
                          }))
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs font-bold text-emerald-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(prod.freeShipping)}
                        onChange={(e) =>
                          updateProductAt(i, (p) => ({
                            ...p,
                            freeShipping: e.target.checked
                          }))
                        }
                        className="accent-emerald-500 w-4 h-4"
                      />
                      <span>Frete Grátis neste Produto</span>
                    </label>
                  </div>
                </div>

                {/* ENDEREÇO DE ORIGEM DO PRODUTO / FORNECEDOR TERCEIRO */}
                <div className="bg-slate-950 border border-cyan-500/40 rounded-xl p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black text-cyan-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <MapPin size={15} className="text-cyan-400" />
                      <span>Endereço de Origem deste Produto (Loja ou Fornecedor Terceiro)</span>
                    </div>
                  </div>

                  {/* Mode Selector: Store Default vs Third-Party Supplier */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateProductAt(i, (p) => ({
                          ...p,
                          originAddressMode: 'store_default'
                        }))
                      }
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        prod.originAddressMode !== 'custom_supplier'
                          ? 'bg-cyan-600/25 border-cyan-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-bold">Endereço Padrão da Loja</div>
                      <div className="text-[10px] text-slate-300 font-mono mt-0.5">
                        {storeSettings.originName || 'Loja Oficial'} ({storeSettings.originCity || 'SP'}/{storeSettings.originState || 'SP'} · {storeSettings.originCep})
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateProductAt(i, (p) => ({
                          ...p,
                          originAddressMode: 'custom_supplier'
                        }))
                      }
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        prod.originAddressMode === 'custom_supplier'
                          ? 'bg-purple-600/25 border-purple-400 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-bold text-purple-200">
                        Fornecedor Terceiro (Outro Endereço)
                      </div>
                      <div className="text-[10px] text-slate-300 mt-0.5">
                        O produto sai direto do endereço do fornecedor
                      </div>
                    </button>
                  </div>

                  {prod.originAddressMode === 'custom_supplier' && (
                    <div className="bg-slate-900/90 border border-purple-500/40 rounded-xl p-3.5 space-y-3">
                      {/* Quick Select from Saved Suppliers */}
                      {(storeSettings.supplierOrigins || []).length > 0 && (
                        <div>
                          <label className="text-[11px] font-bold text-purple-300 block mb-1">
                            Escolher Fornecedor Terceiro Salvo nas Configurações de Frete:
                          </label>
                          <select
                            value={prod.supplierOriginId || ''}
                            onChange={(e) => {
                              const supId = e.target.value;
                              const found = (storeSettings.supplierOrigins || []).find(
                                (s) => s.id === supId
                              );
                              if (found) {
                                updateProductAt(i, (p) => ({
                                  ...p,
                                  originAddressMode: 'custom_supplier',
                                  supplierOriginId: found.id,
                                  customOriginName: found.name,
                                  customOriginCep: found.cep,
                                  customOriginStreet: found.street,
                                  customOriginNumber: found.number,
                                  customOriginComplement: found.complement || '',
                                  customOriginNeighborhood: found.neighborhood,
                                  customOriginCity: found.city,
                                  customOriginState: found.state
                                }));
                              }
                            }}
                            className="w-full bg-slate-950 border border-purple-500/50 rounded-lg p-2 text-xs text-white font-bold outline-none"
                          >
                            <option value="">
                              -- Selecionar fornecedor salvo ou preencher abaixo --
                            </option>
                            {(storeSettings.supplierOrigins || []).map((sup) => (
                              <option key={sup.id} value={sup.id}>
                                {sup.name} — {sup.city}/{sup.state} (CEP: {sup.cep})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-7">
                          <label className="text-[11px] text-slate-300 font-bold block mb-1">
                            Nome do Fornecedor Terceiro / Remetente
                          </label>
                          <input
                            type="text"
                            value={prod.customOriginName || ''}
                            onChange={(e) =>
                              updateProductAt(i, (p) => ({
                                ...p,
                                customOriginName: e.target.value
                              }))
                            }
                            placeholder="Ex: Fornecedor Playmats Sul"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-bold"
                          />
                        </div>

                        <div className="sm:col-span-5">
                          <label className="text-[11px] text-cyan-300 font-bold block mb-1">
                            CEP de Origem do Fornecedor {customCepLoading ? '(Buscando...)' : ''}
                          </label>
                          <input
                            type="text"
                            maxLength={9}
                            value={prod.customOriginCep || ''}
                            onChange={(e) => handleCustomOriginCepLookup(i, e.target.value)}
                            placeholder="00000-000"
                            className="w-full bg-slate-950 border border-cyan-500/60 rounded-lg p-2 text-xs text-cyan-300 font-mono font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-6">
                          <label className="text-[11px] text-slate-400 block mb-1">
                            Rua / Logradouro
                          </label>
                          <input
                            type="text"
                            value={prod.customOriginStreet || ''}
                            onChange={(e) =>
                              updateProductAt(i, (p) => ({
                                ...p,
                                customOriginStreet: e.target.value
                              }))
                            }
                            placeholder="Rua, Avenida..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[11px] text-slate-400 block mb-1">
                            Número
                          </label>
                          <input
                            type="text"
                            value={prod.customOriginNumber || ''}
                            onChange={(e) =>
                              updateProductAt(i, (p) => ({
                                ...p,
                                customOriginNumber: e.target.value
                              }))
                            }
                            placeholder="Nº"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="text-[11px] text-slate-400 block mb-1">
                            Bairro
                          </label>
                          <input
                            type="text"
                            value={prod.customOriginNeighborhood || ''}
                            onChange={(e) =>
                              updateProductAt(i, (p) => ({
                                ...p,
                                customOriginNeighborhood: e.target.value
                              }))
                            }
                            placeholder="Bairro"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-5">
                          <label className="text-[11px] text-slate-400 block mb-1">
                            Cidade do Fornecedor
                          </label>
                          <input
                            type="text"
                            value={prod.customOriginCity || ''}
                            onChange={(e) =>
                              updateProductAt(i, (p) => ({
                                ...p,
                                customOriginCity: e.target.value
                              }))
                            }
                            placeholder="Cidade"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[11px] text-slate-400 block mb-1">
                            UF
                          </label>
                          <input
                            type="text"
                            maxLength={2}
                            value={prod.customOriginState || ''}
                            onChange={(e) =>
                              updateProductAt(i, (p) => ({
                                ...p,
                                customOriginState: e.target.value.toUpperCase()
                              }))
                            }
                            placeholder="UF"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono uppercase text-center"
                          />
                        </div>
                        <div className="sm:col-span-5">
                          <button
                            type="button"
                            onClick={() => handleSaveCurrentCustomOriginToGlobalSuppliers(prod)}
                            disabled={
                              !prod.customOriginName?.trim() ||
                              (prod.customOriginCep || '').replace(/\D/g, '').length !== 8
                            }
                            className="w-full py-2 px-2.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 disabled:opacity-40 border border-purple-500/50 text-purple-200 text-[11px] font-bold transition cursor-pointer"
                          >
                            + Salvar na Lista de Fornecedores
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 4: FOTOS & VÍDEOS DO PRODUTO */}
            {(editorTab === 'all_columns' || editorTab === 'media') && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
                      <Film size={16} />
                      <span>4. Foto do Produto & Galeria de Mídias</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Suba a foto principal e imagens/vídeos adicionais do produto.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow">
                      {uploadingMediaKey === `batch-${i}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      <span>
                        {uploadingMediaKey === `batch-${i}` && batchUploadProgress
                          ? `Subindo ${batchUploadProgress.current}/${batchUploadProgress.total}...`
                          : '+ Subir Várias Fotos e Organizar'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleBatchUploadToOrganizer(i, e.target.files, 'product_gallery');
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>

                    <label className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow">
                      {uploadingMediaKey?.startsWith(`media-${i}-`) ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      <span>Subir 1 Foto/Vídeo</span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleUploadMainMedia(i, e.target.files[0]);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        updateProductAt(i, (p) => {
                          const list = [...currentMediaList, { type: 'image' as const, url: '' }];
                          return {
                            ...p,
                            mediaList: list,
                            mediaUrl: p.mediaUrl || ''
                          };
                        })
                      }
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                    >
                      + URL
                    </button>
                  </div>
                </div>

                {currentMediaList.length > 1 && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      {currentMediaList.length} fotos na galeria deste produto. Você também pode transformá-las em variações:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateProductAt(i, (p) => {
                          const vars = [...(p.priceVariations || [])];
                          const basePrice = p.price || 'R$ 89,90';
                          currentMediaList.forEach((m, mIdx) => {
                            if (m.type !== 'video' && m.url) {
                              vars.push({
                                id: `var_${Date.now()}_${mIdx}`,
                                name: `Versão #${vars.length + 1}`,
                                price: basePrice,
                                imageUrl: m.url,
                                badge: '',
                                description: '',
                                isDefault: vars.length === 0,
                                stock: p.stock
                              });
                            }
                          });
                          return {
                            ...p,
                            priceVariations: vars
                          };
                        })
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-amber-300 text-[11px] font-bold cursor-pointer transition"
                    >
                      ⇄ Transformar Todas as Fotos da Galeria em Variações
                    </button>
                  </div>
                )}

                {currentMediaList.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-800 rounded-xl p-8 text-center space-y-3 bg-slate-950/60">
                    <ImageIcon size={32} className="mx-auto text-slate-600" />
                    <p className="text-xs text-slate-400">
                      Nenhuma foto adicionada a este produto ainda. Use "+ Subir Várias Fotos e Organizar" para enviar várias fotos de uma só vez.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {currentMediaList.map((m, mIdx) => (
                      <div
                        key={mIdx}
                        className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-16 h-14 rounded-lg overflow-hidden bg-black border border-slate-700 shrink-0 flex items-center justify-center relative">
                            {m.type === 'video' ? (
                              <Film size={18} className="text-purple-400" />
                            ) : m.url ? (
                              <img
                                src={m.url}
                                alt=""
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <ImageIcon size={18} className="text-slate-600" />
                            )}
                            {mIdx === 0 && (
                              <span className="absolute bottom-0 inset-x-0 bg-purple-600/90 text-white text-[9px] font-black text-center uppercase">
                                Capa
                              </span>
                            )}
                          </div>

                          <select
                            value={m.type || 'image'}
                            onChange={(e) =>
                              updateProductAt(i, (p) => {
                                const list = [...currentMediaList];
                                list[mIdx] = {
                                  ...list[mIdx],
                                  type: e.target.value as 'image' | 'video'
                                };
                                return {
                                  ...p,
                                  mediaList: list,
                                  ...(mIdx === 0 ? { mediaType: list[0].type } : {})
                                };
                              })
                            }
                            className="bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                          >
                            <option value="image">Foto</option>
                            <option value="video">Vídeo</option>
                          </select>

                          <input
                            type="text"
                            value={m.url || ''}
                            onChange={(e) =>
                              updateProductAt(i, (p) => {
                                const list = [...currentMediaList];
                                list[mIdx] = { ...list[mIdx], url: e.target.value };
                                return {
                                  ...p,
                                  mediaList: list,
                                  ...(mIdx === 0 ? { mediaUrl: list[0].url } : {})
                                };
                              })
                            }
                            placeholder="URL da foto ou vídeo..."
                            className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              updateProductAt(i, (p) => {
                                const list = currentMediaList.filter((_, idx) => idx !== mIdx);
                                return {
                                  ...p,
                                  mediaList: list,
                                  mediaUrl: list[0]?.url || '',
                                  mediaType: list[0]?.type || 'image'
                                };
                              })
                            }
                            className="text-red-400 hover:text-red-300 p-1.5 cursor-pointer"
                            title="Remover foto da galeria"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {/* Quick Actions to Organize this Gallery Photo */}
                        {m.url && m.type !== 'video' && (
                          <div className="flex flex-wrap items-center gap-1.5 pl-1">
                            {mIdx > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateProductAt(i, (p) => {
                                    const list = [...currentMediaList];
                                    const [picked] = list.splice(mIdx, 1);
                                    list.unshift(picked);
                                    return {
                                      ...p,
                                      mediaList: list,
                                      mediaUrl: list[0]?.url || '',
                                      mediaType: list[0]?.type || 'image'
                                    };
                                  })
                                }
                                className="px-2 py-1 rounded bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/40 text-purple-200 text-[10px] font-bold cursor-pointer transition"
                              >
                                ★ Definir como Foto Principal (Capa)
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleConvertGalleryPhotoToVariation(i, mIdx, false)}
                              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 text-amber-200 text-[10px] font-bold cursor-pointer transition"
                              title="Cria uma Variação usando esta foto e mantém na galeria"
                            >
                              + Criar Variação com esta Foto
                            </button>
                            {currentMediaList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleConvertGalleryPhotoToVariation(i, mIdx, true)}
                                className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-500/40 text-cyan-200 text-[10px] font-bold cursor-pointer transition"
                                title="Move esta foto da galeria do produto para ser exclusivamente uma Variação"
                              >
                                ⇄ Mover da Galeria p/ Variação
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: DASHBOARD OVERVIEW & QUICK STOCK / VISIBILITY MANAGER (VIEW A)
  // ============================================================================
  return (
    <div className="space-y-6">
      {/* TOP ACTION BAR (Always at the top, never at the bottom!) */}
      <div className="bg-slate-900 border border-purple-500/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2.5">
              <Box size={22} className="text-purple-400" />
              <span>Central de Produtos, Controle de Estoque & Fornecedores</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Adicione novos produtos no topo, controle o estoque em tempo real, oculte produtos em rascunho ou abra a página dedicada de edição.
            </p>
          </div>

          {/* Primary Top Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleCreateNewProduct(false)}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-purple-950/50 cursor-pointer"
            >
              <Plus size={16} />
              <span>+ Adicionar Novo Produto</span>
            </button>

            <button
              type="button"
              onClick={() => handleCreateNewProduct(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
              title="Cria o produto já marcado como Oculto (Não à vista na loja) para você editar com calma e ativar quando quiser"
            >
              <EyeOff size={15} className="text-amber-400" />
              <span>+ Adicionar Produto Oculto (Não deixar à vista)</span>
            </button>

            {onOpenShippingSettings && (
              <button
                type="button"
                onClick={onOpenShippingSettings}
                className="px-3.5 py-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <MapPin size={15} className="text-cyan-400" />
                <span>Endereços de Origem & Frete</span>
              </button>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveAndNotify()}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
            >
              <Save size={15} />
              <span>{saving ? 'Salvando...' : 'Salvar Tudo'}</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-800/80">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <div className="text-[11px] text-slate-400">Total Cadastrados</div>
            <div className="text-xl font-black font-mono text-white mt-0.5">{stats.total}</div>
          </div>

          <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3">
            <div className="text-[11px] text-emerald-300 flex items-center gap-1">
              <Eye size={12} />
              <span>À Vista na Loja</span>
            </div>
            <div className="text-xl font-black font-mono text-emerald-400 mt-0.5">
              {stats.visible}
            </div>
          </div>

          <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-3">
            <div className="text-[11px] text-amber-300 flex items-center gap-1">
              <EyeOff size={12} />
              <span>Ocultos (Não à vista)</span>
            </div>
            <div className="text-xl font-black font-mono text-amber-300 mt-0.5">
              {stats.hidden}
            </div>
          </div>

          <div className="bg-slate-950/80 border border-rose-500/30 rounded-xl p-3">
            <div className="text-[11px] text-rose-300">Esgotados / Estoque Baixo</div>
            <div className="text-xl font-black font-mono text-rose-400 mt-0.5">
              {stats.outOfStock} esgot. / {stats.lowStock} baixo
            </div>
          </div>

          <div className="bg-slate-950/80 border border-cyan-500/30 rounded-xl p-3">
            <div className="text-[11px] text-cyan-300">Com Fornecedor Terceiro</div>
            <div className="text-xl font-black font-mono text-cyan-300 mt-0.5">
              {stats.customSupplier}
            </div>
          </div>
        </div>
      </div>

      {savedBannerMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center justify-between">
          <span>{savedBannerMsg}</span>
          <button type="button" onClick={() => setSavedBannerMsg(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: `Todos (${stats.total})` },
            { id: 'visible', label: `À Vista na Loja (${stats.visible})` },
            { id: 'hidden', label: `Ocultos / Não à vista (${stats.hidden})` },
            { id: 'in_stock', label: 'Em Estoque' },
            { id: 'out_of_stock', label: `Estoque Baixo / Esgotado (${stats.outOfStock + stats.lowStock})` },
            { id: 'pre_order', label: 'Pré-Venda' },
            { id: 'custom_supplier', label: `Fornecedor Terceiro (${stats.customSupplier})` }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id as ProductFilterMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterMode === tab.id
                  ? 'bg-purple-600 text-white shadow'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-72">
            <Search
              size={14}
              className="text-slate-500 absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produto, categoria, fornecedor..."
              className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleInsertHalloweenTemplate}
            className="px-3 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition shrink-0 hidden xl:flex items-center gap-1.5 cursor-pointer"
            title="Inserir modelo de produto pronto com 2 versões"
          >
            <Sparkles size={13} />
            <span>+ Modelo Pronto</span>
          </button>
        </div>
      </div>

      {/* PRODUCTS GRID / LIST WITH DIRECT STOCK & VISIBILITY CONTROLS */}
      {filteredProducts.length === 0 ? (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <Package size={40} className="mx-auto text-slate-600" />
          <div className="space-y-1">
            <h4 className="text-base font-bold text-white">
              Nenhum produto encontrado neste filtro
            </h4>
            <p className="text-xs text-slate-400">
              Use os botões no topo para adicionar um novo produto visível ou oculto.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => handleCreateNewProduct(false)}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer"
            >
              + Adicionar Novo Produto
            </button>
            <button
              type="button"
              onClick={() => handleCreateNewProduct(true)}
              className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold transition cursor-pointer"
            >
              + Adicionar Produto Oculto
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredProducts.map(({ prod, idx }) => {
            const isVisible = isProductVisibleInStore(prod);
            const isHidden = !isVisible;
            const thumb = getProductPrimaryImage(prod);
            const variations = Array.isArray(prod.priceVariations)
              ? prod.priceVariations.filter((v) => v && (v.name || v.price))
              : [];
            const cardsCount = Array.isArray(prod.productCards)
              ? prod.productCards.reduce((acc, c) => acc + (c.quantity || 1), 0)
              : 0;

            return (
              <div
                key={prod.id || idx}
                className={`rounded-2xl border p-4 sm:p-5 transition shadow-lg flex flex-col xl:flex-row xl:items-center justify-between gap-4 ${
                  isHidden
                    ? 'bg-slate-900/60 border-amber-500/40'
                    : 'bg-slate-900 border-slate-700/80 hover:border-purple-500/50'
                }`}
              >
                {/* Left: Thumbnail & Core Product Info */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-black border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center relative">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={prod.title}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon size={24} className="text-slate-600" />
                    )}
                    <span className="absolute top-1 left-1 bg-black/80 text-[10px] font-mono font-bold text-purple-300 px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {isHidden ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <EyeOff size={11} />
                          <span>Oculto (Não à vista)</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <Eye size={11} />
                          <span>À Vista na Loja</span>
                        </span>
                      )}

                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-950/80 border border-purple-700/50 text-purple-200">
                        {prod.category || prod.storeCategory || 'Decks'}
                      </span>

                      {prod.isPreOrder && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-950/80 border border-amber-700/50 text-amber-300">
                          Pré-Venda
                        </span>
                      )}

                      {prod.originAddressMode === 'custom_supplier' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-950/80 border border-cyan-600/50 text-cyan-300 flex items-center gap-1">
                          <MapPin size={10} />
                          <span>
                            Fornecedor: {prod.customOriginName || 'Terceiro'} (
                            {prod.customOriginCity || prod.customOriginCep || 'CEP próprio'})
                          </span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-400 bg-slate-950 border border-slate-800">
                          Origem Padrão ({storeSettings.originCity || 'SP'}/{storeSettings.originState || 'SP'})
                        </span>
                      )}
                    </div>

                    <h4 className="text-base sm:text-lg font-black text-white truncate">
                      {prod.title || '(Produto Sem Título)'}
                    </h4>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                      <span>
                        Preço Base:{' '}
                        <strong className="text-emerald-400 font-mono">
                          {prod.price || variations[0]?.price || 'R$ 89,90'}
                        </strong>
                      </span>

                      {variations.length > 0 && (
                        <span className="text-amber-300 font-semibold">
                          • {variations.length}{' '}
                          {variations.length === 1 ? 'versão' : 'versões'}:{' '}
                          <span className="text-slate-300 font-normal">
                            {variations
                              .map((v) => `${v.name || 'Versão'} (${v.price || prod.price})`)
                              .join(', ')}
                          </span>
                        </span>
                      )}

                      {cardsCount > 0 && (
                        <span className="text-cyan-300 font-semibold">
                          • {cardsCount} carta(s) individual(is)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle: Direct Stock & Visibility Controls (Zero modal needed!) */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-slate-950/90 border border-slate-800 rounded-xl p-3 shrink-0">
                  {/* Direct Stock Control */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Controle de Estoque
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateProductAt(idx, (p) => ({
                            ...p,
                            stock: Math.max(0, (p.stock ?? 1) - 1)
                          }))
                        }
                        className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={prod.stock !== undefined ? prod.stock : ''}
                        onChange={(e) =>
                          updateProductAt(idx, (p) => ({
                            ...p,
                            stock:
                              e.target.value === '' ? undefined : Number(e.target.value)
                          }))
                        }
                        placeholder="Livre"
                        className="w-16 bg-slate-900 border border-slate-700 rounded-lg py-1 px-1.5 text-center text-xs text-emerald-300 font-mono font-bold outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateProductAt(idx, (p) => ({
                            ...p,
                            stock: (p.stock ?? 0) + 1
                          }))
                        }
                        className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-slate-800 hidden sm:block" />

                  {/* Checkbox: Não deixar à vista / Desmarcar para exibir */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition flex items-center gap-2 select-none ${
                        isHidden
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                      title="Marque para não deixar este produto à vista na loja. Desmarque quando quiser exibi-lo."
                    >
                      <input
                        type="checkbox"
                        checked={isHidden}
                        onChange={(e) => handleToggleVisibility(idx, e.target.checked)}
                        className="w-3.5 h-3.5 accent-amber-500 rounded"
                      />
                      <span>Não deixar à vista</span>
                    </label>

                    <label
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition flex items-center gap-2 select-none ${
                        prod.showInHomeCarousel !== false
                          ? 'bg-purple-500/20 border-purple-500/60 text-purple-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                      title="Ativar ou desativar destaque deste produto no Carrossel da Página Inicial"
                    >
                      <input
                        type="checkbox"
                        checked={prod.showInHomeCarousel !== false}
                        onChange={(e) => handleToggleCarouselHighlight(idx, e.target.checked)}
                        className="w-3.5 h-3.5 accent-purple-500 rounded"
                      />
                      <span>Destaque no Carrossel</span>
                    </label>
                  </div>
                </div>

                {/* Right: Open Dedicated Editor Page, Reorder, Clone, Delete */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingIndex(idx);
                      setEditorTab('all_columns');
                      setViewMode('editor');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black transition flex items-center gap-1.5 shadow-md shadow-purple-950/50 cursor-pointer"
                  >
                    <Edit2 size={14} />
                    <span>Abrir Página de Edição</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveProduct(idx, 'up')}
                      className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 disabled:opacity-30 border border-slate-800 text-slate-300 transition cursor-pointer"
                      title="Subir posição na vitrine"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === products.length - 1}
                      onClick={() => handleMoveProduct(idx, 'down')}
                      className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 disabled:opacity-30 border border-slate-800 text-slate-300 transition cursor-pointer"
                      title="Descer posição na vitrine"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateProduct(idx)}
                      className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-purple-300 transition cursor-pointer"
                      title="Duplicar produto (cria cópia oculta)"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(idx)}
                      className="p-2 rounded-lg bg-slate-950 hover:bg-red-950/60 border border-slate-800 text-red-400 transition cursor-pointer"
                      title="Excluir produto"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
