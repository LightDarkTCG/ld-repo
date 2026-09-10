import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, ShoppingCart, Sparkles, Layers, Image as ImageIcon, Play, Eye } from 'lucide-react';
import { ExclusiveProduct, CardData, ProductMediaItem } from '../types';
import { parseDeckFromCode } from '../deckUtils';

interface NovidadesSectionProps {
  products: ExclusiveProduct[];
  onOpenProductModal: (product: ExclusiveProduct) => void;
  allCards: CardData[];
}

export const NovidadesSection: React.FC<NovidadesSectionProps> = ({
  products,
  onOpenProductModal,
  allCards
}) => {
  const activeProducts = useMemo(() => {
    return products.filter(p => p && p.isActive !== false);
  }, [products]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // If active products change and currentIndex is out of bounds
  useEffect(() => {
    if (currentIndex >= activeProducts.length && activeProducts.length > 0) {
      setCurrentIndex(0);
    }
  }, [activeProducts.length, currentIndex]);

  // Auto slide every 10 seconds if 2 or more products
  useEffect(() => {
    if (activeProducts.length <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeProducts.length);
    }, 10000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeProducts.length, isPaused, currentIndex]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + activeProducts.length) % activeProducts.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % activeProducts.length);
  };

  if (activeProducts.length === 0) {
    return null;
  }

  // Helpers to get media and card counts
  const getProductMedias = (prod: ExclusiveProduct): ProductMediaItem[] => {
    if (prod.mediaList && Array.isArray(prod.mediaList) && prod.mediaList.length > 0) {
      const valid = prod.mediaList.filter(m => m && m.url && m.url.trim() !== '');
      if (valid.length > 0) return valid;
    }
    if (prod.mediaUrl && prod.mediaUrl.trim() !== '') {
      return [{ type: prod.mediaType || 'image', url: prod.mediaUrl }];
    }
    return [{ type: 'image', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe' }];
  };

  const getDeckCount = (prod: ExclusiveProduct) => {
    if (!prod.cardCodes || !prod.cardCodes.trim()) return 0;
    try {
      const parsed = parseDeckFromCode(prod.cardCodes, allCards);
      if (parsed.isValid) return parsed.totalCount;
    } catch {
      // Fallback
    }
    const entries = prod.cardCodes.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    let total = 0;
    for (const e of entries) {
      const match = e.match(/^(\d+)\s*[xX]?\s+/);
      total += match ? parseInt(match[1], 10) : 1;
    }
    return total;
  };

  // --- RENDER 1 PRODUCT: CENTRADO E DE FORA A FORA ---
  if (activeProducts.length === 1) {
    const product = activeProducts[0];
    const medias = getProductMedias(product);
    const mainMedia = medias[0];
    const deckCount = getDeckCount(product);
    const isButtonEnabled = product.isButtonActive !== false && product.isActive !== false;
    const buttonLink = product.buttonLink || 'https://mpago.la/1FZ3Mip';
    const buttonText = product.buttonText || 'Comprar Agora';

    return (
      <section id="novidades" className="pt-24 pb-20 bg-[#0c0c10] relative z-20 overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-wider uppercase">
              NOVIDADES
            </h2>
            <div className="w-16 h-1 bg-purple-600 mx-auto mt-3 rounded-full"></div>
          </div>

          <div className="max-w-5xl mx-auto w-full">
            <div 
              onClick={() => onOpenProductModal(product)}
              className="bg-slate-900/95 border border-slate-800 hover:border-purple-500/60 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 cursor-pointer group flex flex-col md:flex-row"
            >
              {/* Left Column: Media */}
              <div className="relative md:w-1/2 aspect-video md:aspect-auto md:min-h-[380px] bg-black overflow-hidden flex items-center justify-center shrink-0">
                {mainMedia.type === 'video' ? (
                  <video 
                    src={mainMedia.url} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                ) : (
                  <img 
                    src={mainMedia.url} 
                    alt={product.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-slate-950 via-transparent to-transparent opacity-80 pointer-events-none"></div>

                <div className="absolute top-4 left-4 flex flex-wrap gap-2 pointer-events-none">
                  <span className="bg-purple-600/90 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-purple-400/40 shadow-lg">
                    {product.badge || 'Exclusivo'}
                  </span>
                  {medias.length > 1 && (
                    <span className="bg-black/75 backdrop-blur-sm text-purple-200 text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1">
                      <ImageIcon size={12} /> +{medias.length - 1} mídias
                    </span>
                  )}
                </div>

                <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10 text-xs text-purple-300 font-bold flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition">
                  <Eye size={14} />
                  <span>Clique para ver fotos e detalhes</span>
                </div>
              </div>

              {/* Right Column: Info & Action */}
              <div className="p-6 md:p-8 flex flex-col justify-between flex-1 gap-6">
                <div>
                  <div className="flex items-center gap-2 text-purple-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
                    <Sparkles size={14} />
                    <span>Destaque Oficial</span>
                  </div>
                  
                  <h3 className="text-2xl md:text-3xl font-black text-white group-hover:text-purple-300 transition-colors leading-tight mb-3">
                    {product.title || 'Produto Exclusivo'}
                  </h3>

                  <p className="text-slate-300 text-sm md:text-base leading-relaxed line-clamp-4 mb-4">
                    {product.description}
                  </p>

                  {deckCount > 0 && (
                    <div className="inline-flex items-center gap-2 bg-purple-950/70 border border-purple-800/60 px-3 py-1.5 rounded-lg text-purple-300 text-xs font-bold font-mono">
                      <Layers size={14} />
                      <span>DECK PRÉ-MONTADO COM {deckCount} CARTAS</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-800">
                  <button
                    onClick={() => onOpenProductModal(product)}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-bold transition flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <Eye size={16} />
                    <span>Ver Detalhes</span>
                  </button>

                  {isButtonEnabled && (
                    <a 
                      href={buttonLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="w-full sm:flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 hover:scale-[1.02] active:scale-[0.98] text-sm md:text-base"
                    >
                      <ShoppingCart size={18} />
                      <span>{buttonText}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gradient transition divider at bottom */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10">
          <div className="h-28 bg-gradient-to-b from-transparent via-[#0a0a0c]/70 to-[#0a0a0c]"></div>
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"></div>
        </div>
      </section>
    );
  }

  // --- RENDER 2+ PRODUCTS: CAROUSEL WITH 10S AUTO-SLIDE & SIDE BUTTONS ---
  const currentProduct = activeProducts[currentIndex] || activeProducts[0];
  const medias = getProductMedias(currentProduct);
  const mainMedia = medias[0];
  const deckCount = getDeckCount(currentProduct);
  const isButtonEnabled = currentProduct.isButtonActive !== false && currentProduct.isActive !== false;
  const buttonLink = currentProduct.buttonLink || 'https://mpago.la/1FZ3Mip';
  const buttonText = currentProduct.buttonText || 'Comprar Agora';

  return (
    <section id="novidades" className="pt-24 pb-20 bg-[#0c0c10] relative z-20 overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-wider uppercase">
            NOVIDADES
          </h2>
          <div className="w-16 h-1 bg-purple-600 mx-auto mt-3 rounded-full"></div>
        </div>

        <div 
          className="max-w-5xl mx-auto w-full relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Side Navigation Button: Previous */}
          <button
            onClick={handlePrev}
            className="absolute -left-3 sm:-left-5 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-3 rounded-full bg-slate-900/90 border border-purple-600/50 text-white hover:bg-purple-600 hover:text-white transition shadow-[0_0_20px_rgba(168,85,247,0.3)] backdrop-blur-md"
            title="Produto Anterior"
          >
            <ChevronLeft size={22} />
          </button>

          {/* Side Navigation Button: Next */}
          <button
            onClick={handleNext}
            className="absolute -right-3 sm:-right-5 top-1/2 -translate-y-1/2 z-30 p-2.5 sm:p-3 rounded-full bg-slate-900/90 border border-purple-600/50 text-white hover:bg-purple-600 hover:text-white transition shadow-[0_0_20px_rgba(168,85,247,0.3)] backdrop-blur-md"
            title="Próximo Produto"
          >
            <ChevronRight size={22} />
          </button>

          {/* Current Product Card */}
          <div 
            onClick={() => onOpenProductModal(currentProduct)}
            className="bg-slate-900/95 border border-slate-800 hover:border-purple-500/60 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 cursor-pointer group flex flex-col md:flex-row"
          >
            {/* Left Media */}
            <div className="relative md:w-1/2 aspect-video md:aspect-auto md:min-h-[380px] bg-black overflow-hidden flex items-center justify-center shrink-0">
              {mainMedia.type === 'video' ? (
                <video 
                  key={mainMedia.url}
                  src={mainMedia.url} 
                  autoPlay 
                  loop 
                  muted 
                  playsInline 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              ) : (
                <img 
                  key={mainMedia.url}
                  src={mainMedia.url} 
                  alt={currentProduct.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-slate-950 via-transparent to-transparent opacity-80 pointer-events-none"></div>

              <div className="absolute top-4 left-4 flex flex-wrap gap-2 pointer-events-none">
                <span className="bg-purple-600/90 text-white text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-purple-400/40 shadow-lg">
                  {currentProduct.badge || 'Exclusivo'}
                </span>
                {medias.length > 1 && (
                  <span className="bg-black/75 backdrop-blur-sm text-purple-200 text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1">
                    <ImageIcon size={12} /> +{medias.length - 1} mídias
                  </span>
                )}
              </div>

              <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10 text-xs text-purple-300 font-bold flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition">
                <Eye size={14} />
                <span>Clique para ver fotos e detalhes</span>
              </div>
            </div>

            {/* Right Info */}
            <div className="p-6 md:p-8 flex flex-col justify-between flex-1 gap-6">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-purple-400 text-xs font-mono font-bold uppercase tracking-wider">
                    <Sparkles size={14} />
                    <span>Destaque {currentIndex + 1} de {activeProducts.length}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                    Muda a cada 10s
                  </span>
                </div>
                
                <h3 className="text-2xl md:text-3xl font-black text-white group-hover:text-purple-300 transition-colors leading-tight mb-3">
                  {currentProduct.title || 'Produto Exclusivo'}
                </h3>

                <p className="text-slate-300 text-sm md:text-base leading-relaxed line-clamp-4 mb-4">
                  {currentProduct.description}
                </p>

                {deckCount > 0 && (
                  <div className="inline-flex items-center gap-2 bg-purple-950/70 border border-purple-800/60 px-3 py-1.5 rounded-lg text-purple-300 text-xs font-bold font-mono">
                    <Layers size={14} />
                    <span>DECK PRÉ-MONTADO COM {deckCount} CARTAS</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => onOpenProductModal(currentProduct)}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-bold transition flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Eye size={16} />
                  <span>Ver Detalhes</span>
                </button>

                {isButtonEnabled && (
                  <a 
                    href={buttonLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-full sm:flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 hover:scale-[1.02] active:scale-[0.98] text-sm md:text-base"
                  >
                    <ShoppingCart size={18} />
                    <span>{buttonText}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Dots / Indicators */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {activeProducts.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentIndex === idx 
                    ? 'w-8 bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' 
                    : 'w-2.5 bg-slate-700 hover:bg-slate-500'
                }`}
                title={`Ir para o produto ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Gradient transition divider at bottom */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10">
        <div className="h-28 bg-gradient-to-b from-transparent via-[#0a0a0c]/70 to-[#0a0a0c]"></div>
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"></div>
      </div>
    </section>
  );
};
