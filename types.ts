import { LucideIcon } from 'lucide-react';

export type CardType = 'Herói' | 'Combatente' | 'Equipamento' | 'Efeito';

export interface CardVariationItem {
  id: string;
  name: string;
  imageUrl: string;
  frame?: 'Legado' | 'Moderno';
  code?: string;
  rarity?: string;
}

export interface CardData {
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
  variants?: CardVariationItem[];
  parentCode?: string;
  isVariation?: boolean;
  variationType?: string;
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

export interface ExclusiveProduct {
  title: string;
  description: string;
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  mediaList?: ProductMediaItem[];
  cardCodes?: string;
  badge?: string;
  price?: string;
  buttonText?: string;
  buttonLink?: string;
  isActive?: boolean;
  isButtonActive?: boolean;
  noLinkMessage?: string;
}
