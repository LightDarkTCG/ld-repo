import React, { useState, useMemo } from 'react';
import { X, Search, Filter, Save, Download, Trash2, Plus, Minus, AlertTriangle, CheckCircle, BarChart3, Copy } from 'lucide-react';
import { CardData, CardType } from '../types';
import { allCards, collectionsList, archetypesList } from '../data';
import { Card } from './Card';

interface DeckBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeckBuilderModal: React.FC<DeckBuilderModalProps> = ({ isOpen, onClose }) => {
  const [deck, setDeck] = useState<CardData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [importCode, setImportCode] = useState("");
  const [activeTab, setActiveTab] = useState<'build' | 'stats' | 'save'>('build');
  const [filters, setFilters] = useState({
    type: "Todos",
    archetype: "Todos",
    collection: "Todos",
    ct: "Todos"
  });

  // --- Logic ---

  const addToDeck = (card: CardData) => {
    if (deck.length >= 35) {
      alert("O deck não pode ter mais de 35 cartas.");
      return;
    }

    // 1 Copy Limit Rule
    if (deck.some(c => c.code === card.code)) {
      alert("Você só pode adicionar 1 cópia de cada carta.");
      return;
    }

    // Hero Restriction Logic
    if (card.type === 'Herói') {
      const existingHeroes = deck.filter(c => c.type === 'Herói');
      if (existingHeroes.length > 0) {
        
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

        const currentIdentity = getIdentity(existingHeroes[0].name);
        const newIdentity = getIdentity(card.name);
        
        if (currentIdentity !== newIdentity) {
          alert(`Você só pode ter Heróis do tipo "${currentIdentity}" neste deck.`);
          return;
        }
      }
    }

    setDeck([...deck, card]);
  };

  const removeFromDeck = (indexToRemove: number) => {
    setDeck(deck.filter((_, index) => index !== indexToRemove));
  };

  const clearDeck = () => {
    if (confirm("Tem certeza que deseja limpar todo o deck?")) {
      setDeck([]);
    }
  };

  // --- Import / Export ---

  const generateDeckCode = () => {
    const codes = deck.map(c => c.code);
    return btoa(JSON.stringify(codes));
  };

  const loadDeckFromCode = () => {
    try {
      const decoded = atob(importCode);
      const codes: string[] = JSON.parse(decoded);
      
      const newDeck: CardData[] = [];
      let missingCount = 0;

      codes.forEach(code => {
        const found = allCards.find(c => c.code === code);
        if (found) newDeck.push(found);
        else missingCount++;
      });

      setDeck(newDeck);
      setImportCode("");
      alert(`Deck carregado! ${newDeck.length} cartas encontradas.${missingCount > 0 ? ` ${missingCount} cartas não identificadas.` : ''}`);
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
    const ctDistribution: Record<number, number> = {};

    deck.forEach(card => {
      // Count Types
      if (card.type === 'Herói') counts.Heroi++;
      else if (card.type === 'Combatente') counts.Combatente++;
      else if (card.type === 'Equipamento') counts.Equipamento++;
      else if (card.type === 'Efeito') counts.Efeito++;

      // Count CT
      const ct = card.ct || 0;
      ctDistribution[ct] = (ctDistribution[ct] || 0) + 1;
    });

    return { counts, ctDistribution };
  }, [deck]);

  const isValidDeckSize = deck.length >= 30 && deck.length <= 35;

  // --- Filtered Pool ---

