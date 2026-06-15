import React, { useMemo, useState, useEffect } from 'react';
import { X, Zap, BookOpen, Box, Hash, Link as LinkIcon, Edit2, Check, Trash } from 'lucide-react';
import { CardData } from '../types';
import { Card } from './Card';
import { useCards } from '../CardContext';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface CardDetailModalProps {
  card: CardData | null;
  onClose: () => void;
  onSelectRelated?: (card: CardData) => void;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({ card: initialCard, onClose, onSelectRelated }) => {
  const { cards: allCards, archetypes, collections, saveCard, deleteCard } = useCards();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [card, setCard] = useState<CardData | null>(initialCard);
  const [originalCode, setOriginalCode] = useState(initialCard?.code);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return unsub;
  }, []);

  useEffect(() => {
    setCard(initialCard);
    setOriginalCode(initialCard?.code);
    setIsEditing(false);
  }, [initialCard]);



  // --- Logic to find related cards ---
  const relatedCards = useMemo(() => {
    if (!card) return [];

    // Helper: Extrai termos entre « » que são muito usados no jogo para referenciar grupos
    const extractQuotedTerms = (text: string): string[] => {
      const matches = text.match(/«(.*?)»/g);
      if (!matches) return [];
      return matches.map(m => m.replace(/[«»]/g, '').toLowerCase().trim());
    };

    // Helper: Valida restrições de equipamentos baseadas na descrição
    const isEquipmentValid = (equip: CardData, target: CardData): boolean => {
      const desc = equip.description.toLowerCase();
      
      // 1. Restrição de Herói
      if (desc.includes('só pode ser equipada em heróis') || desc.includes('only equip to heroes')) {
        if (target.type !== 'Herói') return false;
      }

      // 2. Restrição de Nome (Ex: "Só pode equipar um combatente com «Spear»")
      if (desc.includes('só pode equipar') || desc.includes('can only equip')) {
        const restrictions = extractQuotedTerms(desc);
        if (restrictions.length > 0) {
          // O alvo deve ter pelo menos UM dos termos restritos em seu nome
          const matchesRestriction = restrictions.some(term => target.name.toLowerCase().includes(term));
          if (!matchesRestriction) return false;
        }
      }

      return true;
    };

    const scoredCards = allCards
      .filter(c => c.code !== card.code) // Exclui a própria carta
      .map(candidate => {
        let score = 0;
        const cDesc = card.description.toLowerCase();
        const candDesc = candidate.description.toLowerCase();
        const cName = card.name.toLowerCase();
        const candName = candidate.name.toLowerCase();

        // --- 1. VALIDAÇÃO DE REGRAS DE EQUIPAMENTO ---
        // Se a carta atual é equip, o candidato deve ser válido
        if (card.type === 'Equipamento') {
          if (!isEquipmentValid(card, candidate)) return { card: candidate, score: 0 };
        }
        // Se o candidato é equip, a carta atual deve ser válida para ele
        if (candidate.type === 'Equipamento') {
          if (!isEquipmentValid(candidate, card)) return { card: candidate, score: 0 };
        }

        // --- 2. MENÇÃO DIRETA DE NOME (Sinergia Forte) ---
        // A carta menciona o nome exato do candidato?
        if (cDesc.includes(candName)) score += 50;
        // O candidato menciona o nome exato da carta?
        if (candDesc.includes(cName)) score += 50;

        // --- 3. MENÇÃO DE GRUPO/FAMÍLIA (via « ») ---
        // Ex: Carta diz "Buffa cartas «Spear»". Candidato tem "Spear" no nome.
        const cQuoted = extractQuotedTerms(cDesc);
        cQuoted.forEach(term => {
          if (term.length > 2 && candName.includes(term)) score += 30;
        });

        const candQuoted = extractQuotedTerms(candDesc);
        candQuoted.forEach(term => {
          if (term.length > 2 && cName.includes(term)) score += 30;
        });

        // --- 4. SINERGIA DE ARQUÉTIPO (Contextual) ---
        // Só pontua se a descrição mencionar o arquétipo explicitamente.
        // Isso evita que todos os "Lúmen" apareçam como relacionados sem motivo.
        const candArchetypes = candidate.archetype.toLowerCase().split(' / ');
        candArchetypes.forEach(arch => {
           // Verifica se a descrição da carta menciona o arquétipo do candidato
           if (cDesc.includes(arch)) score += 15;
        });

        // Vice-versa
        const cardArchetypes = card.archetype.toLowerCase().split(' / ');
        cardArchetypes.forEach(arch => {
           if (candDesc.includes(arch)) score += 15;
        });

        return { card: candidate, score };
      })
      .filter(item => item.score > 0) // Só retorna se tiver pontuação real
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 recomendações

    return scoredCards.map(item => item.card);
  }, [card, allCards]);

  if (!card) return null;

  const handleRelatedClick = (related: CardData) => {
    if (onSelectRelated) {
      onSelectRelated(related);
    }
  };

  const handleCopyFromCard = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    if (!code || !card) return;
    const sourceCard = allCards.find(c => c.code === code);
    if (sourceCard) {
      setCard({
        ...card,
        name: sourceCard.name,
        description: sourceCard.description || '',
        type: sourceCard.type || 'Herói',
        archetype: sourceCard.archetype || 'Desconhecido',
        ct: sourceCard.ct || 0,
        attack: sourceCard.attack || 0,
        defense: sourceCard.defense || 0,
        lore: sourceCard.lore || '',
        collection: sourceCard.collection,
        code: sourceCard.code
      });
    }
    e.target.value = '';
  };

  const handleSave = async () => {
    if (card) {
      if (originalCode && originalCode !== card.code) {
        await deleteCard(originalCode);
      }
      await saveCard(card);
      setOriginalCode(card.code);
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (card) {
      console.log('handleDelete called, originalCode:', originalCode, 'card.code:', card.code);
      if (originalCode) {
        await deleteCard(originalCode);
      } else {
        await deleteCard(card.code);
      }
      onClose();
    }
  };

  const handleSaveAndAddAnother = async () => {
    if (card) {
      if (originalCode && originalCode !== card.code) {
        await deleteCard(originalCode);
      }
      await saveCard(card);
      
      const nextCode = `CUSTOM/${Date.now()}`;
      setOriginalCode(nextCode);
      
      // Mantém no modo de edição e reseta parcialmente
      setCard({
        ...card,
        name: "Nova Carta",
        code: nextCode,
        description: "Edite a carta para alterar sua descrição.",
        lore: "Nova entidade surgida no Macroverso.",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in duration-200">
      <div className="absolute top-4 right-4 flex gap-2 z-50">
        {isEditing ? (
          <>
            {(() => {
              const existingCard = allCards.find(c => c.code === originalCode);
              return existingCard && (!existingCard.frame || existingCard.frame === 'Legado') && card.frame !== 'Moderno' ? (
                <span className="text-red-400 font-bold text-xs flex items-center bg-black/50 px-3 py-1 rounded mt-1 sm:mt-0 max-w-[200px] text-right">
                  ⚠️ Crie uma cópia ou mude o Frame para 'Moderno' para editar.
                </span>
              ) : null;
            })()}
            <button 
              onClick={handleDelete} 
              disabled={(() => {
                const existingCard = allCards.find(c => c.code === originalCode);
                return existingCard ? (!existingCard.frame || existingCard.frame === 'Legado') : false;
              })()}
              className={`p-2 rounded-full text-white transition flex items-center gap-2 px-4 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${confirmDelete ? 'bg-red-700 hover:bg-red-600 shadow-red-900/80 animate-pulse' : 'bg-red-600 hover:bg-red-500 shadow-red-900/50'}`}
            >
              <Trash size={20} /> {confirmDelete ? "Tem certeza?" : "Apagar"}
            </button>
            <button 
              onClick={handleSaveAndAddAnother} 
              disabled={(() => {
                const existingCard = allCards.find(c => c.code === originalCode);
                return existingCard ? (!existingCard.frame || existingCard.frame === 'Legado') && card.frame !== 'Moderno' : false;
              })()}
              className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500 transition flex items-center gap-2 px-4 shadow-lg shadow-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={20} /> Salvar & Lote
            </button>
            <button 
              onClick={handleSave} 
              disabled={(() => {
                const existingCard = allCards.find(c => c.code === originalCode);
                return existingCard ? (!existingCard.frame || existingCard.frame === 'Legado') && card.frame !== 'Moderno' : false;
              })()}
              className="p-2 bg-green-600 rounded-full text-white hover:bg-green-500 transition flex items-center gap-2 px-4 shadow-lg shadow-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={20} /> Salvar
            </button>
          </>
        ) : user ? (
          <button 
            onClick={() => setIsEditing(true)} 
            className="p-2 bg-slate-800 rounded-full text-purple-400 hover:text-white hover:bg-slate-700 transition"
            title="Editar Carta"
          >
            <Edit2 size={24} />
          </button>
        ) : null}
        <button 
          onClick={onClose} 
          className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition"
        >
          <X size={24} />
        </button>
      </div>

      <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-8 p-4 lg:p-8 custom-scrollbar">
        
        {/* Left Column: Image */}
        <div className="flex flex-col items-center gap-6">
             <div className="scale-110 origin-center">
                 <Card {...card} />
             </div>
        </div>

        {/* Right Column: Info */}
        <div className="flex flex-col gap-6 text-slate-200">
          {isEditing && (
            <div className="bg-slate-800/50 p-3 rounded-lg border border-purple-500/50 mb-[-1rem]">
              <label className="text-xs font-bold text-purple-400 block mb-1">Copiar dados de outra carta</label>
              <select onChange={handleCopyFromCard} className="w-full bg-slate-900 border border-purple-700/50 rounded p-2 text-white text-sm outline-none">
                <option value="">Selecione uma carta base (copia todos os dados exceto Imagem e Frame)...</option>
                {allCards.map((c, idx) => <option key={`${c.code}-${idx}`} value={c.code}>{c.name} ({c.code})</option>)}
              </select>
            </div>
          )}
          <div className="border-b border-slate-800 pb-4">
            <div className="flex justify-between items-start mb-4 gap-4">
              {isEditing ? (
                <input 
                  type="text" 
                  value={card.name} 
                  onChange={(e) => setCard({...card, name: e.target.value})}
                  className="w-full text-3xl md:text-4xl font-black text-white tracking-tight bg-slate-900 border border-slate-700 rounded p-2 focus:border-purple-500 outline-none"
                />
              ) : (
                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">{card.name}</h2>
              )}
              
              {isEditing ? (
                <div className="flex flex-col items-center">
                  <label className="text-xs text-yellow-500 font-bold mb-1">Custo (CT)</label>
                  <input 
                    type="number" 
                    value={card.ct} 
                    onChange={(e) => setCard({...card, ct: parseInt(e.target.value) || 0})}
                    className="w-16 h-12 rounded border-2 border-yellow-600 bg-slate-900 font-mono font-bold text-yellow-400 text-xl text-center focus:border-purple-500 outline-none title='Custo (CT)'"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <label className="text-xs text-yellow-500 font-bold mb-1">Custo (CT)</label>
                  <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-yellow-600 bg-yellow-900/20 font-mono font-bold text-yellow-400 text-xl shadow-lg shrink-0" title="Custo (CT)">
                    {card.ct}
                  </div>
                </div>
              )}
            </div>
            
            {isEditing && (
              <div className="grid grid-cols-2 gap-4 mb-4 mt-2">
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Ataque (ATK)</label>
                  <input type="number" placeholder="ATK" value={card.attack || ''} onChange={(e) => setCard({...card, attack: e.target.value ? parseInt(e.target.value) : undefined})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-bold" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Defesa (DEF)</label>
                  <input type="number" placeholder="DEF" value={card.defense || ''} onChange={(e) => setCard({...card, defense: e.target.value ? parseInt(e.target.value) : undefined})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-bold" />
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 text-sm font-medium">
              {isEditing ? (
                 <select value={card.type} onChange={(e) => setCard({...card, type: e.target.value as CardData['type']})} className="px-3 py-1.5 bg-slate-800 rounded text-slate-300 border border-slate-700 outline-none">
                    <option value="Herói">Herói</option>
                    <option value="Combatente">Combatente</option>
                    <option value="Equipamento">Equipamento</option>
                    <option value="Efeito">Efeito</option>
                 </select>
              ) : (
                 <span className="px-3 py-1 bg-slate-800 rounded text-slate-300 border border-slate-700">{card.type}</span>
              )}

              {isEditing ? (
                <>
                  <input list="archetypes-list" type="text" value={card.archetype} onChange={(e) => setCard({...card, archetype: e.target.value})} className="px-3 py-1.5 bg-purple-900/10 rounded text-purple-300 border border-purple-800/50 outline-none w-48 focus:border-purple-500" placeholder="Arquétipo" />
                  <datalist id="archetypes-list">
                    {archetypes.map(a => <option key={a.name} value={a.name} />)}
                  </datalist>
                </>
              ) : (
                <span className="px-3 py-1 bg-purple-900/30 rounded text-purple-300 border border-purple-800/50">{card.archetype}</span>
              )}

              {isEditing ? (
                <>
                  <input list="collections-list" type="text" value={card.collection} onChange={(e) => setCard({...card, collection: e.target.value})} className="px-3 py-1.5 bg-blue-900/10 rounded text-blue-300 border border-blue-800/50 outline-none w-48 focus:border-purple-500" placeholder="Coleção" />
                  <datalist id="collections-list">
                    {collections.map(c => <option key={c} value={c} />)}
                  </datalist>
                </>
              ) : (
                <span className="px-3 py-1 bg-blue-900/30 rounded text-blue-300 border border-blue-800/50 flex items-center gap-1">
                  <Box size={14} /> {card.collection || "Coleção Base"}
                </span>
              )}
              
              {isEditing ? (
                 <select value={card.frame || 'Legado'} onChange={(e) => setCard({...card, frame: e.target.value as 'Legado' | 'Moderno'})} className="px-3 py-1.5 bg-indigo-900/10 rounded text-indigo-300 border border-indigo-800/50 outline-none">
                    <option value="Legado">Frame Legado</option>
                    <option value="Moderno">Frame Moderno</option>
                 </select>
              ) : (
                 <span className="px-3 py-1 bg-indigo-900/30 rounded text-indigo-300 border border-indigo-800/50 hidden"></span>
              )}
            </div>
            
            {isEditing && (
              <div className="mt-4 flex flex-col gap-3">
                <input type="text" value={card.imageUrl || ''} onChange={(e) => setCard({...card, imageUrl: e.target.value})} className="w-full px-3 py-2 bg-slate-900 rounded text-slate-300 border border-slate-700 outline-none text-sm" placeholder="URL da Imagem (https://...)" />
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="publicVisibility" checked={!card.isHidden} onChange={(e) => setCard({...card, isHidden: !e.target.checked})} className="w-4 h-4 accent-green-500 cursor-pointer" />
                  <label htmlFor="publicVisibility" className="text-sm font-bold text-green-400 cursor-pointer">Visível para o público (Desmarque para manter como Rascunho/Draft)</label>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700/50">
            <h4 className="text-sm font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
              <Zap size={16} /> Efeito da Carta
            </h4>
            {isEditing ? (
               <textarea 
                 value={card.description}
                 onChange={(e) => setCard({...card, description: e.target.value})}
                 className="w-full h-32 bg-slate-900 border border-slate-700 rounded p-3 text-slate-200 outline-none focus:border-purple-500 custom-scrollbar"
               />
            ) : (
              <p className="text-lg leading-relaxed text-slate-200 whitespace-pre-wrap">
                {card.description}
              </p>
            )}
          </div>

          <div className="bg-black/40 p-6 rounded-xl border-l-4 border-purple-600 italic">
            <h4 className="text-sm font-bold text-purple-400 uppercase mb-3 flex items-center gap-2">
              <BookOpen size={16} /> Lore
            </h4>
            {isEditing ? (
              <textarea 
                value={card.lore || ''}
                onChange={(e) => setCard({...card, lore: e.target.value})}
                className="w-full h-32 bg-slate-900/50 border border-purple-900/50 rounded p-3 text-slate-400 font-serif outline-none focus:border-purple-500 custom-scrollbar"
                placeholder="Uma história se perde no tempo sem ninguém para contá-la..."
              />
            ) : (
              <p 
                className="text-slate-400 font-serif leading-relaxed"
                dangerouslySetInnerHTML={{ __html: card.lore ? `"${card.lore}"` : '"Dados fragmentados... a história desta entidade perdeu-se no rasgo do Macroverso."' }}
              />
            )}
          </div>

          <div className="text-xs text-slate-600 font-mono pt-2 border-t border-slate-800 flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <Hash size={12}/> ID Código: 
              {isEditing ? (
                <input 
                  type="text" 
                  value={card.code} 
                  onChange={(e) => setCard({...card, code: e.target.value})}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 outline-none focus:border-purple-500 w-full ml-2"
                />
              ) : (
                card.code
              )}
            </div>
          </div>

          {/* Related Cards Section */}
          {relatedCards.length > 0 && (
            <div className="mt-4 animate-in slide-in-from-bottom-4 duration-500">
              <h4 className="text-sm font-bold text-blue-400 uppercase mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
                <LinkIcon size={16} /> Sinergias & Interações
              </h4>
              <div className="flex gap-4 overflow-x-auto pb-4 justify-start lg:justify-center custom-scrollbar">
                {relatedCards.map((related, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleRelatedClick(related)}
                    className="cursor-pointer group flex flex-col items-center flex-shrink-0 hover:scale-105 transition-transform"
                    title={related.name}
                  >
                    {/* Fixed container for the scaled card */}
                    <div className="relative w-[130px] h-[190px]">
                       <div className="absolute top-0 left-0 origin-top-left scale-[0.45] pointer-events-none">
                          <Card {...related} />
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
