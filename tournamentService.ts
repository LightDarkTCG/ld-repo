import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { signInWithEmailAndPassword, User } from 'firebase/auth';
import { db, auth } from './firebase';

export const OFFICIAL_ADMIN_EMAIL = 'viniciuspdiasuzumaki@gmail.com';

export interface Participant {
  id: string;
  seed: number;
  name: string;
  points: number;
  wins: number;
  losses: number;
  ties: number;
  matchesPlayed: number;
  userId?: string;
  userEmail?: string;
  userPhoto?: string;
}

export interface Match {
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

export interface FinalStanding {
  rank: number;
  participantId: string;
  participantName: string;
  userId?: string;
  userEmail?: string;
  userPhoto?: string;
  label: string; // 'Campeão 🏆', 'Vice-Campeão 🥈', '3º Lugar 🥉', etc.
  wins: number;
  losses: number;
  ties: number;
  points: number;
  omw?: number; // Opponents' Match-Win %
  gw?: number;  // Game-Win %
  ogw?: number; // Opponents' Game-Win %
}

export interface SwissTiebreakerStats {
  participantId: string;
  matchPoints: number;
  matchesPlayed: number;
  matchWins: number;
  matchLosses: number;
  matchTies: number;
  gameWins: number;
  gameLosses: number;
  gameTies: number;
  totalGames: number;
  mw: number;        // Raw Match-Win percentage (0.0 to 1.0)
  gw: number;        // Raw Game-Win percentage (0.0 to 1.0)
  omw: number;       // Opponents' Match-Win percentage (with 33% floor)
  ogw: number;       // Opponents' Game-Win percentage (with 33% floor)
  opponentsIds: string[]; // Real opponents IDs (excluding Byes)
}

export interface TournamentData {
  id: string;
  name: string;
  format: 'single_elimination' | 'round_robin' | 'swiss' | 'leaderboard';
  isOfficial: boolean;
  officialVerifiedAt?: string;
  creatorId: string;
  creatorName: string;
  creatorEmail?: string;
  status: 'draft' | 'in_progress' | 'completed';
  currentRound: number;
  totalRounds: number;
  // Swiss Config
  swissPtsWin?: string;
  swissPtsTie?: string;
  swissPtsBye?: string;
  swissRounds?: string;
  swissPhase?: 'swiss' | 'top4' | 'top2';
  // State
  participants: Participant[];
  matches: Match[];
  finalStandings?: FinalStanding[];
  createdAt: any;
  updatedAt: any;
  completedAt?: any;
}

export interface UserChampionshipHistoryEntry {
  id: string;
  tournamentId: string;
  tournamentName: string;
  isOfficial: boolean;
  format: string;
  rank: number;
  rankLabel: string;
  wins: number;
  losses: number;
  ties: number;
  points: number;
  totalParticipants: number;
  completedAt: string;
}

export const MASTER_OFFICIAL_PASSWORDS = [
  'ldt2025', 
  'vinicius2026', 
  'lightdarkoficial', 
  'lightdark2026',
  'oficial2026',
  'campeonato2026'
];

/**
 * Valida a senha da conta pessoal para criação/autenticação de Torneio Oficial
 */
export async function verifyOfficialTournamentPassword(password: string, currentUser?: User | null): Promise<boolean> {
  const cleanPass = (password || '').trim();
  if (!cleanPass) return false;

  // 1. Senhas mestras de emergência configuradas para o criador
  if (MASTER_OFFICIAL_PASSWORDS.includes(cleanPass.toLowerCase())) {
    return true;
  }

  // 2. Se o usuário atual logado for o admin oficial e confirmou sua senha
  if (currentUser?.email?.toLowerCase() === OFFICIAL_ADMIN_EMAIL.toLowerCase() && cleanPass.length >= 4) {
    return true;
  }

  // 3. Tenta autenticar diretamente com a conta de e-mail oficial
  try {
    await signInWithEmailAndPassword(auth, OFFICIAL_ADMIN_EMAIL, cleanPass);
    return true;
  } catch (err: any) {
    return false;
  }
}

/**
 * Salva ou atualiza um torneio no Firestore
 */
export async function saveTournamentToCloud(tournament: Partial<TournamentData> & { id: string }): Promise<void> {
  if (!tournament.id) throw new Error('ID do torneio é obrigatório.');

  const tournamentRef = doc(db, 'tournaments', tournament.id);
  const now = new Date().toISOString();

  await setDoc(tournamentRef, {
    ...tournament,
    updatedAt: now
  }, { merge: true });
}

/**
 * Ouve atualizações de um torneio em tempo real
 */
export function subscribeTournament(
  tournamentId: string, 
  onUpdate: (data: TournamentData | null) => void,
  onError?: (err: any) => void
): () => void {
  const tournamentRef = doc(db, 'tournaments', tournamentId);
  return onSnapshot(tournamentRef, (snap) => {
    if (snap.exists()) {
      onUpdate(snap.data() as TournamentData);
    } else {
      onUpdate(null);
    }
  }, (err) => {
    console.error('Erro ao ouvir torneio:', err);
    if (onError) onError(err);
  });
}

/**
 * Vincula a conta do jogador logado a um participante do torneio
 */
export async function linkPlayerAccountToParticipant(
  tournamentId: string,
  participantId: string,
  user: User
): Promise<void> {
  const tournamentRef = doc(db, 'tournaments', tournamentId);
  const snap = await getDoc(tournamentRef);
  if (!snap.exists()) throw new Error('Torneio não encontrado.');

  const data = snap.data() as TournamentData;
  const updatedParticipants = (data.participants || []).map(p => {
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
  });

  // Atualiza também nas partidas ativas
  const updatedMatches = (data.matches || []).map(m => {
    let p1 = m.player1;
    let p2 = m.player2;
    if (p1 && p1.id === participantId) {
      p1 = { ...p1, userId: user.uid, userEmail: user.email || '', userPhoto: user.photoURL || '' };
    }
    if (p2 && p2.id === participantId) {
      p2 = { ...p2, userId: user.uid, userEmail: user.email || '', userPhoto: user.photoURL || '' };
    }
    return { ...m, player1: p1, player2: p2 };
  });

  await updateDoc(tournamentRef, {
    participants: updatedParticipants,
    matches: updatedMatches,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Calcula os critérios oficiais de desempate do Magic: The Gathering para a fase Suíça:
 * 1. OMW% (Opponents' Match-Win Percentage - Média de vitórias dos oponentes, piso de 33%)
 * 2. GW% (Game-Win Percentage - Porcentagem individual de jogos vencidos, Bye = 2 a 0 limpo)
 * 3. OGW% (Opponents' Game-Win Percentage - Média de GW% dos oponentes, piso de 33%)
 * 
 * Regras de Proteção:
 * - O "Piso" de 33%: oponentes com MW% ou GW% abaixo de 33% são computados como 33% (0.33) para não punir quem os enfrentou.
 * - Desistências (Drops): o histórico do oponente até a saída continua contando com piso de 33%.
 * - Bye: concede 3 pontos de partida, conta 2-0 em jogos (GW%) e é TOTALMENTE ignorado no cálculo de oponentes (OMW% e OGW%).
 */
export function calculateSwissTiebreakers(
  participants: Participant[],
  matches: Match[]
): Map<string, SwissTiebreakerStats> {
  const statsMap = new Map<string, SwissTiebreakerStats>();

  // Inicializa cada participante
  for (const p of participants) {
    statsMap.set(p.id, {
      participantId: p.id,
      matchPoints: 0,
      matchesPlayed: 0,
      matchWins: 0,
      matchLosses: 0,
      matchTies: 0,
      gameWins: 0,
      gameLosses: 0,
      gameTies: 0,
      totalGames: 0,
      mw: 0.33,
      gw: 0.33,
      omw: 0.33,
      ogw: 0.33,
      opponentsIds: []
    });
  }

  // Percorre todas as partidas concluídas
  for (const m of matches) {
    if (m.status !== 'completed') continue;

    const isBye = m.isBye || !m.player1 || !m.player2 || m.player1.id === 'bye' || m.player2?.id === 'bye';

    if (isBye) {
      // Bye: O jogador ganha 3 pontos de partida, 2-0 limpo em jogos, e NÃO é oponente de ninguém
      const byePlayer = (m.player1 && m.player1.id !== 'bye') 
        ? m.player1 
        : ((m.player2 && m.player2.id !== 'bye') ? m.player2 : null);

      if (byePlayer && statsMap.has(byePlayer.id)) {
        const s = statsMap.get(byePlayer.id)!;
        s.matchPoints += 3;
        s.matchesPlayed += 1;
        s.matchWins += 1;
        s.gameWins += 2;
        s.gameLosses += 0;
        s.totalGames += 2;
        // Bye NUNCA entra em opponentsIds
      }
      continue;
    }

    // Partida regular entre dois jogadores
    const p1Id = m.player1.id;
    const p2Id = m.player2.id;
    const s1 = statsMap.get(p1Id);
    const s2 = statsMap.get(p2Id);

    const score1 = m.score1 ?? 0;
    const score2 = m.score2 ?? 0;

    if (s1) {
      s1.matchesPlayed += 1;
      s1.gameWins += score1;
      s1.gameLosses += score2;
      s1.totalGames += (score1 + score2);
      s1.opponentsIds.push(p2Id);

      if (score1 > score2) {
        s1.matchPoints += 3;
        s1.matchWins += 1;
      } else if (score2 > score1) {
        s1.matchLosses += 1;
      } else {
        s1.matchPoints += 1;
        s1.matchTies += 1;
      }
    }

    if (s2) {
      s2.matchesPlayed += 1;
      s2.gameWins += score2;
      s2.gameLosses += score1;
      s2.totalGames += (score1 + score2);
      s2.opponentsIds.push(p1Id);

      if (score2 > score1) {
        s2.matchPoints += 3;
        s2.matchWins += 1;
      } else if (score1 > score2) {
        s2.matchLosses += 1;
      } else {
        s2.matchPoints += 1;
        s2.matchTies += 1;
      }
    }
  }

  // 1. Calcula MW% e GW% individuais
  for (const s of statsMap.values()) {
    if (s.matchesPlayed > 0) {
      s.mw = s.matchPoints / (3 * s.matchesPlayed);
    } else {
      s.mw = 0.33;
    }

    if (s.totalGames > 0) {
      s.gw = (s.gameWins * 3 + s.gameTies * 1) / (3 * s.totalGames);
    } else {
      s.gw = 0.33;
    }
  }

  // 2. Calcula OMW% e OGW% com o Piso de 33% (ignorando Byes)
  for (const s of statsMap.values()) {
    const validOpponents = s.opponentsIds.filter(id => statsMap.has(id));
    if (validOpponents.length === 0) {
      s.omw = 0.33;
      s.ogw = 0.33;
    } else {
      let sumFlooredMW = 0;
      let sumFlooredGW = 0;
      for (const oppId of validOpponents) {
        const opp = statsMap.get(oppId)!;
        // Piso de 33%: oponente que perder tudo (0-4) conta como 33%
        sumFlooredMW += Math.max(0.33, opp.mw);
        sumFlooredGW += Math.max(0.33, opp.gw);
      }
      s.omw = sumFlooredMW / validOpponents.length;
      s.ogw = sumFlooredGW / validOpponents.length;
    }
  }

  return statsMap;
}

export function compareSwissPlayers(
  p1: Participant,
  p2: Participant,
  statsMap: Map<string, SwissTiebreakerStats>
): number {
  const s1 = statsMap.get(p1.id);
  const s2 = statsMap.get(p2.id);

  const pts1 = s1 ? s1.matchPoints : p1.points;
  const pts2 = s2 ? s2.matchPoints : p2.points;

  // 1. Pontos de Partida (3 vit / 1 emp / 0 der)
  if (pts2 !== pts1) {
    return pts2 - pts1;
  }

  // 2. 1º Critério: OMW% (Opponents' Match-Win Percentage)
  const omw1 = s1 ? s1.omw : 0.33;
  const omw2 = s2 ? s2.omw : 0.33;
  if (Math.abs(omw2 - omw1) > 0.0001) {
    return omw2 - omw1;
  }

  // 3. 2º Critério: GW% (Game-Win Percentage)
  const gw1 = s1 ? s1.gw : 0.33;
  const gw2 = s2 ? s2.gw : 0.33;
  if (Math.abs(gw2 - gw1) > 0.0001) {
    return gw2 - gw1;
  }

  // 4. 3º Critério: OGW% (Opponents' Game-Win Percentage)
  const ogw1 = s1 ? s1.ogw : 0.33;
  const ogw2 = s2 ? s2.ogw : 0.33;
  if (Math.abs(ogw2 - ogw1) > 0.0001) {
    return ogw2 - ogw1;
  }

  // 5. Fallback por vitórias / seed
  if (p2.wins !== p1.wins) {
    return p2.wins - p1.wins;
  }
  return p1.seed - p2.seed;
}

export function sortSwissParticipants(
  participants: Participant[],
  matches: Match[]
): { sorted: Participant[]; statsMap: Map<string, SwissTiebreakerStats> } {
  const statsMap = calculateSwissTiebreakers(participants, matches);
  const sorted = [...participants].sort((a, b) => compareSwissPlayers(a, b, statsMap));
  return { sorted, statsMap };
}

/**
 * Calcula a classificação final e registra no histórico dos jogadores com conta vinculada
 */
export async function finalizeTournamentAndRecordHistory(
  tournament: TournamentData
): Promise<FinalStanding[]> {
  const { participants, matches, format, swissPhase } = tournament;
  const standings: FinalStanding[] = [];

  if (format === 'single_elimination' || (format === 'swiss' && swissPhase !== 'swiss')) {
    // Mata-mata: Identificar Campeão e Vice pela última partida
    const completedMatches = matches.filter(m => m.status === 'completed' && m.winnerId);
    const lastMatch = completedMatches[completedMatches.length - 1];

    const championId = lastMatch?.winnerId;
    const runnerUpId = lastMatch ? (lastMatch.winnerId === lastMatch.player1?.id ? lastMatch.player2?.id : lastMatch.player1?.id) : null;

    // Participantes ordenados: Campeão (1), Vice (2), demais por vitórias/pontos
    const sorted = [...participants].sort((a, b) => {
      if (a.id === championId) return -1;
      if (b.id === championId) return 1;
      if (a.id === runnerUpId) return -1;
      if (b.id === runnerUpId) return 1;
      return b.points !== a.points ? b.points - a.points : b.wins - a.wins;
    });

    sorted.forEach((p, idx) => {
      let label = `${idx + 1}º Lugar`;
      if (p.id === championId) label = 'Campeão 🏆';
      else if (p.id === runnerUpId) label = 'Vice-Campeão 🥈';
      else if (idx === 2 || idx === 3) label = 'Semifinalista 🥉';

      standings.push({
        rank: idx + 1,
        participantId: p.id,
        participantName: p.name,
        userId: p.userId,
        userEmail: p.userEmail,
        userPhoto: p.userPhoto,
        label,
        wins: p.wins,
        losses: p.losses,
        ties: p.ties,
        points: p.points
      });
    });
  } else if (format === 'swiss') {
    // Suíço Oficial Magic: Critérios OMW% -> GW% -> OGW%
    const { sorted, statsMap } = sortSwissParticipants(participants, matches);

    sorted.forEach((p, idx) => {
      let label = `${idx + 1}º Lugar`;
      if (idx === 0) label = 'Campeão 🏆';
      else if (idx === 1) label = 'Vice-Campeão 🥈';
      else if (idx === 2) label = '3º Lugar 🥉';

      const s = statsMap.get(p.id);

      standings.push({
        rank: idx + 1,
        participantId: p.id,
        participantName: p.name,
        userId: p.userId,
        userEmail: p.userEmail,
        userPhoto: p.userPhoto,
        label,
        wins: s ? s.matchWins : p.wins,
        losses: s ? s.matchLosses : p.losses,
        ties: s ? s.matchTies : p.ties,
        points: s ? s.matchPoints : p.points,
        omw: s?.omw,
        gw: s?.gw,
        ogw: s?.ogw
      });
    });
  } else {
    // Todos contra todos / Leaderboard: ordenação por pontos
    const sorted = [...participants].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.wins - a.wins;
    });

    sorted.forEach((p, idx) => {
      let label = `${idx + 1}º Lugar`;
      if (idx === 0) label = 'Campeão 🏆';
      else if (idx === 1) label = 'Vice-Campeão 🥈';
      else if (idx === 2) label = '3º Lugar 🥉';

      standings.push({
        rank: idx + 1,
        participantId: p.id,
        participantName: p.name,
        userId: p.userId,
        userEmail: p.userEmail,
        userPhoto: p.userPhoto,
        label,
        wins: p.wins,
        losses: p.losses,
        ties: p.ties,
        points: p.points
      });
    });
  }

  const completedAt = new Date().toISOString();

  // 1. Atualiza o próprio torneio como concluído e armazena a tabela final
  await updateDoc(doc(db, 'tournaments', tournament.id), {
    status: 'completed',
    completedAt,
    finalStandings: standings,
    updatedAt: completedAt
  });

  // 2. Grava no histórico pessoal de cada jogador logado que participou
  for (const st of standings) {
    if (st.userId) {
      try {
        const historyRef = doc(db, 'users', st.userId, 'championshipHistory', tournament.id);
        const historyEntry: UserChampionshipHistoryEntry = {
          id: tournament.id,
          tournamentId: tournament.id,
          tournamentName: tournament.name || 'Torneio Light Dark TCG',
          isOfficial: !!tournament.isOfficial,
          format: tournament.format,
          rank: st.rank,
          rankLabel: st.label,
          wins: st.wins,
          losses: st.losses,
          ties: st.ties,
          points: st.points,
          totalParticipants: participants.length,
          completedAt
        };
        await setDoc(historyRef, historyEntry, { merge: true });
      } catch (err) {
        console.warn(`Erro ao registrar histórico para participante ${st.participantName}:`, err);
      }
    }
  }

  return standings;
}

/**
 * Busca o histórico completo de campeonatos de um usuário
 */
export async function fetchUserChampionshipHistory(userId: string): Promise<UserChampionshipHistoryEntry[]> {
  if (!userId) return [];
  try {
    const historyCol = collection(db, 'users', userId, 'championshipHistory');
    const snap = await getDocs(historyCol);
    const list: UserChampionshipHistoryEntry[] = [];
    snap.forEach(d => {
      list.push(d.data() as UserChampionshipHistoryEntry);
    });
    return list.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  } catch (err) {
    console.error('Erro ao buscar histórico de campeonatos:', err);
    return [];
  }
}

/**
 * Gera URL de compartilhamento do torneio
 */
export function getTournamentShareUrl(tournamentId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  return `${origin}${pathname}?torneio=${encodeURIComponent(tournamentId)}`;
}
