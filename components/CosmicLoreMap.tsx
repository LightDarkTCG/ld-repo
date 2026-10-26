import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Compass, Sparkles, Plus, Edit3, Trash2, X, ChevronRight, ChevronLeft, ChevronUp, ChevronDown,
  ArrowUp, ArrowDown, Upload, Film, Image as ImageIcon, Type, Quote, Layers, Move3d, RotateCcw,
  Maximize2, Minimize2, BookOpen, Search, Check, Loader2, Eye, EyeOff, Shield, Flame, Orbit, Clock
} from 'lucide-react';
import { CardData } from '../types';
import { collectionsList } from '../data';

export interface LoreContentBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'quote' | 'image' | 'video' | 'gallery';
  text?: string;
  caption?: string;
  mediaUrl?: string;
  mediaList?: { url: string; caption?: string; type?: 'image' | 'video' }[];
}

export interface CosmicLocationTimelineEvent {
  id: string;
  dateLabel: string;
  title: string;
  description: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
}

export type CosmicPlaneId = 'macroverso_13' | 'paralelo_corrupcao' | 'rede_do_caos';

export type CosmicCategory =
  | 'universo_principal'
  | 'universo_paralelo'
  | 'porta_corrupcao'
  | 'plano_paralelo'
  | 'borda_macroversal'
  | 'extraverso'
  | 'anomalia_errante'
  | 'macroverso'
  | 'galaxia'
  | 'realidade'
  | 'planeta'
  | 'conceito'
  | 'anomalia';

export type CosmicVisualType =
  | 'spiral_galaxy'
  | 'mecha_universe'
  | 'corrupted_well'
  | 'chaos_network'
  | 'macro_prison'
  | 'extraverse_castle'
  | 'the_veil'
  | 'pathway_of_doors'
  | 'wandering_pocket'
  | 'mirror_macroverse'
  | 'starship_vessel'
  | 'festival_arena'
  | 'ringed_planet'
  | 'fractured_reality'
  | 'black_hole'
  | 'nebula_cluster'
  | 'concept_monolith';

export type CosmicFactionId = 'Aliança' | 'Caos' | 'Asmonious' | 'Neutro';

export interface CosmicTerritoryData {
  id: string;
  name: string;
  faction: CosmicFactionId;
  color: string;
  ringIndex?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngleDeg?: number;
  endAngleDeg?: number;
  position: { x: number; y: number; z: number };
  radius: number;
  controlPercent: number;
  planeId: CosmicPlaneId | 'all';
}

export interface CosmicNodeData {
  id: string;
  name: string;
  subtitle: string;
  planeId?: CosmicPlaneId;
  targetPlaneId?: CosmicPlaneId;
  category: CosmicCategory;
  visualType: CosmicVisualType;
  primaryColor: string;
  secondaryColor: string;
  scale: number;
  position: { x: number; y: number; z: number };
  parentId?: string;
  connectedNodeIds?: string[];
  coverImageUrl?: string;
  summary: string;
  blocks: LoreContentBlock[];
  timelineEvents?: CosmicLocationTimelineEvent[];
  linkedCardCodes?: string[];
  linkedArchetypes?: string[];
  linkedCollections?: string[];
  cardTrajectoryStep?: Record<string, number>;
  customStats?: { label: string; value: string }[];
  isWandering?: boolean;
  isTravelingShip?: boolean;
  isPortalGateway?: boolean;
  cosmologyVersion?: number;
  orderIndex: number;
}

export const FACTION_PRESETS: Record<
  CosmicFactionId,
  { label: string; color: string; borderHex: string; badgeBg: string }
> = {
  Aliança: {
    label: 'Aliança',
    color: '#d97706',
    borderHex: '#f59e0b',
    badgeBg: 'bg-amber-950/90 border-amber-400/60 text-amber-200'
  },
  Caos: {
    label: 'Caos',
    color: '#7e22ce',
    borderHex: '#a855f7',
    badgeBg: 'bg-purple-950/90 border-purple-400/60 text-purple-200'
  },
  Asmonious: {
    label: 'Asmonious',
    color: '#b91c1c',
    borderHex: '#ef4444',
    badgeBg: 'bg-red-950/90 border-red-400/60 text-red-200'
  },
  Neutro: {
    label: 'Neutro',
    color: '#1e293b',
    borderHex: '#64748b',
    badgeBg: 'bg-slate-900/80 border-slate-600/50 text-slate-400'
  }
};

export const PLANE_DEFINITIONS: {
  id: CosmicPlaneId | 'all';
  label: string;
  shortLabel: string;
  description: string;
  accentColor: string;
}[] = [
  {
    id: 'macroverso_13',
    label: 'Macroverso 13',
    shortLabel: 'Macroverso 13',
    description: 'Plano principal do Macroverso 13.',
    accentColor: '#d4af37'
  },
  {
    id: 'paralelo_corrupcao',
    label: 'Paralelo da Corrupção',
    shortLabel: 'Corrupção (Asmonious)',
    description: 'Plano paralelo da Corrupção.',
    accentColor: '#ef4444'
  },
  {
    id: 'rede_do_caos',
    label: 'Rede do Caos',
    shortLabel: 'Rede do Caos',
    description: 'Plano paralelo da Rede do Caos.',
    accentColor: '#a855f7'
  },
  {
    id: 'all',
    label: 'Visão Multidimensional (Todos)',
    shortLabel: 'Todos os Planos',
    description: 'Visualização simultânea de todos os planos.',
    accentColor: '#38bdf8'
  }
];

const WANDERING_POCKET_WAYPOINTS: { x: number; y: number; z: number; sectorName: string }[] = [
  { x: 16, y: 9, z: -15, sectorName: 'Setor 1' },
  { x: -30, y: 12, z: 10, sectorName: 'Setor 2' },
  { x: 34, y: -5, z: 19, sectorName: 'Setor 3' },
  { x: -16, y: 14, z: 32, sectorName: 'Setor 4' },
  { x: 40, y: 12, z: -22, sectorName: 'Setor 5' },
  { x: -24, y: -7, z: -28, sectorName: 'Setor 6' }
];

// Helper to compute polar sector centroid in 3D space
const makePolarSector = (
  id: string,
  name: string,
  ringIndex: number,
  innerRadius: number,
  outerRadius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  faction: CosmicFactionId,
  controlPercent = 100,
  planeId: CosmicPlaneId | 'all' = 'macroverso_13'
): CosmicTerritoryData => {
  const midR = (innerRadius + outerRadius) * 0.5;
  const midRad = (((startAngleDeg + endAngleDeg) * 0.5) * Math.PI) / 180;
  return {
    id,
    name,
    faction,
    color: FACTION_PRESETS[faction].color,
    ringIndex,
    innerRadius,
    outerRadius,
    startAngleDeg,
    endAngleDeg,
    position: {
      x: Math.round(Math.cos(midRad) * midR * 10) / 10,
      y: 0,
      z: Math.round(Math.sin(midRad) * midR * 10) / 10
    },
    radius: Math.round((outerRadius - innerRadius) * 0.5),
    controlPercent,
    planeId
  };
};

// Complete Polar Sector Grid — Numbered strictly Setor 1 to Setor 36
export const DEFAULT_COSMIC_TERRITORIES: CosmicTerritoryData[] = [
  // ANEL 1 (r = 10..23) — Setor 1 a Setor 7
  makePolarSector('sec_r1_1', 'Setor 1', 1, 10, 23, 0, 52, 'Aliança', 100),
  makePolarSector('sec_r1_2', 'Setor 2', 1, 10, 23, 52, 104, 'Caos', 88),
  makePolarSector('sec_r1_3', 'Setor 3', 1, 10, 23, 104, 156, 'Neutro', 0),
  makePolarSector('sec_r1_4', 'Setor 4', 1, 10, 23, 156, 208, 'Neutro', 0),
  makePolarSector('sec_r1_5', 'Setor 5', 1, 10, 23, 208, 260, 'Asmonious', 94),
  makePolarSector('sec_r1_6', 'Setor 6', 1, 10, 23, 260, 310, 'Neutro', 0),
  makePolarSector('sec_r1_7', 'Setor 7', 1, 10, 23, 310, 360, 'Aliança', 92),

  // ANEL 2 (r = 23..37) — Setor 8 a Setor 16
  makePolarSector('sec_r2_1', 'Setor 8', 2, 23, 37, 14, 54, 'Aliança', 95),
  makePolarSector('sec_r2_2', 'Setor 9', 2, 23, 37, 54, 94, 'Asmonious', 96),
  makePolarSector('sec_r2_3', 'Setor 10', 2, 23, 37, 94, 134, 'Caos', 92),
  makePolarSector('sec_r2_4', 'Setor 11', 2, 23, 37, 134, 174, 'Neutro', 0),
  makePolarSector('sec_r2_5', 'Setor 12', 2, 23, 37, 174, 214, 'Neutro', 0),
  makePolarSector('sec_r2_6', 'Setor 13', 2, 23, 37, 214, 254, 'Asmonious', 98),
  makePolarSector('sec_r2_7', 'Setor 14', 2, 23, 37, 254, 294, 'Asmonious', 89),
  makePolarSector('sec_r2_8', 'Setor 15', 2, 23, 37, 294, 334, 'Neutro', 0),
  makePolarSector('sec_r2_9', 'Setor 16', 2, 23, 37, 334, 374, 'Aliança', 90),

  // ANEL 3 (r = 37..51) — Setor 17 a Setor 26
  makePolarSector('sec_r3_1', 'Setor 17', 3, 37, 51, 0, 36, 'Aliança', 96),
  makePolarSector('sec_r3_2', 'Setor 18', 3, 37, 51, 36, 72, 'Asmonious', 92),
  makePolarSector('sec_r3_3', 'Setor 19', 3, 37, 51, 72, 108, 'Caos', 85),
  makePolarSector('sec_r3_4', 'Setor 20', 3, 37, 51, 108, 144, 'Neutro', 0),
  makePolarSector('sec_r3_5', 'Setor 21', 3, 37, 51, 144, 180, 'Neutro', 0),
  makePolarSector('sec_r3_6', 'Setor 22', 3, 37, 51, 180, 216, 'Neutro', 0),
  makePolarSector('sec_r3_7', 'Setor 23', 3, 37, 51, 216, 252, 'Asmonious', 95),
  makePolarSector('sec_r3_8', 'Setor 24', 3, 37, 51, 252, 288, 'Asmonious', 91),
  makePolarSector('sec_r3_9', 'Setor 25', 3, 37, 51, 288, 324, 'Asmonious', 87),
  makePolarSector('sec_r3_10', 'Setor 26', 3, 37, 51, 324, 360, 'Aliança', 94),

  // ANEL 4 (r = 51..65) — Setor 27 a Setor 36
  makePolarSector('sec_r4_1', 'Setor 27', 4, 51, 65, 18, 54, 'Aliança', 91),
  makePolarSector('sec_r4_2', 'Setor 28', 4, 51, 65, 54, 90, 'Neutro', 0),
  makePolarSector('sec_r4_3', 'Setor 29', 4, 51, 65, 90, 126, 'Caos', 84),
  makePolarSector('sec_r4_4', 'Setor 30', 4, 51, 65, 126, 162, 'Neutro', 0),
  makePolarSector('sec_r4_5', 'Setor 31', 4, 51, 65, 162, 198, 'Neutro', 0),
  makePolarSector('sec_r4_6', 'Setor 32', 4, 51, 65, 198, 234, 'Neutro', 0),
  makePolarSector('sec_r4_7', 'Setor 33', 4, 51, 65, 234, 270, 'Asmonious', 100),
  makePolarSector('sec_r4_8', 'Setor 34', 4, 51, 65, 270, 306, 'Neutro', 0),
  makePolarSector('sec_r4_9', 'Setor 35', 4, 51, 65, 306, 342, 'Aliança', 97),
  makePolarSector('sec_r4_10', 'Setor 36', 4, 51, 65, 342, 378, 'Aliança', 93)
];

export const DEFAULT_COSMIC_NODES: CosmicNodeData[] = [
  // ==================== PLANO: MACROVERSO 13 ====================
  {
    id: 'node_universo_principal',
    name: 'Universo Primordial',
    subtitle: '',
    planeId: 'macroverso_13',
    category: 'universo_principal',
    visualType: 'spiral_galaxy',
    primaryColor: '#a855f7',
    secondaryColor: '#f59e0b',
    scale: 1.85,
    position: { x: 0, y: 0, z: 0 },
    connectedNodeIds: [
      'node_universo_deusa_lua',
      'node_universo_chamas',
      'node_universo_heroico',
      'node_universo_arkham',
      'node_poco_portal_1',
      'node_caminho_entre_caminhos',
      'node_castelo_extraverso'
    ],
    coverImageUrl: 'https://i.imgur.com/mwRZMe9.png',
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: ['Herdeiro do Caos', 'Insanis', 'Príncipe do Macroverso'],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 0,
    blocks: []
  },
  {
    id: 'node_universo_deusa_lua',
    name: 'Claire de Lune',
    subtitle: '',
    planeId: 'macroverso_13',
    category: 'universo_paralelo',
    visualType: 'spiral_galaxy',
    primaryColor: '#38bdf8',
    secondaryColor: '#c084fc',
    scale: 1.35,
    position: { x: -28, y: 4, z: -20 },
    connectedNodeIds: [
      'node_universo_principal',
      'node_caminho_entre_caminhos',
      'node_macroverso_inverso',
      'node_castelo_extraverso'
    ],
    coverImageUrl: 'https://i.imgur.com/NRJ4RxO.png',
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: ['Deusa da Lua'],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 1,
    blocks: []
  },
  {
    id: 'node_universo_chamas',
    name: 'Fallen Gods',
    subtitle: '',
    planeId: 'macroverso_13',
    category: 'universo_paralelo',
    visualType: 'spiral_galaxy',
    primaryColor: '#f97316',
    secondaryColor: '#ef4444',
    scale: 1.35,
    position: { x: 28, y: 3, z: -18 },
    connectedNodeIds: [
      'node_universo_principal',
      'node_caminho_entre_caminhos',
      'node_fabrica_von',
      'node_festival_torneio'
    ],
    coverImageUrl: 'https://i.imgur.com/71f2OFs.png',
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: ['Mundo em Chamas'],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 2,
    blocks: []
  },
  {
    id: 'node_universo_heroico',
    name: 'Universo Heróico',
    subtitle: '',
    planeId: 'macroverso_13',
    category: 'universo_paralelo',
    visualType: 'spiral_galaxy',
    primaryColor: '#3b82f6',
    secondaryColor: '#facc15',
    scale: 1.35,
    position: { x: -46, y: 5, z: -8 },
    connectedNodeIds: ['node_universo_principal', 'node_universo_arkham', 'node_universo_deusa_lua'],
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: [],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 3,
    blocks: []
  },
  {
    id: 'node_universo_arkham',
    name: 'Universo Arkham',
    subtitle: '',
    planeId: 'macroverso_13',
    category: 'universo_paralelo',
    visualType: 'spiral_galaxy',
    primaryColor: '#6366f1',
    secondaryColor: '#14b8a6',
    scale: 1.35,
    position: { x: -44, y: -3, z: 22 },
    connectedNodeIds: ['node_universo_principal', 'node_universo_heroico', 'node_festival_torneio'],
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: [],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 4,
    blocks: []
  },
  {
    id: 'node_fabrica_von',
    name: 'Fábrica do Von',
    subtitle: '',
    planeId: 'macroverso_13',
    category: 'universo_paralelo',
    visualType: 'spiral_galaxy',
    primaryColor: '#f59e0b',
    secondaryColor: '#38bdf8',
    scale: 1.35,
    position: { x: 48, y: 2, z: 6 },
    connectedNodeIds: ['node_universo_mechs', 'node_universo_chamas', 'node_nave_gina'],
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: [],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 5,
    blocks: []
  },
  {
    id: 'node_universo_mechs',
    name: 'Universo Tecma',
    subtitle: '',
    planeId: 'macroverso_13',
    category: 'universo_paralelo',
    visualType: 'spiral_galaxy',
    primaryColor: '#06b6d4',
    secondaryColor: '#f43f5e',
    scale: 1.45,
    position: { x: 54, y: 6, z: -32 },
    connectedNodeIds: ['node_universo_principal', 'node_fabrica_von', 'node_castelo_extraverso', 'node_nave_gina'],
    coverImageUrl: 'https://i.imgur.com/4vlTSq5.png',
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: ['Mechs e Mangas'],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 6,
    blocks: []
  },
  {
    id: 'node_poco_portal_1',
    name: 'Poço da Corrupção 1',
    subtitle: '',
    planeId: 'macroverso_13',
    targetPlaneId: 'paralelo_corrupcao',
    isPortalGateway: true,
    category: 'porta_corrupcao',
    visualType: 'corrupted_well',
    primaryColor: '#ef4444',
    secondaryColor: '#7f1d1d',
    scale: 1.15,
    position: { x: 18, y: -3, z: 16 },
    connectedNodeIds: ['node_universo_principal', 'node_poco_portal_2'],
    coverImageUrl: 'https://i.imgur.com/ULE363X.png',
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: [],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 7,
    blocks: []
  },
  {
    id: 'node_poco_portal_2',
    name: 'Poço da Corrupção 2',
    subtitle: '',
    planeId: 'macroverso_13',
    targetPlaneId: 'paralelo_corrupcao',
    isPortalGateway: true,
    category: 'porta_corrupcao',
    visualType: 'corrupted_well',
    primaryColor: '#ef4444',
    secondaryColor: '#7f1d1d',
    scale: 1.15,
    position: { x: 36, y: -4, z: 28 },
    connectedNodeIds: ['node_poco_portal_1', 'node_prisao_macroversal'],
    coverImageUrl: 'https://i.imgur.com/ULE363X.png',
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: [],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 8,
    blocks: []
  },
  {
    id: 'node_zona_caotica_sabio',
    name: 'Zona Caótica do Sábio',
    subtitle: '',
    planeId: 'macroverso_13',
    category: 'anomalia_errante',
    visualType: 'wandering_pocket',
    primaryColor: '#eab308',
    secondaryColor: '#a855f7',
    scale: 1.25,
    position: { x: 16, y: 9, z: -15 },
    connectedNodeIds: ['node_universo_principal'],
    coverImageUrl: 'https://i.imgur.com/BZtRZds.png',
    isWandering: true,
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: [],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 9,
    blocks: []
  },
  {
    id: 'node_nave_gina',
    name: 'Nave Macroversal',
    subtitle: '',
    planeId: 'macroverso_13',
    category: 'anomalia_errante',
    visualType: 'starship_vessel',
    primaryColor: '#22d3ee',
    secondaryColor: '#f59e0b',
    scale: 1.2,
    position: { x: -12, y: 14, z: -32 },
    connectedNodeIds: ['node_universo_principal', 'node_universo_mechs', 'node_festival_torneio', 'node_castelo_extraverso'],
    coverImageUrl: 'https://i.imgur.com/s1bLm2Z.png',
    isTravelingShip: true,
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: [],
    linkedArchetypes: [],
    linkedCardCodes: ['2025/0001/00190'],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 10,
    blocks: []
  },
  {
    id: 'node_festival_torneio',
    name: 'O Festival',
    subtitle: '',
    planeId: 'macroverso_13',
    category: 'borda_macroversal',
    visualType: 'festival_arena',
    primaryColor: '#f59e0b',
    secondaryColor: '#ec4899',
    scale: 1.35,
    position: { x: -50, y: 5, z: 38 },
    connectedNodeIds: ['node_universo_principal', 'node_universo_arkham', 'node_universo_chamas', 'node_nave_gina'],
    coverImageUrl: 'https://i.imgur.com/hq54EdA.png',
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: [],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 11,
    blocks: []
  },
  {
    id: 'node_prisao_macroversal',
    name: 'Prisão Macroversal',
    subtitle: '',
    planeId: 'macroverso_13',
    category: 'borda_macroversal',
    visualType: 'macro_prison',
    primaryColor: '#ec4899',
    secondaryColor: '#4c1d95',
    scale: 1.5,
    position: { x: 0, y: 4, z: -64 },
    connectedNodeIds: ['node_universo_principal', 'node_poco_portal_2', 'node_castelo_extraverso'],
    coverImageUrl: 'https://i.imgur.com/q5KOgyN.png',
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: [],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 12,
    blocks: []
  },
  {
    id: 'node_castelo_extraverso',
    name: 'Castelo Extraverso',
    subtitle: '',
    planeId: 'macroverso_13',
    category: 'extraverso',
    visualType: 'extraverse_castle',
    primaryColor: '#eab308',
    secondaryColor: '#38bdf8',
    scale: 1.55,
    position: { x: 0, y: 28, z: -84 },
    connectedNodeIds: [
      'node_universo_principal',
      'node_prisao_macroversal',
      'node_universo_deusa_lua',
      'node_universo_mechs',
      'node_nave_gina'
    ],
    coverImageUrl: 'https://i.imgur.com/smxmHNB.png',
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: [],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 13,
    blocks: []
  },
  {
    id: 'node_caminho_entre_caminhos',
    name: 'Caminho entre os Caminhos',
    subtitle: '',
    planeId: 'macroverso_13',
    category: 'extraverso',
    visualType: 'pathway_of_doors',
    primaryColor: '#fde047',
    secondaryColor: '#581c87',
    scale: 1.5,
    position: { x: 0, y: 18, z: -38 },
    connectedNodeIds: [
      'node_universo_principal',
      'node_universo_deusa_lua',
      'node_universo_chamas',
      'node_universo_mechs',
      'node_veu',
      'node_castelo_extraverso'
    ],
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: [],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 14,
    blocks: []
  },
  {
    id: 'node_veu',
    name: 'O Véu',
    subtitle: '',
    planeId: 'macroverso_13',
    category: 'extraverso',
    visualType: 'the_veil',
    primaryColor: '#cbd5e1',
    secondaryColor: '#818cf8',
    scale: 1.45,
    position: { x: 0, y: -14, z: -38 },
    connectedNodeIds: ['node_caminho_entre_caminhos', 'node_universo_principal'],
    coverImageUrl: 'https://i.imgur.com/kSR0Wec.png',
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: [],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 15,
    blocks: []
  },
  {
    id: 'node_macroverso_inverso',
    name: 'Macroverso Inverso',
    subtitle: '',
    planeId: 'macroverso_13',
    category: 'extraverso',
    visualType: 'black_hole',
    primaryColor: '#e11d48',
    secondaryColor: '#6d28d9',
    scale: 1.65,
    position: { x: 0, y: -30, z: 0 },
    connectedNodeIds: ['node_universo_principal', 'node_universo_deusa_lua'],
    coverImageUrl: 'https://i.imgur.com/jtzmrTk.png',
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: [],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 16,
    blocks: []
  },

  // ==================== PLANO PARALELO 2: PARALELO DA CORRUPÇÃO ====================
  {
    id: 'node_trono_asmonious',
    name: 'Paralelo da Corrupção',
    subtitle: '',
    planeId: 'paralelo_corrupcao',
    targetPlaneId: 'macroverso_13',
    isPortalGateway: true,
    category: 'plano_paralelo',
    visualType: 'macro_prison',
    primaryColor: '#ef4444',
    secondaryColor: '#7f1d1d',
    scale: 1.75,
    position: { x: 0, y: 0, z: 0 },
    connectedNodeIds: [],
    coverImageUrl: 'https://i.imgur.com/ULE363X.png',
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: [],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 17,
    blocks: []
  },

  // ==================== PLANO PARALELO 3: REDE DO CAOS ====================
  {
    id: 'node_nucleo_rede_caos',
    name: 'Rede do Caos',
    subtitle: '',
    planeId: 'rede_do_caos',
    targetPlaneId: 'macroverso_13',
    isPortalGateway: true,
    category: 'plano_paralelo',
    visualType: 'chaos_network',
    primaryColor: '#a855f7',
    secondaryColor: '#ec4899',
    scale: 1.8,
    position: { x: 0, y: 0, z: 0 },
    connectedNodeIds: [],
    summary: 'Lore será preenchida em breve',
    customStats: [],
    linkedCollections: [],
    linkedArchetypes: [],
    linkedCardCodes: [],
    timelineEvents: [],
    cosmologyVersion: 7,
    orderIndex: 18,
    blocks: []
  }
];

