import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Upload,
  X,
  Check,
  Eye,
  EyeOff,
  Wand2,
  MousePointer
} from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, readBrowserCache, writeBrowserCache } from '../firebase';

export type TextureAnimationEffect =
  | 'arcane_matrix_hybrid'
  | 'runic_astrolabe'
  | 'abyssal_embers'
  | 'cyber_circuit_pulse'
  | 'ether_distortion'
  | 'none';

export type ImageMotionEffect =
  | 'pan_drift'
  | 'energy_pulse'
  | 'hologram_scan'
  | 'heat_warp'
  | 'static';

export type MouseReactiveEffect =
  | 'vortex_constellation'
  | 'repel_shockwave'
  | 'cyber_scanner_lock'
  | 'parallax_glow'
  | 'none';

export interface ThemeTextureSlot {
  id: string;
  code: string;
  label: string;
  themePillar: 'Dark Magic' | 'Alta Magia' | 'Cyberpunk Futurista' | 'Híbrido Cyber-Arcano';
  recommendedSize: string;
  description: string;
  imageUrl: string;
  opacity: number;
  blendMode: 'normal' | 'overlay' | 'screen' | 'multiply' | 'soft-light';
  animationEffect?: TextureAnimationEffect;
  imageMotionEffect?: ImageMotionEffect;
  mouseReactiveEffect?: MouseReactiveEffect;
  animationSpeed?: number;
  effectIntensity?: number;
  showProceduralOverlayWithImage?: boolean;
}

export const TEXTURE_ANIMATION_LABELS: Record<TextureAnimationEffect, string> = {
  arcane_matrix_hybrid: 'Fusão Cyber-Arcana (Runas Giratórias + Circuitos Neon + Brasas)',
  runic_astrolabe: 'Alta Magia • Astrolábio Alquímico & Anéis Rúnicos Giratórios',
  abyssal_embers: 'Dark Magic • Névoa Abissal, Sigilos Ocultos & Brasas Ascendentes',
  cyber_circuit_pulse: 'Cyberpunk • Trilhas de Circuito com Pulsos de Dados & Laser HUD',
  ether_distortion: 'Fendas Dimensionais • Ondas de Éter & Partículas do Vazio',
  none: 'Desativado (Sem Animação Procedural)'
};

export const IMAGE_MOTION_LABELS: Record<ImageMotionEffect, string> = {
  pan_drift: 'Flutuação Orbital & Parallax Contínuo',
  energy_pulse: 'Pulso de Energia & Brilho Arcano (Bloom)',
  hologram_scan: 'Varredura Laser Holográfica (Scanner HUD)',
  heat_warp: 'Ondulação de Éter / Distorção Mágica',
  static: 'Estática (Sem Movimento na Imagem Base)'
};

export const MOUSE_REACTIVE_LABELS: Record<MouseReactiveEffect, string> = {
  vortex_constellation: 'Vórtice Arcano + Constelação Neural + Rastro de Faíscas + Parallax',
  repel_shockwave: 'Campo Gravitacional Repulsor + Ondas de Choque no Clique',
  cyber_scanner_lock: 'Mira Holográfica Cyberpunk HUD + Feixes de Telemetria',
  parallax_glow: 'Lanterna de Éter & Parallax 3D Suave',
  none: 'Desativado (Sem Reação ao Mouse)'
};

