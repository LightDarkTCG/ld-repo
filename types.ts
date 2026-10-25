import { LucideIcon } from 'lucide-react';

export type CardType = 'Herói' | 'Combatente' | 'Equipamento' | 'Efeito';

export const LEGADO_RARITIES = [
  'Legado Comum',
  'Legado Incomum',
  'Legado Rara',
  'Legado Muito Rara',
  'Legado Lendária',
  'Legado Limitada'
] as const;

export const MODERNO_RARITIES = [
  'Moderno Comum',
  'Moderno Incomum',
  'Moderno Rara',
  'Moderno Muito Rara',
  'Moderno Super Rara',
  'Moderno Lendária',
  'Moderno Super Lendária',
  'Moderno Exclusiva',
  'Moderno Super Exclusiva',
  'Moderno Limitada',
  'Moderno Macroversal'
] as const;

export const ALL_OFFICIAL_RARITIES = [
  ...LEGADO_RARITIES,
  ...MODERNO_RARITIES
] as const;

export type LegadoRarity = typeof LEGADO_RARITIES[number];
export type ModernoRarity = typeof MODERNO_RARITIES[number];
export type CardRarity = LegadoRarity | ModernoRarity | string;

export interface RarityGuideItem {
  id: string;
  name: string;
  frame: 'Moderno' | 'Legado';
  badge?: string;
  iconUrl?: string;
  description: string;
  color?: string;
  isUniquePerYear?: boolean;
}

export type TierGuideItem = RarityGuideItem;

export interface CardVariationItem {
  id: string;
  name: string;
  imageUrl: string;
  frame?: 'Legado' | 'Moderno';
  code?: string;
  collection?: string;
  rarity?: string;
  tier?: string;
  isCatalogCover?: boolean;
  isRarePrint?: boolean;
  requiresAdminVerification?: boolean;
  maxPrintCopies?: number;
}

export interface RarePrintVersionConfig {
  isRarePrint: boolean;
  maxPrintCopies: number;
  updatedAt?: string;
}

export interface CardData {
  id?: string;
  name: string;
  type: CardType;
  archetype: string;
  collection: string;
  frame?: 'Legado' | 'Moderno';
  ct: number;
  attack?: number;
  defense?: number;
  description: string;
  imageUrl?: string;
  imageGradient?: string;
  code: string;
  lore?: string;
  deleted?: boolean;
  isHidden?: boolean;
  rarity?: string;
  tier?: string;
  variants?: CardVariationItem[];
  parentCode?: string;
  isVariation?: boolean;
  variationType?: string;
  // Capa do Catálogo
  isCatalogCover?: boolean;
  catalogCoverImageUrl?: string;
  catalogCoverFrame?: 'Legado' | 'Moderno';
  catalogCoverVariationId?: string;
  // Tiragens Raras & Verificação Obrigatória no Álbum (por versão/imagem)
  isRarePrint?: boolean;
  maxPrintCopies?: number; // Ex: 1 cópia única
  requiresAdminVerification?: boolean;
  rarePrintByImage?: Record<string, RarePrintVersionConfig>;
}

export interface AlbumVerificationRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhoto?: string;
  cardCode: string;
  baseCardCode: string;
  cardName: string;
  cardImageUrl?: string;
  cardCollection?: string;
  cardFrame?: 'Legado' | 'Moderno' | string;
  maxPrintCopies?: number;
  proofNote?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  adminNote?: string;
}

export interface ArchetypeData {
  name: string;
  imageUrl?: string;
  icon?: LucideIcon;
  color?: string;
  description: string;
  patchDate?: string;
  isNew?: boolean;
  updatedAt?: string;
}

export interface ProductMediaItem {
  type: 'image' | 'video';
  url: string;
}

export interface ProductPriceVariation {
  id?: string;
  name: string;
  price: string;
  description?: string;
  buttonLink?: string;
  buttonText?: string;
  badge?: string;
  isDefault?: boolean;
  stock?: number;
  weightGrams?: number;
}

