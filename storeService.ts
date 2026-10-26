import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { db, auth, readBrowserCache, writeBrowserCache } from './firebase';
import {
  CartItem,
  ExclusiveProduct,
  MarketplaceListing,
  MarketplaceSellerReview,
  OrderStatus,
  PaymentStatus,
  ShippingOption,
  StoreOrder,
  StoreSettings
} from './types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  originCep: '01001-000',
  freeShippingThreshold: 299,
  handlingDays: 2,
  enableMiniEnvios: true,
  miniEnviosPrice: 16.9,
  miniEnviosDays: '6 a 10 dias úteis',
  enableJadlog: true,
  enableLoggi: true,
  regionalRates: {
    SE: {
      pacBase: 22.9,
      sedexBase: 32.9,
      pacDays: '4 a 7 dias úteis',
      sedexDays: '1 a 3 dias úteis',
      jadlogPackageBase: 19.9,
      jadlogPackageDays: '3 a 6 dias úteis',
      jadlogComBase: 27.9,
      jadlogComDays: '1 a 3 dias úteis',
      loggiExpressBase: 21.5,
      loggiExpressDays: '1 a 3 dias úteis',
      extraPerKg: 6.0
    },
    S: {
      pacBase: 26.9,
      sedexBase: 42.9,
      pacDays: '5 a 8 dias úteis',
      sedexDays: '2 a 4 dias úteis',
      jadlogPackageBase: 23.9,
      jadlogPackageDays: '4 a 7 dias úteis',
      jadlogComBase: 34.9,
      jadlogComDays: '2 a 4 dias úteis',
      loggiExpressBase: 25.9,
      loggiExpressDays: '2 a 5 dias úteis',
      extraPerKg: 8.0
    },
    CO: {
      pacBase: 28.9,
      sedexBase: 46.9,
      pacDays: '5 a 9 dias úteis',
      sedexDays: '2 a 5 dias úteis',
      jadlogPackageBase: 25.9,
      jadlogPackageDays: '4 a 8 dias úteis',
      jadlogComBase: 38.9,
      jadlogComDays: '2 a 5 dias úteis',
      loggiExpressBase: 27.9,
      loggiExpressDays: '2 a 5 dias úteis',
      extraPerKg: 9.0
    },
    NE: {
      pacBase: 34.9,
      sedexBase: 58.9,
      pacDays: '7 a 12 dias úteis',
      sedexDays: '3 a 6 dias úteis',
      jadlogPackageBase: 31.9,
      jadlogPackageDays: '6 a 10 dias úteis',
      jadlogComBase: 48.9,
      jadlogComDays: '3 a 6 dias úteis',
      loggiExpressBase: 33.9,
      loggiExpressDays: '4 a 8 dias úteis',
      extraPerKg: 12.0
    },
    N: {
      pacBase: 39.9,
      sedexBase: 68.9,
      pacDays: '9 a 15 dias úteis',
      sedexDays: '4 a 7 dias úteis',
      jadlogPackageBase: 36.9,
      jadlogPackageDays: '8 a 13 dias úteis',
      jadlogComBase: 56.9,
      jadlogComDays: '4 a 7 dias úteis',
      loggiExpressBase: 38.9,
      loggiExpressDays: '5 a 10 dias úteis',
      extraPerKg: 14.0
    }
  },
  coupons: [
    {
      code: 'BEMVINDO5',
      discountPercent: 5,
      minOrderValue: 50,
      isActive: true
    }
  ],
  whatsappSupport: '5511999999999',
  storeNotice: 'Envio seguro para todo o Brasil via Correios, Jadlog e Loggi com código de rastreio. Pagamento via PIX Instantâneo ou Cartão em até 12x pelo Mercado Pago.'
};

const CART_STORAGE_KEY = 'ld_store_cart_v1';
const LOCAL_ORDERS_KEY = 'ld_local_orders_v1';

