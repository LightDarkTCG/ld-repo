import React, { useState, useEffect } from 'react';
import LifeCounter from './game/LifeCounter';
import SmallCounter from './game/SmallCounter';
import { X, Plus, Minus, Menu, RotateCcw, Image as ImageIcon, LogOut, Check, History } from 'lucide-react';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

interface GameBoardProps {
  onClose: () => void;
}

export default function GameBoard({ onClose }: GameBoardProps) {
  const [themes, setThemes] = useState([
    { id: 'default', name: 'Padrão', url: null }
  ]);

  // Default Imgur themes disabled to test Firebase Storage
  // const defaultImgurThemes = [
  //   { id: 'theme1', name: 'Tema 1', url: 'https://i.imgur.com/MEEgqLT.mp4' },
  //   { id: 'theme2', name: 'Tema 2', url: 'https://i.imgur.com/NiXDYQ6.mp4' },
  //   { id: 'theme3', name: 'Tema 3', url: 'https://i.imgur.com/uyLhRyw.mp4' },
  //   { id: 'theme4', name: 'Tema 4', url: 'https://i.imgur.com/IxbaBFg.mp4' },
  //   { id: 'theme5', name: 'Tema 5', url: 'https://i.imgur.com/sRRvrf0.mp4' },
  //   { id: 'theme6', name: 'Tema 6', url: 'https://i.imgur.com/3haDaoN.mp4' },
  //   { id: 'theme7', name: 'Tema 7', url: 'https://i.imgur.com/N1xEGwR.mp4' },
  //   { id: 'theme8', name: 'Tema 8', url: 'https://i.imgur.com/zyPclYX.mp4' },
  //   { id: 'theme9', name: 'Tema 9', url: 'https://i.imgur.com/B44C6fM.mp4' },
  //   { id: 'theme10', name: 'Tema 10', url: 'https://i.imgur.com/9EOlPvn.mp4' },
  //   { id: 'theme11', name: 'Tema 11', url: 'https://i.imgur.com/GGYybtc.mp4' },
  //   { id: 'theme12', name: 'Tema 12', url: 'https://i.imgur.com/bemqfcI.mp4' },
  //   { id: 'theme13', name: 'Tema 13', url: 'https://i.imgur.com/cClnOWH.mp4' },
  //   { id: 'theme14', name: 'Tema 14', url: 'https://i.imgur.com/wTrMCso.mp4' },
  //   { id: 'theme15', name: 'Tema 15', url: 'https://i.imgur.com/gTf8uZY.mp4' },
  //   { id: 'theme16', name: 'Tema 16', url: 'https://i.imgur.com/YAgBkS9.mp4' },
  //   { id: 'theme17', name: 'Tema 17', url: 'https://i.imgur.com/veA5rlN.mp4' },
  //   { id: 'theme18', name: 'Tema 18', url: 'https://i.imgur.com/sh4o4pA.mp4' }
  // ];

  useEffect(() => {
    const fetchThemes = async () => {
      try {
        const listRef = ref(storage, 'duel_videos');
        const res = await listAll(listRef);
        if (res.items.length > 0) {
          const urls = await Promise.all(res.items.map(item => getDownloadURL(item)));
          const dynamicThemes = [
            { id: 'default', name: 'Padrão', url: null },
            ...urls.map((url, index) => ({
              id: `theme${index + 1}`,
              name: `Tema ${index + 1}`,
              url: url
            }))
          ];
          setThemes(dynamicThemes as any);
        }
      } catch (err: any) {
        if (err.code !== 'storage/quota-exceeded') {
          console.error("Failed to load duel themes from storage:", err);
        }
      }
    };
    fetchThemes();
  }, []);

  // Rounds counter
  const [rounds, setRounds] = useState(1);
  const [turns, setTurns] = useState(0);
  const [activePlayer, setActivePlayer] = useState(2); // 1 (Top) or 2 (Bottom)

  // Menu & Modals
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [themeTargetPlayer, setThemeTargetPlayer] = useState<1 | 2 | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [showSetup, setShowSetup] = useState(true);

  // Match settings
  const [p1Name, setP1Name] = useState('Jogador 1');
  const [p2Name, setP2Name] = useState('Jogador 2');
  const [matchFormat, setMatchFormat] = useState<1 | 3 | 5>(3);
  const [p1Wins, setP1Wins] = useState(0);
  const [p2Wins, setP2Wins] = useState(0);

  // Backgrounds
  const [p1Background, setP1Background] = useState<string | null>(null);
  const [p2Background, setP2Background] = useState<string | null>(null);

  // Player 1 (top)
  const [p1Mana, setP1Mana] = useState(12);
  const [p1Life, setP1Life] = useState(20);
  const [p1CtReduction, setP1CtReduction] = useState(0);
  const [p1DeckDamage, setP1DeckDamage] = useState(0);
  const [p1Runes, setP1Runes] = useState(0);
  const [p1Insanity, setP1Insanity] = useState(100);

  // Player 2 (bottom)
  const [p2Mana, setP2Mana] = useState(12);
  const [p2Life, setP2Life] = useState(20);
  const [p2CtReduction, setP2CtReduction] = useState(0);
  const [p2DeckDamage, setP2DeckDamage] = useState(0);
  const [p2Runes, setP2Runes] = useState(0);
  const [p2Insanity, setP2Insanity] = useState(100);

  // Action Log
  const [actionLogs, setActionLogs] = useState<{ round: number, turn: number, activePlayer: number, diffs: string[] }[]>([]);
  const [turnStartState, setTurnStartState] = useState({
    p1Mana: 12, p1Life: 20, p1CtReduction: 0, p1DeckDamage: 0, p1Runes: 0, p1Insanity: 100,
    p2Mana: 12, p2Life: 20, p2CtReduction: 0, p2DeckDamage: 0, p2Runes: 0, p2Insanity: 100,
  });

  const passTurn = () => {
    const diffs: string[] = [];
    
    if (p1Life !== turnStartState.p1Life) diffs.push(`P1 Vida: ${turnStartState.p1Life} -> ${p1Life}`);
    if (p1Mana !== turnStartState.p1Mana) diffs.push(`P1 Mana: ${turnStartState.p1Mana} -> ${p1Mana}`);
    if (p1CtReduction !== turnStartState.p1CtReduction) diffs.push(`P1 CT: ${turnStartState.p1CtReduction} -> ${p1CtReduction}`);
    if (p1DeckDamage !== turnStartState.p1DeckDamage) diffs.push(`P1 Dano Primordial: ${turnStartState.p1DeckDamage} -> ${p1DeckDamage}`);
    if (p1Runes !== turnStartState.p1Runes) diffs.push(`P1 Runas: ${turnStartState.p1Runes} -> ${p1Runes}`);
    if (p1Insanity !== turnStartState.p1Insanity) diffs.push(`P1 Insanidade: ${turnStartState.p1Insanity} -> ${p1Insanity}`);

    if (p2Life !== turnStartState.p2Life) diffs.push(`P2 Vida: ${turnStartState.p2Life} -> ${p2Life}`);
    if (p2Mana !== turnStartState.p2Mana) diffs.push(`P2 Mana: ${turnStartState.p2Mana} -> ${p2Mana}`);
    if (p2CtReduction !== turnStartState.p2CtReduction) diffs.push(`P2 CT: ${turnStartState.p2CtReduction} -> ${p2CtReduction}`);
    if (p2DeckDamage !== turnStartState.p2DeckDamage) diffs.push(`P2 Dano Primordial: ${turnStartState.p2DeckDamage} -> ${p2DeckDamage}`);
    if (p2Runes !== turnStartState.p2Runes) diffs.push(`P2 Runas: ${turnStartState.p2Runes} -> ${p2Runes}`);
    if (p2Insanity !== turnStartState.p2Insanity) diffs.push(`P2 Insanidade: ${turnStartState.p2Insanity} -> ${p2Insanity}`);

    if (diffs.length > 0) {
      setActionLogs(prev => [...prev, { round: rounds, turn: turns, activePlayer, diffs }]);
    }

    const newTurns = turns + 1;
    setTurns(newTurns);
    setActivePlayer(activePlayer === 1 ? 2 : 1);
    
    let nextP1Mana = p1Mana;
    let nextP2Mana = p2Mana;

    if (newTurns === 2) {
      setRounds(rounds + 1);
      setTurns(0);
      setP1Mana(12);
      setP2Mana(12);
      nextP1Mana = 12;
      nextP2Mana = 12;
    }

    setTurnStartState({
      p1Mana: nextP1Mana, p1Life, p1CtReduction, p1DeckDamage, p1Runes, p1Insanity,
      p2Mana: nextP2Mana, p2Life, p2CtReduction, p2DeckDamage, p2Runes, p2Insanity,
    });
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
    setP1Insanity(100);

    // Reset P2
    setP2Mana(12);
    setP2Life(20);
    setP2CtReduction(0);
    setP2DeckDamage(0);
    setP2Runes(0);
    setP2Insanity(100);

    setActionLogs([]);
    setTurnStartState({
      p1Mana: 12, p1Life: 20, p1CtReduction: 0, p1DeckDamage: 0, p1Runes: 0, p1Insanity: 100,
      p2Mana: 12, p2Life: 20, p2CtReduction: 0, p2DeckDamage: 0, p2Runes: 0, p2Insanity: 100,
    });

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
      className={`${small ? 'w-6 h-6 md:w-12 md:h-12 text-[10px]' : 'w-8 h-8 md:w-12 md:h-12 text-xs'} md:text-base rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 text-white font-bold flex items-center justify-center transition active:scale-95 border border-white/20 shadow-lg`}
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
    insanity, setInsanity,
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
        
        {/* Background Image/Video */}
        {background && (
          <div className="absolute inset-0 z-0">
            {background.includes('.mp4') || background.includes('firebasestorage') ? (
              <video 
                src={background} 
                autoPlay 
                loop 
                muted 
                playsInline 
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                onContextMenu={(e) => e.preventDefault()}
                className="w-full h-full object-cover opacity-80 pointer-events-none"
              />
            ) : (
              <img src={background} alt="Theme" className="w-full h-full object-cover opacity-80" />
            )}
            <div className="absolute inset-0 bg-black/40"></div>
          </div>
        )}

        {/* Turn Indicator */}
        <div className="flex justify-center mb-2 md:mb-8 relative z-10 shrink-0">
          <div className="flex flex-col items-center gap-1.5 md:gap-3">
            <div className="flex items-center gap-2 md:gap-4">
              {/* Turn Indicator placed to the left */}
              <div className={`px-4 py-1 md:px-6 md:py-2 rounded-lg font-bold uppercase tracking-widest text-[8px] sm:text-[10px] md:text-base shadow-lg transition-colors duration-300 backdrop-blur-md border border-white/20 ${isActive ? 'bg-yellow-500/90 text-black shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 'bg-black/60 text-white'}`}>
                {isActive ? 'Turno de Ação' : 'Turno de Reação'}
              </div>

              {/* Player Name Tag */}
              <button 
                onClick={() => {
                  if (playerNum === 1) {
                    setP1Wins((prev) => (prev + 1) % (Math.ceil(matchFormat / 2) + 1));
                  } else {
                    setP2Wins((prev) => (prev + 1) % (Math.ceil(matchFormat / 2) + 1));
                  }
                }}
                className="bg-black/60 border border-white/20 text-white font-bold text-[10px] md:text-sm px-4 py-1 md:py-2 rounded-full drop-shadow-md hover:bg-white/10 transition flex items-center gap-2"
                title="Clique para adicionar vitória"
              >
                <span className="opacity-70 text-purple-400">P{playerNum}</span> | {playerNum === 1 ? p1Name : p2Name}
              </button>
            </div>
            
            {/* Win Indicators */}
            {matchFormat > 1 && (
              <div className="flex gap-2.5 mt-1">
                {Array.from({ length: Math.ceil(matchFormat / 2) }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-3 h-3 md:w-5 md:h-5 rounded-full border-2 border-white/30 transition-all ${
                      (playerNum === 1 ? p1Wins : p2Wins) > i 
                      ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] border-blue-400' 
                      : 'bg-black/40'
                    }`}
                  />
                ))}
              </div>
            )}
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
                title="Dano Primordial"
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

            {/* Insanidade */}
            <div className="flex items-center gap-1 md:gap-4">
              <SmallCounter 
                imageUrl=""
                value={insanity} 
                onChange={setInsanity}
                title="Insanidade"
                borderColor="border-purple-600"
                textColor="text-purple-300"
              />
              <div className="flex flex-col gap-0.5 md:gap-2">
                <QuickButton value={5} onClick={() => setInsanity(insanity + 5)} small />
                <QuickButton value={-5} onClick={() => setInsanity(insanity - 5)} small />
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
      
      {/* Starting Setup Modal */}
      {showSetup && (
        <div className="absolute inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#1e293b] w-full max-w-lg rounded-3xl border-2 border-purple-500/50 shadow-[0_0_40px_rgba(168,85,247,0.3)] p-8">
            <h2 className="text-3xl font-black text-white mb-6 text-center tracking-tighter flex items-center justify-center gap-3">
              <LogOut className="rotate-180 text-purple-400" />
              NOVO DUELO
            </h2>
            
            <div className="space-y-6">
              {/* Nomes dos Jogadores */}
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-sm font-bold mb-2 uppercase tracking-widest">Jogador 1 (Topo)</label>
                  <input 
                    type="text" 
                    value={p1Name}
                    onChange={(e) => setP1Name(e.target.value)}
                    className="w-full bg-slate-900 border-2 border-slate-700 focus:border-purple-500 rounded-xl px-4 py-3 text-white font-bold outline-none transition"
                    placeholder="Nome do Jogador 1"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm font-bold mb-2 uppercase tracking-widest">Jogador 2 (Baixo)</label>
                  <input 
                    type="text" 
                    value={p2Name}
                    onChange={(e) => setP2Name(e.target.value)}
                    className="w-full bg-slate-900 border-2 border-slate-700 focus:border-blue-500 rounded-xl px-4 py-3 text-white font-bold outline-none transition"
                    placeholder="Nome do Jogador 2"
                  />
                </div>
              </div>

              {/* Formato da Partida */}
              <div>
                <label className="block text-slate-400 text-sm font-bold mb-3 uppercase tracking-widest text-center">Formato da Partida</label>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 3, 5].map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setMatchFormat(fmt as 1 | 3 | 5)}
                      className={`py-3 rounded-xl font-black text-lg transition-all border-2 ${
                        matchFormat === fmt 
                        ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.6)] scale-105' 
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      MD{fmt}
                    </button>
                  ))}
                </div>
                <p className="text-center text-xs text-slate-500 mt-3 font-semibold">
                  {matchFormat === 1 && "Vitória Simples - 1 Jogo"}
                  {matchFormat === 3 && "Melhor de 3 - Vence quem ganhar 2"}
                  {matchFormat === 5 && "Melhor de 5 - Vence quem ganhar 3"}
                </p>
              </div>

              {/* Iniciar Button */}
              <button 
                onClick={() => setShowSetup(false)}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black py-4 rounded-xl shadow-lg border border-white/20 transition-all hover:scale-[1.02] active:scale-95 text-lg"
              >
                COMEÇAR DUELO
              </button>
            </div>
          </div>
        </div>
      )}

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
                {themes.map(theme => (
                  <button 
                    key={theme.id}
                    onClick={() => handleThemeSelect(theme.url)}
                    className="relative aspect-video rounded-lg overflow-hidden border-2 border-slate-700 hover:border-white transition group"
                  >
                    {theme.url ? (
                      theme.url.includes('.mp4') || theme.url.includes('firebasestorage') ? (
                        <video 
                          src={theme.url} 
                          autoPlay 
                          loop 
                          muted 
                          playsInline 
                          controlsList="nodownload noplaybackrate"
                          disablePictureInPicture
                          onContextMenu={(e) => e.preventDefault()}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      ) : (
                        <img src={theme.url} alt={theme.name} className="w-full h-full object-cover" />
                      )
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

      {/* Log Modal */}
      {isLogOpen && (
        <div className="absolute inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-[#1e293b] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><History size={20} /> Log de Ações</h3>
              <button onClick={() => setIsLogOpen(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {actionLogs.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Nenhuma ação registrada ainda.</p>
              ) : (
                actionLogs.map((log, idx) => (
                  <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rodada {log.round}</span>
                      <span className="text-xs font-bold text-blue-400">Jogador {log.activePlayer}</span>
                    </div>
                    <ul className="space-y-1">
                      {log.diffs.map((diff, i) => (
                        <li key={i} className="text-sm text-slate-300 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                          {diff}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
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
        insanity={p1Insanity} setInsanity={setP1Insanity}
        rotated={true}
        isActive={activePlayer === 1}
        background={p1Background}
        playerNum={1}
      />

      {/* Center Bar */}
      <div className="h-10 md:h-20 bg-black/60 backdrop-blur-md border-y border-white/20 flex items-center justify-between px-2 md:px-12 relative z-50 shrink-0 shadow-2xl">
        
        {/* Menu Button */}
        <button 
          onClick={() => setIsMenuOpen(true)}
          className="bg-black/50 hover:bg-black/70 border border-white/20 text-white p-2 rounded-lg transition"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="border border-white/20 bg-black/40 rounded px-2 py-1 md:px-4 md:py-2">
            <span className="text-white font-bold text-sm md:text-xl uppercase tracking-widest drop-shadow-md">Rodada: {rounds}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => setIsLogOpen(true)}
            className="bg-slate-700/80 hover:bg-slate-600/90 border border-slate-500/50 text-white p-1 md:px-4 md:py-3 rounded font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(100,116,139,0.5)] transition active:scale-95 text-xs md:text-lg flex items-center justify-center"
            title="Log de Ações"
          >
            <History size={18} className="md:mr-2" />
            <span className="hidden md:inline">Log</span>
          </button>
          <button
            onClick={passTurn}
            className="bg-blue-600/80 hover:bg-blue-500/90 border border-blue-400/50 text-white px-4 py-1 md:px-10 md:py-3 rounded font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(37,99,235,0.5)] transition active:scale-95 text-xs md:text-lg"
          >
            Passar Turno
          </button>
        </div>
      </div>

      {/* Player 2 (Bottom) */}
      <PlayerBoard
        mana={p2Mana} setMana={setP2Mana}
        life={p2Life} setLife={setP2Life}
        ctReduction={p2CtReduction} setCtReduction={setP2CtReduction}
        deckDamage={p2DeckDamage} setDeckDamage={setP2DeckDamage}
        runes={p2Runes} setRunes={setP2Runes}
        insanity={p2Insanity} setInsanity={setP2Insanity}
        rotated={false}
        isActive={activePlayer === 2}
        background={p2Background}
        playerNum={2}
      />

    </div>
  );
}
