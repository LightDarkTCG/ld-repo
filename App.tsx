import React, { useState, useEffect } from 'react';
import { 
  Zap, Heart, Layers, Hexagon, BookOpen,
  ShoppingCart, MapPin, ExternalLink, Search, Filter, Box,
  Menu, X, ChevronRight, ChevronDown, ChevronUp, Scale, Ghost, Instagram, MessageCircle, Mail, Music
} from 'lucide-react';
import { Card } from './components/Card';
import { GameField } from './components/GameField';
import { DeckBuilderModal } from './components/DeckBuilderModal';
import { allCards, archetypesList, collectionsList } from './data';
import { CardData, ArchetypeData } from './types';

// --- SUB-COMPONENTS ---

const ArchetypeCard: React.FC<ArchetypeData> = ({ name, icon: Icon, imageUrl, color, description }) => (
  <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg hover:border-slate-600 transition group relative overflow-hidden h-full flex flex-col">
    <div className={`absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition ${color || ''}`}>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="w-12 h-12 object-contain grayscale" />
      ) : Icon ? (
        <Icon size={48} />
      ) : null}
    </div>
    <div className="flex items-center gap-3 mb-3">
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-8 h-8 object-contain drop-shadow-lg" />
      ) : Icon ? (
        <Icon size={24} className={color} />
      ) : null}
      <h4 className="text-slate-200 font-bold text-lg tracking-wide">{name}</h4>
    </div>
    <p className="text-slate-400 text-xs leading-relaxed z-10 border-t border-slate-800 pt-2 mt-auto">
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
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">A Origem do Macroverso</h2>
            <div className="h-1 w-24 bg-gradient-to-r from-purple-600 to-blue-600 mx-auto rounded-full"></div>
          </div>
          <div className={`relative transition-all duration-700 ease-in-out ${isExpanded ? 'max-h-[2000px]' : 'max-h-40 overflow-hidden'}`}>
             <div className="prose prose-invert prose-lg mx-auto text-slate-400 leading-relaxed text-justify">
                <p className="mb-6 first-letter:text-5xl first-letter:font-bold first-letter:text-white first-letter:mr-1 first-letter:float-left">
                   Light Dark TCG é um jogo de cartas / tabuleiro épico que mergulha os jogadores na origem do Macroverso. Antes de existir qualquer universo, havia apenas o Nada, um vazio preto e silencioso. Foi desse vazio que surgiu o Mestre, entidade que, ao criar o Conceito da Existência, abriu caminho para o nascimento do Tempo, do Fogo, da Água, do Desejo e de inúmeras forças cósmicas. Cada conceito molda realidades inteiras e disputa influência sobre os universos.
                </p>
                <p className="mb-6">
                  No Macroverso Zero, Salazar, a Paz, reinava, mas sua bondade era passiva, uma calmaria que permitia que as sombras se aprofundassem. Na sua luz branda, o Conceito Desejo e o Nada, o fim de todas as coisas, encontraram terreno fértil para crescer.
                </p>
                <p className="mb-6">
                  A queda foi inevitável, a barreira entre os mundos, foi rasgada, e a guerra cósmica entre a Criação (Selena), o Tempo (Arqcuia) e as forças da escuridão começou, deixando um universo quebrado como herança.
                </p>
                <p className="mb-6">
                  É neste mundo fraturado que uma nova geração de heróis e monstros se ergue, todos marcados pelo legado de seus pais e deuses. Eles são a Legião dos Quebrados: princesas exiladas como Hyummeng; amantes amaldiçoados como Kevin e Blair, a Eterna; guerreiros forjados na dor como Criven e Donnie; e almas torturadas buscando um propósito, como Floquinho, Três e Jenos.
                </p>
                <p className="mb-6">
                  Agora, eles lutam não apenas contra os Errantes colossais ou os exércitos de Asmonious, mas também contra a desilusão. Pois neste novo mundo, as linhas se borraram: heróis são traídos por seus aliados mais confiáveis, vilões como Von Linden se tornam amigos, e a própria loucura, abraçada por acadêmicos como Patrick, pode ser a única forma de enxergar a verdade.
                </p>
                <p className="mb-6 border-l-4 border-purple-500 pl-4 italic bg-slate-900/50 p-4 rounded-r">
                   No jogo, os jogadores assumem o papel de heróis, dragões, Conceitos ou variantes de personagens lendários, disputando poder, formando alianças e enfrentando escolhas que podem preservar ou destruir toda a criação. O jogo combina estratégia, cartas, narrativa dinâmica e múltiplos caminhos, permitindo que cada partida seja única. Seu objetivo? Decidir o destino da realidade: manter o equilíbrio entre o bem e o mau ou liberar o caos definitivo.
                </p>
                <p>
                  "Light e Dark" é uma saga sobre os filhos pagando pelos pecados de seus pais. É uma história sobre como o amor, a lealdade e o sacrifício sobrevivem em um universo onde a paz se revelou uma mentira e a traição é uma constante. Presos entre a luz de um futuro que desejam e a escuridão de um passado que os assombra, eles precisam fazer uma escolha: tentarão consertar o mundo que herdaram, ou o queimarão até as cinzas para construir algo novo?
                </p>
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

const ManualModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-slate-700 shadow-2xl relative animate-in fade-in zoom-in duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={24} />
        </button>
        <div className="p-8">
          <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-2">
            <BookOpen className="text-purple-500" /> Manual de Regras
          </h2>
          <div className="space-y-6">
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <h3 className="text-xl font-bold text-purple-400 mb-3">Conceitos Básicos</h3>
              <ul className="list-disc pl-5 space-y-2 text-slate-300 text-sm">
                <li><strong className="text-white">Vida:</strong> 20 Pontos.</li>
                <li><strong className="text-white">Mana:</strong> 12 Pontos (fixo por rodada).</li>
                <li><strong className="text-white">Objetivo:</strong> Reduzir a vida do oponente a 0.</li>
              </ul>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <h3 className="text-xl font-bold text-blue-400 mb-3">Zonas & Áreas</h3>
              <div className="grid grid-cols-2 gap-4 text-sm text-slate-300">
                <div>
                  <strong className="text-white block">Zonas Permanentes:</strong>
                  Deck Principal, Deck de Herói.
                </div>
                <div>
                  <strong className="text-white block">Cemitérios:</strong>
                  Zona Morta (descarte padrão), Zona Apagada (removido do jogo).
                </div>
                <div>
                  <strong className="text-white block">Áreas de Campo:</strong>
                  Área de Combatentes/Heróis (Frente), Área de Efeitos/Equipamentos (Retaguarda).
                </div>
              </div>
            </div>
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <h3 className="text-xl font-bold text-green-400 mb-3">Mecânicas Especiais</h3>
              <ul className="list-disc pl-5 space-y-2 text-slate-300 text-sm">
                <li><strong className="text-white">CT (Custo/Categoria):</strong> Define o nível de poder e custo da carta. Pode ser Reduzido ou Aumentado por efeitos.</li>
                <li><strong className="text-white">Runas:</strong> Recursos gerados em jogo para efeitos poderosos.</li>
              </ul>
            </div>
          </div>
          <button onClick={onClose} className="w-full mt-8 bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-lg font-bold transition">
            Entendi, Fechar Manual
          </button>
        </div>
      </div>
    </div>
  );
};

