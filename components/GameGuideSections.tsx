import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Clock, Layers, Scale, Sparkles, ChevronDown, ChevronUp, 
  Info, Sword, Crown, Zap, CheckCircle, Ghost, FileText, 
  Edit2, Save, X, Plus, Trash2, AlertCircle, Eye, EyeOff, Check, Search, Grid,
  Trophy, Award, Upload, Loader2, Image as ImageIcon, Flame, Filter
} from 'lucide-react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, readBrowserCache, writeBrowserCache } from '../firebase';
import { sanitizeForFirestore, useCards } from '../CardContext';
import { GameField } from './GameField';
import { InteractionsFaqSection } from './InteractionsFaqSection';
import { ArchetypeData, TierGuideItem, RarityGuideItem } from '../types';

export const defaultRarityItems: RarityGuideItem[] = [
  // --- FRAME MODERNO (11) ---
  {
    id: 'rarity-mod-comum',
    name: 'Moderno Comum',
    frame: 'Moderno',
    badge: 'Base do Formato',
    iconUrl: '',
    description: 'A raridade fundamental do formato Moderno. Representa a espinha dorsal dos decks e combatentes essenciais para qualquer estratégia.',
    color: 'slate'
  },
  {
    id: 'rarity-mod-incomum',
    name: 'Moderno Incomum',
    frame: 'Moderno',
    badge: 'Suporte Tático',
    iconUrl: '',
    description: 'Cartas com utilidade estratégica intermediária, oferecendo suporte consistente e ferramentas de controle para arquétipos modernos.',
    color: 'emerald'
  },
  {
    id: 'rarity-mod-rara',
    name: 'Moderno Rara',
    frame: 'Moderno',
    badge: 'Alto Impacto',
    iconUrl: '',
    description: 'Cartas com impacto elevado e habilidades singulares, fundamentais para a curva de poder dos decks competitivos.',
    color: 'blue'
  },
  {
    id: 'rarity-mod-muito-rara',
    name: 'Moderno Muito Rara',
    frame: 'Moderno',
    badge: 'Efeito Decisivo',
    iconUrl: '',
    description: 'Combatentes e cartas de efeito com grande capacidade de alterar o ritmo do jogo e criar viradas táticas impressionantes.',
    color: 'purple'
  },
  {
    id: 'rarity-mod-super-rara',
    name: 'Moderno Super Rara',
    frame: 'Moderno',
    badge: 'Potência Superior',
    iconUrl: '',
    description: 'Cartas de prestígio superior, combinando grande poder em campo com acabamento refinado e alta procura competitiva.',
    color: 'indigo'
  },
  {
    id: 'rarity-mod-lendaria',
    name: 'Moderno Lendária',
    frame: 'Moderno',
    badge: 'Lenda do Macroverso',
    iconUrl: '',
    description: 'Heróis e cartas lendárias de grande relevância na história do jogo, possuindo mecânicas de alto impacto nos duelos.',
    color: 'amber'
  },
  {
    id: 'rarity-mod-super-lendaria',
    name: 'Moderno Super Lendária',
    frame: 'Moderno',
    badge: 'Poder Máximo',
    iconUrl: '',
    description: 'As lendas mais imponentes e poderosas do Macroverso moderno, com habilidades extraordinárias e presença dominante.',
    color: 'yellow'
  },
  {
    id: 'rarity-mod-exclusiva',
    name: 'Moderno Exclusiva',
    frame: 'Moderno',
    badge: 'Edição Especial',
    iconUrl: '',
    description: 'Versões e artes exclusivas de tiragem selecionada, distribuídas em produtos especiais e expansões de destaque.',
    color: 'cyan'
  },
  {
    id: 'rarity-mod-super-exclusiva',
    name: 'Moderno Super Exclusiva',
    frame: 'Moderno',
    badge: 'Item de Colecionador',
    iconUrl: '',
    description: 'Cartas extremamente cobiçadas com tratamentos visuais nobres e disponibilidade restrita para colecionadores exigentes.',
    color: 'pink'
  },
  {
    id: 'rarity-mod-limitada',
    name: 'Moderno Limitada',
    frame: 'Moderno',
    badge: 'Tiragem Limitada',
    iconUrl: '',
    description: 'Cartas com tiragem rigorosamente limitada e numerada, criadas para eventos marcantes e comemorações especiais.',
    color: 'rose'
  },
  {
    id: 'rarity-mod-macroversal',
    name: 'Moderno Macroversal',
    frame: 'Moderno',
    badge: 'Tiragem Única • 1 por Ano',
    iconUrl: '',
    description: 'A raridade suprema do jogo. Possui tiragem única absoluta: sai apenas 1 carta por ano em todo o mundo. A joia máxima do Light Dark TCG.',
    color: 'amber',
    isUniquePerYear: true
  },

  // --- FRAME LEGADO (6) ---
  {
    id: 'rarity-leg-comum',
    name: 'Legado Comum',
    frame: 'Legado',
    badge: 'Fundação Clássica',
    iconUrl: '',
    description: 'A base clássica da era inicial (2025). As cartas que deram início à história e às primeiras batalhas do Macroverso.',
    color: 'slate'
  },
  {
    id: 'rarity-leg-incomum',
    name: 'Legado Incomum',
    frame: 'Legado',
    badge: 'Tática Histórica',
    iconUrl: '',
    description: 'Cartas táticas da era original de Light Dark, fornecendo recursos e mecânicas clássicas de grande nostalgia.',
    color: 'emerald'
  },
  {
    id: 'rarity-leg-rara',
    name: 'Legado Rara',
    frame: 'Legado',
    badge: 'Raridade Clássica',
    iconUrl: '',
    description: 'Cartas raras dos primeiros boosters e coleções clássicas, preservando a essência e o design icônico do Frame Legado.',
    color: 'blue'
  },
  {
    id: 'rarity-leg-muito-rara',
    name: 'Legado Muito Rara',
    frame: 'Legado',
    badge: 'Grande Prestígio',
    iconUrl: '',
    description: 'Poderosas cartas da primeira era de difícil obtenção, reverenciadas pelos veteranos e colecionadores do formato clássico.',
    color: 'purple'
  },
  {
    id: 'rarity-leg-lendaria',
    name: 'Legado Lendária',
    frame: 'Legado',
    badge: 'Lendas da Origem',
    iconUrl: '',
    description: 'Os Heróis e monstros lendários que moldaram a primeira era do Macroverso, com artes e molduras clássicas inconfundíveis.',
    color: 'amber'
  },
  {
    id: 'rarity-leg-limitada',
    name: 'Legado Limitada',
    frame: 'Legado',
    badge: 'Tiragem Histórica',
    iconUrl: '',
    description: 'Tiragens limitadas e especiais de eventos clássicos de 2025, altamente protegidas e valorizadas na comunidade.',
    color: 'rose'
  }
];

export const defaultTierItems = defaultRarityItems;

export interface PatchNoteItem {
  id?: string;
  title: string;
  description: string;
  example?: string;
}

export interface GameManualData {
  patchTitle: string;
  patchDate: string;
  noveltyMessage: string;
  isNoveltyActive: boolean;
  patchNotes: PatchNoteItem[];
  
  basico: {
    deckRules: string[];
    statusItems: Array<{ label: string; text: string; iconType: string }>;
    structureObjective: string;
    structureDuel: string;
    structureRounds: string;
    structureStart: string;
    structureMulligan: string;
    firstRoundNote: string;
  };

  cartas: {
    structureTitle?: string;
    structureItems: Array<{ label: string; text: string; color?: string }>;
    combatenteText: string;
    heroiText: string;
    equipamentoText: string;
    efeitoText: string;
  };

  turnos: {
    roundOverview: string;
    phases: Array<{ step: string; title: string; description: string; color: string }>;
    combatRules: string[];
  };

  regras: {
    chainsText: string;
    chainsPriorityText: string;
    deckOutText: string;
    observations: string[];
  };

  lastUpdated?: string;
}