export const DEFAULT_THEME_TEXTURES: Record<string, ThemeTextureSlot> = {
  hero_bg_texture: {
    id: 'hero_bg_texture',
    code: 'TEX-01',
    label: 'Textura 01 • Véu Cyber-Arcano do Hero (Topo)',
    themePillar: 'Híbrido Cyber-Arcano',
    recommendedSize: '1920x1080px (PNG/WebP)',
    description:
      'Sobreposição de circuitos neon, astrolábio rúnico giratório e partículas abissais reativas ao mouse sobre o Hero.',
    imageUrl: '',
    opacity: 0.6,
    blendMode: 'screen',
    animationEffect: 'arcane_matrix_hybrid',
    imageMotionEffect: 'energy_pulse',
    mouseReactiveEffect: 'vortex_constellation',
    animationSpeed: 1.0,
    effectIntensity: 0.9,
    showProceduralOverlayWithImage: true
  },
  navbar_hud_texture: {
    id: 'navbar_hud_texture',
    code: 'TEX-02',
    label: 'Textura 02 • Barra de Comando HUD & Runas (Navbar)',
    themePillar: 'Cyberpunk Futurista',
    recommendedSize: '1920x160px (PNG/WebP)',
    description:
      'Textura metálica escura com trilhas de circuito cibernético, pulsos de dados neon e mira reativa ao cursor.',
    imageUrl: '',
    opacity: 0.48,
    blendMode: 'screen',
    animationEffect: 'cyber_circuit_pulse',
    imageMotionEffect: 'hologram_scan',
    mouseReactiveEffect: 'cyber_scanner_lock',
    animationSpeed: 1.15,
    effectIntensity: 0.8,
    showProceduralOverlayWithImage: true
  },
  novidades_cyber_texture: {
    id: 'novidades_cyber_texture',
    code: 'TEX-03',
    label: 'Textura 03 • Arsenal & Relíquias (Seção Novidades)',
    themePillar: 'Cyberpunk Futurista',
    recommendedSize: '1920x900px (PNG/WebP)',
    description:
      'Fundo de forja tecnológica, grade hexagonal futurista com pulsos de dados e reação magnética ao cursor.',
    imageUrl: '',
    opacity: 0.5,
    blendMode: 'screen',
    animationEffect: 'cyber_circuit_pulse',
    imageMotionEffect: 'pan_drift',
    mouseReactiveEffect: 'cyber_scanner_lock',
    animationSpeed: 1.0,
    effectIntensity: 0.85,
    showProceduralOverlayWithImage: true
  },
  lore_grimoire_texture: {
    id: 'lore_grimoire_texture',
    code: 'TEX-04',
    label: 'Textura 04 • Grimório Abissal (Seção Sobre Light Dark)',
    themePillar: 'Dark Magic',
    recommendedSize: '1920x1080px (PNG/WebP)',
    description:
      'Textura sombria de magia negra, brasas violetas/carmesim que orbitam o mouse e névoa do Macroverso.',
    imageUrl: '',
    opacity: 0.55,
    blendMode: 'screen',
    animationEffect: 'abyssal_embers',
    imageMotionEffect: 'heat_warp',
    mouseReactiveEffect: 'vortex_constellation',
    animationSpeed: 0.95,
    effectIntensity: 0.88,
    showProceduralOverlayWithImage: true
  },
  card_altar_texture: {
    id: 'card_altar_texture',
    code: 'TEX-05',
    label: 'Textura 05 • Altar de Invocação (Tipos de Cartas)',
    themePillar: 'Alta Magia',
    recommendedSize: '1600x700px (PNG/WebP)',
    description:
      'Astrolábio de alta magia dourada girando em tempo real com vórtice rúnico reativo ao mouse sob os 5 tipos de cartas.',
    imageUrl: '',
    opacity: 0.58,
    blendMode: 'screen',
    animationEffect: 'runic_astrolabe',
    imageMotionEffect: 'energy_pulse',
    mouseReactiveEffect: 'vortex_constellation',
    animationSpeed: 1.0,
    effectIntensity: 0.9,
    showProceduralOverlayWithImage: true
  },
  manual_codex_texture: {
    id: 'manual_codex_texture',
    code: 'TEX-06',
    label: 'Textura 06 • Códice Tático & Regras (Fundo do Manual)',
    themePillar: 'Híbrido Cyber-Arcano',
    recommendedSize: '1920x1200px (PNG/WebP)',
    description:
      'Textura de fundo animada e reativa ao cursor para o Códice de Regras, Arquétipos e Raridades.',
    imageUrl: '',
    opacity: 0.45,
    blendMode: 'screen',
    animationEffect: 'arcane_matrix_hybrid',
    imageMotionEffect: 'pan_drift',
    mouseReactiveEffect: 'vortex_constellation',
    animationSpeed: 0.9,
    effectIntensity: 0.78,
    showProceduralOverlayWithImage: true
  },
  panel_card_texture: {
    id: 'panel_card_texture',
    code: 'TEX-07',
    label: 'Textura 07 • Placa Interna dos Painéis & Acordeões',
    themePillar: 'Dark Magic',
    recommendedSize: '800x400px (PNG/WebP)',
    description:
      'Textura animada com lanterna arcana reativa ao mouse dentro das Seções 01 a 09 do Manual e cards de Arquétipos.',
    imageUrl: '',
    opacity: 0.35,
    blendMode: 'screen',
    animationEffect: 'abyssal_embers',
    imageMotionEffect: 'energy_pulse',
    mouseReactiveEffect: 'parallax_glow',
    animationSpeed: 0.85,
    effectIntensity: 0.68,
    showProceduralOverlayWithImage: true
  },
  catalog_deck_texture: {
    id: 'catalog_deck_texture',
    code: 'TEX-08',
    label: 'Textura 08 • Abas Catálogo, DeckBuilder & Populares',
    themePillar: 'Cyberpunk Futurista',
    recommendedSize: '1920x1080px (PNG/WebP)',
    description:
      'Fundo de matriz neural, circuitos cibernéticos pulsantes e scanner reativo ao mouse para o Catálogo, DeckBuilder e Meta.',
    imageUrl: '',
    opacity: 0.4,
    blendMode: 'screen',
    animationEffect: 'cyber_circuit_pulse',
    imageMotionEffect: 'hologram_scan',
    mouseReactiveEffect: 'cyber_scanner_lock',
    animationSpeed: 1.0,
    effectIntensity: 0.8,
    showProceduralOverlayWithImage: true
  },
  lore_archivum_texture: {
    id: 'lore_archivum_texture',
    code: 'TEX-09',
    label: 'Textura 09 • Aba Lore (Archivum, Árvore, Quiz & Músicas)',
    themePillar: 'Alta Magia',
    recommendedSize: '1920x1080px (PNG/WebP)',
    description:
      'Textura de biblioteca arcana, astrolábio dourado giratório e constelação reativa ao mouse para a aba Lore.',
    imageUrl: '',
    opacity: 0.48,
    blendMode: 'screen',
    animationEffect: 'runic_astrolabe',
    imageMotionEffect: 'pan_drift',
    mouseReactiveEffect: 'vortex_constellation',
    animationSpeed: 0.95,
    effectIntensity: 0.85,
    showProceduralOverlayWithImage: true
  },
  store_booster_texture: {
    id: 'store_booster_texture',
    code: 'TEX-10',
    label: 'Textura 10 • Abas Mercado, Booster, Torneio & Coleção',
    themePillar: 'Híbrido Cyber-Arcano',
    recommendedSize: '1920x1080px (PNG/WebP)',
    description:
      'Textura de cofre de relíquias, forja arcana e ondas de choque reativas ao mouse para o Mercado, Booster, Torneios e Álbum.',
    imageUrl: '',
    opacity: 0.42,
    blendMode: 'screen',
    animationEffect: 'arcane_matrix_hybrid',
    imageMotionEffect: 'energy_pulse',
    mouseReactiveEffect: 'repel_shockwave',
    animationSpeed: 1.05,
    effectIntensity: 0.82,
    showProceduralOverlayWithImage: true
  },
  duel_arena_texture: {
    id: 'duel_arena_texture',
    code: 'TEX-11',
    label: 'Textura 11 • Abas App Duelo & Duelo vs IA (Arena)',
    themePillar: 'Dark Magic',
    recommendedSize: '1920x1080px (PNG/WebP)',
    description:
      'Textura de campo de batalha abissal com fendas dimensionais e repulsão gravitacional ao cursor para o App Duelo e Duelo vs IA.',
    imageUrl: '',
    opacity: 0.42,
    blendMode: 'screen',
    animationEffect: 'ether_distortion',
    imageMotionEffect: 'heat_warp',
    mouseReactiveEffect: 'repel_shockwave',
    animationSpeed: 1.15,
    effectIntensity: 0.88,
    showProceduralOverlayWithImage: true
  }
};

export const useThemeTextures = () => {
  const [textures, setTextures] = useState<Record<string, ThemeTextureSlot>>(() => {
    const cached = readBrowserCache<Record<string, ThemeTextureSlot>>('ld_theme_textures_v3');
    if (cached) {
      const merged = { ...DEFAULT_THEME_TEXTURES };
      Object.keys(merged).forEach((k) => {
        if (cached[k]) {
          merged[k] = { ...merged[k], ...cached[k] };
        }
      });
      return merged;
    }
    return DEFAULT_THEME_TEXTURES;
  });

  const [showPlaceholdersUI, setShowPlaceholdersUI] = useState<boolean>(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'theme_textures'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Record<string, ThemeTextureSlot>;
          const merged = { ...DEFAULT_THEME_TEXTURES };
          Object.keys(merged).forEach((key) => {
            if (data[key]) {
              merged[key] = { ...merged[key], ...data[key] };
            }
          });
          setTextures(merged);
          writeBrowserCache('ld_theme_textures_v3', merged);
        }
      },
      (err) => {
        console.warn('Erro ao carregar texturas do tema:', err);
      }
    );
    return () => unsub();
  }, []);

  const saveTextureSlot = async (slotId: string, patch: Partial<ThemeTextureSlot>) => {
    const baseSlot = textures[slotId] || DEFAULT_THEME_TEXTURES[slotId];
    const updated = {
      ...textures,
      [slotId]: {
        ...baseSlot,
        ...patch
      }
    };
    setTextures(updated);
    writeBrowserCache('ld_theme_textures_v3', updated);
    await setDoc(doc(db, 'settings', 'theme_textures'), updated, { merge: true });
  };

  return {
    textures,
    saveTextureSlot,
    showPlaceholdersUI,
    setShowPlaceholdersUI
  };
};

interface SparkTrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  color: string;
}

interface ShockwaveRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

