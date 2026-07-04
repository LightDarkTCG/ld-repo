import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from "motion/react";
import { 
  Zap, Heart, Layers, Hexagon, BookOpen,
  ShoppingCart, MapPin, ExternalLink, Search, Filter, Box,
  Menu, X, ChevronRight, ChevronDown, ChevronUp, Scale, Ghost, Instagram, MessageCircle, Mail, Music, Info,
  Sword, Shield, Clock, AlertTriangle, Users, FileText, CheckCircle, Crown, Youtube, Settings
} from 'lucide-react';
import { Card } from './components/Card';
import { GameField } from './components/GameField';
import { DeckBuilderModal } from './components/DeckBuilderModal';
import { CardDetailModal } from './components/CardDetailModal';
import GameBoard from './components/GameBoard';
import { TournamentManager } from './components/TournamentManager';
import { AdminPanel } from './components/AdminPanel';
import { LoreView } from './components/LoreView';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { archetypesList, collectionsList } from './data';
import { useCards } from './CardContext';
import { CardData, ArchetypeData } from './types';

// --- SUB-COMPONENTS ---

const ArchetypeCard: React.FC<ArchetypeData> = ({ name, icon: Icon, imageUrl, color, description }) => (
  <div className="bg-slate-900 border border-slate-800 p-2 md:p-4 rounded-lg hover:border-slate-600 transition group relative overflow-hidden h-full flex flex-col min-h-[100px] md:min-h-[280px]">
    <div className={`absolute top-0 right-0 p-1 md:p-2 opacity-5 group-hover:opacity-10 transition ${color || ''}`}>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="w-6 h-6 md:w-12 md:h-12 object-contain grayscale" />
      ) : Icon ? (
        <Icon size={24} className="md:w-12 md:h-12" />
      ) : null}
    </div>
    <div className="flex items-center gap-2 md:gap-4 mb-1 md:mb-4">
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-8 h-8 md:w-14 md:h-14 object-contain drop-shadow-lg" />
      ) : Icon ? (
        <Icon className={`${color} w-6 h-6 md:w-[42px] md:h-[42px]`} />
      ) : null}
      <h4 className="text-slate-200 font-bold text-xs md:text-3xl tracking-wide leading-tight break-words">{name}</h4>
    </div>
    <p className="text-slate-400 text-[9px] md:text-sm leading-relaxed z-10 border-t border-slate-800 pt-1 md:pt-3 mt-auto">
      {description}
    </p>
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

