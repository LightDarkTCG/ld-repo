import React, { useState, useEffect, useRef } from 'react';
import { 
  Crown, 
  X, 
  Users, 
  Settings, 
  Trophy, 
  Plus, 
  Trash2, 
  Shuffle, 
  AlignLeft, 
  PlayCircle, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Award, 
  Share2, 
  Copy, 
  Check, 
  ShieldCheck, 
  ShieldAlert, 
  LogIn, 
  Link2, 
  Sparkles, 
  CheckCircle,
  ExternalLink,
  History,
  Lock,
  Flame,
  Medal
} from 'lucide-react';
import { useAuth } from '../authService';
import { 
  TournamentData, 
  Participant, 
  Match, 
  FinalStanding,
  saveTournamentToCloud, 
  subscribeTournament, 
  linkPlayerAccountToParticipant, 
  finalizeTournamentAndRecordHistory, 
  verifyOfficialTournamentPassword, 
  getTournamentShareUrl,
  calculateSwissTiebreakers,
  sortSwissParticipants,
  SwissTiebreakerStats,
  OFFICIAL_ADMIN_EMAIL 
} from '../tournamentService';
import { ChampionshipHistoryModal } from './ChampionshipHistoryModal';

interface TournamentManagerProps {
  onClose: () => void;
  initialTournamentId?: string;
  onOpenAuth?: () => void;
}

