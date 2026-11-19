import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Edit3,
  Save,
  Check,
  X,
  Clock,
  BookOpen,
  Languages,
  Sparkles,
  RotateCcw,
  ChevronRight,
  Search,
  Disc3,
  Eye,
  EyeOff,
  Sliders,
  FileText,
  Users,
  Wand2,
  ArrowUp,
  ArrowDown,
  ListOrdered
} from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { CardData } from '../types';
import { FULL_LIGHT_DARK_TRACKS } from './SpotifySoundtrackSection';

export interface LyricLineItem {
  id: string;
  time: number | null; // Segundos (ex: 14.5). null = ainda não sincronizado
  original: string;
  translation: string;
}

export interface LoreSongData {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  coverUrl: string;
  loreTitle?: string;
  loreContext?: string;
  chronologicalOrder?: number;
  chronologicalEra?: string;
  relatedCharacters?: string[];
  relatedCardIds?: string[];
  lyrics: LyricLineItem[];
  updatedAt?: string;
}

interface LoreMusicSectionProps {
  isAdmin: boolean;
  cards: CardData[];
  onInspectCard?: (card: CardData) => void;
}

const LORE_SONGS_CACHE_KEY = 'ld_cache_loreSongs_v1';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function formatSeconds(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || isNaN(sec) || sec < 0) return '--:--';
  const totalSeconds = Math.max(0, sec);
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((totalSeconds % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

function formatSecondsShort(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || isNaN(sec) || sec < 0) return '0:00';
  const totalSeconds = Math.max(0, Math.floor(sec));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function parseTimeInput(str: string): number | null {
  const clean = str.trim();
  if (!clean || clean === '--:--') return null;
  // Aceita mm:ss.xx ou mm:ss ou segundos puros
  const parts = clean.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseFloat(parts[1].replace(',', '.'));
    if (!isNaN(mins) && !isNaN(secs)) {
      return Math.max(0, Math.round((mins * 60 + secs) * 10) / 10);
    }
  }
  const direct = parseFloat(clean.replace(',', '.'));
  if (!isNaN(direct)) return Math.max(0, Math.round(direct * 10) / 10);
  return null;
}

function extractYouTubeId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch?.[1]) return watchMatch[1];
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch?.[1]) return shortMatch[1];
  const embedMatch = trimmed.match(/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch?.[1]) return embedMatch[1];
  return trimmed;
}

function buildDefaultLoreSongs(): LoreSongData[] {
  return FULL_LIGHT_DARK_TRACKS.map((t, idx) => ({
    id: `song_${t.youtubeId}`,
    videoId: t.youtubeId,
    title: t.title,
    artist: 'Salazar Dias',
    album: 'Light Dark Official Soundtrack',
    duration: t.durationLabel,
    coverUrl: `https://i.ytimg.com/vi/${t.youtubeId}/hqdefault.jpg`,
    loreTitle: '',
    loreContext: '',
    chronologicalOrder: idx + 1,
    chronologicalEra: '',
    relatedCharacters: [],
    relatedCardIds: [],
    lyrics: []
  }));
}