const GameLore = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <section className="py-20 bg-[#0a0a0c] border-b border-slate-900 relative">
       <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">O Fim do Macroverso?</h2>
            <div className="h-1 w-24 bg-gradient-to-r from-purple-600 to-blue-600 mx-auto rounded-full"></div>
          </div>
          <div className={`relative transition-all duration-700 ease-in-out ${isExpanded ? 'max-h-[3000px]' : 'max-h-40 overflow-hidden'}`}>
             <div className="prose prose-invert prose-lg mx-auto text-slate-400 leading-relaxed text-justify">
                <p className="mb-6 first-letter:text-5xl first-letter:font-bold first-letter:text-white first-letter:mr-1 first-letter:float-left">
                  Light Dark TCG é um jogo de cartas épico que nasceu de uma RPG de mesa que existe a mais de uma década.
                </p>
                <p className="mb-6">
                  "Antes de existir qualquer universo, havia apenas duas coisas, Nada e o Mestre. Foi nesse contexto que o Mestre, que ao criar algo, criou antes o Caos, a mudança, a necessidade de algo sair da imobildiade, e após isso, criou os Conceitos, como a Criação e a Existência, abrindo o caminho para o nascimento do Tempo, do Fogo, da Água, do Desejo e de inúmeras forças cósmicas. Cada conceito molda realidades inteiras e disputa influência e coexistem sobre os universos, se algo existe é porque existe uma entidade pensante ou não.
                </p>
                <p className="mb-6">
                  No Primeiro Macroverso, Salazar, o até então Conceito da Paz reinava, mas sua bondade era passiva, uma calmaria que permitia que as sombras se aprofundassem. Na sua luz branda, o Conceito Desejo encontrou um terreno fértil para crescer, manipulando a todos, desde outros Conceitos como o Tempo até o primogênito de Salazar, o inocente Ikari.
                </p>
                <p className="mb-6">
                  A queda foi inevitável, a barreira entre os mundos, foi rasgada, e na tentativa de salvar o Macroverso de sua aniquilação pelas mãos do Nada, O Conceito Paz se dividiu em 3 entidades: Solus, Salazar e Jim.<br/>
                  Contudo, o estrago já havia sido feito e o Macroverso 1 foi reiniciado, se tornando o 2, 3 e assim até o Macroverso 13 que é onde estamos atualmente.
                </p>
                <p className="mb-6">
                  É neste mundo fraturado que uma nova geração de heróis e monstros se ergue, todos marcados pelo legado de seus pais e de seres que eles nem mesmo sabem da existência. Eles são os Escolhidos; princesas exiladas como Hyummeng; amantes amaldiçoados como Kevin e Blair, a Eterna; guerreiros forjados na dor como Criven e Donnie; e almas torturadas buscando um propósito, como Floquinho, Três e Jenos.
                </p>
                <p className="mb-6 italic text-purple-500 font-bold animate-flicker">
                  É claro, há muita história oculta a ser descoberta, muitas tramas e plots escondidos nas entrelinhas... tudo feito por Mim...
                </p>
                <p className="mb-6">
                  Agora, eles lutam não apenas contra os Errantes colossais ou os exércitos de Asmonious, mas também contra a desilusão. Pois neste novo mundo, as linhas se borraram: heróis são traídos por seus aliados mais confiáveis, vilões como Von Linden se tornam amigos, e a própria loucura, abraçada por acadêmicos como Patrick, pode ser a única forma de enxergar a verdade.
                </p>
                <p className="mb-6 border-l-4 border-purple-500 pl-4 italic bg-slate-900/50 p-4 rounded-r">
                   No jogo, os jogadores assumem o papel de heróis, dragões, Conceitos ou variantes de personagens lendários, disputando poder, fazendo combos e criando interações únicas entre as cartas. O jogo combina estratégia, ação e reação frenética, permitindo que cada partida seja única. Seu objetivo? Zerar a vida do outro jogador!
                </p>
                <p className="mb-6">
                  Acima de tudo "Light e Dark" é uma homenagem aos mais de 50 jogadores que já passaram e jogaram essa campanha, sobre amigos que fizemos, sobre relacionamentos desenvolvidos, a lore também é saga sobre os filhos pagando pelos pecados de seus pais.
                </p>
                <p className="mb-6">
                  É uma história sobre como o amor, a lealdade e o sacrifício sobrevivem em um universo onde a paz se revelou uma mentira e a traição é uma constante. Presos entre a luz de um futuro que desejam e a escuridão de um passado que os assombra.
                </p>
                <p className="mb-8 text-xl font-bold text-white text-center">
                  Contudo... o que acontece quando a maior força de todas... decide ter vontade própria?
                </p>
                
                <div className="w-full aspect-video rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
                  <iframe 
                    src="https://drive.google.com/file/d/1F5prk1S1SY_kdq_XV9JkdkAnIrD7mG-L/preview" 
                    className="w-full h-full border-0"
                    allow="autoplay; fullscreen"
                    title="Light Dark TCG Lore Video"
                  ></iframe>
                </div>
             </div>
             {!isExpanded && (
               <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent pointer-events-none"></div>
             )}
          </div>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-8 text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 px-8 py-3 rounded-full font-bold flex items-center justify-center gap-2 mx-auto transition-all hover:scale-105 group"
          >
            {isExpanded ? (
              <>Ler Menos <ChevronUp size={18} className="group-hover:-translate-y-1 transition-transform" /></>
            ) : (
              <>Ler Mais sobre a Lore <ChevronDown size={18} className="group-hover:translate-y-1 transition-transform" /></>
            )}
          </button>
       </div>
    </section>
  )
}

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
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Lojas Físicas</h3>
              <div className="space-y-3">
                <a href="https://www.instagram.com/fantasystoreudia/" target="_blank" rel="noopener noreferrer" className="bg-slate-800/50 p-4 rounded border border-slate-700 flex gap-4 items-start hover:bg-slate-800 transition block cursor-pointer">
                  <div className="bg-slate-900 p-2 rounded-full text-purple-400 mt-1">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">Fantasy Store</h4>
                    <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                      Av. África, 510 - Tibery<br/>
                      Uberlândia - MG
                    </p>
                  </div>
                </a>
                <a href="https://www.instagram.com/resetnerdstore/" target="_blank" rel="noopener noreferrer" className="bg-slate-800/50 p-4 rounded border border-slate-700 flex gap-4 items-start hover:bg-slate-800 transition block cursor-pointer">
                  <div className="bg-slate-900 p-2 rounded-full text-green-400 mt-1">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">Reset Nerd Store</h4>
                    <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                      R. Buriti Alegre, 1014 - Aparecida<br/>
                      Uberlândia - MG
                    </p>
                  </div>
                </a>
                <a href="https://www.instagram.com/mr.marlontcg/" target="_blank" rel="noopener noreferrer" className="bg-slate-800/50 p-4 rounded border border-slate-700 flex gap-4 items-start hover:bg-slate-800 transition block cursor-pointer">
                  <div className="bg-slate-900 p-2 rounded-full text-red-400 mt-1">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">Mr. TCG</h4>
                    <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                      Av. Fernando Costa, 387 - São Benedito<br/>
                      Uberaba - MG
                    </p>
                  </div>
                </a>
                <a href="https://www.instagram.com/zebugeekstore/" target="_blank" rel="noopener noreferrer" className="bg-slate-800/50 p-4 rounded border border-slate-700 flex gap-4 items-start hover:bg-slate-800 transition block cursor-pointer">
                  <div className="bg-slate-900 p-2 rounded-full text-blue-400 mt-1">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">Zebu Geek Store</h4>
                    <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                      R. Rodolfo Lírio, 458 - Nossa Sra. da Abadia<br/>
                      Uberaba - MG
                    </p>
                  </div>
                </a>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Compre Online</h3>
              <a 
                href="https://mypcards.com/LightDarkCardGame" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 p-4 rounded-lg transition group shadow-lg shadow-purple-900/20 mb-3"
              >
                <div className="flex flex-col">
                   <span className="font-bold text-white text-lg">MypCards</span>
                   <span className="text-purple-200 text-xs">Loja Oficial Online</span>
                </div>
                <ExternalLink size={20} className="text-white/80 group-hover:text-white group-hover:translate-x-1 transition-transform" />
              </a>

              <a 
                href="https://lista.mercadolivre.com.br/_CustId_3408665465?item_id=MLB6798439252&category_id=MLB432989&seller_id=3408665465&client=recoview-selleritems&recos_listing=true#origin=vip&component=sellerData&typeSeller=classic" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 p-4 rounded-lg transition group shadow-lg shadow-yellow-900/20"
              >
                <div className="flex flex-col">
                   <span className="font-bold text-black text-lg">Mercado Livre</span>
                   <span className="text-black/70 text-xs font-medium">Produtos Selecionados</span>
                </div>
                <ExternalLink size={20} className="text-black group-hover:scale-110 transition-transform" />
              </a>
            </div>
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

