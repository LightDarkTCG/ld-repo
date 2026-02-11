import React, { useState } from 'react';
import { 
  Info, X, Sword, Shield, Layers, Ban, Skull, 
  Crown, Droplet, Heart, ArrowDown, ArrowUp, Flame, Gem 
} from 'lucide-react';

type ZoneType = 'combatant' | 'effect' | 'deck' | 'graveyard' | 'banished' | 'hero-deck' | 'stats' | 'modifiers';

interface ZoneInfo {
  id: string;
  title: string;
  description: string;
  type: ZoneType;
  color: string;
  icon?: React.ElementType;
}

const zones: ZoneInfo[] = [
  {
    id: 'combatant',
    title: 'Área Combatente / Herói',
    description: 'Máximo de 6 cartas na linha de frente. Aqui ficam seus Combatentes e seu Herói. Eles atacam e defendem o jogador.',
    type: 'combatant',
    color: 'bg-red-600',
    icon: Sword
  },
  {
    id: 'effect',
    title: 'Área Equipamento / Efeitos',
    description: 'Máximo de 6 cartas na retaguarda. Aqui ficam Equipamentos e cartas de Efeito contínuo. É possível usar vários equipamentos no mesmo combatente/herói usando a mesma área.',
    type: 'effect',
    color: 'bg-blue-600',
    icon: Shield
  },
  {
    id: 'graveyard',
    title: 'Zona Morta',
    description: 'Onde se enviam as cartas destruídas em combate, usadas ou descartadas.',
    type: 'graveyard',
    color: 'bg-stone-600',
    icon: Skull
  },
  {
    id: 'stats',
    title: 'Vida e Mana',
    description: 'VIDA: Jogadores iniciam com 20 PV. Se chegar a 0, você perde. MANA: 12 pontos fixos por rodada para pagar o custo (CT) das cartas.',
    type: 'stats',
    color: 'bg-cyan-600',
    icon: Droplet
  },
  {
    id: 'main-deck',
    title: 'Deck Principal',
    description: 'Seu baralho principal, contendo Combatentes, Efeitos e Equipamentos. O deck total contando com Heróis deve ter entre 30 a 35 cartas sem repetição entre elas.',
    type: 'deck',
    color: 'bg-slate-200 text-slate-900',
    icon: Layers
  },
  {
    id: 'hero-deck',
    title: 'Deck de Heróis',
    description: 'Baralho separado contendo apenas seus Heróis. É possível usar apenas um Herói por deck, mas diversas variantes deles. exemplo Jenos Caído e Jenos Senhor do Macroverso no mesmo deck.',
    type: 'hero-deck',
    color: 'bg-amber-500 text-slate-900',
    icon: Crown
  },
  {
    id: 'cost-mod',
    title: 'Modificadores de Custo',
    description: 'O custo de suas cartas pode mudar de acordo com alguns efeitos de cartas, aumentando ou diminuindo.',
    type: 'modifiers',
    color: 'bg-yellow-500 text-slate-900',
    icon: ArrowDown
  },
  {
    id: 'deck-damage',
    title: 'Dano no Deck',
    description: 'Certos efeitos "queimam" o deck do oponente, quando um valor de dano é dado ao deck, todos os combatentes com vida igual ou menor a esse dano morrem automaticamente ao serem invocados.',
    type: 'modifiers',
    color: 'bg-orange-600',
    icon: Flame
  },
  {
    id: 'runes',
    title: 'Runas',
    description: 'Marcadores especiais acumulados por cartas com arquétipo Cósmico ou efeitos específicos. Usadas para ativar habilidades poderosas.',
    type: 'modifiers',
    color: 'bg-pink-600',
    icon: Gem
  },
  {
    id: 'banished',
    title: 'Zona Apagada',
    description: 'O "exílio" do jogo. Cartas aqui são removidas da partida e raramente retornam.',
    type: 'banished',
    color: 'bg-zinc-800 border-red-500/50',
    icon: Ban
  }
];