  const filteredPool = allCards.filter(card => {
    const matchesSearch = card.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filters.type === "Todos" || card.type === filters.type;
    const matchesArch = filters.archetype === "Todos" || card.archetype.includes(filters.archetype);
    const matchesColl = filters.collection === "Todos" || card.collection === filters.collection;
    const matchesCt = filters.ct === "Todos" || card.ct === parseInt(filters.ct);
    
    return matchesSearch && matchesType && matchesArch && matchesColl && matchesCt;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0c] animate-in fade-in zoom-in duration-200">
      
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Save className="text-purple-500" /> MONTE SEU DECK
          </h2>
          <div className="flex bg-slate-800 rounded-lg p-1">
            <button 
              onClick={() => setActiveTab('build')}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${activeTab === 'build' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Montar
            </button>
            <button 
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${activeTab === 'stats' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Estatísticas
            </button>
            <button 
              onClick={() => setActiveTab('save')}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${activeTab === 'save' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Salvar/Carregar
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`px-3 py-1 rounded border flex items-center gap-2 ${isValidDeckSize ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-red-900/30 border-red-500 text-red-400'}`}>
            <span className="font-mono font-bold text-lg">{deck.length}</span>
            <span className="text-xs uppercase">/ 30-35 Cartas</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition">
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDE: Card Pool (Only visible in Build tab) */}
        {activeTab === 'build' && (
          <div className="w-1/2 flex flex-col border-r border-slate-800 bg-[#0f0f13]">
            {/* Filters */}
            <div className="p-4 border-b border-slate-800 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar carta..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-white text-sm focus:border-purple-500 outline-none"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                <select 
                  className="bg-slate-900 text-xs text-white border border-slate-700 rounded px-2 py-1 outline-none"
                  value={filters.type} onChange={(e) => setFilters({...filters, type: e.target.value})}
                >
                  <option value="Todos">Tipo: Todos</option>
                  <option value="Herói">Herói</option>
                  <option value="Combatente">Combatente</option>
                  <option value="Equipamento">Equipamento</option>
                  <option value="Efeito">Efeito</option>
                </select>
                <select 
                  className="bg-slate-900 text-xs text-white border border-slate-700 rounded px-2 py-1 outline-none"
                  value={filters.ct} onChange={(e) => setFilters({...filters, ct: e.target.value})}
                >
                  <option value="Todos">CT: Todos</option>
                  {[...Array(21)].map((_, i) => <option key={i} value={i}>{i}</option>)}
                </select>
                <select 
                  className="bg-slate-900 text-xs text-white border border-slate-700 rounded px-2 py-1 outline-none w-32"
                  value={filters.collection} onChange={(e) => setFilters({...filters, collection: e.target.value})}
                >
                  <option value="Todos">Coleção: Todas</option>
                  {collectionsList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredPool.map((card, idx) => {
                  const isInDeck = deck.some(c => c.code === card.code);
                  return (
                    <div 
                      key={idx} 
                      onClick={() => !isInDeck && addToDeck(card)} 
                      className={`cursor-pointer group relative ${isInDeck ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                    >
                      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition">
                         {!isInDeck && (
                           <div className="bg-green-600 text-white rounded-full p-1 shadow-lg">
                              <Plus size={16} />
                           </div>
                         )}
                      </div>
                      <div className="pointer-events-none scale-[0.6] origin-top-left w-[170%] h-[170%] mb-[-70%] mr-[-70%]">
                         <Card {...card} />
                      </div>
                      {isInDeck && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px] rounded-xl">
                          <CheckCircle className="text-green-500" size={32} />
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
        <div className={`${activeTab === 'build' ? 'w-1/2' : 'w-full'} flex flex-col bg-[#0a0a0c]`}>
          
          {activeTab === 'build' && (
            <>
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="font-bold text-white">Seu Deck ({deck.length})</h3>
                <button onClick={() => setDeck([])} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                  <Trash2 size={14} /> Limpar
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                {deck.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600">
                    <div className="bg-slate-900 p-4 rounded-full mb-4">
                      <Save size={32} />
                    </div>
                    <p>Selecione cartas à esquerda para adicionar.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {deck.map((card, idx) => (
                      <div key={idx} onClick={() => removeFromDeck(idx)} className="cursor-pointer group relative hover:-translate-y-1 transition-transform">
                        <div className="absolute -top-2 -right-2 z-10 opacity-0 group-hover:opacity-100 transition">
                          <div className="bg-red-600 text-white rounded-full p-1 shadow-lg">
                            <Minus size={14} />
                          </div>
                        </div>
                        {/* Mini Card Representation */}
                        <div className={`rounded-lg border p-2 h-32 flex flex-col justify-between overflow-hidden relative ${
                          card.type === 'Herói' ? 'bg-red-950/50 border-red-800' :
                          card.type === 'Combatente' ? 'bg-blue-950/50 border-blue-800' :
                          card.type === 'Equipamento' ? 'bg-green-950/50 border-green-800' :
                          'bg-purple-950/50 border-purple-800'
                        }`}>
                          {card.imageUrl && (
                            <img src={card.imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-30" alt="" />
                          )}
                          <div className="relative z-10">
                            <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">{card.type}</div>
                            <div className="font-bold text-xs leading-tight line-clamp-2">{card.name}</div>
                          </div>
                          <div className="relative z-10 self-end bg-black/50 px-2 rounded text-xs font-mono text-yellow-400">
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

          {activeTab === 'stats' && (
            <div className="p-8 max-w-4xl mx-auto w-full">
              <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
                <BarChart3 className="text-purple-500" /> Análise do Deck
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Count Stats */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-slate-300 mb-4">Distribuição de Tipos</h4>
                  <div className="space-y-4">
                    {[
                      { label: 'Heróis', count: stats.counts.Heroi, color: 'bg-red-500' },
                      { label: 'Combatentes', count: stats.counts.Combatente, color: 'bg-blue-500' },
                      { label: 'Equipamentos', count: stats.counts.Equipamento, color: 'bg-green-500' },
                      { label: 'Efeitos', count: stats.counts.Efeito, color: 'bg-purple-500' },
                    ].map((stat) => (
                      <div key={stat.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-400">{stat.label}</span>
                          <span className="font-bold text-white">{stat.count}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
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
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h4 className="text-lg font-bold text-slate-300 mb-4">Validação</h4>
                  <div className="space-y-3">
                    <div className={`flex items-center gap-3 p-3 rounded border ${deck.length >= 30 ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
                      {deck.length >= 30 ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                      <span>Mínimo 30 cartas ({deck.length})</span>
                    </div>
                    <div className={`flex items-center gap-3 p-3 rounded border ${deck.length <= 35 ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
                      {deck.length <= 35 ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                      <span>Máximo 35 cartas ({deck.length})</span>
                    </div>
                    <div className={`flex items-center gap-3 p-3 rounded border ${stats.counts.Heroi > 0 ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-yellow-900/20 border-yellow-800 text-yellow-400'}`}>
                      {stats.counts.Heroi > 0 ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                      <span>Pelo menos 1 Herói</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mana Curve */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h4 className="text-lg font-bold text-slate-300 mb-6">Curva de Custo (CT)</h4>
                <div className="h-40 flex items-end gap-2 justify-center">
                  {[...Array(13)].map((_, i) => {
                    const count = stats.ctDistribution[i] || 0;
                    const maxCount = Math.max(...(Object.values(stats.ctDistribution) as number[]), 1);
                    const height = (count / maxCount) * 100;
                    return (
                      <div key={i} className="flex flex-col items-center gap-2 group w-8">
                        <div className="relative w-full bg-slate-800 rounded-t-sm flex items-end justify-center group-hover:bg-slate-700 transition h-full">
                          <div 
                            className="w-full bg-indigo-500 opacity-80 hover:opacity-100 transition-all rounded-t-sm"
                            style={{ height: `${height}%` }}
                          ></div>
                          {count > 0 && (
                            <span className="absolute -top-6 text-xs font-bold text-indigo-400">{count}</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-mono border-t border-slate-700 w-full text-center pt-1">{i}</span>
                      </div>
                    );
                  })}
                  <div className="flex flex-col items-center gap-2 w-8">
                     <span className="text-xs text-slate-600 mb-2">...</span>
                     <span className="text-xs text-slate-500 font-mono pt-1">12+</span>
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
                  
                  {deck.length > 0 ? (
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
                  <div className="flex gap-2">
                    <input 
                      value={importCode}
                      onChange={(e) => setImportCode(e.target.value)}
                      placeholder="Cole o código aqui..."
                      className="flex-1 bg-black border border-slate-700 rounded p-3 text-sm text-white focus:border-purple-500 outline-none"
                    />
                    <button 
                      onClick={loadDeckFromCode}
                      disabled={!importCode}
                      className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded font-bold transition flex items-center gap-2"
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