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
  Loader2, 
  Sparkles, 
  Shield, 
  Palette, 
  SlidersHorizontal, 
  Plus,
  Wand2
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { CardData, CardVariationItem } from '../types';
import { compareCardCodes } from '../deckUtils';
import { useCards, cleanCardCode } from '../CardContext';

interface StagedImage {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  sizeFormatted: string;
}

export interface CardVariationAssignment {
  id: string;
  imageId: string;
  frame: 'Moderno' | 'Legado';
  variationType: string;
  code: string;
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
  const { cleanAllCardSuffixes } = useCards();

  // Uploaded images in tray
  const [stagedImages, setStagedImages] = useState<StagedImage[]>([]);
  
  // Mapping: cardCode -> Array of assigned variations (supports multiple per card!)
  const [assignments, setAssignments] = useState<{ [cardCode: string]: CardVariationAssignment[] }>({});
  
  // Selection / Dragging state
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [hoveredCardCode, setHoveredCardCode] = useState<string | null>(null);

  // --- Variation Settings ---
  const [operationMode, setOperationMode] = useState<'add_variation' | 'replace_original'>('add_variation');
  const [variationPreset, setVariationPreset] = useState<'arte_alternativa' | 'skin' | 'novo_frame' | 'custom'>('arte_alternativa');
  const [defaultFrame, setDefaultFrame] = useState<'Moderno' | 'Legado'>('Moderno');
  const [defaultVariationTitle, setDefaultVariationTitle] = useState<string>('Arte Alternativa');
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
  const [isCleaningSuffixes, setIsCleaningSuffixes] = useState(false);
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