export function parseBRLPrice(raw?: string | number): number {
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  if (!raw) return 0;
  const str = String(raw).trim();
  // Remove currency symbols and spaces
  const cleaned = str.replace(/[^\d.,]/g, '');
  if (!cleaned) return 0;
  // If both '.' and ',' exist, assume '.' is thousands and ',' is decimal
  if (cleaned.includes('.') && cleaned.includes(',')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(normalized);
    return isNaN(val) ? 0 : val;
  }
  if (cleaned.includes(',')) {
    const normalized = cleaned.replace(',', '.');
    const val = parseFloat(normalized);
    return isNaN(val) ? 0 : val;
  }
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function isValidCpf(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(clean.charAt(10), 10);
}

// --- CART MANAGEMENT ---
export function getCartItems(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCartItems(items: CartItem[]): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('ld-cart-updated', { detail: items }));
  } catch (e) {
    console.error('Erro ao salvar carrinho:', e);
  }
}

export function buildCartItemFromProduct(
  product: ExclusiveProduct,
  variationIndex?: number,
  quantity: number = 1
): CartItem {
  const variations = Array.isArray(product.priceVariations)
    ? product.priceVariations.filter((v) => v && v.name && v.name.trim() !== '')
    : [];

  let chosenVar = undefined;
  if (variations.length > 0) {
    if (typeof variationIndex === 'number' && variationIndex >= 0 && variationIndex < variations.length) {
      chosenVar = variations[variationIndex];
    } else {
      const def = variations.find((v) => v.isDefault);
      chosenVar = def || variations[0];
    }
  }

  const rawPrice = chosenVar ? chosenVar.price : product.price || 'R$ 89,90';
  const unitPrice = parseBRLPrice(rawPrice) || 89.9;
  const productId = product.id || product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const variationName = chosenVar?.name;
  const cartItemId = `${productId}__${variationName || 'padrao'}`;

  let imageUrl = product.mediaUrl;
  if (product.mediaList && product.mediaList.length > 0) {
    const firstImage = product.mediaList.find((m) => m.type === 'image' && m.url);
    imageUrl = firstImage?.url || product.mediaList[0]?.url || imageUrl;
  }

  const isPreOrder = Boolean(
    product.isPreOrder ||
      (product.badge && product.badge.toLowerCase().includes('pré-venda')) ||
      (product.buttonText && product.buttonText.toLowerCase().includes('pré-venda'))
  );

  return {
    cartItemId,
    productId,
    title: product.title || 'Produto Oficial Light Dark',
    variationName,
    badge: chosenVar?.badge || product.badge,
    unitPrice,
    formattedPrice: formatBRL(unitPrice),
    quantity: Math.max(1, quantity),
    imageUrl,
    isPreOrder,
    preOrderReleaseDate: product.preOrderReleaseDate || product.noLinkMessage,
    weightGrams: Number(chosenVar?.weightGrams || product.weightGrams || 250),
    freeShipping: Boolean(product.freeShipping),
    maxStock: chosenVar?.stock !== undefined ? chosenVar.stock : product.stock
  };
}

export function addToCart(
  product: ExclusiveProduct,
  variationIndex?: number,
  quantity: number = 1
): CartItem[] {
  const current = getCartItems();
  const newItem = buildCartItemFromProduct(product, variationIndex, quantity);
  const existingIdx = current.findIndex((i) => i.cartItemId === newItem.cartItemId);

  if (existingIdx >= 0) {
    const nextQty = current[existingIdx].quantity + quantity;
    const maxS = current[existingIdx].maxStock;
    current[existingIdx] = {
      ...current[existingIdx],
      unitPrice: newItem.unitPrice,
      formattedPrice: newItem.formattedPrice,
      isPreOrder: newItem.isPreOrder,
      preOrderReleaseDate: newItem.preOrderReleaseDate,
      quantity: maxS && maxS > 0 ? Math.min(maxS, nextQty) : nextQty
    };
  } else {
    current.push(newItem);
  }

  saveCartItems(current);
  return current;
}

export function updateCartItemQuantity(cartItemId: string, quantity: number): CartItem[] {
  const current = getCartItems();
  if (quantity <= 0) {
    const filtered = current.filter((i) => i.cartItemId !== cartItemId);
    saveCartItems(filtered);
    return filtered;
  }
  const updated = current.map((item) => {
    if (item.cartItemId !== cartItemId) return item;
    const maxS = item.maxStock;
    const clamped = maxS && maxS > 0 ? Math.min(maxS, quantity) : quantity;
    return { ...item, quantity: clamped };
  });
  saveCartItems(updated);
  return updated;
}

