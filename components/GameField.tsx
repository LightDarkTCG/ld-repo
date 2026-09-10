import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Sword, Shield, Layers, Ban, Skull, 
  Crown, Droplet, Heart, ArrowDown, ArrowUp, Flame, Gem, Brain, Info, Sparkles
} from 'lucide-react';

type ZoneType = 'combatant' | 'effect' | 'deck' | 'graveyard' | 'banished' | 'hero-deck' | 'stats' | 'modifiers';

interface ZoneInfo {
  id: string;
  title: string;
  tag: string;
  description: string;
  type: ZoneType;
  color: string;
  icon?: React.ElementType;
}

const zones: ZoneInfo[] = [
  {
    id: 'combatant',
    title: 'Área Combatente / Herói',
    tag: 'Linha de Frente (Máx. 6)',
    description: 'Máximo de 6 cartas na linha de frente. Aqui ficam seus Combatentes e seu Herói principal. Eles atacam os combatentes adversários e defendem o jogador diretamente.',
    type: 'combatant',
    color: 'bg-red-600',
    icon: Sword
  },
  {
    id: 'effect',
    title: 'Área Equipamento / Efeitos',
    tag: 'Retaguarda (Máx. 6)',
    description: 'Máximo de 6 cartas na retaguarda. Aqui ficam Equipamentos e cartas de Efeito contínuo. É permitido equipar múltiplos itens no mesmo combatente/herói na mesma área.',
    type: 'effect',
    color: 'bg-blue-600',
    icon: Shield
  },
  {
    id: 'graveyard',
    title: 'Zona Morta (Cemitério)',
    tag: 'Descarte & Destruição',
    description: 'Local para onde são enviadas cartas destruídas em combate, efeitos de uso único já executados ou cartas descartadas da mão.',
    type: 'graveyard',
    color: 'bg-stone-700',
    icon: Skull
  },
  {
    id: 'mana',
    title: 'Mana (Cristais de Ação)',
    tag: '12 Cristais / Turno',
    description: '12 pontos de Mana fixos que se renovam no início de cada rodada. Usados para invocar Combatentes, Heróis e ativar cartas de Efeito.',
    type: 'stats',
    color: 'bg-cyan-600',
    icon: Droplet
  },
  {
    id: 'vida',
    title: 'Vida do Jogador',
    tag: '20 Pontos de Vida',
    description: 'Os duelistas iniciam com 20 PV. Ataques diretos não defendidos reduzem essa vida. Se seus PV chegarem a 0, você é derrotado.',
    type: 'stats',
    color: 'bg-red-600',
    icon: Heart
  },
  {
    id: 'sanidade',
    title: 'Sanidade',
    tag: 'Expansão 2027',
    description: 'Em 2027 os horrores de Arkham chegarão ao Macroverso trazendo mecânicas inéditas de colapso mental e pesadelo cósmico.',
    type: 'stats',
    color: 'bg-emerald-600',
    icon: Brain
  },
  {
    id: 'main-deck',
    title: 'Deck Principal',
    tag: '30 a 35 Cartas Únicas',
    description: 'Seu baralho principal de duelo contendo Combatentes, Efeitos e Equipamentos. O deck total com os Heróis tem entre 30 a 35 cartas sem repetição (regra Highlander).',
    type: 'deck',
    color: 'bg-slate-200 text-slate-900',
    icon: Layers
  },
  {
    id: 'hero-deck',
    title: 'Deck de Heróis',
    tag: 'Identidade & Variantes',
    description: 'Baralho à parte contendo apenas suas cartas de Herói. Usa-se apenas um Herói base por deck, porém com liberdade para incluir suas variantes alternativas.',
    type: 'hero-deck',
    color: 'bg-amber-500 text-slate-900',
    icon: Crown
  },
  {
    id: 'cost-mod',
    title: 'Modificadores de Custo',
    tag: 'Alteradores de Mana',
    description: 'O custo de invocar cartas pode sofrer aumentos ou reduções dinâmicas de acordo com habilidades e auras presentes no campo.',
    type: 'modifiers',
    color: 'bg-yellow-500 text-slate-900',
    icon: ArrowDown
  },
  {
    id: 'deck-damage',
    title: 'Dano Primordial',
    tag: 'Ataque ao Baralho',
    description: 'Efeitos que causam dano ao deck reduzem a vida de todos os combatentes contidos nele. Se a vida zerar no deck, o combatente morre na hora ao ser invocado.',
    type: 'modifiers',
    color: 'bg-orange-600',
    icon: Flame
  },
  {
    id: 'runes',
    title: 'Runas Cósmicas',
    tag: 'Marcadores de Poder',
    description: 'Marcadores especiais gerados por cartas do arquétipo Cósmico ou habilidades únicas. Acumuladas para despertar poderes supremos.',
    type: 'modifiers',
    color: 'bg-pink-600',
    icon: Gem
  },
  {
    id: 'banished',
    title: 'Zona Apagada (Exílio)',
    tag: 'Removida da Partida',
    description: 'O exílio do jogo. Cartas apagadas são extirpadas do duelo além do cemitério e raramente alguma mecânica consegue recuperá-las.',
    type: 'banished',
    color: 'bg-zinc-800 border-red-500/50',
    icon: Ban
  }
];