  // Remove single staged image
  const handleRemoveStagedImage = (imageId: string) => {
    setAssignments(prev => {
      const next: { [cardCode: string]: CardVariationAssignment[] } = {};
      for (const [cCode, items] of Object.entries(prev)) {
        const filtered = items.filter(it => it.imageId !== imageId);
        if (filtered.length > 0) {
          next[cCode] = filtered;
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
  const handlePresetChange = (preset: 'arte_alternativa' | 'skin' | 'novo_frame' | 'custom') => {
    setVariationPreset(preset);
    if (preset === 'arte_alternativa') {
      setDefaultFrame('Moderno');
      setDefaultVariationTitle('Arte Alternativa');
    } else if (preset === 'skin') {
      setDefaultFrame('Moderno');
      setDefaultVariationTitle('Skin');
    } else if (preset === 'novo_frame') {
      setDefaultFrame('Moderno');
      setDefaultVariationTitle('Novo Frame (Moderno)');
    } else {
      setDefaultVariationTitle('Variação');
    }
  };

  // Assign image to card (supports MULTIPLE variations per card!)
  const assignImageToCard = (cardCode: string, imageId: string) => {
    const card = cards.find(c => c.code === cardCode);
    const cleanBaseCode = cleanCardCode(card ? card.code : cardCode);

    setAssignments(prev => {
      const existing = prev[cardCode] || [];

      if (operationMode === 'replace_original') {
        // Replace single original image mode
        return {
          ...prev,
          [cardCode]: [{
            id: `assign_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            imageId,
            frame: defaultFrame,
            variationType: 'Substituição',
            code: cleanBaseCode
          }]
        };
      }

      // Add variation mode: append another variation to this card!
      // NO FORCED CODE SUFFIX! The code is cleanly set to the card's printed code.
      const newAssignment: CardVariationAssignment = {
        id: `assign_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        imageId,
        frame: defaultFrame,
        variationType: defaultVariationTitle || 'Arte Alternativa',
        code: cleanBaseCode
      };

      return {
        ...prev,
        [cardCode]: [...existing, newAssignment]
      };
    });

    if (selectedImageId === imageId) {
      setSelectedImageId(null);
    }
  };

  // Remove a specific assigned variation from a card
  const removeVariationAssignment = (cardCode: string, assignmentId: string) => {
    setAssignments(prev => {
      const current = prev[cardCode] || [];
      const filtered = current.filter(a => a.id !== assignmentId);
      const next = { ...prev };
      if (filtered.length > 0) {
        next[cardCode] = filtered;
      } else {
        delete next[cardCode];
      }
      return next;
    });
  };

  // Update attributes of a specific assigned variation
  const updateVariationAssignment = (
    cardCode: string, 
    assignmentId: string, 
    fields: Partial<CardVariationAssignment>
  ) => {
    setAssignments(prev => {
      const current = prev[cardCode] || [];
      const updated = current.map(item => {
        if (item.id === assignmentId) {
          return { ...item, ...fields };
        }
        return item;
      });
      return {
        ...prev,
        [cardCode]: updated
      };
    });
  };

  // Remove all assigned variations for a card
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
        if (selectedCollection && card.collection !== selectedCollection) return false;
        
        if (cardSearchTerm.trim()) {
          const s = cardSearchTerm.toLowerCase();
          const matchName = (card.name || '').toLowerCase().includes(s);
          const matchCode = (card.code || '').toLowerCase().includes(s);
          if (!matchName && !matchCode) return false;
        }

        const isAssigned = (assignments[card.code]?.length || 0) > 0;
        if (cardStatusFilter === 'assigned' && !isAssigned) return false;
        if (cardStatusFilter === 'pending' && isAssigned) return false;

        return true;
      })
      .sort((a, b) => compareCardCodes(a.code, b.code));
  }, [cards, selectedCollection, cardSearchTerm, cardStatusFilter, assignments]);

  // Count total variations to save
  const totalVariationsCount = useMemo(() => {
    return Object.values(assignments).reduce((acc, list) => acc + list.length, 0);
  }, [assignments]);

  const assignedCardCount = Object.keys(assignments).length;

  // Clean all existing suffixes across custom cards in Firestore
  const handleCleanExistingSuffixes = async () => {
    if (!confirm('Deseja remover todos os sufixos "-ALT" e "-MOD" de todas as cartas e skins existentes no banco de dados? Os códigos originais reais serão preservados.')) {
      return;
    }
    setIsCleaningSuffixes(true);
    setErrorMessage(null);
    try {
      const { updatedCount } = await cleanAllCardSuffixes();
      setSaveSuccessMsg(`🧹 Limpeza concluída! ${updatedCount} carta(s) e skin(s) tiveram seus sufixos "-ALT" e "-MOD" removidos com sucesso.`);
    } catch (e: any) {
      setErrorMessage(`Erro ao limpar sufixos: ${e.message || 'Falha na operação'}`);
    } finally {
      setIsCleaningSuffixes(false);
    }
  };

  // Save all assignments to Firebase
  const handleSaveAll = async () => {
    if (totalVariationsCount === 0) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      const assignedCardCodes = Object.keys(assignments);
      let successVariationCount = 0;
      let stepIndex = 0;

      for (const cCode of assignedCardCodes) {
        const assignedItems = assignments[cCode] || [];
        const card = cards.find(c => c.code === cCode);
        if (!card || assignedItems.length === 0) continue;

        const currentVariants: CardVariationItem[] = card.variants ? [...card.variants] : [];

        for (const item of assignedItems) {
          stepIndex++;
          const staged = stagedImages.find(img => img.id === item.imageId);
          if (!staged) continue;

          setSaveProgress({
            current: stepIndex,
            total: totalVariationsCount,
            cardName: `${card.name} (${item.variationType})`
          });

          // Upload image to Firebase Storage
          const cleanExt = staged.file.name.split('.').pop() || 'png';
          const folder = operationMode === 'add_variation' ? 'cards_variations' : 'cards_updated';
          const cleanCodeForPath = cleanCardCode(card.code).replace(/\//g, '_');
          const storagePath = `${folder}/${Date.now()}_${cleanCodeForPath}_${stepIndex}.${cleanExt}`;
          const fileRef = ref(storage, storagePath);
          
          await uploadBytes(fileRef, staged.file);
          const newDownloadUrl = await getDownloadURL(fileRef);

          if (operationMode === 'add_variation') {
            const finalCleanCode = cleanCardCode(item.code || card.code);
            const targetCollection = (targetCollectionMode === 'custom' && customCollectionName.trim()) 
              ? customCollectionName.trim() 
              : card.collection;

            const variationDocId = `${cleanCodeForPath}_var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

            // 1. Save new variation card with clean code
            const newCard: CardData = {
              ...card,
              id: variationDocId,
              code: finalCleanCode,
              imageUrl: newDownloadUrl,
              frame: item.frame,
              collection: targetCollection,
              isVariation: true,
              parentCode: cleanCardCode(card.code),
              variationType: item.variationType
            };
            await saveCard(newCard);

            // 2. Add to parent's variants array
            currentVariants.push({
              id: variationDocId,
              name: item.variationType,
              imageUrl: newDownloadUrl,
              frame: item.frame,
              code: finalCleanCode,
              rarity: card.rarity
            });

            successVariationCount++;
          } else {
            // Replace original card image
            await saveCard({
              ...card,
              code: cleanCardCode(card.code),
              imageUrl: newDownloadUrl
            });
            successVariationCount++;
          }
        }

        // If in add_variation mode, save the updated parent card variants
        if (operationMode === 'add_variation') {
          await saveCard({
            ...card,
            code: cleanCardCode(card.code),
            variants: currentVariants
          });
        }
      }

      // Cleanup saved staged images from memory and tray
      const allSavedImageIds = Object.values(assignments).flatMap(list => list.map(it => it.imageId));
      setStagedImages(prev => {
        prev.forEach(img => {
          if (allSavedImageIds.includes(img.id)) {
            URL.revokeObjectURL(img.previewUrl);
          }
        });
        return prev.filter(img => !allSavedImageIds.includes(img.id));
      });

      // Clear assignments
      setAssignments({});
      setSelectedImageId(null);

      if (operationMode === 'add_variation') {
        setSaveSuccessMsg(`🎉 Sucesso! ${successVariationCount} variação(ões) adicionada(s) com sucesso em ${assignedCardCodes.length} carta(s) sem sufixos forçados!`);
      } else {
        setSaveSuccessMsg(`🎉 Sucesso! ${successVariationCount} carta(s) tiveram sua imagem original atualizada!`);
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
              Variações, Artes Alternativas & Skins (Multi-Variações)
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Arraste uma ou mais imagens para uma mesma carta para criar <strong>múltiplas variações de uma só vez</strong>. Sem sufixos obrigatórios: cada variação preserva o código impresso na skin.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleCleanExistingSuffixes}
            disabled={isCleaningSuffixes}
            className="px-3.5 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition shadow"
            title="Remove sufixos 'alt' e 'mod' de cartas já cadastradas"
          >
            {isCleaningSuffixes ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Wand2 size={14} />
            )}
            <span>Limpar 'alt'/'mod' do Banco</span>
          </button>

          <button
            onClick={handleSaveAll}
            disabled={isSaving || totalVariationsCount === 0}
            className={`px-5 py-3 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg transition-all ${
              totalVariationsCount > 0
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
                    ? `Salvar ${totalVariationsCount} Variações (${assignedCardCount} cartas)` 
                    : `Atualizar ${totalVariationsCount} Cartas`}
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
              Configurações Padrão para Novas Variações
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
              <span>Adicionar Variações (Não substitui antiga)</span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {/* Preset Selector */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block flex items-center gap-1">
                <Palette size={13} className="text-purple-400" />
                Tipo de Variação ao Arrastar
              </label>
              <div className="grid grid-cols-2 gap-1.5">
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
                  <span className="text-[9px] text-slate-500">Novo visual de arte</span>
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
                  <span className="text-[9px] text-slate-500">Skin de personagem</span>
                </button>
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
                  <span className="text-[9px] text-slate-500">Frame Moderno</span>
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
                  <span className="text-[9px] text-slate-500">Nome livre</span>
                </button>
              </div>
            </div>

            {/* Frame Selector */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-300 block flex items-center gap-1">
                <Layers size={13} className="text-purple-400" />
                Estilo do Frame Padrão
              </label>
              <select
                value={defaultFrame}
                onChange={(e) => setDefaultFrame(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-bold text-xs focus:border-purple-500 outline-none"
              >
                <option value="Moderno">Moderno (1ª Prioridade no Catálogo)</option>
                <option value="Legado">Legado (Estilo Clássico)</option>
              </select>
              <p className="text-[10px] text-slate-400">
                O Catálogo exibe automaticamente na ordem: <strong>Moderno &gt; AA / Skin &gt; Legado</strong>.
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-white text-xs focus:border-purple-500 outline-none"
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

        {/* Informational Code Note */}
        {operationMode === 'add_variation' && (
          <div className="bg-slate-950/80 border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">✓ Código Limpo & Autêntico:</span>
              <span className="text-slate-300">
                Os códigos das skins já estão nas cartas. Nenhum sufixo como "-ALT" ou "-MOD" é adicionado.
              </span>
            </div>
            <div className="text-[11px] text-purple-300 font-medium flex items-center gap-1">
              <Shield size={12} className="text-emerald-400" /> Carta original mantida 100% intacta
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
              Suporta múltiplos arquivos PNG, JPG, WEBP de skins e variações
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
                  ? 'Nenhuma imagem carregada. Faça upload das novas skins acima!'
                  : 'Nenhuma imagem corresponde à busca.'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredStagedImages.map((img) => {
                  const isSelected = selectedImageId === img.id;
                  
                  // Count how many times this image has been assigned
                  const usageCount = Object.values(assignments).reduce((acc, list) => {
                    return acc + list.filter(it => it.imageId === img.id).length;
                  }, 0);

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
                      className={`group relative rounded-xl overflow-hidden border bg-slate-900 transition-all cursor-grab active:cursor-grabbing ${
                        isSelected
                          ? 'border-purple-400 ring-2 ring-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] scale-[1.02]'
                          : usageCount > 0
                            ? 'border-emerald-500/60 bg-emerald-950/10'
                            : 'border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {/* Image Thumbnail */}
                      <div className="aspect-[3/4] w-full bg-black relative">
                        <img
                          src={img.previewUrl}
                          alt={img.name}
                          className="w-full h-full object-cover"
                        />

                        {/* Usage Badge */}
                        {usageCount > 0 && (
                          <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow flex items-center gap-1">
                            <Check size={10} /> Vinculada ({usageCount})
                          </span>
                        )}

                        {/* Remove Image button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveStagedImage(img.id);
                          }}
                          className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 hover:bg-red-600 text-slate-300 hover:text-white transition opacity-0 group-hover:opacity-100"
                          title="Remover imagem"
                        >
                          <X size={12} />
                        </button>
                      </div>

                      {/* Info footer */}
                      <div className="p-2 text-[10px] bg-slate-950/90 flex flex-col gap-0.5">
                        <span className="font-mono text-slate-200 truncate font-semibold" title={img.name}>
                          {img.name}
                        </span>
                        <span className="text-slate-500">{img.sizeFormatted}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ================= RIGHT COLUMN: CARDS LIST & MULTI-VARIATION DROP TARGETS (7 Cols) ================= */}
        <div className="lg:col-span-7 flex flex-col gap-4 bg-slate-950/70 border border-slate-800 p-4 sm:p-5 rounded-2xl">
          
          {/* Header of Right Column */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="font-bold text-white text-base">
                Cartas do Deck / Coleção
              </h4>
              <p className="text-xs text-slate-400">
                Arraste imagens da bandeja para vincular. Você pode soltar <strong>mais de uma variação na mesma carta</strong>!
              </p>
            </div>
            <div className="text-xs font-mono text-purple-300 bg-purple-950/50 px-2.5 py-1 rounded-lg border border-purple-800/40">
              {totalVariationsCount} variação(ões) em {assignedCardCount} carta(s)
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
                <option value="pending">Sem variação vinculada</option>
                <option value="assigned">Com variações vinculadas ({assignedCardCount})</option>
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
              <span>👉 Modo clique ativo: Clique na carta abaixo onde deseja adicionar esta imagem como variação.</span>
              <button onClick={() => setSelectedImageId(null)} className="text-purple-300 hover:text-white font-bold underline">
                Cancelar
              </button>
            </div>
          )}

          {/* Cards List / Multi-Variation Drop Targets */}
          <div className="max-h-[620px] overflow-y-auto custom-scrollbar pr-1 space-y-3">
            {displayCards.map((card) => {
              const assignedList = assignments[card.code] || [];
              const hasAssignments = assignedList.length > 0;
              const isHovered = hoveredCardCode === card.code;
              const cleanBaseCode = cleanCardCode(card.code);

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
                  className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col gap-3 ${
                    isHovered
                      ? 'bg-purple-900/40 border-purple-400 ring-2 ring-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)] scale-[1.01]'
                      : hasAssignments
                        ? 'bg-emerald-950/15 border-emerald-500/40 shadow-inner'
                        : selectedImageId
                          ? 'bg-slate-900/90 border-slate-700 hover:border-purple-400 hover:bg-slate-800 cursor-pointer'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top Line: Base Card Info */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Current Card Image Thumbnail */}
                      <div className="relative w-12 h-16 bg-black rounded-lg overflow-hidden shrink-0 border border-slate-800 shadow-md">
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
                            <ImageIcon size={16} />
                          </div>
                        )}
                        <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[7px] text-center text-slate-400 uppercase font-mono py-0.5">
                          {card.frame || 'Legado'}
                        </span>
                      </div>

                      {/* Meta info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-mono text-xs font-bold text-purple-400 bg-purple-950/70 px-2 py-0.5 rounded border border-purple-800/40">
                            {cleanBaseCode}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            {card.frame || 'Legado'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            {card.collection}
                          </span>
                          {card.variants && card.variants.length > 0 && (
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/40 px-1.5 py-0.5 rounded">
                              {card.variants.length} já cadastrada(s)
                            </span>
                          )}
                        </div>

                        <h5 className="font-bold text-white text-sm sm:text-base leading-tight truncate">
                          {card.name}
                        </h5>

                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
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

                    {/* Unassign All Button */}
                    {hasAssignments && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          unassignCard(card.code);
                        }}
                        className="text-xs text-red-400 hover:text-red-300 hover:underline flex items-center gap-1 shrink-0"
                      >
                        <Trash2 size={12} /> Limpar ({assignedList.length})
                      </button>
                    )}
                  </div>

                  {/* Variations Section: List of assigned variations for this card */}
                  {hasAssignments ? (
                    <div className="bg-slate-950/90 rounded-xl p-3 border border-emerald-500/30 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-1.5">
                        <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                          <Sparkles size={13} />
                          {assignedList.length} variação(ões) pronta(s) para vincular a esta carta:
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Arraste mais imagens para adicionar outra
                        </span>
                      </div>

                      <div className="space-y-2">
                        {assignedList.map((item, idx) => {
                          const staged = stagedImages.find(img => img.id === item.imageId);
                          return (
                            <div 
                              key={item.id} 
                              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-3">
                                {/* Thumbnail */}
                                <div className="w-10 h-14 rounded bg-black border border-emerald-400/60 overflow-hidden shrink-0">
                                  {staged && (
                                    <img 
                                      src={staged.previewUrl} 
                                      alt="Variação" 
                                      className="w-full h-full object-cover" 
                                    />
                                  )}
                                </div>

                                {/* Controls */}
                                <div className="flex flex-col gap-1 text-xs">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-slate-200">
                                      {item.variationType}
                                    </span>
                                    {staged && (
                                      <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">
                                        {staged.name}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 flex-wrap">
                                    {/* Frame selector */}
                                    <select
                                      value={item.frame}
                                      onChange={(e) => updateVariationAssignment(card.code, item.id, { frame: e.target.value as any })}
                                      className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-purple-300 font-bold outline-none"
                                    >
                                      <option value="Moderno">Frame Moderno</option>
                                      <option value="Legado">Frame Legado</option>
                                    </select>

                                    {/* Type selector */}
                                    <select
                                      value={item.variationType}
                                      onChange={(e) => updateVariationAssignment(card.code, item.id, { variationType: e.target.value })}
                                      className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-300 outline-none"
                                    >
                                      <option value="Arte Alternativa">Arte Alternativa</option>
                                      <option value="Skin">Skin</option>
                                      <option value="Novo Frame (Moderno)">Novo Frame (Moderno)</option>
                                      <option value="Variação">Variação Geral</option>
                                    </select>

                                    {/* Code Input (clean, no forced suffix!) */}
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-slate-500">Cód:</span>
                                      <input
                                        type="text"
                                        value={item.code}
                                        onChange={(e) => updateVariationAssignment(card.code, item.id, { code: cleanCardCode(e.target.value) })}
                                        placeholder={cleanBaseCode}
                                        className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-emerald-400 font-mono w-28 outline-none focus:border-emerald-500"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Remove individual variation button */}
                              <button
                                type="button"
                                onClick={() => removeVariationAssignment(card.code, item.id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition shrink-0"
                                title="Remover esta variação"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Drop target to add ANOTHER variation to this same card */}
                      <div 
                        className="py-2 px-3 rounded-lg border-2 border-dashed border-purple-500/30 hover:border-purple-400/70 bg-purple-950/10 text-center flex items-center justify-center gap-1.5 transition text-xs text-purple-300 cursor-pointer"
                        onClick={() => {
                          if (selectedImageId) {
                            assignImageToCard(card.code, selectedImageId);
                          }
                        }}
                      >
                        <Plus size={14} />
                        <span>Solte mais uma imagem aqui para adicionar outra variação desta carta</span>
                      </div>
                    </div>
                  ) : (
                    /* Empty Drop Zone */
                    <div className="w-full py-3 px-3 rounded-xl border-2 border-dashed border-slate-700 hover:border-purple-500/70 bg-slate-950/60 text-center flex flex-col items-center justify-center transition">
                      <span className="text-xs text-slate-300 font-medium">
                        {isHovered ? 'Solte para vincular como variação' : 'Solte a imagem aqui para criar variação'}
                      </span>
                      <span className="text-[10px] text-purple-400/90 mt-0.5">
                        {operationMode === 'add_variation' 
                          ? `Código limpo: ${cleanBaseCode} (sem sufixo forçado)` 
                          : 'Substitui a imagem original desta carta'}
                      </span>
                    </div>
                  )}

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