const CardDetailModal = ({ card, onClose }: { card: CardData | null, onClose: () => void }) => {
  if (!card) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in duration-200">
      <button 
        onClick={onClose} 
        className="absolute top-4 right-4 z-50 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition"
      >
        <X size={24} />
      </button>

      <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-8 p-4 lg:p-8">
        <div className="flex items-center justify-center">
             <div className="scale-110 origin-center">
                 <Card {...card} />
             </div>
        </div>
        <div className="flex flex-col gap-6 text-slate-200">
          <div className="border-b border-slate-800 pb-4">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-4xl font-black text-white tracking-tight">{card.name}</h2>
              <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-yellow-600 bg-yellow-900/20 font-mono font-bold text-yellow-400 text-2xl shadow-lg" title="CT">
                {card.ct}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-sm font-medium">
              <span className="px-3 py-1 bg-slate-800 rounded text-slate-300 border border-slate-700">{card.type}</span>
              <span className="px-3 py-1 bg-purple-900/30 rounded text-purple-300 border border-purple-800/50">{card.archetype}</span>
              <span className="px-3 py-1 bg-blue-900/30 rounded text-blue-300 border border-blue-800/50 flex items-center gap-1">
                 <Box size={14} /> {card.collection || "Coleção Base"}
              </span>
            </div>
          </div>

          <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700/50">
            <h4 className="text-sm font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
              <Zap size={16} /> Efeito da Carta
            </h4>
            <p className="text-lg leading-relaxed text-slate-200 whitespace-pre-wrap">
              {card.description}
            </p>
          </div>

          <div className="bg-black/40 p-6 rounded-xl border-l-4 border-purple-600 italic">
            <h4 className="text-sm font-bold text-purple-400 uppercase mb-3 flex items-center gap-2">
              <BookOpen size={16} /> Lore
            </h4>
            <p className="text-slate-400 font-serif leading-relaxed">
              "{card.lore || "Dados fragmentados... a história desta entidade perdeu-se no rasgo do Macroverso."}"
            </p>
          </div>

          <div className="text-xs text-slate-600 font-mono mt-auto pt-4 border-t border-slate-800">
            ID Código: {card.code}
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
                <div className="bg-slate-800/50 p-4 rounded border border-slate-700 flex gap-4 items-start hover:bg-slate-800 transition">
                  <div className="bg-slate-900 p-2 rounded-full text-purple-400 mt-1">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">Awaken Giants</h4>
                    <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                      Av. África, 510 - Tibery<br/>
                      Uberlândia - MG, 38405-096
                    </p>
                  </div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded border border-slate-700 flex gap-4 items-start hover:bg-slate-800 transition">
                  <div className="bg-slate-900 p-2 rounded-full text-blue-400 mt-1">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg">Zebu Geek Store</h4>
                    <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                      R. Rodolfo Lírio, 458 - Nossa Sra. da Abadia<br/>
                      Uberaba - MG, 38025-500
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-800 pb-2">Compre Online</h3>
              <a 
                href="https://mypcards.com/LightDarkCardGame" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 p-4 rounded-lg transition group shadow-lg shadow-purple-900/20"
              >
                <div className="flex flex-col">
                   <span className="font-bold text-white text-lg">MypCards</span>
                   <span className="text-purple-200 text-xs">Loja Oficial Online</span>
                </div>
                <ExternalLink size={20} className="text-white/80 group-hover:text-white group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CatalogModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [filters, setFilters] = useState({
    type: "Todos",
    archetype: "Todos",
    collection: "Todos",
    minCt: "",
    minAtk: "",
    minDef: ""
  });

  const filteredCards = allCards.filter(card => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      card.name.toLowerCase().includes(searchLower) || 
      card.code.toLowerCase().includes(searchLower) ||
      card.description.toLowerCase().includes(searchLower);

    const matchesType = filters.type === "Todos" || card.type === filters.type;
    const matchesArchetype = filters.archetype === "Todos" || card.archetype.includes(filters.archetype);
    const matchesCollection = filters.collection === "Todos" || (card.collection && card.collection === filters.collection);
    const matchesCt = filters.minCt === "" || card.ct === parseInt(filters.minCt);
    const matchesAtk = filters.minAtk === "" || (card.attack !== undefined && card.attack >= parseInt(filters.minAtk));
    const matchesDef = filters.minDef === "" || (card.defense !== undefined && card.defense >= parseInt(filters.minDef));

    return matchesSearch && matchesType && matchesArchetype && matchesCollection && matchesCt && matchesAtk && matchesDef;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950 animate-in fade-in duration-200">
      <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />

      <div className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shadow-lg z-20">
        <div className="flex items-center gap-3">
          <BookOpen className="text-purple-500" />
          <h2 className="text-xl font-bold text-white">Catálogo de Cartas <span className="text-slate-500 text-sm ml-2">({filteredCards.length} encontradas)</span></h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition">
          <X size={24} />
        </button>
      </div>

      <div className="bg-slate-900/50 border-b border-slate-800 p-4 flex flex-col xl:flex-row gap-4 z-10">
        <div className="relative w-full xl:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Nome, Código ou Palavra Chave..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-white focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center flex-1">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
            <span className="text-xs text-slate-500 uppercase font-bold"><Box size={14}/></span>
            <select 
              className="bg-purple-950 text-sm text-white outline-none cursor-pointer rounded px-2 w-40"
              value={filters.collection}
              onChange={(e) => setFilters({...filters, collection: e.target.value})}
            >
              <option className="bg-purple-950" value="Todos">Todas as Coleções</option>
              {collectionsList.map(c => <option className="bg-purple-950" key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
            <Filter size={14} className="text-slate-500" />
            <select 
              className="bg-purple-950 text-sm text-white outline-none cursor-pointer rounded px-2"
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

          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
            <span className="text-xs text-slate-500 uppercase font-bold">Arquétipo</span>
            <select 
              className="bg-purple-950 text-sm text-white outline-none cursor-pointer w-32 rounded px-2"
              value={filters.archetype}
              onChange={(e) => setFilters({...filters, archetype: e.target.value})}
            >
              <option className="bg-purple-950" value="Todos">Todos</option>
              {archetypesList.map(a => <option className="bg-purple-950" key={a.name} value={a.name}>{a.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
             <input 
               type="number" 
               placeholder="CT" 
               className="w-16 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white focus:border-purple-500 outline-none"
               value={filters.minCt}
               onChange={(e) => setFilters({...filters, minCt: e.target.value})}
             />
             <input 
               type="number" 
               placeholder="ATK" 
               className="w-16 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white focus:border-red-500 outline-none"
               value={filters.minAtk}
               onChange={(e) => setFilters({...filters, minAtk: e.target.value})}
             />
             <input 
               type="number" 
               placeholder="DEF" 
               className="w-16 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-sm text-white focus:border-blue-500 outline-none"
               value={filters.minDef}
               onChange={(e) => setFilters({...filters, minDef: e.target.value})}
             />
          </div>
          
          <button 
            onClick={() => {
              setFilters({ type: "Todos", archetype: "Todos", collection: "Todos", minCt: "", minAtk: "", minDef: "" });
              setSearchTerm("");
            }}
            className="text-xs text-slate-400 hover:text-white underline ml-auto"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-[#0a0a0c]">
        {filteredCards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8 justify-items-center">
            {filteredCards.map((card, idx) => (
              <div key={idx} className="scale-90 origin-top" onClick={() => setSelectedCard(card)}>
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isDeckBuilderOpen, setIsDeckBuilderOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [showcaseCards, setShowcaseCards] = useState<CardData[]>([]);

  const backgroundVideos = [
    "https://i.imgur.com/MEEgqLT.mp4",
    "https://i.imgur.com/NiXDYQ6.mp4",
    "https://i.imgur.com/uyLhRyw.mp4",
    "https://i.imgur.com/IxbaBFg.mp4",
    "https://i.imgur.com/sRRvrf0.mp4",
    "https://i.imgur.com/3haDaoN.mp4",
    "https://i.imgur.com/N1xEGwR.mp4",
    "https://i.imgur.com/zyPclYX.mp4",
    "https://i.imgur.com/B44C6fM.mp4",
    "https://i.imgur.com/9EOlPvn.mp4",
    "https://i.imgur.com/GGYybtc.mp4",
    "https://i.imgur.com/bemqfcI.mp4",
    "https://i.imgur.com/cClnOWH.mp4",
    "https://i.imgur.com/wTrMCso.mp4",
    "https://i.imgur.com/gTf8uZY.mp4",
    "https://i.imgur.com/YAgBkS9.mp4",
    "https://i.imgur.com/veA5rlN.mp4",
    "https://i.imgur.com/sh4o4pA.mp4"
  ];

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
    const interval = setInterval(rotateShowcase, 5000); // Rotate every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 font-sans selection:bg-purple-500 selection:text-white overflow-x-hidden">
      
      <ManualModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />
      <BuyModal isOpen={isBuyModalOpen} onClose={() => setIsBuyModalOpen(false)} />
      <CatalogModal isOpen={isCatalogOpen} onClose={() => setIsCatalogOpen(false)} />
      <DeckBuilderModal isOpen={isDeckBuilderOpen} onClose={() => setIsDeckBuilderOpen(false)} />

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
        <div className="absolute top-0 left-0 w-full h-full z-0 overflow-hidden">
          <video 
            key={currentVideoIndex} 
            src={backgroundVideos[currentVideoIndex]}
            autoPlay
            muted
            playsInline
            onEnded={() => setCurrentVideoIndex((prev) => (prev + 1) % backgroundVideos.length)} 
            className="absolute top-0 left-0 w-full h-full object-cover opacity-50 transition-opacity duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0c]/80 via-[#0a0a0c]/40 to-[#0a0a0c]"></div>
        </div>

        <div className="container mx-auto px-6 relative z-10 text-center">
          <h2 className="text-purple-400 font-mono text-sm tracking-[0.3em] uppercase mb-4 animate-pulse drop-shadow-md">Invasão do Caos</h2>
          <h1 className="text-6xl md:text-8xl font-black text-white mb-6 tracking-tighter drop-shadow-2xl">
            LIGHT <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-blue-500 drop-shadow-none">DARK</span>
          </h1>
          <p className="text-lg text-slate-200 mb-10 max-w-2xl mx-auto drop-shadow-lg font-medium">
            A batalha final entre Ordem e Caos. Monte seu deck, escolha seu Herói e domine a Zona de Combate neste TCG de Ação e Reação.
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
          </div>
        </div>
      </header>

      <GameLore />

      {/* Showcase Section */}
      <section id="cartas" className="py-20 border-y border-slate-900 bg-[#0f0f13]">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold mb-4">O Arsenal</h3>
            <p className="text-slate-400 max-w-xl mx-auto">
              Domine as quatro categorias essenciais.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 justify-items-center">
            {showcaseCards.map((card, idx) => (
              <div key={`${card.code}-${idx}`} className="animate-in fade-in zoom-in duration-500">
                <Card {...card} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Archetypes Grid */}
      <section id="arquetipos" className="py-20 bg-slate-950">
        <div className="container mx-auto px-6">
          <h3 className="text-3xl font-bold mb-12 text-center text-white">Arquétipos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {archetypesList.map((arch, idx) => (
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

            <GameField />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-slate-900">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h4 className="font-bold text-white mb-2">LIGHT DARK TCG</h4>
            <p className="text-slate-500 text-sm">
              &copy; 2024. Todos os direitos reservados.<br/>
              Conceito Insano, Darkus e Macroversal são marcas registradas.
            </p>
          </div>

          <div className="flex gap-6">
            <a href="https://www.instagram.com/lightdarktcg/" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-purple-500 transition">
              <Instagram size={24} />
              <span className="sr-only">Instagram</span>
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