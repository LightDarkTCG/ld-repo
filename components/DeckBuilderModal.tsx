import React, { useState, useMemo } from 'react';
import { X, Search, Save, Download, Trash2, Plus, Minus, AlertTriangle, CheckCircle, BarChart3, Copy, Eye, ChevronDown, ChevronUp, ChevronRight, ChevronLeft, Layers } from 'lucide-react';
import { CardData } from '../types';
import { collectionsList, archetypesList } from '../data';
import { useCards } from '../CardContext';
import { Card } from './Card';
import { CardDetailModal } from './CardDetailModal';

interface DeckBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeckBuilderModal: React.FC<DeckBuilderModalProps> = ({ isOpen, onClose }) => {
  const { cards: allCards } = useCards();
  const [deck, setDeck] = useState<CardData[]>([]);
  const [sideDeck, setSideDeck] = useState<CardData[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [importCode, setImportCode] = useState("");
  const [activeTab, setActiveTab] = useState<'build' | 'stats' | 'save'>('build');
  const [inspectCard, setInspectCard] = useState<CardData | null>(null);
  const [filters, setFilters] = useState({
    type: "Todos",
    archetype: "Todos",
    collection: "Todos",
    frame: "Todos",
    ct: "Todos",
    minAtk: "",
    minDef: "",
    effectWord: ""
  });

  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);
  const [isDeckCollapsed, setIsDeckCollapsed] = useState(false);

  // Helper to determine Hero Identity
  const getIdentity = (name: string) => {
    const n = name.toLowerCase();
    // Regras Específicas
    if (n.includes("mahina")) return "Mahina";
    if (n.includes("otto") || n.includes("asmonious")) return "Asmonious";
    if (n.includes("vellret")) return "Vellret";
    
    // Padrão: Primeira palavra
    return name.split(/[\s-]/)[0];
  };

  // --- Logic ---

  const isHeroGroupValid = (heroes: CardData[]): boolean => {
    if (heroes.length <= 1) return true;

    const identities = new Set(heroes.map(h => getIdentity(h.name)));
    if (identities.size === 1) return true;

    const names = heroes.map(h => h.name);
    const hasVonEvolucao = names.includes("Von Linden - O Conceito Evolução");
    const hasSelenaMacroverso = names.includes("Selena - Macroverso Inverso");
    const hasConceitoCaos = names.includes("Conceito Caos");
    const hasSalazarCaos = names.includes("Salazar - Sucumbido pelo Caos");

    if (hasVonEvolucao && hasSelenaMacroverso) {
      // You can have this combo, but no other Selena.
      // So every hero must be either identity "Von" or exactly "Selena - Macroverso Inverso"
      // Wait, could it be the other way? What if the deck is mainly "Conceito Evolução", could it just be these two?
      // Yes, if we just check that every hero is valid under this rule:
      const vonIdentity = getIdentity("Von Linden - O Conceito Evolução");
      const valid = heroes.every(h => getIdentity(h.name) === vonIdentity || h.name === "Selena - Macroverso Inverso");
      if (valid) return true;
    }

    if (hasConceitoCaos && hasSalazarCaos) {
      // You can have this combo, but no other Salazar.
      const conceitoIdentity = getIdentity("Conceito Caos");
      const valid = heroes.every(h => getIdentity(h.name) === conceitoIdentity || h.name === "Salazar - Sucumbido pelo Caos");
      if (valid) return true;
    }

    return false;
  };

  const addToDeck = (card: CardData, isSide: boolean = false) => {
    // 1 Copy Limit Rule (by name)
    if (deck.some(c => c.name === card.name) || sideDeck.some(c => c.name === card.name)) {
      alert(`Você já possui uma carta chamada "${card.name}" no deck. Apenas 1 cópia com o mesmo nome é permitida (Deck + Side Deck).`);
      return;
    }

    // Hero Restriction Logic
    if (card.type === 'Herói' && !isSide) {
      const existingHeroes = deck.filter(c => c.type === 'Herói');
      const testHeroes = [...existingHeroes, card];
      
      if (!isHeroGroupValid(testHeroes)) {
        alert(`O herói "${card.name}" não pôde ser adicionado. Verifique as restrições de identidade para Heróis no deck principal.`);
        return;
      }
    }

    if (isSide) {
      setSideDeck([...sideDeck, card]);
    } else {
      setDeck([...deck, card]);
    }
  };

