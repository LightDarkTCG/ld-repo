import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  Package,
  RefreshCw,
  Eye,
  Upload,
  Plus,
  Trash2,
  Save,
  Settings,
  Check,
  Loader2,
  Layers,
  Search,
  Percent
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, readBrowserCache, writeBrowserCache } from '../firebase';
import { CardData } from '../types';
import { useCards, sanitizeForFirestore } from '../CardContext';
import { useAuth } from '../authService';
import { Card } from './Card';
import { CardDetailModal } from './CardDetailModal';

const CARD_BACK_URL =
  'https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0120804533.firebasestorage.app/o/cards%2FVERSO%20ARQUIVO%20FINAL%202.jpg?alt=media&token=e765f1d3-ea86-49d3-bad0-166285337cee';

export interface BoosterCustomCardEntry {
  cardCode: string;
  chancePercent: number; // Peso / porcentagem de chance de vir
}

export interface BoosterPackConfig {
  id: string;
  name: string;
  subtitle: string;
  coverImageUrl: string;
  cardsPerPack: number;
  accentColor: string;
  poolMode: 'collections_and_custom' | 'collections_only' | 'custom_only';
  allowedCollections: string[];
  rarityChances: Record<string, number>;
  customCards: BoosterCustomCardEntry[];
}

const DEFAULT_RARITY_CHANCES: Record<string, number> = {
  Comum: 55,
  Incomum: 25,
  Rara: 12,
  'Muito Rara': 5,
  'Lendária': 2,
  Exclusiva: 0.8,
  Limitada: 0.2,
  Macroversal: 0.05
};

