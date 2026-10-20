import { LucideIcon } from 'lucide-react';

export type CardType = 'Herói' | 'Combatente' | 'Equipamento' | 'Efeito';

export interface CardVariationItem {
  id: string;
  name: string;
  imageUrl: string;
  frame?: 'Legado' | 'Moderno';
  code?: string;
  rarity?: string;
  tier?: string;
  isCatalogCover?: boolean;
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
  // Tiragens Raras & Verificação Obrigatória no Álbum
  isRarePrint?: boolean;
  maxPrintCopies?: number; // Ex: 1 cópia única
  requiresAdminVerification?: boolean;
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
}

export interface ExclusiveProduct {
  title: string;
  description: string;
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  mediaList?: ProductMediaItem[];
  cardCodes?: string;
  badge?: string;
  price?: string;
  priceVariations?: ProductPriceVariation[];
  buttonText?: string;
  buttonLink?: string;
  isActive?: boolean;
  isButtonActive?: boolean;
  noLinkMessage?: string;
}
