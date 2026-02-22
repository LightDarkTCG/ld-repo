import React from 'react';
import { Plus, Minus } from 'lucide-react';

interface SmallCounterProps {
  imageUrl: string;
  value: number;
  onChange: (value: number) => void;
  title: string;
  borderColor: string;
  textColor?: string;
}

const SmallCounter: React.FC<SmallCounterProps> = ({ imageUrl, value, onChange, title, borderColor, textColor = "text-white" }) => {
  return (
    <div className={`relative flex flex-col items-center justify-center bg-[#1e293b] rounded-lg border ${borderColor} overflow-hidden h-14 md:h-24 w-full transition-all duration-300 shadow-md`}>
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img src={imageUrl} alt={title} className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1e293b]/50 to-[#1e293b]/90"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between py-0.5">
        
        {/* Main Row: Minus - Number - Plus */}
        <div className="flex items-center justify-between px-1 flex-1">
          <button 
            onClick={() => onChange(value - 1)}
            className="bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center transition active:scale-95 shadow-sm"
          >
            <Minus size={12} strokeWidth={3} />
          </button>

          <span className={`text-2xl md:text-4xl font-black ${textColor} drop-shadow-xl font-mono tracking-tighter`}>
            {value}
          </span>

          <button 
            onClick={() => onChange(value + 1)}
            className="bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center transition active:scale-95 shadow-sm"
          >
            <Plus size={12} strokeWidth={3} />
          </button>
        </div>

        {/* Title */}
        <div className="text-center pb-0.5">
          <span className="text-[8px] md:text-[10px] font-bold text-slate-300 uppercase tracking-widest drop-shadow-md">{title}</span>
        </div>
      </div>
    </div>
  );
};

export default SmallCounter;