export const LoreMusicSection: React.FC<LoreMusicSectionProps> = ({
  isAdmin,
  cards,
  onInspectCard
}) => {
  const [songs, setSongs] = useState<LoreSongData[]>(() => {
    try {
      const raw = localStorage.getItem(LORE_SONGS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return buildDefaultLoreSongs();
  });

  const [selectedSongId, setSelectedSongId] = useState<string>(() => {
    const initial = buildDefaultLoreSongs();
    return initial[0]?.id || '';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterWithLyricsOnly, setFilterWithLyricsOnly] = useState(false);
  const [sortMode, setSortMode] = useState<'chronological' | 'alphabetical'>('chronological');

  // Modos de visualização da letra para o leitor
  const [lyricDisplayMode, setLyricDisplayMode] = useState<'both' | 'original' | 'translation'>('both');
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [showVideoFrame, setShowVideoFrame] = useState(false);

  // Player YouTube state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Estado de Edição / Sincronização (Admin / Colaborador)
  const [adminMode, setAdminMode] = useState<'none' | 'bulk_lyrics' | 'sync_studio' | 'edit_lore' | 'add_song' | 'chronology'>('none');
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Campos de Edição em Lote (Original + Tradução)
  const [bulkOriginalText, setBulkOriginalText] = useState('');
  const [bulkTranslationText, setBulkTranslationText] = useState('');

  // Cursor de linha no Sincronizador ao Vivo (Tap Sync)
  const [syncCursorIndex, setSyncCursorIndex] = useState(0);

  // Campos de Edição de Lore e Contexto da Música
  const [draftLoreTitle, setDraftLoreTitle] = useState('');
  const [draftLoreContext, setDraftLoreContext] = useState('');
  const [draftSongTitle, setDraftSongTitle] = useState('');
  const [draftSongArtist, setDraftSongArtist] = useState('');
  const [draftRelatedCardIds, setDraftRelatedCardIds] = useState<string[]>([]);
  const [cardSearchTerm, setCardSearchTerm] = useState('');

  // Campos para Adicionar Nova Música
  const [newSongYoutubeUrl, setNewSongYoutubeUrl] = useState('');
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongArtist, setNewSongArtist] = useState('Salazar Dias');
  const [newSongDuration, setNewSongDuration] = useState('3:30');

  const ytPlayerRef = useRef<any>(null);
  const selectedSongRef = useRef<LoreSongData | undefined>(undefined);
  const lyricsScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Carrega dados salvos do Firestore (wbSettings/loreSongs)
  useEffect(() => {
    let mounted = true;
    const loadFromFirestore = async () => {
      try {
        const snap = await getDoc(doc(db, 'wbSettings', 'loreSongs'));
        if (!mounted) return;
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.songs) && data.songs.length > 0) {
            // Mescla com as 22 músicas oficiais para garantir que todas existam
            const savedSongs: LoreSongData[] = data.songs;
            const defaults = buildDefaultLoreSongs();
            const mergedMap = new Map<string, LoreSongData>();
            defaults.forEach((d) => mergedMap.set(d.id, d));
            savedSongs.forEach((s) => {
              const existing = mergedMap.get(s.id);
              mergedMap.set(s.id, {
                ...(existing || {}),
                ...s,
                lyrics: Array.isArray(s.lyrics) ? s.lyrics : []
              });
            });
            // Mantém a ordem salva + quaisquer novas padrões
            const savedOrderIds = savedSongs.map((s) => s.id);
            const ordered: LoreSongData[] = [];
            savedOrderIds.forEach((id) => {
              const item = mergedMap.get(id);
              if (item) {
                ordered.push(item);
                mergedMap.delete(id);
              }
            });
            mergedMap.forEach((item) => ordered.push(item));

            setSongs(ordered);
            try {
              localStorage.setItem(LORE_SONGS_CACHE_KEY, JSON.stringify(ordered));
            } catch {
              // ignore
            }
          }
        }
      } catch (err) {
        console.error('Erro ao carregar músicas da Lore:', err);
      }
    };
    loadFromFirestore();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedSong = useMemo(
    () => songs.find((s) => s.id === selectedSongId) || songs[0],
    [songs, selectedSongId]
  );

  useEffect(() => {
    selectedSongRef.current = selectedSong;
  }, [selectedSong]);

  // Sincroniza rascunhos quando troca de música
  useEffect(() => {
    if (!selectedSong) return;
    setDraftLoreTitle(selectedSong.loreTitle || '');
    setDraftLoreContext(selectedSong.loreContext || '');
    setDraftSongTitle(selectedSong.title || '');
    setDraftSongArtist(selectedSong.artist || '');
    setDraftRelatedCardIds(selectedSong.relatedCardIds || []);
    setBulkOriginalText((selectedSong.lyrics || []).map((l) => l.original).join('\n'));
    setBulkTranslationText((selectedSong.lyrics || []).map((l) => l.translation).join('\n'));
    setSyncCursorIndex(0);
    setCurrentTime(0);
  }, [selectedSong?.id]);

  // Inicializa YouTube IFrame API para o player dedicado da Lore
  useEffect(() => {
    let isMounted = true;

    const initPlayer = () => {
      if (!isMounted || !window.YT || !window.YT.Player) return;
      if (ytPlayerRef.current) return;

      const containerEl = document.getElementById('yt-lore-music-player');
      if (!containerEl) return;

      const initialVideoId = selectedSongRef.current?.videoId || FULL_LIGHT_DARK_TRACKS[0].youtubeId;

      ytPlayerRef.current = new window.YT.Player('yt-lore-music-player', {
        height: '200',
        width: '320',
        videoId: initialVideoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event: any) => {
            if (!isMounted) return;
            setIsPlayerReady(true);
            try {
              event.target.setVolume(volume);
              const dur = event.target.getDuration?.() || 0;
              if (dur > 0) setDurationSec(dur);
            } catch {
              // ignore
            }
          },
          onStateChange: (event: any) => {
            if (!isMounted) return;
            if (event.data === 1) {
              setIsPlaying(true);
              const dur = event.target?.getDuration?.() || 0;
              if (dur > 0) setDurationSec(dur);
            } else if (event.data === 2 || event.data === 0 || event.data === -1 || event.data === 5) {
              setIsPlaying(false);
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      if (!document.getElementById('yt-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
          document.head.appendChild(tag);
        }
      }
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        initPlayer();
      };
      const pollTimer = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(pollTimer);
          initPlayer();
        }
      }, 250);
      return () => {
        isMounted = false;
        clearInterval(pollTimer);
      };
    }

    return () => {
      isMounted = false;
      try {
        if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
          ytPlayerRef.current.destroy();
          ytPlayerRef.current = null;
        }
      } catch {
        // ignore
      }
    };
  }, []);

  // Atualiza o tempo atual (currentTime) a cada 100ms para sincronizar a letra com precisão
  useEffect(() => {
    const interval = setInterval(() => {
      const player = ytPlayerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;
      try {
        const state = player.getPlayerState?.();
        if (state === 1) {
          const t = player.getCurrentTime();
          if (typeof t === 'number' && !isNaN(t)) {
            setCurrentTime(t);
          }
          const d = player.getDuration?.();
          if (typeof d === 'number' && d > 0) {
            setDurationSec(d);
          }
        }
      } catch {
        // ignore
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Quando seleciona outra música, carrega no player
  const handleSelectSong = (song: LoreSongData, autoPlay = false) => {
    setSelectedSongId(song.id);
    setCurrentTime(0);
    const player = ytPlayerRef.current;
    if (player && isPlayerReady) {
      try {
        if (autoPlay && typeof player.loadVideoById === 'function') {
          player.loadVideoById(song.videoId);
          setIsPlaying(true);
        } else if (typeof player.cueVideoById === 'function') {
          player.cueVideoById(song.videoId);
          setIsPlaying(false);
        }
      } catch {
        // ignore
      }
    }
  };

  const togglePlayPause = () => {
    const player = ytPlayerRef.current;
    if (!player || !isPlayerReady) return;
    try {
      const state = player.getPlayerState?.();
      if (state === 1) {
        player.pauseVideo();
        setIsPlaying(false);
      } else {
        player.playVideo();
        setIsPlaying(true);
      }
    } catch {
      // ignore
    }
  };

  const seekToSeconds = (targetSec: number, playImmediately = false) => {
    const clamped = Math.max(0, targetSec);
    setCurrentTime(clamped);
    const player = ytPlayerRef.current;
    if (!player || !isPlayerReady) return;
    try {
      player.seekTo(clamped, true);
      if (playImmediately) {
        player.playVideo();
        setIsPlaying(true);
      }
    } catch {
      // ignore
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    const player = ytPlayerRef.current;
    if (player && isPlayerReady) {
      try {
        if (newVol === 0) {
          player.mute();
        } else {
          player.unMute();
          player.setVolume(newVol);
        }
      } catch {
        // ignore
      }
    }
  };

  const toggleMute = () => {
    const player = ytPlayerRef.current;
    if (!player || !isPlayerReady) return;
    try {
      if (isMuted) {
        player.unMute();
        player.setVolume(volume || 80);
        setIsMuted(false);
      } else {
        player.mute();
        setIsMuted(true);
      }
    } catch {
      // ignore
    }
  };

  // Identifica qual linha da letra está ativa no tempo atual
  const activeLyricIndex = useMemo(() => {
    if (!selectedSong || !selectedSong.lyrics || selectedSong.lyrics.length === 0) return -1;
    let bestIdx = -1;
    let bestTime = -1;
    selectedSong.lyrics.forEach((line, idx) => {
      if (line.time !== null && line.time !== undefined && line.time <= currentTime + 0.15) {
        if (line.time >= bestTime) {
          bestTime = line.time;
          bestIdx = idx;
        }
      }
    });
    return bestIdx;
  }, [selectedSong, currentTime]);

  // Auto-scroll suave até a linha ativa durante a reprodução
  useEffect(() => {
    if (!autoScrollEnabled || adminMode === 'sync_studio') return;
    if (activeLyricIndex < 0 || !selectedSong?.lyrics?.[activeLyricIndex]) return;
    const activeLineId = selectedSong.lyrics[activeLyricIndex].id;
    const el = lineRefs.current[activeLineId];
    const container = lyricsScrollContainerRef.current;
    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offsetInside = elRect.top - containerRect.top + container.scrollTop;
      const targetScroll = offsetInside - container.clientHeight / 2 + el.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  }, [activeLyricIndex, autoScrollEnabled, adminMode, selectedSong?.id]);

  // No modo sync_studio, rola automaticamente para a linha do cursor de sincronização
  useEffect(() => {
    if (adminMode !== 'sync_studio' || !selectedSong?.lyrics?.[syncCursorIndex]) return;
    const targetId = selectedSong.lyrics[syncCursorIndex].id;
    const el = lineRefs.current[targetId];
    const container = lyricsScrollContainerRef.current;
    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offsetInside = elRect.top - containerRect.top + container.scrollTop;
      const targetScroll = offsetInside - container.clientHeight / 2 + el.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  }, [syncCursorIndex, adminMode, selectedSong?.id]);

  // Persistência no Firestore
  const persistSongsToFirestore = async (updatedSongs: LoreSongData[], successMessage = 'Alterações salvas na Lore!') => {
    setSongs(updatedSongs);
    try {
      localStorage.setItem(LORE_SONGS_CACHE_KEY, JSON.stringify(updatedSongs));
    } catch {
      // ignore
    }
    if (!isAdmin) return;
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'wbSettings', 'loreSongs'),
        {
          songs: updatedSongs,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      setSaveFeedback(successMessage);
      setTimeout(() => setSaveFeedback(null), 3200);
    } catch (err) {
      console.error('Erro ao salvar músicas da Lore no Firestore:', err);
      setSaveFeedback('Erro ao salvar na nuvem (salvo localmente).');
      setTimeout(() => setSaveFeedback(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  // Processar letras coladas em lote (Original + Tradução lado a lado)
  const handleApplyBulkLyrics = async () => {
    if (!selectedSong) return;
    const origLines = bulkOriginalText.split('\n');
    const transLines = bulkTranslationText.split('\n');
    const maxLen = Math.max(origLines.length, transLines.length);

    const nextLyrics: LyricLineItem[] = [];
    for (let i = 0; i < maxLen; i++) {
      let rawOrig = (origLines[i] ?? '').trim();
      let rawTrans = (transLines[i] ?? '').trim();

      // Ignora linhas vazias duplas no final se ambas estiverem em branco
      if (!rawOrig && !rawTrans) continue;

      // Suporte opcional a tags [mm:ss.xx] coladas junto com a letra original
      let parsedTime: number | null = selectedSong.lyrics?.[i]?.time ?? null;
      const lrcMatch = rawOrig.match(/^\[(\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\]\s*(.*)$/);
      if (lrcMatch) {
        const t = parseTimeInput(lrcMatch[1]);
        if (t !== null) parsedTime = t;
        rawOrig = lrcMatch[2].trim();
      }

      const lrcTransMatch = rawTrans.match(/^\[(\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\]\s*(.*)$/);
      if (lrcTransMatch) {
        rawTrans = lrcTransMatch[2].trim();
      }

      nextLyrics.push({
        id: selectedSong.lyrics?.[i]?.id || `line_${Date.now()}_${i}`,
        time: parsedTime,
        original: rawOrig,
        translation: rawTrans
      });
    }

    const updatedSongs = songs.map((s) =>
      s.id === selectedSong.id
        ? { ...s, lyrics: nextLyrics, updatedAt: new Date().toISOString() }
        : s
    );

    await persistSongsToFirestore(updatedSongs, 'Letras (Original + Tradução) salvas! Agora você pode sincronizar.');
    setAdminMode('sync_studio');
    setSyncCursorIndex(0);
  };

  // Marcar tempo da linha atual no Sincronizador Ao Vivo (Tap Sync)
  const handleStampCurrentLine = () => {
    if (!selectedSong || !selectedSong.lyrics || selectedSong.lyrics.length === 0) return;
    const targetIdx = Math.min(Math.max(0, syncCursorIndex), selectedSong.lyrics.length - 1);

    const player = ytPlayerRef.current;
    let exactTime = currentTime;
    if (player && typeof player.getCurrentTime === 'function') {
      try {
        const liveT = player.getCurrentTime();
        if (typeof liveT === 'number' && !isNaN(liveT)) {
          exactTime = liveT;
        }
      } catch {
        // ignore
      }
    }

    const stampedTime = Math.max(0, Math.round(exactTime * 10) / 10);

    const updatedLyrics = selectedSong.lyrics.map((line, idx) =>
      idx === targetIdx ? { ...line, time: stampedTime } : line
    );

    const updatedSongs = songs.map((s) =>
      s.id === selectedSong.id ? { ...s, lyrics: updatedLyrics } : s
    );
    setSongs(updatedSongs);

    // Avança automaticamente para a próxima linha
    if (targetIdx < selectedSong.lyrics.length - 1) {
      setSyncCursorIndex(targetIdx + 1);
    }
  };

  // Atalho de teclado Espaço no modo sync_studio para marcar o tempo sem tirar a mão
  useEffect(() => {
    if (adminMode !== 'sync_studio') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleStampCurrentLine();
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setSyncCursorIndex((prev) =>
          Math.min((selectedSong?.lyrics?.length || 1) - 1, prev + 1)
        );
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setSyncCursorIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adminMode, syncCursorIndex, selectedSong, currentTime, songs]);

  const handleAdjustLineTime = (lineIdx: number, deltaSec: number) => {
    if (!selectedSong) return;
    const updatedLyrics = selectedSong.lyrics.map((line, idx) => {
      if (idx !== lineIdx) return line;
      const base = line.time ?? currentTime ?? 0;
      return {
        ...line,
        time: Math.max(0, Math.round((base + deltaSec) * 10) / 10)
      };
    });
    setSongs((prev) =>
      prev.map((s) => (s.id === selectedSong.id ? { ...s, lyrics: updatedLyrics } : s))
    );
  };

  const handleUpdateLineField = (
    lineIdx: number,
    field: 'original' | 'translation' | 'time',
    value: string | number | null
  ) => {
    if (!selectedSong) return;
    const updatedLyrics = selectedSong.lyrics.map((line, idx) =>
      idx === lineIdx ? { ...line, [field]: value } : line
    );
    setSongs((prev) =>
      prev.map((s) => (s.id === selectedSong.id ? { ...s, lyrics: updatedLyrics } : s))
    );
  };

  const handleAddSingleLine = (afterIdx?: number) => {
    if (!selectedSong) return;
    const newLine: LyricLineItem = {
      id: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      time: Math.round(currentTime * 10) / 10,
      original: '',
      translation: ''
    };
    const currentList = [...(selectedSong.lyrics || [])];
    if (afterIdx !== undefined && afterIdx >= 0 && afterIdx < currentList.length) {
      currentList.splice(afterIdx + 1, 0, newLine);
    } else {
      currentList.push(newLine);
    }
    setSongs((prev) =>
      prev.map((s) => (s.id === selectedSong.id ? { ...s, lyrics: currentList } : s))
    );
  };

  const handleRemoveSingleLine = (lineIdx: number) => {
    if (!selectedSong) return;
    const updatedLyrics = selectedSong.lyrics.filter((_, idx) => idx !== lineIdx);
    setSongs((prev) =>
      prev.map((s) => (s.id === selectedSong.id ? { ...s, lyrics: updatedLyrics } : s))
    );
  };

  const handleClearAllTimestamps = () => {
    if (!selectedSong) return;
    const cleared = selectedSong.lyrics.map((l) => ({ ...l, time: null }));
    setSongs((prev) =>
      prev.map((s) => (s.id === selectedSong.id ? { ...s, lyrics: cleared } : s))
    );
    setSyncCursorIndex(0);
  };

  const handleSaveLoreAndContext = async () => {
    if (!selectedSong) return;
    const updatedSongs = songs.map((s) =>
      s.id === selectedSong.id
        ? {
            ...s,
            title: draftSongTitle.trim() || s.title,
            artist: draftSongArtist.trim() || s.artist,
            loreTitle: draftLoreTitle.trim(),
            loreContext: draftLoreContext,
            relatedCardIds: draftRelatedCardIds,
            updatedAt: new Date().toISOString()
          }
        : s
    );
    await persistSongsToFirestore(updatedSongs, 'Contexto e Lore da música salvos com sucesso!');
    setAdminMode('none');
  };

  const handleCreateNewSong = async () => {
    const vid = extractYouTubeId(newSongYoutubeUrl);
    if (!vid || !newSongTitle.trim()) return;
    const newId = `song_${vid}_${Date.now()}`;
    const newEntry: LoreSongData = {
      id: newId,
      videoId: vid,
      title: newSongTitle.trim(),
      artist: newSongArtist.trim() || 'Salazar Dias',
      album: 'Light Dark Official Soundtrack',
      duration: newSongDuration.trim() || '3:30',
      coverUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
      loreTitle: '',
      loreContext: '',
      relatedCharacters: [],
      relatedCardIds: [],
      lyrics: []
    };
    const nextList = [newEntry, ...songs];
    await persistSongsToFirestore(nextList, 'Nova música adicionada à Lore!');
    setNewSongYoutubeUrl('');
    setNewSongTitle('');
    setAdminMode('none');
    handleSelectSong(newEntry, false);
  };

  const handleDeleteSong = async (songId: string) => {
    if (songs.length <= 1) return;
    const nextList = songs
      .filter((s) => s.id !== songId)
      .map((s, idx) => ({ ...s, chronologicalOrder: idx + 1 }));
    await persistSongsToFirestore(nextList, 'Música removida.');
    if (selectedSongId === songId && nextList[0]) {
      handleSelectSong(nextList[0], false);
    }
  };

  // Lista ordenada em Ordem Cronológica da Lore
  const chronologicallySortedSongs = useMemo(() => {
    return [...songs].sort((a, b) => {
      const orderA = a.chronologicalOrder ?? 9999;
      const orderB = b.chronologicalOrder ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return 0;
    });
  }, [songs]);

  // Mover música para cima ou para baixo na Ordem Cronológica
  const handleMoveSongChronology = async (songId: string, direction: -1 | 1, saveImmediately = true) => {
    const ordered = [...chronologicallySortedSongs];
    const currentIdx = ordered.findIndex((s) => s.id === songId);
    if (currentIdx < 0) return;
    const targetIdx = currentIdx + direction;
    if (targetIdx < 0 || targetIdx >= ordered.length) return;

    const temp = ordered[currentIdx];
    ordered[currentIdx] = ordered[targetIdx];
    ordered[targetIdx] = temp;

    const normalized = ordered.map((s, idx) => ({
      ...s,
      chronologicalOrder: idx + 1
    }));

    if (saveImmediately) {
      await persistSongsToFirestore(normalized, 'Ordem cronológica atualizada!');
    } else {
      setSongs(normalized);
    }
  };

  // Definir posição exata (ex: mover direto para a posição #1, #5, etc.)
  const handleSetSongExactPosition = (songId: string, newPos1Based: number) => {
    const ordered = [...chronologicallySortedSongs];
    const currentIdx = ordered.findIndex((s) => s.id === songId);
    if (currentIdx < 0) return;
    const clampedTargetIdx = Math.max(0, Math.min(ordered.length - 1, newPos1Based - 1));
    if (clampedTargetIdx === currentIdx) return;

    const [moved] = ordered.splice(currentIdx, 1);
    ordered.splice(clampedTargetIdx, 0, moved);

    const normalized = ordered.map((s, idx) => ({
      ...s,
      chronologicalOrder: idx + 1
    }));
    setSongs(normalized);
  };

  const handleUpdateSongChronologicalEra = (songId: string, eraLabel: string) => {
    setSongs((prev) =>
      prev.map((s) => (s.id === songId ? { ...s, chronologicalEra: eraLabel } : s))
    );
  };

  // Lista filtrada e ordenada de músicas na barra lateral
  const filteredSongs = useMemo(() => {
    const baseList =
      sortMode === 'chronological'
        ? chronologicallySortedSongs
        : [...songs].sort((a, b) => a.title.localeCompare(b.title));

    return baseList.filter((s) => {
      const matchesSearch =
        !searchQuery.trim() ||
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.loreTitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.chronologicalEra || '').toLowerCase().includes(searchQuery.toLowerCase());
      const hasLyricsOrLore =
        !filterWithLyricsOnly ||
        (s.lyrics && s.lyrics.length > 0) ||
        Boolean(s.loreContext && s.loreContext.trim());
      return matchesSearch && hasLyricsOrLore;
    });
  }, [songs, chronologicallySortedSongs, sortMode, searchQuery, filterWithLyricsOnly]);

  // Cartas vinculadas à música atual
  const linkedCards = useMemo(() => {
    if (!selectedSong?.relatedCardIds?.length) return [];
    return cards.filter((c) => selectedSong.relatedCardIds?.includes(c.id));
  }, [cards, selectedSong]);

  const syncedLinesCount = useMemo(() => {
    if (!selectedSong?.lyrics) return 0;
    return selectedSong.lyrics.filter((l) => l.time !== null && l.time !== undefined).length;
  }, [selectedSong]);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-6 pb-28 text-slate-200">
      {/* Cabeçalho da Seção Músicas & Lore */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 border-b border-[rgba(var(--primary-rgb),0.25)] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold uppercase tracking-widest mb-2">
            <Music size={13} /> Trilha Sonora Oficial • Letras Sincronizadas & Lore
          </div>
          <h2 className="font-cinzel text-3xl sm:text-4xl font-black text-white tracking-wider uppercase">
            Músicas do <span className="text-theme">Macroverso</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Selecione uma música para ouvir, acompanhar a letra original e traduzida em tempo real e descobrir a história e o contexto de cada canção dentro da Lore.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {saveFeedback && (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-fade-in">
              <Check size={14} /> {saveFeedback}
            </div>
          )}

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() =>
                  setAdminMode(adminMode === 'bulk_lyrics' ? 'none' : 'bulk_lyrics')
                }
                className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border transition ${
                  adminMode === 'bulk_lyrics'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg'
                    : 'bg-[#101018] hover:bg-[#181824] text-amber-300 border-amber-500/40'
                }`}
              >
                <FileText size={14} /> Colar / Editar Letras
              </button>

              <button
                type="button"
                onClick={() =>
                  setAdminMode(adminMode === 'sync_studio' ? 'none' : 'sync_studio')
                }
                className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border transition ${
                  adminMode === 'sync_studio'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg'
                    : 'bg-[#101018] hover:bg-[#181824] text-emerald-300 border-emerald-500/40'
                }`}
              >
                <Clock size={14} /> Sincronizar Letra
              </button>

              <button
                type="button"
                onClick={() =>
                  setAdminMode(adminMode === 'edit_lore' ? 'none' : 'edit_lore')
                }
                className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border transition ${
                  adminMode === 'edit_lore'
                    ? 'bg-purple-500 text-white border-purple-400 shadow-lg'
                    : 'bg-[#101018] hover:bg-[#181824] text-purple-300 border-purple-500/40'
                }`}
              >
                <BookOpen size={14} /> Editar Contexto & Lore
              </button>

              <button
                type="button"
                onClick={() =>
                  setAdminMode(adminMode === 'chronology' ? 'none' : 'chronology')
                }
                className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border transition ${
                  adminMode === 'chronology'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg'
                    : 'bg-[#101018] hover:bg-[#181824] text-amber-300 border-amber-500/40'
                }`}
              >
                <ListOrdered size={14} /> Ordem Cronológica
              </button>

              <button
                type="button"
                onClick={() =>
                  setAdminMode(adminMode === 'add_song' ? 'none' : 'add_song')
                }
                className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1 border transition ${
                  adminMode === 'add_song'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-[#101018] hover:bg-[#181824] text-cyan-300 border-cyan-500/40'
                }`}
              >
                <Plus size={14} /> Nova Música
              </button>
            </>
          )}
        </div>
      </div>

      {/* Painel para Organizar as Músicas em Ordem Cronológica da Lore (Admin) */}
      {isAdmin && adminMode === 'chronology' && (
        <div className="mb-6 p-5 rounded-2xl bg-[#0e0e18] border border-amber-500/50 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
            <div>
              <h3 className="font-cinzel text-sm sm:text-base font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                <ListOrdered size={17} /> Organizar Músicas em Ordem Cronológica da Lore
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Defina a sequência cronológica das músicas na história (1ª, 2ª, 3ª...) usando as setas ou digitando a posição desejada, e adicione opcionalmente a Era/Período de cada faixa.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  const normalized = chronologicallySortedSongs.map((s, idx) => ({
                    ...s,
                    chronologicalOrder: idx + 1
                  }));
                  await persistSongsToFirestore(
                    normalized,
                    'Ordem cronológica das músicas salva com sucesso!'
                  );
                  setAdminMode('none');
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg"
              >
                <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Ordem Cronológica'}
              </button>
              <button
                type="button"
                onClick={() => setAdminMode('none')}
                className="p-2 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {chronologicallySortedSongs.map((song, idx) => (
              <div
                key={song.id}
                className="p-2.5 rounded-xl bg-[#141422] border border-white/10 hover:border-amber-500/40 flex flex-wrap sm:flex-nowrap items-center gap-3 transition"
              >
                {/* Seletor / Número da Posição Cronológica */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">
                    Posição:
                  </span>
                  <select
                    value={idx + 1}
                    onChange={(e) =>
                      handleSetSongExactPosition(song.id, Number(e.target.value))
                    }
                    className="bg-black border border-amber-500/40 rounded-lg px-2 py-1 text-xs font-mono font-black text-amber-300"
                    title="Mudar posição cronológica diretamente"
                  >
                    {chronologicallySortedSongs.map((_, posIdx) => (
                      <option key={posIdx + 1} value={posIdx + 1}>
                        {posIdx + 1}º na Lore
                      </option>
                    ))}
                  </select>
                </div>

                {/* Botões Subir / Descer */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveSongChronology(song.id, -1, false)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-30 text-slate-200"
                    title="Subir na cronologia"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === chronologicallySortedSongs.length - 1}
                    onClick={() => handleMoveSongChronology(song.id, 1, false)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-30 text-slate-200"
                    title="Descer na cronologia"
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>

                <img
                  src={song.coverUrl}
                  alt={song.title}
                  className="w-9 h-9 rounded-lg object-cover border border-white/10 shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{song.title}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {song.loreTitle || song.artist}
                  </p>
                </div>

                {/* Campo opcional de Era / Momento Cronológico */}
                <div className="w-full sm:w-56 shrink-0">
                  <input
                    type="text"
                    value={song.chronologicalEra || ''}
                    onChange={(e) =>
                      handleUpdateSongChronologicalEra(song.id, e.target.value)
                    }
                    placeholder="Era / Marco (ex: Era Primordial, Ato I...)"
                    className="w-full bg-black/60 border border-white/15 focus:border-amber-500/50 rounded-lg px-2.5 py-1.5 text-[11px] text-amber-200 outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal/Painel para Adicionar Nova Música (Admin) */}
      {isAdmin && adminMode === 'add_song' && (
        <div className="mb-6 p-5 rounded-2xl bg-[#0e0e16] border border-cyan-500/40 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-cinzel text-sm sm:text-base font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2">
              <Plus size={16} /> Adicionar Música à Lore
            </h3>
            <button
              type="button"
              onClick={() => setAdminMode('none')}
              className="text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                Link ou ID do YouTube *
              </label>
              <input
                type="text"
                value={newSongYoutubeUrl}
                onChange={(e) => setNewSongYoutubeUrl(e.target.value)}
                placeholder="Ex: https://youtu.be/OD4j3ot0l8U"
                className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                Nome da Música *
              </label>
              <input
                type="text"
                value={newSongTitle}
                onChange={(e) => setNewSongTitle(e.target.value)}
                placeholder="Ex: The Dragon and Elf"
                className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                Artista / Compositor
              </label>
              <input
                type="text"
                value={newSongArtist}
                onChange={(e) => setNewSongArtist(e.target.value)}
                placeholder="Salazar Dias"
                className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                Duração
              </label>
              <input
                type="text"
                value={newSongDuration}
                onChange={(e) => setNewSongDuration(e.target.value)}
                placeholder="3:45"
                className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => setAdminMode('none')}
              className="px-4 py-2 rounded-lg border border-white/15 text-xs text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateNewSong}
              disabled={!newSongYoutubeUrl.trim() || !newSongTitle.trim() || saving}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-black text-xs uppercase tracking-wider"
            >
              Adicionar Música
            </button>
          </div>
        </div>
      )}

      {/* Layout Principal em 3 Colunas (Desktop): Lista de Músicas | Letra Sincronizada + Player | Contexto & Lore */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA 1: Catálogo de Músicas (3 cols) */}
        <div className="lg:col-span-3 bg-[#0b0b12] border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col max-h-[780px]">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <h3 className="font-cinzel text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Disc3 size={16} className={isPlaying ? 'animate-spin text-amber-400' : 'text-amber-400'} />
              Faixas ({filteredSongs.length})
            </h3>
            <button
              type="button"
              onClick={() => setFilterWithLyricsOnly((v) => !v)}
              className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase transition ${
                filterWithLyricsOnly
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'border-white/10 text-slate-400 hover:text-white'
              }`}
              title="Filtrar músicas que já possuem letra ou lore cadastrada"
            >
              {filterWithLyricsOnly ? 'Com Letra/Lore' : 'Todas'}
            </button>
          </div>

          {/* Seletor de Ordenação: Ordem Cronológica vs A-Z */}
          <div className="flex items-center gap-1 bg-black/50 border border-white/10 rounded-xl p-1 mb-3">
            <button
              type="button"
              onClick={() => setSortMode('chronological')}
              className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition ${
                sortMode === 'chronological'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListOrdered size={12} /> Ordem Cronológica
            </button>
            <button
              type="button"
              onClick={() => setSortMode('alphabetical')}
              className={`py-1 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                sortMode === 'alphabetical'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              A–Z
            </button>
          </div>

          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar música ou era..."
              className="w-full bg-black/50 border border-white/10 focus:border-amber-500/50 rounded-xl pl-8 pr-3 py-2 text-xs text-white outline-none"
            />
          </div>

          <div className="overflow-y-auto space-y-1.5 pr-1 custom-scrollbar flex-1">
            {filteredSongs.map((song, idx) => {
              const isSelected = selectedSong?.id === song.id;
              const hasLyrics = song.lyrics && song.lyrics.length > 0;
              const hasLore = Boolean(song.loreContext && song.loreContext.trim());
              const chronoIndex =
                chronologicallySortedSongs.findIndex((s) => s.id === song.id) + 1;
              return (
                <div
                  key={song.id}
                  onClick={() => handleSelectSong(song, true)}
                  className={`group p-2.5 rounded-xl border cursor-pointer transition flex items-center gap-2.5 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400/70 text-white shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                      : 'bg-[#10101a]/70 border-white/5 hover:border-white/20 text-slate-300'
                  }`}
                >
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-black border border-white/10">
                    <img
                      src={song.coverUrl}
                      alt={song.title}
                      className="w-full h-full object-cover"
                    />
                    <div
                      className={`absolute inset-0 bg-black/50 flex items-center justify-center transition ${
                        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isSelected && isPlaying ? (
                        <Pause size={16} className="text-amber-400" />
                      ) : (
                        <Play size={16} className="text-white fill-white ml-0.5" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold truncate text-white">
                        <span className="text-amber-400 font-mono mr-1">
                          #{chronoIndex > 0 ? chronoIndex : idx + 1}
                        </span>
                        {song.title}
                      </p>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        {song.duration}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {song.chronologicalEra ? (
                        <span className="text-amber-300/90 font-semibold">
                          {song.chronologicalEra}
                        </span>
                      ) : (
                        song.artist
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {hasLyrics && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold uppercase">
                          Letra ({song.lyrics.length})
                        </span>
                      )}
                      {hasLore && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-500/40 text-purple-300 font-bold uppercase">
                          Lore
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Controles rápidos de Subir/Descer na Ordem Cronológica + Excluir (Admin) */}
                  {isAdmin && (
                    <div
                      className="flex flex-col items-center gap-0.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {sortMode === 'chronological' && !searchQuery.trim() && !filterWithLyricsOnly && (
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            disabled={chronoIndex <= 1}
                            onClick={() => handleMoveSongChronology(song.id, -1, true)}
                            className="p-1 text-slate-400 hover:text-amber-300 disabled:opacity-25 transition"
                            title="Subir na ordem cronológica"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            disabled={chronoIndex >= chronologicallySortedSongs.length}
                            onClick={() => handleMoveSongChronology(song.id, 1, true)}
                            className="p-1 text-slate-400 hover:text-amber-300 disabled:opacity-25 transition"
                            title="Descer na ordem cronológica"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>
                      )}
                      {songs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSong(song.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition"
                          title="Remover música"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUNA 2: Player + Acompanhamento da Letra Sincronizada (Original & Traduzida) (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Card do Player da Música Selecionada */}
          {selectedSong && (
            <div className="bg-gradient-to-br from-[#12121f] via-[#0d0d16] to-[#090910] border border-amber-500/30 rounded-2xl p-4 shadow-2xl">
              <div className="flex items-center gap-4">
                <img
                  src={selectedSong.coverUrl}
                  alt={selectedSong.title}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-amber-500/40 shadow-lg shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                      Tocando na Lore
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowVideoFrame((v) => !v)}
                      className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 border border-white/10 px-2 py-0.5 rounded-md"
                    >
                      {showVideoFrame ? <EyeOff size={11} /> : <Eye size={11} />}
                      <span>{showVideoFrame ? 'Ocultar Vídeo' : 'Ver Vídeo'}</span>
                    </button>
                  </div>
                  <h3 className="font-cinzel text-lg sm:text-xl font-black text-white truncate mt-0.5">
                    {selectedSong.title}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {selectedSong.artist} • <span className="text-slate-500">{selectedSong.album}</span>
                  </p>
                  {selectedSong.loreTitle && (
                    <p className="text-[11px] text-purple-300 font-semibold truncate mt-1">
                      ✦ {selectedSong.loreTitle}
                    </p>
                  )}
                </div>
              </div>

              {/* YouTube Video Container (visível se o usuário clicar em Ver Vídeo, senão fica oculto mantendo o áudio) */}
              <div
                className={`mt-3 overflow-hidden rounded-xl border border-white/10 bg-black flex justify-center transition-all ${
                  showVideoFrame ? 'h-48 opacity-100' : 'h-0 opacity-0 pointer-events-none'
                }`}
              >
                <div id="yt-lore-music-player" className="w-full h-full" />
              </div>

              {/* Barra de Progresso (Seek) */}
              <div className="mt-4">
                <input
                  type="range"
                  min={0}
                  max={durationSec > 0 ? durationSec : 240}
                  step={0.1}
                  value={Math.min(currentTime, durationSec > 0 ? durationSec : 240)}
                  onChange={(e) => seekToSeconds(parseFloat(e.target.value), false)}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-1">
                  <span>{formatSecondsShort(currentTime)}</span>
                  <span className="text-amber-400/90 text-[10px]">
                    {syncedLinesCount > 0
                      ? `${syncedLinesCount}/${selectedSong.lyrics.length} versos sincronizados`
                      : selectedSong.lyrics.length > 0
                      ? `${selectedSong.lyrics.length} versos (sem tempo marcado)`
                      : 'Sem letra cadastrada'}
                  </span>
                  <span>
                    {durationSec > 0 ? formatSecondsShort(durationSec) : selectedSong.duration}
                  </span>
                </div>
              </div>

              {/* Controles de Reprodução */}
              <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-white/10">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => seekToSeconds(currentTime - 5)}
                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-mono"
                    title="Voltar 5 segundos"
                  >
                    -5s
                  </button>
                  <button
                    type="button"
                    onClick={togglePlayPause}
                    className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg transition"
                    title={isPlaying ? 'Pausar' : 'Tocar'}
                  >
                    {isPlaying ? (
                      <Pause size={18} />
                    ) : (
                      <Play size={18} className="fill-slate-950 ml-0.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => seekToSeconds(currentTime + 5)}
                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-mono"
                    title="Avançar 5 segundos"
                  >
                    +5s
                  </button>
                </div>

                {/* Controle de Volume */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="text-slate-400 hover:text-white"
                  >
                    {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="w-20 accent-amber-400 h-1 bg-slate-800 rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* MODO ADMIN 1: COLAR / EDITAR LETRAS EM LOTE (ORIGINAL + TRADUÇÃO) */}
          {isAdmin && adminMode === 'bulk_lyrics' && selectedSong && (
            <div className="bg-[#0e0e18] border border-amber-500/50 rounded-2xl p-4 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-cinzel text-sm font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                    <FileText size={15} /> Colar Letra Original & Tradução (Linha por Linha)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Cole um verso por linha. A linha 1 da Letra Original será pareada automaticamente com a linha 1 da Tradução.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminMode('none')}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-amber-300 mb-1">
                    Letra Original (1 verso por linha)
                  </label>
                  <textarea
                    rows={12}
                    value={bulkOriginalText}
                    onChange={(e) => setBulkOriginalText(e.target.value)}
                    placeholder={'In the shadows of the ancient stars...\nTwo souls bound by fire and steel...'}
                    className="w-full bg-black/70 border border-white/15 rounded-xl p-3 text-xs text-white font-mono leading-relaxed"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-cyan-300 mb-1">
                    Letra Traduzida PT-BR (1 verso por linha)
                  </label>
                  <textarea
                    rows={12}
                    value={bulkTranslationText}
                    onChange={(e) => setBulkTranslationText(e.target.value)}
                    placeholder={'Nas sombras das estrelas ancestrais...\nDuas almas unidas pelo fogo e aço...'}
                    className="w-full bg-black/70 border border-white/15 rounded-xl p-3 text-xs text-cyan-100 font-mono leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                <span className="text-[11px] text-slate-400">
                  Dica: Você também pode colar no formato <code className="text-amber-300">[00:14.5] Verso</code> se já tiver os tempos.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdminMode('none')}
                    className="px-3 py-1.5 rounded-lg border border-white/15 text-xs text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyBulkLyrics}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg"
                  >
                    <Save size={14} /> Salvar Versos & Ir para Sincronização
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODO ADMIN 2: BARRA DE SINCRONIZAÇÃO AO VIVO (TAP SYNC) */}
          {isAdmin && adminMode === 'sync_studio' && selectedSong && (
            <div className="bg-emerald-950/30 border border-emerald-500/50 rounded-2xl p-4 shadow-2xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-cinzel text-sm font-black uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                    <Clock size={15} /> Estúdio de Sincronização da Letra
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    Dê Play na música e clique no botão abaixo (ou aperte <kbd className="px-1.5 py-0.5 rounded bg-black/80 border border-white/20 text-amber-300 font-mono">Espaço</kbd>) exatamente quando cada verso começar a ser cantado!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminMode('none')}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {selectedSong.lyrics.length === 0 ? (
                <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-center space-y-2">
                  <p className="text-xs text-slate-300">
                    Esta música ainda não tem versos cadastrados.
                  </p>
                  <button
                    type="button"
                    onClick={() => setAdminMode('bulk_lyrics')}
                    className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider"
                  >
                    Colar Letra Original e Tradução Primeiro
                  </button>
                </div>
              ) : (
                <>
                  {/* Destaque da Linha Selecionada para Marcar */}
                  <div className="p-3 rounded-xl bg-black/60 border border-emerald-500/40">
                    <div className="flex items-center justify-between text-[11px] text-emerald-300 font-mono mb-1">
                      <span>
                        VERSO ALVO #{syncCursorIndex + 1} DE {selectedSong.lyrics.length}
                      </span>
                      <span>
                        Tempo atual do player: <strong>{formatSeconds(currentTime)}</strong>
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white">
                      {selectedSong.lyrics[syncCursorIndex]?.original || '(Verso original vazio)'}
                    </p>
                    <p className="text-xs text-cyan-300 mt-0.5">
                      {selectedSong.lyrics[syncCursorIndex]?.translation || '(Sem tradução)'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleStampCurrentLine}
                      className="flex-1 min-w-[220px] py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.35)] transition"
                    >
                      <Clock size={17} />
                      Marcar Tempo ({formatSeconds(currentTime)}) & Próximo Verso
                    </button>

                    <button
                      type="button"
                      onClick={() => setSyncCursorIndex((p) => Math.max(0, p - 1))}
                      disabled={syncCursorIndex === 0}
                      className="px-3 py-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs font-bold text-slate-200"
                    >
                      ↑ Verso Anterior
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSyncCursorIndex((p) =>
                          Math.min(selectedSong.lyrics.length - 1, p + 1)
                        )
                      }
                      disabled={syncCursorIndex >= selectedSong.lyrics.length - 1}
                      className="px-3 py-3 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs font-bold text-slate-200"
                    >
                      ↓ Próximo
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddSingleLine(syncCursorIndex)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-300 flex items-center gap-1"
                      >
                        <Plus size={12} /> Inserir Verso Abaixo
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAllTimestamps}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 text-[11px] font-bold text-rose-300 flex items-center gap-1"
                      >
                        <RotateCcw size={12} /> Zerar Tempos
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        persistSongsToFirestore(songs, 'Sincronização da letra salva com sucesso!')
                      }
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg"
                    >
                      <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Sincronização'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* PAINEL DE LETRA SINCRONIZADA (ORIGINAL & TRADUÇÃO SIMULTÂNEAS) */}
          <div className="bg-[#0b0b12] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Languages size={16} className="text-amber-400" />
                <h4 className="font-cinzel text-sm font-black uppercase tracking-wider text-white">
                  Letra da Música
                </h4>
              </div>

              {/* Botões de modo de exibição: Original + Tradução ao mesmo tempo, Só Original, Só Tradução */}
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="inline-flex bg-black/60 border border-white/10 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setLyricDisplayMode('both')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition ${
                      lyricDisplayMode === 'both'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Original + Tradução
                  </button>
                  <button
                    type="button"
                    onClick={() => setLyricDisplayMode('original')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition ${
                      lyricDisplayMode === 'original'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    onClick={() => setLyricDisplayMode('translation')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition ${
                      lyricDisplayMode === 'translation'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tradução
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setAutoScrollEnabled((v) => !v)}
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase transition ${
                    autoScrollEnabled
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : 'bg-black/40 border-white/10 text-slate-500 hover:text-white'
                  }`}
                  title="Rolar a letra automaticamente conforme a música avança"
                >
                  Auto-Roll: {autoScrollEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Lista de Versos */}
            <div
              ref={lyricsScrollContainerRef}
              className="h-[460px] overflow-y-auto pr-2 space-y-2.5 custom-scrollbar"
            >
              {!selectedSong || selectedSong.lyrics.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12">
                  <Music size={36} className="text-slate-600 mb-3" />
                  <p className="font-cinzel text-sm font-bold text-slate-400 uppercase tracking-wider">
                    Letra ainda não cadastrada para &ldquo;{selectedSong?.title}&rdquo;
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    {isAdmin
                      ? 'Clique em "Colar / Editar Letras" no topo para adicionar a letra original e a tradução e sincronizar cada verso com a música.'
                      : 'A letra sincronizada e a tradução desta faixa serão disponibilizadas em breve.'}
                  </p>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setAdminMode('bulk_lyrics')}
                      className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Adicionar Letra Original & Tradução
                    </button>
                  )}
                </div>
              ) : (
                selectedSong.lyrics.map((line, idx) => {
                  const isActive = activeLyricIndex === idx;
                  const isSyncTarget = adminMode === 'sync_studio' && syncCursorIndex === idx;

                  return (
                    <div
                      key={line.id || idx}
                      ref={(el) => {
                        if (line.id) lineRefs.current[line.id] = el;
                      }}
                      onClick={() => {
                        if (adminMode === 'sync_studio') {
                          setSyncCursorIndex(idx);
                          return;
                        }
                        if (line.time !== null && line.time !== undefined) {
                          seekToSeconds(line.time, true);
                        }
                      }}
                      className={`rounded-xl p-3 transition-all duration-300 border ${
                        isSyncTarget
                          ? 'bg-emerald-950/50 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                          : isActive
                          ? 'bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-amber-400/80 shadow-[0_0_25px_rgba(245,158,11,0.18)] scale-[1.01]'
                          : 'bg-[#101018]/60 border-white/5 hover:border-white/20 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {/* MODO DE EDIÇÃO DIRETA NO SYNC STUDIO */}
                          {isAdmin && adminMode === 'sync_studio' ? (
                            <div
                              className="space-y-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-mono text-slate-400 font-bold">
                                  #{idx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={formatSeconds(line.time)}
                                  onChange={(e) =>
                                    handleUpdateLineField(
                                      idx,
                                      'time',
                                      parseTimeInput(e.target.value)
                                    )
                                  }
                                  className="w-20 bg-black/80 border border-white/20 rounded px-2 py-0.5 text-[11px] font-mono text-amber-300"
                                  title="Tempo do verso (mm:ss.d)"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAdjustLineTime(idx, -0.5)}
                                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-[10px] font-mono text-slate-300"
                                >
                                  -0.5s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAdjustLineTime(idx, 0.5)}
                                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-[10px] font-mono text-slate-300"
                                >
                                  +0.5s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSyncCursorIndex(idx);
                                    handleStampCurrentLine();
                                  }}
                                  className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-[10px] font-bold text-emerald-300"
                                >
                                  Marcar Agora
                                </button>
                                {line.time !== null && (
                                  <button
                                    type="button"
                                    onClick={() => seekToSeconds(line.time || 0, true)}
                                    className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-[10px] font-bold text-amber-300"
                                  >
                                    Ouvir
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSingleLine(idx)}
                                  className="ml-auto p-1 text-slate-500 hover:text-rose-400"
                                  title="Excluir linha"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>

                              <input
                                type="text"
                                value={line.original}
                                onChange={(e) =>
                                  handleUpdateLineField(idx, 'original', e.target.value)
                                }
                                placeholder="Letra original..."
                                className="w-full bg-black/60 border border-white/10 rounded px-2.5 py-1 text-xs text-white font-semibold"
                              />
                              <input
                                type="text"
                                value={line.translation}
                                onChange={(e) =>
                                  handleUpdateLineField(idx, 'translation', e.target.value)
                                }
                                placeholder="Tradução em português..."
                                className="w-full bg-black/60 border border-white/10 rounded px-2.5 py-1 text-xs text-cyan-200"
                              />
                            </div>
                          ) : (
                            /* MODO LEITURA & ACOMPANHAMENTO SINCRONIZADO */
                            <>
                              {(lyricDisplayMode === 'both' ||
                                lyricDisplayMode === 'original') && (
                                <p
                                  className={`leading-snug transition-colors ${
                                    isActive
                                      ? 'text-base sm:text-lg font-black text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                                      : 'text-xs sm:text-sm font-bold text-slate-200'
                                  }`}
                                >
                                  {line.original || '♪'}
                                </p>
                              )}

                              {(lyricDisplayMode === 'both' ||
                                lyricDisplayMode === 'translation') &&
                                line.translation && (
                                  <p
                                    className={`mt-1 leading-snug italic transition-colors ${
                                      isActive
                                        ? 'text-xs sm:text-sm font-semibold text-cyan-200'
                                        : 'text-[11px] sm:text-xs text-slate-400'
                                    }`}
                                  >
                                    {line.translation}
                                  </p>
                                )}
                            </>
                          )}
                        </div>

                        {/* Badge de Tempo do Verso (clicável para pular para o trecho) */}
                        {adminMode !== 'sync_studio' && line.time !== null && (
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                              isActive
                                ? 'bg-amber-500 text-slate-950 font-black'
                                : 'bg-black/40 text-slate-500'
                            }`}
                          >
                            {formatSecondsShort(line.time)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* COLUNA 3: Contexto & Lore da Música (4 cols) */}
        <div className="lg:col-span-4 bg-[#0b0b12] border border-purple-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <BookOpen size={17} className="text-purple-400" />
              <div>
                <h3 className="font-cinzel text-sm sm:text-base font-black uppercase tracking-wider text-white">
                  Contexto & Lore da Música
                </h3>
                <p className="text-[10px] text-slate-400">
                  História por trás da faixa, eventos e personagens conectados
                </p>
              </div>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() =>
                  setAdminMode(adminMode === 'edit_lore' ? 'none' : 'edit_lore')
                }
                className="px-2.5 py-1 rounded-lg bg-purple-950/60 hover:bg-purple-900/70 border border-purple-500/40 text-purple-200 text-[11px] font-bold flex items-center gap-1"
              >
                <Edit3 size={12} />
                <span>{adminMode === 'edit_lore' ? 'Fechar' : 'Editar'}</span>
              </button>
            )}
          </div>

          {/* MODO EDIÇÃO DE CONTEXTO & LORE (ADMIN) */}
          {isAdmin && adminMode === 'edit_lore' && selectedSong ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Nome da Música
                  </label>
                  <input
                    type="text"
                    value={draftSongTitle}
                    onChange={(e) => setDraftSongTitle(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Artista / Compositor
                  </label>
                  <input
                    type="text"
                    value={draftSongArtist}
                    onChange={(e) => setDraftSongArtist(e.target.value)}
                    className="w-full bg-black/60 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-purple-300 mb-1">
                  Título do Arco / Evento na Lore
                </label>
                <input
                  type="text"
                  value={draftLoreTitle}
                  onChange={(e) => setDraftLoreTitle(e.target.value)}
                  placeholder="Ex: O Pacto de Sangue em Arkham / A Queda do Macroverso 12"
                  className="w-full bg-black/60 border border-purple-500/40 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-purple-300 mb-1">
                  História, Significado e Contexto da Música
                </label>
                <textarea
                  rows={10}
                  value={draftLoreContext}
                  onChange={(e) => setDraftLoreContext(e.target.value)}
                  placeholder="Escreva aqui o contexto completo desta música dentro da Lore de Light Dark, o que cada estrofe simboliza, quais personagens protagonizam o momento e as curiosidades de criação..."
                  className="w-full bg-black/60 border border-white/15 rounded-xl p-3 text-xs text-slate-100 leading-relaxed"
                />
              </div>

              {/* Vincular Cartas / Personagens da Lore */}
              <div className="border-t border-white/10 pt-3">
                <label className="block text-[11px] font-bold uppercase text-amber-300 mb-1.5">
                  Personagens / Cartas Relacionadas ({draftRelatedCardIds.length})
                </label>
                <input
                  type="text"
                  value={cardSearchTerm}
                  onChange={(e) => setCardSearchTerm(e.target.value)}
                  placeholder="Filtrar carta pelo nome..."
                  className="w-full bg-black/60 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white mb-2"
                />
                <div className="max-h-36 overflow-y-auto grid grid-cols-1 gap-1 p-1.5 bg-black/40 border border-white/10 rounded-xl custom-scrollbar">
                  {cards
                    .filter(
                      (c) =>
                        !cardSearchTerm.trim() ||
                        c.name.toLowerCase().includes(cardSearchTerm.toLowerCase())
                    )
                    .slice(0, 40)
                    .map((card) => {
                      const isLinked = draftRelatedCardIds.includes(card.id);
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => {
                            setDraftRelatedCardIds((prev) =>
                              isLinked
                                ? prev.filter((id) => id !== card.id)
                                : [...prev, card.id]
                            );
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition ${
                            isLinked
                              ? 'bg-purple-900/50 border border-purple-400 text-white font-bold'
                              : 'hover:bg-white/5 text-slate-400'
                          }`}
                        >
                          <span className="truncate">{card.name}</span>
                          {isLinked && <Check size={13} className="text-purple-300 shrink-0" />}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdminMode('none')}
                  className="px-3 py-1.5 rounded-lg border border-white/15 text-xs text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveLoreAndContext}
                  className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg"
                >
                  <Save size={14} /> {saving ? 'Salvando...' : 'Salvar Contexto & Lore'}
                </button>
              </div>
            </div>
          ) : (
            /* VISUALIZAÇÃO DO CONTEXTO & LORE DA MÚSICA */
            <div className="space-y-4">
              {selectedSong?.loreTitle && (
                <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-purple-300 font-bold block mb-0.5">
                    Arco / Capítulo Relacionado
                  </span>
                  <h4 className="font-cinzel text-base font-black text-white">
                    {selectedSong.loreTitle}
                  </h4>
                </div>
              )}

              {selectedSong?.loreContext && selectedSong.loreContext.trim() ? (
                <div className="prose prose-invert max-w-none">
                  <div className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-serif bg-[#10101a]/70 border border-white/5 rounded-xl p-4 max-h-[380px] overflow-y-auto custom-scrollbar">
                    {selectedSong.loreContext}
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-[#10101a]/60 border border-white/5 text-center">
                  <Sparkles size={28} className="text-purple-400/50 mx-auto mb-2" />
                  <p className="font-cinzel text-xs font-bold uppercase tracking-wider text-slate-300">
                    Arquivo de Contexto & Lore da Faixa
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {isAdmin
                      ? 'Clique em "Editar Contexto & Lore" para escrever a história, o contexto e os segredos desta música no universo Light Dark.'
                      : 'Os registros históricos sobre o contexto desta canção no Macroverso ainda estão sendo catalogados.'}
                  </p>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setAdminMode('edit_lore')}
                      className="mt-3 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5"
                    >
                      <Edit3 size={12} /> Escrever Contexto e Lore
                    </button>
                  )}
                </div>
              )}

              {/* Cartas / Personagens Relacionados à Música */}
              {linkedCards.length > 0 && (
                <div className="border-t border-white/10 pt-4">
                  <h5 className="text-[11px] font-cinzel font-black uppercase tracking-wider text-amber-400 mb-2.5 flex items-center gap-1.5">
                    <Users size={13} /> Personagens & Cartas Conectadas
                  </h5>
                  <div className="grid grid-cols-2 gap-2">
                    {linkedCards.map((card) => (
                      <div
                        key={card.id}
                        onClick={() => onInspectCard?.(card)}
                        className="p-2 rounded-xl bg-[#12121e] hover:bg-[#19192a] border border-white/10 hover:border-amber-500/50 cursor-pointer transition flex items-center gap-2.5"
                      >
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          className="w-10 h-10 rounded-lg object-cover border border-amber-500/30 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{card.name}</p>
                          <p className="text-[10px] text-amber-400 truncate">{card.archetype}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
