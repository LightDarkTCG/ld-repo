import React from 'react';
import { Sword, Shield, Scale, Sparkles, Hash, Hexagon } from 'lucide-react';
import { CardData, CardType } from '../types';
import { LazyCardImage } from './LazyCardImage';

interface CardProps extends CardData {
  priority?: boolean;
}

const getCardStyle = (type: CardType) => {
  switch (type) {
    case 'Herói': // Vermelho
      return {
        border: 'border-red-600',
        bg: 'bg-red-950/40',
        icon: 'text-red-500',
        glow: 'shadow-[0_0_30px_rgba(220,38,38,0.3)]',
        badge: 'bg-red-900 text-red-100'
      };
    case 'Combatente': // Azul
      return {
        border: 'border-blue-600',
        bg: 'bg-blue-950/40',
        icon: 'text-blue-500',
        glow: 'shadow-[0_0_30px_rgba(37,99,235,0.3)]',
        badge: 'bg-blue-900 text-blue-100'
      };
    case 'Equipamento': // Verde
      return {
        border: 'border-green-600',
        bg: 'bg-green-950/40',
        icon: 'text-green-500',
        glow: 'shadow-[0_0_30px_rgba(22,163,74,0.3)]',
        badge: 'bg-green-900 text-green-100'
      };
    case 'Efeito': // Roxo/Rosa
      return {
        border: 'border-purple-600',
        bg: 'bg-purple-950/40',
        icon: 'text-purple-500',
        glow: 'shadow-[0_0_30px_rgba(147,51,234,0.3)]',
        badge: 'bg-purple-900 text-purple-100'
      };
    case 'Token': // Amarelo
      return {
        border: 'border-yellow-500',
        bg: 'bg-yellow-950/40',
        icon: 'text-yellow-400',
        glow: 'shadow-[0_0_30px_rgba(234,179,8,0.35)]',
        badge: 'bg-yellow-900 text-yellow-100'
      };
    default:
      return { border: 'border-slate-600', bg: 'bg-slate-900', icon: 'text-slate-400', glow: '', badge: 'bg-slate-800' };
  }
};

export const Card: React.FC<CardProps> = React.memo(({ name, type, archetype, ct, attack, defense, description, imageGradient, imageUrl, code, priority, tier }) => {
  const styles = getCardStyle(type);

  // MODO CARTA COMPLETA COM IMAGEM
  if (imageUrl) {
    return (
      <div 
        className={`group relative w-full max-w-[18rem] aspect-[704/987] rounded-xl overflow-hidden shadow-2xl border border-white/10 transition-all duration-500 hover:scale-105 cursor-pointer perspective-1000 transform-gpu ${styles.glow}`}
        style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
      >
        <LazyCardImage 
          src={imageUrl} 
          alt={name} 
          type={type}
          priority={priority}
          className="w-full h-full object-cover block select-none pointer-events-none"
        />
        {tier && (
          <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-amber-500/60 text-[10px] font-black text-amber-300 shadow-lg tracking-wider">
            TIER {tier}
          </div>
        )}
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition duration-300 pointer-events-none"></div>
      </div>
    );
  }

  // MODO GERADOR (Placeholder visual se não houver imagem)
  return (
    <div className={`group relative w-full max-w-[18rem] h-auto aspect-[704/987] transition-all duration-500 hover:scale-105 cursor-pointer perspective-1000 ${styles.glow}`}>
      <div className={`relative h-full w-full bg-slate-900 border-2 ${styles.border} rounded-xl p-3 flex flex-col shadow-2xl overflow-hidden`}>
        <div className="w-full flex justify-between items-start mb-2">
          <div className="flex flex-col max-w-[80%]">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-100 text-md uppercase tracking-wider truncate" title={name}>{name}</span>
              {tier && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black">
                  T{tier}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-mono truncate">{type} • {archetype}</span>
          </div>
          <div className="flex items-center justify-center w-8 h-8 rounded-full border border-slate-600 bg-slate-800 font-bold text-yellow-400 font-mono text-lg shrink-0" title="Custo/Categoria (CT)">
            {ct}
          </div>
        </div>
        <div className={`w-full h-44 ${imageGradient || (type === 'Token' ? 'bg-gradient-to-br from-yellow-900/50 via-amber-950/70 to-slate-950' : 'bg-slate-800')} rounded border ${type === 'Token' ? 'border-yellow-500/40' : 'border-slate-700'} mb-3 relative overflow-hidden group-hover:brightness-110 transition flex items-center justify-center`}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div className={`relative z-10 flex flex-col items-center justify-center gap-1.5 ${type === 'Token' ? 'text-yellow-400/70' : 'opacity-20 text-white'}`}>
            {type === 'Herói' && <Sword size={64} />}
            {type === 'Combatente' && <Shield size={64} />}
            {type === 'Equipamento' && <Scale size={64} />}
            {type === 'Efeito' && <Sparkles size={64} />}
            {type === 'Token' && (
              <>
                <Hexagon size={56} className="text-yellow-400 drop-shadow-[0_0_12px_rgba(234,179,8,0.5)]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-yellow-300/90 bg-yellow-950/80 border border-yellow-500/40 px-2.5 py-0.5 rounded-full">
                  Placeholder • Token
                </span>
              </>
            )}
          </div>
        </div>
        <div className={`w-full flex-grow ${styles.bg} rounded p-2 mb-2 border ${type === 'Token' ? 'border-yellow-500/20' : 'border-white/5'} overflow-hidden`}>
          <p className="text-slate-300 text-[10px] leading-relaxed font-sans line-clamp-[8]">
            {description}
          </p>
        </div>
        <div className="mt-auto border-t border-slate-700 pt-2 flex justify-between items-center">
             {(type === 'Herói' || type === 'Combatente') ? (
              <div className="flex gap-4 font-mono font-bold text-xl">
                <div className="flex items-center text-red-400 gap-1" title="Ataque">
                  <Sword size={16} /> <span>{attack}</span>
                </div>
                <div className="flex items-center text-blue-400 gap-1" title="Defesa/Vida">
                  <Shield size={16} /> <span>{defense}</span>
                </div>
              </div>
            ) : (
              <div className={`text-xs uppercase tracking-widest font-bold text-center w-full ${type === 'Token' ? 'text-yellow-400' : 'text-slate-500'}`}>
                Carta de {type}
              </div>
            )}
            {(type === 'Herói' || type === 'Combatente') && (
              <div className="text-[10px] font-mono text-slate-600 flex items-center gap-1">
                  <Hash size={10}/> {(code || "???").split('/').pop()}
              </div>
            )}
        </div>
      </div>
    </div>
  );
});