export const defaultManualData: GameManualData = {
  patchTitle: 'Patch Atual - Balanceamento & Regras Oficiais',
  patchDate: '24/10/2026',
  noveltyMessage: 'Novas diretrizes de Dano Primordial, Correntes e Limite de Reações atualizadas!',
  isNoveltyActive: true,
  patchNotes: [
    {
      title: '1. Reações Limitadas',
      description: 'Apenas uma carta de reação a uma ação (desde que tenha mana suficiente).'
    },
    {
      title: '2. Correntes Inquebráveis',
      description: 'Não é permitido quebrar a corrente de efeitos de cartas após ser iniciada.'
    },
    {
      title: '3. Ordem de Autoridade',
      description: 'Efeitos com "A Qualquer Momento" (exceto Macroversal) > Dano Primordial > Arquétipo > Efeitos de começo de rodada > Efeitos de começo de turno > Efeitos normais (efeitos condicionais não se aplicam nessa ordem e devem seguir suas condições).',
      example: 'Exemplo: se a carta causar 5 de dano no começo da rodada, e tiver um Conceito, ele recupera as 5 de vida antes.'
    },
    {
      title: '4. Remoção de Alvo',
      description: 'Remover um alvo de um ataque durante o combate nega o ataque do atacante; ele não poderá atacar novamente nesse mesmo turno.'
    },
    {
      title: '5. Invocação de Heróis',
      description: 'Heróis só podem ser invocados por outras cartas de invocação caso não possuam condições de invocação próprias na carta de herói. Nesses casos, deve-se cumprir estritamente a condição de invocação.'
    },
    {
      title: '6. Dano Primordial',
      description: 'O Dano Primordial se aplica a todas as cartas do jogador inimigo (Deck, mão ou Zonas) e deve ser aplicado quando o Herói ou Combatente é invocado, reduzindo sua vida. Caso ela seja zerada, a carta é enviada diretamente à Zona Morta, ignorando arquétipos e efeitos de campo. Se não morrer, entra em campo com vida reduzida. Cartas mortas pelo Dano Primordial não disparam efeitos de campo nem de eliminação em combate.'
    },
    {
      title: '7. Equipamentos no Inimigo',
      description: 'Equipamentos podem ser colocados no campo inimigo equipando um combatente dele (exceto se a própria carta especificar o contrário).'
    },
    {
      title: '8. Sinergia de Heróis',
      description: 'Heróis cujo efeito interaja diretamente com outro herói que possua nome diferente podem ser colocados no mesmo deck (exemplo: Otto e Asmonious).'
    },
    {
      title: '9. Efeitos em Combate',
      description: 'Somente efeitos de combatentes condicionais ou com "A Qualquer Momento" podem ser usados durante o combate.',
      example: 'Ex: "Durante o combate esse combatente recebe 8 de ataque" ou "A qualquer momento, retire 3 de ataque deste combatente e remova uma carta".'
    },
    {
      title: '10. Invocação Negada',
      description: 'Quando um Herói (do tipo que se invoca pelo próprio efeito) tem sua invocação negada, ele fica impossibilitado de ser invocado novamente até a rodada seguinte.'
    },
    {
      title: '11. Resoluções Automáticas',
      description: 'Não é possível responder a cartas que não foram ativadas por escolha do jogador (exemplo: resolução automática disparada por ação inimiga).'
    },
    {
      title: '12. Efeitos Negados e Invocações',
      description: 'Cartas com "nega o efeito de carta" não podem negar invocação. Combatentes com efeitos negados perdem todos os efeitos em campo. Cartas com "nega uma carta usada" podem ser usadas para negar invocações.'
    }
  ],

  basico: {
    deckRules: [
      'Deck Composto por 30 a 35 cartas (contando com os heróis, se houver).',
      'Não é permitido cartas repetidas em todo o deck.',
      'O uso de Herói é opcional, mas se usar, apenas 1 Herói e suas variações no Deck (com exceções para heróis que interagem entre si).',
      'Opcionais: Campo físico, marcadores de status/vida/mana e dados D6/D20 para efeitos.'
    ],
    statusItems: [
      { label: 'Vida Padrão', text: '20 pontos. Se chegar a 0, você perde o duelo.', iconType: 'heart' },
      { label: 'Mana Padrão', text: '12 pontos por rodada. Se renova no começo de cada rodada.', iconType: 'droplet' },
      { label: 'Runas & Recursos', text: 'Recursos especiais gerados para ativação de efeitos poderosos.', iconType: 'sparkles' }
    ],
    structureObjective: 'Reduzir a vida do oponente a 0.',
    structureDuel: 'Melhor de 3 jogos (1x1 ou 2x2 cooperativo).',
    structureRounds: 'Cada rodada possui 2 turnos (Ataque e Defesa) para cada jogador alternadamente.',
    structureStart: 'Pedra, Papel e Tesoura ou rolagem de Dado para decidir quem começa atacando.',
    structureMulligan: 'Ambos os jogadores compram 5 cartas. Cada um pode retornar todas e comprar 5 novas uma única vez.',
    firstRoundNote: 'Nota de Equilíbrio: Na primeira rodada completa de abertura, nenhum combatente causa dano de combate direto.'
  },

  cartas: {
    structureTitle: 'Anatomia & Estrutura das Cartas',
    structureItems: [
      { label: 'Categoria (CT)', text: 'Custo em Cristais de Mana para invocação ou uso da carta.', color: 'text-amber-400' },
      { label: 'Status', text: 'Ataque (Dano físico/mágico) e Vida (apenas Combatentes e Heróis).', color: 'text-white' },
      { label: 'Arquétipo', text: 'Afiliações e títulos que concedem habilidades sinérgicas extras.', color: 'text-purple-400' },
      { label: 'Tipo', text: 'Ícone identificador e moldura cromática correspondente.', color: 'text-blue-400' }
    ],
    combatenteText: 'Os "monstros" comuns e auxiliares de cada deck. Não são classificados como Heróis a não ser por efeitos únicos. Lutam na linha de frente e atacam os inimigos.',
    heroiText: 'Foco principal do deck. Inicialmente ficam fora do deck principal, em sua Zona de Herói dedicada, necessitando de condições específicas para serem invocados. Limite de 1 Herói em campo por jogador (salvo exceções).',
    equipamentoText: 'Alteram status, adicionam arquétipos ou concedem habilidades únicas ao combatente equipado. Ficam vinculados ao alvo até que ele saia de campo. Caso o herói seja substituído, o equipamento é herdado pelo novo herói.',
    efeitoText: 'Cartas de intervenção imediata, feitiços de uso único ou contínuos que alteram o rumo do jogo. Possuem custo em Mana e condições de ativação. Ao terminarem, são enviadas à Zona Morta.'
  },

  turnos: {
    roundOverview: 'O jogo opera em formato dinâmico de Ação e Reação. Sempre que o jogador atacante realiza uma jogada, o defensor tem direito imediato à Reação com suas cartas disponíveis. Declarar ataque consome a ação de combate. Todas as cartas usadas consomem Mana de acordo com sua Categoria (CT).',
    phases: [
      { step: '1', title: 'Início de Rodada', description: 'Ambos os jogadores recuperam Mana para 12. Cada jogador compra 1 carta. Efeitos contínuos de início de rodada ativam em prioridade.', color: 'border-purple-500 bg-purple-500/10' },
      { step: '2', title: 'Turno de Ataque (Jogador 1)', description: 'Jogador 1 gasta Mana em cartas -> Declara Ataques -> Jogador 2 Reage com cartas -> Resolução de combate -> J1 Encerra seu turno.', color: 'border-blue-500 bg-blue-500/10' },
      { step: '3', title: 'Turno de Ataque (Jogador 2)', description: 'Jogador 2 gasta Mana em cartas -> Declara Ataques -> Jogador 1 Reage com cartas -> Resolução de combate -> J2 Encerra seu turno.', color: 'border-red-500 bg-red-500/10' },
      { step: '4', title: 'Fim da Rodada', description: 'Efeitos de fim de rodada encerram. Se nenhum jogador foi derrotado, inicia-se uma nova rodada e os 12 Cristais de Mana são renovados.', color: 'border-emerald-500 bg-emerald-500/10' }
    ],
    combatRules: [
      'Em seu turno de ataque, o jogador pode declarar ataques contra alvos válidos.',
      'Cada combatente em campo pode atacar 1 vez por rodada por padrão (exceto por efeitos de ataque duplo).',
      'Alvos Primários: Combatentes ou Heróis na linha de frente inimiga.',
      'Ataque Direto ao Jogador: Permitido apenas se o campo inimigo estiver desprovido de combatentes e heróis ativos.',
      'Cálculo de Combate: O Atacante aplica seu ATAQUE contra a VIDA atual do alvo. O alvo deduz sua vida no montante equivalente ao dano.',
      'Morte por Combate: Quando a vida de um combatente atinge 0, ele é enviado imediatamente à Zona Morta.',
      'Múltiplos Ataques: Um mesmo combatente inimigo pode ser alvo concentrado de vários ataques no mesmo turno.',
      'Invocação Pós-Ataque: Combatentes invocados após o início da fase de ataque não podem atacar na mesma rodada (exceto Heróis com invocação rápida).'
    ]
  },

  regras: {
    chainsText: 'Sequência de cartas jogadas em resposta umas às outras. A ordem de resolução obedece à regra LIFO (Last In, First Out — a última carta jogada resolve primeiro). A Reação resolve antes da Ação inicial.',
    chainsPriorityText: 'Se duas cartas possuírem exatamente o mesmo gatilho temporal, a Categoria (CT) determina a precedência: cartas de CT maior têm prioridade de ativação sobre cartas de menor custo.',
    deckOutText: 'Caso o deck principal de um jogador chegue ao fim (0 cartas), ele NÃO é derrotado instantaneamente. Em vez disso, sempre que tiver a obrigação de comprar uma carta e seu deck estiver vazio, ele perde 3 pontos de Vida diretamente.',
    observations: [
      'O uso de Herói é opcional, mas caso utilize, o limite máximo é de 1 Herói no deck (salvo cartas com texto que autorizem interação mútua).',
      'Vida reduzida a 0 nem sempre decreta o fim de jogo imediato caso existam cartas ou efeitos de imortalidade/ressurreição em campo.',
      'Sempre que uma carta for buscada, selecionada ou retornada ao Deck, este deve ser obrigatoriamente reembaralhado.',
      'Heróis destruídos ou devolvidos retornam para a Zona do Deck de Heróis, e jamais para o Deck Principal.',
      'Tanto a Vida (20) quanto a Mana (12) podem ultrapassar seus limites iniciais por meio de bônus e feitiços.',
      'Arquétipos especiais como Lúmen e Darkus possuem linhagens de evolução ativadas por cartas específicas.',
      'Não existe limite máximo para cartas acumuladas na mão do jogador.'
    ]
  }
};

interface GameGuideSectionsProps {
  archetypes: ArchetypeData[];
  onSelectArchetype?: (name: string) => void;
  isAdmin: boolean;
  onOpenArchetypeModal?: (archetype: ArchetypeData) => void;
  ArchetypeCardComponent: React.ComponentType<any>;
  cardTypesShowcase?: React.ReactNode;
}

