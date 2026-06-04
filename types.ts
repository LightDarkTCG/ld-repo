import { LucideIcon } from 'lucide-react';

export type CardType = 'Herói' | 'Combatente' | 'Equipamento' | 'Efeito';

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
}

export interface ArchetypeData {
  name: string;
  imageUrl?: string;
  icon?: LucideIcon;
  color?: string;
  description: string;
}
