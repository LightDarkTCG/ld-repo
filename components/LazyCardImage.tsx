import React, { useState, useEffect, useRef } from 'react';
import { Sword, Shield, Scale, Sparkles, Layers } from 'lucide-react';
import { CardType } from '../types';

// Global cache to remember images loaded in this session
const loadedImagesCache = new Set<string>();

interface LazyCardImageProps {
  src: string;
  alt: string;
  type?: CardType;
  priority?: boolean;
  className?: string;
  containerClassName?: string;
}

export const LazyCardImage: React.FC<LazyCardImageProps> = ({
  src,
  alt,
  type,
  priority = false,
  className = "w-full h-full object-cover block select-none pointer-events-none",
  containerClassName = "w-full h-full relative overflow-hidden"
}) => {
  const isAlreadyLoaded = loadedImagesCache.has(src);
  const [isInView, setIsInView] = useState<boolean>(priority || isAlreadyLoaded);
  const [isLoaded, setIsLoaded] = useState<boolean>(isAlreadyLoaded);
  const [hasError, setHasError] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If priority or already loaded, no need for observer
    if (priority || isAlreadyLoaded || isInView) return;

    const target = containerRef.current;
    if (!target) return;

    // IntersectionObserver with 250px margin: starts loading slightly before entering viewport
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '250px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [priority, isAlreadyLoaded, isInView]);

  const handleLoad = () => {
    loadedImagesCache.add(src);
    setIsLoaded(true);
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
    <div ref={containerRef} className={containerClassName}>
      {/* Lightweight skeleton placeholder when not loaded or not in view */}
      {(!isLoaded || hasError) && (
        <div className={`absolute inset-0 bg-gradient-to-b ${skeleton.bg} border ${skeleton.border} flex flex-col items-center justify-center p-3 animate-pulse`}>
          <div className="scale-110 mb-2 opacity-60">
            {skeleton.icon}
          </div>
          <div className="w-16 h-2 bg-white/10 rounded-full mb-1.5"></div>
          <div className="w-10 h-1.5 bg-white/5 rounded-full"></div>
        </div>
      )}

      {/* Only attach src when entering viewport (or priority/cached) */}
      {isInView && !hasError && (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          {...(priority ? { fetchPriority: "high" as any } : { fetchPriority: "low" as any })}
          className={`${className} transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
};
