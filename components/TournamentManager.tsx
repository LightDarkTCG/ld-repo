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
  Medal,
  Video,
  Gavel,
  Calendar,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  Tv,
  Radio,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../authService';
import { CardData } from '../cardService';
import { 
  TournamentData, 
  TournamentPrizes,
  Participant, 
  Match, 
  Referee,
  FinalStanding,
  LiveRoomSummary,
  saveTournamentToCloud, 
  subscribeTournament, 
  subscribeTournamentLiveRooms,
  setTournamentMatchLiveStatus,
  linkPlayerAccountToParticipant, 
  registerGuestPlayerInTournament,
  finalizeTournamentAndRecordHistory, 
  verifyOfficialTournamentPassword, 
  getTournamentShareUrl,
  calculateSwissTiebreakers,
  sortSwissParticipants,
  SwissTiebreakerStats,
  calculateDynamicLeagueDelta,
  OFFICIAL_ADMIN_EMAIL 
} from '../tournamentService';
import { ChampionshipHistoryModal } from './ChampionshipHistoryModal';
import { OnlineDuelBroadcastModal } from './OnlineDuelBroadcastModal';

interface TournamentManagerProps {
  onClose: () => void;
  initialTournamentId?: string;
  onOpenAuth?: () => void;
  allCards?: CardData[];
  tourForceTab?: 'config' | 'participants' | 'bracket';
}

