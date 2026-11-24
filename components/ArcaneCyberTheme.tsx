import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Upload,
  X,
  Check,
  Eye,
  EyeOff,
  Wand2,
  MousePointer,
  Zap,
  ZapOff,
  Gift
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
  | 'christmas_festive'
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
  themePillar:
    | 'Dark Magic'
    | 'Alta Magia'
    | 'Cyberpunk Futurista'
    | 'Híbrido Cyber-Arcano'
    | 'Natalino Festivo';
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
  christmas_festive:
    '🎄 Tema Natalino • Flocos de Neve, Bolas de Natal Animadas & Brilho Vermelho',
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

const syncChristmasThemeDomClass = (isChristmas: boolean) => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('ld-theme-christmas', isChristmas);
  if (document.body) {
    document.body.classList.toggle('ld-theme-christmas', isChristmas);
  }
};

export const isChristmasThemeActiveInSlots = (
  slots: Record<string, ThemeTextureSlot>
): boolean => {
  const list = Object.values(slots);
  if (list.length === 0) return false;
  const christmasCount = list.filter((s) => s?.animationEffect === 'christmas_festive').length;
  return (
    slots.hero_bg_texture?.animationEffect === 'christmas_festive' ||
    christmasCount >= Math.ceil(list.length / 2)
  );
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
  const isChristmasTheme = isChristmasThemeActiveInSlots(textures);

  useEffect(() => {
    syncChristmasThemeDomClass(isChristmasTheme);
  }, [isChristmasTheme]);

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
          syncChristmasThemeDomClass(isChristmasThemeActiveInSlots(merged));
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
    syncChristmasThemeDomClass(isChristmasThemeActiveInSlots(updated));
    await setDoc(doc(db, 'settings', 'theme_textures'), updated, { merge: true });
  };

  return {
    textures,
    saveTextureSlot,
    showPlaceholdersUI,
    setShowPlaceholdersUI,
    isChristmasTheme
  };
};

const SITE_EFFECTS_STORAGE_KEY = 'ld_site_effects_enabled';
const SITE_EFFECTS_EVENT = 'ld-site-effects-change';

const syncSiteEffectsDomClass = (enabled: boolean) => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('ld-effects-disabled', !enabled);
  if (document.body) {
    document.body.classList.toggle('ld-effects-disabled', !enabled);
  }
};

export const getInitialSiteEffectsEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(SITE_EFFECTS_STORAGE_KEY);
    if (raw === 'false') return false;
    return true;
  } catch {
    return true;
  }
};

// Inicializa imediatamente a classe no DOM caso já esteja salvo como desativado
if (typeof window !== 'undefined') {
  syncSiteEffectsDomClass(getInitialSiteEffectsEnabled());
}

export const useSiteEffects = () => {
  const [siteEffectsEnabled, setSiteEffectsState] = useState<boolean>(() =>
    getInitialSiteEffectsEnabled()
  );

  useEffect(() => {
    syncSiteEffectsDomClass(siteEffectsEnabled);
  }, [siteEffectsEnabled]);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const custom = e as CustomEvent<boolean>;
      if (typeof custom.detail === 'boolean') {
        setSiteEffectsState(custom.detail);
        syncSiteEffectsDomClass(custom.detail);
      } else {
        const current = getInitialSiteEffectsEnabled();
        setSiteEffectsState(current);
        syncSiteEffectsDomClass(current);
      }
    };
    window.addEventListener(SITE_EFFECTS_EVENT, handleSync);
    return () => window.removeEventListener(SITE_EFFECTS_EVENT, handleSync);
  }, []);

  const setSiteEffectsEnabled = (next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(siteEffectsEnabled) : next;
    try {
      window.localStorage.setItem(SITE_EFFECTS_STORAGE_KEY, String(resolved));
    } catch {
      // ignore storage errors
    }
    setSiteEffectsState(resolved);
    syncSiteEffectsDomClass(resolved);
    window.dispatchEvent(new CustomEvent<boolean>(SITE_EFFECTS_EVENT, { detail: resolved }));
  };

  const toggleSiteEffects = () => {
    setSiteEffectsEnabled(!siteEffectsEnabled);
  };

  return {
    siteEffectsEnabled,
    setSiteEffectsEnabled,
    toggleSiteEffects
  };
};

