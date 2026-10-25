import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ShoppingCart,
  Package,
  Truck,
  QrCode,
  CreditCard,
  Check,
  Copy,
  Plus,
  Minus,
  Trash2,
  Sparkles,
  Calendar,
  ExternalLink,
  Search,
  RefreshCw,
  ShieldCheck,
  MapPin,
  Tag,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  Settings,
  Layers,
  Flame,
  Percent,
  Box,
  SlidersHorizontal,
  User as UserIcon,
  ChevronRight
} from 'lucide-react';
import {
  CartItem,
  ExclusiveProduct,
  ShippingOption,
  StoreOrder,
  StoreProductCategory,
  StoreSettings
} from '../types';
import {
  addToCart,
  calculateShippingOptions,
  clearCart,
  createStoreOrder,
  DEFAULT_STORE_SETTINGS,
  fetchStoreSettings,
  formatBRL,
  formatCep,
  formatCpf,
  formatPhone,
  generateCheckoutPreferenceForOrder,
  generateOrderId,
  generatePixForOrder,
  getCartItems,
  getStoreOrderById,
  isValidCpf,
  lookupCepAddress,
  parseBRLPrice,
  syncOrderPaymentStatus,
  updateCartItemQuantity
} from '../storeService';

export type StoreCategoryFilter = 'all' | StoreProductCategory;

export const STORE_CATEGORIES: {
  id: StoreCategoryFilter;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    id: 'all',
    label: 'Todos os Produtos',
    shortLabel: 'Todos',
    description: 'Catálogo completo de produtos físicos oficiais Light Dark TCG'
  },
  {
    id: 'decks',
    label: 'Decks',
    shortLabel: 'Decks',
    description: 'Decks estruturais e temáticos prontos para jogar'
  },
  {
    id: 'cartas_avulsas',
    label: 'Cartas Avulsas',
    shortLabel: 'Cartas Avulsas',
    description: 'Singles, cartas promocionais, foils e tiragens especiais'
  },
  {
    id: 'playmats',
    label: 'Playmats',
    shortLabel: 'Playmats',
    description: 'Tapetes de duelo oficiais com zonas demarcadas e arte exclusiva'
  },
  {
    id: 'promocoes',
    label: 'Promoções',
    shortLabel: 'Promoções',
    description: 'Ofertas com descontos especiais por tempo limitado'
  },
  {
    id: 'pre_venda',
    label: 'Pré-venda',
    shortLabel: 'Pré-venda',
    description: 'Lotes antecipados com reserva garantida e bônus exclusivos'
  },
  {
    id: 'kits',
    label: 'Kits',
    shortLabel: 'Kits',
    description: 'Combos de duelista, booster boxes, sleeves e kits completos'
  }
];

export function matchesStoreCategory(prod: ExclusiveProduct, filter: StoreCategoryFilter): boolean {
  if (filter === 'all') return true;

  const explicit = (prod.storeCategory || '').toLowerCase().trim();
  const catText = `${prod.category || ''} ${prod.title || ''} ${prod.badge || ''} ${prod.description || ''}`.toLowerCase();

  const isPreOrderProduct = Boolean(
    prod.isPreOrder ||
      explicit === 'pre_venda' ||
      catText.includes('pré-venda') ||
      catText.includes('pre-venda') ||
      catText.includes('pré venda')
  );

  const rawPrice = parseBRLPrice(prod.price || '0');
  const rawOriginal = parseBRLPrice(prod.originalPrice || '0');
  const isPromoProduct = Boolean(
    prod.isPromotion ||
      explicit === 'promocoes' ||
      (rawOriginal > 0 && rawOriginal > rawPrice) ||
      catText.includes('promoção') ||
      catText.includes('promocao') ||
      catText.includes('oferta') ||
      catText.includes('desconto')
  );

  if (filter === 'pre_venda') return isPreOrderProduct;
  if (filter === 'promocoes') return isPromoProduct;

  if (explicit) {
    return explicit === filter;
  }

  // Fallback inteligente para produtos antigos sem storeCategory salvo
  switch (filter) {
    case 'decks':
      return catText.includes('deck') || Boolean(prod.cardCodes && prod.cardCodes.trim().length > 0);
    case 'cartas_avulsas':
      return (
        catText.includes('carta avulsa') ||
        catText.includes('cartas avulsas') ||
        catText.includes('single') ||
        catText.includes('avulsa')
      );
    case 'playmats':
      return catText.includes('playmat') || catText.includes('tapete') || catText.includes('campo');
    case 'kits':
      return (
        catText.includes('kit') ||
        catText.includes('combo') ||
        catText.includes('box') ||
        catText.includes('booster')
      );
    default:
      return false;
  }
}

export function getProductCategoryLabel(prod: ExclusiveProduct): string {
  const found = STORE_CATEGORIES.find((c) => c.id === prod.storeCategory);
  if (found && found.id !== 'all') return found.label;
  if (prod.category && prod.category.trim()) return prod.category;
  if (matchesStoreCategory(prod, 'playmats')) return 'Playmats';
  if (matchesStoreCategory(prod, 'kits')) return 'Kits';
  if (matchesStoreCategory(prod, 'cartas_avulsas')) return 'Cartas Avulsas';
  return 'Decks';
}

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ExclusiveProduct[];
  initialTab?: 'vitrine' | 'carrinho';
  initialOrderId?: string | null;
  user?: any;
  isAdmin?: boolean;
  onOpenProductDetail?: (product: ExclusiveProduct, variationIndex?: number) => void;
  onOpenAdminStore?: () => void;
  onOpenAuth?: () => void;
  onOpenUserOrders?: () => void;
}