const CATEGORY_LABELS: Record<string, string> = {
  universo_principal: 'Universo Primordial (Centro)',
  universo_paralelo: 'Universo em Espiral',
  porta_corrupcao: 'Poço da Corrupção (Porta de Entrada)',
  plano_paralelo: 'Domínio de Plano Paralelo',
  borda_macroversal: 'Fronteira do Macroverso',
  extraverso: 'Fora do Macroverso (Extraverso)',
  anomalia_errante: 'Dimensão Errante / Cruzador',
  macroverso: 'Macroverso',
  galaxia: 'Galáxia Espiral',
  realidade: 'Realidade / Plano',
  planeta: 'Sistema Estelar',
  conceito: 'Domínio Conceitual',
  anomalia: 'Anomalia Cósmica'
};

const VISUAL_LABELS: Record<CosmicVisualType, string> = {
  spiral_galaxy: 'Galáxia em Espiral de Partículas (Padrão)',
  mecha_universe: 'Galáxia Forja & Anéis de Partículas',
  corrupted_well: 'Poço da Corrupção (Portal & Vórtice)',
  chaos_network: 'Nexo da Rede do Caos (Malha Dimensional)',
  macro_prison: 'Prisão Macroversal (Singularidade & Selos)',
  extraverse_castle: 'Castelo Extraverso (Cidadela Astral)',
  the_veil: 'O Véu (Santuário & Arcos Prateados)',
  pathway_of_doors: 'Caminho entre os Caminhos (Linha de Portas & Espiral Lúmen/Darkus)',
  wandering_pocket: 'Zona Caótica (Relicário Arcano)',
  mirror_macroverse: 'Pirâmide Espelhada Dupla',
  starship_vessel: 'Nave Macroversal (Cruzador Estelar)',
  festival_arena: 'O Festival (Coliseu Cósmico)',
  ringed_planet: 'Galáxia com Anéis Luminosos',
  fractured_reality: 'Nebulosa de Fendas Astrais',
  black_hole: 'Buraco Negro (Horizonte de Eventos & Disco de Acreção)',
  nebula_cluster: 'Aglomerado Nebular Triplo',
  concept_monolith: 'Pilar de Energia Cósmica'
};

interface CosmicLoreMapProps {
  nodes: CosmicNodeData[];
  territories: CosmicTerritoryData[];
  isAdmin: boolean;
  cards: CardData[];
  archetypes: { name: string; description?: string; imageUrl?: string }[];
  onSaveNode: (node: CosmicNodeData) => Promise<void>;
  onDeleteNode: (nodeId: string) => Promise<void>;
  onSaveTerritories: (territories: CosmicTerritoryData[]) => Promise<void>;
  onResetDefaultCosmology?: () => Promise<void>;
  onUploadMedia: (file: File) => Promise<string>;
  onSelectCard?: (card: CardData) => void;
}

const _projVec = new THREE.Vector3();
const _dummyMatrix = new THREE.Matrix4();
const _dummyPos = new THREE.Vector3();
const _dummyQuat = new THREE.Quaternion();
const _dummyScale = new THREE.Vector3();
const _dummyColor = new THREE.Color();
const _shipNextPos = new THREE.Vector3();