export const SiteEffectsToggleButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { siteEffectsEnabled, toggleSiteEffects } = useSiteEffects();

  return (
    <button
      type="button"
      data-tour-id="tour-btn-effects"
      onClick={toggleSiteEffects}
      title={
        siteEffectsEnabled
          ? 'Desativar efeitos de luz, animação e interação com o mouse para deixar o site bem leve'
          : 'Ativar efeitos visuais de luz, animação e interação com o mouse'
      }
      className={`flex items-center gap-2 bg-[#0c0918]/90 border px-2.5 py-1.5 cyber-arcane-btn shrink-0 transition ${
        siteEffectsEnabled
          ? 'border-[#d4af37]/45 hover:border-cyan-400/70 text-slate-100 shadow-[0_0_12px_rgba(212,175,55,0.15)]'
          : 'border-slate-700/80 hover:border-slate-500 text-slate-400 bg-[#080610]'
      } ${className}`}
    >
      {siteEffectsEnabled ? (
        <Zap size={13} className="text-amber-400 shrink-0" />
      ) : (
        <ZapOff size={13} className="text-slate-500 shrink-0" />
      )}
      <span className="text-[11px] font-bold tracking-wide whitespace-nowrap">
        Efeitos do Site
      </span>
      <span
        className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-black uppercase tracking-wider rounded-sm border transition ${
          siteEffectsEnabled
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
            : 'bg-slate-800 text-slate-400 border-slate-600/60'
        }`}
      >
        {siteEffectsEnabled ? 'ON' : 'OFF'}
      </span>
    </button>
  );
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
  isSnowflake?: boolean;
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
 * Helper to draw a detailed 6-branched crystalline snowflake on Canvas
 */
const drawCrystalSnowflake = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rotation: number,
  alpha: number,
  tintColor: string = '#ffffff'
) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = Math.min(1, Math.max(0.05, alpha));
  ctx.strokeStyle = tintColor;
  ctx.lineWidth = Math.max(1, radius * 0.16);
  ctx.lineCap = 'round';

  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -radius);

    // Side crystalline branches
    const b1 = radius * 0.52;
    const b1Len = radius * 0.34;
    ctx.moveTo(0, -b1);
    ctx.lineTo(-b1Len * 0.7, -b1 - b1Len * 0.7);
    ctx.moveTo(0, -b1);
    ctx.lineTo(b1Len * 0.7, -b1 - b1Len * 0.7);

    if (radius > 5.5) {
      const b2 = radius * 0.78;
      const b2Len = radius * 0.22;
      ctx.moveTo(0, -b2);
      ctx.lineTo(-b2Len * 0.7, -b2 - b2Len * 0.7);
      ctx.moveTo(0, -b2);
      ctx.lineTo(b2Len * 0.7, -b2 - b2Len * 0.7);
    }

    ctx.stroke();
    ctx.rotate(Math.PI / 3);
  }

  // Glowing center crystal core
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, radius * 0.18), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/**
 * Helper to draw an animated 3D-shaded hanging or floating Christmas Bauble (Bola de Natal)
 */
const drawChristmasBauble = (
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  ballX: number,
  ballY: number,
  radius: number,
  angle: number,
  styleIndex: number,
  elapsed: number,
  hasString: boolean
) => {
  ctx.save();

  // 1. Hanging Golden Cord from top
  if (hasString) {
    const cordGrad = ctx.createLinearGradient(anchorX, anchorY, ballX, ballY - radius);
    cordGrad.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
    cordGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.75)');
    cordGrad.addColorStop(1, 'rgba(251, 191, 36, 0.95)');
    ctx.beginPath();
    ctx.strokeStyle = cordGrad;
    ctx.lineWidth = 1.35;
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(ballX, ballY - radius * 0.95);
    ctx.stroke();

    // Small festive bow / pin at anchor
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(anchorX, anchorY + 2, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(ballX, ballY);
  ctx.rotate(angle);

  // 2. Soft Crimson / Gold Festive Aura Glow behind Bauble
  const isGoldVariant = styleIndex % 4 === 2;
  const isRubyStripeVariant = styleIndex % 4 === 1;
  const glowRadius = radius * 2.15;
  const aura = ctx.createRadialGradient(0, 0, radius * 0.3, 0, 0, glowRadius);
  if (isGoldVariant) {
    aura.addColorStop(0, 'rgba(251, 191, 36, 0.38)');
    aura.addColorStop(0.5, 'rgba(239, 68, 68, 0.18)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  } else {
    aura.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
    aura.addColorStop(0.55, 'rgba(220, 38, 38, 0.18)');
    aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
  }
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  // 3. Golden Crown Cap & Hanging Ring at top of Christmas Ball
  const capW = Math.max(5, radius * 0.46);
  const capH = Math.max(3.5, radius * 0.28);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(0, -radius - capH * 0.75, capW * 0.28, 0, Math.PI * 2);
  ctx.stroke();

  const capGrad = ctx.createLinearGradient(-capW / 2, -radius - capH, capW / 2, -radius);
  capGrad.addColorStop(0, '#fde68a');
  capGrad.addColorStop(0.5, '#d97706');
  capGrad.addColorStop(1, '#fbbf24');
  ctx.fillStyle = capGrad;
  ctx.fillRect(-capW / 2, -radius - capH * 0.55, capW, capH * 0.75);

  // 4. Main 3D Metallic Sphere Body (Primary Color = Vibrant Christmas Red)
  const sphereGrad = ctx.createRadialGradient(
    -radius * 0.34,
    -radius * 0.34,
    radius * 0.08,
    0,
    0,
    radius
  );
  if (isGoldVariant) {
    sphereGrad.addColorStop(0, '#fffbeb');
    sphereGrad.addColorStop(0.25, '#fbbf24');
    sphereGrad.addColorStop(0.68, '#d97706');
    sphereGrad.addColorStop(1, '#78350f');
  } else if (isRubyStripeVariant) {
    sphereGrad.addColorStop(0, '#ffe4e6');
    sphereGrad.addColorStop(0.22, '#f43f5e');
    sphereGrad.addColorStop(0.65, '#be123c');
    sphereGrad.addColorStop(1, '#4c0519');
  } else {
    sphereGrad.addColorStop(0, '#fecaca');
    sphereGrad.addColorStop(0.22, '#ef4444');
    sphereGrad.addColorStop(0.65, '#b91c1c');
    sphereGrad.addColorStop(1, '#450a0a');
  }

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = sphereGrad;
  ctx.fill();

  // Clip inside sphere for festive bands & motifs
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.clip();

  // Festive Gold / White Equatorial Band & Pattern on the Christmas Ball
  ctx.strokeStyle = isGoldVariant ? 'rgba(220, 38, 38, 0.85)' : 'rgba(253, 224, 71, 0.85)';
  ctx.lineWidth = Math.max(1.4, radius * 0.15);
  ctx.beginPath();
  ctx.moveTo(-radius * 1.1, 0);
  ctx.quadraticCurveTo(0, radius * 0.24, radius * 1.1, 0);
  ctx.stroke();

  if (radius >= 11) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 0.9;
    ctx.setLineDash([2.5, 2.5]);
    ctx.beginPath();
    ctx.moveTo(-radius * 1.1, -radius * 0.24);
    ctx.quadraticCurveTo(0, 0, radius * 1.1, -radius * 0.24);
    ctx.moveTo(-radius * 1.1, radius * 0.24);
    ctx.quadraticCurveTo(0, radius * 0.48, radius * 1.1, radius * 0.24);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  // 5. Outer Metallic Rim Highlight
  ctx.strokeStyle = isGoldVariant ? 'rgba(253, 224, 71, 0.65)' : 'rgba(248, 113, 113, 0.65)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // 6. Specular Glossy Light Reflection & Twinkle Star
  ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
  ctx.beginPath();
  ctx.ellipse(
    -radius * 0.34,
    -radius * 0.34,
    radius * 0.22,
    radius * 0.12,
    -Math.PI / 4,
    0,
    Math.PI * 2
  );
  ctx.fill();

  const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(elapsed * 3.2 + styleIndex * 1.7));
  if (twinkle > 0.65) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${twinkle})`;
    ctx.lineWidth = 1.1;
    const sx = -radius * 0.36;
    const sy = -radius * 0.36;
    const sr = radius * 0.24 * twinkle;
    ctx.beginPath();
    ctx.moveTo(sx - sr, sy);
    ctx.lineTo(sx + sr, sy);
    ctx.moveTo(sx, sy - sr);
    ctx.lineTo(sx, sy + sr);
    ctx.stroke();
  }

  ctx.restore();
};

