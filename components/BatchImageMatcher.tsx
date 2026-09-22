import React, { useState, useMemo, useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Check, 
  X, 
  Search, 
  ArrowRight, 
  Layers, 
  Trash2, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Filter, 
  GripVertical,
  HelpCircle,
  Loader2,
  Sparkles,
  Shield,
  Tag,
  Palette,
  SlidersHorizontal,
  ChevronRight,
  Plus
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { CardData } from '../types';
import { compareCardCodes } from '../deckUtils';

interface StagedImage {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  sizeFormatted: string;
}

interface BatchImageMatcherProps {
  cards: CardData[];
  collections: string[];
  saveCard: (card: CardData) => Promise<void>;
  onSuccess?: () => void;
}

export const BatchImageMatcher: React.FC<BatchImageMatcherProps> = ({
  cards,
  collections,
  saveCard,
  onSuccess
}) => {
  // Uploaded images in tray
  const [stagedImages, setStagedImages] = useState<StagedImage[]>([]);
  // Mapping: cardCode -> imageId
  const [assignments, setAssignments] = useState<{ [cardCode: string]: string }>({});
  
  // Selection / Dragging state
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [hoveredCardCode, setHoveredCardCode] = useState<string | null>(null);

  // --- Variation Settings ---
  // Mode: 'add_variation' (Non-destructive: keeps old card, creates variation) vs 'replace_original' (Overwrites old card's image)
  const [operationMode, setOperationMode] = useState<'add_variation' | 'replace_original'>('add_variation');
  
  // Variation Type preset
  const [variationPreset, setVariationPreset] = useState<'novo_frame' | 'arte_alternativa' | 'skin' | 'custom'>('novo_frame');
  const [codeSuffix, setCodeSuffix] = useState<string>('-M');
  const [variationFrame, setVariationFrame] = useState<'Moderno' | 'Legado'>('Moderno');
  const [customVariationTitle, setCustomVariationTitle] = useState<string>('Novo Frame');
  const [targetCollectionMode, setTargetCollectionMode] = useState<'same' | 'custom'>('same');
  const [customCollectionName, setCustomCollectionName] = useState<string>('');

  // Filters
  const [selectedCollection, setSelectedCollection] = useState<string>(() => {
    if (collections.includes('Legado')) return 'Legado';
    return collections[0] || '';
  });
  const [cardSearchTerm, setCardSearchTerm] = useState('');
  const [imageSearchTerm, setImageSearchTerm] = useState('');
  const [cardStatusFilter, setCardStatusFilter] = useState<'all' | 'pending' | 'assigned'>('all');

  // Saving states
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ current: number; total: number; cardName: string } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format file size nicely
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Add files to staging
  const handleAddFiles = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    const newStaged: StagedImage[] = validFiles.map(file => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${file.name}`;
      return {
        id,
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        sizeFormatted: formatBytes(file.size)
      };
    });

    setStagedImages(prev => [...prev, ...newStaged]);
    setSaveSuccessMsg(null);
  };

  // Drag and Drop from OS / Desktop to dropzone
  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  // Clear single staged image
  const handleRemoveStagedImage = (imageId: string) => {
    setAssignments(prev => {
      const next = { ...prev };
      for (const [cCode, imgId] of Object.entries(next)) {
        if (imgId === imageId) {
          delete next[cCode];
        }
      }
      return next;
    });

    setStagedImages(prev => {
      const target = prev.find(i => i.id === imageId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter(i => i.id !== imageId);
    });

    if (selectedImageId === imageId) {
      setSelectedImageId(null);
    }
  };

  // Clear all staged images
  const handleClearAllImages = () => {
    if (stagedImages.length > 0 && !confirm('Deseja remover todas as imagens carregadas da bandeja?')) {
      return;
    }
    stagedImages.forEach(i => URL.revokeObjectURL(i.previewUrl));
    setStagedImages([]);
    setAssignments({});
    setSelectedImageId(null);
  };

  // Handle Preset Change
  const handlePresetChange = (preset: 'novo_frame' | 'arte_alternativa' | 'skin' | 'custom') => {
    setVariationPreset(preset);
    if (preset === 'novo_frame') {
      setCodeSuffix('-M');
      setVariationFrame('Moderno');
      setCustomVariationTitle('Novo Frame (Moderno)');
    } else if (preset === 'arte_alternativa') {
      setCodeSuffix('-ALT');
      setVariationFrame('Moderno');
      setCustomVariationTitle('Arte Alternativa');
    } else if (preset === 'skin') {
      setCodeSuffix('-SKIN');
      setVariationFrame('Moderno');
      setCustomVariationTitle('Skin');
    } else {
      setCodeSuffix('-V2');
      setCustomVariationTitle('Variação');
    }
  };

  // Calculate generated code for a card in variation mode
  const getGeneratedCode = (baseCode: string) => {
    if (operationMode === 'replace_original') return baseCode;
    const cleanSuffix = codeSuffix.trim();
    if (!cleanSuffix) return `${baseCode}-VAR`;
    return `${baseCode}${cleanSuffix}`;
  };

  // Assign image to card
  const assignImageToCard = (cardCode: string, imageId: string) => {
    setAssignments(prev => ({
      ...prev,
      [cardCode]: imageId
    }));
    if (selectedImageId === imageId) {
      setSelectedImageId(null);
    }
  };

  // Unassign card
  const unassignCard = (cardCode: string) => {
    setAssignments(prev => {
      const next = { ...prev };
      delete next[cardCode];
      return next;
    });
  };

  // Filtered images in tray
  const filteredStagedImages = useMemo(() => {
    return stagedImages.filter(img => {
      if (!imageSearchTerm.trim()) return true;
      return img.name.toLowerCase().includes(imageSearchTerm.toLowerCase());
    });
  }, [stagedImages, imageSearchTerm]);

  // Filtered cards list
  const displayCards = useMemo(() => {
    return cards
      .filter(card => {
        // Exclude variations themselves from being base cards if needed, but allow all
        if (selectedCollection && card.collection !== selectedCollection) return false;
        
        if (cardSearchTerm.trim()) {
          const s = cardSearchTerm.toLowerCase();
          const matchName = (card.name || '').toLowerCase().includes(s);
          const matchCode = (card.code || '').toLowerCase().includes(s);
          if (!matchName && !matchCode) return false;
        }

        const isAssigned = !!assignments[card.code];
        if (cardStatusFilter === 'assigned' && !isAssigned) return false;
        if (cardStatusFilter === 'pending' && isAssigned) return false;

        return true;
      })
      .sort((a, b) => compareCardCodes(a.code, b.code));
  }, [cards, selectedCollection, cardSearchTerm, cardStatusFilter, assignments]);

  // Count assigned
  const assignedCount = Object.keys(assignments).length;

  // Save all assignments to Firebase
  const handleSaveAll = async () => {
    if (assignedCount === 0) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      const assignedCodes = Object.keys(assignments);
      let successCount = 0;

      for (let i = 0; i < assignedCodes.length; i++) {
        const cCode = assignedCodes[i];
        const imgId = assignments[cCode];
        const staged = stagedImages.find(img => img.id === imgId);
        const card = cards.find(c => c.code === cCode);

        if (!staged || !card) continue;

        setSaveProgress({
          current: i + 1,
          total: assignedCodes.length,
          cardName: card.name
        });

        // Upload to Firebase Storage
        const cleanExt = staged.file.name.split('.').pop() || 'png';
        const folder = operationMode === 'add_variation' ? 'cards_variations' : 'cards_updated';
        const storagePath = `${folder}/${Date.now()}_${card.code.replace(/\//g, '_')}_${i}.${cleanExt}`;
        const fileRef = ref(storage, storagePath);
        
        await uploadBytes(fileRef, staged.file);
        const newDownloadUrl = await getDownloadURL(fileRef);

        if (operationMode === 'add_variation') {
          // 1. Calculate new variation code and attributes
          const newCode = getGeneratedCode(card.code);
          const title = customVariationTitle.trim() || 'Variação';
          const targetCollection = (targetCollectionMode === 'custom' && customCollectionName.trim()) 
            ? customCollectionName.trim() 
            : card.collection;

          // 2. Save NEW variation card (preserves the original card untouched!)
          const newCard: CardData = {
            ...card,
            code: newCode,
            imageUrl: newDownloadUrl,
            frame: variationFrame,
            collection: targetCollection,
            isVariation: true,
            parentCode: card.code,
            variationType: title
          };
          await saveCard(newCard);

          // 3. Update the original card's variants list WITHOUT modifying its imageUrl or frame
          const currentVariants = card.variants || [];
          const updatedVariants = [
            ...currentVariants.filter(v => v.code !== newCode),
            {
              id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: title,
              imageUrl: newDownloadUrl,
              frame: variationFrame,
              code: newCode,
              rarity: card.rarity
            }
          ];
          await saveCard({
            ...card,
            variants: updatedVariants
          });

        } else {
          // Replace original card's image
          await saveCard({
            ...card,
            imageUrl: newDownloadUrl
          });
        }

        successCount++;
      }

      // Cleanup saved staged images from memory and tray
      const savedImageIds = Object.values(assignments);
      setStagedImages(prev => {
        prev.forEach(img => {
          if (savedImageIds.includes(img.id)) {
            URL.revokeObjectURL(img.previewUrl);
          }
        });
        return prev.filter(img => !savedImageIds.includes(img.id));
      });

      // Clear assignments
      setAssignments({});
      setSelectedImageId(null);

      if (operationMode === 'add_variation') {
        setSaveSuccessMsg(`🎉 Sucesso! ${successCount} nova(s) variação(ões) adicionada(s) com sucesso (com código sufixado "${codeSuffix}" e Frame ${variationFrame}) sem alterar as cartas originais!`);
      } else {
        setSaveSuccessMsg(`🎉 Sucesso! ${successCount} carta(s) tiveram sua imagem original atualizada!`);
      }
      if (onSuccess) onSuccess();

    } catch (err: any) {
      console.error(err);
      setErrorMessage(`Erro ao salvar imagens: ${err.message || 'Falha no upload'}`);
    } finally {
      setIsSaving(false);
      setSaveProgress(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-slate-200">
      
      {/* Top Banner / Explainer */}
      <div className="bg-gradient-to-r from-purple-950/90 via-slate-900 to-indigo-950/90 border border-purple-500/40 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-purple-600/30 text-purple-300 border border-purple-500/40">
              <Sparkles size={18} className="text-amber-400" />
            </span>
            <h3 className="text-xl font-black text-white tracking-wide">
              Adicionar Variações, Novos Frames & Skins (Arrastar & Soltar)
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Faça upload das imagens atualizadas e <strong>arraste cada imagem para a carta correspondente</strong>. As cartas antigas <strong>NÃO</strong> são substituídas — uma nova variação (com novo frame e código próprio) é criada preservando a original.
          </p>
        </div>

        {/* Global Save Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleSaveAll}
            disabled={isSaving || assignedCount === 0}
            className={`px-5 py-3 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg transition-all ${
              assignedCount > 0
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/60 hover:scale-105 active:scale-95 cursor-pointer'
                : 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 size={18} className="animate-spin text-white" />
                <span>Salvando ({saveProgress?.current}/{saveProgress?.total})...</span>
              </>
            ) : (
              <>
                <Check size={18} />
                <span>
                  {operationMode === 'add_variation' 
                    ? `Criar ${assignedCount} Variações` 
                    : `Atualizar ${assignedCount} Cartas`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Variation Configuration Card */}
      <div className="bg-slate-900/90 border border-purple-500/30 p-4 sm:p-5 rounded-2xl shadow-lg flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-purple-400" />
            <h4 className="font-bold text-white text-sm sm:text-base">
              Configurações da Nova Variação
            </h4>
          </div>

          {/* Operation Mode Toggle */}
          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setOperationMode('add_variation')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                operationMode === 'add_variation'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield size={13} className="text-emerald-400" />
              <span>Adicionar Variação (Não substitui antiga)</span>
            </button>
            <button
              type="button"
              onClick={() => setOperationMode('replace_original')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                operationMode === 'replace_original'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <RefreshCw size={12} />
              <span>Substituir Original</span>
            </button>
          </div>
        </div>

        {operationMode === 'add_variation' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Preset Selector */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block flex items-center gap-1">
                <Palette size={13} className="text-purple-400" />
                Tipo de Variação
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePresetChange('novo_frame')}
                  className={`p-2 rounded-lg border text-left font-bold transition ${
                    variationPreset === 'novo_frame'
                      ? 'bg-purple-950 border-purple-500 text-purple-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-[11px]">🖼️ Novo Frame</span>
                  <span className="text-[9px] text-slate-500 font-mono">Frame Moderno (-M)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetChange('arte_alternativa')}
                  className={`p-2 rounded-lg border text-left font-bold transition ${
                    variationPreset === 'arte_alternativa'
                      ? 'bg-purple-950 border-purple-500 text-purple-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-[11px]">🎨 Arte Alternativa</span>
                  <span className="text-[9px] text-slate-500 font-mono">Arte Alt (-ALT)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetChange('skin')}
                  className={`p-2 rounded-lg border text-left font-bold transition ${
                    variationPreset === 'skin'
                      ? 'bg-purple-950 border-purple-500 text-purple-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-[11px]">✨ Skin</span>
                  <span className="text-[9px] text-slate-500 font-mono">Skin visual (-SKIN)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetChange('custom')}
                  className={`p-2 rounded-lg border text-left font-bold transition ${
                    variationPreset === 'custom'
                      ? 'bg-purple-950 border-purple-500 text-purple-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="block text-[11px]">⚙️ Personalizado</span>
                  <span className="text-[9px] text-slate-500 font-mono">Outro formato</span>
                </button>
              </div>
            </div>

            {/* Frame & Code Suffix */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block flex items-center gap-1">
                <Tag size={13} className="text-purple-400" />
                Sufixo do Código da Variação
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={codeSuffix}
                  onChange={(e) => setCodeSuffix(e.target.value)}
                  placeholder="-M"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-purple-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-1 pt-1 flex-wrap">
                <span className="text-[10px] text-slate-500">Sugestões:</span>
                {['-M', '-MOD', '-ALT', '-SKIN', '-V2'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setCodeSuffix(s)}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Frame Selector */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block flex items-center gap-1">
                <Layers size={13} className="text-purple-400" />
                Frame da Variação
              </label>
              <select
                value={variationFrame}
                onChange={(e) => setVariationFrame(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-bold text-xs focus:border-purple-500 outline-none"
              >
                <option value="Moderno">Moderno (Novo Estilo)</option>
                <option value="Legado">Legado (Estilo Clássico)</option>
              </select>
              <p className="text-[10px] text-slate-500">
                Permite filtrar por Frame no Catálogo e Deck Builder.
              </p>
            </div>

            {/* Collection Target */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block flex items-center gap-1">
                <Filter size={13} className="text-purple-400" />
                Coleção de Destino
              </label>
              <div className="flex gap-2">
                <select
                  value={targetCollectionMode}
                  onChange={(e) => setTargetCollectionMode(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:border-purple-500 outline-none"
                >
                  <option value="same">Mesma Coleção da Carta Base</option>
                  <option value="custom">Outra Coleção Específica...</option>
                </select>
              </div>
              {targetCollectionMode === 'custom' && (
                <input
                  type="text"
                  placeholder="Nome da coleção (ex: Legado Moderno)"
                  value={customCollectionName}
                  onChange={(e) => setCustomCollectionName(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-purple-500/50 rounded-lg px-2.5 py-1.5 text-white text-xs focus:border-purple-500 outline-none"
                />
              )}
            </div>
          </div>
        ) : (
          <div className="bg-amber-950/30 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-200">
            ⚠️ <strong>Modo de Substituição:</strong> A imagem existente da carta selecionada será substituída pela nova imagem. Use este modo apenas se quiser corrigir a arte original da carta.
          </div>
        )}

        {/* Live Code Preview Banner */}
        {operationMode === 'add_variation' && (
          <div className="bg-slate-950/80 border border-slate-800 px-3.5 py-2 rounded-xl text-xs flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Exemplo de código gerado:</span>
              <span className="font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                2025/0001/00001
              </span>
              <ChevronRight size={14} className="text-purple-400" />
              <span className="font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                {getGeneratedCode('2025/0001/00001')}
              </span>
            </div>
            <div className="text-[11px] text-emerald-400/90 font-medium flex items-center gap-1">
              <Shield size={12} /> Carta original mantida intacta
            </div>
          </div>
        )}
      </div>

      {/* Progress & Alert Messages */}
      {isSaving && saveProgress && (
        <div className="bg-slate-900/95 border border-purple-500/50 p-4 rounded-xl shadow-lg animate-pulse">
          <div className="flex justify-between text-xs font-mono mb-1.5 text-purple-300">
            <span>Enviando para o Firebase Storage: <strong>{saveProgress.cardName}</strong></span>
            <span>{Math.round((saveProgress.current / saveProgress.total) * 100)}% ({saveProgress.current}/{saveProgress.total})</span>
          </div>
          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <div 
              className="bg-gradient-to-r from-purple-500 to-emerald-400 h-full transition-all duration-300"
              style={{ width: `${(saveProgress.current / saveProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {saveSuccessMsg && (
        <div className="bg-emerald-950/70 border border-emerald-500/60 p-4 rounded-xl text-emerald-200 text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-400 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-950/70 border border-red-500/60 p-4 rounded-xl text-red-200 text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} className="text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================= LEFT COLUMN: IMAGES STAGING TRAY (5 Cols) ================= */}
        <div className="lg:col-span-5 flex flex-col gap-4 bg-slate-950/70 border border-slate-800 p-4 sm:p-5 rounded-2xl">
          
          {/* Header of Tray */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon size={18} className="text-purple-400" />
              <h4 className="font-bold text-white text-base">
                Bandeja de Imagens ({stagedImages.length})
              </h4>
            </div>

            {stagedImages.length > 0 && (
              <button
                onClick={handleClearAllImages}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 hover:underline"
              >
                <Trash2 size={13} /> Limpar tudo
              </button>
            )}
          </div>

          {/* Upload Drop Area */}
          <div
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDrop={handleDropFiles}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-purple-500/40 hover:border-purple-400 bg-purple-950/20 hover:bg-purple-950/30 p-6 rounded-2xl text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleAddFiles(e.target.files);
              }}
            />
            <div className="w-12 h-12 rounded-full bg-purple-900/40 flex items-center justify-center text-purple-400 group-hover:scale-110 group-hover:bg-purple-800/50 transition">
              <Upload size={22} />
            </div>
            <p className="text-sm font-bold text-white">
              Arraste imagens aqui ou clique para selecionar
            </p>
            <p className="text-xs text-slate-400">
              Suporta múltiplos arquivos PNG, JPG, WEBP (todas as versões novas)
            </p>
          </div>

          {/* Search Tray Images */}
          {stagedImages.length > 0 && (
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={imageSearchTerm}
                onChange={(e) => setImageSearchTerm(e.target.value)}
                placeholder="Filtrar imagens da bandeja por nome..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 outline-none"
              />
            </div>
          )}

          {/* Images Grid Tray */}
          <div className="max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
            {filteredStagedImages.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                {stagedImages.length === 0 
                  ? 'Nenhuma imagem carregada na bandeja ainda.' 
                  : 'Nenhuma imagem corresponde à busca.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {filteredStagedImages.map((img) => {
                  const isAssigned = Object.values(assignments).includes(img.id);
                  const isSelected = selectedImageId === img.id;

                  return (
                    <div
                      key={img.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggingImageId(img.id);
                        e.dataTransfer.setData('text/plain', img.id);
                      }}
                      onDragEnd={() => setDraggingImageId(null)}
                      onClick={() => {
                        setSelectedImageId(isSelected ? null : img.id);
                      }}
                      className={`group relative rounded-xl overflow-hidden border p-1.5 transition-all cursor-grab active:cursor-grabbing flex flex-col ${
                        isSelected 
                          ? 'ring-2 ring-purple-500 bg-purple-950/60 border-purple-400 shadow-lg scale-[1.02]' 
                          : isAssigned
                            ? 'border-emerald-500/50 bg-emerald-950/20'
                            : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="relative w-full aspect-[704/987] rounded-lg overflow-hidden bg-black/50 mb-1.5 border border-black/40">
                        <img
                          src={img.previewUrl}
                          alt={img.name}
                          className="w-full h-full object-cover select-none pointer-events-none"
                          loading="lazy"
                        />
                        
                        {/* Status Badges */}
                        {isAssigned && (
                          <div className="absolute top-1 right-1 bg-emerald-600 text-white rounded-full p-0.5 shadow-md" title="Vinculada a uma carta">
                            <Check size={12} />
                          </div>
                        )}
                        
                        {isSelected && (
                          <div className="absolute inset-0 bg-purple-600/20 border-2 border-purple-400 rounded-lg flex items-center justify-center pointer-events-none">
                            <span className="bg-purple-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                              Selecionada
                            </span>
                          </div>
                        )}

                        <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                          {img.sizeFormatted}
                        </div>
                      </div>

                      {/* File Name */}
                      <div className="px-1 text-[11px] text-slate-300 font-medium truncate" title={img.name}>
                        {img.name}
                      </div>

                      {/* Remove single image button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveStagedImage(img.id);
                        }}
                        className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 bg-black/80 hover:bg-red-600 text-white p-1 rounded-md transition shadow-md"
                        title="Remover da bandeja"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 flex items-start gap-2">
            <HelpCircle size={15} className="text-purple-400 shrink-0 mt-0.5" />
            <p>
              <strong>Como usar:</strong> Arraste a foto da bandeja e solte sobre a carta desejada à direita. Ou clique na foto para selecioná-la e depois clique na carta.
            </p>
          </div>

        </div>

        {/* ================= RIGHT COLUMN: CARDS DROP TARGETS (7 Cols) ================= */}
        <div className="lg:col-span-7 flex flex-col gap-4 bg-slate-950/70 border border-slate-800 p-4 sm:p-5 rounded-2xl">
          
          {/* Header & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div>
              <h4 className="font-bold text-white text-base">
                Cartas Base do Catálogo ({displayCards.length})
              </h4>
              <p className="text-xs text-slate-400">
                {operationMode === 'add_variation' 
                  ? 'Solte a imagem na carta para criar a nova variação' 
                  : 'Solte a imagem na carta para atualizar sua arte'}
              </p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {/* Collection Filter */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Coleção</label>
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-white outline-none focus:border-purple-500"
              >
                <option value="">Todas as Coleções</option>
                {collections.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Status</label>
              <select
                value={cardStatusFilter}
                onChange={(e) => setCardStatusFilter(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-white outline-none focus:border-purple-500"
              >
                <option value="all">Todas ({cards.length})</option>
                <option value="pending">Sem imagem vinculada</option>
                <option value="assigned">Vinculadas ({assignedCount})</option>
              </select>
            </div>

            {/* Search Input */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Busca</label>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={cardSearchTerm}
                  onChange={(e) => setCardSearchTerm(e.target.value)}
                  placeholder="Nome ou código..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-2.5 py-2 text-white placeholder-slate-500 outline-none focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Instruction banner if in click-select mode */}
          {selectedImageId && (
            <div className="bg-purple-950/80 border border-purple-500/50 p-2.5 rounded-lg text-xs text-purple-200 flex items-center justify-between animate-pulse">
              <span>👉 Modo clique ativo: Clique na carta abaixo onde deseja vincular a imagem selecionada.</span>
              <button onClick={() => setSelectedImageId(null)} className="text-purple-300 hover:text-white font-bold underline">
                Cancelar
              </button>
            </div>
          )}

          {/* Cards Grid / Drop Targets */}
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar pr-1 space-y-3">
            {displayCards.map((card) => {
              const assignedImageId = assignments[card.code];
              const assignedImage = assignedImageId 
                ? stagedImages.find(img => img.id === assignedImageId) 
                : null;
              const isHovered = hoveredCardCode === card.code;
              const generatedCode = getGeneratedCode(card.code);

              return (
                <div
                  key={card.code}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    setHoveredCardCode(card.code);
                  }}
                  onDragLeave={() => {
                    if (hoveredCardCode === card.code) setHoveredCardCode(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setHoveredCardCode(null);
                    const droppedImgId = e.dataTransfer.getData('text/plain') || draggingImageId;
                    if (droppedImgId) {
                      assignImageToCard(card.code, droppedImgId);
                    }
                  }}
                  onClick={() => {
                    if (selectedImageId) {
                      assignImageToCard(card.code, selectedImageId);
                    }
                  }}
                  className={`p-3.5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isHovered
                      ? 'bg-purple-900/40 border-purple-400 ring-2 ring-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-[1.01]'
                      : assignedImage
                        ? 'bg-emerald-950/20 border-emerald-500/50 shadow-inner'
                        : selectedImageId
                          ? 'bg-slate-900/90 border-slate-700 hover:border-purple-400 hover:bg-slate-800 cursor-pointer'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Left: Card Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Current Card Image Thumbnail */}
                    <div className="relative w-14 h-20 bg-black rounded-lg overflow-hidden shrink-0 border border-slate-800 shadow-md">
                      {card.imageUrl ? (
                        <img 
                          src={card.imageUrl} 
                          alt={card.name} 
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <ImageIcon size={18} />
                        </div>
                      )}
                      <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] text-center text-slate-400 uppercase font-mono py-0.5">
                        {card.frame || 'Legado'}
                      </span>
                    </div>

                    {/* Meta info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs font-bold text-purple-400 bg-purple-950/70 px-2 py-0.5 rounded border border-purple-800/40">
                          {card.code}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                          {card.frame || 'Legado'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          {card.collection}
                        </span>
                        {card.variants && card.variants.length > 0 && (
                          <span className="text-[9px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/40 px-1.5 py-0.5 rounded">
                            {card.variants.length} variação(ões)
                          </span>
                        )}
                      </div>

                      <h5 className="font-bold text-white text-sm sm:text-base leading-tight truncate">
                        {card.name}
                      </h5>

                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                        <span>{card.type}</span>
                        <span>•</span>
                        <span>CT: {card.ct}</span>
                        {(card.type === 'Herói' || card.type === 'Combatente') && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{card.attack}/{card.defense}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Drop Area / New Image Preview */}
                  <div className="w-full sm:w-auto flex items-center justify-end gap-3 shrink-0">
                    {assignedImage ? (
                      <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-emerald-500/50 shadow-md">
                        <ArrowRight size={16} className="text-emerald-400 shrink-0" />
                        
                        {/* New Staged Image Thumbnail */}
                        <div className="w-14 h-20 rounded-lg overflow-hidden bg-black border-2 border-emerald-400 shadow-emerald-950/50 relative shrink-0">
                          <img 
                            src={assignedImage.previewUrl} 
                            alt="Nova imagem" 
                            className="w-full h-full object-cover" 
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-emerald-600 text-white text-[8px] font-bold text-center uppercase tracking-wider py-0.5">
                            {operationMode === 'add_variation' ? variationFrame : 'Nova'}
                          </span>
                        </div>

                        <div className="max-w-[170px] text-left">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                            {operationMode === 'add_variation' ? '✨ Nova Variação' : '🔄 Substituir Imagem'}
                          </span>
                          {operationMode === 'add_variation' && (
                            <span className="text-[11px] font-mono text-purple-300 font-bold block truncate">
                              {generatedCode}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-300 truncate block font-mono" title={assignedImage.name}>
                            {assignedImage.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => unassignCard(card.code)}
                            className="text-[11px] text-red-400 hover:text-red-300 hover:underline mt-1.5 flex items-center gap-1 cursor-pointer"
                          >
                            <X size={12} /> Desvincular
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full sm:w-48 py-3 px-3 rounded-xl border-2 border-dashed border-slate-700 hover:border-purple-500/70 bg-slate-950/60 text-center flex flex-col items-center justify-center transition">
                        <span className="text-xs text-slate-300 font-medium">
                          {isHovered ? 'Solte para vincular variação' : 'Solte a imagem aqui'}
                        </span>
                        <span className="text-[10px] text-purple-400/90 mt-0.5">
                          {operationMode === 'add_variation' 
                            ? `Gera variação (${codeSuffix})` 
                            : 'ou clique c/ imagem selecionada'}
                        </span>
                      </div>
                    )}
                  </div>

                </div>
              );
            })}

            {displayCards.length === 0 && (
              <div className="py-16 text-center text-slate-500 text-sm">
                Nenhuma carta encontrada com os filtros atuais.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