export const TournamentManager: React.FC<TournamentManagerProps> = ({ 
  onClose, 
  initialTournamentId,
  onOpenAuth 
}) => {
  const { user } = useAuth();
  
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<'config' | 'participants' | 'bracket'>('config');

  // Tournament Identity & Persistence
  const [tournamentId, setTournamentId] = useState<string>(() => {
    return initialTournamentId || `ldt_t_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  });
  const [isOfficial, setIsOfficial] = useState(false);
  const [status, setStatus] = useState<'draft' | 'in_progress' | 'completed'>('draft');
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);

  // Config State
  const [name, setName] = useState('');
  const [format, setFormat] = useState('single_elimination');
  
  // Swiss Options (Regras Oficiais Magic: 3 pts vitória / 1 pt empate / 3 pts Bye)
  const [swissPtsWin, setSwissPtsWin] = useState('3.0');
  const [swissPtsTie, setSwissPtsTie] = useState('1.0');
  const [swissPtsBye, setSwissPtsBye] = useState('3.0');
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
  const [finalStandings, setFinalStandings] = useState<FinalStanding[]>([]);

  // Modals & Popups
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [linkSuccessMessage, setLinkSuccessMessage] = useState<string | null>(null);

  // Ref to prevent loop when updating from cloud
  const isIncomingUpdate = useRef(false);

  // Sincroniza initialTournamentId quando o prop mudar externamente
  useEffect(() => {
    if (initialTournamentId && initialTournamentId !== tournamentId) {
      setTournamentId(initialTournamentId);
    }
  }, [initialTournamentId]);

  // Participante vinculado à conta do usuário logado
  const myLinkedParticipant = user ? participants.find(p => p.userId === user.uid) : null;
  const [showPickParticipantModal, setShowPickParticipantModal] = useState(false);

  const handleSelectMyParticipant = async (participantId: string) => {
    await handleLinkAccount(participantId);
    setShowPickParticipantModal(false);
  };

  const handleAddMyselfAndLink = () => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    const myName = user.displayName || 'Jogador';
    const newP: Participant = {
      id: Math.random().toString(36).substr(2, 9),
      seed: participants.length + 1,
      name: myName,
      points: 0, wins: 0, losses: 0, ties: 0, matchesPlayed: 0,
      userId: user.uid,
      userEmail: user.email || undefined,
      userPhoto: user.photoURL || undefined
    };
    const next = [...participants, newP];
    setParticipants(next);
    persistTournament({ participants: next });
    setLinkSuccessMessage(`Você entrou no torneio e sua conta foi vinculada com sucesso!`);
    setTimeout(() => setLinkSuccessMessage(null), 3500);
    setShowPickParticipantModal(false);
  };

  // Sincronização em tempo real se um ID for fornecido
  useEffect(() => {
    if (!tournamentId) return;

    const unsubscribe = subscribeTournament(tournamentId, (data) => {
      if (!data) return;
      isIncomingUpdate.current = true;
      setName(data.name || '');
      setFormat(data.format || 'single_elimination');
      setIsOfficial(!!data.isOfficial);
      setStatus(data.status || 'draft');
      setCurrentRound(data.currentRound || 1);
      setTotalRounds(data.totalRounds || 1);
      setParticipants(data.participants || []);
      setMatches(data.matches || []);
      if (data.finalStandings) setFinalStandings(data.finalStandings);
      if (data.swissPtsWin) setSwissPtsWin(data.swissPtsWin);
      if (data.swissPtsTie) setSwissPtsTie(data.swissPtsTie);
      if (data.swissPtsBye) setSwissPtsBye(data.swissPtsBye);
      if (data.swissRounds) setSwissRounds(data.swissRounds);
      if (data.swissPhase) setSwissPhase(data.swissPhase);
      if (data.status === 'in_progress' || data.status === 'completed') {
        setTournamentStarted(true);
        setActiveTab('bracket');
      }
      setIsCloudLoaded(true);
      setTimeout(() => {
        isIncomingUpdate.current = false;
      }, 300);
    });

    return () => unsubscribe();
  }, [tournamentId]);

  // Salva no Firestore quando houver modificação local
  const persistTournament = async (override?: Partial<TournamentData>) => {
    if (isIncomingUpdate.current) return;
    setIsSavingCloud(true);
    try {
      const payload: Partial<TournamentData> & { id: string } = {
        id: tournamentId,
        name: name || 'Torneio Light Dark TCG',
        format: format as any,
        isOfficial,
        creatorId: user?.uid || 'guest',
        creatorName: user?.displayName || 'Organizador',
        creatorEmail: user?.email || '',
        status: tournamentStarted ? (status === 'completed' ? 'completed' : 'in_progress') : 'draft',
        currentRound,
        totalRounds,
        swissPtsWin,
        swissPtsTie,
        swissPtsBye,
        swissRounds,
        swissPhase,
        participants,
        matches,
        finalStandings,
        ...override
      };
      await saveTournamentToCloud(payload);
    } catch (err) {
      console.error('Erro ao persistir torneio:', err);
    } finally {
      setIsSavingCloud(false);
    }
  };

  // Autenticação para Torneio Oficial
  const handleConfirmOfficialPassword = async () => {
    setIsVerifyingPassword(true);
    setPasswordError('');
    try {
      const isValid = await verifyOfficialTournamentPassword(passwordInput, user);
      if (isValid) {
        setIsOfficial(true);
        setShowPasswordModal(false);
        setPasswordInput('');
        persistTournament({ isOfficial: true });
      } else {
        setPasswordError('Senha incorreta. Somente a conta oficial tem permissão para autenticar este selo.');
      }
    } catch (e: any) {
      setPasswordError('Falha ao autenticar senha oficial.');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleToggleOfficial = () => {
    if (isOfficial) {
      setIsOfficial(false);
      persistTournament({ isOfficial: false });
    } else {
      // Se for o admin logado, pode ativar diretamente ou solicitar confirmação da senha
      setShowPasswordModal(true);
      setPasswordError('');
      setPasswordInput('');
    }
  };

  // Vincular conta ao participante
  const handleLinkAccount = async (participantId: string) => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      else alert('Faça login com sua conta para se vincular a este torneio.');
      return;
    }

    try {
      await linkPlayerAccountToParticipant(tournamentId, participantId, user);
      setParticipants(prev => prev.map(p => {
        if (p.id === participantId) {
          return {
            ...p,
            name: user.displayName || p.name,
            userId: user.uid,
            userEmail: user.email || '',
            userPhoto: user.photoURL || ''
          };
        }
        return p;
      }));
      setLinkSuccessMessage(`Conta vinculada ao participante com sucesso!`);
      setTimeout(() => setLinkSuccessMessage(null), 3500);
    } catch (err) {
      console.error('Erro ao vincular conta:', err);
      alert('Não foi possível vincular sua conta ao participante.');
    }
  };

  // Copiar link de compartilhamento
  const handleCopyShareLink = () => {
    const url = getTournamentShareUrl(tournamentId);
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Adição de participantes
  const handleAddParticipant = () => {
    if (!newParticipantName.trim()) return;
    
    // Se o nome for o do próprio usuário logado, já pode vincular automaticamente
    const isMe = user && (user.displayName === newParticipantName.trim());

    const newP: Participant = {
      id: Math.random().toString(36).substr(2, 9),
      seed: participants.length + 1,
      name: newParticipantName.trim(),
      points: 0, wins: 0, losses: 0, ties: 0, matchesPlayed: 0,
      userId: isMe ? user.uid : undefined,
      userEmail: isMe ? user.email || undefined : undefined,
      userPhoto: isMe ? user.photoURL || undefined : undefined
    };
    const next = [...participants, newP];
    setParticipants(next);
    setNewParticipantName('');
    persistTournament({ participants: next });
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
    const next = [...participants, ...newPs];
    setParticipants(next);
    setBulkAddText('');
    setIsBulkAdd(false);
    persistTournament({ participants: next });
  };

  const handleRemoveParticipant = (id: string) => {
    const updated = participants.filter(p => p.id !== id).map((p, i) => ({ ...p, seed: i + 1 }));
    setParticipants(updated);
    persistTournament({ participants: updated });
  };

  const handleShuffleSeeds = () => {
    const shuffled = [...participants].sort(() => Math.random() - 0.5).map((p, i) => ({ ...p, seed: i + 1 }));
    setParticipants(shuffled);
    persistTournament({ participants: shuffled });
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

    // Subsequent Rounds
    let roundsCount = Math.log2(nextPowerOf2);
    let previousRoundMatches = currentRoundMatches;

    for (let roundNum = 2; roundNum <= roundsCount; roundNum++) {
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
    }

    setMatches(allMatches);
    setTotalRounds(roundsCount);
    persistTournament({ matches: allMatches, totalRounds: roundsCount, status: 'in_progress' });
  };

  const generateRoundRobin = () => {
    let ps = [...participants];
    if (ps.length % 2 !== 0) {
      ps.push({ id: 'bye', seed: 999, name: 'BYE', points: 0, wins: 0, losses: 0, ties: 0, matchesPlayed: 0 });
    }

    const n = ps.length;
    const roundsCount = n - 1;
    let allMatches: Match[] = [];
    let matchCounter = 1;

    let currentPs = [...ps];

    for (let round = 1; round <= roundsCount; round++) {
      for (let i = 0; i < n / 2; i++) {
        const p1 = currentPs[i];
        const p2 = currentPs[n - 1 - i];

        if (p1.id === 'bye' || p2.id === 'bye') {
          const actualPlayer = p1.id === 'bye' ? p2 : p1;
          allMatches.push({
            id: `m_${matchCounter++}`,
            round,
            player1: actualPlayer,
            player2: null,
            score1: null,
            score2: null,
            winnerId: actualPlayer.id,
            status: 'completed',
            isBye: true
          });
        } else {
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

    setMatches(allMatches);
    setTotalRounds(roundsCount);
    persistTournament({ matches: allMatches, totalRounds: roundsCount, status: 'in_progress' });
  };

  const generateSwissRound = (roundNum: number) => {
    // Ordenação pelos critérios oficiais Magic (Pontos -> OMW% -> GW% -> OGW%)
    const { sorted } = sortSwissParticipants(participants, matches);

    let newMatches: Match[] = [];
    let matchCounter = matches.length + 1;
    let paired = new Set<string>();

    // Bye handling if odd (Seguindo regras do Magic: 3 pts, vitória 2-0 em jogos)
    if (sorted.length % 2 !== 0) {
      const candidatesForBye = [...sorted].reverse();
      const byePlayer = candidatesForBye.find(p => {
        return !matches.some(m => m.isBye && (m.player1?.id === p.id || m.player2?.id === p.id));
      }) || candidatesForBye[0];

      paired.add(byePlayer.id);
      newMatches.push({
        id: `m_${matchCounter++}`,
        round: roundNum,
        player1: byePlayer,
        player2: null,
        score1: 2,
        score2: 0, // Vitória limpa 2 a 0 em jogos
        winnerId: byePlayer.id,
        status: 'completed',
        isBye: true
      });
      updateParticipantStats(byePlayer.id, parseFloat(swissPtsBye || '3'), 1, 0, 0);
    }

    // Pair remaining
    for (let i = 0; i < sorted.length; i++) {
      const p1 = sorted[i];
      if (paired.has(p1.id)) continue;

      let p2: Participant | null = null;
      for (let j = i + 1; j < sorted.length; j++) {
        const potentialOpponent = sorted[j];
        if (paired.has(potentialOpponent.id)) continue;

        const alreadyPlayed = matches.some(m => 
          (m.player1?.id === p1.id && m.player2?.id === potentialOpponent.id) ||
          (m.player2?.id === p1.id && m.player1?.id === potentialOpponent.id)
        );

        if (!alreadyPlayed) {
          p2 = potentialOpponent;
          break;
        }
      }

      if (!p2) {
        for (let j = i + 1; j < sorted.length; j++) {
          if (!paired.has(sorted[j].id)) {
            p2 = sorted[j];
            break;
          }
        }
      }

      if (p2) {
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
    
    const combined = [...matches, ...newMatches];
    setMatches(combined);
    setCurrentRound(roundNum);
    const totRounds = parseInt(swissRounds) || 3;
    setTotalRounds(totRounds);
    persistTournament({ matches: combined, currentRound: roundNum, totalRounds: totRounds, status: 'in_progress' });
  };

  const generateBracketHandler = () => {
    if (participants.length < 2) return;
    
    // Reset stats
    const resetPs = participants.map(p => ({...p, points: 0, wins: 0, losses: 0, ties: 0, matchesPlayed: 0}));
    setParticipants(resetPs);
    setMatches([]);
    setCurrentRound(1);
    setTournamentStarted(true);
    setStatus('in_progress');
    setSwissPhase('swiss');

    if (format === 'single_elimination') {
      generateSingleElimination();
    } else if (format === 'round_robin') {
      generateRoundRobin();
    } else if (format === 'swiss') {
      generateSwissRound(1);
    } else if (format === 'leaderboard') {
      setTotalRounds(1);
      persistTournament({ participants: resetPs, totalRounds: 1, status: 'in_progress' });
    } else {
      generateSingleElimination();
    }
    
    setActiveTab('bracket');
  };

  // --- MATCH HANDLING ---

  const updateParticipantStats = (id: string, pts: number, w: number, l: number, t: number) => {
    setParticipants(prev => {
      const updated = prev.map(p => {
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
      });
      persistTournament({ participants: updated });
      return updated;
    });
  };

  const handleScoreChange = (matchId: string, p1Score: string, p2Score: string) => {
    const updated = matches.map(m => {
      if (m.id === matchId) {
        return {
          ...m,
          score1: p1Score === '' ? null : parseInt(p1Score),
          score2: p2Score === '' ? null : parseInt(p2Score)
        };
      }
      return m;
    });
    setMatches(updated);
    persistTournament({ matches: updated });
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
    persistTournament({ matches: updatedMatches });

    // Update Scores
    if (format === 'swiss' || format === 'round_robin') {
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

    // Cut para Playoffs usando desempate oficial Magic (Pontos -> OMW% -> GW% -> OGW%)
    const { sorted } = sortSwissParticipants(participants, matches);
    const topPlayers = sorted.slice(0, type === 'top4' ? 4 : 2);
    setSwissPhase(type);

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

    const combined = [...matches, ...newMatches];
    setMatches(combined);
    setCurrentRound(playoffRound);
    persistTournament({ matches: combined, currentRound: playoffRound, totalRounds: type === 'top4' ? playoffRound + 1 : playoffRound, swissPhase: type });
  };

  // Finalizar Torneio e Gravar no Histórico dos Participantes
  const handleFinalizeTournament = async () => {
    if (matches.some(m => m.status === 'pending')) {
      const confirm = window.confirm("Ainda existem partidas pendentes no torneio. Deseja finalizar mesmo assim e registrar a classificação atual?");
      if (!confirm) return;
    }

    try {
      const tournamentPayload: TournamentData = {
        id: tournamentId,
        name: name || 'Torneio Light Dark TCG',
        format: format as any,
        isOfficial,
        creatorId: user?.uid || 'guest',
        creatorName: user?.displayName || 'Organizador',
        creatorEmail: user?.email || '',
        status: 'completed',
        currentRound,
        totalRounds,
        swissPtsWin,
        swissPtsTie,
        swissPtsBye,
        swissRounds,
        swissPhase,
        participants,
        matches,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const standings = await finalizeTournamentAndRecordHistory(tournamentPayload);
      setFinalStandings(standings);
      setStatus('completed');
      setShowCelebrationModal(true);
    } catch (err) {
      console.error('Erro ao finalizar torneio:', err);
      alert('Não foi possível registrar o encerramento do campeonato.');
    }
  };

  // Checa se o torneio já está concluído ou tem campeão
  const isAllMatchesFinished = matches.length > 0 && matches.every(m => m.status === 'completed');

  // --- RENDERERS ---

  const renderMatch = (match: Match) => {
    const isCompleted = match.status === 'completed';
    
    return (
      <div key={match.id} className="bg-[#242424] rounded-xl border border-[#333] overflow-hidden shadow-lg flex flex-col">
        {/* Player 1 */}
        <div className={`flex items-center p-2.5 border-b border-[#333] ${match.winnerId === match.player1?.id ? 'bg-[#a855f7]/25' : ''}`}>
          <span className="w-6 text-xs text-slate-500 text-center font-mono">{match.player1?.seed || '-'}</span>
          
          <div className="flex-1 flex items-center gap-1.5 min-w-0 px-2">
            {match.player1?.userPhoto ? (
              <img src={match.player1.userPhoto} alt="" className="w-5 h-5 rounded-full object-cover shrink-0 border border-purple-400" />
            ) : match.player1?.userId ? (
              <div className="w-5 h-5 rounded-full bg-purple-900 text-purple-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                {match.player1.name[0]?.toUpperCase()}
              </div>
            ) : null}
            <span className={`text-sm truncate ${match.winnerId === match.player1?.id ? 'text-[#a855f7] font-black' : 'text-white font-medium'}`}>
              {match.player1?.name || '---'}
            </span>
          </div>

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
        <div className={`flex items-center p-2.5 ${match.winnerId === match.player2?.id ? 'bg-[#a855f7]/25' : ''}`}>
          <span className="w-6 text-xs text-slate-500 text-center font-mono">{match.player2?.seed || '-'}</span>
          
          <div className="flex-1 flex items-center gap-1.5 min-w-0 px-2">
            {match.player2?.userPhoto ? (
              <img src={match.player2.userPhoto} alt="" className="w-5 h-5 rounded-full object-cover shrink-0 border border-purple-400" />
            ) : match.player2?.userId ? (
              <div className="w-5 h-5 rounded-full bg-purple-900 text-purple-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                {match.player2.name[0]?.toUpperCase()}
              </div>
            ) : null}
            <span className={`text-sm truncate ${match.winnerId === match.player2?.id ? 'text-[#a855f7] font-black' : 'text-white font-medium'}`}>
              {match.player2?.name || '---'}
            </span>
          </div>

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
            <span className="text-xs text-slate-500 font-bold uppercase">BYE (Avança Direto)</span>
          </div>
        )}
      </div>
    );
  };

  const renderSwissStandings = () => {
    const { sorted, statsMap } = sortSwissParticipants(participants, matches);

    return (
      <div className="space-y-3">
        <div className="bg-[#242424] rounded-xl border border-[#333] overflow-hidden overflow-x-auto shadow-lg">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-[45px_1fr_65px_75px_75px_75px_75px_65px] gap-2 p-3 md:p-3.5 border-b border-[#333] bg-[#1f1f1f] text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider items-center">
              <div className="text-center">Pos</div>
              <div>Participante</div>
              <div className="text-center text-amber-400 font-black">Pontos</div>
              <div className="text-center">V-D-E</div>
              <div className="text-center text-purple-300 font-black" title="1º Critério: Opponents' Match-Win % (Média de vitórias dos oponentes reais, piso 33%)">
                OMW%
              </div>
              <div className="text-center text-indigo-300 font-black" title="2º Critério: Game-Win % (Aproveitamento individual em jogos, Bye = 2 a 0)">
                GW%
              </div>
              <div className="text-center text-slate-300 font-black" title="3º Critério: Opponents' Game-Win % (Média de GW% dos oponentes reais, piso 33%)">
                OGW%
              </div>
              <div className="text-center">Jogos</div>
            </div>

            <div className="divide-y divide-[#333]">
              {sorted.map((p, idx) => {
                const s = statsMap.get(p.id);
                const isMe = user && user.uid === p.userId;
                const omwFormatted = s ? (s.omw * 100).toFixed(1) + '%' : '33.0%';
                const gwFormatted = s ? (s.gw * 100).toFixed(1) + '%' : '33.0%';
                const ogwFormatted = s ? (s.ogw * 100).toFixed(1) + '%' : '33.0%';
                const gamesRecord = s ? `${s.gameWins}-${s.gameLosses}` : '0-0';

                return (
                  <div 
                    key={p.id} 
                    className={`grid grid-cols-[45px_1fr_65px_75px_75px_75px_75px_65px] gap-2 p-3 md:p-3.5 items-center hover:bg-[#2a2a2a] transition ${
                      isMe ? 'bg-purple-950/25 border-l-2 border-[#a855f7]' : ''
                    }`}
                  >
                    <div className="text-center font-bold font-mono text-[#a855f7]">
                      {idx + 1}º
                    </div>

                    <div className="flex items-center gap-2 truncate">
                      {p.userPhoto ? (
                        <img src={p.userPhoto} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 border border-purple-400" />
                      ) : p.userId ? (
                        <div className="w-6 h-6 rounded-full bg-purple-900 text-purple-200 text-xs font-bold flex items-center justify-center shrink-0">
                          {p.name[0]?.toUpperCase()}
                        </div>
                      ) : null}
                      <span className="font-bold text-white text-sm truncate">{p.name}</span>
                      {isMe && (
                        <span className="text-[9px] bg-purple-600 text-white px-1.5 py-0.2 rounded font-black shrink-0">
                          Você
                        </span>
                      )}
                    </div>

                    {/* Pontos de Partida */}
                    <div className="text-center font-black text-amber-300 text-sm md:text-base font-mono bg-[#1a1a1a] py-1 rounded border border-[#444]">
                      {s ? s.matchPoints : p.points}
                    </div>

                    {/* Partidas V-D-E */}
                    <div className="text-center text-xs text-slate-300 font-mono">
                      {s ? `${s.matchWins}-${s.matchLosses}-${s.matchTies}` : `${p.wins}-${p.losses}-${p.ties}`}
                    </div>

                    {/* 1º Desempate: OMW% */}
                    <div 
                      className="text-center font-mono font-bold text-xs text-purple-300 bg-purple-950/50 py-1 rounded border border-purple-500/30"
                      title="1º Critério: Média de vitórias dos oponentes enfrentados (Piso 33%)"
                    >
                      {omwFormatted}
                    </div>

                    {/* 2º Desempate: GW% */}
                    <div 
                      className="text-center font-mono font-semibold text-xs text-indigo-300 bg-indigo-950/40 py-1 rounded border border-indigo-500/20"
                      title="2º Critério: Desempenho individual em jogos (Bye = 2 a 0 limpo)"
                    >
                      {gwFormatted}
                    </div>

                    {/* 3º Desempate: OGW% */}
                    <div 
                      className="text-center font-mono text-xs text-slate-300 bg-slate-900/50 py-1 rounded border border-slate-700/40"
                      title="3º Critério: Média de GW% dos oponentes enfrentados (Piso 33%)"
                    >
                      {ogwFormatted}
                    </div>

                    {/* Jogos Ganhos - Perdidos */}
                    <div className="text-center text-xs text-slate-400 font-mono">
                      {gamesRecord}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card Explicativo das Regras Oficiais do Magic */}
        <div className="bg-[#181a22] border border-purple-500/30 rounded-xl p-3.5 text-xs text-slate-300 space-y-2 shadow-sm">
          <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wider">
            <Sparkles size={14} className="text-amber-400" />
            <span>Regras Oficiais de Desempate Magic: The Gathering</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] leading-relaxed text-slate-400 pt-1">
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-purple-300 font-bold block mb-0.5">1. OMW% (Oponentes)</span>
              Média da porcentagem de vitórias de todos os oponentes reais enfrentados. Quem jogou contra oponentes mais vitoriosos fica na frente.
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-indigo-300 font-bold block mb-0.5">2. GW% (Jogos Individuais)</span>
              Aproveitamento em jogos de cada partida. Vencer por "2 a 0" rende um GW% superior a vencer por "2 a 1".
            </div>
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-200 font-bold block mb-0.5">3. OGW% (Jogos Oponentes)</span>
              Média do GW% de todos os oponentes reais que você enfrentou. Utilizado em caso de empate nos dois primeiros.
            </div>
          </div>
          <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2 flex flex-col sm:flex-row gap-2 sm:gap-4">
            <span>🛡️ <b>Piso de 33% e Drops</b>: Oponentes 0-4 ou desistentes contam no mínimo 33% para não prejudicar seu desempate.</span>
            <span>⭐ <b>Regra do Bye</b>: Concede 3 pontos, conta 2-0 no seu GW% e é excluído do cálculo dos oponentes.</span>
          </div>
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => {
    const sorted = [...participants].sort((a, b) => b.points - a.points);
    return (
      <div className="bg-[#242424] rounded-xl border border-[#333] overflow-hidden overflow-x-auto shadow-lg">
        <div className="min-w-[420px]">
          <div className="grid grid-cols-[40px_1fr_80px_70px_70px] md:grid-cols-[50px_1fr_90px_80px_80px] gap-2 md:gap-4 p-3 md:p-4 border-b border-[#333] bg-[#1f1f1f] text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">
            <div className="text-center">Pos</div>
            <div>Participante</div>
            <div className="text-center">V-D-E</div>
            <div className="text-center">Jogos</div>
            <div className="text-center">Pontos</div>
          </div>
          <div className="divide-y divide-[#333]">
            {sorted.map((p, idx) => (
              <div key={p.id} className="grid grid-cols-[40px_1fr_80px_70px_70px] md:grid-cols-[50px_1fr_90px_80px_80px] gap-2 md:gap-4 p-3 md:p-4 items-center hover:bg-[#2a2a2a] transition">
                <div className="text-center font-bold text-[#a855f7]">{idx + 1}º</div>
                <div className="flex items-center gap-2 truncate">
                  {p.userPhoto ? (
                    <img src={p.userPhoto} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 border border-purple-400" />
                  ) : p.userId ? (
                    <div className="w-6 h-6 rounded-full bg-purple-900 text-purple-200 text-xs font-bold flex items-center justify-center shrink-0">
                      {p.name[0]?.toUpperCase()}
                    </div>
                  ) : null}
                  <span className="font-medium text-white text-sm md:text-base truncate">{p.name}</span>
                  {p.userId && (
                    <span className="text-[9px] bg-purple-950 text-purple-300 border border-purple-700/60 px-1.5 py-0.2 rounded font-bold">
                      Conectado
                    </span>
                  )}
                </div>
                <div className="text-center text-xs md:text-sm text-slate-300 font-mono">{p.wins}-{p.losses}-{p.ties}</div>
                <div className="text-center text-xs md:text-sm text-slate-300 font-mono">{p.matchesPlayed}</div>
                <div className="text-center font-bold text-white bg-[#1a1a1a] py-1 rounded border border-[#444] font-mono">
                  {format === 'leaderboard' ? (
                    <input 
                      type="number" 
                      value={p.points} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setParticipants(prev => {
                          const up = prev.map(pt => pt.id === p.id ? {...pt, points: val} : pt);
                          persistTournament({ participants: up });
                          return up;
                        });
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
      
      {/* HEADER */}
      <div className={`p-4 flex flex-wrap justify-between items-center shadow-lg shrink-0 gap-3 border-b ${
        isOfficial 
          ? 'bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-950 border-amber-500/50' 
          : 'bg-[#242424] border-[#333]'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            isOfficial 
              ? 'bg-gradient-to-br from-amber-500 to-yellow-500 text-slate-950 border-amber-300 shadow-md shadow-amber-950/60' 
              : 'bg-purple-900/60 text-purple-300 border-purple-500/40'
          }`}>
            <Crown size={22} className={isOfficial ? 'fill-slate-950' : 'fill-purple-400'} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white truncate max-w-[200px] sm:max-w-md">
                {name || 'Torneio Light Dark TCG'}
              </h2>
              {isOfficial ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-sm flex items-center gap-1">
                  <Crown size={10} className="fill-slate-950" /> Oficial
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  Comunitário
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span>Código: <b className="font-mono text-purple-300">{tournamentId.split('_').slice(-1)[0]}</b></span>
              {isSavingCloud && <span className="text-amber-400 text-[10px] flex items-center gap-1">• Salvando na nuvem...</span>}
            </div>
          </div>
        </div>

        {/* BOTOES DE AÇÃO TOPO */}
        <div className="flex items-center gap-2">
          {/* Botão / Status de Vincular Conta */}
          {user ? (
            myLinkedParticipant ? (
              <div 
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs font-bold"
                title={`Vinculado como ${myLinkedParticipant.name}. Resultados serão gravados no seu histórico!`}
              >
                <CheckCircle size={13} className="text-emerald-400" />
                <span className="truncate max-w-[130px]">{myLinkedParticipant.name}</span>
              </div>
            ) : (
              <button
                onClick={() => setShowPickParticipantModal(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-950/40 active:scale-95"
                title="Vincular sua conta a um participante para computar este torneio no seu histórico"
              >
                <Link2 size={13} />
                <span className="hidden sm:inline">Vincular Minha Conta</span>
              </button>
            )
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white font-bold text-xs transition flex items-center gap-1.5 border border-purple-500/30 active:scale-95"
              title="Faça login com sua conta para que seus resultados contem no seu histórico"
            >
              <LogIn size={13} />
              <span className="hidden sm:inline">Entrar na Conta</span>
            </button>
          )}

          {/* Botão de Compartilhar */}
          <button
            onClick={() => setShowShareModal(true)}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-purple-950/40 active:scale-95"
            title="Compartilhar link deste torneio"
          >
            <Share2 size={14} />
            <span className="hidden sm:inline">Compartilhar</span>
          </button>

          {/* Botão Ver Meu Histórico de Campeonatos */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition flex items-center gap-1.5 border border-slate-700 active:scale-95"
            title="Ver meus títulos e histórico de campeonatos"
          >
            <History size={14} className="text-amber-400" />
            <span className="hidden sm:inline">Histórico</span>
          </button>

          {/* Fechar */}
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-[#333] rounded-full text-slate-400 hover:text-white transition"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex bg-[#242424] border-b border-[#333] shrink-0 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('config')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 font-bold text-xs sm:text-sm uppercase tracking-wider transition whitespace-nowrap border-b-2 ${activeTab === 'config' ? 'border-[#a855f7] text-white bg-[#1a1a1a]' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#333]'}`}
        >
          <Settings size={15} /> Configurações
        </button>
        <button 
          onClick={() => setActiveTab('participants')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 font-bold text-xs sm:text-sm uppercase tracking-wider transition whitespace-nowrap border-b-2 ${activeTab === 'participants' ? 'border-[#a855f7] text-white bg-[#1a1a1a]' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#333]'}`}
        >
          <Users size={15} /> Participantes <span className="bg-[#333] text-xs px-2 py-0.5 rounded-full">{participants.length}</span>
        </button>
        <button 
          onClick={() => setActiveTab('bracket')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 font-bold text-xs sm:text-sm uppercase tracking-wider transition whitespace-nowrap border-b-2 ${activeTab === 'bracket' ? 'border-[#a855f7] text-white bg-[#1a1a1a]' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#333]'}`}
        >
          <Trophy size={15} /> Chave & Partidas
        </button>
      </div>

      {/* BANNER DE VINCULAÇÃO DE CONTA */}
      {!myLinkedParticipant ? (
        <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border-b border-purple-500/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-slate-300 min-w-0">
            <Sparkles size={16} className="text-amber-400 shrink-0" />
            <span className="leading-snug">
              {user ? (
                <>Você está conectado como <b className="text-white">{user.displayName || 'Jogador'}</b>. Deseja vincular sua conta a um participante para salvar o resultado no seu histórico?</>
              ) : (
                <>Conecte sua conta Google para que suas vitórias e títulos neste torneio sejam gravados no seu <b className="text-amber-300">Histórico de Campeonatos</b>!</>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <button
                onClick={() => setShowPickParticipantModal(true)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md active:scale-95"
              >
                <Link2 size={13} />
                <span>Vincular Minha Conta</span>
              </button>
            ) : (
              <button
                onClick={onOpenAuth}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md active:scale-95"
              >
                <LogIn size={13} />
                <span>Entrar na Minha Conta</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-950/50 border-b border-emerald-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle size={15} className="text-emerald-400 shrink-0" />
            <span>
              Sua conta está vinculada como <b className="text-white">{myLinkedParticipant.name}</b>. Ao concluir o torneio, seu resultado será gravado no seu perfil!
            </span>
          </div>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="text-amber-400 hover:text-amber-300 font-bold underline flex items-center gap-1 text-[11px]"
          >
            <Trophy size={12} />
            <span>Ver Meu Histórico</span>
          </button>
        </div>
      )}

      {/* TOAST NOTIFICAÇÃO VINCULO */}
      {linkSuccessMessage && (
        <div className="bg-emerald-600 text-white text-xs font-bold py-2 px-4 text-center flex items-center justify-center gap-2 shadow-md">
          <CheckCircle size={15} />
          <span>{linkSuccessMessage}</span>
        </div>
      )}

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#1a1a1a]">
        <div className="max-w-5xl mx-auto">
          
          {/* CONFIG TAB */}
          {activeTab === 'config' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
              
              {/* Nome */}
              <div className="bg-[#242424] p-6 rounded-xl border border-[#333]">
                <label className="block text-sm font-bold text-white mb-2">Nome do Torneio <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    persistTournament({ name: e.target.value });
                  }}
                  className="w-full bg-[#1a1a1a] border border-[#444] rounded-xl p-3 text-white focus:border-[#a855f7] outline-none transition"
                  placeholder="Ex: 1º Torneio Regional Light Dark TCG 2026"
                />
              </div>

              {/* Autenticação Torneio Oficial */}
              <div className={`p-6 rounded-xl border transition ${
                isOfficial 
                  ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border-amber-500/60 shadow-lg' 
                  : 'bg-[#242424] border-[#333]'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                      isOfficial 
                        ? 'bg-gradient-to-br from-amber-500 to-yellow-500 text-slate-950 border-amber-300 shadow-md' 
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      <Crown size={24} className={isOfficial ? 'fill-slate-950' : ''} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                        Torneio Oficial Light Dark TCG
                        {isOfficial && (
                          <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase">
                            Selo Oficial Ativo
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                        {isOfficial 
                          ? 'Este torneio possui chancela oficial. Os resultados serão gravados com destaque dourado exclusivo no histórico dos jogadores.'
                          : 'Torneios oficiais requerem autenticação por senha da conta pessoal do criador. Torneios comunitários são livres e não exigem senha.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleOfficial}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shrink-0 ${
                      isOfficial 
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    <Lock size={14} className={isOfficial ? 'text-slate-950' : 'text-amber-400'} />
                    <span>{isOfficial ? 'Desativar Selo Oficial' : 'Ativar Torneio Oficial'}</span>
                  </button>
                </div>
              </div>

              {/* Formato */}
              <div className="bg-[#242424] p-6 rounded-xl border border-[#333] space-y-6">
                <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                  <div className="w-full md:w-1/4">
                    <label className="block text-sm font-bold text-white mb-2">Formato da Disputa <span className="text-red-500">*</span></label>
                  </div>
                  <div className="w-full md:w-3/4 space-y-4">
                    <select 
                      value={format}
                      onChange={(e) => {
                        setFormat(e.target.value);
                        persistTournament({ format: e.target.value as any });
                      }}
                      disabled={tournamentStarted}
                      className="w-full bg-[#1a1a1a] border border-[#a855f7] rounded-xl p-3 text-white outline-none appearance-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="single_elimination">Eliminação Simples (Mata-mata)</option>
                      <option value="round_robin">Todos contra Todos (Round Robin)</option>
                      <option value="swiss">Formato Suíço (Swiss)</option>
                      <option value="leaderboard">Tabela de Classificação Manual (Leaderboard)</option>
                    </select>

                    {/* Swiss Options */}
                    {format === 'swiss' && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-4">
                          <input type="number" min="1" value={swissRounds} onChange={e => { setSwissRounds(e.target.value); persistTournament({ swissRounds: e.target.value }); }} disabled={tournamentStarted} className="w-16 bg-[#1a1a1a] border border-[#444] rounded p-2 text-center text-white focus:border-[#a855f7] outline-none disabled:opacity-50" />
                          <span className="text-sm text-slate-300">quantidade de rodadas</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <input type="text" value={swissPtsWin} onChange={e => { setSwissPtsWin(e.target.value); persistTournament({ swissPtsWin: e.target.value }); }} className="w-16 bg-[#1a1a1a] border border-[#444] rounded p-2 text-center text-white focus:border-[#a855f7] outline-none" />
                          <span className="text-sm text-slate-300">pontos por vitória (Padrão Magic: 3)</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <input type="text" value={swissPtsTie} onChange={e => { setSwissPtsTie(e.target.value); persistTournament({ swissPtsTie: e.target.value }); }} className="w-16 bg-[#1a1a1a] border border-[#444] rounded p-2 text-center text-white focus:border-[#a855f7] outline-none" />
                          <span className="text-sm text-slate-300">pontos por empate (Padrão Magic: 1)</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <input type="text" value={swissPtsBye} onChange={e => { setSwissPtsBye(e.target.value); persistTournament({ swissPtsBye: e.target.value }); }} className="w-16 bg-[#1a1a1a] border border-[#444] rounded p-2 text-center text-white focus:border-[#a855f7] outline-none" />
                          <span className="text-sm text-slate-300">pontos por bye / folga (Padrão Magic: 3)</span>
                        </div>
                        <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-xl text-xs text-purple-200 leading-relaxed">
                          ✨ <b>Desempates Oficiais Magic</b>: 1º OMW% (com piso de 33%), 2º GW% (com Bye = 2-0 limpo), 3º OGW% (com piso de 33%).
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setActiveTab('participants')}
                  className="bg-[#9333ea] hover:bg-[#7e22ce] text-white px-8 py-3 rounded-xl font-bold transition shadow-lg"
                >
                  Avançar para Participantes
                </button>
              </div>
            </div>
          )}

          {/* PARTICIPANTS TAB */}
          {activeTab === 'participants' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-2xl font-black text-white">Gerenciar Participantes</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Os jogadores podem vincular suas contas aos seus nomes para salvar os resultados nos seus históricos.
                  </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button 
                    onClick={handleShuffleSeeds}
                    disabled={tournamentStarted}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#333] hover:bg-[#444] disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold text-xs transition"
                  >
                    <Shuffle size={14} /> EMBARALHAR
                  </button>
                  <button 
                    onClick={() => setIsBulkAdd(!isBulkAdd)}
                    disabled={tournamentStarted}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#333] hover:bg-[#444] disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold text-xs transition"
                  >
                    <AlignLeft size={14} /> EM MASSA
                  </button>
                </div>
              </div>

              {isBulkAdd ? (
                <div className="bg-[#242424] p-6 rounded-xl border border-[#333]">
                  <h4 className="font-bold text-white mb-2">Adicionar em Massa</h4>
                  <p className="text-xs text-slate-400 mb-4">Insira um nome por linha.</p>
                  <textarea 
                    value={bulkAddText}
                    onChange={(e) => setBulkAddText(e.target.value)}
                    className="w-full h-40 bg-[#1a1a1a] border border-[#444] rounded-xl p-3 text-white focus:border-[#a855f7] outline-none transition mb-4 resize-none text-sm"
                    placeholder="Jogador 1&#10;Jogador 2&#10;Jogador 3"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={handleBulkAdd}
                      className="bg-[#9333ea] hover:bg-[#7e22ce] text-white px-6 py-2 rounded-xl font-bold transition text-xs"
                    >
                      Adicionar
                    </button>
                    <button 
                      onClick={() => setIsBulkAdd(false)}
                      className="bg-transparent border border-[#444] text-white px-6 py-2 rounded-xl font-bold hover:bg-[#333] transition text-xs"
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
                    className="flex-1 bg-[#242424] border border-[#444] rounded-xl p-3 text-white focus:border-[#a855f7] outline-none transition disabled:opacity-50 text-sm"
                    placeholder="Nome do participante..."
                  />
                  <button 
                    onClick={handleAddParticipant}
                    disabled={tournamentStarted}
                    className="bg-[#9333ea] hover:bg-[#7e22ce] disabled:bg-[#444] text-white px-6 py-3 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap text-xs"
                  >
                    <Plus size={16} /> <span>ADICIONAR</span>
                  </button>
                </div>
              )}

              {/* Botão Atalho: Adicionar Minha Própria Conta */}
              {user && !participants.some(p => p.userId === user.uid) && !tournamentStarted && (
                <div className="p-3 bg-purple-950/40 border border-purple-500/40 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-purple-200">
                    <Crown size={15} className="text-amber-400" />
                    <span>Deseja entrar neste torneio com sua conta conectada (<b>{user.displayName || 'Você'}</b>)?</span>
                  </div>
                  <button
                    onClick={() => {
                      const newP: Participant = {
                        id: Math.random().toString(36).substr(2, 9),
                        seed: participants.length + 1,
                        name: user.displayName || 'Jogador',
                        points: 0, wins: 0, losses: 0, ties: 0, matchesPlayed: 0,
                        userId: user.uid,
                        userEmail: user.email || undefined,
                        userPhoto: user.photoURL || undefined
                      };
                      const next = [...participants, newP];
                      setParticipants(next);
                      persistTournament({ participants: next });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition shrink-0"
                  >
                    + Me Adicionar ao Torneio
                  </button>
                </div>
              )}

              {participants.length === 0 ? (
                <div className="bg-[#242424] p-12 rounded-xl border border-[#333] flex flex-col items-center justify-center text-center">
                  <Users size={64} className="text-[#444] mb-4" />
                  <h4 className="text-xl font-bold text-white mb-2 italic">Nenhum participante adicionado</h4>
                  <p className="text-slate-400 text-sm max-w-md">
                    Adicione participantes ao seu torneio digitando um nome acima. Você pode fazer isso individualmente ou em massa.
                  </p>
                </div>
              ) : (
                <div className="bg-[#242424] rounded-xl border border-[#333] overflow-hidden shadow-lg">
                  <div className="grid grid-cols-[50px_1fr_auto] gap-4 p-4 border-b border-[#333] bg-[#1f1f1f] text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <div className="text-center">Seed</div>
                    <div>Nome do Participante & Conta</div>
                    <div className="w-24 text-right">Ação</div>
                  </div>
                  <div className="divide-y divide-[#333]">
                    {participants.map((p) => {
                      const isLinked = !!p.userId;
                      const isMe = user && user.uid === p.userId;

                      return (
                        <div key={p.id} className="grid grid-cols-[50px_1fr_auto] gap-4 p-3.5 items-center hover:bg-[#2a2a2a] transition group">
                          <div className="text-center font-mono text-slate-500 font-bold">{p.seed}</div>
                          
                          <div className="flex items-center gap-2.5 min-w-0">
                            {p.userPhoto ? (
                              <img src={p.userPhoto} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-purple-400" />
                            ) : isLinked ? (
                              <div className="w-7 h-7 rounded-full bg-purple-900 text-purple-200 text-xs font-bold flex items-center justify-center shrink-0">
                                {p.name[0]?.toUpperCase()}
                              </div>
                            ) : null}

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm truncate">{p.name}</span>
                                {isMe && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-600 text-white font-bold">Você</span>
                                )}
                              </div>
                              {isLinked ? (
                                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                                  <CheckCircle size={10} /> Conta vinculada (histórico ativo)
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500">Sem conta vinculada</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Botão para vincular conta */}
                            {!isLinked ? (
                              user ? (
                                <button
                                  onClick={() => handleLinkAccount(p.id)}
                                  className="px-2.5 py-1 rounded-lg bg-purple-950/80 hover:bg-purple-800 text-purple-200 text-xs font-bold transition flex items-center gap-1 border border-purple-700/50"
                                  title="Vincular minha conta a este participante"
                                >
                                  <Link2 size={12} />
                                  <span className="hidden sm:inline">Vincular Minha Conta</span>
                                </button>
                              ) : (
                                <button
                                  onClick={onOpenAuth}
                                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-purple-300 text-xs font-bold transition flex items-center gap-1 border border-purple-700/40"
                                  title="Fazer login para vincular conta"
                                >
                                  <LogIn size={12} />
                                  <span className="hidden sm:inline">Entrar para Vincular</span>
                                </button>
                              )
                            ) : isMe ? (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                                <CheckCircle size={10} /> Vinculado a Você
                              </span>
                            ) : null}

                            {!tournamentStarted && (
                              <button 
                                onClick={() => handleRemoveParticipant(p.id)}
                                className="p-2 hover:bg-red-500/20 rounded-lg text-slate-500 hover:text-red-400 transition"
                                title="Remover"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button 
                  onClick={generateBracketHandler}
                  disabled={participants.length < 2}
                  className="bg-[#9333ea] hover:bg-[#7e22ce] disabled:bg-[#444] disabled:text-slate-500 text-white px-8 py-3 rounded-xl font-bold transition shadow-lg flex items-center gap-2 text-sm"
                >
                  <PlayCircle size={18} /> {tournamentStarted ? 'Reiniciar Torneio' : 'Iniciar Torneio'}
                </button>
              </div>
            </div>
          )}

          {/* BRACKET TAB */}
          {activeTab === 'bracket' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
              
              {!tournamentStarted ? (
                <div className="bg-[#242424] p-12 rounded-xl border border-[#333] text-center">
                  <Trophy size={64} className="mx-auto text-[#444] mb-4" />
                  <p className="text-slate-400 font-medium">Inicie o torneio na aba Participantes primeiro.</p>
                </div>
              ) : (
                <>
                  {/* Banner de Torneio Concluído / Finalizar */}
                  {status === 'completed' ? (
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-950 border-2 border-amber-400/80 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-lg">
                          <Crown size={26} className="fill-slate-950" />
                        </div>
                        <div>
                          <h4 className="text-base font-black text-amber-300 flex items-center gap-2">
                            Torneio Finalizado com Sucesso!
                          </h4>
                          <p className="text-xs text-slate-300 mt-0.5">
                            Os resultados e medalhas foram gravados no histórico oficial dos jogadores conectados.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowCelebrationModal(true)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs transition shadow-md flex items-center gap-1.5 shrink-0"
                      >
                        <Trophy size={14} className="fill-slate-950" />
                        <span>Ver Pódio Final</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-xs text-slate-400">
                        {isAllMatchesFinished ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 size={14} /> Todas as partidas foram concluídas! Você pode finalizar e registrar o histórico agora.
                          </span>
                        ) : (
                          <span>Preencha os placares das partidas para definir os campeões.</span>
                        )}
                      </div>
                      <button
                        onClick={handleFinalizeTournament}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs transition shadow-lg shadow-amber-950/40 flex items-center gap-1.5 active:scale-95 shrink-0"
                      >
                        <Trophy size={14} className="fill-slate-950" />
                        <span>Finalizar Torneio & Salvar Histórico</span>
                      </button>
                    </div>
                  )}

                  {/* Leaderboard View */}
                  {(format === 'swiss' || format === 'round_robin' || format === 'leaderboard') && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                          <Award className="text-[#a855f7]" /> {format === 'swiss' ? 'Classificação Suíça (Critérios Magic)' : 'Classificação Geral'}
                        </h3>
                        {format === 'swiss' && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            Critérios MTG: OMW% → GW% → OGW%
                          </span>
                        )}
                      </div>
                      {format === 'swiss' ? renderSwissStandings() : renderLeaderboard()}
                    </div>
                  )}

                  {/* Matches View */}
                  {format !== 'leaderboard' && (
                    <div>
                      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
                        <h3 className="text-xl sm:text-2xl font-black text-white">Partidas</h3>
                        
                        {/* Pagination / Round Control */}
                        {format === 'single_elimination' || format === 'round_robin' || (format === 'swiss' && swissPhase !== 'swiss') ? (
                          <div className="flex items-center gap-3 bg-[#242424] px-3 py-1.5 rounded-xl border border-[#333]">
                            <button 
                              onClick={() => setCurrentRound(Math.max(1, currentRound - 1))}
                              disabled={currentRound === 1}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                            >
                              <ChevronLeft size={18} />
                            </button>
                            <span className="font-bold text-white text-xs sm:text-sm">Rodada {currentRound} de {totalRounds}</span>
                            <button 
                              onClick={() => setCurrentRound(Math.min(totalRounds, currentRound + 1))}
                              disabled={currentRound === totalRounds}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                            >
                              <ChevronRight size={18} />
                            </button>
                          </div>
                        ) : format === 'swiss' && swissPhase === 'swiss' ? (
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-white bg-[#242424] px-3 py-1.5 rounded-xl border border-[#333] text-xs">
                              Rodada {currentRound} de {totalRounds}
                            </span>
                            {currentRound < totalRounds ? (
                              <button 
                                onClick={advanceSwissRound}
                                className="bg-[#a855f7] hover:bg-[#9333ea] text-white px-4 py-1.5 rounded-xl font-bold text-xs transition shadow-lg"
                              >
                                Próxima Rodada
                              </button>
                            ) : (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => generateSwissPlayoffs('top4')}
                                  className="bg-[#a855f7] hover:bg-[#9333ea] text-white px-3 py-1.5 rounded-xl font-bold text-xs transition shadow-lg"
                                >
                                  Mata-mata (Top 4)
                                </button>
                                <button 
                                  onClick={() => generateSwissPlayoffs('top2')}
                                  className="bg-[#a855f7] hover:bg-[#9333ea] text-white px-3 py-1.5 rounded-xl font-bold text-xs transition shadow-lg"
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

      {/* MODAL COMPARTILHAR TORNEIO */}
      {showShareModal && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1f1f1f] border border-slate-700 w-full max-w-lg rounded-2xl p-6 text-white space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/40">
                  <Share2 size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">Compartilhar Torneio</h3>
                  <p className="text-xs text-slate-400">Qualquer jogador pode abrir este link para acompanhar e vincular sua conta</p>
                </div>
              </div>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 block">Link de Acesso Direto</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={getTournamentShareUrl(tournamentId)}
                  className="flex-1 bg-black border border-slate-700 rounded-xl p-3 text-xs font-mono text-purple-300 overflow-hidden text-ellipsis"
                />
                <button
                  onClick={handleCopyShareLink}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shrink-0"
                >
                  {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-1.5 text-slate-300">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-400" /> Como funciona:
              </p>
              <p>• Ao abrir o link, o participante pode clicar em <b>"Vincular Minha Conta"</b> no nome dele.</p>
              <p>• Quando o campeonato for finalizado, a vitória e pódio serão somados automaticamente no <b>Histórico de Campeonatos</b> do perfil dele!</p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SENHA TORNEIO OFICIAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[130] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1f1f1f] border-2 border-amber-500/80 w-full max-w-md rounded-2xl p-6 text-white space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Crown size={22} className="fill-slate-950" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">Selo de Torneio Oficial</h3>
                  <span className="text-[10px] text-amber-400 font-bold uppercase">Acesso Restrito ao Criador</span>
                </div>
              </div>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Torneios oficiais concedem o selo dourado de autenticidade e ficam permanentemente destacados no Hall da Fama e histórico dos jogadores.
              <br /><br />
              Para validar o selo oficial, insira a senha da sua conta de criador:
              <br />
              <b className="text-amber-300 font-mono text-[11px]">({OFFICIAL_ADMIN_EMAIL})</b>
            </p>

            <div className="space-y-2">
              <input 
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmOfficialPassword()}
                placeholder="Senha da conta pessoal..."
                className="w-full bg-black border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-amber-400 outline-none font-mono"
                autoFocus
              />
              {passwordError && (
                <p className="text-xs text-red-400 flex items-center gap-1 font-medium">
                  <ShieldAlert size={13} /> {passwordError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmOfficialPassword}
                disabled={!passwordInput || isVerifyingPassword}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs transition shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {isVerifyingPassword ? 'Validando...' : 'Autenticar Selo Oficial'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PÓDIO / CELEBRAÇÃO FINAL */}
      {showCelebrationModal && (
        <div className="fixed inset-0 z-[140] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12141c] border-2 border-amber-500/80 w-full max-w-2xl rounded-3xl p-6 sm:p-8 text-white space-y-6 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowCelebrationModal(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X size={24} />
            </button>

            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 flex items-center justify-center mx-auto shadow-xl shadow-amber-950/80 border-2 border-yellow-200">
              <Trophy size={36} className="fill-slate-950" />
            </div>

            <div>
              <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                isOfficial 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {isOfficial ? 'TORNEIO OFICIAL FINALIZADO' : 'CAMPEONATO CONCLUÍDO'}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-white mt-2">
                {name || 'Torneio Light Dark TCG'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Classificação final registrada com sucesso no histórico dos jogadores!
              </p>
            </div>

            {/* PÓDIO */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {/* Campeão */}
              {finalStandings[0] && (
                <div className="sm:order-2 bg-gradient-to-b from-amber-950/80 via-slate-900 to-slate-950 border-2 border-amber-400 rounded-2xl p-4 flex flex-col items-center shadow-lg">
                  <div className="w-12 h-12 rounded-full bg-amber-500 text-slate-950 font-black text-lg flex items-center justify-center mb-2 shadow-md">
                    <Crown size={22} className="fill-slate-950" />
                  </div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-amber-400">1º Lugar</span>
                  <span className="font-black text-base text-white truncate max-w-full">{finalStandings[0].participantName}</span>
                  <span className="text-xs text-amber-300 font-mono mt-0.5">
                    {finalStandings[0].points} pts ({finalStandings[0].wins}V - {finalStandings[0].losses}D)
                    {finalStandings[0].omw !== undefined && ` • ${(finalStandings[0].omw * 100).toFixed(1)}% OMW`}
                  </span>
                </div>
              )}

              {/* Vice */}
              {finalStandings[1] && (
                <div className="sm:order-1 bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-slate-300 text-slate-950 font-black text-sm flex items-center justify-center mb-2 shadow-md">
                    <Medal size={20} className="fill-slate-950" />
                  </div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">2º Lugar</span>
                  <span className="font-bold text-sm text-white truncate max-w-full">{finalStandings[1].participantName}</span>
                  <span className="text-xs text-slate-400 font-mono mt-0.5">
                    {finalStandings[1].points} pts ({finalStandings[1].wins}V - {finalStandings[1].losses}D)
                    {finalStandings[1].omw !== undefined && ` • ${(finalStandings[1].omw * 100).toFixed(1)}% OMW`}
                  </span>
                </div>
              )}

              {/* 3º Lugar */}
              {finalStandings[2] && (
                <div className="sm:order-3 bg-slate-900 border border-slate-700 rounded-2xl p-4 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-amber-800 text-amber-200 font-black text-sm flex items-center justify-center mb-2 shadow-md">
                    <Medal size={20} className="fill-amber-200" />
                  </div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">3º Lugar</span>
                  <span className="font-bold text-sm text-white truncate max-w-full">{finalStandings[2].participantName}</span>
                  <span className="text-xs text-slate-400 font-mono mt-0.5">
                    {finalStandings[2].points} pts ({finalStandings[2].wins}V - {finalStandings[2].losses}D)
                    {finalStandings[2].omw !== undefined && ` • ${(finalStandings[2].omw * 100).toFixed(1)}% OMW`}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  setShowCelebrationModal(false);
                  setShowHistoryModal(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-md"
              >
                Ver Meu Histórico de Campeonatos
              </button>
              <button
                onClick={() => setShowCelebrationModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
              >
                Voltar à Chave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SELECIONAR PARTICIPANTE PARA VINCULAR CONTA */}
      {showPickParticipantModal && (
        <div className="fixed inset-0 z-[125] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1b1e28] border border-purple-500/40 w-full max-w-md rounded-2xl p-6 text-white space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Link2 size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">Vincular Minha Conta</h3>
                  <p className="text-xs text-slate-400">Escolha qual participante representa você neste torneio</p>
                </div>
              </div>
              <button onClick={() => setShowPickParticipantModal(false)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-300">
              Conectado como: <b className="text-white">{user?.displayName || 'Jogador'}</b> {user?.email ? `(${user.email})` : ''}
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {participants.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Nenhum participante adicionado ainda.</p>
              ) : (
                participants.map(p => {
                  const isCurrent = p.userId === user?.uid;
                  const isTaken = !!p.userId && !isCurrent;
                  const isNameMatch = user?.displayName && p.name.trim().toLowerCase() === user.displayName.trim().toLowerCase();

                  return (
                    <div 
                      key={p.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                        isCurrent 
                          ? 'bg-emerald-950/40 border-emerald-500/60'
                          : isTaken
                          ? 'bg-slate-900/40 border-slate-800 opacity-60'
                          : isNameMatch
                          ? 'bg-purple-950/50 border-purple-500/60 hover:border-purple-400'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white truncate">{p.name}</span>
                          {isNameMatch && !p.userId && (
                            <span className="text-[9px] px-2 py-0.2 rounded-full bg-purple-600/50 text-purple-200 border border-purple-400/40 font-bold">
                              Seu Nome
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {isCurrent ? 'Já vinculado à sua conta' : isTaken ? `Vinculado a outro jogador` : 'Disponível para vincular'}
                        </span>
                      </div>

                      {isCurrent ? (
                        <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                          <CheckCircle size={14} /> Ativo
                        </span>
                      ) : isTaken ? (
                        <span className="text-slate-500 text-xs font-medium">Ocupado</span>
                      ) : (
                        <button
                          onClick={() => handleSelectMyParticipant(p.id)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition active:scale-95 shadow-md shadow-purple-950/40"
                        >
                          Sou Eu
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Opção de adicionar a si mesmo se antes do início */}
            {!tournamentStarted && user && !myLinkedParticipant && (
              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={handleAddMyselfAndLink}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Plus size={14} />
                  <span>Entrar como Novo Participante ({user.displayName || 'Eu'})</span>
                </button>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowPickParticipantModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HISTORICO DE CAMPEONATOS */}
      <ChampionshipHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        onOpenTournament={(id) => {
          setTournamentId(id);
          setShowHistoryModal(false);
        }}
        onOpenAuth={onOpenAuth}
      />

    </div>
  );
};
