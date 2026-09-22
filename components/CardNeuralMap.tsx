import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Network, Zap, Sparkles, Filter, ZoomIn, ZoomOut, RotateCcw, 
  Play, Pause, Eye, Plus, Trash2, X, ChevronRight, Info, 
  Layers, Shield, Sword, Box, Search, ArrowRight, Check, Sparkle,
  Maximize2, LayoutGrid, Orbit, Columns3, Lock, Unlock, Link2
} from 'lucide-react';
import { CardData, CardType } from '../types';
import { compareCardCodes } from '../deckUtils';

export type InteractionType = 'same_name' | 'effect_interaction' | 'same_archetype' | 'same_collection' | 'custom';
export type LayoutMode = 'orbits' | 'grid' | 'types';

export interface NeuralLink {
  id: string;
  sourceId: string;
  targetId: string;
  type: InteractionType;
  archetype?: string;
  label: string;
  strength: number; // 1 to 3
  color: string;
  pulseOffset: number;
}

export interface NeuralNode {
  id: string;
  card: CardData;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  radius: number; // approximate bounding radius for physics
  type: CardType;
  isDeck: boolean;
  isHero: boolean;
  color: string;
  glowColor: string;
  borderColor: string;
  connectionsCount: number;
}

export type NeuralFilterType = 'Todos' | 'Combatente' | 'Herói' | 'Equipamento' | 'Efeito' | 'Arquétipos' | 'Nome';
export const NEURAL_FILTERS: NeuralFilterType[] = ['Todos', 'Combatente', 'Herói', 'Equipamento', 'Efeito', 'Arquétipos', 'Nome'];

export interface SuggestedSynergyCard {
  card: CardData;
  score: number;
  interactionCount: number;
  interactionScore: number;
  reasons: string[];
  matchedArchetypes?: string[];
  matchedPrincipalKeywords?: string[];
}

interface CardNeuralMapProps {
  deck: CardData[];
  sideDeck?: CardData[];
  allCards: CardData[];
  onInspectCard: (card: CardData) => void;
  onAddToDeck: (card: CardData) => void;
  onRemoveFromDeck: (index: number) => void;
  onLoadSampleDeck?: (name: string) => void;
}

// Colors for card types:
// Herói = Vermelho, Combatente = Azul, Equipamento = Verde, Efeito = Roxo
const TYPE_COLORS: Record<CardType, { color: string; glow: string; border: string; bgBadge: string; textBadge: string }> = {
  'Herói': { 
    color: '#ef4444', 
    glow: 'rgba(239, 68, 68, 0.75)', 
    border: '#ef4444', 
    bgBadge: 'rgba(239, 68, 68, 0.2)', 
    textBadge: '#fca5a5' 
  },
  'Combatente': { 
    color: '#3b82f6', 
    glow: 'rgba(59, 130, 246, 0.75)', 
    border: '#3b82f6', 
    bgBadge: 'rgba(59, 130, 246, 0.2)', 
    textBadge: '#93c5fd' 
  },
  'Equipamento': { 
    color: '#10b981', 
    glow: 'rgba(16, 185, 129, 0.75)', 
    border: '#10b981', 
    bgBadge: 'rgba(16, 185, 129, 0.2)', 
    textBadge: '#86efac' 
  },
  'Efeito': { 
    color: '#a855f7', 
    glow: 'rgba(168, 85, 247, 0.75)', 
    border: '#a855f7', 
    bgBadge: 'rgba(168, 85, 247, 0.2)', 
    textBadge: '#d8b4fe' 
  }
};

// Colors for link interaction types
const LINK_COLORS: Record<InteractionType, { color: string; glow: string; label: string }> = {
  same_name: { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.85)', label: 'Mesmo Nome / Palavra-Chave' },
  effect_interaction: { color: '#06b6d4', glow: 'rgba(6, 182, 212, 0.85)', label: 'Interação de Efeito' },
  same_archetype: { color: '#a855f7', glow: 'rgba(168, 85, 247, 0.75)', label: 'Mesmo Arquétipo' },
  same_collection: { color: '#6366f1', glow: 'rgba(99, 102, 241, 0.5)', label: 'Mesma Coleção' },
  custom: { color: '#10b981', glow: 'rgba(16, 185, 129, 0.85)', label: 'Ligação Customizada' }
};

export const STRUCTURAL_DECKS = [
  { id: 'jim', name: 'Insanis (Jim & Macroverso)', desc: 'Sinergia de herói Jim, duplicatas e armas macroversais' },
  { id: 'jenos', name: 'Príncipe do Macroverso (Jenos)', desc: 'Combos de Destinados e controle macroversal' },
  { id: 'Herdeiro do Caos', name: 'Herdeiro do Caos', desc: 'Sinergias de Caos, Salazar e efeitos destrutivos' },
  { id: 'Mechs e Mangas', name: 'Mechs e Mangas', desc: 'Combatentes mecânicos, equipamentos e cibernética' },
  { id: 'Mundo em Chamas', name: 'Mundo em Chamas', desc: 'Chamas, ignição e alto poder ofensivo' },
  { id: 'Corruptor Profano', name: 'Corruptor Profano', desc: 'Efeitos corruptores, dreno e arquétipo sombrio' },
  { id: 'O Escolhido', name: 'O Escolhido', desc: 'Heróis lendários com acúmulo de atributos' },
  { id: 'Deusa da Lua', name: 'Deusa da Lua (Mahina)', desc: 'Magias divinas, cura e sustentação estelar' },
];

// Palavras-chave principais exigidas pelo usuário:
// "Mesmo nome somente se for o nome principal, exemplo: Jim, Spear, Aventureiro, que são nomes palavras chave."
export const PRINCIPAL_KEYWORDS = [
  'Jim', 'Spear', 'Aventureiro', 'Aventureira',
  'Jenos', 'Mahina', 'Otto', 'Asmonious', 'Vellret', 'Velrret',
  'Selena', 'Salazar', 'Donnie', 'Blair', 'Kiara', 'Hyummeng',
  'Till Von Linden', 'Von Linden', 'Criven', 'Kevin', 'Argor', 'Ikari', 
  'Dalvo', 'Solus', 'Arqcuia', 'Goor', 'Talenia',
  'Destinado', 'Destinada', 'Gema Macroversal', 'Crueldade', 'Conceito Caos',
  'Valquíria', 'Lorde', 'Corrompido', 'Corrompida', 'Sanguinário', 'Sanguinária',
  'Caótico', 'Caótica'
];

export const CANONICAL_KEYWORD_MAP: Record<string, string> = {
  'destinado': 'Destinado(a)',
  'destinada': 'Destinado(a)',
  'aventureiro': 'Aventureiro(a)',
  'aventureira': 'Aventureiro(a)',
  'corrompido': 'Corrompido(a)',
  'corrompida': 'Corrompido(a)',
  'sanguinario': 'Sanguinário(a)',
  'sanguinário': 'Sanguinário(a)',
  'sanguinaria': 'Sanguinário(a)',
  'sanguinária': 'Sanguinário(a)',
  'caotico': 'Caótico(a)',
  'caótico': 'Caótico(a)',
  'caotica': 'Caótico(a)',
  'caótica': 'Caótico(a)',
  'till von linden': 'Von Linden',
  'von linden': 'Von Linden',
  'velrret': 'Vellret',
  'vellret': 'Vellret'
};

export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function getBaseCardName(name: string): string {
  return normalizeText(name)
    .replace(/\s*\((alt|skin|promo|evento|variante|moderno|legado|beta)[^)]*\)/gi, '')
    .trim();
}

export function extractPrincipalIdentities(name?: string): string[] {
  if (!name || typeof name !== 'string') return [];
  const result = new Set<string>();
  const norm = normalizeText(name);

  for (const kw of PRINCIPAL_KEYWORDS) {
    const kwNorm = normalizeText(kw);
    const regex = new RegExp(`(?:^|[\\s«"'\`(\\[,.;/\\-])${kwNorm}(?:$|[\\s»"'\`)\],.;/\\-])`, 'i');
    if (regex.test(norm)) {
      const canon = CANONICAL_KEYWORD_MAP[kw.toLowerCase()] || kw;
      result.add(canon);
    }
  }

  if (name.includes(' - ')) {
    const prefix = name.split(' - ')[0].trim();
    const prefixNorm = normalizeText(prefix);
    const matched = PRINCIPAL_KEYWORDS.find(k => normalizeText(k) === prefixNorm);
    if (matched) {
      const canon = CANONICAL_KEYWORD_MAP[matched.toLowerCase()] || matched;
      result.add(canon);
    }
  }

  return Array.from(result);
}

export function textMentionsTarget(text: string, target: string): boolean {
  if (!text || !target) return false;
  const tNorm = ` ${normalizeText(text)} `;
  const targetNorm = normalizeText(target);
  if (targetNorm.length < 3) return false;
  const regex = new RegExp(`(?:^|[\\s«"'\`(\\[,.;/\\-])${targetNorm}(?:$|[\\s»"'\`)\],.;/\\-])`, 'i');
  return regex.test(tNorm);
}