export const TournamentManager: React.FC<TournamentManagerProps> = ({ 
  onClose, 
  initialTournamentId,
  onOpenAuth,
  allCards = [],
  tourForceTab
}) => {
  const { user } = useAuth();
  
  // Detecta se o acesso veio através do Link de Convidados (?torneio=...&convite=1)
  const [isInviteLinkMode, setIsInviteLinkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const sp = new URLSearchParams(window.location.search);
    return sp.get('convite') === '1' || sp.get('guest') === '1';
  });

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<'config' | 'participants' | 'bracket'>(() => {
    if (tourForceTab) return tourForceTab;
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('convite') === '1' || sp.get('guest') === '1') {
        return 'participants';
      }
    }
    return 'config';
  });

  const [isTopBarMinimized, setIsTopBarMinimized] = useState(false);

  useEffect(() => {
    if (tourForceTab) {
      setIsTopBarMinimized(false);
      setActiveTab(tourForceTab);
    }
  }, [tourForceTab]);

  // Tournament Identity & Persistence
  const [tournamentId, setTournamentId] = useState<string>(() => {
    const newId = initialTournamentId || `ldt_t_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    if (!initialTournamentId && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`ldt_creator_${newId}`, 'true');
      } catch {}
    }
    return newId;
  });
  const [creatorId, setCreatorId] = useState<string>('');
  const [isOfficial, setIsOfficial] = useState(false);
  const [status, setStatus] = useState<'draft' | 'in_progress' | 'completed'>('draft');
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);

  // Config State: Nome, Formato, Datas (Início e Fim) e Premiações (Top 1 / 2 / 3 e 4 a 8)
  const [name, setName] = useState('');
  const [format, setFormat] = useState('liga_pontos');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [prizes, setPrizes] = useState<TournamentPrizes>({
    top1: '',
    top2: '',
    top3: '',
    top4to8: ''
  });
  
  // Swiss Options (Regras Oficiais Magic: 3 pts vitória / 1 pt empate / 3 pts Bye)
  const [swissPtsWin, setSwissPtsWin] = useState('3.0');
  const [swissPtsTie, setSwissPtsTie] = useState('1.0');
  const [swissPtsBye, setSwissPtsBye] = useState('3.0');
  const [swissRounds, setSwissRounds] = useState('3');
  const [swissPhase, setSwissPhase] = useState<'swiss' | 'top4' | 'top2'>('swiss');

  // Liga (Pontos de Liga Dinâmicos, Bônus de Vitória, Penalidade por Inatividade & Entrada Contínua)
  const [leagueInitialPoints, setLeagueInitialPoints] = useState<number>(1000);
  const [leagueKFactor, setLeagueKFactor] = useState<number>(48);
  const [leagueWinBonusPoints, setLeagueWinBonusPoints] = useState<number>(15);
  const [leagueInactivityPenaltyEnabled, setLeagueInactivityPenaltyEnabled] = useState<boolean>(true);
  const [leagueInactivityPenaltyPointsPerWeek, setLeagueInactivityPenaltyPointsPerWeek] = useState<number>(30);
  const [allowLateJoin, setAllowLateJoin] = useState<boolean>(true);
  const [newDuelP1Id, setNewDuelP1Id] = useState<string>('');
  const [newDuelP2Id, setNewDuelP2Id] = useState<string>('');
  const [newDuelRefereeName, setNewDuelRefereeName] = useState<string>('');
  const [newDuelScheduledAt, setNewDuelScheduledAt] = useState<string>('');
  const [lateJoinPlayerName, setLateJoinPlayerName] = useState<string>('');
  const [guestJoinName, setGuestJoinName] = useState<string>('');
  const [isJoiningAsGuest, setIsJoiningAsGuest] = useState<boolean>(false);

  // Lançamento de Partida Manual / Presencial (Conta do Jogador 1 x Conta do Jogador 2 / Resultado / Nome do Juiz)
  const [manualMatchP1Id, setManualMatchP1Id] = useState<string>('');
  const [manualMatchP2Id, setManualMatchP2Id] = useState<string>('');
  const [manualMatchResult, setManualMatchResult] = useState<string>('2-0');
  const [manualMatchRefereeName, setManualMatchRefereeName] = useState<string>('');
  const [manualMatchDateStr, setManualMatchDateStr] = useState<string>('');

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

  // Copa por Pontos Corridos & Liga: Juízes Registrados & Agenda de Duelos & Estúdio Online
  const [referees, setReferees] = useState<Referee[]>([]);
  const [newRefereeName, setNewRefereeName] = useState('');
  const [newRefereeRole, setNewRefereeRole] = useState('Juiz Oficial');
  const [scheduleFilterRound, setScheduleFilterRound] = useState<number | 'all'>('all');
  const [activeOnlineDuelMatch, setActiveOnlineDuelMatch] = useState<Match | null>(null);
  const [initialBroadcastRole, setInitialBroadcastRole] = useState<'p1' | 'p2' | 'admin' | 'spectator' | undefined>(undefined);
  const [liveRoomsByMatchId, setLiveRoomsByMatchId] = useState<Record<string, LiveRoomSummary>>({});

  const isLeagueMode = format === 'liga_pontos';
  const canLateJoin = isLeagueMode || allowLateJoin;

  // Verifica se o usuário atual é o criador/organizador real deste campeonato
  const isLocalCreator =
    typeof window !== 'undefined' && localStorage.getItem(`ldt_creator_${tournamentId}`) === 'true';
  const isOfficialAdmin = Boolean(
    user?.email && user.email.toLowerCase() === OFFICIAL_ADMIN_EMAIL.toLowerCase()
  );
  const isCloudCreator = Boolean(user?.uid && creatorId && user.uid === creatorId);
  const isOrganizer =
    isOfficialAdmin || isCloudCreator || isLocalCreator || (!initialTournamentId && !isCloudLoaded);

  // Se abriu pelo link de convidado (&convite=1) ou se não é o organizador, fica bloqueado no Modo Convidado (sem acesso a configurações)
  const canConfigure = isOrganizer && !isInviteLinkMode;
  const isAdminOrCreator = canConfigure;

  // Garante que convidados nunca fiquem na aba 'config'
  useEffect(() => {
    if (!canConfigure && activeTab === 'config') {
      setActiveTab(tournamentStarted ? 'bracket' : 'participants');
    }
  }, [canConfigure, activeTab, tournamentStarted]);

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

  // Inscrição direta pelo link de convidado (com ou sem conta Google logada)
  const handleGuestJoinTournament = async (customName?: string) => {
    const targetName = (customName ?? guestJoinName).trim() || user?.displayName || '';
    if (!targetName) {
      if (!user && onOpenAuth) {
        onOpenAuth();
      }
      return;
    }

    setIsJoiningAsGuest(true);
    try {
      const newP = await registerGuestPlayerInTournament(tournamentId, targetName, user);
      setParticipants((prev) => {
        if (prev.some((p) => p.id === newP.id || (user?.uid && p.userId === user.uid))) {
          return prev;
        }
        return [...prev, newP];
      });
      setGuestJoinName('');
      setLinkSuccessMessage(
        format === 'liga_pontos'
          ? `Inscrição confirmada! "${newP.name}" entrou na Liga com ${newP.points} PDL!`
          : `Inscrição confirmada! "${newP.name}" entrou no campeonato!`
      );
      setTimeout(() => setLinkSuccessMessage(null), 4000);
    } catch (err) {
      // Fallback caso o organizador ainda não tenha persistido o documento inicial
      const startPts = format === 'liga_pontos' ? leagueInitialPoints : 0;
      const fallbackP: Participant = {
        id: Math.random().toString(36).substr(2, 9),
        seed: participants.length + 1,
        name: targetName,
        points: startPts,
        wins: 0,
        losses: 0,
        ties: 0,
        matchesPlayed: 0,
        userId: user?.uid,
        userEmail: user?.email || undefined,
        userPhoto: user?.photoURL || undefined
      };
      const next = [...participants, fallbackP];
      setParticipants(next);
      await saveTournamentToCloud({
        id: tournamentId,
        name: name || 'Torneio Light Dark TCG',
        format: format as any,
        participants: next
      });
      setGuestJoinName('');
      setLinkSuccessMessage(`Inscrição confirmada! "${targetName}" entrou no campeonato!`);
      setTimeout(() => setLinkSuccessMessage(null), 4000);
    } finally {
      setIsJoiningAsGuest(false);
    }
  };

  const handleAddMyselfAndLink = async () => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    if (!canConfigure) {
      await handleGuestJoinTournament(user.displayName || 'Jogador');
      setShowPickParticipantModal(false);
      return;
    }
    const myName = user.displayName || 'Jogador';
    const startPts = format === 'liga_pontos' ? leagueInitialPoints : 0;
    const newP: Participant = {
      id: Math.random().toString(36).substr(2, 9),
      seed: participants.length + 1,
      name: myName,
      points: startPts, wins: 0, losses: 0, ties: 0, matchesPlayed: 0,
      userId: user.uid,
      userEmail: user.email || undefined,
      userPhoto: user.photoURL || undefined
    };
    const next = [...participants, newP];
    setParticipants(next);
    persistTournament({ participants: next });
    setLinkSuccessMessage(
      format === 'liga_pontos'
        ? `Você entrou na Liga com ${startPts} PDL (Pontos de Liga) e sua conta foi vinculada!`
        : `Você entrou no torneio e sua conta foi vinculada com sucesso!`
    );
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
      setFormat(data.format || 'liga_pontos');
      if (data.creatorId) setCreatorId(data.creatorId);
      setIsOfficial(!!data.isOfficial);
      setStatus(data.status || 'draft');
      if (data.startDate !== undefined) setStartDate(data.startDate || '');
      if (data.endDate !== undefined) setEndDate(data.endDate || '');
      if (data.prizes) {
        setPrizes({
          top1: data.prizes.top1 || '',
          top2: data.prizes.top2 || '',
          top3: data.prizes.top3 || '',
          top4to8: data.prizes.top4to8 || ''
        });
      }
      setCurrentRound(data.currentRound || 1);
      setTotalRounds(data.totalRounds || 1);
      setParticipants(data.participants || []);
      setMatches(data.matches || []);
      setReferees(data.referees || []);
      if (typeof data.leagueInitialPoints === 'number') setLeagueInitialPoints(data.leagueInitialPoints);
      if (typeof data.leagueKFactor === 'number') setLeagueKFactor(data.leagueKFactor);
      if (typeof data.leagueWinBonusPoints === 'number') setLeagueWinBonusPoints(data.leagueWinBonusPoints);
      if (typeof data.leagueInactivityPenaltyEnabled === 'boolean') setLeagueInactivityPenaltyEnabled(data.leagueInactivityPenaltyEnabled);
      if (typeof data.leagueInactivityPenaltyPointsPerWeek === 'number') setLeagueInactivityPenaltyPointsPerWeek(data.leagueInactivityPenaltyPointsPerWeek);
      if (typeof data.allowLateJoin === 'boolean') setAllowLateJoin(data.allowLateJoin);
      if (data.finalStandings) setFinalStandings(data.finalStandings);
      if (data.swissPtsWin) setSwissPtsWin(data.swissPtsWin);
      if (data.swissPtsTie) setSwissPtsTie(data.swissPtsTie);
      if (data.swissPtsBye) setSwissPtsBye(data.swissPtsBye);
      if (data.swissRounds) setSwissRounds(data.swissRounds);
      if (data.swissPhase) setSwissPhase(data.swissPhase);
      if (data.status === 'in_progress' || data.status === 'completed') {
        setTournamentStarted(true);
        // Se for convidado e ainda não estiver inscrito numa Liga, mantém na aba de inscrição ou chave
        setActiveTab((prev) => (prev === 'config' ? 'bracket' : prev));
      }
      setIsCloudLoaded(true);
      setTimeout(() => {
        isIncomingUpdate.current = false;
      }, 300);
    });

    return () => unsubscribe();
  }, [tournamentId]);

  // Escuta em tempo real as salas de transmissão ao vivo (duelRooms) deste campeonato para exibir aos convidados
  useEffect(() => {
    if (!tournamentId) return;
    const unsubLive = subscribeTournamentLiveRooms(tournamentId, (map) => {
      setLiveRoomsByMatchId(map);
    });
    return () => unsubLive();
  }, [tournamentId]);

  const isMatchCurrentlyLive = (m: Match): boolean => {
    if (!m || m.isBye || m.status === 'completed') return false;
    const liveRoom = liveRoomsByMatchId[m.id];
    return Boolean(m.isLive || liveRoom?.isLiveBroadcast || liveRoom?.hasActiveCamera);
  };

  const handleOpenMatchBroadcast = (
    m: Match,
    explicitRole?: 'p1' | 'p2' | 'admin' | 'spectator'
  ) => {
    if (explicitRole) {
      setInitialBroadcastRole(explicitRole);
    } else if (!canConfigure) {
      // Se for o próprio jogador vinculado à partida, entra na visão dele; caso contrário, convidado assiste como espectador!
      if (user?.uid && m.player1?.userId === user.uid) {
        setInitialBroadcastRole('p1');
      } else if (user?.uid && m.player2?.userId === user.uid) {
        setInitialBroadcastRole('p2');
      } else {
        setInitialBroadcastRole('spectator');
      }
    } else {
      setInitialBroadcastRole(undefined);
    }
    setActiveOnlineDuelMatch(m);
  };

  const handleUpdateMatchLiveFlag = async (matchId: string, nextLive: boolean) => {
    setMatches((prev) =>
      prev.map((m) => (m.id === matchId ? { ...m, isLive: nextLive } : m))
    );
    await setTournamentMatchLiveStatus(tournamentId, matchId, nextLive);
  };

  // Salva no Firestore quando houver modificação local do organizador
  const persistTournament = async (override?: Partial<TournamentData>) => {
    if (isIncomingUpdate.current) return;
    setIsSavingCloud(true);
    try {
      if (typeof window !== 'undefined' && isOrganizer) {
        try {
          localStorage.setItem(`ldt_creator_${tournamentId}`, 'true');
        } catch {}
      }
      const effectiveCreatorId = creatorId || user?.uid || 'organizer';
      if (!creatorId && effectiveCreatorId) setCreatorId(effectiveCreatorId);

      const payload: Partial<TournamentData> & { id: string } = {
        id: tournamentId,
        name: name || 'Torneio Light Dark TCG',
        format: format as any,
        isOfficial,
        creatorId: effectiveCreatorId,
        creatorName: user?.displayName || 'Organizador',
        creatorEmail: user?.email || '',
        status: tournamentStarted ? (status === 'completed' ? 'completed' : 'in_progress') : 'draft',
        startDate,
        endDate,
        prizes,
        currentRound,
        totalRounds,
        swissPtsWin,
        swissPtsTie,
        swissPtsBye,
        swissRounds,
        swissPhase,
        referees,
        leagueInitialPoints,
        leagueKFactor,
        leagueWinBonusPoints,
        leagueInactivityPenaltyEnabled,
        leagueInactivityPenaltyPointsPerWeek,
        allowLateJoin,
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

  // Adição de participantes (Suporta entrada de novos jogadores durante o campeonato na Liga)
  const handleAddParticipant = (customName?: string) => {
    const targetName = (customName ?? newParticipantName).trim();
    if (!targetName) return;
    
    // Se o nome for o do próprio usuário logado, já pode vincular automaticamente
    const isMe = user && (user.displayName === targetName);
    const startPoints = format === 'liga_pontos' ? leagueInitialPoints : 0;

    const newP: Participant = {
      id: Math.random().toString(36).substr(2, 9),
      seed: participants.length + 1,
      name: targetName,
      points: startPoints,
      wins: 0,
      losses: 0,
      ties: 0,
      matchesPlayed: 0,
      userId: isMe ? user.uid : undefined,
      userEmail: isMe ? user.email || undefined : undefined,
      userPhoto: isMe ? user.photoURL || undefined : undefined
    };
    const next = [...participants, newP];
    setParticipants(next);
    if (customName !== undefined) {
      setLateJoinPlayerName('');
    } else {
      setNewParticipantName('');
    }
    persistTournament({ participants: next });
    if (tournamentStarted) {
      setLinkSuccessMessage(
        format === 'liga_pontos'
          ? `Novo jogador "${targetName}" entrou na Liga com ${startPoints} PDL!`
          : `Novo jogador "${targetName}" adicionado ao campeonato!`
      );
      setTimeout(() => setLinkSuccessMessage(null), 3500);
    }
  };

  const handleBulkAdd = () => {
    if (!bulkAddText.trim()) return;
    const names = bulkAddText.split('\n').filter(n => n.trim() !== '');
    const startPoints = format === 'liga_pontos' ? leagueInitialPoints : 0;
    const newPs = names.map((n, i) => ({
      id: Math.random().toString(36).substr(2, 9),
      seed: participants.length + i + 1,
      name: n.trim(),
      points: startPoints,
      wins: 0,
      losses: 0,
      ties: 0,
      matchesPlayed: 0
    }));
    const next = [...participants, ...newPs];
    setParticipants(next);
    setBulkAddText('');
    setIsBulkAdd(false);
    persistTournament({ participants: next });
  };

  // Agendar um novo duelo manualmente (usado na Liga ou quando novos jogadores entram durante o campeonato)
  const handleCreateCustomLeagueDuel = () => {
    if (!newDuelP1Id || !newDuelP2Id || newDuelP1Id === newDuelP2Id) return;
    const p1 = participants.find((p) => p.id === newDuelP1Id);
    const p2 = participants.find((p) => p.id === newDuelP2Id);
    if (!p1 || !p2) return;

    const chosenRef = referees.find((r) => r.name === newDuelRefereeName || r.id === newDuelRefereeName);
    const defaultRef = chosenRef || (referees.length > 0 ? referees[matches.length % referees.length] : undefined);
    const mId = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

    const newMatch: Match = {
      id: mId,
      round: currentRound || 1,
      player1: p1,
      player2: p2,
      score1: null,
      score2: null,
      winnerId: null,
      status: 'pending',
      bestOf: 3,
      refereeId: defaultRef?.id,
      refereeName: newDuelRefereeName.trim() || defaultRef?.name || '',
      scheduledAt: newDuelScheduledAt.trim() || undefined,
      liveRoomId: `live_${tournamentId}_${mId}`
    };

    const nextMatches = [newMatch, ...matches];
    setMatches(nextMatches);
    setNewDuelScheduledAt('');
    persistTournament({ matches: nextMatches });
    setLinkSuccessMessage(`Duelo agendado na Liga: ${p1.name} vs ${p2.name}!`);
    setTimeout(() => setLinkSuccessMessage(null), 3000);
  };

  // Lançar Partida Presencial / Manualmente já com Resultado e Juiz (Conta do Jogador 1 x Conta do Jogador 2 / Resultado / Nome do Juiz)
  const handleRecordManualMatch = () => {
    if (!manualMatchP1Id || !manualMatchP2Id || manualMatchP1Id === manualMatchP2Id) return;
    const p1 = participants.find((p) => p.id === manualMatchP1Id);
    const p2 = participants.find((p) => p.id === manualMatchP2Id);
    if (!p1 || !p2) return;

    const chosenRef = referees.find(
      (r) => r.name === manualMatchRefereeName || r.id === manualMatchRefereeName
    );
    const finalRefName = manualMatchRefereeName.trim() || chosenRef?.name || '';
    const mId = `m_manual_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

    let s1 = 0;
    let s2 = 0;
    let isWO = false;
    let woWinnerId: string | null = null;
    let winnerId: string | null = null;

    if (manualMatchResult === '2-0') {
      s1 = 2;
      s2 = 0;
      winnerId = p1.id;
    } else if (manualMatchResult === '2-1') {
      s1 = 2;
      s2 = 1;
      winnerId = p1.id;
    } else if (manualMatchResult === '1-1') {
      s1 = 1;
      s2 = 1;
      winnerId = null;
    } else if (manualMatchResult === '1-2') {
      s1 = 1;
      s2 = 2;
      winnerId = p2.id;
    } else if (manualMatchResult === '0-2') {
      s1 = 0;
      s2 = 2;
      winnerId = p2.id;
    } else if (manualMatchResult === 'WO-P1') {
      s1 = 2;
      s2 = 0;
      isWO = true;
      woWinnerId = p1.id;
      winnerId = p1.id;
    } else if (manualMatchResult === 'WO-P2') {
      s1 = 0;
      s2 = 2;
      isWO = true;
      woWinnerId = p2.id;
      winnerId = p2.id;
    }

    let completedAtMs = Date.now();
    if (manualMatchDateStr) {
      const parsedDate = new Date(manualMatchDateStr);
      if (!Number.isNaN(parsedDate.getTime())) {
        completedAtMs = parsedDate.getTime();
      }
    }

    const manualMatch: Match = {
      id: mId,
      round: currentRound || 1,
      player1: p1,
      player2: p2,
      score1: s1,
      score2: s2,
      winnerId,
      status: 'completed',
      bestOf: 3,
      isWO,
      woWinnerId,
      isManualEntry: true,
      refereeId: chosenRef?.id,
      refereeName: finalRefName,
      scheduledAt: manualMatchDateStr ? `Presencial (${formatDateDisplay(manualMatchDateStr)})` : 'Partida Presencial / Manual',
      completedAtMs,
      liveRoomId: `live_${tournamentId}_${mId}`
    };

    const nextMatches = [manualMatch, ...matches];

    if (format === 'copa_pontos_corridos' || format === 'round_robin' || format === 'liga_pontos') {
      const { participants: updatedParticipants, matches: syncedMatches } = recalculateLeagueStandings(
        participants,
        nextMatches
      );
      setMatches(syncedMatches);
      setParticipants(updatedParticipants);
      persistTournament({ matches: syncedMatches, participants: updatedParticipants });
    } else {
      setMatches(nextMatches);
      persistTournament({ matches: nextMatches });
    }

    setLinkSuccessMessage(
      `Partida manual registrada: ${p1.name} (${s1}) x (${s2}) ${p2.name}${finalRefName ? ` • Juiz: ${finalRefName}` : ''}!`
    );
    setTimeout(() => setLinkSuccessMessage(null), 4000);
  };

  // Ajustar manualmente semanas de inatividade de um jogador na Liga (+1 ou -1 semana sem partida)
  const handleAdjustPlayerInactivityWeeks = (participantId: string, deltaWeeks: number) => {
    const preUpdatedParticipants = participants.map((p) => {
      if (p.id !== participantId) return p;
      const currentManual = p.manualPenaltyWeeks || 0;
      return {
        ...p,
        manualPenaltyWeeks: currentManual + deltaWeeks
      };
    });

    const { participants: recalculatedPs, matches: syncedMatches } = recalculateLeagueStandings(
      preUpdatedParticipants,
      matches
    );
    setParticipants(recalculatedPs);
    setMatches(syncedMatches);
    persistTournament({ participants: recalculatedPs, matches: syncedMatches });
  };

  // Pareamento automático na Liga por proximidade de Pontos de Liga (PDL)
  const handleGenerateBalancedLeagueRound = () => {
    if (participants.length < 2) return;
    const sortedByPdl = [...participants].sort((a, b) => b.points - a.points);
    const nextRoundNum = matches.length > 0 ? Math.max(...matches.map((m) => m.round || 1)) + 1 : 1;
    const createdMatches: Match[] = [];

    for (let i = 0; i + 1 < sortedByPdl.length; i += 2) {
      const p1 = sortedByPdl[i];
      const p2 = sortedByPdl[i + 1];
      const defaultRef = referees.length > 0 ? referees[(matches.length + createdMatches.length) % referees.length] : undefined;
      const mId = `m_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 5)}`;

      createdMatches.push({
        id: mId,
        round: nextRoundNum,
        player1: p1,
        player2: p2,
        score1: null,
        score2: null,
        winnerId: null,
        status: 'pending',
        bestOf: 3,
        refereeId: defaultRef?.id,
        refereeName: defaultRef?.name || '',
        liveRoomId: `live_${tournamentId}_${mId}`
      });
    }

    const nextMatches = [...createdMatches, ...matches];
    const nextTotalRounds = Math.max(totalRounds, nextRoundNum);
    setMatches(nextMatches);
    setCurrentRound(nextRoundNum);
    setTotalRounds(nextTotalRounds);
    persistTournament({
      matches: nextMatches,
      currentRound: nextRoundNum,
      totalRounds: nextTotalRounds
    });
    setLinkSuccessMessage(`Nova bateria de ${createdMatches.length} duelo(s) gerada por proximidade de Pontos de Liga!`);
    setTimeout(() => setLinkSuccessMessage(null), 3500);
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

  // --- GERENCIAMENTO DE JUÍZES (COPA POR PONTOS CORRIDOS / TORNEIO) ---
  const handleAddReferee = () => {
    if (!newRefereeName.trim()) return;
    const newRef: Referee = {
      id: `ref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      name: newRefereeName.trim(),
      role: newRefereeRole.trim() || 'Juiz Oficial'
    };
    const nextRefs = [...referees, newRef];
    setReferees(nextRefs);
    setNewRefereeName('');
    persistTournament({ referees: nextRefs });
  };

  const handleRemoveReferee = (refId: string) => {
    const nextRefs = referees.filter((r) => r.id !== refId);
    setReferees(nextRefs);
    persistTournament({ referees: nextRefs });
  };

  const handleAssignMatchReferee = (matchId: string, refIdOrName: string) => {
    const foundRef = referees.find((r) => r.id === refIdOrName || r.name === refIdOrName);
    const updated = matches.map((m) => {
      if (m.id === matchId) {
        return {
          ...m,
          refereeId: foundRef ? foundRef.id : undefined,
          refereeName: foundRef ? foundRef.name : refIdOrName
        };
      }
      return m;
    });
    setMatches(updated);
    persistTournament({ matches: updated });
  };

  const handleUpdateMatchSchedule = (matchId: string, scheduledAt: string) => {
    const updated = matches.map((m) => (m.id === matchId ? { ...m, scheduledAt } : m));
    setMatches(updated);
    persistTournament({ matches: updated });
  };

  // Recalcula pontuação de todos os participantes e deltas das partidas (suporta Liga com Pontos de Liga Dinâmicos / Zebra, Bônus de Vitória, Penalidade por Inatividade Semanal e Copa por Pontos Corridos)
  const recalculateLeagueStandings = (
    currentParticipants: Participant[],
    currentMatches: Match[],
    overrides?: {
      initialPts?: number;
      kFactor?: number;
      winBonusPts?: number;
      inactivityEnabled?: boolean;
      inactivityPtsPerWeek?: number;
    }
  ): { participants: Participant[]; matches: Match[] } => {
    // MODO LIGA POR PONTOS DE LIGA (Rating Dinâmico + Bônus de Vitória + Penalidade Semanal por Inatividade)
    if (format === 'liga_pontos') {
      const startPts = overrides?.initialPts ?? (leagueInitialPoints || 1000);
      const kVal = overrides?.kFactor ?? (leagueKFactor || 48);
      const winBonusVal = overrides?.winBonusPts ?? (leagueWinBonusPoints ?? 0);
      const inactivityOn = overrides?.inactivityEnabled ?? leagueInactivityPenaltyEnabled;
      const penaltyPerWeek = overrides?.inactivityPtsPerWeek ?? (leagueInactivityPenaltyPointsPerWeek || 0);

      const stats = new Map<
        string,
        {
          points: number;
          wins: number;
          losses: number;
          ties: number;
          matchesPlayed: number;
          lastMatchAtMs?: number;
          inactivityWeeks: number;
          inactivityPenaltyTotal: number;
        }
      >();

      currentParticipants.forEach((p) => {
        stats.set(p.id, {
          points: startPts,
          wins: 0,
          losses: 0,
          ties: 0,
          matchesPlayed: 0,
          lastMatchAtMs: undefined,
          inactivityWeeks: 0,
          inactivityPenaltyTotal: 0
        });
      });

      // Ordena partidas concluídas cronologicamente para cálculo sequencial de rating
      const completedOrder = currentMatches
        .filter((m) => m.status === 'completed' && !m.isBye && m.player1 && m.player2)
        .sort((a, b) => (a.completedAtMs || 0) - (b.completedAtMs || 0));

      const matchDeltaInfo = new Map<
        string,
        {
          p1LeagueDelta: number;
          p2LeagueDelta: number;
          p1PointsBefore: number;
          p2PointsBefore: number;
          p1PointsAfter: number;
          p2PointsAfter: number;
        }
      >();

      for (const m of completedOrder) {
        if (!m.player1 || !m.player2) continue;
        const s1 = stats.get(m.player1.id) || {
          points: startPts,
          wins: 0,
          losses: 0,
          ties: 0,
          matchesPlayed: 0,
          lastMatchAtMs: undefined,
          inactivityWeeks: 0,
          inactivityPenaltyTotal: 0
        };
        const s2 = stats.get(m.player2.id) || {
          points: startPts,
          wins: 0,
          losses: 0,
          ties: 0,
          matchesPlayed: 0,
          lastMatchAtMs: undefined,
          inactivityWeeks: 0,
          inactivityPenaltyTotal: 0
        };

        const p1Before = s1.points;
        const p2Before = s2.points;

        let outcome: 'p1_win' | 'p2_win' | 'tie' = 'tie';
        if (m.isWO && m.woWinnerId) {
          outcome = m.woWinnerId === m.player1.id ? 'p1_win' : 'p2_win';
        } else {
          const sc1 = m.score1 ?? 0;
          const sc2 = m.score2 ?? 0;
          if (sc1 > sc2) outcome = 'p1_win';
          else if (sc2 > sc1) outcome = 'p2_win';
          else outcome = 'tie';
        }

        const { delta1, delta2 } = calculateDynamicLeagueDelta(
          p1Before,
          p2Before,
          outcome,
          kVal,
          winBonusVal
        );

        s1.points = Math.max(100, p1Before + delta1);
        s2.points = Math.max(100, p2Before + delta2);
        s1.matchesPlayed += 1;
        s2.matchesPlayed += 1;

        const matchTime = m.completedAtMs || Date.now();
        s1.lastMatchAtMs = Math.max(s1.lastMatchAtMs || 0, matchTime);
        s2.lastMatchAtMs = Math.max(s2.lastMatchAtMs || 0, matchTime);

        if (outcome === 'p1_win') {
          s1.wins += 1;
          s2.losses += 1;
        } else if (outcome === 'p2_win') {
          s2.wins += 1;
          s1.losses += 1;
        } else {
          s1.ties += 1;
          s2.ties += 1;
        }

        stats.set(m.player1.id, s1);
        stats.set(m.player2.id, s2);

        matchDeltaInfo.set(m.id, {
          p1LeagueDelta: delta1,
          p2LeagueDelta: delta2,
          p1PointsBefore: p1Before,
          p2PointsBefore: p2Before,
          p1PointsAfter: s1.points,
          p2PointsAfter: s2.points
        });
      }

      // Aplica Penalidade por Inatividade Semanal (a cada 7 dias sem partida + ajustes manuais de semanas)
      const nowMs = Date.now();
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      const parsedStartMs = startDate ? new Date(startDate).getTime() : NaN;
      const fallbackStartMs = !Number.isNaN(parsedStartMs) ? parsedStartMs : undefined;

      const nextParticipants = currentParticipants.map((p) => {
        const st = stats.get(p.id);
        if (!st) return p;

        let autoIdleWeeks = 0;
        const refLastActiveMs = st.lastMatchAtMs || p.joinedAtMs || fallbackStartMs;
        if (refLastActiveMs && nowMs > refLastActiveMs) {
          autoIdleWeeks = Math.max(0, Math.floor((nowMs - refLastActiveMs) / ONE_WEEK_MS));
        }

        const totalIdleWeeks = Math.max(0, autoIdleWeeks + (p.manualPenaltyWeeks || 0));
        const penaltyTotal =
          inactivityOn && penaltyPerWeek > 0 ? totalIdleWeeks * penaltyPerWeek : 0;

        const finalPoints = Math.max(100, st.points - penaltyTotal);

        return {
          ...p,
          points: finalPoints,
          wins: st.wins,
          losses: st.losses,
          ties: st.ties,
          matchesPlayed: st.matchesPlayed,
          lastMatchAtMs: st.lastMatchAtMs,
          inactivityWeeks: totalIdleWeeks,
          inactivityPenaltyTotal: penaltyTotal
        };
      });

      const nextMatches = currentMatches.map((m) => {
        if (m.status !== 'completed') {
          return {
            ...m,
            p1LeagueDelta: undefined,
            p2LeagueDelta: undefined,
            p1PointsBefore: undefined,
            p2PointsBefore: undefined,
            p1PointsAfter: undefined,
            p2PointsAfter: undefined
          };
        }
        const info = matchDeltaInfo.get(m.id);
        return info ? { ...m, ...info } : m;
      });

      return { participants: nextParticipants, matches: nextMatches };
    }

    // MODO COPA POR PONTOS CORRIDOS / ROUND ROBIN (Vitória = 3 pts, Empate = 1 pt, W.O. = 3 pts)
    const winPts = format === 'copa_pontos_corridos' ? 3 : parseFloat(swissPtsWin || '3');
    const tiePts = format === 'copa_pontos_corridos' ? 1 : parseFloat(swissPtsTie || '1');
    const stats = new Map<string, { points: number; wins: number; losses: number; ties: number; matchesPlayed: number }>();

    currentParticipants.forEach((p) => {
      stats.set(p.id, { points: 0, wins: 0, losses: 0, ties: 0, matchesPlayed: 0 });
    });

    for (const m of currentMatches) {
      if (m.status !== 'completed') continue;
      if (m.isBye || !m.player1 || !m.player2) continue;

      const s1 = stats.get(m.player1.id);
      const s2 = stats.get(m.player2.id);

      if (m.isWO && m.woWinnerId) {
        if (m.woWinnerId === m.player1.id) {
          if (s1) {
            s1.points += 3;
            s1.wins += 1;
            s1.matchesPlayed += 1;
          }
          if (s2) {
            s2.losses += 1;
            s2.matchesPlayed += 1;
          }
        } else if (m.woWinnerId === m.player2.id) {
          if (s2) {
            s2.points += 3;
            s2.wins += 1;
            s2.matchesPlayed += 1;
          }
          if (s1) {
            s1.losses += 1;
            s1.matchesPlayed += 1;
          }
        }
        continue;
      }

      const sc1 = m.score1 ?? 0;
      const sc2 = m.score2 ?? 0;

      if (sc1 > sc2) {
        if (s1) {
          s1.points += winPts;
          s1.wins += 1;
          s1.matchesPlayed += 1;
        }
        if (s2) {
          s2.losses += 1;
          s2.matchesPlayed += 1;
        }
      } else if (sc2 > sc1) {
        if (s2) {
          s2.points += winPts;
          s2.wins += 1;
          s2.matchesPlayed += 1;
        }
        if (s1) {
          s1.losses += 1;
          s1.matchesPlayed += 1;
        }
      } else {
        if (s1) {
          s1.points += tiePts;
          s1.ties += 1;
          s1.matchesPlayed += 1;
        }
        if (s2) {
          s2.points += tiePts;
          s2.ties += 1;
          s2.matchesPlayed += 1;
        }
      }
    }

    const nextParticipants = currentParticipants.map((p) => {
      const st = stats.get(p.id);
      return st ? { ...p, ...st } : p;
    });

    return { participants: nextParticipants, matches: currentMatches };
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
            isBye: true,
            bestOf: 3
          });
        } else {
          const defaultReferee = referees.length > 0 ? referees[(matchCounter - 1) % referees.length] : undefined;
          const mId = `m_${matchCounter++}`;
          allMatches.push({
            id: mId,
            round,
            player1: p1,
            player2: p2,
            score1: null,
            score2: null,
            winnerId: null,
            status: 'pending',
            bestOf: 3,
            refereeId: defaultReferee?.id,
            refereeName: defaultReferee?.name || '',
            liveRoomId: `live_${tournamentId}_${mId}`
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
    
    // Reset stats (Na Liga, todos iniciam com os Pontos de Liga Iniciais, ex: 1000 PDL)
    const initialPts = format === 'liga_pontos' ? (leagueInitialPoints || 1000) : 0;
    const resetPs = participants.map(p => ({...p, points: initialPts, wins: 0, losses: 0, ties: 0, matchesPlayed: 0}));
    setParticipants(resetPs);
    setMatches([]);
    setCurrentRound(1);
    setTournamentStarted(true);
    setStatus('in_progress');
    setSwissPhase('swiss');

    if (format === 'single_elimination') {
      generateSingleElimination();
    } else if (format === 'round_robin' || format === 'copa_pontos_corridos') {
      generateRoundRobin();
    } else if (format === 'liga_pontos') {
      // Gera a 1ª rodada inicial pareada para a Liga e permite adicionar novos jogadores e novos duelos livremente
      const initialMatches: Match[] = [];
      for (let i = 0; i + 1 < resetPs.length; i += 2) {
        const p1 = resetPs[i];
        const p2 = resetPs[i + 1];
        const defaultReferee = referees.length > 0 ? referees[(i / 2) % referees.length] : undefined;
        const mId = `m_${i / 2 + 1}`;
        initialMatches.push({
          id: mId,
          round: 1,
          player1: p1,
          player2: p2,
          score1: null,
          score2: null,
          winnerId: null,
          status: 'pending',
          bestOf: 3,
          refereeId: defaultReferee?.id,
          refereeName: defaultReferee?.name || '',
          liveRoomId: `live_${tournamentId}_${mId}`
        });
      }
      setMatches(initialMatches);
      setTotalRounds(1);
      persistTournament({
        participants: resetPs,
        matches: initialMatches,
        totalRounds: 1,
        status: 'in_progress'
      });
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
          score2: p2Score === '' ? null : parseInt(p2Score),
          isWO: false,
          woWinnerId: null
        };
      }
      return m;
    });
    setMatches(updated);
    persistTournament({ matches: updated });
  };

  // Define resultado rápido MD3 ou W.O. para Copa por Pontos Corridos ou Liga (recalcula tabela e PDL automaticamente)
  const handleSetMatchResult = (
    matchId: string,
    score1: number,
    score2: number,
    options?: { isWO?: boolean; woWinnerId?: string | null; markCompleted?: boolean }
  ) => {
    const isWO = Boolean(options?.isWO);
    const woWinnerId = options?.woWinnerId ?? null;
    const markCompleted = options?.markCompleted !== false;

    const updatedMatches = matches.map((m) => {
      if (m.id !== matchId) return m;
      let winnerId: string | null = null;
      if (isWO && woWinnerId) {
        winnerId = woWinnerId;
      } else if (score1 > score2) {
        winnerId = m.player1?.id || null;
      } else if (score2 > score1) {
        winnerId = m.player2?.id || null;
      }
      return {
        ...m,
        score1,
        score2,
        isWO,
        woWinnerId,
        winnerId,
        completedAtMs: markCompleted ? (m.completedAtMs || Date.now()) : m.completedAtMs,
        status: markCompleted ? ('completed' as const) : m.status
      };
    });

    if (format === 'copa_pontos_corridos' || format === 'round_robin' || format === 'liga_pontos') {
      const { participants: updatedParticipants, matches: syncedMatches } = recalculateLeagueStandings(participants, updatedMatches);
      setMatches(syncedMatches);
      setParticipants(updatedParticipants);
      persistTournament({ matches: syncedMatches, participants: updatedParticipants });
    } else {
      setMatches(updatedMatches);
      persistTournament({ matches: updatedMatches });
    }
  };

  const handleReopenMatch = (matchId: string) => {
    const updatedMatches = matches.map((m) =>
      m.id === matchId
        ? {
            ...m,
            status: 'pending' as const,
            winnerId: null,
            isWO: false,
            woWinnerId: null,
            p1LeagueDelta: undefined,
            p2LeagueDelta: undefined
          }
        : m
    );
    if (format === 'copa_pontos_corridos' || format === 'round_robin' || format === 'liga_pontos') {
      const { participants: updatedParticipants, matches: syncedMatches } = recalculateLeagueStandings(participants, updatedMatches);
      setMatches(syncedMatches);
      setParticipants(updatedParticipants);
      persistTournament({ matches: syncedMatches, participants: updatedParticipants });
    } else {
      setMatches(updatedMatches);
      persistTournament({ matches: updatedMatches });
    }
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
        return {
          ...m,
          status: 'completed' as const,
          winnerId,
          isWO: false,
          woWinnerId: null,
          completedAtMs: m.completedAtMs || Date.now()
        };
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

    // Update Scores
    if (format === 'copa_pontos_corridos' || format === 'round_robin' || format === 'liga_pontos') {
      const { participants: updatedParticipants, matches: syncedMatches } = recalculateLeagueStandings(participants, updatedMatches);
      setMatches(syncedMatches);
      setParticipants(updatedParticipants);
      persistTournament({ matches: syncedMatches, participants: updatedParticipants });
    } else if (format === 'swiss') {
      setMatches(updatedMatches);
      persistTournament({ matches: updatedMatches });
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
    } else {
      setMatches(updatedMatches);
      persistTournament({ matches: updatedMatches });
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
    const isWO = Boolean(match.isWO);
    const isLiveNow = isMatchCurrentlyLive(match);
    const liveInfo = liveRoomsByMatchId[match.id];
    
    return (
      <div
        key={match.id}
        className={`bg-[#242424] rounded-xl border overflow-hidden shadow-lg flex flex-col transition ${
          isLiveNow
            ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
            : 'border-[#333]'
        }`}
      >
        {/* Top bar: MD3 & Referee & Live Assistir / Online Duel Button */}
        {!match.isBye && match.player1 && match.player2 && (
          <div className="px-2.5 py-1.5 bg-[#191919] border-b border-[#333] flex items-center justify-between gap-2 text-[10px]">
            <div className="flex items-center gap-1.5 text-slate-400 min-w-0">
              {isLiveNow ? (
                <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-mono font-black flex items-center gap-1 animate-pulse">
                  <Radio size={10} /> AO VIVO
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30 font-mono font-bold">
                  MD3
                </span>
              )}
              {match.refereeName && (
                <span className="truncate text-amber-300 flex items-center gap-1">
                  <Gavel size={10} /> {match.refereeName}
                </span>
              )}
              {isLiveNow && liveInfo && (
                <span className="hidden sm:inline text-[9px] font-mono text-red-300">
                  ❤️ {liveInfo.p1Life}x{liveInfo.p2Life}
                </span>
              )}
            </div>
            <button
              onClick={() =>
                handleOpenMatchBroadcast(match, !canConfigure ? 'spectator' : undefined)
              }
              className={`px-2.5 py-1 rounded font-black flex items-center gap-1 shrink-0 shadow transition ${
                isLiveNow
                  ? 'bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white animate-pulse'
                  : 'bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white'
              }`}
              title={
                isLiveNow
                  ? 'Assistir Partida Ao Vivo Agora'
                  : !canConfigure
                  ? 'Assistir Partida / Entrar como Espectador'
                  : 'Abrir Sala de Duelo Online & Transmissão'
              }
            >
              {isLiveNow ? <Radio size={11} /> : !canConfigure ? <Eye size={11} /> : <Video size={11} />}
              <span>
                {isLiveNow
                  ? 'Assistir Ao Vivo'
                  : !canConfigure
                  ? 'Assistir Partida'
                  : 'Duelo Online'}
              </span>
            </button>
          </div>
        )}

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
            <div className="min-w-0">
              <span className={`text-sm truncate block ${match.winnerId === match.player1?.id ? 'text-[#a855f7] font-black' : 'text-white font-medium'}`}>
                {match.player1?.name || '---'}
              </span>
              {match.player1?.userId && (
                <span className="text-[9px] text-emerald-400 flex items-center gap-0.5">
                  <UserCheck size={9} /> Vinculado
                </span>
              )}
            </div>
          </div>

          {!match.isBye && !isCompleted && match.player1 && match.player2 && canConfigure && (
            <input 
              type="number" 
              placeholder="0"
              value={match.score1 !== null ? match.score1 : ''}
              onChange={(e) => handleScoreChange(match.id, e.target.value, match.score2 !== null ? match.score2.toString() : '')}
              className="w-16 bg-[#1a1a1a] border border-[#444] rounded p-1 text-center text-white text-sm outline-none focus:border-[#a855f7] placeholder-slate-600"
            />
          )}
          {(isCompleted || !canConfigure) && (
            <span className="w-16 text-center font-bold text-white text-lg">
              {isWO ? (match.woWinnerId === match.player1?.id ? 'W.O.' : '0') : (match.score1 !== null ? match.score1 : (match.isBye ? '-' : '0'))}
            </span>
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
            <div className="min-w-0">
              <span className={`text-sm truncate block ${match.winnerId === match.player2?.id ? 'text-[#a855f7] font-black' : 'text-white font-medium'}`}>
                {match.player2?.name || '---'}
              </span>
              {match.player2?.userId && (
                <span className="text-[9px] text-emerald-400 flex items-center gap-0.5">
                  <UserCheck size={9} /> Vinculado
                </span>
              )}
            </div>
          </div>

          {!match.isBye && !isCompleted && match.player1 && match.player2 && canConfigure && (
            <input 
              type="number" 
              placeholder="0"
              value={match.score2 !== null ? match.score2 : ''}
              onChange={(e) => handleScoreChange(match.id, match.score1 !== null ? match.score1.toString() : '', e.target.value)}
              className="w-16 bg-[#1a1a1a] border border-[#444] rounded p-1 text-center text-white text-sm outline-none focus:border-[#a855f7] placeholder-slate-600"
            />
          )}
          {(isCompleted || !canConfigure) && (
            <span className="w-16 text-center font-bold text-white text-lg">
              {isWO ? (match.woWinnerId === match.player2?.id ? 'W.O.' : '0') : (match.score2 !== null ? match.score2 : (match.isBye ? '' : '0'))}
            </span>
          )}
        </div>

        {/* Actions (Only Organizer/Admin) */}
        {!isCompleted && !match.isBye && match.player1 && match.player2 && canConfigure && (
          <div className="bg-[#1a1a1a] p-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-[#333]">
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  handleSetMatchResult(match.id, 2, 0, {
                    isWO: true,
                    woWinnerId: match.player1!.id,
                    markCompleted: true
                  })
                }
                className="px-2 py-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[10px] font-bold"
                title="W.O. concede 3 pontos para o Jogador 1"
              >
                W.O. P1
              </button>
              <button
                onClick={() =>
                  handleSetMatchResult(match.id, 0, 2, {
                    isWO: true,
                    woWinnerId: match.player2!.id,
                    markCompleted: true
                  })
                }
                className="px-2 py-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[10px] font-bold"
                title="W.O. concede 3 pontos para o Jogador 2"
              >
                W.O. P2
              </button>
            </div>
            <button 
              onClick={() => completeMatch(match.id)}
              disabled={match.score1 === null || match.score2 === null}
              className="bg-[#9333ea] hover:bg-[#7e22ce] disabled:bg-[#444] disabled:text-slate-500 text-white px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1"
            >
              <CheckCircle2 size={14} /> Confirmar
            </button>
          </div>
        )}
        {isCompleted && !match.isBye && (
          <div className="bg-[#1a1a1a] px-2.5 py-1.5 flex items-center justify-between border-t border-[#333] text-[10px]">
            <span className="text-emerald-400 font-bold">
              {isWO ? 'Encerrado por W.O. (+3 pts)' : 'Resultado Confirmado'}
            </span>
            {canConfigure && (
              <button
                onClick={() => handleReopenMatch(match.id)}
                className="text-slate-400 hover:text-white underline flex items-center gap-1"
              >
                <RotateCcw size={10} /> Editar
              </button>
            )}
          </div>
        )}
        {match.isBye && (
          <div className="bg-[#1a1a1a] p-2 text-center border-t border-[#333]">
            <span className="text-xs text-slate-500 font-bold uppercase">Folga na Rodada (BYE)</span>
          </div>
        )}
      </div>
    );
  };

  // Agenda de Duelos Completa para Copa por Pontos Corridos & Liga por Pontos de Liga (Mostra cada player vinculado, Juiz registrado, Resultado MD3 / W.O., Variação de Pontos de Liga e Sala de Duelo Online)
  const renderCopaSchedule = () => {
    const filteredMatches = matches.filter(
      (m) => !m.isBye && (scheduleFilterRound === 'all' || m.round === scheduleFilterRound)
    );

    const roundsList = Array.from({ length: Math.max(1, totalRounds) }, (_, i) => i + 1);
    const p1SelectedObj = participants.find((p) => p.id === newDuelP1Id);
    const p2SelectedObj = participants.find((p) => p.id === newDuelP2Id);
    const previewDeltaWinP1 =
      isLeagueMode && p1SelectedObj && p2SelectedObj && p1SelectedObj.id !== p2SelectedObj.id
        ? calculateDynamicLeagueDelta(
            p1SelectedObj.points,
            p2SelectedObj.points,
            'p1_win',
            leagueKFactor,
            leagueWinBonusPoints
          )
        : null;
    const previewDeltaWinP2 =
      isLeagueMode && p1SelectedObj && p2SelectedObj && p1SelectedObj.id !== p2SelectedObj.id
        ? calculateDynamicLeagueDelta(
            p1SelectedObj.points,
            p2SelectedObj.points,
            'p2_win',
            leagueKFactor,
            leagueWinBonusPoints
          )
        : null;

    const manualP1Obj = participants.find((p) => p.id === manualMatchP1Id);
    const manualP2Obj = participants.find((p) => p.id === manualMatchP2Id);
    const manualPreviewOutcome: 'p1_win' | 'p2_win' | 'tie' =
      manualMatchResult === '2-0' || manualMatchResult === '2-1' || manualMatchResult === 'wo_p1'
        ? 'p1_win'
        : manualMatchResult === '0-2' || manualMatchResult === '1-2' || manualMatchResult === 'wo_p2'
        ? 'p2_win'
        : 'tie';
    const manualDeltaPreview =
      isLeagueMode && manualP1Obj && manualP2Obj && manualP1Obj.id !== manualP2Obj.id
        ? calculateDynamicLeagueDelta(
            manualP1Obj.points,
            manualP2Obj.points,
            manualPreviewOutcome,
            leagueKFactor,
            leagueWinBonusPoints
          )
        : null;

    return (
      <div className="space-y-4">
        {/* Painel Exclusivo da Liga: Entrada de Novos Jogadores Durante o Campeonato & Criador de Duelos */}
        {(isLeagueMode || canLateJoin) && (
          <div className="bg-gradient-to-r from-[#1c132d] via-[#131829] to-[#1a1328] border border-cyan-500/40 rounded-2xl p-4 space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h4 className="text-sm sm:text-base font-cinzel font-black text-cyan-300 flex items-center gap-2">
                  <Flame size={17} className="text-amber-400" />
                  <span>
                    {isLeagueMode
                      ? 'Central da Liga Dinâmica • Entrada Contínua & Pontos de Liga (PDL)'
                      : 'Entrada de Novos Jogadores & Agendamento Livre'}
                  </span>
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  {isLeagueMode ? (
                    <>
                      Novos jogadores podem entrar a qualquer momento com <b className="text-amber-300">{leagueInitialPoints} PDL</b>. Quando um jogador com <b className="text-emerald-400">poucos pontos vence um com muitos pontos (Zebra)</b>, ele ganha muito mais Pontos de Liga e o adversário perde mais!
                    </>
                  ) : (
                    <>Novos jogadores podem entrar mesmo com o campeonato em andamento.</>
                  )}
                </p>
              </div>

              {isLeagueMode && canConfigure && (
                <button
                  onClick={handleGenerateBalancedLeagueRound}
                  disabled={participants.length < 2}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shrink-0 active:scale-95 transition"
                  title="Pareia automaticamente todos os jogadores atuais por proximidade de Pontos de Liga"
                >
                  <Shuffle size={14} />
                  <span>Gerar Rodada por Proximidade de PDL</span>
                </button>
              )}
            </div>

            <div className={`grid grid-cols-1 ${canConfigure ? 'lg:grid-cols-2' : ''} gap-4`}>
              {/* Bloco 1: Entrada de Novo Jogador durante o Campeonato */}
              <div className="bg-black/45 border border-purple-500/30 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={13} className="text-purple-400" /> Entrar como Novo Jogador Durante o Campeonato
                  </span>
                  {isLeagueMode && (
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
                      Inicia com {leagueInitialPoints} PDL
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lateJoinPlayerName}
                    onChange={(e) => setLateJoinPlayerName(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' &&
                      (canConfigure
                        ? handleAddParticipant(lateJoinPlayerName)
                        : handleGuestJoinTournament(lateJoinPlayerName))
                    }
                    placeholder="Digite seu nick/nome para entrar agora na Liga..."
                    className="flex-1 bg-[#14111d] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={() =>
                      canConfigure
                        ? handleAddParticipant(lateJoinPlayerName)
                        : handleGuestJoinTournament(lateJoinPlayerName)
                    }
                    disabled={isJoiningAsGuest}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center gap-1 shrink-0 transition"
                  >
                    <Plus size={14} /> Entrar na Liga
                  </button>
                </div>
                {user && !participants.some((p) => p.userId === user.uid) && (
                  <button
                    onClick={handleAddMyselfAndLink}
                    className="w-full py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
                  >
                    <UserCheck size={12} /> Entrar Agora com Minha Conta ({user.displayName || 'Jogador'})
                  </button>
                )}
              </div>

              {/* Bloco 2: Agendar Novo Confronto da Liga (Somente Organizador) */}
              {canConfigure && (
                <div className="bg-black/45 border border-cyan-500/30 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={13} className="text-cyan-400" /> Agendar Novo Duelo na Liga
                    </span>
                    {previewDeltaWinP1 && previewDeltaWinP2 && (
                      <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded">
                        Vitória P1: +{previewDeltaWinP1.delta1} PDL | Vitória P2: +{previewDeltaWinP2.delta2} PDL
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={newDuelP1Id}
                      onChange={(e) => setNewDuelP1Id(e.target.value)}
                      className="bg-[#14111d] border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
                    >
                      <option value="">Selecionar Jogador 1...</option>
                      {participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.points} {isLeagueMode ? 'PDL' : 'pts'})
                        </option>
                      ))}
                    </select>

                    <select
                      value={newDuelP2Id}
                      onChange={(e) => setNewDuelP2Id(e.target.value)}
                      className="bg-[#14111d] border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-400"
                    >
                      <option value="">Selecionar Jogador 2...</option>
                      {participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.points} {isLeagueMode ? 'PDL' : 'pts'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap gap-2">
                    <input
                      type="text"
                      value={newDuelRefereeName}
                      onChange={(e) => setNewDuelRefereeName(e.target.value)}
                      placeholder="Juiz (opcional)"
                      className="w-full sm:w-36 bg-[#14111d] border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-amber-200 outline-none focus:border-amber-400"
                    />
                    <input
                      type="text"
                      value={newDuelScheduledAt}
                      onChange={(e) => setNewDuelScheduledAt(e.target.value)}
                      placeholder="Horário (Ex: Hoje 21:00)"
                      className="flex-1 bg-[#14111d] border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-400"
                    />
                    <button
                      onClick={handleCreateCustomLeagueDuel}
                      disabled={!newDuelP1Id || !newDuelP2Id || newDuelP1Id === newDuelP2Id}
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black text-xs flex items-center gap-1 shrink-0 transition"
                    >
                      <Plus size={14} /> Criar Duelo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bloco 3: Preencher Partida Manualmente (Partidas Presenciais / Conta Jogador 1 x Conta Jogador 2 / Resultado / Nome do Juiz) */}
            {canConfigure && (
              <div className="bg-gradient-to-r from-emerald-950/50 via-[#121824] to-amber-950/40 border border-emerald-500/45 rounded-xl p-3.5 space-y-3 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Gavel size={14} className="text-amber-400" /> Preencher Partida Manualmente (Partida Presencial / Resultado Direto)
                    </span>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Anote confrontos presenciais ou já finalizados: selecione a <b>Conta do Jogador 1 x Conta do Jogador 2</b>, o <b>Resultado</b> e o <b>Nome do Juiz</b>.
                    </p>
                  </div>

                  {manualDeltaPreview && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono bg-black/60 border border-emerald-500/40 px-2.5 py-1 rounded-lg">
                      <span className="text-slate-300">Impacto PDL:</span>
                      <span className={manualDeltaPreview.delta1 >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {manualP1Obj?.name}: {manualDeltaPreview.delta1 >= 0 ? `+${manualDeltaPreview.delta1}` : manualDeltaPreview.delta1} PDL
                      </span>
                      <span className="text-slate-500">|</span>
                      <span className={manualDeltaPreview.delta2 >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {manualP2Obj?.name}: {manualDeltaPreview.delta2 >= 0 ? `+${manualDeltaPreview.delta2}` : manualDeltaPreview.delta2} PDL
                      </span>
                      {manualDeltaPreview.appliedWinBonus > 0 && (
                        <span className="text-amber-300">
                          (Roubo: {manualDeltaPreview.stolenPoints} + Bônus Vit: +{manualDeltaPreview.appliedWinBonus})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                  {/* Conta do Jogador 1 */}
                  <div className="md:col-span-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Conta do Jogador 1
                    </label>
                    <select
                      value={manualMatchP1Id}
                      onChange={(e) => setManualMatchP1Id(e.target.value)}
                      className="w-full bg-[#14111d] border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-400"
                    >
                      <option value="">Selecionar Conta Jogador 1...</option>
                      {participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.userEmail ? `(${p.userEmail})` : p.userId ? '(Conta Vinculada)' : '(Convidado)'} • {p.points} {isLeagueMode ? 'PDL' : 'pts'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* X / Resultado */}
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-amber-300 uppercase block mb-1 text-center">
                      Resultado (J1 x J2)
                    </label>
                    <select
                      value={manualMatchResult}
                      onChange={(e) => setManualMatchResult(e.target.value as any)}
                      className="w-full bg-[#14111d] border border-amber-500/50 rounded-xl px-2.5 py-2 text-xs font-black text-amber-300 text-center outline-none focus:border-amber-400"
                    >
                      <option value="2-0">2 x 0 (Vitória J1)</option>
                      <option value="2-1">2 x 1 (Vitória J1)</option>
                      <option value="1-1">1 x 1 (Empate)</option>
                      <option value="1-2">1 x 2 (Vitória J2)</option>
                      <option value="0-2">0 x 2 (Vitória J2)</option>
                      <option value="wo_p1">W.O. (Vitória J1 • 2x0)</option>
                      <option value="wo_p2">W.O. (Vitória J2 • 0x2)</option>
                    </select>
                  </div>

                  {/* Conta do Jogador 2 */}
                  <div className="md:col-span-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Conta do Jogador 2
                    </label>
                    <select
                      value={manualMatchP2Id}
                      onChange={(e) => setManualMatchP2Id(e.target.value)}
                      className="w-full bg-[#14111d] border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-400"
                    >
                      <option value="">Selecionar Conta Jogador 2...</option>
                      {participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.userEmail ? `(${p.userEmail})` : p.userId ? '(Conta Vinculada)' : '(Convidado)'} • {p.points} {isLeagueMode ? 'PDL' : 'pts'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Nome do Juiz */}
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Nome do Juiz
                    </label>
                    <input
                      type="text"
                      list="tournament-referees-datalist"
                      value={manualMatchRefereeName}
                      onChange={(e) => setManualMatchRefereeName(e.target.value)}
                      placeholder="Nome do Juiz..."
                      className="w-full bg-[#14111d] border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-amber-200 outline-none focus:border-amber-400"
                    />
                    <datalist id="tournament-referees-datalist">
                      {referees.map((ref) => (
                        <option key={ref.id} value={ref.name} />
                      ))}
                    </datalist>
                  </div>

                  {/* Botão Registrar Partida */}
                  <div className="md:col-span-2 self-end">
                    <button
                      onClick={handleRecordManualMatch}
                      disabled={!manualMatchP1Id || !manualMatchP2Id || manualMatchP1Id === manualMatchP2Id}
                      className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition active:scale-95"
                    >
                      <Check size={14} /> Lançar Partida
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filtro de Rodadas da Agenda + Resumo das Regras */}
        <div className="bg-[#201c2b] border border-purple-500/35 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-base sm:text-lg font-cinzel font-black text-amber-300 flex items-center gap-2">
              <Calendar size={18} className="text-cyan-400" />
              <span>
                {isLeagueMode
                  ? 'Agenda Oficial de Duelos • Liga por Pontos de Liga (PDL Dinâmico)'
                  : 'Agenda Oficial de Duelos • Copa por Pontos Corridos (MD3)'}
              </span>
            </h4>
            <p className="text-xs text-slate-300 mt-0.5">
              {isLeagueMode ? (
                <>
                  Rating Dinâmico (Fator K={leagueKFactor}): <b className="text-emerald-400">Pontos roubados (Zebra)</b>
                  {leagueWinBonusPoints > 0 && (
                    <>
                      {' '}
                      + <b className="text-amber-300">Bônus de Vitória (+{leagueWinBonusPoints} PDL)</b>
                    </>
                  )}
                  {leagueInactivityPenaltyEnabled && leagueInactivityPenaltyPointsPerWeek > 0 && (
                    <>
                      {' '}
                      • <b className="text-rose-400">Inatividade: -{leagueInactivityPenaltyPointsPerWeek} PDL/semana sem partida</b>
                    </>
                  )}
                </>
              ) : (
                <>
                  Vitória = <b className="text-emerald-400">3 pontos</b> • Empate = <b className="text-amber-300">1 ponto</b> • W.O. = <b className="text-cyan-300">3 pontos para quem compareceu</b>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setScheduleFilterRound('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                scheduleFilterRound === 'all'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-[#14111d] text-slate-300 hover:text-white border border-purple-500/30'
              }`}
            >
              Todas as Partidas ({matches.filter((m) => !m.isBye).length})
            </button>
            {roundsList.map((r) => (
              <button
                key={r}
                onClick={() => setScheduleFilterRound(r)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  scheduleFilterRound === r
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#14111d] text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                R{r}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Duelos da Agenda */}
        <div className="space-y-3">
          {filteredMatches.map((m) => {
            const isCompleted = m.status === 'completed';
            const isWO = Boolean(m.isWO);
            const p1 = participants.find((pt) => pt.id === m.player1?.id) || m.player1;
            const p2 = participants.find((pt) => pt.id === m.player2?.id) || m.player2;
            if (!p1 || !p2) return null;

            const p1Won = m.winnerId === p1.id;
            const p2Won = m.winnerId === p2.id;
            const isTie = isCompleted && !isWO && m.score1 === m.score2;

            // Simulação em tempo real de quanto cada jogador ganha/perde se vencer este duelo na Liga
            const p1WinSim = isLeagueMode
              ? calculateDynamicLeagueDelta(p1.points, p2.points, 'p1_win', leagueKFactor, leagueWinBonusPoints)
              : null;
            const p2WinSim = isLeagueMode
              ? calculateDynamicLeagueDelta(p1.points, p2.points, 'p2_win', leagueKFactor, leagueWinBonusPoints)
              : null;

            const isLiveNow = isMatchCurrentlyLive(m);
            const liveInfo = liveRoomsByMatchId[m.id];

            return (
              <div
                key={m.id}
                className={`rounded-2xl border p-4 transition shadow-lg ${
                  isLiveNow
                    ? 'bg-gradient-to-r from-[#241320] via-[#1c132b] to-[#241320] border-2 border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.28)]'
                    : isCompleted
                    ? 'bg-[#181622] border-emerald-500/35'
                    : 'bg-[#221e2e] border-purple-500/35 hover:border-amber-400/50'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Esquerda: Rodada + Status Ao Vivo + Data/Hora + Juiz da Partida */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-950 border border-purple-500/40 text-amber-300 font-mono font-black text-xs">
                      RODADA {m.round} • MD3
                    </span>
                    {m.isManualEntry && (
                      <span className="px-2 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-[10px]">
                        PARTIDA PRESENCIAL / MANUAL
                      </span>
                    )}

                    {isLiveNow && (
                      <span className="px-2.5 py-1 rounded-lg bg-red-600 border border-red-300 text-white font-mono font-black text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse">
                        <Radio size={13} />
                        <span>AO VIVO AGORA</span>
                      </span>
                    )}

                    {isLiveNow && liveInfo && (
                      <span className="px-2.5 py-1 rounded-lg bg-black/70 border border-red-500/40 text-xs font-mono text-slate-200 flex items-center gap-2">
                        <span>
                          ❤️ <b className="text-red-300">{liveInfo.p1Life}</b> vs{' '}
                          <b className="text-red-300">{liveInfo.p2Life}</b>
                        </span>
                        {liveInfo.spotlightCardName && (
                          <span className="text-amber-300">
                            • Carta: <b>{liveInfo.spotlightCardName}</b>
                          </span>
                        )}
                      </span>
                    )}

                    {/* Seletor / Registro do Juiz da Partida */}
                    <div className="flex items-center gap-1.5 bg-[#120f1a] border border-slate-700 rounded-xl px-2.5 py-1">
                      <Gavel size={13} className="text-amber-400 shrink-0" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Juiz:</span>
                      {canConfigure ? (
                        referees.length > 0 ? (
                          <select
                            value={m.refereeName || ''}
                            onChange={(e) => handleAssignMatchReferee(m.id, e.target.value)}
                            className="bg-transparent text-xs font-bold text-amber-200 outline-none cursor-pointer"
                          >
                            <option value="" className="bg-slate-900 text-slate-400">
                              Selecionar Juiz...
                            </option>
                            {referees.map((ref) => (
                              <option key={ref.id} value={ref.name} className="bg-slate-900 text-white">
                                {ref.name} ({ref.role || 'Juiz'})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={m.refereeName || ''}
                            onChange={(e) => handleAssignMatchReferee(m.id, e.target.value)}
                            placeholder="Digitar nome do Juiz..."
                            className="bg-transparent text-xs font-bold text-amber-200 outline-none w-32"
                          />
                        )
                      ) : (
                        <span className="text-xs font-bold text-amber-200">
                          {m.refereeName || 'A definir'}
                        </span>
                      )}
                    </div>

                    {/* Data / Horário do Duelo */}
                    {(canConfigure || m.scheduledAt) && (
                      <div className="flex items-center gap-1.5 bg-[#120f1a] border border-slate-700 rounded-xl px-2.5 py-1">
                        <Calendar size={12} className="text-cyan-400 shrink-0" />
                        {canConfigure ? (
                          <input
                            type="text"
                            value={m.scheduledAt || ''}
                            onChange={(e) => handleUpdateMatchSchedule(m.id, e.target.value)}
                            placeholder="Horário / Data (Ex: Sáb 19:00)"
                            className="bg-transparent text-xs text-slate-200 outline-none w-36"
                          />
                        ) : (
                          <span className="text-xs text-slate-200">{m.scheduledAt}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Direita: Botão Assistir Ao Vivo (Convidados) & Estúdio de Duelo Online */}
                  <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto">
                    {canConfigure && !isCompleted && (
                      <button
                        onClick={() => handleUpdateMatchLiveFlag(m.id, !isLiveNow)}
                        className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition ${
                          isLiveNow
                            ? 'bg-red-950/90 hover:bg-red-900 border-red-400 text-red-200'
                            : 'bg-[#14111d] hover:bg-red-950/60 border-red-500/40 text-red-300'
                        }`}
                        title={
                          isLiveNow
                            ? 'Encerrar destaque Ao Vivo desta partida'
                            : 'Destacar partida como Ao Vivo para todos os convidados assistirem'
                        }
                      >
                        <Radio size={13} className={isLiveNow ? 'text-red-400 animate-pulse' : ''} />
                        <span>{isLiveNow ? 'Encerrar Ao Vivo' : 'Marcar Ao Vivo'}</span>
                      </button>
                    )}

                    {!canConfigure ? (
                      <button
                        onClick={() => handleOpenMatchBroadcast(m, 'spectator')}
                        className={`px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition active:scale-95 ${
                          isLiveNow
                            ? 'bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white border border-red-300 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                            : 'bg-gradient-to-r from-emerald-600 via-cyan-600 to-purple-600 hover:from-emerald-500 hover:to-purple-500 text-white'
                        }`}
                      >
                        {isLiveNow ? <Radio size={14} className="animate-pulse" /> : <Eye size={14} />}
                        <span>
                          {isLiveNow
                            ? '🔴 Assistir Partida Ao Vivo'
                            : 'Assistir Partida / Sala Online'}
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenMatchBroadcast(m)}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 via-purple-600 to-amber-500 hover:from-cyan-500 hover:to-amber-400 text-white font-black text-xs flex items-center gap-2 shadow-lg transition active:scale-95"
                      >
                        <Tv size={14} />
                        <span>Sala de Duelo Online & Transmissão (2 Câmeras)</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Centro: Confronto entre os 2 Players Vinculados + Placar MD3 + Botões Rápidos */}
                <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3">
                  {/* Player 1 Card */}
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                      p1Won
                        ? 'bg-emerald-950/40 border-emerald-400/70'
                        : 'bg-[#14111d] border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {p1.userPhoto ? (
                        <img
                          src={p1.userPhoto}
                          alt={p1.name}
                          className="w-8 h-8 rounded-full object-cover border border-purple-400 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-purple-900 text-purple-200 font-black text-xs flex items-center justify-center shrink-0">
                          {p1.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-sm sm:text-base truncate">
                            {p1.name}
                          </span>
                          <span className="text-[10px] font-mono text-amber-300 bg-black/50 px-1.5 py-0.5 rounded border border-amber-500/25">
                            {isCompleted && m.p1PointsAfter !== undefined ? m.p1PointsAfter : p1.points}{' '}
                            {isLeagueMode ? 'PDL' : 'pts'}
                          </span>
                          {isLeagueMode && isCompleted && m.p1LeagueDelta !== undefined ? (
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono font-black text-[10px] ${
                                m.p1LeagueDelta > 0
                                  ? 'bg-emerald-500 text-slate-950'
                                  : m.p1LeagueDelta < 0
                                  ? 'bg-red-950/90 text-red-300 border border-red-500/40'
                                  : 'bg-amber-500 text-slate-950'
                              }`}
                            >
                              {m.p1LeagueDelta > 0 ? `+${m.p1LeagueDelta} PDL` : `${m.p1LeagueDelta} PDL`}
                            </span>
                          ) : !isLeagueMode && p1Won ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-black text-[9px] uppercase">
                              {isWO ? '+3 PTS (W.O.)' : '+3 PTS'}
                            </span>
                          ) : !isLeagueMode && isTie ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[9px] uppercase">
                              +1 PT
                            </span>
                          ) : null}
                        </div>
                        {p1.userId ? (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                            <UserCheck size={11} /> Jogador Vinculado {p1.userEmail ? `(${p1.userEmail})` : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            Aguardando vínculo de conta
                          </span>
                        )}
                        {isLeagueMode && !isCompleted && p1WinSim && (
                          <span className="text-[10px] text-cyan-300/90 font-mono block mt-0.5">
                            Se vencer: <b className="text-emerald-400">+{p1WinSim.delta1} PDL</b>{' '}
                            {p1.points < p2.points && (
                              <span className="text-amber-300 font-bold">(Bônus Zebra!)</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Placar Central MD3 & Resultados Rápidos */}
                  <div className="flex flex-col items-center justify-center gap-2 px-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={2}
                        disabled={isCompleted || !canConfigure}
                        value={m.score1 !== null ? m.score1 : ''}
                        onChange={(e) =>
                          handleScoreChange(
                            m.id,
                            e.target.value,
                            m.score2 !== null ? m.score2.toString() : ''
                          )
                        }
                        placeholder="0"
                        className="w-12 h-10 bg-black border border-purple-500/50 rounded-xl text-center font-mono font-black text-lg text-white outline-none focus:border-amber-400 disabled:opacity-80"
                      />
                      <span className="font-mono font-black text-xs text-slate-400 uppercase">
                        {isWO ? 'W.O.' : 'VS'}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={2}
                        disabled={isCompleted || !canConfigure}
                        value={m.score2 !== null ? m.score2 : ''}
                        onChange={(e) =>
                          handleScoreChange(
                            m.id,
                            m.score1 !== null ? m.score1.toString() : '',
                            e.target.value
                          )
                        }
                        placeholder="0"
                        className="w-12 h-10 bg-black border border-cyan-500/50 rounded-xl text-center font-mono font-black text-lg text-white outline-none focus:border-amber-400 disabled:opacity-80"
                      />
                    </div>

                    {/* Atalhos Rápidos MD3 + Empate + W.O. (Somente Organizador) */}
                    {!isCompleted ? (
                      canConfigure ? (
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {[
                            { label: '2-0', s1: 2, s2: 0 },
                            { label: '2-1', s1: 2, s2: 1 },
                            { label: '1-1 (Empate)', s1: 1, s2: 1 },
                            { label: '1-2', s1: 1, s2: 2 },
                            { label: '0-2', s1: 0, s2: 2 }
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              onClick={() =>
                                handleSetMatchResult(m.id, preset.s1, preset.s2, {
                                  isWO: false,
                                  markCompleted: true
                                })
                              }
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-purple-600 text-slate-200 hover:text-white font-mono font-bold text-[10px] border border-slate-700 transition"
                            >
                              {preset.label}
                            </button>
                          ))}
                          <button
                            onClick={() =>
                              handleSetMatchResult(m.id, 2, 0, {
                                isWO: true,
                                woWinnerId: p1.id,
                                markCompleted: true
                              })
                            }
                            className="px-2 py-1 rounded-lg bg-amber-950/90 hover:bg-amber-800 text-amber-300 border border-amber-500/40 font-bold text-[10px]"
                            title={`W.O. para ${p1.name}`}
                          >
                            W.O. {p1.name.split(' ')[0]}
                          </button>
                          <button
                            onClick={() =>
                              handleSetMatchResult(m.id, 0, 2, {
                                isWO: true,
                                woWinnerId: p2.id,
                                markCompleted: true
                              })
                            }
                            className="px-2 py-1 rounded-lg bg-amber-950/90 hover:bg-amber-800 text-amber-300 border border-amber-500/40 font-bold text-[10px]"
                            title={`W.O. para ${p2.name}`}
                          >
                            W.O. {p2.name.split(' ')[0]}
                          </button>
                          {m.score1 !== null && m.score2 !== null && (
                            <button
                              onClick={() => completeMatch(m.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1"
                            >
                              <CheckCircle2 size={11} /> Salvar
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">
                          Partida pendente • Aguardando resultado oficial
                        </span>
                      )
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          {isLeagueMode ? (
                            <>
                              {p1Won
                                ? `Vitória de ${p1.name} (${m.p1LeagueDelta && m.p1LeagueDelta > 0 ? `+${m.p1LeagueDelta}` : m.p1LeagueDelta} PDL)`
                                : p2Won
                                ? `Vitória de ${p2.name} (${m.p2LeagueDelta && m.p2LeagueDelta > 0 ? `+${m.p2LeagueDelta}` : m.p2LeagueDelta} PDL)`
                                : 'Empate processado no Rating da Liga'}
                            </>
                          ) : isWO ? (
                            `Vitória por W.O. (+3 pts para ${p1Won ? p1.name : p2.name})`
                          ) : isTie ? (
                            'Empate Confirmado (+1 pt cada)'
                          ) : (
                            `Vitória MD3 (+3 pts para ${p1Won ? p1.name : p2.name})`
                          )}
                        </span>
                        {canConfigure && (
                          <button
                            onClick={() => handleReopenMatch(m.id)}
                            className="text-[10px] text-slate-400 hover:text-white underline"
                          >
                            Alterar
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Player 2 Card */}
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                      p2Won
                        ? 'bg-emerald-950/40 border-emerald-400/70'
                        : 'bg-[#14111d] border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {p2.userPhoto ? (
                        <img
                          src={p2.userPhoto}
                          alt={p2.name}
                          className="w-8 h-8 rounded-full object-cover border border-cyan-400 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-cyan-950 text-cyan-200 font-black text-xs flex items-center justify-center shrink-0">
                          {p2.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white text-sm sm:text-base truncate">
                            {p2.name}
                          </span>
                          <span className="text-[10px] font-mono text-amber-300 bg-black/50 px-1.5 py-0.5 rounded border border-amber-500/25">
                            {isCompleted && m.p2PointsAfter !== undefined ? m.p2PointsAfter : p2.points}{' '}
                            {isLeagueMode ? 'PDL' : 'pts'}
                          </span>
                          {isLeagueMode && isCompleted && m.p2LeagueDelta !== undefined ? (
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono font-black text-[10px] ${
                                m.p2LeagueDelta > 0
                                  ? 'bg-emerald-500 text-slate-950'
                                  : m.p2LeagueDelta < 0
                                  ? 'bg-red-950/90 text-red-300 border border-red-500/40'
                                  : 'bg-amber-500 text-slate-950'
                              }`}
                            >
                              {m.p2LeagueDelta > 0 ? `+${m.p2LeagueDelta} PDL` : `${m.p2LeagueDelta} PDL`}
                            </span>
                          ) : !isLeagueMode && p2Won ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-black text-[9px] uppercase">
                              {isWO ? '+3 PTS (W.O.)' : '+3 PTS'}
                            </span>
                          ) : !isLeagueMode && isTie ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[9px] uppercase">
                              +1 PT
                            </span>
                          ) : null}
                        </div>
                        {p2.userId ? (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                            <UserCheck size={11} /> Jogador Vinculado {p2.userEmail ? `(${p2.userEmail})` : ''}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            Aguardando vínculo de conta
                          </span>
                        )}
                        {isLeagueMode && !isCompleted && p2WinSim && (
                          <span className="text-[10px] text-cyan-300/90 font-mono block mt-0.5">
                            Se vencer: <b className="text-emerald-400">+{p2WinSim.delta2} PDL</b>{' '}
                            {p2.points < p1.points && (
                              <span className="text-amber-300 font-bold">(Bônus Zebra!)</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
    const sorted = [...participants].sort((a, b) =>
      b.points !== a.points ? b.points - a.points : b.wins - a.wins
    );
    return (
      <div className="space-y-3">
        {isLeagueMode && (
          <div className="bg-[#1b1626] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-slate-300">
              <span className="font-bold text-cyan-300">Regras Ativas da Liga:</span>
              <span className="bg-black/40 border border-amber-500/30 px-2 py-0.5 rounded text-amber-300 font-mono">
                Início: {leagueInitialPoints} PDL
              </span>
              <span className="bg-black/40 border border-purple-500/30 px-2 py-0.5 rounded text-purple-300 font-mono">
                Fator K (Zebra): {leagueKFactor}
              </span>
              <span className="bg-black/40 border border-emerald-500/30 px-2 py-0.5 rounded text-emerald-300 font-mono">
                Bônus Vitória: +{leagueWinBonusPoints} PDL
              </span>
              <span className="bg-black/40 border border-rose-500/30 px-2 py-0.5 rounded text-rose-300 font-mono">
                {leagueInactivityPenaltyEnabled
                  ? `Penalidade Inatividade: -${leagueInactivityPenaltyPointsPerWeek} PDL / semana sem jogar`
                  : 'Penalidade Inatividade: Desativada'}
              </span>
            </div>
            {canConfigure && leagueInactivityPenaltyEnabled && (
              <span className="text-[11px] text-slate-400">
                Use <b>-1 Sem</b> / <b>+1 Sem</b> para ajustar semanas de inatividade de qualquer jogador.
              </span>
            )}
          </div>
        )}

        <div className="bg-[#242424] rounded-xl border border-[#333] overflow-hidden overflow-x-auto shadow-lg">
          <div className="min-w-[560px]">
            <div
              className={`grid ${
                isLeagueMode
                  ? 'grid-cols-[40px_1fr_75px_60px_135px_105px] md:grid-cols-[50px_1fr_85px_70px_165px_120px]'
                  : 'grid-cols-[40px_1fr_80px_70px_95px] md:grid-cols-[50px_1fr_90px_80px_115px]'
              } gap-2 md:gap-3 p-3 md:p-4 border-b border-[#333] bg-[#1f1f1f] text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider`}
            >
              <div className="text-center">Pos</div>
              <div>Participante / Conta</div>
              <div className="text-center">V-D-E</div>
              <div className="text-center">Jogos</div>
              {isLeagueMode && <div className="text-center text-rose-300">Inatividade</div>}
              <div className="text-center text-amber-300">
                {isLeagueMode ? 'Pontos de Liga' : 'Pontos'}
              </div>
            </div>
            <div className="divide-y divide-[#333]">
              {sorted.map((p, idx) => {
                const netDiff = isLeagueMode ? p.points - leagueInitialPoints : 0;
                const idleWeeks = p.inactivityWeeks || 0;
                const idlePenalty = p.inactivityPenaltyTotal || 0;
                return (
                  <div
                    key={p.id}
                    className={`grid ${
                      isLeagueMode
                        ? 'grid-cols-[40px_1fr_75px_60px_135px_105px] md:grid-cols-[50px_1fr_85px_70px_165px_120px]'
                        : 'grid-cols-[40px_1fr_80px_70px_95px] md:grid-cols-[50px_1fr_90px_80px_115px]'
                    } gap-2 md:gap-3 p-3 md:p-4 items-center hover:bg-[#2a2a2a] transition`}
                  >
                    <div className="text-center font-bold text-[#a855f7]">{idx + 1}º</div>
                    <div className="flex items-center gap-2 min-w-0">
                      {p.userPhoto ? (
                        <img src={p.userPhoto} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 border border-purple-400" />
                      ) : p.userId ? (
                        <div className="w-6 h-6 rounded-full bg-purple-900 text-purple-200 text-xs font-bold flex items-center justify-center shrink-0">
                          {p.name[0]?.toUpperCase()}
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-white text-sm md:text-base truncate">{p.name}</span>
                          {p.userId && (
                            <span className="text-[9px] bg-purple-950 text-purple-300 border border-purple-700/60 px-1.5 py-0.2 rounded font-bold shrink-0">
                              Vinculado
                            </span>
                          )}
                        </div>
                        {p.userEmail && (
                          <span className="text-[10px] text-slate-400 truncate block">{p.userEmail}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-center text-xs md:text-sm text-slate-300 font-mono">{p.wins}-{p.losses}-{p.ties}</div>
                    <div className="text-center text-xs md:text-sm text-slate-300 font-mono">{p.matchesPlayed}</div>

                    {isLeagueMode && (
                      <div className="flex items-center justify-center gap-1">
                        {canConfigure && (
                          <button
                            onClick={() => handleAdjustPlayerInactivityWeeks(p.id, -1)}
                            title="Perdoar / Remover 1 semana de inatividade"
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-900/70 text-slate-300 hover:text-emerald-200 border border-slate-700 text-[10px] font-mono font-bold transition"
                          >
                            -1s
                          </button>
                        )}
                        <div className="text-center font-mono">
                          {idlePenalty > 0 ? (
                            <span className="text-[11px] font-bold text-rose-400 bg-rose-950/60 border border-rose-500/40 px-1.5 py-0.5 rounded block">
                              -{idlePenalty} PDL ({idleWeeks}s)
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-400/90 bg-emerald-950/30 border border-emerald-500/20 px-1.5 py-0.5 rounded block">
                              Ativo (0s)
                            </span>
                          )}
                        </div>
                        {canConfigure && (
                          <button
                            onClick={() => handleAdjustPlayerInactivityWeeks(p.id, 1)}
                            title="Aplicar +1 semana de penalidade por inatividade"
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-rose-900/80 text-slate-300 hover:text-rose-200 border border-slate-700 text-[10px] font-mono font-bold transition"
                          >
                            +1s
                          </button>
                        )}
                      </div>
                    )}

                    <div className="text-center font-bold text-white bg-[#1a1a1a] py-1 px-1.5 rounded border border-[#444] font-mono flex items-center justify-center gap-1">
                      {format === 'leaderboard' && canConfigure ? (
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
                        <>
                          <span className="text-sm md:text-base text-amber-300">{p.points}</span>
                          {isLeagueMode && (
                            <span
                              className={`text-[10px] font-bold ${
                                netDiff > 0
                                  ? 'text-emerald-400'
                                  : netDiff < 0
                                  ? 'text-red-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              ({netDiff >= 0 ? `+${netDiff}` : netDiff})
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return '';
    // Se vier no formato YYYY-MM-DD do input type="date", formata para DD/MM/YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    return dateStr;
  };

  const hasAnyScheduleOrPrizes = Boolean(
    startDate || endDate || prizes.top1 || prizes.top2 || prizes.top3 || prizes.top4to8
  );

  const formatLabelMap: Record<string, string> = {
    liga_pontos: 'Liga Dinâmica (Pontos de Liga • PDL)',
    copa_pontos_corridos: 'Copa por Pontos Corridos (MD3)',
    single_elimination: 'Eliminação Simples (Mata-mata)',
    round_robin: 'Todos contra Todos (Round Robin)',
    swiss: 'Formato Suíço (Swiss)',
    leaderboard: 'Classificação Geral (Leaderboard)'
  };

  return (
    <div data-tour-id="tour-tournament-main" className="fixed inset-0 z-[100] flex flex-col bg-[#05030a] text-slate-200 font-sans animate-in fade-in duration-200 overflow-hidden">
      {isTopBarMinimized ? (
        <div className="bg-[#080612] border-b border-amber-500/35 px-3 py-1 flex items-center justify-center shrink-0 relative z-30 shadow-md">
          <button
            type="button"
            onClick={() => setIsTopBarMinimized(false)}
            className="px-4 py-0.5 rounded-full bg-purple-950/80 hover:bg-purple-900 border border-amber-500/45 text-amber-300 hover:text-white transition flex items-center gap-1.5 text-[10px] font-cyber font-bold uppercase tracking-wider shadow cursor-pointer"
            title="Expandir barra superior de Torneios"
          >
            <ChevronDown size={15} className="text-amber-400 animate-bounce" />
          </button>
        </div>
      ) : (
        <>
          {/* HEADER */}
          <div className={`p-4 flex flex-wrap justify-between items-center shadow-[0_10px_30px_rgba(0,0,0,0.85)] shrink-0 gap-3 border-b ${
            isOfficial 
              ? 'bg-gradient-to-r from-amber-950/60 via-[#090614] to-[#05030a] border-amber-500/50' 
              : 'bg-[#080612] border-purple-500/35'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`cyber-arcane-btn w-10 h-10 flex items-center justify-center shrink-0 border ${
                isOfficial 
                  ? 'bg-gradient-to-br from-amber-500 to-yellow-500 text-slate-950 border-amber-300 shadow-md shadow-amber-950/60' 
                  : 'bg-purple-900/60 text-purple-300 border-purple-500/40'
              }`}>
                <Crown size={22} className={isOfficial ? 'fill-slate-950' : 'fill-purple-400'} />
              </div>
              <div>
                <span className="block text-[9px] font-mono uppercase tracking-[0.22em] text-cyan-400">
                  {canConfigure
                    ? 'COLISEU COMPETITIVO // PAINEL DO ORGANIZADOR'
                    : 'COLISEU COMPETITIVO // INSCRIÇÃO & ACOMPANHAMENTO DE JOGADORES'}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-cinzel font-black text-white tracking-wider truncate max-w-[200px] sm:max-w-md">
                    {name || 'Torneio Light Dark TCG'}
                  </h2>
                  {isOfficial ? (
                    <span className="cyber-arcane-btn px-2 py-0.5 text-[10px] font-mono font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-sm flex items-center gap-1">
                      <Crown size={10} className="fill-slate-950" /> Oficial
                    </span>
                  ) : (
                    <span className="cyber-arcane-btn px-2 py-0.5 text-[10px] font-mono font-bold bg-[#0d0a1a] text-slate-300 border border-purple-500/35">
                      Comunitário
                    </span>
                  )}
                  {!canConfigure && (
                    <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono font-bold uppercase">
                      Acesso Convidado / Jogador
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                  <span>Código: <b className="font-mono text-amber-300">{tournamentId.split('_').slice(-1)[0]}</b></span>
                  <span>•</span>
                  <span className="text-purple-300 font-semibold">{formatLabelMap[format] || format}</span>
                  {isSavingCloud && <span className="text-amber-400 text-[10px] flex items-center gap-1">• Salvando na nuvem...</span>}
                </div>
              </div>
            </div>

            {/* BOTOES DE AÇÃO TOPO */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Se for o criador/organizador real, permite alternar entre Visão Organizador e Visão de Convidado */}
              {isOrganizer && (
                <button
                  onClick={() => {
                    const nextInviteMode = !isInviteLinkMode;
                    setIsInviteLinkMode(nextInviteMode);
                    if (nextInviteMode && activeTab === 'config') {
                      setActiveTab('participants');
                    }
                  }}
                  className={`cyber-arcane-btn px-2.5 py-1.5 text-[11px] font-cyber font-bold uppercase tracking-wider transition flex items-center gap-1.5 border ${
                    isInviteLinkMode
                      ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                      : 'bg-[#0d0a1a] hover:bg-purple-950/60 text-cyan-300 border-cyan-500/40'
                  }`}
                  title={
                    isInviteLinkMode
                      ? 'Voltar para o Painel do Organizador (Configurações liberadas)'
                      : 'Simular como os jogadores convidados enxergam o link (Sem configurações)'
                  }
                >
                  <ShieldCheck size={13} />
                  <span className="hidden md:inline">
                    {isInviteLinkMode ? 'Voltar ao Modo Organizador' : 'Ver como Convidado'}
                  </span>
                </button>
              )}

              {/* Botão / Status de Vincular Conta */}
              {user ? (
                myLinkedParticipant ? (
                  <div 
                    className="cyber-arcane-btn hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs font-cyber font-bold uppercase tracking-wider"
                    title={`Inscrito e vinculado como ${myLinkedParticipant.name}. Resultados serão gravados no seu histórico!`}
                  >
                    <CheckCircle size={13} className="text-emerald-400" />
                    <span className="truncate max-w-[130px]">{myLinkedParticipant.name}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowPickParticipantModal(true)}
                    className="cyber-arcane-btn px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-cyber font-bold uppercase tracking-wider text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-950/40 active:scale-95"
                    title="Entrar no campeonato ou vincular sua conta a um participante"
                  >
                    <Link2 size={13} />
                    <span className="hidden sm:inline">Entrar / Vincular Conta</span>
                  </button>
                )
              ) : (
                <button
                  onClick={onOpenAuth}
                  className="cyber-arcane-btn px-3 py-1.5 bg-[#0d0a1a] hover:bg-purple-950/60 text-purple-300 hover:text-white font-cyber font-bold uppercase tracking-wider text-xs transition flex items-center gap-1.5 border border-purple-500/40 active:scale-95"
                  title="Faça login com sua conta para entrar e salvar resultados no seu histórico"
                >
                  <LogIn size={13} />
                  <span className="hidden sm:inline">Entrar na Conta</span>
                </button>
              )}

              {/* Botão de Link de Convite */}
              <button
                onClick={async () => {
                  if (canConfigure) {
                    await persistTournament();
                  }
                  setShowShareModal(true);
                }}
                className="cyber-arcane-btn px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white border border-amber-400/40 font-cyber font-bold uppercase tracking-wider text-xs transition flex items-center gap-1.5 shadow-md shadow-purple-950/40 active:scale-95"
                title="Gerar link de convite para jogadores entrarem no campeonato"
              >
                <Share2 size={14} />
                <span className="hidden sm:inline">Link de Convite</span>
              </button>

              {/* Botão Ver Meu Histórico de Campeonatos */}
              <button
                onClick={() => setShowHistoryModal(true)}
                className="cyber-arcane-btn px-3 py-1.5 bg-[#0d0a1a] hover:bg-purple-950/50 text-slate-300 hover:text-white font-cyber font-bold uppercase tracking-wider text-xs transition flex items-center gap-1.5 border border-amber-500/35 active:scale-95"
                title="Ver meus títulos e histórico de campeonatos"
              >
                <History size={14} className="text-amber-400" />
                <span className="hidden sm:inline">Histórico</span>
              </button>

              {/* Minimizar Topo */}
              <button
                type="button"
                onClick={() => setIsTopBarMinimized(true)}
                className="cyber-arcane-btn p-2 bg-[#0d0a1a] hover:bg-purple-950/50 border border-purple-500/35 text-slate-400 hover:text-amber-300 transition"
                title="Minimizar barra superior"
              >
                <ChevronUp size={18} />
              </button>

              {/* Fechar */}
              <button 
                onClick={onClose} 
                className="cyber-arcane-btn p-2 bg-[#0d0a1a] hover:bg-red-950/50 border border-amber-500/30 text-slate-400 hover:text-white transition"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* TABS (Aba Configurações é EXCLUSIVA do Organizador — Convidados só veem Inscrição & Participantes e Chave & Partidas) */}
          <div className="flex bg-[#090614] border-b border-purple-500/30 shrink-0 overflow-x-auto no-scrollbar">
            {canConfigure && (
              <button 
                onClick={() => setActiveTab('config')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 font-cyber font-bold text-xs sm:text-sm uppercase tracking-wider transition whitespace-nowrap border-b-2 ${activeTab === 'config' ? 'border-amber-400 text-amber-300 bg-[#05030a]' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-purple-950/30'}`}
              >
                <Settings size={15} /> Configurações (Organizador)
              </button>
            )}
            <button 
              onClick={() => setActiveTab('participants')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 font-cyber font-bold text-xs sm:text-sm uppercase tracking-wider transition whitespace-nowrap border-b-2 ${activeTab === 'participants' ? 'border-amber-400 text-amber-300 bg-[#05030a]' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-purple-950/30'}`}
            >
              <Users size={15} /> {canConfigure ? 'Participantes & Inscrições' : 'Entrar no Campeonato & Inscritos'}{' '}
              <span className="bg-purple-950/90 border border-purple-500/40 text-amber-300 font-mono text-xs px-2 py-0.5">{participants.length}</span>
            </button>
            <button 
              onClick={() => setActiveTab('bracket')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 font-cyber font-bold text-xs sm:text-sm uppercase tracking-wider transition whitespace-nowrap border-b-2 ${activeTab === 'bracket' ? 'border-amber-400 text-amber-300 bg-[#05030a]' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-purple-950/30'}`}
            >
              <Trophy size={15} /> Tabela & Agenda de Duelos
            </button>
          </div>

          {/* BANNER DE VINCULAÇÃO DE CONTA */}
          {!myLinkedParticipant ? (
            <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border-b border-purple-500/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-2.5 text-slate-300 min-w-0">
                <Sparkles size={16} className="text-amber-400 shrink-0" />
                <span className="leading-snug">
                  {user ? (
                    <>Você está conectado como <b className="text-white">{user.displayName || 'Jogador'}</b>. Inscreva-se ou vincule sua conta para disputar este campeonato!</>
                  ) : (
                    <>Conecte sua conta Google ou inscreva seu nome abaixo para participar deste campeonato e registrar seus títulos no <b className="text-amber-300">Histórico de Campeonatos</b>!</>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {user ? (
                  <button
                    onClick={handleAddMyselfAndLink}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    <UserCheck size={13} />
                    <span>Entrar Agora como {user.displayName || 'Jogador'}</span>
                  </button>
                ) : (
                  <button
                    onClick={onOpenAuth}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    <LogIn size={13} />
                    <span>Conectar Minha Conta</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-emerald-950/50 border-b border-emerald-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-300 shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle size={15} className="text-emerald-400 shrink-0" />
                <span>
                  Você está inscrito neste campeonato como <b className="text-white">{myLinkedParticipant.name}</b>! Ao concluir o torneio, seu resultado será gravado no seu perfil.
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
        </>
      )}

      {/* TOAST NOTIFICAÇÃO VINCULO */}
      {linkSuccessMessage && (
        <div className="bg-emerald-600 text-white text-xs font-bold py-2 px-4 text-center flex items-center justify-center gap-2 shadow-md">
          <CheckCircle size={15} />
          <span>{linkSuccessMessage}</span>
        </div>
      )}

      {/* CONTENT */}
      <div
        className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#1a1a1a]"
        onScroll={(e) => {
          if (!tourForceTab && e.currentTarget.scrollTop > 35 && !isTopBarMinimized) {
            setIsTopBarMinimized(true);
          }
        }}
      >
        <div className="max-w-5xl mx-auto space-y-6">

          {/* QUADRO OFICIAL DE DATAS (INÍCIO / FIM) & PREMIAÇÕES (TOP 1 / 2 / 3 e 4 A 8) - VISÍVEL PARA TODOS */}
          {(hasAnyScheduleOrPrizes || !canConfigure) && (
            <div className="bg-gradient-to-r from-[#171126] via-[#121624] to-[#191229] border border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 flex items-center justify-center shrink-0">
                    <Trophy size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-400 block">
                      INFORMAÇÕES OFICIAIS DO CAMPEONATO
                    </span>
                    <h3 className="text-sm sm:text-base font-cinzel font-black text-white">
                      Cronograma & Premiação Oficial ({name || 'Campeonato Light Dark TCG'})
                    </h3>
                  </div>
                </div>

                {/* Datas de Início e Fim */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-3 py-1.5 rounded-xl bg-black/50 border border-cyan-500/35 flex items-center gap-1.5 text-xs">
                    <Calendar size={13} className="text-cyan-400" />
                    <span className="text-slate-400">Início:</span>
                    <b className="text-cyan-300 font-mono">{formatDateDisplay(startDate) || 'A definir'}</b>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-black/50 border border-purple-500/35 flex items-center gap-1.5 text-xs">
                    <Calendar size={13} className="text-purple-400" />
                    <span className="text-slate-400">Término:</span>
                    <b className="text-purple-300 font-mono">{formatDateDisplay(endDate) || 'A definir'}</b>
                  </div>
                </div>
              </div>

              {/* Cards de Premiação Top 1 / Top 2 / Top 3 / Top 4 a 8 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-gradient-to-b from-amber-950/60 to-black/60 border border-amber-400/60 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                      <Crown size={12} className="text-amber-400" /> TOP 1 • CAMPEÃO
                    </span>
                    <span className="text-xs">🏆</span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-white break-words">
                    {prizes.top1 || 'A definir pelo organizador'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-gradient-to-b from-slate-800/70 to-black/60 border border-slate-400/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-200 flex items-center gap-1">
                      <Medal size={12} className="text-slate-300" /> TOP 2 • VICE-CAMPEÃO
                    </span>
                    <span className="text-xs">🥈</span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-100 break-words">
                    {prizes.top2 || 'A definir pelo organizador'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-gradient-to-b from-amber-900/40 to-black/60 border border-amber-700/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <Medal size={12} className="text-amber-500" /> TOP 3 • 3º LUGAR
                    </span>
                    <span className="text-xs">🥉</span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-amber-100 break-words">
                    {prizes.top3 || 'A definir pelo organizador'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-gradient-to-b from-purple-950/60 to-black/60 border border-purple-500/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider text-purple-300 flex items-center gap-1">
                      <Award size={12} className="text-purple-400" /> TOP 4 A 8 • 4º AO 8º
                    </span>
                    <span className="text-xs">🎖️</span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-purple-100 break-words">
                    {prizes.top4to8 || 'A definir pelo organizador'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CENTRAL DE TRANSMISSÕES AO VIVO PARA CONVIDADOS (ASSISTIR PARTIDAS AO VIVO) */}
          {(() => {
            const validMatches = matches.filter((m) => !m.isBye && m.player1 && m.player2);
            const liveMatchesList = validMatches.filter((m) => isMatchCurrentlyLive(m));
            const ongoingMatchesList = validMatches.filter(
              (m) => m.status !== 'completed' && !isMatchCurrentlyLive(m)
            );

            if (liveMatchesList.length === 0 && (canConfigure || ongoingMatchesList.length === 0)) {
              return null;
            }

            return (
              <div
                className={`rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 border-2 transition ${
                  liveMatchesList.length > 0
                    ? 'bg-gradient-to-r from-[#240b15] via-[#170e29] to-[#1f0c18] border-red-500/80 shadow-[0_0_30px_rgba(239,68,68,0.25)]'
                    : 'bg-gradient-to-r from-[#13192b] via-[#161129] to-[#121a2a] border-cyan-500/40'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        liveMatchesList.length > 0
                          ? 'bg-red-600 text-white border-red-300 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse'
                          : 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50'
                      }`}
                    >
                      {liveMatchesList.length > 0 ? <Radio size={20} /> : <Tv size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                            liveMatchesList.length > 0
                              ? 'bg-red-600 text-white'
                              : 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {liveMatchesList.length > 0
                            ? `🔴 ${liveMatchesList.length} PARTIDA(S) AO VIVO AGORA`
                            : '📺 SALAS DE TRANSMISSÃO DISPONÍVEIS PARA CONVIDADOS'}
                        </span>
                        <span className="text-[10px] font-mono text-amber-300 uppercase">
                          • Modo Espectador Liberado
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-cinzel font-black text-white mt-1">
                        {liveMatchesList.length > 0
                          ? 'Assista às Partidas que Estão Acontecendo Ao Vivo!'
                          : 'Central de Transmissão Ao Vivo para Convidados'}
                      </h3>
                    </div>
                  </div>

                  {activeTab !== 'bracket' && validMatches.length > 0 && (
                    <button
                      onClick={() => setActiveTab('bracket')}
                      className="px-3.5 py-2 rounded-xl bg-black/60 hover:bg-black/80 border border-white/15 text-xs font-bold text-amber-300 flex items-center gap-1.5 shrink-0 transition"
                    >
                      <Trophy size={13} />
                      <span>Ver Agenda Completa ({validMatches.length})</span>
                    </button>
                  )}
                </div>

                {/* Lista de Partidas Ao Vivo Agora */}
                {liveMatchesList.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {liveMatchesList.map((m) => {
                      const liveInfo = liveRoomsByMatchId[m.id];
                      const p1Name = m.player1?.name || 'Jogador 1';
                      const p2Name = m.player2?.name || 'Jogador 2';
                      const s1 = liveInfo ? liveInfo.p1Wins : m.score1 ?? 0;
                      const s2 = liveInfo ? liveInfo.p2Wins : m.score2 ?? 0;

                      return (
                        <div
                          key={m.id}
                          className="p-3.5 rounded-xl bg-black/60 border border-red-500/60 flex flex-col justify-between gap-3 shadow-lg"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2 py-0.5 rounded bg-red-600 text-white font-mono font-black text-[10px] flex items-center gap-1 animate-pulse">
                              <Radio size={11} /> AO VIVO • RODADA {m.round}
                            </span>
                            {m.refereeName && (
                              <span className="text-[10px] font-mono text-amber-300 flex items-center gap-1">
                                <Gavel size={11} /> Juiz: <b>{m.refereeName}</b>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-3 bg-[#120b20] px-3 py-2.5 rounded-xl border border-purple-500/30">
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-white text-xs sm:text-sm truncate block">
                                {p1Name}
                              </span>
                              {liveInfo && (
                                <span className="text-[10px] font-mono text-red-300">
                                  ❤️ {liveInfo.p1Life} Vida
                                </span>
                              )}
                            </div>

                            <div className="px-3 py-1 rounded-lg bg-black border border-amber-500/40 font-mono font-black text-base text-amber-400 shrink-0">
                              {s1} <span className="text-xs text-slate-500">x</span> {s2}
                            </div>

                            <div className="min-w-0 flex-1 text-right">
                              <span className="font-bold text-white text-xs sm:text-sm truncate block">
                                {p2Name}
                              </span>
                              {liveInfo && (
                                <span className="text-[10px] font-mono text-red-300">
                                  ❤️ {liveInfo.p2Life} Vida
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] text-slate-300 truncate">
                              {liveInfo?.spotlightCardName ? (
                                <span>
                                  ✨ Carta na mesa: <b className="text-amber-300">{liveInfo.spotlightCardName}</b>
                                </span>
                              ) : (
                                <span>📷 Câmeras & Marcadores em Tempo Real</span>
                              )}
                            </div>

                            <button
                              onClick={() => handleOpenMatchBroadcast(m, 'spectator')}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shrink-0 transition active:scale-95"
                            >
                              <Eye size={14} />
                              <span>Assistir Ao Vivo</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Caso não haja partida com flag vermelha ainda, exibe as partidas da rodada atual para o convidado assistir com 1 clique */}
                {liveMatchesList.length === 0 && ongoingMatchesList.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-300">
                      Escolha qualquer confronto em andamento abaixo para abrir a <b>Sala de Transmissão em Modo Espectador</b> e assistir às câmeras e contadores em tempo real:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {ongoingMatchesList.slice(0, 4).map((m) => (
                        <div
                          key={m.id}
                          className="p-3 rounded-xl bg-black/50 border border-cyan-500/30 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <span className="text-[10px] font-mono text-cyan-300 block">
                              Rodada {m.round} • MD3 {m.refereeName ? `• Juiz: ${m.refereeName}` : ''}
                            </span>
                            <div className="text-xs sm:text-sm font-bold text-white truncate">
                              {m.player1?.name} <span className="text-amber-400 font-mono">vs</span> {m.player2?.name}
                            </div>
                          </div>
                          <button
                            onClick={() => handleOpenMatchBroadcast(m, 'spectator')}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-black text-xs flex items-center gap-1.5 shrink-0 shadow transition"
                          >
                            <Eye size={13} />
                            <span>Assistir Partida</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          
          {/* CONFIG TAB (SOMENTE ORGANIZADOR) */}
          {activeTab === 'config' && canConfigure && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
              
              {/* Nome */}
              <div className="bg-[#242424] p-6 rounded-xl border border-[#333]">
                <label className="block text-sm font-bold text-white mb-2">Nome da Liga / Copa / Torneio <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    persistTournament({ name: e.target.value });
                  }}
                  className="w-full bg-[#1a1a1a] border border-[#444] rounded-xl p-3 text-white focus:border-[#a855f7] outline-none transition"
                  placeholder="Ex: 1ª Liga Oficial Light Dark TCG 2026"
                />
              </div>

              {/* Cronograma (Data Início e Data Fim) & Premiações (Top 1 / 2 / 3 e 4 a 8) */}
              <div className="bg-[#242424] p-6 rounded-xl border border-amber-500/40 space-y-6 shadow-lg">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#383838] pb-3">
                  <div>
                    <h4 className="font-cinzel font-black text-base sm:text-lg text-amber-300 flex items-center gap-2">
                      <Trophy size={18} className="text-amber-400" />
                      <span>Cronograma & Premiações do Campeonato</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Defina a Data de Início, Data de Fim e os Prêmios de Top 1, Top 2, Top 3 e Top 4 a 8 antes de enviar o link para os jogadores entrarem.
                    </p>
                  </div>
                </div>

                {/* Datas: Início e Fim */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#3a3a3a] space-y-1.5">
                    <label className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={14} className="text-cyan-400" /> Data de Início
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        persistTournament({ startDate: e.target.value });
                      }}
                      className="w-full bg-[#121212] border border-[#444] rounded-xl p-2.5 text-sm text-white focus:border-cyan-400 outline-none font-mono"
                    />
                  </div>

                  <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#3a3a3a] space-y-1.5">
                    <label className="text-xs font-black text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar size={14} className="text-purple-400" /> Data de Fim (Encerramento)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        persistTournament({ endDate: e.target.value });
                      }}
                      className="w-full bg-[#121212] border border-[#444] rounded-xl p-2.5 text-sm text-white focus:border-purple-400 outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Premiações: Top 1, Top 2, Top 3 e Top 4 a 8 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-amber-950/35 to-[#1a1a1a] p-4 rounded-xl border border-amber-500/50 space-y-1.5">
                    <label className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Crown size={14} className="text-amber-400" /> Prêmio Top 1 (1º Lugar • Campeão 🏆)
                    </label>
                    <input
                      type="text"
                      value={prizes.top1}
                      onChange={(e) => {
                        const nextPrizes = { ...prizes, top1: e.target.value };
                        setPrizes(nextPrizes);
                        persistTournament({ prizes: nextPrizes });
                      }}
                      placeholder="Ex: R$ 500,00 + Booster Box + Troféu Oficial"
                      className="w-full bg-[#121212] border border-amber-500/40 rounded-xl p-2.5 text-sm text-white focus:border-amber-400 outline-none"
                    />
                  </div>

                  <div className="bg-[#1a1a1a] p-4 rounded-xl border border-slate-600/50 space-y-1.5">
                    <label className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Medal size={14} className="text-slate-300" /> Prêmio Top 2 (2º Lugar • Vice-Campeão 🥈)
                    </label>
                    <input
                      type="text"
                      value={prizes.top2}
                      onChange={(e) => {
                        const nextPrizes = { ...prizes, top2: e.target.value };
                        setPrizes(nextPrizes);
                        persistTournament({ prizes: nextPrizes });
                      }}
                      placeholder="Ex: R$ 250,00 + 10 Boosters + Playmat"
                      className="w-full bg-[#121212] border border-[#444] rounded-xl p-2.5 text-sm text-white focus:border-slate-300 outline-none"
                    />
                  </div>

                  <div className="bg-[#1a1a1a] p-4 rounded-xl border border-amber-700/50 space-y-1.5">
                    <label className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Medal size={14} className="text-amber-500" /> Prêmio Top 3 (3º Lugar 🥉)
                    </label>
                    <input
                      type="text"
                      value={prizes.top3}
                      onChange={(e) => {
                        const nextPrizes = { ...prizes, top3: e.target.value };
                        setPrizes(nextPrizes);
                        persistTournament({ prizes: nextPrizes });
                      }}
                      placeholder="Ex: R$ 100,00 + 5 Boosters"
                      className="w-full bg-[#121212] border border-[#444] rounded-xl p-2.5 text-sm text-white focus:border-amber-500 outline-none"
                    />
                  </div>

                  <div className="bg-[#1a1a1a] p-4 rounded-xl border border-purple-500/40 space-y-1.5">
                    <label className="text-xs font-black text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Award size={14} className="text-purple-400" /> Prêmio Top 4 a 8 (4º ao 8º Lugar 🎖️)
                    </label>
                    <input
                      type="text"
                      value={prizes.top4to8}
                      onChange={(e) => {
                        const nextPrizes = { ...prizes, top4to8: e.target.value };
                        setPrizes(nextPrizes);
                        persistTournament({ prizes: nextPrizes });
                      }}
                      placeholder="Ex: 2 Boosters + Carta Promo Exclusiva para cada"
                      className="w-full bg-[#121212] border border-[#444] rounded-xl p-2.5 text-sm text-white focus:border-purple-400 outline-none"
                    />
                  </div>
                </div>
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
                        const newFmt = e.target.value;
                        setFormat(newFmt);
                        if (newFmt === 'liga_pontos' && !tournamentStarted) {
                          const updatedPs = participants.map((p) => ({
                            ...p,
                            points: p.points === 0 ? leagueInitialPoints : p.points
                          }));
                          setParticipants(updatedPs);
                          persistTournament({ format: newFmt as any, participants: updatedPs });
                        } else {
                          persistTournament({ format: newFmt as any });
                        }
                      }}
                      disabled={tournamentStarted}
                      className="w-full bg-[#1a1a1a] border border-[#a855f7] rounded-xl p-3 text-white outline-none appearance-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="liga_pontos">Liga Dinâmica (Pontos de Liga / Rating ELO • Entrada Contínua de Novos Jogadores • Bônus de Zebra)</option>
                      <option value="copa_pontos_corridos">Copa por Pontos Corridos (MD3 • Agenda de Duelos & Juízes • 3 pts Vit / 1 pt Emp / W.O. 3 pts)</option>
                      <option value="single_elimination">Eliminação Simples (Mata-mata)</option>
                      <option value="round_robin">Todos contra Todos Clássico (Round Robin)</option>
                      <option value="swiss">Formato Suíço (Swiss)</option>
                      <option value="leaderboard">Tabela de Classificação Manual (Leaderboard)</option>
                    </select>

                    {/* Liga Dinâmica (Pontos de Liga & Entrada Contínua de Novos Jogadores) Options */}
                    {format === 'liga_pontos' && (
                      <div className="space-y-4 pt-2">
                        <div className="p-4 bg-gradient-to-r from-cyan-950/60 via-[#150d2a] to-purple-950/50 border border-cyan-500/40 rounded-xl space-y-2.5 text-xs">
                          <div className="flex items-center gap-2 text-cyan-300 font-black uppercase tracking-wider">
                            <Flame size={15} className="text-amber-400" />
                            <span>Regras da Liga Dinâmica (Pontos de Liga, Bônus de Vitória & Penalidade por Inatividade)</span>
                          </div>
                          <ul className="space-y-1 text-slate-300">
                            <li>• <b>Entrada Livre Durante o Campeonato</b>: Novos jogadores podem entrar na Liga a qualquer momento começando com <b className="text-amber-300">{leagueInitialPoints} Pontos de Liga (PDL)</b>.</li>
                            <li>• <b>Pontos Roubados (Zebra) + Bônus de Vitória</b>: Além dos pontos roubados do adversário pelo cálculo de Zebra, o vencedor recebe <b className="text-emerald-400">+{leagueWinBonusPoints} PDL extras de Bônus de Vitória</b>.</li>
                            <li>• <b>Penalidade por Inatividade Semanal</b>: Evita que jogadores acumulem muitos pontos e parem de jogar. A cada semana (7 dias) sem partida registrada, o jogador perde <b className="text-rose-400">{leagueInactivityPenaltyEnabled ? `${leagueInactivityPenaltyPointsPerWeek} PDL` : '0 PDL (Desativado)'}</b>.</li>
                            <li>• <b>Partidas Presenciais (Lançamento Manual) & Estúdio Online</b>: Permite anotar partidas presenciais informando Conta do Jogador 1 x Conta do Jogador 2 / Resultado / Nome do Juiz.</li>
                          </ul>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                            <div className="bg-black/40 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                              <div>
                                <span className="text-white font-bold block">Pontos de Liga Iniciais (PDL)</span>
                                <span className="text-[10px] text-slate-400">Pontuação base de todo novo jogador</span>
                              </div>
                              <input
                                type="number"
                                min={100}
                                max={5000}
                                step={50}
                                value={leagueInitialPoints}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1000;
                                  setLeagueInitialPoints(val);
                                  const { participants: recalcP, matches: recalcM } = recalculateLeagueStandings(
                                    participants,
                                    matches,
                                    { initialPts: val }
                                  );
                                  setParticipants(recalcP);
                                  setMatches(recalcM);
                                  persistTournament({
                                    leagueInitialPoints: val,
                                    participants: recalcP,
                                    matches: recalcM
                                  });
                                }}
                                className="w-20 bg-[#14111d] border border-cyan-500/40 rounded-lg p-1.5 text-center font-mono font-black text-amber-300 outline-none"
                              />
                            </div>

                            <div className="bg-black/40 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                              <div>
                                <span className="text-white font-bold block">Impacto de Zebra (Fator K)</span>
                                <span className="text-[10px] text-slate-400">Maior valor = mais pontos roubados na zebra</span>
                              </div>
                              <input
                                type="number"
                                min={16}
                                max={120}
                                step={4}
                                value={leagueKFactor}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 48;
                                  setLeagueKFactor(val);
                                  const { participants: recalcP, matches: recalcM } = recalculateLeagueStandings(
                                    participants,
                                    matches,
                                    { kFactor: val }
                                  );
                                  setParticipants(recalcP);
                                  setMatches(recalcM);
                                  persistTournament({
                                    leagueKFactor: val,
                                    participants: recalcP,
                                    matches: recalcM
                                  });
                                }}
                                className="w-20 bg-[#14111d] border border-purple-500/40 rounded-lg p-1.5 text-center font-mono font-black text-emerald-400 outline-none"
                              />
                            </div>

                            {/* Bônus de Vitória (+X PDL) */}
                            <div className="bg-black/40 p-2.5 rounded-xl border border-emerald-500/30 flex items-center justify-between gap-2">
                              <div>
                                <span className="text-emerald-300 font-bold block">Bônus Extra por Vitória (+PDL)</span>
                                <span className="text-[10px] text-slate-400">Pontos extras além dos pontos roubados</span>
                              </div>
                              <input
                                type="number"
                                min={0}
                                max={500}
                                step={5}
                                value={leagueWinBonusPoints}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setLeagueWinBonusPoints(val);
                                  const { participants: recalcP, matches: recalcM } = recalculateLeagueStandings(
                                    participants,
                                    matches,
                                    { winBonusPts: val }
                                  );
                                  setParticipants(recalcP);
                                  setMatches(recalcM);
                                  persistTournament({
                                    leagueWinBonusPoints: val,
                                    participants: recalcP,
                                    matches: recalcM
                                  });
                                }}
                                className="w-20 bg-[#14111d] border border-emerald-500/50 rounded-lg p-1.5 text-center font-mono font-black text-emerald-300 outline-none"
                              />
                            </div>

                            {/* Penalidade por Inatividade Semanal */}
                            <div className="bg-black/40 p-2.5 rounded-xl border border-rose-500/30 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id="toggle-league-inactivity"
                                    checked={leagueInactivityPenaltyEnabled}
                                    onChange={(e) => {
                                      const enabled = e.target.checked;
                                      setLeagueInactivityPenaltyEnabled(enabled);
                                      const { participants: recalcP, matches: recalcM } = recalculateLeagueStandings(
                                        participants,
                                        matches,
                                        { inactivityEnabled: enabled }
                                      );
                                      setParticipants(recalcP);
                                      setMatches(recalcM);
                                      persistTournament({
                                        leagueInactivityPenaltyEnabled: enabled,
                                        participants: recalcP,
                                        matches: recalcM
                                      });
                                    }}
                                    className="accent-rose-500 w-3.5 h-3.5 cursor-pointer"
                                  />
                                  <label htmlFor="toggle-league-inactivity" className="text-rose-300 font-bold cursor-pointer truncate">
                                    Penalidade por Inatividade
                                  </label>
                                </div>
                                <span className="text-[10px] text-slate-400 block">
                                  PDL perdidos a cada semana sem partida
                                </span>
                              </div>
                              <input
                                type="number"
                                min={0}
                                max={1000}
                                step={5}
                                disabled={!leagueInactivityPenaltyEnabled}
                                value={leagueInactivityPenaltyPointsPerWeek}
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setLeagueInactivityPenaltyPointsPerWeek(val);
                                  const { participants: recalcP, matches: recalcM } = recalculateLeagueStandings(
                                    participants,
                                    matches,
                                    { inactivityPtsPerWeek: val }
                                  );
                                  setParticipants(recalcP);
                                  setMatches(recalcM);
                                  persistTournament({
                                    leagueInactivityPenaltyPointsPerWeek: val,
                                    participants: recalcP,
                                    matches: recalcM
                                  });
                                }}
                                className="w-20 bg-[#14111d] border border-rose-500/50 disabled:opacity-40 rounded-lg p-1.5 text-center font-mono font-black text-rose-300 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Copa por Pontos Corridos Options & Registro de Juízes */}
                    {(format === 'copa_pontos_corridos' || format === 'liga_pontos') && (
                      <div className="space-y-4 pt-2">
                        {format === 'copa_pontos_corridos' && (
                          <div className="p-4 bg-gradient-to-r from-purple-950/60 via-[#150d2a] to-cyan-950/40 border border-amber-500/40 rounded-xl space-y-2 text-xs">
                            <div className="flex items-center gap-2 text-amber-300 font-black uppercase tracking-wider">
                              <Trophy size={15} />
                              <span>Regras Oficiais da Copa por Pontos Corridos</span>
                            </div>
                            <ul className="space-y-1 text-slate-300">
                              <li>• <b>Partidas MD3 (Melhor de 3)</b>: Todos os jogadores vinculados se enfrentam na Agenda de Duelos.</li>
                              <li>• <b>Pontuação</b>: Vitória = <b className="text-emerald-400">3 pontos</b> | Empate = <b className="text-amber-300">1 ponto</b> | Derrota = 0 pontos.</li>
                              <li>• <b>Regra de W.O.</b>: Concede <b className="text-cyan-300">3 pontos (vitória 2-0)</b> diretamente para o jogador que compareceu.</li>
                              <li>• <b>Estúdio de Duelo Online</b>: Suporte integrado para até 2 câmeras por jogador (Deck + Rosto opcional), gravação, marcadores completos do App Duelo e exibição de cartas na tela por câmera ou busca rápida do Admin.</li>
                            </ul>
                          </div>
                        )}

                        {/* Cadastro de Juízes da Partida (Registrados pelo Admin/Organizador) */}
                        <div className="p-4 bg-[#1a1a1a] border border-[#3a3a3a] rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                              <Gavel size={14} /> Juízes Oficiais (Registrados por Você)
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {referees.length} juiz(es) registrado(s)
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={newRefereeName}
                              onChange={(e) => setNewRefereeName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddReferee()}
                              placeholder="Nome do Juiz da partida..."
                              className="flex-1 bg-[#242424] border border-[#444] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                            />
                            <input
                              type="text"
                              value={newRefereeRole}
                              onChange={(e) => setNewRefereeRole(e.target.value)}
                              placeholder="Função (Ex: Juiz Principal)"
                              className="sm:w-44 bg-[#242424] border border-[#444] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                            />
                            <button
                              type="button"
                              onClick={handleAddReferee}
                              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1 shrink-0"
                            >
                              <Plus size={14} /> Registrar Juiz
                            </button>
                          </div>

                          {referees.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {referees.map((ref) => (
                                <div
                                  key={ref.id}
                                  className="px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/40 flex items-center gap-2 text-xs"
                                >
                                  <Gavel size={12} className="text-amber-400" />
                                  <span className="font-bold text-white">{ref.name}</span>
                                  <span className="text-[10px] text-purple-300">({ref.role || 'Juiz'})</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveReferee(ref.id)}
                                    className="text-slate-400 hover:text-red-400"
                                    title="Remover Juiz"
                                  >
                                    <X size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

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

              {/* Fluxo de Criação -> Gerar Link de Convidados para Preencher Jogadores */}
              <div className="bg-gradient-to-r from-purple-950/70 via-[#171128] to-cyan-950/60 border border-cyan-500/40 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
                    <Share2 size={12} /> PRÓXIMO PASSO: CONVIDAR JOGADORES PELO LINK
                  </span>
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    Salve o Campeonato e envie o Link de Convite para os jogadores se inscreverem
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    O <b>Link de Convidados</b> abre exclusivamente a tela de <b>Inscrição e Acompanhamento</b> (os convidados <b>não</b> têm acesso às configurações).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={async () => {
                      await persistTournament();
                      setShowShareModal(true);
                    }}
                    className="flex-1 md:flex-none px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs transition shadow-lg flex items-center justify-center gap-2"
                  >
                    <Share2 size={15} />
                    <span>Salvar & Gerar Link de Convidados</span>
                  </button>
                  <button 
                    type="button"
                    onClick={async () => {
                      await persistTournament();
                      setActiveTab('participants');
                    }}
                    className="flex-1 md:flex-none bg-[#9333ea] hover:bg-[#7e22ce] text-white px-6 py-3 rounded-xl font-bold text-xs transition shadow-lg text-center"
                  >
                    Avançar para Participantes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PARTICIPANTS TAB */}
          {activeTab === 'participants' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                  <h3 className="text-2xl font-black text-white">
                    {canConfigure ? 'Gerenciar Participantes & Inscrições' : 'Inscrição de Jogadores no Campeonato'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {canConfigure
                      ? 'Adicione jogadores manualmente ou compartilhe o Link de Convite para que eles próprios entrem no campeonato.'
                      : 'Inscreva-se abaixo para entrar diretamente na lista de jogadores deste campeonato!'}
                  </p>
                </div>

                {canConfigure && (
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button
                      onClick={async () => {
                        await persistTournament();
                        setShowShareModal(true);
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-2 rounded-xl font-black text-xs transition shadow"
                    >
                      <Share2 size={14} /> LINK P/ JOGADORES ENTRAREM
                    </button>
                    <button 
                      onClick={handleShuffleSeeds}
                      disabled={tournamentStarted && !isLeagueMode}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#333] hover:bg-[#444] disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold text-xs transition"
                    >
                      <Shuffle size={14} /> EMBARALHAR
                    </button>
                    <button 
                      onClick={() => setIsBulkAdd(!isBulkAdd)}
                      disabled={tournamentStarted && !canLateJoin}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#333] hover:bg-[#444] disabled:opacity-50 text-white px-4 py-2 rounded-xl font-bold text-xs transition"
                    >
                      <AlignLeft size={14} /> EM MASSA
                    </button>
                  </div>
                )}
              </div>

              {/* PAINEL DE INSCRIÇÃO DE CONVIDADO (QUANDO ABERTO PELO LINK DE CONVIDADOS) */}
              {!canConfigure && (
                <div className="bg-gradient-to-r from-purple-950/70 via-[#151126] to-cyan-950/60 border-2 border-cyan-400/50 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <span className="text-[10px] font-mono font-black uppercase tracking-widest text-cyan-300 block">
                        PORTAL DE ENTRADA DO JOGADOR // CONVITE OFICIAL
                      </span>
                      <h4 className="text-lg sm:text-xl font-cinzel font-black text-white mt-0.5">
                        Entrar em: {name || 'Campeonato Light Dark TCG'}
                      </h4>
                      <p className="text-xs text-slate-300 mt-1">
                        {isLeagueMode
                          ? `Você iniciará na Liga Dinâmica com ${leagueInitialPoints} Pontos de Liga (PDL).`
                          : 'Confirme sua inscrição abaixo para garantir sua vaga na chave do campeonato.'}
                      </p>
                    </div>
                  </div>

                  {myLinkedParticipant ? (
                    <div className="p-4 rounded-xl bg-emerald-950/70 border border-emerald-400/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                        <div>
                          <div className="text-sm font-black text-white">
                            Inscrição Confirmada como <span className="text-emerald-300">{myLinkedParticipant.name}</span>!
                          </div>
                          <div className="text-xs text-emerald-200/80">
                            Seed #{myLinkedParticipant.seed} • Sua conta está vinculada ao campeonato.
                          </div>
                        </div>
                      </div>
                      {tournamentStarted && (
                        <button
                          onClick={() => setActiveTab('bracket')}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shrink-0"
                        >
                          Ver Tabela & Agenda de Duelos
                        </button>
                      )}
                    </div>
                  ) : (!tournamentStarted || canLateJoin) ? (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          type="text"
                          value={guestJoinName}
                          onChange={(e) => setGuestJoinName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleGuestJoinTournament()}
                          placeholder={
                            user?.displayName
                              ? `Seu Nick / Nome (ou deixe em branco para usar "${user.displayName}")...`
                              : 'Digite seu Nick ou Nome de Jogador para entrar no campeonato...'
                          }
                          className="flex-1 bg-black/70 border border-cyan-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
                        />
                        <button
                          onClick={() => handleGuestJoinTournament()}
                          disabled={isJoiningAsGuest || (!guestJoinName.trim() && !user?.displayName)}
                          className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 shrink-0"
                        >
                          <UserCheck size={17} />
                          <span>{isJoiningAsGuest ? 'Inscrevendo...' : 'Confirmar Minha Inscrição'}</span>
                        </button>
                      </div>

                      {!user && onOpenAuth && (
                        <div className="flex items-center justify-between gap-2 pt-1 text-xs text-slate-300 flex-wrap">
                          <span>Prefere entrar com sua Conta Google vinculada ao histórico oficial?</span>
                          <button
                            onClick={onOpenAuth}
                            className="text-amber-300 hover:text-amber-200 font-bold underline flex items-center gap-1"
                          >
                            <LogIn size={13} /> Fazer Login Google & Entrar
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-500/40 text-xs text-amber-200">
                      As inscrições para novos jogadores estão encerradas pois o torneio já foi iniciado. Se o seu nome já estiver na lista abaixo, clique em <b>"Vincular Minha Conta"</b> ao lado dele!
                    </div>
                  )}
                </div>
              )}

              {/* CONTROLES DE ADIÇÃO DO ORGANIZADOR */}
              {canConfigure && (
                <>
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
                        disabled={tournamentStarted && !canLateJoin}
                        className="flex-1 bg-[#242424] border border-[#444] rounded-xl p-3 text-white focus:border-[#a855f7] outline-none transition disabled:opacity-50 text-sm"
                        placeholder={
                          tournamentStarted && canLateJoin
                            ? `Adicionar novo jogador com o campeonato em andamento (${isLeagueMode ? `${leagueInitialPoints} PDL` : '0 pts'})...`
                            : 'Adicionar participante manualmente (ou use o Link de Convite)...'
                        }
                      />
                      <button 
                        onClick={() => handleAddParticipant()}
                        disabled={tournamentStarted && !canLateJoin}
                        className="bg-[#9333ea] hover:bg-[#7e22ce] disabled:bg-[#444] text-white px-6 py-3 rounded-xl font-bold transition flex items-center gap-2 whitespace-nowrap text-xs"
                      >
                        <Plus size={16} /> <span>{tournamentStarted && canLateJoin ? 'ENTRAR AGORA' : 'ADICIONAR'}</span>
                      </button>
                    </div>
                  )}

                  {/* Botão Atalho: Adicionar Minha Própria Conta */}
                  {user && !participants.some(p => p.userId === user.uid) && (!tournamentStarted || canLateJoin) && (
                    <div className="p-3 bg-purple-950/40 border border-purple-500/40 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-purple-200">
                        <Crown size={15} className="text-amber-400" />
                        <span>
                          Deseja entrar {isLeagueMode ? `na Liga (${leagueInitialPoints} PDL)` : 'neste torneio'} com sua conta conectada (<b>{user.displayName || 'Você'}</b>)?
                        </span>
                      </div>
                      <button
                        onClick={handleAddMyselfAndLink}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition shrink-0"
                      >
                        + Me Adicionar {isLeagueMode ? 'à Liga' : 'ao Torneio'}
                      </button>
                    </div>
                  )}
                </>
              )}

              {participants.length === 0 ? (
                <div className="bg-[#242424] p-12 rounded-xl border border-[#333] flex flex-col items-center justify-center text-center">
                  <Users size={64} className="text-[#444] mb-4" />
                  <h4 className="text-xl font-bold text-white mb-2 italic">Nenhum jogador inscrito ainda</h4>
                  <p className="text-slate-400 text-sm max-w-md">
                    {canConfigure
                      ? 'Compartilhe o Link de Convite com os jogadores para que eles se inscrevam automaticamente, ou adicione nomes acima.'
                      : 'Seja o primeiro a se inscrever neste campeonato usando o formulário acima!'}
                  </p>
                </div>
              ) : (
                <div className="bg-[#242424] rounded-xl border border-[#333] overflow-hidden shadow-lg">
                  <div className="grid grid-cols-[50px_1fr_auto] gap-4 p-4 border-b border-[#333] bg-[#1f1f1f] text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <div className="text-center">Seed</div>
                    <div>Jogadores Inscritos ({participants.length})</div>
                    <div className="w-24 text-right">Status / Vínculo</div>
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
                                {isLeagueMode && (
                                  <span className="text-[10px] font-mono text-amber-300 bg-black/50 px-1.5 py-0.5 rounded border border-amber-500/25">
                                    {p.points} PDL
                                  </span>
                                )}
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

                            {canConfigure && !tournamentStarted && (
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

              {canConfigure && (
                <div className="flex justify-end pt-4">
                  <button 
                    onClick={generateBracketHandler}
                    disabled={participants.length < 2}
                    className="bg-[#9333ea] hover:bg-[#7e22ce] disabled:bg-[#444] disabled:text-slate-500 text-white px-8 py-3 rounded-xl font-bold transition shadow-lg flex items-center gap-2 text-sm"
                  >
                    <PlayCircle size={18} /> {tournamentStarted ? 'Reiniciar Torneio' : 'Iniciar Torneio'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* BRACKET TAB */}
          {activeTab === 'bracket' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
              
              {!tournamentStarted ? (
                <div className="bg-[#242424] p-12 rounded-xl border border-[#333] text-center space-y-3">
                  <Trophy size={64} className="mx-auto text-[#444] mb-2" />
                  <p className="text-slate-300 font-bold text-base">
                    {canConfigure
                      ? 'Inicie o campeonato na aba Participantes quando os jogadores terminarem de se inscrever.'
                      : 'Aguardando o organizador iniciar as rodadas do campeonato!'}
                  </p>
                  {!canConfigure && (
                    <button
                      onClick={() => setActiveTab('participants')}
                      className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition"
                    >
                      Ir para Inscrição & Lista de Participantes ({participants.length})
                    </button>
                  )}
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
                  ) : canConfigure ? (
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
                  ) : null}

                  {/* Leaderboard View */}
                  {(format === 'swiss' || format === 'round_robin' || format === 'copa_pontos_corridos' || format === 'liga_pontos' || format === 'leaderboard') && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                        <h3 className="text-xl font-black text-white flex items-center gap-2">
                          <Award className="text-[#a855f7]" />{' '}
                          {format === 'swiss'
                            ? 'Classificação Suíça (Critérios Magic)'
                            : format === 'liga_pontos'
                            ? 'Ranking da Liga Dinâmica (Pontos de Liga • PDL)'
                            : format === 'copa_pontos_corridos'
                            ? 'Tabela da Copa por Pontos Corridos (MD3)'
                            : 'Classificação Geral'}
                        </h3>
                        {format === 'swiss' && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            Critérios MTG: OMW% → GW% → OGW%
                          </span>
                        )}
                        {format === 'liga_pontos' && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            Início: {leagueInitialPoints} PDL • Bônus de Zebra Ativo (K={leagueKFactor})
                          </span>
                        )}
                        {format === 'copa_pontos_corridos' && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            Vitória = 3 pts • Empate = 1 pt • W.O. = 3 pts
                          </span>
                        )}
                      </div>
                      {format === 'swiss' ? renderSwissStandings() : renderLeaderboard()}
                    </div>
                  )}

                  {/* Quick Referee Bar inside Bracket Tab for Copa por Pontos Corridos & Liga (Somente Organizador pode editar) */}
                  {(format === 'copa_pontos_corridos' || format === 'liga_pontos') && (canConfigure || referees.length > 0) && (
                    <div className="mb-6 bg-[#1e1b29] border border-purple-500/30 rounded-2xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Gavel size={16} className="text-amber-400" />
                          <span className="font-cinzel font-black text-xs sm:text-sm text-white uppercase">
                            Quadro de Juízes Oficiais do Campeonato
                          </span>
                        </div>
                        {canConfigure && (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newRefereeName}
                              onChange={(e) => setNewRefereeName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddReferee()}
                              placeholder="Registrar novo Juiz..."
                              className="bg-black border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                            />
                            <button
                              onClick={handleAddReferee}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1"
                            >
                              <Plus size={13} /> Adicionar Juiz
                            </button>
                          </div>
                        )}
                      </div>
                      {referees.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {referees.map((ref) => (
                            <span
                              key={ref.id}
                              className="px-2.5 py-1 rounded-lg bg-black/60 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-1.5"
                            >
                              <Gavel size={11} className="text-amber-400" />
                              <b>{ref.name}</b>
                              {canConfigure && (
                                <button
                                  onClick={() => handleRemoveReferee(ref.id)}
                                  className="text-slate-500 hover:text-red-400 ml-1"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Adicione os juízes acima para escalá-los nas partidas da Agenda de Duelos abaixo.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Matches View */}
                  {format === 'copa_pontos_corridos' || format === 'liga_pontos' ? (
                    renderCopaSchedule()
                  ) : format !== 'leaderboard' ? (
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
                            {canConfigure && (
                              currentRound < totalRounds ? (
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
                              )
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
                  ) : null}
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {/* MODAL COMPARTILHAR LINK DE CONVIDADOS DO CAMPEONATO */}
      {showShareModal && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1f1f1f] border border-cyan-500/40 w-full max-w-lg rounded-2xl p-6 text-white space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-300 flex items-center justify-center border border-cyan-500/40">
                  <Share2 size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">Link de Convite para Jogadores</h3>
                  <p className="text-xs text-slate-400">Envie este link para os jogadores entrarem no campeonato</p>
                </div>
              </div>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-cyan-300 block">
                Link Exclusivo de Convidados (Somente Inscrição & Visualização)
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={getTournamentShareUrl(tournamentId)}
                  className="flex-1 bg-black border border-slate-700 rounded-xl p-3 text-xs font-mono text-cyan-300 overflow-hidden text-ellipsis"
                />
                <button
                  onClick={handleCopyShareLink}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shrink-0"
                >
                  {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedLink ? 'Copiado!' : 'Copiar Link'}</span>
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-1.5 text-slate-300">
              <p className="font-bold text-amber-300 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" /> Proteção de Configurações Ativa:
              </p>
              <p>• <b>O link de convidados é somente para entrar no campeonato</b>, não permitindo configurar ou alterar regras, datas, prêmios ou resultados.</p>
              <p>• Ao abrir o link, o jogador convidado verá a <b>Data de Início, Data de Fim, Premiações (Top 1 / 2 / 3 e 4 a 8)</b> e poderá confirmar sua inscrição diretamente na lista de participantes!</p>
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

      {/* ESTÚDIO DE DUELO ONLINE & TRANSMISSÃO (2 CÂMERAS + APP DUELO + CARTA EM TELA + MODO ESPECTADOR PARA CONVIDADOS) */}
      {activeOnlineDuelMatch && (
        <OnlineDuelBroadcastModal
          isOpen={Boolean(activeOnlineDuelMatch)}
          onClose={() => {
            setActiveOnlineDuelMatch(null);
            setInitialBroadcastRole(undefined);
          }}
          tournamentId={tournamentId}
          tournamentName={name || 'Copa Light Dark TCG'}
          match={activeOnlineDuelMatch}
          allCards={allCards}
          isAdminOrCreator={isAdminOrCreator}
          currentUserUid={user?.uid}
          currentUserName={user?.displayName || undefined}
          referees={referees}
          initialRole={initialBroadcastRole}
          onLiveStatusChange={(matchId, nextLive) => {
            handleUpdateMatchLiveFlag(matchId, nextLive);
          }}
          onSaveMatchScore={(matchId, s1, s2, opts) => {
            handleSetMatchResult(matchId, s1, s2, opts);
          }}
        />
      )}

    </div>
  );
};
