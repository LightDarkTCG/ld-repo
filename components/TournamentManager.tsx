import React, { useState, useEffect } from 'react';
import { Crown, X, Users, Settings, Trophy, Plus, Trash2, Shuffle, AlignLeft, Edit2, PlayCircle, CheckCircle2, ChevronRight, ChevronLeft, Award } from 'lucide-react';

interface Participant {
  id: string;
  seed: number;
  name: string;
  points: number;
  wins: number;
  losses: number;
  ties: number;
  matchesPlayed: number;
}

interface Match {
  id: string;
  round: number;
  player1: Participant | null;
  player2: Participant | null;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  status: 'pending' | 'active' | 'completed';
  nextMatchId?: string;
  isBye?: boolean;
}

export const TournamentManager = ({ onClose }: { onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState<'config' | 'participants' | 'bracket'>('config');
  
  // Config State
  const [name, setName] = useState('');
  const [format, setFormat] = useState('single_elimination');
  
  // Swiss Options
  const [swissPtsWin, setSwissPtsWin] = useState('1.0');
  const [swissPtsTie, setSwissPtsTie] = useState('0.5');
  const [swissPtsBye, setSwissPtsBye] = useState('1.0');
  const [swissRounds, setSwissRounds] = useState('3');
  const [swissPhase, setSwissPhase] = useState<'swiss' | 'top4' | 'top2'>('swiss');

  // Participants State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [bulkAddText, setBulkAddText] = useState('');
  const [isBulkAdd, setIsBulkAdd] = useState(false);

  // Bracket State
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(1);
  const [tournamentStarted, setTournamentStarted] = useState(false);

  const handleAddParticipant = () => {
    if (!newParticipantName.trim()) return;
    const newP: Participant = {
      id: Math.random().toString(36).substr(2, 9),
      seed: participants.length + 1,
      name: newParticipantName.trim(),
      points: 0, wins: 0, losses: 0, ties: 0, matchesPlayed: 0
    };
    setParticipants([...participants, newP]);
    setNewParticipantName('');
  };

  const handleBulkAdd = () => {
    if (!bulkAddText.trim()) return;
    const names = bulkAddText.split('\n').filter(n => n.trim() !== '');
    const newPs = names.map((n, i) => ({
      id: Math.random().toString(36).substr(2, 9),
      seed: participants.length + i + 1,
      name: n.trim(),
      points: 0, wins: 0, losses: 0, ties: 0, matchesPlayed: 0
    }));
    setParticipants([...participants, ...newPs]);
    setBulkAddText('');
    setIsBulkAdd(false);
  };

  const handleRemoveParticipant = (id: string) => {
    const updated = participants.filter(p => p.id !== id).map((p, i) => ({ ...p, seed: i + 1 }));
    setParticipants(updated);
  };

  const handleShuffleSeeds = () => {
    const shuffled = [...participants].sort(() => Math.random() - 0.5).map((p, i) => ({ ...p, seed: i + 1 }));
    setParticipants(shuffled);
  };

  // --- GENERATORS ---

  const generateSingleElimination = () => {
    const shuffled = [...participants].sort((a, b) => a.seed - b.seed);
    const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
    const byesCount = nextPowerOf2 - shuffled.length;
    
    const padded: (Participant | null)[] = [...shuffled];
    for(let i=0; i<byesCount; i++) padded.push(null);

    let currentRoundMatches: Match[] = [];
    let allMatches: Match[] = [];
    let matchCounter = 1;

    // Round 1
    for (let i = 0; i < padded.length; i += 2) {
      const p1 = padded[i];
      const p2 = padded[i + 1];
      const isBye = p1 === null || p2 === null;
      const winnerId = isBye ? (p1 ? p1.id : (p2 ? p2.id : null)) : null;

      const match: Match = {
        id: `m_${matchCounter++}`,
        round: 1,
        player1: p1,
        player2: p2,
        score1: null,
        score2: null,
        winnerId,
        status: isBye ? 'completed' : 'pending',
        isBye
      };
      currentRoundMatches.push(match);
      allMatches.push(match);
    }

    let roundNum = 2;
    let previousRoundMatches = [...currentRoundMatches];

    while (previousRoundMatches.length > 1) {
      let nextRoundMatches: Match[] = [];
      for (let i = 0; i < previousRoundMatches.length; i += 2) {
        const m1 = previousRoundMatches[i];
        const m2 = previousRoundMatches[i + 1];
        
        const match: Match = {
          id: `m_${matchCounter++}`,
          round: roundNum,
          player1: m1.winnerId ? participants.find(p => p.id === m1.winnerId) || null : null,
          player2: m2.winnerId ? participants.find(p => p.id === m2.winnerId) || null : null,
          score1: null,
          score2: null,
          winnerId: null,
          status: 'pending'
        };
        
        m1.nextMatchId = match.id;
        m2.nextMatchId = match.id;
        
        nextRoundMatches.push(match);
        allMatches.push(match);
      }
      previousRoundMatches = nextRoundMatches;
      roundNum++;
    }

    setTotalRounds(roundNum - 1);
    setMatches(allMatches);
  };

  const generateRoundRobin = () => {
    let ps = [...participants];
    if (ps.length % 2 !== 0) {
      ps.push({ id: 'bye', name: 'BYE', seed: 0, points: 0, wins: 0, losses: 0, ties: 0, matchesPlayed: 0 });
    }
    
    const numRounds = ps.length - 1;
    const half = ps.length / 2;
    let allMatches: Match[] = [];
    let matchCounter = 1;

    let currentPs = [...ps];

    for (let round = 1; round <= numRounds; round++) {
      for (let i = 0; i < half; i++) {
        const p1 = currentPs[i];
        const p2 = currentPs[currentPs.length - 1 - i];
        
        if (p1.id !== 'bye' && p2.id !== 'bye') {
          allMatches.push({
            id: `m_${matchCounter++}`,
            round,
            player1: p1,
            player2: p2,
            score1: null,
            score2: null,
            winnerId: null,
            status: 'pending'
          });
        }
      }
      // Rotate
      currentPs = [currentPs[0], currentPs[currentPs.length - 1], ...currentPs.slice(1, currentPs.length - 1)];
    }

    setTotalRounds(numRounds);
    setMatches(allMatches);
  };

  const generateSwissRound = (roundNum: number) => {
    // Sort by points, then random
    let ps = [...participants].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return Math.random() - 0.5;
    });

    const hasPlayed = (p1Id: string, p2Id: string) => {
      return matches.some(m => 
        (m.player1?.id === p1Id && m.player2?.id === p2Id) ||
        (m.player1?.id === p2Id && m.player2?.id === p1Id)
      );
    };

    const hasHadBye = (pId: string) => {
      return matches.some(m => m.isBye && m.player1?.id === pId);
    };

    let newMatches: Match[] = [];
    let matchCounter = matches.length + 1;
    const paired = new Set<string>();

    // 1. Assign BYE if odd. Look for lowest ranked player who hasn't had a BYE.
    if (ps.length % 2 !== 0) {
      let byePlayerIndex = -1;
      for (let i = ps.length - 1; i >= 0; i--) {
        if (!hasHadBye(ps[i].id)) {
          byePlayerIndex = i;
          break;
        }
      }
      if (byePlayerIndex === -1) byePlayerIndex = ps.length - 1;
      
      const byePlayer = ps[byePlayerIndex];
      paired.add(byePlayer.id);
      newMatches.push({
        id: `m_${matchCounter++}`,
        round: roundNum,
        player1: byePlayer,
        player2: null,
        score1: 2,
        score2: 1,
        winnerId: byePlayer.id,
        status: 'completed',
        isBye: true
      });
      // Award bye points immediately (now granting 1 win as per request)
      updateParticipantStats(byePlayer.id, parseFloat(swissPtsBye), 1, 0, 0);
    }
    
    // 2. Greedy pairing avoiding repeat matches
    for (let i = 0; i < ps.length; i++) {
        if (paired.has(ps[i].id)) continue;
        
        let p1 = ps[i];
        let p2Index = -1;
        
        // Find best opponent (closest in score) that hasn't played p1
        for (let j = i + 1; j < ps.length; j++) {
            if (paired.has(ps[j].id)) continue;
            if (!hasPlayed(p1.id, ps[j].id)) {
                p2Index = j;
                break;
            }
        }
        
        // Fallback: If no unplayed opponent is found, just pair with the next available
        if (p2Index === -1) {
            for (let j = i + 1; j < ps.length; j++) {
                if (!paired.has(ps[j].id)) {
                    p2Index = j;
                    break;
                }
            }
        }
        
        if (p2Index !== -1) {
            const p2 = ps[p2Index];
            paired.add(p1.id);
            paired.add(p2.id);
            
            newMatches.push({
              id: `m_${matchCounter++}`,
              round: roundNum,
              player1: p1,
              player2: p2,
              score1: null,
              score2: null,
              winnerId: null,
              status: 'pending'
            });
        }
    }
    
    setMatches([...matches, ...newMatches]);
    setCurrentRound(roundNum);
    setTotalRounds(parseInt(swissRounds) || 3);
  };

  const generateBracketHandler = () => {
    if (participants.length < 2) return;
    
    // Reset stats
    setParticipants(participants.map(p => ({...p, points: 0, wins: 0, losses: 0, ties: 0, matchesPlayed: 0})));
    setMatches([]);
    setCurrentRound(1);
    setTournamentStarted(true);
    setSwissPhase('swiss');

    if (format === 'single_elimination') {
      generateSingleElimination();
    } else if (format === 'round_robin') {
      generateRoundRobin();
    } else if (format === 'swiss') {
      generateSwissRound(1);
    } else if (format === 'leaderboard') {
      // Leaderboard just uses the participants list directly
      setTotalRounds(1);
    } else {
      // Fallback to single elim for unsupported formats
      generateSingleElimination();
    }
    
    setActiveTab('bracket');
  };

  // --- MATCH HANDLING ---

  const updateParticipantStats = (id: string, pts: number, w: number, l: number, t: number) => {
    setParticipants(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          points: p.points + pts,
          wins: p.wins + w,
          losses: p.losses + l,
          ties: p.ties + t,
          matchesPlayed: p.matchesPlayed + 1
        };
      }
      return p;
    }));
  };

  const handleScoreChange = (matchId: string, p1Score: string, p2Score: string) => {
    setMatches(matches.map(m => {
      if (m.id === matchId) {
        return {
          ...m,
          score1: p1Score === '' ? null : parseInt(p1Score),
          score2: p2Score === '' ? null : parseInt(p2Score)
        };
      }
      return m;
    }));
  };

  const completeMatch = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || match.status === 'completed' || !match.player1 || !match.player2) return;
    if (match.score1 === null || match.score2 === null) return;

    let winnerId: string | null = null;
    let isTie = false;

    if (match.score1 > match.score2) winnerId = match.player1.id;
    else if (match.score2 > match.score1) winnerId = match.player2.id;
    else isTie = true;

    // Update Match
    const updatedMatches = matches.map(m => {
      if (m.id === matchId) {
        return { ...m, status: 'completed' as const, winnerId };
      }
      return m;
    });

    // Propagate winner in Single Elimination or Swiss Playoffs
    if ((format === 'single_elimination' || (format === 'swiss' && swissPhase !== 'swiss')) && match.nextMatchId && winnerId) {
      const winner = winnerId === match.player1.id ? match.player1 : match.player2;
      const nextMatchIndex = updatedMatches.findIndex(m => m.id === match.nextMatchId);
      if (nextMatchIndex !== -1) {
        if (!updatedMatches[nextMatchIndex].player1) {
          updatedMatches[nextMatchIndex].player1 = winner;
        } else {
          updatedMatches[nextMatchIndex].player2 = winner;
        }
      }
    }

    setMatches(updatedMatches);

    // Update Stats for Swiss/Round Robin (only during regular phase)
    if ((format === 'swiss' && swissPhase === 'swiss') || format === 'round_robin') {
      const winPts = parseFloat(swissPtsWin);
      const tiePts = parseFloat(swissPtsTie);
      
      if (isTie) {
        updateParticipantStats(match.player1.id, tiePts, 0, 0, 1);
        updateParticipantStats(match.player2.id, tiePts, 0, 0, 1);
      } else if (winnerId === match.player1.id) {
        updateParticipantStats(match.player1.id, winPts, 1, 0, 0);
        updateParticipantStats(match.player2.id, 0, 0, 1, 0);
      } else {
        updateParticipantStats(match.player2.id, winPts, 1, 0, 0);
        updateParticipantStats(match.player1.id, 0, 0, 1, 0);
      }
    }
  };

  const advanceSwissRound = () => {
    const currentRoundMatches = matches.filter(m => m.round === currentRound);
    if (currentRoundMatches.some(m => m.status !== 'completed')) {
      alert("Complete todas as partidas da rodada atual antes de avançar.");
      return;
    }
    generateSwissRound(currentRound + 1);
  };

  const generateSwissPlayoffs = (type: 'top4' | 'top2') => {
    const currentRoundMatches = matches.filter(m => m.round === currentRound);
    if (currentRoundMatches.some(m => m.status !== 'completed')) {
      alert("Complete todas as partidas da rodada atual antes de avançar.");
      return;
    }

    const sorted = [...participants].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return Math.random() - 0.5; // Tiebreaker
    });

    const topPlayers = type === 'top4' ? sorted.slice(0, 4) : sorted.slice(0, 2);
    
    let newMatches: Match[] = [];
    let matchCounter = matches.length + 1;
    const playoffRound = currentRound + 1;

    if (type === 'top4') {
      // Semifinals
      const semi1: Match = {
        id: `m_${matchCounter++}`, round: playoffRound, player1: topPlayers[0], player2: topPlayers[3],
        score1: null, score2: null, winnerId: null, status: 'pending'
      };
      const semi2: Match = {
        id: `m_${matchCounter++}`, round: playoffRound, player1: topPlayers[1], player2: topPlayers[2],
        score1: null, score2: null, winnerId: null, status: 'pending'
      };
      
      // Final
      const final: Match = {
        id: `m_${matchCounter++}`, round: playoffRound + 1, player1: null, player2: null,
        score1: null, score2: null, winnerId: null, status: 'pending'
      };

      semi1.nextMatchId = final.id;
      semi2.nextMatchId = final.id;

      newMatches.push(semi1, semi2, final);
      setTotalRounds(playoffRound + 1);
    } else {
      // Final only
      newMatches.push({
        id: `m_${matchCounter++}`, round: playoffRound, player1: topPlayers[0], player2: topPlayers[1],
        score1: null, score2: null, winnerId: null, status: 'pending'
      });
      setTotalRounds(playoffRound);
    }

    setMatches([...matches, ...newMatches]);
    setCurrentRound(playoffRound);
    setSwissPhase(type);
  };

  // --- RENDERERS ---

  const renderMatch = (match: Match) => {
    const isCompleted = match.status === 'completed';
    
    return (
      <div key={match.id} className="bg-[#242424] rounded-lg border border-[#333] overflow-hidden shadow-md flex flex-col">
        {/* Player 1 */}
        <div className={`flex items-center p-2 border-b border-[#333] ${match.winnerId === match.player1?.id ? 'bg-[#a855f7]/20' : ''}`}>
          <span className="w-6 text-xs text-slate-500 text-center">{match.player1?.seed || '-'}</span>
          <span className={`flex-1 text-sm font-medium px-2 truncate ${match.winnerId === match.player1?.id ? 'text-[#a855f7] font-bold' : 'text-white'}`}>
            {match.player1?.name || '---'}
          </span>
          {!match.isBye && !isCompleted && match.player1 && match.player2 && (
            <input 
              type="number" 
              placeholder="0"
              value={match.score1 !== null ? match.score1 : ''}
              onChange={(e) => handleScoreChange(match.id, e.target.value, match.score2 !== null ? match.score2.toString() : '')}
              className="w-16 bg-[#1a1a1a] border border-[#444] rounded p-1 text-center text-white text-sm outline-none focus:border-[#a855f7] placeholder-slate-600"
            />
          )}
          {isCompleted && (
            <span className="w-16 text-center font-bold text-white text-lg">{match.score1 !== null ? match.score1 : (match.isBye ? '-' : '')}</span>
          )}
        </div>
        
        {/* Player 2 */}
        <div className={`flex items-center p-2 ${match.winnerId === match.player2?.id ? 'bg-[#a855f7]/20' : ''}`}>
          <span className="w-6 text-xs text-slate-500 text-center">{match.player2?.seed || '-'}</span>
          <span className={`flex-1 text-sm font-medium px-2 truncate ${match.winnerId === match.player2?.id ? 'text-[#a855f7] font-bold' : 'text-white'}`}>
            {match.player2?.name || '---'}
          </span>
          {!match.isBye && !isCompleted && match.player1 && match.player2 && (
            <input 
              type="number" 
              placeholder="0"
              value={match.score2 !== null ? match.score2 : ''}
              onChange={(e) => handleScoreChange(match.id, match.score1 !== null ? match.score1.toString() : '', e.target.value)}
              className="w-16 bg-[#1a1a1a] border border-[#444] rounded p-1 text-center text-white text-sm outline-none focus:border-[#a855f7] placeholder-slate-600"
            />
          )}
          {isCompleted && (
            <span className="w-16 text-center font-bold text-white text-lg">{match.score2 !== null ? match.score2 : ''}</span>
          )}
        </div>

        {/* Actions */}
        {!isCompleted && !match.isBye && match.player1 && match.player2 && (
          <div className="bg-[#1a1a1a] p-2 flex justify-end border-t border-[#333]">
            <button 
              onClick={() => completeMatch(match.id)}
              disabled={match.score1 === null || match.score2 === null}
              className="bg-[#9333ea] hover:bg-[#7e22ce] disabled:bg-[#444] disabled:text-slate-500 text-white px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1"
            >
              <CheckCircle2 size={14} /> Confirmar
            </button>
          </div>
        )}
        {match.isBye && (
          <div className="bg-[#1a1a1a] p-2 text-center border-t border-[#333]">
            <span className="text-xs text-slate-500 font-bold uppercase">BYE</span>
          </div>
        )}
      </div>
    );
  };

  const renderLeaderboard = () => {
    const sorted = [...participants].sort((a, b) => b.points - a.points);
    return (
      <div className="bg-[#242424] rounded-lg border border-[#333] overflow-hidden overflow-x-auto">
        <div className="min-w-[400px]">
          <div className="grid grid-cols-[40px_1fr_70px_60px_60px] md:grid-cols-[50px_1fr_80px_80px_80px] gap-2 md:gap-4 p-3 md:p-4 border-b border-[#333] bg-[#1f1f1f] text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">
            <div className="text-center">Pos</div>
            <div>Participante</div>
            <div className="text-center">V-D-E</div>
            <div className="text-center">Jogos</div>
            <div className="text-center">Pontos</div>
          </div>
          <div className="divide-y divide-[#333]">
            {sorted.map((p, idx) => (
              <div key={p.id} className="grid grid-cols-[40px_1fr_70px_60px_60px] md:grid-cols-[50px_1fr_80px_80px_80px] gap-2 md:gap-4 p-3 md:p-4 items-center hover:bg-[#2a2a2a] transition">
                <div className="text-center font-bold text-[#a855f7]">{idx + 1}º</div>
                <div className="font-medium text-white text-sm md:text-base truncate">{p.name}</div>
                <div className="text-center text-xs md:text-sm text-slate-300">{p.wins}-{p.losses}-{p.ties}</div>
                <div className="text-center text-xs md:text-sm text-slate-300">{p.matchesPlayed}</div>
                <div className="text-center font-bold text-white bg-[#1a1a1a] py-1 rounded border border-[#444]">
                  {format === 'leaderboard' ? (
                    <input 
                      type="number" 
                      value={p.points} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setParticipants(prev => prev.map(pt => pt.id === p.id ? {...pt, points: val} : pt));
                      }}
                      className="w-full bg-transparent text-center outline-none text-sm md:text-base"
                    />
                  ) : (
                    <span className="text-sm md:text-base">{p.points}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#1a1a1a] text-slate-200 font-sans animate-in fade-in duration-200 overflow-hidden">
      {/* Header */}
      <div className="bg-[#242424] border-b border-[#333] p-4 flex justify-between items-center shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <Crown className="text-[#a855f7]" />
          <h2 className="text-xl font-bold text-white">{name || 'Criar Torneio'}</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-[#333] rounded-full text-slate-400 hover:text-white transition">
          <X size={24} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#242424] border-b border-[#333] shrink-0 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('config')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 font-bold text-sm uppercase tracking-wider transition whitespace-nowrap border-b-2 ${activeTab === 'config' ? 'border-[#a855f7] text-white bg-[#1a1a1a]' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#333]'}`}
        >
          <Settings size={16} /> Configurações
        </button>
        <button 
          onClick={() => setActiveTab('participants')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 font-bold text-sm uppercase tracking-wider transition whitespace-nowrap border-b-2 ${activeTab === 'participants' ? 'border-[#a855f7] text-white bg-[#1a1a1a]' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#333]'}`}
        >
          <Users size={16} /> Participantes <span className="bg-[#333] text-xs px-2 py-0.5 rounded-full">{participants.length}</span>
        </button>
        <button 
          onClick={() => setActiveTab('bracket')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 font-bold text-sm uppercase tracking-wider transition whitespace-nowrap border-b-2 ${activeTab === 'bracket' ? 'border-[#a855f7] text-white bg-[#1a1a1a]' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#333]'}`}
        >
          <Trophy size={16} /> Torneio
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#1a1a1a]">
        <div className="max-w-5xl mx-auto">
          
          {/* CONFIG TAB */}
          {activeTab === 'config' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
              
              <div className="bg-[#242424] p-6 rounded-lg border border-[#333]">
                <label className="block text-sm font-bold text-white mb-2">Nome do Torneio <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#444] rounded p-3 text-white focus:border-[#a855f7] outline-none transition"
                  placeholder="Ex: Campeonato Regional 2026"
                />
              </div>

              <div className="bg-[#242424] p-6 rounded-lg border border-[#333] space-y-6">
                
                {/* Formato */}
                <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                  <div className="w-full md:w-1/4">
                    <label className="block text-sm font-bold text-white mb-2">Formato <span className="text-red-500">*</span></label>
                  </div>
                  <div className="w-full md:w-3/4 space-y-4">
                    <select 
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      disabled={tournamentStarted}
                      className="w-full bg-[#1a1a1a] border border-[#a855f7] rounded p-3 text-white outline-none appearance-none cursor-pointer disabled:opacity-50"
                      style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
                    >
                      <option value="single_elimination">Eliminação Simples (Single Elimination)</option>
                      <option value="round_robin">Todos contra Todos (Round Robin)</option>
                      <option value="swiss">Suíço (Swiss)</option>
                      <option value="leaderboard">Tabela de Classificação (Leaderboard)</option>
                    </select>

                    {/* Swiss Options */}
                    {format === 'swiss' && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-4">
                          <input type="number" min="1" value={swissRounds} onChange={e => setSwissRounds(e.target.value)} disabled={tournamentStarted} className="w-16 bg-[#1a1a1a] border border-[#444] rounded p-2 text-center text-white focus:border-[#a855f7] outline-none disabled:opacity-50" />
                          <span className="text-sm text-slate-300">quantidade de rodadas</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <input type="text" value={swissPtsWin} onChange={e => setSwissPtsWin(e.target.value)} className="w-16 bg-[#1a1a1a] border border-[#444] rounded p-2 text-center text-white focus:border-[#a855f7] outline-none" />
                          <span className="text-sm text-slate-300">pontos por vitória</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <input type="text" value={swissPtsTie} onChange={e => setSwissPtsTie(e.target.value)} className="w-16 bg-[#1a1a1a] border border-[#444] rounded p-2 text-center text-white focus:border-[#a855f7] outline-none" />
                          <span className="text-sm text-slate-300">pontos por empate</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <input type="text" value={swissPtsBye} onChange={e => setSwissPtsBye(e.target.value)} className="w-16 bg-[#1a1a1a] border border-[#444] rounded p-2 text-center text-white focus:border-[#a855f7] outline-none" />
                          <span className="text-sm text-slate-300">pontos por bye (folga)</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button 
                  onClick={() => setActiveTab('participants')}
                  className="bg-[#9333ea] hover:bg-[#7e22ce] text-white px-8 py-3 rounded font-bold transition shadow-lg"
                >
                  Avançar
                </button>
              </div>
            </div>
          )}

          {/* PARTICIPANTS TAB */}
          {activeTab === 'participants' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h3 className="text-2xl font-black italic text-white">Gerenciar Participantes</h3>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={handleShuffleSeeds}
                    disabled={tournamentStarted}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#444] hover:bg-[#555] disabled:opacity-50 text-white px-4 py-2 rounded font-bold text-sm transition"
                  >
                    <Shuffle size={16} /> EMBARALHAR
                  </button>
                  <button 
                    onClick={() => setIsBulkAdd(!isBulkAdd)}
                    disabled={tournamentStarted}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#444] hover:bg-[#555] disabled:opacity-50 text-white px-4 py-2 rounded font-bold text-sm transition"
                  >
                    <AlignLeft size={16} /> ADICIONAR EM MASSA
                  </button>
                </div>
              </div>

              {isBulkAdd ? (
                <div className="bg-[#242424] p-6 rounded-lg border border-[#333]">
                  <h4 className="font-bold text-white mb-2">Adicionar em Massa</h4>
                  <p className="text-xs text-slate-400 mb-4">Insira um nome por linha.</p>
                  <textarea 
                    value={bulkAddText}
                    onChange={(e) => setBulkAddText(e.target.value)}
                    className="w-full h-40 bg-[#1a1a1a] border border-[#444] rounded p-3 text-white focus:border-[#a855f7] outline-none transition mb-4 resize-none"
                    placeholder="Jogador 1&#10;Jogador 2&#10;Jogador 3"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={handleBulkAdd}
                      className="bg-[#9333ea] hover:bg-[#7e22ce] text-white px-6 py-2 rounded font-bold transition"
                    >
                      Adicionar
                    </button>
                    <button 
                      onClick={() => setIsBulkAdd(false)}
                      className="bg-transparent border border-[#444] text-white px-6 py-2 rounded font-bold hover:bg-[#333] transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
                    disabled={tournamentStarted}
                    className="flex-1 bg-[#242424] border border-[#444] rounded p-3 text-white focus:border-[#a855f7] outline-none transition disabled:opacity-50"
                    placeholder="Nome do participante..."
                  />
                  <button 
                    onClick={handleAddParticipant}
                    disabled={tournamentStarted}
                    className="bg-[#9333ea] hover:bg-[#7e22ce] disabled:bg-[#444] text-white px-6 py-3 rounded font-bold transition flex items-center gap-2 whitespace-nowrap"
                  >
                    <Plus size={18} /> <span className="hidden sm:inline">ADICIONAR</span>
                  </button>
                </div>
              )}

              {participants.length === 0 ? (
                <div className="bg-[#242424] p-12 rounded-lg border border-[#333] flex flex-col items-center justify-center text-center">
                  <Users size={64} className="text-[#444] mb-4" />
                  <h4 className="text-xl font-bold text-white mb-2 italic">Nenhum participante adicionado</h4>
                  <p className="text-slate-400 text-sm max-w-md">
                    Adicione participantes ao seu torneio digitando um nome acima. Você pode fazer isso individualmente ou em massa.
                  </p>
                </div>
              ) : (
                <div className="bg-[#242424] rounded-lg border border-[#333] overflow-hidden">
                  <div className="grid grid-cols-[60px_1fr_auto] gap-4 p-4 border-b border-[#333] bg-[#1f1f1f] text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <div className="text-center">Seed</div>
                    <div>Nome do Participante</div>
                    <div className="w-20"></div>
                  </div>
                  <div className="divide-y divide-[#333]">
                    {participants.map((p) => (
                      <div key={p.id} className="grid grid-cols-[60px_1fr_auto] gap-4 p-4 items-center hover:bg-[#2a2a2a] transition group">
                        <div className="text-center font-mono text-slate-500 font-bold">{p.seed}</div>
                        <div className="font-medium text-white">{p.name}</div>
                        <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition">
                          <button 
                            onClick={() => handleRemoveParticipant(p.id)}
                            disabled={tournamentStarted}
                            className="p-2 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-500 transition disabled:hidden"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button 
                  onClick={generateBracketHandler}
                  disabled={participants.length < 2}
                  className="bg-[#9333ea] hover:bg-[#7e22ce] disabled:bg-[#444] disabled:text-slate-500 text-white px-8 py-3 rounded font-bold transition shadow-lg flex items-center gap-2"
                >
                  <PlayCircle size={20} /> {tournamentStarted ? 'Reiniciar Torneio' : 'Iniciar Torneio'}
                </button>
              </div>
            </div>
          )}

          {/* BRACKET TAB */}
          {activeTab === 'bracket' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
              
              {!tournamentStarted ? (
                <div className="bg-[#242424] p-12 rounded-lg border border-[#333] text-center">
                  <Trophy size={64} className="mx-auto text-[#444] mb-4" />
                  <p className="text-slate-400 font-medium">Inicie o torneio na aba Participantes primeiro.</p>
                </div>
              ) : (
                <>
                  {/* Leaderboard View */}
                  {(format === 'swiss' || format === 'round_robin' || format === 'leaderboard') && (
                    <div className="mb-8">
                      <h3 className="text-xl font-black italic text-white mb-4 flex items-center gap-2">
                        <Award className="text-[#a855f7]" /> Classificação Atual
                      </h3>
                      {renderLeaderboard()}
                    </div>
                  )}

                  {/* Matches View */}
                  {format !== 'leaderboard' && (
                    <div>
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-black italic text-white">Partidas</h3>
                        
                        {/* Pagination / Round Control */}
                        {format === 'single_elimination' || format === 'round_robin' || (format === 'swiss' && swissPhase !== 'swiss') ? (
                          <div className="flex items-center gap-4 bg-[#242424] px-2 py-1 rounded border border-[#333]">
                            <button 
                              onClick={() => setCurrentRound(Math.max(1, currentRound - 1))}
                              disabled={currentRound === 1}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                            >
                              <ChevronLeft size={20} />
                            </button>
                            <span className="font-bold text-white text-sm">Rodada {currentRound} de {totalRounds}</span>
                            <button 
                              onClick={() => setCurrentRound(Math.min(totalRounds, currentRound + 1))}
                              disabled={currentRound === totalRounds}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                            >
                              <ChevronRight size={20} />
                            </button>
                          </div>
                        ) : format === 'swiss' && swissPhase === 'swiss' ? (
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-white bg-[#242424] px-4 py-2 rounded border border-[#333]">Rodada {currentRound} de {totalRounds}</span>
                            {currentRound < totalRounds ? (
                              <button 
                                onClick={advanceSwissRound}
                                className="bg-[#a855f7] hover:bg-[#9333ea] text-white px-4 py-2 rounded font-bold text-sm transition shadow-lg"
                              >
                                Próxima Rodada
                              </button>
                            ) : (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => generateSwissPlayoffs('top4')}
                                  className="bg-[#a855f7] hover:bg-[#9333ea] text-white px-4 py-2 rounded font-bold text-sm transition shadow-lg"
                                >
                                  Mata-mata (Top 4)
                                </button>
                                <button 
                                  onClick={() => generateSwissPlayoffs('top2')}
                                  className="bg-[#a855f7] hover:bg-[#9333ea] text-white px-4 py-2 rounded font-bold text-sm transition shadow-lg"
                                >
                                  Final (Top 2)
                                </button>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {matches.filter(m => m.round === currentRound).map(renderMatch)}
                      </div>
                      
                      {matches.filter(m => m.round === currentRound).length === 0 && (
                        <p className="text-slate-500 italic">Nenhuma partida nesta rodada.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
