import React, { useState, useEffect, useMemo } from 'react';
import { X, ShoppingCart, Play, Image as ImageIcon, ChevronLeft, ChevronRight, Layers, Sword, Shield, Sparkles, ExternalLink, Copy, Check, Info, Calendar, Dices } from 'lucide-react';
import { ExclusiveProduct, ProductMediaItem, CardData, ProductPriceVariation } from '../types';
import { parseDeckFromCode, ParsedDeckData, DeckCardEntry } from '../deckUtils';
import { MulliganSimulatorModal } from './MulliganSimulatorModal';

interface ProductDetailModalProps {
  product: ExclusiveProduct | null;
  onClose: () => void;
  allCards: CardData[];
  onSelectCard?: (card: CardData) => void;
  initialVariationIndex?: number;
  onAddToCart?: (product: ExclusiveProduct, variationIndex: number) => void;
  onBuyNow?: (product: ExclusiveProduct, variationIndex: number) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  allCards,
  onSelectCard,
  initialVariationIndex,
  onAddToCart,
  onBuyNow
}) => {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [addedToCartFeedback, setAddedToCartFeedback] = useState(false);
  const [showMulliganSimulator, setShowMulliganSimulator] = useState(false);

  // Extract all media items
  const mediaList: ProductMediaItem[] = useMemo(() => {
    if (!product) return [{ type: 'image', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe' }];
    if (product.mediaList && Array.isArray(product.mediaList) && product.mediaList.length > 0) {
      const valid = product.mediaList.filter(m => m && m.url && m.url.trim() !== '');
      if (valid.length > 0) return valid;
    }
    if (product.mediaUrl && product.mediaUrl.trim() !== '') {
      return [{ type: product.mediaType || 'image', url: product.mediaUrl }];
    }
    return [{ type: 'image', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe' }];
  }, [product]);

  // Parse card codes from Deck Builder code or code list
  const deckData: ParsedDeckData = useMemo(() => {
    if (!product) return { cards: [], mainCount: 0, sideCount: 0, heroCount: 0 };
    return parseDeckFromCode(product.cardCodes, allCards);
  }, [product?.cardCodes, allCards]);

  // Suporte a variações de preço (ex: Versão Normal vs Versão Full Foil)
  const priceVariations: ProductPriceVariation[] = useMemo(() => {
    if (!product?.priceVariations || !Array.isArray(product.priceVariations)) return [];
    return product.priceVariations.filter(v => v && v.name && v.name.trim() !== '');
  }, [product?.priceVariations]);

  const hasVariations = priceVariations.length > 0;

  // Estado da variação selecionada (inicia com initialVariationIndex, isDefault ou índice 0)
  const [selectedVariationIndex, setSelectedVariationIndex] = useState<number>(() => {
    if (typeof initialVariationIndex === 'number' && initialVariationIndex >= 0) {
      return initialVariationIndex;
    }
    if (!product?.priceVariations || product.priceVariations.length === 0) return 0;
    const defIdx = product.priceVariations.findIndex(v => v.isDefault);
    return defIdx >= 0 ? defIdx : 0;
  });

  // Sincroniza se o produto ou initialVariationIndex mudar
  useEffect(() => {
    if (typeof initialVariationIndex === 'number' && initialVariationIndex >= 0 && initialVariationIndex < priceVariations.length) {
      setSelectedVariationIndex(initialVariationIndex);
      return;
    }
    if (priceVariations.length > 0) {
      const defIdx = priceVariations.findIndex(v => v.isDefault);
      setSelectedVariationIndex(defIdx >= 0 ? defIdx : 0);
    } else {
      setSelectedVariationIndex(0);
    }
    setActiveMediaIndex(0);
  }, [product, initialVariationIndex, priceVariations.length]);

  if (!product) return null;

  const currentMedia = mediaList[activeMediaIndex] || mediaList[0];

  const handleCopyDeckCode = () => {
    if (!deckData.rawDeckBuilderCode) return;
    navigator.clipboard.writeText(deckData.rawDeckBuilderCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const activeVariationIndex = (selectedVariationIndex >= 0 && selectedVariationIndex < priceVariations.length)
    ? selectedVariationIndex
    : 0;

  const selectedVariation: ProductPriceVariation | null = hasVariations
    ? priceVariations[activeVariationIndex]
    : null;

  const isButtonEnabled = product.isButtonActive !== false && product.isActive !== false;
  const currentPrice = selectedVariation ? selectedVariation.price : (product.price || '');
  const currentLink = (selectedVariation?.buttonLink && selectedVariation.buttonLink.trim() !== '')
    ? selectedVariation.buttonLink
    : product.buttonLink;
  const hasLink = Boolean(currentLink && currentLink.trim() !== '');

  const buttonText = selectedVariation?.buttonText || product.buttonText || (
    hasLink 
      ? (hasVariations ? `Comprar ${selectedVariation?.name}` : 'Comprar Agora')
      : 'Consultar Pré-Venda'
  );

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
                  <img 
                    src={card.imageUrl} 
                    alt={card.name || ""} 
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                  />
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

              {/* Buy Action & Variations */}
              <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-4">
                
                {/* Seletor de Variações de Preço (ex: Versão Normal vs Versão Full Foil) */}
                {hasVariations && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                        <Sparkles size={14} className="text-amber-400" />
                        <span>Escolha o Acabamento / Versão:</span>
                      </label>
                      <span className="text-[11px] text-slate-400 font-medium font-mono">
                        {priceVariations.length} opções
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {priceVariations.map((variation, idx) => {
                        const isSelected = activeVariationIndex === idx;
                        const isFoil = (variation.name || '').toLowerCase().includes('foil') || 
                                       (variation.badge || '').toLowerCase().includes('foil');

                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedVariationIndex(idx)}
                            className={`p-3.5 rounded-xl border-2 transition-all duration-200 cursor-pointer relative flex flex-col justify-between gap-2 text-left ${
                              isSelected
                                ? 'bg-gradient-to-br from-purple-950/90 via-slate-900 to-indigo-950/90 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.35)] ring-1 ring-purple-400'
                                : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected ? 'border-purple-400 bg-purple-600' : 'border-slate-600 bg-slate-950'
                                }`}>
                                  {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                </div>
                                <span className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                                  {variation.name}
                                </span>
                              </div>

                              {/* Badge da Variação */}
                              {(variation.badge || isFoil) && (
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 border shadow-sm ${
                                  isFoil
                                    ? 'bg-gradient-to-r from-amber-500/25 to-yellow-500/25 text-yellow-300 border-yellow-500/50'
                                    : 'bg-purple-950 text-purple-300 border-purple-700/60'
                                }`}>
                                  {isFoil && <Sparkles size={10} className="text-yellow-400" />}
                                  <span>{variation.badge || 'Full Foil'}</span>
                                </span>
                              )}
                            </div>

                            {variation.description && (
                              <p className="text-[11px] text-slate-400 leading-tight pl-6">
                                {variation.description}
                              </p>
                            )}

                            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 pl-6 mt-0.5">
                              <span className="text-[10px] text-slate-400 font-medium">Preço desta versão:</span>
                              <span className={`font-black font-mono text-base ${isSelected ? 'text-emerald-400 font-bold' : 'text-slate-300'}`}>
                                {variation.price.startsWith('R$') ? variation.price : `R$ ${variation.price}`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Exibição do Preço Selecionado */}
                {currentPrice && currentPrice.trim() !== '' && (
                  <div className="flex items-center justify-between bg-slate-900/90 border border-emerald-500/40 px-4 py-3 rounded-xl shadow-inner">
                    <div>
                      <span className="text-xs text-slate-300 font-bold uppercase tracking-wider block">
                        {hasVariations ? `Valor da Versão (${selectedVariation?.name}):` : 'Valor do Produto:'}
                      </span>
                      {hasVariations && selectedVariation?.badge && (
                        <span className="text-[10px] text-amber-300 font-mono flex items-center gap-1 mt-0.5">
                          <Sparkles size={10} /> {selectedVariation.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-2xl font-black text-emerald-400 font-mono">
                      {currentPrice.startsWith('R$') ? currentPrice : `R$ ${currentPrice}`}
                    </span>
                  </div>
                )}

                {/* Aviso de Pré-Venda / Lançamento */}
                {(product.isPreOrder || product.preOrderReleaseDate || (!hasLink && product.noLinkMessage)) && (
                  <div className="p-3.5 rounded-xl bg-purple-950/60 border border-purple-800/60 flex items-center gap-3 text-left">
                    <Calendar size={22} className="text-amber-400 shrink-0" />
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-purple-300">
                        {product.isPreOrder ? 'Lote Oficial de Pré-Venda' : 'Previsão de Envio / Lançamento'}
                      </div>
                      <div className="text-sm font-black text-amber-400">
                        {product.preOrderReleaseDate || product.noLinkMessage || 'Reserva Garantida · Envio via Correios c/ Rastreio'}
                      </div>
                    </div>
                  </div>
                )}

                {isButtonEnabled ? (
                  onBuyNow && product.allowInternalCheckout !== false ? (
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      {onAddToCart && (
                        <button
                          type="button"
                          onClick={() => {
                            onAddToCart(product, activeVariationIndex);
                            setAddedToCartFeedback(true);
                            setTimeout(() => setAddedToCartFeedback(false), 1800);
                          }}
                          className={`py-3.5 px-4 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 border cursor-pointer ${
                            addedToCartFeedback
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                          }`}
                        >
                          {addedToCartFeedback ? (
                            <>
                              <Check size={16} />
                              <span>No Carrinho!</span>
                            </>
                          ) : (
                            <>
                              <ShoppingCart size={16} />
                              <span>Por no Carrinho</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onBuyNow(product, activeVariationIndex)}
                        className="flex-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2.5 shadow-lg shadow-purple-900/50 hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base cursor-pointer"
                      >
                        <ShoppingCart size={20} />
                        <span>
                          {hasVariations
                            ? `Comprar ${selectedVariation?.name} (PIX / Cartão)`
                            : buttonText}
                        </span>
                      </button>
                    </div>
                  ) : hasLink ? (
                    <a 
                      href={currentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2.5 shadow-lg shadow-purple-900/50 hover:scale-[1.02] active:scale-[0.98] text-base"
                    >
                      <ShoppingCart size={20} />
                      <span>{buttonText}</span>
                      <ExternalLink size={16} className="opacity-70 ml-1" />
                    </a>
                  ) : (
                    <button 
                      type="button"
                      onClick={() => setShowNotice(true)}
                      className="w-full bg-gradient-to-r from-amber-600 via-purple-600 to-indigo-600 hover:from-amber-500 hover:via-purple-500 hover:to-indigo-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2.5 shadow-lg shadow-purple-900/50 hover:scale-[1.02] active:scale-[0.98] text-base cursor-pointer"
                    >
                      <Calendar size={20} className="text-amber-300" />
                      <span>{buttonText}</span>
                    </button>
                  )
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

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMulliganSimulator(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs bg-emerald-600/90 hover:bg-emerald-500 text-white border border-emerald-400/50 transition-all shadow-md cursor-pointer"
                    title="Simular Mão Inicial de 5 cartas e Mulligan deste Deck"
                  >
                    <Dices size={16} />
                    <span>Simular Mão Inicial (5 Cartas)</span>
                  </button>

                  {deckData.rawDeckBuilderCode && (
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
                  )}
                </div>
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

      {/* On-screen Notice Modal when there's no link */}
      {showNotice && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowNotice(false)}
        >
          <div 
            className="bg-slate-900 border-2 border-purple-500/70 rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-[0_0_50px_rgba(168,85,247,0.5)] text-center relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-purple-500 to-indigo-500"></div>
            
            <button 
              onClick={() => setShowNotice(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-700 transition"
            >
              <X size={18} />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-purple-950/80 border border-purple-500/40 text-purple-300 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-950">
              <Calendar size={32} className="text-amber-400 animate-pulse" />
            </div>

            <div className="inline-block bg-purple-950/90 text-purple-300 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-purple-700/50 mb-2">
              Aviso de Lançamento
            </div>

            <h4 className="text-xl sm:text-2xl font-black text-white mb-2">
              {product.title || 'Produto Oficial'}
            </h4>

            {hasVariations && selectedVariation && (
              <div className="mb-2 px-3 py-1.5 rounded-lg bg-purple-950/70 border border-purple-700/60 inline-flex items-center gap-2 text-xs font-mono text-purple-200">
                <span>Versão: <strong className="text-white">{selectedVariation.name}</strong></span>
                <span className="text-emerald-400 font-bold">
                  ({selectedVariation.price.startsWith('R$') ? selectedVariation.price : `R$ ${selectedVariation.price}`})
                </span>
              </div>
            )}

            <div className="my-5 p-4 rounded-xl bg-slate-950 border border-purple-500/40 shadow-inner">
              <p className="text-lg sm:text-xl font-black text-amber-400 tracking-wide uppercase">
                {product.noLinkMessage || 'PRÉ VENDA ABRE EM 15/10'}
              </p>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">
              Este item ainda não possui link de compra direta. Fique atento às nossas novidades para não perder a data de abertura!
            </p>

            <button
              onClick={() => setShowNotice(false)}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold transition shadow-lg shadow-purple-900/40"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Mulligan Hand Simulator Modal */}
      {showMulliganSimulator && deckData.isValid && (
        <MulliganSimulatorModal
          isOpen={showMulliganSimulator}
          onClose={() => setShowMulliganSimulator(false)}
          deck={deckData.mainDeck.flatMap(entry =>
            entry.card ? Array(entry.qty).fill(entry.card) : []
          )}
          sideDeck={deckData.sideDeck.flatMap(entry =>
            entry.card ? Array(entry.qty).fill(entry.card) : []
          )}
          deckTitle={product.title}
          onInspectCard={onSelectCard}
        />
      )}
    </div>
  );
};
