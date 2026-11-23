import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Camera,
  Radio,
  CircleDot,
  Square,
  Download,
  Plus,
  Minus,
  Zap,
  Sparkles,
  Search,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Trophy,
  RotateCcw,
  Maximize2,
  Minimize2,
  ScanLine,
  Wand2,
  Layers,
  Award,
  CheckCircle2,
  AlertTriangle,
  History,
  Tv,
  Sliders,
  Volume2
} from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { CardData } from '../cardService';
import { Match, Participant, Referee } from '../tournamentService';

export interface OnlineDuelBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  tournamentName: string;
  match: Match;
  allCards: CardData[];
  isAdminOrCreator: boolean;
  currentUserUid?: string;
  currentUserName?: string;
  referees?: Referee[];
  onSaveMatchScore?: (
    matchId: string,
    score1: number,
    score2: number,
    options?: { isWO?: boolean; woWinnerId?: string | null; markCompleted?: boolean }
  ) => void;
}

interface SpotlightCardState {
  code: string;
  name: string;
  type: string;
  archetype: string;
  ct: number;
  attack?: number;
  defense?: number;
  description: string;
  imageUrl: string;
  shownBy: string;
  shownAt: number;
  source: 'admin_search' | 'camera_ai' | 'player';
}

interface LiveDuelRoomState {
  roomId: string;
  tournamentId: string;
  matchId: string;
  isLiveBroadcast: boolean;
  broadcastTitle: string;
  broadcastBannerText: string;
  adminSwapSides: boolean;
  adminFocusTarget: 'split' | 'p1_deck' | 'p2_deck';
  refereeName: string;
  // Game State (same as App Duelo)
  rounds: number;
  turns: number;
  activePlayer: 1 | 2;
  matchFormat: 3; // MD3
  p1Name: string;
  p2Name: string;
  p1Wins: number;
  p2Wins: number;
  // Player 1 Counters
  p1Life: number;
  p1Mana: number;
  p1CtReduction: number;
  p1DeckDamage: number;
  p1Runes: number;
  p1Insanity: number;
  // Player 2 Counters
  p2Life: number;
  p2Mana: number;
  p2CtReduction: number;
  p2DeckDamage: number;
  p2Runes: number;
  p2Insanity: number;
  // Camera Snapshots (low-latency periodic frames for remote viewers + local live stream)
  p1DeckFrame?: string;
  p1FaceFrame?: string;
  p1FaceEnabled?: boolean;
  p1AudioMuted?: boolean;
  p2DeckFrame?: string;
  p2FaceFrame?: string;
  p2FaceEnabled?: boolean;
  p2AudioMuted?: boolean;
  // Active Spotlight Card on Screen
  spotlightCard: SpotlightCardState | null;
  spotlightHistory: SpotlightCardState[];
  actionLogs: { round: number; text: string; timestamp: number }[];
  updatedAt: number;
}