export function clearCart(): void {
  saveCartItems([]);
}

// --- CEP & SHIPPING CALCULATION ---
export async function lookupCepAddress(cepRaw: string): Promise<{
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}> {
  const cleanCep = cepRaw.replace(/\D/g, '');
  if (cleanCep.length !== 8) {
    throw new Error('Digite um CEP válido com 8 números.');
  }

  // Try backend proxy first
  try {
    const apiRes = await fetch(`/api/cep/${cleanCep}`);
    if (apiRes.ok) {
      return await apiRes.json();
    }
  } catch {
    // Fallback to direct ViaCEP
  }

  try {
    const viaRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    if (viaRes.ok) {
      const data = await viaRes.json();
      if (!data.erro) {
        return {
          cep: data.cep || cleanCep,
          street: data.logradouro || '',
          neighborhood: data.bairro || '',
          city: data.localidade || '',
          state: data.uf || ''
        };
      }
    }
  } catch {
    // Fallback to BrasilAPI
  }

  const brRes = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
  if (brRes.ok) {
    const data = await brRes.json();
    return {
      cep: data.cep || cleanCep,
      street: data.street || '',
      neighborhood: data.neighborhood || '',
      city: data.city || '',
      state: data.state || ''
    };
  }

  throw new Error('CEP não encontrado. Verifique os números digitados.');
}

function getRegionByUfOrCep(uf: string, cep: string): 'SE' | 'S' | 'CO' | 'NE' | 'N' {
  const cleanUf = (uf || '').toUpperCase().trim();
  if (['SP', 'RJ', 'MG', 'ES'].includes(cleanUf)) return 'SE';
  if (['PR', 'SC', 'RS'].includes(cleanUf)) return 'S';
  if (['DF', 'GO', 'MT', 'MS'].includes(cleanUf)) return 'CO';
  if (['BA', 'SE', 'AL', 'PE', 'PB', 'RN', 'CE', 'PI', 'MA'].includes(cleanUf)) return 'NE';
  if (['AM', 'RR', 'AP', 'PA', 'TO', 'RO', 'AC'].includes(cleanUf)) return 'N';

  const firstDigit = cep.replace(/\D/g, '')[0];
  if (['0', '1', '2', '3'].includes(firstDigit)) return 'SE';
  if (['8', '9'].includes(firstDigit)) return 'S';
  if (firstDigit === '7') return 'CO';
  if (['4', '5'].includes(firstDigit)) return 'NE';
  return 'N';
}

export function getCarrierTrackingUrl(carrier?: string, trackingCode?: string): string {
  const code = (trackingCode || '').trim();
  const c = (carrier || '').toLowerCase();
  if (c.includes('jadlog')) {
    return `https://www.jadlog.com.br/siteInstitucional/tracking.jad?cte=${encodeURIComponent(code)}`;
  }
  if (c.includes('loggi')) {
    return `https://www.loggi.com/rastreador/${encodeURIComponent(code)}`;
  }
  return `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(code)}`;
}

