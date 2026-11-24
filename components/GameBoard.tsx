import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Menu, RotateCcw, Image as ImageIcon, LogOut, Check, History, Zap, Sparkles, Wifi, Smartphone, Copy, Users, ArrowRight } from 'lucide-react';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { storage, db } from '../firebase';

interface GameBoardProps {
  onClose: () => void;
  tourForceShowSetup?: boolean;
}

export default function GameBoard({ onClose, tourForceShowSetup }: GameBoardProps) {
  const [themes, setThemes] = useState([
    { id: 'default', name: 'Padrão', url: null }
  ]);

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

  // Mode: 'normal' (2 players, 20 HP, 12 Mana/round) | 'mesao' (4 players, 25 HP, 12 Mana start, +3 Mana/turn max 15, no round reset)
  const [duelMode, setDuelMode] = useState<'normal' | 'mesao'>('normal');

  // Connection mode: 'local' (same device) | 'online' (each player on their own phone)
  const [connectionType, setConnectionType] = useState<'local' | 'online'>('local');
  const [onlineTab, setOnlineTab] = useState<'create' | 'join'>('create');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [myPlayerSlot, setMyPlayerSlot] = useState<1 | 2 | 3 | 4>(1);
  const [myCustomName, setMyCustomName] = useState<string>('');
  const [onlineStatusMsg, setOnlineStatusMsg] = useState<string>('');
  const [isConnectingOnline, setIsConnectingOnline] = useState<boolean>(false);
  const [copiedRoomCode, setCopiedRoomCode] = useState<boolean>(false);
  const [joinedRoomPreview, setJoinedRoomPreview] = useState<any | null>(null);

  // Rounds counter
  const [rounds, setRounds] = useState(1);
  const [turns, setTurns] = useState(0);
  const [activePlayer, setActivePlayer] = useState<1 | 2 | 3 | 4>(2);

  // Menu & Modals
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [themeTargetPlayer, setThemeTargetPlayer] = useState<1 | 2 | 3 | 4 | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [showSetup, setShowSetup] = useState(tourForceShowSetup ?? true);

  useEffect(() => {
    if (typeof tourForceShowSetup === 'boolean') {
      setShowSetup(tourForceShowSetup);
    }
  }, [tourForceShowSetup]);

  // Match settings
  const [p1Name, setP1Name] = useState('Jogador 1');
  const [p2Name, setP2Name] = useState('Jogador 2');
  const [p3Name, setP3Name] = useState('Jogador 3');
  const [p4Name, setP4Name] = useState('Jogador 4');
  const [matchFormat, setMatchFormat] = useState<1 | 3 | 5>(3);
  const [p1Wins, setP1Wins] = useState(0);
  const [p2Wins, setP2Wins] = useState(0);
  const [p3Wins, setP3Wins] = useState(0);
  const [p4Wins, setP4Wins] = useState(0);

  // Backgrounds
  const [p1Background, setP1Background] = useState<string | null>(null);
  const [p2Background, setP2Background] = useState<string | null>(null);
  const [p3Background, setP3Background] = useState<string | null>(null);
  const [p4Background, setP4Background] = useState<string | null>(null);

  // Player 1
  const [p1Mana, setP1Mana] = useState(12);
  const [p1Life, setP1Life] = useState(20);
  const [p1CtReduction, setP1CtReduction] = useState(0);
  const [p1DeckDamage, setP1DeckDamage] = useState(0);
  const [p1Runes, setP1Runes] = useState(0);
  const [p1Insanity, setP1Insanity] = useState(100);

  // Player 2
  const [p2Mana, setP2Mana] = useState(12);
  const [p2Life, setP2Life] = useState(20);
  const [p2CtReduction, setP2CtReduction] = useState(0);
  const [p2DeckDamage, setP2DeckDamage] = useState(0);
  const [p2Runes, setP2Runes] = useState(0);
  const [p2Insanity, setP2Insanity] = useState(100);

  // Player 3 (Modo Mesão)
  const [p3Mana, setP3Mana] = useState(12);
  const [p3Life, setP3Life] = useState(25);
  const [p3CtReduction, setP3CtReduction] = useState(0);
  const [p3DeckDamage, setP3DeckDamage] = useState(0);
  const [p3Runes, setP3Runes] = useState(0);
  const [p3Insanity, setP3Insanity] = useState(100);

  // Player 4 (Modo Mesão)
  const [p4Mana, setP4Mana] = useState(12);
  const [p4Life, setP4Life] = useState(25);
  const [p4CtReduction, setP4CtReduction] = useState(0);
  const [p4DeckDamage, setP4DeckDamage] = useState(0);
  const [p4Runes, setP4Runes] = useState(0);
  const [p4Insanity, setP4Insanity] = useState(100);

  // Action Log
  const [actionLogs, setActionLogs] = useState<{ round: number, turn: number, activePlayer: number, diffs: string[] }[]>([]);
  const [turnStartState, setTurnStartState] = useState({
    p1Mana: 12, p1Life: 20, p1CtReduction: 0, p1DeckDamage: 0, p1Runes: 0, p1Insanity: 100,
    p2Mana: 12, p2Life: 20, p2CtReduction: 0, p2DeckDamage: 0, p2Runes: 0, p2Insanity: 100,
    p3Mana: 12, p3Life: 25, p3CtReduction: 0, p3DeckDamage: 0, p3Runes: 0, p3Insanity: 100,
    p4Mana: 12, p4Life: 25, p4CtReduction: 0, p4DeckDamage: 0, p4Runes: 0, p4Insanity: 100,
  });

  // Real-time Firestore listener when in an online room
  useEffect(() => {
    if (connectionType !== 'online' || !roomCode) return;

    const roomRef = doc(db, 'duelRooms', roomCode);
    const unsubscribe = onSnapshot(roomRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      if (data.duelMode === 'normal' || data.duelMode === 'mesao') setDuelMode(data.duelMode);
      if (data.matchFormat) setMatchFormat(data.matchFormat);
      if (typeof data.rounds === 'number') setRounds(data.rounds);
      if (typeof data.turns === 'number') setTurns(data.turns);
      if (typeof data.activePlayer === 'number') setActivePlayer(data.activePlayer as 1 | 2 | 3 | 4);

      if (typeof data.p1Name === 'string') setP1Name(data.p1Name);
      if (typeof data.p2Name === 'string') setP2Name(data.p2Name);
      if (typeof data.p3Name === 'string') setP3Name(data.p3Name);
      if (typeof data.p4Name === 'string') setP4Name(data.p4Name);

      if (typeof data.p1Wins === 'number') setP1Wins(data.p1Wins);
      if (typeof data.p2Wins === 'number') setP2Wins(data.p2Wins);
      if (typeof data.p3Wins === 'number') setP3Wins(data.p3Wins);
      if (typeof data.p4Wins === 'number') setP4Wins(data.p4Wins);

      if (typeof data.p1Mana === 'number') setP1Mana(data.p1Mana);
      if (typeof data.p1Life === 'number') setP1Life(data.p1Life);
      if (typeof data.p1CtReduction === 'number') setP1CtReduction(data.p1CtReduction);
      if (typeof data.p1DeckDamage === 'number') setP1DeckDamage(data.p1DeckDamage);
      if (typeof data.p1Runes === 'number') setP1Runes(data.p1Runes);
      if (typeof data.p1Insanity === 'number') setP1Insanity(data.p1Insanity);

      if (typeof data.p2Mana === 'number') setP2Mana(data.p2Mana);
      if (typeof data.p2Life === 'number') setP2Life(data.p2Life);
      if (typeof data.p2CtReduction === 'number') setP2CtReduction(data.p2CtReduction);
      if (typeof data.p2DeckDamage === 'number') setP2DeckDamage(data.p2DeckDamage);
      if (typeof data.p2Runes === 'number') setP2Runes(data.p2Runes);
      if (typeof data.p2Insanity === 'number') setP2Insanity(data.p2Insanity);

      if (typeof data.p3Mana === 'number') setP3Mana(data.p3Mana);
      if (typeof data.p3Life === 'number') setP3Life(data.p3Life);
      if (typeof data.p3CtReduction === 'number') setP3CtReduction(data.p3CtReduction);
      if (typeof data.p3DeckDamage === 'number') setP3DeckDamage(data.p3DeckDamage);
      if (typeof data.p3Runes === 'number') setP3Runes(data.p3Runes);
      if (typeof data.p3Insanity === 'number') setP3Insanity(data.p3Insanity);

      if (typeof data.p4Mana === 'number') setP4Mana(data.p4Mana);
      if (typeof data.p4Life === 'number') setP4Life(data.p4Life);
      if (typeof data.p4CtReduction === 'number') setP4CtReduction(data.p4CtReduction);
      if (typeof data.p4DeckDamage === 'number') setP4DeckDamage(data.p4DeckDamage);
      if (typeof data.p4Runes === 'number') setP4Runes(data.p4Runes);
      if (typeof data.p4Insanity === 'number') setP4Insanity(data.p4Insanity);

      if (Array.isArray(data.actionLogs)) setActionLogs(data.actionLogs);
      if (data.turnStartState) setTurnStartState(data.turnStartState);
    });

    return () => unsubscribe();
  }, [connectionType, roomCode]);

  const syncOnlinePatch = async (patch: Record<string, any>) => {
    if (connectionType !== 'online' || !roomCode) return;
    try {
      const roomRef = doc(db, 'duelRooms', roomCode);
      await updateDoc(roomRef, {
        ...patch,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.error('Failed to sync duel room patch:', err);
    }
  };

  // Wrapper setters that sync to Firestore when in Online Mode
  const updateP1Mana = (val: number) => { setP1Mana(val); syncOnlinePatch({ p1Mana: val }); };
  const updateP1Life = (val: number) => { setP1Life(val); syncOnlinePatch({ p1Life: val }); };
  const updateP1Ct = (val: number) => { setP1CtReduction(val); syncOnlinePatch({ p1CtReduction: val }); };
  const updateP1Prim = (val: number) => { setP1DeckDamage(val); syncOnlinePatch({ p1DeckDamage: val }); };
  const updateP1Runes = (val: number) => { setP1Runes(val); syncOnlinePatch({ p1Runes: val }); };
  const updateP1Insanity = (val: number) => { setP1Insanity(val); syncOnlinePatch({ p1Insanity: val }); };

  const updateP2Mana = (val: number) => { setP2Mana(val); syncOnlinePatch({ p2Mana: val }); };
  const updateP2Life = (val: number) => { setP2Life(val); syncOnlinePatch({ p2Life: val }); };
  const updateP2Ct = (val: number) => { setP2CtReduction(val); syncOnlinePatch({ p2CtReduction: val }); };
  const updateP2Prim = (val: number) => { setP2DeckDamage(val); syncOnlinePatch({ p2DeckDamage: val }); };
  const updateP2Runes = (val: number) => { setP2Runes(val); syncOnlinePatch({ p2Runes: val }); };
  const updateP2Insanity = (val: number) => { setP2Insanity(val); syncOnlinePatch({ p2Insanity: val }); };

  const updateP3Mana = (val: number) => { setP3Mana(val); syncOnlinePatch({ p3Mana: val }); };
  const updateP3Life = (val: number) => { setP3Life(val); syncOnlinePatch({ p3Life: val }); };
  const updateP3Ct = (val: number) => { setP3CtReduction(val); syncOnlinePatch({ p3CtReduction: val }); };
  const updateP3Prim = (val: number) => { setP3DeckDamage(val); syncOnlinePatch({ p3DeckDamage: val }); };
  const updateP3Runes = (val: number) => { setP3Runes(val); syncOnlinePatch({ p3Runes: val }); };
  const updateP3Insanity = (val: number) => { setP3Insanity(val); syncOnlinePatch({ p3Insanity: val }); };

  const updateP4Mana = (val: number) => { setP4Mana(val); syncOnlinePatch({ p4Mana: val }); };
  const updateP4Life = (val: number) => { setP4Life(val); syncOnlinePatch({ p4Life: val }); };
  const updateP4Ct = (val: number) => { setP4CtReduction(val); syncOnlinePatch({ p4CtReduction: val }); };
  const updateP4Prim = (val: number) => { setP4DeckDamage(val); syncOnlinePatch({ p4DeckDamage: val }); };
  const updateP4Runes = (val: number) => { setP4Runes(val); syncOnlinePatch({ p4Runes: val }); };
  const updateP4Insanity = (val: number) => { setP4Insanity(val); syncOnlinePatch({ p4Insanity: val }); };

  const applyModeDefaults = (mode: 'normal' | 'mesao') => {
    const startLife = mode === 'mesao' ? 25 : 20;
    const startPlayer: 1 | 2 = mode === 'mesao' ? 1 : 2;
    setDuelMode(mode);
    if (mode === 'normal' && myPlayerSlot > 2) {
      setMyPlayerSlot(1);
    }
    setRounds(1);
    setTurns(0);
    setActivePlayer(startPlayer);

    setP1Mana(12); setP1Life(startLife); setP1CtReduction(0); setP1DeckDamage(0); setP1Runes(0); setP1Insanity(100);
    setP2Mana(12); setP2Life(startLife); setP2CtReduction(0); setP2DeckDamage(0); setP2Runes(0); setP2Insanity(100);
    setP3Mana(12); setP3Life(startLife); setP3CtReduction(0); setP3DeckDamage(0); setP3Runes(0); setP3Insanity(100);
    setP4Mana(12); setP4Life(startLife); setP4CtReduction(0); setP4DeckDamage(0); setP4Runes(0); setP4Insanity(100);

    setActionLogs([]);
    setTurnStartState({
      p1Mana: 12, p1Life: startLife, p1CtReduction: 0, p1DeckDamage: 0, p1Runes: 0, p1Insanity: 100,
      p2Mana: 12, p2Life: startLife, p2CtReduction: 0, p2DeckDamage: 0, p2Runes: 0, p2Insanity: 100,
      p3Mana: 12, p3Life: startLife, p3CtReduction: 0, p3DeckDamage: 0, p3Runes: 0, p3Insanity: 100,
      p4Mana: 12, p4Life: startLife, p4CtReduction: 0, p4DeckDamage: 0, p4Runes: 0, p4Insanity: 100,
    });
  };

  const generateShortRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateOnlineRoom = async () => {
    setIsConnectingOnline(true);
    setOnlineStatusMsg('');
    try {
      const code = generateShortRoomCode();
      const startLife = duelMode === 'mesao' ? 25 : 20;
      const startPlayer: 1 | 2 = duelMode === 'mesao' ? 1 : 2;

      const finalP1Name = myPlayerSlot === 1 && myCustomName.trim() ? myCustomName.trim() : p1Name;
      const finalP2Name = myPlayerSlot === 2 && myCustomName.trim() ? myCustomName.trim() : p2Name;
      const finalP3Name = myPlayerSlot === 3 && myCustomName.trim() ? myCustomName.trim() : p3Name;
      const finalP4Name = myPlayerSlot === 4 && myCustomName.trim() ? myCustomName.trim() : p4Name;

      const initialTurnState = {
        p1Mana: 12, p1Life: startLife, p1CtReduction: 0, p1DeckDamage: 0, p1Runes: 0, p1Insanity: 100,
        p2Mana: 12, p2Life: startLife, p2CtReduction: 0, p2DeckDamage: 0, p2Runes: 0, p2Insanity: 100,
        p3Mana: 12, p3Life: startLife, p3CtReduction: 0, p3DeckDamage: 0, p3Runes: 0, p3Insanity: 100,
        p4Mana: 12, p4Life: startLife, p4CtReduction: 0, p4DeckDamage: 0, p4Runes: 0, p4Insanity: 100,
      };

      const roomData = {
        roomCode: code,
        duelMode,
        matchFormat,
        rounds: 1,
        turns: 0,
        activePlayer: startPlayer,
        p1Name: finalP1Name,
        p2Name: finalP2Name,
        p3Name: finalP3Name,
        p4Name: finalP4Name,
        p1Wins: 0,
        p2Wins: 0,
        p3Wins: 0,
        p4Wins: 0,
        ...initialTurnState,
        actionLogs: [],
        turnStartState: initialTurnState,
        updatedAt: Date.now()
      };

      await setDoc(doc(db, 'duelRooms', code), roomData);
      setRoomCode(code);
      setShowSetup(false);
    } catch (err) {
      console.error('Error creating online room:', err);
      setOnlineStatusMsg('Erro ao criar sala online. Tente novamente.');
    } finally {
      setIsConnectingOnline(false);
    }
  };

  const handleLookupRoom = async (codeToLookup?: string) => {
    const clean = (codeToLookup ?? joinCodeInput).trim().toUpperCase();
    if (clean.length < 3) {
      setOnlineStatusMsg('Digite um código de sala válido.');
      return;
    }
    setIsConnectingOnline(true);
    setOnlineStatusMsg('');
    try {
      const snap = await getDoc(doc(db, 'duelRooms', clean));
      if (!snap.exists()) {
        setJoinedRoomPreview(null);
        setOnlineStatusMsg(`Sala "${clean}" não encontrada.`);
        return;
      }
      const data = snap.data();
      setJoinedRoomPreview(data);
      if (data.duelMode === 'normal' && myPlayerSlot > 2) {
        setMyPlayerSlot(2);
      }
    } catch (err) {
      console.error('Error looking up room:', err);
      setOnlineStatusMsg('Erro ao buscar sala. Verifique sua conexão.');
    } finally {
      setIsConnectingOnline(false);
    }
  };

  const handleConfirmJoinOnlineRoom = async () => {
    const clean = joinCodeInput.trim().toUpperCase();
    if (!clean) return;
    setIsConnectingOnline(true);
    setOnlineStatusMsg('');
    try {
      const roomRef = doc(db, 'duelRooms', clean);
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        setOnlineStatusMsg(`Sala "${clean}" não encontrada.`);
        setIsConnectingOnline(false);
        return;
      }
      const data = snap.data();
      const slot = data.duelMode === 'normal' && myPlayerSlot > 2 ? 2 : myPlayerSlot;
      setMyPlayerSlot(slot);

      if (myCustomName.trim()) {
        const nameField = `p${slot}Name`;
        await updateDoc(roomRef, {
          [nameField]: myCustomName.trim(),
          updatedAt: Date.now()
        });
      }

      setRoomCode(clean);
      setShowSetup(false);
    } catch (err) {
      console.error('Error joining online room:', err);
      setOnlineStatusMsg('Não foi possível entrar na sala.');
    } finally {
      setIsConnectingOnline(false);
    }
  };

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

    if (duelMode === 'mesao') {
      if (p3Life !== turnStartState.p3Life) diffs.push(`P3 Vida: ${turnStartState.p3Life} -> ${p3Life}`);
      if (p3Mana !== turnStartState.p3Mana) diffs.push(`P3 Mana: ${turnStartState.p3Mana} -> ${p3Mana}`);
      if (p3CtReduction !== turnStartState.p3CtReduction) diffs.push(`P3 CT: ${turnStartState.p3CtReduction} -> ${p3CtReduction}`);
      if (p3DeckDamage !== turnStartState.p3DeckDamage) diffs.push(`P3 Dano Primordial: ${turnStartState.p3DeckDamage} -> ${p3DeckDamage}`);
      if (p3Runes !== turnStartState.p3Runes) diffs.push(`P3 Runas: ${turnStartState.p3Runes} -> ${p3Runes}`);
      if (p3Insanity !== turnStartState.p3Insanity) diffs.push(`P3 Insanidade: ${turnStartState.p3Insanity} -> ${p3Insanity}`);

      if (p4Life !== turnStartState.p4Life) diffs.push(`P4 Vida: ${turnStartState.p4Life} -> ${p4Life}`);
      if (p4Mana !== turnStartState.p4Mana) diffs.push(`P4 Mana: ${turnStartState.p4Mana} -> ${p4Mana}`);
      if (p4CtReduction !== turnStartState.p4CtReduction) diffs.push(`P4 CT: ${turnStartState.p4CtReduction} -> ${p4CtReduction}`);
      if (p4DeckDamage !== turnStartState.p4DeckDamage) diffs.push(`P4 Dano Primordial: ${turnStartState.p4DeckDamage} -> ${p4DeckDamage}`);
      if (p4Runes !== turnStartState.p4Runes) diffs.push(`P4 Runas: ${turnStartState.p4Runes} -> ${p4Runes}`);
      if (p4Insanity !== turnStartState.p4Insanity) diffs.push(`P4 Insanidade: ${turnStartState.p4Insanity} -> ${p4Insanity}`);
    }

    const updatedLogs = diffs.length > 0
      ? [...actionLogs, { round: rounds, turn: turns, activePlayer, diffs }]
      : actionLogs;

    if (diffs.length > 0) {
      setActionLogs(updatedLogs);
    }

    const newTurns = turns + 1;

    if (duelMode === 'mesao') {
      // Modo Mesão: 4 jogadores, +3 mana a cada turno (máximo 15), não recupera mana ao virar a rodada
      const nextPlayer = ((activePlayer % 4) + 1) as 1 | 2 | 3 | 4;
      setActivePlayer(nextPlayer);

      const nextP1Mana = Math.min(15, p1Mana + 3);
      const nextP2Mana = Math.min(15, p2Mana + 3);
      const nextP3Mana = Math.min(15, p3Mana + 3);
      const nextP4Mana = Math.min(15, p4Mana + 3);

      setP1Mana(nextP1Mana);
      setP2Mana(nextP2Mana);
      setP3Mana(nextP3Mana);
      setP4Mana(nextP4Mana);

      let finalRounds = rounds;
      let finalTurns = newTurns;

      if (newTurns >= 4) {
        finalRounds = rounds + 1;
        finalTurns = 0;
        setRounds(finalRounds);
        setTurns(0);
      } else {
        setTurns(finalTurns);
      }

      const nextTurnStartState = {
        p1Mana: nextP1Mana, p1Life, p1CtReduction, p1DeckDamage, p1Runes, p1Insanity,
        p2Mana: nextP2Mana, p2Life, p2CtReduction, p2DeckDamage, p2Runes, p2Insanity,
        p3Mana: nextP3Mana, p3Life, p3CtReduction, p3DeckDamage, p3Runes, p3Insanity,
        p4Mana: nextP4Mana, p4Life, p4CtReduction, p4DeckDamage, p4Runes, p4Insanity,
      };

      setTurnStartState(nextTurnStartState);

      syncOnlinePatch({
        activePlayer: nextPlayer,
        rounds: finalRounds,
        turns: finalTurns,
        p1Mana: nextP1Mana,
        p2Mana: nextP2Mana,
        p3Mana: nextP3Mana,
        p4Mana: nextP4Mana,
        actionLogs: updatedLogs,
        turnStartState: nextTurnStartState
      });
    } else {
      // Modo Normal: 2 jogadores, recupera 12 de mana quando vira a rodada
      const nextPlayer = activePlayer === 1 ? 2 : 1;
      setActivePlayer(nextPlayer);
      
      let nextP1Mana = p1Mana;
      let nextP2Mana = p2Mana;
      let finalRounds = rounds;
      let finalTurns = newTurns;

      if (newTurns === 2) {
        finalRounds = rounds + 1;
        finalTurns = 0;
        setRounds(finalRounds);
        setTurns(0);
        setP1Mana(12);
        setP2Mana(12);
        nextP1Mana = 12;
        nextP2Mana = 12;
      } else {
        setTurns(finalTurns);
      }

      const nextTurnStartState = {
        p1Mana: nextP1Mana, p1Life, p1CtReduction, p1DeckDamage, p1Runes, p1Insanity,
        p2Mana: nextP2Mana, p2Life, p2CtReduction, p2DeckDamage, p2Runes, p2Insanity,
        p3Mana, p3Life, p3CtReduction, p3DeckDamage, p3Runes, p3Insanity,
        p4Mana, p4Life, p4CtReduction, p4DeckDamage, p4Runes, p4Insanity,
      };

      setTurnStartState(nextTurnStartState);

      syncOnlinePatch({
        activePlayer: nextPlayer,
        rounds: finalRounds,
        turns: finalTurns,
        p1Mana: nextP1Mana,
        p2Mana: nextP2Mana,
        actionLogs: updatedLogs,
        turnStartState: nextTurnStartState
      });
    }
  };

  const handleReset = (startingPlayer: 1 | 2 | 3 | 4) => {
    const startLife = duelMode === 'mesao' ? 25 : 20;
    setRounds(1);
    setTurns(0);
    setActivePlayer(startingPlayer);
    
    // Reset P1
    setP1Mana(12);
    setP1Life(startLife);
    setP1CtReduction(0);
    setP1DeckDamage(0);
    setP1Runes(0);
    setP1Insanity(100);

    // Reset P2
    setP2Mana(12);
    setP2Life(startLife);
    setP2CtReduction(0);
    setP2DeckDamage(0);
    setP2Runes(0);
    setP2Insanity(100);

    // Reset P3
    setP3Mana(12);
    setP3Life(startLife);
    setP3CtReduction(0);
    setP3DeckDamage(0);
    setP3Runes(0);
    setP3Insanity(100);

    // Reset P4
    setP4Mana(12);
    setP4Life(startLife);
    setP4CtReduction(0);
    setP4DeckDamage(0);
    setP4Runes(0);
    setP4Insanity(100);

    const resetTurnState = {
      p1Mana: 12, p1Life: startLife, p1CtReduction: 0, p1DeckDamage: 0, p1Runes: 0, p1Insanity: 100,
      p2Mana: 12, p2Life: startLife, p2CtReduction: 0, p2DeckDamage: 0, p2Runes: 0, p2Insanity: 100,
      p3Mana: 12, p3Life: startLife, p3CtReduction: 0, p3DeckDamage: 0, p3Runes: 0, p3Insanity: 100,
      p4Mana: 12, p4Life: startLife, p4CtReduction: 0, p4DeckDamage: 0, p4Runes: 0, p4Insanity: 100,
    };

    setActionLogs([]);
    setTurnStartState(resetTurnState);

    syncOnlinePatch({
      rounds: 1,
      turns: 0,
      activePlayer: startingPlayer,
      ...resetTurnState,
      actionLogs: [],
      turnStartState: resetTurnState
    });

    setShowResetModal(false);
    setIsMenuOpen(false);
  };

  const handleThemeSelect = (url: string | null) => {
    if (themeTargetPlayer === 1) setP1Background(url);
    if (themeTargetPlayer === 2) setP2Background(url);
    if (themeTargetPlayer === 3) setP3Background(url);
    if (themeTargetPlayer === 4) setP4Background(url);
    setShowThemeModal(false);
    setThemeTargetPlayer(null);
  };

  const getPlayerName = (num: number) => {
    if (num === 1) return p1Name;
    if (num === 2) return p2Name;
    if (num === 3) return p3Name;
    return p4Name;
  };

  const getPlayerWins = (num: number) => {
    if (num === 1) return p1Wins;
    if (num === 2) return p2Wins;
    if (num === 3) return p3Wins;
    return p4Wins;
  };

  const incrementPlayerWins = (num: number) => {
    const mod = Math.ceil(matchFormat / 2) + 1;
    if (num === 1) {
      const next = (p1Wins + 1) % mod;
      setP1Wins(next);
      syncOnlinePatch({ p1Wins: next });
    } else if (num === 2) {
      const next = (p2Wins + 1) % mod;
      setP2Wins(next);
      syncOnlinePatch({ p2Wins: next });
    } else if (num === 3) {
      const next = (p3Wins + 1) % mod;
      setP3Wins(next);
      syncOnlinePatch({ p3Wins: next });
    } else {
      const next = (p4Wins + 1) % mod;
      setP4Wins(next);
      syncOnlinePatch({ p4Wins: next });
    }
  };

  const getPlayerProps = (num: 1 | 2 | 3 | 4) => {
    if (num === 1) {
      return {
        mana: p1Mana, setMana: updateP1Mana,
        life: p1Life, setLife: updateP1Life,
        ctReduction: p1CtReduction, setCtReduction: updateP1Ct,
        deckDamage: p1DeckDamage, setDeckDamage: updateP1Prim,
        runes: p1Runes, setRunes: updateP1Runes,
        insanity: p1Insanity, setInsanity: updateP1Insanity,
        background: p1Background,
        playerNum: 1 as const,
        name: p1Name,
        wins: p1Wins
      };
    }
    if (num === 2) {
      return {
        mana: p2Mana, setMana: updateP2Mana,
        life: p2Life, setLife: updateP2Life,
        ctReduction: p2CtReduction, setCtReduction: updateP2Ct,
        deckDamage: p2DeckDamage, setDeckDamage: updateP2Prim,
        runes: p2Runes, setRunes: updateP2Runes,
        insanity: p2Insanity, setInsanity: updateP2Insanity,
        background: p2Background,
        playerNum: 2 as const,
        name: p2Name,
        wins: p2Wins
      };
    }
    if (num === 3) {
      return {
        mana: p3Mana, setMana: updateP3Mana,
        life: p3Life, setLife: updateP3Life,
        ctReduction: p3CtReduction, setCtReduction: updateP3Ct,
        deckDamage: p3DeckDamage, setDeckDamage: updateP3Prim,
        runes: p3Runes, setRunes: updateP3Runes,
        insanity: p3Insanity, setInsanity: updateP3Insanity,
        background: p3Background,
        playerNum: 3 as const,
        name: p3Name,
        wins: p3Wins
      };
    }
    return {
      mana: p4Mana, setMana: updateP4Mana,
      life: p4Life, setLife: updateP4Life,
      ctReduction: p4CtReduction, setCtReduction: updateP4Ct,
      deckDamage: p4DeckDamage, setDeckDamage: updateP4Prim,
      runes: p4Runes, setRunes: updateP4Runes,
      insanity: p4Insanity, setInsanity: updateP4Insanity,
      background: p4Background,
      playerNum: 4 as const,
      name: p4Name,
      wins: p4Wins
    };
  };

  // Compact Opponent Summary Bar for Online Mode (shows other players smaller at the top)
  const OpponentMiniCard = ({ playerNum }: { playerNum: 1 | 2 | 3 | 4 }) => {
    const p = getPlayerProps(playerNum);
    const isTurn = activePlayer === playerNum;

    return (
      <div
        className={`relative rounded-xl p-1.5 sm:p-2 flex flex-col justify-between transition-all overflow-hidden border ${
          isTurn
            ? 'bg-slate-900/95 border-2 border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.45)]'
            : 'bg-slate-900/80 border-white/10'
        }`}
      >
        {/* Top Row: Name + Turn indicator + Wins */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[8px] sm:text-[9px] font-black px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0 leading-none">
              P{playerNum}
            </span>
            <span className="text-[9px] sm:text-xs font-bold text-white truncate leading-tight">
              {p.name}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isTurn && (
              <span className="px-1 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[7px] sm:text-[8px] uppercase flex items-center gap-0.5 shadow leading-none">
                <Zap size={7} className="fill-slate-950" />
                VEZ
              </span>
            )}
            {matchFormat > 1 && (
              <div className="flex gap-0.5">
                {Array.from({ length: Math.ceil(matchFormat / 2) }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full border border-white/30 ${
                      p.wins > i ? 'bg-blue-500 border-blue-300' : 'bg-black/40'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Middle Row: VIDA & MANA */}
        <div className="grid grid-cols-2 gap-1 mb-1">
          <div className="bg-red-600/90 border border-red-400 rounded-md py-0.5 px-1.5 flex items-center justify-between shadow-sm">
            <span className="text-[7px] sm:text-[9px] font-black text-red-100 uppercase leading-none">VIDA</span>
            <span className="text-xs sm:text-base font-black font-mono text-white leading-none">{p.life}</span>
          </div>
          <div className="bg-purple-700/90 border border-purple-400 rounded-md py-0.5 px-1.5 flex items-center justify-between shadow-sm">
            <span className="text-[7px] sm:text-[9px] font-black text-purple-100 uppercase leading-none">MANA</span>
            <span className="text-xs sm:text-base font-black font-mono text-white leading-none">{p.mana}</span>
          </div>
        </div>

        {/* Bottom Row: CT, PRIM, RUNAS, SANID */}
        <div className="grid grid-cols-4 gap-0.5 text-center">
          <div className="bg-pink-950/70 border border-pink-500/40 rounded px-0.5 py-0.5">
            <div className="text-[6.5px] sm:text-[8px] text-pink-300 font-bold uppercase truncate leading-none">CT</div>
            <div className="text-[9px] sm:text-[11px] font-black font-mono text-white leading-tight mt-0.5">{p.ctReduction}</div>
          </div>
          <div className="bg-red-950/70 border border-red-500/40 rounded px-0.5 py-0.5">
            <div className="text-[6.5px] sm:text-[8px] text-red-300 font-bold uppercase truncate leading-none">PRIM</div>
            <div className="text-[9px] sm:text-[11px] font-black font-mono text-white leading-tight mt-0.5">{p.deckDamage}</div>
          </div>
          <div className="bg-slate-800/80 border border-slate-500/40 rounded px-0.5 py-0.5">
            <div className="text-[6.5px] sm:text-[8px] text-slate-300 font-bold uppercase truncate leading-none">RUNA</div>
            <div className="text-[9px] sm:text-[11px] font-black font-mono text-white leading-tight mt-0.5">{p.runes}</div>
          </div>
          <div className="bg-emerald-950/70 border border-emerald-500/40 rounded px-0.5 py-0.5">
            <div className="text-[6.5px] sm:text-[8px] text-emerald-300 font-bold uppercase truncate leading-none">SAN</div>
            <div className="text-[9px] sm:text-[11px] font-black font-mono text-white leading-tight mt-0.5">{p.insanity}</div>
          </div>
        </div>
      </div>
    );
  };

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
    playerNum,
    compact = false,
    isMyOnlineBoard = false
  }: any) => {
    
    // CT: rosa padrão quando 0, rosa claro se negativo, roxo escuro se positivo
    const getCtStyle = (val: number) => {
      if (val > 0) {
        return 'bg-[#3b0764] border-purple-600 text-purple-100 font-black shadow-[0_0_14px_rgba(147,51,234,0.6)]';
      }
      if (val < 0) {
        return 'bg-pink-200 border-pink-100 text-pink-950 font-black shadow-[0_0_12px_rgba(244,114,182,0.7)]';
      }
      return 'bg-pink-600 border-pink-400 text-white shadow-md shadow-pink-950/40';
    };

    // Primordial: vermelho quando adicionado (> 0)
    const getPrimordialStyle = (val: number) => {
      if (val > 0) {
        return 'bg-red-600 border-red-400 text-white font-black shadow-[0_0_14px_rgba(239,68,68,0.7)]';
      }
      return 'bg-black/60 border-slate-700/80 text-white';
    };

    // Runas: cinza quando adicionadas (> 0)
    const getRunesStyle = (val: number) => {
      if (val > 0) {
        return 'bg-slate-400 border-slate-200 text-slate-950 font-black shadow-[0_0_12px_rgba(148,163,184,0.7)]';
      }
      return 'bg-black/60 border-slate-700/80 text-white';
    };

    // Sanidade: verde conforme vai diminuindo (< 100)
    const getSanityStyle = (val: number) => {
      if (val >= 100) {
        return 'bg-black/60 border-slate-700/80 text-white';
      }
      if (val >= 80) {
        return 'bg-emerald-950/90 border-emerald-700 text-emerald-300 shadow-sm';
      }
      if (val >= 60) {
        return 'bg-emerald-900 border-emerald-600 text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
      }
      if (val >= 40) {
        return 'bg-emerald-700 border-emerald-500 text-white shadow-[0_0_14px_rgba(16,185,129,0.7)]';
      }
      if (val >= 20) {
        return 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_16px_rgba(16,185,129,0.85)] font-black';
      }
      return 'bg-emerald-500 border-emerald-300 text-slate-950 font-black shadow-[0_0_20px_rgba(16,185,129,1)]';
    };

    return (
      <div className={`flex-1 flex flex-col justify-between ${compact ? 'p-1 sm:p-2 md:p-2.5' : 'p-2 sm:p-3 md:p-6'} relative ${rotated ? 'rotate-180' : ''} min-h-0 transition-all duration-500 overflow-hidden`}>
        
        {/* Contorno luminoso para o lado da vez de jogar */}
        <div 
          className={`absolute inset-0.5 sm:inset-1.5 rounded-xl sm:rounded-2xl pointer-events-none transition-all duration-500 z-30 ${
            isActive 
              ? 'border-2 sm:border-3 border-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.75),inset_0_0_20px_rgba(251,191,36,0.15)] ring-1 ring-amber-300/70 bg-amber-500/[0.03]' 
              : 'border border-white/5 opacity-40'
          }`}
        />

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

        {/* Top Header: Turno Badge & Jogador Wins */}
        <div className={`flex items-center justify-between max-w-2xl mx-auto w-full ${compact ? 'px-1 mb-0.5' : 'px-1.5 sm:px-2 mb-0.5 sm:mb-1.5'} relative z-10 shrink-0 gap-1`}>
          <div className={`${compact ? 'px-1.5 py-0.5 text-[7px] sm:text-[9px]' : 'px-2 sm:px-3 py-0.5 text-[8px] sm:text-xs'} rounded-full font-black uppercase tracking-wider transition-all border flex items-center gap-0.5 shrink-0 ${
            isActive 
              ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.7)]' 
              : 'bg-black/60 text-slate-400 border-white/10'
          }`}>
            {isActive && <Zap size={compact ? 8 : 10} className="fill-slate-950" />}
            <span>{compact ? (isActive ? 'VEZ' : 'AGUARD.') : (isActive ? 'Sua Vez de Jogar' : 'Aguardando Turno')}</span>
          </div>

          <div className="flex items-center gap-1 min-w-0">
            {isMyOnlineBoard && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[8px] sm:text-[10px] font-black uppercase shrink-0">
                Você
              </span>
            )}
            <button 
              onClick={() => incrementPlayerWins(playerNum)}
              className={`bg-black/60 border border-white/20 text-white font-bold ${compact ? 'text-[8px] sm:text-[10px] px-1.5 py-0.5' : 'text-[9px] sm:text-xs px-2 py-0.5'} rounded-full hover:bg-white/10 transition flex items-center gap-1 min-w-0`}
              title="Clique para adicionar vitória"
            >
              <span className="opacity-75 text-purple-400 shrink-0">P{playerNum}</span>
              <span className={`truncate ${compact ? 'max-w-[52px] sm:max-w-[95px]' : 'max-w-[90px] sm:max-w-[140px]'}`}>{getPlayerName(playerNum)}</span>
            </button>

            {matchFormat > 1 && (
              <div className="flex gap-0.5 shrink-0">
                {Array.from({ length: Math.ceil(matchFormat / 2) }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`${compact ? 'w-1.5 h-1.5 sm:w-2 sm:h-2' : 'w-2 h-2 sm:w-3 sm:h-3'} rounded-full border border-white/30 transition-all ${
                      getPlayerWins(playerNum) > i 
                      ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)] border-blue-400' 
                      : 'bg-black/40'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CONTAINER PRINCIPAL DO LAYOUT */}
        <div className={`flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full relative z-10 min-h-0 ${compact ? 'gap-0.5 sm:gap-1.5 px-0.5' : 'gap-1.5 sm:gap-3'}`}>
          
          {/* LINHA 1: VIDA e MANA */}
          <div className={`grid grid-cols-2 ${compact ? 'gap-1 sm:gap-2' : 'gap-2 sm:gap-4 md:gap-6'} w-full`}>
            
            {/* CARD VIDA */}
            <div className="flex flex-col items-center">
              <span className={`${compact ? 'text-[7.5px] sm:text-[10px]' : 'text-[10px] sm:text-xs md:text-sm'} font-black text-red-400 uppercase tracking-wider mb-0.5 drop-shadow leading-none`}>
                VIDA
              </span>
              
              <div className={`w-full bg-red-600 border border-red-400 rounded-lg sm:rounded-xl ${compact ? 'p-0.5 sm:p-1' : 'p-1.5 sm:p-2.5'} flex items-center justify-between shadow-lg shadow-red-950/40 transition-colors duration-300`}>
                <button
                  onClick={() => setLife(life + 1)}
                  className={`${compact ? 'w-5 h-5 sm:w-7 sm:h-7' : 'w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12'} rounded-md sm:rounded-lg bg-red-800/80 hover:bg-red-700 text-white border border-red-300/40 flex items-center justify-center transition active:scale-90 shadow-sm font-bold shrink-0`}
                  title="Aumentar Vida (+1)"
                >
                  <Plus size={compact ? 11 : 16} strokeWidth={3} />
                </button>

                <span className={`${compact ? 'text-sm sm:text-xl md:text-2xl' : 'text-2xl sm:text-4xl md:text-5xl'} font-black text-white font-mono tracking-tighter drop-shadow px-0.5 leading-none`}>
                  {life}
                </span>

                <button
                  onClick={() => setLife(life - 1)}
                  className={`${compact ? 'w-5 h-5 sm:w-7 sm:h-7' : 'w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12'} rounded-md sm:rounded-lg bg-red-800/80 hover:bg-red-700 text-white border border-red-300/40 flex items-center justify-center transition active:scale-90 shadow-sm font-bold shrink-0`}
                  title="Diminuir Vida (-1)"
                >
                  <Minus size={compact ? 11 : 16} strokeWidth={3} />
                </button>
              </div>

              {/* Botões rápidos [+5] e [-5] abaixo da Vida */}
              <div className="flex items-center justify-center gap-1.5 sm:gap-3 mt-0.5">
                <button
                  onClick={() => setLife(life + 5)}
                  className={`${compact ? 'w-6 sm:w-9 text-[8px] sm:text-[10px] py-0' : 'w-9 sm:w-12 text-[10px] sm:text-xs py-0.5'} rounded bg-red-900/80 hover:bg-red-800 border border-red-500/50 text-white font-black transition active:scale-90 shadow-sm text-center`}
                >
                  +5
                </button>
                <button
                  onClick={() => setLife(life - 5)}
                  className={`${compact ? 'w-6 sm:w-9 text-[8px] sm:text-[10px] py-0' : 'w-9 sm:w-12 text-[10px] sm:text-xs py-0.5'} rounded bg-red-900/80 hover:bg-red-800 border border-red-500/50 text-white font-black transition active:scale-90 shadow-sm text-center`}
                >
                  -5
                </button>
              </div>
            </div>

            {/* CARD MANA */}
            <div className="flex flex-col items-center">
              <span className={`${compact ? 'text-[7.5px] sm:text-[10px]' : 'text-[10px] sm:text-xs md:text-sm'} font-black text-purple-400 uppercase tracking-wider mb-0.5 drop-shadow leading-none truncate max-w-full`}>
                {compact ? 'MANA' : `MANA ${duelMode === 'mesao' ? '(MÁX 15)' : ''}`}
              </span>
              
              <div className={`w-full bg-purple-700 border border-purple-400 rounded-lg sm:rounded-xl ${compact ? 'p-0.5 sm:p-1' : 'p-1.5 sm:p-2.5'} flex items-center justify-between shadow-lg shadow-purple-950/40 transition-colors duration-300`}>
                <button
                  onClick={() => setMana(duelMode === 'mesao' ? Math.min(15, mana + 1) : mana + 1)}
                  className={`${compact ? 'w-5 h-5 sm:w-7 sm:h-7' : 'w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12'} rounded-md sm:rounded-lg bg-purple-900/80 hover:bg-purple-800 text-white border border-purple-300/40 flex items-center justify-center transition active:scale-90 shadow-sm font-bold shrink-0`}
                  title="Aumentar Mana (+1)"
                >
                  <Plus size={compact ? 11 : 16} strokeWidth={3} />
                </button>

                <span className={`${compact ? 'text-sm sm:text-xl md:text-2xl' : 'text-2xl sm:text-4xl md:text-5xl'} font-black text-white font-mono tracking-tighter drop-shadow px-0.5 leading-none`}>
                  {mana}
                </span>

                <button
                  onClick={() => setMana(mana - 1)}
                  className={`${compact ? 'w-5 h-5 sm:w-7 sm:h-7' : 'w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12'} rounded-md sm:rounded-lg bg-purple-900/80 hover:bg-purple-800 text-white border border-purple-300/40 flex items-center justify-center transition active:scale-90 shadow-sm font-bold shrink-0`}
                  title="Diminuir Mana (-1)"
                >
                  <Minus size={compact ? 11 : 16} strokeWidth={3} />
                </button>
              </div>

              {/* Botões rápidos [+5] e [-5] abaixo da Mana */}
              <div className="flex items-center justify-center gap-1.5 sm:gap-3 mt-0.5">
                <button
                  onClick={() => setMana(duelMode === 'mesao' ? Math.min(15, mana + 5) : mana + 5)}
                  className={`${compact ? 'w-6 sm:w-9 text-[8px] sm:text-[10px] py-0' : 'w-9 sm:w-12 text-[10px] sm:text-xs py-0.5'} rounded bg-purple-900/80 hover:bg-purple-800 border border-purple-500/50 text-white font-black transition active:scale-90 shadow-sm text-center`}
                >
                  +5
                </button>
                <button
                  onClick={() => setMana(mana - 5)}
                  className={`${compact ? 'w-6 sm:w-9 text-[8px] sm:text-[10px] py-0' : 'w-9 sm:w-12 text-[10px] sm:text-xs py-0.5'} rounded bg-purple-900/80 hover:bg-purple-800 border border-purple-500/50 text-white font-black transition active:scale-90 shadow-sm text-center`}
                >
                  -5
                </button>
              </div>
            </div>

          </div>

          {/* LINHA 2: CT, PRIMORDIAL, RUNAS, SANIDADE */}
          <div className={`grid grid-cols-4 ${compact ? 'gap-1 sm:gap-1.5' : 'gap-1.5 sm:gap-3 md:gap-4'} w-full mt-0.5`}>
            
            {/* CT */}
            <div className="flex flex-col items-center min-w-0">
              <span className={`${compact ? 'text-[6.5px] sm:text-[8.5px]' : 'text-[9px] sm:text-xs'} font-bold text-pink-400 uppercase tracking-tight mb-0.5 truncate max-w-full text-center leading-none`}>
                CT
              </span>
              <div className={`w-full ${getCtStyle(ctReduction)} rounded-md sm:rounded-lg border ${compact ? 'py-0.5 min-h-[20px] sm:min-h-[28px]' : 'py-1 sm:py-1.5 min-h-[32px] sm:min-h-[44px]'} flex items-center justify-center shadow-sm transition-colors duration-300`}>
                <span className={`${compact ? 'text-[11px] sm:text-sm md:text-base' : 'text-base sm:text-xl md:text-2xl'} font-black font-mono tracking-tight drop-shadow leading-none`}>
                  {ctReduction}
                </span>
              </div>
              <div className="flex items-center justify-center gap-0.5 sm:gap-1 mt-0.5 w-full">
                <button
                  onClick={() => setCtReduction(ctReduction + 1)}
                  className={`flex-1 max-w-[26px] sm:max-w-[36px] ${compact ? 'h-4 sm:h-5' : 'h-5 sm:h-6'} rounded bg-black/60 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center transition active:scale-90 font-bold`}
                  title="+1 CT"
                >
                  <Plus size={compact ? 9 : 11} strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => setCtReduction(ctReduction - 1)}
                  className={`flex-1 max-w-[26px] sm:max-w-[36px] ${compact ? 'h-4 sm:h-5' : 'h-5 sm:h-6'} rounded bg-black/60 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center transition active:scale-90 font-bold`}
                  title="-1 CT"
                >
                  <Minus size={compact ? 9 : 11} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* PRIMORDIAL */}
            <div className="flex flex-col items-center min-w-0">
              <span className={`${compact ? 'text-[6.5px] sm:text-[8.5px]' : 'text-[9px] sm:text-xs'} font-bold text-red-400 uppercase tracking-tight mb-0.5 truncate max-w-full text-center leading-none`}>
                {compact ? 'PRIM.' : 'PRIMORDIAL'}
              </span>
              <div className={`w-full ${getPrimordialStyle(deckDamage)} rounded-md sm:rounded-lg border ${compact ? 'py-0.5 min-h-[20px] sm:min-h-[28px]' : 'py-1 sm:py-1.5 min-h-[32px] sm:min-h-[44px]'} flex items-center justify-center shadow-sm transition-colors duration-300`}>
                <span className={`${compact ? 'text-[11px] sm:text-sm md:text-base' : 'text-base sm:text-xl md:text-2xl'} font-black text-white font-mono tracking-tight drop-shadow leading-none`}>
                  {deckDamage}
                </span>
              </div>
              <div className="flex items-center justify-center gap-0.5 sm:gap-1 mt-0.5 w-full">
                <button
                  onClick={() => setDeckDamage(deckDamage + 1)}
                  className={`flex-1 max-w-[26px] sm:max-w-[36px] ${compact ? 'h-4 sm:h-5' : 'h-5 sm:h-6'} rounded bg-black/60 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center transition active:scale-90 font-bold`}
                  title="+1 Primordial"
                >
                  <Plus size={compact ? 9 : 11} strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => setDeckDamage(deckDamage - 1)}
                  className={`flex-1 max-w-[26px] sm:max-w-[36px] ${compact ? 'h-4 sm:h-5' : 'h-5 sm:h-6'} rounded bg-black/60 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center transition active:scale-90 font-bold`}
                  title="-1 Primordial"
                >
                  <Minus size={compact ? 9 : 11} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* RUNAS */}
            <div className="flex flex-col items-center min-w-0">
              <span className={`${compact ? 'text-[6.5px] sm:text-[8.5px]' : 'text-[9px] sm:text-xs'} font-bold text-slate-300 uppercase tracking-tight mb-0.5 truncate max-w-full text-center leading-none`}>
                RUNAS
              </span>
              <div className={`w-full ${getRunesStyle(runes)} rounded-md sm:rounded-lg border ${compact ? 'py-0.5 min-h-[20px] sm:min-h-[28px]' : 'py-1 sm:py-1.5 min-h-[32px] sm:min-h-[44px]'} flex items-center justify-center shadow-sm transition-colors duration-300`}>
                <span className={`${compact ? 'text-[11px] sm:text-sm md:text-base' : 'text-base sm:text-xl md:text-2xl'} font-black text-white font-mono tracking-tight drop-shadow leading-none`}>
                  {runes}
                </span>
              </div>
              <div className="flex items-center justify-center gap-0.5 sm:gap-1 mt-0.5 w-full">
                <button
                  onClick={() => setRunes(runes + 1)}
                  className={`flex-1 max-w-[26px] sm:max-w-[36px] ${compact ? 'h-4 sm:h-5' : 'h-5 sm:h-6'} rounded bg-black/60 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center transition active:scale-90 font-bold`}
                  title="+1 Runas"
                >
                  <Plus size={compact ? 9 : 11} strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => setRunes(runes - 1)}
                  className={`flex-1 max-w-[26px] sm:max-w-[36px] ${compact ? 'h-4 sm:h-5' : 'h-5 sm:h-6'} rounded bg-black/60 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center transition active:scale-90 font-bold`}
                  title="-1 Runas"
                >
                  <Minus size={compact ? 9 : 11} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* SANIDADE */}
            <div className="flex flex-col items-center min-w-0">
              <span className={`${compact ? 'text-[6.5px] sm:text-[8.5px]' : 'text-[9px] sm:text-xs'} font-bold text-emerald-400 uppercase tracking-tight mb-0.5 truncate max-w-full text-center leading-none`}>
                {compact ? 'SANID.' : 'SANIDADE'}
              </span>
              <div className={`w-full ${getSanityStyle(insanity)} rounded-md sm:rounded-lg border ${compact ? 'py-0.5 min-h-[20px] sm:min-h-[28px]' : 'py-1 sm:py-1.5 min-h-[32px] sm:min-h-[44px]'} flex items-center justify-center shadow-sm transition-colors duration-300`}>
                <span className={`${compact ? 'text-[11px] sm:text-sm md:text-base' : 'text-base sm:text-xl md:text-2xl'} font-black font-mono tracking-tight drop-shadow leading-none`}>
                  {insanity}
                </span>
              </div>
              <div className="flex items-center justify-center gap-0.5 sm:gap-1 mt-0.5 w-full">
                <button
                  onClick={() => setInsanity(insanity + 1)}
                  className={`flex-1 max-w-[26px] sm:max-w-[36px] ${compact ? 'h-4 sm:h-5' : 'h-5 sm:h-6'} rounded bg-black/60 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center transition active:scale-90 font-bold`}
                  title="+1 Sanidade"
                >
                  <Plus size={compact ? 9 : 11} strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => setInsanity(insanity - 1)}
                  className={`flex-1 max-w-[26px] sm:max-w-[36px] ${compact ? 'h-4 sm:h-5' : 'h-5 sm:h-6'} rounded bg-black/60 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center transition active:scale-90 font-bold`}
                  title="-1 Sanidade"
                >
                  <Minus size={compact ? 9 : 11} strokeWidth={2.5} />
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    );
  };

  // List of other players for Online Mode top bar
  const otherPlayersInOnline = (duelMode === 'mesao' ? [1, 2, 3, 4] : [1, 2]).filter(
    (num) => num !== myPlayerSlot
  ) as (1 | 2 | 3 | 4)[];

  const myBoardProps = getPlayerProps(myPlayerSlot);

  return (
    <div data-tour-id="tour-gameboard-active" className="fixed inset-0 z-[100] h-screen w-full bg-[#0f172a] flex flex-col overflow-hidden font-sans">
      
      {/* Starting Setup Modal */}
      {showSetup && (
        <div className="absolute inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-300 overflow-y-auto">
          <div data-tour-id="tour-gameboard-setup" className="bg-[#1e293b] w-full max-w-lg rounded-3xl border-2 border-purple-500/50 shadow-[0_0_40px_rgba(168,85,247,0.3)] p-5 sm:p-7 my-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="w-8" />
              <h2 className="text-xl sm:text-2xl font-black text-white text-center tracking-tighter flex items-center justify-center gap-2">
                <LogOut className="rotate-180 text-purple-400" size={22} />
                ASSISTENTE DE DUELO
              </h2>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Seleção de Conexão: Local vs Online */}
              <div>
                <label className="block text-slate-400 text-[11px] font-bold mb-1.5 uppercase tracking-widest text-center">
                  Tipo de Conexão
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setConnectionType('local');
                      setOnlineStatusMsg('');
                    }}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm transition-all border-2 flex items-center justify-center gap-2 ${
                      connectionType === 'local'
                        ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <Smartphone size={16} />
                    <span>MESMO APARELHO</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConnectionType('online');
                      setOnlineStatusMsg('');
                    }}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm transition-all border-2 flex items-center justify-center gap-2 ${
                      connectionType === 'online'
                        ? 'bg-cyan-600 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)]'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <Wifi size={16} />
                    <span>CONEXÃO ONLINE</span>
                  </button>
                </div>
              </div>

              {connectionType === 'local' ? (
                <>
                  {/* Seleção de Modo: Normal (2 Players) vs Modo Mesão (4 Players) */}
                  <div>
                    <label className="block text-slate-400 text-[11px] font-bold mb-1.5 uppercase tracking-widest text-center">
                      Modo de Jogo
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => applyModeDefaults('normal')}
                        className={`py-2.5 px-3 rounded-xl font-black text-sm transition-all border-2 flex flex-col items-center gap-0.5 ${
                          duelMode === 'normal'
                            ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.6)]'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        <span>MODO NORMAL</span>
                        <span className="text-[10px] font-medium opacity-80">2 Players • 20 Vida • 12 Mana</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => applyModeDefaults('mesao')}
                        className={`py-2.5 px-3 rounded-xl font-black text-sm transition-all border-2 flex flex-col items-center gap-0.5 ${
                          duelMode === 'mesao'
                            ? 'bg-emerald-600 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.6)]'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        <span>MODO MESÃO</span>
                        <span className="text-[10px] font-medium opacity-90">4 Players • 25 Vida • +3 Mana/Turno</span>
                      </button>
                    </div>
                  </div>

                  {/* Nomes dos Jogadores */}
                  <div className={duelMode === 'mesao' ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5' : 'space-y-3'}>
                    <div>
                      <label className="block text-slate-400 text-[11px] font-bold mb-1 uppercase tracking-widest">
                        {duelMode === 'mesao' ? 'Jogador 1 (Topo Esq.)' : 'Jogador 1 (Topo)'}
                      </label>
                      <input 
                        type="text" 
                        value={p1Name}
                        onChange={(e) => setP1Name(e.target.value)}
                        className="w-full bg-slate-900 border-2 border-slate-700 focus:border-purple-500 rounded-xl px-3 py-2 text-white font-bold outline-none transition text-sm"
                        placeholder="Nome do Jogador 1"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] font-bold mb-1 uppercase tracking-widest">
                        {duelMode === 'mesao' ? 'Jogador 2 (Topo Dir.)' : 'Jogador 2 (Baixo)'}
                      </label>
                      <input 
                        type="text" 
                        value={p2Name}
                        onChange={(e) => setP2Name(e.target.value)}
                        className="w-full bg-slate-900 border-2 border-slate-700 focus:border-blue-500 rounded-xl px-3 py-2 text-white font-bold outline-none transition text-sm"
                        placeholder="Nome do Jogador 2"
                      />
                    </div>
                    {duelMode === 'mesao' && (
                      <>
                        <div>
                          <label className="block text-slate-400 text-[11px] font-bold mb-1 uppercase tracking-widest">
                            Jogador 3 (Baixo Esq.)
                          </label>
                          <input 
                            type="text" 
                            value={p3Name}
                            onChange={(e) => setP3Name(e.target.value)}
                            className="w-full bg-slate-900 border-2 border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-white font-bold outline-none transition text-sm"
                            placeholder="Nome do Jogador 3"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 text-[11px] font-bold mb-1 uppercase tracking-widest">
                            Jogador 4 (Baixo Dir.)
                          </label>
                          <input 
                            type="text" 
                            value={p4Name}
                            onChange={(e) => setP4Name(e.target.value)}
                            className="w-full bg-slate-900 border-2 border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-white font-bold outline-none transition text-sm"
                            placeholder="Nome do Jogador 4"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Formato da Partida */}
                  <div>
                    <label className="block text-slate-400 text-[11px] font-bold mb-1.5 uppercase tracking-widest text-center">Formato da Partida</label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[1, 3, 5].map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => setMatchFormat(fmt as 1 | 3 | 5)}
                          className={`py-2 rounded-xl font-black text-sm transition-all border-2 ${
                            matchFormat === fmt 
                            ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.6)]' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          MD{fmt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Iniciar Button */}
                  <button 
                    onClick={() => setShowSetup(false)}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black py-3.5 rounded-xl shadow-lg border border-white/20 transition-all hover:scale-[1.01] active:scale-95 text-base"
                  >
                    COMEÇAR DUELO LOCAL {duelMode === 'mesao' ? '(MODO MESÃO)' : ''}
                  </button>
                </>
              ) : (
                /* CONEXÃO ONLINE (CADA JOGADOR NO SEU CELULAR) */
                <div className="space-y-4">
                  <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-2.5 text-center">
                    <p className="text-xs text-cyan-200 font-semibold">
                      Cada jogador usa seu próprio celular: seus status ficam <strong>grandes</strong> na sua tela e os outros aparecem <strong>menores</strong> no topo em tempo real!
                    </p>
                  </div>

                  {/* Abas Criar Sala vs Entrar em Sala */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      onClick={() => { setOnlineTab('create'); setOnlineStatusMsg(''); }}
                      className={`py-2 rounded-lg font-black text-xs uppercase transition ${
                        onlineTab === 'create'
                          ? 'bg-cyan-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Criar Nova Sala
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOnlineTab('join'); setOnlineStatusMsg(''); }}
                      className={`py-2 rounded-lg font-black text-xs uppercase transition ${
                        onlineTab === 'join'
                          ? 'bg-cyan-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Entrar com Código
                    </button>
                  </div>

                  {onlineTab === 'create' ? (
                    <div className="space-y-3.5">
                      {/* Modo Normal vs Mesão */}
                      <div>
                        <label className="block text-slate-400 text-[11px] font-bold mb-1.5 uppercase tracking-widest text-center">
                          Modo da Sala Online
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => applyModeDefaults('normal')}
                            className={`py-2.5 px-2 rounded-xl font-black text-xs sm:text-sm transition-all border-2 flex flex-col items-center gap-0.5 ${
                              duelMode === 'normal'
                                ? 'bg-purple-600 border-purple-400 text-white shadow'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            <span>MODO NORMAL (2P)</span>
                            <span className="text-[10px] font-medium opacity-80">20 Vida • 12 Mana</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => applyModeDefaults('mesao')}
                            className={`py-2.5 px-2 rounded-xl font-black text-xs sm:text-sm transition-all border-2 flex flex-col items-center gap-0.5 ${
                              duelMode === 'mesao'
                                ? 'bg-emerald-600 border-emerald-400 text-white shadow'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            <span>MODO MESÃO (4P)</span>
                            <span className="text-[10px] font-medium opacity-90">25 Vida • +3 Mana/Turno</span>
                          </button>
                        </div>
                      </div>

                      {/* Qual jogador você é + Seu Nome */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-slate-400 text-[11px] font-bold mb-1 uppercase tracking-widest">
                            Qual Jogador você é?
                          </label>
                          <div className={`grid ${duelMode === 'mesao' ? 'grid-cols-4' : 'grid-cols-2'} gap-1.5`}>
                            {(duelMode === 'mesao' ? [1, 2, 3, 4] : [1, 2]).map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setMyPlayerSlot(slot as 1 | 2 | 3 | 4)}
                                className={`py-2 rounded-lg font-black text-xs border transition ${
                                  myPlayerSlot === slot
                                    ? 'bg-cyan-600 border-cyan-300 text-white shadow'
                                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                                }`}
                              >
                                P{slot}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-400 text-[11px] font-bold mb-1 uppercase tracking-widest">
                            Seu Nome (P{myPlayerSlot})
                          </label>
                          <input
                            type="text"
                            value={myCustomName}
                            onChange={(e) => setMyCustomName(e.target.value)}
                            placeholder={`Ex: ${getPlayerName(myPlayerSlot)}`}
                            className="w-full bg-slate-900 border-2 border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-1.5 text-white font-bold outline-none transition text-sm"
                          />
                        </div>
                      </div>

                      {/* Formato MD1 / MD3 / MD5 */}
                      <div>
                        <label className="block text-slate-400 text-[11px] font-bold mb-1 uppercase tracking-widest text-center">
                          Formato da Partida
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[1, 3, 5].map((fmt) => (
                            <button
                              key={fmt}
                              type="button"
                              onClick={() => setMatchFormat(fmt as 1 | 3 | 5)}
                              className={`py-1.5 rounded-xl font-black text-xs sm:text-sm transition-all border-2 ${
                                matchFormat === fmt
                                  ? 'bg-purple-600 border-purple-400 text-white'
                                  : 'bg-slate-800 border-slate-700 text-slate-400'
                              }`}
                            >
                              MD{fmt}
                            </button>
                          ))}
                        </div>
                      </div>

                      {onlineStatusMsg && (
                        <p className="text-xs text-red-400 text-center font-bold bg-red-950/40 border border-red-500/30 rounded-lg py-1.5 px-2">
                          {onlineStatusMsg}
                        </p>
                      )}

                      <button
                        type="button"
                        disabled={isConnectingOnline}
                        onClick={handleCreateOnlineRoom}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl shadow-lg border border-white/20 transition-all active:scale-95 text-sm sm:text-base flex items-center justify-center gap-2"
                      >
                        <Wifi size={18} />
                        <span>{isConnectingOnline ? 'CRIANDO SALA...' : 'CRIAR SALA ONLINE'}</span>
                      </button>
                    </div>
                  ) : (
                    /* ENTRAR COM CÓDIGO */
                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-slate-400 text-[11px] font-bold mb-1 uppercase tracking-widest">
                          Código da Sala (4 letras/números)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            value={joinCodeInput}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              setJoinCodeInput(val);
                              if (val.length === 4) {
                                handleLookupRoom(val);
                              }
                            }}
                            placeholder="Ex: K7M9"
                            className="flex-1 bg-slate-900 border-2 border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-white font-mono font-black uppercase tracking-widest text-center text-lg outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleLookupRoom()}
                            disabled={isConnectingOnline}
                            className="px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 font-bold text-xs uppercase transition"
                          >
                            Buscar
                          </button>
                        </div>
                      </div>

                      {joinedRoomPreview && (
                        <div className="bg-slate-900/90 border border-cyan-500/40 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-cyan-300 uppercase">
                              Sala {joinedRoomPreview.roomCode} • {joinedRoomPreview.duelMode === 'mesao' ? 'Modo Mesão (4P)' : 'Modo Normal (2P)'}
                            </span>
                            <span className="text-slate-400 font-mono">Rodada {joinedRoomPreview.rounds || 1}</span>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-slate-400 text-[11px] font-bold mb-1.5 uppercase tracking-widest">
                          Escolha qual Jogador você é neste celular:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {((joinedRoomPreview?.duelMode ?? duelMode) === 'mesao' ? [1, 2, 3, 4] : [1, 2]).map((slot) => {
                            const previewName = joinedRoomPreview
                              ? joinedRoomPreview[`p${slot}Name`] || `Jogador ${slot}`
                              : getPlayerName(slot);
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setMyPlayerSlot(slot as 1 | 2 | 3 | 4)}
                                className={`p-2.5 rounded-xl border-2 text-left transition flex items-center justify-between ${
                                  myPlayerSlot === slot
                                    ? 'bg-cyan-600/30 border-cyan-400 text-white shadow'
                                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-[10px] font-black text-cyan-300 uppercase">Jogador {slot}</div>
                                  <div className="text-xs font-bold truncate">{previewName}</div>
                                </div>
                                {myPlayerSlot === slot && <Check size={16} className="text-cyan-300 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-400 text-[11px] font-bold mb-1 uppercase tracking-widest">
                          Seu Nome (Opcional — atualiza P{myPlayerSlot})
                        </label>
                        <input
                          type="text"
                          value={myCustomName}
                          onChange={(e) => setMyCustomName(e.target.value)}
                          placeholder="Digite seu nome ou apelido..."
                          className="w-full bg-slate-900 border-2 border-slate-700 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-white font-bold outline-none transition text-sm"
                        />
                      </div>

                      {onlineStatusMsg && (
                        <p className="text-xs text-red-400 text-center font-bold bg-red-950/40 border border-red-500/30 rounded-lg py-1.5 px-2">
                          {onlineStatusMsg}
                        </p>
                      )}

                      <button
                        type="button"
                        disabled={isConnectingOnline || !joinCodeInput.trim()}
                        onClick={handleConfirmJoinOnlineRoom}
                        className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl shadow-lg border border-white/20 transition-all active:scale-95 text-sm sm:text-base flex items-center justify-center gap-2"
                      >
                        <ArrowRight size={18} />
                        <span>{isConnectingOnline ? 'ENTRANDO...' : `ENTRAR NA SALA COMO P${myPlayerSlot}`}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
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

            {connectionType === 'online' && roomCode && (
              <div className="p-3 bg-cyan-950/50 border-b border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-300 uppercase">Código da Sala Online</span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(roomCode);
                      setCopiedRoomCode(true);
                      setTimeout(() => setCopiedRoomCode(false), 2000);
                    }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 text-xs font-mono font-black border border-cyan-400/40"
                  >
                    <span>{roomCode}</span>
                    {copiedRoomCode ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Trocar meu jogador neste celular:</span>
                  <div className={`grid ${duelMode === 'mesao' ? 'grid-cols-4' : 'grid-cols-2'} gap-1`}>
                    {(duelMode === 'mesao' ? [1, 2, 3, 4] : [1, 2]).map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setMyPlayerSlot(slot as 1 | 2 | 3 | 4)}
                        className={`py-1 rounded font-black text-xs border transition ${
                          myPlayerSlot === slot
                            ? 'bg-cyan-600 border-cyan-300 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        P{slot}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col p-2">
              <button 
                onClick={() => { setShowResetModal(true); setIsMenuOpen(false); }}
                className="flex items-center gap-3 text-slate-200 hover:bg-slate-700/50 p-3 rounded-xl transition text-left"
              >
                <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400"><RotateCcw size={20} /></div>
                <div>
                  <div className="font-bold">Reiniciar Partida Atual</div>
                  <div className="text-xs text-slate-400">Reseta vida, mana e rodadas</div>
                </div>
              </button>

              <button 
                onClick={() => { setShowSetup(true); setIsMenuOpen(false); }}
                className="flex items-center gap-3 text-slate-200 hover:bg-slate-700/50 p-3 rounded-xl transition text-left"
              >
                <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400"><Sparkles size={20} /></div>
                <div>
                  <div className="font-bold">Configurar / Sala Online</div>
                  <div className="text-xs text-slate-400">Modo Normal, Mesão ou Sala Online</div>
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
                <span className="font-bold text-slate-200">{p1Name}</span>
              </button>
              
              <button 
                onClick={() => handleReset(2)}
                className="bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-blue-500 p-4 rounded-xl flex flex-col items-center gap-2 transition group"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">2</div>
                <span className="font-bold text-slate-200">{p2Name}</span>
              </button>

              {duelMode === 'mesao' && (
                <>
                  <button 
                    onClick={() => handleReset(3)}
                    className="bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-emerald-500 p-4 rounded-xl flex flex-col items-center gap-2 transition group"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition">3</div>
                    <span className="font-bold text-slate-200">{p3Name}</span>
                  </button>

                  <button 
                    onClick={() => handleReset(4)}
                    className="bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-amber-500 p-4 rounded-xl flex flex-col items-center gap-2 transition group"
                  >
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition">4</div>
                    <span className="font-bold text-slate-200">{p4Name}</span>
                  </button>
                </>
              )}
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
                  <span className="block text-lg font-bold text-white mb-2">{p1Name}</span>
                  <span className="text-sm text-slate-400 group-hover:text-purple-400">Alterar fundo</span>
                </button>
                <button 
                  onClick={() => setThemeTargetPlayer(2)}
                  className="bg-slate-800 p-6 rounded-xl border-2 border-slate-700 hover:border-blue-500 transition text-center group"
                >
                  <span className="block text-lg font-bold text-white mb-2">{p2Name}</span>
                  <span className="text-sm text-slate-400 group-hover:text-blue-400">Alterar fundo</span>
                </button>
                {duelMode === 'mesao' && (
                  <>
                    <button 
                      onClick={() => setThemeTargetPlayer(3)}
                      className="bg-slate-800 p-6 rounded-xl border-2 border-slate-700 hover:border-emerald-500 transition text-center group"
                    >
                      <span className="block text-lg font-bold text-white mb-2">{p3Name}</span>
                      <span className="text-sm text-slate-400 group-hover:text-emerald-400">Alterar fundo</span>
                    </button>
                    <button 
                      onClick={() => setThemeTargetPlayer(4)}
                      className="bg-slate-800 p-6 rounded-xl border-2 border-slate-700 hover:border-amber-500 transition text-center group"
                    >
                      <span className="block text-lg font-bold text-white mb-2">{p4Name}</span>
                      <span className="text-sm text-slate-400 group-hover:text-amber-400">Alterar fundo</span>
                    </button>
                  </>
                )}
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
                    {((themeTargetPlayer === 1 && p1Background === theme.url) ||
                      (themeTargetPlayer === 2 && p2Background === theme.url) ||
                      (themeTargetPlayer === 3 && p3Background === theme.url) ||
                      (themeTargetPlayer === 4 && p4Background === theme.url)) && (
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
                      <span className="text-xs font-bold text-blue-400">{getPlayerName(log.activePlayer)}</span>
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

      {/* ONLINE MODE LAYOUT: Opponents compact on top + Center Bar + My Board big on bottom */}
      {connectionType === 'online' && roomCode ? (
        <>
          {/* TOP COMPACT BAR: Other Players' Statuses */}
          <div className="bg-slate-950/90 border-b border-white/10 p-2 sm:p-3 shrink-0">
            <div className={`grid ${otherPlayersInOnline.length === 3 ? 'grid-cols-3' : 'grid-cols-1 max-w-md mx-auto'} gap-2 sm:gap-3`}>
              {otherPlayersInOnline.map((oppNum) => (
                <OpponentMiniCard key={oppNum} playerNum={oppNum} />
              ))}
            </div>
          </div>

          {/* Center Control Bar */}
          <div className="h-10 sm:h-12 bg-black/85 backdrop-blur-md border-b border-white/20 flex items-center justify-between px-1.5 sm:px-4 md:px-6 relative z-50 shrink-0 shadow-2xl gap-1 sm:gap-2">
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="bg-black/60 hover:bg-black/80 border border-white/20 text-white p-1 sm:p-1.5 rounded-lg transition active:scale-95 shadow-sm"
                title="Menu"
              >
                <Menu size={15} />
              </button>

              <button
                onClick={() => {
                  navigator.clipboard?.writeText(roomCode);
                  setCopiedRoomCode(true);
                  setTimeout(() => setCopiedRoomCode(false), 2000);
                }}
                className="border border-cyan-500/40 bg-cyan-950/60 hover:bg-cyan-900/60 rounded-lg px-1.5 py-0.5 text-cyan-300 font-mono font-black text-[10px] sm:text-xs flex items-center gap-1 transition"
                title="Clique para copiar o código da sala"
              >
                <Wifi size={10} className="text-cyan-400" />
                <span>{roomCode}</span>
                {copiedRoomCode ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} className="opacity-70" />}
              </button>

              <div className="border border-white/20 bg-black/60 rounded-lg px-1.5 sm:px-2.5 py-0.5 text-white font-bold text-[10px] sm:text-xs tracking-wider whitespace-nowrap shadow-sm flex items-center gap-1">
                <span>R{rounds}</span>
                {duelMode === 'mesao' && (
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hidden md:inline">
                    T{turns + 1}/4
                  </span>
                )}
              </div>
            </div>

            {/* Centro: Vez do Jogador */}
            <div className="flex items-center justify-center min-w-0 px-0.5">
              <div className="flex items-center gap-1 px-2 sm:px-3 py-0.5 rounded-full bg-slate-900/95 border border-amber-400/80 text-amber-300 text-[10px] sm:text-xs font-black shadow-[0_0_10px_rgba(251,191,36,0.3)] truncate max-w-[115px] sm:max-w-[190px] md:max-w-xs">
                <Zap size={11} className="fill-amber-400 text-amber-400 shrink-0 animate-pulse" />
                <span className="truncate">Vez: {getPlayerName(activePlayer)}</span>
              </div>
            </div>

            {/* Direita: Log e Passar Turno */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                onClick={() => setIsLogOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-1.5 sm:px-2.5 py-1 rounded-lg font-bold text-[10px] sm:text-xs shadow-sm transition active:scale-95 flex items-center gap-1"
                title="Log de Ações"
              >
                <History size={13} />
                <span className="hidden sm:inline">Log</span>
              </button>
              
              <button
                onClick={passTurn}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-blue-400/60 text-white px-2 sm:px-3.5 py-1 rounded-lg font-black uppercase tracking-wider shadow-[0_0_12px_rgba(37,99,235,0.4)] transition active:scale-95 text-[10px] sm:text-xs whitespace-nowrap"
              >
                Passar Turno
              </button>
            </div>
          </div>

          {/* MAIN FULL-SIZE AREA: Current Player's Own Statuses */}
          <PlayerBoard
            mana={myBoardProps.mana} setMana={myBoardProps.setMana}
            life={myBoardProps.life} setLife={myBoardProps.setLife}
            ctReduction={myBoardProps.ctReduction} setCtReduction={myBoardProps.setCtReduction}
            deckDamage={myBoardProps.deckDamage} setDeckDamage={myBoardProps.setDeckDamage}
            runes={myBoardProps.runes} setRunes={myBoardProps.setRunes}
            insanity={myBoardProps.insanity} setInsanity={myBoardProps.setInsanity}
            rotated={false}
            isActive={activePlayer === myPlayerSlot}
            background={myBoardProps.background}
            playerNum={myPlayerSlot}
            compact={false}
            isMyOnlineBoard={true}
          />
        </>
      ) : (
        /* LOCAL MODE LAYOUT (Same Device) */
        <>
          {/* TOP HALF */}
          {duelMode === 'mesao' ? (
            <div className="flex-1 grid grid-cols-2 divide-x divide-white/10 min-h-0">
              <PlayerBoard
                mana={p1Mana} setMana={updateP1Mana}
                life={p1Life} setLife={updateP1Life}
                ctReduction={p1CtReduction} setCtReduction={updateP1Ct}
                deckDamage={p1DeckDamage} setDeckDamage={updateP1Prim}
                runes={p1Runes} setRunes={updateP1Runes}
                insanity={p1Insanity} setInsanity={updateP1Insanity}
                rotated={true}
                isActive={activePlayer === 1}
                background={p1Background}
                playerNum={1}
                compact={true}
              />
              <PlayerBoard
                mana={p2Mana} setMana={updateP2Mana}
                life={p2Life} setLife={updateP2Life}
                ctReduction={p2CtReduction} setCtReduction={updateP2Ct}
                deckDamage={p2DeckDamage} setDeckDamage={updateP2Prim}
                runes={p2Runes} setRunes={updateP2Runes}
                insanity={p2Insanity} setInsanity={updateP2Insanity}
                rotated={true}
                isActive={activePlayer === 2}
                background={p2Background}
                playerNum={2}
                compact={true}
              />
            </div>
          ) : (
            <PlayerBoard
              mana={p1Mana} setMana={updateP1Mana}
              life={p1Life} setLife={updateP1Life}
              ctReduction={p1CtReduction} setCtReduction={updateP1Ct}
              deckDamage={p1DeckDamage} setDeckDamage={updateP1Prim}
              runes={p1Runes} setRunes={updateP1Runes}
              insanity={p1Insanity} setInsanity={updateP1Insanity}
              rotated={true}
              isActive={activePlayer === 1}
              background={p1Background}
              playerNum={1}
            />
          )}

          {/* Center Bar */}
          <div className="h-10 sm:h-12 bg-black/80 backdrop-blur-md border-y border-white/20 flex items-center justify-between px-1.5 sm:px-4 md:px-6 relative z-50 shrink-0 shadow-2xl gap-1 sm:gap-2">
            
            {/* Esquerda: Menu e Rodada */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button 
                onClick={() => setIsMenuOpen(true)}
                className="bg-black/60 hover:bg-black/80 border border-white/20 text-white p-1 sm:p-1.5 rounded-lg transition active:scale-95 shadow-sm"
                title="Menu"
              >
                <Menu size={15} />
              </button>

              <div className="border border-white/20 bg-black/60 rounded-lg px-2 sm:px-2.5 py-0.5 text-white font-bold text-[10px] sm:text-xs tracking-wider whitespace-nowrap shadow-sm flex items-center gap-1">
                <span>Rodada {rounds}</span>
                {duelMode === 'mesao' && (
                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hidden sm:inline">
                    T{turns + 1}/4
                  </span>
                )}
              </div>
            </div>

            {/* Centro: Vez do Jogador */}
            <div className="flex items-center justify-center min-w-0 px-0.5">
              <div className="flex items-center gap-1 px-2 sm:px-3 py-0.5 rounded-full bg-slate-900/95 border border-amber-400/80 text-amber-300 text-[10px] sm:text-xs font-black shadow-[0_0_10px_rgba(251,191,36,0.3)] truncate max-w-[115px] sm:max-w-[190px] md:max-w-xs">
                <Zap size={11} className="fill-amber-400 text-amber-400 shrink-0 animate-pulse" />
                <span className="truncate">Vez: {getPlayerName(activePlayer)}</span>
              </div>
            </div>

            {/* Direita: Log e Passar Turno */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                onClick={() => setIsLogOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white px-1.5 sm:px-2.5 py-1 rounded-lg font-bold text-[10px] sm:text-xs shadow-sm transition active:scale-95 flex items-center gap-1"
                title="Log de Ações"
              >
                <History size={13} />
                <span className="hidden sm:inline">Log</span>
              </button>
              
              <button
                onClick={passTurn}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-blue-400/60 text-white px-2 sm:px-3.5 py-1 rounded-lg font-black uppercase tracking-wider shadow-[0_0_12px_rgba(37,99,235,0.4)] transition active:scale-95 text-[10px] sm:text-xs whitespace-nowrap"
              >
                Passar Turno
              </button>
            </div>
          </div>

          {/* BOTTOM HALF */}
          {duelMode === 'mesao' ? (
            <div className="flex-1 grid grid-cols-2 divide-x divide-white/10 min-h-0">
              <PlayerBoard
                mana={p3Mana} setMana={updateP3Mana}
                life={p3Life} setLife={updateP3Life}
                ctReduction={p3CtReduction} setCtReduction={updateP3Ct}
                deckDamage={p3DeckDamage} setDeckDamage={updateP3Prim}
                runes={p3Runes} setRunes={updateP3Runes}
                insanity={p3Insanity} setInsanity={updateP3Insanity}
                rotated={false}
                isActive={activePlayer === 3}
                background={p3Background}
                playerNum={3}
                compact={true}
              />
              <PlayerBoard
                mana={p4Mana} setMana={updateP4Mana}
                life={p4Life} setLife={updateP4Life}
                ctReduction={p4CtReduction} setCtReduction={updateP4Ct}
                deckDamage={p4DeckDamage} setDeckDamage={updateP4Prim}
                runes={p4Runes} setRunes={updateP4Runes}
                insanity={p4Insanity} setInsanity={updateP4Insanity}
                rotated={false}
                isActive={activePlayer === 4}
                background={p4Background}
                playerNum={4}
                compact={true}
              />
            </div>
          ) : (
            <PlayerBoard
              mana={p2Mana} setMana={updateP2Mana}
              life={p2Life} setLife={updateP2Life}
              ctReduction={p2CtReduction} setCtReduction={updateP2Ct}
              deckDamage={p2DeckDamage} setDeckDamage={updateP2Prim}
              runes={p2Runes} setRunes={updateP2Runes}
              insanity={p2Insanity} setInsanity={updateP2Insanity}
              rotated={false}
              isActive={activePlayer === 2}
              background={p2Background}
              playerNum={2}
            />
          )}
        </>
      )}

    </div>
  );
}