export const GameField = () => {
  const [activeZone, setActiveZone] = useState<string | null>(null);

  const handleZoneClick = (id: string) => {
    setActiveZone(id === activeZone ? null : id);
  };

  const getActiveData = () => zones.find(z => z.id === activeZone);

  // Common styles for slots
  const slotBaseClass = "relative rounded-lg border-2 transition-all duration-300 cursor-pointer flex items-center justify-center group overflow-hidden shadow-lg backdrop-blur-sm";
  const slotInactiveClass = "border-slate-700/50 bg-slate-800/40 hover:bg-slate-700/60 hover:border-slate-500 hover:shadow-purple-500/10";
  const slotActiveClass = "border-yellow-400 bg-slate-700 shadow-[0_0_20px_rgba(250,204,21,0.2)] scale-105 z-20";

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Description Panel */}
      <div className={`w-full bg-[#16161a] border border-slate-700 rounded-xl p-6 transition-all duration-500 ease-in-out ${activeZone ? 'opacity-100 translate-y-0 shadow-2xl shadow-purple-900/20' : 'opacity-50 translate-y-4 grayscale'}`}>
        {activeZone ? (
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg shadow-lg ${getActiveData()?.color.includes('text-slate-900') ? getActiveData()?.color : `${getActiveData()?.color} text-white`}`}>
              {getActiveData()?.icon && React.createElement(getActiveData()!.icon!, { size: 24 })}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">{getActiveData()?.title}</h3>
              <p className="text-slate-300 leading-relaxed">{getActiveData()?.description}</p>
            </div>
            <button onClick={() => setActiveZone(null)} className="ml-auto text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full">
              <X size={20} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-slate-500 justify-center h-full min-h-[80px]">
            <Info size={20} className="animate-pulse" />
            <p>Clique em uma área do campo abaixo para ver os detalhes das regras.</p>
          </div>
        )}
      </div>

      {/* The Board - Dark Theme */}
      <div className="relative w-full bg-[#111113] rounded-xl p-4 md:p-8 shadow-2xl border-4 border-[#2a2a30] select-none">
        
        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

        <div className="flex flex-col gap-4 max-w-6xl mx-auto relative z-10">
          
          {/* ROW 1: COMBATANT ZONES */}
          <div className="grid grid-cols-6 gap-3 h-32 md:h-48">
             {[...Array(6)].map((_, i) => (
               <div 
                 key={`comb-${i}`} 
                 onClick={() => handleZoneClick('combatant')}
                 className={`${slotBaseClass} ${activeZone === 'combatant' ? slotActiveClass : slotInactiveClass}`}
               >
                  <Sword className="text-slate-600 group-hover:text-red-500 transition duration-500 opacity-30 group-hover:opacity-100" size={32} />
                  <span className="absolute bottom-2 text-[10px] uppercase font-bold text-slate-600 tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Combat</span>
               </div>
             ))}
          </div>

          {/* ROW 2: EFFECT ZONES */}
          <div className="grid grid-cols-6 gap-3 h-32 md:h-48">
             {[...Array(6)].map((_, i) => (
               <div 
                 key={`eff-${i}`} 
                 onClick={() => handleZoneClick('effect')}
                 className={`${slotBaseClass} ${activeZone === 'effect' ? slotActiveClass : slotInactiveClass}`}
               >
                  <Shield className="text-slate-600 group-hover:text-blue-500 transition duration-500 opacity-30 group-hover:opacity-100" size={32} />
                  <span className="absolute bottom-2 text-[10px] uppercase font-bold text-slate-600 tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Effect</span>
               </div>
             ))}
          </div>

          {/* ROW 3: UTILITY ZONES */}
          <div className="grid grid-cols-6 gap-3 mt-4 h-36 md:h-52">
            
            {/* COL 1: Graveyard */}
            <div 
              onClick={() => handleZoneClick('graveyard')}
              className={`${slotBaseClass} ${activeZone === 'graveyard' ? slotActiveClass : slotInactiveClass} flex-col gap-2`}
            >
               <Skull className="text-slate-500" size={32} />
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Morta</span>
            </div>

            {/* COL 2: Stats (Mana/Life) */}
            <div 
              onClick={() => handleZoneClick('stats')}
              className={`${slotBaseClass} ${activeZone === 'stats' ? slotActiveClass : 'border-slate-700/30 bg-transparent hover:bg-slate-800/20'} flex-col justify-center gap-6`}
            >
               <div className="flex flex-col items-center gap-1 text-cyan-500">
                  <Droplet size={28} fill="currentColor" className="opacity-80" />
                  <span className="text-xs font-mono font-bold">MANA</span>
               </div>
               <div className="flex flex-col items-center gap-1 text-red-500">
                  <Heart size={28} fill="currentColor" className="opacity-80" />
                  <span className="text-xs font-mono font-bold">VIDA</span>
               </div>
            </div>

            {/* COL 3: Main Deck */}
            <div 
              onClick={() => handleZoneClick('main-deck')}
              className={`${slotBaseClass} ${activeZone === 'main-deck' ? slotActiveClass : slotInactiveClass} flex-col gap-2`}
            >
               <Layers className="text-slate-500" size={32} />
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Deck<br/>Principal</span>
            </div>

            {/* COL 4: Hero Deck */}
            <div 
              onClick={() => handleZoneClick('hero-deck')}
              className={`${slotBaseClass} ${activeZone === 'hero-deck' ? slotActiveClass : slotInactiveClass} flex-col gap-2`}
            >
               <Crown className="text-amber-600" size={32} />
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Deck<br/>Herói</span>
            </div>

            {/* COL 5: Mechanics (Cost/Dmg/Runes) */}
            <div className="flex flex-col gap-2 h-full">
               {/* Cost Mods */}
               <div 
                 onClick={() => handleZoneClick('cost-mod')}
                 className={`flex-1 rounded border border-slate-700 hover:border-yellow-500 hover:bg-yellow-500/10 cursor-pointer flex items-center justify-center gap-2 transition ${activeZone === 'cost-mod' ? 'bg-yellow-500/20 border-yellow-400' : ''}`}
                 title="Modificadores de Custo"
               >
                  <ArrowDown size={16} className="text-slate-400" />
                  <ArrowUp size={16} className="text-slate-400" />
               </div>
               {/* Deck Damage */}
               <div 
                 onClick={() => handleZoneClick('deck-damage')}
                 className={`flex-1 rounded border border-slate-700 hover:border-orange-500 hover:bg-orange-500/10 cursor-pointer flex items-center justify-center transition ${activeZone === 'deck-damage' ? 'bg-orange-500/20 border-orange-400' : ''}`}
                 title="Dano no Deck"
               >
                  <Flame size={20} className="text-slate-400" />
               </div>
               {/* Runes */}
               <div 
                 onClick={() => handleZoneClick('runes')}
                 className={`flex-1 rounded border border-slate-700 hover:border-pink-500 hover:bg-pink-500/10 cursor-pointer flex items-center justify-center transition ${activeZone === 'runes' ? 'bg-pink-500/20 border-pink-400' : ''}`}
                 title="Runas"
               >
                  <Gem size={20} className="text-slate-400" />
               </div>
            </div>

            {/* COL 6: Banished */}
            <div 
              onClick={() => handleZoneClick('banished')}
              className={`${slotBaseClass} ${activeZone === 'banished' ? slotActiveClass : slotInactiveClass} flex-col gap-2`}
            >
               <Ban className="text-slate-500" size={32} />
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Zona<br/>Apagada</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};