export function calculateShippingOptions(
  cepRaw: string,
  stateUf: string,
  items: CartItem[],
  subtotal: number,
  settings: StoreSettings = DEFAULT_STORE_SETTINGS
): ShippingOption[] {
  const cleanCep = cepRaw.replace(/\D/g, '');
  if (cleanCep.length !== 8 || items.length === 0) return [];

  const region = getRegionByUfOrCep(stateUf, cleanCep);
  const defaultRegionRates = DEFAULT_STORE_SETTINGS.regionalRates[region];
  const rates: RegionalShippingRate = {
    ...defaultRegionRates,
    ...(settings.regionalRates?.[region] || {})
  };

  const totalGrams = items.reduce((acc, item) => acc + (item.weightGrams || 250) * item.quantity, 0);
  const extraKg = Math.max(0, Math.ceil((totalGrams - 500) / 1000));
  const extraWeightCost = extraKg * (rates.extraPerKg || 6);

  const allItemsFreeShipping = items.every((i) => i.freeShipping);
  const qualifiesFreeShipping =
    allItemsFreeShipping ||
    (settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold);

  const options: ShippingOption[] = [];

  if (qualifiesFreeShipping) {
    options.push({
      id: 'free',
      name: 'Frete Grátis (Envio Econômico c/ Rastreio)',
      company: 'Correios / Transportadora',
      price: 0,
      estimatedDays: rates.jadlogPackageDays || rates.pacDays,
      description: 'Desbloqueado para o seu pedido!'
    });
  }

  if (settings.enableMiniEnvios && totalGrams <= 350 && !qualifiesFreeShipping) {
    options.push({
      id: 'mini',
      name: 'Correios Mini Envios',
      company: 'Correios',
      price: Number((settings.miniEnviosPrice || 16.9).toFixed(2)),
      estimatedDays: settings.miniEnviosDays || '6 a 10 dias úteis',
      description: 'Econômico com rastreamento para pedidos leves'
    });
  }

  if (settings.enableLoggi !== false) {
    const loggiBase = rates.loggiExpressBase ?? defaultRegionRates.loggiExpressBase ?? 21.5;
    const loggiPrice = Number((loggiBase + extraWeightCost * 0.9).toFixed(2));
    options.push({
      id: 'loggi_express',
      name: 'Loggi Express',
      company: 'Loggi',
      price: loggiPrice,
      estimatedDays: rates.loggiExpressDays || defaultRegionRates.loggiExpressDays || '1 a 4 dias úteis',
      description: 'Transportadora expressa com rastreio em tempo real'
    });
  }

  if (settings.enableJadlog !== false) {
    const jadlogPkgBase = rates.jadlogPackageBase ?? defaultRegionRates.jadlogPackageBase ?? 19.9;
    const jadlogComBase = rates.jadlogComBase ?? defaultRegionRates.jadlogComBase ?? 27.9;
    const jadlogPkgPrice = Number((jadlogPkgBase + extraWeightCost * 0.85).toFixed(2));
    const jadlogComPrice = Number((jadlogComBase + extraWeightCost * 1.15).toFixed(2));

    options.push({
      id: 'jadlog_package',
      name: 'Jadlog .Package',
      company: 'Jadlog',
      price: jadlogPkgPrice,
      estimatedDays: rates.jadlogPackageDays || defaultRegionRates.jadlogPackageDays || '3 a 7 dias úteis',
      description: 'Modalidade econômica Jadlog com seguro e rastreamento'
    });

    options.push({
      id: 'jadlog_com',
      name: 'Jadlog .Com (Expresso)',
      company: 'Jadlog',
      price: jadlogComPrice,
      estimatedDays: rates.jadlogComDays || defaultRegionRates.jadlogComDays || '1 a 4 dias úteis',
      description: 'Modalidade expressa prioritária Jadlog com seguro total'
    });
  }

  const pacPrice = Number((rates.pacBase + extraWeightCost).toFixed(2));
  const sedexPrice = Number((rates.sedexBase + extraWeightCost * 1.35).toFixed(2));

  options.push({
    id: 'pac',
    name: 'Correios PAC',
    company: 'Correios',
    price: pacPrice,
    estimatedDays: rates.pacDays,
    description: 'Entrega econômica dos Correios com seguro e código de rastreio'
  });

  options.push({
    id: 'sedex',
    name: 'Correios SEDEX',
    company: 'Correios',
    price: sedexPrice,
    estimatedDays: rates.sedexDays,
    description: 'Entrega expressa prioritária dos Correios com seguro e rastreio'
  });

  return options.sort((a, b) => a.price - b.price);
}

