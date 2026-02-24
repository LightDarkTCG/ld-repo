import React from 'react';
import { Plus, Minus } from 'lucide-react';

interface LifeCounterProps {
  imageUrl: string;
  value: number;
  onChange: (value: number) => void;
  title: string;
  borderColor: string;
  textColor?: string;
}

const LifeCounter: React.FC<LifeCounterProps> = ({ imageUrl, value, onChange, title, borderColor, textColor = "text-white" }) => {
  return (
    <div className={`relative flex flex-col items-center justify-center bg-black/40 backdrop-blur-md rounded-xl border-2 ${borderColor} overflow-hidden h-20 md:h-32 w-full transition-all duration-300 shadow-xl`}>
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img src={imageUrl} alt={title} className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/80"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between py-1">
        
        {/* Main Row: Minus - Number - Plus */}
        <div className="flex items-center justify-between px-2 flex-1">
          <button 
            onClick={() => onChange(value - 1)}
            className="bg-black/50 hover:bg-black/70 text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition active:scale-95 shadow-md border border-white/10"
          >
            <Minus size={16} strokeWidth={3} />
          </button>

          <span className={`text-4xl md:text-6xl font-black ${textColor} drop-shadow-[0_0_15px_rgba(0,0,0,0.8)] font-mono tracking-tighter`}>
            {value}
          </span>

          <button 
            onClick={() => onChange(value + 1)}
            className="bg-black/50 hover:bg-black/70 text-white w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition active:scale-95 shadow-md border border-white/10"
          >
            <Plus size={16} strokeWidth={3} />
          </button>
        </div>

        {/* Title */}
        <div className="text-center pb-1">
          <span className="text-[10px] md:text-sm font-bold text-white uppercase tracking-widest drop-shadow-md">{title}</span>
        </div>
      </div>
    </div>
  );
};

export default LifeCounter;
