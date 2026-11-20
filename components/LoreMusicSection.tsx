import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
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
  Link2,
  Unlink,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { CardData } from '../types';
import { FULL_LIGHT_DARK_TRACKS } from './SpotifySoundtrackSection';

export interface LyricLineItem {
  id: string;
  time: number | null;
  original: string;
  translation: string;
}

export interface SongTimelineConnection {
  fromId: string;
  toId: string;
}

export interface LoreSongData {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  coverUrl: string;
  backgroundUrl?: string;
  loreTitle?: string;
  loreContext?: string;
  chronologicalOrder?: number;
  chronologicalEra?: string;
  nodeX?: number;
  nodeY?: number;
  relatedCharacters?: string[];
  relatedCardIds?: string[];
  lyrics: LyricLineItem[];
  updatedAt?: string;
}

interface LoreMusicSectionProps {
  isAdmin: boolean;
  cards: CardData[];
  onInspectCard?: (card: CardData) => void;
  onClose?: () => void;
}

const LORE_SONGS_CACHE_KEY = 'ld_cache_loreSongs_v1';
const LORE_SONG_LINKS_CACHE_KEY = 'ld_cache_loreSongLinks_v1';

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
  const clean = str.trim().replace(/^\[|\]$/g, '');
  if (!clean || clean === '--:--') return null;

  const parts = clean.split(':');
  if (parts.length === 3) {
    const hrs = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    const secs = parseFloat(parts[2].replace(',', '.'));
    if (!isNaN(hrs) && !isNaN(mins) && !isNaN(secs)) {
      return Math.max(0, Math.round((hrs * 3600 + mins * 60 + secs) * 10) / 10);
    }
  }
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

/**
 * Interpreta texto de legendas sincronizadas do YouTube Studio (.sbv, .srt, .vtt,
 * transcrição copiada do YouTube com tempos, ou LRC [mm:ss.xx]).
 */
function parseYouTubeSubtitleText(
  rawText: string,
  bilingualSameBlock = false
): Array<{ time: number | null; text: string; secondLine?: string }> {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  const rawLines = normalized.split('\n');
  const results: Array<{ time: number | null; text: string; secondLine?: string }> = [];

  const timeTokenPattern = '(?:\\d{1,2}:)?\\d{1,2}:\\d{2}(?:[.,]\\d{1,3})?';

  const rangeLineRegex = new RegExp(
    `^\\s*\\[?(${timeTokenPattern})\\]?\\s*(?:-->|,|\\s+-\\s+|\\s+–\\s+)\\s*\\[?(${timeTokenPattern})\\]?(?:\\s+.*)?$`
  );

  const standaloneTimeRegex = new RegExp(`^\\s*\\[?(${timeTokenPattern})\\]?\\s*$`);

  const inlineTimeAndTextRegex = new RegExp(
    `^\\s*(?:\\[?(${timeTokenPattern})\\]?(?:\\s*(?:-->|,|-)\\s*\\[?${timeTokenPattern}\\]?)?)\\s+(.+)$`
  );

  const isSrtIndexLine = (lineIdx: number): boolean => {
    const l = rawLines[lineIdx]?.trim() || '';
    if (!/^\d+$/.test(l)) return false;
    const nextL = rawLines[lineIdx + 1]?.trim() || '';
    return rangeLineRegex.test(nextL) || standaloneTimeRegex.test(nextL);
  };

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i].trim();

    if (!line || /^WEBVTT($|\s)/i.test(line) || /^NOTE($|\s)/i.test(line)) {
      i++;
      continue;
    }

    if (isSrtIndexLine(i)) {
      i++;
      continue;
    }

    const rangeMatch = line.match(rangeLineRegex);
    const standaloneMatch = !rangeMatch ? line.match(standaloneTimeRegex) : null;

    if (rangeMatch || standaloneMatch) {
      const startToken = rangeMatch ? rangeMatch[1] : standaloneMatch![1];
      const parsedTime = parseTimeInput(startToken);
      i++;

      const cueLines: string[] = [];
      while (i < rawLines.length) {
        const nextLine = rawLines[i].trim();
        if (!nextLine) {
          i++;
          break;
        }
        if (
          isSrtIndexLine(i) ||
          rangeLineRegex.test(nextLine) ||
          standaloneTimeRegex.test(nextLine)
        ) {
          break;
        }
        const cleanCue = nextLine.replace(/<[^>]+>/g, '').trim();
        if (cleanCue) cueLines.push(cleanCue);
        i++;
      }

      if (cueLines.length > 0) {
        if (bilingualSameBlock && cueLines.length >= 2) {
          results.push({
            time: parsedTime,
            text: cueLines[0],
            secondLine: cueLines.slice(1).join(' ')
          });
        } else {
          results.push({
            time: parsedTime,
            text: cueLines.join(' ')
          });
        }
      }
      continue;
    }

    const inlineMatch = line.match(inlineTimeAndTextRegex);
    if (inlineMatch) {
      const parsedTime = parseTimeInput(inlineMatch[1]);
      const cleanText = inlineMatch[2].replace(/<[^>]+>/g, '').trim();
      if (cleanText) {
        results.push({
          time: parsedTime,
          text: cleanText
        });
      }
      i++;
      continue;
    }

    const cleanPlain = line.replace(/<[^>]+>/g, '').trim();
    if (cleanPlain) {
      results.push({
        time: null,
        text: cleanPlain
      });
    }
    i++;
  }

  return results;
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

// Gera posições iniciais estilo árvore/linha do tempo modular (como no rascunho)
function getDefaultNodePosition(idx: number): { x: number; y: number } {
  const colPattern = [
    { x: 60, y: 120 },
    { x: 240, y: 40 },
    { x: 240, y: 200 },
    { x: 430, y: 40 },
    { x: 430, y: 200 },
    { x: 610, y: 115 },
    { x: 780, y: 195 },
    { x: 930, y: 65 },
    { x: 1090, y: 165 }
  ];
  if (idx < colPattern.length) {
    return colPattern[idx];
  }
  const extraIdx = idx - colPattern.length;
  const col = Math.floor(extraIdx / 2);
  const row = extraIdx % 2;
  return {
    x: 1270 + col * 190,
    y: row === 0 ? 55 : 195
  };
}

function buildDefaultConnections(songsList: LoreSongData[]): SongTimelineConnection[] {
  const conns: SongTimelineConnection[] = [];
  if (songsList.length >= 9) {
    // Ligações iniciais no formato do rascunho enviado
    const pairs = [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 4],
      [3, 5],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8]
    ];
    pairs.forEach(([a, b]) => {
      if (songsList[a] && songsList[b]) {
        conns.push({ fromId: songsList[a].id, toId: songsList[b].id });
      }
    });
    for (let i = 8; i < songsList.length - 1; i++) {
      conns.push({ fromId: songsList[i].id, toId: songsList[i + 1].id });
    }
  } else {
    for (let i = 0; i < songsList.length - 1; i++) {
      conns.push({ fromId: songsList[i].id, toId: songsList[i + 1].id });
    }
  }
  return conns;
}

function buildDefaultLoreSongs(): LoreSongData[] {
  return FULL_LIGHT_DARK_TRACKS.map((t, idx) => {
    const pos = getDefaultNodePosition(idx);
    return {
      id: `song_${t.youtubeId}`,
      videoId: t.youtubeId,
      title: t.title,
      artist: 'Salazar Dias',
      album: 'Light Dark Official Soundtrack',
      duration: t.durationLabel,
      coverUrl: `https://i.ytimg.com/vi/${t.youtubeId}/hqdefault.jpg`,
      backgroundUrl: `https://i.ytimg.com/vi/${t.youtubeId}/maxresdefault.jpg`,
      loreTitle: '',
      loreContext: '',
      chronologicalOrder: idx + 1,
      chronologicalEra: '',
      nodeX: pos.x,
      nodeY: pos.y,
      relatedCharacters: [],
      relatedCardIds: [],
      lyrics: []
    };
  });
}

const NODE_WIDTH = 122;
const NODE_HEIGHT = 152;
const MIN_TIMELINE_ZOOM = 0.45;
const MAX_TIMELINE_ZOOM = 1.65;