// Calculate deterministic, beautifully spaced non-overlapping positions for cards
// REQUISITO: "cartas sem ligação nenhuma, coloque elas sempre alinhadas em cima"
function calculateLayoutPositions(
  items: Array<{ card: CardData; id: string }>, 
  mode: LayoutMode,
  connCounts: Record<string, number> = {}
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const total = items.length;
  if (total === 0) return positions;

  // Separate cards that have no connections at all vs cards that have connections
  // Herói cards are always placed centrally
  const unconnected = items.filter(it => (connCounts[it.id] || 0) === 0 && it.card.type !== 'Herói');
  const connected = items.filter(it => (connCounts[it.id] || 0) > 0 || it.card.type === 'Herói');

  const placeConnectedItems = (list: typeof items) => {
    const subTotal = list.length;
    if (subTotal === 0) return;

    if (mode === 'grid') {
      const sorted = [...list].sort((a, b) => {
        const typeOrder: Record<string, number> = { 
          'Herói': 0, 'Combatente': 1, 'Equipamento': 2, 'Magia': 3, 'Intervenção': 4, 'Terreno': 5 
        };
        const orderA = typeOrder[a.card.type] ?? 9;
        const orderB = typeOrder[b.card.type] ?? 9;
        if (orderA !== orderB) return orderA - orderB;
        return (a.card.name || '').localeCompare(b.card.name || '');
      });

      const cols = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(subTotal * 1.35))));
      const colSpacing = 84;
      const rowSpacing = 118;

      sorted.forEach((item, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = (col - (cols - 1) / 2) * colSpacing;
        const y = (row - (Math.ceil(subTotal / cols) - 1) / 2) * rowSpacing + 25;
        positions.set(item.id, { x, y });
      });
      return;
    }

    if (mode === 'types') {
      const groups: Record<string, typeof list> = {
        'Herói': [],
        'Combatente': [],
        'Equipamento': [],
        'Magia': [],
        'Intervenção': [],
        'Outros': []
      };

      list.forEach(item => {
        if (groups[item.card.type]) {
          groups[item.card.type].push(item);
        } else {
          groups['Outros'].push(item);
        }
      });

      const activeGroups = Object.entries(groups).filter(([_, l]) => l.length > 0);
      const groupCount = activeGroups.length;
      const colSpacing = 105;
      const rowSpacing = 98;

      activeGroups.forEach(([_, groupItems], colIdx) => {
        const colX = (colIdx - (groupCount - 1) / 2) * colSpacing;
        groupItems.sort((a, b) => (a.card.name || '').localeCompare(b.card.name || ''));
        groupItems.forEach((item, rowIdx) => {
          const rowY = (rowIdx - (groupItems.length - 1) / 2) * rowSpacing + 25;
          positions.set(item.id, { x: colX, y: rowY });
        });
      });
      return;
    }

    // Mode: 'orbits'
    const heroes = list.filter(i => i.card.type === 'Herói');
    const nonHeroes = list.filter(i => i.card.type !== 'Herói');

    nonHeroes.sort((a, b) => {
      const archA = a.card.archetype || 'Z';
      const archB = b.card.archetype || 'Z';
      if (archA !== archB) return archA.localeCompare(archB);
      return (a.card.name || '').localeCompare(b.card.name || '');
    });

    const centerY = 110;
    if (heroes.length === 1) {
      positions.set(heroes[0].id, { x: 0, y: centerY });
    } else if (heroes.length > 1) {
      const heroRadius = 45;
      heroes.forEach((h, i) => {
        const angle = (i / heroes.length) * Math.PI * 2 - Math.PI / 2;
        positions.set(h.id, {
          x: Math.cos(angle) * heroRadius,
          y: centerY + Math.sin(angle) * heroRadius
        });
      });
    }

    const remaining = [...nonHeroes];
    const ringConfigs = [
      { radius: 130, capacity: 10 },
      { radius: 230, capacity: 18 },
      { radius: 330, capacity: 26 },
      { radius: 420, capacity: 34 }
    ];

    let currentRingIdx = 0;
    while (remaining.length > 0 && currentRingIdx < ringConfigs.length) {
      const ring = ringConfigs[currentRingIdx];
      const countInRing = Math.min(ring.capacity, remaining.length);
      const cardsInThisRing = remaining.splice(0, countInRing);
      const angleOffset = currentRingIdx * 0.35;

      cardsInThisRing.forEach((item, i) => {
        const angle = (i / countInRing) * Math.PI * 2 + angleOffset;
        positions.set(item.id, {
          x: Math.cos(angle) * ring.radius,
          y: centerY + Math.sin(angle) * ring.radius
        });
      });

      currentRingIdx++;
    }

    if (remaining.length > 0) {
      const lastRadius = 490;
      remaining.forEach((item, i) => {
        const angle = (i / remaining.length) * Math.PI * 2;
        positions.set(item.id, {
          x: Math.cos(angle) * lastRadius,
          y: centerY + Math.sin(angle) * lastRadius
        });
      });
    }
  };

  // 1. Place connected cards according to mode
  placeConnectedItems(connected);

  // Garantir que as cartas com conexão NUNCA fiquem na área superior das cartas sem conexão
  connected.forEach(it => {
    const p = positions.get(it.id);
    if (p && p.y < -100) {
      p.y = -100;
    }
  });

  // 2. REQUISITO: "cartas sem ligação nenhuma, coloque elas sempre alinhadas em cima"
  // Na linha de cartas sem ligação deve ficar SOMENTE as cartas sem ligação, sem sobreposição com cartas ligadas.
  if (unconnected.length > 0) {
    const topBaseY = -280;
    const colSpacing = 74;
    const maxPerLine = 12;

    if (unconnected.length <= maxPerLine) {
      unconnected.forEach((item, idx) => {
        const x = (idx - (unconnected.length - 1) / 2) * colSpacing;
        positions.set(item.id, { x, y: topBaseY });
      });
    } else {
      unconnected.forEach((item, idx) => {
        const row = Math.floor(idx / maxPerLine);
        const col = idx % maxPerLine;
        const countInThisRow = Math.min(maxPerLine, unconnected.length - row * maxPerLine);
        const x = (col - (countInThisRow - 1) / 2) * colSpacing;
        const y = topBaseY - row * 96;
        positions.set(item.id, { x, y });
      });
    }
  }

  return positions;
}

