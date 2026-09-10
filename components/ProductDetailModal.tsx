import React, { useState, useMemo } from 'react';
import { X, ShoppingCart, Play, Image as ImageIcon, ChevronLeft, ChevronRight, Layers, Sword, Shield, Sparkles, ExternalLink, Copy, Check, Info } from 'lucide-react';
import { ExclusiveProduct, ProductMediaItem, CardData } from '../types';
import { parseDeckFromCode, ParsedDeckData, DeckCardEntry } from '../deckUtils';

interface ProductDetailModalProps {
  product: ExclusiveProduct | null;
  onClose: () => void;
  allCards: CardData[];
  onSelectCard?: (card: CardData) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  allCards,
  onSelectCard
}) => {
  if (!product) return null;

  // Extract all media items
  const mediaList: ProductMediaItem[] = useMemo(() => {
    if (product.mediaList && Array.isArray(product.mediaList) && product.mediaList.length > 0) {
      const valid = product.mediaList.filter(m => m && m.url && m.url.trim() !== '');
      if (valid.length > 0) return valid;
    }
    if (product.mediaUrl && product.mediaUrl.trim() !== '') {
      return [{ type: product.mediaType || 'image', url: product.mediaUrl }];
    }
    return [{ type: 'image', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe' }];
  }, [product]);

  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const currentMedia = mediaList[activeMediaIndex] || mediaList[0];

  // Parse card codes from Deck Builder code or code list
  const deckData: ParsedDeckData = useMemo(() => {
    return parseDeckFromCode(product.cardCodes, allCards);
  }, [product.cardCodes, allCards]);

  const handleCopyDeckCode = () => {
    if (!deckData.rawDeckBuilderCode) return;
    navigator.clipboard.writeText(deckData.rawDeckBuilderCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const isButtonEnabled = product.isButtonActive !== false && product.isActive !== false;
  const buttonLink = product.buttonLink || 'https://mpago.la/1FZ3Mip';
  const buttonText = product.buttonText || 'Comprar Agora';

  const renderCardGrid = (entries: DeckCardEntry[]) => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {entries.map((item, idx) => {
          const card = item.card;
          return (
            <div 
              key={idx}
              onClick={() => card && onSelectCard && onSelectCard(card)}
              className={`p-3 rounded-xl border flex items-center gap-3 transition-all duration-200 group ${
                card 
                  ? 'bg-slate-950/80 border-slate-800 hover:border-purple-500/60 cursor-pointer hover:bg-slate-850 hover:shadow-lg' 
                  : 'bg-slate-950/40 border-slate-850 opacity-70'
              }`}
            >
              {/* Quantity multiplier */}
              <span className="shrink-0 bg-purple-900/80 border border-purple-600/50 text-purple-200 font-mono font-bold text-xs px-2 py-1 rounded-md shadow-sm">
                {item.qty}x
              </span>

              {/* Card art or placeholder */}
              <div className="w-11 h-14 rounded overflow-hidden shrink-0 bg-slate-900 border border-slate-800 flex items-center justify-center">
                {card?.imageUrl ? (
                  <img src={card.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                ) : (
                  <Layers size={18} className="text-slate-600" />
                )}
              </div>

              {/* Card Info */}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-white truncate group-hover:text-purple-300 transition-colors">
                  {card ? card.name : item.code}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-mono">
                  {card?.type && (
                    <span className={`font-semibold ${
                      card.type === 'Herói' ? 'text-red-400' :
                      card.type === 'Combatente' ? 'text-blue-400' :
                      card.type === 'Equipamento' ? 'text-green-400' :
                      'text-purple-400'
                    }`}>
                      {card.type}
                    </span>
                  )}
                  {card?.ct !== undefined && (
                    <span className="text-yellow-400 font-bold">CT {card.ct}</span>
                  )}
                  {(card?.attack !== undefined && card?.defense !== undefined && (card.type === 'Herói' || card.type === 'Combatente')) && (
                    <span className="text-slate-400">{card.attack}/{card.defense}</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 font-mono truncate">
                  {item.code}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-purple-900/50 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-[0_0_50px_rgba(168,85,247,0.25)] overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-900/30 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <span className="bg-purple-950 text-purple-300 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-purple-700/50">
              {product.badge || 'Produto Oficial'}
            </span>
            <h3 className="text-white font-bold text-base md:text-lg truncate max-w-[280px] sm:max-w-md">
              {product.title || 'Detalhes do Produto'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800/80 hover:bg-purple-900/50 text-slate-400 hover:text-white transition"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-7 space-y-7">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Media Gallery (Left Side - 7 Cols on lg) */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-slate-800 shadow-xl flex items-center justify-center">
                {currentMedia?.type === 'video' ? (
                  <video 
                    key={currentMedia.url}
                    src={currentMedia.url} 
                    controls 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img 
                    key={currentMedia?.url}
                    src={currentMedia?.url} 
                    alt={product.title} 
                    className="w-full h-full object-contain select-none"
                  />
                )}

                {/* Media Counter Badge */}
                {mediaList.length > 1 && (
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs font-mono font-bold px-2.5 py-1 rounded-md border border-white/10">
                    {activeMediaIndex + 1} / {mediaList.length}
                  </div>
                )}
              </div>

              {/* Thumbnails strip */}
              {mediaList.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 custom-scrollbar">
                  {mediaList.map((m, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveMediaIndex(idx)}
                      className={`relative shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                        activeMediaIndex === idx 
                          ? 'border-purple-500 ring-2 ring-purple-500/50 scale-105' 
                          : 'border-slate-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {m.type === 'video' ? (
                        <div className="w-full h-full bg-slate-950 flex items-center justify-center relative">
                          <video src={m.url} className="w-full h-full object-cover" muted />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Play size={16} className="text-white fill-white" />
                          </div>
                        </div>
                      ) : (
                        <img src={m.url} alt="" className="w-full h-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info and Purchase (Right Side - 5 Cols on lg) */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-5 bg-slate-950/50 border border-purple-900/20 p-5 rounded-xl">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-3">
                  {product.title || 'Produto Exclusivo'}
                </h2>

                <div className="text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-line mb-6">
                  {product.description}
                </div>

                {deckData.isValid && (
                  <div className="mb-4 inline-flex items-center gap-2 bg-purple-950/70 border border-purple-800/60 px-3.5 py-1.5 rounded-lg text-purple-300 text-xs font-bold font-mono">
                    <Layers size={15} />
                    <span>
                      DECK PRÉ-MONTADO COM {deckData.totalCount} CARTAS
                      {deckData.totalSideCount > 0 ? ` (${deckData.totalMainCount} Principal + ${deckData.totalSideCount} Side)` : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Buy Action */}
              <div className="pt-4 border-t border-slate-800/80">
                {isButtonEnabled ? (
                  <a 
                    href={buttonLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2.5 shadow-lg shadow-purple-900/50 hover:scale-[1.02] active:scale-[0.98] text-base"
                  >
                    <ShoppingCart size={20} />
                    <span>{buttonText}</span>
                    <ExternalLink size={16} className="opacity-70 ml-1" />
                  </a>
                ) : (
                  <div className="w-full py-3.5 px-4 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-400 text-xs text-center font-medium">
                    Vendas temporariamente indisponíveis
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Deck List Section (if valid deck cards exist) */}
          {deckData.isValid && (
            <div className="border-t border-purple-900/30 pt-6 space-y-6">
              
              {/* Header with Copy Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/70 border border-purple-900/30 p-4 rounded-xl">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="text-purple-400" size={20} />
                    <h4 className="text-lg md:text-xl font-bold text-white tracking-wide">
                      Composição do Deck
                    </h4>
                    {deckData.isDeckBuilderCode && (
                      <span className="bg-purple-900/60 text-purple-300 border border-purple-700/40 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                        Criador de Deck
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Clique em qualquer carta para ver todos os detalhes e efeitos completos.
                  </p>
                </div>

                {deckData.rawDeckBuilderCode && (
                  <div className="flex flex-col sm:items-end gap-1">
                    <button
                      onClick={handleCopyDeckCode}
                      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs transition-all shadow-md ${
                        copiedCode
                          ? 'bg-emerald-600 text-white border border-emerald-400 shadow-emerald-950/50'
                          : 'bg-purple-600/80 hover:bg-purple-600 text-white border border-purple-500/50 hover:scale-[1.02] active:scale-[0.98]'
                      }`}
                      title="Copiar código do deck para o Criador de Deck"
                    >
                      {copiedCode ? (
                        <>
                          <Check size={16} className="text-white" />
                          <span>Código do Deck Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          <span>Copiar Código do Deck</span>
                        </>
                      )}
                    </button>
                    <span className="text-[10px] text-slate-400 hidden sm:block">
                      Compatível com a aba Carregar Deck
                    </span>
                  </div>
                )}
              </div>

              {/* Main Deck */}
              {deckData.mainDeck.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      Deck Principal ({deckData.totalMainCount} cartas)
                    </h5>
                  </div>
                  {renderCardGrid(deckData.mainDeck)}
                </div>
              )}

              {/* Side Deck */}
              {deckData.sideDeck.length > 0 && (
                <div className="border-t border-slate-800/80 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      Side Deck ({deckData.totalSideCount} cartas)
                    </h5>
                  </div>
                  {renderCardGrid(deckData.sideDeck)}
                </div>
              )}

              {/* Unrecognized codes notice if any */}
              {deckData.missingCodes.length > 0 && (
                <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-3 text-xs text-amber-300 flex items-start gap-2">
                  <Info size={16} className="shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <span className="font-bold">Alguns códigos não foram encontrados no banco atual: </span>
                    <span className="font-mono text-amber-200">{deckData.missingCodes.join(', ')}</span>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
