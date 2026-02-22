import React, { useState } from 'react';
import LifeCounter from './game/LifeCounter';
import SmallCounter from './game/SmallCounter';
import { X, Plus, Minus, Menu, RotateCcw, Image as ImageIcon, LogOut, Check } from 'lucide-react';

interface GameBoardProps {
  onClose: () => void;
}

const THEMES = [
  { id: 'default', name: 'Padrão', url: null },
  { id: 'fire', name: 'Fogo', url: 'https://images.unsplash.com/photo-1542259681-d4cd7a93f130?q=80&w=1000&auto=format&fit=crop' },
  { id: 'water', name: 'Água', url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?q=80&w=1000&auto=format&fit=crop' },
  { id: 'forest', name: 'Floresta', url: 'https://images.unsplash.com/photo-1448375240586-dfd8f3793300?q=80&w=1000&auto=format&fit=crop' },
  { id: 'dark', name: 'Trevas', url: 'https://images.unsplash.com/photo-1516617442634-75371039cb3a?q=80&w=1000&auto=format&fit=crop' },
];

export default function GameBoard({ onClose }: GameBoardProps) {
  // Rounds counter
  const [rounds, setRounds] = useState(1);
  const [turns, setTurns] = useState(0);
  const [activePlayer, setActivePlayer] = useState(2); // 1 (Top) or 2 (Bottom)

  // Menu & Modals
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [themeTargetPlayer, setThemeTargetPlayer] = useState<1 | 2 | null>(null);

  // Backgrounds
  const [p1Background, setP1Background] = useState<string | null>(null);
  const [p2Background, setP2Background] = useState<string | null>(null);

  // Player 1 (top)
  const [p1Mana, setP1Mana] = useState(12);
  const [p1Life, setP1Life] = useState(20);
  const [p1CtReduction, setP1CtReduction] = useState(0);
  const [p1DeckDamage, setP1DeckDamage] = useState(0);
  const [p1Runes, setP1Runes] = useState(0);

  // Player 2 (bottom)
  const [p2Mana, setP2Mana] = useState(12);
  const [p2Life, setP2Life] = useState(20);
  const [p2CtReduction, setP2CtReduction] = useState(0);
  const [p2DeckDamage, setP2DeckDamage] = useState(0);
  const [p2Runes, setP2Runes] = useState(0);

  const passTurn = () => {
    const newTurns = turns + 1;
    setTurns(newTurns);
    setActivePlayer(activePlayer === 1 ? 2 : 1);
    if (newTurns === 2) {
      setRounds(rounds + 1);
      setTurns(0);
      setP1Mana(12);
      setP2Mana(12);
    }
  };

  const handleReset = (startingPlayer: 1 | 2) => {
    setRounds(1);
    setTurns(0);
    setActivePlayer(startingPlayer);
    
    // Reset P1
    setP1Mana(12);
    setP1Life(20);
    setP1CtReduction(0);
    setP1DeckDamage(0);
    setP1Runes(0);

    // Reset P2
    setP2Mana(12);
    setP2Life(20);
    setP2CtReduction(0);
    setP2DeckDamage(0);
    setP2Runes(0);

    setShowResetModal(false);
    setIsMenuOpen(false);
  };

  const handleThemeSelect = (url: string | null) => {
    if (themeTargetPlayer === 1) setP1Background(url);
    if (themeTargetPlayer === 2) setP2Background(url);
    setShowThemeModal(false);
    setThemeTargetPlayer(null);
  };

  const QuickButton = ({ value, onClick, small = false }: { value: number, onClick: () => void, small?: boolean }) => (
    <button 
      onClick={onClick}
      className={`${small ? 'w-6 h-6 md:w-12 md:h-12 text-[10px]' : 'w-8 h-8 md:w-12 md:h-12 text-xs'} md:text-base rounded-full bg-slate-400/20 hover:bg-slate-400/40 text-slate-300 hover:text-white font-bold flex items-center justify-center transition active:scale-95 border border-slate-500/30`}
    >
      {value > 0 ? `+${value}` : value}
    </button>
  );

  const PlayerBoard = ({ 
    mana, setMana, 
    life, setLife, 
    ctReduction, setCtReduction, 
    deckDamage, setDeckDamage, 
    runes, setRunes,
    rotated = false,
    isActive = false,
    background = null,
    playerNum
  }: any) => {
    
    // Conditional Border Logic
    const getCtBorderColor = (val: number) => {
      if (val > 0) return 'border-green-500';
      if (val < 0) return 'border-pink-500';
      return 'border-slate-600';
    };

    const getDeckDamageBorderColor = (val: number) => {
      if (val >= 1) return 'border-red-600';
      return 'border-slate-600';
    };

    return (
      <div className={`flex-1 flex flex-col p-2 md:p-8 relative ${rotated ? 'rotate-180' : ''} min-h-0`}>
        
        {/* Background Image */}
        {background && (
          <div className="absolute inset-0 z-0">
            <img src={background} alt="Theme" className="w-full h-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a]/80 to-[#0f172a]/90"></div>
          </div>
        )}

        {/* Turn Indicator */}
        <div className="flex justify-center mb-2 md:mb-8 relative z-10 shrink-0">
          <div className={`px-4 py-1 md:px-6 md:py-2 rounded-lg font-bold uppercase tracking-widest text-[10px] md:text-base shadow-lg transition-colors duration-300 ${isActive ? 'bg-yellow-500 text-black' : 'bg-white text-black'}`}>
            {isActive ? 'Turno de Ação' : 'Turno de Reação'}
          </div>
        </div>

        <div className="flex-1 flex gap-2 md:gap-8 items-center justify-center max-w-6xl mx-auto w-full relative z-10 min-h-0">
          
          {/* Left Column: Large Counters (Mana & Life) */}
          <div className="flex-1 flex flex-col gap-2 md:gap-6 justify-center">
            
            {/* Mana Row */}
            <div className="flex items-center gap-1 md:gap-4">
              <div className="flex flex-col gap-1 md:gap-2">
                <QuickButton value={5} onClick={() => setMana(mana + 5)} />
                <QuickButton value={-5} onClick={() => setMana(mana - 5)} />
              </div>
              <LifeCounter 
                imageUrl="https://i.imgur.com/SGuVcOD.png"
                value={mana} 
                onChange={setMana}
                title="Mana"
                borderColor="border-purple-500"
              />
            </div>

            {/* Life Row */}
            <div className="flex items-center gap-1 md:gap-4">
              <div className="flex flex-col gap-1 md:gap-2">
                <QuickButton value={5} onClick={() => setLife(life + 5)} />
                <QuickButton value={-5} onClick={() => setLife(life - 5)} />
              </div>
              <LifeCounter 
                imageUrl="https://i.imgur.com/Qo0TYjF.png"
                value={life} 
                onChange={setLife}
                title="Vida"
                borderColor="border-red-600"
              />
            </div>
          </div>

          {/* Right Column: Small Counters */}
          <div className="w-[35%] md:w-80 flex flex-col gap-1.5 md:gap-4 justify-center">
            
            {/* Redução CT */}
            <div className="flex items-center gap-1 md:gap-4">
              <SmallCounter 
                imageUrl="https://i.imgur.com/niLnaQ1.png"
                value={ctReduction} 
                onChange={setCtReduction}
                title="Redução de CT"
                borderColor={getCtBorderColor(ctReduction)}
              />
              <div className="flex flex-col gap-0.5 md:gap-2">
                <QuickButton value={5} onClick={() => setCtReduction(ctReduction + 5)} small />
                <QuickButton value={-5} onClick={() => setCtReduction(ctReduction - 5)} small />
              </div>
            </div>

            {/* Dano Deck */}
            <div className="flex items-center gap-1 md:gap-4">
              <SmallCounter 
                imageUrl="https://i.imgur.com/ewap7GN.png"
                value={deckDamage} 
                onChange={setDeckDamage}
                title="Dano no Deck"
                borderColor={getDeckDamageBorderColor(deckDamage)}
              />
              <div className="flex flex-col gap-0.5 md:gap-2">
                <QuickButton value={5} onClick={() => setDeckDamage(deckDamage + 5)} small />
                <QuickButton value={-5} onClick={() => setDeckDamage(deckDamage - 5)} small />
              </div>
            </div>

            {/* Runas */}
            <div className="flex items-center gap-1 md:gap-4">
              <SmallCounter 
                imageUrl="https://i.imgur.com/KdjsUyS.png"
                value={runes} 
                onChange={setRunes}
                title="Runas"
                borderColor="border-blue-500"
              />
              <div className="flex flex-col gap-0.5 md:gap-2">
                <QuickButton value={5} onClick={() => setRunes(runes + 5)} small />
                <QuickButton value={-5} onClick={() => setRunes(runes - 5)} small />
              </div>
            </div>

          </div>
        </div>
        
        {/* Theme Button (Visible only when menu is open or maybe just always visible in corner?) 
            Actually, let's put it in the main menu for simplicity as requested.
        */}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] h-screen w-full bg-[#0f172a] flex flex-col overflow-hidden font-sans">
      
      {/* Menu Button Removed - Moved to Center Bar */}

      {/* Menu Overlay */}
      {isMenuOpen && (
        <div className="absolute inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-start justify-start p-4 md:p-8 animate-in fade-in duration-200" onClick={() => setIsMenuOpen(false)}>
          <div className="bg-[#1e293b] w-full max-w-xs rounded-2xl border border-slate-700 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-white font-bold text-lg">Menu do Jogo</h2>
              <button onClick={() => setIsMenuOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="flex flex-col p-2">
              <button 
                onClick={() => { setShowResetModal(true); setIsMenuOpen(false); }}
                className="flex items-center gap-3 text-slate-200 hover:bg-slate-700/50 p-3 rounded-xl transition text-left"
              >
                <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400"><RotateCcw size={20} /></div>
                <div>
                  <div className="font-bold">Iniciar Novo Duelo</div>
                  <div className="text-xs text-slate-400">Reseta vida, mana e rodadas</div>
                </div>
              </button>

              <button 
                onClick={() => { setShowThemeModal(true); setIsMenuOpen(false); }}
                className="flex items-center gap-3 text-slate-200 hover:bg-slate-700/50 p-3 rounded-xl transition text-left"
              >
                <div className="bg-purple-500/20 p-2 rounded-lg text-purple-400"><ImageIcon size={20} /></div>
                <div>
                  <div className="font-bold">Mudar Tema</div>
                  <div className="text-xs text-slate-400">Personalize o fundo do jogo</div>
                </div>
              </button>

              <div className="h-px bg-slate-700 my-2"></div>

              <button 
                onClick={onClose}
                className="flex items-center gap-3 text-red-400 hover:bg-red-500/10 p-3 rounded-xl transition text-left"
              >
                <div className="bg-red-500/20 p-2 rounded-lg"><LogOut size={20} /></div>
                <div>
                  <div className="font-bold">Fechar App de Duelo</div>
                  <div className="text-xs text-red-400/70">Voltar para o site</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Modal */}
      {showResetModal && (
        <div className="absolute inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-2 text-center">Quem começa jogando?</h3>
            <p className="text-slate-400 text-center mb-6 text-sm">O jogador selecionado iniciará com o Turno de Ação.</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button 
                onClick={() => handleReset(1)}
                className="bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-purple-500 p-4 rounded-xl flex flex-col items-center gap-2 transition group"
              >
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition">1</div>
                <span className="font-bold text-slate-200">Jogador 1 (Topo)</span>
              </button>
              
              <button 
                onClick={() => handleReset(2)}
                className="bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-blue-500 p-4 rounded-xl flex flex-col items-center gap-2 transition group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">2</div>
                <span className="font-bold text-slate-200">Jogador 2 (Baixo)</span>
              </button>
            </div>

            <button 
              onClick={() => setShowResetModal(false)}
              className="w-full py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Theme Modal */}
      {showThemeModal && (
        <div className="absolute inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-[#1e293b] w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Escolha um Tema</h3>
              <button onClick={() => { setShowThemeModal(false); setThemeTargetPlayer(null); }} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>

            {!themeTargetPlayer ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => setThemeTargetPlayer(1)}
                  className="bg-slate-800 p-6 rounded-xl border-2 border-slate-700 hover:border-purple-500 transition text-center group"
                >
                  <span className="block text-lg font-bold text-white mb-2">Jogador 1 (Topo)</span>
                  <span className="text-sm text-slate-400 group-hover:text-purple-400">Alterar fundo</span>
                </button>
                <button 
                  onClick={() => setThemeTargetPlayer(2)}
                  className="bg-slate-800 p-6 rounded-xl border-2 border-slate-700 hover:border-blue-500 transition text-center group"
                >
                  <span className="block text-lg font-bold text-white mb-2">Jogador 2 (Baixo)</span>
                  <span className="text-sm text-slate-400 group-hover:text-blue-400">Alterar fundo</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {THEMES.map(theme => (
                  <button 
                    key={theme.id}
                    onClick={() => handleThemeSelect(theme.url)}
                    className="relative aspect-video rounded-lg overflow-hidden border-2 border-slate-700 hover:border-white transition group"
                  >
                    {theme.url ? (
                      <img src={theme.url} alt={theme.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500 font-bold">Padrão</div>
                    )}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <span className="font-bold text-white">{theme.name}</span>
                    </div>
                    {((themeTargetPlayer === 1 && p1Background === theme.url) || (themeTargetPlayer === 2 && p2Background === theme.url)) && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full shadow-lg">
                        <Check size={12} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Player 1 (Top - Rotated) */}
      <PlayerBoard
        mana={p1Mana} setMana={setP1Mana}
        life={p1Life} setLife={setP1Life}
        ctReduction={p1CtReduction} setCtReduction={setP1CtReduction}
        deckDamage={p1DeckDamage} setDeckDamage={setP1DeckDamage}
        runes={p1Runes} setRunes={setP1Runes}
        rotated={true}
        isActive={activePlayer === 1}
        background={p1Background}
        playerNum={1}
      />

      {/* Center Bar */}
      <div className="h-10 md:h-20 bg-[#1e293b] border-y border-slate-700 flex items-center justify-between px-2 md:px-12 relative z-50 shrink-0 shadow-2xl">
        
        {/* Menu Button */}
        <button 
          onClick={() => setIsMenuOpen(true)}
          className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg transition"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="border border-slate-500 rounded px-2 py-1 md:px-4 md:py-2">
            <span className="text-white font-bold text-sm md:text-xl uppercase tracking-widest">Rodada: {rounds}</span>
          </div>
        </div>

        <button
          onClick={passTurn}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1 md:px-10 md:py-3 rounded font-bold uppercase tracking-widest shadow-lg transition active:scale-95 text-xs md:text-lg"
        >
          Passar Turno
        </button>
      </div>

      {/* Player 2 (Bottom) */}
      <PlayerBoard
        mana={p2Mana} setMana={setP2Mana}
        life={p2Life} setLife={setP2Life}
        ctReduction={p2CtReduction} setCtReduction={setP2CtReduction}
        deckDamage={p2DeckDamage} setDeckDamage={setP2DeckDamage}
        runes={p2Runes} setRunes={setP2Runes}
        rotated={false}
        isActive={activePlayer === 2}
        background={p2Background}
        playerNum={2}
      />

    </div>
  );
}