/**
 * Real-Time HTML5 Canvas Procedural Texture & Mouse-Reactive Shader-Like Engine
 * Renders live animated Dark Magic embers, High Magic stardust & sigil orbits,
 * Cyberpunk neon circuit data packets, Festive Christmas Snowflakes & Swinging Christmas Ornaments,
 * AND interactive mouse effects.
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
      const palette =
        effect === 'christmas_festive'
          ? ['#ef4444', '#ffffff', '#fbbf24', '#f43f5e']
          : ['#d4af37', '#06b6d4', '#a855f7', '#f43f5e'];
      trailSparks.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 1.4 - mvx * 0.08,
        vy:
          effect === 'christmas_festive'
            ? 0.4 + Math.random() * 1.1 - mvy * 0.06
            : -0.6 - Math.random() * 1.2 - mvy * 0.08,
        r: 1.5 + Math.random() * 2.6,
        life: 0,
        maxLife: 26 + Math.random() * 22,
        color: palette[Math.floor(Math.random() * palette.length)],
        isSnowflake: effect === 'christmas_festive' && Math.random() > 0.35
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
        color:
          effect === 'christmas_festive'
            ? Math.random() > 0.35
              ? '#ef4444'
              : '#fbbf24'
            : Math.random() > 0.5
            ? '#06b6d4'
            : '#d4af37'
      });
    };

    const canUseFineMouse = () => {
      if (typeof window === 'undefined') return false;
      if (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
        return false;
      }
      return true;
    };

    const handleWindowPointerMove = (e: PointerEvent) => {
      // Ignora completamente eventos de touch / caneta em celulares e tablets (somente mouse)
      if ((e.pointerType && e.pointerType !== 'mouse') || !canUseFineMouse()) {
        if (mouse.isInside) {
          mouse.isInside = false;
          onMouseNormUpdateRef.current?.(0, 0, false);
        }
        return;
      }
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

    const handleWindowPointerDown = (e: PointerEvent) => {
      // Ignora completamente toques em celulares (somente clique real de mouse)
      if ((e.pointerType && e.pointerType !== 'mouse') || !canUseFineMouse()) return;
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

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: true });
    window.addEventListener('pointerdown', handleWindowPointerDown, { passive: true });

    // 1. Particles (Embers / Stardust / Void Motes / Crystalline Snowflakes)
    const isChristmas = effect === 'christmas_festive';
    const particleCount = isChristmas
      ? Math.min(78, Math.max(28, Math.floor((width * height) / 11500)))
      : Math.min(64, Math.max(22, Math.floor((width * height) / 15000)));

    const particles = Array.from({ length: particleCount }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: isChristmas
        ? i % 3 === 0
          ? 4.5 + Math.random() * 5.2
          : 1.6 + Math.random() * 2.8
        : 1.1 + Math.random() * 2.4,
      vx: (Math.random() - 0.5) * (isChristmas ? 0.65 : 0.48),
      vy: isChristmas
        ? 0.45 + Math.random() * 1.15 // Falling snow downward
        : -0.35 - Math.random() * 0.75,
      pushVx: 0,
      pushVy: 0,
      phase: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 1.6,
      isCrystalSnowflake: isChristmas && i % 2 === 0,
      colorType: i % 3 // 0: primary, 1: secondary, 2: accent
    }));

    // 2. Animated Hanging & Floating Christmas Baubles (Bolas de Natal)
    const hangingBaubleCount = isChristmas
      ? Math.min(11, Math.max(4, Math.floor(width / 155)))
      : 0;
    const hangingBaubles = Array.from({ length: hangingBaubleCount }, (_, i) => {
      const spacing = width / (hangingBaubleCount + 1);
      return {
        anchorXRatio: (i + 1) / (hangingBaubleCount + 1),
        anchorX: spacing * (i + 1),
        stringLen: 24 + (i % 3) * 18 + (i % 2) * 10,
        radius: 10 + (i % 3) * 3.5,
        swingFreq: 1.35 + (i % 4) * 0.22,
        swingAmp: 0.16 + (i % 3) * 0.05,
        swingPhase: i * 1.15,
        mouseVelAngle: 0,
        mouseOffsetAngle: 0,
        styleIndex: i
      };
    });

    const floatingBaubleCount = isChristmas
      ? Math.min(8, Math.max(3, Math.floor((width * height) / 95000)))
      : 0;
    const floatingBaubles = Array.from({ length: floatingBaubleCount }, (_, i) => ({
      x: Math.random() * width,
      y: height * 0.25 + Math.random() * (height * 0.65),
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.25,
      radius: 7.5 + (i % 3) * 2.8,
      phase: i * 1.4,
      styleIndex: i + 1
    }));

    // 3. Cyberpunk Circuit Data Pulses
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

      // A. MOUSE-REACTIVE ARCANE / FESTIVE CRIMSON LANTERN GLOW
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
        if (effect === 'christmas_festive') {
          spotGrad.addColorStop(0, 'rgba(239, 68, 68, 0.28)');
          spotGrad.addColorStop(0.45, 'rgba(251, 191, 36, 0.12)');
          spotGrad.addColorStop(0.8, 'rgba(255, 255, 255, 0.06)');
          spotGrad.addColorStop(1, 'rgba(5, 4, 10, 0)');
        } else if (mouseEffect === 'cyber_scanner_lock') {
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

      // B. ABYSSAL MIASMA / ETHER WAVES / FESTIVE CRIMSON RIBBONS
      if (
        effect === 'abyssal_embers' ||
        effect === 'ether_distortion' ||
        effect === 'arcane_matrix_hybrid' ||
        effect === 'christmas_festive'
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
          if (effect === 'christmas_festive') {
            ctx.strokeStyle =
              w === 0 ? 'rgba(239, 68, 68, 0.28)' : 'rgba(251, 191, 36, 0.22)';
          } else {
            ctx.strokeStyle =
              w === 0
                ? 'rgba(168, 85, 247, 0.22)'
                : w === 1
                ? 'rgba(6, 182, 212, 0.18)'
                : 'rgba(225, 29, 72, 0.18)';
          }
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // B2. CHRISTMAS FESTIVE GARLAND LIGHTS & ANIMATED BAUBLES (BOLAS DE NATAL)
      if (effect === 'christmas_festive') {
        // Twinkling festive light garland along top edge
        if (hangingBaubles.length > 1) {
          ctx.beginPath();
          for (let i = 0; i <= width; i += 24) {
            const sag = Math.sin((i / Math.max(1, width)) * Math.PI * 3) * 10 + 6;
            if (i === 0) ctx.moveTo(i, sag);
            else ctx.lineTo(i, sag);
          }
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.32)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Floating background Christmas ornaments
        floatingBaubles.forEach((fb) => {
          fb.x += fb.vx * speed + Math.sin(elapsed * 0.9 + fb.phase) * 0.22;
          fb.y += fb.vy * speed + Math.cos(elapsed * 1.1 + fb.phase) * 0.22;
          if (fb.x < -25) fb.x = width + 25;
          if (fb.x > width + 25) fb.x = -25;
          if (fb.y < 20) fb.y = height - 20;
          if (fb.y > height - 15) fb.y = 25;

          const tilt = Math.sin(elapsed * 1.3 + fb.phase) * 0.22;
          drawChristmasBauble(
            ctx,
            fb.x,
            0,
            fb.x,
            fb.y,
            fb.radius,
            tilt,
            fb.styleIndex,
            elapsed,
            false
          );
        });

        // Hanging swinging 3D Christmas baubles at the top (reactive to mouse!)
        hangingBaubles.forEach((hb) => {
          hb.anchorX = hb.anchorXRatio * width;
          const baseAngle =
            Math.sin(elapsed * hb.swingFreq + hb.swingPhase) * hb.swingAmp;
          const totalAngle = baseAngle + hb.mouseOffsetAngle;

          const ballX = hb.anchorX + Math.sin(totalAngle) * hb.stringLen;
          const ballY = Math.cos(totalAngle) * hb.stringLen + hb.radius;

          // Mouse collision / brush physics makes the Christmas ball swing dynamically!
          if (mouse.isInside) {
            const dx = ballX - mouse.x;
            const dy = ballY - mouse.y;
            const dist = Math.hypot(dx, dy);
            const hitRadius = hb.radius * 3.2 + 28;
            if (dist < hitRadius) {
              const push = (1 - dist / hitRadius) * 0.045;
              hb.mouseVelAngle += (dx >= 0 ? 1 : -1) * push + mouse.vx * 0.0012;
            }
          }

          // Spring-damper physics on mouse-induced swing
          hb.mouseVelAngle += -hb.mouseOffsetAngle * 0.06;
          hb.mouseVelAngle *= 0.92;
          hb.mouseOffsetAngle = Math.max(
            -0.75,
            Math.min(0.75, hb.mouseOffsetAngle + hb.mouseVelAngle)
          );

          drawChristmasBauble(
            ctx,
            hb.anchorX,
            0,
            ballX,
            ballY,
            hb.radius,
            -totalAngle * 0.85,
            hb.styleIndex,
            elapsed,
            true
          );
        });
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

      // D. FLOATING ARCANE EMBERS / STARDUST / CRYSTALLINE SNOWFLAKES + MOUSE VORTEX
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
              pt.pushVx += nx * nearMouseFactor * 0.65;
              pt.pushVy += ny * nearMouseFactor * 0.65;
            } else if (mouseEffect === 'vortex_constellation') {
              const tx = -ny;
              const ty = nx;
              pt.pushVx += (tx * 0.45 + nx * 0.18) * nearMouseFactor;
              pt.pushVy += (ty * 0.45 + ny * 0.18) * nearMouseFactor;
            } else if (mouseEffect === 'cyber_scanner_lock') {
              pt.pushVx -= nx * nearMouseFactor * 0.22;
              pt.pushVy -= ny * nearMouseFactor * 0.22;
            }

            if (
              mouseEffect === 'vortex_constellation' ||
              mouseEffect === 'cyber_scanner_lock'
            ) {
              ctx.beginPath();
              ctx.strokeStyle =
                effect === 'christmas_festive'
                  ? `rgba(239, 68, 68, ${nearMouseFactor * 0.45})`
                  : mouseEffect === 'cyber_scanner_lock'
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

        const windSway =
          effect === 'christmas_festive'
            ? Math.sin(elapsed * 1.3 + pt.phase) * 0.55
            : Math.sin(elapsed * 1.4 + pt.phase) * 0.25;

        pt.x += pt.vx * speed + pt.pushVx + windSway;
        pt.y += pt.vy * speed + pt.pushVy;
        pt.rotation += pt.rotSpeed * 0.02 * speed;

        if (pt.y < -16) {
          pt.y = height + 16;
          pt.x = Math.random() * width;
        } else if (pt.y > height + 16) {
          pt.y = -16;
          pt.x = Math.random() * width;
        }
        if (pt.x < -16) pt.x = width + 16;
        if (pt.x > width + 16) pt.x = -16;

        const baseAlpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(elapsed * 2.5 + pt.phase));
        const alpha = Math.min(1, baseAlpha + nearMouseFactor * 0.5);

        if (effect === 'christmas_festive') {
          if (pt.isCrystalSnowflake) {
            const flakeTint =
              pt.colorType === 0
                ? '#ffffff'
                : pt.colorType === 1
                ? '#fecaca'
                : '#fef08a';
            drawCrystalSnowflake(
              ctx,
              pt.x,
              pt.y,
              pt.r * (1 + nearMouseFactor * 0.35),
              pt.rotation,
              alpha,
              flakeTint
            );
          } else {
            // Glowing snow mote / crimson festive ember
            const fill =
              pt.colorType === 0
                ? `rgba(255, 255, 255, ${alpha})`
                : pt.colorType === 1
                ? `rgba(239, 68, 68, ${alpha})`
                : `rgba(251, 191, 36, ${alpha})`;
            ctx.beginPath();
            ctx.fillStyle = fill;
            ctx.arc(pt.x, pt.y, pt.r * (1 + nearMouseFactor * 0.8), 0, Math.PI * 2);
            ctx.fill();
          }
          return;
        }

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

      // E. TRAILING CURSOR SPARKS / SNOWFLAKES
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
        if (sp.isSnowflake) {
          drawCrystalSnowflake(
            ctx,
            sp.x,
            sp.y,
            sp.r * 2.1 * norm,
            sp.life * 0.1,
            norm * 0.9,
            sp.color
          );
        } else {
          ctx.save();
          ctx.globalAlpha = norm * 0.85;
          ctx.fillStyle = sp.color;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.r * norm, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // F. EXPANDING ARCANE / CYBER / FESTIVE SHOCKWAVE RIPPLES
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

      // G. INTERACTIVE CURSOR RUNIC SIGIL / CYBER HUD / CHRISTMAS SNOWFLAKE RETICLE
      if (
        mouse.isInside &&
        (mouseEffect === 'vortex_constellation' ||
          mouseEffect === 'cyber_scanner_lock' ||
          mouseEffect === 'repel_shockwave')
      ) {
        ctx.save();
        ctx.translate(mouse.x, mouse.y);
        ctx.rotate(elapsed * (mouseEffect === 'cyber_scanner_lock' ? -1.4 : 0.9));

        ctx.strokeStyle =
          effect === 'christmas_festive'
            ? 'rgba(239, 68, 68, 0.5)'
            : mouseEffect === 'cyber_scanner_lock'
            ? 'rgba(6, 182, 212, 0.42)'
            : 'rgba(212, 175, 55, 0.38)';
        ctx.lineWidth = 1.1;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.rotate(-elapsed * 1.8);
        ctx.strokeStyle =
          effect === 'christmas_festive'
            ? 'rgba(251, 191, 36, 0.5)'
            : mouseEffect === 'repel_shockwave'
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
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerdown', handleWindowPointerDown);
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
  const { siteEffectsEnabled } = useSiteEffects();
  const parallaxImgRef = useRef<HTMLDivElement | null>(null);
  const parallaxAstrolabeRef = useRef<HTMLDivElement | null>(null);

  const hasCustomImage = Boolean(slot?.imageUrl && slot.imageUrl.trim() !== '');
  const handleTriggerConfig = onOpenConfig || onOpenTextureManager;

  useEffect(() => {
    if (!siteEffectsEnabled) {
      if (parallaxImgRef.current) {
        parallaxImgRef.current.style.transform = 'translate3d(0px, 0px, 0)';
      }
      if (parallaxAstrolabeRef.current) {
        parallaxAstrolabeRef.current.style.transform = 'translate3d(0px, 0px, 0)';
      }
    }
  }, [siteEffectsEnabled]);

  // Resolve active animation preset from slot or fallback based on variant
  const resolvedAnimEffect: TextureAnimationEffect = !siteEffectsEnabled
    ? 'none'
    : slot?.animationEffect ||
      (variant === 'high-magic' || variant === 'altar'
        ? 'runic_astrolabe'
        : variant === 'dark-magic' || variant === 'grimoire' || variant === 'panel'
        ? 'abyssal_embers'
        : variant === 'cyber-grid' || variant === 'cyber' || variant === 'navbar'
        ? 'cyber_circuit_pulse'
        : 'arcane_matrix_hybrid');

  const resolvedMotionEffect: ImageMotionEffect = !siteEffectsEnabled
    ? 'static'
    : slot?.imageMotionEffect || 'pan_drift';

  const resolvedMouseEffect: MouseReactiveEffect = !siteEffectsEnabled
    ? 'none'
    : slot?.mouseReactiveEffect || 'vortex_constellation';

  const speed = slot?.animationSpeed ?? 1.0;
  const intensity = slot?.effectIntensity ?? 0.85;
  const showOverlay = slot?.showProceduralOverlayWithImage ?? true;
  const isChristmas = resolvedAnimEffect === 'christmas_festive';

  // Direct DOM parallax update for zero-lag 60fps mouse parallax shift
  const handleMouseNormUpdate = (nx: number, ny: number, active: boolean) => {
    if (!siteEffectsEnabled) return;
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

  const motionClass = !siteEffectsEnabled
    ? ''
    : resolvedMotionEffect === 'pan_drift'
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
      {/* 1. Custom Uploaded Texture Image (static & lightweight when siteEffectsEnabled is false) */}
      {hasCustomImage && (
        <div
          ref={parallaxImgRef}
          className="absolute -inset-4"
        >
          <div
            className={`w-full h-full bg-cover bg-center bg-no-repeat ${motionClass}`}
            style={{
              backgroundImage: `url("${slot!.imageUrl}")`,
              opacity: siteEffectsEnabled ? (slot?.opacity ?? 0.45) : Math.min(0.28, (slot?.opacity ?? 0.45) * 0.65),
              mixBlendMode: siteEffectsEnabled ? ((slot?.blendMode || 'screen') as any) : 'normal'
            }}
          />
        </div>
      )}

      {/* 2. Procedural Animated SVG Geometric / Runic / Christmas Layer + Mouse-Reactive Canvas */}
      {siteEffectsEnabled &&
        (!hasCustomImage || showOverlay) &&
        (resolvedAnimEffect !== 'none' || resolvedMouseEffect !== 'none') && (
          <div
            className={`absolute inset-0 ${!hasCustomImage ? motionClass : ''}`}
            style={{
              opacity: hasCustomImage
                ? Math.min(0.9, (slot?.opacity ?? 0.45) * intensity)
                : Math.min(0.96, (slot?.opacity ?? 0.55) * (0.65 + intensity * 0.5))
            }}
          >
            {/* Base Pattern Grid (Cyber Hex / Runic Sigil / Festive Crimson Snowflake Grid) */}
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
                    stroke={isChristmas ? 'rgba(239,68,68,0.18)' : 'rgba(212,175,55,0.13)'}
                    strokeWidth="0.8"
                  />
                  <path
                    d="M0 36 H22 L28 30 H44 L50 36 H72 M36 0 V20 M36 52 V72"
                    fill="none"
                    stroke={isChristmas ? 'rgba(251,191,36,0.16)' : 'rgba(6,182,212,0.14)'}
                    strokeWidth="0.75"
                  />
                  <circle
                    cx="36"
                    cy="36"
                    r="2.2"
                    fill={isChristmas ? 'rgba(239,68,68,0.45)' : 'rgba(168,85,247,0.35)'}
                  />
                </pattern>

                <radialGradient id={`glow-${slot?.id || variant}`} cx="50%" cy="50%" r="55%">
                  <stop
                    offset="0%"
                    stopColor={isChristmas ? 'rgba(220,38,38,0.28)' : 'rgba(147,51,234,0.22)'}
                  />
                  <stop
                    offset="50%"
                    stopColor={isChristmas ? 'rgba(185,28,28,0.12)' : 'rgba(6,182,212,0.09)'}
                  />
                  <stop offset="100%" stopColor="rgba(5,4,10,0)" />
                </radialGradient>
              </defs>

              <rect width="100%" height="100%" fill={`url(#pat-hex-${slot?.id || variant})`} />
              <rect width="100%" height="100%" fill={`url(#glow-${slot?.id || variant})`} />
            </svg>

            {/* Rotating High-Magic Astrolabe OR Festive Crimson Christmas Snowflake Mandala */}
            {(resolvedAnimEffect === 'runic_astrolabe' ||
              resolvedAnimEffect === 'arcane_matrix_hybrid' ||
              resolvedAnimEffect === 'ether_distortion' ||
              resolvedAnimEffect === 'christmas_festive') && (
              <div
                ref={parallaxAstrolabeRef}
                className="absolute inset-0 flex items-center justify-center overflow-hidden transition-transform duration-300 ease-out"
              >
                <svg
                  className="w-[620px] h-[620px] sm:w-[820px] sm:h-[820px] opacity-40 shrink-0"
                  viewBox="0 0 600 600"
                  fill="none"
                >
                  {/* Outer Clockwise Ring */}
                  <g className="ld-anim-spin-cw" style={{ transformOrigin: '300px 300px' }}>
                    <circle
                      cx="300"
                      cy="300"
                      r="265"
                      stroke={isChristmas ? 'rgba(239,68,68,0.45)' : 'rgba(212,175,55,0.34)'}
                      strokeWidth="1.3"
                      strokeDasharray="10 8 2 8"
                    />
                    <circle
                      cx="300"
                      cy="300"
                      r="248"
                      stroke={isChristmas ? 'rgba(251,191,36,0.34)' : 'rgba(6,182,212,0.26)'}
                      strokeWidth="1"
                      strokeDasharray="36 14 6 14"
                    />
                    <rect
                      x="125"
                      y="125"
                      width="350"
                      height="350"
                      stroke={isChristmas ? 'rgba(239,68,68,0.26)' : 'rgba(212,175,55,0.18)'}
                      strokeWidth="0.9"
                    />
                    <rect
                      x="125"
                      y="125"
                      width="350"
                      height="350"
                      transform="rotate(45 300 300)"
                      stroke={isChristmas ? 'rgba(255,255,255,0.22)' : 'rgba(168,85,247,0.24)'}
                      strokeWidth="0.9"
                    />
                  </g>

                  {/* Inner Counter-Clockwise Ring / Crystalline Star */}
                  <g className="ld-anim-spin-ccw" style={{ transformOrigin: '300px 300px' }}>
                    <circle
                      cx="300"
                      cy="300"
                      r="185"
                      stroke={isChristmas ? 'rgba(239,68,68,0.42)' : 'rgba(6,182,212,0.34)'}
                      strokeWidth="1.3"
                      strokeDasharray="22 10 4 10"
                    />
                    <circle
                      cx="300"
                      cy="300"
                      r="135"
                      stroke={isChristmas ? 'rgba(251,191,36,0.36)' : 'rgba(212,175,55,0.3)'}
                      strokeWidth="1"
                      strokeDasharray="6 6"
                    />
                    <polygon
                      points="300,115 460,392 140,392"
                      stroke={isChristmas ? 'rgba(239,68,68,0.32)' : 'rgba(212,175,55,0.22)'}
                      strokeWidth="1"
                      fill="none"
                    />
                    <polygon
                      points="300,485 460,208 140,208"
                      stroke={isChristmas ? 'rgba(255,255,255,0.26)' : 'rgba(6,182,212,0.22)'}
                      strokeWidth="1"
                      fill="none"
                    />
                  </g>
                </svg>
              </div>
            )}

            {/* Real-Time Canvas Particle, Snowflakes, Christmas Baubles & Mouse-Reactive Shader Layer */}
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
      {siteEffectsEnabled &&
        (resolvedMotionEffect === 'hologram_scan' ||
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
      ? 'var(--ld-arcane-gold, #d4af37)'
      : accent === 'cyan'
      ? 'var(--ld-cyber-cyan, #06b6d4)'
      : accent === 'crimson'
      ? '#ef4444'
      : 'var(--ld-dark-magic, #a855f7)';

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
 * Shader-like Motion Effects, Global Animated Themes (including the Red Christmas Theme),
 * and Custom Texture Images for all 11 Slots (TEX-01 to TEX-11).
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
  const isChristmasActive = isChristmasThemeActiveInSlots(textures);

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
        themePillar: def.themePillar,
        animationEffect: def.animationEffect,
        imageMotionEffect: def.imageMotionEffect,
        mouseReactiveEffect: def.mouseReactiveEffect,
        animationSpeed: def.animationSpeed,
        effectIntensity: def.effectIntensity,
        opacity: def.opacity,
        showProceduralOverlayWithImage: true
      });
    }
    setFeedback(
      'Tema Padrão Cyber-Arcano restaurado com animações e reação ao mouse em todos os 11 slots!'
    );
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleApplyChristmasThemeAll = async () => {
    for (const def of Object.values(DEFAULT_THEME_TEXTURES)) {
      await onSaveSlot(def.id, {
        themePillar: 'Natalino Festivo',
        animationEffect: 'christmas_festive',
        imageMotionEffect: 'pan_drift',
        mouseReactiveEffect: 'vortex_constellation',
        animationSpeed: 1.0,
        effectIntensity: 0.92,
        opacity: Math.max(0.55, def.opacity),
        showProceduralOverlayWithImage: true
      });
    }
    setFeedback(
      '🎄 Tema Natalino ativado em todo o site! Cor principal Vermelha, Flocos de Neve e Bolas de Natal animadas!'
    );
    setTimeout(() => setFeedback(null), 4000);
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
        <CyberArcaneCornerFrame accent={isChristmasActive ? 'crimson' : 'gold'} />

        {/* Header */}
        <div className="p-5 bg-[#0b0916] border-b border-[#d4af37]/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 border flex items-center justify-center ${
                isChristmasActive
                  ? 'bg-red-950/80 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.35)]'
                  : 'bg-[#141026] border-[#d4af37]/60 text-[#d4af37]'
              }`}
            >
              {isChristmasActive ? <Gift size={20} /> : <Wand2 size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono uppercase tracking-[0.25em] ${
                    isChristmasActive ? 'text-red-400' : 'text-cyan-400'
                  }`}
                >
                  {isChristmasActive
                    ? '🎄 TEMA NATALINO ATIVO (COR PRINCIPAL: VERMELHA • NEVE & BOLAS DE NATAL)'
                    : 'Motor de Temas Animados & Reativos ao Mouse • Dark Magic × Alta Magia × Cyberpunk'}
                </span>
              </div>
              <h3 className="font-cinzel text-lg sm:text-xl font-black text-white uppercase tracking-wider">
                Temas Animados, Texturas & Efeitos Interativos (TEX-01 a TEX-11)
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleApplyChristmasThemeAll}
              className={`cyber-arcane-btn px-3.5 py-1.5 text-xs font-cinzel font-black uppercase tracking-wider flex items-center gap-1.5 transition ${
                isChristmasActive
                  ? 'bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 text-white ring-2 ring-red-400 shadow-[0_0_24px_rgba(239,68,68,0.65)]'
                  : 'bg-gradient-to-r from-red-700 to-rose-600 hover:from-red-600 hover:to-rose-500 text-white border border-red-400/60 shadow-[0_0_16px_rgba(239,68,68,0.35)]'
              }`}
              title="Ativar Tema Natalino Animado em todo o site (Cor principal vermelha, flocos de neve e bolas de natal animadas)"
            >
              <Gift size={14} />
              <span>🎄 Ativar Tema Natalino (Vermelho)</span>
            </button>

            <button
              type="button"
              onClick={handleApplyAnimatedPresetsAll}
              className="cyber-arcane-btn px-3 py-1.5 text-xs font-cinzel font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-cyan-400 text-slate-950 flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition"
              title="Restaurar o Tema Padrão Cyber-Arcano em todas as 11 áreas do site"
            >
              <Sparkles size={14} />
              <span>Tema Padrão Cyber-Arcano</span>
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
          {/* Quick Global Theme Selector Banner */}
          <div className="p-4 bg-gradient-to-r from-[#16080c] via-[#0e0b1c] to-[#16080c] border border-red-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-200 leading-relaxed">
              <div className="font-cinzel font-black text-sm text-red-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                <Gift size={15} className="text-red-400" />
                <span>Novo Tema Animado: Natalino Dinâmico (Cor Principal Vermelha)</span>
              </div>
              Inclui <strong className="text-white">flocos de neve cristalinos caindo</strong>,{' '}
              <strong className="text-red-400">bolas de natal 3D animadas</strong> que balançam ao
              passar o mouse, luzes festivas e{' '}
              <strong className="text-red-400">identidade visual vermelha</strong> em todo o site!
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleApplyChristmasThemeAll}
                className="cyber-arcane-btn px-4 py-2 text-xs font-cinzel font-black uppercase tracking-wider bg-red-600 hover:bg-red-500 text-white border border-red-300/60 shadow-[0_0_20px_rgba(239,68,68,0.5)] transition whitespace-nowrap"
              >
                🎄 Aplicar Tema Natalino Agora
              </button>
            </div>
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
                      : currentAnim === 'christmas_festive'
                      ? 'border-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                      : hasImg
                      ? 'border-[#d4af37]/60'
                      : 'border-white/15 hover:border-[#d4af37]/40'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 border font-mono text-[10px] font-bold ${
                          currentAnim === 'christmas_festive'
                            ? 'bg-red-950/80 border-red-500/60 text-red-300'
                            : 'bg-[#191330] border-[#d4af37]/50 text-[#d4af37]'
                        }`}
                      >
                        {slot.code} •{' '}
                        {currentAnim === 'christmas_festive'
                          ? 'Natalino Festivo (Vermelho)'
                          : slot.themePillar}
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
                          Tema Animado Procedural (Canvas/Runas)
                        </label>
                        <select
                          value={currentAnim}
                          onChange={(e) => {
                            const nextAnim = e.target.value as TextureAnimationEffect;
                            onSaveSlot(slot.id, {
                              animationEffect: nextAnim,
                              themePillar:
                                nextAnim === 'christmas_festive'
                                  ? 'Natalino Festivo'
                                  : DEFAULT_THEME_TEXTURES[slot.id]?.themePillar || slot.themePillar
                            });
                          }}
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