export const CosmicLoreMap: React.FC<CosmicLoreMapProps> = ({
  nodes,
  territories,
  isAdmin,
  cards,
  archetypes,
  onSaveNode,
  onDeleteNode,
  onSaveTerritories,
  onResetDefaultCosmology,
  onUploadMedia,
  onSelectCard
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Active Dimensional Plane ('macroverso_13' | 'paralelo_corrupcao' | 'rede_do_caos' | 'all')
  const [activePlane, setActivePlane] = useState<CosmicPlaneId | 'all'>('macroverso_13');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Retractable Menu States
  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(false);
  const [isPlaneMenuOpen, setIsPlaneMenuOpen] = useState<boolean>(false);
  const [isTerritoryMenuOpen, setIsTerritoryMenuOpen] = useState<boolean>(false);
  const [isIndexOpen, setIsIndexOpen] = useState<boolean>(false);
  const [isRightDrawerCollapsed, setIsRightDrawerCollapsed] = useState<boolean>(false);
  const [isRightDrawerWide, setIsRightDrawerWide] = useState<boolean>(false);
  const [pinDisplayMode, setPinDisplayMode] = useState<'compact' | 'full' | 'minimal'>('compact');
  const [showTerritories, setShowTerritories] = useState<boolean>(true);

  const [wanderingSectorIdx, setWanderingSectorIdx] = useState<number>(() =>
    Math.floor(Math.random() * WANDERING_POCKET_WAYPOINTS.length)
  );
  const [resettingCosmology, setResettingCosmology] = useState<boolean>(false);

  // Admin Placement Modes: 'node' | 'corrupted_well' | 'territory' | 'move_territory' | null
  const [placementMode, setPlacementMode] = useState<
    'node' | 'corrupted_well' | 'territory' | 'move_territory' | null
  >(null);
  const [newTerritoryFaction, setNewTerritoryFaction] = useState<CosmicFactionId>('Asmonious');
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null);

  // Admin In-Map Node Editor states
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingNode, setEditingNode] = useState<CosmicNodeData | null>(null);
  const [savingNode, setSavingNode] = useState<boolean>(false);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [cardPickerSearch, setCardPickerSearch] = useState<string>('');
  const [quickAddCardSearch, setQuickAddCardSearch] = useState<string>('');
  const [isQuickAddCardOpen, setIsQuickAddCardOpen] = useState<boolean>(false);

  // Character / Card Trajectory Tracking States
  const [trackedCard, setTrackedCard] = useState<CardData | null>(null);
  const [isTrajectoryMenuOpen, setIsTrajectoryMenuOpen] = useState<boolean>(false);
  const [trajectorySearchQuery, setTrajectorySearchQuery] = useState<string>('');
  const [savingTrajectory, setSavingTrajectory] = useState<boolean>(false);

  // Per-Location Timeline (Linha do Tempo do Local) Quick Editor States
  const [isTimelineFormOpen, setIsTimelineFormOpen] = useState<boolean>(false);
  const [editingTimelineEventId, setEditingTimelineEventId] = useState<string | null>(null);
  const [timelineDraft, setTimelineDraft] = useState<CosmicLocationTimelineEvent>({
    id: '',
    dateLabel: '',
    title: '',
    description: '',
    mediaUrl: '',
    mediaType: 'image'
  });
  const [savingTimelineEvent, setSavingTimelineEvent] = useState<boolean>(false);
  const [uploadingTimelineMedia, setUploadingTimelineMedia] = useState<boolean>(false);

  // Screen-projected 2D coordinates for DOM markers over 3D nodes & territories
  const [projectedLabels, setProjectedLabels] = useState<
    { id: string; x: number; y: number; visible: boolean; distance: number }[]
  >([]);
  const [projectedTerritories, setProjectedTerritories] = useState<
    { id: string; x: number; y: number; visible: boolean }[]
  >([]);

  // Filter nodes by current plane + category + search
  const visiblePlaneNodes = useMemo(() => {
    return nodes.filter((n) => {
      const nodePlane = n.planeId || 'macroverso_13';
      if (activePlane === 'all') return true;
      return nodePlane === activePlane;
    });
  }, [nodes, activePlane]);

  const filteredNodes = useMemo(() => {
    return visiblePlaneNodes.filter((n) => {
      if (filterCategory !== 'all' && n.category !== filterCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          n.name.toLowerCase().includes(q) ||
          n.subtitle.toLowerCase().includes(q) ||
          n.summary.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [visiblePlaneNodes, filterCategory, searchQuery]);

  const visibleTerritories = useMemo(() => {
    if (!showTerritories) return [];
    return territories.filter((t) => {
      if (activePlane === 'all' || t.planeId === 'all') return true;
      return (t.planeId || 'macroverso_13') === activePlane;
    });
  }, [territories, activePlane, showTerritories]);

  const selectedTerritory = useMemo(
    () => territories.find((t) => t.id === selectedTerritoryId) || null,
    [territories, selectedTerritoryId]
  );

  // Compute the ordered trajectory of locations for the currently tracked card
  const trackedCardTrajectory = useMemo(() => {
    if (!trackedCard) return [];
    const code = trackedCard.code;
    const colLower = (trackedCard.collection || '').toLowerCase();

    const matchingNodes = nodes.filter((n) => {
      if ((n.linkedCardCodes || []).includes(code)) return true;
      if (
        colLower &&
        (n.linkedCollections || []).some((c) => c.toLowerCase() === colLower)
      ) {
        return true;
      }
      return false;
    });

    return matchingNodes.sort((a, b) => {
      const stepA =
        a.cardTrajectoryStep?.[code] ??
        ((a.linkedCardCodes || []).includes(code) ? 100 : 10);
      const stepB =
        b.cardTrajectoryStep?.[code] ??
        ((b.linkedCardCodes || []).includes(code) ? 100 : 10);
      if (stepA !== stepB) return stepA - stepB;
      return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
    });
  }, [trackedCard, nodes]);

  // Fast lookup map of nodeId -> 1-based step index in trackedCardTrajectory
  const trackedNodeStepMap = useMemo(() => {
    const map = new Map<string, number>();
    trackedCardTrajectory.forEach((n, idx) => {
      map.set(n.id, idx + 1);
    });
    return map;
  }, [trackedCardTrajectory]);

  // Mutable refs for Three.js loop access
  const nodesRef = useRef<CosmicNodeData[]>(visiblePlaneNodes);
  nodesRef.current = visiblePlaneNodes;

  const territoriesRef = useRef<CosmicTerritoryData[]>(visibleTerritories);
  territoriesRef.current = visibleTerritories;

  const trackedTrajectoryRef = useRef<CosmicNodeData[]>(trackedCardTrajectory);
  trackedTrajectoryRef.current = trackedCardTrajectory;

  const activePlaneRef = useRef<CosmicPlaneId | 'all'>(activePlane);
  activePlaneRef.current = activePlane;

  const selectedNodeIdRef = useRef<string | null>(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;

  const placementModeRef = useRef(placementMode);
  placementModeRef.current = placementMode;

  const wanderingTargetRef = useRef<THREE.Vector3>(
    new THREE.Vector3(
      WANDERING_POCKET_WAYPOINTS[wanderingSectorIdx].x,
      WANDERING_POCKET_WAYPOINTS[wanderingSectorIdx].y,
      WANDERING_POCKET_WAYPOINTS[wanderingSectorIdx].z
    )
  );

  const cameraFlightRef = useRef<{
    active: boolean;
    camPos: THREE.Vector3;
    lookAt: THREE.Vector3;
  }>({
    active: false,
    camPos: new THREE.Vector3(0, 48, 96),
    lookAt: new THREE.Vector3(0, 0, 0)
  });

  const sceneObjectsRef = useRef<{
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    controls?: OrbitControls;
    nodeGroups: Map<string, THREE.Group>;
    territoryGroups: Map<string, THREE.Group>;
    clickableProxies: THREE.Mesh[];
    connectionLinesGroup?: THREE.Group;
    trajectoryGroup?: THREE.Group;
    astrolabeGroup?: THREE.Group;
    rebuildNodes?: () => void;
    rebuildTerritories?: () => void;
    rebuildTrajectory?: () => void;
  }>({
    nodeGroups: new Map(),
    territoryGroups: new Map(),
    clickableProxies: []
  });

  // Silent background drift for Zona Caótica do Sábio
  useEffect(() => {
    const interval = window.setInterval(() => {
      setWanderingSectorIdx((prev) => {
        const nextIdx =
          (prev + 1 + Math.floor(Math.random() * (WANDERING_POCKET_WAYPOINTS.length - 1))) %
          WANDERING_POCKET_WAYPOINTS.length;
        const wp = WANDERING_POCKET_WAYPOINTS[nextIdx];
        wanderingTargetRef.current.set(wp.x, wp.y, wp.z);
        return nextIdx;
      });
    }, 12000);
    return () => window.clearInterval(interval);
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const flyToNode = (node: CosmicNodeData | null) => {
    if (!node) {
      cameraFlightRef.current.camPos.set(0, 48, 96);
      cameraFlightRef.current.lookAt.set(0, 0, 0);
      cameraFlightRef.current.active = true;
      return;
    }
    const liveGroup = sceneObjectsRef.current.nodeGroups.get(node.id);
    const x = liveGroup ? liveGroup.position.x : node.position.x;
    const y = liveGroup ? liveGroup.position.y : node.position.y;
    const z = liveGroup ? liveGroup.position.z : node.position.z;
    const dist = Math.max(15, (node.scale || 1) * 11.5);
    cameraFlightRef.current.camPos.set(x + dist * 0.45, y + dist * 0.45, z + dist);
    cameraFlightRef.current.lookAt.set(x + (window.innerWidth > 1024 ? 3.5 : 0), y, z);
    cameraFlightRef.current.active = true;
  };

  const handleSelectNode = (node: CosmicNodeData | null) => {
    if (!node) {
      setSelectedNodeId(null);
      setIsRightDrawerCollapsed(false);
      flyToNode(null);
      return;
    }
    setSelectedNodeId(node.id);
    setIsRightDrawerCollapsed(false);
    flyToNode(node);
    if (isEditMode) {
      setEditingNode(JSON.parse(JSON.stringify(node)));
    }
  };

  const handleSwitchPlane = (targetPlane: CosmicPlaneId | 'all') => {
    setActivePlane(targetPlane);
    setSelectedNodeId(null);
    setIsEditMode(false);
    setEditingNode(null);
    flyToNode(null);
  };

  // Start tracking a card's trajectory on the 3D map
  const handleSelectCardTrajectory = (card: CardData) => {
    setTrackedCard(card);
    // Check if the card's trajectory spans planes outside current activePlane
    const code = card.code;
    const colLower = (card.collection || '').toLowerCase();
    const cardNodes = nodes.filter(
      (n) =>
        (n.linkedCardCodes || []).includes(code) ||
        (colLower && (n.linkedCollections || []).some((c) => c.toLowerCase() === colLower))
    );
    const hasOtherPlane = cardNodes.some(
      (n) => activePlane !== 'all' && (n.planeId || 'macroverso_13') !== activePlane
    );
    if (hasOtherPlane) {
      setActivePlane('all');
    }
  };

  // Admin Helper: Add a card to a specific location (and append to its trajectory)
  const handleAddCardToNode = async (card: CardData, targetNode: CosmicNodeData) => {
    setSavingTrajectory(true);
    try {
      const code = card.code;
      const existingCodes = targetNode.linkedCardCodes || [];
      const nextCodes = existingCodes.includes(code) ? existingCodes : [...existingCodes, code];

      // Determine next step index across all nodes where this card appears
      const currentSteps = nodes
        .filter(
          (n) =>
            n.id !== targetNode.id &&
            ((n.linkedCardCodes || []).includes(code) ||
              ((card.collection || '') &&
                (n.linkedCollections || []).some(
                  (c) => c.toLowerCase() === (card.collection || '').toLowerCase()
                )))
        )
        .map((n, idx) => n.cardTrajectoryStep?.[code] ?? idx + 1);
      const maxStep = currentSteps.length > 0 ? Math.max(...currentSteps) : 0;

      const updatedNode: CosmicNodeData = {
        ...targetNode,
        linkedCardCodes: nextCodes,
        cardTrajectoryStep: {
          ...(targetNode.cardTrajectoryStep || {}),
          [code]: targetNode.cardTrajectoryStep?.[code] ?? maxStep + 1
        }
      };
      await onSaveNode(updatedNode);
      if (editingNode && editingNode.id === targetNode.id) {
        setEditingNode(updatedNode);
      }
    } finally {
      setSavingTrajectory(false);
    }
  };

  // Admin Helper: Remove a card from a specific location
  const handleRemoveCardFromNode = async (card: CardData, targetNode: CosmicNodeData) => {
    setSavingTrajectory(true);
    try {
      const code = card.code;
      const nextCodes = (targetNode.linkedCardCodes || []).filter((c) => c !== code);
      const nextSteps = { ...(targetNode.cardTrajectoryStep || {}) };
      delete nextSteps[code];

      const updatedNode: CosmicNodeData = {
        ...targetNode,
        linkedCardCodes: nextCodes,
        cardTrajectoryStep: nextSteps
      };
      await onSaveNode(updatedNode);
      if (editingNode && editingNode.id === targetNode.id) {
        setEditingNode(updatedNode);
      }
    } finally {
      setSavingTrajectory(false);
    }
  };

  // Admin Helper: Move a stop earlier or later in the tracked card's trajectory
  const handleMoveTrajectoryStop = async (stopIndex: number, direction: -1 | 1) => {
    if (!trackedCard) return;
    const targetIdx = stopIndex + direction;
    if (targetIdx < 0 || targetIdx >= trackedCardTrajectory.length) return;

    setSavingTrajectory(true);
    try {
      const code = trackedCard.code;
      const reordered = [...trackedCardTrajectory];
      const temp = reordered[stopIndex];
      reordered[stopIndex] = reordered[targetIdx];
      reordered[targetIdx] = temp;

      for (let i = 0; i < reordered.length; i++) {
        const n = reordered[i];
        const desiredStep = i + 1;
        const nextCodes = (n.linkedCardCodes || []).includes(code)
          ? n.linkedCardCodes || []
          : [...(n.linkedCardCodes || []), code];
        const updated: CosmicNodeData = {
          ...n,
          linkedCardCodes: nextCodes,
          cardTrajectoryStep: {
            ...(n.cardTrajectoryStep || {}),
            [code]: desiredStep
          }
        };
        await onSaveNode(updated);
      }
    } finally {
      setSavingTrajectory(false);
    }
  };

  // Start creating a new generic Universe/Node at clicked 3D coordinates
  const startNewNodeAt = (pos: { x: number; y: number; z: number }) => {
    const targetPlane: CosmicPlaneId =
      activePlane === 'all' ? 'macroverso_13' : activePlane;
    const distFromCenter = Math.round(Math.hypot(pos.x, pos.y, pos.z));
    const newNode: CosmicNodeData = {
      id: `cosmic_${Date.now()}`,
      name: 'Novo Universo',
      subtitle: '',
      planeId: targetPlane,
      category:
        targetPlane !== 'macroverso_13'
          ? 'plano_paralelo'
          : distFromCenter > 60
          ? 'extraverso'
          : 'universo_paralelo',
      visualType: 'spiral_galaxy',
      primaryColor: '#a855f7',
      secondaryColor: '#38bdf8',
      scale: 1.3,
      position: {
        x: Math.round(pos.x * 10) / 10,
        y: Math.round(pos.y * 10) / 10,
        z: Math.round(pos.z * 10) / 10
      },
      connectedNodeIds: ['node_universo_principal'],
      summary: 'Lore será preenchida em breve',
      customStats: [],
      linkedCollections: [],
      linkedArchetypes: [],
      linkedCardCodes: [],
      timelineEvents: [],
      cosmologyVersion: 7,
      orderIndex: nodes.length,
      blocks: []
    };
    setPlacementMode(null);
    setIsEditMode(true);
    setIsRightDrawerCollapsed(false);
    setEditingNode(newNode);
    setSelectedNodeId(newNode.id);
    flyToNode(newNode);
  };

  // 1-Click Paste of a Poço da Corrupção (Portal Gateway to Paralelo da Corrupção)
  const pasteCorruptedWellAt = async (pos: { x: number; y: number; z: number }) => {
    const wellCount =
      nodes.filter((n) => n.category === 'porta_corrupcao' || n.visualType === 'corrupted_well')
        .length + 1;
    const wellNode: CosmicNodeData = {
      id: `poco_corrupcao_${Date.now()}`,
      name: `Poço da Corrupção #${wellCount}`,
      subtitle: '',
      planeId: activePlane === 'all' ? 'macroverso_13' : activePlane,
      targetPlaneId: 'paralelo_corrupcao',
      isPortalGateway: true,
      category: 'porta_corrupcao',
      visualType: 'corrupted_well',
      primaryColor: '#ef4444',
      secondaryColor: '#7f1d1d',
      scale: 1.15,
      position: {
        x: Math.round(pos.x * 10) / 10,
        y: Math.round(pos.y * 10) / 10,
        z: Math.round(pos.z * 10) / 10
      },
      connectedNodeIds: ['node_universo_principal'],
      coverImageUrl: 'https://i.imgur.com/ULE363X.png',
      summary: 'Lore será preenchida em breve',
      customStats: [],
      linkedCollections: [],
      linkedArchetypes: [],
      linkedCardCodes: [],
      timelineEvents: [],
      cosmologyVersion: 7,
      orderIndex: nodes.length,
      blocks: []
    };
    setPlacementMode(null);
    await onSaveNode(wellNode);
    setSelectedNodeId(wellNode.id);
    setIsRightDrawerCollapsed(false);
    flyToNode(wellNode);
  };

  // Click on any Polar Sector Wedge on the 3D Map to Paint/Assign Faction (Helldivers Style)
  const handleTerritoryMapClick = async (pos: { x: number; y: number; z: number }) => {
    const r = Math.hypot(pos.x, pos.z);
    const rawDeg = (Math.atan2(pos.z, pos.x) * 180) / Math.PI;
    const deg = ((rawDeg % 360) + 360) % 360;

    const hitSector = territories.find((sec) => {
      const inR = sec.innerRadius ?? 10;
      const outR = sec.outerRadius ?? 30;
      if (r < inR || r > outR) return false;
      const sAng = sec.startAngleDeg ?? 0;
      const eAng = sec.endAngleDeg ?? 45;
      if (deg >= sAng && deg <= eAng) return true;
      if (eAng > 360 && deg + 360 >= sAng && deg + 360 <= eAng) return true;
      return false;
    });

    if (hitSector) {
      const preset = FACTION_PRESETS[newTerritoryFaction] || FACTION_PRESETS.Asmonious;
      const nextList = territories.map((t) =>
        t.id === hitSector.id
          ? {
              ...t,
              faction: newTerritoryFaction,
              color: preset.color,
              controlPercent: newTerritoryFaction === 'Neutro' ? 0 : t.controlPercent || 95
            }
          : t
      );
      setSelectedTerritoryId(hitSector.id);
      await onSaveTerritories(nextList);
    }
  };

  const handleTerritoryMapClickRef = useRef(handleTerritoryMapClick);
  handleTerritoryMapClickRef.current = handleTerritoryMapClick;

  const pasteCorruptedWellAtRef = useRef(pasteCorruptedWellAt);
  pasteCorruptedWellAtRef.current = pasteCorruptedWellAt;

  const startNewNodeAtRef = useRef(startNewNodeAt);
  startNewNodeAtRef.current = startNewNodeAt;

  // Trigger scene node, territory & trajectory rebuild when data or plane changes
  useEffect(() => {
    if (sceneObjectsRef.current.rebuildNodes) {
      sceneObjectsRef.current.rebuildNodes();
    }
    if (sceneObjectsRef.current.rebuildTrajectory) {
      sceneObjectsRef.current.rebuildTrajectory();
    }
  }, [visiblePlaneNodes, editingNode, activePlane]);

  useEffect(() => {
    if (sceneObjectsRef.current.rebuildTerritories) {
      sceneObjectsRef.current.rebuildTerritories();
    }
  }, [visibleTerritories, selectedTerritoryId, activePlane]);

  useEffect(() => {
    if (sceneObjectsRef.current.rebuildTrajectory) {
      sceneObjectsRef.current.rebuildTrajectory();
    }
  }, [trackedCardTrajectory, activePlane]);

  // Initialize Three.js WebGL Viewport
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030308);
    scene.fog = new THREE.FogExp2(0x030308, 0.0028);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.5, 550);
    camera.position.set(0, 48, 96);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance'
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0xc4b5fd, 0x090d16, 1.0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    keyLight.position.set(55, 75, 45);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    rimLight.position.set(-55, -35, -50);
    scene.add(rimLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.055;
    controls.maxDistance = 230;
    controls.minDistance = 6;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.minPolarAngle = 0.08;

    const cancelFlight = () => {
      cameraFlightRef.current.active = false;
    };
    controls.addEventListener('start', cancelFlight);

    // Procedural Soft Star/Nebula Particle Texture (Zero external asset 404s)
    const createGlowTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createRadialGradient(64, 64, 1, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.18, 'rgba(255,255,255,0.85)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.28)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };
    const glowTexture = createGlowTexture();

    // Procedural Helldivers-Style Polar Sector War-Table Map Texture (2048x2048)
    const createHelldiversSectorMapTexture = (
      sectors: CosmicTerritoryData[],
      selectedId: string | null
    ) => {
      const size = 2048;
      const cx = size / 2;
      const cy = size / 2;
      const worldMaxR = 68;
      const pxPerUnit = (size * 0.485) / worldMaxR;

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const traceSectorWedge = (sec: CosmicTerritoryData) => {
        const rIn = Math.max(4, sec.innerRadius ?? 10) * pxPerUnit;
        const rOut = Math.max(rIn + 4, sec.outerRadius ?? 24) * pxPerUnit;
        const aStart = ((sec.startAngleDeg ?? 0) * Math.PI) / 180;
        const aEnd = ((sec.endAngleDeg ?? 45) * Math.PI) / 180;

        ctx.beginPath();
        ctx.arc(cx, cy, rOut, aStart, aEnd, false);
        ctx.arc(cx, cy, rIn, aEnd, aStart, true);
        ctx.closePath();
      };

      // 1. Central Core Circle Emblem (Universo Primordial — Translucent Core)
      const coreR = 10 * pxPerUnit;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(4, 5, 12, 0.16)';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.52)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 0.82, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.stroke();
      ctx.restore();

      // 2. Pass 1: Translucent Polar Sector Wedges & Subtle 45° Diagonal Hatch Lines
      sectors.forEach((sec) => {
        ctx.save();
        traceSectorWedge(sec);

        if (sec.faction && sec.faction !== 'Neutro') {
          ctx.clip();

          let fillRgba = 'rgba(153, 27, 27, 0.22)';
          let hatchRgba = 'rgba(252, 165, 165, 0.22)';
          if (sec.faction === 'Caos') {
            fillRgba = 'rgba(88, 28, 135, 0.22)';
            hatchRgba = 'rgba(216, 180, 254, 0.22)';
          } else if (sec.faction === 'Aliança') {
            fillRgba = 'rgba(146, 92, 22, 0.20)';
            hatchRgba = 'rgba(253, 224, 71, 0.20)';
          }

          ctx.fillStyle = fillRgba;
          ctx.fillRect(0, 0, size, size);

          // Signature Helldivers 45° Diagonal Hatch Stripes inside the Sector Wedge
          ctx.strokeStyle = hatchRgba;
          ctx.lineWidth = 2.4;
          for (let d = -size; d < size * 2; d += 20) {
            ctx.beginPath();
            ctx.moveTo(d, 0);
            ctx.lineTo(d + size, size);
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = 'rgba(3, 4, 10, 0.06)';
          ctx.fill();
        }
        ctx.restore();
      });

      // 3. Pass 2: Translucent Sector Grid Borders & Stepped Frontlines
      sectors.forEach((sec) => {
        ctx.save();
        traceSectorWedge(sec);
        const isControlled = sec.faction && sec.faction !== 'Neutro';
        const isSel = sec.id === selectedId;

        ctx.lineJoin = 'round';
        if (isSel) {
          ctx.lineWidth = 5.5;
          ctx.strokeStyle = 'rgba(253, 224, 71, 0.9)';
        } else if (isControlled) {
          ctx.lineWidth = 2.6;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.56)';
        } else {
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        }
        ctx.stroke();
        ctx.restore();
      });

      // 4. Pass 3: Sector Labels & Faction Ownership Tags inside each Wedge
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      sectors.forEach((sec) => {
        const rIn = (sec.innerRadius ?? 10) * pxPerUnit;
        const rOut = (sec.outerRadius ?? 24) * pxPerUnit;
        const midR = (rIn + rOut) * 0.5;
        const midAng = (((sec.startAngleDeg ?? 0) + (sec.endAngleDeg ?? 45)) * 0.5 * Math.PI) / 180;

        const tx = cx + Math.cos(midAng) * midR;
        const ty = cy + Math.sin(midAng) * midR;
        const isControlled = sec.faction && sec.faction !== 'Neutro';

        const shortName = sec.name.replace(/^Setor\s+/i, '');
        ctx.font = isControlled
          ? 'bold 20px Inter, system-ui, sans-serif'
          : '600 17px Inter, system-ui, sans-serif';
        ctx.fillStyle = isControlled ? 'rgba(255, 255, 255, 0.72)' : 'rgba(255, 255, 255, 0.34)';
        ctx.fillText(shortName, tx, ty - 11);

        ctx.font = isControlled
          ? 'bold 15px Inter, system-ui, sans-serif'
          : '500 14px Inter, system-ui, sans-serif';
        ctx.fillStyle = isControlled ? 'rgba(255, 255, 255, 0.56)' : 'rgba(255, 255, 255, 0.24)';
        ctx.fillText(isControlled ? `Setor · ${sec.faction}` : 'Setor', tx, ty + 12);
      });
      ctx.restore();

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      return tex;
    };

    // Deep Background Starfield (1,800 glowing particle stars in 1 draw call)
    const bgStarCount = 1800;
    const bgPositions = new Float32Array(bgStarCount * 3);
    const bgColors = new Float32Array(bgStarCount * 3);
    const palette = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xc4b5fd),
      new THREE.Color(0x93c5fd),
      new THREE.Color(0xfde68a),
      new THREE.Color(0xf9a8d4)
    ];
    for (let i = 0; i < bgStarCount; i++) {
      const radius = 90 + Math.random() * 190;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      bgPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      bgPositions[i * 3 + 1] = radius * Math.cos(phi) * 0.65;
      bgPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      const col = palette[i % palette.length];
      bgColors[i * 3] = col.r;
      bgColors[i * 3 + 1] = col.g;
      bgColors[i * 3 + 2] = col.b;
    }
    const bgStarGeo = new THREE.BufferGeometry();
    bgStarGeo.setAttribute('position', new THREE.BufferAttribute(bgPositions, 3));
    bgStarGeo.setAttribute('color', new THREE.BufferAttribute(bgColors, 3));
    const bgStarMat = new THREE.PointsMaterial({
      size: 1.35,
      map: glowTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const starField = new THREE.Points(bgStarGeo, bgStarMat);
    scene.add(starField);

    // Subtle Astrolabe & Macroverse Boundary Particle Ring
    const astrolabeGroup = new THREE.Group();
    const borderParticleCount = 720;
    const borderPos = new Float32Array(borderParticleCount * 3);
    for (let i = 0; i < borderParticleCount; i++) {
      const ang = (i / borderParticleCount) * Math.PI * 2;
      const r = 64 + (Math.random() - 0.5) * 1.2;
      borderPos[i * 3] = Math.cos(ang) * r;
      borderPos[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
      borderPos[i * 3 + 2] = Math.sin(ang) * r;
    }
    const borderGeo = new THREE.BufferGeometry();
    borderGeo.setAttribute('position', new THREE.BufferAttribute(borderPos, 3));
    const borderMat = new THREE.PointsMaterial({
      size: 0.9,
      map: glowTexture,
      color: 0xd4af37,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    astrolabeGroup.add(new THREE.Points(borderGeo, borderMat));
    scene.add(astrolabeGroup);

    const placementPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    const territoriesContainer = new THREE.Group();
    const connectionLinesGroup = new THREE.Group();
    const trajectoryGroup = new THREE.Group();
    const nodesContainer = new THREE.Group();
    scene.add(territoriesContainer);
    scene.add(connectionLinesGroup);
    scene.add(trajectoryGroup);
    scene.add(nodesContainer);

    // Helper: Build a Rich Particle Spiral Galaxy / Nebula Cloud (NO basic geometric spheres/boxes!)
    const createSpiralGalaxyCloud = (opts: {
      count: number;
      arms: number;
      radius: number;
      spin: number;
      thickness: number;
      primary: THREE.Color;
      secondary: THREE.Color;
      coreWhiteMix?: number;
      verticalFunnel?: number;
      pointSize?: number;
    }) => {
      const {
        count,
        arms,
        radius,
        spin,
        thickness,
        primary,
        secondary,
        coreWhiteMix = 0.65,
        verticalFunnel = 0,
        pointSize = 0.72
      } = opts;

      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const white = new THREE.Color(0xffffff);
      const tempColor = new THREE.Color();

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const rNorm = Math.pow(Math.random(), 1.55);
        const r = rNorm * radius;
        const branchAngle = ((i % arms) / arms) * Math.PI * 2;
        const spinAngle = r * spin;

        // Organic scatter along spiral arms
        const spread = 0.25 + rNorm * 0.95;
        const randX = Math.pow(Math.random(), 2.2) * (Math.random() < 0.5 ? 1 : -1) * spread;
        const randY =
          (Math.random() - 0.5) * thickness * (1 - rNorm * 0.55) -
          (verticalFunnel ? (1 - rNorm) * verticalFunnel : 0);
        const randZ = Math.pow(Math.random(), 2.2) * (Math.random() < 0.5 ? 1 : -1) * spread;

        positions[i3] = Math.cos(branchAngle + spinAngle) * r + randX;
        positions[i3 + 1] = randY;
        positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + randZ;

        // Smooth color gradient: hot white/primary core -> primary mid-arm -> secondary outer spiral tips
        if (rNorm < 0.18) {
          tempColor.copy(primary).lerp(white, (1 - rNorm / 0.18) * coreWhiteMix);
        } else {
          tempColor.copy(primary).lerp(secondary, (rNorm - 0.18) / 0.82);
        }
        colors[i3] = tempColor.r;
        colors[i3 + 1] = tempColor.g;
        colors[i3 + 2] = tempColor.b;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mat = new THREE.PointsMaterial({
        size: pointSize,
        map: glowTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const points = new THREE.Points(geo, mat);
      points.userData.isSwirlingGalaxy = true;
      return points;
    };

    // Helper: Soft Volumetric Nebula Dust Cloud around a Galaxy
    const createNebulaHazeCloud = (
      count: number,
      radius: number,
      primary: THREE.Color,
      secondary: THREE.Color
    ) => {
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const tempColor = new THREE.Color();

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const r = Math.pow(Math.random(), 1.2) * radius;
        const theta = Math.random() * Math.PI * 2;
        positions[i3] = Math.cos(theta) * r;
        positions[i3 + 1] = (Math.random() - 0.5) * 1.1;
        positions[i3 + 2] = Math.sin(theta) * r;

        tempColor.copy(i % 2 === 0 ? primary : secondary);
        colors[i3] = tempColor.r;
        colors[i3 + 1] = tempColor.g;
        colors[i3 + 2] = tempColor.b;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mat = new THREE.PointsMaterial({
        size: 2.3,
        map: glowTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const cloud = new THREE.Points(geo, mat);
      cloud.userData.isSwirlingGalaxy = true;
      return cloud;
    };

    // Helper: Spherical / Vertical Ambient Particle Aura for Non-Galaxy 3D Landmarks
    const createAmbientParticleAura = (opts: {
      count: number;
      minRadius: number;
      maxRadius: number;
      verticalScale: number;
      primary: THREE.Color;
      secondary: THREE.Color;
      pointSize?: number;
      opacity?: number;
    }) => {
      const {
        count,
        minRadius,
        maxRadius,
        verticalScale,
        primary,
        secondary,
        pointSize = 0.72,
        opacity = 0.85
      } = opts;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const tempColor = new THREE.Color();
      const white = new THREE.Color(0xffffff);

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const r = minRadius + Math.pow(Math.random(), 1.3) * (maxRadius - minRadius);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        positions[i3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = r * Math.cos(phi) * verticalScale;
        positions[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);

        const t = Math.random();
        if (t < 0.2) {
          tempColor.copy(primary).lerp(white, 0.55);
        } else {
          tempColor.copy(primary).lerp(secondary, (t - 0.2) / 0.8);
        }
        colors[i3] = tempColor.r;
        colors[i3 + 1] = tempColor.g;
        colors[i3 + 2] = tempColor.b;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mat = new THREE.PointsMaterial({
        size: pointSize,
        map: glowTexture,
        vertexColors: true,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const aura = new THREE.Points(geo, mat);
      aura.userData.spinSpeedY = 0.14;
      return aura;
    };

    // Build Hybrid 3D Sculpted Architecture + Particle Systems for Each Node
    const buildNodeMeshGroup = (node: CosmicNodeData): THREE.Group => {
      const group = new THREE.Group();
      if (node.isWandering || node.id === 'node_zona_caotica_sabio') {
        group.position.copy(wanderingTargetRef.current);
      } else {
        group.position.set(node.position.x, node.position.y, node.position.z);
      }
      const baseScale = Math.max(0.5, node.scale || 1);
      group.scale.setScalar(baseScale);

      const primary = new THREE.Color(node.primaryColor || '#a855f7');
      const secondary = new THREE.Color(node.secondaryColor || '#38bdf8');
      const goldColor = new THREE.Color(0xd4af37);

      if (node.visualType === 'extraverse_castle') {
        // ==================== CASTELO EXTRAVERSO / CIDADELA SOBERANA ====================
        // Distinct 3D Floating Astral Citadel + Ascending Starlight Embers (NOT a spiral galaxy!)
        const citadelGroup = new THREE.Group();
        citadelGroup.userData.floatBob = true;

        // Inverted Floating Island Crystal Base
        const baseCone = new THREE.Mesh(
          new THREE.ConeGeometry(2.3, 2.6, 6),
          new THREE.MeshStandardMaterial({
            color: 0x111827,
            emissive: secondary,
            emissiveIntensity: 0.35,
            metalness: 0.85,
            roughness: 0.25,
            flatShading: true
          })
        );
        baseCone.rotation.x = Math.PI;
        baseCone.position.y = -1.35;
        citadelGroup.add(baseCone);

        // Stepped Sovereign Terrace Platform
        const terrace = new THREE.Mesh(
          new THREE.CylinderGeometry(2.45, 2.15, 0.55, 6),
          new THREE.MeshStandardMaterial({
            color: primary,
            emissive: primary,
            emissiveIntensity: 0.45,
            metalness: 0.8,
            roughness: 0.2,
            flatShading: true
          })
        );
        terrace.position.y = 0.15;
        citadelGroup.add(terrace);

        // Grand Central Throne Spire
        const centralTower = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.95, 3.2, 6),
          new THREE.MeshStandardMaterial({
            color: 0xfef3c7,
            emissive: primary,
            emissiveIntensity: 0.75,
            metalness: 0.65,
            roughness: 0.2,
            flatShading: true
          })
        );
        centralTower.position.y = 1.9;
        citadelGroup.add(centralTower);

        const centralRoof = new THREE.Mesh(
          new THREE.ConeGeometry(0.65, 1.4, 6),
          new THREE.MeshStandardMaterial({
            color: primary,
            emissive: primary,
            emissiveIntensity: 1.0,
            metalness: 0.7,
            roughness: 0.15,
            flatShading: true
          })
        );
        centralRoof.position.y = 4.15;
        citadelGroup.add(centralRoof);

        // 4 Surrounding Gothic-Astral Bastion Spires
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const dist = 1.75;
          const turret = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.38, 1.85, 6),
            new THREE.MeshStandardMaterial({
              color: secondary,
              emissive: secondary,
              emissiveIntensity: 0.6,
              metalness: 0.75,
              roughness: 0.25,
              flatShading: true
            })
          );
          turret.position.set(Math.cos(ang) * dist, 1.15, Math.sin(ang) * dist);
          citadelGroup.add(turret);

          const turretTip = new THREE.Mesh(
            new THREE.ConeGeometry(0.32, 0.85, 6),
            new THREE.MeshStandardMaterial({
              color: primary,
              emissive: primary,
              emissiveIntensity: 0.9,
              flatShading: true
            })
          );
          turretTip.position.set(Math.cos(ang) * dist, 2.45, Math.sin(ang) * dist);
          citadelGroup.add(turretTip);
        }

        // Levitating Sovereign Crown Halo Ring around the Spire
        const crownRing = new THREE.Mesh(
          new THREE.TorusGeometry(2.8, 0.08, 12, 48),
          new THREE.MeshBasicMaterial({
            color: primary,
            transparent: true,
            opacity: 0.85
          })
        );
        crownRing.rotation.x = Math.PI / 2;
        crownRing.position.y = 1.6;
        crownRing.userData.spinSpeedZ = 0.45;
        citadelGroup.add(crownRing);

        group.add(citadelGroup);

        // Spherical/Vertical Celestial Particle Aura around the Citadel
        group.add(
          createAmbientParticleAura({
            count: 520,
            minRadius: 2.0,
            maxRadius: 4.8,
            verticalScale: 1.35,
            primary,
            secondary,
            pointSize: 0.68
          })
        );
      } else if (node.visualType === 'macro_prison') {
        // ==================== PRISÃO MACROVERSAL / SELO DO NADA ====================
        // Pitch-Black Singularity Core locked inside 3 Interlocking Runic Cages + Binding Spikes + Dark Embers
        const voidCore = new THREE.Mesh(
          new THREE.SphereGeometry(1.35, 32, 32),
          new THREE.MeshBasicMaterial({ color: 0x020105 })
        );
        group.add(voidCore);

        // Glowing Containment Rim around the Void Core
        const rimShell = new THREE.Mesh(
          new THREE.SphereGeometry(1.48, 24, 24),
          new THREE.MeshBasicMaterial({
            color: primary,
            wireframe: true,
            transparent: true,
            opacity: 0.45
          })
        );
        rimShell.userData.spinSpeedY = -0.35;
        group.add(rimShell);

        // 3 Interlocking Runic Containment Rings (Gyroscopic Cage)
        for (let rIdx = 0; rIdx < 3; rIdx++) {
          const cageRing = new THREE.Mesh(
            new THREE.TorusGeometry(2.35 + rIdx * 0.42, 0.09, 12, 48),
            new THREE.MeshStandardMaterial({
              color: rIdx === 1 ? goldColor : primary,
              emissive: rIdx === 1 ? goldColor : primary,
              emissiveIntensity: 0.85,
              metalness: 0.85,
              roughness: 0.2
            })
          );
          cageRing.rotation.x = (rIdx * Math.PI) / 3;
          cageRing.rotation.y = (rIdx * Math.PI) / 4;
          cageRing.userData.spinSpeedX = (rIdx % 2 === 0 ? 1 : -1) * 0.32;
          cageRing.userData.spinSpeedY = (rIdx % 2 === 0 ? -1 : 1) * 0.24;
          group.add(cageRing);
        }

        // 6 Inward-Pointing Binding Pylons / Anchors locking the Void
        const spikesGroup = new THREE.Group();
        spikesGroup.userData.spinSpeedY = 0.18;
        for (let s = 0; s < 6; s++) {
          const ang = (s / 6) * Math.PI * 2;
          const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.28, 1.45, 5),
            new THREE.MeshStandardMaterial({
              color: secondary,
              emissive: primary,
              emissiveIntensity: 0.65,
              metalness: 0.8,
              roughness: 0.25,
              flatShading: true
            })
          );
          spike.position.set(Math.cos(ang) * 2.85, 0, Math.sin(ang) * 2.85);
          spike.lookAt(0, 0, 0);
          spike.rotateX(Math.PI / 2);
          spikesGroup.add(spike);
        }
        group.add(spikesGroup);

        // Swirling Containment Seal Particles
        group.add(
          createAmbientParticleAura({
            count: 680,
            minRadius: 1.7,
            maxRadius: 4.9,
            verticalScale: 0.95,
            primary,
            secondary: goldColor,
            pointSize: 0.68
          })
        );
      } else if (node.visualType === 'corrupted_well') {
        // ==================== POÇO DA CORRUPÇÃO (PORTAL DE ENTRADA) ====================
        // Abyssal Dimensional Portal Gate (Tilted Monolithic Ring + Pillars) + Crimson Vortex Funnel
        const portalGroup = new THREE.Group();
        portalGroup.rotation.x = 0.55; // Angled toward camera so the portal mouth & pillars are clearly visible

        // Outer Obsidian-Crimson Portal Arch Ring
        const archRing = new THREE.Mesh(
          new THREE.TorusGeometry(2.15, 0.22, 12, 36),
          new THREE.MeshStandardMaterial({
            color: 0x1f090d,
            emissive: primary,
            emissiveIntensity: 0.75,
            metalness: 0.75,
            roughness: 0.3,
            flatShading: true
          })
        );
        portalGroup.add(archRing);

        // Inner Blood-Red Event Horizon Disc
        const horizonDisc = new THREE.Mesh(
          new THREE.CircleGeometry(1.95, 32),
          new THREE.MeshBasicMaterial({
            color: primary,
            transparent: true,
            opacity: 0.38,
            side: THREE.DoubleSide
          })
        );
        portalGroup.add(horizonDisc);

        // 4 Jagged Abyssal Pillars Framing the Gateway
        for (let p = 0; p < 4; p++) {
          const ang = (p / 4) * Math.PI * 2 + Math.PI / 4;
          const pillar = new THREE.Mesh(
            new THREE.ConeGeometry(0.32, 1.5, 5),
            new THREE.MeshStandardMaterial({
              color: secondary,
              emissive: primary,
              emissiveIntensity: 0.6,
              flatShading: true
            })
          );
          pillar.position.set(Math.cos(ang) * 2.25, Math.sin(ang) * 2.25, 0.25);
          pillar.rotation.x = Math.PI / 2;
          portalGroup.add(pillar);
        }
        group.add(portalGroup);

        // Swirling Abyssal Funnel of Crimson Particles sucking into the Well
        const vortexFunnel = createSpiralGalaxyCloud({
          count: 850,
          arms: 4,
          radius: 3.6,
          spin: 2.6,
          thickness: 0.5,
          primary,
          secondary,
          coreWhiteMix: 0.25,
          verticalFunnel: 2.3,
          pointSize: 0.66
        });
        group.add(vortexFunnel);
      } else if (node.visualType === 'starship_vessel') {
        // ==================== NAVE MACROVERSAL ====================
        // Distinct 3D Interuniversal Star-Cruiser Hull + Ion Particle Wake
        const shipHullGroup = new THREE.Group();
        shipHullGroup.name = 'starship_hull';

        // Sleek Armored Forward Prow (elongated 4-sided pyramid pointing along +Z)
        const prowMesh = new THREE.Mesh(
          new THREE.ConeGeometry(0.75, 2.8, 4),
          new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            emissive: primary,
            emissiveIntensity: 0.55,
            metalness: 0.88,
            roughness: 0.18,
            flatShading: true
          })
        );
        prowMesh.rotation.x = Math.PI / 2;
        prowMesh.rotation.z = Math.PI / 4;
        prowMesh.position.z = 1.1;
        shipHullGroup.add(prowMesh);

        // Main Cruiser Fuselage & Elevated Command Bridge
        const bridgeMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.65, 0.55, 1.5),
          new THREE.MeshStandardMaterial({
            color: secondary,
            emissive: secondary,
            emissiveIntensity: 0.7,
            metalness: 0.85,
            roughness: 0.2
          })
        );
        bridgeMesh.position.set(0, 0.42, 0.1);
        shipHullGroup.add(bridgeMesh);

        // Swept Star-Cruiser Delta Wings
        const wingsMesh = new THREE.Mesh(
          new THREE.BoxGeometry(3.2, 0.12, 1.35),
          new THREE.MeshStandardMaterial({
            color: primary,
            emissive: primary,
            emissiveIntensity: 0.65,
            metalness: 0.85,
            roughness: 0.22
          })
        );
        wingsMesh.position.set(0, 0, -0.15);
        shipHullGroup.add(wingsMesh);

        // Dual Warp Nacelle Engines (Port & Starboard)
        [-1.15, 1.15].forEach((xOffset) => {
          const nacelle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.22, 1.7, 12),
            new THREE.MeshStandardMaterial({
              color: 0x0f172a,
              emissive: primary,
              emissiveIntensity: 0.8,
              metalness: 0.9,
              roughness: 0.15
            })
          );
          nacelle.rotation.x = Math.PI / 2;
          nacelle.position.set(xOffset, -0.05, -0.35);
          shipHullGroup.add(nacelle);
        });

        // Streaming Ion-Plasma Particle Wake behind the Thrusters
        const wakeCount = 550;
        const wakePos = new Float32Array(wakeCount * 3);
        const wakeCol = new Float32Array(wakeCount * 3);
        const cTemp = new THREE.Color();
        for (let i = 0; i < wakeCount; i++) {
          const i3 = i * 3;
          const tNorm = Math.random();
          const angle = tNorm * Math.PI * 6 + (i % 2) * Math.PI;
          const spreadR = 0.12 + tNorm * 1.1;
          wakePos[i3] = Math.cos(angle) * spreadR;
          wakePos[i3 + 1] = Math.sin(angle) * spreadR * 0.45;
          wakePos[i3 + 2] = -0.9 - tNorm * 5.6;
          cTemp.copy(primary).lerp(secondary, tNorm);
          wakeCol[i3] = cTemp.r;
          wakeCol[i3 + 1] = cTemp.g;
          wakeCol[i3 + 2] = cTemp.b;
        }
        const wakeGeo = new THREE.BufferGeometry();
        wakeGeo.setAttribute('position', new THREE.BufferAttribute(wakePos, 3));
        wakeGeo.setAttribute('color', new THREE.BufferAttribute(wakeCol, 3));
        const wakeMat = new THREE.PointsMaterial({
          size: 0.72,
          map: glowTexture,
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        shipHullGroup.add(new THREE.Points(wakeGeo, wakeMat));

        group.add(shipHullGroup);
      } else if (node.visualType === 'wandering_pocket') {
        // ==================== ZONA CAÓTICA DO SÁBIO ====================
        // Arcane Pocket-Dimension Reliquary (Octahedron Core + Wireframe Dodecahedron Cage) + Rift Sparks
        const coreOcta = new THREE.Mesh(
          new THREE.OctahedronGeometry(1.25, 0),
          new THREE.MeshStandardMaterial({
            color: primary,
            emissive: primary,
            emissiveIntensity: 0.95,
            metalness: 0.65,
            roughness: 0.15,
            flatShading: true
          })
        );
        coreOcta.userData.spinSpeedY = 0.65;
        coreOcta.userData.spinSpeedX = 0.35;
        group.add(coreOcta);

        const outerCage = new THREE.Mesh(
          new THREE.DodecahedronGeometry(2.15, 0),
          new THREE.MeshBasicMaterial({
            color: secondary,
            wireframe: true,
            transparent: true,
            opacity: 0.75
          })
        );
        outerCage.userData.spinSpeedY = -0.4;
        outerCage.userData.spinSpeedZ = 0.28;
        group.add(outerCage);

        const arcaneRing = new THREE.Mesh(
          new THREE.TorusGeometry(2.65, 0.06, 12, 48),
          new THREE.MeshBasicMaterial({
            color: primary,
            transparent: true,
            opacity: 0.8
          })
        );
        arcaneRing.rotation.x = Math.PI / 3;
        arcaneRing.userData.spinSpeedZ = -0.5;
        group.add(arcaneRing);

        group.add(
          createAmbientParticleAura({
            count: 540,
            minRadius: 1.5,
            maxRadius: 4.2,
            verticalScale: 1.0,
            primary,
            secondary,
            pointSize: 0.72
          })
        );
      } else if (node.visualType === 'festival_arena') {
        // ==================== O FESTIVAL (COLISEU ESTELAR) ====================
        // 3D Grand Cosmic Colosseum Stadium Ring + 6 Crowned Pylons + Central Duel Crystal + Rising Sparks
        const colosseumGroup = new THREE.Group();

        // Outer Armored Colosseum Wall Ring
        const stadiumWall = new THREE.Mesh(
          new THREE.CylinderGeometry(2.75, 2.35, 0.95, 12, 1, true),
          new THREE.MeshStandardMaterial({
            color: primary,
            emissive: primary,
            emissiveIntensity: 0.65,
            metalness: 0.8,
            roughness: 0.25,
            side: THREE.DoubleSide,
            flatShading: true
          })
        );
        colosseumGroup.add(stadiumWall);

        // Glowing Tournament Arena Stage Floor
        const arenaFloor = new THREE.Mesh(
          new THREE.CylinderGeometry(2.25, 2.25, 0.18, 24),
          new THREE.MeshStandardMaterial({
            color: 0x1e1b4b,
            emissive: secondary,
            emissiveIntensity: 0.55,
            metalness: 0.7,
            roughness: 0.2
          })
        );
        arenaFloor.position.y = -0.35;
        colosseumGroup.add(arenaFloor);

        // 6 Grand Tournament Pylons around the Colosseum Rim
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          const pylon = new THREE.Mesh(
            new THREE.BoxGeometry(0.32, 1.75, 0.32),
            new THREE.MeshStandardMaterial({
              color: primary,
              emissive: secondary,
              emissiveIntensity: 0.7,
              metalness: 0.8,
              roughness: 0.2
            })
          );
          pylon.position.set(Math.cos(ang) * 2.65, 0.55, Math.sin(ang) * 2.65);
          colosseumGroup.add(pylon);
        }

        // Floating Champion Trophy Crystal above the Arena
        const championCrystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.75, 0),
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: primary,
            emissiveIntensity: 1.1,
            flatShading: true
          })
        );
        championCrystal.position.y = 1.35;
        championCrystal.userData.spinSpeedY = 0.85;
        colosseumGroup.add(championCrystal);

        group.add(colosseumGroup);

        group.add(
          createAmbientParticleAura({
            count: 580,
            minRadius: 1.6,
            maxRadius: 4.5,
            verticalScale: 1.2,
            primary,
            secondary,
            pointSize: 0.72
          })
        );
      } else if (node.visualType === 'the_veil') {
        // ==================== O VÉU ====================
        // Serene Silver Sanctuary Core + 3 Translucent Celestial Veil Ribbon Arches + Mist Particles
        const veilCore = new THREE.Mesh(
          new THREE.SphereGeometry(1.15, 32, 32),
          new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            emissive: primary,
            emissiveIntensity: 0.75,
            metalness: 0.3,
            roughness: 0.15
          })
        );
        group.add(veilCore);

        // 3 Sweeping Translucent Veil Ribbons wrapping the Sanctuary
        for (let v = 0; v < 3; v++) {
          const veilRibbon = new THREE.Mesh(
            new THREE.TorusGeometry(2.1 + v * 0.55, 0.18, 16, 48, Math.PI * 1.45),
            new THREE.MeshStandardMaterial({
              color: v % 2 === 0 ? primary : secondary,
              emissive: v % 2 === 0 ? primary : secondary,
              emissiveIntensity: 0.55,
              transparent: true,
              opacity: 0.55,
              side: THREE.DoubleSide
            })
          );
          veilRibbon.rotation.x = 0.45 + v * 0.5;
          veilRibbon.rotation.y = v * 1.1;
          veilRibbon.userData.spinSpeedY = (v % 2 === 0 ? 1 : -1) * 0.22;
          veilRibbon.userData.spinSpeedZ = 0.15;
          group.add(veilRibbon);
        }

        group.add(
          createAmbientParticleAura({
            count: 720,
            minRadius: 1.5,
            maxRadius: 4.8,
            verticalScale: 1.15,
            primary,
            secondary,
            pointSize: 0.82,
            opacity: 0.75
          })
        );
      } else if (node.visualType === 'pathway_of_doors') {
        // ==================== CAMINHO ENTRE OS CAMINHOS ====================
        // Sleek, Thin Continuous Spiral Line spanning the entire Macroverse 13 Map
        // Centered around the Macroverse origin (0,0,0) in world space while passing directly through this node's position
        const invScale = 1 / baseScale;
        const rMin = 2.5;
        const rMax = 63.0;
        const turns = 4.25;
        const totalAngle = turns * Math.PI * 2;

        const nodeR = Math.max(rMin, Math.min(rMax, Math.hypot(node.position.x, node.position.z) || 38));
        const nodeAngle = Math.atan2(node.position.z, node.position.x);
        const tNode = (nodeR - rMin) / (rMax - rMin);

        const curvePointsLumen: THREE.Vector3[] = [];
        const curvePointsDarkus: THREE.Vector3[] = [];
        const sampleCount = 320;

        for (let i = 0; i <= sampleCount; i++) {
          const t = i / sampleCount;
          const r = rMin + t * (rMax - rMin);
          const theta = nodeAngle + (t - tNode) * totalAngle;

          // Smooth height profile: passes exactly through node.position.y at tNode and glides softly across the map
          const bell = Math.exp(-Math.pow((t - tNode) * 2.6, 2));
          const wy = node.position.y * bell + 2.2 * (1 - bell);
          const wx = Math.cos(theta) * r;
          const wz = Math.sin(theta) * r;

          // Convert world coordinate to this node's local space
          const lx = (wx - node.position.x) * invScale;
          const ly = (wy - node.position.y) * invScale;
          const lz = (wz - node.position.z) * invScale;

          // Slight helical micro-braid between the Lúmen and Darkus thin lines
          const braidPhase = t * Math.PI * 28;
          const braidOffset = 0.14 * invScale;
          curvePointsLumen.push(
            new THREE.Vector3(
              lx + Math.cos(braidPhase) * braidOffset,
              ly + Math.sin(braidPhase) * braidOffset * 0.6,
              lz
            )
          );
          curvePointsDarkus.push(
            new THREE.Vector3(
              lx - Math.cos(braidPhase) * braidOffset,
              ly - Math.sin(braidPhase) * braidOffset * 0.6,
              lz
            )
          );
        }

        const lumenCurve = new THREE.CatmullRomCurve3(curvePointsLumen);
        const darkusCurve = new THREE.CatmullRomCurve3(curvePointsDarkus);

        // 1. Razor-Thin Luminous Lúmen Spiral Filament (Tube + Core Line)
        const lumenTubeGeo = new THREE.TubeGeometry(lumenCurve, 420, 0.055 * invScale, 6, false);
        const lumenTubeMat = new THREE.MeshBasicMaterial({
          color: primary,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        group.add(new THREE.Mesh(lumenTubeGeo, lumenTubeMat));

        const lumenLineGeo = new THREE.BufferGeometry().setFromPoints(lumenCurve.getPoints(500));
        const lumenLineMat = new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.95
        });
        group.add(new THREE.Line(lumenLineGeo, lumenLineMat));

        // 2. Razor-Thin Intertwined Darkus Spiral Filament
        const darkusTubeGeo = new THREE.TubeGeometry(darkusCurve, 420, 0.055 * invScale, 6, false);
        const darkusTubeMat = new THREE.MeshBasicMaterial({
          color: 0xa855f7,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        group.add(new THREE.Mesh(darkusTubeGeo, darkusTubeMat));

        // 3. Delicate Shimmering Dust Strictly Hugging the Thin Spiral Line
        const shimmerCount = 900;
        const shPositions = new Float32Array(shimmerCount * 3);
        const shColors = new Float32Array(shimmerCount * 3);
        const lumenCol = new THREE.Color(0xfef08a);
        const darkusCol = new THREE.Color(0xa855f7);
        const whiteCol = new THREE.Color(0xffffff);
        const cTmp = new THREE.Color();

        for (let i = 0; i < shimmerCount; i++) {
          const i3 = i * 3;
          const u = i / (shimmerCount - 1);
          const pt = (i % 2 === 0 ? lumenCurve : darkusCurve).getPointAt(u);
          shPositions[i3] = pt.x + (Math.random() - 0.5) * 0.12;
          shPositions[i3 + 1] = pt.y + (Math.random() - 0.5) * 0.12;
          shPositions[i3 + 2] = pt.z + (Math.random() - 0.5) * 0.12;

          if (i % 2 === 0) {
            cTmp.copy(lumenCol).lerp(whiteCol, 0.45);
          } else {
            cTmp.copy(darkusCol).lerp(secondary, 0.35);
          }
          shColors[i3] = cTmp.r;
          shColors[i3 + 1] = cTmp.g;
          shColors[i3 + 2] = cTmp.b;
        }
        const shimmerGeo = new THREE.BufferGeometry();
        shimmerGeo.setAttribute('position', new THREE.BufferAttribute(shPositions, 3));
        shimmerGeo.setAttribute('color', new THREE.BufferAttribute(shColors, 3));
        const shimmerMat = new THREE.PointsMaterial({
          size: 0.45,
          map: glowTexture,
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        group.add(new THREE.Points(shimmerGeo, shimmerMat));

        // 4. Compact Lúmen & Darkus Dual-Star Node Anchor at (0, 0, 0) where the Spiral passes through
        const anchorRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.65, 0.035, 12, 36),
          new THREE.MeshBasicMaterial({
            color: primary,
            transparent: true,
            opacity: 0.9
          })
        );
        anchorRing.rotation.x = Math.PI / 2;
        anchorRing.userData.spinSpeedZ = 0.6;
        group.add(anchorRing);
      } else if (node.visualType === 'black_hole' || node.visualType === 'mirror_macroverse') {
        // ==================== MACROVERSO INVERSO (BURACO NEGRO) ====================
        // Gargantua-Style Black Hole Singularity + Photon Ring + Gravitational Lensing Arch + Accretion Disc
        const eventHorizon = new THREE.Mesh(
          new THREE.SphereGeometry(1.85, 36, 36),
          new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        group.add(eventHorizon);

        // Blazing Inner Photon Sphere Ring hugging the Black Hole Shadow
        const photonRing = new THREE.Mesh(
          new THREE.TorusGeometry(1.92, 0.08, 16, 64),
          new THREE.MeshBasicMaterial({
            color: 0xffffff
          })
        );
        photonRing.rotation.x = Math.PI / 2.15;
        group.add(photonRing);

        // Relativistic Gravitational Lensing Light Arch (Top & Bottom Bent Light Halo)
        const lensingArchA = new THREE.Mesh(
          new THREE.TorusGeometry(2.05, 0.09, 16, 64),
          new THREE.MeshBasicMaterial({
            color: primary,
            transparent: true,
            opacity: 0.88
          })
        );
        lensingArchA.rotation.x = 0.22;
        lensingArchA.userData.spinSpeedZ = 0.35;
        group.add(lensingArchA);

        const lensingArchB = new THREE.Mesh(
          new THREE.TorusGeometry(2.15, 0.06, 16, 64),
          new THREE.MeshBasicMaterial({
            color: secondary,
            transparent: true,
            opacity: 0.72
          })
        );
        lensingArchB.rotation.y = Math.PI / 2;
        lensingArchB.rotation.x = 0.22;
        lensingArchB.userData.spinSpeedZ = -0.35;
        group.add(lensingArchB);

        // Glowing Equatorial Accretion Disc Plane
        const accretionRing = new THREE.Mesh(
          new THREE.RingGeometry(1.98, 4.9, 64),
          new THREE.MeshBasicMaterial({
            color: primary,
            transparent: true,
            opacity: 0.36,
            side: THREE.DoubleSide
          })
        );
        accretionRing.rotation.x = Math.PI / 2.15;
        group.add(accretionRing);

        // Swirling High-Velocity Accretion Disc Particles
        const accretionParticles = createSpiralGalaxyCloud({
          count: 2400,
          arms: 6,
          radius: 5.8,
          spin: -3.2,
          thickness: 0.24,
          primary,
          secondary,
          coreWhiteMix: 0.95,
          pointSize: 0.72
        });
        accretionParticles.rotation.x = 0.08;
        group.add(accretionParticles);
      } else if (node.visualType === 'chaos_network') {
        // ==================== NÚCLEO DA REDE DO CAOS ====================
        // 3D Geodesic Neural Matrix Core + Radiating Conduit Struts + Synaptic Particle Cloud
        const nexusCore = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1.35, 0),
          new THREE.MeshStandardMaterial({
            color: primary,
            emissive: primary,
            emissiveIntensity: 0.9,
            metalness: 0.75,
            roughness: 0.2,
            flatShading: true
          })
        );
        nexusCore.userData.spinSpeedY = 0.4;
        group.add(nexusCore);

        const wireMatrix = new THREE.Mesh(
          new THREE.IcosahedronGeometry(2.35, 1),
          new THREE.MeshBasicMaterial({
            color: secondary,
            wireframe: true,
            transparent: true,
            opacity: 0.55
          })
        );
        wireMatrix.userData.spinSpeedY = -0.25;
        wireMatrix.userData.spinSpeedX = 0.2;
        group.add(wireMatrix);

        group.add(
          createAmbientParticleAura({
            count: 650,
            minRadius: 1.6,
            maxRadius: 4.8,
            verticalScale: 1.0,
            primary,
            secondary,
            pointSize: 0.7
          })
        );
      } else if (node.visualType === 'mecha_universe') {
        // ==================== UNIVERSO TECMA & FÁBRICA DO VON ====================
        // Hybrid: 3-Arm Particle Spiral Galaxy + Hexagonal 3D Dyson-Ring Megastructure & Pylons
        const mechaSpiral = createSpiralGalaxyCloud({
          count: 1450,
          arms: 3,
          radius: 4.9,
          spin: 1.45,
          thickness: 0.6,
          primary,
          secondary,
          coreWhiteMix: 0.8,
          pointSize: 0.72
        });
        mechaSpiral.rotation.x = 0.14;
        group.add(mechaSpiral);

        // Central Reactor Sun Core
        const reactorCore = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.95, 1),
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: primary,
            emissiveIntensity: 1.1,
            metalness: 0.85,
            roughness: 0.15,
            flatShading: true
          })
        );
        reactorCore.userData.spinSpeedY = 0.5;
        group.add(reactorCore);

        // Hexagonal Dyson-Sphere Megastructure Frame
        const dysonRing = new THREE.Mesh(
          new THREE.TorusGeometry(3.15, 0.12, 8, 6),
          new THREE.MeshStandardMaterial({
            color: primary,
            emissive: secondary,
            emissiveIntensity: 0.75,
            metalness: 0.9,
            roughness: 0.2,
            flatShading: true
          })
        );
        dysonRing.rotation.x = Math.PI / 2.3;
        dysonRing.userData.spinSpeedZ = -0.3;
        group.add(dysonRing);

        // 6 Orbital Industrial Nodes around the Dyson Ring
        const pylonsGroup = new THREE.Group();
        pylonsGroup.userData.spinSpeedY = 0.25;
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          const nodeBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.38, 0.38, 0.38),
            new THREE.MeshStandardMaterial({
              color: secondary,
              emissive: primary,
              emissiveIntensity: 0.85
            })
          );
          nodeBox.position.set(Math.cos(ang) * 3.15, 0, Math.sin(ang) * 3.15);
          pylonsGroup.add(nodeBox);
        }
        group.add(pylonsGroup);
      } else {
        // ==================== UNIVERSOS (PRIMORDIAL & PARALELOS) ====================
        // Hybrid: Logarithmic Particle Spiral Galaxy + Sculpted 3D Galactic Core & Orbital Rings
        const isPrimordial = node.id === 'node_universo_principal' || node.category === 'universo_principal';
        const armCount = isPrimordial ? 5 : 4;
        const galaxyRadius = isPrimordial ? 6.2 : 5.0;

        const spiralGalaxy = createSpiralGalaxyCloud({
          count: isPrimordial ? 2300 : 1650,
          arms: armCount,
          radius: galaxyRadius,
          spin: 1.65,
          thickness: 0.7,
          primary,
          secondary,
          coreWhiteMix: 0.85,
          pointSize: 0.74
        });
        spiralGalaxy.rotation.x = 0.15;
        spiralGalaxy.rotation.z = -0.08;
        group.add(spiralGalaxy);

        const nebulaCloud = createNebulaHazeCloud(280, galaxyRadius * 0.88, primary, secondary);
        nebulaCloud.rotation.x = 0.15;
        nebulaCloud.rotation.z = -0.08;
        group.add(nebulaCloud);

        // 3D Sculpted Galactic Sun Nucleus
        const galacticCore = new THREE.Mesh(
          new THREE.SphereGeometry(isPrimordial ? 1.05 : 0.78, 24, 24),
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: primary,
            emissiveIntensity: 1.2,
            roughness: 0.15,
            metalness: 0.2
          })
        );
        group.add(galacticCore);

        if (isPrimordial) {
          // Primordial Universe Crown: Dual Interlocking Golden Celestial Astrolabe Rings
          const outerAstrolabe = new THREE.Mesh(
            new THREE.TorusGeometry(3.6, 0.08, 12, 64),
            new THREE.MeshStandardMaterial({
              color: goldColor,
              emissive: goldColor,
              emissiveIntensity: 0.85,
              metalness: 0.9,
              roughness: 0.15
            })
          );
          outerAstrolabe.rotation.x = Math.PI / 2.6;
          outerAstrolabe.userData.spinSpeedZ = 0.28;
          group.add(outerAstrolabe);

          const innerAstrolabe = new THREE.Mesh(
            new THREE.TorusGeometry(2.35, 0.06, 12, 48),
            new THREE.MeshStandardMaterial({
              color: secondary,
              emissive: primary,
              emissiveIntensity: 0.8,
              metalness: 0.85,
              roughness: 0.2
            })
          );
          innerAstrolabe.rotation.x = -Math.PI / 3.2;
          innerAstrolabe.userData.spinSpeedZ = -0.38;
          group.add(innerAstrolabe);
        } else {
          // Parallel Universe: Subtle Tilted Planetary Orbit Ring + 2 Orbiting Worlds
          const orbitGroup = new THREE.Group();
          orbitGroup.rotation.x = 0.38;
          orbitGroup.rotation.z = 0.22;
          orbitGroup.userData.spinSpeedY = 0.35;

          const orbitTrack = new THREE.Mesh(
            new THREE.TorusGeometry(2.45, 0.04, 10, 48),
            new THREE.MeshBasicMaterial({
              color: secondary,
              transparent: true,
              opacity: 0.55
            })
          );
          orbitTrack.rotation.x = Math.PI / 2;
          orbitGroup.add(orbitTrack);

          const planetA = new THREE.Mesh(
            new THREE.SphereGeometry(0.24, 16, 16),
            new THREE.MeshStandardMaterial({
              color: 0xffffff,
              emissive: secondary,
              emissiveIntensity: 0.9
            })
          );
          planetA.position.set(2.45, 0, 0);
          orbitGroup.add(planetA);

          const planetB = new THREE.Mesh(
            new THREE.SphereGeometry(0.17, 16, 16),
            new THREE.MeshStandardMaterial({
              color: primary,
              emissive: primary,
              emissiveIntensity: 0.85
            })
          );
          planetB.position.set(-2.45, 0, 0);
          orbitGroup.add(planetB);

          group.add(orbitGroup);
        }
      }

      // Soft Galactic/Landmark Glow Halo Sprite
      const isThinSpiralPath = node.visualType === 'pathway_of_doors';
      const haloSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          color: primary,
          transparent: true,
          opacity: isThinSpiralPath ? 0.22 : 0.42,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      haloSprite.scale.set(isThinSpiralPath ? 3.2 : 9.5, isThinSpiralPath ? 3.2 : 9.5, 1);
      group.add(haloSprite);

      return group;
    };

    const rebuildNodes = () => {
      nodesContainer.traverse((obj) => {
        const anyObj = obj as any;
        if (anyObj.geometry) anyObj.geometry.dispose();
        if (anyObj.material) {
          if (Array.isArray(anyObj.material)) anyObj.material.forEach((mt: any) => mt.dispose());
          else anyObj.material.dispose();
        }
      });
      nodesContainer.clear();

      connectionLinesGroup.traverse((obj) => {
        if ((obj as THREE.Line).isLine) {
          const l = obj as THREE.Line;
          l.geometry?.dispose();
          (l.material as THREE.Material)?.dispose();
        }
      });
      connectionLinesGroup.clear();

      sceneObjectsRef.current.nodeGroups.clear();
      sceneObjectsRef.current.clickableProxies = [];

      if (astrolabeGroup) {
        astrolabeGroup.visible =
          activePlaneRef.current === 'macroverso_13' || activePlaneRef.current === 'all';
      }

      const activeList = [...nodesRef.current];
      if (editingNode) {
        const idx = activeList.findIndex((n) => n.id === editingNode.id);
        if (idx >= 0) activeList[idx] = editingNode;
        else activeList.push(editingNode);
      }

      const byId = new Map<string, CosmicNodeData>();
      activeList.forEach((n) => byId.set(n.id, n));

      activeList.forEach((node) => {
        const group = buildNodeMeshGroup(node);
        nodesContainer.add(group);
        sceneObjectsRef.current.nodeGroups.set(node.id, group);

        const proxy = new THREE.Mesh(
          new THREE.SphereGeometry(4.2, 12, 12),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        proxy.userData.nodeId = node.id;
        group.add(proxy);
        sceneObjectsRef.current.clickableProxies.push(proxy);
      });

      // Subtle Cosmic Leyline Filaments between connected nodes
      const drawnPairs = new Set<string>();
      activeList.forEach((node) => {
        if (node.isTravelingShip || node.isWandering) return;
        (node.connectedNodeIds || []).forEach((targetId) => {
          const target = byId.get(targetId);
          if (!target || target.isTravelingShip || target.isWandering) return;
          const pairKey = [node.id, target.id].sort().join('--');
          if (drawnPairs.has(pairKey)) return;
          drawnPairs.add(pairKey);

          const start = new THREE.Vector3(node.position.x, node.position.y, node.position.z);
          const end = new THREE.Vector3(target.position.x, target.position.y, target.position.z);
          const mid = start.clone().lerp(end, 0.5);
          mid.y += 3.5;

          const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
          const points = curve.getPoints(36);
          const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
          const lineMat = new THREE.LineBasicMaterial({
            color: new THREE.Color(node.primaryColor || '#a855f7'),
            transparent: true,
            opacity: 0.24
          });
          connectionLinesGroup.add(new THREE.Line(lineGeo, lineMat));
        });
      });
    };

    // Build Helldivers-Style Galactic Polar Sector War-Table Map
    const rebuildTerritories = () => {
      territoriesContainer.traverse((obj) => {
        const anyObj = obj as any;
        if (anyObj.geometry) anyObj.geometry.dispose();
        if (anyObj.material) {
          if (anyObj.material.map) anyObj.material.map.dispose();
          if (Array.isArray(anyObj.material)) anyObj.material.forEach((mt: any) => mt.dispose());
          else anyObj.material.dispose();
        }
      });
      territoriesContainer.clear();
      sceneObjectsRef.current.territoryGroups.clear();

      const activeSectors = territoriesRef.current;
      if (!activeSectors || activeSectors.length === 0) return;

      const mapTex = createHelldiversSectorMapTexture(activeSectors, selectedTerritoryId);
      const planeSize = 136;
      const mapGeo = new THREE.PlaneGeometry(planeSize, planeSize);
      mapGeo.rotateX(-Math.PI / 2);

      const mapMat = new THREE.MeshBasicMaterial({
        map: mapTex,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const warTableMesh = new THREE.Mesh(mapGeo, mapMat);
      warTableMesh.position.set(0, -1.6, 0);
      territoriesContainer.add(warTableMesh);
    };

    // Build 3D Character Trajectory Path across all visited locations (1º ➔ 2º ➔ 3º...)
    const rebuildTrajectory = () => {
      trajectoryGroup.traverse((obj) => {
        const anyObj = obj as any;
        if (anyObj.geometry) anyObj.geometry.dispose();
        if (anyObj.material) {
          if (Array.isArray(anyObj.material)) anyObj.material.forEach((mt: any) => mt.dispose());
          else anyObj.material.dispose();
        }
      });
      trajectoryGroup.clear();

      const stops = trackedTrajectoryRef.current;
      if (!stops || stops.length === 0) return;

      const getStopPos = (node: CosmicNodeData): THREE.Vector3 => {
        const liveGrp = sceneObjectsRef.current.nodeGroups.get(node.id);
        if (liveGrp) return liveGrp.position.clone();
        return new THREE.Vector3(node.position.x, node.position.y, node.position.z);
      };

      // 1. Luminous Golden-Cyan Beacon Rings around every location visited by the character
      stops.forEach((stopNode, idx) => {
        const pos = getStopPos(stopNode);
        const beaconGroup = new THREE.Group();
        beaconGroup.position.copy(pos);
        beaconGroup.userData.trackNodeId = stopNode.id;

        const ringRadius = Math.max(3.6, (stopNode.scale || 1) * 3.1);
        const ringGeo = new THREE.TorusGeometry(ringRadius, 0.11, 14, 56);
        ringGeo.rotateX(Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: idx === 0 ? 0x38bdf8 : idx === stops.length - 1 ? 0xfbbf24 : 0xd4af37,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        beaconGroup.add(ringMesh);

        const outerHaloGeo = new THREE.TorusGeometry(ringRadius * 1.18, 0.05, 10, 48);
        outerHaloGeo.rotateX(Math.PI / 2);
        const outerHaloMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const outerHaloMesh = new THREE.Mesh(outerHaloGeo, outerHaloMat);
        beaconGroup.add(outerHaloMesh);

        trajectoryGroup.add(beaconGroup);
      });

      // 2. Curved 3D Astral Trajectory Tubes + Directional Animated Energy Pulses between consecutive stops
      for (let i = 0; i < stops.length - 1; i++) {
        const startPos = getStopPos(stops[i]);
        const endPos = getStopPos(stops[i + 1]);
        const dist = startPos.distanceTo(endPos);
        const midPos = startPos.clone().lerp(endPos, 0.5);
        midPos.y += Math.min(18, Math.max(5.5, dist * 0.22));

        const curve = new THREE.QuadraticBezierCurve3(startPos, midPos, endPos);

        // Glowing Core Tube
        const tubeGeo = new THREE.TubeGeometry(curve, 56, 0.16, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        trajectoryGroup.add(tubeMesh);

        // Outer Cyan Aura Tube
        const auraTubeGeo = new THREE.TubeGeometry(curve, 56, 0.36, 8, false);
        const auraTubeMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.32,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const auraTubeMesh = new THREE.Mesh(auraTubeGeo, auraTubeMat);
        trajectoryGroup.add(auraTubeMesh);

        // 3 Traveling Energy Orbs per segment showing direction of travel (from i to i+1)
        for (let p = 0; p < 3; p++) {
          const pulseGeo = new THREE.SphereGeometry(0.42, 12, 12);
          const pulseMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });
          const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
          pulseMesh.userData.trajectoryCurve = curve;
          pulseMesh.userData.pulseOffset = p / 3;
          trajectoryGroup.add(pulseMesh);
        }
      }
    };

    sceneObjectsRef.current = {
      scene,
      camera,
      controls,
      nodeGroups: new Map(),
      territoryGroups: new Map(),
      clickableProxies: [],
      connectionLinesGroup,
      trajectoryGroup,
      astrolabeGroup,
      rebuildNodes,
      rebuildTerritories,
      rebuildTrajectory
    };

    rebuildNodes();
    rebuildTerritories();
    rebuildTrajectory();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverTime = 0;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (Math.hypot(dx, dy) > 6) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const mode = placementModeRef.current;
      if (mode) {
        const hitPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(placementPlane, hitPoint)) {
          if (mode === 'node') {
            startNewNodeAtRef.current({ x: hitPoint.x, y: 0, z: hitPoint.z });
          } else if (mode === 'corrupted_well') {
            pasteCorruptedWellAtRef.current({ x: hitPoint.x, y: -2, z: hitPoint.z });
          } else if (mode === 'territory' || mode === 'move_territory') {
            handleTerritoryMapClickRef.current({ x: hitPoint.x, y: 0, z: hitPoint.z });
          }
          return;
        }
      }

      const hits = raycaster.intersectObjects(sceneObjectsRef.current.clickableProxies, false);
      if (hits.length > 0) {
        const hitNodeId = hits[0].object.userData.nodeId;
        const found = nodesRef.current.find((n) => n.id === hitNodeId);
        if (found) {
          handleSelectNode(found);
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 45) return;
      lastHoverTime = now;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(sceneObjectsRef.current.clickableProxies, false);
      if (hits.length > 0) {
        const hitNodeId = hits[0].object.userData.nodeId;
        setHoveredNodeId(hitNodeId);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredNodeId(null);
        renderer.domElement.style.cursor = placementModeRef.current ? 'crosshair' : 'grab';
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let labelUpdateCounter = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      sceneObjectsRef.current.nodeGroups.forEach((group, id) => {
        const nodeData = nodesRef.current.find((n) => n.id === id);

        if (nodeData?.isTravelingShip || id === 'node_nave_gina') {
          const t = elapsed * 0.15;
          const nextT = t + 0.05;
          const curX = Math.sin(t) * 44;
          const curY = 10 + Math.cos(t * 2) * 5;
          const curZ = Math.sin(t * 2) * 28;

          _shipNextPos.set(
            Math.sin(nextT) * 44,
            10 + Math.cos(nextT * 2) * 5,
            Math.sin(nextT * 2) * 28
          );
          group.position.set(curX, curY, curZ);
          const hullChild = group.getObjectByName('starship_hull');
          if (hullChild) {
            hullChild.lookAt(_shipNextPos);
          }
        } else if (nodeData?.isWandering || id === 'node_zona_caotica_sabio') {
          group.position.lerp(wanderingTargetRef.current, 1 - Math.exp(-2.2 * delta));
        }

        // Animate both spiral particle galaxies and 3D sculptural structures (rings, cages, citadels, relics)
        group.traverse((child) => {
          if (child === group) return;
          if (child.userData.isSwirlingGalaxy) {
            child.rotation.y += delta * 0.24;
          }
          if (child.userData.spinSpeedX) {
            child.rotation.x += delta * child.userData.spinSpeedX;
          }
          if (child.userData.spinSpeedY) {
            child.rotation.y += delta * child.userData.spinSpeedY;
          }
          if (child.userData.spinSpeedZ) {
            child.rotation.z += delta * child.userData.spinSpeedZ;
          }
          if (child.userData.floatBob) {
            child.position.y = Math.sin(elapsed * 1.4) * 0.25;
          }
        });
      });

      // Animate character trajectory directional energy pulses & follow moving nodes
      trajectoryGroup.children.forEach((child) => {
        if (child.userData.trackNodeId) {
          const liveGrp = sceneObjectsRef.current.nodeGroups.get(child.userData.trackNodeId);
          if (liveGrp) {
            child.position.copy(liveGrp.position);
          }
          child.rotation.y += delta * 0.65;
        } else if (child.userData.trajectoryCurve) {
          const curve = child.userData.trajectoryCurve as THREE.QuadraticBezierCurve3;
          const offset = child.userData.pulseOffset || 0;
          const t = (elapsed * 0.38 + offset) % 1;
          curve.getPoint(t, child.position);
        }
      });

      starField.rotation.y += delta * 0.008;
      astrolabeGroup.rotation.y -= delta * 0.006;

      if (cameraFlightRef.current.active) {
        const dampFactor = 1 - Math.exp(-4.2 * delta);
        camera.position.lerp(cameraFlightRef.current.camPos, dampFactor);
        controls.target.lerp(cameraFlightRef.current.lookAt, dampFactor);
        if (
          camera.position.distanceTo(cameraFlightRef.current.camPos) < 0.15 &&
          controls.target.distanceTo(cameraFlightRef.current.lookAt) < 0.15
        ) {
          cameraFlightRef.current.active = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      labelUpdateCounter++;
      if (labelUpdateCounter % 2 === 0 && container) {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        const nextLabels: { id: string; x: number; y: number; visible: boolean; distance: number }[] = [];

        sceneObjectsRef.current.nodeGroups.forEach((grp, id) => {
          _projVec.copy(grp.position);
          const dist = camera.position.distanceTo(_projVec);
          _projVec.project(camera);
          const isBehind = _projVec.z > 1;
          const x = (_projVec.x * 0.5 + 0.5) * w;
          const y = (-(_projVec.y * 0.5) + 0.5) * h;
          const inBounds = !isBehind && x >= -60 && x <= w + 60 && y >= -60 && y <= h + 60;
          nextLabels.push({ id, x, y, visible: inBounds, distance: dist });
        });
        setProjectedLabels(nextLabels);

        const nextTerrLabels: { id: string; x: number; y: number; visible: boolean }[] = [];
        sceneObjectsRef.current.territoryGroups.forEach((tGrp, id) => {
          _projVec.copy(tGrp.position);
          _projVec.y += 0.5;
          _projVec.project(camera);
          const isBehind = _projVec.z > 1;
          const x = (_projVec.x * 0.5 + 0.5) * w;
          const y = (-(_projVec.y * 0.5) + 0.5) * h;
          const inBounds = !isBehind && x >= -60 && x <= w + 60 && y >= -60 && y <= h + 60;
          nextTerrLabels.push({ id, x, y, visible: inBounds });
        });
        setProjectedTerritories(nextTerrLabels);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      controls.dispose();
      glowTexture.dispose();
      bgStarGeo.dispose();
      bgStarMat.dispose();
      renderer.dispose();
    };
  }, []);

  // Rich Block Editor Helpers for Admin
  const addBlock = (type: LoreContentBlock['type']) => {
    if (!editingNode) return;
    const newBlock: LoreContentBlock = {
      id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      text: type === 'heading' ? 'Novo Subtítulo da Lore' : type === 'quote' ? 'Uma citação memorável...' : '',
      caption: '',
      mediaUrl: '',
      mediaList: type === 'gallery' ? [] : undefined
    };
    setEditingNode({
      ...editingNode,
      blocks: [...(editingNode.blocks || []), newBlock]
    });
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    if (!editingNode) return;
    const list = [...(editingNode.blocks || [])];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    setEditingNode({ ...editingNode, blocks: list });
  };

  const updateBlock = (index: number, patch: Partial<LoreContentBlock>) => {
    if (!editingNode) return;
    const list = [...(editingNode.blocks || [])];
    list[index] = { ...list[index], ...patch };
    setEditingNode({ ...editingNode, blocks: list });
  };

  const removeBlock = (index: number) => {
    if (!editingNode) return;
    const list = (editingNode.blocks || []).filter((_, idx) => idx !== index);
    setEditingNode({ ...editingNode, blocks: list });
  };

  // Timeline Event Helpers inside Edit Mode
  const addEditingTimelineEvent = () => {
    if (!editingNode) return;
    const newEv: CosmicLocationTimelineEvent = {
      id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      dateLabel: '',
      title: '',
      description: '',
      mediaUrl: '',
      mediaType: 'image'
    };
    setEditingNode({
      ...editingNode,
      timelineEvents: [...(editingNode.timelineEvents || []), newEv]
    });
  };

  const updateEditingTimelineEvent = (
    index: number,
    patch: Partial<CosmicLocationTimelineEvent>
  ) => {
    if (!editingNode) return;
    const list = [...(editingNode.timelineEvents || [])];
    list[index] = { ...list[index], ...patch };
    setEditingNode({ ...editingNode, timelineEvents: list });
  };

  const moveEditingTimelineEvent = (index: number, direction: -1 | 1) => {
    if (!editingNode) return;
    const list = [...(editingNode.timelineEvents || [])];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    setEditingNode({ ...editingNode, timelineEvents: list });
  };

  const removeEditingTimelineEvent = (index: number) => {
    if (!editingNode) return;
    const list = (editingNode.timelineEvents || []).filter((_, idx) => idx !== index);
    setEditingNode({ ...editingNode, timelineEvents: list });
  };

  // Quick Timeline Event Helpers directly inside Reader View (for Admin)
  const handleOpenNewTimelineForm = () => {
    setEditingTimelineEventId(null);
    setTimelineDraft({
      id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      dateLabel: '',
      title: '',
      description: '',
      mediaUrl: '',
      mediaType: 'image'
    });
    setIsTimelineFormOpen(true);
  };

  const handleOpenEditTimelineForm = (ev: CosmicLocationTimelineEvent) => {
    setEditingTimelineEventId(ev.id);
    setTimelineDraft({
      id: ev.id,
      dateLabel: ev.dateLabel || '',
      title: ev.title || '',
      description: ev.description || '',
      mediaUrl: ev.mediaUrl || '',
      mediaType: ev.mediaType || 'image'
    });
    setIsTimelineFormOpen(true);
  };

  const handleSaveQuickTimelineEvent = async (targetNode: CosmicNodeData) => {
    if (!timelineDraft.title.trim() && !timelineDraft.description.trim()) return;
    setSavingTimelineEvent(true);
    try {
      const existing = targetNode.timelineEvents || [];
      let nextEvents: CosmicLocationTimelineEvent[];
      if (editingTimelineEventId) {
        nextEvents = existing.map((ev) =>
          ev.id === editingTimelineEventId ? { ...timelineDraft } : ev
        );
      } else {
        nextEvents = [
          ...existing,
          {
            ...timelineDraft,
            id: timelineDraft.id || `tl_${Date.now()}`
          }
        ];
      }
      const updatedNode: CosmicNodeData = {
        ...targetNode,
        timelineEvents: nextEvents
      };
      await onSaveNode(updatedNode);
      setIsTimelineFormOpen(false);
      setEditingTimelineEventId(null);
    } finally {
      setSavingTimelineEvent(false);
    }
  };

  const handleDeleteQuickTimelineEvent = async (
    targetNode: CosmicNodeData,
    eventId: string
  ) => {
    setSavingTimelineEvent(true);
    try {
      const nextEvents = (targetNode.timelineEvents || []).filter((ev) => ev.id !== eventId);
      await onSaveNode({
        ...targetNode,
        timelineEvents: nextEvents
      });
    } finally {
      setSavingTimelineEvent(false);
    }
  };

  const handleMoveQuickTimelineEvent = async (
    targetNode: CosmicNodeData,
    index: number,
    direction: -1 | 1
  ) => {
    const list = [...(targetNode.timelineEvents || [])];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    setSavingTimelineEvent(true);
    try {
      const temp = list[index];
      list[index] = list[targetIdx];
      list[targetIdx] = temp;
      await onSaveNode({
        ...targetNode,
        timelineEvents: list
      });
    } finally {
      setSavingTimelineEvent(false);
    }
  };

  const handleSaveEditingNode = async () => {
    if (!editingNode) return;
    setSavingNode(true);
    try {
      await onSaveNode(editingNode);
      setSelectedNodeId(editingNode.id);
      setIsEditMode(false);
      setEditingNode(null);
    } finally {
      setSavingNode(false);
    }
  };

  // Update territory helper
  const updateTerritory = async (id: string, patch: Partial<CosmicTerritoryData>) => {
    const nextList = territories.map((t) => {
      if (t.id !== id) return t;
      const updated = { ...t, ...patch };
      if (patch.faction && FACTION_PRESETS[patch.faction]) {
        updated.color = FACTION_PRESETS[patch.faction].color;
      }
      return updated;
    });
    await onSaveTerritories(nextList);
  };

  const deleteTerritory = async (id: string) => {
    const nextList = territories.filter((t) => t.id !== id);
    if (selectedTerritoryId === id) setSelectedTerritoryId(null);
    await onSaveTerritories(nextList);
  };

  // Resolve linked cards for the active node (ONLY explicit card codes & explicit collections — NO automatic archetype matching)
  const activeNodeForDrawer = isEditMode && editingNode ? editingNode : selectedNode;
  const linkedCardsList = useMemo(() => {
    if (!activeNodeForDrawer) return [];
    const codeSet = new Set(activeNodeForDrawer.linkedCardCodes || []);
    const colSet = new Set(
      (activeNodeForDrawer.linkedCollections || []).map((c) => c.toLowerCase())
    );

    const explicitMatches: CardData[] = [];
    const collectionMatches: CardData[] = [];

    cards.forEach((c) => {
      if (c.isHidden) return;
      if (codeSet.has(c.code)) {
        explicitMatches.push(c);
        return;
      }
      if (colSet.size > 0 && c.collection && colSet.has(c.collection.toLowerCase())) {
        collectionMatches.push(c);
      }
    });

    return [...explicitMatches, ...collectionMatches];
  }, [activeNodeForDrawer, cards]);

  const getEmbedVideoUrl = (url?: string): { isIframe: boolean; src: string } => {
    if (!url) return { isIframe: false, src: '' };
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      return { isIframe: true, src: `https://www.youtube.com/embed/${videoId}` };
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return { isIframe: true, src: `https://www.youtube.com/embed/${videoId}` };
    }
    if (url.includes('drive.google.com/file/d/')) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match?.[1]) {
        return { isIframe: true, src: `https://drive.google.com/file/d/${match[1]}/preview` };
      }
    }
    return { isIframe: false, src: url };
  };

  const currentPlaneInfo =
    PLANE_DEFINITIONS.find((p) => p.id === activePlane) || PLANE_DEFINITIONS[0];

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-3.5rem)] bg-[#030308] overflow-hidden select-none">
      {/* Dedicated Empty WebGL Canvas Container */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Semantic 2D HTML Pins Tracking 3D Celestial Galaxies & Gateways */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {projectedLabels.map((lbl) => {
          if (!lbl.visible) return null;
          const node =
            editingNode && editingNode.id === lbl.id
              ? editingNode
              : filteredNodes.find((n) => n.id === lbl.id);
          if (!node) return null;

          const isSelected = selectedNodeId === node.id;
          const isHovered = hoveredNodeId === node.id;
          const trajectoryStep = trackedNodeStepMap.get(node.id);
          const isInTrajectory = Boolean(trajectoryStep);
          const showTitle =
            pinDisplayMode !== 'minimal' || isSelected || isHovered || isInTrajectory;
          const showSubtitle =
            pinDisplayMode === 'full' || isSelected || isHovered || isInTrajectory;

          return (
            <div
              key={node.id}
              style={{
                transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0)`
              }}
              className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
            >
              <button
                type="button"
                onClick={() => handleSelectNode(node)}
                className={`group flex flex-col items-center transition-transform duration-200 ${
                  isSelected || isInTrajectory
                    ? 'scale-110 z-20'
                    : isHovered
                    ? 'scale-105 z-20'
                    : trackedCard
                    ? 'opacity-45 hover:opacity-95'
                    : 'opacity-85 hover:opacity-100'
                }`}
              >
                {/* Character Trajectory Step Badge above Pin */}
                {isInTrajectory && trackedCard && (
                  <div className="mb-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-cyan-400 text-slate-950 font-cinzel font-black text-[10px] tracking-wider uppercase shadow-[0_0_16px_rgba(251,191,36,0.9)] flex items-center gap-1 border border-white">
                    <span>
                      {trackedCardTrajectory.length > 1
                        ? `${trajectoryStep}º LOCAL`
                        : 'PRESENTE AQUI'}
                    </span>
                  </div>
                )}

                {/* Luminous Star Pin Marker */}
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all shadow-md ${
                    isInTrajectory
                      ? 'bg-amber-950 border-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.95)] scale-125'
                      : isSelected
                      ? 'bg-[#12101b] border-[#d4af37] shadow-[0_0_16px_rgba(212,175,55,0.8)]'
                      : 'bg-[#090912]/90 border-white/30 group-hover:border-[#d4af37]'
                  }`}
                  style={{
                    borderColor: isInTrajectory
                      ? '#fbbf24'
                      : isSelected
                      ? '#d4af37'
                      : node.primaryColor
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: isInTrajectory ? '#fde047' : node.primaryColor
                    }}
                  />
                </div>

                {/* Compact Title Plate */}
                {showTitle && (
                  <div
                    className={`mt-1.5 px-2 py-0.5 rounded border text-center transition-all ${
                      isInTrajectory
                        ? 'bg-[#141008]/95 border-amber-400 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.45)]'
                        : isSelected
                        ? 'bg-[#0c0a14]/95 border-[#d4af37] text-white shadow-xl'
                        : 'bg-[#06060c]/80 border-white/15 text-slate-200 group-hover:border-white/40'
                    }`}
                  >
                    <span className="font-cinzel text-[10px] font-bold tracking-wider uppercase whitespace-nowrap block">
                      {node.name}
                    </span>
                    {showSubtitle && (
                      <span className="text-[9px] text-slate-400 tracking-wide whitespace-nowrap block">
                        {CATEGORY_LABELS[node.category] || node.category}
                      </span>
                    )}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* TOP-LEFT RETRACTABLE MENUS (Plane Switcher, Territory Control, Universe Index & Character Trajectories) */}
      <div className="absolute top-3 left-3 z-20 pointer-events-auto flex flex-col items-start gap-2 max-w-md">
        {/* Compact Retractable Menu Triggers */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 1. Mudar de Plano Dimensional */}
          <button
            type="button"
            onClick={() => {
              setIsPlaneMenuOpen(!isPlaneMenuOpen);
              setIsTerritoryMenuOpen(false);
              setIsIndexOpen(false);
              setIsTrajectoryMenuOpen(false);
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-cinzel font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg transition ${
              isPlaneMenuOpen
                ? 'bg-[#12101d]/95 border-[#d4af37] text-[#d4af37]'
                : 'bg-[#080811]/90 border-white/15 text-slate-200 hover:border-[#d4af37]/60 hover:text-white'
            }`}
          >
            <Orbit size={13} style={{ color: currentPlaneInfo.accentColor }} />
            <span>Plano: {currentPlaneInfo.shortLabel}</span>
            {isPlaneMenuOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* 2. Territórios & Setores (Helldivers Style) */}
          <button
            type="button"
            onClick={() => {
              setIsTerritoryMenuOpen(!isTerritoryMenuOpen);
              setIsPlaneMenuOpen(false);
              setIsIndexOpen(false);
              setIsTrajectoryMenuOpen(false);
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 shadow-lg transition ${
              isTerritoryMenuOpen
                ? 'bg-red-950/90 border-red-400 text-red-200 font-bold'
                : 'bg-[#080811]/90 border-white/15 text-slate-200 hover:border-white/35 hover:text-white'
            }`}
          >
            <Shield size={13} className="text-red-400" />
            <span>Setores ({visibleTerritories.length})</span>
            {isTerritoryMenuOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {/* 3. Índice de Universos & Filtros */}
          <button
            type="button"
            onClick={() => {
              setIsIndexOpen(!isIndexOpen);
              setIsPlaneMenuOpen(false);
              setIsTerritoryMenuOpen(false);
              setIsTrajectoryMenuOpen(false);
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 shadow-lg transition ${
              isIndexOpen
                ? 'bg-[#d4af37] border-[#d4af37] text-slate-950 font-bold'
                : 'bg-[#080811]/90 border-white/15 text-slate-200 hover:border-white/35 hover:text-white'
            }`}
          >
            <Layers size={13} />
            <span>Universos ({filteredNodes.length})</span>
            {isIndexOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
          </button>

          {/* 4. Trajetória de Personagens / Cartas */}
          <button
            type="button"
            onClick={() => {
              setIsTrajectoryMenuOpen(!isTrajectoryMenuOpen);
              setIsPlaneMenuOpen(false);
              setIsTerritoryMenuOpen(false);
              setIsIndexOpen(false);
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 shadow-lg transition ${
              trackedCard || isTrajectoryMenuOpen
                ? 'bg-amber-500/95 border-amber-300 text-slate-950 font-bold'
                : 'bg-[#080811]/90 border-white/15 text-slate-200 hover:border-amber-400/50 hover:text-white'
            }`}
          >
            <Compass size={13} className={trackedCard || isTrajectoryMenuOpen ? 'text-slate-950' : 'text-amber-400'} />
            <span>
              {trackedCard ? `Trajetória: ${trackedCard.name}` : 'Trajetórias'}
            </span>
            {isTrajectoryMenuOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* RETRACTABLE PANEL 4: SELECIONAR PERSONAGEM PARA VER TRAJETÓRIA OU VINCULAR A MÚLTIPLOS LOCAIS */}
        {isTrajectoryMenuOpen && (
          <div className="bg-[#080811]/95 border border-amber-400/45 p-3 rounded-xl shadow-2xl space-y-2.5 w-80 sm:w-96 max-h-[72vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5 shrink-0">
              <span className="text-[10px] font-cinzel font-bold uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                <Compass size={13} /> Trajetória de Personagens pelo Cosmos
              </span>
              <button
                type="button"
                onClick={() => setIsTrajectoryMenuOpen(false)}
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5"
              >
                <ChevronUp size={12} /> Recolher
              </button>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug shrink-0">
              Escolha qualquer carta/personagem abaixo para traçar no mapa 3D todos os locais onde esteve (1º ➔ 2º ➔ 3º...) ou adicionar novos locais à sua jornada.
            </p>

            <div className="relative shrink-0">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={trajectorySearchQuery}
                onChange={(e) => setTrajectorySearchQuery(e.target.value)}
                placeholder="Buscar personagem ou carta..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar max-h-60">
              {cards
                .filter((c) => {
                  if (c.isHidden) return false;
                  if (trajectorySearchQuery.trim()) {
                    const q = trajectorySearchQuery.toLowerCase();
                    return (
                      c.name.toLowerCase().includes(q) ||
                      c.code.toLowerCase().includes(q) ||
                      (c.collection || '').toLowerCase().includes(q)
                    );
                  }
                  // Default when no search: show cards that already have explicit locations first, then others
                  return true;
                })
                .sort((a, b) => {
                  const aExplicitCount = nodes.filter((n) =>
                    (n.linkedCardCodes || []).includes(a.code)
                  ).length;
                  const bExplicitCount = nodes.filter((n) =>
                    (n.linkedCardCodes || []).includes(b.code)
                  ).length;
                  if (aExplicitCount !== bExplicitCount) return bExplicitCount - aExplicitCount;
                  return a.name.localeCompare(b.name);
                })
                .slice(0, 40)
                .map((c) => {
                  const isAct = trackedCard?.code === c.code;
                  const explicitStopCount = nodes.filter((n) =>
                    (n.linkedCardCodes || []).includes(c.code)
                  ).length;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        handleSelectCardTrajectory(c);
                        setIsTrajectoryMenuOpen(false);
                      }}
                      className={`w-full p-1.5 rounded-lg border text-left flex items-center justify-between gap-2 transition ${
                        isAct
                          ? 'bg-amber-500/20 border-amber-400 text-white'
                          : 'bg-slate-950/80 border-white/10 text-slate-200 hover:border-amber-400/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {c.imageUrl ? (
                          <img
                            src={c.imageUrl}
                            alt=""
                            className="w-7 h-9 object-cover rounded shrink-0 border border-white/15"
                          />
                        ) : (
                          <div className="w-7 h-9 rounded bg-slate-900 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{c.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {c.collection || c.type}
                          </div>
                        </div>
                      </div>
                      {explicitStopCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/25 border border-amber-400/50 text-amber-200 text-[10px] font-bold shrink-0">
                          {explicitStopCount} {explicitStopCount === 1 ? 'local' : 'locais'}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* FLOATING ACTIVE TRAJECTORY HUD (Shows ordered stops 1º ➔ 2º ➔ 3º + Admin Multi-Location Editor) */}
        {trackedCard && (
          <div className="bg-[#090913]/95 border-2 border-amber-400/70 p-3.5 rounded-xl shadow-[0_0_30px_rgba(251,191,36,0.25)] space-y-3 w-80 sm:w-96 animate-fade-in">
            <div className="flex items-start justify-between gap-2.5 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                {trackedCard.imageUrl && (
                  <img
                    src={trackedCard.imageUrl}
                    alt={trackedCard.name}
                    className="w-10 h-13 object-cover rounded-lg border border-amber-400 shrink-0 shadow-md"
                  />
                )}
                <div className="min-w-0">
                  <span className="text-[10px] font-cinzel font-bold uppercase tracking-widest text-amber-300 block">
                    Trajetória no Macroverso
                  </span>
                  <h4 className="font-cinzel text-sm font-black text-white truncate">
                    {trackedCard.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    {onSelectCard && (
                      <button
                        type="button"
                        onClick={() => onSelectCard(trackedCard)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-white/15 text-[10px] text-amber-200 font-semibold transition"
                      >
                        Inspecionar Carta
                      </button>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {trackedCardTrajectory.length}{' '}
                      {trackedCardTrajectory.length === 1 ? 'parada' : 'paradas'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTrackedCard(null)}
                className="p-1 rounded-lg bg-slate-900 hover:bg-red-950/70 text-slate-400 hover:text-white border border-white/10 shrink-0"
                title="Fechar visualização de trajetória"
              >
                <X size={14} />
              </button>
            </div>

            {/* Ordered List of Visited Locations (1º ➔ 2º ➔ 3º...) */}
            {trackedCardTrajectory.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {trackedCardTrajectory.map((stopNode, idx) => {
                  const isCurrentSelected = selectedNodeId === stopNode.id;
                  return (
                    <div
                      key={stopNode.id}
                      className={`p-2 rounded-lg border flex items-center justify-between gap-2 transition ${
                        isCurrentSelected
                          ? 'bg-amber-500/20 border-amber-400 text-white'
                          : 'bg-slate-950/85 border-white/10 text-slate-200 hover:border-amber-400/50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            stopNode.planeId &&
                            activePlane !== 'all' &&
                            stopNode.planeId !== activePlane
                          ) {
                            setActivePlane('all');
                          }
                          handleSelectNode(stopNode);
                        }}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left"
                      >
                        <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-cinzel font-black text-[10px] shrink-0">
                          {idx + 1}º
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-cinzel font-bold truncate">
                            {stopNode.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {CATEGORY_LABELS[stopNode.category] || stopNode.category}
                          </div>
                        </div>
                      </button>

                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0 || savingTrajectory}
                            onClick={() => handleMoveTrajectoryStop(idx, -1)}
                            className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                            title="Mover para antes na trajetória"
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button
                            type="button"
                            disabled={
                              idx === trackedCardTrajectory.length - 1 || savingTrajectory
                            }
                            onClick={() => handleMoveTrajectoryStop(idx, 1)}
                            className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                            title="Mover para depois na trajetória"
                          >
                            <ArrowDown size={11} />
                          </button>
                          {(stopNode.linkedCardCodes || []).includes(trackedCard.code) && (
                            <button
                              type="button"
                              disabled={savingTrajectory}
                              onClick={() => handleRemoveCardFromNode(trackedCard, stopNode)}
                              className="p-1 rounded bg-red-950/70 hover:bg-red-900 text-red-300"
                              title="Remover personagem deste local"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-400 bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-center">
                Este personagem ainda não possui locais vinculados no mapa.
              </div>
            )}

            {/* Admin Multi-Location Adder ("Personagem X esteve aqui, aqui e ali") */}
            {isAdmin && (
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                  + Adicionar Local à Trajetória de {trackedCard.name}:
                </span>
                <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1.5 bg-slate-950 rounded-lg border border-slate-800 custom-scrollbar">
                  {nodes
                    .filter((n) => !trackedNodeStepMap.has(n.id))
                    .map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        disabled={savingTrajectory}
                        onClick={() => handleAddCardToNode(trackedCard, n)}
                        className="px-2 py-1 rounded bg-slate-900 hover:bg-amber-500 hover:text-slate-950 border border-white/10 text-[10px] text-slate-300 font-semibold transition flex items-center gap-1"
                      >
                        <Plus size={10} />
                        <span>{n.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* RETRACTABLE PANEL 1: MUDAR DE PLANO DIMENSIONAL */}
        {isPlaneMenuOpen && (
          <div className="bg-[#080811]/95 border border-[#d4af37]/35 p-3 rounded-xl shadow-2xl space-y-2.5 w-76 sm:w-84 animate-fade-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="text-[10px] font-cinzel font-bold uppercase tracking-widest text-[#d4af37]">
                Mudar de Plano Dimensional
              </span>
              <button
                type="button"
                onClick={() => setIsPlaneMenuOpen(false)}
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5"
              >
                <ChevronUp size={12} /> Recolher
              </button>
            </div>

            <div className="space-y-1.5">
              {PLANE_DEFINITIONS.map((pl) => {
                const isAct = activePlane === pl.id;
                return (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => handleSwitchPlane(pl.id)}
                    className={`w-full p-2 rounded-lg text-left border transition flex flex-col gap-0.5 ${
                      isAct
                        ? 'bg-white/10 border-[#d4af37] text-white'
                        : 'bg-slate-950/70 border-white/10 text-slate-300 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-cinzel text-xs font-bold flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: pl.accentColor }}
                        />
                        {pl.label}
                      </span>
                      {isAct && (
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#d4af37] text-slate-950 font-bold">
                          Ativo
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 leading-snug">{pl.description}</span>
                  </button>
                );
              })}
            </div>

            {isAdmin && (
              <div className="pt-1.5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setPlacementMode(placementMode === 'corrupted_well' ? null : 'corrupted_well');
                    setIsPlaneMenuOpen(false);
                  }}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <Flame size={13} /> + Colar Poço da Corrupção no Mapa
                </button>
              </div>
            )}
          </div>
        )}

        {/* RETRACTABLE PANEL 2: GRADE POLAR DE SETORES (ESTILO HELLDIVERS) */}
        {isTerritoryMenuOpen && (
          <div className="bg-[#080811]/95 border border-white/15 p-3 rounded-xl shadow-2xl space-y-3 w-80 sm:w-92 max-h-[76vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5 shrink-0">
              <span className="text-[11px] font-cinzel font-bold uppercase tracking-wider text-[#d4af37] flex items-center gap-1.5">
                <Shield size={13} className="text-red-400" /> Grade de Setores (Asmonious · Caos · Aliança)
              </span>
              <button
                type="button"
                onClick={() => setIsTerritoryMenuOpen(false)}
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5"
              >
                <ChevronUp size={12} /> Recolher
              </button>
            </div>

            {/* Toggle Visibility */}
            <div className="flex items-center justify-between bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-white/10 shrink-0">
              <span className="text-xs text-slate-300">Exibir Grade de Setores no Mapa</span>
              <button
                type="button"
                onClick={() => setShowTerritories(!showTerritories)}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition ${
                  showTerritories ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {showTerritories ? 'Visível' : 'Oculto'}
              </button>
            </div>

            {/* Faction Legend Pills */}
            <div className="grid grid-cols-4 gap-1 shrink-0">
              {(['Asmonious', 'Caos', 'Aliança', 'Neutro'] as CosmicFactionId[]).map((fac) => {
                const preset = FACTION_PRESETS[fac];
                const count = visibleTerritories.filter((t) => t.faction === fac).length;
                return (
                  <div
                    key={fac}
                    className="p-1.5 rounded-lg bg-slate-950 border border-white/10 flex flex-col items-center text-center"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full mb-0.5 border border-white/30"
                      style={{ backgroundColor: preset.color }}
                    />
                    <span className="text-[10px] font-bold text-white">{fac}</span>
                    <span className="text-[9px] text-slate-400">{count} set.</span>
                  </div>
                );
              })}
            </div>

            {/* Admin Interactive Sector Painter & Wedge Creator */}
            {isAdmin && (
              <div className="bg-slate-900/90 border border-white/10 rounded-lg p-2.5 space-y-2 shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#d4af37] block">
                  Pintar Setores Direto no Mapa 3D
                </span>
                <div className="grid grid-cols-4 gap-1">
                  {(['Asmonious', 'Caos', 'Aliança', 'Neutro'] as CosmicFactionId[]).map((fac) => (
                    <button
                      key={fac}
                      type="button"
                      onClick={() => setNewTerritoryFaction(fac)}
                      className={`py-1 rounded text-[10px] font-bold border transition ${
                        newTerritoryFaction === fac
                          ? 'bg-white/15 border-white text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {fac}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPlacementMode(placementMode === 'territory' ? null : 'territory');
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition border ${
                      placementMode === 'territory'
                        ? 'bg-amber-500 text-slate-950 border-amber-300'
                        : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400'
                    }`}
                  >
                    <Edit3 size={12} />
                    {placementMode === 'territory'
                      ? `Clique nos Setores para Pintar (${newTerritoryFaction})`
                      : `Modo Pintar Setores (${newTerritoryFaction})`}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const newSec = makePolarSector(
                        `sec_custom_${Date.now()}`,
                        `Setor ${territories.length + 1}`,
                        2,
                        23,
                        37,
                        0,
                        40,
                        newTerritoryFaction,
                        newTerritoryFaction === 'Neutro' ? 0 : 95
                      );
                      const nextList = [...territories, newSec];
                      setSelectedTerritoryId(newSec.id);
                      await onSaveTerritories(nextList);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-[11px] font-bold flex items-center gap-1"
                    title="Adicionar Nova Fatia de Setor Polar"
                  >
                    <Plus size={12} /> Setor
                  </button>
                </div>
              </div>
            )}

            {/* List of Polar Sectors & Live Angular/Radial Wedge Editor */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-0.5">
              {visibleTerritories.map((terr) => {
                const isSel = selectedTerritoryId === terr.id;
                return (
                  <div
                    key={terr.id}
                    className={`rounded-lg border p-2 transition ${
                      isSel
                        ? 'bg-slate-900 border-[#d4af37]'
                        : 'bg-slate-950/70 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div
                      onClick={() => setSelectedTerritoryId(isSel ? null : terr.id)}
                      className="flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/30"
                          style={{ backgroundColor: FACTION_PRESETS[terr.faction]?.color || terr.color }}
                        />
                        <div className="truncate">
                          <div className="text-xs font-bold text-white truncate">{terr.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {terr.faction} · Anel {terr.innerRadius ?? 10}–{terr.outerRadius ?? 24} ·{' '}
                            {terr.startAngleDeg ?? 0}°–{terr.endAngleDeg ?? 45}°
                          </div>
                        </div>
                      </div>
                      <ChevronDown
                        size={13}
                        className={`text-slate-400 transition-transform ${isSel ? 'rotate-180' : ''}`}
                      />
                    </div>

                    {/* Admin Polar Sector Wedge Editor */}
                    {isAdmin && isSel && (
                      <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-2.5">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Nome do Setor</label>
                          <input
                            type="text"
                            value={terr.name}
                            onChange={(e) => updateTerritory(terr.id, { name: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                          />
                        </div>

                        <div className="grid grid-cols-4 gap-1">
                          {(['Asmonious', 'Caos', 'Aliança', 'Neutro'] as CosmicFactionId[]).map((fac) => (
                            <button
                              key={fac}
                              type="button"
                              onClick={() =>
                                updateTerritory(terr.id, {
                                  faction: fac,
                                  controlPercent: fac === 'Neutro' ? 0 : 95
                                })
                              }
                              className={`py-1 rounded text-[10px] font-bold border ${
                                terr.faction === fac
                                  ? 'bg-[#d4af37] text-slate-950 border-[#d4af37]'
                                  : 'bg-slate-950 border-slate-800 text-slate-400'
                              }`}
                            >
                              {fac}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 block">
                              Raio Interno: {terr.innerRadius ?? 10}
                            </label>
                            <input
                              type="range"
                              min="8"
                              max="60"
                              step="1"
                              value={terr.innerRadius ?? 10}
                              onChange={(e) =>
                                updateTerritory(terr.id, { innerRadius: Number(e.target.value) })
                              }
                              className="w-full accent-[#d4af37]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block">
                              Raio Externo: {terr.outerRadius ?? 24}
                            </label>
                            <input
                              type="range"
                              min="14"
                              max="66"
                              step="1"
                              value={terr.outerRadius ?? 24}
                              onChange={(e) =>
                                updateTerritory(terr.id, { outerRadius: Number(e.target.value) })
                              }
                              className="w-full accent-[#d4af37]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 block">
                              Ângulo Inicial: {terr.startAngleDeg ?? 0}°
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="360"
                              step="2"
                              value={terr.startAngleDeg ?? 0}
                              onChange={(e) =>
                                updateTerritory(terr.id, { startAngleDeg: Number(e.target.value) })
                              }
                              className="w-full accent-purple-400"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block">
                              Ângulo Final: {terr.endAngleDeg ?? 45}°
                            </label>
                            <input
                              type="range"
                              min="10"
                              max="400"
                              step="2"
                              value={terr.endAngleDeg ?? 45}
                              onChange={(e) =>
                                updateTerritory(terr.id, { endAngleDeg: Number(e.target.value) })
                              }
                              className="w-full accent-purple-400"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => deleteTerritory(terr.id)}
                            className="px-2.5 py-1 rounded bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-500/30 text-[10px] font-bold flex items-center gap-1"
                          >
                            <Trash2 size={11} /> Excluir Setor
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* RETRACTABLE PANEL 3: NAVEGADOR DE UNIVERSOS & FILTROS */}
        {isIndexOpen && (
          <div className="bg-[#080811]/95 border border-white/15 rounded-xl p-3 shadow-2xl w-72 sm:w-80 max-h-[68vh] flex flex-col gap-2.5 animate-fade-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="text-[11px] font-cinzel font-bold uppercase tracking-wider text-[#d4af37]">
                Universos & Locais ({filteredNodes.length})
              </span>
              <button
                type="button"
                onClick={() => setIsIndexOpen(false)}
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-900"
              >
                <ChevronLeft size={12} /> Recolher
              </button>
            </div>

            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar universo, local, personagem..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-6 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#d4af37] outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'universo_principal', label: 'Primordial' },
                { id: 'universo_paralelo', label: 'Universos' },
                { id: 'porta_corrupcao', label: 'Poços (Portas)' },
                { id: 'plano_paralelo', label: 'Planos Paralelos' },
                { id: 'borda_macroversal', label: 'Fronteira' },
                { id: 'extraverso', label: 'Extraverso & Véu' },
                { id: 'anomalia_errante', label: 'Nave & Zona' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFilterCategory(cat.id)}
                  className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                    filterCategory === cat.id
                      ? 'bg-[#d4af37] text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-0.5">
              {filteredNodes.map((n) => {
                const isSel = selectedNodeId === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleSelectNode(n)}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between gap-2 transition border ${
                      isSel
                        ? 'bg-white/15 border-[#d4af37] text-white'
                        : 'bg-slate-950/70 border-white/5 text-slate-300 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: n.primaryColor }}
                      />
                      <div className="truncate">
                        <div className="text-xs font-bold truncate">{n.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {CATEGORY_LABELS[n.category] || n.category}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={13} className={isSel ? 'text-[#d4af37] shrink-0' : 'text-slate-600 shrink-0'} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active 3D Placement Banner */}
        {placementMode && (
          <div className="bg-purple-950/95 border border-purple-400 px-3 py-2 rounded-lg shadow-xl flex items-center justify-between gap-2 w-72 sm:w-80">
            <div className="text-[11px] text-purple-100">
              <strong className="block font-bold text-white">
                {placementMode === 'corrupted_well'
                  ? 'Colar Poço da Corrupção'
                  : placementMode === 'territory'
                  ? `Posicionar Território (${newTerritoryFaction})`
                  : placementMode === 'move_territory'
                  ? 'Mover Território Selecionado'
                  : 'Posicionar Novo Universo'}
              </strong>
              Clique em qualquer ponto do espaço 3D.
            </div>
            <button
              type="button"
              onClick={() => setPlacementMode(null)}
              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-200 rounded border border-slate-700 shrink-0"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM RETRACTABLE QUICK CONTROL BAR */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center">
        {isHudCollapsed ? (
          <button
            type="button"
            onClick={() => setIsHudCollapsed(false)}
            className="bg-[#090912]/90 hover:bg-[#121222] border border-white/20 px-3.5 py-1.5 rounded-full text-[11px] font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 shadow-xl transition"
          >
            <ChevronUp size={13} className="text-[#d4af37]" />
            <span>Controles do Mapa</span>
          </button>
        ) : (
          <div className="bg-[#090912]/92 border border-white/15 rounded-full px-3 py-1.5 shadow-2xl flex flex-wrap items-center justify-center gap-1.5 max-w-[95vw]">
            <button
              type="button"
              onClick={() => handleSelectNode(null)}
              className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] text-slate-200 font-medium flex items-center gap-1 transition"
            >
              <RotateCcw size={12} />
              <span>Visão Geral</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTerritories(!showTerritories)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium flex items-center gap-1 border transition ${
                showTerritories
                  ? 'bg-red-950/70 border-red-500/50 text-red-200'
                  : 'bg-slate-900 border-slate-700/80 text-slate-400'
              }`}
            >
              <Shield size={12} />
              <span>Territórios: {showTerritories ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setPinDisplayMode((prev) =>
                  prev === 'compact' ? 'full' : prev === 'full' ? 'minimal' : 'compact'
                )
              }
              className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] text-slate-200 font-medium flex items-center gap-1 transition"
            >
              {pinDisplayMode === 'minimal' ? <EyeOff size={12} /> : <Eye size={12} />}
              <span>
                Nomes:{' '}
                {pinDisplayMode === 'compact'
                  ? 'Compactos'
                  : pinDisplayMode === 'full'
                  ? 'Completos'
                  : 'Ocultos'}
              </span>
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setPlacementMode(placementMode === 'node' ? null : 'node')
                  }
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 border transition ${
                    placementMode === 'node'
                      ? 'bg-purple-600 text-white border-purple-400'
                      : 'bg-purple-950/90 hover:bg-purple-900 text-purple-200 border-purple-700/70'
                  }`}
                >
                  <Plus size={12} />
                  <span>+ Universo</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPlacementMode(
                      placementMode === 'corrupted_well' ? null : 'corrupted_well'
                    )
                  }
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 border transition ${
                    placementMode === 'corrupted_well'
                      ? 'bg-red-600 text-white border-red-400'
                      : 'bg-red-950/90 hover:bg-red-900 text-red-200 border-red-700/70'
                  }`}
                  title="Clique para colar um Poço da Corrupção (Porta de Entrada) no mapa"
                >
                  <Flame size={12} />
                  <span>+ Colar Poço</span>
                </button>

                {onResetDefaultCosmology && (
                  <button
                    type="button"
                    disabled={resettingCosmology}
                    onClick={async () => {
                      setResettingCosmology(true);
                      try {
                        await onResetDefaultCosmology();
                        handleSelectNode(null);
                      } finally {
                        setResettingCosmology(false);
                      }
                    }}
                    className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1"
                    title="Sincronizar universos e planos padrões"
                  >
                    {resettingCosmology ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    <span className="hidden sm:inline">Sincronizar</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setIsHudCollapsed(true);
                setIsPlaneMenuOpen(false);
                setIsTerritoryMenuOpen(false);
                setIsIndexOpen(false);
              }}
              className="px-2.5 py-1 rounded-full bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10 text-[11px] flex items-center gap-1 transition"
            >
              <ChevronDown size={12} />
              <span>Recolher</span>
            </button>
          </div>
        )}
      </div>

      {/* RETRACTED TAB FOR RIGHT LORE DRAWER */}
      {activeNodeForDrawer && isRightDrawerCollapsed && (
        <div className="absolute top-4 right-0 z-30 pointer-events-auto flex items-center">
          <button
            type="button"
            onClick={() => setIsRightDrawerCollapsed(false)}
            className="bg-[#08080f]/95 hover:bg-[#121220] border border-r-0 border-[#d4af37]/60 rounded-l-xl px-3.5 py-2.5 shadow-2xl flex items-center gap-2 text-xs text-white font-cinzel font-bold tracking-wider uppercase transition"
          >
            <ChevronLeft size={15} className="text-[#d4af37]" />
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: activeNodeForDrawer.primaryColor }}
            />
            <span className="max-w-[180px] truncate">{activeNodeForDrawer.name}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsEditMode(false);
              setEditingNode(null);
              handleSelectNode(null);
            }}
            className="bg-[#05050a]/95 hover:bg-red-950/80 border border-l-0 border-[#d4af37]/40 px-2 py-2.5 text-slate-400 hover:text-white transition"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* RIGHT-SIDE RETRACTABLE LORE CHRONICLE & RICH BLOCK EDITOR DRAWER */}
      {activeNodeForDrawer && !isRightDrawerCollapsed && (
        <aside
          className={`absolute top-0 right-0 h-full w-full ${
            isEditMode || isRightDrawerWide ? 'max-w-2xl' : 'max-w-md sm:max-w-lg'
          } bg-[#08080f]/95 border-l border-[#d4af37]/30 z-30 pointer-events-auto flex flex-col shadow-2xl overflow-hidden transition-all duration-200 animate-fade-in`}
        >
          {/* Drawer Top Action Bar */}
          <div className="px-4 py-3 bg-[#05050a] border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] text-[#d4af37] font-cinzel tracking-widest uppercase font-bold truncate">
              <Sparkles size={13} className="shrink-0" />
              <span className="truncate">{CATEGORY_LABELS[activeNodeForDrawer.category] || activeNodeForDrawer.category}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsRightDrawerCollapsed(true)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/15 text-slate-200 hover:text-white text-[11px] font-semibold flex items-center gap-1 transition"
                title="Recolher este menu lateral para ver a galáxia 3D livremente"
              >
                <ChevronRight size={13} />
                <span>Recolher</span>
              </button>

              {!isEditMode && (
                <button
                  type="button"
                  onClick={() => setIsRightDrawerWide(!isRightDrawerWide)}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white hidden sm:flex"
                  title={isRightDrawerWide ? 'Reduzir largura da janela' : 'Expandir largura de leitura'}
                >
                  {isRightDrawerWide ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              )}

              {isAdmin && !isEditMode && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditMode(true);
                    setEditingNode(JSON.parse(JSON.stringify(activeNodeForDrawer)));
                  }}
                  className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center gap-1 transition"
                >
                  <Edit3 size={12} />
                  <span>Editar</span>
                </button>
              )}

              {isAdmin && isEditMode && (
                <>
                  <button
                    type="button"
                    disabled={savingNode}
                    onClick={handleSaveEditingNode}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center gap-1 transition"
                  >
                    {savingNode ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    <span>Salvar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditMode(false);
                      setEditingNode(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold"
                  >
                    Cancelar
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsEditMode(false);
                  setEditingNode(null);
                  handleSelectNode(null);
                }}
                className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/10"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Drawer Scrollable Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* ADMIN EDIT MODE */}
            {isAdmin && isEditMode && editingNode ? (
              <div className="p-6 space-y-6">
                <div className="bg-purple-950/30 border border-purple-500/40 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                    <h4 className="text-sm font-bold text-purple-300 flex items-center gap-2">
                      <Move3d size={16} /> Propriedades 3D & Identidade do Universo
                    </h4>
                    <button
                      type="button"
                      onClick={async () => {
                        await onDeleteNode(editingNode.id);
                        setIsEditMode(false);
                        setEditingNode(null);
                        setSelectedNodeId(null);
                      }}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-950/40"
                    >
                      <Trash2 size={13} /> Excluir
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Nome do Universo / Local</label>
                      <input
                        type="text"
                        value={editingNode.name}
                        onChange={(e) => setEditingNode({ ...editingNode, name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Subtítulo / Epíteto</label>
                      <input
                        type="text"
                        value={editingNode.subtitle}
                        onChange={(e) => setEditingNode({ ...editingNode, subtitle: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Plano Dimensional</label>
                      <select
                        value={editingNode.planeId || 'macroverso_13'}
                        onChange={(e) =>
                          setEditingNode({
                            ...editingNode,
                            planeId: e.target.value as CosmicPlaneId
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                      >
                        <option value="macroverso_13">Macroverso 13</option>
                        <option value="paralelo_corrupcao">Paralelo da Corrupção</option>
                        <option value="rede_do_caos">Rede do Caos</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Classificação</label>
                      <select
                        value={editingNode.category}
                        onChange={(e) =>
                          setEditingNode({ ...editingNode, category: e.target.value as CosmicCategory })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                      >
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Formação de Partículas 3D</label>
                      <select
                        value={editingNode.visualType}
                        onChange={(e) =>
                          setEditingNode({
                            ...editingNode,
                            visualType: e.target.value as CosmicVisualType
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                      >
                        {Object.entries(VISUAL_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Portal Gateway Target Plane */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 rounded-lg p-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(editingNode.isPortalGateway)}
                        onChange={(e) =>
                          setEditingNode({
                            ...editingNode,
                            isPortalGateway: e.target.checked,
                            targetPlaneId: e.target.checked
                              ? editingNode.targetPlaneId || 'paralelo_corrupcao'
                              : undefined
                          })
                        }
                        className="accent-red-500"
                      />
                      <span className="text-xs text-slate-200">
                        Funciona como Porta de Entrada para Outro Plano
                      </span>
                    </label>

                    {editingNode.isPortalGateway && (
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Plano de Destino</label>
                        <select
                          value={editingNode.targetPlaneId || 'paralelo_corrupcao'}
                          onChange={(e) =>
                            setEditingNode({
                              ...editingNode,
                              targetPlaneId: e.target.value as CosmicPlaneId
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                        >
                          <option value="paralelo_corrupcao">Paralelo da Corrupção</option>
                          <option value="rede_do_caos">Rede do Caos</option>
                          <option value="macroverso_13">Macroverso 13</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Colors & Scale */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Cor do Núcleo</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editingNode.primaryColor}
                          onChange={(e) => setEditingNode({ ...editingNode, primaryColor: e.target.value })}
                          className="w-9 h-9 rounded bg-slate-950 cursor-pointer border border-slate-700"
                        />
                        <span className="text-xs font-mono text-slate-300">{editingNode.primaryColor}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Cor dos Braços Espirais</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editingNode.secondaryColor}
                          onChange={(e) => setEditingNode({ ...editingNode, secondaryColor: e.target.value })}
                          className="w-9 h-9 rounded bg-slate-950 cursor-pointer border border-slate-700"
                        />
                        <span className="text-xs font-mono text-slate-300">{editingNode.secondaryColor}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Escala: {editingNode.scale.toFixed(2)}x
                      </label>
                      <input
                        type="range"
                        min="0.6"
                        max="2.5"
                        step="0.05"
                        value={editingNode.scale}
                        onChange={(e) => setEditingNode({ ...editingNode, scale: Number(e.target.value) })}
                        className="w-full accent-purple-500 mt-2"
                      />
                    </div>
                  </div>

                  {/* 3D Coordinates X, Y, Z Sliders */}
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-mono">
                        Eixo X: {editingNode.position.x}
                      </label>
                      <input
                        type="range"
                        min="-90"
                        max="90"
                        step="1"
                        value={editingNode.position.x}
                        onChange={(e) =>
                          setEditingNode({
                            ...editingNode,
                            position: { ...editingNode.position, x: Number(e.target.value) }
                          })
                        }
                        className="w-full accent-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-mono">
                        Altitude Y: {editingNode.position.y}
                      </label>
                      <input
                        type="range"
                        min="-45"
                        max="45"
                        step="1"
                        value={editingNode.position.y}
                        onChange={(e) =>
                          setEditingNode({
                            ...editingNode,
                            position: { ...editingNode.position, y: Number(e.target.value) }
                          })
                        }
                        className="w-full accent-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1 font-mono">
                        Profundidade Z: {editingNode.position.z}
                      </label>
                      <input
                        type="range"
                        min="-95"
                        max="95"
                        step="1"
                        value={editingNode.position.z}
                        onChange={(e) =>
                          setEditingNode({
                            ...editingNode,
                            position: { ...editingNode.position, z: Number(e.target.value) }
                          })
                        }
                        className="w-full accent-amber-400"
                      />
                    </div>
                  </div>

                  {/* Cover Image Banner Upload */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Imagem de Capa (Banner Superior)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingNode.coverImageUrl || ''}
                        onChange={(e) => setEditingNode({ ...editingNode, coverImageUrl: e.target.value })}
                        placeholder="Cole a URL ou envie do computador..."
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                      />
                      <label className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0">
                        <Upload size={13} /> Subir Capa
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            if (e.target.files?.[0]) {
                              setUploadingBlockId('cover');
                              try {
                                const url = await onUploadMedia(e.target.files[0]);
                                setEditingNode({ ...editingNode, coverImageUrl: url });
                              } finally {
                                setUploadingBlockId(null);
                              }
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Summary / Sinopse */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Sinopse Principal (Introdução)</label>
                    <textarea
                      value={editingNode.summary}
                      onChange={(e) => setEditingNode({ ...editingNode, summary: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white h-20 resize-none"
                    />
                  </div>

                  {/* Connected Nodes */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">
                      Rotas Astrais Conectadas
                    </label>
                    <div className="flex flex-wrap gap-1.5 bg-slate-950 p-2.5 rounded-lg border border-slate-800 max-h-28 overflow-y-auto">
                      {nodes
                        .filter((n) => n.id !== editingNode.id)
                        .map((other) => {
                          const isConn = (editingNode.connectedNodeIds || []).includes(other.id);
                          return (
                            <button
                              key={other.id}
                              type="button"
                              onClick={() => {
                                const curr = editingNode.connectedNodeIds || [];
                                const next = isConn
                                  ? curr.filter((id) => id !== other.id)
                                  : [...curr, other.id];
                                setEditingNode({ ...editingNode, connectedNodeIds: next });
                              }}
                              className={`px-2.5 py-1 rounded text-xs border transition ${
                                isConn
                                  ? 'bg-purple-900/70 border-purple-400 text-white font-bold'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              {other.name}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>

                {/* Custom Stats Editor */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">
                      Atributos & Dados da Ficha Cósmica
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingNode({
                          ...editingNode,
                          customStats: [...(editingNode.customStats || []), { label: '', value: '' }]
                        })
                      }
                      className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded flex items-center gap-1"
                    >
                      <Plus size={12} /> Adicionar Atributo
                    </button>
                  </div>
                  {(editingNode.customStats || []).map((st, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Rótulo"
                        value={st.label}
                        onChange={(e) => {
                          const next = [...(editingNode.customStats || [])];
                          next[idx] = { ...next[idx], label: e.target.value };
                          setEditingNode({ ...editingNode, customStats: next });
                        }}
                        className="w-1/3 bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="Valor"
                        value={st.value}
                        onChange={(e) => {
                          const next = [...(editingNode.customStats || [])];
                          next[idx] = { ...next[idx], value: e.target.value };
                          setEditingNode({ ...editingNode, customStats: next });
                        }}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = (editingNode.customStats || []).filter((_, i) => i !== idx);
                          setEditingNode({ ...editingNode, customStats: next });
                        }}
                        className="p-2 text-red-400 hover:bg-slate-800 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Rich Lore Content Blocks Editor */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        Construtor de Capítulos, Imagens & Vídeos (Ordem Livre)
                      </h4>
                      <p className="text-xs text-slate-400">
                        Adicione quantos blocos quiser e organize a ordem usando as setas ↑ ↓.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {(editingNode.blocks || []).map((blk, idx) => (
                      <div
                        key={blk.id}
                        className="bg-slate-900 border border-slate-700/80 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="text-xs font-bold text-[#d4af37] uppercase tracking-wider">
                            Bloco #{idx + 1} ·{' '}
                            {blk.type === 'paragraph' && 'Parágrafo de Texto'}
                            {blk.type === 'heading' && 'Subtítulo de Capítulo'}
                            {blk.type === 'quote' && 'Citação / Epígrafe'}
                            {blk.type === 'image' && 'Imagem em Destaque'}
                            {blk.type === 'video' && 'Vídeo (MP4 / YouTube / Drive)'}
                            {blk.type === 'gallery' && 'Galeria de Imagens'}
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveBlock(idx, -1)}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === (editingNode.blocks || []).length - 1}
                              onClick={() => moveBlock(idx, 1)}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200"
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeBlock(idx)}
                              className="p-1.5 rounded bg-red-950/60 hover:bg-red-900 text-red-300 ml-1"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {(blk.type === 'paragraph' || blk.type === 'heading' || blk.type === 'quote') && (
                          <div className="space-y-2">
                            <textarea
                              value={blk.text || ''}
                              onChange={(e) => updateBlock(idx, { text: e.target.value })}
                              placeholder={
                                blk.type === 'heading'
                                  ? 'Título da seção...'
                                  : 'Escreva o conteúdo narrativo da lore...'
                              }
                              className={`w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white ${
                                blk.type === 'heading' ? 'h-12 font-bold text-sm' : 'h-28 text-xs leading-relaxed'
                              }`}
                            />
                            {blk.type === 'quote' && (
                              <input
                                type="text"
                                value={blk.caption || ''}
                                onChange={(e) => updateBlock(idx, { caption: e.target.value })}
                                placeholder="Autor ou fonte da citação"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-300"
                              />
                            )}
                          </div>
                        )}

                        {(blk.type === 'image' || blk.type === 'video') && (
                          <div className="space-y-2.5">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={blk.mediaUrl || ''}
                                onChange={(e) => updateBlock(idx, { mediaUrl: e.target.value })}
                                placeholder={
                                  blk.type === 'video'
                                    ? 'URL do vídeo (.mp4, YouTube, Google Drive) ou envie do PC...'
                                    : 'URL da imagem ou envie do PC...'
                                }
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                              />
                              <label className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0">
                                {uploadingBlockId === blk.id ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Upload size={13} />
                                )}
                                <span>Subir do PC</span>
                                <input
                                  type="file"
                                  accept={blk.type === 'video' ? 'video/*' : 'image/*'}
                                  className="hidden"
                                  onChange={async (e) => {
                                    if (e.target.files?.[0]) {
                                      setUploadingBlockId(blk.id);
                                      try {
                                        const url = await onUploadMedia(e.target.files[0]);
                                        updateBlock(idx, { mediaUrl: url });
                                      } finally {
                                        setUploadingBlockId(null);
                                      }
                                    }
                                  }}
                                />
                              </label>
                            </div>
                            <input
                              type="text"
                              value={blk.caption || ''}
                              onChange={(e) => updateBlock(idx, { caption: e.target.value })}
                              placeholder="Legenda opcional da imagem/vídeo..."
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-300"
                            />
                          </div>
                        )}

                        {blk.type === 'gallery' && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400">
                                {(blk.mediaList || []).length} mídias na galeria
                              </span>
                              <label className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5">
                                {uploadingBlockId === blk.id ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Upload size={13} />
                                )}
                                <span>+ Adicionar Imagem/Vídeo</span>
                                <input
                                  type="file"
                                  accept="image/*,video/*"
                                  multiple
                                  className="hidden"
                                  onChange={async (e) => {
                                    const files = Array.from(e.target.files || []);
                                    if (files.length === 0) return;
                                    setUploadingBlockId(blk.id);
                                    try {
                                      const nextList = [...(blk.mediaList || [])];
                                      for (const f of files) {
                                        const url = await onUploadMedia(f);
                                        nextList.push({
                                          url,
                                          type: f.type.startsWith('video/') ? 'video' : 'image',
                                          caption: ''
                                        });
                                      }
                                      updateBlock(idx, { mediaList: nextList });
                                    } finally {
                                      setUploadingBlockId(null);
                                    }
                                  }}
                                />
                              </label>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              {(blk.mediaList || []).map((item, mIdx) => (
                                <div
                                  key={mIdx}
                                  className="bg-slate-950 border border-slate-800 p-2 rounded-lg space-y-1.5"
                                >
                                  {item.type === 'video' ? (
                                    <video src={item.url} className="w-full h-24 object-cover rounded" />
                                  ) : (
                                    <img src={item.url} alt="" className="w-full h-24 object-cover rounded" />
                                  )}
                                  <div className="flex gap-1">
                                    <input
                                      type="text"
                                      value={item.caption || ''}
                                      placeholder="Legenda..."
                                      onChange={(e) => {
                                        const next = [...(blk.mediaList || [])];
                                        next[mIdx] = { ...next[mIdx], caption: e.target.value };
                                        updateBlock(idx, { mediaList: next });
                                      }}
                                      className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = (blk.mediaList || []).filter((_, i) => i !== mIdx);
                                        updateBlock(idx, { mediaList: next });
                                      }}
                                      className="p-1 text-red-400 hover:bg-slate-900 rounded"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add Block Toolbar */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => addBlock('heading')}
                      className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Type size={14} className="text-[#d4af37]" /> + Subtítulo
                    </button>
                    <button
                      type="button"
                      onClick={() => addBlock('paragraph')}
                      className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 font-semibold flex items-center justify-center gap-1.5"
                    >
                      <BookOpen size={14} className="text-blue-400" /> + Parágrafo
                    </button>
                    <button
                      type="button"
                      onClick={() => addBlock('quote')}
                      className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Quote size={14} className="text-amber-400" /> + Citação
                    </button>
                    <button
                      type="button"
                      onClick={() => addBlock('image')}
                      className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 font-semibold flex items-center justify-center gap-1.5"
                    >
                      <ImageIcon size={14} className="text-emerald-400" /> + Imagem
                    </button>
                    <button
                      type="button"
                      onClick={() => addBlock('video')}
                      className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Film size={14} className="text-purple-400" /> + Vídeo
                    </button>
                    <button
                      type="button"
                      onClick={() => addBlock('gallery')}
                      className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 font-semibold flex items-center justify-center gap-1.5"
                    >
                      <Layers size={14} className="text-pink-400" /> + Galeria
                    </button>
                  </div>
                </div>

                {/* Timeline Events Editor for this Location */}
                <div className="bg-slate-900/90 border border-amber-500/35 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Clock size={14} /> Linha do Tempo Deste Local (Acontecimentos)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Adicione e organize os acontecimentos cronológicos que ocorreram neste local.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addEditingTimelineEvent}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1 shrink-0 transition"
                    >
                      <Plus size={13} /> + Acontecimento
                    </button>
                  </div>

                  {(editingNode.timelineEvents || []).length === 0 ? (
                    <div className="text-xs text-slate-400 bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center">
                      Nenhum acontecimento na linha do tempo deste local. Clique em{' '}
                      <strong className="text-amber-300">+ Acontecimento</strong> para adicionar.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(editingNode.timelineEvents || []).map((ev, evIdx) => (
                        <div
                          key={ev.id}
                          className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5"
                        >
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                            <span className="text-xs font-bold text-amber-300">
                              Acontecimento #{evIdx + 1}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={evIdx === 0}
                                onClick={() => moveEditingTimelineEvent(evIdx, -1)}
                                className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                                title="Mover para cima"
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={evIdx === (editingNode.timelineEvents || []).length - 1}
                                onClick={() => moveEditingTimelineEvent(evIdx, 1)}
                                className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                                title="Mover para baixo"
                              >
                                <ArrowDown size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeEditingTimelineEvent(evIdx)}
                                className="p-1 rounded bg-red-950/60 hover:bg-red-900 text-red-300 ml-1"
                                title="Excluir acontecimento"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                Data / Era / Marco Temporal
                              </label>
                              <input
                                type="text"
                                value={ev.dateLabel}
                                onChange={(e) =>
                                  updateEditingTimelineEvent(evIdx, { dateLabel: e.target.value })
                                }
                                placeholder="Ex: Era Primordial, Ano 400..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-[10px] text-slate-400 block mb-0.5">
                                Título do Acontecimento
                              </label>
                              <input
                                type="text"
                                value={ev.title}
                                onChange={(e) =>
                                  updateEditingTimelineEvent(evIdx, { title: e.target.value })
                                }
                                placeholder="Título do evento histórico..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">
                              Descrição do Acontecimento
                            </label>
                            <textarea
                              value={ev.description}
                              onChange={(e) =>
                                updateEditingTimelineEvent(evIdx, { description: e.target.value })
                              }
                              placeholder="Descreva o que aconteceu neste marco da linha do tempo..."
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white h-20 resize-none"
                            />
                          </div>

                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={ev.mediaUrl || ''}
                              onChange={(e) =>
                                updateEditingTimelineEvent(evIdx, { mediaUrl: e.target.value })
                              }
                              placeholder="URL de imagem/vídeo opcional..."
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                            />
                            <label className="px-2.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0">
                              <Upload size={12} /> Mídia
                              <input
                                type="file"
                                accept="image/*,video/*"
                                className="hidden"
                                onChange={async (e) => {
                                  if (e.target.files?.[0]) {
                                    const file = e.target.files[0];
                                    setUploadingBlockId(ev.id);
                                    try {
                                      const url = await onUploadMedia(file);
                                      updateEditingTimelineEvent(evIdx, {
                                        mediaUrl: url,
                                        mediaType: file.type.startsWith('video/') ? 'video' : 'image'
                                      });
                                    } finally {
                                      setUploadingBlockId(null);
                                    }
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Game Integration Picker */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#d4af37]">
                    Vincular Personagens & Cartas a Este Universo
                  </h4>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">
                      Coleções de Cartas Originárias Deste Universo
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      {collectionsList.map((colName) => {
                        const isSel = (editingNode.linkedCollections || []).includes(colName);
                        return (
                          <button
                            key={colName}
                            type="button"
                            onClick={() => {
                              const curr = editingNode.linkedCollections || [];
                              const next = isSel
                                ? curr.filter((c) => c !== colName)
                                : [...curr, colName];
                              setEditingNode({ ...editingNode, linkedCollections: next });
                            }}
                            className={`px-2.5 py-1 rounded text-xs border transition ${
                              isSel
                                ? 'bg-purple-600 text-white border-purple-400 font-bold'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {colName}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">
                      Arquétipos Associados
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                      {archetypes.map((arch) => {
                        const isSel = (editingNode.linkedArchetypes || []).includes(arch.name);
                        return (
                          <button
                            key={arch.name}
                            type="button"
                            onClick={() => {
                              const curr = editingNode.linkedArchetypes || [];
                              const next = isSel
                                ? curr.filter((a) => a !== arch.name)
                                : [...curr, arch.name];
                              setEditingNode({ ...editingNode, linkedArchetypes: next });
                            }}
                            className={`px-2.5 py-1 rounded text-xs border transition ${
                              isSel
                                ? 'bg-[#d4af37] text-slate-950 border-[#d4af37] font-bold'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {arch.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">
                      Vincular Cartas Específicas em Destaque
                    </label>
                    <input
                      type="text"
                      value={cardPickerSearch}
                      onChange={(e) => setCardPickerSearch(e.target.value)}
                      placeholder="Pesquisar carta pelo nome ou código..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white mb-2"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto bg-slate-950 p-2 rounded-lg border border-slate-800">
                      {cards
                        .filter((c) => {
                          if (!cardPickerSearch.trim()) {
                            return (editingNode.linkedCardCodes || []).includes(c.code);
                          }
                          const q = cardPickerSearch.toLowerCase();
                          return (
                            c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
                          );
                        })
                        .slice(0, 24)
                        .map((c) => {
                          const isLinked = (editingNode.linkedCardCodes || []).includes(c.code);
                          return (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                const curr = editingNode.linkedCardCodes || [];
                                const next = isLinked
                                  ? curr.filter((cd) => cd !== c.code)
                                  : [...curr, c.code];
                                setEditingNode({ ...editingNode, linkedCardCodes: next });
                              }}
                              className={`p-1.5 rounded text-left text-[11px] flex items-center gap-2 border transition ${
                                isLinked
                                  ? 'bg-purple-950 border-purple-400 text-white font-bold'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              {c.imageUrl && (
                                <img src={c.imageUrl} alt="" className="w-6 h-8 object-cover rounded shrink-0" />
                              )}
                              <span className="truncate">{c.name}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* READER VIEW */
              <div>
                {/* Hero Cover Banner */}
                <div className="relative h-60 w-full bg-[#05050c] overflow-hidden border-b border-[#d4af37]/30">
                  {activeNodeForDrawer.coverImageUrl ? (
                    <img
                      src={activeNodeForDrawer.coverImageUrl}
                      alt={activeNodeForDrawer.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{
                        background: `radial-gradient(circle at 50% 35%, ${activeNodeForDrawer.primaryColor}44, ${activeNodeForDrawer.secondaryColor}22, #05050c 85%)`
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08080f] via-[#08080f]/50 to-transparent" />

                  <div className="absolute bottom-5 left-6 right-6 space-y-1">
                    <span className="text-xs font-cinzel tracking-[0.25em] uppercase text-[#d4af37] block">
                      {activeNodeForDrawer.subtitle}
                    </span>
                    <h2 className="font-cinzel text-2xl sm:text-3xl font-black text-white uppercase tracking-wide">
                      {activeNodeForDrawer.name}
                    </h2>
                  </div>
                </div>

                {/* Body Container */}
                <div className="p-6 space-y-7">
                  {/* Portal Gateway Action Banner (Switch Plane through Poço da Corrupção or Rede do Caos) */}
                  {(activeNodeForDrawer.isPortalGateway || activeNodeForDrawer.targetPlaneId) && (
                    <div className="bg-red-950/35 border border-red-500/45 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs text-red-100">
                        <strong className="text-red-300 font-cinzel uppercase tracking-wider block">
                          Passagem Dimensional Ativa
                        </strong>
                        Esta porta de entrada conecta diretamente a outro plano dimensional.
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleSwitchPlane(activeNodeForDrawer.targetPlaneId || 'paralelo_corrupcao')
                        }
                        className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-lg transition"
                      >
                        <Orbit size={14} />
                        <span>
                          Atravessar para{' '}
                          {
                            PLANE_DEFINITIONS.find(
                              (p) => p.id === (activeNodeForDrawer.targetPlaneId || 'paralelo_corrupcao')
                            )?.label
                          }
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Lead Summary */}
                  <p className="font-playfair text-base sm:text-lg text-slate-200 leading-relaxed italic border-b border-white/10 pb-5">
                    {activeNodeForDrawer.summary}
                  </p>

                  {/* Custom Cosmic Attributes Strip */}
                  {activeNodeForDrawer.customStats && activeNodeForDrawer.customStats.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#0c0c16] border border-white/10 rounded-xl p-4">
                      {activeNodeForDrawer.customStats.map((st, i) => (
                        <div key={i} className="space-y-0.5">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                            {st.label}
                          </span>
                          <span className="text-xs font-bold text-[#d4af37] block">{st.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rich Media & Narrative Blocks */}
                  <div className="space-y-5">
                    {(activeNodeForDrawer.blocks || []).map((blk) => {
                      if (blk.type === 'heading') {
                        return (
                          <h3
                            key={blk.id}
                            className="font-cinzel text-xl font-bold text-[#d4af37] uppercase tracking-wider pt-3 border-b border-[#d4af37]/20 pb-2"
                          >
                            {blk.text}
                          </h3>
                        );
                      }
                      if (blk.type === 'paragraph') {
                        return (
                          <p
                            key={blk.id}
                            className="font-playfair text-base text-slate-300 leading-relaxed whitespace-pre-wrap"
                          >
                            {blk.text}
                          </p>
                        );
                      }
                      if (blk.type === 'quote') {
                        return (
                          <blockquote
                            key={blk.id}
                            className="bg-[#0d0d18] border border-[#d4af37]/30 rounded-xl p-5 my-4 text-center space-y-2"
                          >
                            <p className="font-playfair text-base sm:text-lg italic text-amber-100">
                              "{blk.text}"
                            </p>
                            {blk.caption && (
                              <footer className="text-xs font-cinzel tracking-widest uppercase text-[#d4af37]">
                                — {blk.caption}
                              </footer>
                            )}
                          </blockquote>
                        );
                      }
                      if (blk.type === 'image' && blk.mediaUrl) {
                        return (
                          <figure key={blk.id} className="space-y-2 my-4">
                            <div className="rounded-xl overflow-hidden border border-white/15 bg-black shadow-xl">
                              <img
                                src={blk.mediaUrl}
                                alt={blk.caption || ''}
                                className="w-full max-h-[440px] object-contain mx-auto"
                              />
                            </div>
                            {blk.caption && (
                              <figcaption className="text-xs text-center text-slate-400 italic font-playfair">
                                {blk.caption}
                              </figcaption>
                            )}
                          </figure>
                        );
                      }
                      if (blk.type === 'video' && blk.mediaUrl) {
                        const embed = getEmbedVideoUrl(blk.mediaUrl);
                        return (
                          <figure key={blk.id} className="space-y-2 my-4">
                            <div className="rounded-xl overflow-hidden border border-white/15 bg-black aspect-video shadow-xl">
                              {embed.isIframe ? (
                                <iframe
                                  src={embed.src}
                                  className="w-full h-full border-0"
                                  allow="autoplay; fullscreen"
                                  title={blk.caption || 'Lore Video'}
                                />
                              ) : (
                                <video
                                  src={embed.src}
                                  controls
                                  className="w-full h-full object-contain"
                                />
                              )}
                            </div>
                            {blk.caption && (
                              <figcaption className="text-xs text-center text-slate-400 italic font-playfair">
                                {blk.caption}
                              </figcaption>
                            )}
                          </figure>
                        );
                      }
                      if (blk.type === 'gallery' && blk.mediaList && blk.mediaList.length > 0) {
                        return (
                          <div key={blk.id} className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
                            {blk.mediaList.map((m, idx) => (
                              <figure
                                key={idx}
                                className="rounded-xl overflow-hidden border border-white/15 bg-[#0b0b14] flex flex-col"
                              >
                                {m.type === 'video' ? (
                                  <video src={m.url} controls className="w-full h-48 object-cover" />
                                ) : (
                                  <img src={m.url} alt={m.caption || ''} className="w-full h-48 object-cover" />
                                )}
                                {m.caption && (
                                  <figcaption className="p-2.5 text-xs text-slate-300 text-center font-playfair italic">
                                    {m.caption}
                                  </figcaption>
                                )}
                              </figure>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>

                  {/* LOCATION TIMELINE SECTION (LINHA DO TEMPO DESTE LOCAL) */}
                  <div className="pt-6 border-t border-white/10 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-cinzel text-sm font-bold uppercase tracking-widest text-[#d4af37] flex items-center gap-2">
                          <Clock size={15} className="text-[#d4af37]" />
                          <span>
                            Linha do Tempo Deste Local (
                            {(activeNodeForDrawer.timelineEvents || []).length})
                          </span>
                        </h4>
                        <p className="text-xs text-slate-400">
                          Cronologia de acontecimentos e marcos históricos ocorridos em{' '}
                          {activeNodeForDrawer.name}.
                        </p>
                      </div>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isTimelineFormOpen && !editingTimelineEventId) {
                              setIsTimelineFormOpen(false);
                            } else {
                              handleOpenNewTimelineForm();
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 transition shadow-md"
                        >
                          <Plus size={13} />
                          <span>
                            {isTimelineFormOpen && !editingTimelineEventId
                              ? 'Fechar Formulário'
                              : '+ Adicionar Acontecimento'}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Admin Inline Form to Add or Edit a Timeline Event */}
                    {isAdmin && isTimelineFormOpen && (
                      <div className="bg-slate-950/95 border border-[#d4af37]/60 rounded-xl p-4 space-y-3 animate-fade-in">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span className="text-xs font-cinzel font-bold uppercase tracking-wider text-[#d4af37]">
                            {editingTimelineEventId
                              ? 'Editar Acontecimento da Linha do Tempo'
                              : `Novo Acontecimento em ${activeNodeForDrawer.name}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsTimelineFormOpen(false);
                              setEditingTimelineEventId(null);
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">
                              Data / Era / Período
                            </label>
                            <input
                              type="text"
                              value={timelineDraft.dateLabel}
                              onChange={(e) =>
                                setTimelineDraft({ ...timelineDraft, dateLabel: e.target.value })
                              }
                              placeholder="Ex: Era 1, Ano 320..."
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-slate-400 block mb-1">
                              Título do Acontecimento
                            </label>
                            <input
                              type="text"
                              value={timelineDraft.title}
                              onChange={(e) =>
                                setTimelineDraft({ ...timelineDraft, title: e.target.value })
                              }
                              placeholder="Nome do acontecimento..."
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">
                            Descrição do Acontecimento
                          </label>
                          <textarea
                            value={timelineDraft.description}
                            onChange={(e) =>
                              setTimelineDraft({ ...timelineDraft, description: e.target.value })
                            }
                            placeholder="Escreva os detalhes deste acontecimento histórico..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white h-24 resize-none"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={timelineDraft.mediaUrl || ''}
                            onChange={(e) =>
                              setTimelineDraft({ ...timelineDraft, mediaUrl: e.target.value })
                            }
                            placeholder="URL de imagem ou vídeo opcional..."
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                          />
                          <label className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0">
                            {uploadingTimelineMedia ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Upload size={12} />
                            )}
                            <span>Anexar Mídia</span>
                            <input
                              type="file"
                              accept="image/*,video/*"
                              className="hidden"
                              onChange={async (e) => {
                                if (e.target.files?.[0]) {
                                  const file = e.target.files[0];
                                  setUploadingTimelineMedia(true);
                                  try {
                                    const url = await onUploadMedia(file);
                                    setTimelineDraft({
                                      ...timelineDraft,
                                      mediaUrl: url,
                                      mediaType: file.type.startsWith('video/') ? 'video' : 'image'
                                    });
                                  } finally {
                                    setUploadingTimelineMedia(false);
                                  }
                                }
                              }}
                            />
                          </label>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsTimelineFormOpen(false);
                              setEditingTimelineEventId(null);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={savingTimelineEvent}
                            onClick={() => handleSaveQuickTimelineEvent(activeNodeForDrawer)}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                          >
                            {savingTimelineEvent ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Check size={12} />
                            )}
                            <span>Salvar Acontecimento</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Vertical Timeline Events List */}
                    {(activeNodeForDrawer.timelineEvents || []).length > 0 ? (
                      <div className="relative pl-5 border-l-2 border-[#d4af37]/40 space-y-5 my-2">
                        {(activeNodeForDrawer.timelineEvents || []).map((ev, idx) => (
                          <div
                            key={ev.id}
                            className="relative bg-[#0c0c17] border border-white/10 hover:border-[#d4af37]/50 rounded-xl p-4 space-y-2 transition"
                          >
                            {/* Timeline Node Dot */}
                            <div
                              className="absolute -left-[27px] top-4 w-3.5 h-3.5 rounded-full bg-[#08080f] border-2 border-[#d4af37] shadow-[0_0_10px_rgba(212,175,55,0.8)]"
                              style={{ borderColor: activeNodeForDrawer.primaryColor || '#d4af37' }}
                            />

                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                {ev.dateLabel && (
                                  <span className="inline-block px-2 py-0.5 rounded bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#d4af37] font-cinzel text-[10px] font-bold uppercase tracking-widest">
                                    {ev.dateLabel}
                                  </span>
                                )}
                                <h5 className="font-cinzel text-sm sm:text-base font-bold text-white">
                                  {ev.title || `Acontecimento #${idx + 1}`}
                                </h5>
                              </div>

                              {isAdmin && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    disabled={idx === 0 || savingTimelineEvent}
                                    onClick={() =>
                                      handleMoveQuickTimelineEvent(activeNodeForDrawer, idx, -1)
                                    }
                                    className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                                    title="Mover para antes"
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      idx ===
                                        (activeNodeForDrawer.timelineEvents || []).length - 1 ||
                                      savingTimelineEvent
                                    }
                                    onClick={() =>
                                      handleMoveQuickTimelineEvent(activeNodeForDrawer, idx, 1)
                                    }
                                    className="p-1 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                                    title="Mover para depois"
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditTimelineForm(ev)}
                                    className="p-1 rounded bg-purple-950/70 hover:bg-purple-800 text-purple-200"
                                    title="Editar acontecimento"
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={savingTimelineEvent}
                                    onClick={() =>
                                      handleDeleteQuickTimelineEvent(activeNodeForDrawer, ev.id)
                                    }
                                    className="p-1 rounded bg-red-950/70 hover:bg-red-900 text-red-300"
                                    title="Excluir acontecimento"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>

                            {ev.description && (
                              <p className="font-playfair text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {ev.description}
                              </p>
                            )}

                            {ev.mediaUrl && (
                              <div className="pt-2">
                                {ev.mediaType === 'video' ? (
                                  <video
                                    src={ev.mediaUrl}
                                    controls
                                    className="w-full max-h-64 rounded-lg border border-white/10 bg-black object-contain"
                                  />
                                ) : (
                                  <img
                                    src={ev.mediaUrl}
                                    alt={ev.title || ''}
                                    className="w-full max-h-64 rounded-lg border border-white/10 bg-black object-contain"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 bg-[#0b0b14] border border-white/10 rounded-xl p-4 text-center">
                        Linha do tempo será preenchida em breve.
                        {isAdmin && (
                          <span className="block mt-1 text-amber-300">
                            Clique em <strong>+ Adicionar Acontecimento</strong> acima para registrar os eventos deste local.
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Connected Realities / Travel Links */}
                  {activeNodeForDrawer.connectedNodeIds &&
                    activeNodeForDrawer.connectedNodeIds.length > 0 && (
                      <div className="pt-5 border-t border-white/10 space-y-3">
                        <h4 className="font-cinzel text-xs uppercase tracking-widest text-slate-400">
                          Rotas Astrais & Fronteiras Conectadas
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {activeNodeForDrawer.connectedNodeIds.map((connId) => {
                            const target = nodes.find((n) => n.id === connId);
                            if (!target) return null;
                            return (
                              <button
                                key={target.id}
                                type="button"
                                onClick={() => {
                                  if (
                                    target.planeId &&
                                    activePlane !== 'all' &&
                                    target.planeId !== activePlane
                                  ) {
                                    setActivePlane(target.planeId);
                                  }
                                  handleSelectNode(target);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#0e0e1a] hover:bg-[#161628] border border-white/15 hover:border-[#d4af37] text-xs text-slate-200 flex items-center gap-2 transition"
                              >
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: target.primaryColor }}
                                />
                                <span className="font-cinzel font-bold">{target.name}</span>
                                <ChevronRight size={13} className="text-[#d4af37]" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  {/* Linked Cards, Champions & Multi-Location Trajectory Trigger */}
                  {(linkedCardsList.length > 0 || isAdmin) && (
                    <div className="pt-5 border-t border-white/10 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="font-cinzel text-sm font-bold uppercase tracking-widest text-[#d4af37]">
                            Seres, Campeões & Registros Deste Local ({linkedCardsList.length})
                          </h4>
                          <p className="text-xs text-slate-400">
                            Clique em um personagem para exibir sua trajetória pelo mapa ou inspecionar sua carta.
                          </p>
                        </div>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setIsQuickAddCardOpen(!isQuickAddCardOpen)}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 transition shadow-md"
                          >
                            <Plus size={13} />
                            <span>
                              {isQuickAddCardOpen ? 'Fechar Seletor' : '+ Adicionar Carta Aqui'}
                            </span>
                          </button>
                        )}
                      </div>

                      {/* Admin Quick Card Picker for this Location */}
                      {isAdmin && isQuickAddCardOpen && (
                        <div className="bg-slate-950/95 border border-amber-400/50 rounded-xl p-3.5 space-y-3 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-300">
                              Adicionar Personagem / Carta a {activeNodeForDrawer.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Você pode adicionar o mesmo personagem em vários locais para criar sua trajetória
                            </span>
                          </div>
                          <input
                            type="text"
                            value={quickAddCardSearch}
                            onChange={(e) => setQuickAddCardSearch(e.target.value)}
                            placeholder="Pesquisar carta pelo nome, código ou coleção..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                          />
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {cards
                              .filter((c) => {
                                if (c.isHidden) return false;
                                if (!quickAddCardSearch.trim()) return true;
                                const q = quickAddCardSearch.toLowerCase();
                                return (
                                  c.name.toLowerCase().includes(q) ||
                                  c.code.toLowerCase().includes(q) ||
                                  (c.collection || '').toLowerCase().includes(q)
                                );
                              })
                              .slice(0, 30)
                              .map((c) => {
                                const isAlreadyExplicit = (
                                  activeNodeForDrawer.linkedCardCodes || []
                                ).includes(c.code);
                                return (
                                  <button
                                    key={c.code}
                                    type="button"
                                    disabled={savingTrajectory}
                                    onClick={() => {
                                      if (isAlreadyExplicit) {
                                        handleRemoveCardFromNode(c, activeNodeForDrawer);
                                      } else {
                                        handleAddCardToNode(c, activeNodeForDrawer);
                                      }
                                    }}
                                    className={`p-1.5 rounded-lg text-left text-[11px] flex items-center gap-2 border transition ${
                                      isAlreadyExplicit
                                        ? 'bg-amber-500/20 border-amber-400 text-white font-bold'
                                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-amber-400/50 hover:text-white'
                                    }`}
                                  >
                                    {c.imageUrl && (
                                      <img
                                        src={c.imageUrl}
                                        alt=""
                                        className="w-6 h-8 object-cover rounded shrink-0"
                                      />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate">{c.name}</div>
                                      <div className="text-[9px] text-amber-300">
                                        {isAlreadyExplicit ? '✓ Vinculado (Remover)' : '+ Adicionar'}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {linkedCardsList.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {linkedCardsList.map((card) => {
                            const isTrackingThis = trackedCard?.code === card.code;
                            const isExplicitHere = (
                              activeNodeForDrawer.linkedCardCodes || []
                            ).includes(card.code);
                            const colLower = (card.collection || '').toLowerCase();
                            const visitedCount = nodes.filter(
                              (n) =>
                                (n.linkedCardCodes || []).includes(card.code) ||
                                (colLower &&
                                  (n.linkedCollections || []).some(
                                    (col) => col.toLowerCase() === colLower
                                  ))
                            ).length;

                            return (
                              <div
                                key={card.code}
                                onClick={() => handleSelectCardTrajectory(card)}
                                className={`group relative bg-[#0c0c16] border rounded-xl overflow-hidden cursor-pointer transition flex flex-col ${
                                  isTrackingThis
                                    ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-[0_0_20px_rgba(251,191,36,0.3)]'
                                    : 'border-white/10 hover:border-[#d4af37]'
                                }`}
                              >
                                {/* Admin Quick Remove Button */}
                                {isAdmin && isExplicitHere && (
                                  <button
                                    type="button"
                                    disabled={savingTrajectory}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveCardFromNode(card, activeNodeForDrawer);
                                    }}
                                    className="absolute top-1.5 right-1.5 z-10 p-1 rounded-full bg-red-950/90 hover:bg-red-600 text-red-200 hover:text-white border border-red-400/50 shadow"
                                    title="Remover esta carta deste local"
                                  >
                                    <X size={11} />
                                  </button>
                                )}

                                {/* Multi-location Trajectory Badge */}
                                <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded bg-black/80 border border-amber-400/50 text-[9px] font-bold text-amber-300 flex items-center gap-1">
                                  <Compass size={10} />
                                  <span>
                                    {visitedCount > 1
                                      ? `${visitedCount} locais`
                                      : 'Trajetória'}
                                  </span>
                                </div>

                                <div className="aspect-[3/4] bg-black overflow-hidden">
                                  {card.imageUrl ? (
                                    <img
                                      src={card.imageUrl}
                                      alt={card.name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-600 font-bold">
                                      {card.name}
                                    </div>
                                  )}
                                </div>
                                <div className="p-2 space-y-1.5">
                                  <div>
                                    <div className="text-xs font-bold text-white truncate">
                                      {card.name}
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {card.type}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 pt-0.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectCardTrajectory(card);
                                      }}
                                      className={`flex-1 py-1 px-1.5 rounded text-[10px] font-bold text-center transition ${
                                        isTrackingThis
                                          ? 'bg-amber-400 text-slate-950'
                                          : 'bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-400/30'
                                      }`}
                                    >
                                      {isTrackingThis ? 'Traçando Rota' : 'Ver Trajetória'}
                                    </button>
                                    {onSelectCard && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onSelectCard(card);
                                        }}
                                        className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold transition"
                                        title="Abrir detalhes da carta"
                                      >
                                        Carta
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 bg-[#0b0b14] border border-white/10 rounded-xl p-4 text-center">
                          Nenhuma carta vinculada a este local. Clique em{' '}
                          <strong className="text-amber-300">+ Adicionar Carta Aqui</strong> para vincular personagens.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
};