export const CardNeuralMap: React.FC<CardNeuralMapProps> = ({
  deck,
  sideDeck = [],
  allCards,
  onInspectCard,
  onAddToDeck,
  onRemoveFromDeck,
  onLoadSampleDeck
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport / Camera state
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  
  // Selection, layout and physics state
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('orbits');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isPhysicsRunning, setIsPhysicsRunning] = useState(true);
  const simAlphaRef = useRef<number>(0.35);

  // Suggested Cards Drawer State (User requested: "Sugerir cartas = mostrar lista de cartas em vez de adicionar elas diretamente")
  const [showSuggestionsDrawer, setShowSuggestionsDrawer] = useState(false);
  const [suggestionSearch, setSuggestionSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<NeuralFilterType>('Todos');

  // Custom Links state (REQUISITO: "fazer ligação customizadas")
  const [customLinks, setCustomLinks] = useState<Array<{ id: string; sourceId: string; targetId: string; label?: string }>>([]);
  const [isLinkingMode, setIsLinkingMode] = useState<boolean>(false);
  const [linkingSourceNodeId, setLinkingSourceNodeId] = useState<string | null>(null);

  // Quick Add Card Modal (REQUISITO: "adicionar carta clicando em areas vazias do mapa")
  const [quickAddModal, setQuickAddModal] = useState<{ isOpen: boolean; x: number; y: number } | null>(null);
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [quickAddTypeFilter, setQuickAddTypeFilter] = useState<string>('Todos');
  const mouseDownPosRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });

  // Link type filters
  const [activeLinkFilters, setActiveLinkFilters] = useState<Record<InteractionType, boolean>>({
    same_name: true,
    effect_interaction: true,
    same_archetype: true,
    same_collection: false,
    custom: true
  });
  // Archetype connection filter (REQUISITO: "adicione o filtro de arquetipo na ligação de arquétipos")
  const [selectedArchetypeLinkFilter, setSelectedArchetypeLinkFilter] = useState<string>('Todos');

  // Image cache
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Nodes and simulation ref
  const nodesRef = useRef<NeuralNode[]>([]);
  const linksRef = useRef<NeuralLink[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Pre-load images for cards and re-render on load
  const triggerRepaint = useCallback(() => {
    // triggers canvas redraw
  }, []);

  // Archetypes available among deck cards for link filtering
  const availableLinkArchetypes = useMemo(() => {
    const archSet = new Set<string>();
    deck.forEach(c => {
      (c?.archetype || '').split('/').map(a => a.trim()).filter(a => a && a !== 'Desconhecido').forEach(a => archSet.add(a));
    });
    return Array.from(archSet).sort();
  }, [deck]);

  // Check if a link is active based on type filters and archetype filter
  const isLinkActive = useCallback((link: NeuralLink) => {
    if (!activeLinkFilters[link.type]) return false;
    if (link.type === 'same_archetype' && selectedArchetypeLinkFilter !== 'Todos') {
      return link.archetype === selectedArchetypeLinkFilter;
    }
    return true;
  }, [activeLinkFilters, selectedArchetypeLinkFilter]);

  useEffect(() => {
    const cardsToPreload = [...deck, ...sideDeck];
    cardsToPreload.forEach(card => {
      if (card.imageUrl && !imageCacheRef.current.has(card.imageUrl)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = card.imageUrl;
        img.onload = () => {
          imageCacheRef.current.set(card.imageUrl!, img);
        };
      }
    });
  }, [deck, sideDeck]);

  // Active deck cards representation
  const activeDeckCards = useMemo(() => {
    return deck.map((card, index) => ({
      card,
      id: `deck-${card.code}-${index}`,
      isDeck: true
    }));
  }, [deck]);

  // Calculate intelligent suggestions list based on current deck synergies
  // REGRAS DO USUÁRIO:
  // - NÃO SUGERIR CARTAS QUE SÃO SKIN OU ARTES ALTERNATIVAS DE CARTAS QUE JÁ ESTÃO NO DECK
  // - NÃO SUGERIR OUTROS HERÓIS QUE NÃO INTERAGEM COM O HERÓI ATUAL DO DECK
  const suggestedSynergyCards = useMemo(() => {
    if (!deck || deck.length === 0 || !allCards) return [];
    
    const deckCodes = new Set(deck.map(c => c?.code).filter(Boolean));
    const deckExactNames = new Set(deck.map(c => normalizeText(c?.name || '')));
    const deckBaseNames = new Set(deck.map(c => getBaseCardName(c?.name || '')));
    const deckHeroes = deck.filter(c => c?.type === 'Herói');

    const deckArchetypes: Set<string> = new Set(
      deck.flatMap(c => (c?.archetype || '').split('/').map(a => a.trim()).filter(Boolean))
    );
    const deckPrincipalKeywords: string[] = Array.from(
      new Set(deck.flatMap(c => extractPrincipalIdentities(c?.name)))
    );
    const deckCardsNormalized = deck.map(c => ({
      name: normalizeText(c?.name || ''),
      desc: c?.description || '',
      card: c
    }));

    const scored: SuggestedSynergyCard[] = [];

    allCards.forEach(candidate => {
      if (!candidate || !candidate.code) return;

      // 1. Já está no deck por código
      if (deckCodes.has(candidate.code)) return;

      // 2. REGRA: NAO SUGERIR CARTAS QUE SAO SKIN OU ARTES ALTERNATIVAS DE CARTAS QUE JÁ ESTAO NO DECK
      const candNormName = normalizeText(candidate.name || '');
      const candBaseName = getBaseCardName(candidate.name || '');
      if (deckExactNames.has(candNormName)) return;
      if (deckBaseNames.has(candBaseName)) return;

      // 3. REGRA: NAO SUGERIR OUTROS HEROIS QUE NAO INTERAGEM COM O HEROI ATUAL DO DECK
      if (candidate.type === 'Herói' && deckHeroes.length > 0) {
        const candDesc = candidate.description || '';
        const candIdents = extractPrincipalIdentities(candidate.name);
        const candArchs = (candidate.archetype || '').split('/').map(a => a.trim()).filter(Boolean);

        const interactsWithDeckHero = deckHeroes.some(hero => {
          const heroDesc = hero.description || '';
          const heroIdents = extractPrincipalIdentities(hero.name);
          const heroArchs = (hero.archetype || '').split('/').map(a => a.trim()).filter(Boolean);

          // Candidato cita o Herói do deck ou palavra-chave do Herói
          if (textMentionsTarget(candDesc, hero.name)) return true;
          if (heroIdents.some(id => textMentionsTarget(candDesc, id))) return true;

          // Herói do deck cita o candidato ou palavra-chave do candidato
          if (textMentionsTarget(heroDesc, candidate.name)) return true;
          if (candIdents.some(id => textMentionsTarget(heroDesc, id))) return true;

          // Cita o arquétipo do herói ou herói cita o arquétipo do candidato
          if (heroArchs.some(arch => textMentionsTarget(candDesc, arch))) return true;
          if (candArchs.some(arch => textMentionsTarget(heroDesc, arch))) return true;

          // Compartilha arquétipo com o Herói
          if (candArchs.some(a => heroArchs.includes(a))) return true;

          // Parceiros Canônicos de lore
          const hNorm = normalizeText(hero.name);
          const cNorm = normalizeText(candidate.name);
          if ((hNorm.includes('otto') && cNorm.includes('asmonious')) || (hNorm.includes('asmonious') && cNorm.includes('otto'))) return true;
          if ((hNorm.includes('von linden') && cNorm.includes('selena')) || (hNorm.includes('selena') && cNorm.includes('von linden'))) return true;
          if ((hNorm.includes('conceito caos') && cNorm.includes('salazar')) || (hNorm.includes('salazar') && cNorm.includes('conceito caos'))) return true;

          return false;
        });

        if (!interactsWithDeckHero) {
          return; // Herói não interage com o herói atual: excluir da sugestão!
        }
      }

      let score = 0;
      const reasons: string[] = [];
      const matchedArchetypes: string[] = [];
      const matchedPrincipalKeywords: string[] = [];
      const interactingDeckCardCodes = new Set<string>();

      // Sinergia de Arquétipo
      const candidateArchs = (candidate.archetype || '').split('/').map(a => a.trim()).filter(Boolean);
      candidateArchs.forEach(a => {
        if (deckArchetypes.has(a)) {
          score += 8;
          matchedArchetypes.push(a);
        }
      });
      if (matchedArchetypes.length > 0) {
        reasons.push(`Mesmo Arquétipo: ${matchedArchetypes.join(', ')}`);
        deckCardsNormalized.forEach(dc => {
          const dcArchs = (dc.card.archetype || '').split('/').map(x => x.trim());
          if (candidateArchs.some(a => dcArchs.includes(a))) {
            interactingDeckCardCodes.add(dc.card.code);
          }
        });
      }

      // Sinergia de Nome Principal / Personagem (Jim, Spear, Aventureiro, etc.)
      const candidateIdents = extractPrincipalIdentities(candidate.name);
      candidateIdents.forEach(id => {
        if (deckPrincipalKeywords.includes(id)) {
          score += 12;
          matchedPrincipalKeywords.push(id);
        }
      });
      if (matchedPrincipalKeywords.length > 0) {
        reasons.push(`Mesmo Personagem Principal: ${matchedPrincipalKeywords.join(', ')}`);
        deckCardsNormalized.forEach(dc => {
          const dcIdents = extractPrincipalIdentities(dc.card.name);
          if (candidateIdents.some(id => dcIdents.includes(id))) {
            interactingDeckCardCodes.add(dc.card.code);
          }
        });
      }

      // Efeito do candidato cita cartas ou palavras-chave do deck
      const candDesc = candidate.description || '';
      deckPrincipalKeywords.forEach(id => {
        if (textMentionsTarget(candDesc, id)) {
          score += 10;
          reasons.push(`Efeito cita a palavra-chave «${id}»`);
          deckCardsNormalized.forEach(dc => {
            if (extractPrincipalIdentities(dc.card.name).includes(id)) {
              interactingDeckCardCodes.add(dc.card.code);
            }
          });
        }
      });
      deckCardsNormalized.forEach(dc => {
        if (textMentionsTarget(candDesc, dc.card.name)) {
          score += 16;
          reasons.push(`Efeito cita diretamente «${dc.card.name}»`);
          interactingDeckCardCodes.add(dc.card.code);
        }
      });

      // Cartas do deck citam o candidato ou palavras-chave dele
      deckCardsNormalized.forEach(dc => {
        candidateIdents.forEach(id => {
          if (textMentionsTarget(dc.desc, id)) {
            score += 10;
            reasons.push(`«${dc.card.name}» no deck cita «${id}»`);
            interactingDeckCardCodes.add(dc.card.code);
          }
        });
        if (textMentionsTarget(dc.desc, candidate.name)) {
          score += 16;
          reasons.push(`«${dc.card.name}» no deck cita esta carta`);
          interactingDeckCardCodes.add(dc.card.code);
        }
      });

      // Citação de Arquétipos mútuos ("tambem se citar arquétipos")
      candidateArchs.forEach(arch => {
        deckCardsNormalized.forEach(dc => {
          if (textMentionsTarget(dc.desc, arch)) {
            score += 8;
            reasons.push(`«${dc.card.name}» interage com o arquétipo «${arch}»`);
            interactingDeckCardCodes.add(dc.card.code);
          }
        });
      });
      deckArchetypes.forEach(arch => {
        if (textMentionsTarget(candDesc, arch)) {
          score += 8;
          reasons.push(`Efeito interage com o arquétipo «${arch}»`);
          deckCardsNormalized.forEach(dc => {
            if ((dc.card.archetype || '').includes(arch)) {
              interactingDeckCardCodes.add(dc.card.code);
            }
          });
        }
      });

      // Sinergia Herói + Equipamento
      if (candidate.type === 'Equipamento' && textMentionsTarget(candDesc, 'heroi') && deckHeroes.length > 0) {
        score += 7;
        reasons.push(`Equipamento compatível com o Herói do deck`);
        deckHeroes.forEach(h => interactingDeckCardCodes.add(h.code));
      }

      const interactionCount = interactingDeckCardCodes.size;
      const interactionScore = (interactionCount * 25) + score;

      if (score > 0 || interactionCount > 0) {
        scored.push({
          card: candidate,
          score,
          interactionCount,
          interactionScore,
          reasons: Array.from(new Set(reasons)),
          matchedArchetypes,
          matchedPrincipalKeywords
        });
      }
    });

    // REQUISITO: "em sugerir cartas, classifique inicialmente as cartas com maior interação com o deck para menor"
    return scored.sort((a, b) => {
      if (b.interactionScore !== a.interactionScore) {
        return b.interactionScore - a.interactionScore;
      }
      if (b.interactionCount !== a.interactionCount) {
        return b.interactionCount - a.interactionCount;
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.reasons.length !== a.reasons.length) {
        return b.reasons.length - a.reasons.length;
      }
      return (a.card.name || '').localeCompare(b.card.name || '');
    });
  }, [deck, allCards]);

  // Filtered suggestions for drawer
  // Filtros= Todos, Combatente, Heroi, Equipamento, Efeito, Arquétipos, Nome
  const filteredSuggestions = useMemo(() => {
    return suggestedSynergyCards.filter(item => {
      if (!item || !item.card) return false;

      if (activeFilter === 'Combatente' && item.card.type !== 'Combatente') return false;
      if (activeFilter === 'Herói' && item.card.type !== 'Herói') return false;
      if (activeFilter === 'Equipamento' && item.card.type !== 'Equipamento') return false;
      if (activeFilter === 'Efeito' && item.card.type !== 'Efeito') return false;
      if (activeFilter === 'Arquétipos') {
        const hasArch = (item.matchedArchetypes && item.matchedArchetypes.length > 0) ||
          item.reasons.some(r => r.toLowerCase().includes('arquétipo'));
        if (!hasArch) return false;
      }
      if (activeFilter === 'Nome') {
        const hasName = (item.matchedPrincipalKeywords && item.matchedPrincipalKeywords.length > 0) ||
          item.reasons.some(r => 
            r.toLowerCase().includes('nome') || 
            r.toLowerCase().includes('personagem') || 
            r.toLowerCase().includes('palavra-chave') || 
            r.toLowerCase().includes('variante')
          );
        if (!hasName) return false;
      }

      if (suggestionSearch.trim()) {
        const query = normalizeText(suggestionSearch);
        const matchesName = normalizeText(item.card.name || '').includes(query);
        const matchesArch = normalizeText(item.card.archetype || '').includes(query);
        const matchesDesc = normalizeText(item.card.description || '').includes(query);
        return matchesName || matchesArch || matchesDesc;
      }
      return true;
    });
  }, [suggestedSynergyCards, suggestionSearch, activeFilter]);

  // Detect synergy links between deck cards
  // REGRAS DO USUÁRIO:
  // - Mesmo nome somente se for o nome principal (ex: Jim, Spear, Aventureiro)
  // - Interação somente se citar outras cartas ou palavras-chave que remetem a outras cartas, também se citar arquétipos
  const { nodesData, linksData } = useMemo(() => {
    const combinedCards = activeDeckCards;

    const links: NeuralLink[] = [];
    const linkKeys = new Set<string>();

    for (let i = 0; i < combinedCards.length; i++) {
      for (let j = i + 1; j < combinedCards.length; j++) {
        const itemA = combinedCards[i];
        const itemB = combinedCards[j];
        const cardA = itemA.card;
        const cardB = itemB.card;

        const idA = itemA.id;
        const idB = itemB.id;
        const linkPairKey = `${idA}_${idB}`;

        // 1. Mesmo Nome: ONLY if both share a principal keyword or exact duplicate card name
        const identsA = extractPrincipalIdentities(cardA.name);
        const identsB = extractPrincipalIdentities(cardB.name);
        const commonIdent = identsA.find(id => identsB.includes(id));
        const isExactSameName = normalizeText(cardA.name) === normalizeText(cardB.name);

        if (commonIdent || isExactSameName) {
          const matchLabel = commonIdent || cardA.name;
          links.push({
            id: `link-name-${linkPairKey}`,
            sourceId: idA,
            targetId: idB,
            type: 'same_name',
            label: `Mesmo Nome Principal: «${matchLabel}»`,
            strength: 2.5,
            color: LINK_COLORS.same_name.color,
            pulseOffset: Math.random() * 100
          });
          linkKeys.add(linkPairKey);
        }

        // 2. Interação: somente se citar outras cartas ou palavras chave que remetem a outras cartas, tambem se citar arquétipos
        const descA = cardA.description || '';
        const descB = cardB.description || '';
        const archsA = (cardA.archetype || '').split('/').map(a => a.trim()).filter(Boolean);
        const archsB = (cardB.archetype || '').split('/').map(a => a.trim()).filter(Boolean);

        let effectInteractionLabel = '';

        // Cita o nome da outra carta
        const aQuotesBName = textMentionsTarget(descA, cardB.name);
        const bQuotesAName = textMentionsTarget(descB, cardA.name);

        // Cita palavras-chave principais da outra carta
        const citedBKeyword = identsB.find(id => textMentionsTarget(descA, id));
        const citedAKeyword = identsA.find(id => textMentionsTarget(descB, id));

        // Cita arquétipos da outra carta ("tambem se citar arquétipos")
        const citedArchOfB = archsB.find(arch => textMentionsTarget(descA, arch));
        const citedArchOfA = archsA.find(arch => textMentionsTarget(descB, arch));

        // Interações com Herói
        const isHeroEquipCombo = 
          (cardA.type === 'Equipamento' && textMentionsTarget(descA, 'heroi') && cardB.type === 'Herói') ||
          (cardB.type === 'Equipamento' && textMentionsTarget(descB, 'heroi') && cardA.type === 'Herói');

        const isHeroInvocationSynergy = 
          ((normalizeText(descA).includes('mesmo nome do heroi') || normalizeText(descA).includes('invoque um heroi')) && cardB.type === 'Herói') ||
          ((normalizeText(descB).includes('mesmo nome do heroi') || normalizeText(descB).includes('invoque um heroi')) && cardA.type === 'Herói');

        const isRunaSynergy = 
          ((cardA.archetype?.includes('Cósmico') || normalizeText(descA).includes('runa')) && normalizeText(descB).includes('runas')) ||
          ((cardB.archetype?.includes('Cósmico') || normalizeText(descB).includes('runa')) && normalizeText(descA).includes('runas'));

        const nameANorm = normalizeText(cardA.name);
        const nameBNorm = normalizeText(cardB.name);
        const isPartnerCombo = 
          (nameANorm.includes('otto') && nameBNorm.includes('asmonious')) ||
          (nameANorm.includes('asmonious') && nameBNorm.includes('otto')) ||
          (nameANorm.includes('von linden') && nameBNorm.includes('selena')) ||
          (nameANorm.includes('selena') && nameBNorm.includes('von linden')) ||
          (nameANorm.includes('conceito caos') && nameBNorm.includes('salazar')) ||
          (nameANorm.includes('salazar') && nameBNorm.includes('conceito caos'));

        if (aQuotesBName) {
          effectInteractionLabel = `«${cardA.name}» cita «${cardB.name}» em seu efeito`;
        } else if (bQuotesAName) {
          effectInteractionLabel = `«${cardB.name}» cita «${cardA.name}» em seu efeito`;
        } else if (citedBKeyword) {
          effectInteractionLabel = `«${cardA.name}» cita a palavra-chave «${citedBKeyword}» de «${cardB.name}»`;
        } else if (citedAKeyword) {
          effectInteractionLabel = `«${cardB.name}» cita a palavra-chave «${citedAKeyword}» de «${cardA.name}»`;
        } else if (citedArchOfB) {
          effectInteractionLabel = `«${cardA.name}» cita o arquétipo «${citedArchOfB}» de «${cardB.name}»`;
        } else if (citedArchOfA) {
          effectInteractionLabel = `«${cardB.name}» cita o arquétipo «${citedArchOfA}» de «${cardA.name}»`;
        } else if (isHeroEquipCombo) {
          effectInteractionLabel = `Equipamento de sinergia com o Herói em campo`;
        } else if (isHeroInvocationSynergy) {
          effectInteractionLabel = `Efeito interage diretamente com o Herói do deck`;
        } else if (isRunaSynergy) {
          effectInteractionLabel = `Sinergia de Geração e Consumo de Runas Cósmicas`;
        } else if (isPartnerCombo) {
          effectInteractionLabel = `Parceiros Canônicos de Sinergia (Regra Especial)`;
        }

        if (effectInteractionLabel) {
          links.push({
            id: `link-eff-${linkPairKey}`,
            sourceId: idA,
            targetId: idB,
            type: 'effect_interaction',
            label: effectInteractionLabel,
            strength: 2.8,
            color: LINK_COLORS.effect_interaction.color,
            pulseOffset: Math.random() * 100
          });
          linkKeys.add(linkPairKey);
        }

        // 3. Same Archetype
        const commonArch = archsA.find(a => archsB.includes(a));

        if (commonArch && !linkKeys.has(linkPairKey)) {
          links.push({
            id: `link-arch-${linkPairKey}`,
            sourceId: idA,
            targetId: idB,
            type: 'same_archetype',
            archetype: commonArch,
            label: `Mesmo Arquétipo: «${commonArch}»`,
            strength: 1.5,
            color: LINK_COLORS.same_archetype.color,
            pulseOffset: Math.random() * 100
          });
          linkKeys.add(linkPairKey);
        }

        // 4. Same Collection
        if (cardA.collection && cardA.collection === cardB.collection && !linkKeys.has(linkPairKey)) {
          links.push({
            id: `link-coll-${linkPairKey}`,
            sourceId: idA,
            targetId: idB,
            type: 'same_collection',
            label: `Mesma Coleção: «${cardA.collection}»`,
            strength: 0.8,
            color: LINK_COLORS.same_collection.color,
            pulseOffset: Math.random() * 100
          });
        }
      }
    }

    // 5. Custom Links (REQUISITO: "fazer ligação customizadas")
    customLinks.forEach((cl, idx) => {
      const existsA = combinedCards.some(c => c.id === cl.sourceId);
      const existsB = combinedCards.some(c => c.id === cl.targetId);
      if (existsA && existsB) {
        links.push({
          id: cl.id || `custom-link-${cl.sourceId}-${cl.targetId}-${idx}`,
          sourceId: cl.sourceId,
          targetId: cl.targetId,
          type: 'custom',
          label: cl.label || 'Ligação Personalizada',
          strength: 2,
          color: LINK_COLORS.custom.color,
          pulseOffset: idx * 25
        });
      }
    });

    const connCounts: Record<string, number> = {};
    links.forEach(l => {
      connCounts[l.sourceId] = (connCounts[l.sourceId] || 0) + 1;
      connCounts[l.targetId] = (connCounts[l.targetId] || 0) + 1;
    });

    const layoutPositions = calculateLayoutPositions(combinedCards, layoutMode, connCounts);

    // Card Miniature Proportions: Aspect ratio 1 : 1.4 (TCG standard)
    const nodes: NeuralNode[] = combinedCards.map((item) => {
      const isHero = item.card.type === 'Herói';
      
      // Card width & height in exact card ratio (~1:1.4)
      const width = isHero ? 62 : 54;
      const height = isHero ? 87 : 76;
      const radius = Math.hypot(width, height) / 2; // Physics bounding radius

      const typeStyle = TYPE_COLORS[item.card.type] || TYPE_COLORS['Combatente'];
      const pos = layoutPositions.get(item.id) || { x: 0, y: 0 };

      return {
        id: item.id,
        card: item.card,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        width,
        height,
        radius,
        type: item.card.type,
        isDeck: item.isDeck,
        isHero,
        color: typeStyle.color,
        glowColor: typeStyle.glow,
        borderColor: typeStyle.border,
        connectionsCount: connCounts[item.id] || 0
      };
    });

    return { nodesData: nodes, linksData: links };
  }, [activeDeckCards, layoutMode, customLinks]);

  // Sync ref with calculated nodes
  useEffect(() => {
    nodesRef.current = nodesData;
    linksRef.current = linksData;
    simAlphaRef.current = (layoutMode === 'orbits' && isPhysicsRunning) ? 0.35 : 0;
  }, [nodesData, linksData, layoutMode, isPhysicsRunning]);

  // Physics Simulation Loop with auto-cooling stabilization (Stops cards from wandering or dancing)
  useEffect(() => {
    let pulseTime = 0;

    const tick = () => {
      pulseTime += 0.035;
      const nodes = nodesRef.current;
      const links = linksRef.current;
      const count = nodes.length;

      // Only calculate physical forces if physics is active, layout is orbits, and alpha has not cooled down to zero
      if (isPhysicsRunning && layoutMode === 'orbits' && simAlphaRef.current > 0.005) {
        const alpha = simAlphaRef.current;

        // 1. Soft anti-overlap separation (ONLY if cards actually touch / overlap)
        const minDist = 80;
        for (let i = 0; i < count; i++) {
          for (let j = i + 1; j < count; j++) {
            const a = nodes[i];
            const b = nodes[j];

            // Unconnected cards stay aligned at the top, ignore physics separation
            if (a.connectionsCount === 0 || b.connectionsCount === 0) continue;

            let dx = b.x - a.x;
            let dy = b.y - a.y;

            if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
              dx = 1;
              dy = 1;
            }

            const distSq = dx * dx + dy * dy;
            if (distSq < minDist * minDist) {
              const dist = Math.max(1, Math.sqrt(distSq));
              const overlap = (minDist - dist) / minDist;
              const push = overlap * 1.8 * alpha;
              const fx = (dx / dist) * push;
              const fy = (dy / dist) * push;

              if (Number.isFinite(fx) && Number.isFinite(fy)) {
                if (a.id !== draggedNodeId && !a.isHero && a.connectionsCount > 0) {
                  a.vx -= fx;
                  a.vy -= fy;
                }
                if (b.id !== draggedNodeId && !b.isHero && b.connectionsCount > 0) {
                  b.vx += fx;
                  b.vy += fy;
                }
              }
            }
          }
        }

        // 2. Gentle spring nudge along direct synergy links
        links.forEach(link => {
          if (!isLinkActive(link)) return;

          const a = nodes.find(n => n.id === link.sourceId);
          const b = nodes.find(n => n.id === link.targetId);
          if (!a || !b) return;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));

          const idealDist = link.type === 'same_name' ? 120 :
                            link.type === 'effect_interaction' ? 140 : 180;

          const displacement = dist - idealDist;
          const springForce = displacement * 0.003 * (link.strength || 1) * alpha;

          const fx = (dx / dist) * springForce;
          const fy = (dy / dist) * springForce;

          if (Number.isFinite(fx) && Number.isFinite(fy)) {
            if (a.id !== draggedNodeId && !a.isHero && a.connectionsCount > 0) {
              a.vx += fx;
              a.vy += fy;
            }
            if (b.id !== draggedNodeId && !b.isHero && b.connectionsCount > 0) {
              b.vx += fx;
              b.vy += fy;
            }
          }
        });

        // 3. Boundary containment (keeps cards bounded so they never drift off-screen)
        const maxBoundRadius = Math.max(380, Math.sqrt(count) * 62);

        // Find the lowest point (max Y) of the unconnected cards zone to ensure a strict barrier
        let maxUnconnectedBottomY = -Infinity;
        nodes.forEach(n => {
          if (n.connectionsCount === 0 && !n.isHero) {
            const cardBottom = n.y + n.height / 2 + 30;
            if (cardBottom > maxUnconnectedBottomY) maxUnconnectedBottomY = cardBottom;
          }
        });

        nodes.forEach(node => {
          if (node.id === draggedNodeId || node.isHero) return;

          // Unconnected cards stay firmly aligned at the top
          if (node.connectionsCount === 0) {
            node.vx = 0;
            node.vy = 0;
            return;
          }

          // REQUISITO: "Na linha de cartas sem ligação. deve ficar somente as cartas sem ligação"
          // Impede estritamente que cartas com conexões subam até a linha/zona de cartas sem ligação
          const barrierY = maxUnconnectedBottomY !== -Infinity ? Math.max(-130, maxUnconnectedBottomY + 50) : -130;
          if (node.y < barrierY) {
            node.y = barrierY;
            if (node.vy < 0) node.vy = 0;
          }

          const distFromOrigin = Math.hypot(node.x, node.y);
          if (distFromOrigin > maxBoundRadius) {
            const pull = (distFromOrigin - maxBoundRadius) * 0.04 * alpha;
            node.vx -= (node.x / distFromOrigin) * pull;
            node.vy -= (node.y / distFromOrigin) * pull;
          }

          // High damping so movement comes to a crisp halt
          node.vx *= 0.72;
          node.vy *= 0.72;

          if (Math.abs(node.vx) < 0.02) node.vx = 0;
          if (Math.abs(node.vy) < 0.02) node.vy = 0;

          if (Number.isFinite(node.vx)) node.x += node.vx;
          else node.vx = 0;

          if (Number.isFinite(node.vy)) node.y += node.vy;
          else node.vy = 0;

          if (!Number.isFinite(node.x)) node.x = 0;
          if (!Number.isFinite(node.y)) node.y = 0;

          // Garantir que após aplicar vy a carta ligada continue estritamente abaixo da zona de cartas sem ligação
          if (node.y < barrierY) {
            node.y = barrierY;
            node.vy = 0;
          }
        });

        // Smoothly decay energy to zero
        simAlphaRef.current *= 0.92;
      } else {
        // Simulation cooled or disabled: strictly zero velocities so cards NEVER walk or drift!
        nodes.forEach(node => {
          node.vx = 0;
          node.vy = 0;
        });
      }

      renderCanvas(pulseTime);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPhysicsRunning, layoutMode, draggedNodeId, activeLinkFilters, camera, hoveredNodeId, selectedNodeId, activeFilter]);

  // Main Canvas Render with High-DPI (Retina) support for sharp numbers and names
  const renderCanvas = (pulseTime: number = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;

    ctx.save();
    // Clear whole buffer
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply DPR scale first
    ctx.scale(dpr, dpr);

    // High quality text and image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Safe camera parameters
    const safeZoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
    const safeCamX = Number.isFinite(camera.x) ? camera.x : 0;
    const safeCamY = Number.isFinite(camera.y) ? camera.y : 0;

    // Center camera in CSS coordinates
    ctx.translate(cssWidth / 2 + safeCamX, cssHeight / 2 + safeCamY);
    ctx.scale(safeZoom, safeZoom);

    // Draw Subtle Cybernetic / Cosmic Grid
    drawGrid(ctx);

    const nodes = nodesRef.current;
    const links = linksRef.current;
    const focusNodeId = hoveredNodeId || selectedNodeId;

    const connectedNodeIds = new Set<string>();
    if (focusNodeId) {
      connectedNodeIds.add(focusNodeId);
      links.forEach(l => {
        if (!isLinkActive(l)) return;
        if (l.sourceId === focusNodeId) connectedNodeIds.add(l.targetId);
        if (l.targetId === focusNodeId) connectedNodeIds.add(l.sourceId);
      });
    }

    // Filter matching logic for visualization
    const doesNodeMatchActiveFilter = (node: NeuralNode): boolean => {
      if (activeFilter === 'Todos') return true;
      if (activeFilter === 'Combatente') return node.type === 'Combatente';
      if (activeFilter === 'Herói') return node.type === 'Herói';
      if (activeFilter === 'Equipamento') return node.type === 'Equipamento';
      if (activeFilter === 'Efeito') return node.type === 'Efeito';
      if (activeFilter === 'Arquétipos') {
        return links.some(l => l.type === 'same_archetype' && isLinkActive(l) && (l.sourceId === node.id || l.targetId === node.id));
      }
      if (activeFilter === 'Nome') {
        return links.some(l => l.type === 'same_name' && isLinkActive(l) && (l.sourceId === node.id || l.targetId === node.id));
      }
      return true;
    };

    // Draw header and demarcation line for unconnected cards if present
    const unconnectedNodes = nodes.filter(n => n.connectionsCount === 0 && !n.isHero);
    if (unconnectedNodes.length > 0) {
      let minUnconnectedY = 0;
      let maxUnconnectedY = -Infinity;
      let minUnconnectedX = Infinity;
      let maxUnconnectedX = -Infinity;

      unconnectedNodes.forEach(n => {
        if (n.y < minUnconnectedY) minUnconnectedY = n.y;
        if (n.y > maxUnconnectedY) maxUnconnectedY = n.y;
        if (n.x < minUnconnectedX) minUnconnectedX = n.x;
        if (n.x > maxUnconnectedX) maxUnconnectedX = n.x;
      });

      const headerY = minUnconnectedY - 48;
      const dividerY = maxUnconnectedY + 46;
      const lineWidth = Math.max(600, (maxUnconnectedX - minUnconnectedX) + 160);

      ctx.save();
      // Label
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = 'bold 11px monospace, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`— CARTAS SEM LIGAÇÃO (${unconnectedNodes.length}) —`, 0, headerY);

      // Subtle horizontal divider line separating unconnected cards from connected cards below
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;
      ctx.moveTo(-lineWidth / 2, dividerY);
      ctx.lineTo(lineWidth / 2, dividerY);
      ctx.stroke();
      ctx.restore();
    }

    // 1. Draw Links
    links.forEach(link => {
      if (!isLinkActive(link)) return;

      const a = nodes.find(n => n.id === link.sourceId);
      const b = nodes.find(n => n.id === link.targetId);
      if (!a || !b || !Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) return;

      const isConnectedToFocus = focusNodeId 
        ? (link.sourceId === focusNodeId || link.targetId === focusNodeId)
        : true;

      // Filter modulation
      let filterAlpha = 1;
      if (activeFilter === 'Arquétipos') {
        filterAlpha = link.type === 'same_archetype' ? 1 : 0.12;
      } else if (activeFilter === 'Nome') {
        filterAlpha = link.type === 'same_name' ? 1 : 0.12;
      } else if (activeFilter !== 'Todos') {
        const aMatch = doesNodeMatchActiveFilter(a);
        const bMatch = doesNodeMatchActiveFilter(b);
        filterAlpha = (aMatch && bMatch) ? 1 : ((aMatch || bMatch) ? 0.35 : 0.08);
      }

      const alpha = (focusNodeId 
        ? (isConnectedToFocus ? 0.95 : 0.08)
        : (link.type === 'same_collection' ? 0.25 : 0.65)) * filterAlpha;

      const lineWidth = isConnectedToFocus && focusNodeId ? 3.0 : 1.5;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = link.color;
      ctx.lineWidth = lineWidth;

      if (isConnectedToFocus && focusNodeId) {
        ctx.shadowColor = link.color;
        ctx.shadowBlur = 12;
      }

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // Synapse glowing energy pulse traveling along the link
      if (isConnectedToFocus && filterAlpha > 0.3) {
        const pulseProgress = ((pulseTime * 0.8 + link.pulseOffset) % 10) / 10;
        const px = a.x + (b.x - a.x) * pulseProgress;
        const py = a.y + (b.y - a.y) * pulseProgress;

        if (Number.isFinite(px) && Number.isFinite(py)) {
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = link.color;
          ctx.shadowBlur = 9;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    });

    // Linha divisória sutil para a zona de cartas sem ligação direta
    const hasUnconnected = nodes.some(n => n.connectionsCount === 0 && !n.isHero);
    if (hasUnconnected) {
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(-600, -180);
      ctx.lineTo(600, -180);
      ctx.stroke();

      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('CARTAS SEM LIGAÇÃO DIRETA', 0, -188);
      ctx.restore();
    }

    // 2. Draw Nodes as Card Miniatures (Proporção correta de carta TCG)
    nodes.forEach(node => {
      if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return;

      const isFocused = node.id === focusNodeId;
      const isConnected = !focusNodeId || connectedNodeIds.has(node.id);
      const isFilterMatch = doesNodeMatchActiveFilter(node);
      const nodeAlpha = (isConnected ? 1 : 0.25) * (isFilterMatch ? 1 : 0.2);

      const cardW = Number.isFinite(node.width) && node.width > 0 ? node.width : 54;
      const cardH = Number.isFinite(node.height) && node.height > 0 ? node.height : 76;
      const cardX = node.x - cardW / 2;
      const cardY = node.y - cardH / 2;
      const cornerR = 5;

      if (!Number.isFinite(cardX) || !Number.isFinite(cardY)) return;

      ctx.save();
      ctx.globalAlpha = nodeAlpha;

      // Glow halo when focused or Hero
      if (isFocused || node.isHero) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX - 5, cardY - 5, cardW + 10, cardH + 10, cornerR + 3);
        ctx.fillStyle = node.glowColor;
        ctx.shadowColor = node.color;
        ctx.shadowBlur = isFocused ? 26 : 14;
        ctx.fill();
        ctx.restore();
      }

      // Card Body Background
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, cornerR);
      ctx.fillStyle = '#0a0e17';
      ctx.fill();

      // Card Image (in correct card aspect ratio)
      const cachedImg = node.card.imageUrl ? imageCacheRef.current.get(node.card.imageUrl) : null;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cardX + 1.5, cardY + 1.5, cardW - 3, cardH - 3, cornerR - 1);
      ctx.clip();

      if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
        ctx.drawImage(cachedImg, cardX, cardY, cardW, cardH);
        
        // Subtle gradient shading at bottom for text contrast
        const gradTop = cardY + cardH * 0.4;
        const gradBottom = cardY + cardH;
        if (Number.isFinite(cardX) && Number.isFinite(gradTop) && Number.isFinite(gradBottom)) {
          try {
            const grad = ctx.createLinearGradient(cardX, gradTop, cardX, gradBottom);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(10,14,23,0.85)');
            ctx.fillStyle = grad;
            ctx.fillRect(cardX, cardY, cardW, cardH);
          } catch {
            ctx.fillStyle = 'rgba(10,14,23,0.6)';
            ctx.fillRect(cardX, gradTop, cardW, cardH * 0.6);
          }
        }
      } else {
        // Fallback card illustration with stylized background
        ctx.fillStyle = '#111827';
        ctx.fillRect(cardX, cardY, cardW, cardH);

        ctx.fillStyle = node.color;
        ctx.font = `bold 18px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initial = ((node.card?.name || '?').charAt(0) || '?').toUpperCase();
        ctx.fillText(initial, node.x, node.y - 2);

        if (node.type !== 'Efeito' && node.type !== 'Equipamento') {
          ctx.font = `9px sans-serif`;
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(node.type, node.x, node.y + 14);
        }
      }
      ctx.restore();

      // Card Border Outlines: Color by Card Type
      // Herói = vermelho (#ef4444), Combatente = azul (#3b82f6), Equipamento = verde (#10b981), Efeito = roxo (#a855f7)
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, cornerR);
      ctx.lineWidth = isFocused ? 3.5 : (node.isHero ? 2.8 : 2.0);
      ctx.strokeStyle = isFocused ? '#ffffff' : node.borderColor;
      ctx.stroke();

      // Hero Crown Indicator 👑
      if (node.isHero) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = `bold 13px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('👑', node.x, cardY - 7);
      }

      // 3. STATS OVERLAYS ON CARD MINIATURE:
      // (a) Custo de Tempo (CT) Badge - Top Left
      const ctVal = node.card.ct ?? 0;
      const badgeW = 20;
      const badgeH = 14;
      const badgeX = cardX + 2.5;
      const badgeY = cardY + 2.5;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#eab308';
      ctx.stroke();

      // High-resolution CT number
      ctx.fillStyle = '#fef08a';
      ctx.font = `bold 10px monospace, "Courier New", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${ctVal}`, badgeX + badgeW / 2, badgeY + badgeH / 2);

      // (b) Ataque e Vida (ATK & DEF) Badges at Bottom - only for Herói / Combatente
      // REQUISITO: "Remova a escrita 'EFEITO' e 'equipamento' das cartas no mapa neural, deixe somente custo nelas"
      const isCombatType = node.card.type === 'Herói' || node.card.type === 'Combatente';
      const hasCombatStats = isCombatType && node.card.attack !== undefined && node.card.defense !== undefined;

      if (hasCombatStats) {
        const statH = 13;
        const statY = cardY + cardH - statH - 2.5;

        // Ataque (Bottom Left - Red Badge)
        const atkW = 24;
        const atkX = cardX + 2.5;

        ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
        ctx.beginPath();
        ctx.roundRect(atkX, statY, atkW, statH, 3);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#fca5a5';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 9px monospace, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`⚔${node.card.attack}`, atkX + atkW / 2, statY + statH / 2);

        // Vida / Defesa (Bottom Right - Blue/Green Badge)
        const defW = 24;
        const defX = cardX + cardW - defW - 2.5;

        ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
        ctx.beginPath();
        ctx.roundRect(defX, statY, defW, statH, 3);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#86efac';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 9px monospace, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🛡${node.card.defense}`, defX + defW / 2, statY + statH / 2);
      }

      // (c) Card Name Pill Label (Crystal Clear High Resolution)
      const name = node.card?.name || 'Carta';
      const shortName = name.length > 20 ? name.slice(0, 18) + '…' : name;
      
      ctx.font = `bold ${isFocused ? '11px' : '10px'} -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const textMetrics = ctx.measureText(shortName);
      const pillWidth = Math.max(cardW + 12, textMetrics.width + 14);
      const pillHeight = 18;
      const pillX = node.x - pillWidth / 2;
      const pillY = cardY + cardH + 5;

      ctx.fillStyle = isFocused ? 'rgba(30, 41, 59, 0.98)' : 'rgba(10, 15, 29, 0.92)';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 9);
      ctx.fill();

      ctx.strokeStyle = isFocused ? node.color : 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = isFocused ? '#ffffff' : '#f1f5f9';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(shortName, node.x, pillY + pillHeight / 2);

      ctx.restore();
    });

    ctx.restore();
  };

  // Draw cybernetic cosmic grid
  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.lineWidth = 1;
    const gridSize = 70;
    const range = 2000;

    for (let x = -range; x <= range; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, -range);
      ctx.lineTo(x, range);
      ctx.stroke();
    }
    for (let y = -range; y <= range; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(-range, y);
      ctx.lineTo(range, y);
      ctx.stroke();
    }

    // Origin point
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
    ctx.fill();
    ctx.restore();
  };

  // Resize canvas with devicePixelRatio for maximum sharpness
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      renderCanvas();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Convert client coordinates to simulation coordinates
  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
    const camX = Number.isFinite(camera.x) ? camera.x : 0;
    const camY = Number.isFinite(camera.y) ? camera.y : 0;

    const simX = (screenX - (rect.width / 2 + camX)) / zoom;
    const simY = (screenY - (rect.height / 2 + camY)) / zoom;
    return { 
      x: Number.isFinite(simX) ? simX : 0, 
      y: Number.isFinite(simY) ? simY : 0 
    };
  }, [camera]);

  // Find node under mouse (testing against card rectangle bounds)
  const getNodeAtCoords = useCallback((simX: number, simY: number) => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const halfW = node.width / 2;
      const halfH = node.height / 2;

      // Check card miniature rectangle + name pill below
      const inX = simX >= node.x - halfW - 6 && simX <= node.x + halfW + 6;
      const inY = simY >= node.y - halfH - 6 && simY <= node.y + halfH + 26;

      if (inX && inY) {
        return node;
      }
    }
    return null;
  }, []);

  // Mouse / Touch Event Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    const { x: simX, y: simY } = getCanvasCoords(e.clientX, e.clientY);
    const clickedNode = getNodeAtCoords(simX, simY);

    if (clickedNode) {
      if (isLinkingMode && linkingSourceNodeId) {
        if (clickedNode.id !== linkingSourceNodeId) {
          // Criar ligação customizada entre as duas cartas
          const newLinkId = `custom-${linkingSourceNodeId}-${clickedNode.id}-${Date.now()}`;
          setCustomLinks(prev => {
            const exists = prev.some(
              l => (l.sourceId === linkingSourceNodeId && l.targetId === clickedNode.id) ||
                   (l.sourceId === clickedNode.id && l.targetId === linkingSourceNodeId)
            );
            if (exists) return prev;
            return [...prev, { id: newLinkId, sourceId: linkingSourceNodeId, targetId: clickedNode.id, label: 'Ligação Personalizada' }];
          });
          setIsLinkingMode(false);
          setLinkingSourceNodeId(null);
          setSelectedNodeId(clickedNode.id);
          return;
        } else {
          // Clicou na mesma carta, cancela modo de ligação
          setIsLinkingMode(false);
          setLinkingSourceNodeId(null);
          return;
        }
      }

      setDraggedNodeId(clickedNode.id);
      setSelectedNodeId(clickedNode.id);
    } else {
      if (isLinkingMode) {
        setIsLinkingMode(false);
        setLinkingSourceNodeId(null);
      }
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - camera.x, y: e.clientY - camera.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x: simX, y: simY } = getCanvasCoords(e.clientX, e.clientY);

    if (draggedNodeId) {
      const node = nodesRef.current.find(n => n.id === draggedNodeId);
      if (node && Number.isFinite(simX) && Number.isFinite(simY)) {
        node.x = simX;
        node.y = simY;
        node.vx = 0;
        node.vy = 0;
      }
    } else if (isDraggingCanvas) {
      setCamera(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }));
    } else {
      const hovered = getNodeAtCoords(simX, simY);
      setHoveredNodeId(hovered ? hovered.id : null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const clickDist = Math.hypot(e.clientX - mouseDownPosRef.current.x, e.clientY - mouseDownPosRef.current.y);
    const clickDuration = Date.now() - mouseDownPosRef.current.time;

    // REQUISITO: "adicione tambem opção de adicionar carta clicando em areas vazias do mapa"
    if (!draggedNodeId && clickDist < 6 && clickDuration < 350) {
      const { x: simX, y: simY } = getCanvasCoords(e.clientX, e.clientY);
      const clickedNode = getNodeAtCoords(simX, simY);
      if (!clickedNode && !isLinkingMode) {
        setQuickAddModal({ isOpen: true, x: e.clientX, y: e.clientY });
      }
    }

    setDraggedNodeId(null);
    setIsDraggingCanvas(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    setCamera(prev => ({
      ...prev,
      zoom: Math.min(2.5, Math.max(0.35, prev.zoom * zoomFactor))
    }));
  };

  const handleZoom = (direction: 'in' | 'out') => {
    setCamera(prev => ({
      ...prev,
      zoom: Math.min(2.5, Math.max(0.35, prev.zoom * (direction === 'in' ? 1.25 : 0.8)))
    }));
  };

  const handleResetCamera = () => {
    setCamera({ x: 0, y: 0, zoom: 1 });
  };

  // Fit all cards cleanly into view on screen with comfortable padding
  const handleFitToScreen = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.length === 0) {
      setCamera({ x: 0, y: 0, zoom: 1 });
      return;
    }

    const canvas = canvasRef.current;
    const width = canvas ? canvas.clientWidth : 800;
    const height = canvas ? canvas.clientHeight : 600;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x - n.width / 2);
      maxX = Math.max(maxX, n.x + n.width / 2);
      minY = Math.min(minY, n.y - n.height / 2);
      maxY = Math.max(maxY, n.y + n.height / 2);
    });

    const graphWidth = Math.max(120, maxX - minX + 160);
    const graphHeight = Math.max(120, maxY - minY + 160);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const scaleX = width / graphWidth;
    const scaleY = height / graphHeight;
    const fitZoom = Math.min(1.6, Math.max(0.35, Math.min(scaleX, scaleY)));

    setCamera({
      x: width / 2 - centerX * fitZoom,
      y: height / 2 - centerY * fitZoom,
      zoom: fitZoom
    });
  }, []);

  // Reorganize and reset positions according to layoutMode
  const handleReorganize = useCallback(() => {
    const combinedCards = [
      ...deck.map((card, i) => ({ card, id: `deck-${card.id || card.name}-${i}`, isDeck: true })),
      ...sideDeck.map((card, i) => ({ card, id: `side-${card.id || card.name}-${i}`, isDeck: false }))
    ];
    const connCounts: Record<string, number> = {};
    linksRef.current.forEach(l => {
      connCounts[l.sourceId] = (connCounts[l.sourceId] || 0) + 1;
      connCounts[l.targetId] = (connCounts[l.targetId] || 0) + 1;
    });
    const newPos = calculateLayoutPositions(combinedCards, layoutMode, connCounts);
    nodesRef.current.forEach(n => {
      const p = newPos.get(n.id);
      if (p) {
        n.x = p.x;
        n.y = p.y;
      }
      n.vx = 0;
      n.vy = 0;
    });
    simAlphaRef.current = (layoutMode === 'orbits' && isPhysicsRunning) ? 0.35 : 0;
    setTimeout(() => {
      handleFitToScreen();
    }, 50);
  }, [deck, sideDeck, layoutMode, isPhysicsRunning, handleFitToScreen]);

  // Automatically fit cards onto screen when cards change or layout changes
  useEffect(() => {
    const timer = setTimeout(() => {
      handleFitToScreen();
    }, 100);
    return () => clearTimeout(timer);
  }, [deck.length, layoutMode, handleFitToScreen]);

  // Selected card details
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodesRef.current.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId]);

  // Synergies connected to selected node
  const selectedNodeSynergies = useMemo(() => {
    if (!selectedNodeId) return [];
    const connected: { link: NeuralLink; otherNode: NeuralNode; reason: string }[] = [];

    linksRef.current.forEach(link => {
      let otherId: string | null = null;
      if (link.sourceId === selectedNodeId) otherId = link.targetId;
      else if (link.targetId === selectedNodeId) otherId = link.sourceId;

      if (otherId) {
        const otherNode = nodesRef.current.find(n => n.id === otherId);
        if (otherNode) {
          connected.push({
            link,
            otherNode,
            reason: link.label
          });
        }
      }
    });

    return connected;
  }, [selectedNodeId]);

  // Deck synergy metrics
  const synergyStats = useMemo(() => {
    const totalNodes = activeDeckCards.length;
    const links = linksData.filter(isLinkActive);
    const totalLinks = links.length;
    const sameNameCount = linksData.filter(l => l.type === 'same_name').length;
    const effectCount = linksData.filter(l => l.type === 'effect_interaction').length;
    const archCount = linksData.filter(l => l.type === 'same_archetype' && (selectedArchetypeLinkFilter === 'Todos' || l.archetype === selectedArchetypeLinkFilter)).length;

    const cohesionIndex = Math.min(100, Math.round((totalLinks / Math.max(1, totalNodes * 1.5)) * 100));

    return { totalNodes, totalLinks, sameNameCount, effectCount, archCount, cohesionIndex };
  }, [activeDeckCards, linksData, isLinkActive, selectedArchetypeLinkFilter]);

  // Filtered cards for Quick Add modal
  const filteredQuickAddCards = useMemo(() => {
    const search = quickAddSearch.toLowerCase().trim();
    return allCards.filter(c => {
      if (quickAddTypeFilter !== 'Todos' && c.type !== quickAddTypeFilter) return false;
      if (search) {
        const matchName = (c.name || '').toLowerCase().includes(search);
        const matchDesc = (c.description || '').toLowerCase().includes(search);
        const matchArch = (c.archetype || '').toLowerCase().includes(search);
        const matchCode = (c.code || '').toLowerCase().includes(search);
        return matchName || matchDesc || matchArch || matchCode;
      }
      return true;
    }).sort((a, b) => compareCardCodes(a.code, b.code));
  }, [allCards, quickAddSearch, quickAddTypeFilter]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#07090e] overflow-hidden flex select-none">
      
      {/* Background canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* TOP CONTROLS: Line 1 (Metrics & Link Types) and Line 2 (Filtros) */}
      <div className="absolute top-3 left-3 right-3 flex flex-col gap-2 pointer-events-none z-10">
        
        {/* LINHA 1: Quantidade de cartas / Sinapses / Nome / Interação / Arquétipo (Todos) / Coleção / Sugerir cartas */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/95 backdrop-blur-md p-1.5 px-3 rounded-xl border border-slate-700/60 shadow-xl pointer-events-auto flex-wrap text-xs">
          {/* Título / Identificador */}
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs md:text-sm mr-1">
            <Network size={17} className="text-cyan-400 shrink-0" />
            <span className="hidden sm:inline">Mapa Neural</span>
          </div>

          <span className="text-slate-600 hidden sm:inline">|</span>

          {/* Quantidade de Cartas */}
          <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/50">
            <span className="font-mono text-cyan-300 font-bold">{synergyStats.totalNodes}</span>
            <span className="text-slate-400 text-[11px]">Cartas</span>
          </div>

          {/* Sinapses */}
          <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/50">
            <span className="font-mono text-purple-400 font-bold">{synergyStats.totalLinks}</span>
            <span className="text-slate-400 text-[11px]">Sinapses</span>
          </div>

          <span className="text-slate-600">|</span>

          {/* Mesmo Nome */}
          <button
            onClick={() => setActiveLinkFilters(f => ({ ...f, same_name: !f.same_name }))}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeLinkFilters.same_name 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                : 'text-slate-500 hover:text-slate-300 bg-slate-800/40'
            }`}
            title="Conexões entre variantes do mesmo personagem/nome"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Nome ({synergyStats.sameNameCount})
          </button>

          {/* Interação */}
          <button
            onClick={() => setActiveLinkFilters(f => ({ ...f, effect_interaction: !f.effect_interaction }))}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeLinkFilters.effect_interaction 
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                : 'text-slate-500 hover:text-slate-300 bg-slate-800/40'
            }`}
            title="Conexões de cartas que mencionam ou ativam efeitos mútuos"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Interação ({synergyStats.effectCount})
          </button>

          {/* Arquétipo com seletor Todos */}
          <div className="flex items-center gap-1 bg-purple-950/40 p-0.5 rounded-lg border border-purple-500/30">
            <button
              onClick={() => setActiveLinkFilters(f => ({ ...f, same_archetype: !f.same_archetype }))}
              className={`px-2 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                activeLinkFilters.same_archetype 
                  ? 'bg-purple-500/30 text-purple-300' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Conexões de cartas do mesmo arquétipo"
            >
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              Arquétipo ({synergyStats.archCount})
            </button>

            {activeLinkFilters.same_archetype && availableLinkArchetypes.length > 0 && (
              <select
                value={selectedArchetypeLinkFilter}
                onChange={(e) => setSelectedArchetypeLinkFilter(e.target.value)}
                className="bg-purple-900/90 hover:bg-purple-800 text-purple-200 border border-purple-400/50 rounded text-[11px] font-semibold py-0.5 px-1.5 outline-none cursor-pointer"
                title="Filtrar conexões de arquétipos por arquétipo específico"
              >
                <option value="Todos">Todos ({availableLinkArchetypes.length})</option>
                {availableLinkArchetypes.map(arch => {
                  const count = linksData.filter(l => l.type === 'same_archetype' && l.archetype === arch).length;
                  return (
                    <option key={arch} value={arch}>{arch} {count > 0 ? `(${count})` : ''}</option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Coleção */}
          <button
            onClick={() => setActiveLinkFilters(f => ({ ...f, same_collection: !f.same_collection }))}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeLinkFilters.same_collection 
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' 
                : 'text-slate-500 hover:text-slate-300 bg-slate-800/40'
            }`}
            title="Conexões de cartas da mesma coleção"
          >
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            Coleção
          </button>

          {/* Sugerir Cartas */}
          <button
            onClick={() => setShowSuggestionsDrawer(prev => !prev)}
            className={`ml-auto px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-md ${
              showSuggestionsDrawer 
                ? 'bg-emerald-600 text-white border border-emerald-400' 
                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-900/90'
            }`}
            title="Ver lista de cartas sugeridas com alta sinergia para adicionar ao deck"
          >
            <Sparkles size={14} className={showSuggestionsDrawer ? 'text-white animate-spin' : 'text-emerald-400'} />
            <span>Sugerir Cartas</span>
            {suggestedSynergyCards.length > 0 && (
              <span className="ml-0.5 bg-emerald-800 text-emerald-100 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {suggestedSynergyCards.length}
              </span>
            )}
          </button>
        </div>

        {/* LINHA 2: Filtros */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-xl pointer-events-auto flex-wrap w-fit">
          <span className="text-[11px] font-bold text-slate-400 px-2 uppercase tracking-wider">Filtros:</span>
          {NEURAL_FILTERS.map(f => {
            const isActive = activeFilter === f;
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 shadow-sm shadow-cyan-950'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent'
                }`}
              >
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {/* FLOATING CAMERA & SIMULATION CONTROLS */}
      <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2 z-10">
        {/* Layout Modes */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-2xl">
          <button
            onClick={() => setLayoutMode('orbits')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              layoutMode === 'orbits'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Organização em Órbitas (Herói ao centro com anéis de sinergia)"
          >
            <Orbit size={14} />
            <span>Órbitas</span>
          </button>
          <button
            onClick={() => setLayoutMode('grid')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              layoutMode === 'grid'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Organização em Grade (Todas as cartas alinhadas e visíveis)"
          >
            <LayoutGrid size={14} />
            <span>Grade</span>
          </button>
          <button
            onClick={() => setLayoutMode('types')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              layoutMode === 'types'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Organização em Colunas por Tipo (Herói, Combatente, Equipamento...)"
          >
            <Columns3 size={14} />
            <span>Por Tipo</span>
          </button>
        </div>

        {/* Viewport & Lock Controls */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-2xl">
          <button
            onClick={handleFitToScreen}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-cyan-300 hover:text-white hover:bg-cyan-950/40 rounded-lg transition"
            title="Enquadrar todas as cartas na tela"
          >
            <Maximize2 size={14} />
            <span>Enquadrar</span>
          </button>
          <div className="w-px h-4 bg-slate-700 mx-0.5"></div>
          <button
            onClick={() => handleZoom('in')}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Aumentar Zoom"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => handleZoom('out')}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Diminuir Zoom"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={handleReorganize}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Resetar e Reorganizar Posições"
          >
            <RotateCcw size={16} />
          </button>
          <div className="w-px h-4 bg-slate-700 mx-0.5"></div>
          <button
            onClick={() => {
              setIsPhysicsRunning(p => {
                const next = !p;
                if (next) simAlphaRef.current = 0.35;
                return next;
              });
            }}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
              !isPhysicsRunning 
                ? 'bg-amber-950/70 text-amber-300 border border-amber-800/50' 
                : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
            }`}
            title={isPhysicsRunning ? 'Física ativa (clique para fixar cartas)' : 'Cartas fixadas (clique para ativar física)'}
          >
            {!isPhysicsRunning ? <Lock size={13} /> : <Unlock size={13} />}
            <span>{!isPhysicsRunning ? 'Fixas' : 'Física'}</span>
          </button>
        </div>
      </div>

      {/* LINKING MODE FLOATING BANNER (REQUISITO: "fazer ligação customizadas") */}
      {isLinkingMode && linkingSourceNodeId && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 bg-emerald-950/95 border border-emerald-500/70 text-emerald-200 px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-pulse">
          <Link2 size={18} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">
            Clique na carta que deseja conectar com <strong>{nodesRef.current.find(n => n.id === linkingSourceNodeId)?.card.name || 'a carta selecionada'}</strong>
          </span>
          <button
            onClick={() => {
              setIsLinkingMode(false);
              setLinkingSourceNodeId(null);
            }}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-md border border-slate-600 transition"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* EMPTY DECK GUIDANCE BANNER - DECKS ESTRUTURAIS (REQUISITO: "quando abre sem ter codigo de deck, em vez de sugestões aleatórias, sugira os decks estruturais") */}
      {deck.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center p-4 z-20 pointer-events-none">
          <div className="bg-slate-900/95 border border-purple-800/60 p-5 md:p-6 rounded-2xl max-w-xl w-full shadow-2xl backdrop-blur-xl pointer-events-auto max-h-[85vh] flex flex-col">
            <div className="text-center mb-3">
              <div className="w-12 h-12 rounded-full bg-purple-950/80 border border-purple-500/40 flex items-center justify-center mx-auto mb-2 text-purple-400">
                <Network size={26} />
              </div>
              <h3 className="text-lg font-bold text-white mb-0.5">Decks Estruturais</h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
                Seu deck está vazio. Carregue um dos decks estruturais temáticos para testar as conexões neurais instantaneamente:
              </p>
            </div>

            <div className="overflow-y-auto space-y-2 pr-1 flex-1 max-h-72">
              {STRUCTURAL_DECKS.map((stDeck) => (
                <button
                  key={stDeck.id}
                  onClick={() => onLoadSampleDeck && onLoadSampleDeck(stDeck.id)}
                  className="w-full text-left bg-slate-800/70 hover:bg-slate-700/80 border border-slate-700 hover:border-purple-500/50 p-2.5 rounded-xl transition flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-xs sm:text-sm text-white group-hover:text-purple-300 transition flex items-center gap-2">
                      <Layers size={14} className="text-purple-400 shrink-0" />
                      <span className="truncate">{stDeck.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {stDeck.desc}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs bg-purple-900/60 text-purple-200 border border-purple-500/40 px-2.5 py-1 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition font-medium">
                    Carregar
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD CARD MODAL (REQUISITO: "adicionar carta clicando em areas vazias do mapa") */}
      {quickAddModal && quickAddModal.isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setQuickAddModal(null)}
        >
          <div 
            className="bg-slate-900 border border-purple-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-500/50 flex items-center justify-center text-purple-400">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Adicionar Carta ao Deck</h3>
                  <p className="text-[11px] text-slate-400">Clique para adicionar ao mapa neural</p>
                </div>
              </div>
              <button
                onClick={() => setQuickAddModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search & Type filter */}
            <div className="p-3 bg-slate-950/40 border-b border-slate-800 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={quickAddSearch}
                  onChange={(e) => setQuickAddSearch(e.target.value)}
                  placeholder="Pesquisar por nome ou efeito..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>

              <div className="flex gap-1 overflow-x-auto pb-1 text-xs">
                {['Todos', 'Combatente', 'Herói', 'Equipamento', 'Efeito'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setQuickAddTypeFilter(t)}
                    className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition whitespace-nowrap ${
                      quickAddTypeFilter === t
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Cards List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-800/40">
              {filteredQuickAddCards.slice(0, 40).map((card) => {
                const countInDeck = deck.filter(c => c.name === card.name).length;
                return (
                  <div key={card.id || card.code || card.name} className="pt-2 first:pt-0 flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-12 rounded bg-slate-950 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                        {card.imageUrl ? (
                          <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-slate-500">{(card.name || '?')[0]}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-white truncate group-hover:text-purple-300 transition">
                          {card.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className={
                            card.type === 'Herói' ? 'text-red-400' :
                            card.type === 'Combatente' ? 'text-blue-400' :
                            card.type === 'Equipamento' ? 'text-emerald-400' : 'text-purple-400'
                          }>
                            {card.type}
                          </span>
                          <span>•</span>
                          <span>CT: {card.cost ?? 0}</span>
                          {countInDeck > 0 && (
                            <span className="bg-purple-950 text-purple-300 px-1 rounded border border-purple-800">
                              {countInDeck}x no deck
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onAddToDeck(card);
                      }}
                      className="bg-purple-700 hover:bg-purple-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1 shrink-0 shadow"
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>
                );
              })}
              {filteredQuickAddCards.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Nenhuma carta encontrada com os filtros atuais.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUGGESTED CARDS LIST DRAWER (USER REQUIREMENT: Mostrar lista de cartas em vez de adicionar diretamente) */}
      {showSuggestionsDrawer && (
        <div className="absolute top-16 left-4 bottom-4 w-84 md:w-96 bg-slate-900/95 backdrop-blur-xl border border-emerald-800/50 rounded-2xl shadow-2xl flex flex-col z-30 animate-in slide-in-from-left duration-200 overflow-hidden">
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-600/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Sparkles size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-white flex items-center gap-2 truncate">
                  <span>Cartas Sugeridas</span>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/60">
                    {filteredSuggestions.length}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400 truncate">Sinergia calculada com seu deck atual</p>
              </div>
            </div>
            <button
              onClick={() => setShowSuggestionsDrawer(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Fechar sugestões"
            >
              <X size={18} />
            </button>
          </div>

          {/* Search & Filters */}
          <div className="p-3 border-b border-slate-800 bg-slate-900/60 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={suggestionSearch}
                onChange={(e) => setSuggestionSearch(e.target.value)}
                placeholder="Buscar por nome, arquétipo ou efeito..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
              {suggestionSearch && (
                <button 
                  onClick={() => setSuggestionSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filtros solicitados pelo usuário: Todos, Combatente, Heroi, Equipamento, Efeito, Arquétipos, Nome */}
            <div className="flex gap-1 overflow-x-auto pb-1 text-[11px]">
              {NEURAL_FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition ${
                    activeFilter === f
                      ? 'bg-emerald-600 text-white font-bold shadow-sm'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* List of Cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredSuggestions.length > 0 ? (
              filteredSuggestions.map(({ card, score, reasons }, idx) => {
                const typeStyle = TYPE_COLORS[card.type] || TYPE_COLORS['Combatente'];
                return (
                  <div
                    key={card.code || idx}
                    className="bg-slate-950/70 border border-slate-800/80 hover:border-emerald-500/50 rounded-xl p-3 transition flex flex-col gap-2 group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Miniature thumbnail */}
                      <div 
                        onClick={() => onInspectCard(card)}
                        className="w-12 h-16 rounded-md overflow-hidden bg-slate-900 border shrink-0 cursor-pointer shadow relative group-hover:border-emerald-400 transition"
                        style={{ borderColor: typeStyle.border }}
                      >
                        {card.imageUrl ? (
                          <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-base" style={{ color: typeStyle.color }}>
                            {(card.name || '?').charAt(0)}
                          </div>
                        )}
                        <span className="absolute top-0.5 left-0.5 bg-black/85 text-yellow-300 font-mono text-[9px] font-bold px-1 rounded">
                          {card.ct}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span 
                            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                            style={{ 
                              backgroundColor: typeStyle.bgBadge, 
                              color: typeStyle.textBadge, 
                              borderColor: typeStyle.border 
                            }}
                          >
                            {card.type}
                          </span>
                          {card.archetype && (
                            <span className="text-[9px] text-slate-400 truncate max-w-[120px]">
                              {card.archetype}
                            </span>
                          )}
                        </div>

                        <h5 
                          onClick={() => onInspectCard(card)}
                          className="text-xs font-bold text-white group-hover:text-emerald-300 transition truncate cursor-pointer"
                        >
                          {card.name}
                        </h5>

                        <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-slate-400">
                          <span className="text-yellow-400 font-bold">CT {card.ct}</span>
                          {card.attack !== undefined && card.defense !== undefined && (
                            <span>• <span className="text-red-400 font-bold">⚔{card.attack}</span> / <span className="text-emerald-400 font-bold">🛡{card.defense}</span></span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Synergy reasons */}
                    <div className="space-y-1 pt-1 border-t border-slate-900">
                      {reasons.map((r, rIdx) => (
                        <div key={rIdx} className="text-[11px] text-emerald-300/90 flex items-start gap-1.5">
                          <Sparkle size={11} className="text-emerald-400 shrink-0 mt-0.5" />
                          <span className="leading-tight">{r}</span>
                        </div>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1 mt-0.5">
                      <button
                        onClick={() => onInspectCard(card)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition flex items-center justify-center gap-1 border border-slate-700/60"
                        title="Inspecionar carta"
                      >
                        <Eye size={13} />
                        <span>Ver</span>
                      </button>

                      <button
                        onClick={() => onAddToDeck(card)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/60"
                        title="Adicionar carta ao deck"
                      >
                        <Plus size={14} />
                        <span>Adicionar ao Deck</span>
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Sparkles size={32} className="mx-auto mb-2 opacity-40 text-emerald-400" />
                <p className="text-xs font-medium">Nenhuma sugestão encontrada para os filtros atuais.</p>
                <p className="text-[11px] text-slate-600 mt-1">Adicione mais cartas ao deck para descobrir sinergias!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SELECTED CARD / SYNERGY INSPECTOR DRAWER */}
      {selectedNode && (
        <div className="absolute top-16 right-4 bottom-4 w-80 md:w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl flex flex-col z-30 animate-in slide-in-from-right duration-200 overflow-hidden">
          
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-950/60">
            <div className="flex items-center gap-3 min-w-0">
              {selectedNode.card.imageUrl ? (
                <img 
                  src={selectedNode.card.imageUrl} 
                  alt={selectedNode.card.name} 
                  className="w-12 h-16 object-cover rounded-md border shrink-0 shadow"
                  style={{ borderColor: selectedNode.borderColor }}
                />
              ) : (
                <div 
                  className="w-12 h-16 rounded-md bg-slate-950 border flex items-center justify-center font-bold text-lg shrink-0"
                  style={{ borderColor: selectedNode.borderColor, color: selectedNode.color }}
                >
                  {(selectedNode.card?.name || '?').charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <span 
                  className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1 border"
                  style={{ 
                    backgroundColor: TYPE_COLORS[selectedNode.type]?.bgBadge, 
                    color: TYPE_COLORS[selectedNode.type]?.textBadge,
                    borderColor: selectedNode.borderColor
                  }}
                >
                  {selectedNode.type}
                </span>
                <h4 className="text-sm font-bold text-white leading-tight truncate">
                  {selectedNode.card.name}
                </h4>
                <div className="flex items-center gap-2 mt-1 text-xs font-mono text-slate-400">
                  <span className="text-yellow-400 font-bold">CT {selectedNode.card.ct}</span>
                  {selectedNode.card.attack !== undefined && selectedNode.card.defense !== undefined && (
                    <span>• <span className="text-red-400">⚔{selectedNode.card.attack}</span> / <span className="text-emerald-400">🛡{selectedNode.card.defense}</span></span>
                  )}
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setSelectedNodeId(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex gap-2 flex-wrap">
            <button
              onClick={() => onInspectCard(selectedNode.card)}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-1.5 px-2.5 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow"
            >
              <Eye size={14} /> Detalhes
            </button>

            <button
              onClick={() => {
                setIsLinkingMode(true);
                setLinkingSourceNodeId(selectedNode.id);
              }}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-2.5 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow"
              title="Ligar esta carta a outra carta no mapa neural"
            >
              <Link2 size={14} /> Ligar a Outra
            </button>
            
            <button
              onClick={() => {
                const idx = deck.findIndex(c => c.name === selectedNode.card.name);
                if (idx !== -1) {
                  onRemoveFromDeck(idx);
                  setSelectedNodeId(null);
                }
              }}
              className="bg-red-950/60 hover:bg-red-900/70 border border-red-800/60 text-red-300 font-bold py-1.5 px-2.5 rounded-lg text-xs transition flex items-center justify-center gap-1.5"
              title="Remover do Deck"
            >
              <Trash2 size={14} /> Remover
            </button>
          </div>

          {/* Synergy List Section */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              <span>Sinergias Ativas no Deck</span>
              <span className="text-cyan-400 font-mono">({selectedNodeSynergies.length})</span>
            </div>

            {selectedNodeSynergies.length > 0 ? (
              <div className="space-y-2.5">
                {selectedNodeSynergies.map((item, i) => (
                  <div 
                    key={i}
                    onClick={() => setSelectedNodeId(item.otherNode.id)}
                    className="bg-slate-950/60 hover:bg-slate-800/70 border border-slate-800 hover:border-cyan-500/50 p-3 rounded-xl transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-xs text-slate-200 group-hover:text-cyan-300 transition truncate">
                        {item.otherNode.card.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          item.link.type === 'same_name' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                          item.link.type === 'effect_interaction' ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' :
                          item.link.type === 'same_archetype' ? 'bg-purple-950 text-purple-400 border border-purple-800' :
                          item.link.type === 'custom' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                          'bg-indigo-950 text-indigo-400 border border-indigo-800'
                        }`}>
                          {LINK_COLORS[item.link.type].label}
                        </span>
                        {item.link.type === 'custom' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomLinks(prev => prev.filter(l => l.id !== item.link.id));
                            }}
                            className="text-red-400 hover:text-red-300 p-1 hover:bg-red-900/40 rounded transition"
                            title="Remover ligação customizada"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {item.reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Info size={28} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">Nenhuma conexão direta ativa com os filtros atuais.</p>
              </div>
            )}
          </div>

          {/* Footer Card Description snippet */}
          <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-[11px] text-slate-400 line-clamp-3">
            {selectedNode.card.description}
          </div>
        </div>
      )}

    </div>
  );
};