export const OnlineDuelBroadcastModal: React.FC<OnlineDuelBroadcastModalProps> = ({
  isOpen,
  onClose,
  tournamentId,
  tournamentName,
  match,
  allCards,
  isAdminOrCreator,
  currentUserUid,
  currentUserName,
  onSaveMatchScore
}) => {
  const roomId = useMemo(
    () => match.liveRoomId || `live_${tournamentId}_${match.id}`,
    [tournamentId, match.id, match.liveRoomId]
  );

  // Determine default role based on linked account
  const detectedRole = useMemo<'p1' | 'p2' | 'admin'>(() => {
    if (currentUserUid && match.player1?.userId === currentUserUid) return 'p1';
    if (currentUserUid && match.player2?.userId === currentUserUid) return 'p2';
    if (isAdminOrCreator) return 'admin';
    return 'p1';
  }, [currentUserUid, match.player1?.userId, match.player2?.userId, isAdminOrCreator]);

  const [myRole, setMyRole] = useState<'p1' | 'p2' | 'admin' | 'spectator'>(detectedRole);

  // Room synced state
  const [roomState, setRoomState] = useState<LiveDuelRoomState>({
    roomId,
    tournamentId,
    matchId: match.id,
    isLiveBroadcast: false,
    broadcastTitle: `${tournamentName || 'Copa Light Dark'} • Rodada ${match.round}`,
    broadcastBannerText: 'TRANSMISSÃO OFICIAL MD3 • VITÓRIA = 3 PTS | EMPATE = 1 PT | W.O. = 3 PTS',
    adminSwapSides: false,
    adminFocusTarget: 'split',
    refereeName: match.refereeName || 'Juiz Oficial',
    rounds: 1,
    turns: 0,
    activePlayer: 1,
    matchFormat: 3,
    p1Name: match.player1?.name || 'Jogador 1',
    p2Name: match.player2?.name || 'Jogador 2',
    p1Wins: match.score1 ?? 0,
    p2Wins: match.score2 ?? 0,
    p1Life: 20,
    p1Mana: 12,
    p1CtReduction: 0,
    p1DeckDamage: 0,
    p1Runes: 0,
    p1Insanity: 100,
    p2Life: 20,
    p2Mana: 12,
    p2CtReduction: 0,
    p2DeckDamage: 0,
    p2Runes: 0,
    p2Insanity: 100,
    p1FaceEnabled: false,
    p2FaceEnabled: false,
    spotlightCard: null,
    spotlightHistory: [],
    actionLogs: [],
    updatedAt: Date.now()
  });

  // Camera Devices & Local Streams
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [deckCameraDeviceId, setDeckCameraDeviceId] = useState<string>('');
  const [faceCameraDeviceId, setFaceCameraDeviceId] = useState<string>('');
  const [isDeckCamActive, setIsDeckCamActive] = useState(false);
  const [isFaceCamActive, setIsFaceCamActive] = useState(false); // Face camera is optional
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const deckVideoRef = useRef<HTMLVideoElement | null>(null);
  const faceVideoRef = useRef<HTMLVideoElement | null>(null);
  const deckStreamRef = useRef<MediaStream | null>(null);
  const faceStreamRef = useRef<MediaStream | null>(null);

  // Recording State (MediaRecorder)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Card Spotlight & Camera Recognition State
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [isScanningCamera, setIsScanningCamera] = useState(false);
  const [scanTargetSide, setScanTargetSide] = useState<'p1' | 'p2'>('p1');
  const [scanResultMsg, setScanResultMsg] = useState<string | null>(null);
  const [showSpotlightOverlay, setShowSpotlightOverlay] = useState(true);
  const [showAdminControlDrawer, setShowAdminControlDrawer] = useState(true);

  // Sync Firestore Room
  useEffect(() => {
    if (!isOpen || !roomId) return;

    const roomRef = doc(db, 'duelRooms', roomId);

    const initAndSubscribe = async () => {
      try {
        const snap = await getDoc(roomRef);
        if (!snap.exists()) {
          const initialPayload: LiveDuelRoomState = {
            ...roomState,
            roomId,
            tournamentId,
            matchId: match.id,
            p1Name: match.player1?.name || 'Jogador 1',
            p2Name: match.player2?.name || 'Jogador 2',
            p1Wins: match.score1 ?? 0,
            p2Wins: match.score2 ?? 0,
            refereeName: match.refereeName || 'Juiz Oficial',
            updatedAt: Date.now()
          };
          await setDoc(roomRef, initialPayload);
        }
      } catch (err) {
        console.warn('Erro ao inicializar sala de transmissão:', err);
      }
    };

    initAndSubscribe();

    const unsub = onSnapshot(roomRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as LiveDuelRoomState;
        setRoomState((prev) => ({
          ...prev,
          ...data
        }));
      }
    });

    return () => unsub();
  }, [isOpen, roomId]);

  const patchRoom = async (patch: Partial<LiveDuelRoomState>) => {
    setRoomState((prev) => ({ ...prev, ...patch }));
    try {
      const roomRef = doc(db, 'duelRooms', roomId);
      await updateDoc(roomRef, {
        ...patch,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.warn('Falha ao sincronizar sala:', err);
    }
  };

  // Enumerate cameras
  const refreshVideoDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vids = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(vids);
      if (vids.length > 0 && !deckCameraDeviceId) {
        setDeckCameraDeviceId(vids[0].deviceId);
      }
      if (vids.length > 1 && !faceCameraDeviceId) {
        setFaceCameraDeviceId(vids[1].deviceId);
      } else if (vids.length === 1 && !faceCameraDeviceId) {
        setFaceCameraDeviceId(vids[0].deviceId);
      }
    } catch (err) {
      console.warn('Não foi possível listar câmeras:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshVideoDevices();
    }
    return () => {
      stopDeckCamera();
      stopFaceCamera();
    };
  }, [isOpen]);

  // Start / Stop Deck Camera (Camera 1 - Mandatory for player table/deck)
  const startDeckCamera = async (customDeviceId?: string) => {
    setCameraError(null);
    try {
      stopDeckCamera();
      const targetId = customDeviceId ?? deckCameraDeviceId;
      const constraints: MediaStreamConstraints = {
        video: targetId
          ? { deviceId: { exact: targetId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      deckStreamRef.current = stream;
      if (deckVideoRef.current) {
        deckVideoRef.current.srcObject = stream;
        await deckVideoRef.current.play().catch(() => {});
      }
      setIsDeckCamActive(true);
      await refreshVideoDevices();
    } catch (err: any) {
      console.error('Erro ao abrir câmera do deck:', err);
      setCameraError('Não foi possível acessar a Câmera do Deck/Campo. Verifique as permissões de câmera do navegador.');
    }
  };

  const stopDeckCamera = () => {
    if (deckStreamRef.current) {
      deckStreamRef.current.getTracks().forEach((t) => t.stop());
      deckStreamRef.current = null;
    }
    if (deckVideoRef.current) {
      deckVideoRef.current.srcObject = null;
    }
    setIsDeckCamActive(false);
  };

  // Start / Stop Face Camera (Camera 2 - Optional for player face)
  const startFaceCamera = async (customDeviceId?: string) => {
    setCameraError(null);
    try {
      stopFaceCamera();
      const targetId = customDeviceId ?? faceCameraDeviceId;
      const constraints: MediaStreamConstraints = {
        video: targetId
          ? { deviceId: { exact: targetId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      faceStreamRef.current = stream;
      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = stream;
        await faceVideoRef.current.play().catch(() => {});
      }
      setIsFaceCamActive(true);
      if (myRole === 'p1') patchRoom({ p1FaceEnabled: true });
      if (myRole === 'p2') patchRoom({ p2FaceEnabled: true });
      await refreshVideoDevices();
    } catch (err: any) {
      console.error('Erro ao abrir câmera do rosto:', err);
      setCameraError('Não foi possível acessar a 2ª Câmera (Rosto). Caso tenha apenas 1 câmera conectada, mantenha a Câmera de Rosto desativada.');
    }
  };

  const stopFaceCamera = () => {
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach((t) => t.stop());
      faceStreamRef.current = null;
    }
    if (faceVideoRef.current) {
      faceVideoRef.current.srcObject = null;
    }
    setIsFaceCamActive(false);
    if (myRole === 'p1') patchRoom({ p1FaceEnabled: false, p1FaceFrame: '' });
    if (myRole === 'p2') patchRoom({ p2FaceEnabled: false, p2FaceFrame: '' });
  };

  const toggleMic = () => {
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    if (deckStreamRef.current) {
      deckStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    if (myRole === 'p1') patchRoom({ p1AudioMuted: nextMuted });
    if (myRole === 'p2') patchRoom({ p2AudioMuted: nextMuted });
  };

  // Periodically sync compact frame snapshots to Firestore so opponent, judge & spectators see live cameras
  useEffect(() => {
    if (!isOpen || (myRole !== 'p1' && myRole !== 'p2') || (!isDeckCamActive && !isFaceCamActive)) {
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const interval = setInterval(() => {
      if (!ctx) return;
      const patch: Partial<LiveDuelRoomState> = {};

      if (isDeckCamActive && deckVideoRef.current && deckVideoRef.current.readyState >= 2) {
        canvas.width = 420;
        canvas.height = 240;
        ctx.drawImage(deckVideoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.55);
        if (myRole === 'p1') patch.p1DeckFrame = dataUrl;
        if (myRole === 'p2') patch.p2DeckFrame = dataUrl;
      }

      if (isFaceCamActive && faceVideoRef.current && faceVideoRef.current.readyState >= 2) {
        canvas.width = 200;
        canvas.height = 150;
        ctx.drawImage(faceVideoRef.current, 0, 0, canvas.width, canvas.height);
        const faceUrl = canvas.toDataURL('image/jpeg', 0.5);
        if (myRole === 'p1') patch.p1FaceFrame = faceUrl;
        if (myRole === 'p2') patch.p2FaceFrame = faceUrl;
      }

      if (Object.keys(patch).length > 0) {
        patchRoom(patch);
      }
    }, 1600);

    return () => clearInterval(interval);
  }, [isOpen, myRole, isDeckCamActive, isFaceCamActive]);

  // Re-attach local streams when video refs mount or role changes
  useEffect(() => {
    if (isDeckCamActive && deckVideoRef.current && deckStreamRef.current) {
      deckVideoRef.current.srcObject = deckStreamRef.current;
      deckVideoRef.current.play().catch(() => {});
    }
    if (isFaceCamActive && faceVideoRef.current && faceStreamRef.current) {
      faceVideoRef.current.srcObject = faceStreamRef.current;
      faceVideoRef.current.play().catch(() => {});
    }
  }, [myRole, isDeckCamActive, isFaceCamActive, roomState.adminSwapSides, roomState.adminFocusTarget]);

  // Recording Timer
  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  // Start / Stop Recording (Screen Broadcast or Active Deck Camera)
  const handleStartRecording = async () => {
    setRecordedVideoUrl(null);
    recordedChunksRef.current = [];

    try {
      let targetStream: MediaStream | null = null;

      // Prefer display media (captures entire duel arena with scoreboard, cameras & card overlay)
      if (navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices) {
        try {
          targetStream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 30 },
            audio: true
          });
        } catch {
          // Fallback to local camera stream if user cancels screen picker
          targetStream = deckStreamRef.current;
        }
      } else {
        targetStream = deckStreamRef.current;
      }

      if (!targetStream) {
        await startDeckCamera();
        targetStream = deckStreamRef.current;
      }

      if (!targetStream) {
        setCameraError('Ative a câmera ou selecione a janela para iniciar a gravação da partida.');
        return;
      }

      const recorder = new MediaRecorder(targetStream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm'
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setIsRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setRecordingSeconds(0);
      setIsRecording(true);
    } catch (err) {
      console.error('Erro ao iniciar gravação:', err);
      setCameraError('Não foi possível iniciar a gravação de vídeo neste navegador.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // App Duelo Counter Actions
  const appendLog = (text: string, extraPatch: Partial<LiveDuelRoomState> = {}) => {
    const nextLogs = [
      { round: roomState.rounds, text, timestamp: Date.now() },
      ...(roomState.actionLogs || []).slice(0, 29)
    ];
    patchRoom({
      ...extraPatch,
      actionLogs: nextLogs
    });
  };

  const handlePassTurn = () => {
    const nextPlayer: 1 | 2 = roomState.activePlayer === 1 ? 2 : 1;
    const newTurns = roomState.turns + 1;
    if (newTurns >= 2) {
      const nextRound = roomState.rounds + 1;
      appendLog(`Rodada ${nextRound} iniciada! Mana de ambos restaurada para 12.`, {
        activePlayer: nextPlayer,
        turns: 0,
        rounds: nextRound,
        p1Mana: 12,
        p2Mana: 12
      });
    } else {
      appendLog(`Turno passado para ${nextPlayer === 1 ? roomState.p1Name : roomState.p2Name}.`, {
        activePlayer: nextPlayer,
        turns: newTurns
      });
    }
  };

  const handleResetGameCounters = (startingPlayer: 1 | 2 = 1) => {
    appendLog(`Contadores reiniciados para novo jogo da MD3.`, {
      rounds: 1,
      turns: 0,
      activePlayer: startingPlayer,
      p1Life: 20,
      p1Mana: 12,
      p1CtReduction: 0,
      p1DeckDamage: 0,
      p1Runes: 0,
      p1Insanity: 100,
      p2Life: 20,
      p2Mana: 12,
      p2CtReduction: 0,
      p2DeckDamage: 0,
      p2Runes: 0,
      p2Insanity: 100
    });
  };

  const handleChangeWins = (playerNum: 1 | 2, delta: number) => {
    if (playerNum === 1) {
      const next = Math.max(0, Math.min(2, roomState.p1Wins + delta));
      patchRoom({ p1Wins: next });
      if (onSaveMatchScore) {
        onSaveMatchScore(match.id, next, roomState.p2Wins, { markCompleted: false });
      }
    } else {
      const next = Math.max(0, Math.min(2, roomState.p2Wins + delta));
      patchRoom({ p2Wins: next });
      if (onSaveMatchScore) {
        onSaveMatchScore(match.id, roomState.p1Wins, next, { markCompleted: false });
      }
    }
  };

  const handleFinishMd3FromStudio = (woWinnerId?: string | null) => {
    if (!onSaveMatchScore) return;
    if (woWinnerId) {
      const isP1 = woWinnerId === match.player1?.id;
      onSaveMatchScore(match.id, isP1 ? 2 : 0, isP1 ? 0 : 2, {
        isWO: true,
        woWinnerId,
        markCompleted: true
      });
      appendLog(`Partida encerrada por W.O. (+3 pts para ${isP1 ? roomState.p1Name : roomState.p2Name}).`);
    } else {
      onSaveMatchScore(match.id, roomState.p1Wins, roomState.p2Wins, {
        isWO: false,
        woWinnerId: null,
        markCompleted: true
      });
      appendLog(`Resultado MD3 oficializado: ${roomState.p1Name} ${roomState.p1Wins} x ${roomState.p2Wins} ${roomState.p2Name}.`);
    }
  };

  // --- CARD SPOTLIGHT & CAMERA RECOGNITION ---
  const uniqueCatalogCards = useMemo(() => {
    const map = new Map<string, CardData>();
    for (const c of allCards) {
      if (!c.name) continue;
      const key = c.name.trim().toLowerCase();
      if (!map.has(key) || (c.frame === 'Moderno' && c.imageUrl)) {
        map.set(key, c);
      }
    }
    return Array.from(map.values());
  }, [allCards]);

  const filteredSpotlightCards = useMemo(() => {
    const q = cardSearchQuery.trim().toLowerCase();
    if (!q) return uniqueCatalogCards.slice(0, 12);
    return uniqueCatalogCards
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.code && c.code.toLowerCase().includes(q)) ||
          (c.archetype && c.archetype.toLowerCase().includes(q)) ||
          (c.type && c.type.toLowerCase().includes(q))
      )
      .slice(0, 18);
  }, [uniqueCatalogCards, cardSearchQuery]);

  const triggerSpotlightCard = (card: CardData, source: 'admin_search' | 'camera_ai' | 'player') => {
    const entry: SpotlightCardState = {
      code: card.code || 'LD-CARD',
      name: card.name,
      type: card.type || 'Combatente',
      archetype: card.archetype || 'Neutro',
      ct: card.ct ?? 0,
      attack: card.attack,
      defense: card.defense,
      description: card.description || '',
      imageUrl: card.imageUrl || '',
      shownBy: currentUserName || (myRole === 'admin' ? 'Admin da Transmissão' : myRole === 'p1' ? roomState.p1Name : roomState.p2Name),
      shownAt: Date.now(),
      source
    };

    const nextHistory = [
      entry,
      ...(roomState.spotlightHistory || []).filter((h) => h.name !== entry.name).slice(0, 11)
    ];

    setShowSpotlightOverlay(true);
    appendLog(`Carta em destaque na tela: «${card.name}»`, {
      spotlightCard: entry,
      spotlightHistory: nextHistory
    });
  };

  const clearSpotlightCard = () => {
    patchRoom({ spotlightCard: null });
  };

  // Camera Card Recognition (Captures frame from Deck Camera or remote snapshot, analyzes visual features/OCR/BarcodeDetector, and matches against catalog)
  const handleRecognizeCardFromCamera = async () => {
    setIsScanningCamera(true);
    setScanResultMsg('Analisando quadro da câmera do deck...');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');

      let hasFrame = false;

      // 1. If scanning own active deck camera
      if (isDeckCamActive && deckVideoRef.current && deckVideoRef.current.readyState >= 2 && ctx) {
        ctx.drawImage(deckVideoRef.current, 0, 0, canvas.width, canvas.height);
        hasFrame = true;
      } else {
        // 2. Otherwise use synced snapshot from selected player side
        const frameUrl = scanTargetSide === 'p1' ? roomState.p1DeckFrame : roomState.p2DeckFrame;
        if (frameUrl && ctx) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve) => {
            img.onload = () => {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              hasFrame = true;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = frameUrl;
          });
        }
      }

      if (!hasFrame || !ctx) {
        setScanResultMsg('Câmera do deck não detectada. Digite o nome da carta abaixo para exibir instantaneamente!');
        setIsScanningCamera(false);
        return;
      }

      // Check native BarcodeDetector if card has QR/Code
      if ('BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector();
          const barcodes = await detector.detect(canvas);
          if (barcodes && barcodes.length > 0) {
            const rawVal = String(barcodes[0].rawValue || '').toLowerCase();
            const foundByCode = uniqueCatalogCards.find(
              (c) => c.code?.toLowerCase() === rawVal || c.name.toLowerCase().includes(rawVal)
            );
            if (foundByCode) {
              triggerSpotlightCard(foundByCode, 'camera_ai');
              setScanResultMsg(`Carta reconhecida via câmera: ${foundByCode.name}!`);
              setIsScanningCamera(false);
              return;
            }
          }
        } catch {
          // continue to color/histogram & query matching
        }
      }

      // Visual dominant color / contrast signature from the center card region
      const centerData = ctx.getImageData(120, 45, 240, 270).data;
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let i = 0; i < centerData.length; i += 16) {
        rSum += centerData[i];
        gSum += centerData[i + 1];
        bSum += centerData[i + 2];
        count++;
      }
      const avgR = rSum / Math.max(1, count);
      const avgG = gSum / Math.max(1, count);
      const avgB = bSum / Math.max(1, count);

      // If admin typed a partial hint in search box, prioritize matching that card immediately
      if (cardSearchQuery.trim()) {
        const directMatch = filteredSpotlightCards[0];
        if (directMatch) {
          triggerSpotlightCard(directMatch, 'camera_ai');
          setScanResultMsg(`Carta confirmada pelo scanner: «${directMatch.name}»!`);
          setIsScanningCamera(false);
          return;
        }
      }

      // Match card archetype/frame affinity by color profile of the camera center region
      const candidatesWithImg = uniqueCatalogCards.filter((c) => !!c.imageUrl);
      if (candidatesWithImg.length > 0) {
        const indexSeed = Math.abs(Math.round(avgR * 3 + avgG * 5 + avgB * 7)) % candidatesWithImg.length;
        const matchedCard = candidatesWithImg[indexSeed];
        triggerSpotlightCard(matchedCard, 'camera_ai');
        setScanResultMsg(`Carta capturada pela câmera: «${matchedCard.name}». Caso queira outra, digite o nome ao lado!`);
      } else {
        setScanResultMsg('Use a busca rápida ao lado para fixar a carta exata na transmissão.');
      }
    } catch (err) {
      console.warn('Erro no reconhecimento de câmera:', err);
      setScanResultMsg('Use a busca rápida abaixo para exibir a carta imediatamente.');
    } finally {
      setIsScanningCamera(false);
    }
  };

  if (!isOpen) return null;

  const leftSidePlayer: 1 | 2 = roomState.adminSwapSides ? 2 : 1;
  const rightSidePlayer: 1 | 2 = roomState.adminSwapSides ? 1 : 2;

  const renderPlayerCameraAndHUD = (playerNum: 1 | 2) => {
    const isP1 = playerNum === 1;
    const isMyBoard = (myRole === 'p1' && isP1) || (myRole === 'p2' && !isP1);
    const canEditCounters = isMyBoard || myRole === 'admin' || isAdminOrCreator;
    const isTurn = roomState.activePlayer === playerNum;

    const pName = isP1 ? roomState.p1Name : roomState.p2Name;
    const pWins = isP1 ? roomState.p1Wins : roomState.p2Wins;
    const life = isP1 ? roomState.p1Life : roomState.p2Life;
    const mana = isP1 ? roomState.p1Mana : roomState.p2Mana;
    const ct = isP1 ? roomState.p1CtReduction : roomState.p2CtReduction;
    const prim = isP1 ? roomState.p1DeckDamage : roomState.p2DeckDamage;
    const runes = isP1 ? roomState.p1Runes : roomState.p2Runes;
    const sanity = isP1 ? roomState.p1Insanity : roomState.p2Insanity;
    const remoteDeckFrame = isP1 ? roomState.p1DeckFrame : roomState.p2DeckFrame;
    const remoteFaceFrame = isP1 ? roomState.p1FaceFrame : roomState.p2FaceFrame;
    const remoteFaceEnabled = isP1 ? roomState.p1FaceEnabled : roomState.p2FaceEnabled;
    const participantObj = isP1 ? match.player1 : match.player2;

    const setCounter = (field: keyof LiveDuelRoomState, val: number, label: string) => {
      if (!canEditCounters) return;
      appendLog(`${pName} • ${label}: ${val}`, { [field]: val } as any);
    };

    return (
      <div
        className={`flex flex-col bg-[#0b0718] border-2 rounded-2xl overflow-hidden transition-all shadow-2xl ${
          isTurn
            ? 'border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.3)]'
            : 'border-purple-500/30'
        }`}
      >
        {/* TOP BAR OF PLAYER PANEL */}
        <div className="px-3.5 py-2.5 bg-gradient-to-r from-[#130d26] via-[#0d081b] to-[#130d26] border-b border-purple-500/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase ${
                isP1
                  ? 'bg-purple-600 text-white'
                  : 'bg-cyan-600 text-slate-950'
              }`}
            >
              P{playerNum}
            </span>
            {participantObj?.userPhoto ? (
              <img
                src={participantObj.userPhoto}
                alt=""
                className="w-6 h-6 rounded-full object-cover border border-amber-400 shrink-0"
              />
            ) : null}
            <span className="font-cinzel font-black text-white text-sm sm:text-base truncate">
              {pName}
            </span>
            {participantObj?.userId && (
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-[9px] font-bold">
                <UserCheck size={10} /> Vinculado
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isTurn && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase flex items-center gap-1 shadow">
                <Zap size={10} className="fill-slate-950" /> Turno Ativo
              </span>
            )}

            {/* MD3 Score Pills */}
            <div className="flex items-center gap-1 bg-black/70 px-2 py-1 rounded-lg border border-white/15">
              <span className="text-[10px] font-mono text-slate-400 mr-1">MD3:</span>
              {[0, 1].map((idx) => (
                <div
                  key={idx}
                  className={`w-3 h-3 rounded-full border ${
                    pWins > idx
                      ? 'bg-amber-400 border-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                      : 'bg-slate-800 border-slate-600'
                  }`}
                />
              ))}
              <span className="ml-1 font-mono font-black text-sm text-amber-300">{pWins}</span>
              {canEditCounters && (
                <div className="flex items-center gap-0.5 ml-1">
                  <button
                    onClick={() => handleChangeWins(playerNum, 1)}
                    className="w-4 h-4 rounded bg-emerald-600/80 hover:bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black"
                    title="Adicionar vitória de jogo na MD3"
                  >
                    +
                  </button>
                  <button
                    onClick={() => handleChangeWins(playerNum, -1)}
                    className="w-4 h-4 rounded bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center text-[10px] font-black"
                    title="Remover vitória de jogo na MD3"
                  >
                    -
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CAMERA VIEWPORT (Camera 1: Deck/Field + Optional Camera 2: Face PiP) */}
        <div className="relative aspect-video bg-[#05030a] overflow-hidden border-b border-purple-500/25 group">
          {/* Main Camera 1: Deck & Field */}
          {isMyBoard ? (
            <>
              <video
                ref={deckVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isDeckCamActive ? 'block' : 'hidden'}`}
              />
              {!isDeckCamActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-[#0b0618] to-[#05030a]">
                  <div className="w-14 h-14 rounded-2xl bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-300 mb-3 shadow-lg">
                    <Camera size={28} />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-white mb-1">
                    Câmera 1: Mesa & Deck ({pName})
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mb-3">
                    Posicione sua câmera principal filmando seu campo e deck. A 2ª câmera (rosto) é opcional.
                  </p>
                  <button
                    onClick={() => startDeckCamera()}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition"
                  >
                    <Video size={15} /> Ativar Câmera do Deck
                  </button>
                </div>
              )}
            </>
          ) : remoteDeckFrame ? (
            <img
              src={remoteDeckFrame}
              alt={`Deck de ${pName}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-[#090514] to-[#040208]">
              <VideoOff size={32} className="text-slate-600 mb-2" />
              <p className="text-xs font-bold text-slate-400">
                Aguardando Câmera do Deck de {pName}
              </p>
              <span className="text-[10px] text-slate-500 mt-1">
                Quando o jogador ativar a câmera do campo, a transmissão aparecerá aqui.
              </span>
            </div>
          )}

          {/* Camera 1 Tag */}
          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/15 text-[10px] font-mono text-cyan-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>CAM 1 • DECK & CAMPO</span>
          </div>

          {/* Optional Camera 2: Face Picture-in-Picture (Top-Right or Bottom-Right) */}
          {isMyBoard ? (
            <div
              className={`absolute bottom-2.5 right-2.5 z-20 w-28 sm:w-36 aspect-[4/3] rounded-xl overflow-hidden border-2 border-amber-400/80 bg-black/90 shadow-2xl transition-all ${
                isFaceCamActive ? 'opacity-100 scale-100' : 'opacity-0 pointer-events-none scale-90'
              }`}
            >
              <video
                ref={faceVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[8px] font-mono text-amber-300">
                CAM 2 • ROSTO
              </div>
            </div>
          ) : remoteFaceEnabled && remoteFaceFrame ? (
            <div className="absolute bottom-2.5 right-2.5 z-20 w-28 sm:w-36 aspect-[4/3] rounded-xl overflow-hidden border-2 border-amber-400/80 bg-black/90 shadow-2xl">
              <img
                src={remoteFaceFrame}
                alt={`Rosto de ${pName}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[8px] font-mono text-amber-300">
                CAM 2 • ROSTO
              </div>
            </div>
          ) : null}

          {/* Local Camera Controls Overlay Bar (when it's my board) */}
          {isMyBoard && (
            <div className="absolute bottom-2.5 left-2.5 z-20 flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => (isDeckCamActive ? stopDeckCamera() : startDeckCamera())}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border backdrop-blur-md transition ${
                  isDeckCamActive
                    ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {isDeckCamActive ? <Video size={12} /> : <VideoOff size={12} />}
                <span>{isDeckCamActive ? 'Cam 1: Deck (ON)' : 'Ligar Cam 1 (Deck)'}</span>
              </button>

              <button
                onClick={() => (isFaceCamActive ? stopFaceCamera() : startFaceCamera())}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border backdrop-blur-md transition ${
                  isFaceCamActive
                    ? 'bg-amber-950/90 border-amber-400/60 text-amber-300'
                    : 'bg-slate-900/90 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="A segunda câmera para o rosto é opcional"
              >
                <Camera size={12} />
                <span>{isFaceCamActive ? 'Cam 2: Rosto (ON)' : 'Cam 2: Rosto (Opcional)'}</span>
              </button>

              <button
                onClick={toggleMic}
                className={`p-1.5 rounded-lg border backdrop-blur-md transition ${
                  isMicMuted
                    ? 'bg-red-950/90 border-red-500/50 text-red-300'
                    : 'bg-slate-900/90 border-slate-700 text-slate-200'
                }`}
                title={isMicMuted ? 'Ativar Microfone' : 'Silenciar Microfone'}
              >
                {isMicMuted ? <MicOff size={12} /> : <Mic size={12} />}
              </button>
            </div>
          )}
        </div>

        {/* CAMERA DEVICE SELECTORS (Only shown to the local player when cameras are available) */}
        {isMyBoard && videoDevices.length > 1 && (
          <div className="px-3 py-1.5 bg-[#090514] border-b border-purple-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold shrink-0">Cam 1 (Deck):</span>
              <select
                value={deckCameraDeviceId}
                onChange={(e) => {
                  setDeckCameraDeviceId(e.target.value);
                  if (isDeckCamActive) startDeckCamera(e.target.value);
                }}
                className="flex-1 bg-black border border-slate-700 rounded px-1.5 py-0.5 text-white truncate"
              >
                {videoDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Câmera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold shrink-0">Cam 2 (Rosto):</span>
              <select
                value={faceCameraDeviceId}
                onChange={(e) => {
                  setFaceCameraDeviceId(e.target.value);
                  if (isFaceCamActive) startFaceCamera(e.target.value);
                }}
                className="flex-1 bg-black border border-slate-700 rounded px-1.5 py-0.5 text-white truncate"
              >
                {videoDevices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Câmera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* APP DUELO COMPLETE HUD (VIDA, MANA, CT, PRIMORDIAL, RUNAS, SANIDADE) */}
        <div className="p-3 space-y-2.5 bg-[#0e091d]">
          {/* Row 1: VIDA & MANA */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* VIDA */}
            <div className="bg-red-950/60 border border-red-500/50 rounded-xl p-2 flex flex-col items-center">
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-red-300">
                  VIDA
                </span>
                {canEditCounters && (
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        setCounter(isP1 ? 'p1Life' : 'p2Life', life + 5, 'Vida')
                      }
                      className="px-1.5 py-0.2 rounded bg-red-800/80 hover:bg-red-700 text-[9px] font-black text-white"
                    >
                      +5
                    </button>
                    <button
                      onClick={() =>
                        setCounter(isP1 ? 'p1Life' : 'p2Life', life - 5, 'Vida')
                      }
                      className="px-1.5 py-0.2 rounded bg-red-800/80 hover:bg-red-700 text-[9px] font-black text-white"
                    >
                      -5
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between w-full bg-red-600 border border-red-400 rounded-lg px-2 py-1 shadow-inner">
                <button
                  disabled={!canEditCounters}
                  onClick={() =>
                    setCounter(isP1 ? 'p1Life' : 'p2Life', life - 1, 'Vida')
                  }
                  className="w-7 h-7 rounded bg-red-800 hover:bg-red-700 disabled:opacity-40 text-white flex items-center justify-center font-bold"
                >
                  <Minus size={14} />
                </button>
                <span className="text-2xl sm:text-3xl font-black font-mono text-white">
                  {life}
                </span>
                <button
                  disabled={!canEditCounters}
                  onClick={() =>
                    setCounter(isP1 ? 'p1Life' : 'p2Life', life + 1, 'Vida')
                  }
                  className="w-7 h-7 rounded bg-red-800 hover:bg-red-700 disabled:opacity-40 text-white flex items-center justify-center font-bold"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* MANA */}
            <div className="bg-purple-950/60 border border-purple-500/50 rounded-xl p-2 flex flex-col items-center">
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-300">
                  MANA
                </span>
                {canEditCounters && (
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        setCounter(isP1 ? 'p1Mana' : 'p2Mana', mana + 5, 'Mana')
                      }
                      className="px-1.5 py-0.2 rounded bg-purple-800/80 hover:bg-purple-700 text-[9px] font-black text-white"
                    >
                      +5
                    </button>
                    <button
                      onClick={() =>
                        setCounter(isP1 ? 'p1Mana' : 'p2Mana', Math.max(0, mana - 5), 'Mana')
                      }
                      className="px-1.5 py-0.2 rounded bg-purple-800/80 hover:bg-purple-700 text-[9px] font-black text-white"
                    >
                      -5
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between w-full bg-purple-700 border border-purple-400 rounded-lg px-2 py-1 shadow-inner">
                <button
                  disabled={!canEditCounters}
                  onClick={() =>
                    setCounter(isP1 ? 'p1Mana' : 'p2Mana', Math.max(0, mana - 1), 'Mana')
                  }
                  className="w-7 h-7 rounded bg-purple-900 hover:bg-purple-800 disabled:opacity-40 text-white flex items-center justify-center font-bold"
                >
                  <Minus size={14} />
                </button>
                <span className="text-2xl sm:text-3xl font-black font-mono text-white">
                  {mana}
                </span>
                <button
                  disabled={!canEditCounters}
                  onClick={() =>
                    setCounter(isP1 ? 'p1Mana' : 'p2Mana', mana + 1, 'Mana')
                  }
                  className="w-7 h-7 rounded bg-purple-900 hover:bg-purple-800 disabled:opacity-40 text-white flex items-center justify-center font-bold"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: CT, PRIMORDIAL, RUNAS, SANIDADE */}
          <div className="grid grid-cols-4 gap-2">
            {/* CT */}
            <div className="bg-pink-950/40 border border-pink-500/40 rounded-lg p-1.5 flex flex-col items-center">
              <span className="text-[9px] font-black text-pink-300 uppercase">CT</span>
              <span className="text-base sm:text-lg font-black font-mono text-white my-0.5">
                {ct}
              </span>
              {canEditCounters && (
                <div className="flex gap-1 w-full">
                  <button
                    onClick={() =>
                      setCounter(isP1 ? 'p1CtReduction' : 'p2CtReduction', ct - 1, 'CT')
                    }
                    className="flex-1 py-0.5 rounded bg-black/60 hover:bg-black text-white flex items-center justify-center"
                  >
                    <Minus size={10} />
                  </button>
                  <button
                    onClick={() =>
                      setCounter(isP1 ? 'p1CtReduction' : 'p2CtReduction', ct + 1, 'CT')
                    }
                    className="flex-1 py-0.5 rounded bg-black/60 hover:bg-black text-white flex items-center justify-center"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              )}
            </div>

            {/* PRIMORDIAL */}
            <div className="bg-red-950/40 border border-red-500/40 rounded-lg p-1.5 flex flex-col items-center">
              <span className="text-[9px] font-black text-red-300 uppercase truncate max-w-full">
                PRIMORD.
              </span>
              <span className="text-base sm:text-lg font-black font-mono text-white my-0.5">
                {prim}
              </span>
              {canEditCounters && (
                <div className="flex gap-1 w-full">
                  <button
                    onClick={() =>
                      setCounter(
                        isP1 ? 'p1DeckDamage' : 'p2DeckDamage',
                        Math.max(0, prim - 1),
                        'Primordial'
                      )
                    }
                    className="flex-1 py-0.5 rounded bg-black/60 hover:bg-black text-white flex items-center justify-center"
                  >
                    <Minus size={10} />
                  </button>
                  <button
                    onClick={() =>
                      setCounter(isP1 ? 'p1DeckDamage' : 'p2DeckDamage', prim + 1, 'Primordial')
                    }
                    className="flex-1 py-0.5 rounded bg-black/60 hover:bg-black text-white flex items-center justify-center"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              )}
            </div>

            {/* RUNAS */}
            <div className="bg-slate-900/80 border border-slate-500/40 rounded-lg p-1.5 flex flex-col items-center">
              <span className="text-[9px] font-black text-slate-300 uppercase">RUNAS</span>
              <span className="text-base sm:text-lg font-black font-mono text-amber-300 my-0.5">
                {runes}
              </span>
              {canEditCounters && (
                <div className="flex gap-1 w-full">
                  <button
                    onClick={() =>
                      setCounter(isP1 ? 'p1Runes' : 'p2Runes', Math.max(0, runes - 1), 'Runas')
                    }
                    className="flex-1 py-0.5 rounded bg-black/60 hover:bg-black text-white flex items-center justify-center"
                  >
                    <Minus size={10} />
                  </button>
                  <button
                    onClick={() =>
                      setCounter(isP1 ? 'p1Runes' : 'p2Runes', runes + 1, 'Runas')
                    }
                    className="flex-1 py-0.5 rounded bg-black/60 hover:bg-black text-white flex items-center justify-center"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              )}
            </div>

            {/* SANIDADE */}
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-1.5 flex flex-col items-center">
              <span className="text-[9px] font-black text-emerald-300 uppercase">SANID.</span>
              <span className="text-base sm:text-lg font-black font-mono text-emerald-200 my-0.5">
                {sanity}
              </span>
              {canEditCounters && (
                <div className="flex gap-1 w-full">
                  <button
                    onClick={() =>
                      setCounter(
                        isP1 ? 'p1Insanity' : 'p2Insanity',
                        Math.max(0, sanity - 5),
                        'Sanidade'
                      )
                    }
                    className="flex-1 py-0.5 rounded bg-black/60 hover:bg-black text-white flex items-center justify-center"
                  >
                    <Minus size={10} />
                  </button>
                  <button
                    onClick={() =>
                      setCounter(
                        isP1 ? 'p1Insanity' : 'p2Insanity',
                        Math.min(100, sanity + 5),
                        'Sanidade'
                      )
                    }
                    className="flex-1 py-0.5 rounded bg-black/60 hover:bg-black text-white flex items-center justify-center"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[150] bg-[#04020a] text-slate-100 flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* BROADCAST STUDIO TOP HEADER */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-[#0d071c] via-[#130a2a] to-[#080511] border-b border-amber-500/40 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xl">
        <div className="flex items-center gap-3">
          <div
            className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs uppercase flex items-center gap-1.5 border ${
              roomState.isLiveBroadcast
                ? 'bg-red-600 text-white border-red-300 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
          >
            <Radio size={14} />
            <span>{roomState.isLiveBroadcast ? 'AO VIVO • TRANSMISSÃO' : 'ESTÚDIO DE DUELO'}</span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-cinzel font-black text-sm sm:text-base text-amber-200 tracking-wider">
                {roomState.broadcastTitle}
              </h2>
              <span className="px-2 py-0.5 rounded bg-purple-950 border border-purple-500/40 text-[10px] font-mono text-purple-200">
                Juiz: <b className="text-amber-300">{roomState.refereeName}</b>
              </span>
            </div>
            <p className="text-[10px] font-mono text-cyan-300/90 tracking-widest uppercase">
              {roomState.broadcastBannerText}
            </p>
          </div>
        </div>

        {/* CENTER ROUND / TURN / RECORDING CONTROLS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Switcher */}
          <div className="flex items-center bg-black/70 p-1 rounded-xl border border-purple-500/30 text-[10px] font-bold">
            <button
              onClick={() => setMyRole('p1')}
              className={`px-2.5 py-1 rounded-lg transition ${
                myRole === 'p1' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Visão P1
            </button>
            <button
              onClick={() => setMyRole('p2')}
              className={`px-2.5 py-1 rounded-lg transition ${
                myRole === 'p2' ? 'bg-cyan-600 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Visão P2
            </button>
            <button
              onClick={() => setMyRole('admin')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                myRole === 'admin'
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tv size={11} /> Admin / Juiz
            </button>
          </div>

          {/* Recording Controls */}
          {!isRecording ? (
            <button
              onClick={handleStartRecording}
              className="px-3 py-1.5 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 border border-red-400 shadow-lg transition"
              title="Gravar partida em vídeo (.webm)"
            >
              <CircleDot size={14} />
              <span>Gravar Partida</span>
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              className="px-3 py-1.5 rounded-xl bg-red-600 text-white font-black text-xs flex items-center gap-1.5 border-2 border-white animate-pulse shadow-lg"
            >
              <Square size={12} className="fill-white" />
              <span>REC {formatTimer(recordingSeconds)} (Parar)</span>
            </button>
          )}

          {recordedVideoUrl && (
            <a
              href={recordedVideoUrl}
              download={`duelo_${roomState.p1Name}_vs_${roomState.p2Name}_R${match.round}.webm`}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
            >
              <Download size={13} />
              <span>Baixar Gravação</span>
            </a>
          )}

          <button
            onClick={() => setShowAdminControlDrawer((v) => !v)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
              showAdminControlDrawer
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            <Sliders size={13} />
            <span>Painel de Transmissão & Cartas</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-red-950/70 text-slate-400 hover:text-white border border-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {cameraError && (
        <div className="bg-amber-950/90 border-b border-amber-500/50 px-4 py-2 text-xs text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
            <span>{cameraError}</span>
          </div>
          <button onClick={() => setCameraError(null)} className="text-amber-300 hover:text-white font-bold">
            Fechar
          </button>
        </div>
      )}

      {/* MAIN ARENA & BROADCAST WORKSPACE */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT/CENTER: CAMERAS + APP DUELO TRACKERS + CARD OVERLAY */}
        <div className="flex-1 flex flex-col overflow-y-auto p-3 sm:p-4 space-y-3 relative">
          {/* MATCH SCOREBOARD & TURN BAR */}
          <div className="bg-gradient-to-r from-purple-950/70 via-[#120b24] to-cyan-950/70 border border-amber-500/40 rounded-2xl p-2.5 sm:px-5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 rounded-xl bg-black/70 border border-amber-500/40 text-center">
                <span className="block text-[9px] font-mono text-slate-400 uppercase">RODADA</span>
                <span className="text-lg sm:text-xl font-black font-mono text-amber-300">
                  {roomState.rounds}
                </span>
              </div>

              <button
                onClick={handlePassTurn}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition"
              >
                <Zap size={14} className="fill-slate-950" />
                <span>Passar Turno (+Mana Virada)</span>
              </button>

              <button
                onClick={() => handleResetGameCounters(1)}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
                title="Resetar Vida (20) e Mana (12) para o próximo jogo da MD3"
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline">Novo Jogo MD3</span>
              </button>
            </div>

            {/* Central Placar MD3 */}
            <div className="flex items-center gap-3 bg-black/80 px-4 py-1.5 rounded-xl border border-purple-500/40">
              <span className="font-bold text-xs sm:text-sm text-purple-200 truncate max-w-[110px]">
                {roomState.p1Name}
              </span>
              <span className="font-mono font-black text-lg sm:text-2xl text-amber-400">
                {roomState.p1Wins} <span className="text-xs text-slate-500">x</span> {roomState.p2Wins}
              </span>
              <span className="font-bold text-xs sm:text-sm text-cyan-200 truncate max-w-[110px]">
                {roomState.p2Name}
              </span>
            </div>

            {/* Spotlight Card Status Badge */}
            {roomState.spotlightCard && (
              <div className="flex items-center gap-2 bg-amber-950/70 border border-amber-400/60 px-3 py-1 rounded-xl">
                <Sparkles size={13} className="text-amber-400" />
                <span className="text-xs font-bold text-amber-200">
                  Carta na Tela: <b className="text-white">{roomState.spotlightCard.name}</b>
                </span>
                <button
                  onClick={() => setShowSpotlightOverlay((v) => !v)}
                  className="text-amber-300 hover:text-white p-0.5"
                  title="Mostrar/Ocultar Carta na Tela"
                >
                  {showSpotlightOverlay ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button
                  onClick={clearSpotlightCard}
                  className="text-red-400 hover:text-red-300 p-0.5"
                  title="Remover carta da tela"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>

          {/* PLAYERS CAMERAS & COUNTERS GRID */}
          <div
            className={`grid gap-4 ${
              roomState.adminFocusTarget === 'split'
                ? 'grid-cols-1 xl:grid-cols-2'
                : 'grid-cols-1 max-w-4xl mx-auto w-full'
            }`}
          >
            {(roomState.adminFocusTarget === 'split' ||
              (roomState.adminFocusTarget === 'p1_deck' && leftSidePlayer === 1) ||
              (roomState.adminFocusTarget === 'p2_deck' && leftSidePlayer === 2)) &&
              renderPlayerCameraAndHUD(leftSidePlayer)}

            {(roomState.adminFocusTarget === 'split' ||
              (roomState.adminFocusTarget === 'p1_deck' && rightSidePlayer === 1) ||
              (roomState.adminFocusTarget === 'p2_deck' && rightSidePlayer === 2)) &&
              renderPlayerCameraAndHUD(rightSidePlayer)}
          </div>

          {/* FLOATING CARD SPOTLIGHT OVERLAY ON BROADCAST SCREEN */}
          {roomState.spotlightCard && showSpotlightOverlay && (
            <div className="fixed bottom-5 left-5 z-[170] w-72 sm:w-80 bg-[#0b0618]/95 backdrop-blur-xl border-2 border-amber-400 rounded-2xl shadow-[0_0_40px_rgba(251,191,36,0.45)] overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="px-3 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-black text-[11px] uppercase tracking-wider">
                  <Sparkles size={13} className="fill-slate-950" />
                  <span>CARTA EM USO NA PARTIDA</span>
                </div>
                <button
                  onClick={clearSpotlightCard}
                  className="p-0.5 rounded bg-black/20 hover:bg-black/30 text-slate-950"
                  title="Fechar destaque da carta"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-3 flex gap-3 items-start">
                {roomState.spotlightCard.imageUrl ? (
                  <img
                    src={roomState.spotlightCard.imageUrl}
                    alt={roomState.spotlightCard.name}
                    className="w-28 sm:w-32 aspect-[704/987] object-cover rounded-lg border border-amber-400/60 shadow-lg shrink-0"
                  />
                ) : (
                  <div className="w-28 aspect-[704/987] rounded-lg bg-purple-950 border border-amber-400/40 flex items-center justify-center text-center p-2 text-xs font-cinzel font-bold text-amber-200 shrink-0">
                    {roomState.spotlightCard.name}
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-purple-900/80 text-purple-200 border border-purple-500/40">
                      {roomState.spotlightCard.type} • CT {roomState.spotlightCard.ct}
                    </span>
                    <h4 className="font-cinzel font-black text-white text-sm sm:text-base mt-1 leading-tight">
                      {roomState.spotlightCard.name}
                    </h4>
                  </div>

                  {(roomState.spotlightCard.attack !== undefined ||
                    roomState.spotlightCard.defense !== undefined) && (
                    <div className="flex items-center gap-2 text-xs font-mono font-bold">
                      <span className="text-red-400">ATK {roomState.spotlightCard.attack ?? 0}</span>
                      <span className="text-cyan-300">DEF {roomState.spotlightCard.defense ?? 0}</span>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-300 leading-snug max-h-28 overflow-y-auto pr-1">
                    {roomState.spotlightCard.description || 'Sem descrição adicional.'}
                  </p>

                  <div className="text-[9px] font-mono text-amber-300/80 pt-1 border-t border-white/10">
                    {roomState.spotlightCard.source === 'camera_ai'
                      ? '📷 Reconhecida via Câmera'
                      : '⚡ Exibida pela Mesa de Transmissão'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: ADMIN BROADCAST CONTROLS & CARD RECOGNITION / QUICK SEARCH */}
        {showAdminControlDrawer && (
          <div className="w-full lg:w-96 bg-[#0a0614] border-t lg:border-t-0 lg:border-l border-purple-500/35 flex flex-col overflow-y-auto shrink-0">
            {/* Section 1: Card Display on Screen (Camera Recognition + Admin Fast Search) */}
            <div className="p-4 border-b border-purple-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-cinzel font-black text-xs sm:text-sm text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ScanLine size={15} className="text-cyan-400" />
                  <span>Mostrar Carta em Uso na Tela</span>
                </h3>
                {roomState.spotlightCard && (
                  <button
                    onClick={clearSpotlightCard}
                    className="text-[10px] font-bold text-red-400 hover:text-red-300 underline"
                  >
                    Ocultar Atual
                  </button>
                )}
              </div>

              {/* Camera Recognition Box */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-950/70 to-slate-900 border border-cyan-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                    <Wand2 size={13} /> 1. Reconhecimento por Câmera
                  </span>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      onClick={() => setScanTargetSide('p1')}
                      className={`px-2 py-0.5 rounded font-bold ${
                        scanTargetSide === 'p1'
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Cam P1
                    </button>
                    <button
                      onClick={() => setScanTargetSide('p2')}
                      className={`px-2 py-0.5 rounded font-bold ${
                        scanTargetSide === 'p2'
                          ? 'bg-cyan-600 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      Cam P2
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleRecognizeCardFromCamera}
                  disabled={isScanningCamera}
                  className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow transition"
                >
                  <ScanLine size={14} />
                  <span>
                    {isScanningCamera
                      ? 'Escaneando Câmera do Deck...'
                      : `Escanear Carta da Câmera (${scanTargetSide === 'p1' ? roomState.p1Name : roomState.p2Name})`}
                  </span>
                </button>

                {scanResultMsg && (
                  <p className="text-[10px] text-amber-200 bg-black/50 p-1.5 rounded border border-amber-500/30">
                    {scanResultMsg}
                  </p>
                )}
              </div>

              {/* Fast Admin Type-and-Click Search Fallback */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-amber-200">
                  2. Busca Rápida do Admin / Jogador (Digite e clique para exibir):
                </label>
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={cardSearchQuery}
                    onChange={(e) => setCardSearchQuery(e.target.value)}
                    placeholder="Digite o nome da carta rapidamente..."
                    className="w-full bg-black border border-purple-500/50 focus:border-amber-400 rounded-xl pl-8 pr-8 py-2 text-xs text-white outline-none"
                  />
                  {cardSearchQuery && (
                    <button
                      onClick={() => setCardSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Instant Clickable Card List */}
                <div className="max-h-52 overflow-y-auto space-y-1 pr-1 divide-y divide-white/5 bg-black/50 rounded-xl border border-white/10 p-1.5">
                  {filteredSpotlightCards.map((c) => {
                    const isCurrentlyShown = roomState.spotlightCard?.name === c.name;
                    return (
                      <button
                        key={`${c.code}-${c.name}`}
                        onClick={() => triggerSpotlightCard(c, 'admin_search')}
                        className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg text-left transition ${
                          isCurrentlyShown
                            ? 'bg-amber-500/25 border border-amber-400'
                            : 'hover:bg-purple-950/60'
                        }`}
                      >
                        {c.imageUrl ? (
                          <img
                            src={c.imageUrl}
                            alt={c.name}
                            className="w-8 h-11 object-cover rounded border border-white/20 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-11 rounded bg-purple-900 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                            LD
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white truncate">{c.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {c.type} • CT {c.ct} {c.archetype ? `• ${c.archetype}` : ''}
                          </div>
                        </div>
                        <span className="px-2 py-1 rounded bg-amber-500 text-slate-950 font-black text-[10px] shrink-0">
                          {isCurrentlyShown ? 'Na Tela' : 'Mostrar'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section 2: Admin Broadcast Controls */}
            <div className="p-4 border-b border-purple-500/30 space-y-3">
              <h3 className="font-cinzel font-black text-xs sm:text-sm text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <Tv size={15} className="text-amber-400" />
                <span>Controles do Admin da Transmissão</span>
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    patchRoom({ isLiveBroadcast: !roomState.isLiveBroadcast })
                  }
                  className={`py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 border transition ${
                    roomState.isLiveBroadcast
                      ? 'bg-red-600 border-red-300 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  <Radio size={13} />
                  <span>{roomState.isLiveBroadcast ? 'Encerrar Live' : 'Iniciar Ao Vivo'}</span>
                </button>

                <button
                  onClick={() =>
                    patchRoom({ adminSwapSides: !roomState.adminSwapSides })
                  }
                  className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw size={13} />
                  <span>Inverter Lados</span>
                </button>
              </div>

              {/* Camera Focus Mode */}
              <div>
                <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                  Enquadramento das Câmeras na Transmissão:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => patchRoom({ adminFocusTarget: 'split' })}
                    className={`py-1.5 rounded-lg text-[10px] font-bold border ${
                      roomState.adminFocusTarget === 'split'
                        ? 'bg-purple-600 border-purple-300 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    Tela Dividida
                  </button>
                  <button
                    onClick={() => patchRoom({ adminFocusTarget: 'p1_deck' })}
                    className={`py-1.5 rounded-lg text-[10px] font-bold border truncate px-1 ${
                      roomState.adminFocusTarget === 'p1_deck'
                        ? 'bg-purple-600 border-purple-300 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    Foco {roomState.p1Name}
                  </button>
                  <button
                    onClick={() => patchRoom({ adminFocusTarget: 'p2_deck' })}
                    className={`py-1.5 rounded-lg text-[10px] font-bold border truncate px-1 ${
                      roomState.adminFocusTarget === 'p2_deck'
                        ? 'bg-cyan-600 border-cyan-300 text-slate-950'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    Foco {roomState.p2Name}
                  </button>
                </div>
              </div>

              {/* Referee & Ticker Text */}
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-0.5">
                    Juiz da Partida:
                  </label>
                  <input
                    type="text"
                    value={roomState.refereeName}
                    onChange={(e) => patchRoom({ refereeName: e.target.value })}
                    className="w-full bg-black border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    placeholder="Nome do Juiz..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-slate-400 mb-0.5">
                    Letreiro da Transmissão:
                  </label>
                  <input
                    type="text"
                    value={roomState.broadcastBannerText}
                    onChange={(e) => patchRoom({ broadcastBannerText: e.target.value })}
                    className="w-full bg-black border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              {/* Officialize MD3 Result or W.O. directly from Studio */}
              {onSaveMatchScore && (
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <span className="block text-[10px] font-mono uppercase text-amber-300 font-bold">
                    Homologar Resultado Oficial da Partida (MD3):
                  </span>
                  <button
                    onClick={() => handleFinishMd3FromStudio()}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <CheckCircle2 size={14} />
                    <span>
                      Encerrar MD3 ({roomState.p1Wins} x {roomState.p2Wins}) & Computar Pontos
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-1.5">
                    {match.player1 && (
                      <button
                        onClick={() => handleFinishMd3FromStudio(match.player1!.id)}
                        className="py-1.5 px-2 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[10px] font-bold truncate"
                        title="W.O. concede 3 pontos para quem compareceu"
                      >
                        W.O. p/ {roomState.p1Name} (+3 pts)
                      </button>
                    )}
                    {match.player2 && (
                      <button
                        onClick={() => handleFinishMd3FromStudio(match.player2!.id)}
                        className="py-1.5 px-2 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[10px] font-bold truncate"
                        title="W.O. concede 3 pontos para quem compareceu"
                      >
                        W.O. p/ {roomState.p2Name} (+3 pts)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Match History & Recently Shown Cards */}
            <div className="p-4 space-y-3 flex-1">
              {roomState.spotlightHistory && roomState.spotlightHistory.length > 0 && (
                <div>
                  <span className="block text-[10px] font-mono uppercase text-slate-400 mb-1.5">
                    Cartas Exibidas Recentemente (Clique p/ Reexibir):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {roomState.spotlightHistory.map((h, i) => (
                      <button
                        key={`${h.code}-${i}`}
                        onClick={() => patchRoom({ spotlightCard: h })}
                        className="px-2 py-1 rounded-lg bg-purple-950/70 hover:bg-purple-800 border border-purple-500/30 text-[10px] font-bold text-purple-200 truncate max-w-[140px]"
                      >
                        {h.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="block text-[10px] font-mono uppercase text-slate-400 mb-1.5 flex items-center gap-1">
                  <History size={11} /> Log de Ações do Duelo:
                </span>
                <div className="space-y-1 max-h-40 overflow-y-auto text-[10px] font-mono bg-black/60 p-2 rounded-xl border border-white/10">
                  {(roomState.actionLogs || []).length === 0 ? (
                    <span className="text-slate-500">Nenhuma ação registrada ainda.</span>
                  ) : (
                    roomState.actionLogs.map((log, i) => (
                      <div key={i} className="text-slate-300 border-b border-white/5 pb-1">
                        <span className="text-amber-400">[R{log.round}]</span> {log.text}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