interface ActiveTarget {
  id: string;
  zone: ZoneInfo;
  centerX: number;
  targetY: number;
  placement: 'top' | 'bottom';
  slotIndex?: number;
}

export const GameField: React.FC = () => {
  const [activeTarget, setActiveTarget] = useState<ActiveTarget | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState<number>(900);
  const [boardHeight, setBoardHeight] = useState<number>(550);

  // Keep board dimensions in sync to accurately clamp floating popovers
  useEffect(() => {
    const updateDimensions = () => {
      if (boardRef.current) {
        setBoardWidth(boardRef.current.offsetWidth);
        setBoardHeight(boardRef.current.offsetHeight);
      }
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    if (boardRef.current) {
      observer.observe(boardRef.current);
    }

    window.addEventListener('resize', updateDimensions);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  const handleSlotClick = (zoneId: string, event: React.MouseEvent<HTMLElement>, index?: number) => {
    event.stopPropagation();
    
    // Toggle off if already clicked
    if (activeTarget?.id === zoneId && activeTarget?.slotIndex === index) {
      setActiveTarget(null);
      return;
    }

    const zone = zones.find(z => z.id === zoneId);
    if (!zone || !boardRef.current) return;

    const boardRect = boardRef.current.getBoundingClientRect();
    const slotRect = event.currentTarget.getBoundingClientRect();

    const centerX = (slotRect.left + slotRect.right) / 2 - boardRect.left;
    const topY = slotRect.top - boardRect.top;
    const bottomY = slotRect.bottom - boardRect.top;

    // If slot is in the lower 45% of the board, tooltip floats ABOVE (arrow points DOWN)
    // Otherwise it floats BELOW (arrow points UP)
    const isLowerHalf = topY > boardRect.height * 0.42;
    const placement: 'top' | 'bottom' = isLowerHalf ? 'top' : 'bottom';

    setActiveTarget({
      id: zoneId,
      zone,
      centerX,
      targetY: placement === 'top' ? topY : bottomY,
      placement,
      slotIndex: index
    });
  };

  // Common styles for slots
  const slotBaseClass = "relative rounded-xl border-2 transition-all duration-300 cursor-pointer flex items-center justify-center group overflow-hidden shadow-lg backdrop-blur-sm";
  const slotInactiveBase = "border-slate-700/60 bg-slate-800/50";
  const slotInactiveCombatant = `${slotInactiveBase} hover:border-red-400/60 hover:bg-[linear-gradient(to_bottom,rgba(239,68,68,0.2)_50%,rgba(59,130,246,0.2)_50%)] hover:shadow-[0_-8px_20px_rgba(239,68,68,0.3),0_8px_20px_rgba(59,130,246,0.3)]`;
  const slotInactiveEffect = `${slotInactiveBase} hover:border-purple-400/60 hover:bg-[linear-gradient(to_bottom,rgba(168,85,247,0.2)_50%,rgba(34,197,94,0.2)_50%)] hover:shadow-[0_-8px_20px_rgba(168,85,247,0.3),0_8px_20px_rgba(34,197,94,0.3)]`;
  const slotInactiveDefault = `${slotInactiveBase} hover:bg-slate-700/60 hover:border-slate-500 hover:shadow-purple-500/20`;
  const slotActiveClass = "border-yellow-400 bg-slate-700/90 shadow-[0_0_25px_rgba(250,204,21,0.35)] ring-2 ring-yellow-400/50 scale-[1.03] z-20";

  // Calculate popover width and position clamped inside the board
  const CARD_WIDTH = Math.min(360, Math.max(280, boardWidth - 32));
  const cardLeft = activeTarget 
    ? Math.max(16, Math.min(boardWidth - CARD_WIDTH - 16, activeTarget.centerX - CARD_WIDTH / 2))
    : 16;
  const arrowOffset = activeTarget 
    ? Math.max(20, Math.min(CARD_WIDTH - 20, activeTarget.centerX - cardLeft))
    : 20;

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Interactive Helper Banner */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900/60 border border-purple-900/30 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-purple-400 animate-pulse" />
          <span>Clique em qualquer área do campo para ver a explicação na hora com a seta indicativa.</span>
        </div>
        {activeTarget && (
          <button 
            onClick={() => setActiveTarget(null)}
            className="text-purple-400 hover:text-white flex items-center gap-1 font-semibold text-[11px]"
          >
            <X size={13} /> Fechar aviso
          </button>
        )}
      </div>

      {/* The Board Container */}
      <div 
        ref={boardRef}
        onClick={() => setActiveTarget(null)}
        className="relative w-full bg-[#0d0d10] rounded-2xl p-3 sm:p-5 md:p-7 shadow-2xl border-4 border-[#222228] select-none overflow-visible"
      >
        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 pointer-events-none opacity-5 rounded-2xl bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:36px_36px]"></div>

        {/* Board Rows */}
        <div className="flex flex-col gap-3 sm:gap-4 max-w-6xl mx-auto relative z-10">
          
          {/* ROW 1: COMBATANT ZONES */}
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-red-400/80 flex items-center gap-1.5">
                <Sword size={12} /> Linha de Frente — Combatente / Herói (Máx. 6)
              </span>
            </div>
            <div className="grid grid-cols-6 gap-2 sm:gap-3 h-24 sm:h-32 md:h-40">
              {[...Array(6)].map((_, i) => {
                const isActive = activeTarget?.id === 'combatant' && activeTarget?.slotIndex === i;
                return (
                  <div 
                    key={`comb-${i}`} 
                    onClick={(e) => handleSlotClick('combatant', e, i)}
                    className={`${slotBaseClass} ${isActive ? slotActiveClass : slotInactiveCombatant}`}
                  >
                    <Sword className={`transition duration-300 ${isActive ? 'text-yellow-400 scale-110' : 'text-slate-600 group-hover:text-red-400 opacity-40 group-hover:opacity-100'}`} size={28} />
                    <span className="absolute bottom-1.5 text-[9px] sm:text-[10px] uppercase font-bold text-slate-500 tracking-wider">Combat #{i + 1}</span>
                    {isActive && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ROW 2: EFFECT ZONES */}
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-blue-400/80 flex items-center gap-1.5">
                <Shield size={12} /> Retaguarda — Equipamentos & Efeitos (Máx. 6)
              </span>
            </div>
            <div className="grid grid-cols-6 gap-2 sm:gap-3 h-24 sm:h-32 md:h-40">
              {[...Array(6)].map((_, i) => {
                const isActive = activeTarget?.id === 'effect' && activeTarget?.slotIndex === i;
                return (
                  <div 
                    key={`eff-${i}`} 
                    onClick={(e) => handleSlotClick('effect', e, i)}
                    className={`${slotBaseClass} ${isActive ? slotActiveClass : slotInactiveEffect}`}
                  >
                    <Shield className={`transition duration-300 ${isActive ? 'text-yellow-400 scale-110' : 'text-slate-600 group-hover:text-blue-400 opacity-40 group-hover:opacity-100'}`} size={28} />
                    <span className="absolute bottom-1.5 text-[9px] sm:text-[10px] uppercase font-bold text-slate-500 tracking-wider">Efeito #{i + 1}</span>
                    {isActive && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ROW 3: UTILITY ZONES */}
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-slate-400/80 flex items-center gap-1.5">
                <Layers size={12} /> Zonas de Suporte, Baralhos e Marcadores
              </span>
            </div>
            <div className="grid grid-cols-6 gap-2 sm:gap-3 h-28 sm:h-36 md:h-44">
              
              {/* COL 1: Graveyard */}
              <div 
                onClick={(e) => handleSlotClick('graveyard', e)}
                className={`${slotBaseClass} ${activeTarget?.id === 'graveyard' ? slotActiveClass : slotInactiveDefault} flex-col gap-1 sm:gap-2`}
              >
                <Skull className={activeTarget?.id === 'graveyard' ? 'text-yellow-400' : 'text-slate-500 group-hover:text-slate-300'} size={28} />
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Zona<br/>Morta</span>
                {activeTarget?.id === 'graveyard' && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                )}
              </div>

              {/* COL 2: Stats (Mana/Life/Sanity) */}
              <div className="flex flex-col gap-1.5 h-full">
                <div 
                  onClick={(e) => handleSlotClick('mana', e)}
                  className={`flex-1 rounded-lg border transition-all cursor-pointer flex items-center justify-center px-1 ${
                    activeTarget?.id === 'mana' 
                      ? 'bg-cyan-500/25 border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400' 
                      : 'border-slate-700/60 bg-slate-800/40 hover:border-cyan-500/70 hover:bg-cyan-500/10'
                  }`}
                >
                  <div className="flex items-center gap-1 sm:gap-1.5 text-cyan-400">
                    <Droplet size={13} fill="currentColor" className="opacity-90" />
                    <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-wider">MANA</span>
                  </div>
                </div>
                
                <div 
                  onClick={(e) => handleSlotClick('vida', e)}
                  className={`flex-1 rounded-lg border transition-all cursor-pointer flex items-center justify-center px-1 ${
                    activeTarget?.id === 'vida' 
                      ? 'bg-red-500/25 border-red-300 shadow-[0_0_15px_rgba(239,68,68,0.4)] ring-1 ring-red-400' 
                      : 'border-slate-700/60 bg-slate-800/40 hover:border-red-500/70 hover:bg-red-500/10'
                  }`}
                >
                  <div className="flex items-center gap-1 sm:gap-1.5 text-red-400">
                    <Heart size={13} fill="currentColor" className="opacity-90" />
                    <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-wider">VIDA</span>
                  </div>
                </div>

                <div 
                  onClick={(e) => handleSlotClick('sanidade', e)}
                  className={`flex-1 rounded-lg border transition-all cursor-pointer flex items-center justify-center px-1 ${
                    activeTarget?.id === 'sanidade' 
                      ? 'bg-emerald-500/25 border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)] ring-1 ring-emerald-400' 
                      : 'border-slate-700/60 bg-slate-800/40 hover:border-emerald-500/70 hover:bg-emerald-500/10'
                  }`}
                >
                  <div className="flex items-center gap-1 sm:gap-1.5 text-emerald-400">
                    <Brain size={13} className="opacity-90" />
                    <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-wider">SANIDADE</span>
                  </div>
                </div>
              </div>

              {/* COL 3: Main Deck */}
              <div 
                onClick={(e) => handleSlotClick('main-deck', e)}
                className={`${slotBaseClass} ${activeTarget?.id === 'main-deck' ? slotActiveClass : slotInactiveDefault} flex-col gap-1 sm:gap-2`}
              >
                <Layers className={activeTarget?.id === 'main-deck' ? 'text-yellow-400' : 'text-slate-400 group-hover:text-white'} size={28} />
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Deck<br/>Principal</span>
                {activeTarget?.id === 'main-deck' && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                )}
              </div>

              {/* COL 4: Hero Deck */}
              <div 
                onClick={(e) => handleSlotClick('hero-deck', e)}
                className={`${slotBaseClass} ${activeTarget?.id === 'hero-deck' ? slotActiveClass : slotInactiveDefault} flex-col gap-1 sm:gap-2`}
              >
                <Crown className={activeTarget?.id === 'hero-deck' ? 'text-yellow-400' : 'text-amber-500 group-hover:text-amber-400'} size={28} />
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Deck<br/>Herói</span>
                {activeTarget?.id === 'hero-deck' && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                )}
              </div>

              {/* COL 5: Mechanics (Cost/Dmg/Runes) */}
              <div className="flex flex-col gap-1.5 h-full">
                <div 
                  onClick={(e) => handleSlotClick('cost-mod', e)}
                  className={`flex-1 rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1 px-1 ${
                    activeTarget?.id === 'cost-mod' 
                      ? 'bg-yellow-500/25 border-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.4)] ring-1 ring-yellow-400' 
                      : 'border-slate-700/60 bg-slate-800/40 hover:border-yellow-500/70 hover:bg-yellow-500/10'
                  }`}
                  title="Modificadores de Custo"
                >
                  <ArrowDown size={13} className={activeTarget?.id === 'cost-mod' ? 'text-yellow-400' : 'text-slate-400'} />
                  <ArrowUp size={13} className={activeTarget?.id === 'cost-mod' ? 'text-yellow-400' : 'text-slate-400'} />
                  <span className="text-[8px] sm:text-[9px] font-bold text-yellow-400/80">CUSTO</span>
                </div>

                <div 
                  onClick={(e) => handleSlotClick('deck-damage', e)}
                  className={`flex-1 rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1 px-1 ${
                    activeTarget?.id === 'deck-damage' 
                      ? 'bg-orange-500/25 border-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.4)] ring-1 ring-orange-400' 
                      : 'border-slate-700/60 bg-slate-800/40 hover:border-orange-500/70 hover:bg-orange-500/10'
                  }`}
                  title="Dano Primordial"
                >
                  <Flame size={14} className={activeTarget?.id === 'deck-damage' ? 'text-orange-400' : 'text-orange-400/70'} />
                  <span className="text-[8px] sm:text-[9px] font-bold text-orange-400/80">PRIMORDIAL</span>
                </div>

                <div 
                  onClick={(e) => handleSlotClick('runes', e)}
                  className={`flex-1 rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1 px-1 ${
                    activeTarget?.id === 'runes' 
                      ? 'bg-pink-500/25 border-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.4)] ring-1 ring-pink-400' 
                      : 'border-slate-700/60 bg-slate-800/40 hover:border-pink-500/70 hover:bg-pink-500/10'
                  }`}
                  title="Runas"
                >
                  <Gem size={14} className={activeTarget?.id === 'runes' ? 'text-pink-400' : 'text-pink-400/70'} />
                  <span className="text-[8px] sm:text-[9px] font-bold text-pink-400/80">RUNAS</span>
                </div>
              </div>

              {/* COL 6: Banished */}
              <div 
                onClick={(e) => handleSlotClick('banished', e)}
                className={`${slotBaseClass} ${activeTarget?.id === 'banished' ? slotActiveClass : slotInactiveDefault} flex-col gap-1 sm:gap-2`}
              >
                <Ban className={activeTarget?.id === 'banished' ? 'text-yellow-400' : 'text-slate-500 group-hover:text-red-400'} size={28} />
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Zona<br/>Apagada</span>
                {activeTarget?.id === 'banished' && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                )}
              </div>

            </div>
          </div>
        </div>

        {/* FLOATING EXPLANATION WINDOW WITH DIRECTIONAL ARROW */}
        <AnimatePresence>
          {activeTarget && (
            <motion.div
              key={`${activeTarget.id}-${activeTarget.slotIndex ?? 'default'}`}
              initial={{ 
                opacity: 0, 
                y: activeTarget.placement === 'top' ? 12 : -12, 
                scale: 0.96 
              }}
              animate={{ 
                opacity: 1, 
                y: 0, 
                scale: 1 
              }}
              exit={{ 
                opacity: 0, 
                y: activeTarget.placement === 'top' ? 8 : -8, 
                scale: 0.96 
              }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="absolute z-50 bg-[#121217]/95 backdrop-blur-xl border border-purple-500/70 rounded-2xl p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_35px_rgba(168,85,247,0.25)] text-white"
              style={{
                left: `${cardLeft}px`,
                ...(activeTarget.placement === 'top' 
                  ? { bottom: `${boardHeight - activeTarget.targetY + 12}px` }
                  : { top: `${activeTarget.targetY + 12}px` }),
                width: `${CARD_WIDTH}px`
              }}
            >
              {/* Directional Arrow Pointing To The Clicked Spot */}
              {activeTarget.placement === 'top' ? (
                // Points DOWN towards the target slot
                <div 
                  className="absolute -bottom-2 w-4 h-4 bg-[#121217] border-r border-b border-purple-500/70 rotate-45 shadow-lg pointer-events-none transform -translate-x-1/2"
                  style={{ left: `${arrowOffset}px` }}
                />
              ) : (
                // Points UP towards the target slot
                <div 
                  className="absolute -top-2 w-4 h-4 bg-[#121217] border-l border-t border-purple-500/70 rotate-45 shadow-lg pointer-events-none transform -translate-x-1/2"
                  style={{ left: `${arrowOffset}px` }}
                />
              )}

              {/* Card Content Header */}
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl shadow-md ${activeTarget.zone.color.includes('text-slate-900') ? activeTarget.zone.color : `${activeTarget.zone.color} text-white`}`}>
                    {activeTarget.zone.icon && React.createElement(activeTarget.zone.icon, { size: 18 })}
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-wide leading-tight">
                      {activeTarget.zone.title}
                    </h3>
                    <span className="inline-block text-[10px] font-semibold text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded-md border border-purple-800/50 mt-1">
                      {activeTarget.zone.tag}
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setActiveTarget(null)}
                  className="text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 p-1.5 rounded-lg transition-colors"
                  aria-label="Fechar janela"
                  title="Fechar"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Card Description */}
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                {activeTarget.zone.description}
              </p>

              {/* Footer Tip */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Clique fora para fechar</span>
                <span className="text-purple-400 font-bold">LIGHT DARK TCG</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};
