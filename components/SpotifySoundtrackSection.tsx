import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

export interface SpotifyMicroTrack {
  uri: string;
  title: string;
  fullTitle?: string;
  subtitle?: string;
  audioUrl: string;
}

const DEFAULT_VOLUME = 0.4; // 40%

const DEFAULT_LIGHT_DARK_TRACKS: SpotifyMicroTrack[] = [
  {
    uri: 'spotify:track:3MH4UlLaUUNZB8kN6viikE',
    title: 'The Dragon and Elf',
    fullTitle: 'The Dragon and Elf - Toca do Salazar',
    subtitle: 'Salazar Dias',
    audioUrl: 'https://p.scdn.co/mp3-preview/f2b9e5e26c89584a789b4b19c3198929a5c851a6'
  },
  {
    uri: 'spotify:track:3e20V5QWeXMRPppedi7fNK',
    title: 'The Blank Sheet',
    fullTitle: 'The Blank Sheet',
    subtitle: 'Salazar Dias',
    audioUrl: 'https://p.scdn.co/mp3-preview/80f0c2110955b7aa90e557968f1fce83cbdbc13b'
  },
  {
    uri: 'spotify:track:1oSPZW7lRR5x9yBhWBbbBt',
    title: 'My Moon',
    fullTitle: 'My Moon',
    subtitle: 'Salazar Dias',
    audioUrl: 'https://p.scdn.co/mp3-preview/3faa2e89a7e9755adf397b928cd714ba324de686'
  },
  {
    uri: 'spotify:track:1otCDbpd6mICT1WS88sGxr',
    title: 'Blood Soldier',
    fullTitle: 'Blood Soldier',
    subtitle: 'Salazar Dias',
    audioUrl: 'https://p.scdn.co/mp3-preview/b8af4b514ecdecc8b30a509bfd28fa60a0a2093e'
  },
  {
    uri: 'spotify:track:2js6YWjhK6QkAaIj3cUSKs',
    title: 'Broken Doll',
    fullTitle: 'Broken Doll',
    subtitle: 'Salazar Dias',
    audioUrl: 'https://p.scdn.co/mp3-preview/2be42858fb7bb0423b234b95192c19e5677441a9'
  },
  {
    uri: 'spotify:track:3lWY3WzFeME63AG2jC3aBm',
    title: 'Heir of Chaos',
    fullTitle: 'Heir of Chaos',
    subtitle: 'Salazar Dias',
    audioUrl: 'https://p.scdn.co/mp3-preview/b0e5dcff0000fdc2fd559b271c05480022c88fb9'
  },
  {
    uri: 'spotify:track:1d61pZDCw0eBiiVlKW1Vh0',
    title: 'ACROSS THE MACROVERSE',
    fullTitle: 'ACROSS THE MACROVERSE',
    subtitle: 'Salazar Dias',
    audioUrl: 'https://p.scdn.co/mp3-preview/a081434bcc2bf760d50bfcd21c124b62c285f206'
  },
  {
    uri: 'spotify:track:1LkjBgo46JIXCDVXk71y4B',
    title: 'Shadows of Arkham',
    fullTitle: 'Shadows of Arkham - Toca do Salazar',
    subtitle: 'Salazar Dias',
    audioUrl: 'https://p.scdn.co/mp3-preview/91a0e0e7e5de3b9abc6b445812a3553602c38f9e'
  },
  {
    uri: 'spotify:track:5abCNFS7VTwopkr5TPzyx2',
    title: 'Last Drink',
    fullTitle: 'Last Drink',
    subtitle: 'Salazar Dias',
    audioUrl: 'https://p.scdn.co/mp3-preview/40ad69f0d5013a9e14aa23c148ccb25726da0e76'
  },
  {
    uri: 'spotify:track:3ekaZG1HtoG0JIIEm1Zrqu',
    title: 'Sacrifice',
    fullTitle: 'Sacrifice',
    subtitle: 'Salazar Dias',
    audioUrl: 'https://p.scdn.co/mp3-preview/9c3fa1f9d9d85bc8e3105c62b5e0e98fb8b624fe'
  }
];

export const NavbarSpotifyMicroPlayer: React.FC = () => {
  const [tracks, setTracks] = useState<SpotifyMicroTrack[]>(DEFAULT_LIGHT_DARK_TRACKS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userPausedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    fetch('/api/spotify-tracks')
      .then((r) => r.json())
      .then((data) => {
        if (mounted && Array.isArray(data?.tracks) && data.tracks.length > 0) {
          setTracks(data.tracks);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const currentTrack = tracks[currentIndex] || tracks[0];

  // Auto-play on initial load at 40% volume, with instant fallback on first user interaction if browser blocks autoplay
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    audio.volume = DEFAULT_VOLUME;
    if (audio.src !== currentTrack.audioUrl) {
      audio.src = currentTrack.audioUrl;
    }

    const attemptAutoPlay = () => {
      if (userPausedRef.current || !audioRef.current) return;
      audioRef.current.volume = DEFAULT_VOLUME;
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          cleanupListeners();
        })
        .catch(() => {
          // Keeps visual state ready and waits for first pointer/key gesture
        });
    };

    const handleFirstInteraction = (e: Event) => {
      if (userPausedRef.current) {
        cleanupListeners();
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-spotify-micro-toggle="true"]')) {
        cleanupListeners();
        return;
      }
      attemptAutoPlay();
    };

    const cleanupListeners = () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

    if (!userPausedRef.current) {
      attemptAutoPlay();
      window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
      window.addEventListener('keydown', handleFirstInteraction, { passive: true });
      window.addEventListener('touchstart', handleFirstInteraction, { passive: true });
    }

    return cleanupListeners;
  }, [currentIndex, currentTrack?.audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = DEFAULT_VOLUME;

    if (!audio.paused) {
      userPausedRef.current = true;
      audio.pause();
      setIsPlaying(false);
    } else {
      userPausedRef.current = false;
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handlePrev = () => {
    userPausedRef.current = false;
    setCurrentIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
    setIsPlaying(true);
  };

  const handleNext = () => {
    userPausedRef.current = false;
    setCurrentIndex((prev) => (prev + 1) % tracks.length);
    setIsPlaying(true);
  };

  return (
    <div
      className="flex items-center gap-1 bg-slate-950/90 border border-slate-800 rounded-lg px-2 py-1 h-[30px] shrink-0"
      title={`Spotify Light Dark (Vol 40%): ${currentTrack?.fullTitle || currentTrack?.title || ''}`}
    >
      <audio
        ref={audioRef}
        preload="auto"
        autoPlay
        onEnded={handleNext}
        onPause={() => {
          if (userPausedRef.current) setIsPlaying(false);
        }}
        onPlay={() => {
          if (audioRef.current) audioRef.current.volume = DEFAULT_VOLUME;
          setIsPlaying(true);
        }}
      />

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
        {currentTrack?.title}
      </span>
    </div>
  );
};
