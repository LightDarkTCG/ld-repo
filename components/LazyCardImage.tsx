import React, { useState, useEffect, useRef } from 'react';
import { Sword, Shield, Scale, Sparkles, Layers } from 'lucide-react';
import { CardType } from '../types';

// Global cache to remember images loaded in this session across all components
export const loadedImagesCache = new Set<string>();

// Predictive image preloader
export const preloadCardImage = (url?: string) => {
  if (!url || loadedImagesCache.has(url)) return;
  const img = new Image();
  img.referrerPolicy = 'no-referrer';
  img.src = url;
  img.onload = () => {
    loadedImagesCache.add(url);
  };
};

interface LazyCardImageProps {
  src: string;
  alt: string;
  type?: CardType;
  priority?: boolean;
  className?: string;
  containerClassName?: string;
}

export const LazyCardImage: React.FC<LazyCardImageProps> = React.memo(({
  src,
  alt,
  type,
  priority = false,
  className = "w-full h-full object-cover block select-none pointer-events-none",
  containerClassName = "w-full h-full relative overflow-hidden"
}) => {
  const isAlreadyLoaded = loadedImagesCache.has(src);
  const [isLoaded, setIsLoaded] = useState<boolean>(isAlreadyLoaded);
  const [hasError, setHasError] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Sync state when src prop changes
  useEffect(() => {
    if (loadedImagesCache.has(src)) {
      setIsLoaded(true);
      setHasError(false);
    } else {
      setIsLoaded(false);
      setHasError(false);
      // Immediately check if browser has this image already decoded in memory/cache
      if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
        loadedImagesCache.add(src);
        setIsLoaded(true);
      }
    }
  }, [src]);

  const handleLoad = () => {
    loadedImagesCache.add(src);
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  // Color accents for the placeholder skeleton based on card type
  const getSkeletonTheme = () => {
    switch (type) {
      case 'Herói':
        return { bg: 'from-red-950/60 to-slate-950', border: 'border-red-900/40', icon: <Sword size={32} className="text-red-500/40" /> };
      case 'Combatente':
        return { bg: 'from-blue-950/60 to-slate-950', border: 'border-blue-900/40', icon: <Shield size={32} className="text-blue-500/40" /> };
      case 'Equipamento':
        return { bg: 'from-green-950/60 to-slate-950', border: 'border-green-900/40', icon: <Scale size={32} className="text-green-500/40" /> };
      case 'Efeito':
        return { bg: 'from-purple-950/60 to-slate-950', border: 'border-purple-900/40', icon: <Sparkles size={32} className="text-purple-500/40" /> };
      default:
        return { bg: 'from-slate-900 to-slate-950', border: 'border-slate-800', icon: <Layers size={32} className="text-slate-600/40" /> };
    }
  };

  const skeleton = getSkeletonTheme();

  return (
    <div className={containerClassName}>
      {/* Lightweight skeleton placeholder when not loaded or on error */}
      {(!isLoaded || hasError) && (
        <div className={`absolute inset-0 bg-gradient-to-b ${skeleton.bg} border ${skeleton.border} flex flex-col items-center justify-center p-3 z-0 ${!isLoaded ? 'animate-pulse' : ''}`}>
          <div className="scale-110 mb-2 opacity-60">
            {skeleton.icon}
          </div>
          <div className="w-16 h-2 bg-white/10 rounded-full mb-1.5"></div>
          <div className="w-10 h-1.5 bg-white/5 rounded-full"></div>
        </div>
      )}

      {/* Native browser image rendering with native lazy loading and no-referrer */}
      {!hasError && src && (
        <img
          ref={(el) => {
            imgRef.current = el;
            if (el && el.complete && el.naturalWidth > 0 && !isLoaded) {
              loadedImagesCache.add(src);
              setIsLoaded(true);
            }
          }}
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onLoad={handleLoad}
          onError={handleError}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          {...(priority ? { fetchPriority: "high" as any } : { fetchPriority: "auto" as any })}
          className={`${className} relative z-10 transition-opacity duration-150 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
});