// --- STORE SETTINGS FIRESTORE ---
export async function fetchStoreSettings(): Promise<StoreSettings> {
  const cached = readBrowserCache<StoreSettings>('ld_cache_storeSettings_v1');
  try {
    const snap = await getDoc(doc(db, 'homeSettings', 'storeSettings'));
    if (snap.exists()) {
      const rawData = snap.data() as Partial<StoreSettings>;
      const rawRegional = (rawData?.regionalRates || {}) as Partial<StoreSettings['regionalRates']>;
      const merged: StoreSettings = {
        ...DEFAULT_STORE_SETTINGS,
        ...rawData,
        enableJadlog: rawData.enableJadlog ?? DEFAULT_STORE_SETTINGS.enableJadlog,
        enableLoggi: rawData.enableLoggi ?? DEFAULT_STORE_SETTINGS.enableLoggi,
        regionalRates: {
          SE: { ...DEFAULT_STORE_SETTINGS.regionalRates.SE, ...(rawRegional.SE || {}) },
          S: { ...DEFAULT_STORE_SETTINGS.regionalRates.S, ...(rawRegional.S || {}) },
          CO: { ...DEFAULT_STORE_SETTINGS.regionalRates.CO, ...(rawRegional.CO || {}) },
          NE: { ...DEFAULT_STORE_SETTINGS.regionalRates.NE, ...(rawRegional.NE || {}) },
          N: { ...DEFAULT_STORE_SETTINGS.regionalRates.N, ...(rawRegional.N || {}) }
        }
      };
      writeBrowserCache('ld_cache_storeSettings_v1', merged);
      return merged;
    }
  } catch (err) {
    console.warn('Usando configurações padrão de loja:', err);
  }
  return cached || DEFAULT_STORE_SETTINGS;
}