export const LoreMusicSection: React.FC<LoreMusicSectionProps> = ({
  isAdmin,
  cards,
  onInspectCard,
  onClose
}) => {
  const [songs, setSongs] = useState<LoreSongData[]>(() => {
    try {
      const raw = localStorage.getItem(LORE_SONGS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((s: LoreSongData, idx: number) => {
            const defPos = getDefaultNodePosition(idx);
            return {
              ...s,
              nodeX: typeof s.nodeX === 'number' ? s.nodeX : defPos.x,
              nodeY: typeof s.nodeY === 'number' ? s.nodeY : defPos.y
            };
          });
        }
      }
    } catch {
      // ignore
    }
    return buildDefaultLoreSongs();
  });

  const [connections, setConnections] = useState<SongTimelineConnection[]>(() => {
    try {
      const raw = localStorage.getItem(LORE_SONG_LINKS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return buildDefaultConnections(buildDefaultLoreSongs());
  });

  const [selectedSongId, setSelectedSongId] = useState<string>(() => {
    const initial = buildDefaultLoreSongs();
    return initial[0]?.id || '';
  });

  // Zoom da Linha do Tempo Modular
  const [timelineZoom, setTimelineZoom] = useState<number>(1);
  const timelineZoomRef = useRef<number>(1);
  useEffect(() => {
    timelineZoomRef.current = timelineZoom;
  }, [timelineZoom]);

  const handleAdjustTimelineZoom = (delta: number) => {
    setTimelineZoom((prev) => {
      const next = Math.round((prev + delta) * 100) / 100;
      return Math.min(MAX_TIMELINE_ZOOM, Math.max(MIN_TIMELINE_ZOOM, next));
    });
  };

  // Painel de "Curiosidades da Música" aberto quando a pessoa clica em uma música
  const [curiositiesSongId, setCuriositiesSongId] = useState<string | null>(null);

  // Player YouTube state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Modos exclusivos de Admin (invisíveis para visitantes)
  const [adminMode, setAdminMode] = useState<
    'none' | 'bulk_lyrics' | 'sync_studio' | 'edit_lore' | 'add_song'
  >('none');
  const [isLinkingMode, setIsLinkingMode] = useState(false);
  const [linkSourceSongId, setLinkSourceSongId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Modos de exibição da letra dentro do editor/sincronizador
  const [lyricDisplayMode, setLyricDisplayMode] = useState<'both' | 'original' | 'translation'>('both');
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  // Campos de Edição em Lote (Original + Tradução) e Importação de Legenda do YouTube
  const [bulkImportTab, setBulkImportTab] = useState<'plain' | 'yt_captions'>('plain');
  const [bulkOriginalText, setBulkOriginalText] = useState('');
  const [bulkTranslationText, setBulkTranslationText] = useState('');
  const [ytCaptionOriginalText, setYtCaptionOriginalText] = useState('');
  const [ytCaptionTranslationText, setYtCaptionTranslationText] = useState('');
  const [ytBilingualSingleBlock, setYtBilingualSingleBlock] = useState(false);

  // Rascunho de digitação manual de tempo por linha
  const [timeInputDrafts, setTimeInputDrafts] = useState<Record<string, string>>({});

  // Cursor de linha no Sincronizador ao Vivo
  const [syncCursorIndex, setSyncCursorIndex] = useState(0);
  const syncCursorRef = useRef(0);

  const updateSyncCursor = (nextIdx: number) => {
    syncCursorRef.current = nextIdx;
    setSyncCursorIndex(nextIdx);
  };

  // Campos de Edição de Curiosidades da Música
  const [draftLoreTitle, setDraftLoreTitle] = useState('');
  const [draftLoreContext, setDraftLoreContext] = useState('');
  const [draftSongTitle, setDraftSongTitle] = useState('');
  const [draftSongDuration, setDraftSongDuration] = useState('');
  const [draftCoverUrl, setDraftCoverUrl] = useState('');
  const [draftBackgroundUrl, setDraftBackgroundUrl] = useState('');
  const [draftRelatedCardIds, setDraftRelatedCardIds] = useState<string[]>([]);
  const [cardSearchTerm, setCardSearchTerm] = useState('');

  // Campos para Adicionar Nova Música
  const [newSongYoutubeUrl, setNewSongYoutubeUrl] = useState('');
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongDuration, setNewSongDuration] = useState('3:30');

  // Drag & Drop dos blocos na Linha do Tempo Modular
  const [draggingSongId, setDraggingSongId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number; startX: number; startY: number; moved: boolean }>({
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
    moved: false
  });
  const timelineCanvasRef = useRef<HTMLDivElement | null>(null);
  const songsRef = useRef<LoreSongData[]>(songs);
  const connectionsRef = useRef<SongTimelineConnection[]>(connections);

  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);

  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);

  const ytPlayerRef = useRef<any>(null);
  const selectedSongRef = useRef<LoreSongData | undefined>(undefined);
  const lyricsScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Carrega músicas e conexões (traços) do Firestore (wbSettings/loreSongs)
  useEffect(() => {
    let mounted = true;
    const loadFromFirestore = async () => {
      try {
        const snap = await getDoc(doc(db, 'wbSettings', 'loreSongs'));
        if (!mounted) return;
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.songs) && data.songs.length > 0) {
            const savedSongs: LoreSongData[] = data.songs;
            const defaults = buildDefaultLoreSongs();
            const mergedMap = new Map<string, LoreSongData>();
            defaults.forEach((d) => mergedMap.set(d.id, d));
            savedSongs.forEach((s, idx) => {
              const existing = mergedMap.get(s.id);
              const defPos = getDefaultNodePosition(idx);
              mergedMap.set(s.id, {
                ...(existing || {}),
                ...s,
                nodeX: typeof s.nodeX === 'number' ? s.nodeX : existing?.nodeX ?? defPos.x,
                nodeY: typeof s.nodeY === 'number' ? s.nodeY : existing?.nodeY ?? defPos.y,
                lyrics: Array.isArray(s.lyrics) ? s.lyrics : []
              });
            });
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

            if (Array.isArray(data.connections)) {
              setConnections(data.connections);
              try {
                localStorage.setItem(LORE_SONG_LINKS_CACHE_KEY, JSON.stringify(data.connections));
              } catch {
                // ignore
              }
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

  const curiositiesSong = useMemo(
    () => (curiositiesSongId ? songs.find((s) => s.id === curiositiesSongId) || null : null),
    [songs, curiositiesSongId]
  );

  useEffect(() => {
    selectedSongRef.current = selectedSong;
  }, [selectedSong]);

  // Sincroniza rascunhos quando troca de música selecionada
  useEffect(() => {
    if (!selectedSong) return;
    setDraftLoreTitle(selectedSong.loreTitle || '');
    setDraftLoreContext(selectedSong.loreContext || '');
    setDraftSongTitle(selectedSong.title || '');
    setDraftSongDuration(selectedSong.duration || '');
    setDraftCoverUrl(selectedSong.coverUrl || '');
    setDraftBackgroundUrl(selectedSong.backgroundUrl || '');
    setDraftRelatedCardIds(selectedSong.relatedCardIds || []);
    setBulkOriginalText((selectedSong.lyrics || []).map((l) => l.original).join('\n'));
    setBulkTranslationText((selectedSong.lyrics || []).map((l) => l.translation).join('\n'));
    setTimeInputDrafts({});
    updateSyncCursor(0);
  }, [selectedSong?.id]);

  useEffect(() => {
    if (adminMode === 'bulk_lyrics' && selectedSong) {
      setBulkOriginalText((selectedSong.lyrics || []).map((l) => l.original).join('\n'));
      setBulkTranslationText((selectedSong.lyrics || []).map((l) => l.translation).join('\n'));
    }
  }, [adminMode]);

  // Inicializa YouTube IFrame API
  useEffect(() => {
    let isMounted = true;

    const initPlayer = () => {
      if (!isMounted || !window.YT || !window.YT.Player) return;
      if (ytPlayerRef.current) return;

      const containerEl = document.getElementById('yt-lore-music-player');
      if (!containerEl) return;

      const initialVideoId =
        selectedSongRef.current?.videoId || FULL_LIGHT_DARK_TRACKS[0].youtubeId;

      ytPlayerRef.current = new window.YT.Player('yt-lore-music-player', {
        height: '180',
        width: '320',
        videoId: initialVideoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
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
            } else if (
              event.data === 2 ||
              event.data === 0 ||
              event.data === -1 ||
              event.data === 5
            ) {
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

  // Atualiza currentTime a cada 100ms
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

  // Persistência no Firestore (músicas + conexões de traços)
  const persistToFirestore = async (
    updatedSongs: LoreSongData[],
    updatedConnections: SongTimelineConnection[] = connectionsRef.current,
    successMessage?: string
  ) => {
    setSongs(updatedSongs);
    setConnections(updatedConnections);
    try {
      localStorage.setItem(LORE_SONGS_CACHE_KEY, JSON.stringify(updatedSongs));
      localStorage.setItem(LORE_SONG_LINKS_CACHE_KEY, JSON.stringify(updatedConnections));
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
          connections: updatedConnections,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
      if (successMessage) {
        setSaveFeedback(successMessage);
        setTimeout(() => setSaveFeedback(null), 2800);
      }
    } catch (err) {
      console.error('Erro ao salvar músicas da Lore no Firestore:', err);
    } finally {
      setSaving(false);
    }
  };

  // Tocar ou pausar uma música específica
  const handlePlayOrToggleSong = (song: LoreSongData) => {
    const player = ytPlayerRef.current;
    if (selectedSongId === song.id) {
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
      return;
    }

    setSelectedSongId(song.id);
    setCurrentTime(0);
    if (player && isPlayerReady) {
      try {
        player.loadVideoById(song.videoId);
        setIsPlaying(true);
      } catch {
        // ignore
      }
    }
  };

  // Clicar no bloco da música: seleciona/toca e abre "Curiosidades da Música" (ou linka com traço se estiver no modo Linkar)
  const handleClickSongBlock = (song: LoreSongData) => {
    if (isAdmin && isLinkingMode) {
      if (!linkSourceSongId) {
        setLinkSourceSongId(song.id);
        return;
      }
      if (linkSourceSongId === song.id) {
        setLinkSourceSongId(null);
        return;
      }
      // Verifica se já existe traço entre as duas músicas
      const exists = connections.some(
        (c) =>
          (c.fromId === linkSourceSongId && c.toId === song.id) ||
          (c.fromId === song.id && c.toId === linkSourceSongId)
      );
      const nextConns = exists
        ? connections.filter(
            (c) =>
              !(
                (c.fromId === linkSourceSongId && c.toId === song.id) ||
                (c.fromId === song.id && c.toId === linkSourceSongId)
              )
          )
        : [...connections, { fromId: linkSourceSongId, toId: song.id }];

      setLinkSourceSongId(null);
      persistToFirestore(
        songsRef.current,
        nextConns,
        exists ? 'Traço removido!' : 'Traço conectado!'
      );
      return;
    }

    if (selectedSongId !== song.id) {
      setSelectedSongId(song.id);
      setCurrentTime(0);
      const player = ytPlayerRef.current;
      if (player && isPlayerReady) {
        try {
          player.loadVideoById(song.videoId);
          setIsPlaying(true);
        } catch {
          // ignore
        }
      }
    }
    setCuriositiesSongId(song.id);
  };

  // Eventos de Arrastar Livremente (Drag & Drop) para o Admin na Linha do Tempo Modular (respeitando o Zoom)
  const handleNodePointerDown = (e: React.PointerEvent, song: LoreSongData) => {
    if (!isAdmin || isLinkingMode) return;
    // Ignora se clicou direto no botão de Play
    if ((e.target as HTMLElement).closest('[data-play-btn="true"]')) return;

    const canvasEl = timelineCanvasRef.current;
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const zoom = timelineZoomRef.current || 1;
    const pointerXInCanvas = (e.clientX - rect.left + canvasEl.scrollLeft) / zoom;
    const pointerYInCanvas = (e.clientY - rect.top + canvasEl.scrollTop) / zoom;

    dragOffsetRef.current = {
      offsetX: pointerXInCanvas - (song.nodeX ?? 0),
      offsetY: pointerYInCanvas - (song.nodeY ?? 0),
      startX: e.clientX,
      startY: e.clientY,
      moved: false
    };
    setDraggingSongId(song.id);
  };

  useEffect(() => {
    if (!draggingSongId) return;

    const handlePointerMove = (e: PointerEvent) => {
      const canvasEl = timelineCanvasRef.current;
      if (!canvasEl) return;
      const dx = Math.abs(e.clientX - dragOffsetRef.current.startX);
      const dy = Math.abs(e.clientY - dragOffsetRef.current.startY);
      if (dx > 5 || dy > 5) {
        dragOffsetRef.current.moved = true;
      }

      const rect = canvasEl.getBoundingClientRect();
      const zoom = timelineZoomRef.current || 1;
      const pointerXInCanvas = (e.clientX - rect.left + canvasEl.scrollLeft) / zoom;
      const pointerYInCanvas = (e.clientY - rect.top + canvasEl.scrollTop) / zoom;

      const newX = Math.max(16, Math.round(pointerXInCanvas - dragOffsetRef.current.offsetX));
      const newY = Math.max(16, Math.round(pointerYInCanvas - dragOffsetRef.current.offsetY));

      setSongs((prev) =>
        prev.map((s) =>
          s.id === draggingSongId ? { ...s, nodeX: newX, nodeY: newY } : s
        )
      );
    };

    const handlePointerUp = () => {
      const wasMoved = dragOffsetRef.current.moved;
      setDraggingSongId(null);
      if (wasMoved) {
        persistToFirestore(songsRef.current, connectionsRef.current);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingSongId]);

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

  const activeLyricLine = useMemo(() => {
    if (!selectedSong?.lyrics || selectedSong.lyrics.length === 0) return null;
    if (activeLyricIndex >= 0 && selectedSong.lyrics[activeLyricIndex]) {
      return selectedSong.lyrics[activeLyricIndex];
    }
    return selectedSong.lyrics[0];
  }, [selectedSong, activeLyricIndex]);

  // Auto-scroll no modal de sincronização
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

  // Processar letras coladas em lote (Original + Tradução lado a lado)
  const handleApplyBulkLyrics = async () => {
    if (!selectedSong) return;

    const origParsed = parseYouTubeSubtitleText(bulkOriginalText, false);
    const transParsed = parseYouTubeSubtitleText(bulkTranslationText, false);
    const hasDetectedTimestampsInOrig = origParsed.some((item) => item.time !== null);

    const nextLyrics: LyricLineItem[] = [];

    if (hasDetectedTimestampsInOrig) {
      const maxLen = Math.max(origParsed.length, transParsed.length);
      for (let i = 0; i < maxLen; i++) {
        const origItem = origParsed[i];
        const transItem = transParsed[i];
        const rawOrig = origItem?.text?.trim() || '';
        const rawTrans = transItem?.text?.trim() || '';
        if (!rawOrig && !rawTrans) continue;

        nextLyrics.push({
          id: selectedSong.lyrics?.[i]?.id || `line_${Date.now()}_${i}`,
          time: origItem?.time ?? selectedSong.lyrics?.[i]?.time ?? null,
          original: rawOrig,
          translation: rawTrans
        });
      }
    } else {
      const origLines = bulkOriginalText.split('\n');
      const transLines = bulkTranslationText.split('\n');
      const maxLen = Math.max(origLines.length, transLines.length);

      for (let i = 0; i < maxLen; i++) {
        let rawOrig = (origLines[i] ?? '').trim();
        let rawTrans = (transLines[i] ?? '').trim();
        if (!rawOrig && !rawTrans) continue;

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
    }

    const updatedSongs = songs.map((s) =>
      s.id === selectedSong.id
        ? { ...s, lyrics: nextLyrics, updatedAt: new Date().toISOString() }
        : s
    );

    await persistToFirestore(
      updatedSongs,
      connectionsRef.current,
      'Letras salvas!'
    );
    setAdminMode('sync_studio');
    updateSyncCursor(0);
  };

  const ytCaptionPreviewItems = useMemo(() => {
    const origCues = parseYouTubeSubtitleText(ytCaptionOriginalText, ytBilingualSingleBlock);
    const transCues = ytBilingualSingleBlock
      ? []
      : parseYouTubeSubtitleText(ytCaptionTranslationText, false);

    return origCues.map((cue, idx) => ({
      time: cue.time,
      original: cue.text,
      translation: ytBilingualSingleBlock
        ? cue.secondLine || ''
        : transCues[idx]?.text || ''
    }));
  }, [ytCaptionOriginalText, ytCaptionTranslationText, ytBilingualSingleBlock]);

  const handleApplyYouTubeCaptions = async () => {
    if (!selectedSong || ytCaptionPreviewItems.length === 0) return;

    const nextLyrics: LyricLineItem[] = ytCaptionPreviewItems.map((item, idx) => ({
      id: selectedSong.lyrics?.[idx]?.id || `line_${Date.now()}_${idx}`,
      time: item.time,
      original: item.original,
      translation: item.translation || selectedSong.lyrics?.[idx]?.translation || ''
    }));

    const updatedSongs = songs.map((s) =>
      s.id === selectedSong.id
        ? { ...s, lyrics: nextLyrics, updatedAt: new Date().toISOString() }
        : s
    );

    await persistToFirestore(
      updatedSongs,
      connectionsRef.current,
      `Legenda importada (${nextLyrics.length} versos)!`
    );
    setBulkOriginalText(nextLyrics.map((l) => l.original).join('\n'));
    setBulkTranslationText(nextLyrics.map((l) => l.translation).join('\n'));
    setTimeInputDrafts({});
    setAdminMode('sync_studio');
    updateSyncCursor(0);
  };

  // Marcar tempo do verso atual e avançar para o próximo
  const handleStampCurrentLine = (overrideIdx?: number) => {
    const currentSong = selectedSongRef.current || selectedSong;
    if (!currentSong) return;
    const list = currentSong.lyrics || [];
    if (list.length === 0) return;

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
    const baseIdx = typeof overrideIdx === 'number' ? overrideIdx : syncCursorRef.current;
    const targetIdx = Math.min(Math.max(0, baseIdx), list.length - 1);
    const stampedLineId = list[targetIdx]?.id || '';
    const nextCursor = targetIdx < list.length - 1 ? targetIdx + 1 : targetIdx;

    const updatedLyrics = list.map((line, idx) =>
      idx === targetIdx ? { ...line, time: stampedTime } : line
    );

    setSongs((prevSongs) =>
      prevSongs.map((s) =>
        s.id === currentSong.id ? { ...s, lyrics: updatedLyrics } : s
      )
    );

    if (stampedLineId) {
      setTimeInputDrafts((prev) => {
        if (!(stampedLineId in prev)) return prev;
        const copy = { ...prev };
        delete copy[stampedLineId];
        return copy;
      });
    }

    updateSyncCursor(nextCursor);
  };

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
        const maxIdx = Math.max(0, (selectedSongRef.current?.lyrics?.length || 1) - 1);
        updateSyncCursor(Math.min(maxIdx, syncCursorRef.current + 1));
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        updateSyncCursor(Math.max(0, syncCursorRef.current - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adminMode, syncCursorIndex, selectedSong, currentTime, songs]);

  const handleAdjustLineTime = (lineIdx: number, deltaSec: number) => {
    const currentSong = selectedSongRef.current || selectedSong;
    if (!currentSong) return;
    const adjustedLineId = currentSong.lyrics?.[lineIdx]?.id || '';
    setSongs((prev) =>
      prev.map((s) => {
        if (s.id !== currentSong.id) return s;
        const updatedLyrics = s.lyrics.map((line, idx) => {
          if (idx !== lineIdx) return line;
          const base = line.time ?? currentTime ?? 0;
          return {
            ...line,
            time: Math.max(0, Math.round((base + deltaSec) * 10) / 10)
          };
        });
        return { ...s, lyrics: updatedLyrics };
      })
    );
    if (adjustedLineId) {
      setTimeInputDrafts((prev) => {
        if (!(adjustedLineId in prev)) return prev;
        const copy = { ...prev };
        delete copy[adjustedLineId];
        return copy;
      });
    }
  };

  const handleUpdateLineField = (
    lineIdx: number,
    field: 'original' | 'translation' | 'time',
    value: string | number | null
  ) => {
    const activeSongId = selectedSong?.id;
    if (!activeSongId) return;
    setSongs((prev) =>
      prev.map((s) => {
        if (s.id !== activeSongId) return s;
        const updatedLyrics = s.lyrics.map((line, idx) =>
          idx === lineIdx ? { ...line, [field]: value } : line
        );
        return { ...s, lyrics: updatedLyrics };
      })
    );
  };

  const handleAddSingleLine = (afterIdx?: number) => {
    const currentSong = selectedSongRef.current || selectedSong;
    if (!currentSong) return;
    const newLine: LyricLineItem = {
      id: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      time: null,
      original: '',
      translation: ''
    };

    const currentList = [...(currentSong.lyrics || [])];
    const insertedIndex =
      afterIdx !== undefined && afterIdx >= 0 && afterIdx < currentList.length
        ? afterIdx + 1
        : currentList.length;

    currentList.splice(insertedIndex, 0, newLine);

    setSongs((prev) =>
      prev.map((s) =>
        s.id === currentSong.id ? { ...s, lyrics: currentList } : s
      )
    );
    updateSyncCursor(insertedIndex);
  };

  const handleRemoveSingleLine = (lineIdx: number) => {
    const currentSong = selectedSongRef.current || selectedSong;
    if (!currentSong) return;
    const nextLen = Math.max(0, (currentSong.lyrics?.length || 1) - 1);
    setSongs((prev) =>
      prev.map((s) => {
        if (s.id !== currentSong.id) return s;
        const updatedLyrics = s.lyrics.filter((_, idx) => idx !== lineIdx);
        return { ...s, lyrics: updatedLyrics };
      })
    );
    updateSyncCursor(Math.max(0, Math.min(syncCursorRef.current, Math.max(0, nextLen - 1))));
  };

  const handleSaveCuriosities = async () => {
    if (!selectedSong) return;
    const updatedSongs = songs.map((s) =>
      s.id === selectedSong.id
        ? {
            ...s,
            title: draftSongTitle.trim() || s.title,
            duration: draftSongDuration.trim() || s.duration,
            coverUrl: draftCoverUrl.trim() || s.coverUrl,
            backgroundUrl: draftBackgroundUrl.trim() || s.backgroundUrl,
            loreTitle: draftLoreTitle.trim(),
            loreContext: draftLoreContext,
            relatedCardIds: draftRelatedCardIds,
            updatedAt: new Date().toISOString()
          }
        : s
    );
    await persistToFirestore(
      updatedSongs,
      connectionsRef.current,
      'Curiosidades da música salvas!'
    );
    setAdminMode('none');
  };

  const handleCreateNewSong = async () => {
    const vid = extractYouTubeId(newSongYoutubeUrl);
    if (!vid || !newSongTitle.trim()) return;
    const newId = `song_${vid}_${Date.now()}`;
    const pos = getDefaultNodePosition(songs.length);
    const newEntry: LoreSongData = {
      id: newId,
      videoId: vid,
      title: newSongTitle.trim(),
      artist: 'Salazar Dias',
      album: 'Light Dark Official Soundtrack',
      duration: newSongDuration.trim() || '3:30',
      coverUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
      backgroundUrl: `https://i.ytimg.com/vi/${vid}/maxresdefault.jpg`,
      loreTitle: '',
      loreContext: '',
      chronologicalOrder: songs.length + 1,
      nodeX: pos.x,
      nodeY: pos.y,
      relatedCharacters: [],
      relatedCardIds: [],
      lyrics: []
    };
    const nextList = [...songs, newEntry];
    await persistToFirestore(nextList, connectionsRef.current, 'Música adicionada!');
    setNewSongYoutubeUrl('');
    setNewSongTitle('');
    setAdminMode('none');
    setSelectedSongId(newEntry.id);
  };

  const handleDeleteSong = async (songId: string) => {
    if (songs.length <= 1) return;
    const nextList = songs.filter((s) => s.id !== songId);
    const nextConns = connections.filter((c) => c.fromId !== songId && c.toId !== songId);
    await persistToFirestore(nextList, nextConns, 'Música removida.');
    if (selectedSongId === songId && nextList[0]) {
      setSelectedSongId(nextList[0].id);
    }
    if (curiositiesSongId === songId) {
      setCuriositiesSongId(null);
    }
  };

  // Tamanho total do canvas da Linha do Tempo Modular baseado nos blocos
  const canvasDimensions = useMemo(() => {
    let maxX = 1400;
    let maxY = 340;
    songs.forEach((s) => {
      if (typeof s.nodeX === 'number' && s.nodeX + NODE_WIDTH + 120 > maxX) {
        maxX = s.nodeX + NODE_WIDTH + 120;
      }
      if (typeof s.nodeY === 'number' && s.nodeY + NODE_HEIGHT + 80 > maxY) {
        maxY = s.nodeY + NODE_HEIGHT + 80;
      }
    });
    return { width: maxX, height: maxY };
  }, [songs]);

  const songMapById = useMemo(() => {
    const map = new Map<string, LoreSongData>();
    songs.forEach((s) => map.set(s.id, s));
    return map;
  }, [songs]);

  // Conjunto de músicas que já possuem pelo menos 1 ligação (traço)
  const linkedSongIdsSet = useMemo(() => {
    const set = new Set<string>();
    connections.forEach((c) => {
      if (songMapById.has(c.fromId) && songMapById.has(c.toId)) {
        set.add(c.fromId);
        set.add(c.toId);
      }
    });
    return set;
  }, [connections, songMapById]);

  const unlinkedSongsCount = useMemo(() => {
    return songs.filter((s) => !linkedSongIdsSet.has(s.id)).length;
  }, [songs, linkedSongIdsSet]);

  const curiositiesLinkedCards = useMemo(() => {
    if (!curiositiesSong?.relatedCardIds?.length) return [];
    return cards.filter((c) => curiositiesSong.relatedCardIds?.includes(c.id));
  }, [cards, curiositiesSong]);

  const bgImageSrc =
    selectedSong?.backgroundUrl ||
    selectedSong?.coverUrl ||
    'https://i.ytimg.com/vi/OD4j3ot0l8U/maxresdefault.jpg';

  return (
    <div className="fixed inset-0 z-[150] bg-[#08070b] text-white overflow-hidden flex flex-col select-none">
      {/* YouTube Player Oculto (Áudio em Tempo Real) */}
      <div className="fixed -left-[9999px] -top-[9999px] w-1 h-1 overflow-hidden pointer-events-none opacity-0">
        <div id="yt-lore-music-player" />
      </div>

      {/* IMAGEM DE FUNDO EM TELA CHEIA COM ZOOM DE ENQUADRAMENTO (REMOVE BORDAS DO YOUTUBE) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <img
          src={bgImageSrc}
          alt=""
          onError={(e) => {
            if (selectedSong?.coverUrl && e.currentTarget.src !== selectedSong.coverUrl) {
              e.currentTarget.src = selectedSong.coverUrl;
            }
          }}
          className="w-full h-full object-cover object-center opacity-40 scale-[1.35] transition-all duration-700"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 35%, rgba(25,12,12,0.3) 0%, rgba(7,7,11,0.86) 75%, rgba(5,5,8,0.97) 100%)'
          }}
        />
      </div>

      {/* TOPO: CONTROLES EXCLUSIVOS DO ADMIN + CONTROLES DE ZOOM DA TIMELINE + BOTÃO FECHAR JANELA */}
      <div className="relative z-30 flex items-center justify-between px-4 sm:px-6 pt-3 pb-1 gap-2 flex-wrap">
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsLinkingMode((v) => !v);
                  setLinkSourceSongId(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 border transition shadow-lg ${
                  isLinkingMode
                    ? 'bg-white text-slate-950 border-white'
                    : 'bg-black/70 hover:bg-black/90 text-slate-200 border-white/20'
                }`}
                title="Clique em uma música e depois em outra para criar ou remover um traço branco entre elas"
              >
                <Link2 size={13} />
                <span>
                  {isLinkingMode
                    ? linkSourceSongId
                      ? 'Clique na 2ª Música...'
                      : 'Modo Linkar Traços (Ativo)'
                    : 'Linkar com Traços'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setAdminMode(adminMode === 'sync_studio' ? 'none' : 'sync_studio')
                }
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 border transition shadow-lg ${
                  adminMode === 'sync_studio' || adminMode === 'bulk_lyrics'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-black/70 hover:bg-black/90 text-emerald-300 border-emerald-500/40'
                }`}
              >
                <Clock size={13} /> Sincronizar / Letra
              </button>

              <button
                type="button"
                onClick={() =>
                  setAdminMode(adminMode === 'edit_lore' ? 'none' : 'edit_lore')
                }
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 border transition shadow-lg ${
                  adminMode === 'edit_lore'
                    ? 'bg-purple-500 text-white border-purple-400'
                    : 'bg-black/70 hover:bg-black/90 text-purple-300 border-purple-500/40'
                }`}
              >
                <BookOpen size={13} /> Editar Curiosidades
              </button>

              <button
                type="button"
                onClick={() =>
                  setAdminMode(adminMode === 'add_song' ? 'none' : 'add_song')
                }
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1 border transition shadow-lg ${
                  adminMode === 'add_song'
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-black/70 hover:bg-black/90 text-amber-300 border-amber-500/40'
                }`}
              >
                <Plus size={13} /> Nova Música
              </button>

              {unlinkedSongsCount > 0 && (
                <span
                  className="px-2.5 py-1.5 rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-300 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg"
                  title="Músicas marcadas em vermelho na linha do tempo ainda não possuem nenhum traço de ligação"
                >
                  <Unlink size={12} className="text-rose-400" />
                  <span>{unlinkedSongsCount} sem ligação</span>
                </span>
              )}

              {saveFeedback && (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                  <Check size={12} /> {saveFeedback}
                </span>
              )}
            </>
          )}
        </div>

        {/* CONTROLES DE ZOOM DA TIMELINE + BOTÃO FECHAR */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1 bg-black/75 border border-white/20 rounded-xl px-2 py-1 shadow-xl">
            <button
              type="button"
              onClick={() => handleAdjustTimelineZoom(-0.15)}
              disabled={timelineZoom <= MIN_TIMELINE_ZOOM}
              className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-35 text-slate-200 hover:text-white transition"
              title="Diminuir Zoom da Linha do Tempo"
            >
              <ZoomOut size={14} />
            </button>
            <input
              type="range"
              min={MIN_TIMELINE_ZOOM}
              max={MAX_TIMELINE_ZOOM}
              step={0.05}
              value={timelineZoom}
              onChange={(e) => setTimelineZoom(parseFloat(e.target.value))}
              className="w-16 sm:w-20 accent-white h-1 bg-slate-700 rounded-lg cursor-pointer"
              title="Zoom da Linha do Tempo"
            />
            <span className="text-[10px] font-mono font-bold text-slate-300 w-9 text-center">
              {Math.round(timelineZoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => handleAdjustTimelineZoom(0.15)}
              disabled={timelineZoom >= MAX_TIMELINE_ZOOM}
              className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-35 text-slate-200 hover:text-white transition"
              title="Aumentar Zoom da Linha do Tempo"
            >
              <ZoomIn size={14} />
            </button>
            {Math.abs(timelineZoom - 1) > 0.01 && (
              <button
                type="button"
                onClick={() => setTimelineZoom(1)}
                className="p-1 rounded-lg hover:bg-white/10 text-amber-300 hover:text-amber-200 transition"
                title="Resetar Zoom (100%)"
              >
                <RotateCcw size={12} />
              </button>
            )}
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-black/70 hover:bg-black/90 border border-white/20 text-slate-200 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-xl transition"
            >
              <X size={15} /> Fechar
            </button>
          )}
        </div>
      </div>

      {/* ÁREA SUPERIOR CENTRAL: LETRA GRANDE SENDO EXIBIDA + TRADUÇÃO MENOR (IGUAL AO RASCUNHO) */}
      <div className="relative z-10 flex-1 min-h-[180px] flex flex-col items-center justify-center px-6 text-center pointer-events-none">
        {activeLyricLine ? (
          <div className="max-w-5xl mx-auto transition-all duration-300">
            <p className="text-2xl sm:text-4xl md:text-5xl font-semibold text-white tracking-wide leading-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]">
              {activeLyricLine.original || '♪'}
            </p>
            {activeLyricLine.translation && (
              <p className="mt-2 sm:mt-3 text-base sm:text-xl md:text-2xl font-normal text-white/90 tracking-wide drop-shadow-[0_2px_16px_rgba(0,0,0,0.95)]">
                {activeLyricLine.translation}
              </p>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <p className="text-2xl sm:text-4xl md:text-5xl font-semibold text-white/90 tracking-wide drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]">
              {selectedSong?.title || ''}
            </p>
            {selectedSong?.loreTitle && (
              <p className="mt-2 text-base sm:text-xl md:text-2xl text-white/75 drop-shadow-[0_2px_16px_rgba(0,0,0,0.95)]">
                {selectedSong.loreTitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ÁREA INFERIOR: LINHA DO TEMPO MODULAR COM ZOOM, BLOCOS ARRASTÁVEIS E TRAÇOS BRANCOS */}
      <div
        ref={timelineCanvasRef}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleAdjustTimelineZoom(e.deltaY < 0 ? 0.1 : -0.1);
          }
        }}
        className="relative z-20 h-[52vh] min-h-[310px] w-full overflow-auto custom-scrollbar"
      >
        {/* Wrapper dimensionado pelo Zoom para scroll natural */}
        <div
          className="relative mx-auto"
          style={{
            width: `${Math.round(canvasDimensions.width * timelineZoom)}px`,
            height: `${Math.round(canvasDimensions.height * timelineZoom)}px`
          }}
        >
          {/* Canvas escalado pelo timelineZoom */}
          <div
            className="relative origin-top-left transition-transform duration-75"
            style={{
              width: `${canvasDimensions.width}px`,
              height: `${canvasDimensions.height}px`,
              transform: `scale(${timelineZoom})`
            }}
          >
            {/* CAMADA SVG DOS TRAÇOS BRANCOS CONECTANDO AS MÚSICAS */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={canvasDimensions.width}
              height={canvasDimensions.height}
            >
              {connections.map((conn, idx) => {
                const fromSong = songMapById.get(conn.fromId);
                const toSong = songMapById.get(conn.toId);
                if (!fromSong || !toSong) return null;
                const x1 = (fromSong.nodeX ?? 0) + NODE_WIDTH / 2;
                const y1 = (fromSong.nodeY ?? 0) + NODE_HEIGHT / 2;
                const x2 = (toSong.nodeX ?? 0) + NODE_WIDTH / 2;
                const y2 = (toSong.nodeY ?? 0) + NODE_HEIGHT / 2;
                return (
                  <line
                    key={`${conn.fromId}_${conn.toId}_${idx}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#ffffff"
                    strokeWidth={7}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>

            {/* BLOCOS DE CADA MÚSICA (IMAGEM ENQUADRADA COM ZOOM, NOME, TEMPO E BOTÃO DE PLAY) */}
            {songs.map((song, idx) => {
              const isSelected = selectedSong?.id === song.id;
              const isThisPlaying = isSelected && isPlaying;
              const isLinkSource = isLinkingMode && linkSourceSongId === song.id;
              const isUnlinked = !linkedSongIdsSet.has(song.id);
              const pos = {
                x: typeof song.nodeX === 'number' ? song.nodeX : getDefaultNodePosition(idx).x,
                y: typeof song.nodeY === 'number' ? song.nodeY : getDefaultNodePosition(idx).y
              };

              return (
                <div
                  key={song.id}
                  onPointerDown={(e) => handleNodePointerDown(e, song)}
                  onClick={() => {
                    if (dragOffsetRef.current.moved) {
                      dragOffsetRef.current.moved = false;
                      return;
                    }
                    handleClickSongBlock(song);
                  }}
                  style={{
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    width: `${NODE_WIDTH}px`
                  }}
                  className={`absolute rounded-2xl bg-[#101217] p-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.85)] transition-shadow flex flex-col items-center ${
                    isAdmin && !isLinkingMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                  } ${
                    isLinkSource
                      ? 'ring-4 ring-white'
                      : isAdmin && isUnlinked
                      ? 'ring-2 ring-rose-500 shadow-[0_0_24px_rgba(244,63,94,0.45)]'
                      : isSelected
                      ? 'ring-2 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.35)]'
                      : 'hover:ring-1 hover:ring-white/40'
                  }`}
                >
                  {/* Marcação exclusiva para o Admin quando a música não tem nenhuma ligação */}
                  {isAdmin && isUnlinked && (
                    <div
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg whitespace-nowrap border border-rose-300/60"
                      title="Esta música ainda não está ligada a nenhuma outra na linha do tempo"
                    >
                      <Unlink size={9} />
                      <span>Sem Ligação</span>
                    </div>
                  )}

                  {/* Imagem Quadrada da Música Enquadrada com Zoom na Moldura + Botão de Play */}
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-black shrink-0 group border border-white/10">
                    <img
                      src={song.coverUrl}
                      alt={song.title}
                      draggable={false}
                      className="w-full h-full object-cover object-center scale-[1.36] transition-transform duration-300 group-hover:scale-[1.44]"
                    />
                    <button
                      type="button"
                      data-play-btn="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayOrToggleSong(song);
                      }}
                      className={`absolute inset-0 flex items-center justify-center bg-black/45 transition ${
                        isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      title={isThisPlaying ? 'Pausar' : 'Tocar'}
                    >
                      <div className="w-9 h-9 rounded-full bg-black/80 border border-white/30 flex items-center justify-center text-white shadow-lg">
                        {isThisPlaying ? (
                          <Pause size={16} />
                        ) : (
                          <Play size={16} className="fill-white ml-0.5" />
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Nome da Música */}
                  <p className="mt-2 text-xs font-extrabold text-white text-center leading-tight line-clamp-2 w-full">
                    {song.title}
                  </p>

                  {/* Tempo e Botão de Play Compacto */}
                  <div className="mt-1.5 w-full flex items-center justify-between px-1 pt-1 border-t border-white/10">
                    <span className="text-[10px] font-mono text-slate-400">
                      {song.duration}
                    </span>
                    <button
                      type="button"
                      data-play-btn="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayOrToggleSong(song);
                      }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition ${
                        isThisPlaying
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-white/10 hover:bg-white/25 text-white'
                      }`}
                      title={isThisPlaying ? 'Pausar' : 'Tocar'}
                    >
                      {isThisPlaying ? (
                        <Pause size={11} />
                      ) : (
                        <Play size={11} className="fill-current ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BARRA INFERIOR COMPACTA DE ÁUDIO (PLAY/PAUSE, TEMPO E BOTÃO DE CURIOSIDADES) */}
      {selectedSong && (
        <div className="relative z-30 bg-[#0a0b0f]/95 border-t border-white/10 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => handlePlayOrToggleSong(selectedSong)}
              className="w-9 h-9 rounded-full bg-white hover:bg-slate-200 text-slate-950 flex items-center justify-center shrink-0 shadow"
            >
              {isPlaying ? (
                <Pause size={16} />
              ) : (
                <Play size={16} className="fill-slate-950 ml-0.5" />
              )}
            </button>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-white truncate">
                {selectedSong.title}
              </p>
              <p className="text-[10px] font-mono text-slate-400">
                {formatSecondsShort(currentTime)} /{' '}
                {durationSec > 0 ? formatSecondsShort(durationSec) : selectedSong.duration}
              </p>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-2 hidden sm:block">
            <input
              type="range"
              min={0}
              max={durationSec > 0 ? durationSec : 240}
              step={0.1}
              value={Math.min(currentTime, durationSec > 0 ? durationSec : 240)}
              onChange={(e) => seekToSeconds(parseFloat(e.target.value), false)}
              className="w-full accent-white h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setCuriositiesSongId(
                  curiositiesSongId === selectedSong.id ? null : selectedSong.id
                )
              }
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 transition"
            >
              <BookOpen size={13} />
              <span>Curiosidades da Música</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                className="text-slate-400 hover:text-white"
              >
                {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-16 accent-white h-1 bg-slate-800 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL / PAINEL PÚBLICO: "CURIOSIDADES DA MÚSICA" (ABRE AO CLICAR EM UMA MÚSICA) */}
      {curiositiesSong && adminMode === 'none' && (
        <div
          className="fixed inset-0 z-[170] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setCuriositiesSongId(null)}
        >
          <div
            className="w-full max-w-xl bg-[#0e1017] border border-white/15 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/15 shrink-0 bg-black">
                  <img
                    src={curiositiesSong.coverUrl}
                    alt={curiositiesSong.title}
                    className="w-full h-full object-cover object-center scale-[1.36]"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 block">
                    Curiosidades da Música
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    {curiositiesSong.title}
                  </h3>
                  {curiositiesSong.loreTitle && (
                    <p className="text-xs text-slate-300 mt-0.5">
                      {curiositiesSong.loreTitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSongId(curiositiesSong.id);
                      setAdminMode('edit_lore');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-amber-300 flex items-center gap-1"
                  >
                    <Edit3 size={12} /> Editar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCuriositiesSongId(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {curiositiesSong.loreContext && curiositiesSong.loreContext.trim() ? (
              <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap bg-black/40 border border-white/10 rounded-xl p-4">
                {curiositiesSong.loreContext}
              </div>
            ) : (
              <div className="text-xs text-slate-400 bg-black/30 border border-white/5 rounded-xl p-5 text-center">
                Nenhuma curiosidade registrada para esta música ainda.
              </div>
            )}

            {curiositiesLinkedCards.length > 0 && (
              <div className="pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Personagens Relacionados
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {curiositiesLinkedCards.map((card) => (
                    <div
                      key={card.id}
                      onClick={() => onInspectCard?.(card)}
                      className="p-2 rounded-xl bg-black/50 hover:bg-black/80 border border-white/10 cursor-pointer flex items-center gap-2.5 transition"
                    >
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
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
        </div>
      )}

      {/* ========================================================================
          MODAIS EXCLUSIVOS DO ADMIN (SINCRONIZAR LETRA, LEGENDA YT, CURIOSIDADES, NOVA MÚSICA)
          ======================================================================== */}
      {isAdmin && adminMode !== 'none' && selectedSong && (
        <div className="fixed inset-0 z-[180] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#0b0b12] border border-white/15 rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar space-y-4">
            {/* CABEÇALHO DO MODAL ADMIN */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl overflow-hidden border border-amber-500/40 shrink-0 bg-black">
                  <img
                    src={selectedSong.coverUrl}
                    alt={selectedSong.title}
                    className="w-full h-full object-cover object-center scale-[1.36]"
                  />
                </div>
                <div>
                  <h3 className="font-cinzel text-base font-black text-white uppercase">
                    {selectedSong.title}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {adminMode === 'sync_studio'
                      ? 'Sincronização da Letra'
                      : adminMode === 'bulk_lyrics'
                      ? 'Colar Letras / Legenda do YouTube'
                      : adminMode === 'edit_lore'
                      ? 'Editar Curiosidades da Música'
                      : 'Adicionar Nova Música'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdminMode('none')}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* MINI PLAYER DENTRO DO MODAL ADMIN PARA SINCRONIZAR COM FACILIDADE */}
            {(adminMode === 'sync_studio' || adminMode === 'bulk_lyrics') && (
              <div className="bg-[#12121e] border border-amber-500/30 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => seekToSeconds(currentTime - 5)}
                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300"
                  >
                    -5s
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePlayOrToggleSong(selectedSong)}
                    className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow"
                  >
                    {isPlaying ? (
                      <Pause size={16} />
                    ) : (
                      <Play size={16} className="fill-slate-950 ml-0.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => seekToSeconds(currentTime + 5)}
                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-xs font-mono text-slate-300"
                  >
                    +5s
                  </button>
                  <div className="flex-1">
                    <input
                      type="range"
                      min={0}
                      max={durationSec > 0 ? durationSec : 240}
                      step={0.1}
                      value={Math.min(currentTime, durationSec > 0 ? durationSec : 240)}
                      onChange={(e) => seekToSeconds(parseFloat(e.target.value), false)}
                      className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                  <span className="text-xs font-mono text-amber-300 shrink-0">
                    {formatSeconds(currentTime)}
                  </span>
                </div>
              </div>
            )}

            {/* MODO 1: SINCRONIZADOR DE LETRA (LAYOUT COMPACTO SOLICITADO) */}
            {adminMode === 'sync_studio' && (
              <div className="space-y-4">
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedSong.lyrics || selectedSong.lyrics.length === 0) {
                        handleAddSingleLine();
                      } else {
                        handleStampCurrentLine();
                      }
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_0_25px_rgba(16,185,129,0.3)] transition"
                  >
                    <Clock size={18} className="shrink-0" />
                    <span>
                      Marcar Tempo ({formatSeconds(currentTime)}) &amp; Próximo Verso
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      persistToFirestore(
                        songs,
                        connectionsRef.current,
                        'Sincronização salva!'
                      )
                    }
                    className="py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shrink-0 transition"
                  >
                    <Save size={16} />
                    <span>{saving ? 'Salvando...' : 'Salvar Sincronização'}</span>
                  </button>
                </div>

                <div className="bg-[#08080e] border border-white/10 rounded-2xl p-4 flex flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Languages size={16} className="text-amber-400" />
                      <h4 className="font-cinzel text-sm font-black uppercase tracking-wider text-white">
                        Letra da Música
                      </h4>
                    </div>

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
                      >
                        Auto-Roll: {autoScrollEnabled ? 'ON' : 'OFF'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setBulkImportTab('yt_captions');
                          setAdminMode('bulk_lyrics');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white text-slate-950 hover:bg-slate-200 text-[10px] font-extrabold uppercase transition"
                      >
                        Legenda YT
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setBulkImportTab('plain');
                          setAdminMode('bulk_lyrics');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase transition"
                      >
                        Colar Texto
                      </button>
                    </div>
                  </div>

                  <div
                    ref={lyricsScrollContainerRef}
                    className="h-[390px] overflow-y-auto pr-2 space-y-2.5 custom-scrollbar"
                  >
                    {selectedSong.lyrics.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 gap-3">
                        <p className="text-xs text-slate-400">
                          Nenhum verso cadastrado nesta música.
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setBulkImportTab('yt_captions');
                              setAdminMode('bulk_lyrics');
                            }}
                            className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs uppercase"
                          >
                            Colar Legenda YT
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBulkImportTab('plain');
                              setAdminMode('bulk_lyrics');
                            }}
                            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase"
                          >
                            Colar Letra Original e Tradução
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddSingleLine()}
                            className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold text-xs uppercase"
                          >
                            + Verso Manual
                          </button>
                        </div>
                      </div>
                    ) : (
                      selectedSong.lyrics.map((line, idx) => {
                        const isSyncTarget = syncCursorIndex === idx;
                        return (
                          <div
                            key={line.id || idx}
                            ref={(el) => {
                              if (line.id) lineRefs.current[line.id] = el;
                            }}
                            onClick={() => updateSyncCursor(idx)}
                            className={`rounded-xl p-3 transition-all border ${
                              isSyncTarget
                                ? 'bg-emerald-950/50 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                : 'bg-[#101018]/70 border-white/5 hover:border-white/20'
                            }`}
                          >
                            <div
                              className="space-y-1.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => updateSyncCursor(idx)}
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold transition ${
                                    isSyncTarget
                                      ? 'bg-emerald-500 text-slate-950'
                                      : 'bg-white/5 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  #{idx + 1}
                                </button>
                                <input
                                  type="text"
                                  placeholder="00:00.0"
                                  value={
                                    timeInputDrafts[line.id] !== undefined
                                      ? timeInputDrafts[line.id]
                                      : line.time !== null && line.time !== undefined
                                      ? formatSeconds(line.time)
                                      : ''
                                  }
                                  onFocus={() => {
                                    updateSyncCursor(idx);
                                    setTimeInputDrafts((prev) => ({
                                      ...prev,
                                      [line.id]:
                                        line.time !== null && line.time !== undefined
                                          ? formatSeconds(line.time)
                                          : ''
                                    }));
                                  }}
                                  onChange={(e) => {
                                    const rawVal = e.target.value;
                                    setTimeInputDrafts((prev) => ({
                                      ...prev,
                                      [line.id]: rawVal
                                    }));
                                    if (!rawVal.trim()) {
                                      handleUpdateLineField(idx, 'time', null);
                                    } else {
                                      const parsed = parseTimeInput(rawVal);
                                      if (parsed !== null) {
                                        handleUpdateLineField(idx, 'time', parsed);
                                      }
                                    }
                                  }}
                                  onBlur={() => {
                                    const rawVal = timeInputDrafts[line.id];
                                    if (rawVal !== undefined) {
                                      const parsed = rawVal.trim() ? parseTimeInput(rawVal) : null;
                                      handleUpdateLineField(idx, 'time', parsed);
                                      setTimeInputDrafts((prev) => {
                                        const copy = { ...prev };
                                        delete copy[line.id];
                                        return copy;
                                      });
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  className="w-24 bg-black/80 border border-amber-500/40 focus:border-amber-400 rounded px-2 py-0.5 text-[11px] font-mono text-amber-300 outline-none"
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
                                  onClick={() => handleStampCurrentLine(idx)}
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
                                  onClick={() => handleAddSingleLine(idx)}
                                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-[10px] font-bold text-slate-300 flex items-center gap-0.5"
                                >
                                  <Plus size={11} /> Verso
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSingleLine(idx)}
                                  className="ml-auto p-1 text-slate-500 hover:text-rose-400"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>

                              {(lyricDisplayMode === 'both' || lyricDisplayMode === 'original') && (
                                <input
                                  type="text"
                                  value={line.original}
                                  onChange={(e) =>
                                    handleUpdateLineField(idx, 'original', e.target.value)
                                  }
                                  placeholder="Letra original..."
                                  className="w-full bg-black/60 border border-white/10 rounded px-2.5 py-1 text-xs text-white font-semibold"
                                />
                              )}
                              {(lyricDisplayMode === 'both' ||
                                lyricDisplayMode === 'translation') && (
                                <input
                                  type="text"
                                  value={line.translation}
                                  onChange={(e) =>
                                    handleUpdateLineField(idx, 'translation', e.target.value)
                                  }
                                  placeholder="Tradução em português..."
                                  className="w-full bg-black/60 border border-white/10 rounded px-2.5 py-1 text-xs text-cyan-200"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* MODO 2: COLAR LETRAS OU SYNC DE LEGENDA DO YOUTUBE */}
            {adminMode === 'bulk_lyrics' && (
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setBulkImportTab('yt_captions')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                      bulkImportTab === 'yt_captions'
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'text-emerald-300/80 hover:text-white'
                    }`}
                  >
                    Colar Sync de Legenda do YouTube (.txt / .sbv / .srt)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkImportTab('plain')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                      bulkImportTab === 'plain'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Letra Linha por Linha (Sem Tempos)
                  </button>
                </div>

                {bulkImportTab === 'yt_captions' ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ytBilingualSingleBlock}
                          onChange={(e) => setYtBilingualSingleBlock(e.target.checked)}
                          className="accent-emerald-500 rounded"
                        />
                        <span>
                          Legenda única já com Original + Tradução no mesmo bloco
                        </span>
                      </label>

                      <label className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] font-bold text-amber-300 cursor-pointer">
                        Carregar arquivo (.txt / .sbv / .srt)
                        <input
                          type="file"
                          accept=".txt,.sbv,.srt,.vtt,.lrc"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              if (typeof reader.result === 'string') {
                                setYtCaptionOriginalText(reader.result);
                              }
                            };
                            reader.readAsText(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>

                    <div
                      className={`grid grid-cols-1 ${
                        ytBilingualSingleBlock ? '' : 'sm:grid-cols-2'
                      } gap-3`}
                    >
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-emerald-300 mb-1">
                          Texto de Sync da Legenda do YouTube (Com Tempos)
                        </label>
                        <textarea
                          rows={10}
                          value={ytCaptionOriginalText}
                          onChange={(e) => setYtCaptionOriginalText(e.target.value)}
                          placeholder={
                            '0:00:12.340,0:00:16.500\nIn the shadows of the ancient stars\n\n0:00:16.500,0:00:21.000\nTwo souls bound by fire and steel'
                          }
                          className="w-full bg-black/70 border border-emerald-500/40 rounded-xl p-3 text-xs text-white font-mono leading-relaxed"
                        />
                      </div>

                      {!ytBilingualSingleBlock && (
                        <div>
                          <label className="block text-[11px] font-bold uppercase text-cyan-300 mb-1">
                            Tradução PT-BR (Com tempos do YT ou 1 verso por linha)
                          </label>
                          <textarea
                            rows={10}
                            value={ytCaptionTranslationText}
                            onChange={(e) => setYtCaptionTranslationText(e.target.value)}
                            placeholder={
                              'Nas sombras das estrelas ancestrais\nDuas almas unidas pelo fogo e aço'
                            }
                            className="w-full bg-black/70 border border-cyan-500/30 rounded-xl p-3 text-xs text-cyan-100 font-mono leading-relaxed"
                          />
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 flex items-center justify-between text-xs">
                      <span className="text-slate-300">
                        Versos reconhecidos:{' '}
                        <strong className="text-emerald-400">
                          {ytCaptionPreviewItems.length}
                        </strong>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAdminMode('sync_studio')}
                          className="px-3 py-1.5 rounded-lg border border-white/15 text-slate-300"
                        >
                          Voltar
                        </button>
                        <button
                          type="button"
                          disabled={saving || ytCaptionPreviewItems.length === 0}
                          onClick={handleApplyYouTubeCaptions}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black uppercase"
                        >
                          Importar Legenda YT
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-amber-300 mb-1">
                          Letra Original (1 verso por linha)
                        </label>
                        <textarea
                          rows={10}
                          value={bulkOriginalText}
                          onChange={(e) => setBulkOriginalText(e.target.value)}
                          className="w-full bg-black/70 border border-white/15 rounded-xl p-3 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-cyan-300 mb-1">
                          Tradução PT-BR (1 verso por linha)
                        </label>
                        <textarea
                          rows={10}
                          value={bulkTranslationText}
                          onChange={(e) => setBulkTranslationText(e.target.value)}
                          className="w-full bg-black/70 border border-white/15 rounded-xl p-3 text-xs text-cyan-100 font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAdminMode('sync_studio')}
                        className="px-3 py-1.5 rounded-lg border border-white/15 text-xs text-slate-300"
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyBulkLyrics}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase"
                      >
                        Salvar Versos &amp; Sincronizar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODO 3: EDITAR CURIOSIDADES DA MÚSICA, CAPA E IMAGEM DE FUNDO */}
            {adminMode === 'edit_lore' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      Nome da Música
                    </label>
                    <input
                      type="text"
                      value={draftSongTitle}
                      onChange={(e) => setDraftSongTitle(e.target.value)}
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      Tempo / Duração
                    </label>
                    <input
                      type="text"
                      value={draftSongDuration}
                      onChange={(e) => setDraftSongDuration(e.target.value)}
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      URL da Imagem do Bloco (Capa)
                    </label>
                    <input
                      type="text"
                      value={draftCoverUrl}
                      onChange={(e) => setDraftCoverUrl(e.target.value)}
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      URL da Arte de Fundo da Tela (Opcional)
                    </label>
                    <input
                      type="text"
                      value={draftBackgroundUrl}
                      onChange={(e) => setDraftBackgroundUrl(e.target.value)}
                      placeholder="Arte grande exibida atrás da letra..."
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-purple-300 mb-1">
                    Subtítulo / Arco (Opcional)
                  </label>
                  <input
                    type="text"
                    value={draftLoreTitle}
                    onChange={(e) => setDraftLoreTitle(e.target.value)}
                    placeholder="Ex: Arco de Arkham"
                    className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-purple-300 mb-1">
                    Curiosidades da Música
                  </label>
                  <textarea
                    rows={8}
                    value={draftLoreContext}
                    onChange={(e) => setDraftLoreContext(e.target.value)}
                    placeholder="Escreva aqui as curiosidades e a história desta música..."
                    className="w-full bg-black/60 border border-white/15 rounded-xl p-3 text-xs text-slate-100 leading-relaxed"
                  />
                </div>

                <div className="border-t border-white/10 pt-3">
                  <label className="block text-[11px] font-bold uppercase text-amber-300 mb-1">
                    Personagens Relacionados ({draftRelatedCardIds.length})
                  </label>
                  <input
                    type="text"
                    value={cardSearchTerm}
                    onChange={(e) => setCardSearchTerm(e.target.value)}
                    placeholder="Filtrar personagem..."
                    className="w-full bg-black/60 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white mb-2"
                  />
                  <div className="max-h-32 overflow-y-auto grid grid-cols-2 gap-1 p-1.5 bg-black/40 border border-white/10 rounded-xl custom-scrollbar">
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
                            onClick={() =>
                              setDraftRelatedCardIds((prev) =>
                                isLinked
                                  ? prev.filter((id) => id !== card.id)
                                  : [...prev, card.id]
                              )
                            }
                            className={`px-2 py-1 rounded text-left text-xs flex items-center justify-between ${
                              isLinked
                                ? 'bg-purple-900/50 border border-purple-400 text-white font-bold'
                                : 'hover:bg-white/5 text-slate-400'
                            }`}
                          >
                            <span className="truncate">{card.name}</span>
                            {isLinked && <Check size={12} className="text-purple-300 shrink-0" />}
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  {songs.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteSong(selectedSong.id);
                        setAdminMode('none');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-xs font-bold text-rose-300 flex items-center gap-1"
                    >
                      <Trash2 size={13} /> Excluir Música
                    </button>
                  ) : (
                    <div />
                  )}
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
                      disabled={saving}
                      onClick={handleSaveCuriosities}
                      className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-black text-xs uppercase flex items-center gap-1.5"
                    >
                      <Save size={14} /> Salvar Curiosidades
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODO 4: ADICIONAR NOVA MÚSICA */}
            {adminMode === 'add_song' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      Link ou ID do YouTube *
                    </label>
                    <input
                      type="text"
                      value={newSongYoutubeUrl}
                      onChange={(e) => setNewSongYoutubeUrl(e.target.value)}
                      placeholder="https://youtu.be/..."
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
                      placeholder="Ex: My Lady"
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                      Tempo / Duração
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
                    disabled={!newSongYoutubeUrl.trim() || !newSongTitle.trim() || saving}
                    onClick={handleCreateNewSong}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs uppercase"
                  >
                    Criar Bloco na Linha do Tempo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