  const removeFromDeck = (indexToRemove: number, isSide: boolean = false) => {
    if (isSide) {
      setSideDeck(sideDeck.filter((_, index) => index !== indexToRemove));
    } else {
      setDeck(deck.filter((_, index) => index !== indexToRemove));
    }
  };

  const clearDeck = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setDeck([]);
    setSideDeck([]);
    setConfirmClear(false);
  };

  // --- Import / Export ---

  const isValidToSave = useMemo(() => {
    const hasValidSize = deck.length >= 30 && deck.length <= 35 && sideDeck.length <= 5;
    const mainHeroes = deck.filter(c => c.type === 'Herói');
    
    const hasSingleHeroIdentity = isHeroGroupValid(mainHeroes);

    const allCards = [...deck, ...sideDeck];
    const uniqueNames = new Set(allCards.map(c => c.name));
    const hasNoDuplicates = uniqueNames.size === allCards.length;

    return hasValidSize && hasSingleHeroIdentity && hasNoDuplicates;
  }, [deck, sideDeck]);

  const generateDeckCode = () => {
    if (!isValidToSave) return "";
    const mainCodes = deck.map(c => c.code);
    const sideCodes = sideDeck.map(c => c.code);
    return btoa(JSON.stringify({ main: mainCodes, side: sideCodes }));
  };

  const loadDeckFromCode = () => {
    try {
      const decoded = atob(importCode);
      const parsed = JSON.parse(decoded);
      
      let mainCodes: string[] = [];
      let sideCodes: string[] = [];

      if (Array.isArray(parsed)) {
        mainCodes = parsed;
      } else if (parsed && parsed.main) {
        mainCodes = parsed.main;
        sideCodes = parsed.side || [];
      } else {
        throw new Error("Invalid format");
      }
      
      const newMainDeck: CardData[] = [];
      const newSideDeck: CardData[] = [];
      let missingCount = 0;

      mainCodes.forEach(code => {
        const found = allCards.find(c => c.code === code);
        if (found) newMainDeck.push(found);
        else missingCount++;
      });

      sideCodes.forEach(code => {
        const found = allCards.find(c => c.code === code);
        if (found) newSideDeck.push(found);
        else missingCount++;
      });

      setDeck(newMainDeck);
      setSideDeck(newSideDeck);
      setImportCode("");
      alert(`Deck carregado! ${newMainDeck.length} cartas no principal, ${newSideDeck.length} no side deck.${missingCount > 0 ? ` ${missingCount} cartas não identificadas.` : ''}`);
    } catch (e) {
      alert("Código de deck inválido.");
    }
  };

  // --- Stats ---

  const stats = useMemo(() => {
    const counts = {
      Heroi: 0,
      Combatente: 0,
      Equipamento: 0,
      Efeito: 0,
      Total: deck.length
    };
    
    // Initialize buckets 0 to 12 (12 will be 12+)
    const ctDistribution: Record<number, number> = {};
    for (let i = 0; i <= 12; i++) {
      ctDistribution[i] = 0;
    }

    deck.forEach(card => {
      // Count Types
      if (card.type === 'Herói') counts.Heroi++;
      else if (card.type === 'Combatente') counts.Combatente++;
      else if (card.type === 'Equipamento') counts.Equipamento++;
      else if (card.type === 'Efeito') counts.Efeito++;

      // Count CT
      let ct = card.ct || 0;
      if (ct > 12) ct = 12; // Group 12+
      ctDistribution[ct] = (ctDistribution[ct] || 0) + 1;
    });

    return { counts, ctDistribution };
  }, [deck]);

  const isValidDeckSize = deck.length >= 30 && deck.length <= 35 && sideDeck.length <= 5;

  // --- Filtered Pool ---

  const filteredPool = allCards.filter(card => {
    const matchesSearch = card.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          card.code.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filters.type === "Todos" || card.type === filters.type;
    const matchesArch = filters.archetype === "Todos" || card.archetype.includes(filters.archetype);
    const matchesColl = filters.collection === "Todos" || card.collection === filters.collection;
    const matchesFrame = filters.frame === "Todos" || (card.frame || "Legado") === filters.frame;
    const matchesCt = filters.ct === "Todos" || card.ct === parseInt(filters.ct);
    
    // Changed to exact match (===) instead of >=
    const matchesAtk = filters.minAtk === "" || (card.attack !== undefined && card.attack === parseInt(filters.minAtk));
    const matchesDef = filters.minDef === "" || (card.defense !== undefined && card.defense === parseInt(filters.minDef));
    const matchesEffectWord = filters.effectWord === "" || card.description.toLowerCase().includes(filters.effectWord.toLowerCase());
    
    return matchesSearch && matchesType && matchesArch && matchesColl && matchesFrame && matchesCt && matchesAtk && matchesDef && matchesEffectWord;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0c] animate-in fade-in zoom-in duration-200">
      
      {/* Inspect Modal */}
      <CardDetailModal 
        card={inspectCard} 
        onClose={() => setInspectCard(null)} 
        onSelectRelated={(related) => setInspectCard(related)}
      />

      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-2 md:p-4 flex flex-col md:flex-row justify-between items-center shadow-lg gap-2 md:gap-0 shrink-0">
        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 w-full md:w-auto">
          <h2 className="text-lg md:text-2xl font-bold text-white flex items-center gap-2 whitespace-nowrap">
            <Save className="text-purple-500" size={20} /> MONTE SEU DECK
          </h2>
          <div className="flex bg-slate-800 rounded-lg p-1 w-full md:w-auto overflow-x-auto">
            <button 
              onClick={() => setActiveTab('build')}
              className={`flex-1 md:flex-none px-2 md:px-4 py-1.5 rounded-md text-[10px] md:text-sm font-bold transition whitespace-nowrap ${activeTab === 'build' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Montar
            </button>
            <button 
              onClick={() => setActiveTab('stats')}
              className={`flex-1 md:flex-none px-2 md:px-4 py-1.5 rounded-md text-[10px] md:text-sm font-bold transition whitespace-nowrap ${activeTab === 'stats' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Estatísticas
            </button>
            <button 
              onClick={() => setActiveTab('save')}
              className={`flex-1 md:flex-none px-2 md:px-4 py-1.5 rounded-md text-[10px] md:text-sm font-bold transition whitespace-nowrap ${activeTab === 'save' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Salvar/Carregar
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className={`px-2 md:px-3 py-1 rounded border flex items-center gap-2 ${isValidDeckSize ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-red-900/30 border-red-500 text-red-400'}`}>
            <span className="font-mono font-bold text-sm md:text-lg">{deck.length}</span>
            <span className="text-[10px] md:text-xs uppercase">/ 30-35 Cartas</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Floating Expand Button (Mobile Only) */}
        {activeTab === 'build' && isDeckCollapsed && (
          <button 
            onClick={() => setIsDeckCollapsed(false)}
            className="md:hidden absolute bottom-6 right-6 z-50 bg-purple-600 hover:bg-purple-500 text-white p-4 rounded-full shadow-xl shadow-purple-900/50 animate-in fade-in zoom-in border border-white/10"
            title="Ver Deck"
          >
            <div className="flex flex-col items-center gap-1">
               <ChevronUp size={24} />
               <span className="text-[10px] font-bold">{deck.length}</span>
            </div>
          </button>
        )}

        {/* LEFT SIDE: Card Pool (Only visible in Build tab) */}
        {activeTab === 'build' && (
          <div className={`flex flex-col border-r border-slate-800 bg-[#0f0f13] transition-all duration-300 min-h-0 ${isDeckCollapsed ? 'w-full flex-1' : 'w-full md:w-1/2 h-1/2 md:h-full'}`}>
            {/* Filters */}
            <div className="border-b border-slate-800 bg-slate-900/30">
              <div 
                className="p-2 md:p-4 flex justify-between items-center cursor-pointer md:cursor-default"
                onClick={() => setIsFiltersCollapsed(!isFiltersCollapsed)}
              >
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Search size={14} /> Filtros
                </div>
                <button className="md:hidden text-slate-400">
                  {isFiltersCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              </div>
              
              {!isFiltersCollapsed && (
                <div className="p-2 md:p-4 pt-0 space-y-2 md:space-y-3 animate-in slide-in-from-top-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                      type="text" 
                      placeholder="Nome ou Código..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-white text-sm focus:border-purple-500 outline-none"
                    />
                  </div>
                  
                    <div className="flex flex-wrap gap-2">
                      <select 
                        className="bg-slate-900 text-xs text-white border border-slate-700 rounded px-2 py-1 outline-none flex-1 min-w-[80px]"
                        value={filters.frame} onChange={(e) => setFilters({...filters, frame: e.target.value})}
                      >
                        <option value="Todos">Frame: Todos</option>
                        <option value="Legado">Legado</option>
                        <option value="Moderno">Moderno</option>
                      </select>

                      <select 
                        className="bg-slate-900 text-xs text-white border border-slate-700 rounded px-2 py-1 outline-none flex-1 min-w-[80px]"
                        value={filters.type} onChange={(e) => setFilters({...filters, type: e.target.value})}
                      >
                      <option value="Todos">Tipo: Todos</option>
                      <option value="Herói">Herói</option>
                      <option value="Combatente">Combatente</option>
                      <option value="Equipamento">Equipamento</option>
                      <option value="Efeito">Efeito</option>
                    </select>

                    <select 
                      className="bg-slate-900 text-xs text-white border border-slate-700 rounded px-2 py-1 outline-none flex-1 min-w-[100px]"
                      value={filters.archetype} onChange={(e) => setFilters({...filters, archetype: e.target.value})}
                    >
                      <option value="Todos">Arq: Todos</option>
                      {Array.from(new Set(allCards.map(c => c.archetype).filter(Boolean).flatMap(a => a?.split(' / ') || []))).sort().map(a => <option key={a} value={a}>{a}</option>)}
                    </select>

                    <select 
                      className="bg-slate-900 text-xs text-white border border-slate-700 rounded px-2 py-1 outline-none w-16"
                      value={filters.ct} onChange={(e) => setFilters({...filters, ct: e.target.value})}
                    >
                      <option value="Todos">CT</option>
                      {[...Array(21)].map((_, i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>

                  <div className="flex gap-2">
                     <select 
                      className="bg-slate-900 text-xs text-white border border-slate-700 rounded px-2 py-1 outline-none flex-1"
                      value={filters.collection} onChange={(e) => setFilters({...filters, collection: e.target.value})}
                    >
                      <option value="Todos">Coleção: Todas</option>
                      {Array.from(new Set(allCards.map(c => c.collection).filter(Boolean))).sort().map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <input 
                      type="number" 
                      placeholder="ATK" 
                      className="w-14 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-red-500 outline-none"
                      value={filters.minAtk}
                      onChange={(e) => setFilters({...filters, minAtk: e.target.value})}
                    />
                    
                    <input 
                      type="number" 
                      placeholder="VIDA" 
                      className="w-14 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none"
                      value={filters.minDef}
                      onChange={(e) => setFilters({...filters, minDef: e.target.value})}
                    />
                  </div>

                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Palavra no Efeito (ex: Qualquer momento)" 
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-purple-500 outline-none"
                      value={filters.effectWord}
                      onChange={(e) => setFilters({...filters, effectWord: e.target.value})}
                    />
                  </div>

                  <button 
                    onClick={() => setFilters({ type: "Todos", archetype: "Todos", collection: "Todos", frame: "Todos", ct: "Todos", minAtk: "", minDef: "", effectWord: "" })}
                    className="w-full text-center text-xs text-slate-500 hover:text-white underline py-1"
                  >
                    Limpar Filtros
                  </button>
                </div>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 md:p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
                {filteredPool.map((card, idx) => {
                  const isInMain = deck.some(c => c.name === card.name);
                  const isInSide = sideDeck.some(c => c.name === card.name);
                  const isInDeck = isInMain || isInSide;
                  return (
                    <div 
                      key={idx} 
                      className={`cursor-pointer group relative ${isInDeck ? 'opacity-50' : ''}`}
                    >
                      <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition flex flex-col gap-1">
                         {/* Info Button */}
                         <button 
                           onClick={(e) => { e.stopPropagation(); setInspectCard(card); }}
                           className="bg-blue-600 text-white rounded-full p-1 shadow-lg hover:scale-110 transition"
                           title="Ver Detalhes"
                         >
                            <Eye size={12} />
                         </button>
                         {/* Add Button */}
                         {!isInDeck && (
                           <>
                             <button 
                               onClick={() => addToDeck(card, false)}
                               className="bg-green-600 text-white rounded-full p-1 shadow-lg hover:scale-110 transition"
                               title="Adicionar ao Deck Principal"
                             >
                                <Plus size={12} />
                             </button>
                             <button 
                               onClick={() => addToDeck(card, true)}
                               className="bg-teal-600 text-white rounded-full p-1 shadow-lg hover:scale-110 transition"
                               title="Adicionar ao Side Deck"
                             >
                                <Layers size={12} />
                             </button>
                           </>
                         )}
                      </div>
                      
                      <div 
                        onClick={() => !isInDeck && addToDeck(card, false)}
                        className={`pointer-events-none scale-[0.6] origin-top-left w-[170%] h-[170%] mb-[-70%] mr-[-70%] ${isInDeck ? 'grayscale' : ''}`}
                      >
                         <Card {...card} />
                      </div>
                      
                      {isInDeck && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <CheckCircle className="text-green-500 drop-shadow-lg" size={24} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* RIGHT SIDE: Current Deck (or Stats/Save view) */}
        <div className={`${activeTab === 'build' ? (isDeckCollapsed ? 'h-0 md:h-full md:w-12 overflow-hidden' : 'h-1/2 md:h-full md:w-1/2') : 'w-full h-full'} flex flex-col bg-[#0a0a0c] border-t md:border-t-0 md:border-l border-slate-800 transition-all duration-300 relative min-h-0`}>
          
          {activeTab === 'build' && (
            <>
              <div 
                className="p-2 md:p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 cursor-pointer md:cursor-default shrink-0"
                onClick={() => setIsDeckCollapsed(!isDeckCollapsed)}
              >
                <div className="flex items-center gap-2">
                   <button className="md:hidden text-slate-400">
                      {isDeckCollapsed ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                   </button>
                   <h3 className="font-bold text-white text-sm md:text-base whitespace-nowrap">Seu Deck ({deck.length + sideDeck.length})</h3>
                </div>
                
                {!isDeckCollapsed && (
                  <button onClick={(e) => { e.stopPropagation(); clearDeck(); }} className={`text-xs flex items-center gap-1 px-2 py-1 rounded transition ${confirmClear ? 'text-white bg-red-800 animate-pulse' : 'text-red-400 hover:text-red-300 hover:bg-red-900/20'}`}>
                    <Trash2 size={14} /> <span className="hidden md:inline">{confirmClear ? 'Certeza?' : 'Limpar'}</span>
                  </button>
                )}
              </div>

              {!isDeckCollapsed && (
                <div className="flex-1 overflow-y-auto p-2 md:p-4 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] min-h-0 flex flex-col gap-6">
                  {deck.length === 0 && sideDeck.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600">
                      <div className="bg-slate-900 p-4 rounded-full mb-4">
                        <Save size={32} />
                      </div>
                      <p className="text-sm text-center px-4">Selecione cartas à esquerda (ou acima) para adicionar.</p>
                    </div>
                  ) : (
                    <>
                      {/* Main Deck */}
                      <div>
                        <h4 className="text-white font-bold mb-3 border-b border-slate-700 pb-1 flex justify-between items-center">
                          <span>Deck Principal</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${deck.length >= 30 && deck.length <= 35 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>{deck.length} / 30-35</span>
                        </h4>
                        {deck.length === 0 ? (
                          <div className="text-slate-500 text-sm italic">Vazio</div>
                        ) : (
                          <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                            {deck.map((card, idx) => (
                              <div key={`main-${idx}`} className="cursor-pointer group relative hover:-translate-y-1 transition-transform">
                                <div className="absolute -top-2 -right-2 z-10 opacity-100 md:opacity-0 group-hover:opacity-100 transition flex gap-1">
                                  <button 
                                     onClick={(e) => { e.stopPropagation(); setInspectCard(card); }}
                                     className="bg-blue-600 text-white rounded-full p-1 shadow-lg hover:scale-110 transition"
                                     title="Ver Detalhes"
                                   >
                                      <Eye size={12} />
                                   </button>
                                  <button 
                                    onClick={() => removeFromDeck(idx, false)}
                                    className="bg-red-600 text-white rounded-full p-1 shadow-lg hover:scale-110 transition"
                                    title="Remover"
                                  >
                                    <Minus size={12} />
                                  </button>
                                </div>
                                {/* Mini Card Representation */}
                                <div 
                                  className={`rounded-lg border p-1 md:p-2 h-24 md:h-32 flex flex-col justify-between overflow-hidden relative ${
                                  card.type === 'Herói' ? 'bg-red-950/50 border-red-800' :
                                  card.type === 'Combatente' ? 'bg-blue-950/50 border-blue-800' :
                                  card.type === 'Equipamento' ? 'bg-green-950/50 border-green-800' :
                                  'bg-purple-950/50 border-purple-800'
                                }`}>
                                  {card.imageUrl && (
                                    <img src={card.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-30" alt="" />
                                  )}
                                  <div className="relative z-10">
                                    <div className="text-[8px] md:text-[10px] uppercase font-bold tracking-wider opacity-70 truncate">{card.type}</div>
                                    <div className="font-bold text-[10px] md:text-xs leading-tight line-clamp-2">{card.name}</div>
                                  </div>
                                  <div className="relative z-10 self-end bg-black/50 px-1 md:px-2 rounded text-[10px] md:text-xs font-mono text-yellow-400">
                                    CT {card.ct}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Side Deck */}
                      <div>
                        <h4 className="text-white font-bold mb-3 border-b border-slate-700 pb-1 flex justify-between items-center">
                          <span>Side Deck</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${sideDeck.length <= 5 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>{sideDeck.length} / 5</span>
                        </h4>
                        {sideDeck.length === 0 ? (
                          <div className="text-slate-500 text-sm italic">Vazio</div>
                        ) : (
                          <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                            {sideDeck.map((card, idx) => (
                              <div key={`side-${idx}`} className="cursor-pointer group relative hover:-translate-y-1 transition-transform">
                                <div className="absolute -top-2 -right-2 z-10 opacity-100 md:opacity-0 group-hover:opacity-100 transition flex gap-1">
                                  <button 
                                     onClick={(e) => { e.stopPropagation(); setInspectCard(card); }}
                                     className="bg-blue-600 text-white rounded-full p-1 shadow-lg hover:scale-110 transition"
                                     title="Ver Detalhes"
                                   >
                                      <Eye size={12} />
                                   </button>
                                  <button 
                                    onClick={() => removeFromDeck(idx, true)}
                                    className="bg-red-600 text-white rounded-full p-1 shadow-lg hover:scale-110 transition"
                                    title="Remover"
                                  >
                                    <Minus size={12} />
                                  </button>
                                </div>
                                {/* Mini Card Representation */}
                                <div 
                                  className={`rounded-lg border p-1 md:p-2 h-24 md:h-32 flex flex-col justify-between overflow-hidden relative ${
                                  card.type === 'Herói' ? 'bg-red-950/50 border-red-800' :
                                  card.type === 'Combatente' ? 'bg-blue-950/50 border-blue-800' :
                                  card.type === 'Equipamento' ? 'bg-green-950/50 border-green-800' :
                                  'bg-purple-950/50 border-purple-800'
                                }`}>
                                  {card.imageUrl && (
                                    <img src={card.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-30" alt="" />
                                  )}
                                  <div className="relative z-10">
                                    <div className="text-[8px] md:text-[10px] uppercase font-bold tracking-wider opacity-70 truncate">{card.type}</div>
                                    <div className="font-bold text-[10px] md:text-xs leading-tight line-clamp-2">{card.name}</div>
                                  </div>
                                  <div className="relative z-10 self-end bg-black/50 px-1 md:px-2 rounded text-[10px] md:text-xs font-mono text-yellow-400">
                                    CT {card.ct}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'stats' && (
            <div className="p-2 md:p-8 max-w-4xl mx-auto w-full overflow-y-auto">
              <h3 className="text-lg md:text-2xl font-bold text-white mb-4 md:mb-8 flex items-center gap-2">
                <BarChart3 className="text-purple-500" /> Análise do Deck
              </h3>
              
              <div className="flex flex-col gap-4 md:gap-8 mb-4 md:mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                  {/* Count Stats */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 md:p-6">
                    <h4 className="text-sm md:text-lg font-bold text-slate-300 mb-2 md:mb-4">Distribuição de Tipos</h4>
                    <div className="space-y-2 md:space-y-4">
                      {[
                        { label: 'Heróis', count: stats.counts.Heroi, color: 'bg-red-500' },
                        { label: 'Combatentes', count: stats.counts.Combatente, color: 'bg-blue-500' },
                        { label: 'Equipamentos', count: stats.counts.Equipamento, color: 'bg-green-500' },
                        { label: 'Efeitos', count: stats.counts.Efeito, color: 'bg-purple-500' },
                      ].map((stat) => (
                        <div key={stat.label}>
                          <div className="flex justify-between text-xs md:text-sm mb-1">
                            <span className="text-slate-400">{stat.label}</span>
                            <span className="font-bold text-white">{stat.count}</span>
                          </div>
                          <div className="h-1.5 md:h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${stat.color}`} 
                              style={{ width: `${stats.counts.Total > 0 ? (stat.count / stats.counts.Total) * 100 : 0}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Validation */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 md:p-6">
                    <h4 className="text-sm md:text-lg font-bold text-slate-300 mb-2 md:mb-4">Validação</h4>
                    <div className="space-y-2 md:space-y-3">
                      <div className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded border ${deck.length >= 30 ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
                        {deck.length >= 30 ? <CheckCircle size={16} className="md:w-5 md:h-5" /> : <AlertTriangle size={16} className="md:w-5 md:h-5" />}
                        <span className="text-xs md:text-base">Mínimo 30 cartas no Principal ({deck.length})</span>
                      </div>
                      <div className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded border ${deck.length <= 35 ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
                        {deck.length <= 35 ? <CheckCircle size={16} className="md:w-5 md:h-5" /> : <AlertTriangle size={16} className="md:w-5 md:h-5" />}
                        <span className="text-xs md:text-base">Máximo 35 cartas no Principal ({deck.length})</span>
                      </div>
                      <div className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded border ${sideDeck.length <= 5 ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
                        {sideDeck.length <= 5 ? <CheckCircle size={16} className="md:w-5 md:h-5" /> : <AlertTriangle size={16} className="md:w-5 md:h-5" />}
                        <span className="text-xs md:text-base">Máximo 5 cartas no Side Deck ({sideDeck.length})</span>
                      </div>
                      <div className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded border ${deck.filter(c => c.type === 'Herói').length <= 1 || deck.filter(c => c.type === 'Herói').every(h => getIdentity(h.name) === getIdentity(deck.filter(c => c.type === 'Herói')[0].name)) ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
                        {deck.filter(c => c.type === 'Herói').length <= 1 || deck.filter(c => c.type === 'Herói').every(h => getIdentity(h.name) === getIdentity(deck.filter(c => c.type === 'Herói')[0].name)) ? <CheckCircle size={16} className="md:w-5 md:h-5" /> : <AlertTriangle size={16} className="md:w-5 md:h-5" />}
                        <span className="text-xs md:text-base">Apenas 1 tipo de Herói no Principal</span>
                      </div>
                      <div className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded border ${new Set([...deck, ...sideDeck].map(c => c.name)).size === deck.length + sideDeck.length ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
                        {new Set([...deck, ...sideDeck].map(c => c.name)).size === deck.length + sideDeck.length ? <CheckCircle size={16} className="md:w-5 md:h-5" /> : <AlertTriangle size={16} className="md:w-5 md:h-5" />}
                        <span className="text-xs md:text-base">Sem nomes repetidos (Deck + Side Deck)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mana Curve */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 md:p-6">
                  <h4 className="text-sm md:text-lg font-bold text-slate-300 mb-4 md:mb-6">Curva de Custo (CT)</h4>
                  <div className="h-32 md:h-40 flex items-end gap-1 md:gap-2 justify-center w-full">
                    {[...Array(13)].map((_, i) => {
                      const count = stats.ctDistribution[i] || 0;
                      const maxCount = Math.max(...(Object.values(stats.ctDistribution) as number[]), 1);
                      const height = (count / maxCount) * 100;
                      const label = i === 12 ? '12+' : i.toString();

                      return (
                        <div key={i} className="flex flex-col items-center gap-1 md:gap-2 group flex-1 h-full justify-end">
                          <div className="relative w-full bg-slate-800 rounded-t-sm flex items-end justify-center group-hover:bg-slate-700 transition" style={{ height: '100%' }}>
                            <div 
                              className="w-full bg-indigo-500 opacity-80 hover:opacity-100 transition-all rounded-t-sm"
                              style={{ height: `${height}%` }}
                            ></div>
                            {count > 0 && (
                              <span className="absolute -top-4 md:-top-6 text-[10px] md:text-xs font-bold text-indigo-400">{count}</span>
                            )}
                          </div>
                          <span className="text-[10px] md:text-xs text-slate-500 font-mono border-t border-slate-700 w-full text-center pt-1">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'save' && (
            <div className="p-8 max-w-2xl mx-auto w-full flex flex-col justify-center h-full">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-6">
                
                {/* Export */}
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Salvar Deck</h3>
                  <p className="text-slate-400 mb-4">Copie o código abaixo para salvar ou compartilhar seu deck.</p>
                  
                  {deck.length > 0 || sideDeck.length > 0 ? (
                    isValidToSave ? (
                      <div className="flex gap-2">
                        <input 
                          readOnly
                          value={generateDeckCode()}
                          className="flex-1 bg-black border border-slate-700 rounded p-3 text-xs font-mono text-green-400 overflow-hidden text-ellipsis"
                        />
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(generateDeckCode());
                            alert("Código copiado!");
                          }}
                          className="bg-slate-800 hover:bg-slate-700 text-white p-3 rounded border border-slate-600 transition"
                          title="Copiar"
                        >
                          <Copy size={20} />
                        </button>
                      </div>
                    ) : (
                      <div className="text-red-500 bg-red-900/20 p-4 rounded border border-red-800 text-left text-sm space-y-2">
                        <p className="font-bold mb-2">O deck não cumpre as regras de montagem e não pode ser salvo:</p>
                        {deck.length < 30 && <p>• O deck principal precisa ter no mínimo 30 cartas. (Atual: {deck.length})</p>}
                        {deck.length > 35 && <p>• O deck principal pode ter no máximo 35 cartas. (Atual: {deck.length})</p>}
                        {sideDeck.length > 5 && <p>• O Side Deck pode ter no máximo 5 cartas. (Atual: {sideDeck.length})</p>}
                        {deck.filter(c => c.type === 'Herói').length > 1 && !deck.filter(c => c.type === 'Herói').every(h => getIdentity(h.name) === getIdentity(deck.filter(c => c.type === 'Herói')[0].name)) && <p>• O deck principal só pode ter Heróis de um único tipo/identidade.</p>}
                        {new Set([...deck, ...sideDeck].map(c => c.name)).size !== deck.length + sideDeck.length && <p>• Você tem cartas com nomes repetidos.</p>}
                      </div>
                    )
                  ) : (
                    <div className="text-yellow-500 bg-yellow-900/20 p-4 rounded border border-yellow-800">
                      Monte um deck primeiro para gerar um código.
                    </div>
                  )}
                </div>

                <div className="w-full h-px bg-slate-800 my-8"></div>

                {/* Import */}
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Carregar Deck</h3>
                  <p className="text-slate-400 mb-4">Cole um código de deck aqui para editar.</p>
                  <div className="flex flex-col md:flex-row gap-2">
                    <input 
                      value={importCode}
                      onChange={(e) => setImportCode(e.target.value)}
                      placeholder="Cole o código aqui..."
                      className="flex-1 bg-black border border-slate-700 rounded p-3 text-sm text-white focus:border-purple-500 outline-none"
                    />
                    <button 
                      onClick={loadDeckFromCode}
                      disabled={!importCode}
                      className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 md:py-0 rounded font-bold transition flex items-center justify-center gap-2"
                    >
                      <Download size={18} /> Carregar
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