export async function saveStoreSettings(settings: StoreSettings): Promise<void> {
  const path = 'homeSettings/storeSettings';
  try {
    const clean = JSON.parse(JSON.stringify(settings));
    await setDoc(doc(db, 'homeSettings', 'storeSettings'), clean);
    writeBrowserCache('ld_cache_storeSettings_v1', clean);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// --- ORDERS FIRESTORE & LOCAL CACHE ---
export function getLocalOrderIds(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalOrderId(orderId: string): void {
  try {
    const current = getLocalOrderIds();
    if (!current.includes(orderId)) {
      const next = [orderId, ...current].slice(0, 30);
      localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore
  }
}

export function generateOrderId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `LD-${y}${m}${d}-${rand}`;
}

export async function createStoreOrder(order: StoreOrder): Promise<StoreOrder> {
  const path = `storeOrders/${order.id}`;
  try {
    const clean = JSON.parse(JSON.stringify(order));
    await setDoc(doc(db, 'storeOrders', order.id), clean);
    saveLocalOrderId(order.id);
    return order;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateStoreOrderFields(
  orderId: string,
  fields: Partial<StoreOrder>
): Promise<void> {
  const path = `storeOrders/${orderId}`;
  try {
    const payload = JSON.parse(
      JSON.stringify({
        ...fields,
        updatedAt: new Date().toISOString()
      })
    );
    await updateDoc(doc(db, 'storeOrders', orderId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function getStoreOrderById(orderId: string): Promise<StoreOrder | null> {
  const cleanId = orderId.trim().toUpperCase();
  const path = `storeOrders/${cleanId}`;
  try {
    const snap = await getDoc(doc(db, 'storeOrders', cleanId));
    if (snap.exists()) {
      return snap.data() as StoreOrder;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function fetchCustomerOrders(userId?: string, userEmail?: string): Promise<StoreOrder[]> {
  const ordersMap = new Map<string, StoreOrder>();

  // 1. Fetch by userId if logged in
  if (userId) {
    try {
      const q = query(collection(db, 'storeOrders'), where('userId', '==', userId));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const data = d.data() as StoreOrder;
        ordersMap.set(data.id, data);
      });
    } catch (err) {
      console.warn('Erro ao buscar pedidos por userId:', err);
    }
  }

  // 2. Fetch by userEmail if logged in
  if (userEmail) {
    try {
      const q = query(collection(db, 'storeOrders'), where('userEmail', '==', userEmail));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const data = d.data() as StoreOrder;
        ordersMap.set(data.id, data);
      });
    } catch (err) {
      console.warn('Erro ao buscar pedidos por email:', err);
    }
  }

  // 3. Also load any orders stored in local browser history
  const localIds = getLocalOrderIds();
  for (const id of localIds) {
    if (!ordersMap.has(id)) {
      try {
        const snap = await getDoc(doc(db, 'storeOrders', id));
        if (snap.exists()) {
          ordersMap.set(id, snap.data() as StoreOrder);
        }
      } catch {
        // ignore
      }
    }
  }

  const list = Array.from(ordersMap.values());
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return list;
}

export function subscribeAllStoreOrders(
  onOrders: (orders: StoreOrder[]) => void,
  onError?: (err: unknown) => void
) {
  const path = 'storeOrders';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as StoreOrder);
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onOrders(list);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

// --- MERCADO PAGO API CLIENT HELPERS ---
export async function generatePixForOrder(order: StoreOrder): Promise<{
  paymentId: string;
  status: PaymentStatus;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl?: string;
}> {
  const itemSummary = order.items
    .map((i) => `${i.quantity}x ${i.title}${i.variationName ? ` (${i.variationName})` : ''}`)
    .join(', ');

  const res = await fetch('/api/mercadopago/pix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: order.id,
      amount: order.totalAmount,
      description: `Pedido ${order.id}: ${itemSummary}`.slice(0, 240),
      payerEmail: order.userEmail,
      payerName: order.customerName,
      payerCpf: order.customerCpf
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao gerar PIX no Mercado Pago.');
  }

  await updateStoreOrderFields(order.id, {
    mpPaymentId: data.paymentId,
    mpPixQrCode: data.qrCode,
    mpPixQrCodeBase64: data.qrCodeBase64,
    mpPixTicketUrl: data.ticketUrl || '',
    paymentStatus: (data.status as PaymentStatus) || 'pending'
  });

  return data;
}

export async function generateCheckoutPreferenceForOrder(order: StoreOrder): Promise<{
  preferenceId: string;
  initPoint: string;
}> {
  const res = await fetch('/api/mercadopago/preference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: order.id,
      items: order.items,
      shippingCost: order.shippingCost,
      discountAmount: order.discountAmount,
      originUrl: window.location.origin,
      payer: {
        name: order.customerName,
        email: order.userEmail,
        cpf: order.customerCpf,
        cep: order.shippingAddress.cep,
        street: order.shippingAddress.street,
        number: order.shippingAddress.number,
        shippingMethodName: order.shippingMethodName
      }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Erro ao criar link de pagamento no Mercado Pago.');
  }

  await updateStoreOrderFields(order.id, {
    mpPreferenceId: data.preferenceId,
    mpInitPoint: data.initPoint
  });

  return data;
}

export async function syncOrderPaymentStatus(order: StoreOrder): Promise<StoreOrder> {
  try {
    let mpStatus: string | undefined;
    let mpPaymentId = order.mpPaymentId;

    if (mpPaymentId) {
      const res = await fetch(`/api/mercadopago/payment/${encodeURIComponent(mpPaymentId)}`);
      if (res.ok) {
        const data = await res.json();
        mpStatus = data.status;
      }
    } else {
      const res = await fetch(`/api/mercadopago/order/${encodeURIComponent(order.id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found) {
          mpStatus = data.status;
          mpPaymentId = data.paymentId;
        }
      }
    }

    if (mpStatus && mpStatus !== order.paymentStatus) {
      const isApproved = mpStatus === 'approved';
      const nextOrderStatus: OrderStatus = isApproved
        ? order.hasPreOrderItems
          ? 'pre_order_reserved'
          : 'paid'
        : mpStatus === 'cancelled' || mpStatus === 'rejected'
        ? 'cancelled'
        : order.orderStatus;

      const updates: Partial<StoreOrder> = {
        paymentStatus: mpStatus as PaymentStatus,
        orderStatus: nextOrderStatus,
        ...(mpPaymentId ? { mpPaymentId } : {}),
        ...(isApproved && !order.paidAt ? { paidAt: new Date().toISOString() } : {})
      };

      await updateStoreOrderFields(order.id, updates);
      return { ...order, ...updates };
    }
  } catch (err) {
    console.warn('Falha ao sincronizar status no Mercado Pago:', err);
  }
  return order;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, { label: string; color: string; desc: string }> = {
  awaiting_payment: {
    label: 'Aguardando Pagamento',
    color: 'text-amber-300 bg-amber-950/80 border-amber-700/60',
    desc: 'Conclua o pagamento via PIX ou Cartão para confirmar seu pedido.'
  },
  paid: {
    label: 'Pagamento Aprovado',
    color: 'text-emerald-300 bg-emerald-950/80 border-emerald-600/60',
    desc: 'Pagamento confirmado! Seu pedido entrará em separação.'
  },
  pre_order_reserved: {
    label: 'Pré-Venda Confirmada',
    color: 'text-purple-200 bg-purple-950/90 border-purple-500/60',
    desc: 'Sua vaga no lote de Pré-Venda está garantida e paga!'
  },
  preparing_shipment: {
    label: 'Em Separação / Embalagem',
    color: 'text-cyan-300 bg-cyan-950/80 border-cyan-600/60',
    desc: 'Estamos preparando e embalando seu pedido com proteção.'
  },
  shipped: {
    label: 'Pedido Enviado',
    color: 'text-blue-300 bg-blue-950/80 border-blue-500/60',
    desc: 'Seu pedido foi despachado! Acompanhe pelo código de rastreio.'
  },
  delivered: {
    label: 'Entregue',
    color: 'text-emerald-300 bg-emerald-950/90 border-emerald-500/70',
    desc: 'Pedido entregue no endereço destinatário. Bom jogo!'
  },
  cancelled: {
    label: 'Cancelado',
    color: 'text-red-300 bg-red-950/80 border-red-700/60',
    desc: 'Este pedido foi cancelado.'
  }
};

// --- MERCADO DA COMUNIDADE (COMÉRCIO LIVRE ENTRE JOGADORES + AVALIAÇÕES) ---
export function subscribeMarketplaceListings(
  onListings: (listings: MarketplaceListing[]) => void,
  onError?: (err: unknown) => void
) {
  const path = 'marketplaceListings';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as MarketplaceListing);
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      onListings(list);
    },
    (err) => {
      if (onError) onError(err);
      console.warn('Erro ao assinar marketplaceListings:', err);
    }
  );
}

export async function createMarketplaceListing(listing: MarketplaceListing): Promise<MarketplaceListing> {
  const path = `marketplaceListings/${listing.id}`;
  try {
    const enriched: MarketplaceListing = {
      ...listing,
      formattedPrice: formatBRL(listing.price),
      createdAt: listing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const clean = JSON.parse(JSON.stringify(enriched));
    await setDoc(doc(db, 'marketplaceListings', listing.id), clean);
    return enriched;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateMarketplaceListing(
  listingId: string,
  fields: Partial<MarketplaceListing>
): Promise<void> {
  const path = `marketplaceListings/${listingId}`;
  try {
    const extra: Partial<MarketplaceListing> = {
      updatedAt: new Date().toISOString()
    };
    if (typeof fields.price === 'number') {
      extra.formattedPrice = formatBRL(fields.price);
    }
    const payload = JSON.parse(JSON.stringify({ ...fields, ...extra }));
    await updateDoc(doc(db, 'marketplaceListings', listingId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteMarketplaceListing(listingId: string): Promise<void> {
  const path = `marketplaceListings/${listingId}`;
  try {
    await deleteDoc(doc(db, 'marketplaceListings', listingId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- SISTEMA DE AVALIAÇÃO POR COMPRADOR (REPUTAÇÃO DE VENDEDORES) ---
export function subscribeMarketplaceSellerReviews(
  onReviews: (reviews: MarketplaceSellerReview[]) => void,
  onError?: (err: unknown) => void
) {
  const path = 'marketplaceSellerReviews';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as MarketplaceSellerReview);
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      onReviews(list);
    },
    (err) => {
      if (onError) onError(err);
      console.warn('Erro ao assinar marketplaceSellerReviews:', err);
    }
  );
}

export async function createMarketplaceSellerReview(
  review: MarketplaceSellerReview
): Promise<MarketplaceSellerReview> {
  const path = `marketplaceSellerReviews/${review.id}`;
  try {
    const clean = JSON.parse(
      JSON.stringify({
        ...review,
        rating: Math.max(1, Math.min(5, Math.round(review.rating || 5))),
        createdAt: review.createdAt || new Date().toISOString()
      })
    );
    await setDoc(doc(db, 'marketplaceSellerReviews', review.id), clean);
    return clean;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteMarketplaceSellerReview(reviewId: string): Promise<void> {
  const path = `marketplaceSellerReviews/${reviewId}`;
  try {
    await deleteDoc(doc(db, 'marketplaceSellerReviews', reviewId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}