export type StoreProductCategory =
  | 'decks'
  | 'cartas_avulsas'
  | 'playmats'
  | 'promocoes'
  | 'pre_venda'
  | 'kits';

export interface ExclusiveProduct {
  id?: string;
  title: string;
  description: string;
  category?: string;
  storeCategory?: StoreProductCategory;
  isPromotion?: boolean;
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  mediaList?: ProductMediaItem[];
  cardCodes?: string;
  badge?: string;
  price?: string;
  originalPrice?: string;
  priceVariations?: ProductPriceVariation[];
  buttonText?: string;
  buttonLink?: string;
  isActive?: boolean;
  isButtonActive?: boolean;
  noLinkMessage?: string;
  // Loja Interna, Pré-Venda e Cálculo de Frete
  isPreOrder?: boolean;
  preOrderReleaseDate?: string;
  preOrderBonus?: string;
  stock?: number;
  weightGrams?: number;
  freeShipping?: boolean;
  allowInternalCheckout?: boolean;
}

export interface CartItem {
  cartItemId: string;
  productId: string;
  title: string;
  variationName?: string;
  badge?: string;
  unitPrice: number;
  formattedPrice: string;
  quantity: number;
  imageUrl?: string;
  isPreOrder?: boolean;
  preOrderReleaseDate?: string;
  weightGrams: number;
  freeShipping?: boolean;
  maxStock?: number;
}

export interface ShippingOption {
  id: 'pac' | 'sedex' | 'mini' | 'jadlog_package' | 'jadlog_com' | 'loggi_express' | 'free';
  name: string;
  company: string;
  price: number;
  estimatedDays: string;
  description?: string;
}

export interface StoreCoupon {
  code: string;
  discountPercent?: number;
  discountFixed?: number;
  minOrderValue?: number;
  isActive: boolean;
}

export interface RegionalShippingRate {
  pacBase: number;
  sedexBase: number;
  pacDays: string;
  sedexDays: string;
  jadlogPackageBase?: number;
  jadlogPackageDays?: string;
  jadlogComBase?: number;
  jadlogComDays?: string;
  loggiExpressBase?: number;
  loggiExpressDays?: string;
  extraPerKg: number;
}

export interface StoreSettings {
  originCep: string;
  freeShippingThreshold: number;
  handlingDays: number;
  enableMiniEnvios: boolean;
  miniEnviosPrice: number;
  miniEnviosDays: string;
  enableJadlog?: boolean;
  enableLoggi?: boolean;
  regionalRates: {
    SE: RegionalShippingRate;
    S: RegionalShippingRate;
    CO: RegionalShippingRate;
    NE: RegionalShippingRate;
    N: RegionalShippingRate;
  };
  coupons: StoreCoupon[];
  whatsappSupport: string;
  storeNotice?: string;
}

export interface StoreOrderAddress {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

export type OrderStatus =
  | 'awaiting_payment'
  | 'paid'
  | 'pre_order_reserved'
  | 'preparing_shipment'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'in_process';

export interface StoreOrder {
  id: string;
  userId?: string;
  userEmail: string;
  customerName: string;
  customerCpf: string;
  customerPhone: string;
  shippingAddress: StoreOrderAddress;
  items: CartItem[];
  subtotal: number;
  shippingMethodId: string;
  shippingMethodName: string;
  shippingCost: number;
  shippingEstimatedDays: string;
  couponCode?: string;
  discountAmount: number;
  totalAmount: number;
  hasPreOrderItems: boolean;
  preOrderReleaseNotes?: string;
  paymentMethod: 'pix' | 'checkout_pro';
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  mpPaymentId?: string;
  mpPreferenceId?: string;
  mpInitPoint?: string;
  mpPixQrCode?: string;
  mpPixQrCodeBase64?: string;
  mpPixTicketUrl?: string;
  trackingCode?: string;
  trackingCarrier?: string;
  customerNotes?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  shippedAt?: string;
}