interface BoosterOpenerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export const BoosterOpenerModal: React.FC<BoosterOpenerModalProps> = ({
  isOpen,
  onClose,
  isAdmin: isAdminProp
}) => {
  const { isAdmin: authIsAdmin } = useAuth();
  const isAdmin = Boolean(isAdminProp ?? authIsAdmin);
  const { cards: allCards, collections } = useCards();

  const [packs, setPacks] = useState<BoosterPackConfig[]>(
    () => readBrowserCache<BoosterPackConfig[]>('ld_cache_boosterPacks_v2') || []
  );
  const [selectedPackId, setSelectedPackId] = useState<string>('');

  // Pack opening state
  const [stage, setStage] = useState<'sealed' | 'ripping' | 'cards'>('sealed');
  const [pulledCards, setPulledCards] = useState<CardData[]>([]);
  const [revealedIndices, setRevealedIndices] = useState<number[]>([]);
  const [inspectedCard, setInspectedCard] = useState<CardData | null>(null);

  // Admin editor state
  const [isEditingPacks, setIsEditingPacks] = useState(false);
  const [editingPackIndex, setEditingPackIndex] = useState<number>(0);
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [savingPacks, setSavingPacks] = useState(false);
  const [uploadingPackId, setUploadingPackId] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    getDoc(doc(db, 'homeSettings', 'boosterSettings'))
      .then((snap) => {
        if (snap.exists() && Array.isArray(snap.data()?.packs)) {
          const loaded = (snap.data().packs as any[]).map((p) => ({
            id: p.id || `booster-${Date.now()}`,
            name: p.name || '',
            subtitle: p.subtitle || '',
            coverImageUrl: p.coverImageUrl || '',
            cardsPerPack: Number(p.cardsPerPack) || 5,
            accentColor: p.accentColor || '#9333ea',
            poolMode: p.poolMode || 'collections_and_custom',
            allowedCollections: Array.isArray(p.allowedCollections) ? p.allowedCollections : [],
            rarityChances: p.rarityChances || { ...DEFAULT_RARITY_CHANCES },
            customCards: Array.isArray(p.customCards) ? p.customCards : []
          })) as BoosterPackConfig[];
          setPacks(loaded);
          writeBrowserCache('ld_cache_boosterPacks_v2', loaded);
          if (loaded.length > 0 && !loaded.some((p) => p.id === selectedPackId)) {
            setSelectedPackId(loaded[0].id);
          }
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const currentPack = useMemo(
    () => packs.find((p) => p.id === selectedPackId) || packs[0] || null,
    [packs, selectedPackId]
  );

  const getRarityGlowClass = (rarity?: string): string => {
    const r = (rarity || '').toLowerCase();
    if (r.includes('macroversal')) {
      return 'ring-4 ring-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.9)]';
    }
    if (r.includes('lendária') || r.includes('lendaria') || r.includes('exclusiva') || r.includes('limitada')) {
      return 'ring-2 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.75)]';
    }
    if (r.includes('muito rara') || r.includes('super rara')) {
      return 'ring-2 ring-purple-400 shadow-[0_0_22px_rgba(168,85,247,0.7)]';
    }
    if (r.includes('rara')) {
      return 'ring-2 ring-blue-400 shadow-[0_0_18px_rgba(59,130,246,0.6)]';
    }
    return 'ring-1 ring-slate-700 shadow-lg';
  };

  const getCardRarityWeight = (card: CardData, rarityChances: Record<string, number>): number => {
    const rRaw = (card.rarity || 'Comum').trim();
    if (typeof rarityChances[rRaw] === 'number') {
      return Math.max(0, rarityChances[rRaw]);
    }
    const rLower = rRaw.toLowerCase();
    for (const [key, val] of Object.entries(rarityChances)) {
      if (rLower.includes(key.toLowerCase())) {
        return Math.max(0, Number(val) || 0);
      }
    }
    return 10;
  };

  const generatePackCards = (pack: BoosterPackConfig): CardData[] => {
    const weightedPool: { card: CardData; weight: number }[] = [];
    const addedCodes = new Set<string>();

    // 1. Cartas adicionadas manualmente com chance específica
    if (pack.poolMode === 'custom_only' || pack.poolMode === 'collections_and_custom') {
      for (const entry of pack.customCards || []) {
        const found = allCards.find(
          (c) => String(c.code || '').trim().toLowerCase() === String(entry.cardCode || '').trim().toLowerCase()
        );
        if (found && (Number(entry.chancePercent) || 0) > 0) {
          weightedPool.push({
            card: found,
            weight: Number(entry.chancePercent)
          });
          addedCodes.add(found.code);
        }
      }
    }

    // 2. Cartas vindas das coleções permitidas ponderadas pela chance da raridade
    if (pack.poolMode === 'collections_only' || pack.poolMode === 'collections_and_custom') {
      const allowedSet = new Set((pack.allowedCollections || []).map((c) => c.trim().toLowerCase()));
      const collectionCards = allCards.filter((c) => {
        if (c.isHidden) return false;
        if (addedCodes.has(c.code)) return false;
        if (allowedSet.size === 0) return false;
        return allowedSet.has((c.collection || '').trim().toLowerCase());
      });

      for (const card of collectionCards) {
        const w = getCardRarityWeight(card, pack.rarityChances || DEFAULT_RARITY_CHANCES);
        if (w > 0) {
          weightedPool.push({ card, weight: w });
        }
      }
    }

    if (weightedPool.length === 0) {
      return [];
    }

    const count = Math.max(1, Math.min(15, pack.cardsPerPack || 5));
    const result: CardData[] = [];
    let available = [...weightedPool];

    for (let i = 0; i < count; i++) {
      if (available.length === 0) {
        available = [...weightedPool];
      }
      const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
      let roll = Math.random() * (totalWeight || 1);
      let chosenIdx = 0;

      for (let j = 0; j < available.length; j++) {
        roll -= available[j].weight;
        if (roll <= 0) {
          chosenIdx = j;
          break;
        }
      }

      result.push(available[chosenIdx].card);
      available.splice(chosenIdx, 1);
    }

    return result;
  };

  const handleOpenPack = () => {
    if (!currentPack || stage !== 'sealed') return;
    const generated = generatePackCards(currentPack);
    if (generated.length === 0) {
      alert(
        'Este booster ainda não possui cartas ou coleções configuradas. Configure as cartas/coleções no painel de Admin.'
      );
      return;
    }
    setStage('ripping');
    setPulledCards(generated);
    setRevealedIndices([]);
    setTimeout(() => {
      setStage('cards');
    }, 650);
  };

  const handleRevealCard = (index: number) => {
    if (!revealedIndices.includes(index)) {
      setRevealedIndices((prev) => [...prev, index]);
    } else {
      setInspectedCard(pulledCards[index]);
    }
  };

  const handleRevealAll = () => {
    setRevealedIndices(pulledCards.map((_, idx) => idx));
  };

  const handleResetPack = () => {
    setStage('sealed');
    setPulledCards([]);
    setRevealedIndices([]);
  };

  const handleUploadBoosterCover = async (packId: string, file: File) => {
    try {
      setUploadingPackId(packId);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageRef = ref(storage, `booster_covers/${Date.now()}_${safeName}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setPacks((prev) =>
        prev.map((p) => (p.id === packId ? { ...p, coverImageUrl: url } : p))
      );
      setSaveFeedback('Imagem de capa enviada! Clique em Salvar Alterações para confirmar.');
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err) {
      console.error('Erro ao enviar capa do booster:', err);
      alert('Erro ao fazer upload da imagem de capa.');
    } finally {
      setUploadingPackId(null);
    }
  };

  const handleSavePacksToFirestore = async () => {
    try {
      setSavingPacks(true);
      const payload = sanitizeForFirestore({
        packs,
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'homeSettings', 'boosterSettings'), payload, { merge: true });
      writeBrowserCache('ld_cache_boosterPacks_v2', packs);
      if (packs.length > 0 && !packs.some((p) => p.id === selectedPackId)) {
        setSelectedPackId(packs[0].id);
      }
      setSaveFeedback('Configurações de Boosters salvas com sucesso!');
      setTimeout(() => setSaveFeedback(null), 3500);
    } catch (err) {
      console.error('Erro ao salvar boosters:', err);
      alert('Erro ao salvar configurações dos boosters.');
    } finally {
      setSavingPacks(false);
    }
  };

  const handleAddPack = () => {
    const newPack: BoosterPackConfig = {
      id: `booster-${Date.now()}`,
      name: '',
      subtitle: '',
      coverImageUrl: '',
      cardsPerPack: 5,
      accentColor: '#9333ea',
      poolMode: 'collections_and_custom',
      allowedCollections: [],
      rarityChances: { ...DEFAULT_RARITY_CHANCES },
      customCards: []
    };
    const next = [...packs, newPack];
    setPacks(next);
    setEditingPackIndex(next.length - 1);
    setSelectedPackId(newPack.id);
    setIsEditingPacks(true);
  };

  const handleRemovePack = (id: string) => {
    const next = packs.filter((p) => p.id !== id);
    setPacks(next);
    setEditingPackIndex(0);
    if (selectedPackId === id) {
      setSelectedPackId(next[0]?.id || '');
    }
  };

  if (!isOpen) return null;

  const activeEditPack = packs[editingPackIndex] || null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      {inspectedCard && (
        <CardDetailModal card={inspectedCard} onClose={() => setInspectedCard(null)} />
      )}

      <div className="relative w-full max-w-6xl bg-[#0b0b10] border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600/30 to-amber-500/20 border border-purple-500/40 flex items-center justify-center text-amber-400 shadow-lg">
              <Package size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700/50">
                  Pack Opener
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                SIMULADOR DE ABERTURA DE BOOSTER
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsEditingPacks((prev) => !prev)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                  isEditingPacks
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg'
                    : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-500/40'
                }`}
              >
                <Settings size={14} />
                {isEditingPacks ? 'Fechar Editor Admin' : 'Gerenciar Boosters & Chances (Admin)'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Admin Configuration Panel */}
          {isAdmin && isEditingPacks && (
            <div className="rounded-2xl border border-amber-500/40 bg-slate-950/95 p-4 sm:p-6 space-y-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-amber-300 flex items-center gap-2">
                    <Settings size={18} />
                    Configurar Boosters, Capas, Coleções e Chances de Drop
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Crie seus próprios boosters, escolha a capa, quais coleções ou cartas específicas podem vir e a chance (%) de cada uma.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleAddPack}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Plus size={14} className="text-amber-400" />
                    Adicionar Booster
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePacksToFirestore}
                    disabled={savingPacks}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg transition disabled:opacity-50"
                  >
                    {savingPacks ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Salvar Alterações
                  </button>
                </div>
              </div>

              {saveFeedback && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <Check size={15} />
                  {saveFeedback}
                </div>
              )}

              {packs.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl text-slate-400 text-xs space-y-3">
                  <p>Nenhum booster cadastrado.</p>
                  <button
                    type="button"
                    onClick={handleAddPack}
                    className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Criar Primeiro Booster
                  </button>
                </div>
              ) : (
                <>
                  {/* Seletor de qual Booster está sendo editado */}
                  <div className="flex items-center gap-2 flex-wrap border-b border-slate-800 pb-3">
                    {packs.map((p, idx) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setEditingPackIndex(idx)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-2 ${
                          editingPackIndex === idx
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                        }`}
                      >
                        <span>{p.name || `Booster #${idx + 1}`}</span>
                      </button>
                    ))}
                  </div>

                  {activeEditPack && (
                    <div className="space-y-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5">
                      {/* 1. Dados Básicos & Capa */}
                      <div className="flex flex-col md:flex-row gap-5">
                        <div className="w-32 sm:w-36 shrink-0 flex flex-col items-center gap-2 mx-auto md:mx-0">
                          <div className="w-28 h-40 rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-950 shadow-lg relative flex items-center justify-center">
                            {activeEditPack.coverImageUrl ? (
                              <img
                                src={activeEditPack.coverImageUrl}
                                alt={activeEditPack.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] text-slate-500 text-center px-2">
                                Sem Capa
                              </span>
                            )}
                          </div>
                          <label className="w-full cursor-pointer px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition">
                            {uploadingPackId === activeEditPack.id ? (
                              <>
                                <Loader2 size={12} className="animate-spin" />
                                Enviando...
                              </>
                            ) : (
                              <>
                                <Upload size={12} />
                                Upload Capa
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingPackId === activeEditPack.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadBoosterCover(activeEditPack.id, file);
                              }}
                            />
                          </label>
                        </div>

                        <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                              1. Identificação e Capa do Booster
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemovePack(activeEditPack.id)}
                              className="px-2.5 py-1 rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/40 text-[11px] font-bold flex items-center gap-1"
                            >
                              <Trash2 size={12} /> Excluir Booster
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                                Nome do Booster
                              </label>
                              <input
                                type="text"
                                value={activeEditPack.name}
                                placeholder="Digite o nome do booster..."
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPacks((prev) =>
                                    prev.map((p, i) => (i === editingPackIndex ? { ...p, name: val } : p))
                                  );
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                                Subtítulo / Descrição
                              </label>
                              <input
                                type="text"
                                value={activeEditPack.subtitle}
                                placeholder="Opcional..."
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPacks((prev) =>
                                    prev.map((p, i) => (i === editingPackIndex ? { ...p, subtitle: val } : p))
                                  );
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                                Cartas por Pacote
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={15}
                                value={activeEditPack.cardsPerPack}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 5;
                                  setPacks((prev) =>
                                    prev.map((p, i) =>
                                      i === editingPackIndex ? { ...p, cardsPerPack: val } : p
                                    )
                                  );
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                                Modo de Sorteio
                              </label>
                              <select
                                value={activeEditPack.poolMode}
                                onChange={(e) => {
                                  const val = e.target.value as BoosterPackConfig['poolMode'];
                                  setPacks((prev) =>
                                    prev.map((p, i) => (i === editingPackIndex ? { ...p, poolMode: val } : p))
                                  );
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                              >
                                <option value="collections_and_custom">
                                  Coleções Marcadas + Cartas Específicas
                                </option>
                                <option value="collections_only">Apenas Coleções Marcadas</option>
                                <option value="custom_only">Apenas Cartas Específicas Abaixo</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                                Cor de Destaque
                              </label>
                              <input
                                type="color"
                                value={activeEditPack.accentColor || '#9333ea'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPacks((prev) =>
                                    prev.map((p, i) =>
                                      i === editingPackIndex ? { ...p, accentColor: val } : p
                                    )
                                  );
                                }}
                                className="w-full h-8 bg-slate-950 border border-slate-800 rounded-lg px-1 cursor-pointer"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                              URL da Imagem de Capa do Booster
                            </label>
                            <input
                              type="text"
                              value={activeEditPack.coverImageUrl}
                              placeholder="Cole uma URL de imagem ou use o botão Upload Capa..."
                              onChange={(e) => {
                                const val = e.target.value;
                                setPacks((prev) =>
                                  prev.map((p, i) =>
                                    i === editingPackIndex ? { ...p, coverImageUrl: val } : p
                                  )
                                );
                              }}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 2. Seleção de Coleções que vêm no Booster */}
                      {activeEditPack.poolMode !== 'custom_only' && (
                        <div className="border-t border-slate-800 pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                              2. Coleções que podem vir neste Booster
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Marque uma ou mais coleções do catálogo
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {collections.map((col) => {
                              const checked = (activeEditPack.allowedCollections || []).includes(col);
                              return (
                                <button
                                  key={col}
                                  type="button"
                                  onClick={() => {
                                    const current = activeEditPack.allowedCollections || [];
                                    const nextCols = checked
                                      ? current.filter((c) => c !== col)
                                      : [...current, col];
                                    setPacks((prev) =>
                                      prev.map((p, i) =>
                                        i === editingPackIndex
                                          ? { ...p, allowedCollections: nextCols }
                                          : p
                                      )
                                    );
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                                    checked
                                      ? 'bg-purple-600/30 border-purple-400 text-white'
                                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  <Check
                                    size={12}
                                    className={checked ? 'text-purple-300 opacity-100' : 'opacity-0'}
                                  />
                                  <span>{col}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 3. Chance por Raridade */}
                      {activeEditPack.poolMode !== 'custom_only' && (
                        <div className="border-t border-slate-800 pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                              <Percent size={13} /> 3. Peso / Chance de Vir por Raridade (%)
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Define a proporção de sorteio das cartas das coleções marcadas
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {Object.entries(
                              activeEditPack.rarityChances || DEFAULT_RARITY_CHANCES
                            ).map(([rarName, weight]) => (
                              <div
                                key={rarName}
                                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2"
                              >
                                <span className="text-xs font-bold text-slate-300 truncate">
                                  {rarName}
                                </span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={weight}
                                    onChange={(e) => {
                                      const val = Math.max(0, Number(e.target.value) || 0);
                                      setPacks((prev) =>
                                        prev.map((p, i) =>
                                          i === editingPackIndex
                                            ? {
                                                ...p,
                                                rarityChances: {
                                                  ...(p.rarityChances || DEFAULT_RARITY_CHANCES),
                                                  [rarName]: val
                                                }
                                              }
                                            : p
                                        )
                                      );
                                    }}
                                    className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300 font-mono text-right"
                                  />
                                  <span className="text-[10px] text-slate-500">%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 4. Cartas Específicas que podem vir + Chance individual */}
                      {activeEditPack.poolMode !== 'collections_only' && (
                        <div className="border-t border-slate-800 pt-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">
                              4. Cartas Específicas do Booster e Chance Individual (%)
                            </span>
                            <div className="relative w-full sm:w-72">
                              <Search
                                size={13}
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                              />
                              <input
                                type="text"
                                value={cardSearchQuery}
                                onChange={(e) => setCardSearchQuery(e.target.value)}
                                placeholder="Buscar carta por nome ou código..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white"
                              />
                            </div>
                          </div>

                          {/* Resultados de busca rápida para adicionar carta */}
                          {cardSearchQuery.trim().length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                              {allCards
                                .filter((c) => {
                                  const q = cardSearchQuery.trim().toLowerCase();
                                  return (
                                    c.name.toLowerCase().includes(q) ||
                                    String(c.code || '').toLowerCase().includes(q) ||
                                    (c.collection || '').toLowerCase().includes(q)
                                  );
                                })
                                .slice(0, 20)
                                .map((c) => {
                                  const alreadyIn = (activeEditPack.customCards || []).some(
                                    (entry) => entry.cardCode === c.code
                                  );
                                  return (
                                    <button
                                      key={c.code}
                                      type="button"
                                      onClick={() => {
                                        if (alreadyIn) return;
                                        const nextCustom = [
                                          ...(activeEditPack.customCards || []),
                                          { cardCode: c.code, chancePercent: 10 }
                                        ];
                                        setPacks((prev) =>
                                          prev.map((p, i) =>
                                            i === editingPackIndex
                                              ? { ...p, customCards: nextCustom }
                                              : p
                                          )
                                        );
                                      }}
                                      className={`p-1.5 rounded-lg border text-left text-[11px] flex items-center gap-2 transition ${
                                        alreadyIn
                                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                                          : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-amber-400'
                                      }`}
                                    >
                                      {c.imageUrl && (
                                        <img
                                          src={c.imageUrl}
                                          alt=""
                                          className="w-6 h-8 object-cover rounded shrink-0"
                                        />
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="font-bold truncate">{c.name}</div>
                                        <div className="text-[9px] text-slate-400 font-mono">
                                          #{c.code} · {alreadyIn ? 'Adicionada' : '+ Incluir'}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                            </div>
                          )}

                          {/* Lista de cartas específicas configuradas */}
                          {(activeEditPack.customCards || []).length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
                              {(activeEditPack.customCards || []).map((entry, cIdx) => {
                                const cardObj = allCards.find((c) => c.code === entry.cardCode);
                                return (
                                  <div
                                    key={entry.cardCode}
                                    className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {cardObj?.imageUrl && (
                                        <img
                                          src={cardObj.imageUrl}
                                          alt=""
                                          className="w-8 h-11 object-cover rounded shrink-0"
                                        />
                                      )}
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-white truncate">
                                          {cardObj?.name || `Carta #${entry.cardCode}`}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono">
                                          Cód: {entry.cardCode} · {cardObj?.rarity || 'Comum'}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={entry.chancePercent}
                                        onChange={(e) => {
                                          const val = Math.max(0, Number(e.target.value) || 0);
                                          setPacks((prev) =>
                                            prev.map((p, i) => {
                                              if (i !== editingPackIndex) return p;
                                              const updated = [...(p.customCards || [])];
                                              updated[cIdx] = { ...updated[cIdx], chancePercent: val };
                                              return { ...p, customCards: updated };
                                            })
                                          );
                                        }}
                                        className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300 font-mono text-right"
                                        title="Chance / Peso (%)"
                                      />
                                      <span className="text-[10px] text-slate-400">%</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPacks((prev) =>
                                            prev.map((p, i) => {
                                              if (i !== editingPackIndex) return p;
                                              return {
                                                ...p,
                                                customCards: (p.customCards || []).filter(
                                                  (_, idx) => idx !== cIdx
                                                )
                                              };
                                            })
                                          );
                                        }}
                                        className="p-1 text-red-400 hover:text-red-300"
                                        title="Remover carta do booster"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic">
                              Nenhuma carta específica adicionada individualmente. Use a busca acima se quiser fixar cartas e chances individuais neste booster.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Quando não há boosters cadastrados */}
          {packs.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <Package size={48} className="mx-auto text-slate-600" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Nenhum Booster disponível no momento</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {isAdmin
                    ? 'Clique no botão abaixo para adicionar seu primeiro booster, definir a imagem de capa, a coleção e as chances das cartas.'
                    : 'Novos pacotes de booster serão liberados pelo administrador em breve.'}
                </p>
              </div>
              {isAdmin && !isEditingPacks && (
                <button
                  type="button"
                  onClick={handleAddPack}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 shadow-lg transition"
                >
                  <Plus size={15} /> Adicionar Primeiro Booster
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Pack Selector Tabs */}
              <div className="flex items-center justify-center gap-2.5 flex-wrap">
                {packs.map((pack) => {
                  const active = pack.id === currentPack?.id;
                  return (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => {
                        setSelectedPackId(pack.id);
                        handleResetPack();
                      }}
                      className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition flex items-center gap-2 border ${
                        active
                          ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-900/40 scale-105'
                          : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800'
                      }`}
                    >
                      <Layers size={15} className={active ? 'text-amber-300' : 'text-purple-400'} />
                      <span>{pack.name || 'Booster'}</span>
                    </button>
                  );
                })}
              </div>

              {/* Pack Opening Stage */}
              {currentPack && stage !== 'cards' ? (
                <div className="py-6 sm:py-10 flex flex-col items-center justify-center text-center">
                  <div
                    onClick={handleOpenPack}
                    className={`relative cursor-pointer group select-none transition-all duration-500 ${
                      stage === 'ripping'
                        ? 'scale-110 rotate-2 opacity-0 blur-md'
                        : 'hover:scale-105 hover:-translate-y-2'
                    }`}
                  >
                    <div
                      className="absolute -inset-6 rounded-3xl blur-2xl opacity-50 group-hover:opacity-80 transition duration-500"
                      style={{ backgroundColor: currentPack.accentColor || '#9333ea' }}
                    />

                    <div className="relative w-60 sm:w-72 aspect-[2.5/3.7] rounded-2xl overflow-hidden border-2 border-amber-400/60 bg-slate-950 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col justify-between">
                      <div className="h-5 w-full bg-gradient-to-r from-slate-800 via-slate-600 to-slate-800 border-b border-amber-400/40 flex items-center justify-center">
                        <div className="w-full border-b border-dashed border-amber-300/60" />
                      </div>

                      <div className="relative flex-1 overflow-hidden">
                        <img
                          src={currentPack.coverImageUrl || CARD_BACK_URL}
                          alt={currentPack.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />
                        <div className="absolute bottom-3 inset-x-3 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-widest bg-amber-500 text-slate-950 mb-1 shadow">
                            {currentPack.cardsPerPack || 5} Cartas
                          </span>
                          <h3 className="text-base sm:text-lg font-black text-white drop-shadow-md leading-tight">
                            {currentPack.name}
                          </h3>
                          {currentPack.subtitle && (
                            <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">
                              {currentPack.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="h-3 w-full bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 border-t border-slate-700" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenPack}
                    className="mt-8 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 hover:from-amber-400 hover:via-purple-500 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-purple-950/60 flex items-center gap-2 transition active:scale-95"
                  >
                    <Sparkles size={18} className="text-amber-200 animate-spin" />
                    Rasgar Pacote Agora
                  </button>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5">
                    <div>
                      <h4 className="text-sm font-black text-white flex items-center gap-2">
                        <Sparkles size={16} className="text-amber-400" />
                        Cartas Obtidas em {currentPack?.name}
                      </h4>
                      <p className="text-xs text-slate-400">
                        Clique nas cartas viradas para revelá-las, ou clique numa carta revelada para ampliar.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {revealedIndices.length < pulledCards.length && (
                        <button
                          type="button"
                          onClick={handleRevealAll}
                          className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
                        >
                          <Eye size={14} />
                          Revelar Todas
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleResetPack}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition shadow-md"
                      >
                        <RefreshCw size={14} />
                        Abrir Outro Pacote
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 justify-items-center py-2">
                    {pulledCards.map((card, idx) => {
                      const isRevealed = revealedIndices.includes(idx);
                      return (
                        <div
                          key={`${card.code}-${idx}`}
                          onClick={() => handleRevealCard(idx)}
                          className="w-full max-w-[210px] flex flex-col items-center cursor-pointer group"
                        >
                          {!isRevealed ? (
                            <div className="relative w-full aspect-[2.5/3.5] rounded-xl overflow-hidden border-2 border-purple-500/50 shadow-xl group-hover:scale-105 group-hover:border-amber-400 transition duration-300 bg-slate-950">
                              <img
                                src={currentPack?.coverImageUrl || CARD_BACK_URL}
                                alt="Carta Oculta"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-center p-3">
                                <span className="px-2.5 py-1 rounded-full bg-purple-600/90 text-white text-[10px] font-black uppercase tracking-wider shadow">
                                  Toque p/ Revelar
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`w-full rounded-xl p-1 transition duration-300 group-hover:scale-105 ${getRarityGlowClass(
                                card.rarity
                              )}`}
                            >
                              <div className="w-full overflow-hidden rounded-lg">
                                <Card card={card} />
                              </div>
                              <div className="mt-2 text-center px-1">
                                <div className="text-[11px] font-black text-white truncate">
                                  {card.name}
                                </div>
                                <div className="text-[10px] font-mono text-amber-300 truncate">
                                  {card.rarity || 'Comum'}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