export const GameGuideSections: React.FC<GameGuideSectionsProps> = ({
  archetypes,
  onSelectArchetype,
  isAdmin,
  ArchetypeCardComponent,
  cardTypesShowcase
}) => {
  const [data, setData] = useState<GameManualData>(() => readBrowserCache<GameManualData>('ld_cache_gameManual_v2') || defaultManualData);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [archetypeSearch, setArchetypeSearch] = useState('');

  // Collapsible state for each of the 8 sections
  // 1: PATCH ATUAL, 2: BASICO, 3: CARTAS, 4: TURNOS, 5: REGRAS, 6: ARQUÉTIPOS, 7: CAMPOS, 8: RARIDADES
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    patch: true,
    basico: false,
    cartas: false,
    turnos: false,
    regras: false,
    arquetipos: true,
    campos: false,
    raridades: true,
    faq: false
  });

  // Raridades data & state (Frame Moderno & Frame Legado)
  const [rarityItems, setRarityItems] = useState<RarityGuideItem[]>(() => readBrowserCache<RarityGuideItem[]>('ld_cache_rarities_v2') || defaultRarityItems);
  const [selectedRarityFrame, setSelectedRarityFrame] = useState<'all' | 'Moderno' | 'Legado'>('all');
  const [isEditingRarities, setIsEditingRarities] = useState(false);
  const [uploadingRarityId, setUploadingRarityId] = useState<string | null>(null);
  const [isSavingRarities, setIsSavingRarities] = useState(false);
  const [rarityFeedback, setRarityFeedback] = useState<string | null>(null);

  // Arquétipos editor state inside Manual
  const { saveArchetype } = useCards();
  const [editingArchetype, setEditingArchetype] = useState<{
    isCreating: boolean;
    name: string;
    imageUrl: string;
    description: string;
    patchDate: string;
    isNew: boolean;
  } | null>(null);
  const [isUploadingArchetypeIcon, setIsUploadingArchetypeIcon] = useState(false);
  const [isSavingArchetype, setIsSavingArchetype] = useState(false);
  const [archetypeFeedback, setArchetypeFeedback] = useState<string | null>(null);

  const handleUploadArchetypeIcon = async (file: File) => {
    if (!file || !editingArchetype) return;
    try {
      setIsUploadingArchetypeIcon(true);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileRef = ref(storage, `archetype_icons/${Date.now()}_${safeName}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      setEditingArchetype(prev => prev ? { ...prev, imageUrl: url } : null);
      setArchetypeFeedback('Ícone do arquétipo enviado com sucesso!');
      setTimeout(() => setArchetypeFeedback(null), 3500);
    } catch (err) {
      console.error('Erro ao enviar ícone do arquétipo:', err);
      alert('Erro ao enviar o ícone. Tente novamente.');
    } finally {
      setIsUploadingArchetypeIcon(false);
    }
  };

  const handleSaveArchetypeForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArchetype || !editingArchetype.name.trim()) return;
    try {
      setIsSavingArchetype(true);
      await saveArchetype({
        name: editingArchetype.name.trim(),
        imageUrl: editingArchetype.imageUrl.trim(),
        description: editingArchetype.description,
        patchDate: editingArchetype.patchDate.trim() || new Date().toLocaleDateString('pt-BR'),
        isNew: editingArchetype.isNew
      });
      setArchetypeFeedback(`Arquétipo "${editingArchetype.name.trim()}" salvo com sucesso!`);
      setEditingArchetype(null);
      setTimeout(() => setArchetypeFeedback(null), 3500);
    } catch (err) {
      console.error('Erro ao salvar arquétipo:', err);
      alert('Erro ao salvar arquétipo.');
    } finally {
      setIsSavingArchetype(false);
    }
  };

  const handleToggleArchetypeNew = async (arch: ArchetypeData) => {
    try {
      await saveArchetype({
        name: arch.name,
        imageUrl: arch.imageUrl || '',
        description: arch.description || '',
        patchDate: arch.patchDate || new Date().toLocaleDateString('pt-BR'),
        isNew: !arch.isNew
      });
      setArchetypeFeedback(
        !arch.isNew
          ? `"${arch.name}" marcado como NOVO!`
          : `Selo Novo removido de "${arch.name}".`
      );
      setTimeout(() => setArchetypeFeedback(null), 3000);
    } catch (err) {
      console.error('Erro ao alternar status Novo do arquétipo:', err);
    }
  };

  // Listen to Firestore real-time doc for game manual
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'homeSettings', 'gameManual'), (snap) => {
      if (snap.exists()) {
        const remoteData = snap.data() as Partial<GameManualData>;
        const nextManual: GameManualData = {
          ...defaultManualData,
          ...remoteData,
          patchNotes: remoteData.patchNotes && remoteData.patchNotes.length > 0 
            ? remoteData.patchNotes 
            : defaultManualData.patchNotes,
          basico: { ...defaultManualData.basico, ...(remoteData.basico || {}) },
          cartas: { 
            ...defaultManualData.cartas, 
            ...(remoteData.cartas || {}),
            structureTitle: remoteData.cartas?.structureTitle || defaultManualData.cartas.structureTitle || 'Anatomia & Estrutura das Cartas',
            structureItems: (remoteData.cartas?.structureItems && remoteData.cartas.structureItems.length > 0)
              ? remoteData.cartas.structureItems
              : defaultManualData.cartas.structureItems
          },
          turnos: { ...defaultManualData.turnos, ...(remoteData.turnos || {}) },
          regras: { ...defaultManualData.regras, ...(remoteData.regras || {}) }
        };
        setData(nextManual);
        writeBrowserCache('ld_cache_gameManual_v2', nextManual);
      }
      setIsLoading(false);
    }, (err) => {
      console.warn('Erro ao carregar manual do Firestore, usando padrões:', err);
      setIsLoading(false);
    });

    // Real-time listener for Raridades
    const unsubRarities = onSnapshot(doc(db, 'homeSettings', 'raritySettings'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (Array.isArray(d.items) && d.items.length > 0) {
          setRarityItems(d.items);
          writeBrowserCache('ld_cache_rarities_v2', d.items);
          return;
        }
      }
      // Check legacy tierSettings if raritySettings is empty
      getDoc(doc(db, 'homeSettings', 'tierSettings')).then(tierSnap => {
        if (tierSnap.exists()) {
          const td = tierSnap.data();
          if (Array.isArray(td.items) && Array.isArray(td.items) && td.items.length > 0) {
            setRarityItems(td.items);
            writeBrowserCache('ld_cache_rarities_v2', td.items);
          }
        }
      }).catch(() => {});
    }, (err) => {
      console.warn('Erro ao carregar raridades do Firestore:', err);
    });

    return () => {
      unsub();
      unsubRarities();
    };
  }, []);

  const handleUploadRarityIcon = async (rarityId: string, file: File) => {
    if (!file) return;
    try {
      setUploadingRarityId(rarityId);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileRef = ref(storage, `rarity_icons/${rarityId}_${Date.now()}_${safeName}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      
      const updated = rarityItems.map(r => r.id === rarityId ? { ...r, iconUrl: url } : r);
      setRarityItems(updated);
      
      const payload = sanitizeForFirestore({
        items: updated,
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'homeSettings', 'raritySettings'), payload, { merge: true });
      await setDoc(doc(db, 'homeSettings', 'tierSettings'), payload, { merge: true });
      
      setRarityFeedback('Ícone PNG da raridade anexado e salvo com sucesso!');
      setTimeout(() => setRarityFeedback(null), 3500);
    } catch (err) {
      console.error('Erro ao anexar ícone da raridade:', err);
      alert('Erro ao anexar o ícone PNG. Tente novamente.');
    } finally {
      setUploadingRarityId(null);
    }
  };

  const handleSaveRarities = async (itemsToSave: RarityGuideItem[]) => {
    try {
      setIsSavingRarities(true);
      const payload = sanitizeForFirestore({
        items: itemsToSave,
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'homeSettings', 'raritySettings'), payload, { merge: true });
      await setDoc(doc(db, 'homeSettings', 'tierSettings'), payload, { merge: true });
      
      setRarityFeedback('Raridades das Cartas salvas com sucesso!');
      setIsEditingRarities(false);
      setTimeout(() => setRarityFeedback(null), 3500);
    } catch (err) {
      console.error('Erro ao salvar raridades:', err);
      alert('Erro ao salvar as configurações de raridades.');
    } finally {
      setIsSavingRarities(false);
    }
  };

  const handleResetDefaultRarities = async () => {
    if (!window.confirm('Deseja restaurar todas as 17 raridades oficiais padrão (11 Moderno + 6 Legado)?')) return;
    try {
      setIsSavingRarities(true);
      setRarityItems(defaultRarityItems);
      const payload = sanitizeForFirestore({
        items: defaultRarityItems,
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'homeSettings', 'raritySettings'), payload, { merge: true });
      await setDoc(doc(db, 'homeSettings', 'tierSettings'), payload, { merge: true });
      setRarityFeedback('17 Raridades Oficiais restauradas com sucesso!');
      setIsEditingRarities(false);
      setTimeout(() => setRarityFeedback(null), 3500);
    } catch (err) {
      console.error('Erro ao restaurar raridades padrão:', err);
    } finally {
      setIsSavingRarities(false);
    }
  };

  const handleAddRarity = () => {
    const nextNum = rarityItems.length + 1;
    const newRarity: RarityGuideItem = {
      id: `rarity-${Date.now()}`,
      name: `Nova Raridade ${nextNum}`,
      frame: 'Moderno',
      badge: 'Nova Classificação',
      iconUrl: '',
      description: 'Breve explicação sobre as características visuais, prestígio e tiragem desta raridade no jogo.',
      color: 'slate'
    };
    setRarityItems(prev => [...prev, newRarity]);
  };

  const handleDeleteRarity = (id: string) => {
    if (rarityItems.length <= 1) {
      alert('É necessário manter pelo menos uma raridade cadastrada.');
      return;
    }
    setRarityItems(prev => prev.filter(r => r.id !== id));
  };

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    setOpenSections({
      patch: true,
      basico: true,
      cartas: true,
      turnos: true,
      regras: true,
      arquetipos: true,
      campos: true,
      raridades: true,
      faq: true
    });
  };

  const collapseAll = () => {
    setOpenSections({
      patch: false,
      basico: false,
      cartas: false,
      turnos: false,
      regras: false,
      arquetipos: false,
      campos: false,
      raridades: false,
      faq: false
    });
  };

  const filteredArchetypes = archetypes.filter(arch => 
    arch.name.toLowerCase().includes(archetypeSearch.toLowerCase()) ||
    (arch.description && arch.description.toLowerCase().includes(archetypeSearch.toLowerCase()))
  );

  return (
    <section id="manual-regras" className="py-16 md:py-24 bg-[#0a0a0c] relative border-b border-purple-900/20 text-slate-200">
      <div className="container mx-auto px-4 sm:px-6 max-w-5xl">

        {/* Novelty Alert Banner (Mensagem de novidade com a data do patch) */}
        {data.isNoveltyActive && (
          <div className="mb-10 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-950/80 via-indigo-950/70 to-slate-900/90 border border-purple-500/40 shadow-xl shadow-purple-950/30 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-44 h-44 bg-purple-600/20 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-purple-600/30 border border-purple-400/40 text-purple-300 shrink-0 mt-0.5 md:mt-0 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                  <Sparkles size={22} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[11px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/50">
                      Novidade do Patch
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/50 border border-amber-600/40 px-2 py-0.5 rounded">
                      {data.patchDate || 'Patch Recente'}
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-white leading-tight">
                    {data.noveltyMessage || 'O jogo foi atualizado com novos esclarecimentos e regras de combate!'}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                <button
                  onClick={() => {
                    setOpenSections(prev => ({ ...prev, patch: true }));
                    const el = document.getElementById('section-patch');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-900/40 transition active:scale-95 flex items-center gap-1.5"
                >
                  <Eye size={14} /> Ver Patch Notes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-purple-400 mb-2">
              <BookOpen size={15} /> Compêndio Geral do Jogador
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight flex flex-wrap items-center gap-3">
              <span>MANUAL E REGRAS</span>
              <span className="text-amber-400 text-lg sm:text-2xl font-mono">
                (PATCH ATUAL: {data.patchDate || 'Atual'})
              </span>
            </h2>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Consulte todas as diretrizes oficiais de jogo, fases de turno, regras avançadas, arquétipos e layout do campo em seções retráteis.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={expandAll}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
            >
              Expandir Todos
            </button>
            <button
              onClick={collapseAll}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
            >
              Recolher Todos
            </button>
            
            {isAdmin && (
              <button
                onClick={() => setIsEditorOpen(true)}
                className="text-xs font-bold px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30 transition flex items-center gap-1.5 active:scale-95"
                title="Editar todas as seções e patch do manual"
              >
                <Edit2 size={13} /> Editar Manual
              </button>
            )}
          </div>
        </div>

        {/* Accordion Sections Ordered:
            1. PATCH ATUAL
            2. BASICO
            3. CARTAS
            4. TURNOS
            5. REGRAS
            6. ARQUÉTIPOS
            7. CAMPOS
        */}
        <div className="space-y-4">

          {/* 1. PATCH ATUAL */}
          <div id="section-patch" className="rounded-2xl border border-amber-600/30 bg-gradient-to-b from-amber-950/20 to-slate-950 overflow-hidden shadow-lg shadow-black/40 transition-all">
            <button
              onClick={() => toggleSection('patch')}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-amber-950/30 transition group"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                  <Scale size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                      Seção 01
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Data: {data.patchDate || 'Atual'}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-amber-300 transition-colors tracking-wide">
                    PATCH ATUAL
                  </h3>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-slate-300 group-hover:text-white shrink-0 ml-2">
                {openSections.patch ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {openSections.patch && (
              <div className="p-4 sm:p-6 border-t border-amber-500/20 bg-slate-950/90 space-y-6 animate-in slide-in-from-top-2 duration-200">
                <div className="bg-gradient-to-r from-amber-950/30 to-slate-900/50 p-4 rounded-xl border border-amber-700/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                      <Sparkles size={18} className="text-amber-400" />
                      {data.patchTitle}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                      Diretrizes oficiais vigentes e esclarecimento de interações no formato competitivo e casual.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-400 block font-mono">Última Revisão:</span>
                    <span className="text-sm font-bold font-mono text-amber-400">{data.patchDate}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {data.patchNotes.map((note, idx) => (
                    <div 
                      key={idx} 
                      className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 hover:border-amber-600/40 transition hover:bg-slate-900/90"
                    >
                      <h5 className="font-bold text-amber-400 text-sm mb-1.5 flex items-start gap-2">
                        <span>{note.title}</span>
                      </h5>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed text-justify">
                        {note.description}
                      </p>
                      {note.example && (
                        <div className="mt-2 text-xs italic text-slate-400 bg-black/40 p-2 rounded border border-slate-800/80">
                          {note.example}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* TIPOS DE CARTAS (SLIDESHOW) */}
          {cardTypesShowcase}

          {/* 2. BASICO */}
          <div id="section-basico" className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg shadow-black/40 transition-all hover:border-slate-700">
            <button
              onClick={() => toggleSection('basico')}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-900/50 transition group"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
                  <Info size={20} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-mono font-bold text-purple-400 uppercase tracking-wider block">
                    Seção 02
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-purple-300 transition-colors tracking-wide">
                    BÁSICO
                  </h3>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/60 text-slate-300 group-hover:text-white shrink-0 ml-2">
                {openSections.basico ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {openSections.basico && (
              <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/90 space-y-6 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* O que é preciso */}
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                    <h4 className="text-base sm:text-lg font-bold text-purple-400 mb-3 flex items-center gap-2">
                      <CheckCircle size={18} /> Construção & Requisitos do Deck
                    </h4>
                    <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                      {data.basico.deckRules.map((rule, idx) => (
                        <li key={idx} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-purple-400 font-bold shrink-0 mt-0.5">•</span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Status do Jogo */}
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                    <h4 className="text-base sm:text-lg font-bold text-blue-400 mb-3 flex items-center gap-2">
                      <Info size={18} /> Status Essenciais do Jogo
                    </h4>
                    <div className="space-y-3">
                      {data.basico.statusItems.map((item, idx) => (
                        <div key={idx} className="bg-black/30 p-3 rounded-lg border border-slate-800/80">
                          <strong className="block text-white text-xs sm:text-sm mb-0.5">{item.label}</strong>
                          <span className="text-xs text-slate-400 leading-relaxed">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Estrutura do Duelo */}
                <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                  <h4 className="text-base sm:text-lg font-bold text-white mb-4">
                    Estrutura & Dinâmica da Partida
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm text-slate-300">
                    <div className="space-y-2">
                      <p><strong className="text-purple-400">Objetivo da Vitória:</strong> {data.basico.structureObjective}</p>
                      <p><strong className="text-purple-400">Formato:</strong> {data.basico.structureDuel}</p>
                      <p><strong className="text-purple-400">Rodadas:</strong> {data.basico.structureRounds}</p>
                    </div>
                    <div className="space-y-2">
                      <p><strong className="text-purple-400">Início de Jogo:</strong> {data.basico.structureStart}</p>
                      <p><strong className="text-purple-400">Regra de Mulligan:</strong> {data.basico.structureMulligan}</p>
                      <p className="text-yellow-400/90 italic font-medium pt-1 border-t border-slate-800/80">
                        {data.basico.firstRoundNote}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. CARTAS */}
          <div id="section-cartas" className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg shadow-black/40 transition-all hover:border-slate-700">
            <button
              onClick={() => toggleSection('cartas')}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-900/50 transition group"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                  <Layers size={20} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider block">
                    Seção 03
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-blue-300 transition-colors tracking-wide">
                    CARTAS
                  </h3>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/60 text-slate-300 group-hover:text-white shrink-0 ml-2">
                {openSections.cartas ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {openSections.cartas && (
              <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/90 space-y-6 animate-in slide-in-from-top-2 duration-200">
                {/* Anatomia da Carta */}
                <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                  <h4 className="text-base sm:text-lg font-bold text-white mb-3">
                    {data.cartas.structureTitle || 'Anatomia & Estrutura das Cartas'}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    {(data.cartas.structureItems || defaultManualData.cartas.structureItems).map((item, idx) => (
                      <div key={idx} className="p-3 bg-black/40 rounded-lg border border-slate-800">
                        <strong className={`block ${item.color || 'text-amber-400'} mb-1 font-bold`}>{item.label}</strong>
                        <span className="text-slate-300 leading-snug">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4 Categorias */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Combatente */}
                  <div className="bg-slate-900/60 p-4 rounded-xl border-l-4 border-blue-500 border-t border-r border-b border-slate-800 flex gap-3.5">
                    <div className="p-2.5 rounded-lg bg-blue-950/50 text-blue-400 border border-blue-800/40 shrink-0 h-fit">
                      <Sword size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-bold text-blue-400 text-base">Combatente</h5>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/50">MOLDURA AZUL</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed text-justify">
                        {data.cartas.combatenteText}
                      </p>
                    </div>
                  </div>

                  {/* Herói */}
                  <div className="bg-slate-900/60 p-4 rounded-xl border-l-4 border-red-500 border-t border-r border-b border-slate-800 flex gap-3.5">
                    <div className="p-2.5 rounded-lg bg-red-950/50 text-red-400 border border-red-800/40 shrink-0 h-fit">
                      <Crown size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-bold text-red-400 text-base">Herói</h5>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800/50">MOLDURA VERMELHA</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed text-justify">
                        {data.cartas.heroiText}
                      </p>
                    </div>
                  </div>

                  {/* Equipamento */}
                  <div className="bg-slate-900/60 p-4 rounded-xl border-l-4 border-green-500 border-t border-r border-b border-slate-800 flex gap-3.5">
                    <div className="p-2.5 rounded-lg bg-green-950/50 text-green-400 border border-green-800/40 shrink-0 h-fit">
                      <Scale size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-bold text-green-400 text-base">Equipamento</h5>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-green-950 text-green-300 border border-green-800/50">MOLDURA VERDE</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed text-justify">
                        {data.cartas.equipamentoText}
                      </p>
                    </div>
                  </div>

                  {/* Efeito */}
                  <div className="bg-slate-900/60 p-4 rounded-xl border-l-4 border-purple-500 border-t border-r border-b border-slate-800 flex gap-3.5">
                    <div className="p-2.5 rounded-lg bg-purple-950/50 text-purple-400 border border-purple-800/40 shrink-0 h-fit">
                      <Zap size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h5 className="font-bold text-purple-400 text-base">Efeito</h5>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/50">MOLDURA ROXA</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed text-justify">
                        {data.cartas.efeitoText}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. TURNOS */}
          <div id="section-turnos" className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg shadow-black/40 transition-all hover:border-slate-700">
            <button
              onClick={() => toggleSection('turnos')}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-900/50 transition group"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                  <Clock size={20} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider block">
                    Seção 04
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-red-300 transition-colors tracking-wide">
                    TURNOS
                  </h3>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/60 text-slate-300 group-hover:text-white shrink-0 ml-2">
                {openSections.turnos ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {openSections.turnos && (
              <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/90 space-y-6 animate-in slide-in-from-top-2 duration-200">
                <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                  <h4 className="text-base sm:text-lg font-bold text-white mb-2">Estrutura da Rodada: Ação e Reação</h4>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                    {data.turnos.roundOverview}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {data.turnos.phases.map((phase, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border ${phase.color} bg-slate-950/80 flex flex-col justify-between`}>
                        <div>
                          <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-xs font-black text-white mb-2 border border-slate-700">
                            {phase.step}
                          </div>
                          <h5 className="font-bold text-white text-sm mb-1.5">{phase.title}</h5>
                          <p className="text-xs text-slate-300 leading-relaxed">{phase.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                  <h4 className="text-base sm:text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
                    <Sword size={18} /> Regras & Cálculos de Combate
                  </h4>
                  <ul className="space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {data.turnos.combatRules.map((rule, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-red-400 font-bold shrink-0 mt-0.5">•</span>
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* 5. REGRAS */}
          <div id="section-regras" className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg shadow-black/40 transition-all hover:border-slate-700">
            <button
              onClick={() => toggleSection('regras')}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-900/50 transition group"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Scale size={20} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                    Seção 05
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-emerald-300 transition-colors tracking-wide">
                    REGRAS
                  </h3>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/60 text-slate-300 group-hover:text-white shrink-0 ml-2">
                {openSections.regras ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {openSections.regras && (
              <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/90 space-y-6 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Correntes */}
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                    <h4 className="text-base sm:text-lg font-bold text-yellow-400 mb-2 flex items-center gap-2">
                      <Layers size={18} /> Resolução em Corrente (Chains)
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed text-justify mb-3">
                      {data.regras.chainsText}
                    </p>
                    <div className="p-3 bg-black/40 rounded-lg border border-slate-800 text-xs text-slate-400 leading-relaxed">
                      <strong className="text-white block mb-0.5">Precedência por CT:</strong>
                      {data.regras.chainsPriorityText}
                    </div>
                  </div>

                  {/* Sem Deck */}
                  <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                    <h4 className="text-base sm:text-lg font-bold text-purple-400 mb-2 flex items-center gap-2">
                      <Ghost size={18} /> Esgotamento de Deck (Deck Out)
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed text-justify">
                      {data.regras.deckOutText}
                    </p>
                  </div>
                </div>

                {/* Observações importantes */}
                <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
                  <h4 className="text-base sm:text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <FileText size={18} /> Observações Estratégicas Fundamentais
                  </h4>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm text-slate-300">
                    {data.regras.observations.map((obs, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-black/20 p-2.5 rounded-lg border border-slate-800/80">
                        <span className="text-purple-400 font-bold shrink-0 mt-0.5">•</span>
                        <span className="leading-relaxed">{obs}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* 6. ARQUÉTIPOS */}
          <div id="section-arquetipos" className="rounded-2xl border border-purple-800/40 bg-slate-950 overflow-hidden shadow-lg shadow-black/40 transition-all hover:border-purple-600/60">
            <button
              onClick={() => toggleSection('arquetipos')}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-900/50 transition group"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
                  <Crown size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-purple-400 uppercase tracking-wider">
                      Seção 06
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/50">
                      {archetypes.length} Arquétipos Registrados
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-purple-300 transition-colors tracking-wide">
                    ARQUÉTIPOS
                  </h3>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/60 text-slate-300 group-hover:text-white shrink-0 ml-2">
                {openSections.arquetipos ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {openSections.arquetipos && (
              <div className="p-4 sm:p-6 border-t border-purple-800/30 bg-slate-950/90 space-y-6 animate-in slide-in-from-top-2 duration-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                  <div>
                    <h4 className="font-bold text-white text-base">Classificações & Linhagens</h4>
                    <p className="text-xs text-slate-400">
                      Pesquise e consulte as habilidades intrínsecas de cada classe do Macroverso.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={archetypeSearch}
                        onChange={(e) => setArchetypeSearch(e.target.value)}
                        placeholder="Filtrar arquétipo..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingArchetype({
                            isCreating: true,
                            name: '',
                            imageUrl: '',
                            description: '',
                            patchDate: new Date().toLocaleDateString('pt-BR'),
                            isNew: true
                          });
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-purple-900/40 transition whitespace-nowrap"
                      >
                        <Plus size={14} /> Novo Arquétipo
                      </button>
                    )}
                  </div>
                </div>

                {archetypeFeedback && (
                  <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                    <span>{archetypeFeedback}</span>
                  </div>
                )}

                {isAdmin && editingArchetype && (
                  <form
                    onSubmit={handleSaveArchetypeForm}
                    className="bg-slate-900/95 border-2 border-purple-500/50 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl animate-in fade-in"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <h5 className="font-black text-white text-sm sm:text-base flex items-center gap-2">
                        <Crown size={18} className="text-purple-400" />
                        {editingArchetype.isCreating ? 'Criar Novo Arquétipo' : `Editar Arquétipo: ${editingArchetype.name}`}
                      </h5>
                      <button
                        type="button"
                        onClick={() => setEditingArchetype(null)}
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Nome do Arquétipo</label>
                        <input
                          type="text"
                          required
                          disabled={!editingArchetype.isCreating}
                          value={editingArchetype.name}
                          onChange={(e) => setEditingArchetype(prev => prev ? { ...prev, name: e.target.value } : null)}
                          placeholder="Ex: Escolhido"
                          className={`w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 ${!editingArchetype.isCreating ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Data do Patch</label>
                        <input
                          type="text"
                          value={editingArchetype.patchDate}
                          onChange={(e) => setEditingArchetype(prev => prev ? { ...prev, patchDate: e.target.value } : null)}
                          placeholder="Ex: 10/09/2026"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Ícone do Arquétipo (URL ou Upload do PC)</label>
                      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                        <input
                          type="text"
                          value={editingArchetype.imageUrl}
                          onChange={(e) => setEditingArchetype(prev => prev ? { ...prev, imageUrl: e.target.value } : null)}
                          placeholder="https://..."
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                        <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition shrink-0">
                          {isUploadingArchetypeIcon ? <Loader2 size={14} className="animate-spin text-purple-400" /> : <Upload size={14} className="text-purple-400" />}
                          <span>{isUploadingArchetypeIcon ? 'Enviando...' : 'Enviar do PC'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isUploadingArchetypeIcon}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadArchetypeIcon(file);
                            }}
                          />
                        </label>
                        {editingArchetype.imageUrl && (
                          <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center p-1 shrink-0">
                            <img src={editingArchetype.imageUrl} alt="Preview" className="w-full h-full object-contain" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Descrição / Habilidade do Arquétipo</label>
                      <textarea
                        rows={4}
                        required
                        value={editingArchetype.description}
                        onChange={(e) => setEditingArchetype(prev => prev ? { ...prev, description: e.target.value } : null)}
                        placeholder="Descreva a regra e efeito oficial deste arquétipo..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white leading-relaxed focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none bg-emerald-950/30 border border-emerald-500/30 px-3 py-2 rounded-lg">
                        <input
                          type="checkbox"
                          checked={editingArchetype.isNew}
                          onChange={(e) => setEditingArchetype(prev => prev ? { ...prev, isNew: e.target.checked } : null)}
                          className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-0"
                        />
                        <span className="text-xs font-bold text-emerald-300">
                          Destacar com selo "NOVO" (Piscando no Manual)
                        </span>
                      </label>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingArchetype(null)}
                          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingArchetype}
                          className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-900/40 transition disabled:opacity-50"
                        >
                          <Save size={14} />
                          <span>{isSavingArchetype ? 'Salvando...' : 'Salvar Arquétipo'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                <div className="flex flex-col gap-3">
                  {filteredArchetypes.length > 0 ? (
                    filteredArchetypes.map((arch, idx) => (
                      <div key={arch.name || idx} className="relative group/arch">
                        <ArchetypeCardComponent {...arch} />
                        {isAdmin && (
                          <div className="mt-2 sm:mt-0 sm:absolute sm:top-3.5 sm:right-4 flex items-center justify-end gap-2 z-10">
                            <button
                              type="button"
                              onClick={() => handleToggleArchetypeNew(arch)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 ${
                                arch.isNew
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30'
                                  : 'bg-slate-800/90 text-slate-400 border-slate-700 hover:text-white hover:border-slate-500'
                              }`}
                              title="Alternar destaque Novo no Manual"
                            >
                              <Sparkles size={11} />
                              {arch.isNew ? 'Novo Ativo' : 'Marcar Novo'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingArchetype({
                                  isCreating: false,
                                  name: arch.name,
                                  imageUrl: arch.imageUrl || '',
                                  description: arch.description || '',
                                  patchDate: arch.patchDate || '10/09/2026',
                                  isNew: !!arch.isNew
                                });
                                const el = document.getElementById('section-arquetipos');
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }}
                              className="px-3 py-1 rounded-lg bg-purple-600/90 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center gap-1 shadow transition"
                            >
                              <Edit2 size={11} /> Editar
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-500 text-sm bg-slate-900/30 rounded-xl border border-slate-800">
                      Nenhum arquétipo encontrado para "{archetypeSearch}".
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 7. CAMPOS */}
          <div id="section-campos" className="rounded-2xl border border-cyan-800/40 bg-slate-950 overflow-hidden shadow-lg shadow-black/40 transition-all hover:border-cyan-600/60">
            <button
              onClick={() => toggleSection('campos')}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-900/50 transition group"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                  <Grid size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                      Seção 07
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                      Playmat Interativo
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-cyan-300 transition-colors tracking-wide">
                    CAMPOS
                  </h3>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/60 text-slate-300 group-hover:text-white shrink-0 ml-2">
                {openSections.campos ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {openSections.campos && (
              <div className="p-4 sm:p-6 border-t border-cyan-800/30 bg-slate-950/90 space-y-6 animate-in slide-in-from-top-2 duration-200">
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-white text-base">Topologia & Zonas do Tabuleiro</h4>
                    <p className="text-xs text-slate-400">
                      Clique em qualquer setor abaixo para explorar a função das zonas de combate, heróis, retaguarda, cemitério e mana.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono px-3 py-1 rounded bg-slate-950 border border-slate-800 text-cyan-400">
                    Toque nas zonas para detalhes
                  </span>
                </div>

                <div className="w-full overflow-x-auto pb-4 -mx-2 px-2 sm:mx-0 sm:px-0">
                  <div className="min-w-[650px] md:min-w-0 w-full">
                    <GameField />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 8. RARIDADE DAS CARTAS */}
          <div id="section-raridades" className="rounded-2xl border border-amber-500/40 bg-slate-950 overflow-hidden shadow-lg shadow-black/40 transition-all hover:border-amber-500/60">
            <button
              onClick={() => toggleSection('raridades')}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-900/50 transition group"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 via-purple-600/20 to-cyan-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                  <Award size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                      Seção 08
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/50">
                      Oficial • 17 Raridades
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-700 hidden sm:inline-block">
                      Frame Moderno (11) & Frame Legado (6)
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-amber-300 transition-colors tracking-wide">
                    RARIDADE DAS CARTAS
                  </h3>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/60 text-slate-300 group-hover:text-white shrink-0 ml-2">
                {openSections.raridades ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {openSections.raridades && (
              <div className="p-4 sm:p-6 border-t border-amber-500/30 bg-slate-950/90 space-y-6 animate-in slide-in-from-top-2 duration-200">
                {/* Header informativo */}
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-white text-base flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-400" />
                      Raridades Oficiais: Frame Moderno & Frame Legado
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
                      Consulte todas as 17 raridades de Light Dark TCG com seus ícones característicos, regras de tiragem e prestígio de colecionador. As cartas de raridade <strong className="text-amber-300">Moderno Macroversal</strong> possuem tiragem única absoluta de apenas 1 por ano.
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        onClick={handleResetDefaultRarities}
                        disabled={isSavingRarities}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition active:scale-95"
                        title="Restaurar a lista padrão com as 17 raridades oficiais"
                      >
                        Restaurar 17 Padrões
                      </button>
                      <button
                        onClick={() => setIsEditingRarities(!isEditingRarities)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition flex items-center gap-1.5 active:scale-95"
                      >
                        <Edit2 size={13} /> {isEditingRarities ? 'Fechar Edição' : 'Editar Raridades'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Filtros por Frame (Todas, Moderno, Legado) */}
                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-1">
                      <Filter size={13} className="text-amber-400" /> Filtrar:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedRarityFrame('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        selectedRarityFrame === 'all'
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      Todas as Raridades
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        selectedRarityFrame === 'all' ? 'bg-slate-950/30 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {rarityItems.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRarityFrame('Moderno')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        selectedRarityFrame === 'Moderno'
                          ? 'bg-cyan-500 text-slate-950 shadow-md'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      Frame Moderno
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        selectedRarityFrame === 'Moderno' ? 'bg-slate-950/30 text-slate-950 font-black' : 'bg-cyan-950 text-cyan-300'
                      }`}>
                        {rarityItems.filter(r => r.frame === 'Moderno').length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRarityFrame('Legado')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        selectedRarityFrame === 'Legado'
                          ? 'bg-amber-600 text-white shadow-md'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      Frame Legado
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        selectedRarityFrame === 'Legado' ? 'bg-slate-950/30 text-white font-black' : 'bg-amber-950 text-amber-300'
                      }`}>
                        {rarityItems.filter(r => r.frame === 'Legado').length}
                      </span>
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-500 font-mono">
                    Exibindo {rarityItems.filter(r => selectedRarityFrame === 'all' ? true : r.frame === selectedRarityFrame).length} de {rarityItems.length} raridades
                  </span>
                </div>

                {rarityFeedback && (
                  <div className="p-3 bg-emerald-950/70 border border-emerald-500 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <Check size={16} />
                    {rarityFeedback}
                  </div>
                )}

                {/* Grid das Raridades */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rarityItems
                    .filter(item => selectedRarityFrame === 'all' || item.frame === selectedRarityFrame)
                    .map((rarity, idx) => {
                      const realIndex = rarityItems.findIndex(r => r.id === rarity.id);
                      const isMacroversal = rarity.isUniquePerYear || rarity.name.toLowerCase().includes('macroversal');
                      
                      return (
                        <div 
                          key={rarity.id || idx}
                          className={`p-4 rounded-xl transition-all flex flex-col justify-between gap-3 relative group overflow-hidden shadow-lg ${
                            isMacroversal
                              ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-purple-950/30 border-2 border-amber-400/80 shadow-amber-950/40 ring-1 ring-amber-400/50'
                              : rarity.frame === 'Legado'
                              ? 'bg-slate-900/75 border border-amber-900/40 hover:border-amber-500/60'
                              : 'bg-slate-900/75 border border-slate-800 hover:border-cyan-500/50'
                          }`}
                        >
                          {/* Destaque para Moderno Macroversal */}
                          {isMacroversal && (
                            <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-400 to-yellow-500 text-slate-950 text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-bl-lg shadow-sm">
                              Tiragem Única • 1/Ano
                            </div>
                          )}

                          <div>
                            <div className="flex items-start gap-3 mb-2">
                              {/* Ícone PNG da Raridade */}
                              <div className={`w-14 h-14 rounded-xl bg-slate-950 flex items-center justify-center shrink-0 p-1 relative overflow-hidden transition-colors shadow-inner ${
                                isMacroversal 
                                  ? 'border-2 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                                  : rarity.frame === 'Legado'
                                  ? 'border border-amber-600/40 group-hover:border-amber-400'
                                  : 'border border-cyan-500/40 group-hover:border-cyan-400'
                              }`}>
                                {rarity.iconUrl ? (
                                  <img 
                                    src={rarity.iconUrl} 
                                    alt={rarity.name} 
                                    className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(245,158,11,0.35)] select-none"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center text-center p-1">
                                    {isMacroversal ? (
                                      <Sparkles size={20} className="text-amber-400 animate-pulse" />
                                    ) : (
                                      <Award size={18} className={rarity.frame === 'Legado' ? 'text-amber-400' : 'text-cyan-400'} />
                                    )}
                                    <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400 mt-0.5 truncate max-w-[48px]">
                                      {rarity.frame === 'Legado' ? 'LEG' : 'MOD'}
                                    </span>
                                  </div>
                                )}

                                {uploadingRarityId === rarity.id && (
                                  <div className="absolute inset-0 bg-slate-950/85 flex items-center justify-center">
                                    <Loader2 size={18} className="animate-spin text-amber-400" />
                                  </div>
                                )}
                              </div>

                              {/* Título, Frame & Badge */}
                              <div className="flex-1 min-w-0 pr-1">
                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                  <span className={`text-[9px] font-mono font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                    rarity.frame === 'Legado'
                                      ? 'bg-amber-950/90 text-amber-300 border border-amber-800/60'
                                      : 'bg-cyan-950/90 text-cyan-300 border border-cyan-800/60'
                                  }`}>
                                    Frame {rarity.frame}
                                  </span>

                                  {rarity.badge && (
                                    <span className="text-[9px] font-bold text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 truncate max-w-[130px]">
                                      {rarity.badge}
                                    </span>
                                  )}
                                </div>

                                {isEditingRarities && isAdmin ? (
                                  <div className="space-y-1.5 mt-1">
                                    <input 
                                      type="text"
                                      value={rarity.name}
                                      onChange={(e) => {
                                        const updated = [...rarityItems];
                                        updated[realIndex].name = e.target.value;
                                        setRarityItems(updated);
                                      }}
                                      placeholder="Nome da Raridade"
                                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-bold"
                                    />
                                    <div className="flex gap-1.5">
                                      <select
                                        value={rarity.frame}
                                        onChange={(e) => {
                                          const updated = [...rarityItems];
                                          updated[realIndex].frame = e.target.value as 'Moderno' | 'Legado';
                                          setRarityItems(updated);
                                        }}
                                        className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-300 font-bold"
                                      >
                                        <option value="Moderno">Moderno</option>
                                        <option value="Legado">Legado</option>
                                      </select>
                                      <input 
                                        type="text"
                                        value={rarity.badge || ''}
                                        onChange={(e) => {
                                          const updated = [...rarityItems];
                                          updated[realIndex].badge = e.target.value;
                                          setRarityItems(updated);
                                        }}
                                        placeholder="Badge (ex: Alto Impacto)"
                                        className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-amber-300 font-bold"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <h5 className="font-black text-white text-base tracking-wide flex items-center gap-1.5 truncate">
                                      {rarity.name}
                                    </h5>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Explicação breve */}
                            {isEditingRarities && isAdmin ? (
                              <div className="mt-2">
                                <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">
                                  Breve Explicação:
                                </label>
                                <textarea
                                  rows={3}
                                  value={rarity.description}
                                  onChange={(e) => {
                                    const updated = [...rarityItems];
                                    updated[realIndex].description = e.target.value;
                                    setRarityItems(updated);
                                  }}
                                  placeholder="Breve explicação sobre as características e tiragem desta raridade..."
                                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 outline-none focus:border-amber-500"
                                />
                              </div>
                            ) : (
                              <p className="text-xs text-slate-300 leading-relaxed mt-2 text-justify">
                                {rarity.description}
                              </p>
                            )}
                          </div>

                          {/* Ações de Admin para anexar PNG e editar */}
                          {isAdmin && (
                            <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
                              <div className="flex items-center justify-between gap-2">
                                <label className="cursor-pointer bg-slate-950 hover:bg-slate-900 border border-slate-700 hover:border-amber-500/60 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition flex-1 justify-center active:scale-95 shadow-sm">
                                  <Upload size={13} className="text-amber-400 shrink-0" />
                                  <span className="truncate">
                                    {rarity.iconUrl ? 'Trocar Ícone PNG' : 'Anexar Ícone PNG'}
                                  </span>
                                  <input 
                                    type="file" 
                                    accept="image/png,image/webp,image/svg+xml,image/jpeg"
                                    className="hidden"
                                    onChange={(e) => {
                                      if (e.target.files?.[0]) {
                                        handleUploadRarityIcon(rarity.id, e.target.files[0]);
                                      }
                                    }}
                                  />
                                </label>

                                {isEditingRarities && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRarity(rarity.id)}
                                    className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 hover:text-white transition"
                                    title="Excluir esta Raridade"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>

                              {isEditingRarities && (
                                <div className="flex items-center gap-1.5">
                                  <input 
                                    type="text"
                                    value={rarity.iconUrl || ''}
                                    onChange={(e) => {
                                      const updated = [...rarityItems];
                                      updated[realIndex].iconUrl = e.target.value;
                                      setRarityItems(updated);
                                    }}
                                    placeholder="Ou cole a URL direta do PNG..."
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300 font-mono"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Controles de Admin gerais para Raridades */}
                {isAdmin && isEditingRarities && (
                  <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleAddRarity}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition"
                      >
                        <Plus size={14} className="text-amber-400" />
                        Adicionar Nova Raridade
                      </button>

                      <button
                        type="button"
                        onClick={handleResetDefaultRarities}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition"
                      >
                        Restaurar Padrões
                      </button>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => handleSaveRarities(rarityItems)}
                        disabled={isSavingRarities}
                        className="w-full sm:w-auto px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 transition disabled:opacity-50"
                      >
                        {isSavingRarities ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Salvar Raridades & Explicações
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 9. FAQ RÁPIDO DE INTERAÇÕES (JUIZ DIGITAL & EMBAIXADORES) - RETRÁTIL */}
          <div id="section-faq" className="rounded-2xl border border-indigo-500/40 bg-slate-950 overflow-hidden shadow-lg shadow-black/40 transition-all hover:border-indigo-500/60">
            <button
              onClick={() => toggleSection('faq')}
              className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-900/50 transition group"
            >
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                  <Scale size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">
                      Seção 09
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                      Juiz Digital & Embaixadores
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-indigo-300 transition-colors tracking-wide">
                    FAQ RÁPIDO DE INTERAÇÕES
                  </h3>
                </div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/60 text-slate-300 group-hover:text-white shrink-0 ml-2">
                {openSections.faq ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {openSections.faq && (
              <div className="p-4 sm:p-6 border-t border-indigo-500/30 bg-slate-950/90 animate-in slide-in-from-top-2 duration-200">
                <InteractionsFaqSection />
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Admin Manual Editor Modal */}
      {isEditorOpen && isAdmin && (
        <ManualEditModal
          data={data}
          onClose={() => setIsEditorOpen(false)}
          onSave={async (updatedData) => {
            await setDoc(doc(db, 'homeSettings', 'gameManual'), sanitizeForFirestore({
              ...updatedData,
              lastUpdated: new Date().toISOString()
            }), { merge: true });
            setData(updatedData);
            setIsEditorOpen(false);
          }}
        />
      )}
    </section>
  );
};

// Admin Editor Component
const ManualEditModal: React.FC<{
  data: GameManualData;
  onClose: () => void;
  onSave: (data: GameManualData) => Promise<void>;
}> = ({ data, onClose, onSave }) => {
  const [form, setForm] = useState<GameManualData>(() => {
    const cloned: GameManualData = JSON.parse(JSON.stringify(data));
    if (!cloned.cartas) {
      cloned.cartas = { ...defaultManualData.cartas };
    }
    if (!cloned.cartas.structureTitle) {
      cloned.cartas.structureTitle = defaultManualData.cartas.structureTitle || 'Anatomia & Estrutura das Cartas';
    }
    if (!cloned.cartas.structureItems || cloned.cartas.structureItems.length === 0) {
      cloned.cartas.structureItems = JSON.parse(JSON.stringify(defaultManualData.cartas.structureItems));
    }
    return cloned;
  });
  const [activeTab, setActiveTab] = useState<'patch' | 'basico' | 'cartas' | 'turnos' | 'regras' | 'arquetipos'>('patch');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { archetypes, saveArchetype } = useCards();
  const [modalArchSearch, setModalArchSearch] = useState('');
  const [modalEditingArch, setModalEditingArch] = useState<{
    isCreating: boolean;
    name: string;
    imageUrl: string;
    description: string;
    patchDate: string;
    isNew: boolean;
  } | null>(null);
  const [modalUploadingIcon, setModalUploadingIcon] = useState(false);
  const [modalSavingArch, setModalSavingArch] = useState(false);

  const updateStructureItem = (index: number, field: 'label' | 'text' | 'color', val: string) => {
    setForm(prev => {
      const items = [...(prev.cartas.structureItems || defaultManualData.cartas.structureItems)];
      items[index] = { ...items[index], [field]: val };
      return {
        ...prev,
        cartas: {
          ...prev.cartas,
          structureItems: items
        }
      };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(form);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Erro ao salvar manual:', err);
      alert('Erro ao salvar no Firestore. Verifique as permissões de administrador.');
    } finally {
      setIsSaving(false);
    }
  };

  const addPatchNote = () => {
    setForm(prev => ({
      ...prev,
      patchNotes: [
        ...prev.patchNotes,
        {
          title: `${prev.patchNotes.length + 1}. Nova Regra ou Mudança`,
          description: 'Descreva a alteração ou esclarecimento aqui...'
        }
      ]
    }));
  };

  const removePatchNote = (index: number) => {
    setForm(prev => ({
      ...prev,
      patchNotes: prev.patchNotes.filter((_, i) => i !== index)
    }));
  };

  const updatePatchNote = (index: number, field: keyof PatchNoteItem, val: string) => {
    setForm(prev => {
      const copy = [...prev.patchNotes];
      copy[index] = { ...copy[index], [field]: val };
      return { ...prev, patchNotes: copy };
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0e0e12] border border-purple-500/40 rounded-2xl max-w-4xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/40">
              <Edit2 size={18} />
            </div>
            <div>
              <h3 className="font-black text-white text-base sm:text-lg">
                Editar Manual, Regras & Patch
              </h3>
              <p className="text-xs text-slate-400">
                Altere os textos oficiais exibidos na homepage. As mudanças são salvas em tempo real no Firestore.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-4 shrink-0 overflow-x-auto gap-2 py-2">
          {[
            { id: 'patch', label: '1. Patch Atual & Alerta', icon: Scale },
            { id: 'basico', label: '2. Básico', icon: Info },
            { id: 'cartas', label: '3. Cartas', icon: Layers },
            { id: 'turnos', label: '4. Turnos & Combate', icon: Clock },
            { id: 'regras', label: '5. Regras Avançadas', icon: Sparkles },
            { id: 'arquetipos', label: '6. Arquétipos', icon: Crown }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* TAB 1: PATCH */}
          {activeTab === 'patch' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-4">
                <h4 className="font-bold text-amber-400 text-sm flex items-center gap-2">
                  <Sparkles size={16} /> Configurações Gerais do Patch & Novidade
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Título do Patch
                    </label>
                    <input
                      type="text"
                      value={form.patchTitle}
                      onChange={e => setForm(prev => ({ ...prev, patchTitle: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Data do Patch (ex: 24/10/2026)
                    </label>
                    <input
                      type="text"
                      value={form.patchDate}
                      onChange={e => setForm(prev => ({ ...prev, patchDate: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mensagem de Destaque / Novidade (Aparece no banner com a data do patch)
                  </label>
                  <textarea
                    rows={2}
                    value={form.noveltyMessage}
                    onChange={e => setForm(prev => ({ ...prev, noveltyMessage: e.target.value }))}
                    placeholder="Ex: Novo Patch Disponível: Ajustes de combate e regras oficiais atualizadas!"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.isNoveltyActive}
                      onChange={e => setForm(prev => ({ ...prev, isNoveltyActive: e.target.checked }))}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-purple-600 focus:ring-0"
                    />
                    <span className="text-xs font-bold text-white">
                      Exibir Banner de Novidade do Patch no topo do Manual
                    </span>
                  </label>
                </div>
              </div>

              {/* Patch Notes Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm">Itens e Notas de Atualização ({form.patchNotes.length})</h4>
                  <button
                    onClick={addPatchNote}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition"
                  >
                    <Plus size={14} /> Adicionar Item
                  </button>
                </div>

                {form.patchNotes.map((note, idx) => (
                  <div key={idx} className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={note.title}
                        onChange={e => updatePatchNote(idx, 'title', e.target.value)}
                        placeholder="Título do item..."
                        className="w-full font-bold text-amber-400 bg-transparent border-b border-slate-800 px-1 py-1 text-xs focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={() => removePatchNote(idx)}
                        className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-950/40 transition shrink-0"
                        title="Remover item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div>
                      <textarea
                        rows={2}
                        value={note.description}
                        onChange={e => updatePatchNote(idx, 'description', e.target.value)}
                        placeholder="Descrição da regra / alteração..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        value={note.example || ''}
                        onChange={e => updatePatchNote(idx, 'example', e.target.value)}
                        placeholder="Exemplo prático (opcional)..."
                        className="w-full bg-slate-950/50 border border-slate-800/80 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: BASICO */}
          {activeTab === 'basico' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-4">
                <h4 className="font-bold text-purple-400 text-sm">Regras de Deck (Uma por linha)</h4>
                <textarea
                  rows={4}
                  value={form.basico.deckRules.join('\n')}
                  onChange={e => {
                    const lines = e.target.value.split('\n');
                    setForm(prev => ({
                      ...prev,
                      basico: { ...prev.basico, deckRules: lines }
                    }));
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-purple-500 leading-relaxed font-mono"
                />
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-4">
                <h4 className="font-bold text-white text-sm">Estrutura da Partida</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Objetivo da Vitória</label>
                    <input
                      type="text"
                      value={form.basico.structureObjective}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        basico: { ...prev.basico, structureObjective: e.target.value }
                      }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Formato do Duelo</label>
                    <input
                      type="text"
                      value={form.basico.structureDuel}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        basico: { ...prev.basico, structureDuel: e.target.value }
                      }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Regra de Início</label>
                    <input
                      type="text"
                      value={form.basico.structureStart}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        basico: { ...prev.basico, structureStart: e.target.value }
                      }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Regra de Mulligan</label>
                    <input
                      type="text"
                      value={form.basico.structureMulligan}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        basico: { ...prev.basico, structureMulligan: e.target.value }
                      }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nota da Primeira Rodada</label>
                  <input
                    type="text"
                    value={form.basico.firstRoundNote}
                    onChange={e => setForm(prev => ({
                      ...prev,
                      basico: { ...prev.basico, firstRoundNote: e.target.value }
                    }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CARTAS */}
          {activeTab === 'cartas' && (
            <div className="space-y-5 animate-in fade-in">
              {/* Anatomia & Estrutura das Cartas */}
              <div className="bg-slate-900/60 p-4 sm:p-5 rounded-xl border border-purple-500/30 space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <h4 className="font-bold text-amber-400 text-sm flex items-center gap-2">
                    <Layers size={16} /> Anatomia & Estrutura das Cartas
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Edite o título da seção e os 4 campos explicativos da anatomia das cartas (Categoria, Status, Arquétipo, Tipo).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Título da Seção de Estrutura
                  </label>
                  <input
                    type="text"
                    value={form.cartas.structureTitle || 'Anatomia & Estrutura das Cartas'}
                    onChange={e => setForm(prev => ({
                      ...prev,
                      cartas: { ...prev.cartas, structureTitle: e.target.value }
                    }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                  {(form.cartas.structureItems || defaultManualData.cartas.structureItems).map((item, idx) => (
                    <div key={idx} className="bg-slate-950/90 p-3.5 rounded-lg border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400">
                          Estrutura #{idx + 1}
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 ${item.color || 'text-slate-300'}`}>
                          {item.label}
                        </span>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Nome / Rótulo
                        </label>
                        <input
                          type="text"
                          value={item.label}
                          onChange={e => updateStructureItem(idx, 'label', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Texto Descritivo
                        </label>
                        <textarea
                          rows={2}
                          value={item.text}
                          onChange={e => updateStructureItem(idx, 'text', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Categorias de Cartas */}
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-blue-400 text-sm">Descrição: Combatente (Azul)</h4>
                <textarea
                  rows={3}
                  value={form.cartas.combatenteText}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    cartas: { ...prev.cartas, combatenteText: e.target.value }
                  }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-red-400 text-sm">Descrição: Herói (Vermelho)</h4>
                <textarea
                  rows={3}
                  value={form.cartas.heroiText}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    cartas: { ...prev.cartas, heroiText: e.target.value }
                  }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-green-400 text-sm">Descrição: Equipamento (Verde)</h4>
                <textarea
                  rows={3}
                  value={form.cartas.equipamentoText}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    cartas: { ...prev.cartas, equipamentoText: e.target.value }
                  }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-purple-400 text-sm">Descrição: Efeito (Roxo)</h4>
                <textarea
                  rows={3}
                  value={form.cartas.efeitoText}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    cartas: { ...prev.cartas, efeitoText: e.target.value }
                  }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}

          {/* TAB 4: TURNOS */}
          {activeTab === 'turnos' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm">Visão Geral da Rodada (Ação e Reação)</h4>
                <textarea
                  rows={3}
                  value={form.turnos.roundOverview}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    turnos: { ...prev.turnos, roundOverview: e.target.value }
                  }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-red-400 text-sm">Regras de Combate (Uma por linha)</h4>
                <textarea
                  rows={8}
                  value={form.turnos.combatRules.join('\n')}
                  onChange={e => {
                    const lines = e.target.value.split('\n');
                    setForm(prev => ({
                      ...prev,
                      turnos: { ...prev.turnos, combatRules: lines }
                    }));
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}

          {/* TAB 5: REGRAS */}
          {activeTab === 'regras' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-yellow-400 text-sm">Correntes (Chains - LIFO)</h4>
                <textarea
                  rows={3}
                  value={form.regras.chainsText}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    regras: { ...prev.regras, chainsText: e.target.value }
                  }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <label className="block text-xs font-semibold text-slate-300">Prioridade por CT</label>
                <textarea
                  rows={2}
                  value={form.regras.chainsPriorityText}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    regras: { ...prev.regras, chainsPriorityText: e.target.value }
                  }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-purple-400 text-sm">Sem Deck (Deck Out)</h4>
                <textarea
                  rows={3}
                  value={form.regras.deckOutText}
                  onChange={e => setForm(prev => ({
                    ...prev,
                    regras: { ...prev.regras, deckOutText: e.target.value }
                  }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm">Observações Importantes (Uma por linha)</h4>
                <textarea
                  rows={6}
                  value={form.regras.observations.join('\n')}
                  onChange={e => {
                    const lines = e.target.value.split('\n');
                    setForm(prev => ({
                      ...prev,
                      regras: { ...prev.regras, observations: lines }
                    }));
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}

          {/* TAB 6: ARQUÉTIPOS */}
          {activeTab === 'arquetipos' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Crown size={16} className="text-purple-400" /> Gerenciar Arquétipos do Manual
                  </h4>
                  <p className="text-xs text-slate-400">
                    Crie ou edite ícones, descrições, datas de patch e destaque "Novo" dos arquétipos.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={modalArchSearch}
                    onChange={e => setModalArchSearch(e.target.value)}
                    placeholder="Buscar arquétipo..."
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setModalEditingArch({
                      isCreating: true,
                      name: '',
                      imageUrl: '',
                      description: '',
                      patchDate: new Date().toLocaleDateString('pt-BR'),
                      isNew: true
                    })}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                  >
                    <Plus size={14} /> Novo Arquétipo
                  </button>
                </div>
              </div>

              {modalEditingArch && (
                <div className="bg-slate-900 border-2 border-purple-500/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-white text-xs sm:text-sm">
                      {modalEditingArch.isCreating ? 'Criar Novo Arquétipo' : `Editando: ${modalEditingArch.name}`}
                    </h5>
                    <button type="button" onClick={() => setModalEditingArch(null)} className="text-slate-400 hover:text-white">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Nome</label>
                      <input
                        type="text"
                        disabled={!modalEditingArch.isCreating}
                        value={modalEditingArch.name}
                        onChange={e => setModalEditingArch(prev => prev ? { ...prev, name: e.target.value } : null)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Data do Patch</label>
                      <input
                        type="text"
                        value={modalEditingArch.patchDate}
                        onChange={e => setModalEditingArch(prev => prev ? { ...prev, patchDate: e.target.value } : null)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Ícone (URL ou Upload)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={modalEditingArch.imageUrl}
                        onChange={e => setModalEditingArch(prev => prev ? { ...prev, imageUrl: e.target.value } : null)}
                        placeholder="https://..."
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                      <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0">
                        {modalUploadingIcon ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                        <span>{modalUploadingIcon ? 'Enviando...' : 'Enviar do PC'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={modalUploadingIcon}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              setModalUploadingIcon(true);
                              const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                              const fileRef = ref(storage, `archetype_icons/${Date.now()}_${safeName}`);
                              await uploadBytes(fileRef, file);
                              const url = await getDownloadURL(fileRef);
                              setModalEditingArch(prev => prev ? { ...prev, imageUrl: url } : null);
                            } catch (err) {
                              alert('Erro ao enviar imagem.');
                            } finally {
                              setModalUploadingIcon(false);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Descrição</label>
                    <textarea
                      rows={3}
                      value={modalEditingArch.description}
                      onChange={e => setModalEditingArch(prev => prev ? { ...prev, description: e.target.value } : null)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-emerald-300 font-bold">
                      <input
                        type="checkbox"
                        checked={modalEditingArch.isNew}
                        onChange={e => setModalEditingArch(prev => prev ? { ...prev, isNew: e.target.checked } : null)}
                      />
                      Destacar como "Novo" (Piscando)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModalEditingArch(null)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={modalSavingArch || !modalEditingArch.name.trim()}
                        onClick={async () => {
                          if (!modalEditingArch) return;
                          try {
                            setModalSavingArch(true);
                            await saveArchetype({
                              name: modalEditingArch.name.trim(),
                              imageUrl: modalEditingArch.imageUrl.trim(),
                              description: modalEditingArch.description,
                              patchDate: modalEditingArch.patchDate.trim() || new Date().toLocaleDateString('pt-BR'),
                              isNew: modalEditingArch.isNew
                            });
                            setModalEditingArch(null);
                          } finally {
                            setModalSavingArch(false);
                          }
                        }}
                        className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Save size={13} /> {modalSavingArch ? 'Salvando...' : 'Salvar Arquétipo'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {archetypes
                  .filter(a => a.name.toLowerCase().includes(modalArchSearch.toLowerCase()) || (a.description || '').toLowerCase().includes(modalArchSearch.toLowerCase()))
                  .map(arch => (
                    <div key={arch.name} className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-2">
                      <div className="flex items-start gap-3">
                        {arch.imageUrl ? (
                          <img src={arch.imageUrl} alt={arch.name} className="w-9 h-9 object-contain shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-purple-950/60 flex items-center justify-center text-purple-400 font-bold text-xs shrink-0">
                            {arch.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-xs">{arch.name}</span>
                            {arch.isNew && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                Novo
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{arch.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                        <span className="text-slate-500 font-mono">Patch: {arch.patchDate || '10/09/2026'}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => saveArchetype({ ...arch, isNew: !arch.isNew })}
                            className={`px-2 py-1 rounded text-[10px] font-bold border ${
                              arch.isNew
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                            }`}
                          >
                            {arch.isNew ? 'Novo Ativo' : 'Marcar Novo'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setModalEditingArch({
                              isCreating: false,
                              name: arch.name,
                              imageUrl: arch.imageUrl || '',
                              description: arch.description || '',
                              patchDate: arch.patchDate || '10/09/2026',
                              isNew: !!arch.isNew
                            })}
                            className="px-2.5 py-1 rounded bg-purple-600/80 hover:bg-purple-600 text-white text-[10px] font-bold flex items-center gap-1"
                          >
                            <Edit2 size={10} /> Editar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            {saveSuccess ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Check size={14} /> Alterações salvas com sucesso no Firestore!
              </span>
            ) : (
              <span>Salvando no documento oficial <code className="text-purple-400">homeSettings/gameManual</code></span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-900/40 disabled:opacity-50"
            >
              <Save size={14} /> {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
