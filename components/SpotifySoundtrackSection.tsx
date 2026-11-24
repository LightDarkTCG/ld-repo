import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

export interface FullMicroTrack {
  youtubeId: string;
  title: string;
  fullTitle: string;
  durationLabel: string;
}

const DEFAULT_VOLUME_PERCENT = 40; // 40%

// Todas as faixas completas oficiais de Salazar Dias (YouTube Music / Topic)
export const FULL_LIGHT_DARK_TRACKS: FullMicroTrack[] = [
  {
    youtubeId: 'OD4j3ot0l8U',
    title: 'The Dragon and Elf',
    fullTitle: 'The Dragon and Elf (Toca do Salazar) — Salazar Dias',
    durationLabel: '3:52'
  },
  {
    youtubeId: 'b_75bsZrbJk',
    title: 'The Blank Sheet',
    fullTitle: 'The Blank Sheet — Salazar Dias',
    durationLabel: '5:31'
  },
  {
    youtubeId: '7YRvEWN6h_8',
    title: 'My Moon',
    fullTitle: 'My Moon — Salazar Dias',
    durationLabel: '4:46'
  },
  {
    youtubeId: 'JmiLjKTZV64',
    title: 'Blood Soldier',
    fullTitle: 'Blood Soldier — Salazar Dias',
    durationLabel: '3:35'
  },
  {
    youtubeId: 'zhNRyugrM8A',
    title: 'Broken Doll',
    fullTitle: 'Broken Doll — Salazar Dias',
    durationLabel: '2:46'
  },
  {
    youtubeId: 'O50KYgW7bm0',
    title: 'Heir of Chaos',
    fullTitle: 'Heir of Chaos — Salazar Dias',
    durationLabel: '5:48'
  },
  {
    youtubeId: 'kZrh7MLjAvg',
    title: 'ACROSS THE MACROVERSE',
    fullTitle: 'ACROSS THE MACROVERSE — Salazar Dias',
    durationLabel: '4:50'
  },
  {
    youtubeId: 'oFDJASwEdgI',
    title: 'Shadows of Arkham',
    fullTitle: 'Shadows of Arkham (Toca do Salazar) — Salazar Dias',
    durationLabel: '4:50'
  },
  {
    youtubeId: 'drgKwlW7ME0',
    title: 'Last Drink',
    fullTitle: 'Last Drink — Salazar Dias',
    durationLabel: '4:55'
  },
  {
    youtubeId: 'aS-X3uLN2bo',
    title: 'Sacrifice',
    fullTitle: 'Sacrifice — Salazar Dias',
    durationLabel: '4:20'
  },
  {
    youtubeId: 'rN_nGWQHpMo',
    title: 'Fall of Macroverse',
    fullTitle: 'Fall of Macroverse — Salazar Dias',
    durationLabel: '5:20'
  },
  {
    youtubeId: 'UGBUoXlg5Qs',
    title: 'The Lady of Time',
    fullTitle: 'The Lady of Time (Toca do Salazar) — Salazar Dias',
    durationLabel: '4:32'
  },
  {
    youtubeId: 'gddLujQfsVE',
    title: 'Reverse Universe',
    fullTitle: 'Reverse Universe — Salazar Dias',
    durationLabel: '3:24'
  },
  {
    youtubeId: 'dCgDGlHDZ9o',
    title: 'For The Glory',
    fullTitle: 'For The Glory — Salazar Dias',
    durationLabel: '5:32'
  },
  {
    youtubeId: 'yoeXf9-W9IA',
    title: "The night's true light!",
    fullTitle: "The night's true light! — Salazar Dias",
    durationLabel: '4:31'
  },
  {
    youtubeId: 'OosH6HzKzX0',
    title: 'I Promisse',
    fullTitle: 'I Promisse — Salazar Dias',
    durationLabel: '5:18'
  },
  {
    youtubeId: 'n7bOOcFaPcc',
    title: 'I Dare You',
    fullTitle: 'I Dare You — Salazar Dias',
    durationLabel: '4:12'
  },
  {
    youtubeId: 'go5Gekjpe2c',
    title: 'Destino',
    fullTitle: 'Destino — Salazar Dias',
    durationLabel: '4:50'
  },
  {
    youtubeId: '5lUBZv6TQhs',
    title: 'The Chosen',
    fullTitle: 'The Chosen — Salazar Dias',
    durationLabel: '4:25'
  },
  {
    youtubeId: 'FcBWUaV5lH0',
    title: 'Madness is Clarity',
    fullTitle: 'Madness is Clarity — Salazar Dias',
    durationLabel: '4:05'
  },
  {
    youtubeId: 'y7xSgnIEkoo',
    title: 'My Lady',
    fullTitle: 'My Lady — Salazar Dias',
    durationLabel: '5:28'
  },
  {
    youtubeId: 'MZnW-9tzF_8',
    title: 'Never be like you.',
    fullTitle: 'Never be like you. — Salazar Dias',
    durationLabel: '6:32'
  }
];

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface NavbarSpotifyMicroPlayerProps {
  isHomePage?: boolean;
}

