import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { 
  Zap, Heart, Layers, Hexagon, BookOpen,
  ShoppingCart, ExternalLink, Search, Filter, Box, ArrowDownAZ,
  Menu, X, ChevronRight, ChevronDown, ChevronUp, Scale, Ghost, Instagram, MessageCircle, Mail, Music, Info,
  Sword, Shield, Clock, AlertTriangle, Users, FileText, CheckCircle, Crown, Youtube, Settings, Sparkles,
  LogIn, LogOut, BookmarkCheck, Cloud, User as UserIcon, Edit2, Check, Flame, Trophy, Award, Package, Truck
} from 'lucide-react';
import { Card } from './components/Card';
import { GameField } from './components/GameField';
import { DeckBuilderModal } from './components/DeckBuilderModal';
import { CardDetailModal } from './components/CardDetailModal';
import { AlbumModal } from './components/AlbumModal';
import { SavedDecksModal } from './components/SavedDecksModal';
import { AuthModal } from './components/AuthModal';
import { PopularCardsModal } from './components/PopularCardsModal';
import { CollectorsRankingModal } from './components/CollectorsRankingModal';
import { ChampionshipHistoryModal } from './components/ChampionshipHistoryModal';
import { UserProfileModal, TargetUserProfile } from './components/UserProfileModal';
import { useAuth } from './authService';
import GameBoard from './components/GameBoard';
import { TournamentManager } from './components/TournamentManager';
import { AdminPanel } from './components/AdminPanel';
import { LoreView } from './components/LoreView';
import { compareCardCodes } from './deckUtils';
import { db, storage, readBrowserCache, writeBrowserCache } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { useCards, cleanCardCode, getBaseCardCode, getCardDisplayPriority, resolveModernFrameOnly, isLegacyCard } from './CardContext';
import { CardData, CardType, ArchetypeData, ExclusiveProduct, FeaturedRareCardsConfig, LEGADO_RARITIES, MODERNO_RARITIES } from './types';
import { NovidadesSection } from './components/NovidadesSection';
import { ProductDetailModal } from './components/ProductDetailModal';
import { GameGuideSections } from './components/GameGuideSections';
import { StoreModal } from './components/StoreModal';
import { addToCart, getCartItems, optimizeBase64ImagesInProducts, toProductSlug } from './storeService';
import { DuelBotModal } from './duel-bot/DuelBotModal';
import { NavbarSpotifyMicroPlayer } from './components/SpotifySoundtrackSection';
import { downloadPresentationGuidePdf } from './utils/presentationPdfGenerator';
import {
  useThemeTextures,
  useSiteEffects,
  SiteEffectsToggleButton,
  ArcaneCyberTextureLayer,
  CyberArcaneCornerFrame,
  ThemeTexturesManagerModal,
  ThemeTextureSlot,
  DEFAULT_THEME_TEXTURES
} from './components/ArcaneCyberTheme';
import {
  useBlairSiteTour,
  ConhecaOSiteNavbarButton,
  BlairFirstVisitPromptModal,
  BlairSiteTourModal,
  BLAIR_TOUR_SLIDES
} from './components/BlairSiteTourModal';

// --- SUB-COMPONENTS ---

const ArchetypeCard: React.FC<ArchetypeData> = ({ name, icon: Icon, imageUrl, color, description, patchDate, isNew }) => (
  <div className={`cyber-arcane-box-sm ${isNew ? 'border-emerald-500/50 shadow-[0_0_24px_rgba(16,185,129,0.16)]' : ''} hover:border-amber-500/45 p-4 md:p-5 transition-all duration-300 flex items-start gap-4 md:gap-5 shadow-xl group relative overflow-hidden`}>
    <CyberArcaneCornerFrame accent={isNew ? 'cyan' : 'violet'} />
    {/* Ícone à esquerda */}
    <div className="shrink-0 flex items-center justify-center pt-0.5 relative z-10">
      <div className="p-2 bg-[#07060e]/90 border border-amber-500/25 shadow-inner">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-10 h-10 md:w-12 md:h-12 object-contain drop-shadow-[0_0_10px_rgba(168,85,247,0.35)]" />
        ) : Icon ? (
          <Icon className={`${color || 'text-amber-400'} w-10 h-10 md:w-12 md:h-12`} />
        ) : (
          <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-950/60 flex items-center justify-center text-amber-300 font-cinzel font-bold text-base md:text-lg">
            {name.charAt(0)}
          </div>
        )}
      </div>
    </div>

    {/* Nome em negrito e em baixo a descrição */}
    <div className="flex-1 min-w-0 relative z-10">
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <h4 className="font-cinzel font-bold text-base md:text-xl text-amber-50 group-hover:text-amber-300 transition-colors tracking-wider flex items-center gap-2.5 flex-wrap">
          <span>{name}</span>
          {isNew && (
            <span className="relative inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-cyber font-black uppercase tracking-widest bg-emerald-950/90 text-emerald-300 border border-emerald-400/60 shadow-[0_0_15px_rgba(16,185,129,0.35)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              NOVO PATCH
            </span>
          )}
        </h4>
      </div>

      <p className="text-slate-300 text-xs md:text-sm leading-relaxed break-words">
        {description}
      </p>

      {/* Em baixo (pequeno): data do patch */}
      <div className="mt-3 pt-2.5 border-t border-purple-500/20 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
        <span className="text-[11px] font-mono tracking-tight text-slate-400 flex items-center gap-1.5">
          <span className="text-slate-500 uppercase">REGISTRO DE PATCH:</span>
          <span className="text-cyan-300 font-medium bg-cyan-950/40 px-2 py-0.5 border border-cyan-500/30">
            {patchDate || '10/09/2026'}
          </span>
        </span>
        {isNew && (
          <span className="text-[11px] font-cyber font-bold uppercase tracking-wider text-emerald-400/90 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-400 animate-ping" />
            Sincronizado no Patch
          </span>
        )}
      </div>
    </div>
  </div>
);

const FieldItem = ({ label, value, icon: Icon, color }: { label: string, value: string, icon: any, color: string }) => (
  <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded border border-slate-700/50">
    <div className={`p-2 rounded bg-slate-900 ${color}`}>
      <Icon size={18} />
    </div>
    <div>
      <div className="text-xs text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="font-bold text-white text-sm">{value}</div>
    </div>
  </div>
);

const GameLore: React.FC<{
  textureSlot?: ThemeTextureSlot;
  showPlaceholderBadge?: boolean;
  onConfigureTexture?: (slotId: string) => void;
}> = ({ textureSlot, showPlaceholderBadge, onConfigureTexture }) => {
  return (
    <section id="sobre-light-dark" className="py-24 bg-[#05040a] border-b border-amber-500/20 relative overflow-hidden">
       {textureSlot && (
         <ArcaneCyberTextureLayer
           slot={textureSlot}
           variant="dark-magic"
           showPlaceholderBadge={showPlaceholderBadge}
           onOpenConfig={onConfigureTexture}
         />
       )}
       <div className="arcane-divider top-0 left-0 right-0 absolute" />

       <div className="container mx-auto px-4 sm:px-6 max-w-4xl relative z-10">
          <div className="cyber-arcane-box p-6 sm:p-10 md:p-12 relative">
            <CyberArcaneCornerFrame accent="gold" />

            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 bg-purple-950/60 border border-amber-500/35 text-[11px] font-mono uppercase tracking-[0.25em] text-amber-300">
                <span>GRIMÓRIO M13 // ARQUIVO CÓSMICO</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-cinzel font-black text-amber-50 mb-4 uppercase tracking-wider drop-shadow-[0_2px_18px_rgba(212,175,55,0.25)]">
                SOBRE LIGHT DARK
              </h2>
              <div className="flex items-center justify-center gap-3">
                <div className="h-[1px] w-16 bg-gradient-to-r from-transparent to-amber-500/70"></div>
                <div className="w-2 h-2 rotate-45 border border-cyan-400 bg-purple-600"></div>
                <div className="h-[1px] w-16 bg-gradient-to-l from-transparent to-cyan-400/70"></div>
              </div>
            </div>

            {/* Resumo da ideia do jogo */}
            <div className="prose prose-invert prose-lg mx-auto text-slate-200 leading-relaxed text-justify space-y-6">
              <p className="first-letter:text-5xl first-letter:font-cinzel first-letter:font-black first-letter:text-amber-400 first-letter:mr-3 first-letter:float-left">
                <strong className="text-amber-200 font-cinzel">Light Dark TCG</strong> é um jogo de cartas estratégico e colecionável que nasceu de uma campanha de RPG de mesa com mais de uma década de história. Nele, dois (ou quatro) jogadores se enfrentam em duelos dinâmicos de <strong className="text-cyan-300">Ação e Reação</strong> com o objetivo de reduzir os <strong className="text-amber-300">20 pontos de Vida</strong> do oponente a zero.
              </p>
              <div className="cyber-arcane-box-sm p-5 bg-[#090714]/90 border border-cyan-500/30 text-slate-200 relative">
                <CyberArcaneCornerFrame accent="cyan" />
                <p className="m-0 text-sm sm:text-base leading-relaxed">
                  Você monta um deck único de 30 a 35 cartas sem repetições e assume o comando de <strong className="text-amber-300">Heróis lendários, Combatentes, Equipamentos e Efeitos</strong> — utilizando <strong className="text-cyan-300">Mana</strong> e <strong className="text-purple-300">Runas</strong> para invocar criaturas, criar correntes de resposta no turno adversário e dominar diferentes Arquétipos entre a <span className="text-purple-300 font-semibold">Magia Negra</span>, a <span className="text-amber-300 font-semibold">Alta Magia</span> e a <span className="text-cyan-300 font-semibold">Tecnologia Futurista do Macroverso</span>.
                </p>
              </div>
            </div>
          </div>
       </div>
    </section>
  );
};

const TYPE_DEFINITIONS: Record<string, { text: string, colorName: string, colorClass: string }> = {
  'Combatente': {
    text: "As cartas combatentes são os ‘‘monstros’’ comuns e auxiliares de cada deck, eles não são classificados como heróis a não ser por efeitos únicos.",
    colorName: "AZUL",
    colorClass: "text-blue-500 border-blue-500"
  },
  'Herói': {
    text: "As cartas de Heróis são o foco dos decks, eles inicialmente ficam fora do deck principal, em uma área própria e precisam de condições específicas para serem invocados (alguns heróis só podem ser invocados pelo seu próprio efeito seguindo suas regras enquanto outros dependem de cartas de invocação), não é permitido ter 2 heróis em campo ao mesmo tempo a não ser por efeitos específicos.",
    colorName: "VERMELHO",
    colorClass: "text-red-500 border-red-500"
  },
  'Efeito': {
    text: "As cartas de efeitos são cartas de uso único ou contínuo que fazem uma ou mais ações, cada uma possui seu custo e condições de ativação que devem ser seguidas, uma carta de efeito após o término de seu uso é enviada a Zona Morta.",
    colorName: "ROXO",
    colorClass: "text-purple-500 border-purple-500"
  },
  'Equipamento': {
    text: "As cartas de equipamentos alteram status, adicionam arquétipos ou geram algum efeito diferente ao combatente equipado. Elas se vinculam a um combatente/herói até que o mesmo deixe o campo, caso o equipado deixe o campo, equipamento vai para a Zona Morta, caso um herói seja substituído por outro, o equipamento passa para o novo herói, não há limites de equipamentos em um mesmo alvo, o que define a ordem de prioridade de efeito entre eles é a Categoria, quanto maior, mais prioridade.",
    colorName: "VERDE",
    colorClass: "text-green-500 border-green-500"
  },
  'Token': {
    text: "Tokens são cartas vinculadas a cartas que se utilizam delas, tokens só podem ser afetadas por cartas que as afetam diretamente, elas ocupam espaço em campo mas não declaram ataques e nem possuem efeitos, tokens também não podem ser equipados. Os Tokens ficam no deck de heróis e você pode colocar no máximo 15, quando deixam o campo, elas voltam para o deck de heróis.",
    colorName: "AMARELO",
    colorClass: "text-yellow-400 border-yellow-400"
  }
};

const TypeModal = ({ type, onClose }: { type: string | null, onClose: () => void }) => {
  if (!type || !TYPE_DEFINITIONS[type]) return null;
  const def = TYPE_DEFINITIONS[type];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in duration-200" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 p-8 rounded-xl max-w-lg w-full relative shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={24} />
        </button>
        <h3 className={`text-3xl font-black mb-4 uppercase tracking-wider ${def.colorClass.split(' ')[0]}`}>{type}</h3>
        <p className="text-slate-300 leading-relaxed mb-6 text-justify">
          {def.text}
        </p>
        <div className={`text-xs font-bold border py-2 px-4 rounded inline-block bg-slate-950 ${def.colorClass}`}>
          COR DA CARTA: {def.colorName}
        </div>
      </div>
    </div>
  );
};

const ManualModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState<'intro' | 'cards' | 'turns' | 'advanced'>('intro');

  if (!isOpen) return null;

  const tabs = [
    { id: 'intro', label: 'Básico', icon: Info },
    { id: 'cards', label: 'Cartas', icon: Layers },
    { id: 'turns', label: 'Turnos', icon: Clock },
    { id: 'advanced', label: 'Regras', icon: Scale },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0c] animate-in fade-in zoom-in duration-200">
      <div className="w-full flex-1 flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <BookOpen className="text-purple-500" /> MANUAL DE REGRAS
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-full transition">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-950 border-b border-slate-800 shrink-0 w-full">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-1 md:gap-2 px-1 md:px-6 py-4 font-bold text-[10px] md:text-sm uppercase tracking-wider transition whitespace-nowrap border-b-2 ${
                activeTab === tab.id 
                  ? (tab.id === 'advanced' ? 'border-yellow-500 text-yellow-500 bg-slate-900' : 'border-purple-500 text-white bg-slate-900') 
                  : (tab.id === 'advanced' ? 'border-transparent text-yellow-500/70 hover:text-yellow-500 hover:bg-slate-900/50' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900/50')
              }`}
            >
              <tab.icon size={16} className="shrink-0" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#0f0f13]">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {activeTab === 'intro' && (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-800">
                    <h3 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2"><CheckCircle size={20}/> O Que É Preciso</h3>
                    <ul className="space-y-3 text-slate-300 text-sm leading-relaxed">
                      <li><strong className="text-white">Deck:</strong> Composto por 30 a 35 cartas (contando com os heróis, se houver).</li>
                      <li><strong className="text-white">Restrições:</strong> Não é permitido cartas repetidas. O uso de Herói é opcional, mas se usar, apenas 1 Herói e suas variações no Deck (com exceções para heróis que interagem entre si).</li>
                      <li><strong className="text-white">Tokens:</strong> Os Tokens ficam no Deck de Heróis (máximo de 15). Quando deixam o campo, voltam para o Deck de Heróis.</li>
                      <li><strong className="text-white">Opcionais:</strong> Campo físico, marcadores de status/vida/mana e dados D6/D20 para efeitos.</li>
                    </ul>
                  </div>
                  <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-800">
                    <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2"><Info size={20}/> Status do Jogo</h3>
                    <ul className="space-y-3 text-slate-300 text-sm leading-relaxed">
                      <li><strong className="text-white">Vida:</strong> Padrão de 20 pontos. Se chegar a 0, você perde.</li>
                      <li><strong className="text-white">Mana:</strong> Padrão de 12 pontos. Se renova no começo de cada rodada.</li>
                      <li><strong className="text-white">Runas:</strong> Quantidade de recursos gerados usados para efeitos poderosos.</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-800">
                  <h3 className="text-xl font-bold text-white mb-4">Estrutura do Jogo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm text-slate-300">
                    <div>
                      <p className="mb-2"><strong className="text-purple-400">Objetivo:</strong> Reduzir a vida do oponente a 0.</p>
                      <p className="mb-2"><strong className="text-purple-400">Duelo:</strong> Melhor de 3 jogos (1x1 ou 2x2).</p>
                      <p className="mb-2"><strong className="text-purple-400">Rodadas:</strong> Cada rodada possui 2 turnos (Ataque e Defesa) para cada jogador.</p>
                    </div>
                    <div>
                      <p className="mb-2"><strong className="text-purple-400">Início:</strong> Pedra, Papel e Tesoura ou Dado para decidir quem começa.</p>
                      <p className="mb-2"><strong className="text-purple-400">Mulligan:</strong> Jogadores compram 5 cartas. Podem retornar todas e comprar 5 novas uma única vez.</p>
                      <p className="mb-2 text-yellow-500 italic">Nota: Na primeira rodada completa, nenhum combatente causa dano de combate.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cards' && (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-800">
                  <h3 className="text-xl font-bold text-white mb-4">Estrutura das Cartas</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-300">
                    <div className="p-3 bg-black/30 rounded border border-slate-700">
                      <strong className="block text-yellow-400 mb-1">Categoria (CT)</strong>
                      Custo de invocação ou uso da carta.
                    </div>
                    <div className="p-3 bg-black/30 rounded border border-slate-700">
                      <strong className="block text-white mb-1">Status</strong>
                      Ataque e Vida (apenas Combatentes e Heróis).
                    </div>
                    <div className="p-3 bg-black/30 rounded border border-slate-700">
                      <strong className="block text-purple-400 mb-1">Arquétipo</strong>
                      Classificações que dão habilidades extras.
                    </div>
                    <div className="p-3 bg-black/30 rounded border border-slate-700">
                      <strong className="block text-blue-400 mb-1">Tipo</strong>
                      Ícone identificador (Espada, Escudo, etc).
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="flex gap-4 items-start bg-slate-900/50 p-4 rounded border-l-4 border-blue-500">
                    <div className="bg-blue-900/20 p-3 rounded text-blue-500"><Sword size={24}/></div>
                    <div>
                      <h4 className="font-bold text-blue-400 text-lg">Combatente (Azul)</h4>
                      <p className="text-slate-300 text-sm">Os "monstros" comuns e auxiliares. Não são classificados como Heróis a não ser por efeitos únicos.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start bg-slate-900/50 p-4 rounded border-l-4 border-red-500">
                    <div className="bg-red-900/20 p-3 rounded text-red-500"><Crown size={24}/></div>
                    <div>
                      <h4 className="font-bold text-red-400 text-lg">Herói (Vermelho)</h4>
                      <p className="text-slate-300 text-sm">Foco do deck. Ficam no Deck de Heróis (fora do principal). Precisam de condições específicas para invocar. Limite de 1 Herói em campo (salvo exceções).</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start bg-slate-900/50 p-4 rounded border-l-4 border-green-500">
                    <div className="bg-green-900/20 p-3 rounded text-green-500"><Scale size={24}/></div>
                    <div>
                      <h4 className="font-bold text-green-400 text-lg">Equipamento (Verde)</h4>
                      <p className="text-slate-300 text-sm">Alteram status ou dão efeitos. Vinculados a um alvo. Se o alvo sai, o equipamento vai para a Zona Morta. Se um Herói é substituído, passa para o novo. Prioridade definida pelo CT (maior = mais prioridade).</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start bg-slate-900/50 p-4 rounded border-l-4 border-purple-500">
                    <div className="bg-purple-900/20 p-3 rounded text-purple-500"><Zap size={24}/></div>
                    <div>
                      <h4 className="font-bold text-purple-400 text-lg">Efeito (Roxo)</h4>
                      <p className="text-slate-300 text-sm">Cartas de uso único ou contínuo. Possuem custo e condições. Após o uso, vão para a Zona Morta.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-start bg-slate-900/50 p-4 rounded border-l-4 border-yellow-500">
                    <div className="bg-yellow-900/20 p-3 rounded text-yellow-400"><Hexagon size={24}/></div>
                    <div>
                      <h4 className="font-bold text-yellow-400 text-lg">Token (Amarelo)</h4>
                      <p className="text-slate-300 text-sm">Tokens são cartas vinculadas a cartas que se utilizam delas, só podem ser afetadas por cartas que as afetam diretamente, ocupam espaço em campo mas não declaram ataques, não possuem efeitos e não podem ser equipados. Ficam no Deck de Heróis (máximo de 15) e, quando deixam o campo, voltam para o Deck de Heróis.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'turns' && (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-800">
                  <h3 className="text-xl font-bold text-white mb-4">Estrutura da Rodada</h3>
                  <p className="text-slate-300 text-sm mb-6">
                    Formato de Ação e Reação. Quando o atacante joga, o defensor tem direito à Reação (pode usar cartas). Declarar ataque não é considerado ação padrão. Cartas usadas consomem Mana baseado no CT.
                  </p>
                  
                  <div className="relative border-l-2 border-slate-700 ml-4 space-y-8 pb-4">
                    <div className="relative pl-8">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-purple-500"></div>
                      <h4 className="font-bold text-white">1. Início de Rodada</h4>
                      <p className="text-xs text-slate-400">Recuperar Mana para 12. Comprar 1 Carta. Efeitos de Início de Turno ativam.</p>
                    </div>
                    <div className="relative pl-8">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500"></div>
                      <h4 className="font-bold text-white">2. Turno de Ataque (Jogador 1)</h4>
                      <p className="text-xs text-slate-400">J1 usa cartas &rarr; J1 Ataca &rarr; J2 Reage/Não Reage &rarr; J1 Encerra turno.</p>
                    </div>
                    <div className="relative pl-8">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-red-500"></div>
                      <h4 className="font-bold text-white">3. Turno de Ataque (Jogador 2)</h4>
                      <p className="text-xs text-slate-400">J2 usa cartas &rarr; J2 Ataca &rarr; J1 Reage/Não Reage &rarr; J2 Encerra turno.</p>
                    </div>
                    <div className="relative pl-8">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-green-500"></div>
                      <h4 className="font-bold text-white">4. Fim da Rodada</h4>
                      <p className="text-xs text-slate-400">Rodada encerra. Nova rodada inicia. Mana só recupera no começo da nova rodada.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-800">
                  <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2"><Sword size={20}/> Regras de Combate</h3>
                  <ul className="list-disc pl-5 space-y-2 text-slate-300 text-sm">
                    <li>Em seu turno, o jogador pode declarar ataque ao inimigo.</li>
                    <li>Cada combatente pode atacar uma vez normalmente (exceto efeitos).</li>
                    <li><strong>Alvos:</strong> Combatente Inimigo ou Jogador Inimigo (se não houver combatentes no campo).</li>
                    <li><strong>Cálculo:</strong> Atacante usa seu ATAQUE contra a VIDA atual do alvo. O alvo perde vida igual ao ataque.</li>
                    <li><strong>Morte:</strong> Vida reduzida a 0 = Enviado para Zona Morta.</li>
                    <li><strong>Múltiplos Ataques:</strong> Um mesmo inimigo pode ser alvo de vários combatentes.</li>
                    <li><strong>Invocação:</strong> Combatentes invocados após o primeiro ataque não podem realizar ataques no mesmo turno (exceto Heróis que se invocam).</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-800">
                    <h3 className="text-lg font-bold text-yellow-400 mb-3 flex items-center gap-2"><Layers size={18}/> Correntes (Chains)</h3>
                    <p className="text-slate-300 text-sm leading-relaxed text-justify">
                      Sequência de cartas jogadas em resposta umas às outras. A ordem de ativação é pela <strong>última carta usada</strong> (LIFO - Last In, First Out). A reação ativa antes da ação.
                      <br/><br/>
                      <strong>Prioridade de CT:</strong> Se duas cartas possuem o mesmo gatilho, a Categoria (CT) determina a prioridade. CTs mais altos têm precedência.
                    </p>
                  </div>
                  
                  <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-800">
                    <h3 className="text-lg font-bold text-purple-400 mb-3 flex items-center gap-2"><Ghost size={18}/> Sem Deck (Deck Out)</h3>
                    <p className="text-slate-300 text-sm leading-relaxed text-justify">
                      Caso o deck de um jogador acabe, ele <strong>não perde o jogo imediatamente</strong>. Em vez disso, ele perde <strong>3 de vida</strong> sempre que tiver que comprar uma carta e não puder.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-800">
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><FileText size={18}/> Observações Importantes</h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
                    <li className="flex items-start gap-2"><span className="text-purple-500">•</span> O uso de Herói é opcional, mas se usar, só é possível ter 1 Herói no Deck (com exceções para heróis que interagem entre si).</li>
                    <li className="flex items-start gap-2"><span className="text-purple-500">•</span> Vida 0 nem sempre significa fim de jogo (depende de efeitos).</li>
                    <li className="flex items-start gap-2"><span className="text-purple-500">•</span> Se retirar/voltar carta ao Deck, embaralhe.</li>
                    <li className="flex items-start gap-2"><span className="text-purple-500">•</span> Heróis retornam ao Deck de Heróis, não ao Principal.</li>
                    <li className="flex items-start gap-2"><span className="text-purple-500">•</span> Vida (20) e Mana (12) podem ser ultrapassados por efeitos.</li>
                    <li className="flex items-start gap-2"><span className="text-purple-500">•</span> Arquétipos Lúmen/Darkus podem evoluir com cartas específicas.</li>
                    <li className="flex items-start gap-2"><span className="text-purple-500">•</span> Não há limite para cartas na mão.</li>
                    <li className="flex items-start gap-2"><span className="text-yellow-400">•</span> Tokens ficam no Deck de Heróis (máximo 15), ocupam espaço em campo sem atacar ou receber equipamentos, e retornam ao Deck de Heróis ao deixar o campo.</li>
                  </ul>
                </div>

                <div className="bg-gradient-to-r from-yellow-900/20 to-amber-900/20 p-6 rounded-lg border border-yellow-700/50">
                  <h3 className="text-xl font-bold text-yellow-500 mb-4 flex items-center gap-2"><Scale size={20}/> PATCH NOTES</h3>
                  <ul className="space-y-4 text-slate-300 text-sm">
                    <li>
                      <strong className="text-yellow-500 block mb-1">1. Reações Limitadas</strong>
                      Apenas uma carta de reação a uma ação (desde que tenha mana).
                    </li>
                    <li>
                      <strong className="text-yellow-500 block mb-1">2. Correntes Inquebráveis</strong>
                      Não pode quebrar a corrente de efeitos de cartas.
                    </li>
                    <li>
                      <strong className="text-yellow-500 block mb-1">3. Ordem de Autoridade</strong>
                      Efeitos com "A Qualquer Momento" (exceto Macroversal) &gt; Dano Primordial &gt; Arquétipo &gt; Efeitos de começo de rodada &gt; Efeitos de começo de turno &gt; Efeitos normais (efeitos condicionais não se aplicam nessa ordem e devem seguir as condições).<br/>
                      <span className="text-slate-400 italic mt-1 block">Exemplo: se a carta dar 5 de dano no começo da rodada, e tiver um Conceito, ele recupera as 5 de vida antes.</span>
                    </li>
                    <li>
                      <strong className="text-yellow-500 block mb-1">4. Remoção de Alvo</strong>
                      Remover um alvo de um ataque durante o combate nega o ataque do atacante, ele não poderá atacar nesse mesmo turno.
                    </li>
                    <li>
                      <strong className="text-yellow-500 block mb-1">5. Invocação de Heróis</strong>
                      Heróis só podem ser invocados por outras cartas de invocação caso não possuam condições de invocação próprias na carta de herói. Nesses casos, deve-se cumprir a condição de invocação.
                    </li>
                    <li>
                      <strong className="text-yellow-500 block mb-1">6. Dano Primordial</strong>
                      O Dano Primordial se aplica a todas as cartas do jogador inimigo (Deck, mão ou Zonas) e deve ser aplicado quando o Herói ou Combatente é invocado, removendo a vida dele. Caso ela seja zerada, ele é enviado a Zona Morta, ignorando arquétipos e efeitos. Se ele não morrer, é invocado com menos vida (ex: toma 5 de dano primordial e tem 7 de vida, é invocado com 2 de vida). Combatentes e Heróis mortos pelo Dano Primordial não podem usar seus efeitos de campo, de invocação ou de serem eliminados por combate, pois eles oficialmente não entram em campo.
                    </li>
                    <li>
                      <strong className="text-yellow-500 block mb-1">7. Equipamentos no Inimigo</strong>
                      Equipamentos podem ser colocados no campo inimigo equipando um combatente dele (exceto se especificar na própria carta).
                    </li>
                    <li>
                      <strong className="text-yellow-500 block mb-1">8. Sinergia de Heróis</strong>
                      Heróis cujo o efeito interaja com outro herói que não possui o mesmo nome podem ser colocados no mesmo deck (exemplo Otto e Asmonious).
                    </li>
                    <li>
                      <strong className="text-yellow-500 block mb-1">9. Efeitos em Combate</strong>
                      Somente efeitos de combatentes condicionais ou com "A Qualquer Momento" podem ser usados durante o combate.<br/>
                      <span className="text-slate-400 italic mt-1 block">Ex: "Durante o combate esse combatente recebe 8 de ataque" ou "A qualquer momento, retire 3 de ataque desse combatente e remova uma carta".</span>
                    </li>
                    <li>
                      <strong className="text-yellow-500 block mb-1">10. Invocação Negada</strong>
                      Quando um Herói (do tipo que se invoca pelo próprio efeito) tem sua invocação negada, ele fica impossibilitado de ser invocado novamente até a rodada seguinte.
                    </li>
                    <li>
                      <strong className="text-yellow-500 block mb-1">11. Resoluções Automáticas</strong>
                      Não é possível responder cartas que não foram ativadas por escolha de jogador, exemplo: "Invocação do Herói Criven", nesse caso ele é tratado como resolução a ação feita, que foi invocar o herói inimigo.
                    </li>
                    <li>
                      <strong className="text-yellow-500 block mb-1">12. Efeitos Negados e Invocações</strong>
                      <div className="space-y-2">
                        <p>Cartas com "nega o efeito de carta" não podem ser usadas para negar invocação (nunca puderam), combatentes com efeitos negados perdem todos os efeitos enquanto estiverem em campo, eles se tornaram combatentes/Heróis sem efeitos.</p>
                        <p>Efeitos de combatentes podem ser negados mesmo que não estejam em uso. Ex: O efeito do Dragão da Floresta Jovem se ativa quando ele ataca e no começo da rodada, agora não precisa mais dos gatilhos para se negar o efeito dele. (a não ser que a carta diga "quando o jogador inimigo usar efeito...")</p>
                        <p>Cartas com "nega uma carta usada" podem ser usadas para negar invocações.</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

const BuyModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 w-full max-w-lg rounded-xl border border-slate-700 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={24} />
        </button>
        <div className="p-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <ShoppingCart className="text-green-500" /> Onde Comprar
          </h2>
          <div className="space-y-4">
            <a 
              href="https://mypcards.com/LightDarkCardGame" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 p-5 rounded-xl transition group shadow-lg shadow-purple-900/30 border border-purple-500/30 hover:scale-[1.02]"
            >
              <div className="flex flex-col">
                 <span className="font-bold text-white text-lg tracking-wide">MYP Cards</span>
                 <span className="text-purple-200 text-xs">Loja Oficial Online</span>
              </div>
              <ExternalLink size={20} className="text-white/80 group-hover:text-white group-hover:translate-x-1 transition-transform" />
            </a>

            <a 
              href="https://lista.mercadolivre.com.br/_CustId_3408665465?item_id=MLB6798439252&category_id=MLB432989&seller_id=3408665465&client=recoview-selleritems&recos_listing=true#origin=vip&component=sellerData&typeSeller=classic" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 p-5 rounded-xl transition group shadow-lg shadow-yellow-900/30 border border-yellow-400/40 hover:scale-[1.02]"
            >
              <div className="flex flex-col">
                 <span className="font-bold text-slate-950 text-lg tracking-wide">Mercado Livre</span>
                 <span className="text-slate-900 font-semibold text-xs">Produtos Selecionados</span>
              </div>
              <ExternalLink size={20} className="text-slate-950 group-hover:scale-110 transition-transform" />
            </a>

            <a 
              href="https://shopee.com.br/lps_cards_store" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 p-5 rounded-xl transition group shadow-lg shadow-orange-900/30 border border-orange-500/30 hover:scale-[1.02]"
            >
              <div className="flex flex-col">
                 <span className="font-bold text-white text-lg tracking-wide">Shopee</span>
                 <span className="text-orange-100 text-xs">LPS Cards Store</span>
              </div>
              <ExternalLink size={20} className="text-white/80 group-hover:text-white group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

const EASTER_EGG_SEQUENCE = [
  "2025/0001/00116",
  "2025/0001/00333",
  "2025/0001/00183",
  "2025/0001/00235",
  "2025/0001/00232",
  "2025/0001/00092",
  "2025/0001/00001",
  "2025/0001/00214"
];

const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {
    console.error("Audio context not supported", e);
  }
};

const CatalogModal = ({ 
  isOpen, 
  onClose, 
  onOpenAdmin, 
  onOpenAuth,
  isAdmin,
  tourAutoOpenCard = false
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onOpenAdmin: () => void; 
  onOpenAuth?: () => void;
  isAdmin?: boolean;
  tourAutoOpenCard?: boolean;
}) => {
  const { cards: allCards, collections, archetypes } = useCards();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [easterEggStep, setEasterEggStep] = useState(0);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [filters, setFilters] = useState({
    type: "Todos",
    archetype: "Todos",
    collection: "Todos",
    frame: "Todos",
    rarity: "Todos",
    minCt: "",
    minAtk: "",
    minDef: "",
    sortBy: "code-asc"
  });

  const [visibleCount, setVisibleCount] = useState(60);
  const [expandVariations, setExpandVariations] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset pagination when search or filters change or when modal opens
  useEffect(() => {
    setVisibleCount(60);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [searchTerm, filters, isOpen, expandVariations]);

  const handleCardClick = (card: CardData) => {
    setSelectedCard(card);
    
    if (card.code === EASTER_EGG_SEQUENCE[easterEggStep]) {
      playBeep();
      const nextStep = easterEggStep + 1;
      if (nextStep === EASTER_EGG_SEQUENCE.length) {
        setShowEasterEgg(true);
        setEasterEggStep(0);
      } else {
        setEasterEggStep(nextStep);
      }
    } else if (card.code === EASTER_EGG_SEQUENCE[0]) {
      playBeep();
      setEasterEggStep(1);
    } else {
      setEasterEggStep(0);
    }
  };

  const checkRarityMatch = (cRarityRaw?: string, cFrameRaw?: string, targetRarity?: string): boolean => {
    if (!targetRarity || targetRarity === "Todos") return true;
    const cRarity = (cRarityRaw || '').trim();
    const cFrame = cFrameRaw || 'Legado';
    if (cRarity === targetRarity) return true;
    if (targetRarity === 'Moderno Comum' && cFrame === 'Moderno' && (cRarity === 'Comum' || cRarity === 'Beta' || !cRarity)) return true;
    if (targetRarity === 'Legado Comum' && cFrame === 'Legado' && (cRarity === 'Comum' || cRarity === 'Beta' || !cRarity)) return true;
    if (targetRarity === 'Legado Incomum' && cFrame === 'Legado' && cRarity === 'Incomum') return true;
    if (targetRarity === 'Moderno Incomum' && cFrame === 'Moderno' && cRarity === 'Incomum') return true;
    if (targetRarity === 'Legado Rara' && cFrame === 'Legado' && cRarity === 'Rara') return true;
    if (targetRarity === 'Moderno Rara' && cFrame === 'Moderno' && cRarity === 'Rara') return true;
    if (targetRarity === 'Legado Muito Rara' && cFrame === 'Legado' && cRarity === 'Muito Rara') return true;
    if (targetRarity === 'Moderno Muito Rara' && cFrame === 'Moderno' && cRarity === 'Muito Rara') return true;
    if (targetRarity === 'Legado Lendária' && cFrame === 'Legado' && cRarity === 'Lendária') return true;
    if (targetRarity === 'Moderno Lendária' && cFrame === 'Moderno' && cRarity === 'Lendária') return true;
    if (targetRarity === 'Legado Limitada' && cFrame === 'Legado' && (cRarity === 'Limitada' || cRarity === 'Limitadas')) return true;
    if (targetRarity === 'Moderno Limitada' && cFrame === 'Moderno' && (cRarity === 'Limitada' || cRarity === 'Limitadas')) return true;
    if (targetRarity === 'Moderno Macroversal' && (cRarity === 'Macroversal' || cRarity === 'Moderno Macroversal')) return true;
    return false;
  };

  const filteredCards = useMemo(() => {
    // Agrupa allCards estritamente pelo código base para que variações (skins, artes alternativas,
    // mesmo de outras coleções como LOUCURAS CAÓTICAS) usem o MESMO ESPAÇO no catálogo como variação!
    const groupedByCard = new Map<string, CardData[]>();
    for (const card of allCards) {
      const baseCode = getBaseCardCode(card.code, card.parentCode);
      const key = baseCode;
      if (!groupedByCard.has(key)) {
        groupedByCard.set(key, []);
      }
      groupedByCard.get(key)!.push(card);
    }

    // Para cada grupo de carta única, escolhe a carta principal baseando-se no filtro e prioridade
    const catalogCards: CardData[] = [];
    groupedByCard.forEach((group) => {
      let chosenCard: CardData;

      const anyCoverUrl = group.find(c => c.catalogCoverImageUrl)?.catalogCoverImageUrl;
      const anyCoverFrame = group.find(c => c.catalogCoverFrame)?.catalogCoverFrame;

      // 1. PRIORIDADE MÁXIMA: Capa manual definida pelo Administrador
      let manualCover: CardData | undefined = group.find(c => 
        c.isCatalogCover || 
        (anyCoverUrl && c.imageUrl === anyCoverUrl)
      );
      if (!manualCover && anyCoverUrl) {
        for (const c of group) {
          const v = c.variants?.find(v => v.imageUrl === anyCoverUrl);
          if (v) {
            const vRare = Boolean(v.isRarePrint || v.requiresAdminVerification);
            manualCover = {
              ...c,
              id: v.id || c.id,
              imageUrl: v.imageUrl,
              frame: v.frame || anyCoverFrame || c.frame || 'Moderno',
              variationType: v.name || c.variationType,
              rarity: v.rarity || c.rarity,
              isCatalogCover: true,
              isRarePrint: vRare,
              requiresAdminVerification: vRare,
              maxPrintCopies: vRare ? (v.maxPrintCopies || 1) : 0
            };
            break;
          }
        }
      }

      if (filters.frame === 'Legado') {
        const legacyMatch = group.find(c => (c.frame || 'Legado') === 'Legado' && !c.code?.endsWith('-M'));
        if (legacyMatch) {
          chosenCard = { ...legacyMatch, frame: 'Legado' };
        } else {
          let foundVariant: any = null;
          for (const c of group) {
            const v = c.variants?.find(v => (v.frame || 'Legado') === 'Legado');
            if (v) {
              const vRare = Boolean(v.isRarePrint || v.requiresAdminVerification);
              foundVariant = {
                ...c,
                imageUrl: v.imageUrl,
                frame: 'Legado',
                variationType: v.name,
                rarity: v.rarity || c.rarity,
                isRarePrint: vRare,
                requiresAdminVerification: vRare,
                maxPrintCopies: vRare ? (v.maxPrintCopies || 1) : 0
              };
              break;
            }
          }
          chosenCard = foundVariant || group[0];
        }
      } else if (filters.frame === 'Moderno') {
        const modernMatch = group.find(c => c.frame === 'Moderno' || (c.code && c.code.endsWith('-M')));
        if (modernMatch) {
          chosenCard = { ...modernMatch, frame: 'Moderno' };
        } else {
          let foundVariant: any = null;
          for (const c of group) {
            const v = c.variants?.find(v => v.frame === 'Moderno');
            if (v) {
              const vRare = Boolean(v.isRarePrint || v.requiresAdminVerification);
              foundVariant = {
                ...c,
                imageUrl: v.imageUrl,
                frame: 'Moderno',
                variationType: v.name || 'Novo Frame',
                rarity: v.rarity || c.rarity,
                isRarePrint: vRare,
                requiresAdminVerification: vRare,
                maxPrintCopies: vRare ? (v.maxPrintCopies || 1) : 0
              };
              break;
            }
          }
          chosenCard = foundVariant || group[0];
        }
      } else if (manualCover) {
        chosenCard = manualCover;
      } else {
        let candidates = group;
        if (filters.collection !== 'Todos') {
          const colMatches = group.filter(c => c.collection === filters.collection);
          if (colMatches.length > 0) {
            candidates = colMatches;
          }
        }

        // Quando filters.frame === 'Todos' e não há capa manual:
        // No catálogo geral, se a carta possui versão moderna (ou variação moderna), exibe o Frame Moderno na capa por padrão!
        const modernBase = candidates.find(c => c.frame === 'Moderno' || (c.code && c.code.endsWith('-M')));
        let modernVariant: any = null;
        if (!modernBase) {
          for (const c of candidates) {
            const v = c.variants?.find(v => v.frame === 'Moderno' || v.name?.toLowerCase().includes('moderno') || v.name?.toLowerCase().includes('novo frame'));
            if (v) {
              const vRare = Boolean(v.isRarePrint || v.requiresAdminVerification);
              modernVariant = {
                ...c,
                imageUrl: v.imageUrl,
                frame: 'Moderno',
                variationType: v.name || 'Novo Frame',
                rarity: v.rarity || c.rarity,
                isRarePrint: vRare,
                requiresAdminVerification: vRare,
                maxPrintCopies: vRare ? (v.maxPrintCopies || 1) : 0
              };
              break;
            }
          }
        }
        const legacyBase = candidates.find(c => (c.frame || 'Legado') === 'Legado' && !c.code?.endsWith('-M'));

        chosenCard = modernBase || modernVariant || legacyBase || candidates[0];
      }

      // Se um filtro de raridade ou coleção específico está ativo e a capa escolhida não corresponde,
      // mas existe uma variação que corresponde ao filtro, destaca a variação correspondente na capa!
      if (filters.rarity !== 'Todos' && !checkRarityMatch(chosenCard.rarity, chosenCard.frame, filters.rarity)) {
        for (const c of group) {
          const v = c.variants?.find(v =>
            checkRarityMatch(v.rarity || c.rarity, v.frame || c.frame, filters.rarity) &&
            (filters.frame === 'Todos' || (v.frame || 'Legado') === filters.frame)
          );
          if (v) {
            const vRare = Boolean(v.isRarePrint || v.requiresAdminVerification);
            chosenCard = {
              ...c,
              imageUrl: v.imageUrl,
              frame: v.frame || c.frame || 'Moderno',
              variationType: v.name || c.variationType,
              rarity: v.rarity || c.rarity,
              collection: v.collection || c.collection,
              isRarePrint: vRare,
              requiresAdminVerification: vRare,
              maxPrintCopies: vRare ? (v.maxPrintCopies || 1) : 0
            };
            break;
          }
        }
      }

      // Consolida todas as variações deste grupo dentro de chosenCard.variants (sem perder nenhuma skin/variação)
      const allVariants: any[] = [];
      group.forEach(item => {
        if (item.variants && item.variants.length > 0) {
          item.variants.forEach(v => {
            if (v.imageUrl && v.imageUrl !== chosenCard.imageUrl && !allVariants.some(existing => existing.imageUrl === v.imageUrl)) {
              allVariants.push({
                ...v,
                code: cleanCardCode(v.code || item.code)
              });
            }
          });
        }
        if (item.imageUrl && item.imageUrl !== chosenCard.imageUrl) {
          if (!allVariants.some(existing => existing.imageUrl === item.imageUrl)) {
            const itemRare = Boolean(item.isRarePrint || item.requiresAdminVerification);
            allVariants.push({
              id: item.id || `var_${item.code}`,
              name: item.variationType || (item.frame === 'Moderno' ? 'Novo Frame' : 'Legado'),
              imageUrl: item.imageUrl,
              frame: item.frame || (isLegacyCard(item) ? 'Legado' : 'Moderno'),
              code: cleanCardCode(item.code),
              collection: item.collection,
              rarity: item.rarity,
              tier: item.tier,
              isCatalogCover: Boolean(anyCoverUrl && item.imageUrl === anyCoverUrl),
              isRarePrint: itemRare,
              requiresAdminVerification: itemRare,
              maxPrintCopies: itemRare ? (item.maxPrintCopies || 1) : 0
            });
          }
        }
      });

      const chosenRare = Boolean(chosenCard.isRarePrint || chosenCard.requiresAdminVerification);

      const cardWithVariants: CardData = {
        ...chosenCard,
        catalogCoverImageUrl: anyCoverUrl || chosenCard.catalogCoverImageUrl,
        catalogCoverFrame: anyCoverFrame || chosenCard.catalogCoverFrame,
        isCatalogCover: Boolean(anyCoverUrl && chosenCard.imageUrl === anyCoverUrl),
        isRarePrint: chosenRare,
        requiresAdminVerification: chosenRare,
        maxPrintCopies: chosenRare ? (chosenCard.maxPrintCopies || 1) : 0,
        code: cleanCardCode(chosenCard.code),
        variants: allVariants
      };

      catalogCards.push(cardWithVariants);
    });

    return catalogCards.filter(card => {
      const searchLower = (searchTerm || "").toLowerCase();
      const matchesSearch = !searchLower ||
        (card.name || "").toLowerCase().includes(searchLower) || 
        (card.code || "").toLowerCase().includes(searchLower) ||
        (card.description || "").toLowerCase().includes(searchLower) ||
        (card.collection || "").toLowerCase().includes(searchLower) ||
        Boolean(card.variants && card.variants.some((v: any) =>
          (v.name || "").toLowerCase().includes(searchLower) ||
          (v.code || "").toLowerCase().includes(searchLower) ||
          (v.collection || "").toLowerCase().includes(searchLower)
        ));

      const matchesType = filters.type === "Todos" || card.type === filters.type;
      const matchesArchetype = filters.archetype === "Todos" || (card.archetype || "").includes(filters.archetype);
      
      // Se filtrando por coleção, verifica se a carta ou alguma de suas variações pertence a essa coleção
      const matchesCollection = filters.collection === "Todos" || 
        card.collection === filters.collection ||
        Boolean(card.variants && card.variants.some((v: any) => v.collection === filters.collection));

      const matchesFrame = filters.frame === "Todos" ||
        (card.frame || "Legado") === filters.frame ||
        Boolean(card.variants && card.variants.some((v: any) => (v.frame || "Legado") === filters.frame));

      const matchesRarity = filters.rarity === "Todos" ||
        checkRarityMatch(card.rarity, card.frame, filters.rarity) ||
        Boolean(card.variants && card.variants.some((v: any) => checkRarityMatch(v.rarity || card.rarity, v.frame || card.frame, filters.rarity)));

      const matchesCt = filters.minCt === "" || card.ct === parseInt(filters.minCt);
      
      // Exact match for ATK and DEF
      const matchesAtk = filters.minAtk === "" || (card.attack !== undefined && card.attack === parseInt(filters.minAtk));
      const matchesDef = filters.minDef === "" || (card.defense !== undefined && card.defense === parseInt(filters.minDef));

      return matchesSearch && matchesType && matchesArchetype && matchesCollection && matchesFrame && matchesRarity && matchesCt && matchesAtk && matchesDef;
    }).sort((a, b) => {
      switch (filters.sortBy) {
        case 'code-desc':
          return compareCardCodes(b.code, a.code) || (b.name || '').localeCompare(a.name || '');
        case 'name-asc':
          return (a.name || '').localeCompare(b.name || '') || compareCardCodes(a.code, b.code);
        case 'name-desc':
          return (b.name || '').localeCompare(a.name || '') || compareCardCodes(a.code, b.code);
        case 'ct-asc':
          return (a.ct || 0) - (b.ct || 0) || compareCardCodes(a.code, b.code);
        case 'ct-desc':
          return (b.ct || 0) - (a.ct || 0) || compareCardCodes(a.code, b.code);
        case 'atk-desc':
          return (b.attack || 0) - (a.attack || 0) || compareCardCodes(a.code, b.code);
        case 'def-desc':
          return (b.defense || 0) - (a.defense || 0) || compareCardCodes(a.code, b.code);
        case 'code-asc':
        default:
          return compareCardCodes(a.code, b.code) || (a.name || '').localeCompare(b.name || '');
      }
    });
  }, [allCards, searchTerm, filters]);

  // Lista expandida com todas as variações correspondentes aos filtros ativos (para soma total exata e opção de visualização expandida)
  const expandedFilteredCards = useMemo(() => {
    const list: CardData[] = [];
    for (const card of filteredCards) {
      const seenUrls = new Set<string>();
      const candidateVersions: CardData[] = [];

      if (card.imageUrl) {
        seenUrls.add(card.imageUrl);
        candidateVersions.push(card);
      }

      if (card.variants && card.variants.length > 0) {
        for (const v of card.variants) {
          if (!v.imageUrl || seenUrls.has(v.imageUrl)) continue;
          seenUrls.add(v.imageUrl);
          const vFrame = v.frame || (isLegacyCard(card) ? 'Moderno' : 'Legado');
          const vRare = Boolean(v.isRarePrint || v.requiresAdminVerification);
          candidateVersions.push({
            ...card,
            id: v.id || `var_${v.code || card.code}_${candidateVersions.length}`,
            code: cleanCardCode(v.code || card.code),
            imageUrl: v.imageUrl,
            frame: vFrame,
            variationType: v.name,
            collection: v.collection || card.collection,
            rarity: v.rarity || card.rarity,
            isVariation: true,
            isCatalogCover: Boolean(v.isCatalogCover),
            isRarePrint: vRare,
            requiresAdminVerification: vRare,
            maxPrintCopies: vRare ? (v.maxPrintCopies || 1) : 0
          });
        }
      }

      const matchingVersions = candidateVersions.filter(ver => {
        const verFrameMatch = filters.frame === "Todos" || (ver.frame || "Legado") === filters.frame;
        const verColMatch = filters.collection === "Todos" || (ver.collection || card.collection) === filters.collection;
        const verRarityMatch = filters.rarity === "Todos" || checkRarityMatch(ver.rarity, ver.frame, filters.rarity);
        return verFrameMatch && verColMatch && verRarityMatch;
      });

      if (matchingVersions.length > 0) {
        list.push(...matchingVersions);
      } else {
        list.push(card);
      }
    }
    return list;
  }, [filteredCards, filters.frame, filters.collection, filters.rarity]);

  const totalVariationsCount = expandedFilteredCards.length;
  const activeGridCards = expandVariations ? expandedFilteredCards : filteredCards;

  // Infinite scroll intersection observer for ultra-fast progressive card loading
  useEffect(() => {
    if (!isOpen || visibleCount >= activeGridCards.length) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 40, activeGridCards.length));
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '500px',
        threshold: 0.01,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isOpen, visibleCount, activeGridCards.length]);

  const [isTopBarMinimized, setIsTopBarMinimized] = useState(false);

  const handleCatalogScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop > 35 && !isTopBarMinimized) {
      setIsTopBarMinimized(true);
    }
    if (visibleCount >= activeGridCards.length) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 600) {
      setVisibleCount((prev) => Math.min(prev + 40, activeGridCards.length));
    }
  };

  const displayedCards = activeGridCards.slice(0, visibleCount);

  useLayoutEffect(() => {
    if (!isOpen) return;
    setIsTopBarMinimized(false);
    if (tourAutoOpenCard) {
      const sample = displayedCards[0] || allCards[0] || null;
      if (sample) {
        setSelectedCard(sample);
      }
    } else {
      setSelectedCard(null);
    }
  }, [isOpen, tourAutoOpenCard]);

  if (!isOpen) return null;

  return (
    <div data-tour-id="tour-catalog-open-view" className="fixed inset-0 z-[70] flex flex-col bg-slate-950 animate-in fade-in duration-200">
      
      {/* Use the new extracted component */}
      {selectedCard && (
        <CardDetailModal 
          card={selectedCard} 
          onClose={() => setSelectedCard(null)} 
          onSelectRelated={(related) => handleCardClick(related)}
          onOpenAuth={() => onOpenAuth?.()}
        />
      )}

      {/* Easter Egg Modal */}
      {showEasterEgg && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-slate-900 border-2 border-purple-500 rounded-2xl p-8 max-w-md w-full text-center shadow-[0_0_30px_rgba(168,85,247,0.4)]">
            <h3 className="text-2xl font-black text-white mb-4 animate-pulse">O Caminho foi Revelado</h3>
            <p className="text-slate-300 mb-8 text-lg">
              Parabéns, você está no caminho certo, pegue seu prêmio!
            </p>
            <a 
              href="https://drive.google.com/file/d/1gB661Rzj3zvXfD9-5NeIDq2acyPniU1x/view?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-8 rounded-full transition-all hover:scale-105 hover:shadow-[0_0_15px_rgba(168,85,247,0.6)]"
              onClick={() => setShowEasterEgg(false)}
            >
              Resgatar Prêmio
            </a>
            <button 
              onClick={() => setShowEasterEgg(false)}
              className="block w-full mt-4 text-slate-500 hover:text-slate-400 text-sm"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {isTopBarMinimized ? (
        <div className="bg-[#070510]/95 border-b border-amber-500/35 px-3 py-1 flex items-center justify-center shrink-0 relative z-20 shadow-md">
          <button
            type="button"
            onClick={() => setIsTopBarMinimized(false)}
            className="px-4 py-0.5 rounded-full bg-purple-950/80 hover:bg-purple-900 border border-amber-500/45 text-amber-300 hover:text-white transition flex items-center gap-1.5 text-[10px] font-cyber font-bold uppercase tracking-wider shadow cursor-pointer"
            title="Expandir barra superior do Catálogo"
          >
            <ChevronDown size={15} className="text-amber-400 animate-bounce" />
          </button>
        </div>
      ) : (
        <>
          <div className="bg-[#070510]/95 border-b border-amber-500/35 p-4 flex flex-wrap justify-between items-center gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.85)] z-20 relative">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-2 bg-purple-950/80 border border-amber-500/45 text-amber-300 shadow-[0_0_12px_rgba(212,175,55,0.25)]">
                <BookOpen size={20} className="shrink-0" />
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.24em] text-cyan-400">
                  MATRIZ DE DADOS // GRIMÓRIO DE CARTAS
                </div>
                <h2 className="text-xl sm:text-2xl font-cinzel font-black text-amber-50 flex flex-wrap items-center gap-2.5">
                  <span>Catálogo de Cartas</span>
                  <span className="text-amber-300 text-xs font-mono font-bold bg-purple-950/80 border border-amber-500/40 px-2.5 py-0.5">
                    {totalVariationsCount} REGISTROS
                  </span>
                  {isAdmin && !expandVariations && totalVariationsCount !== filteredCards.length && (
                    <span className="text-slate-500 text-xs font-mono font-normal">
                      ({filteredCards.length} cartas base agrupadas)
                    </span>
                  )}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setExpandVariations(prev => !prev)}
                className={`cyber-arcane-btn px-3.5 py-1.5 text-xs font-cyber font-bold uppercase tracking-wider border transition flex items-center gap-1.5 ${
                  expandVariations
                    ? 'bg-purple-900/60 border-amber-400 text-amber-200 shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                    : 'bg-[#0c0a18] border-purple-500/35 text-slate-300 hover:text-white hover:border-amber-400/60'
                }`}
                title={expandVariations ? 'Agrupar variações na mesma carta' : 'Mostrar todas as variações individualmente na grade'}
              >
                <Layers size={14} className={expandVariations ? 'text-amber-400' : 'text-cyan-400'} />
                {expandVariations ? 'Agrupar Variações' : 'Mostrar Todas as Variações'}
              </button>
              {isAdmin && (
                <button 
                  onClick={onOpenAdmin} 
                  className="p-2 bg-[#0c0a18] border border-purple-500/35 hover:border-amber-400/60 text-slate-400 hover:text-amber-200 transition"
                  title="Admin do Catálogo"
                >
                  <Settings size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsTopBarMinimized(true)}
                className="p-2 bg-[#0c0a18] border border-purple-500/35 hover:border-amber-400/60 text-slate-400 hover:text-amber-200 transition"
                title="Minimizar barra superior"
              >
                <ChevronUp size={18} />
              </button>
              <button onClick={onClose} className="p-2 bg-[#0c0a18] border border-amber-500/35 hover:border-rose-500/60 text-slate-300 hover:text-white transition">
                <X size={20} />
              </button>
            </div>
          </div>

      <div className="bg-[#080612]/90 border-b border-purple-500/25 p-4 flex flex-col xl:flex-row gap-4 z-10">
        <div className="flex items-center bg-[#05040a] border border-amber-500/35 overflow-hidden w-full xl:w-80 shrink-0">
          <Search className="ml-3 text-amber-400/80 shrink-0" size={18} />
          <input 
            type="text" 
            placeholder="Nome, Código ou Palavra Chave..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent py-2 pl-2 pr-4 text-white focus:outline-none transition"
          />
        </div>

        <div className="flex flex-col md:flex-row flex-wrap gap-2 items-start md:items-center flex-1">
          {/* Row 1 Mobile: Collection / Type */}
          <div className="flex w-full md:w-auto gap-2">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 flex-1 md:flex-none">
              <span className="text-xs text-slate-500 uppercase font-bold"><Box size={14}/></span>
              <select 
                className="bg-purple-950 text-sm text-white outline-none cursor-pointer rounded px-2 w-full md:w-40"
                value={filters.collection}
                onChange={(e) => setFilters({...filters, collection: e.target.value})}
              >
                <option className="bg-purple-950" value="Todos">Todas as Coleções</option>
                {collections.map(c => <option className="bg-purple-950" key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 flex-1 md:flex-none">
              <span className="text-xs text-slate-500 uppercase font-bold">Frame</span>
              <select 
                className="bg-purple-950 text-sm text-white outline-none cursor-pointer rounded px-2 w-full md:w-32"
                value={filters.frame}
                onChange={(e) => setFilters({...filters, frame: e.target.value})}
              >
                <option className="bg-purple-950" value="Todos">Todos</option>
                <option className="bg-purple-950" value="Legado">Legado</option>
                <option className="bg-purple-950" value="Moderno">Moderno</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 flex-1 md:flex-none">
              <span className="text-xs text-slate-500 uppercase font-bold">Raridade</span>
              <select 
                className="bg-purple-950 text-sm text-white outline-none cursor-pointer rounded px-2 w-full md:w-44"
                value={filters.rarity}
                onChange={(e) => setFilters({...filters, rarity: e.target.value})}
              >
                <option className="bg-purple-950" value="Todos">Todas as Raridades</option>
                <optgroup label="Frame Moderno" className="bg-purple-950 font-bold text-amber-300">
                  {MODERNO_RARITIES.map(r => (
                    <option key={r} value={r} className="bg-purple-950 text-white font-normal">
                      {r} {r === 'Moderno Macroversal' ? '★ (1/ano)' : ''}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Frame Legado" className="bg-purple-950 font-bold text-cyan-300">
                  {LEGADO_RARITIES.map(r => (
                    <option key={r} value={r} className="bg-purple-950 text-white font-normal">
                      {r}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 flex-1 md:flex-none">
              <Filter size={14} className="text-slate-500" />
              <select 
                className="bg-purple-950 text-sm text-white outline-none cursor-pointer rounded px-2 w-full"
                value={filters.type}
                onChange={(e) => setFilters({...filters, type: e.target.value})}
              >
                <option className="bg-purple-950" value="Todos">Todos os Tipos</option>
                <option className="bg-purple-950" value="Herói">Herói</option>
                <option className="bg-purple-950" value="Combatente">Combatente</option>
                <option className="bg-purple-950" value="Equipamento">Equipamento</option>
                <option className="bg-purple-950" value="Efeito">Efeito</option>
                <option className="bg-purple-950" value="Token">Token</option>
              </select>
            </div>
          </div>

          {/* Row 2 Mobile: Archetype / Stats / Clear */}
          <div className="flex w-full md:w-auto gap-2 flex-wrap items-center">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 flex-1 md:flex-none min-w-[120px]">
              <span className="text-xs text-slate-500 uppercase font-bold">Arquétipo</span>
              <select 
                className="bg-purple-950 text-sm text-white outline-none cursor-pointer w-full md:w-32 rounded px-2"
                value={filters.archetype}
                onChange={(e) => setFilters({...filters, archetype: e.target.value})}
              >
                <option className="bg-purple-950" value="Todos">Todos</option>
                {archetypes.map(a => <option className="bg-purple-950" key={a.name} value={a.name}>{a.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-1 md:flex-none">
              <input 
                type="number" 
                placeholder="CT" 
                className="w-full md:w-16 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white focus:border-purple-500 outline-none"
                value={filters.minCt}
                onChange={(e) => setFilters({...filters, minCt: e.target.value})}
              />
              <input 
                type="number" 
                placeholder="ATK" 
                className="w-full md:w-16 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white focus:border-red-500 outline-none"
                value={filters.minAtk}
                onChange={(e) => setFilters({...filters, minAtk: e.target.value})}
              />
              <input 
                type="number" 
                placeholder="VIDA" 
                className="w-full md:w-16 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 outline-none"
                value={filters.minDef}
                onChange={(e) => setFilters({...filters, minDef: e.target.value})}
              />
            </div>
          
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 flex-1 md:flex-none">
              <ArrowDownAZ size={14} className="text-purple-400 shrink-0" />
              <span className="text-xs text-slate-500 uppercase font-bold shrink-0">Ordem</span>
              <select 
                className="bg-purple-950 text-sm text-white outline-none cursor-pointer rounded px-2 w-full md:w-44"
                value={filters.sortBy}
                onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
              >
                <option className="bg-purple-950" value="code-asc">Código (Crescente)</option>
                <option className="bg-purple-950" value="code-desc">Código (Decrescente)</option>
                <option className="bg-purple-950" value="name-asc">Nome (A - Z)</option>
                <option className="bg-purple-950" value="name-desc">Nome (Z - A)</option>
                <option className="bg-purple-950" value="ct-asc">CT (Menor &gt; Maior)</option>
                <option className="bg-purple-950" value="ct-desc">CT (Maior &gt; Menor)</option>
                <option className="bg-purple-950" value="atk-desc">ATK (Maior)</option>
                <option className="bg-purple-950" value="def-desc">VIDA (Maior)</option>
              </select>
            </div>
          
            <button 
              onClick={() => {
                setFilters({ type: "Todos", archetype: "Todos", collection: "Todos", frame: "Todos", rarity: "Todos", minCt: "", minAtk: "", minDef: "", sortBy: "code-asc" });
                setSearchTerm("");
              }}
              className="text-xs text-slate-400 hover:text-white underline ml-auto md:ml-2 whitespace-nowrap"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>
      </>
      )}

      <div
        ref={scrollContainerRef}
        onScroll={handleCatalogScroll}
        className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#0a0a0c]"
      >
        {activeGridCards.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 md:gap-8 justify-items-center">
              {displayedCards.map((card, idx) => (
                <div
                  key={`${card.code || card.name}_${card.imageUrl || ''}_${card.frame || ''}_${idx}`}
                  data-tour-id={idx === 0 ? 'tour-catalog-first-card' : undefined}
                  className="scale-[0.65] md:scale-90 origin-top w-full flex justify-center -mb-24 md:mb-0"
                  onClick={() => handleCardClick(card)}
                >
                   <Card {...card} priority={idx < 28} />
                </div>
              ))}
            </div>

            {visibleCount < activeGridCards.length && (
              <div ref={sentinelRef} className="h-20 w-full flex items-center justify-center pt-8 pb-4">
                <button
                  type="button"
                  onClick={() => setVisibleCount(activeGridCards.length)}
                  className="flex items-center gap-2 text-xs font-mono text-purple-300 hover:text-white bg-slate-900/90 hover:bg-purple-950/80 px-4 py-2 rounded-full border border-purple-700/40 transition cursor-pointer"
                >
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                  Carregando mais cartas ({displayedCards.length} de {activeGridCards.length}) — Clique para mostrar todas
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <Ghost size={64} className="mb-4 opacity-50" />
            <p className="text-xl font-bold">Nenhuma carta encontrada</p>
            <p className="text-sm">Tente ajustar seus filtros de busca.</p>
          </div>
        )}
      </div>
    </div>
  );
};



const defaultModernShowcase: CardData[] = [
  {
    name: "Mahina - O Arauto do Véu",
    type: "Herói",
    archetype: "Véu / Caos",
    collection: "Invasão do Caos",
    ct: 11,
    attack: 12,
    defense: 12,
    description: "Arauto Supremo do Véu. Enquanto estiver em campo, manipula o fluxo do espaço e do tempo.",
    imageUrl: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0120804533.firebasestorage.app/o/wb_images%2F1788736620932_Prancheta%2014.png?alt=media&token=efac4eed-1323-40d1-a15c-9687c910a9b2",
    code: "2026/0001/00301",
    frame: "Moderno"
  },
  {
    name: "Arthemiel do Véu",
    type: "Combatente",
    archetype: "Véu",
    collection: "Invasão do Caos",
    ct: 9,
    attack: 10,
    defense: 9,
    description: "Combatente das sombras do Véu que dissipa magias de combate dos adversários.",
    imageUrl: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0120804533.firebasestorage.app/o/wb_images%2F1788736640296_Prancheta%2024.png?alt=media&token=aadd5a29-3fe7-4782-a975-03b4600fe18c",
    code: "2026/0001/00302",
    frame: "Moderno"
  },
  {
    name: "ESCUDO DA PALADINA",
    type: "Efeito",
    archetype: "Solador",
    collection: "Invasão do Caos",
    ct: 4,
    attack: 0,
    defense: 0,
    description: "Uma vez por rodada, anula o dano total direcionado a um combatente aliado.",
    imageUrl: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0120804533.firebasestorage.app/o/wb_images%2F1781635147380_Prancheta%20322.webp?alt=media&token=19ad976b-5699-48b7-8146-7854d11f0975",
    code: "2026_0001_00395",
    frame: "Moderno"
  },
  {
    name: "Canhão Macroversal",
    type: "Equipamento",
    archetype: "Macroversal",
    collection: "Invasão do Caos",
    ct: 6,
    attack: 0,
    defense: 0,
    description: "O combatente equipado recebe +8 de ataque em ataques frontais e dispara contra a zona de reserva.",
    imageUrl: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0120804533.firebasestorage.app/o/wb_images%2F1781635874862_Prancheta%20542.webp?alt=media&token=a10de265-f51e-4ad5-8e78-a028d38c0da4",
    code: "2026_0001_00417",
    frame: "Moderno"
  }
];

const defaultExclusiveProducts: ExclusiveProduct[] = [
  {
    title: "Deck Halloween - Invasão das Sombras",
    badge: "Edição Especial Halloween",
    description: "Adquira o Deck Temático de Halloween completo pronto para jogar com criaturas das trevas e magias sombrias. Escolha entre a versão Normal tradicional e a cobiçada versão Full Foil 100% holográfica!",
    mediaType: "video",
    mediaUrl: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0120804533.firebasestorage.app/o/home_videos%2FSeamless_looping_video_from_image_202606031804%20(1).mp4?alt=media&token=efbb7217-ad2c-466f-bb35-55903af9b685",
    mediaList: [
      {
        type: "video",
        url: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0120804533.firebasestorage.app/o/home_videos%2FSeamless_looping_video_from_image_202606031804%20(1).mp4?alt=media&token=efbb7217-ad2c-466f-bb35-55903af9b685"
      },
      {
        type: "image",
        url: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0120804533.firebasestorage.app/o/wb_images%2F1788736620932_Prancheta%2014.png?alt=media&token=efac4eed-1323-40d1-a15c-9687c910a9b2"
      }
    ],
    cardCodes: "eyJtYWluIjpbIjIwMjUvMDAwMS8wMDAwMSIsIjIwMjUvMDAwMS8wMDAwMiIsIjIwMjUvMDAwMS8wMDAwMiIsIjIwMjUvMDAwMS8wMDAwMyIsIjIwMjUvMDAwMS8wMDAwNCIsIjIwMjUvMDAwMS8wMDAwNSJdLCJzaWRlIjpbIjIwMjUvMDAwMS8wMDAwNiJdfQ==",
    price: "R$ 89,90",
    priceVariations: [
      {
        name: "Versão Normal",
        price: "R$ 89,90",
        badge: "Padrão",
        description: "Acabamento tradicional não-foil com todas as cartas inclusas",
        buttonLink: "https://mpago.la/1FZ3Mip",
        isDefault: true
      },
      {
        name: "Versão Full Foil",
        price: "R$ 149,90",
        badge: "Full Foil",
        description: "Edição Especial Halloween: 100% das cartas do deck com acabamento holográfico Full Foil",
        buttonLink: "https://mpago.la/1FZ3Mip",
        isDefault: false
      }
    ],
    buttonText: "Comprar Agora",
    buttonLink: "https://mpago.la/1FZ3Mip",
    noLinkMessage: "PRÉ VENDA DE HALLOWEEN ABRE EM 15/10",
    isButtonActive: true,
    isActive: true
  }
];

export default function App() {
  const { cards: allCards, collections, archetypes } = useCards();
  const { user, isAdmin, logout, changeDisplayName } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [storeInitialTab, setStoreInitialTab] = useState<'vitrine' | 'carrinho'>('vitrine');
  const [storeInitialOrderId, setStoreInitialOrderId] = useState<string | null>(null);
  const [storeInitialListingId, setStoreInitialListingId] = useState<string | null>(null);
  const [storeInitialVariationIdx, setStoreInitialVariationIdx] = useState<number | undefined>(undefined);
  const [pendingProductSlug, setPendingProductSlug] = useState<{ slug: string; varIdx?: number } | null>(null);
  const [cartCount, setCartCount] = useState<number>(() => {
    return getCartItems().reduce((sum, i) => sum + i.quantity, 0);
  });
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isLoreOpen, setIsLoreOpen] = useState(false);
  const [isDeckBuilderOpen, setIsDeckBuilderOpen] = useState(false);
  const [isAlbumOpen, setIsAlbumOpen] = useState(false);
  const [isSavedDecksOpen, setIsSavedDecksOpen] = useState(false);
  const [isPopularCardsOpen, setIsPopularCardsOpen] = useState(false);
  const [isCollectorsRankingOpen, setIsCollectorsRankingOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [isTournamentOpen, setIsTournamentOpen] = useState(false);
  const [activeTournamentId, setActiveTournamentId] = useState<string | undefined>(undefined);
  const [isChampionshipHistoryOpen, setIsChampionshipHistoryOpen] = useState(false);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [targetUserProfile, setTargetUserProfile] = useState<TargetUserProfile | null>(null);
  const [userProfileInitialTab, setUserProfileInitialTab] = useState<'wishlist' | 'most_wanted' | 'stats' | 'verifications' | 'orders'>('wishlist');

  const openUserProfile = (profile?: TargetUserProfile | null, tab: 'wishlist' | 'most_wanted' | 'stats' | 'verifications' | 'orders' = 'wishlist') => {
    setTargetUserProfile(profile || null);
    setUserProfileInitialTab(tab);
    setIsUserProfileOpen(true);
  };
  const [adminMode, setAdminMode] = useState<'none' | 'home' | 'catalog' | 'master' | 'store'>('none');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const DEFAULT_SHOWCASE_CARDS: CardData[] = [
    {
      code: 'LD-HERO-01',
      name: 'Herói',
      type: 'Herói' as CardType,
      archetype: 'Liderança',
      collection: 'Deck de Heróis',
      ct: 0,
      frame: 'Moderno',
      description: 'Heróis lideram a batalha, possuem pontos de vida próprios e habilidades que definem a estratégia do seu deck.',
      imageUrl: ''
    },
    {
      code: 'LD-COMB-01',
      name: 'Combatente',
      type: 'Combatente' as CardType,
      archetype: 'Vanguarda',
      collection: 'Deck Principal',
      ct: 2,
      frame: 'Moderno',
      description: 'Combatentes são invocados ao campo para atacar, defender e executar sinergias diretas com seus Heróis.',
      imageUrl: ''
    },
    {
      code: 'LD-EFF-01',
      name: 'Efeito',
      type: 'Efeito' as CardType,
      archetype: 'Arcano',
      collection: 'Deck Principal',
      ct: 1,
      frame: 'Moderno',
      description: 'Cartas de Efeito alteram o rumo do turno com magias, respostas rápidas e manipulações táticas do campo.',
      imageUrl: ''
    },
    {
      code: 'LD-EQUIP-01',
      name: 'Equipamento',
      type: 'Equipamento' as CardType,
      archetype: 'Arsenal',
      collection: 'Deck Principal',
      ct: 1,
      frame: 'Moderno',
      description: 'Equipamentos fortalecem Heróis ou Combatentes com bônus permanentes e habilidades especiais acopladas.',
      imageUrl: ''
    },
    {
      code: 'LD-TOKEN-01',
      name: 'Token',
      type: 'Token' as CardType,
      archetype: 'Vinculado',
      collection: 'Deck de Heróis (Máx. 15)',
      ct: 0,
      frame: 'Moderno',
      description: 'Tokens são cartas vinculadas a cartas que se utilizam delas, só podem ser afetadas por cartas que as afetam diretamente, ocupam espaço em campo mas não declaram ataques e nem possuem efeitos, tokens também não podem ser equipados.',
      imageUrl: ''
    }
  ];

  const [showcaseCards, setShowcaseCards] = useState<CardData[]>(() => {
    const cached = readBrowserCache<CardData[]>('ld_cache_showcaseCards_v3');
    return cached && cached.length > 0 ? cached : DEFAULT_SHOWCASE_CARDS;
  });
  const [selectedProduct, setSelectedProduct] = useState<ExclusiveProduct | null>(null);
  const [selectedProductVariationIndex, setSelectedProductVariationIndex] = useState<number | undefined>(undefined);
  const [inspectedDeckCard, setInspectedDeckCard] = useState<CardData | null>(null);

  interface ModalSnapshot {
    isManualOpen: boolean;
    isBuyModalOpen: boolean;
    storeInitialTab: 'vitrine' | 'carrinho';
    storeInitialOrderId: string | null;
    isCatalogOpen: boolean;
    isLoreOpen: boolean;
    isDeckBuilderOpen: boolean;
    isAlbumOpen: boolean;
    isSavedDecksOpen: boolean;
    isPopularCardsOpen: boolean;
    isCollectorsRankingOpen: boolean;
    isGameOpen: boolean;
    isTournamentOpen: boolean;
    activeTournamentId: string | undefined;
    isChampionshipHistoryOpen: boolean;
    isUserProfileOpen: boolean;
    targetUserProfile: TargetUserProfile | null;
    userProfileInitialTab: 'wishlist' | 'most_wanted' | 'stats' | 'verifications' | 'orders';
    adminMode: 'none' | 'home' | 'catalog' | 'master' | 'store';
    selectedType: string | null;
    selectedProduct: ExclusiveProduct | null;
    selectedProductVariationIndex: number | undefined;
  }

  const [modalHistory, setModalHistory] = useState<ModalSnapshot[]>([]);

  const getCurrentModalSnapshot = (): ModalSnapshot => ({
    isManualOpen,
    isBuyModalOpen,
    storeInitialTab,
    storeInitialOrderId,
    isCatalogOpen,
    isLoreOpen,
    isDeckBuilderOpen,
    isAlbumOpen,
    isSavedDecksOpen,
    isPopularCardsOpen,
    isCollectorsRankingOpen,
    isGameOpen,
    isTournamentOpen,
    activeTournamentId,
    isChampionshipHistoryOpen,
    isUserProfileOpen,
    targetUserProfile,
    userProfileInitialTab,
    adminMode,
    selectedType,
    selectedProduct,
    selectedProductVariationIndex
  });

  const hasAnyActiveModal = (s: ModalSnapshot): boolean =>
    s.isManualOpen ||
    s.isBuyModalOpen ||
    s.isCatalogOpen ||
    s.isLoreOpen ||
    s.isDeckBuilderOpen ||
    s.isAlbumOpen ||
    s.isSavedDecksOpen ||
    s.isPopularCardsOpen ||
    s.isCollectorsRankingOpen ||
    s.isGameOpen ||
    s.isTournamentOpen ||
    s.isChampionshipHistoryOpen ||
    s.isUserProfileOpen ||
    s.adminMode !== 'none' ||
    s.selectedType !== null ||
    s.selectedProduct !== null;

  const clearAllActiveModals = () => {
    setIsManualOpen(false);
    setIsBuyModalOpen(false);
    setStoreInitialOrderId(null);
    setStoreInitialListingId(null);
    setStoreInitialVariationIdx(undefined);
    setIsCatalogOpen(false);
    setIsLoreOpen(false);
    setIsDeckBuilderOpen(false);
    setIsAlbumOpen(false);
    setIsSavedDecksOpen(false);
    setIsPopularCardsOpen(false);
    setIsCollectorsRankingOpen(false);
    setIsGameOpen(false);
    setIsTournamentOpen(false);
    setActiveTournamentId(undefined);
    setIsChampionshipHistoryOpen(false);
    setIsUserProfileOpen(false);
    setTargetUserProfile(null);
    setAdminMode('none');
    setSelectedType(null);
    setSelectedProduct(null);
    setSelectedProductVariationIndex(undefined);
  };

  const restoreModalSnapshot = (s: ModalSnapshot) => {
    setIsManualOpen(s.isManualOpen);
    setIsBuyModalOpen(s.isBuyModalOpen);
    setStoreInitialTab(s.storeInitialTab);
    setStoreInitialOrderId(s.storeInitialOrderId);
    setIsCatalogOpen(s.isCatalogOpen);
    setIsLoreOpen(s.isLoreOpen);
    setIsDeckBuilderOpen(s.isDeckBuilderOpen);
    setIsAlbumOpen(s.isAlbumOpen);
    setIsSavedDecksOpen(s.isSavedDecksOpen);
    setIsPopularCardsOpen(s.isPopularCardsOpen);
    setIsCollectorsRankingOpen(s.isCollectorsRankingOpen);
    setIsGameOpen(s.isGameOpen);
    setIsTournamentOpen(s.isTournamentOpen);
    setActiveTournamentId(s.activeTournamentId);
    setIsChampionshipHistoryOpen(s.isChampionshipHistoryOpen);
    setIsUserProfileOpen(s.isUserProfileOpen);
    setTargetUserProfile(s.targetUserProfile);
    setUserProfileInitialTab(s.userProfileInitialTab);
    setAdminMode(s.adminMode);
    setSelectedType(s.selectedType);
    setSelectedProduct(s.selectedProduct);
    setSelectedProductVariationIndex(s.selectedProductVariationIndex);
  };

  const navigateToModal = (openFn: () => void) => {
    const snap = getCurrentModalSnapshot();
    if (hasAnyActiveModal(snap)) {
      setModalHistory((prev) => [...prev, snap]);
      clearAllActiveModals();
    }
    openFn();
  };

  const closeCurrentModal = () => {
    clearAllActiveModals();
    setModalHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      restoreModalSnapshot(last);
      return prev.slice(0, -1);
    });
  };

  // Alteração de nome de usuário
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState('');
  const [isSavingDisplayName, setIsSavingDisplayName] = useState(false);

  const handleSaveDisplayName = async () => {
    const clean = tempDisplayName.trim();
    if (!clean) return;
    setIsSavingDisplayName(true);
    try {
      await changeDisplayName(clean);
      setIsEditingDisplayName(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar o nome de usuário.');
    } finally {
      setIsSavingDisplayName(false);
    }
  };

  // Check for game mode in URL
  const [isGameMode, setIsGameMode] = useState(false);
  const [isDuelBotOpen, setIsDuelBotOpen] = useState(false);
  const { textures, saveTextureSlot, showPlaceholdersUI, setShowPlaceholdersUI, isChristmasTheme } = useThemeTextures();
  const [isTextureModalOpen, setIsTextureModalOpen] = useState(false);
  const [textureModalSlotId, setTextureModalSlotId] = useState<string | null>(null);

  const handleOpenTextureSlotConfig = (slotId: string) => {
    setTextureModalSlotId(slotId);
    setIsTextureModalOpen(true);
  };

  // Inicializa exclusivamente do cache do navegador (sincronizado com o Firebase) sem textos fixos antigos
  const [homeSettings, setHomeSettings] = useState<any>(() => {
    return readBrowserCache<any>('ld_cache_homeSettings_v2');
  });

  // Configuração dedicada das Cartas Raras do Carrossel (armazenada em homeSettings/featuredRareCards)
  const [featuredRareCardsConfig, setFeaturedRareCardsConfig] = useState<FeaturedRareCardsConfig | undefined>(() => {
    const cached = readBrowserCache<FeaturedRareCardsConfig>('ld_cache_featuredRareCards_v1');
    if (cached && Array.isArray(cached.cards)) return cached;
    const legacyHome = readBrowserCache<any>('ld_cache_homeSettings_v2');
    return legacyHome?.featuredRareCardsConfig;
  });

  useEffect(() => {
    const syncCartCount = () => {
      setCartCount(getCartItems().reduce((sum, i) => sum + i.quantity, 0));
    };
    window.addEventListener('ld-cart-updated', syncCartCount);
    window.addEventListener('storage', syncCartCount);
    return () => {
      window.removeEventListener('ld-cart-updated', syncCartCount);
      window.removeEventListener('storage', syncCartCount);
    };
  }, []);

  useEffect(() => {
    // Limpa qualquer hash residual (#manual-regras, etc.) da URL para manter o link do site limpo
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    const applyUrlRoute = () => {
      const path = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
      const params = new URLSearchParams(window.location.search);

      if (params.get('mode') === 'game') {
        setIsGameMode(true);
        setIsGameOpen(true);
        return;
      }

      const mpOrderParam = params.get('mp_order');
      if (mpOrderParam) {
        setStoreInitialOrderId(mpOrderParam);
        setStoreInitialTab('carrinho');
        setIsBuyModalOpen(true);
        return;
      }

      const tournamentParam = params.get('torneio') || params.get('tournament');
      if (tournamentParam) {
        setActiveTournamentId(tournamentParam);
        setIsTournamentOpen(true);
        return;
      }

      const produtoParam = params.get('produto') || params.get('product');
      const anuncioParam = params.get('anuncio') || params.get('listing');
      const variacaoParam = params.get('variacao');
      const parsedVarIdx =
        variacaoParam !== null && !Number.isNaN(Number(variacaoParam))
          ? Number(variacaoParam)
          : undefined;

      if (anuncioParam) {
        clearAllActiveModals();
        setStoreInitialListingId(anuncioParam);
        setStoreInitialVariationIdx(parsedVarIdx);
        setStoreInitialTab('vitrine');
        setIsBuyModalOpen(true);
        return;
      }

      if (produtoParam) {
        clearAllActiveModals();
        setPendingProductSlug({ slug: toProductSlug(produtoParam), varIdx: parsedVarIdx });
        return;
      }

      if (path === '/catalog' || path === '/catalogo') {
        clearAllActiveModals();
        setIsCatalogOpen(true);
      } else if (path === '/mercado' || path === '/loja' || path === '/store') {
        clearAllActiveModals();
        setStoreInitialTab('vitrine');
        setIsBuyModalOpen(true);
      } else if (path === '/decks' || path === '/deckbuilder' || path === '/monte-seu-deck') {
        clearAllActiveModals();
        setIsDeckBuilderOpen(true);
      } else if (path === '/lore') {
        clearAllActiveModals();
        setIsLoreOpen(true);
      } else if (path === '/torneios' || path === '/torneio') {
        clearAllActiveModals();
        setIsTournamentOpen(true);
      } else if (path === '/populares') {
        clearAllActiveModals();
        setIsPopularCardsOpen(true);
      } else if (path === '/album') {
        clearAllActiveModals();
        setIsAlbumOpen(true);
      } else if (path === '/ranking' || path === '/hall-da-fama') {
        clearAllActiveModals();
        setIsCollectorsRankingOpen(true);
      } else if (path === '/duelo') {
        clearAllActiveModals();
        setIsGameOpen(true);
      } else if (path === '/duelo-ia' || path === '/bot') {
        clearAllActiveModals();
        setIsDuelBotOpen(true);
      } else if (path === '/manual') {
        clearAllActiveModals();
        setIsManualOpen(true);
      } else if (path === '/') {
        clearAllActiveModals();
        setIsDuelBotOpen(false);
      }
    };

    applyUrlRoute();
    window.addEventListener('popstate', applyUrlRoute);

    let didAutoOptimizeProducts = false;
    const unsubHomeSettings = onSnapshot(doc(db, 'homeSettings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const rawProducts: ExclusiveProduct[] = Array.isArray(data.exclusiveProducts)
          ? data.exclusiveProducts
          : [];
        const nextSettings = {
          ...data,
          exclusiveProducts: rawProducts
        };
        setHomeSettings(nextSettings);
        writeBrowserCache('ld_cache_homeSettings_v2', nextSettings);

        if (!didAutoOptimizeProducts && rawProducts.length > 0) {
          const hasHeavyBase64 = rawProducts.some(
            (p) =>
              p?.mediaUrl?.startsWith('data:image/') ||
              p?.mediaList?.some((m) => m?.url?.startsWith('data:image/')) ||
              p?.priceVariations?.some((v) => v?.imageUrl?.startsWith('data:image/'))
          );
          if (hasHeavyBase64) {
            didAutoOptimizeProducts = true;
            optimizeBase64ImagesInProducts(rawProducts).then(({ nextProducts, changed }) => {
              if (changed) {
                const optimizedSettings = { ...nextSettings, exclusiveProducts: nextProducts };
                setHomeSettings(optimizedSettings);
                writeBrowserCache('ld_cache_homeSettings_v2', optimizedSettings);
                setDoc(doc(db, 'homeSettings', 'global'), JSON.parse(JSON.stringify(optimizedSettings)), {
                  merge: true
                }).catch(() => {});
              }
            });
          }
        }
      }
    }, (err) => {
      console.error('Erro ao escutar homeSettings:', err);
    });

    const unsubRareCards = onSnapshot(doc(db, 'homeSettings', 'featuredRareCards'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as FeaturedRareCardsConfig;
        if (data && Array.isArray(data.cards)) {
          setFeaturedRareCardsConfig(data);
          writeBrowserCache('ld_cache_featuredRareCards_v1', data);
        }
      }
    }, (err) => {
      console.error('Erro ao escutar featuredRareCards:', err);
    });

    return () => {
      window.removeEventListener('popstate', applyUrlRoute);
      unsubHomeSettings();
      unsubRareCards();
    };
  }, []);

  // Abre automaticamente o produto compartilhado via URL (?produto=slug) assim que os produtos carregam
  useEffect(() => {
    if (!pendingProductSlug) return;
    const list: ExclusiveProduct[] = homeSettings?.exclusiveProducts || [];
    if (list.length === 0) return;

    const matched = list.find(
      (p) => p && toProductSlug(p.title || '') === pendingProductSlug.slug
    );
    if (matched) {
      setSelectedProduct(matched);
      setSelectedProductVariationIndex(pendingProductSlug.varIdx);
      setPendingProductSlug(null);
    } else {
      // Caso o slug não seja encontrado nos produtos oficiais, abre o Mercado geral
      setStoreInitialTab('vitrine');
      setIsBuyModalOpen(true);
      setPendingProductSlug(null);
    }
  }, [pendingProductSlug, homeSettings]);

  // Sincroniza a URL do navegador com a página/modal ou produto aberto no momento
  useEffect(() => {
    if (typeof window === 'undefined' || pendingProductSlug) return;

    let targetUrl = '/';
    const currentParams = new URLSearchParams(window.location.search);

    if (selectedProduct) {
      const slug = toProductSlug(selectedProduct.title || 'produto');
      const p = new URLSearchParams();
      p.set('produto', slug);
      if (
        typeof selectedProductVariationIndex === 'number' &&
        selectedProductVariationIndex > 0
      ) {
        p.set('variacao', String(selectedProductVariationIndex));
      }
      targetUrl = `/mercado?${p.toString()}`;
    } else if (isBuyModalOpen) {
      const anuncio = currentParams.get('anuncio') || storeInitialListingId;
      const mpOrder = currentParams.get('mp_order') || storeInitialOrderId;
      if (anuncio) {
        const p = new URLSearchParams();
        p.set('anuncio', anuncio);
        if (currentParams.get('variacao')) {
          p.set('variacao', currentParams.get('variacao')!);
        }
        targetUrl = `/mercado?${p.toString()}`;
      } else if (mpOrder) {
        targetUrl = `/mercado?mp_order=${encodeURIComponent(mpOrder)}`;
      } else {
        targetUrl = '/mercado';
      }
    } else if (isCatalogOpen) {
      targetUrl = '/catalog';
    } else if (isDeckBuilderOpen) {
      targetUrl = '/decks';
    } else if (isLoreOpen) {
      targetUrl = '/lore';
    } else if (isTournamentOpen) {
      targetUrl = activeTournamentId
        ? `/torneios?torneio=${encodeURIComponent(activeTournamentId)}`
        : '/torneios';
    } else if (isPopularCardsOpen) {
      targetUrl = '/populares';
    } else if (isAlbumOpen) {
      targetUrl = '/album';
    } else if (isCollectorsRankingOpen) {
      targetUrl = '/ranking';
    } else if (isGameOpen) {
      targetUrl = '/duelo';
    } else if (isDuelBotOpen) {
      targetUrl = '/duelo-ia';
    } else if (isManualOpen) {
      targetUrl = '/manual';
    }

    const currentFull = `${window.location.pathname}${window.location.search}`;
    if (currentFull !== targetUrl) {
      window.history.pushState(null, '', targetUrl);
    }
  }, [
    selectedProduct,
    selectedProductVariationIndex,
    isBuyModalOpen,
    storeInitialListingId,
    storeInitialOrderId,
    isCatalogOpen,
    isDeckBuilderOpen,
    isLoreOpen,
    isTournamentOpen,
    activeTournamentId,
    isPopularCardsOpen,
    isAlbumOpen,
    isCollectorsRankingOpen,
    isGameOpen,
    isDuelBotOpen,
    isManualOpen,
    pendingProductSlug
  ]);

  useEffect(() => {
    const handleContext = (e: MouseEvent) => {
      e.preventDefault();
    };
    
    document.addEventListener('contextmenu', handleContext);
    return () => {
      document.removeEventListener('contextmenu', handleContext);
    };
  }, []);

  const [fetchedVideos, setFetchedVideos] = useState<string[]>(() => {
    return readBrowserCache<string[]>('ld_cache_homeVideos_v2') || [];
  });
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const listRef = ref(storage, 'home_videos');
        const res = await listAll(listRef);
        if (res.items.length > 0) {
          const urls = await Promise.all(res.items.map(item => getDownloadURL(item)));
          setFetchedVideos(urls);
          writeBrowserCache('ld_cache_homeVideos_v2', urls);
        }
      } catch (err: any) {
        if (err.code !== 'storage/quota-exceeded') {
          console.error("Failed to load videos from storage:", err);
        }
      }
    };
    fetchVideos();
  }, []);

  const backgroundVideos = homeSettings?.videos?.length > 0 ? homeSettings.videos : fetchedVideos.map(url => ({ url, duration: 0, position: 'center', transition: 'fade' }));

  useEffect(() => {
    if (!backgroundVideos || backgroundVideos.length === 0) return;
    const currentVideo = backgroundVideos[currentVideoIndex];
    if (currentVideo?.duration > 0) {
      const timer = setTimeout(() => {
        setCurrentVideoIndex((prev) => (prev + 1) % backgroundVideos.length);
      }, currentVideo.duration * 1000);
      return () => clearTimeout(timer);
    }
  }, [currentVideoIndex, backgroundVideos]);
  
  const { siteEffectsEnabled } = useSiteEffects();
  const {
    isWelcomePromptOpen,
    isTourModalOpen,
    setIsTourModalOpen,
    currentSlideIndex: tourSlideIndex,
    setCurrentSlideIndex: setTourSlideIndex,
    openTourAtSlide,
    handleAcceptWelcomePrompt,
    handleDeclineWelcomePrompt,
    tourSettings,
    saveBlairStepPng,
    saveDefaultBlairPng,
    saveBlairStepContent,
    saveWelcomePromptContent
  } = useBlairSiteTour();

  const activeTourSlide = isTourModalOpen ? BLAIR_TOUR_SLIDES[tourSlideIndex] : undefined;
  const activeTourEnvView = activeTourSlide?.envView;

  // Abre e navega sincronamente pelas janelas do site conforme o passo atual da apresentação da Blair
  const [prevTourSyncKey, setPrevTourSyncKey] = useState<string>('');
  const currentTourSyncKey = isTourModalOpen && activeTourEnvView ? `${tourSlideIndex}:${activeTourEnvView}` : '';
  if (currentTourSyncKey !== prevTourSyncKey) {
    setPrevTourSyncKey(currentTourSyncKey);
    if (isTourModalOpen && activeTourEnvView) {
      setIsManualOpen(false);
      setIsAlbumOpen(false);
      setIsSavedDecksOpen(false);
      setIsCollectorsRankingOpen(false);
      setIsChampionshipHistoryOpen(false);
      setIsUserProfileOpen(false);
      setIsDuelBotOpen(false);
      setAdminMode('none');
      setSelectedType(null);
      setSelectedProduct(null);

      setIsCatalogOpen(
        activeTourEnvView === 'catalog_grid' || activeTourEnvView === 'catalog_card_open'
      );
      setIsLoreOpen(
        activeTourEnvView === 'lore_home' ||
          activeTourEnvView === 'lore_map' ||
          activeTourEnvView === 'lore_relations' ||
          activeTourEnvView === 'lore_quiz' ||
          activeTourEnvView === 'lore_music' ||
          activeTourEnvView === 'lore_archives'
      );
      setIsGameOpen(activeTourEnvView === 'game_setup' || activeTourEnvView === 'game_board');
      setIsTournamentOpen(
        activeTourEnvView === 'tournament_config' || activeTourEnvView === 'tournament_bracket'
      );
      setIsDeckBuilderOpen(
        activeTourEnvView === 'deckbuilder_build' ||
          activeTourEnvView === 'deckbuilder_mulligan' ||
          activeTourEnvView === 'deckbuilder_neural' ||
          activeTourEnvView === 'deckbuilder_compare' ||
          activeTourEnvView === 'deckbuilder_stats'
      );
      setIsPopularCardsOpen(activeTourEnvView === 'popular_modal');
      setIsUserMenuOpen(activeTourEnvView === 'home_account');
      if (activeTourEnvView === 'store_modal') {
        setStoreInitialOrderId(null);
        setStoreInitialTab('vitrine');
        setIsBuyModalOpen(true);
      } else {
        setIsBuyModalOpen(false);
      }
    }
  }

  const handleCloseTour = () => {
    setIsTourModalOpen(false);
    setIsUserMenuOpen(false);
    clearAllActiveModals();
  };
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    videoRefs.current.forEach((vid, i) => {
      if (vid) {
        if (!siteEffectsEnabled) {
          vid.pause();
        } else if (i === currentVideoIndex) {
          vid.currentTime = 0;
          vid.play().catch(e => console.log('Autoplay prevented', e));
        } else {
          vid.pause();
        }
      }
    });
  }, [currentVideoIndex, siteEffectsEnabled]);

  useEffect(() => {
    setCurrentVideoIndex(Math.floor(Math.random() * backgroundVideos.length));
    const handleScroll = () => { setScrolled(window.scrollY > 50); };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [backgroundVideos.length]);

  const allCardsRef = useRef(allCards);
  allCardsRef.current = allCards;

  useEffect(() => {
    // Dynamic Showcase Rotation - Prefers Modern Frame Cards from Firebase, with safe fallbacks for all 5 card types
    const rotateShowcase = () => {
      const sourceCards = allCardsRef.current || [];
      if (sourceCards.length === 0) return;

      const pickCardByType = (cardType: CardType, fallbackCard: CardData): CardData => {
        const allOfType = sourceCards.filter(c => c.type === cardType);
        if (allOfType.length === 0) return fallbackCard;

        // 1. Try cards resolved to Modern frame with an image
        const modernResolved = allOfType
          .map(c => resolveModernFrameOnly(c))
          .filter((c): c is CardData => c !== null);
        const modernWithImg = modernResolved.filter(c => !!c.imageUrl);
        if (modernWithImg.length > 0) {
          return modernWithImg[Math.floor(Math.random() * modernWithImg.length)];
        }
        if (modernResolved.length > 0) {
          return modernResolved[Math.floor(Math.random() * modernResolved.length)];
        }

        // 2. Fallback to any card of this type with an image
        const anyWithImg = allOfType.filter(c => !!c.imageUrl);
        if (anyWithImg.length > 0) {
          return anyWithImg[Math.floor(Math.random() * anyWithImg.length)];
        }

        // 3. Fallback to any card of this type
        return allOfType[Math.floor(Math.random() * allOfType.length)] || fallbackCard;
      };

      const hero = pickCardByType('Herói', DEFAULT_SHOWCASE_CARDS[0]);
      const combatant = pickCardByType('Combatente', DEFAULT_SHOWCASE_CARDS[1]);
      const effect = pickCardByType('Efeito', DEFAULT_SHOWCASE_CARDS[2]);
      const equipment = pickCardByType('Equipamento', DEFAULT_SHOWCASE_CARDS[3]);
      const tokenCard = pickCardByType('Token', DEFAULT_SHOWCASE_CARDS[4]);

      const nextShowcase = [hero, combatant, effect, equipment, tokenCard];
      setShowcaseCards(nextShowcase);
      writeBrowserCache('ld_cache_showcaseCards_v3', nextShowcase);
    };

    if (allCards.length > 0) {
      rotateShowcase();
    }
    const interval = setInterval(rotateShowcase, 12000);

    return () => clearInterval(interval);
  }, [allCards.length]);

  const isOnHomePage = !(
    isGameMode ||
    isManualOpen ||
    isBuyModalOpen ||
    isCatalogOpen ||
    isLoreOpen ||
    isDeckBuilderOpen ||
    isAlbumOpen ||
    isSavedDecksOpen ||
    isPopularCardsOpen ||
    isCollectorsRankingOpen ||
    isGameOpen ||
    isDuelBotOpen ||
    isTournamentOpen ||
    isChampionshipHistoryOpen ||
    isUserProfileOpen ||
    adminMode !== 'none' ||
    selectedType !== null ||
    selectedProduct !== null
  );

  // Bloqueia o scroll da página inicial sempre que qualquer janela/aba própria ou o tutorial estiver aberto
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isOnHomePage || isTourModalOpen || isWelcomePromptOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOnHomePage, isTourModalOpen, isWelcomePromptOpen]);

  if (isGameMode) {
    return <GameBoard onClose={() => window.close()} />;
  }

  return (
    <div className={`${isOnHomePage ? 'min-h-screen' : 'h-screen overflow-hidden'} bg-[#05040a] text-slate-200 font-sans selection:bg-purple-500 selection:text-white overflow-x-hidden`}>
      
      <ManualModal isOpen={isManualOpen} onClose={closeCurrentModal} />
      <StoreModal
        isOpen={isBuyModalOpen}
        onClose={closeCurrentModal}
        products={homeSettings?.exclusiveProducts || []}
        allCards={allCards}
        onOpenProductDetail={(product, variationIdx) => {
          navigateToModal(() => {
            setSelectedProduct(product);
            setSelectedProductVariationIndex(variationIdx);
          });
        }}
        user={user}
        isAdmin={isAdmin}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenAdminStore={() => {
          if (isAdmin) {
            navigateToModal(() => {
              setAdminMode('store');
            });
          }
        }}
        onOpenUserOrders={() => {
          navigateToModal(() => {
            openUserProfile(null, 'orders');
          });
        }}
        initialTab={storeInitialTab}
        initialOrderId={storeInitialOrderId}
        initialListingId={storeInitialListingId}
        initialVariationIdx={storeInitialVariationIdx}
      />
      <CatalogModal
        isOpen={isCatalogOpen}
        onClose={closeCurrentModal}
        isAdmin={isAdmin}
        tourAutoOpenCard={activeTourEnvView === 'catalog_card_open'}
        onOpenAdmin={() => { 
          if (isAdmin) {
            navigateToModal(() => {
              setAdminMode('catalog');
            });
          }
        }}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />
      {isLoreOpen && (
        <LoreView
          onClose={closeCurrentModal}
          tourForceView={
            activeTourEnvView === 'lore_map'
              ? 'cosmic_map'
              : activeTourEnvView === 'lore_relations'
              ? 'relations_tree'
              : activeTourEnvView === 'lore_quiz'
              ? 'daily_quiz'
              : activeTourEnvView === 'lore_music'
              ? 'music'
              : activeTourEnvView === 'lore_archives'
              ? 'archives'
              : activeTourEnvView === 'lore_home'
              ? 'home'
              : undefined
          }
        />
      )}
      <DeckBuilderModal
        isOpen={isDeckBuilderOpen}
        onClose={closeCurrentModal}
        tourForceReady={
          activeTourEnvView === 'deckbuilder_build' ||
          activeTourEnvView === 'deckbuilder_mulligan' ||
          activeTourEnvView === 'deckbuilder_neural' ||
          activeTourEnvView === 'deckbuilder_compare' ||
          activeTourEnvView === 'deckbuilder_stats'
        }
        tourForceTab={
          activeTourEnvView === 'deckbuilder_build'
            ? 'build'
            : activeTourEnvView === 'deckbuilder_mulligan'
            ? 'mulligan'
            : activeTourEnvView === 'deckbuilder_neural'
            ? 'neural'
            : activeTourEnvView === 'deckbuilder_compare'
            ? 'compare'
            : activeTourEnvView === 'deckbuilder_stats'
            ? 'stats'
            : undefined
        }
      />
      <AlbumModal 
        isOpen={isAlbumOpen} 
        onClose={closeCurrentModal} 
        onSelectCard={(c) => {
          setInspectedDeckCard(c);
        }} 
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenRanking={() => {
          navigateToModal(() => setIsCollectorsRankingOpen(true));
        }}
        onOpenWishlist={() => {
          navigateToModal(() => openUserProfile(null, 'wishlist'));
        }}
      />
      <SavedDecksModal
        isOpen={isSavedDecksOpen}
        onClose={closeCurrentModal}
        allCards={allCards}
        onLoadDeck={(main, side) => {
          navigateToModal(() => setIsDeckBuilderOpen(true));
        }}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />
      <PopularCardsModal
        isOpen={isPopularCardsOpen}
        onClose={closeCurrentModal}
        allCards={allCards}
        onSelectCard={(c) => setInspectedDeckCard(c)}
        onOpenDeckBuilder={() => {
          navigateToModal(() => setIsDeckBuilderOpen(true));
        }}
      />
      <CollectorsRankingModal
        isOpen={isCollectorsRankingOpen}
        onClose={closeCurrentModal}
        onOpenAlbum={() => {
          navigateToModal(() => setIsAlbumOpen(true));
        }}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenUserProfile={(target) => {
          navigateToModal(() => openUserProfile(target, 'wishlist'));
        }}
        onOpenMostWanted={() => {
          navigateToModal(() => openUserProfile(null, 'most_wanted'));
        }}
      />
      <UserProfileModal
        isOpen={isUserProfileOpen}
        onClose={closeCurrentModal}
        targetProfile={targetUserProfile}
        initialTab={userProfileInitialTab}
        onOpenCardDetail={(c) => setInspectedDeckCard(c)}
        onOpenAlbum={() => {
          navigateToModal(() => setIsAlbumOpen(true));
        }}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenOrderPayment={(orderId) => {
          navigateToModal(() => {
            setStoreInitialOrderId(orderId);
            setStoreInitialTab('carrinho');
            setIsBuyModalOpen(true);
          });
        }}
      />
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
      {isTournamentOpen && (
        <TournamentManager 
          initialTournamentId={activeTournamentId}
          onClose={closeCurrentModal}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          allCards={allCards}
          tourForceTab={
            activeTourEnvView === 'tournament_config'
              ? 'config'
              : activeTourEnvView === 'tournament_bracket'
              ? 'bracket'
              : undefined
          }
        />
      )}
      <ChampionshipHistoryModal
        isOpen={isChampionshipHistoryOpen}
        onClose={closeCurrentModal}
        onOpenTournament={(tId) => {
          navigateToModal(() => {
            setActiveTournamentId(tId);
            setIsTournamentOpen(true);
          });
        }}
        onOpenAuth={() => setIsAuthModalOpen(true)}
      />
      <TypeModal type={selectedType} onClose={closeCurrentModal} />
      {isGameOpen && (
        <GameBoard
          onClose={closeCurrentModal}
          tourForceShowSetup={
            activeTourEnvView === 'game_setup'
              ? true
              : activeTourEnvView === 'game_board'
              ? false
              : undefined
          }
        />
      )}
      <DuelBotModal isOpen={isDuelBotOpen} onClose={() => setIsDuelBotOpen(false)} />
      {adminMode !== 'none' && isAdmin && <AdminPanel adminType={adminMode} onClose={closeCurrentModal} />}

      {/* Camada Global de Textura / Placeholder para as Abas Secundárias (TEX-08 a TEX-11) */}
      {(isCatalogOpen || isDeckBuilderOpen || isPopularCardsOpen || isSavedDecksOpen) && textures.catalog_deck_texture && (
        <div className="fixed inset-0 z-[125] pointer-events-none">
          <ArcaneCyberTextureLayer
            slot={textures.catalog_deck_texture}
            variant="cyber-grid"
            showPlaceholderBadge={showPlaceholdersUI}
            onOpenConfig={handleOpenTextureSlotConfig}
          />
        </div>
      )}
      {isLoreOpen && textures.lore_archivum_texture && (
        <div className="fixed inset-0 z-[125] pointer-events-none">
          <ArcaneCyberTextureLayer
            slot={textures.lore_archivum_texture}
            variant="high-magic"
            showPlaceholderBadge={showPlaceholdersUI}
            onOpenConfig={handleOpenTextureSlotConfig}
          />
        </div>
      )}
      {(isBuyModalOpen || isTournamentOpen || isChampionshipHistoryOpen || isAlbumOpen || isCollectorsRankingOpen || isUserProfileOpen) && textures.store_booster_texture && (
        <div className="fixed inset-0 z-[125] pointer-events-none">
          <ArcaneCyberTextureLayer
            slot={textures.store_booster_texture}
            variant="hybrid"
            showPlaceholderBadge={showPlaceholdersUI}
            onOpenConfig={handleOpenTextureSlotConfig}
          />
        </div>
      )}
      {(isGameOpen || isDuelBotOpen) && textures.duel_arena_texture && (
        <div className="fixed inset-0 z-[125] pointer-events-none">
          <ArcaneCyberTextureLayer
            slot={textures.duel_arena_texture}
            variant="dark-magic"
            showPlaceholderBadge={showPlaceholdersUI}
            onOpenConfig={handleOpenTextureSlotConfig}
          />
        </div>
      )}

      <ThemeTexturesManagerModal
        isOpen={isTextureModalOpen}
        onClose={() => setIsTextureModalOpen(false)}
        textures={textures}
        onSaveSlot={saveTextureSlot}
        initialSlotId={textureModalSlotId}
        showPlaceholdersUI={showPlaceholdersUI}
        onTogglePlaceholdersUI={setShowPlaceholdersUI}
      />

      {/* Navbar Cyber-Arcana (Dark Magic x High Magic x Cyberpunk) - Oculta quando outra janela está aberta */}
      <nav className={`${isOnHomePage ? 'fixed' : 'hidden'} w-full z-50 transition-all duration-300 border-b ${scrolled ? (isChristmasTheme ? 'bg-[#0b0305]/95 border-red-500/45 py-2.5 shadow-[0_10px_35px_rgba(220,38,38,0.22)] backdrop-blur-xl' : 'bg-[#05040a]/95 border-amber-500/30 py-2.5 shadow-[0_10px_35px_rgba(0,0,0,0.85)] backdrop-blur-xl') : (isChristmasTheme ? 'bg-gradient-to-b from-[#0b0305]/95 via-[#0b0305]/75 to-transparent border-red-500/25 py-3.5' : 'bg-gradient-to-b from-[#05040a]/95 via-[#05040a]/75 to-transparent border-amber-500/15 py-3.5')}`}>
        <ArcaneCyberTextureLayer
          slot={textures.navbar_hud_texture}
          variant="cyber-grid"
          showPlaceholderBadge={showPlaceholdersUI}
          onOpenConfig={handleOpenTextureSlotConfig}
        />
        <div data-tour-id="tour-mobile-nav-bar" className="container mx-auto px-3 sm:px-6 relative z-10 flex items-center justify-between gap-3">
          {/* Logo */}
          <div 
            className="flex items-center gap-2.5 cursor-pointer shrink-0 group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <img 
              src="https://i.imgur.com/cDLxOtO.png" 
              alt="Light Dark TCG" 
              className="h-11 sm:h-13 w-auto object-contain drop-shadow-[0_0_12px_rgba(212,175,55,0.3)] group-hover:scale-105 transition-transform"
            />
          </div>

          {/* Desktop / Laptop Navigation - Wrap responsivo sem sobrepor botões */}
          <div className="hidden md:flex items-center justify-end flex-wrap gap-1.5 lg:gap-2 flex-1 min-w-0">
            <ConhecaOSiteNavbarButton onClick={() => openTourAtSlide(0)} />
            <SiteEffectsToggleButton />
            <NavbarSpotifyMicroPlayer isHomePage={isOnHomePage && !isWelcomePromptOpen && !isTourModalOpen} />
            <button 
              type="button"
              data-tour-id="tour-btn-manual"
              onClick={() => {
                document.getElementById('manual-regras')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="cyber-arcane-btn bg-purple-950/90 hover:bg-purple-900 text-amber-200 border border-amber-500/45 px-2.5 py-1.5 text-[11px] font-cinzel font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 shadow-sm shadow-purple-950/60 active:scale-95 whitespace-nowrap"
            >
              <BookOpen size={13} className="text-amber-400" /> Manual
            </button>
            <button 
              data-tour-id="tour-btn-catalog"
              onClick={() => setIsCatalogOpen(true)}
              className="cyber-arcane-btn bg-[#0d0b18]/90 hover:bg-[#17132b] text-slate-100 border border-purple-500/35 hover:border-amber-400/60 px-2.5 py-1.5 text-[11px] font-cyber font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
            >
              <Search size={13} className="text-purple-400" /> Catálogo
            </button>
            <button 
              data-tour-id="tour-btn-lore"
              onClick={() => setIsLoreOpen(true)}
              className="cyber-arcane-btn bg-[#0d0b18]/90 hover:bg-[#17132b] text-slate-100 border border-cyan-500/35 hover:border-cyan-400/70 px-2.5 py-1.5 text-[11px] font-cyber font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
            >
              <BookOpen size={13} className="text-cyan-400" /> Lore
            </button>
            <button 
              data-tour-id="tour-btn-duelo"
              onClick={() => setIsGameOpen(true)}
              className="cyber-arcane-btn bg-[#0d0b18]/90 hover:bg-[#17132b] text-slate-100 border border-purple-500/35 hover:border-purple-400/70 px-2.5 py-1.5 text-[11px] font-cyber font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
            >
              <Zap size={13} className="text-purple-400" /> App Duelo
            </button>
            <button 
              data-tour-id="tour-btn-duel-ia"
              onClick={() => setIsDuelBotOpen(true)}
              className="cyber-arcane-btn bg-gradient-to-r from-purple-950 via-indigo-950 to-cyan-950 hover:from-purple-900 hover:to-cyan-900 text-cyan-200 px-2.5 py-1.5 text-[11px] font-cyber font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 active:scale-95 whitespace-nowrap border border-cyan-400/45 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
              title="Simulador de Duelo contra IA (Deck Insanis)"
            >
              <Sword size={13} className="text-amber-300" /> Duelo vs IA
            </button>
            <button 
              data-tour-id="tour-btn-torneio"
              onClick={() => setIsTournamentOpen(true)}
              className="cyber-arcane-btn bg-[#0d0b18]/90 hover:bg-[#17132b] text-slate-100 border border-amber-500/35 hover:border-amber-400/70 px-2.5 py-1.5 text-[11px] font-cyber font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
            >
              <Crown size={13} className="text-amber-400" /> Torneio
            </button>
            <button 
              data-tour-id="tour-btn-deckbuilder"
              onClick={() => setIsDeckBuilderOpen(true)} 
              className="cyber-arcane-btn bg-[#0d0b18]/90 hover:bg-[#17132b] text-slate-100 border border-purple-500/35 hover:border-amber-400/60 px-2.5 py-1.5 text-[11px] font-cyber font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
            >
              <Layers size={13} className="text-purple-400" /> DeckBuilder
            </button>
            <button 
              data-tour-id="tour-btn-populares"
              onClick={() => setIsPopularCardsOpen(true)} 
              className="cyber-arcane-btn bg-[#0d0b18]/90 hover:bg-[#17132b] text-slate-100 border border-rose-500/35 hover:border-rose-400/70 px-2.5 py-1.5 text-[11px] font-cyber font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
              title="Cartas Populares da Comunidade (Meta)"
            >
              <Flame size={13} className="text-rose-400" /> Populares
            </button>
            <div data-tour-id="tour-btn-mercado" className="flex items-center gap-1">
              <button 
                onClick={() => {
                  setStoreInitialOrderId(null);
                  setStoreInitialTab('vitrine');
                  setIsBuyModalOpen(true);
                }}
                className="cyber-arcane-btn relative bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 text-[11px] font-cyber font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.25)] active:scale-95 whitespace-nowrap"
              >
                <Package size={13} className="text-slate-950" /> Mercado
              </button>
              <button
                onClick={() => {
                  setStoreInitialOrderId(null);
                  setStoreInitialTab('carrinho');
                  setIsBuyModalOpen(true);
                }}
                title="Abrir Carrinho & Calcular Frete"
                className="relative p-1.5 bg-[#0d0b18]/90 hover:bg-slate-800 border border-emerald-500/45 text-emerald-400 transition-all active:scale-95 flex items-center justify-center"
              >
                <ShoppingCart size={15} />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black flex items-center justify-center shadow">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setTextureModalSlotId(null);
                  setIsTextureModalOpen(true);
                }}
                className={`cyber-arcane-btn px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider border transition flex items-center gap-1 whitespace-nowrap ${
                  isChristmasTheme
                    ? 'bg-red-600/30 border-red-400 text-red-100 shadow-[0_0_14px_rgba(239,68,68,0.45)]'
                    : showPlaceholdersUI
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                    : 'bg-[#0d0b18]/90 border-amber-500/40 text-amber-300 hover:bg-amber-950/50'
                }`}
                title="Gerenciar Temas Animados & Texturas (TEX-01..11)"
              >
                <Sparkles size={12} className={isChristmasTheme ? 'text-red-300' : 'text-amber-400'} />
                <span>{isChristmasTheme ? '🎄 Tema Natalino' : 'Temas & Texturas'}</span>
              </button>
            )}

            {/* Conta / Perfil */}
            {!user && activeTourEnvView !== 'home_account' ? (
              <button 
                data-tour-id="tour-btn-conta"
                onClick={() => setIsAuthModalOpen(true)}
                className="cyber-arcane-btn bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white border border-purple-400/40 px-3 py-1.5 text-[11px] font-cyber font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 shadow-md shadow-purple-900/40 active:scale-95 whitespace-nowrap"
              >
                <LogIn size={13} /> Entrar
              </button>
            ) : (
              <div data-tour-id="tour-btn-conta" className="relative">
                <button
                  onClick={() => {
                    if (!user) {
                      setIsAuthModalOpen(true);
                    } else {
                      setIsUserMenuOpen(prev => !prev);
                    }
                  }}
                  className="bg-[#0d0b18]/95 hover:bg-[#17132b] text-amber-100 border border-amber-500/40 px-2.5 py-1 text-xs font-cyber font-bold transition flex items-center gap-2 shadow-sm"
                >
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'Jogador'} className="w-5 h-5 rounded-full border border-amber-400" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-purple-800 border border-amber-400/50 flex items-center justify-center text-[10px] text-amber-200 font-bold">
                      {(user?.displayName || 'J')[0]}
                    </div>
                  )}
                  <span className="max-w-[95px] truncate hidden xl:inline">{user?.displayName || 'Sua Conta'}</span>
                  <ChevronDown size={13} className="text-amber-400" />
                </button>

                {(isUserMenuOpen || activeTourEnvView === 'home_account') && (
                  <div
                    data-tour-id="tour-account-menu-dropdown"
                    className="absolute right-0 mt-2 w-64 bg-[#07060e] border border-amber-500/40 shadow-2xl py-2 z-50 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150"
                  >
                    <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                      {user && isEditingDisplayName ? (
                        <div className="flex flex-col gap-1.5 py-1">
                          <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider">Mudar Nome de Exibição</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={tempDisplayName}
                              onChange={(e) => setTempDisplayName(e.target.value)}
                              maxLength={25}
                              placeholder="Novo apelido..."
                              className="bg-slate-900 border border-purple-500 rounded-lg px-2.5 py-1 text-xs text-white outline-none w-full font-bold focus:ring-1 focus:ring-purple-400"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveDisplayName();
                                if (e.key === 'Escape') setIsEditingDisplayName(false);
                              }}
                            />
                            <button
                              onClick={handleSaveDisplayName}
                              disabled={isSavingDisplayName || !tempDisplayName.trim()}
                              className="p-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg transition shrink-0"
                              title="Salvar Nome"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setIsEditingDisplayName(false)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition shrink-0"
                              title="Cancelar"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white truncate" title={user?.displayName || 'Duelista'}>
                              {user?.displayName || 'Sua Conta de Duelista'}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{user?.email || 'Perfil, Álbum & Coleção'}</div>
                          </div>
                          {user && (
                            <button
                              onClick={() => {
                                setTempDisplayName(user.displayName || '');
                                setIsEditingDisplayName(true);
                              }}
                              className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-purple-950/50 rounded-lg transition shrink-0"
                              title="Alterar nome de usuário"
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        if (!user) {
                          setIsAuthModalOpen(true);
                          return;
                        }
                        setTempDisplayName(user.displayName || '');
                        setIsEditingDisplayName(true);
                      }}
                      className="px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-purple-900/30 flex items-center gap-2 transition"
                    >
                      <Edit2 size={14} className="text-purple-400" />
                      <span>Mudar Nome de Usuário</span>
                    </button>

                    <button
                      onClick={() => { openUserProfile(null, 'wishlist'); setIsUserMenuOpen(false); }}
                      className="px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-purple-900/30 flex items-center gap-2 transition"
                    >
                      <Heart size={14} className="text-pink-400 fill-pink-400/20" />
                      <span>Meu Perfil & Cartas que Procuro</span>
                    </button>

                    <button
                      onClick={() => { openUserProfile(null, 'most_wanted'); setIsUserMenuOpen(false); }}
                      className="px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-purple-900/30 flex items-center gap-2 transition"
                    >
                      <Flame size={14} className="text-amber-400 fill-amber-400/20" />
                      <span>Cartas Mais Procuradas</span>
                    </button>

                    <button
                      onClick={() => { setIsAlbumOpen(true); setIsUserMenuOpen(false); }}
                      className="px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-purple-900/30 flex items-center gap-2 transition"
                    >
                      <BookmarkCheck size={14} className="text-purple-400" />
                      <span>Meu Álbum de Coleção</span>
                    </button>

                    <button
                      onClick={() => { setIsCollectorsRankingOpen(true); setIsUserMenuOpen(false); }}
                      className="px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-purple-900/30 flex items-center gap-2 transition"
                    >
                      <Trophy size={14} className="text-amber-400" />
                      <span>Hall da Fama</span>
                    </button>

                    <button
                      onClick={() => { setIsSavedDecksOpen(true); setIsUserMenuOpen(false); }}
                      className="px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-purple-900/30 flex items-center gap-2 transition"
                    >
                      <Cloud size={14} className="text-purple-400" />
                      <span>Meus Decks Salvos</span>
                    </button>

                    <button
                      onClick={() => { setIsChampionshipHistoryOpen(true); setIsUserMenuOpen(false); }}
                      className="px-3 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-purple-900/30 flex items-center gap-2 transition"
                    >
                      <Award size={14} className="text-amber-400" />
                      <span>Histórico de Campeonatos</span>
                    </button>

                    <button
                      onClick={() => {
                        openUserProfile(null, 'orders');
                        setIsUserMenuOpen(false);
                      }}
                      className="px-3 py-2 text-left text-xs text-emerald-300 hover:text-white hover:bg-emerald-900/30 flex items-center gap-2 transition font-bold"
                    >
                      <Truck size={14} className="text-emerald-400" />
                      <span>Meus Pedidos & Rastreio</span>
                    </button>

                    {isAdmin && (
                      <>
                        <button
                          onClick={() => {
                            setTextureModalSlotId(null);
                            setIsTextureModalOpen(true);
                            setIsUserMenuOpen(false);
                          }}
                          className="px-3 py-2 text-left text-xs text-cyan-300 hover:text-white hover:bg-cyan-900/30 flex items-center gap-2 transition font-bold"
                        >
                          <Sparkles size={14} className="text-cyan-400" />
                          <span>Texturas & Placeholders (TEX-01..07)</span>
                        </button>
                        <button
                          onClick={() => {
                            setAdminMode('store');
                            setIsUserMenuOpen(false);
                          }}
                          className="px-3 py-2 text-left text-xs text-amber-300 hover:text-white hover:bg-amber-900/30 flex items-center gap-2 transition font-bold"
                        >
                          <Package size={14} className="text-amber-400" />
                          <span>Painel de Vendas & Frete (Admin)</span>
                        </button>
                        <button
                          onClick={() => {
                            downloadPresentationGuidePdf();
                            setIsUserMenuOpen(false);
                          }}
                          className="px-3 py-2 text-left text-xs text-purple-300 hover:text-white hover:bg-purple-900/40 flex items-center gap-2 transition font-bold"
                        >
                          <FileText size={14} className="text-purple-400" />
                          <span>Baixar PDF de Apresentação (Vídeo)</span>
                        </button>
                      </>
                    )}

                    <div className="border-t border-slate-800/80 my-1"></div>

                    <button
                      onClick={() => { logout(); setIsUserMenuOpen(false); }}
                      className="px-3 py-2 text-left text-xs text-red-400 hover:text-white hover:bg-red-950/50 flex items-center gap-2 transition"
                    >
                      <LogOut size={14} />
                      <span>Sair da Conta</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button className="md:hidden text-amber-200 p-1.5 border border-amber-500/30 bg-[#0d0b18]/80" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {/* Mobile Menu */}
        {isMenuOpen && (
             <div className="md:hidden absolute top-full left-0 w-full bg-[#0a0a0c] border-b border-slate-800 p-4 flex flex-col gap-2.5 shadow-2xl animate-in slide-in-from-top-2">
                <ConhecaOSiteNavbarButton
                  onClick={() => {
                    setIsMenuOpen(false);
                    openTourAtSlide(0);
                  }}
                  className="w-full justify-center py-2"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <SiteEffectsToggleButton className="flex-1 justify-between" />
                  <NavbarSpotifyMicroPlayer isHomePage={isOnHomePage && !isWelcomePromptOpen && !isTourModalOpen} />
                </div>
                <button 
                  type="button"
                  className="bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm shadow-purple-900/40" 
                  onClick={() => {
                    setIsMenuOpen(false);
                    document.getElementById('manual-regras')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <BookOpen size={15} /> Ler Manual Completo
                </button>
                <button 
                  onClick={() => { setIsCatalogOpen(true); setIsMenuOpen(false); }}
                  className="bg-slate-100 hover:bg-white text-slate-950 px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm"
                >
                  <Search size={15} className="text-purple-600" /> Catálogo de Cartas
                </button>
                <button 
                  onClick={() => { setIsLoreOpen(true); setIsMenuOpen(false); }}
                  className="bg-slate-100 hover:bg-white text-slate-950 px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm"
                >
                  <BookOpen size={15} className="text-blue-600" /> Lore & Universo
                </button>
                <button 
                  onClick={() => { setIsGameOpen(true); setIsMenuOpen(false); }}
                  className="bg-slate-100 hover:bg-white text-slate-950 px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm"
                >
                  <Zap size={15} className="text-purple-600 fill-purple-600/30" /> App Duelo
                </button>
                <button 
                  onClick={() => { setIsDuelBotOpen(true); setIsMenuOpen(false); }}
                  className="bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm border border-purple-400/30"
                >
                  <Sword size={15} className="text-amber-300" /> Duelo vs IA (Insanis)
                </button>
                <button 
                  onClick={() => { setIsTournamentOpen(true); setIsMenuOpen(false); }}
                  className="bg-slate-100 hover:bg-white text-slate-950 px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm"
                >
                  <Crown size={15} className="text-amber-500 fill-amber-500/30" /> Torneio
                </button>
                <button 
                  onClick={() => { setIsDeckBuilderOpen(true); setIsMenuOpen(false); }} 
                  className="bg-slate-100 hover:bg-white text-slate-950 px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm text-left"
                >
                  <Layers size={15} className="text-purple-600" /> Monte seu Deck
                </button>
                <button 
                  onClick={() => { setIsPopularCardsOpen(true); setIsMenuOpen(false); }} 
                  className="bg-slate-100 hover:bg-white text-slate-950 px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm text-left"
                >
                  <Flame size={15} className="text-red-500 fill-red-500/20" /> Cartas Populares (Meta)
                </button>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setStoreInitialOrderId(null);
                      setStoreInitialTab('vitrine');
                      setIsBuyModalOpen(true);
                      setIsMenuOpen(false);
                    }}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Package size={15} className="text-slate-950" /> Mercado
                  </button>
                  <button
                    onClick={() => {
                      setStoreInitialOrderId(null);
                      setStoreInitialTab('carrinho');
                      setIsBuyModalOpen(true);
                      setIsMenuOpen(false);
                    }}
                    className="relative px-3.5 py-2 rounded-lg bg-slate-900 border border-emerald-500/40 text-emerald-400 text-xs font-black flex items-center gap-1.5"
                  >
                    <ShoppingCart size={15} />
                    {cartCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black">
                        {cartCount}
                      </span>
                    )}
                  </button>
                </div>

                {!user ? (
                  <button 
                    onClick={() => { setIsAuthModalOpen(true); setIsMenuOpen(false); }}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm"
                  >
                    <LogIn size={15} /> Entrar na Conta
                  </button>
                ) : (
                  <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
                    <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 px-3.5 py-2 rounded-lg text-xs">
                      <span className="font-bold text-white truncate max-w-[170px]">{user.displayName || 'Jogador'}</span>
                      <button
                        onClick={() => {
                          setTempDisplayName(user.displayName || '');
                          setIsEditingDisplayName(true);
                          setIsMenuOpen(false);
                          setIsUserMenuOpen(true);
                        }}
                        className="text-purple-400 hover:text-purple-300 font-bold text-xs flex items-center gap-1"
                      >
                        <Edit2 size={12} /> Mudar Nome
                      </button>
                    </div>

                    <button 
                      onClick={() => { openUserProfile(null, 'wishlist'); setIsMenuOpen(false); }}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 border border-slate-800"
                    >
                      <Heart size={14} className="text-pink-400 fill-pink-400/20" /> Meu Perfil & Cartas que Procuro
                    </button>

                    <button 
                      onClick={() => { openUserProfile(null, 'most_wanted'); setIsMenuOpen(false); }}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 border border-slate-800"
                    >
                      <Flame size={14} className="text-amber-400 fill-amber-400/20" /> Cartas Mais Procuradas
                    </button>

                    <button 
                      onClick={() => { setIsAlbumOpen(true); setIsMenuOpen(false); }}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 border border-slate-800"
                    >
                      <BookmarkCheck size={14} className="text-purple-400" /> Meu Álbum de Coleção
                    </button>

                    <button 
                      onClick={() => { setIsCollectorsRankingOpen(true); setIsMenuOpen(false); }} 
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 border border-slate-800"
                    >
                      <Trophy size={14} className="text-amber-400" /> Hall da Fama
                    </button>

                    <button 
                      onClick={() => { setIsSavedDecksOpen(true); setIsMenuOpen(false); }}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 border border-slate-800"
                    >
                      <Cloud size={14} className="text-purple-400" /> Meus Decks Salvos
                    </button>

                    <button 
                      onClick={() => { setIsChampionshipHistoryOpen(true); setIsMenuOpen(false); }}
                      className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 border border-slate-800"
                    >
                      <Award size={14} className="text-amber-400" /> Histórico de Campeonatos
                    </button>

                    <button 
                      onClick={() => {
                        openUserProfile(null, 'orders');
                        setIsMenuOpen(false);
                      }}
                      className="bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 hover:text-white px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 border border-emerald-800/60"
                    >
                      <Truck size={14} className="text-emerald-400" /> Meus Pedidos & Rastreio
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          downloadPresentationGuidePdf();
                          setIsMenuOpen(false);
                        }}
                        className="bg-purple-950/70 hover:bg-purple-900/70 text-purple-200 hover:text-white px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 border border-purple-700/60"
                      >
                        <FileText size={14} className="text-purple-400" /> Baixar PDF de Apresentação (Vídeo)
                      </button>
                    )}

                    <button 
                      onClick={() => { logout(); setIsMenuOpen(false); }}
                      className="bg-red-950/80 border border-red-800 text-red-300 hover:text-white px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm"
                    >
                      <LogOut size={15} /> Sair da Conta
                    </button>
                  </div>
                )}
             </div>
        )}
      </nav>

      {/* 1. Hero Section — Dark Magic x High Magic x Cyberpunk */}
      <header className="relative pt-28 pb-24 lg:pt-36 lg:pb-32 overflow-hidden min-h-[70vh] lg:min-h-[78vh] flex items-center">
        <div className="absolute top-0 left-0 w-full h-full z-0 overflow-hidden bg-[#05040a]">
          {siteEffectsEnabled && backgroundVideos.map((vid: any, i: number) => {
            const isActive = i === currentVideoIndex;
            const resolvedPosition =
              !vid.position || vid.position === 'center' ? 'center top' : vid.position;
            return (
              <video 
                key={i} 
                ref={el => videoRefs.current[i] = el}
                src={vid.url}
                autoPlay={isActive}
                muted
                playsInline
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                onContextMenu={(e) => e.preventDefault()}
                onEnded={() => {
                  if (!vid.duration && isActive) {
                    setCurrentVideoIndex((prev) => (prev + 1) % backgroundVideos.length);
                  }
                }} 
                className={`absolute top-0 left-0 w-full h-full object-cover pointer-events-none transition-opacity duration-1000 ${isActive ? 'opacity-50' : 'opacity-0'} ${vid.transition === 'none' ? 'duration-0' : 'duration-1000'}`}
                style={{ objectPosition: resolvedPosition }}
              />
            );
          })}
          {/* Camada de Textura / Placeholder TEX-01 (Hero) */}
          <ArcaneCyberTextureLayer
            slot={textures.hero_bg_texture}
            variant="dark-magic"
            showPlaceholderBadge={showPlaceholdersUI}
            onOpenConfig={handleOpenTextureSlotConfig}
          />
          {siteEffectsEnabled && (
            <div className="absolute inset-0 cyber-scanlines opacity-35 pointer-events-none" />
          )}
          {/* Suave escurecimento no topo para leitura da navbar e gradiente intenso na base para não dar corte abrupto */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#05040a]/80 via-[#05040a]/25 to-[#05040a] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 right-0 h-48 sm:h-64 md:h-72 bg-gradient-to-t from-[#05040a] via-[#05040a]/90 to-transparent pointer-events-none z-10"></div>
        </div>

        <div data-tour-id="tour-hero-main" className="container mx-auto px-4 sm:px-6 relative z-20 text-center">
          {homeSettings ? (
            <div className="max-w-4xl mx-auto relative py-6 px-4 sm:px-8">
              <div className={`inline-flex items-center gap-2.5 px-3.5 py-1 mb-5 bg-[#090714]/85 border ${isChristmasTheme ? 'border-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.3)]' : 'border-amber-500/35 shadow-[0_0_25px_rgba(168,85,247,0.2)]'}`}>
                <span className={`w-1.5 h-1.5 rotate-45 ${isChristmasTheme ? 'bg-red-500' : 'bg-cyan-400'} ${siteEffectsEnabled ? 'animate-pulse' : ''}`} />
                <h2 className="font-mono text-[11px] sm:text-xs tracking-[0.28em] uppercase drop-shadow-md" style={{ color: isChristmasTheme ? '#fca5a5' : (homeSettings.primaryColor || '#e2c15a') }}>
                  {homeSettings.topSubtitle ?? ''}
                </h2>
                <span className={`w-1.5 h-1.5 rotate-45 ${isChristmasTheme ? 'bg-amber-400' : 'bg-amber-400'} ${siteEffectsEnabled ? 'animate-pulse' : ''}`} />
              </div>

              {/* Título Principal + SideText em layout flexível responsivo (sem estourar nem sobrepor) */}
              <div className="flex flex-wrap items-baseline justify-center gap-x-4 gap-y-2 mb-6">
                <h1 
                  className={`font-cinzel text-4xl sm:text-6xl md:text-8xl font-black tracking-tight ${siteEffectsEnabled ? (homeSettings.titleEffect === 'glitch' ? 'glitch-text' : homeSettings.titleEffect === 'pulse' ? 'animate-pulse' : '') : ''}`} 
                  data-text={homeSettings.title ?? ''}
                  style={{
                    color: isChristmasTheme ? '#ef4444' : (homeSettings.primaryColor || '#d4af37'),
                    filter: siteEffectsEnabled
                      ? `drop-shadow(0 0 ${homeSettings.titleShadowIntensity ?? 18}px ${isChristmasTheme ? '#dc2626' : (homeSettings.titleShadowColor || homeSettings.primaryColor || '#9333ea')})`
                      : 'none'
                  }}
                >
                  {homeSettings.title ?? ''}
                </h1>
                {homeSettings.sideText && (
                  <span 
                    className={`text-2xl sm:text-4xl md:text-6xl font-cyber font-bold tracking-wider pointer-events-none ${siteEffectsEnabled ? (homeSettings.sideTextEffect === 'flicker' ? 'animate-flicker-rare' : homeSettings.sideTextEffect === 'pulse' ? 'animate-pulse' : homeSettings.sideTextEffect === 'glitch' ? 'glitch-text' : '') : ''}`} 
                    data-text={homeSettings.sideText}
                    style={{ 
                      color: isChristmasTheme ? '#fbbf24' : (homeSettings.sideTextColor || '#22d3ee'),
                      filter: siteEffectsEnabled
                        ? `drop-shadow(0 0 ${homeSettings.sideTextShadowIntensity ?? 12}px ${isChristmasTheme ? '#ef4444' : (homeSettings.sideTextShadowColor || homeSettings.sideTextColor || '#06b6d4')})`
                        : 'none'
                    }}
                  >
                    {homeSettings.sideText}
                  </span>
                )}
              </div>

              <p className="text-base sm:text-lg md:text-xl text-slate-200 max-w-2xl mx-auto drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] font-medium leading-relaxed">
                {homeSettings.synopsis ?? ''}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-5 py-6 animate-pulse">
              <div className="h-4 w-56 bg-slate-800/70" />
              <div className="h-16 sm:h-20 w-72 sm:w-96 bg-slate-800/60" />
              <div className="h-4 w-80 sm:w-[28rem] bg-slate-800/50" />
            </div>
          )}
        </div>
      </header>

      {/* 2. ABAIXO: NOVIDADES */}
      <div data-tour-id="tour-sec-novidades">
        <NovidadesSection 
          products={homeSettings?.exclusiveProducts || []} 
          onOpenProductModal={(product, variationIndex) => {
            setSelectedProduct(product);
            setSelectedProductVariationIndex(variationIndex);
          }}
          onOpenStoreCheckout={(product, variationIdx) => {
            if (product && typeof product === 'object') {
              addToCart(product, variationIdx, 1);
            }
            setStoreInitialOrderId(null);
            setStoreInitialTab('carrinho');
            setIsBuyModalOpen(true);
          }}
          allCards={allCards}
          textureSlot={textures.novidades_cyber_texture}
          showPlaceholderBadge={showPlaceholdersUI}
          onConfigureTexture={handleOpenTextureSlotConfig}
          rareCardsConfig={featuredRareCardsConfig || homeSettings?.featuredRareCardsConfig}
          isAdmin={isAdmin}
          onOpenCatalog={() => {
            navigateToModal(() => {
              setIsCatalogOpen(true);
            });
          }}
          onSaveRareCardsConfig={async (config) => {
            const cleanConfig: FeaturedRareCardsConfig = JSON.parse(JSON.stringify(config));
            setFeaturedRareCardsConfig(cleanConfig);
            writeBrowserCache('ld_cache_featuredRareCards_v1', cleanConfig);
            setHomeSettings((prev: any) => {
              const next = { ...(prev || {}), featuredRareCardsConfig: cleanConfig };
              writeBrowserCache('ld_cache_homeSettings_v2', next);
              return next;
            });
            await setDoc(
              doc(db, 'homeSettings', 'featuredRareCards'),
              cleanConfig,
              { merge: true }
            );
          }}
          onSaveProducts={async (nextProducts) => {
            const cleanProducts = JSON.parse(JSON.stringify(nextProducts));
            setHomeSettings((prev: any) => {
              const next = { ...(prev || {}), exclusiveProducts: cleanProducts };
              writeBrowserCache('ld_cache_homeSettings_v2', next);
              return next;
            });
            await setDoc(
              doc(db, 'homeSettings', 'global'),
              { exclusiveProducts: cleanProducts },
              { merge: true }
            );
          }}
        />
      </div>

      {/* 3. ABAIXO: SOBRE LIGHT DARK */}
      <div data-tour-id="tour-sec-sobre">
        <GameLore
          textureSlot={textures.lore_grimoire_texture}
          showPlaceholderBadge={showPlaceholdersUI}
          onConfigureTexture={handleOpenTextureSlotConfig}
        />
      </div>

      {/* 4. ABAIXO: MANUAL E REGRAS (PATCH ATUAL:) + Tipos de Cartas + RESTANTE DO MANUAL */}
      <div data-tour-id="tour-sec-manual">
      <GameGuideSections 
        archetypes={archetypes} 
        isAdmin={isAdmin} 
        ArchetypeCardComponent={ArchetypeCard}
        textureSlot={textures.manual_codex_texture}
        panelTextureSlot={textures.panel_card_texture}
        showPlaceholderBadge={showPlaceholdersUI}
        onConfigureTexture={handleOpenTextureSlotConfig}
        tourOpenManualSection={activeTourSlide?.manualSection || null}
        cardTypesShowcase={
          <div id="cartas" data-tour-id="tour-sec-cartas" className="py-10 px-4 sm:px-8 cyber-arcane-box relative overflow-hidden">
            <ArcaneCyberTextureLayer
              slot={textures.card_altar_texture}
              variant="high-magic"
              showPlaceholderBadge={showPlaceholdersUI}
              onOpenConfig={handleOpenTextureSlotConfig}
            />
            <CyberArcaneCornerFrame accent="gold" />
            <div className="text-center mb-10 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-0.5 mb-2 bg-purple-950/70 border border-amber-500/35 text-[10px] font-mono uppercase tracking-[0.25em] text-amber-300">
                <span>ALTAR DE INVOCAÇÃO // MATRIZ DE CARTAS</span>
              </div>
              <h3 className="text-2xl sm:text-4xl font-cinzel font-black text-amber-50 uppercase tracking-wider">Tipos de Cartas</h3>
              <div className="flex items-center justify-center gap-2 mt-3">
                <div className="w-12 h-[1px] bg-amber-500/60"></div>
                <div className="w-2 h-2 rotate-45 bg-cyan-400"></div>
                <div className="w-12 h-[1px] bg-cyan-400/60"></div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 px-2 md:px-0 relative z-10">
              {(showcaseCards.length > 0 ? showcaseCards : DEFAULT_SHOWCASE_CARDS).map((card, idx) => (
                <motion.div 
                  key={`${card.type}-${card.code}-${idx}`} 
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.06 }}
                  className="group cursor-pointer w-full max-w-[175px] sm:max-w-[220px] md:max-w-none mx-auto hover:scale-105 transition-transform flex flex-col items-center gap-2.5"
                  onClick={() => setSelectedType(card.type)}
                  title={`Clique para inspecionar a classe ${card.type}`}
                >
                  <div className="w-full relative">
                    <Card {...card} priority={true} />
                  </div>
                  <div className="w-full py-1.5 px-3 bg-[#090414]/90 border border-amber-500/35 group-hover:border-cyan-400/70 transition-colors text-center shadow-[0_0_15px_rgba(0,0,0,0.6)]">
                    <span className="text-[11px] sm:text-xs font-cinzel font-bold uppercase tracking-[0.2em] text-amber-200 group-hover:text-cyan-300 transition-colors">
                      {card.type}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        }
      />
      </div>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-slate-900">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h4 className="font-bold text-white mb-2">LIGHT DARK TCG</h4>
            <p className="text-slate-500 text-sm mb-4">
              &copy; 2024. Todos os direitos reservados.<br/>
              Os personagens, nomes, e jogo são marcas registradas.
            </p>
            {isAdmin && (
              <button 
                onClick={() => setAdminMode('home')} 
                className="text-slate-700 hover:text-slate-500 transition"
                title="Admin da Tela Inicial"
              >
                <Settings size={14} />
              </button>
            )}
          </div>

          <div className="flex gap-6">
            <a href="https://www.instagram.com/lightdarktcg/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-purple-500 transition">
              <Instagram size={24} />
              <span className="sr-only">Instagram</span>
            </a>
            <a href="https://www.youtube.com/@LightDarkCardGame" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-red-600 transition">
              <Youtube size={24} />
              <span className="sr-only">YouTube</span>
            </a>
            <a href="https://chat.whatsapp.com/LbCUjK7svXzEnc5UGNE9ZC" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-green-500 transition">
              <MessageCircle size={24} />
              <span className="sr-only">WhatsApp</span>
            </a>
            <a href="mailto:lightdarktcg@gmail.com" className="text-slate-400 hover:text-blue-500 transition">
              <Mail size={24} />
              <span className="sr-only">Email</span>
            </a>
            <a href="https://open.spotify.com/intl-pt/artist/07k0ysslV4dERl0GGaFaji?si=Lou5gJwLT96skytMqWVokw" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-green-400 transition">
              <Music size={24} />
              <span className="sr-only">Spotify</span>
            </a>
          </div>
        </div>
      </footer>

      {/* Product Detail Modal (Multiple Media Gallery & Decklist) */}
      {selectedProduct && (
        <ProductDetailModal 
          product={selectedProduct}
          initialVariationIndex={selectedProductVariationIndex}
          onClose={closeCurrentModal}
          allCards={allCards}
          onSelectCard={(c) => setInspectedDeckCard(c)}
          onAddToCart={(prod, varIdx) => {
            addToCart(prod, varIdx, 1);
          }}
          onBuyNow={(prod, varIdx) => {
            addToCart(prod, varIdx, 1);
            navigateToModal(() => {
              setStoreInitialTab('carrinho');
              setIsBuyModalOpen(true);
            });
          }}
        />
      )}

      {/* Modal to inspect cards from the pre-built deck list */}
      {inspectedDeckCard && (
        <CardDetailModal 
          card={inspectedDeckCard}
          onClose={() => setInspectedDeckCard(null)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
      )}

      {/* Janela de Primeira Visita ou Longo Tempo sem Entrar ("Primeira vez no site? Deseja conhecer a plataforma?") */}
      <BlairFirstVisitPromptModal
        isOpen={isWelcomePromptOpen}
        onAccept={handleAcceptWelcomePrompt}
        onDecline={handleDeclineWelcomePrompt}
        blairPngUrl={
          tourSettings.welcomePromptPngUrl ||
          tourSettings.stepBlairPngUrls?.['step_01_welcome'] ||
          tourSettings.defaultBlairPngUrl ||
          ''
        }
        isAdmin={isAdmin}
        tourSettings={tourSettings}
        onSaveWelcomePrompt={saveWelcomePromptContent}
      />

      {/* Apresentação Dinâmica "Conheça o Site" Guiada pela Blair */}
      <BlairSiteTourModal
        isOpen={isTourModalOpen}
        onClose={handleCloseTour}
        currentSlideIndex={tourSlideIndex}
        onChangeSlideIndex={setTourSlideIndex}
        isAdmin={isAdmin}
        tourSettings={tourSettings}
        onSaveStepPng={saveBlairStepPng}
        onSaveDefaultPng={saveDefaultBlairPng}
        onSaveStepContent={saveBlairStepContent}
      />
    </div>
  );
}