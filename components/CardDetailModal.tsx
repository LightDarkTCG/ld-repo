import React, { useMemo } from 'react';
import { X, Zap, BookOpen, Box, Hash, Link as LinkIcon } from 'lucide-react';
import { CardData } from '../types';
import { Card } from './Card';
import { allCards } from '../data';

interface CardDetailModalProps {
  card: CardData | null;
  onClose: () => void;
  onSelectRelated?: (card: CardData) => void;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({ card, onClose, onSelectRelated }) => {
  if (!card) return null;

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
      .slice(0, 6); // Top 6 recomendações

    return scoredCards.map(item => item.card);
  }, [card]);

  const handleRelatedClick = (related: CardData) => {
    if (onSelectRelated) {
      onSelectRelated(related);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in duration-200">
      <button 
        onClick={onClose} 
        className="absolute top-4 right-4 z-50 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition"
      >
        <X size={24} />
      </button>

      <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-8 p-4 lg:p-8 custom-scrollbar">
        
        {/* Left Column: Image */}
        <div className="flex flex-col items-center gap-6">
             <div className="scale-110 origin-center">
                 <Card {...card} />
             </div>
        </div>

        {/* Right Column: Info */}
        <div className="flex flex-col gap-6 text-slate-200">
          <div className="border-b border-slate-800 pb-4">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">{card.name}</h2>
              <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-yellow-600 bg-yellow-900/20 font-mono font-bold text-yellow-400 text-2xl shadow-lg shrink-0" title="CT">
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

          <div className="text-xs text-slate-600 font-mono pt-2 border-t border-slate-800 flex items-center gap-1">
            <Hash size={12}/> ID Código: {card.code}
          </div>

          {/* Related Cards Section */}
          {relatedCards.length > 0 && (
            <div className="mt-4 animate-in slide-in-from-bottom-4 duration-500">
              <h4 className="text-sm font-bold text-blue-400 uppercase mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
                <LinkIcon size={16} /> Sinergias & Interações
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {relatedCards.map((related, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleRelatedClick(related)}
                    className="cursor-pointer group flex flex-col gap-2"
                  >
                    <div className="origin-top-left scale-[0.45] w-[220%] h-[220%] mb-[-120%] mr-[-120%] pointer-events-none">
                       <Card {...related} />
                    </div>
                    <div className="text-[10px] text-center text-slate-400 group-hover:text-white truncate font-bold mt-2">
                      {related.name}
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