export const StoreModal: React.FC<StoreModalProps> = ({
  isOpen,
  onClose,
  products,
  initialTab = 'vitrine',
  initialOrderId,
  user,
  isAdmin,
  onOpenProductDetail,
  onOpenAdminStore,
  onOpenAuth,
  onOpenUserOrders
}) => {
  // Store Filter & Search States
  const [selectedCategory, setSelectedCategory] = useState<StoreCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name-asc'>('featured');
  const [onlyFreeShipping, setOnlyFreeShipping] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);

  // Cart Drawer & Checkout Flow States
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [cartStep, setCartStep] = useState<'cart' | 'checkout' | 'payment'>('cart');

  const [cart, setCart] = useState<CartItem[]>(() => getCartItems());
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [selectedVariations, setSelectedVariations] = useState<Record<number, number>>({});
  const [addedFeedbackIdx, setAddedFeedbackIdx] = useState<number | null>(null);

  // Shipping & Coupon State
  const [cep, setCep] = useState('');
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  const [selectedShippingId, setSelectedShippingId] = useState<string>('pac');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string>('');
  const [couponMessage, setCouponMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Customer & Address Form State
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerCpf, setCustomerCpf] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [stateUf, setStateUf] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'checkout_pro'>('pix');

  // Checkout Execution State
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [activeOrder, setActiveOrder] = useState<StoreOrder | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  // Sync user data into customer form
  useEffect(() => {
    if (user) {
      if (!customerName && user.displayName) setCustomerName(user.displayName);
      if (!customerEmail && user.email) setCustomerEmail(user.email);
    }
  }, [user]);

  // Listen to cart updates
  useEffect(() => {
    const syncCart = () => setCart(getCartItems());
    window.addEventListener('ld-cart-updated', syncCart);
    return () => window.removeEventListener('ld-cart-updated', syncCart);
  }, []);

  // Load Store Settings & initial state when store opens
  useEffect(() => {
    if (!isOpen) return;
    setCart(getCartItems());
    fetchStoreSettings().then(setStoreSettings);

    if (initialOrderId) {
      getStoreOrderById(initialOrderId).then((ord) => {
        if (ord) {
          syncOrderPaymentStatus(ord).then((synced) => {
            setActiveOrder(synced);
            setCartStep('payment');
            setIsCartDrawerOpen(true);
          });
        }
      });
    } else if (initialTab === 'carrinho') {
      setCartStep('cart');
      setIsCartDrawerOpen(true);
    } else {
      setIsCartDrawerOpen(false);
      setCartStep('cart');
    }
  }, [isOpen, initialTab, initialOrderId]);

  // Poll payment status automatically when on 'payment' step and order is pending
  useEffect(() => {
    if (!isOpen || !isCartDrawerOpen || cartStep !== 'payment' || !activeOrder) return;
    if (activeOrder.paymentStatus === 'approved') return;

    const interval = setInterval(async () => {
      const updated = await syncOrderPaymentStatus(activeOrder);
      if (updated.paymentStatus !== activeOrder.paymentStatus) {
        setActiveOrder(updated);
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [isOpen, isCartDrawerOpen, cartStep, activeOrder]);

  const activeProducts = useMemo(() => {
    return (products || []).filter((p) => p && p.isActive !== false);
  }, [products]);

  // Category counts for badges
  const categoryCounts = useMemo(() => {
    const counts: Record<StoreCategoryFilter, number> = {
      all: activeProducts.length,
      decks: 0,
      cartas_avulsas: 0,
      playmats: 0,
      promocoes: 0,
      pre_venda: 0,
      kits: 0
    };
    for (const p of activeProducts) {
      if (matchesStoreCategory(p, 'decks')) counts.decks++;
      if (matchesStoreCategory(p, 'cartas_avulsas')) counts.cartas_avulsas++;
      if (matchesStoreCategory(p, 'playmats')) counts.playmats++;
      if (matchesStoreCategory(p, 'promocoes')) counts.promocoes++;
      if (matchesStoreCategory(p, 'pre_venda')) counts.pre_venda++;
      if (matchesStoreCategory(p, 'kits')) counts.kits++;
    }
    return counts;
  }, [activeProducts]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const list = activeProducts
      .map((prod, originalIdx) => ({ prod, originalIdx }))
      .filter(({ prod }) => {
        if (!matchesStoreCategory(prod, selectedCategory)) return false;

        if (onlyFreeShipping && !prod.freeShipping) return false;

        if (onlyInStock) {
          const outOfStock = prod.stock !== undefined && prod.stock === 0;
          if (outOfStock) return false;
        }

        if (q) {
          const hay = `${prod.title || ''} ${prod.description || ''} ${prod.badge || ''} ${prod.category || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }

        return true;
      });

    list.sort((a, b) => {
      const priceA = parseBRLPrice(a.prod.priceVariations?.[0]?.price || a.prod.price || '89,90');
      const priceB = parseBRLPrice(b.prod.priceVariations?.[0]?.price || b.prod.price || '89,90');

      if (sortBy === 'price-asc') return priceA - priceB;
      if (sortBy === 'price-desc') return priceB - priceA;
      if (sortBy === 'name-asc') return (a.prod.title || '').localeCompare(b.prod.title || '');
      return a.originalIdx - b.originalIdx;
    });

    return list;
  }, [activeProducts, selectedCategory, searchQuery, sortBy, onlyFreeShipping, onlyInStock]);

  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  const hasPreOrderItems = useMemo(() => {
    return cart.some((item) => item.isPreOrder);
  }, [cart]);

  const shippingOptions: ShippingOption[] = useMemo(() => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return [];
    // Even if cart is empty, allow previewing shipping rates using a standard 250g item
    const itemsForCalc: CartItem[] =
      cart.length > 0
        ? cart
        : [
            {
              cartItemId: 'preview',
              productId: 'preview',
              title: 'Deck Padrão',
              unitPrice: 89.9,
              formattedPrice: 'R$ 89,90',
              quantity: 1,
              weightGrams: 250
            }
          ];
    const subForCalc = cart.length > 0 ? subtotal : 89.9;
    return calculateShippingOptions(clean, stateUf, itemsForCalc, subForCalc, storeSettings);
  }, [cep, stateUf, cart, subtotal, storeSettings]);

  useEffect(() => {
    if (shippingOptions.length > 0) {
      const exists = shippingOptions.some((o) => o.id === selectedShippingId);
      if (!exists) {
        setSelectedShippingId(shippingOptions[0].id);
      }
    }
  }, [shippingOptions, selectedShippingId]);

  const selectedShipping: ShippingOption | null = useMemo(() => {
    return shippingOptions.find((o) => o.id === selectedShippingId) || shippingOptions[0] || null;
  }, [shippingOptions, selectedShippingId]);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    const found = (storeSettings.coupons || []).find(
      (c) => c.isActive && c.code.toUpperCase() === appliedCoupon.toUpperCase()
    );
    if (!found) return 0;
    if (found.minOrderValue && subtotal < found.minOrderValue) return 0;
    if (found.discountPercent && found.discountPercent > 0) {
      return Number(((subtotal * found.discountPercent) / 100).toFixed(2));
    }
    if (found.discountFixed && found.discountFixed > 0) {
      return Math.min(subtotal, Number(found.discountFixed.toFixed(2)));
    }
    return 0;
  }, [appliedCoupon, subtotal, storeSettings.coupons]);

  const shippingCost = selectedShipping ? selectedShipping.price : 0;
  const totalAmount = Math.max(0.5, Number((subtotal - discountAmount + shippingCost).toFixed(2)));

  const handleCepChange = async (rawVal: string) => {
    const formatted = formatCep(rawVal);
    setCep(formatted);
    setCepError('');

    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8) {
      setCepLoading(true);
      try {
        const addr = await lookupCepAddress(digits);
        if (addr.street) setStreet(addr.street);
        if (addr.neighborhood) setNeighborhood(addr.neighborhood);
        if (addr.city) setCity(addr.city);
        if (addr.state) setStateUf(addr.state);
      } catch (err: any) {
        setCepError(err.message || 'Não foi possível buscar o endereço pelo CEP.');
      } finally {
        setCepLoading(false);
      }
    }
  };

  const handleApplyCoupon = () => {
    setCouponMessage(null);
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    const found = (storeSettings.coupons || []).find(
      (c) => c.isActive && c.code.toUpperCase() === code
    );
    if (!found) {
      setCouponMessage({ type: 'err', text: 'Cupom inválido ou expirado.' });
      return;
    }
    if (found.minOrderValue && subtotal < found.minOrderValue) {
      setCouponMessage({
        type: 'err',
        text: `Este cupom exige pedido mínimo de ${formatBRL(found.minOrderValue)}.`
      });
      return;
    }

    setAppliedCoupon(found.code.toUpperCase());
    setCouponMessage({
      type: 'ok',
      text: `Cupom ${found.code.toUpperCase()} aplicado com sucesso!`
    });
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError('');

    if (cart.length === 0) {
      setCheckoutError('Seu carrinho está vazio.');
      return;
    }
    if (!customerName.trim() || customerName.trim().split(/\s+/).length < 2) {
      setCheckoutError('Por favor, informe seu Nome e Sobrenome completos.');
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setCheckoutError('Por favor, informe um e-mail válido para receber o comprovante e rastreio.');
      return;
    }
    if (!isValidCpf(customerCpf)) {
      setCheckoutError('Por favor, informe um CPF válido (11 dígitos) para emissão do pagamento e envio.');
      return;
    }
    if (customerPhone.replace(/\D/g, '').length < 10) {
      setCheckoutError('Por favor, informe seu WhatsApp/Telefone com DDD.');
      return;
    }
    if (cep.replace(/\D/g, '').length !== 8 || !street.trim() || !number.trim() || !city.trim() || !stateUf.trim()) {
      setCheckoutError('Preencha o CEP e o endereço completo de entrega (Rua, Número, Cidade e UF).');
      return;
    }
    if (!selectedShipping) {
      setCheckoutError('Selecione uma modalidade de frete.');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const orderId = generateOrderId();
      const nowIso = new Date().toISOString();
      const preOrderNotes = cart
        .filter((i) => i.isPreOrder && i.preOrderReleaseDate)
        .map((i) => `${i.title}: ${i.preOrderReleaseDate}`)
        .join(' | ');

      const newOrder: StoreOrder = {
        id: orderId,
        userId: user?.uid || undefined,
        userEmail: customerEmail.trim(),
        customerName: customerName.trim(),
        customerCpf: customerCpf.replace(/\D/g, ''),
        customerPhone: customerPhone.trim(),
        shippingAddress: {
          cep: cep.replace(/\D/g, ''),
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim() || undefined,
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          state: stateUf.trim().toUpperCase()
        },
        items: cart,
        subtotal: Number(subtotal.toFixed(2)),
        shippingMethodId: selectedShipping.id,
        shippingMethodName: selectedShipping.name,
        shippingCost: Number(shippingCost.toFixed(2)),
        shippingEstimatedDays: selectedShipping.estimatedDays,
        couponCode: appliedCoupon || undefined,
        discountAmount: Number(discountAmount.toFixed(2)),
        totalAmount,
        hasPreOrderItems,
        preOrderReleaseNotes: preOrderNotes || undefined,
        paymentMethod,
        paymentStatus: 'pending',
        orderStatus: 'awaiting_payment',
        customerNotes: customerNotes.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await createStoreOrder(newOrder);

      if (paymentMethod === 'pix') {
        const pixData = await generatePixForOrder(newOrder);
        const updatedOrder: StoreOrder = {
          ...newOrder,
          mpPaymentId: pixData.paymentId,
          mpPixQrCode: pixData.qrCode,
          mpPixQrCodeBase64: pixData.qrCodeBase64,
          mpPixTicketUrl: pixData.ticketUrl,
          paymentStatus: pixData.status || 'pending'
        };
        setActiveOrder(updatedOrder);
        clearCart();
        setCartStep('payment');
      } else {
        const prefData = await generateCheckoutPreferenceForOrder(newOrder);
        const updatedOrder: StoreOrder = {
          ...newOrder,
          mpPreferenceId: prefData.preferenceId,
          mpInitPoint: prefData.initPoint
        };
        setActiveOrder(updatedOrder);
        clearCart();
        setCartStep('payment');
      }
    } catch (err: any) {
      console.error('Erro ao processar checkout:', err);
      setCheckoutError(err.message || 'Erro ao iniciar pagamento no Mercado Pago.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleSwitchOrderToCheckoutPro = async () => {
    if (!activeOrder) return;
    setIsCheckingPayment(true);
    setCheckoutError('');
    try {
      const pref = await generateCheckoutPreferenceForOrder(activeOrder);
      const updated = {
        ...activeOrder,
        paymentMethod: 'checkout_pro' as const,
        mpPreferenceId: pref.preferenceId,
        mpInitPoint: pref.initPoint
      };
      setActiveOrder(updated);
    } catch (err: any) {
      setCheckoutError(err.message || 'Erro ao gerar link de cartão.');
    } finally {
      setIsCheckingPayment(false);
    }
  };

  const handleSwitchOrderToPix = async () => {
    if (!activeOrder) return;
    setIsCheckingPayment(true);
    setCheckoutError('');
    try {
      const pix = await generatePixForOrder(activeOrder);
      const updated = {
        ...activeOrder,
        paymentMethod: 'pix' as const,
        mpPaymentId: pix.paymentId,
        mpPixQrCode: pix.qrCode,
        mpPixQrCodeBase64: pix.qrCodeBase64,
        mpPixTicketUrl: pix.ticketUrl
      };
      setActiveOrder(updated);
    } catch (err: any) {
      setCheckoutError(err.message || 'Erro ao gerar QR Code PIX.');
    } finally {
      setIsCheckingPayment(false);
    }
  };

  const handleManualVerifyPayment = async (orderToCheck: StoreOrder) => {
    setIsCheckingPayment(true);
    try {
      const synced = await syncOrderPaymentStatus(orderToCheck);
      if (activeOrder && activeOrder.id === synced.id) {
        setActiveOrder(synced);
      }
    } finally {
      setIsCheckingPayment(false);
    }
  };

  const getCategoryIcon = (catId: StoreCategoryFilter, size = 15) => {
    switch (catId) {
      case 'decks':
        return <Layers size={size} />;
      case 'cartas_avulsas':
        return <Sparkles size={size} />;
      case 'playmats':
        return <Package size={size} />;
      case 'promocoes':
        return <Percent size={size} />;
      case 'pre_venda':
        return <Calendar size={size} />;
      case 'kits':
        return <Box size={size} />;
      default:
        return <Flame size={size} />;
    }
  };

  if (!isOpen) return null;

  const freeShippingRemaining =
    storeSettings.freeShippingThreshold > 0
      ? Math.max(0, storeSettings.freeShippingThreshold - subtotal)
      : 0;

  const activeCategoryMeta =
    STORE_CATEGORIES.find((c) => c.id === selectedCategory) || STORE_CATEGORIES[0];

  return (
    <div className="fixed inset-0 z-[70] bg-[#0a0a0c] text-slate-200 flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* ================= TOP ANNOUNCEMENT BAR ================= */}
      {storeSettings.freeShippingThreshold > 0 && (
        <div className="bg-slate-950 border-b border-slate-800/80 px-4 sm:px-8 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
            <span className="truncate">
              {storeSettings.storeNotice ||
                'Loja Oficial Light Dark TCG · Pagamento seguro via Mercado Pago (PIX e Cartão em até 12x) · Envio via Correios, Jadlog e Loggi'}
            </span>
          </div>
          <div className="font-mono text-xs shrink-0">
            {subtotal === 0 ? (
              <span className="text-amber-300">
                Frete Grátis em compras acima de{' '}
                <strong>{formatBRL(storeSettings.freeShippingThreshold)}</strong>
              </span>
            ) : freeShippingRemaining > 0 ? (
              <span className="text-amber-300">
                Faltam <strong className="tabular-nums">{formatBRL(freeShippingRemaining)}</strong> para{' '}
                <strong>Frete Grátis</strong>!
              </span>
            ) : (
              <span className="text-emerald-400 font-bold">
                ✓ Você desbloqueou Frete Grátis neste pedido!
              </span>
            )}
          </div>
        </div>
      )}

      {/* ================= MAIN STORE HEADER ================= */}
      <header className="bg-[#0e0e14] border-b border-slate-800/90 px-4 sm:px-8 py-3.5 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 sm:gap-6">
          {/* Left: Back to Site + Store Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition flex items-center gap-2 text-xs font-bold cursor-pointer"
              title="Voltar para a página inicial"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Voltar ao Site</span>
            </button>

            <div className="flex items-center gap-2.5">
              <img
                src="https://i.imgur.com/cDLxOtO.png"
                alt="Light Dark TCG"
                className="h-9 w-auto object-contain hidden sm:block"
              />
              <div>
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight leading-none">
                  LOJA OFICIAL
                </h1>
                <span className="text-[11px] text-emerald-400 font-semibold block mt-0.5">
                  Light Dark TCG · Produtos Físicos
                </span>
              </div>
            </div>
          </div>

          {/* Center: Search Bar */}
          <div className="order-3 md:order-2 w-full md:flex-1 md:max-w-xl relative">
            <Search
              size={16}
              className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar decks, cartas avulsas, playmats, kits, pré-vendas..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Right: Admin Button & Mercado Livre-style Cart Icon */}
          <div className="order-2 md:order-3 flex items-center gap-2.5">
            {isAdmin && onOpenAdminStore && (
              <button
                type="button"
                onClick={onOpenAdminStore}
                className="px-3 py-2.5 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                title="Gerenciar Pedidos, Frete e Produtos no Painel Admin"
              >
                <Settings size={15} />
                <span className="hidden lg:inline">Gerenciar Loja</span>
              </button>
            )}

            {/* Cart Icon Button (Mercado Livre Style - Icon + Quantity Badge Only) */}
            <button
              type="button"
              onClick={() => {
                setCartStep(activeOrder && cart.length === 0 ? 'payment' : 'cart');
                setIsCartDrawerOpen(true);
              }}
              className="relative p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/60 transition flex items-center justify-center group cursor-pointer"
              title="Abrir Carrinho e Calcular Frete"
            >
              <ShoppingCart
                size={20}
                className="text-emerald-400 group-hover:scale-105 transition-transform"
              />
              {totalItemsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black font-mono flex items-center justify-center tabular-nums shadow">
                  {totalItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ================= HORIZONTAL CATEGORY BAR ================= */}
        <div className="max-w-7xl mx-auto mt-3 pt-2.5 border-t border-slate-800/70 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {STORE_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const count = categoryCounts[cat.id];
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
                    : 'bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800/80'
                }`}
              >
                {getCategoryIcon(cat.id, 14)}
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md tabular-nums ${
                    isSelected
                      ? 'bg-black/30 text-white font-black'
                      : 'bg-slate-950 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ================= MAIN FULL-PAGE STORE BODY ================= */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT SIDEBAR: FILTERS & QUICK SHIPPING SIMULATOR (3 COLS ON DESKTOP) */}
            <aside className="lg:col-span-3 space-y-5">
              {/* Categories Filter Card */}
              <div className="bg-[#0e0e14] border border-slate-800/90 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <SlidersHorizontal size={14} className="text-purple-400" />
                    <span>Categorias da Loja</span>
                  </h2>
                  {selectedCategory !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      className="text-[11px] text-purple-400 hover:text-purple-300 underline"
                    >
                      Ver todas
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {STORE_CATEGORIES.map((cat) => {
                    const isSel = selectedCategory === cat.id;
                    const count = categoryCounts[cat.id];
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                          isSel
                            ? 'bg-purple-600/20 text-purple-300 border border-purple-500/50'
                            : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {getCategoryIcon(cat.id, 14)}
                          <span>{cat.label}</span>
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Refinements & Availability Filter */}
              <div className="bg-[#0e0e14] border border-slate-800/90 rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
                  Filtros Rápidos
                </h3>

                <label className="flex items-center justify-between gap-2 text-xs text-slate-300 cursor-pointer py-1">
                  <span>Apenas com Frete Grátis</span>
                  <input
                    type="checkbox"
                    checked={onlyFreeShipping}
                    onChange={(e) => setOnlyFreeShipping(e.target.checked)}
                    className="accent-emerald-500 w-4 h-4 rounded"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 text-xs text-slate-300 cursor-pointer py-1">
                  <span>Apenas em Estoque</span>
                  <input
                    type="checkbox"
                    checked={onlyInStock}
                    onChange={(e) => setOnlyInStock(e.target.checked)}
                    className="accent-purple-500 w-4 h-4 rounded"
                  />
                </label>
              </div>

              {/* Quick CEP Shipping Simulator in Sidebar */}
              <div className="bg-[#0e0e14] border border-slate-800/90 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Truck size={14} className="text-emerald-400" />
                    <span>Simular Frete</span>
                  </h3>
                  {city && stateUf && (
                    <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                      <MapPin size={11} />
                      {city}/{stateUf}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    placeholder="Digite seu CEP (00000-000)"
                    maxLength={9}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                  />
                  {cepLoading && (
                    <RefreshCw
                      size={13}
                      className="animate-spin text-purple-400 absolute right-3 top-1/2 -translate-y-1/2"
                    />
                  )}
                </div>

                {cepError && <p className="text-[11px] text-red-400">{cepError}</p>}

                {shippingOptions.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {shippingOptions.map((opt) => (
                      <div
                        key={opt.id}
                        className="flex items-center justify-between text-[11px] bg-slate-950/80 border border-slate-800/80 rounded-lg px-2.5 py-1.5"
                      >
                        <div>
                          <div className="font-bold text-slate-200">{opt.name}</div>
                          <div className="text-[10px] text-slate-400">{opt.estimatedDays}</div>
                        </div>
                        <span className="font-mono font-bold text-emerald-400 tabular-nums">
                          {opt.price === 0 ? 'GRÁTIS' : formatBRL(opt.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Consulte prazos e valores via <strong>Correios</strong>, <strong>Jadlog</strong> e{' '}
                    <strong>Loggi</strong> informando seu CEP.
                  </p>
                )}
              </div>

              {/* Marketplaces Parceiros Card */}
              <div className="bg-[#0e0e14] border border-slate-800/90 rounded-2xl p-4 space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Lojas Parceiras Oficiais
                </h3>
                <a
                  href="https://mypcards.com/LightDarkCardGame"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 transition text-xs group"
                >
                  <div>
                    <div className="font-bold text-white">MYP Cards</div>
                    <div className="text-[11px] text-slate-400">Cartas Avulsas & Singles</div>
                  </div>
                  <ExternalLink size={14} className="text-slate-500 group-hover:text-white" />
                </a>

                <a
                  href="https://lista.mercadolivre.com.br/_CustId_3408665465?item_id=MLB6798439252&category_id=MLB432989&seller_id=3408665465&client=recoview-selleritems&recos_listing=true"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 transition text-xs group"
                >
                  <div>
                    <div className="font-bold text-amber-400">Mercado Livre</div>
                    <div className="text-[11px] text-slate-400">Loja Oficial Parceira</div>
                  </div>
                  <ExternalLink size={14} className="text-slate-500 group-hover:text-white" />
                </a>

                <a
                  href="https://shopee.com.br/lps_cards_store"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 transition text-xs group"
                >
                  <div>
                    <div className="font-bold text-orange-400">Shopee</div>
                    <div className="text-[11px] text-slate-400">LPS Cards Store</div>
                  </div>
                  <ExternalLink size={14} className="text-slate-500 group-hover:text-white" />
                </a>
              </div>
            </aside>

            {/* RIGHT MAIN AREA: PRODUCT SHOWCASE GRID (9 COLS ON DESKTOP) */}
            <main className="lg:col-span-9 space-y-6">
              {/* Category Header & Sort Bar */}
              <div className="bg-[#0e0e14] border border-slate-800/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400">{getCategoryIcon(selectedCategory, 18)}</span>
                    <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                      {activeCategoryMeta.label}
                    </h2>
                    <span className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md tabular-nums">
                      {filteredProducts.length}{' '}
                      {filteredProducts.length === 1 ? 'produto' : 'produtos'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{activeCategoryMeta.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400">Ordenar por:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="featured">Mais Relevantes</option>
                    <option value="price-asc">Menor Preço</option>
                    <option value="price-desc">Maior Preço</option>
                    <option value="name-asc">Nome (A - Z)</option>
                  </select>
                </div>
              </div>

              {/* Products Grid */}
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredProducts.map(({ prod, originalIdx: idx }) => {
                    const variations = Array.isArray(prod.priceVariations)
                      ? prod.priceVariations.filter((v) => v && v.name && v.name.trim() !== '')
                      : [];
                    const hasVars = variations.length > 0;
                    const defaultVarIdx = hasVars
                      ? Math.max(0, variations.findIndex((v) => v.isDefault))
                      : 0;
                    const activeVarIdx =
                      selectedVariations[idx] !== undefined
                        ? selectedVariations[idx]
                        : defaultVarIdx;
                    const chosenVar = hasVars ? variations[activeVarIdx] || variations[0] : null;

                    const rawPrice = chosenVar ? chosenVar.price : prod.price || 'R$ 89,90';
                    const numericPrice = parseBRLPrice(rawPrice) || 89.9;
                    const numericOriginalPrice = prod.originalPrice
                      ? parseBRLPrice(prod.originalPrice)
                      : 0;
                    const hasDiscount = numericOriginalPrice > numericPrice;
                    const discountPct = hasDiscount
                      ? Math.round(
                          ((numericOriginalPrice - numericPrice) / numericOriginalPrice) * 100
                        )
                      : 0;

                    const currentStock =
                      chosenVar?.stock !== undefined ? chosenVar.stock : prod.stock;
                    const isOutOfStock = currentStock !== undefined && currentStock === 0;

                    const isPreOrder = matchesStoreCategory(prod, 'pre_venda');
                    const isPromo = matchesStoreCategory(prod, 'promocoes');

                    const medias =
                      prod.mediaList && prod.mediaList.length > 0
                        ? prod.mediaList
                        : prod.mediaUrl
                        ? [{ type: prod.mediaType || 'image', url: prod.mediaUrl }]
                        : [];
                    const coverMedia = medias[0];

                    return (
                      <div
                        key={idx}
                        className="bg-[#0e0e14] border border-slate-800/90 hover:border-slate-700 rounded-2xl overflow-hidden flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5 shadow-lg"
                      >
                        <div>
                          {/* Product Media */}
                          <div
                            onClick={() =>
                              onOpenProductDetail && onOpenProductDetail(prod, activeVarIdx)
                            }
                            className="relative aspect-[4/3] bg-black overflow-hidden cursor-pointer group"
                          >
                            {coverMedia?.type === 'video' ? (
                              <video
                                src={coverMedia.url}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : coverMedia?.url ? (
                              <img
                                src={coverMedia.url}
                                alt={prod.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-600">
                                <Package size={48} />
                              </div>
                            )}

                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />

                            <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-200 bg-slate-950/90 border border-purple-500/40 px-2.5 py-1 rounded-md">
                                {isPreOrder
                                  ? 'Pré-Venda'
                                  : prod.badge || getProductCategoryLabel(prod)}
                              </span>

                              <div className="flex items-center gap-1.5">
                                {(isPromo || hasDiscount) && (
                                  <span className="text-[10px] font-black text-amber-950 bg-amber-400 px-2 py-0.5 rounded-md">
                                    {discountPct > 0 ? `-${discountPct}% OFF` : 'PROMO'}
                                  </span>
                                )}
                                {prod.freeShipping && (
                                  <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/90 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                                    Frete Grátis
                                  </span>
                                )}
                              </div>
                            </div>

                            {onOpenProductDetail && (
                              <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] text-slate-200 font-semibold flex items-center gap-1 border border-white/10">
                                <Eye size={12} />
                                <span>Ver Detalhes</span>
                              </div>
                            )}
                          </div>

                          {/* Product Info */}
                          <div className="p-4 sm:p-5 space-y-2.5">
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                              <span className="text-purple-300 font-semibold">
                                {getProductCategoryLabel(prod)}
                              </span>
                              <span>·</span>
                              <span>{prod.weightGrams || 250}g</span>
                              {currentStock !== undefined && currentStock > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="text-amber-300 font-mono tabular-nums">
                                    {currentStock} disp.
                                  </span>
                                </>
                              )}
                            </div>

                            <h3
                              onClick={() =>
                                onOpenProductDetail && onOpenProductDetail(prod, activeVarIdx)
                              }
                              className="text-base sm:text-lg font-bold text-white leading-snug hover:text-purple-300 cursor-pointer transition"
                            >
                              {prod.title}
                            </h3>

                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                              {prod.description}
                            </p>

                            {/* Pre-order Release Notice */}
                            {(isPreOrder || prod.preOrderReleaseDate) && (
                              <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-800/50 flex items-center gap-2 text-[11px] text-amber-300">
                                <Calendar size={13} className="shrink-0 text-amber-400" />
                                <span className="font-semibold truncate">
                                  {prod.preOrderReleaseDate ||
                                    prod.noLinkMessage ||
                                    'Lote de Pré-Venda c/ Reserva Garantida'}
                                </span>
                              </div>
                            )}

                            {/* Variations Selector */}
                            {hasVars && (
                              <div className="space-y-1.5 pt-1">
                                <label className="text-[11px] text-slate-400 font-semibold block">
                                  Escolha a Versão:
                                </label>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {variations.map((v, vIdx) => {
                                    const isSel = activeVarIdx === vIdx;
                                    return (
                                      <button
                                        key={vIdx}
                                        type="button"
                                        onClick={() =>
                                          setSelectedVariations((prev) => ({
                                            ...prev,
                                            [idx]: vIdx
                                          }))
                                        }
                                        className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                                          isSel
                                            ? 'bg-purple-950/80 border-purple-500 text-white'
                                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                                        }`}
                                      >
                                        <div className="text-[11px] font-bold truncate">
                                          {v.name}
                                        </div>
                                        <div className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                                          {formatBRL(parseBRLPrice(v.price))}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Price & Actions Footer */}
                        <div className="p-4 sm:p-5 pt-3 border-t border-slate-800/80 space-y-3 bg-slate-950/40">
                          <div className="flex items-baseline justify-between">
                            <div>
                              {hasDiscount && (
                                <span className="text-xs text-slate-500 line-through font-mono block tabular-nums">
                                  {formatBRL(numericOriginalPrice)}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400 block">
                                À vista no PIX ou Cartão
                              </span>
                              <span className="text-xl font-black text-emerald-400 font-mono tabular-nums">
                                {formatBRL(numericPrice)}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                              até 12x
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isOutOfStock}
                              onClick={() => {
                                addToCart(prod, activeVarIdx, 1);
                                setAddedFeedbackIdx(idx);
                                setTimeout(() => setAddedFeedbackIdx(null), 1500);
                              }}
                              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                                isOutOfStock
                                  ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                                  : addedFeedbackIdx === idx
                                  ? 'bg-emerald-600 text-white border-emerald-500'
                                  : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-700'
                              }`}
                            >
                              {isOutOfStock ? (
                                <span>Esgotado</span>
                              ) : addedFeedbackIdx === idx ? (
                                <>
                                  <Check size={14} />
                                  <span>No Carrinho!</span>
                                </>
                              ) : (
                                <>
                                  <Plus size={14} />
                                  <span>Por no Carrinho</span>
                                </>
                              )}
                            </button>

                            {!isOutOfStock && (
                              <button
                                type="button"
                                onClick={() => {
                                  addToCart(prod, activeVarIdx, 1);
                                  setCartStep('cart');
                                  setIsCartDrawerOpen(true);
                                }}
                                className="flex-1 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-purple-950/50 cursor-pointer"
                              >
                                <ShoppingCart size={14} />
                                <span>{isPreOrder ? 'Reservar' : 'Comprar'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 bg-[#0e0e14] rounded-2xl border border-slate-800/90 p-8 space-y-4">
                  <Package size={44} className="mx-auto text-slate-500" />
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">
                      Nenhum produto encontrado em "{activeCategoryMeta.label}"
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      {searchQuery || onlyFreeShipping || onlyInStock
                        ? 'Tente limpar os filtros de busca ou selecionar outra categoria de produtos.'
                        : 'Em breve novos produtos desta categoria estarão disponíveis na Loja Oficial.'}
                    </p>
                  </div>
                  {selectedCategory !== 'all' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('all');
                        setSearchQuery('');
                        setOnlyFreeShipping(false);
                        setOnlyInStock(false);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Ver Todos os Produtos ({activeProducts.length})
                    </button>
                  )}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      {/* ================= SLIDE-OVER CART & SHIPPING DRAWER (MERCADO LIVRE STYLE) ================= */}
      {isCartDrawerOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200"
          onClick={() => setIsCartDrawerOpen(false)}
        >
          <div
            className="bg-[#0d0d12] w-full max-w-2xl h-full border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-white leading-tight">
                    {cartStep === 'cart' && `Meu Carrinho (${totalItemsCount})`}
                    {cartStep === 'checkout' && 'Endereço de Entrega e Pagamento'}
                    {cartStep === 'payment' && 'Pagamento do Pedido'}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {cartStep === 'cart' &&
                      'Calcule o frete via Correios, Jadlog ou Loggi antes de finalizar'}
                    {cartStep === 'checkout' &&
                      'Informe onde devemos entregar seus produtos físicos'}
                    {cartStep === 'payment' &&
                      'Pagamento seguro processado pelo Mercado Pago'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCartDrawerOpen(false)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Step Progress Indicator inside Drawer */}
            {cart.length > 0 && cartStep !== 'payment' && (
              <div className="px-5 py-2.5 bg-slate-900/70 border-b border-slate-800 flex items-center gap-2 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setCartStep('cart')}
                  className={`font-bold flex items-center gap-1.5 cursor-pointer ${
                    cartStep === 'cart' ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-[10px] font-mono">
                    1
                  </span>
                  <span>Carrinho e Frete</span>
                </button>
                <ChevronRight size={14} className="text-slate-600" />
                <button
                  type="button"
                  onClick={() => setCartStep('checkout')}
                  className={`font-bold flex items-center gap-1.5 cursor-pointer ${
                    cartStep === 'checkout' ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/50 flex items-center justify-center text-[10px] font-mono">
                    2
                  </span>
                  <span>Entrega e Pagamento</span>
                </button>
              </div>
            )}

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
              {/* STEP 1: CART ITEMS & SHIPPING CALCULATOR */}
              {cartStep === 'cart' && (
                <>
                  {cart.length === 0 ? (
                    <div className="text-center py-16 space-y-4">
                      <ShoppingCart size={48} className="mx-auto text-slate-600" />
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold text-white">Seu carrinho está vazio</h3>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto">
                          Explore as categorias da Loja Oficial para adicionar Decks, Cartas Avulsas, Playmats ou Kits.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsCartDrawerOpen(false)}
                        className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer"
                      >
                        Continuar Comprando
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Cart Items List */}
                      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                          <span className="text-xs font-bold text-white">
                            Produtos Selecionados ({totalItemsCount})
                          </span>
                          <button
                            type="button"
                            onClick={() => clearCart()}
                            className="text-[11px] text-slate-400 hover:text-red-400 transition cursor-pointer"
                          >
                            Esvaziar carrinho
                          </button>
                        </div>

                        <div className="divide-y divide-slate-800/80">
                          {cart.map((item) => (
                            <div
                              key={item.cartItemId}
                              className="py-3 first:pt-0 last:pb-0 flex items-center gap-3"
                            >
                              <div className="w-14 h-14 rounded-xl bg-black border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.title}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package size={20} className="text-slate-600" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-xs sm:text-sm text-white truncate">
                                  {item.title}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                                  {item.variationName && (
                                    <span className="text-purple-300 font-semibold">
                                      {item.variationName}
                                    </span>
                                  )}
                                  {item.isPreOrder && (
                                    <span className="text-amber-300 font-semibold">
                                      · Pré-Venda
                                    </span>
                                  )}
                                  <span>·</span>
                                  <span className="font-mono tabular-nums">
                                    {formatBRL(item.unitPrice)} un.
                                  </span>
                                </div>
                              </div>

                              {/* Quantity Controls */}
                              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCartItemQuantity(item.cartItemId, item.quantity - 1)
                                  }
                                  className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="w-6 text-center text-xs font-mono font-bold text-white tabular-nums">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCartItemQuantity(item.cartItemId, item.quantity + 1)
                                  }
                                  className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>

                              <div className="text-right shrink-0 w-20">
                                <div className="text-xs sm:text-sm font-black font-mono text-emerald-400 tabular-nums">
                                  {formatBRL(item.unitPrice * item.quantity)}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => updateCartItemQuantity(item.cartItemId, 0)}
                                  className="text-[10px] text-slate-500 hover:text-red-400 transition cursor-pointer"
                                >
                                  Remover
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Shipping Calculator by CEP */}
                      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3.5">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                            <Truck size={16} className="text-purple-400" />
                            <span>Frete e Prazo (Correios, Jadlog e Loggi)</span>
                          </h3>
                          {city && stateUf && (
                            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                              <MapPin size={12} />
                              {city} / {stateUf}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={cep}
                              onChange={(e) => handleCepChange(e.target.value)}
                              placeholder="Digite seu CEP (00000-000)"
                              maxLength={9}
                              className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white font-mono outline-none"
                            />
                            {cepLoading && (
                              <RefreshCw
                                size={14}
                                className="animate-spin text-purple-400 absolute right-3 top-1/2 -translate-y-1/2"
                              />
                            )}
                          </div>
                          <a
                            href="https://buscacepinter.correios.com.br/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-purple-400 hover:text-purple-300 underline whitespace-nowrap"
                          >
                            Não sei meu CEP
                          </a>
                        </div>

                        {cepError && <p className="text-xs text-red-400">{cepError}</p>}

                        {shippingOptions.length > 0 ? (
                          <div className="space-y-2">
                            {shippingOptions.map((opt) => {
                              const isSel = selectedShipping?.id === opt.id;
                              const companyLower = (opt.company || '').toLowerCase();
                              const badgeColor = companyLower.includes('loggi')
                                ? 'bg-sky-950/90 text-sky-300 border-sky-500/40'
                                : companyLower.includes('jadlog')
                                ? 'bg-rose-950/90 text-rose-300 border-rose-500/40'
                                : 'bg-amber-950/90 text-amber-300 border-amber-500/40';
                              return (
                                <label
                                  key={opt.id}
                                  onClick={() => setSelectedShippingId(opt.id)}
                                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                                    isSel
                                      ? 'bg-purple-950/60 border-purple-500 text-white'
                                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <input
                                      type="radio"
                                      name="drawerShippingOption"
                                      checked={isSel}
                                      onChange={() => setSelectedShippingId(opt.id)}
                                      className="accent-purple-500"
                                    />
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold text-white">
                                          {opt.name}
                                        </span>
                                        <span
                                          className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${badgeColor}`}
                                        >
                                          {opt.company}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-400">
                                        Prazo estimado: <strong>{opt.estimatedDays}</strong>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-xs sm:text-sm font-black font-mono text-emerald-400 tabular-nums shrink-0 ml-2">
                                    {opt.price === 0 ? 'GRÁTIS' : formatBRL(opt.price)}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">
                            Informe seu CEP de 8 dígitos para selecionar o frete via Correios, Jadlog ou Loggi.
                          </p>
                        )}
                      </div>

                      {/* Discount Coupon */}
                      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Tag size={13} className="text-purple-400" />
                          <span>Cupom de Desconto</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={couponInput}
                            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                            placeholder="Código do cupom"
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase outline-none focus:border-purple-500"
                          />
                          <button
                            type="button"
                            onClick={handleApplyCoupon}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition cursor-pointer"
                          >
                            Aplicar
                          </button>
                        </div>
                        {couponMessage && (
                          <p
                            className={`text-xs font-semibold ${
                              couponMessage.type === 'ok' ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {couponMessage.text}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* STEP 2: DELIVERY ADDRESS & PAYMENT METHOD FORM */}
              {cartStep === 'checkout' && cart.length > 0 && (
                <form id="store-checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-4">
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-purple-300 border-b border-slate-800 pb-2">
                      1. Dados do Destinatário
                    </h3>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Nome Completo do Destinatário *
                      </label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Nome e Sobrenome"
                        className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          CPF (para Nota/Envio) *
                        </label>
                        <input
                          type="text"
                          required
                          value={customerCpf}
                          onChange={(e) => setCustomerCpf(formatCpf(e.target.value))}
                          placeholder="000.000.000-00"
                          maxLength={14}
                          className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-3.5 py-2 text-sm text-white font-mono outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          WhatsApp c/ DDD *
                        </label>
                        <input
                          type="text"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                          placeholder="(11) 99999-9999"
                          maxLength={15}
                          className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-3.5 py-2 text-sm text-white font-mono outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        E-mail (para receber o Rastreio) *
                      </label>
                      <input
                        type="email"
                        required
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="seuemail@exemplo.com"
                        className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-purple-300 border-b border-slate-800 pb-2">
                      2. Endereço de Entrega ({selectedShipping?.name || 'Frete'})
                    </h3>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <label className="text-xs text-slate-400 block mb-1">CEP *</label>
                        <input
                          type="text"
                          required
                          value={cep}
                          onChange={(e) => handleCepChange(e.target.value)}
                          placeholder="00000-000"
                          maxLength={9}
                          className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-slate-400 block mb-1">
                          Rua / Logradouro *
                        </label>
                        <input
                          type="text"
                          required
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                          placeholder="Rua, Avenida..."
                          className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Número *</label>
                        <input
                          type="text"
                          required
                          value={number}
                          onChange={(e) => setNumber(e.target.value)}
                          placeholder="123"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-slate-400 block mb-1">
                          Complemento (Apto, Bloco)
                        </label>
                        <input
                          type="text"
                          value={complement}
                          onChange={(e) => setComplement(e.target.value)}
                          placeholder="Opcional"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs text-slate-400 block mb-1">Bairro *</label>
                        <input
                          type="text"
                          required
                          value={neighborhood}
                          onChange={(e) => setNeighborhood(e.target.value)}
                          placeholder="Bairro"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-slate-400 block mb-1">Cidade *</label>
                        <input
                          type="text"
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="Cidade"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="text-xs text-slate-400 block mb-1">UF *</label>
                        <input
                          type="text"
                          required
                          maxLength={2}
                          value={stateUf}
                          onChange={(e) => setStateUf(e.target.value.toUpperCase())}
                          placeholder="SP"
                          className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-2 py-2 text-xs text-white font-mono uppercase text-center outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Observações do Pedido (opcional)
                      </label>
                      <input
                        type="text"
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder="Algum detalhe sobre entrega ou pedido..."
                        className="w-full bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                      />
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-purple-300 border-b border-slate-800 pb-2">
                      3. Forma de Pagamento (Mercado Pago)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('pix')}
                        className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                          paymentMethod === 'pix'
                            ? 'bg-emerald-950/70 border-emerald-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <QrCode size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold">PIX Instantâneo</div>
                          <div className="text-[11px] text-slate-400">
                            QR Code na tela · Aprovação imediata
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('checkout_pro')}
                        className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                          paymentMethod === 'checkout_pro'
                            ? 'bg-purple-950/70 border-purple-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <CreditCard size={18} className="text-purple-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold">Cartão / Boleto / MP</div>
                          <div className="text-[11px] text-slate-400">
                            Em até 12x via Mercado Pago
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {checkoutError && (
                    <div className="p-3 rounded-xl bg-red-950/70 border border-red-600/50 text-xs text-red-200 flex items-center gap-2">
                      <AlertCircle size={15} className="text-red-400 shrink-0" />
                      <span>{checkoutError}</span>
                    </div>
                  )}
                </form>
              )}

              {/* STEP 3: ACTIVE ORDER PAYMENT SCREEN */}
              {cartStep === 'payment' && activeOrder && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
                  {activeOrder.paymentStatus === 'approved' ? (
                    <div className="text-center space-y-4 py-4">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                        <Check size={34} />
                      </div>
                      <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                        Pagamento Confirmado pelo Mercado Pago
                      </div>
                      <h3 className="text-xl font-black text-white">
                        Pedido #{activeOrder.id} Confirmado!
                      </h3>
                      <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                        Recebemos seu pagamento! Você pode acompanhar a separação e o código de rastreio (Correios, Jadlog ou Loggi) diretamente no seu <strong>Perfil de Usuário</strong>.
                      </p>

                      {onOpenUserOrders && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCartDrawerOpen(false);
                            onOpenUserOrders();
                          }}
                          className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition inline-flex items-center gap-2 cursor-pointer"
                        >
                          <UserIcon size={15} />
                          <span>Ir para Meu Perfil &gt; Meus Pedidos</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <span className="text-xs text-slate-400 font-mono">
                            Pedido #{activeOrder.id}
                          </span>
                          <h3 className="text-base font-black text-white">
                            {activeOrder.paymentMethod === 'pix'
                              ? 'Escaneie o QR Code PIX'
                              : 'Conclua no Mercado Pago'}
                          </h3>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-400 block">Total</span>
                          <span className="text-lg font-black font-mono text-emerald-400 tabular-nums">
                            {formatBRL(activeOrder.totalAmount)}
                          </span>
                        </div>
                      </div>

                      {activeOrder.paymentMethod === 'pix' && activeOrder.mpPixQrCode ? (
                        <div className="space-y-4 text-center">
                          {activeOrder.mpPixQrCodeBase64 && (
                            <div className="bg-white p-3.5 rounded-2xl w-52 h-52 mx-auto flex items-center justify-center shadow-lg">
                              <img
                                src={`data:image/png;base64,${activeOrder.mpPixQrCodeBase64}`}
                                alt="QR Code PIX Mercado Pago"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}

                          <div className="space-y-1.5 text-left">
                            <label className="text-xs font-bold text-slate-300 block">
                              PIX Copia e Cola:
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                readOnly
                                value={activeOrder.mpPixQrCode}
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(activeOrder.mpPixQrCode || '');
                                  setCopiedPix(true);
                                  setTimeout(() => setCopiedPix(false), 2500);
                                }}
                                className={`px-3.5 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                                  copiedPix
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                                }`}
                              >
                                {copiedPix ? <Check size={14} /> : <Copy size={14} />}
                                <span>{copiedPix ? 'Copiado!' : 'Copiar'}</span>
                              </button>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-300">
                            <div className="flex items-center gap-2">
                              <RefreshCw
                                size={14}
                                className="animate-spin text-emerald-400 shrink-0"
                              />
                              <span>Aguardando pagamento...</span>
                            </div>
                            <button
                              type="button"
                              disabled={isCheckingPayment}
                              onClick={() => handleManualVerifyPayment(activeOrder)}
                              className="text-purple-400 hover:text-purple-300 font-bold underline shrink-0 cursor-pointer"
                            >
                              Já paguei, verificar
                            </button>
                          </div>

                          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                            <span>Prefere Cartão de Crédito?</span>
                            <button
                              type="button"
                              onClick={handleSwitchOrderToCheckoutPro}
                              className="text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer"
                            >
                              Mudar para Cartão (até 12x)
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 text-center py-3">
                          {activeOrder.mpInitPoint && (
                            <a
                              href={activeOrder.mpInitPoint}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs sm:text-sm transition shadow-lg shadow-purple-950/50"
                            >
                              <CreditCard size={16} />
                              <span>
                                Pagar no Mercado Pago ({formatBRL(activeOrder.totalAmount)})
                              </span>
                              <ExternalLink size={14} />
                            </a>
                          )}

                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-300">
                            <span>Concluiu o pagamento na outra aba?</span>
                            <button
                              type="button"
                              disabled={isCheckingPayment}
                              onClick={() => handleManualVerifyPayment(activeOrder)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold shrink-0 cursor-pointer"
                            >
                              Verificar Status
                            </button>
                          </div>

                          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                            <span>Prefere pagar via PIX na tela?</span>
                            <button
                              type="button"
                              onClick={handleSwitchOrderToPix}
                              className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                            >
                              Gerar QR Code PIX
                            </button>
                          </div>
                        </div>
                      )}

                      {onOpenUserOrders && (
                        <div className="pt-3 border-t border-slate-800 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setIsCartDrawerOpen(false);
                              onOpenUserOrders();
                            }}
                            className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                          >
                            Acompanhar meus pedidos e rastreio no Meu Perfil
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Drawer Footer (Summary + Primary CTA) */}
            {cart.length > 0 && cartStep !== 'payment' && (
              <div className="p-5 bg-slate-950 border-t border-slate-800 space-y-3 shrink-0">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal ({totalItemsCount} itens):</span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {formatBRL(subtotal)}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Cupom ({appliedCoupon}):</span>
                      <span className="font-mono tabular-nums">- {formatBRL(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400">
                    <span>
                      Frete ({selectedShipping ? selectedShipping.name : 'Informe o CEP'}):
                    </span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {selectedShipping
                        ? selectedShipping.price === 0
                          ? 'GRÁTIS'
                          : formatBRL(selectedShipping.price)
                        : 'A calcular'}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-slate-800 text-sm font-black text-white">
                    <span>Total do Pedido:</span>
                    <span className="text-lg text-emerald-400 font-mono tabular-nums">
                      {formatBRL(totalAmount)}
                    </span>
                  </div>
                </div>

                {cartStep === 'cart' ? (
                  <button
                    type="button"
                    onClick={() => setCartStep('checkout')}
                    className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
                  >
                    <span>Continuar para Entrega e Pagamento</span>
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCartStep('cart')}
                      className="px-4 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-800 transition cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      form="store-checkout-form"
                      disabled={isSubmittingOrder}
                      className="flex-1 py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
                    >
                      {isSubmittingOrder ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" />
                          <span>Processando...</span>
                        </>
                      ) : paymentMethod === 'pix' ? (
                        <>
                          <QrCode size={16} />
                          <span>Gerar PIX ({formatBRL(totalAmount)})</span>
                        </>
                      ) : (
                        <>
                          <CreditCard size={16} />
                          <span>Pagar com Cartão ({formatBRL(totalAmount)})</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