const CatalogModal = ({ isOpen, onClose, onOpenAdmin }: { isOpen: boolean, onClose: () => void, onOpenAdmin: () => void }) => {
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
    minDef: ""
  });

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

  const filteredCards = allCards.filter(card => {
    const searchLower = (searchTerm || "").toLowerCase();
    const matchesSearch = 
      (card.name || "").toLowerCase().includes(searchLower) || 
      (card.code || "").toLowerCase().includes(searchLower) ||
      (card.description || "").toLowerCase().includes(searchLower);

    const matchesType = filters.type === "Todos" || card.type === filters.type;
    const matchesArchetype = filters.archetype === "Todos" || card.archetype.includes(filters.archetype);
    const matchesCollection = filters.collection === "Todos" || (card.collection && card.collection === filters.collection);
    const matchesFrame = filters.frame === "Todos" || (card.frame || "Legado") === filters.frame;
    const matchesRarity = filters.rarity === "Todos" || (card.rarity || "Comum") === filters.rarity;
    const matchesCt = filters.minCt === "" || card.ct === parseInt(filters.minCt);
    
    // Changed to exact match (===) instead of >=
    const matchesAtk = filters.minAtk === "" || (card.attack !== undefined && card.attack === parseInt(filters.minAtk));
    const matchesDef = filters.minDef === "" || (card.defense !== undefined && card.defense === parseInt(filters.minDef));

    return matchesSearch && matchesType && matchesArchetype && matchesCollection && matchesFrame && matchesRarity && matchesCt && matchesAtk && matchesDef;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950 animate-in fade-in duration-200">
      
      {/* Use the new extracted component */}
      <CardDetailModal 
        card={selectedCard} 
        onClose={() => setSelectedCard(null)} 
        onSelectRelated={(related) => handleCardClick(related)}
      />

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

      <div className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shadow-lg z-20">
        <div className="flex items-center gap-3">
          <BookOpen className="text-purple-500" />
          <h2 className="text-xl font-bold text-white">Catálogo de Cartas <span className="text-slate-500 text-sm ml-2">({filteredCards.length} encontradas)</span></h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onOpenAdmin} 
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition"
            title="Admin do Catálogo"
          >
            <Settings size={20} />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition">
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="bg-slate-900/50 border-b border-slate-800 p-4 flex flex-col xl:flex-row gap-4 z-10">
        <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg overflow-hidden w-full xl:w-80 shrink-0">
          <Search className="ml-3 text-slate-500 shrink-0" size={18} />
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
                className="bg-purple-950 text-sm text-white outline-none cursor-pointer rounded px-2 w-full md:w-32"
                value={filters.rarity}
                onChange={(e) => setFilters({...filters, rarity: e.target.value})}
              >
                <option className="bg-purple-950" value="Todos">Todas</option>
                <option className="bg-purple-950" value="Comum">Comum</option>
                <option className="bg-purple-950" value="Incomum">Incomum</option>
                <option className="bg-purple-950" value="Rara">Rara</option>
                <option className="bg-purple-950" value="Muito Rara">Muito Rara</option>
                <option className="bg-purple-950" value="Limitadas">Limitadas</option>
                <option className="bg-purple-950" value="Beta">Beta</option>
                <option className="bg-purple-950" value="Evento">Evento</option>
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
          
            <button 
              onClick={() => {
                setFilters({ type: "Todos", archetype: "Todos", collection: "Todos", frame: "Todos", minCt: "", minAtk: "", minDef: "" });
                setSearchTerm("");
              }}
              className="text-xs text-slate-400 hover:text-white underline ml-auto md:ml-2 whitespace-nowrap"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#0a0a0c]">
        {filteredCards.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 md:gap-8 justify-items-center">
            {filteredCards.map((card, idx) => (
              <div key={idx} className="scale-[0.65] md:scale-90 origin-top w-full flex justify-center -mb-24 md:mb-0" onClick={() => handleCardClick(card)}>
                 <Card {...card} />
              </div>
            ))}
          </div>
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



export default function App() {
  const { cards: allCards, collections, archetypes } = useCards();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isLoreOpen, setIsLoreOpen] = useState(false);
  const [isDeckBuilderOpen, setIsDeckBuilderOpen] = useState(false);
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [isTournamentOpen, setIsTournamentOpen] = useState(false);
  const [adminMode, setAdminMode] = useState<'none' | 'home' | 'catalog' | 'master'>('none');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [showcaseCards, setShowcaseCards] = useState<CardData[]>([]);

  // Check for game mode in URL
  const [isGameMode, setIsGameMode] = useState(false);
  const [homeSettings, setHomeSettings] = useState<any>({
    title: 'LIGHT DARK',
    topSubtitle: 'Invasão do Caos',
    sideText: '1/5',
    titleEffect: 'glitch',
    primaryColor: '#a855f7',
    titleShadowColor: '#a855f7',
    titleShadowIntensity: 15,
    sideTextColor: '#a855f7',
    sideTextShadowColor: '#a855f7',
    sideTextShadowIntensity: 10,
    videos: [],
    videoTransition: 'fade' // 'fade' | 'none'
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'game') {
      setIsGameMode(true);
      setIsGameOpen(true);
    }
    
    // Recovery routine for accidentally deleted standard cards
    import('firebase/firestore').then(({ doc, deleteDoc }) => {
      deleteDoc(doc(db, 'customCards', '2025_0001_B0001')).catch(console.error);
      deleteDoc(doc(db, 'customCards', '2025_0001_00001')).catch(console.error);
      deleteDoc(doc(db, 'customCards', '2025_0001_00002')).catch(console.error);
    });

    const fetchHomeSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'homeSettings', 'global'));
        if (snap.exists()) {
          setHomeSettings((prev: any) => ({ ...prev, ...snap.data() }));
        }
      } catch(e) {
        console.error(e);
      }
    };
    fetchHomeSettings();
  }, []);

  useEffect(() => {
    const handleContext = (e: MouseEvent) => {
      e.preventDefault();
    };
    
    document.addEventListener('contextmenu', handleContext);
    return () => {
      document.removeEventListener('contextmenu', handleContext);
    };
  }, []);

  const [fetchedVideos, setFetchedVideos] = useState<string[]>([]);
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const listRef = ref(storage, 'home_videos');
        const res = await listAll(listRef);
        if (res.items.length > 0) {
          const urls = await Promise.all(res.items.map(item => getDownloadURL(item)));
          setFetchedVideos(urls);
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
  
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    videoRefs.current.forEach((vid, i) => {
      if (vid) {
        if (i === currentVideoIndex) {
          vid.currentTime = 0;
          vid.play().catch(e => console.log('Autoplay prevented', e));
        } else {
          vid.pause();
        }
      }
    });
  }, [currentVideoIndex]);

  useEffect(() => {
    setCurrentVideoIndex(Math.floor(Math.random() * backgroundVideos.length));
    const handleScroll = () => { setScrolled(window.scrollY > 50); };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [backgroundVideos.length]);

  useEffect(() => {
    // Dynamic Showcase Rotation
    const rotateShowcase = () => {
      const heroes = allCards.filter(c => c.type === 'Herói');
      const combatants = allCards.filter(c => c.type === 'Combatente');
      const effects = allCards.filter(c => c.type === 'Efeito');
      const equipments = allCards.filter(c => c.type === 'Equipamento');

      const getRandom = (arr: CardData[]) => arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : allCards[0];

      setShowcaseCards([
        getRandom(heroes),
        getRandom(combatants),
        getRandom(effects),
        getRandom(equipments)
      ]);
    };

    rotateShowcase(); // Initial load
    const interval = setInterval(rotateShowcase, 15000); // Rotate every 15 seconds

    return () => clearInterval(interval);
  }, []);

  if (isGameMode) {
    return <GameBoard onClose={() => window.close()} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 font-sans selection:bg-purple-500 selection:text-white overflow-x-hidden">
      
      <ManualModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
      <BuyModal isOpen={isBuyModalOpen} onClose={() => setIsBuyModalOpen(false)} />
      <CatalogModal isOpen={isCatalogOpen} onClose={() => setIsCatalogOpen(false)} onOpenAdmin={() => { setIsCatalogOpen(false); setAdminMode('catalog'); }} />
      {isLoreOpen && <LoreView onClose={() => setIsLoreOpen(false)} />}
      <DeckBuilderModal isOpen={isDeckBuilderOpen} onClose={() => setIsDeckBuilderOpen(false)} />
      {isTournamentOpen && <TournamentManager onClose={() => setIsTournamentOpen(false)} />}
      <TypeModal type={selectedType} onClose={() => setSelectedType(null)} />
      {isGameOpen && <GameBoard onClose={() => setIsGameOpen(false)} />}
      {adminMode !== 'none' && <AdminPanel adminType={adminMode} onClose={() => {
        if (adminMode === 'catalog') {
          setIsCatalogOpen(true);
        }
        setAdminMode('none');
      }} />}

      {/* Navbar */}
      <nav className={`fixed w-full z-50 transition-all duration-300 border-b ${scrolled ? 'bg-[#0a0a0c]/95 border-slate-800 py-3' : 'bg-transparent border-transparent py-6'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img 
              src="https://i.imgur.com/cDLxOtO.png" 
              alt="Light Dark TCG" 
              className="h-14 w-auto object-contain"
            />
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium uppercase tracking-wide">
            <button 
              onClick={() => setIsGameOpen(true)}
              className="text-purple-400 hover:text-purple-300 transition flex items-center gap-2 font-bold animate-pulse"
            >
              <Zap size={16} /> APP DUELO
            </button>
            <button 
              onClick={() => setIsTournamentOpen(true)}
              className="text-yellow-500 hover:text-yellow-400 transition flex items-center gap-2 font-bold"
            >
              <Crown size={16} /> CRIAR TORNEIO
            </button>
            <button onClick={() => setIsDeckBuilderOpen(true)} className="hover:text-purple-400 transition">MONTE SEU DECK</button>
            <a href="#arquetipos" className="hover:text-purple-400 transition">Arquétipos</a>
            <a href="#estrutura" className="hover:text-purple-400 transition">Campo</a>
            <button 
              onClick={() => setIsBuyModalOpen(true)}
              className="bg-slate-100 hover:bg-slate-200 text-black px-6 py-2 rounded font-bold transition flex items-center gap-2"
            >
              <ShoppingCart size={16} /> Comprar
            </button>
          </div>

          <button className="md:hidden text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {/* Mobile Menu */}
        {isMenuOpen && (
             <div className="md:hidden absolute top-full left-0 w-full bg-[#0a0a0c] border-b border-slate-800 p-4 flex flex-col gap-4 shadow-2xl animate-in slide-in-from-top-2">
                <button 
                  onClick={() => { setIsGameOpen(true); setIsMenuOpen(false); }}
                  className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-2"
                >
                  <Zap size={16} /> APP DUELO
                </button>
                <button 
                  onClick={() => { setIsTournamentOpen(true); setIsMenuOpen(false); }}
                  className="text-yellow-500 hover:text-yellow-400 font-bold flex items-center gap-2"
                >
                  <Crown size={16} /> CRIAR TORNEIO
                </button>
                <button onClick={() => { setIsDeckBuilderOpen(true); setIsMenuOpen(false); }} className="text-white hover:text-purple-400 text-left">MONTE SEU DECK</button>
                <a href="#arquetipos" className="text-white hover:text-purple-400" onClick={()=>setIsMenuOpen(false)}>Arquétipos</a>
                <a href="#estrutura" className="text-white hover:text-purple-400" onClick={()=>setIsMenuOpen(false)}>Campo</a>
                <button 
                  onClick={() => { setIsBuyModalOpen(true); setIsMenuOpen(false); }}
                  className="bg-purple-600 text-white px-4 py-2 rounded font-bold"
                >
                  Comprar
                </button>
             </div>
        )}
      </nav>

      {/* Hero Section */}
      <header className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden h-[80vh] flex items-center">
        <div className="absolute top-0 left-0 w-full h-full z-0 overflow-hidden bg-black">
          {backgroundVideos.map((vid: any, i: number) => {
            const isActive = i === currentVideoIndex;
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
                style={{ objectPosition: vid.position || 'center' }}
              />
            );
          })}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0c]/80 via-[#0a0a0c]/40 to-[#0a0a0c]"></div>
        </div>

        <div className="container mx-auto px-6 relative z-10 text-center">
          <h2 className="font-mono text-xs sm:text-sm tracking-[0.3em] uppercase mb-4 animate-pulse drop-shadow-md" style={{ color: homeSettings?.primaryColor || '#c084fc' }}>
            {homeSettings?.topSubtitle || 'Invasão do Caos'}
          </h2>
          <div className="relative inline-block mb-6">
            <h1 
              className={`text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter whitespace-nowrap ${homeSettings?.titleEffect === 'glitch' ? 'glitch-text' : homeSettings?.titleEffect === 'pulse' ? 'animate-pulse' : ''}`} 
              data-text={homeSettings?.title || 'LIGHT DARK'}
              style={{
                color: homeSettings?.primaryColor || '#9333ea',
                filter: `drop-shadow(0 0 ${homeSettings?.titleShadowIntensity ?? 15}px ${homeSettings?.titleShadowColor || homeSettings?.primaryColor || '#9333ea'})`
              }}
            >
              {homeSettings?.title || 'LIGHT DARK'}
            </h1>
            <span 
              className={`absolute top-1/2 -translate-y-1/2 left-[102%] text-3xl sm:text-5xl md:text-7xl font-mono tracking-normal pointer-events-none ${homeSettings?.sideTextEffect === 'flicker' ? 'animate-flicker-rare' : homeSettings?.sideTextEffect === 'pulse' ? 'animate-pulse' : homeSettings?.sideTextEffect === 'glitch' ? 'glitch-text' : ''}`} 
              data-text={homeSettings?.sideText || '1/5'}
              style={{ 
                color: homeSettings?.sideTextColor || '#a855f7',
                filter: `drop-shadow(0 0 ${homeSettings?.sideTextShadowIntensity ?? 10}px ${homeSettings?.sideTextShadowColor || homeSettings?.sideTextColor || '#a855f7'})`
              }}
            >
              {homeSettings?.sideText || '1/5'}
            </span>
          </div>
          <p className="text-lg text-slate-200 mb-10 max-w-2xl mx-auto drop-shadow-lg font-medium">
            {homeSettings?.synopsis || 'O Caos começou a invadir, Escolhidos, Arautos, precisamos de vocês! Monte seu deck, escolha seu Herói e domine os duelos neste TCG frenético.'}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => setIsManualOpen(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-purple-900/50"
            >
              Ler Manual Completo <BookOpen size={18} />
            </button>
            <button 
              onClick={() => setIsCatalogOpen(true)}
              className="px-8 py-4 rounded font-bold border border-slate-400/50 bg-black/30 hover:bg-slate-800 transition text-slate-200 flex items-center gap-2 justify-center backdrop-blur-sm"
            >
              <Search size={18} /> Catálogo
            </button>
            <button 
              onClick={() => setIsLoreOpen(true)}
              className="px-8 py-4 rounded font-bold border border-slate-400/50 bg-black/30 hover:bg-slate-800 transition text-slate-200 flex items-center gap-2 justify-center backdrop-blur-sm"
            >
              <BookOpen size={18} /> Lore
            </button>
          </div>
        </div>
      </header>

      <GameLore />



      {/* Showcase Section */}
      <section id="cartas" className="py-20 border-y border-slate-900 bg-[#0f0f13]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold mb-4">Tipos de Cartas</h3>
            <p className="text-slate-400 max-w-xl mx-auto">
              Domine as quatro categorias essenciais.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 px-4 md:px-0">
            <AnimatePresence mode="wait">
              {showcaseCards.map((card, idx) => (
                <motion.div 
                  key={`${card.code}-${idx}`} 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.5 }}
                  className="cursor-pointer max-w-[140px] md:max-w-none mx-auto"
                  onClick={() => setSelectedType(card.type)}
                  title="Clique para saber mais"
                >
                  <Card {...card} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Archetypes Grid */}
      <section id="arquetipos" className="py-20 bg-slate-950">
        <div className="container mx-auto px-6">
          <h3 className="text-3xl font-bold mb-12 text-center text-white">Arquétipos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {archetypes.map((arch, idx) => (
              <ArchetypeCard key={idx} {...arch} />
            ))}
          </div>
        </div>
      </section>

      {/* Field Structure Section - Updated to GameField */}
      <section id="estrutura" className="py-24 relative overflow-hidden bg-slate-900/20">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-white mb-4">Estrutura do Campo</h2>
              <p className="text-slate-400">Interaja com as zonas abaixo para entender as regras.</p>
            </div>

            <div className="transform scale-[0.6] origin-top w-[166%] -ml-[33%] md:w-full md:scale-100 md:ml-0 md:origin-center -mb-48 md:mb-0">
              <GameField />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-slate-900">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h4 className="font-bold text-white mb-2">LIGHT DARK TCG</h4>
            <p className="text-slate-500 text-sm mb-4">
              &copy; 2024. Todos os direitos reservados.<br/>
              Os personagens, nomes, e jogo são marcas registradas.
            </p>
            <button 
              onClick={() => setAdminMode('home')} 
              className="text-slate-700 hover:text-slate-500 transition"
              title="Admin da Tela Inicial"
            >
              <Settings size={14} />
            </button>
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
            <a href="https://open.spotify.com/intl-pt/artist/07k0ysslV4dERl0GGaFaji?si=j7I8AFYUTBGct3rb28od3g" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-green-400 transition">
              <Music size={24} />
              <span className="sr-only">Spotify</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}