/**
 * Real-Time HTML5 Canvas Procedural Texture & Mouse-Reactive Shader-Like Engine
 * Renders live animated Dark Magic embers, High Magic stardust & sigil orbits,
 * Cyberpunk neon circuit data packets, AND interactive mouse effects:
 * - Cursor Vortex / Gravitational Repulsion on particles
 * - Neural / Alchemical Constellation tethers connecting nearby nodes to the cursor
 * - Trailing arcane sparks emitted along the cursor path
 * - Expanding shockwave ripples on mouse click or fast swipe
 * - Rotating Runic / Cyber HUD reticle tracking the cursor
 */
const ProceduralAnimatedCanvas: React.FC<{
  effect: TextureAnimationEffect;
  mouseEffect: MouseReactiveEffect;
  speed: number;
  intensity: number;
  onMouseNormUpdate?: (nx: number, ny: number, active: boolean) => void;
}> = ({ effect, mouseEffect, speed, intensity, onMouseNormUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onMouseNormUpdateRef = useRef(onMouseNormUpdate);
  onMouseNormUpdateRef.current = onMouseNormUpdate;

  useEffect(() => {
    if (effect === 'none' && mouseEffect === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 450);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = Math.max(200, canvas.parentElement.clientWidth);
      height = canvas.height = Math.max(120, canvas.parentElement.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // Mouse state relative to this canvas
    const mouse = {
      targetX: width * 0.5,
      targetY: height * 0.5,
      x: width * 0.5,
      y: height * 0.5,
      vx: 0,
      vy: 0,
      isInside: false,
      lastMoveTime: 0
    };

    const trailSparks: SparkTrailParticle[] = [];
    const ripples: ShockwaveRipple[] = [];

    const spawnTrailSpark = (x: number, y: number, mvx: number, mvy: number) => {
      if (trailSparks.length > 48) return;
      const palette = ['#d4af37', '#06b6d4', '#a855f7', '#f43f5e'];
      trailSparks.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 1.4 - mvx * 0.08,
        vy: -0.6 - Math.random() * 1.2 - mvy * 0.08,
        r: 1.2 + Math.random() * 2.2,
        life: 0,
        maxLife: 24 + Math.random() * 22,
        color: palette[Math.floor(Math.random() * palette.length)]
      });
    };

    const spawnRipple = (x: number, y: number, maxR = 140) => {
      if (ripples.length > 6) ripples.shift();
      ripples.push({
        x,
        y,
        radius: 6,
        maxRadius: maxR,
        alpha: 0.85,
        color: Math.random() > 0.5 ? '#06b6d4' : '#d4af37'
      });
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      // Only process if container is visible in viewport
      if (rect.bottom < -50 || rect.top > window.innerHeight + 50 || rect.width === 0) {
        if (mouse.isInside) {
          mouse.isInside = false;
          onMouseNormUpdateRef.current?.(0, 0, false);
        }
        return;
      }

      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const inside =
        localX >= -40 &&
        localX <= rect.width + 40 &&
        localY >= -40 &&
        localY <= rect.height + 40;

      if (inside) {
        const dx = localX - mouse.targetX;
        const dy = localY - mouse.targetY;
        mouse.vx = dx;
        mouse.vy = dy;
        mouse.targetX = localX;
        mouse.targetY = localY;
        mouse.isInside = true;
        mouse.lastMoveTime = performance.now();

        if (mouseEffect !== 'none') {
          const nx = (localX / Math.max(1, rect.width) - 0.5) * 2;
          const ny = (localY / Math.max(1, rect.height) - 0.5) * 2;
          onMouseNormUpdateRef.current?.(nx, ny, true);

          const speedMag = Math.hypot(dx, dy);
          if (speedMag > 4) {
            spawnTrailSpark(localX, localY, dx, dy);
          }
          if (speedMag > 42 && ripples.length < 2) {
            spawnRipple(localX, localY, 95);
          }
        }
      } else if (mouse.isInside) {
        mouse.isInside = false;
        onMouseNormUpdateRef.current?.(0, 0, false);
      }
    };

    const handleWindowMouseDown = (e: MouseEvent) => {
      if (mouseEffect === 'none' || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      if (localX >= 0 && localX <= rect.width && localY >= 0 && localY <= rect.height) {
        spawnRipple(localX, localY, 175);
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2;
          spawnTrailSpark(
            localX + Math.cos(ang) * 8,
            localY + Math.sin(ang) * 8,
            -Math.cos(ang) * 18,
            -Math.sin(ang) * 18
          );
        }
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove, { passive: true });
    window.addEventListener('mousedown', handleWindowMouseDown, { passive: true });

    // 1. Particles (Embers / Stardust / Void Motes)
    const particleCount = Math.min(64, Math.max(22, Math.floor((width * height) / 15000)));
    const particles = Array.from({ length: particleCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 1.1 + Math.random() * 2.4,
      vx: (Math.random() - 0.5) * 0.48,
      vy: -0.35 - Math.random() * 0.75,
      pushVx: 0,
      pushVy: 0,
      phase: Math.random() * Math.PI * 2,
      colorType: i % 3 // 0: gold, 1: cyan, 2: violet/crimson
    }));

    // 2. Cyberpunk Circuit Data Pulses
    const pulseCount =
      effect === 'cyber_circuit_pulse' || effect === 'arcane_matrix_hybrid' ? 12 : 4;
    const circuitPulses = Array.from({ length: pulseCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.floor(Math.random() * 10) * (height / 10) + 20,
      len: 45 + Math.random() * 90,
      v: (1.6 + Math.random() * 2.2) * (i % 2 === 0 ? 1 : -1),
      vertical: i % 3 === 0,
      color: i % 2 === 0 ? '#06b6d4' : '#d4af37'
    }));

    const startTime = performance.now();

    const render = (now: number) => {
      const elapsed = ((now - startTime) / 1000) * speed;
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = Math.min(1, Math.max(0.15, intensity));

      // Smooth cursor interpolation
      mouse.x += (mouse.targetX - mouse.x) * 0.18;
      mouse.y += (mouse.targetY - mouse.y) * 0.18;

      // A. MOUSE-REACTIVE ARCANE LANTERN / SPOTLIGHT GLOW
      if (mouse.isInside && mouseEffect !== 'none') {
        const spotRadius = Math.min(340, Math.max(180, width * 0.24));
        const spotGrad = ctx.createRadialGradient(
          mouse.x,
          mouse.y,
          4,
          mouse.x,
          mouse.y,
          spotRadius
        );
        if (mouseEffect === 'cyber_scanner_lock') {
          spotGrad.addColorStop(0, 'rgba(6, 182, 212, 0.22)');
          spotGrad.addColorStop(0.45, 'rgba(212, 175, 55, 0.09)');
          spotGrad.addColorStop(1, 'rgba(5, 4, 10, 0)');
        } else if (mouseEffect === 'repel_shockwave') {
          spotGrad.addColorStop(0, 'rgba(225, 29, 72, 0.2)');
          spotGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.11)');
          spotGrad.addColorStop(1, 'rgba(5, 4, 10, 0)');
        } else {
          spotGrad.addColorStop(0, 'rgba(212, 175, 55, 0.22)');
          spotGrad.addColorStop(0.45, 'rgba(168, 85, 247, 0.12)');
          spotGrad.addColorStop(0.8, 'rgba(6, 182, 212, 0.05)');
          spotGrad.addColorStop(1, 'rgba(5, 4, 10, 0)');
        }
        ctx.fillStyle = spotGrad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, spotRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // B. ABYSSAL MIASMA / ETHER WAVES (also bends near the mouse!)
      if (
        effect === 'abyssal_embers' ||
        effect === 'ether_distortion' ||
        effect === 'arcane_matrix_hybrid'
      ) {
        const waveCount = effect === 'ether_distortion' ? 3 : 2;
        for (let w = 0; w < waveCount; w++) {
          ctx.beginPath();
          const baseY = height * (0.3 + w * 0.25);
          for (let x = 0; x <= width; x += 22) {
            let y =
              baseY +
              Math.sin(x * 0.006 + elapsed * (0.9 + w * 0.3) + w * 2) * 26 +
              Math.cos(x * 0.014 - elapsed * 0.7) * 12;

            // Interactive mouse wave deflection
            if (mouse.isInside && mouseEffect !== 'none') {
              const distX = Math.abs(x - mouse.x);
              if (distX < 180) {
                const pull = (1 - distX / 180) * ((mouse.y - y) * 0.32);
                y += pull;
              }
            }

            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle =
            w === 0
              ? 'rgba(168, 85, 247, 0.22)'
              : w === 1
              ? 'rgba(6, 182, 212, 0.18)'
              : 'rgba(225, 29, 72, 0.18)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // C. CYBERPUNK CIRCUIT DATA PULSES
      if (effect === 'cyber_circuit_pulse' || effect === 'arcane_matrix_hybrid') {
        circuitPulses.forEach((p) => {
          if (!p.vertical) {
            p.x += p.v * speed;
            if (p.v > 0 && p.x - p.len > width) {
              p.x = -20;
              p.y = Math.floor(Math.random() * 12) * Math.max(24, height / 12) + 16;
            } else if (p.v < 0 && p.x + p.len < 0) {
              p.x = width + 20;
              p.y = Math.floor(Math.random() * 12) * Math.max(24, height / 12) + 16;
            }

            const grad = ctx.createLinearGradient(
              p.x - (p.v > 0 ? p.len : 0),
              p.y,
              p.x + (p.v < 0 ? p.len : 0),
              p.y
            );
            if (p.v > 0) {
              grad.addColorStop(0, 'rgba(6, 182, 212, 0)');
              grad.addColorStop(1, p.color);
            } else {
              grad.addColorStop(0, p.color);
              grad.addColorStop(1, 'rgba(212, 175, 55, 0)');
            }

            ctx.beginPath();
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.6;
            ctx.moveTo(p.x - (p.v > 0 ? p.len : 0), p.y);
            ctx.lineTo(p.x + (p.v < 0 ? p.len : 0), p.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.fillStyle = p.color;
            ctx.arc(p.x, p.y, 2.3, 0, Math.PI * 2);
            ctx.fill();
          } else {
            p.y += Math.abs(p.v) * 0.75 * speed;
            if (p.y - p.len > height) {
              p.y = -20;
              p.x = Math.floor(Math.random() * 16) * Math.max(32, width / 16) + 20;
            }
            const grad = ctx.createLinearGradient(p.x, p.y - p.len, p.x, p.y);
            grad.addColorStop(0, 'rgba(168, 85, 247, 0)');
            grad.addColorStop(1, '#06b6d4');
            ctx.beginPath();
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.4;
            ctx.moveTo(p.x, p.y - p.len);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
        });
      }

      // D. FLOATING ARCANE EMBERS / STARDUST PARTICLES + MOUSE VORTEX / REPULSION / CONSTELLATION
      const interactRadius = 155;
      particles.forEach((pt) => {
        // Mouse physics interaction
        let nearMouseFactor = 0;
        if (mouse.isInside && mouseEffect !== 'none') {
          const dx = pt.x - mouse.x;
          const dy = pt.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < interactRadius && dist > 0.1) {
            nearMouseFactor = 1 - dist / interactRadius;
            const nx = dx / dist;
            const ny = dy / dist;

            if (mouseEffect === 'repel_shockwave') {
              // Strong radial gravitational push away from cursor
              pt.pushVx += nx * nearMouseFactor * 0.65;
              pt.pushVy += ny * nearMouseFactor * 0.65;
            } else if (mouseEffect === 'vortex_constellation') {
              // Arcane orbital swirl around cursor + gentle outward pressure
              const tx = -ny;
              const ty = nx;
              pt.pushVx += (tx * 0.45 + nx * 0.18) * nearMouseFactor;
              pt.pushVy += (ty * 0.45 + ny * 0.18) * nearMouseFactor;
            } else if (mouseEffect === 'cyber_scanner_lock') {
              // Snap slightly toward cursor scan grid
              pt.pushVx -= nx * nearMouseFactor * 0.22;
              pt.pushVy -= ny * nearMouseFactor * 0.22;
            }

            // Draw glowing constellation / neural tether line to cursor
            if (
              mouseEffect === 'vortex_constellation' ||
              mouseEffect === 'cyber_scanner_lock'
            ) {
              ctx.beginPath();
              ctx.strokeStyle =
                mouseEffect === 'cyber_scanner_lock'
                  ? `rgba(6, 182, 212, ${nearMouseFactor * 0.42})`
                  : `rgba(212, 175, 55, ${nearMouseFactor * 0.38})`;
              ctx.lineWidth = 0.8 + nearMouseFactor * 0.8;
              ctx.moveTo(mouse.x, mouse.y);
              ctx.lineTo(pt.x, pt.y);
              ctx.stroke();
            }
          }
        }

        // Apply damping to mouse impulse
        pt.pushVx *= 0.9;
        pt.pushVy *= 0.9;

        pt.x += pt.vx * speed + pt.pushVx + Math.sin(elapsed * 1.4 + pt.phase) * 0.25;
        pt.y += pt.vy * speed + pt.pushVy;

        if (pt.y < -12) {
          pt.y = height + 12;
          pt.x = Math.random() * width;
        } else if (pt.y > height + 12) {
          pt.y = -12;
          pt.x = Math.random() * width;
        }
        if (pt.x < -12) pt.x = width + 12;
        if (pt.x > width + 12) pt.x = -12;

        const baseAlpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(elapsed * 2.5 + pt.phase));
        const alpha = Math.min(1, baseAlpha + nearMouseFactor * 0.5);
        let fill = `rgba(212, 175, 55, ${alpha})`;
        if (nearMouseFactor > 0.45) {
          fill = `rgba(34, 211, 238, ${alpha})`;
        } else if (effect === 'abyssal_embers') {
          fill =
            pt.colorType === 0
              ? `rgba(168, 85, 247, ${alpha})`
              : pt.colorType === 1
              ? `rgba(225, 29, 72, ${alpha})`
              : `rgba(212, 175, 55, ${alpha})`;
        } else if (effect === 'cyber_circuit_pulse') {
          fill =
            pt.colorType === 0
              ? `rgba(6, 182, 212, ${alpha})`
              : `rgba(168, 85, 247, ${alpha * 0.8})`;
        } else {
          fill =
            pt.colorType === 0
              ? `rgba(212, 175, 55, ${alpha})`
              : pt.colorType === 1
              ? `rgba(6, 182, 212, ${alpha})`
              : `rgba(168, 85, 247, ${alpha})`;
        }

        ctx.beginPath();
        ctx.fillStyle = fill;
        ctx.arc(pt.x, pt.y, pt.r * (1 + nearMouseFactor * 0.9), 0, Math.PI * 2);
        ctx.fill();
      });

      // E. TRAILING CURSOR SPARKS
      for (let i = trailSparks.length - 1; i >= 0; i--) {
        const sp = trailSparks[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.life++;
        if (sp.life >= sp.maxLife) {
          trailSparks.splice(i, 1);
          continue;
        }
        const norm = 1 - sp.life / sp.maxLife;
        ctx.save();
        ctx.globalAlpha = norm * 0.85;
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.r * norm, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // F. EXPANDING ARCANE / CYBER SHOCKWAVE RIPPLES
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.radius += (rp.maxRadius - rp.radius) * 0.11 + 1.8;
        rp.alpha *= 0.93;
        if (rp.alpha < 0.03 || rp.radius >= rp.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.strokeStyle = rp.color;
        ctx.globalAlpha = rp.alpha;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // G. INTERACTIVE CURSOR RUNIC SIGIL / CYBER HUD RETICLE
      if (
        mouse.isInside &&
        (mouseEffect === 'vortex_constellation' ||
          mouseEffect === 'cyber_scanner_lock' ||
          mouseEffect === 'repel_shockwave')
      ) {
        ctx.save();
        ctx.translate(mouse.x, mouse.y);
        ctx.rotate(elapsed * (mouseEffect === 'cyber_scanner_lock' ? -1.4 : 0.9));

        // Outer Dashed Sigil/Scanner Circle
        ctx.strokeStyle =
          mouseEffect === 'cyber_scanner_lock'
            ? 'rgba(6, 182, 212, 0.42)'
            : 'rgba(212, 175, 55, 0.38)';
        ctx.lineWidth = 1.1;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.stroke();

        // Inner Diamond / Crosshair
        ctx.setLineDash([]);
        ctx.rotate(-elapsed * 1.8);
        ctx.strokeStyle =
          mouseEffect === 'repel_shockwave'
            ? 'rgba(225, 29, 72, 0.45)'
            : 'rgba(168, 85, 247, 0.45)';
        ctx.strokeRect(-13, -13, 26, 26);

        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mousedown', handleWindowMouseDown);
    };
  }, [effect, mouseEffect, speed, intensity]);

  if (effect === 'none' && mouseEffect === 'none') return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
};

/**
 * SVG Procedural Animated Layer + Custom Texture Layer with Mouse-Reactive Parallax, Vortex & Shader Effects
 */
export const ArcaneCyberTextureLayer: React.FC<{
  slot?: ThemeTextureSlot;
  variant?:
    | 'hero'
    | 'navbar'
    | 'cyber'
    | 'grimoire'
    | 'altar'
    | 'codex'
    | 'panel'
    | 'dark-magic'
    | 'high-magic'
    | 'cyber-grid'
    | 'hybrid';
  showPlaceholderBadge?: boolean;
  isAdmin?: boolean;
  onOpenTextureManager?: (slotId: string) => void;
  onOpenConfig?: (slotId: string) => void;
  className?: string;
}> = ({
  slot,
  variant = 'hybrid',
  showPlaceholderBadge = false,
  isAdmin = true,
  onOpenTextureManager,
  onOpenConfig,
  className = ''
}) => {
  const parallaxImgRef = useRef<HTMLDivElement | null>(null);
  const parallaxAstrolabeRef = useRef<HTMLDivElement | null>(null);

  const hasCustomImage = Boolean(slot?.imageUrl && slot.imageUrl.trim() !== '');
  const handleTriggerConfig = onOpenConfig || onOpenTextureManager;

  // Resolve active animation preset from slot or fallback based on variant
  const resolvedAnimEffect: TextureAnimationEffect =
    slot?.animationEffect ||
    (variant === 'high-magic' || variant === 'altar'
      ? 'runic_astrolabe'
      : variant === 'dark-magic' || variant === 'grimoire' || variant === 'panel'
      ? 'abyssal_embers'
      : variant === 'cyber-grid' || variant === 'cyber' || variant === 'navbar'
      ? 'cyber_circuit_pulse'
      : 'arcane_matrix_hybrid');

  const resolvedMotionEffect: ImageMotionEffect =
    slot?.imageMotionEffect || 'pan_drift';

  const resolvedMouseEffect: MouseReactiveEffect =
    slot?.mouseReactiveEffect || 'vortex_constellation';

  const speed = slot?.animationSpeed ?? 1.0;
  const intensity = slot?.effectIntensity ?? 0.85;
  const showOverlay = slot?.showProceduralOverlayWithImage ?? true;

  // Direct DOM parallax update for zero-lag 60fps mouse parallax shift
  const handleMouseNormUpdate = (nx: number, ny: number, active: boolean) => {
    if (parallaxImgRef.current) {
      parallaxImgRef.current.style.transform = active
        ? `translate3d(${(-nx * 14).toFixed(1)}px, ${(-ny * 14).toFixed(1)}px, 0)`
        : 'translate3d(0px, 0px, 0)';
    }
    if (parallaxAstrolabeRef.current) {
      parallaxAstrolabeRef.current.style.transform = active
        ? `translate3d(${(nx * 22).toFixed(1)}px, ${(ny * 22).toFixed(1)}px, 0)`
        : 'translate3d(0px, 0px, 0)';
    }
  };

  const motionClass =
    resolvedMotionEffect === 'pan_drift'
      ? 'ld-anim-pan-drift'
      : resolvedMotionEffect === 'energy_pulse'
      ? 'ld-anim-energy-pulse'
      : resolvedMotionEffect === 'heat_warp'
      ? 'ld-anim-heat-warp'
      : '';

  const motionDurSec =
    resolvedMotionEffect === 'pan_drift'
      ? `${Math.round(22 / speed)}s`
      : resolvedMotionEffect === 'energy_pulse'
      ? `${(6 / speed).toFixed(1)}s`
      : `${(9 / speed).toFixed(1)}s`;

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none ${className}`}
      style={
        {
          '--ld-tex-dur': motionDurSec,
          '--ld-spin-dur': `${Math.round(45 / speed)}s`
        } as React.CSSProperties
      }
    >
      {/* 1. Custom Uploaded Texture Image (with animated motion + mouse parallax shift) */}
      {hasCustomImage && (
        <div
          ref={parallaxImgRef}
          className="absolute -inset-4 transition-transform duration-300 ease-out"
        >
          <div
            className={`w-full h-full bg-cover bg-center bg-no-repeat transition-opacity duration-500 ${motionClass}`}
            style={{
              backgroundImage: `url("${slot!.imageUrl}")`,
              opacity: slot?.opacity ?? 0.45,
              mixBlendMode: (slot?.blendMode || 'screen') as any
            }}
          />
        </div>
      )}

      {/* 2. Procedural Animated SVG Geometric / Runic / Circuit Layer + Mouse-Reactive Canvas */}
      {(!hasCustomImage || showOverlay) &&
        (resolvedAnimEffect !== 'none' || resolvedMouseEffect !== 'none') && (
          <div
            className={`absolute inset-0 ${!hasCustomImage ? motionClass : ''}`}
            style={{
              opacity: hasCustomImage
                ? Math.min(0.9, (slot?.opacity ?? 0.45) * intensity)
                : Math.min(0.96, (slot?.opacity ?? 0.55) * (0.65 + intensity * 0.5))
            }}
          >
            {/* Base Pattern Grid (Cyber Hex / Runic Sigil / Circuit Traces) */}
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern
                  id={`pat-hex-${slot?.id || variant}`}
                  width="72"
                  height="72"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M36 0 L72 18 L72 54 L36 72 L0 54 L0 18 Z"
                    fill="none"
                    stroke="rgba(212,175,55,0.13)"
                    strokeWidth="0.8"
                  />
                  <path
                    d="M0 36 H22 L28 30 H44 L50 36 H72 M36 0 V20 M36 52 V72"
                    fill="none"
                    stroke="rgba(6,182,212,0.14)"
                    strokeWidth="0.75"
                  />
                  <circle cx="36" cy="36" r="2" fill="rgba(168,85,247,0.35)" />
                </pattern>

                <radialGradient id={`glow-${slot?.id || variant}`} cx="50%" cy="50%" r="55%">
                  <stop offset="0%" stopColor="rgba(147,51,234,0.22)" />
                  <stop offset="50%" stopColor="rgba(6,182,212,0.09)" />
                  <stop offset="100%" stopColor="rgba(5,4,10,0)" />
                </radialGradient>
              </defs>

              <rect width="100%" height="100%" fill={`url(#pat-hex-${slot?.id || variant})`} />
              <rect width="100%" height="100%" fill={`url(#glow-${slot?.id || variant})`} />
            </svg>

            {/* Rotating High-Magic Astrolabe & Alchemical Runic Rings (with 3D Mouse Parallax) */}
            {(resolvedAnimEffect === 'runic_astrolabe' ||
              resolvedAnimEffect === 'arcane_matrix_hybrid' ||
              resolvedAnimEffect === 'ether_distortion') && (
              <div
                ref={parallaxAstrolabeRef}
                className="absolute inset-0 flex items-center justify-center overflow-hidden transition-transform duration-300 ease-out"
              >
                <svg
                  className="w-[620px] h-[620px] sm:w-[820px] sm:h-[820px] opacity-40 shrink-0"
                  viewBox="0 0 600 600"
                  fill="none"
                >
                  {/* Outer Clockwise Runic Astrolabe Ring */}
                  <g className="ld-anim-spin-cw" style={{ transformOrigin: '300px 300px' }}>
                    <circle
                      cx="300"
                      cy="300"
                      r="265"
                      stroke="rgba(212,175,55,0.34)"
                      strokeWidth="1.2"
                      strokeDasharray="10 8 2 8"
                    />
                    <circle
                      cx="300"
                      cy="300"
                      r="248"
                      stroke="rgba(6,182,212,0.26)"
                      strokeWidth="0.9"
                      strokeDasharray="36 14 6 14"
                    />
                    {/* Inscribed Octagram / Alchemical Square */}
                    <rect
                      x="125"
                      y="125"
                      width="350"
                      height="350"
                      stroke="rgba(212,175,55,0.18)"
                      strokeWidth="0.9"
                    />
                    <rect
                      x="125"
                      y="125"
                      width="350"
                      height="350"
                      transform="rotate(45 300 300)"
                      stroke="rgba(168,85,247,0.24)"
                      strokeWidth="0.9"
                    />
                  </g>

                  {/* Inner Counter-Clockwise Cyber-Arcane Telemetry Ring */}
                  <g className="ld-anim-spin-ccw" style={{ transformOrigin: '300px 300px' }}>
                    <circle
                      cx="300"
                      cy="300"
                      r="185"
                      stroke="rgba(6,182,212,0.34)"
                      strokeWidth="1.3"
                      strokeDasharray="22 10 4 10"
                    />
                    <circle
                      cx="300"
                      cy="300"
                      r="135"
                      stroke="rgba(212,175,55,0.3)"
                      strokeWidth="1"
                      strokeDasharray="6 6"
                    />
                    <polygon
                      points="300,115 460,392 140,392"
                      stroke="rgba(212,175,55,0.22)"
                      strokeWidth="0.9"
                      fill="none"
                    />
                    <polygon
                      points="300,485 460,208 140,208"
                      stroke="rgba(6,182,212,0.22)"
                      strokeWidth="0.9"
                      fill="none"
                    />
                  </g>
                </svg>
              </div>
            )}

            {/* Real-Time Canvas Particle, Circuit Pulse & Mouse-Reactive Shader Layer */}
            <ProceduralAnimatedCanvas
              effect={resolvedAnimEffect}
              mouseEffect={resolvedMouseEffect}
              speed={speed}
              intensity={intensity}
              onMouseNormUpdate={handleMouseNormUpdate}
            />
          </div>
        )}

      {/* 3. Holographic Laser Scanline Sweep */}
      {(resolvedMotionEffect === 'hologram_scan' ||
        resolvedAnimEffect === 'cyber_circuit_pulse') && (
        <div
          className="absolute left-0 right-0 h-16 bg-gradient-to-b from-transparent via-cyan-400/15 to-amber-400/20 border-b border-cyan-400/35 pointer-events-none"
          style={{
            animation: `ld-tex-holo-scanline ${(7 / speed).toFixed(1)}s linear infinite`
          }}
        />
      )}

      {/* 4. Interactive Placeholder Badge (only visible when Admin enables Texture Placeholder Mode) */}
      {isAdmin && showPlaceholderBadge && slot && (
        <div className="absolute top-3 right-3 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTriggerConfig?.(slot.id);
            }}
            className="group flex items-center gap-2 px-3 py-1.5 bg-[#07060e]/95 hover:bg-[#120e24] border border-dashed border-[#d4af37]/80 hover:border-cyan-400 text-left shadow-[0_0_20px_rgba(212,175,55,0.25)] transition-all"
            style={{
              clipPath:
                'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)'
            }}
          >
            <div className="w-2 h-2 rotate-45 bg-[#d4af37] group-hover:bg-cyan-400 shrink-0 animate-pulse" />
            <div>
              <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#d4af37] group-hover:text-cyan-300 flex items-center gap-1.5">
                <span>
                  [{slot.code}] {hasCustomImage ? 'TEXTURA + FX ATIVO' : 'TEXTURA PROCEDURAL ANIMADA'}
                </span>
                <span className="text-[9px] text-purple-300 font-normal">
                  ({slot.themePillar})
                </span>
              </div>
              <div className="text-[11px] font-bold text-slate-200">
                {slot.label} —{' '}
                <span className="text-cyan-400 underline">Configurar Efeito / Imagem</span>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Ornamental Corner Frame (Combines High-Magic Gold Rune Filigree + Cyberpunk Chamfered HUD Brackets)
 */
export const CyberArcaneCornerFrame: React.FC<{
  accent?: 'gold' | 'cyan' | 'violet' | 'crimson';
  className?: string;
}> = ({ accent = 'gold', className = '' }) => {
  const strokeColor =
    accent === 'gold'
      ? '#d4af37'
      : accent === 'cyan'
      ? '#06b6d4'
      : accent === 'crimson'
      ? '#f43f5e'
      : '#a855f7';

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      {/* Top-Left Corner Bracket */}
      <svg className="absolute top-0 left-0 w-7 h-7 opacity-80" viewBox="0 0 28 28" fill="none">
        <path d="M1 20 V6 L6 1 H20" stroke={strokeColor} strokeWidth="1.5" />
        <path d="M4 14 V8 L8 4 H14" stroke={strokeColor} strokeWidth="0.75" strokeOpacity="0.6" />
        <rect x="6" y="6" width="2.5" height="2.5" transform="rotate(45 7.25 7.25)" fill={strokeColor} />
      </svg>
      {/* Top-Right Corner Bracket */}
      <svg className="absolute top-0 right-0 w-7 h-7 opacity-80" viewBox="0 0 28 28" fill="none">
        <path d="M27 20 V6 L22 1 H8" stroke={strokeColor} strokeWidth="1.5" />
        <path d="M24 14 V8 L20 4 H14" stroke={strokeColor} strokeWidth="0.75" strokeOpacity="0.6" />
        <rect x="19.5" y="6" width="2.5" height="2.5" transform="rotate(45 20.75 7.25)" fill={strokeColor} />
      </svg>
      {/* Bottom-Left Corner Bracket */}
      <svg className="absolute bottom-0 left-0 w-7 h-7 opacity-80" viewBox="0 0 28 28" fill="none">
        <path d="M1 8 V22 L6 27 H20" stroke={strokeColor} strokeWidth="1.5" />
        <path d="M4 14 V20 L8 24 H14" stroke={strokeColor} strokeWidth="0.75" strokeOpacity="0.6" />
        <rect x="6" y="19.5" width="2.5" height="2.5" transform="rotate(45 7.25 20.75)" fill={strokeColor} />
      </svg>
      {/* Bottom-Right Corner Bracket */}
      <svg className="absolute bottom-0 right-0 w-7 h-7 opacity-80" viewBox="0 0 28 28" fill="none">
        <path d="M27 8 V22 L22 27 H8" stroke={strokeColor} strokeWidth="1.5" />
        <path d="M24 14 V20 L20 24 H14" stroke={strokeColor} strokeWidth="0.75" strokeOpacity="0.6" />
        <rect x="19.5" y="19.5" width="2.5" height="2.5" transform="rotate(45 20.75 20.75)" fill={strokeColor} />
      </svg>
    </div>
  );
};

/**
 * Modal for the Admin to configure live Procedural Texture Animations, Mouse-Reactive Effects,
 * Shader-like Motion Effects, and Custom Texture Images for all 11 Slots (TEX-01 to TEX-11).
 */
export const ThemeTexturesManagerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  textures: Record<string, ThemeTextureSlot>;
  onSaveSlot: (slotId: string, patch: Partial<ThemeTextureSlot>) => Promise<void>;
  initialSelectedSlotId?: string | null;
  initialSlotId?: string | null;
  showPlaceholdersUI: boolean;
  onTogglePlaceholdersUI: (val: boolean) => void;
}> = ({
  isOpen,
  onClose,
  textures,
  onSaveSlot,
  initialSelectedSlotId,
  initialSlotId,
  showPlaceholdersUI,
  onTogglePlaceholdersUI
}) => {
  const [uploadingSlotId, setUploadingSlotId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeHighlightId = initialSlotId || initialSelectedSlotId || null;

  const slotList = Object.values(DEFAULT_THEME_TEXTURES).map((def) => ({
    ...def,
    ...(textures[def.id] || {})
  }));

  const handleFileUpload = async (slotId: string, file: File) => {
    setUploadingSlotId(slotId);
    try {
      const storageRef = ref(storage, `theme_textures/${slotId}_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await onSaveSlot(slotId, { imageUrl: url });
      setFeedback(`Textura [${textures[slotId]?.code || slotId}] atualizada com sucesso!`);
      setTimeout(() => setFeedback(null), 3500);
    } catch (e) {
      console.error('Erro no upload de textura:', e);
    } finally {
      setUploadingSlotId(null);
    }
  };

  const handleApplyAnimatedPresetsAll = async () => {
    for (const def of Object.values(DEFAULT_THEME_TEXTURES)) {
      await onSaveSlot(def.id, {
        animationEffect: def.animationEffect,
        imageMotionEffect: def.imageMotionEffect,
        mouseReactiveEffect: def.mouseReactiveEffect,
        animationSpeed: def.animationSpeed,
        effectIntensity: def.effectIntensity,
        opacity: def.opacity,
        showProceduralOverlayWithImage: true
      });
    }
    setFeedback('Animações procedurais e reação ao mouse ativadas em todos os 11 slots do site!');
    setTimeout(() => setFeedback(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className="relative bg-[#07060e] border border-[#d4af37]/50 max-w-6xl w-full max-h-[92vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.95)] overflow-hidden"
        style={{
          clipPath:
            'polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)'
        }}
      >
        <CyberArcaneCornerFrame accent="gold" />

        {/* Header */}
        <div className="p-5 bg-[#0b0916] border-b border-[#d4af37]/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#141026] border border-[#d4af37]/60 flex items-center justify-center text-[#d4af37]">
              <Wand2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-400">
                  Motor de Texturas Animadas & Reativas ao Mouse • Dark Magic × Alta Magia × Cyberpunk
                </span>
              </div>
              <h3 className="font-cinzel text-lg sm:text-xl font-black text-white uppercase tracking-wider">
                Animações de Texturas & Efeitos Interativos (TEX-01 a TEX-11)
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleApplyAnimatedPresetsAll}
              className="cyber-arcane-btn px-3 py-1.5 text-xs font-cinzel font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-cyan-400 text-slate-950 flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition"
              title="Restaurar e ativar as animações e reação ao mouse em todas as 11 áreas do site"
            >
              <Sparkles size={14} />
              <span>Ativar Preset Animado + Mouse em Tudo</span>
            </button>

            <button
              type="button"
              onClick={() => onTogglePlaceholdersUI(!showPlaceholdersUI)}
              className={`cyber-arcane-btn px-3 py-1.5 text-xs font-bold border transition flex items-center gap-1.5 ${
                showPlaceholdersUI
                  ? 'bg-[#d4af37] text-slate-950 border-[#d4af37]'
                  : 'bg-[#120f22] text-slate-300 border-white/15 hover:border-[#d4af37]/60'
              }`}
            >
              {showPlaceholdersUI ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>
                {showPlaceholdersUI ? 'Etiquetas na Tela: ON' : 'Mostrar Etiquetas na Tela'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-slate-900 hover:bg-red-950/80 text-slate-400 hover:text-white border border-white/10 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {feedback && (
          <div className="mx-5 mt-4 p-3 bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center gap-2">
            <Check size={15} className="text-emerald-400 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          <div className="p-3.5 bg-[#0e0b1c] border border-cyan-500/30 text-xs text-slate-300 leading-relaxed">
            Passe o mouse sobre os blocos de preview abaixo (ou por qualquer área do site) para ver a{' '}
            <strong className="text-amber-300">Reação Interativa ao Cursor</strong>: vórtice de
            partículas arcanas, feixes de constelação neural conectando ao mouse, lanterna de éter,
            mira holográfica giratória, parallax 3D e ondas de choque ao clicar!
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {slotList.map((slot) => {
              const isHighlighted = activeHighlightId === slot.id;
              const hasImg = Boolean(slot.imageUrl && slot.imageUrl.trim() !== '');
              const currentAnim = slot.animationEffect || 'arcane_matrix_hybrid';
              const currentMotion = slot.imageMotionEffect || 'pan_drift';
              const currentMouse = slot.mouseReactiveEffect || 'vortex_constellation';
              const currentSpeed = slot.animationSpeed ?? 1.0;
              const currentIntensity = slot.effectIntensity ?? 0.85;

              return (
                <div
                  key={slot.id}
                  className={`p-4 bg-[#0c0a18] border transition flex flex-col justify-between gap-3 relative ${
                    isHighlighted
                      ? 'border-cyan-400 ring-1 ring-cyan-400/50'
                      : hasImg
                      ? 'border-[#d4af37]/60'
                      : 'border-white/15 hover:border-[#d4af37]/40'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 bg-[#191330] border border-[#d4af37]/50 text-[#d4af37] font-mono text-[10px] font-bold">
                        {slot.code} • {slot.themePillar}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-300 flex items-center gap-1">
                        <MousePointer size={11} />
                        {currentMouse === 'none' ? 'Sem Mouse FX' : 'Reativo ao Mouse'}
                      </span>
                    </div>

                    <h4 className="font-cinzel text-sm font-bold text-white">{slot.label}</h4>

                    <p className="text-[11px] text-slate-400 leading-snug">{slot.description}</p>

                    {/* Live Animated + Mouse Reactive Preview Box */}
                    <div className="relative h-36 w-full bg-[#05040a] border border-amber-500/30 overflow-hidden flex items-center justify-center shadow-inner">
                      <ArcaneCyberTextureLayer slot={slot} />
                      <span className="relative z-10 px-2.5 py-1 bg-black/80 border border-amber-500/30 text-[10px] font-mono text-amber-200 shadow-lg">
                        {hasImg
                          ? '✓ Imagem + Efeitos Reativos ao Mouse'
                          : '⚡ Passe o Mouse ou Clique Aqui para Testar'}
                      </span>
                    </div>
                  </div>

                  {/* Animation, Motion & Mouse Reactivity Selectors */}
                  <div className="space-y-2.5 pt-2.5 border-t border-white/10">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-emerald-300 mb-1 flex items-center gap-1">
                        <MousePointer size={11} /> Efeito Interativo de Reação ao Mouse
                      </label>
                      <select
                        value={currentMouse}
                        onChange={(e) =>
                          onSaveSlot(slot.id, {
                            mouseReactiveEffect: e.target.value as MouseReactiveEffect
                          })
                        }
                        className="w-full bg-[#06050c] border border-emerald-500/40 px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-400"
                      >
                        {Object.entries(MOUSE_REACTIVE_LABELS).map(([k, lbl]) => (
                          <option key={k} value={k}>
                            {lbl}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-amber-300 mb-1">
                          Animação Procedural (Canvas/Runas)
                        </label>
                        <select
                          value={currentAnim}
                          onChange={(e) =>
                            onSaveSlot(slot.id, {
                              animationEffect: e.target.value as TextureAnimationEffect
                            })
                          }
                          className="w-full bg-[#06050c] border border-purple-500/40 px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
                        >
                          {Object.entries(TEXTURE_ANIMATION_LABELS).map(([k, lbl]) => (
                            <option key={k} value={k}>
                              {lbl}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-cyan-300 mb-1">
                          Efeito de Movimento / Shader
                        </label>
                        <select
                          value={currentMotion}
                          onChange={(e) =>
                            onSaveSlot(slot.id, {
                              imageMotionEffect: e.target.value as ImageMotionEffect
                            })
                          }
                          className="w-full bg-[#06050c] border border-cyan-500/40 px-2 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                        >
                          {Object.entries(IMAGE_MOTION_LABELS).map(([k, lbl]) => (
                            <option key={k} value={k}>
                              {lbl}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Sliders: Speed, Intensity, Opacity */}
                    <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] text-slate-300 font-mono">
                      <div className="bg-[#080612] border border-white/10 p-1.5">
                        <div className="flex justify-between mb-1">
                          <span>Velocidade</span>
                          <span className="text-cyan-300">{currentSpeed.toFixed(1)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.3"
                          max="2.5"
                          step="0.1"
                          value={currentSpeed}
                          onChange={(e) =>
                            onSaveSlot(slot.id, { animationSpeed: parseFloat(e.target.value) })
                          }
                          className="w-full accent-cyan-400"
                        />
                      </div>

                      <div className="bg-[#080612] border border-white/10 p-1.5">
                        <div className="flex justify-between mb-1">
                          <span>Intensidade FX</span>
                          <span className="text-purple-300">
                            {Math.round(currentIntensity * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.05"
                          value={currentIntensity}
                          onChange={(e) =>
                            onSaveSlot(slot.id, { effectIntensity: parseFloat(e.target.value) })
                          }
                          className="w-full accent-purple-400"
                        />
                      </div>

                      <div className="bg-[#080612] border border-white/10 p-1.5">
                        <div className="flex justify-between mb-1">
                          <span>Opacidade</span>
                          <span className="text-amber-300">
                            {Math.round((slot.opacity ?? 0.45) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.05"
                          max="1"
                          step="0.05"
                          value={slot.opacity ?? 0.45}
                          onChange={(e) =>
                            onSaveSlot(slot.id, { opacity: parseFloat(e.target.value) })
                          }
                          className="w-full accent-[#d4af37]"
                        />
                      </div>
                    </div>

                    {/* Optional Custom Image Upload / URL */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={slot.imageUrl || ''}
                        onChange={(e) => onSaveSlot(slot.id, { imageUrl: e.target.value })}
                        placeholder="Opcional: URL de imagem base p/ combinar com o efeito..."
                        className="flex-1 bg-[#06050c] border border-white/15 px-2.5 py-1.5 text-xs text-white font-mono focus:border-[#d4af37] outline-none"
                      />
                      <label className="px-3 py-1.5 bg-[#d4af37] hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer flex items-center gap-1.5 shrink-0 transition">
                        <Upload size={13} />
                        <span>{uploadingSlotId === slot.id ? 'Enviando...' : 'Upload'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingSlotId === slot.id}
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleFileUpload(slot.id, e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {hasImg && (
                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={slot.showProceduralOverlayWithImage ?? true}
                            onChange={(e) =>
                              onSaveSlot(slot.id, {
                                showProceduralOverlayWithImage: e.target.checked
                              })
                            }
                            className="accent-cyan-400"
                          />
                          <span>Manter partículas/runas reativas sobre a imagem</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => onSaveSlot(slot.id, { imageUrl: '' })}
                          className="text-red-400 hover:text-red-300 text-[10px] font-mono underline"
                        >
                          Remover Imagem (Usar 100% Procedural)
                        </button>
                      </div>
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