export const NavbarSpotifyMicroPlayer: React.FC<NavbarSpotifyMicroPlayerProps> = ({
  isHomePage = true,
}) => {
  const [tracks] = useState<FullMicroTrack[]>(FULL_LIGHT_DARK_TRACKS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false);
  const userPausedRef = useRef(false);
  const isHomePageRef = useRef(isHomePage);
  const currentIndexRef = useRef(0);
  const containerIdRef = useRef(`yt_micro_player_${Math.random().toString(36).slice(2, 8)}`);

  isHomePageRef.current = isHomePage;
  currentIndexRef.current = currentIndex;
  const currentTrack = tracks[currentIndex] || tracks[0];

  const isAllowedToPlay = () => {
    const isTabVisible = typeof document !== 'undefined' ? !document.hidden && document.visibilityState !== 'hidden' : true;
    return isHomePageRef.current && isTabVisible && !userPausedRef.current;
  };

  const pausePlayerSilently = () => {
    if (playerRef.current && playerReadyRef.current) {
      try {
        playerRef.current.pauseVideo?.();
      } catch {
        // ignore
      }
    }
    setIsPlaying(false);
  };

  const resumePlayerIfAllowed = () => {
    if (!isAllowedToPlay() || !playerRef.current || !playerReadyRef.current) return;
    try {
      playerRef.current.unMute?.();
      playerRef.current.setVolume?.(DEFAULT_VOLUME_PERCENT);
      playerRef.current.playVideo?.();
      setIsPlaying(true);
    } catch {
      // ignore
    }
  };

  const advanceToNextTrack = () => {
    setCurrentIndex((prev) => {
      const next = (prev + 1) % tracks.length;
      if (playerRef.current && playerReadyRef.current) {
        try {
          playerRef.current.setVolume(DEFAULT_VOLUME_PERCENT);
          if (isAllowedToPlay()) {
            playerRef.current.loadVideoById(tracks[next].youtubeId);
            playerRef.current.playVideo();
            setIsPlaying(true);
          } else {
            playerRef.current.cueVideoById(tracks[next].youtubeId);
            setIsPlaying(false);
          }
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  // Pause immediately when leaving the home page; resume when returning to the home page (if not manually paused)
  useEffect(() => {
    isHomePageRef.current = isHomePage;
    if (!isHomePage) {
      pausePlayerSilently();
    } else {
      resumePlayerIfAllowed();
    }
  }, [isHomePage]);

  // Pause immediately when switching browser tabs; resume when returning to the tab on the home page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        pausePlayerSilently();
      } else {
        resumePlayerIfAllowed();
      }
    };

    const handlePageHide = () => {
      pausePlayerSilently();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const tryPlayCurrent = () => {
      if (!isAllowedToPlay() || !playerRef.current || !playerReadyRef.current) return;
      try {
        playerRef.current.unMute?.();
        playerRef.current.setVolume?.(DEFAULT_VOLUME_PERCENT);
        playerRef.current.playVideo?.();
      } catch {
        // ignore
      }
    };

    const handleFirstInteraction = (e: Event) => {
      if (userPausedRef.current) {
        cleanupListeners();
        return;
      }
      if (!isAllowedToPlay()) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-spotify-micro-toggle="true"]')) {
        cleanupListeners();
        return;
      }
      if (!playerRef.current || !playerReadyRef.current) return;
      try {
        const state = playerRef.current.getPlayerState?.();
        if (state !== 1) {
          tryPlayCurrent();
        } else {
          cleanupListeners();
        }
      } catch {
        tryPlayCurrent();
      }
    };

    const cleanupListeners = () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

    const initPlayer = () => {
      if (!isMounted || !window.YT || !window.YT.Player) return;
      if (playerRef.current) return;

      playerRef.current = new window.YT.Player(containerIdRef.current, {
        height: '1',
        width: '1',
        videoId: tracks[currentIndexRef.current].youtubeId,
        playerVars: {
          autoplay: isAllowedToPlay() ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0
        },
        events: {
          onReady: (event: any) => {
            if (!isMounted) return;
            playerReadyRef.current = true;
            try {
              event.target.unMute();
              event.target.setVolume(DEFAULT_VOLUME_PERCENT);
              if (isAllowedToPlay()) {
                event.target.playVideo();
              } else {
                event.target.pauseVideo();
                setIsPlaying(false);
              }
            } catch {
              // ignore
            }
          },
          onStateChange: (event: any) => {
            if (!isMounted) return;
            // YT.PlayerState: ENDED = 0, PLAYING = 1, PAUSED = 2
            if (event.data === 0) {
              advanceToNextTrack();
            } else if (event.data === 1) {
              // Guard: if not on home page or tab is hidden, force pause immediately
              const isTabVisible = !document.hidden && document.visibilityState !== 'hidden';
              if (!isHomePageRef.current || !isTabVisible || userPausedRef.current) {
                try {
                  event.target.pauseVideo();
                } catch {
                  // ignore
                }
                setIsPlaying(false);
                return;
              }
              try {
                event.target.unMute();
                event.target.setVolume(DEFAULT_VOLUME_PERCENT);
              } catch {
                // ignore
              }
              setIsPlaying(true);
              cleanupListeners();
            } else if (event.data === 2) {
              setIsPlaying(false);
            }
          },
          onError: () => {
            if (!isMounted) return;
            advanceToNextTrack();
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        initPlayer();
      };
    }

    window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
    window.addEventListener('keydown', handleFirstInteraction, { passive: true });
    window.addEventListener('touchstart', handleFirstInteraction, { passive: true });

    return () => {
      isMounted = false;
      cleanupListeners();
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
        playerReadyRef.current = false;
      }
    };
  }, []);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p || !playerReadyRef.current) return;

    try {
      const state = p.getPlayerState?.();
      if (state === 1 || isPlaying) {
        userPausedRef.current = true;
        p.pauseVideo();
        setIsPlaying(false);
      } else {
        userPausedRef.current = false;
        if (!isHomePageRef.current || document.hidden) return;
        p.unMute?.();
        p.setVolume?.(DEFAULT_VOLUME_PERCENT);
        p.playVideo();
        setIsPlaying(true);
      }
    } catch {
      // ignore
    }
  };

  const handlePrev = () => {
    userPausedRef.current = false;
    setCurrentIndex((prev) => {
      const next = (prev - 1 + tracks.length) % tracks.length;
      if (playerRef.current && playerReadyRef.current) {
        try {
          playerRef.current.unMute?.();
          playerRef.current.setVolume?.(DEFAULT_VOLUME_PERCENT);
          if (isAllowedToPlay()) {
            playerRef.current.loadVideoById(tracks[next].youtubeId);
            playerRef.current.playVideo();
            setIsPlaying(true);
          } else {
            playerRef.current.cueVideoById(tracks[next].youtubeId);
            setIsPlaying(false);
          }
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const handleNext = () => {
    userPausedRef.current = false;
    advanceToNextTrack();
  };

  return (
    <div
      data-tour-id="tour-music-player"
      className="flex items-center gap-1 bg-slate-950/90 border border-slate-800 rounded-lg px-2 py-1 h-[30px] shrink-0 relative"
      title={`${currentTrack.fullTitle} (${currentTrack.durationLabel}) • Volume 40%`}
    >
      {/* Hidden 1x1 YouTube Music / Topic Player for Full-Length Tracks */}
      <div className="w-0 h-0 overflow-hidden opacity-0 pointer-events-none absolute">
        <div id={containerIdRef.current} />
      </div>

      <button
        type="button"
        onClick={handlePrev}
        className="p-0.5 text-slate-400 hover:text-white transition active:scale-90"
        title="Música anterior"
      >
        <SkipBack size={11} />
      </button>

      <button
        type="button"
        data-spotify-micro-toggle="true"
        onClick={togglePlay}
        className={`p-1 rounded transition active:scale-90 ${
          isPlaying
            ? 'text-emerald-400 hover:text-emerald-300'
            : 'text-purple-400 hover:text-white'
        }`}
        title={isPlaying ? 'Pausar música' : 'Tocar música'}
      >
        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
      </button>

      <button
        type="button"
        onClick={handleNext}
        className="p-0.5 text-slate-400 hover:text-white transition active:scale-90"
        title="Próxima música"
      >
        <SkipForward size={11} />
      </button>

      <span className="text-[10px] font-medium text-slate-300 max-w-[85px] xl:max-w-[110px] truncate select-none ml-0.5">
        {currentTrack.title}
      </span>
    </div>
  );
};
