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
  Loader2
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
    // Remove any assignment pointing to this image
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

  // Assign image to a card
  const assignImageToCard = (cardCode: string, imageId: string) => {
    setAssignments(prev => ({
      ...prev,
      [cardCode]: imageId
    }));
    // If it was selected via click-mode, deselect it after assigning
    if (selectedImageId === imageId) {
      setSelectedImageId(null);
    }
    setSaveSuccessMsg(null);
  };

  // Remove assignment from card
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

  // Which cards to display
  const displayCards = useMemo(() => {
    let list = [...cards];

    if (selectedCollection) {
      list = list.filter(c => c.collection === selectedCollection);
    }

    if (cardSearchTerm.trim()) {
      const q = cardSearchTerm.toLowerCase();
      list = list.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.code.toLowerCase().includes(q)
      );
    }

    if (cardStatusFilter === 'pending') {
      list = list.filter(c => !assignments[c.code]);
    } else if (cardStatusFilter === 'assigned') {
      list = list.filter(c => !!assignments[c.code]);
    }

    return list.sort((a, b) => compareCardCodes(a.code, b.code));
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
        const storagePath = `cards_updated/${Date.now()}_${card.code.replace(/\//g, '_')}.${cleanExt}`;
        const fileRef = ref(storage, storagePath);
        
        await uploadBytes(fileRef, staged.file);
        const newDownloadUrl = await getDownloadURL(fileRef);

        // Update card in Firestore
        await saveCard({
          ...card,
          imageUrl: newDownloadUrl
        });

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
      setSaveSuccessMsg(`🎉 Sucesso! ${successCount} carta(s) foram atualizadas com suas novas imagens no banco de dados!`);
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
      <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/40 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-purple-600/30 text-purple-300 border border-purple-500/40">
              <Upload size={18} />
            </span>
            <h3 className="text-xl font-black text-white tracking-wide">
              Vincular Novas Imagens de Cartas em Lote
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Suba todas as imagens da sua pasta de uma só vez (ex: coleção <strong>Legado</strong> ou atualizações). Depois, <strong>arraste cada imagem para a respectiva carta</strong> que ela representa para atualizar.
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
                <span>Salvar {assignedCount} Imagens Vinculadas</span>
              </>
            )}
          </button>
        </div>
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
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 hover:underline cursor-pointer"
                title="Limpar imagens carregadas"
              >
                <Trash2 size={13} />
                <span>Limpar Todas</span>
              </button>
            )}
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropFiles}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-purple-500/40 hover:border-purple-400 hover:bg-purple-950/20 bg-slate-900/60 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
          >
            <input 
              ref={fileInputRef}
              type="file" 
              multiple 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => e.target.files && handleAddFiles(e.target.files)}
            />
            <div className="w-12 h-12 rounded-xl bg-purple-950/70 border border-purple-700/40 text-purple-300 flex items-center justify-center group-hover:scale-110 transition shadow-md">
              <Upload size={24} className="text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                Clique para selecionar várias imagens
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                ou arraste e solte arquivos aqui (PNG, JPG, WEBP)
              </p>
            </div>
          </div>

          {/* Tray Controls & Search */}
          {stagedImages.length > 0 && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Filtrar imagem por nome de arquivo..."
                  value={imageSearchTerm}
                  onChange={(e) => setImageSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
                />
                {imageSearchTerm && (
                  <button 
                    onClick={() => setImageSearchTerm('')} 
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>
                  {filteredStagedImages.length} de {stagedImages.length} exibidas
                </span>
                <span className="text-purple-400 font-medium">
                  {assignedCount} vinculadas
                </span>
              </div>
            </div>
          )}

          {/* Staged Images List (Draggable Grid) */}
          <div className="max-h-[550px] overflow-y-auto custom-scrollbar pr-1 space-y-2.5">
            {filteredStagedImages.map((img) => {
              // Check which card is assigned to this image
              const assignedCardCode = Object.keys(assignments).find(k => assignments[k] === img.id);
              const assignedCard = assignedCardCode ? cards.find(c => c.code === assignedCardCode) : null;
              const isSelected = selectedImageId === img.id;

              return (
                <div
                  key={img.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', img.id);
                    e.dataTransfer.effectAllowed = 'copyMove';
                    setDraggingImageId(img.id);
                  }}
                  onDragEnd={() => setDraggingImageId(null)}
                  onClick={() => {
                    // Toggle selection for click-to-assign mode
                    setSelectedImageId(isSelected ? null : img.id);
                  }}
                  className={`p-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing flex items-center gap-3 relative select-none ${
                    assignedCard
                      ? 'bg-purple-950/30 border-purple-500/40 opacity-90'
                      : isSelected
                        ? 'bg-purple-900/50 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-2 ring-purple-500'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <GripVertical size={16} className="text-slate-600 shrink-0 cursor-grab" />

                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-lg bg-black overflow-hidden shrink-0 border border-slate-800 relative group/thumb">
                    <img 
                      src={img.previewUrl} 
                      alt={img.name} 
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate" title={img.name}>
                      {img.name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {img.sizeFormatted}
                    </p>

                    {/* Assignment Status */}
                    {assignedCard ? (
                      <div className="inline-flex items-center gap-1.5 mt-1 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded text-[10px] text-emerald-300 font-bold max-w-full truncate">
                        <Check size={11} className="shrink-0" />
                        <span className="truncate">Vinculada a: {assignedCard.name} ({assignedCard.code})</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-purple-400/80 italic block mt-0.5">
                        {isSelected ? '👉 Selecionada! Clique em uma carta ao lado' : 'Arraste para uma carta'}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {assignedCardCode && (
                      <button
                        onClick={() => unassignCard(assignedCardCode)}
                        className="p-1.5 text-amber-400 hover:text-amber-200 hover:bg-slate-800 rounded text-xs transition"
                        title="Desvincular desta carta"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveStagedImage(img.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition"
                      title="Excluir imagem da bandeja"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {stagedImages.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-xs italic">
                Nenhuma imagem carregada ainda. Use a área de upload acima para adicionar suas fotos.
              </div>
            )}
          </div>
        </div>

        {/* ================= RIGHT COLUMN: CARDS DROP TARGETS (7 Cols) ================= */}
        <div className="lg:col-span-7 flex flex-col gap-4 bg-slate-950/70 border border-slate-800 p-4 sm:p-5 rounded-2xl">
          
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-white text-base flex items-center gap-2">
                <Layers size={18} className="text-purple-400" />
                <span>Cartas da Coleção</span>
              </h4>
              <p className="text-xs text-slate-400">
                Solte a imagem na carta correspondente para atualizar
              </p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            {/* Collection Filter */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Coleção</label>
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-purple-500"
              >
                <option value="">Todas as Coleções</option>
                {collections.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            {/* Search Filter */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Buscar Carta</label>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Nome ou código..."
                  value={cardSearchTerm}
                  onChange={(e) => setCardSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-2 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Status</label>
              <select
                value={cardStatusFilter}
                onChange={(e) => setCardStatusFilter(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-purple-500"
              >
                <option value="all">Todas as Cartas ({cards.length})</option>
                <option value="pending">Apenas Sem Nova Imagem</option>
                <option value="assigned">Apenas Vinculadas ({assignedCount})</option>
              </select>
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
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <ImageIcon size={18} />
                        </div>
                      )}
                      <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] text-center text-slate-400 uppercase font-mono py-0.5">
                        Atual
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
                      <div className="flex items-center gap-3 bg-slate-950 p-2 rounded-xl border border-emerald-500/50 shadow-md">
                        <ArrowRight size={16} className="text-emerald-400 shrink-0" />
                        
                        {/* New Staged Image Thumbnail */}
                        <div className="w-14 h-20 rounded-lg overflow-hidden bg-black border-2 border-emerald-400 shadow-emerald-950/50 relative shrink-0">
                          <img 
                            src={assignedImage.previewUrl} 
                            alt="Nova imagem" 
                            className="w-full h-full object-cover" 
                          />
                          <span className="absolute bottom-0 inset-x-0 bg-emerald-600 text-white text-[8px] font-bold text-center uppercase tracking-wider py-0.5">
                            Nova
                          </span>
                        </div>

                        <div className="max-w-[140px] truncate text-left">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                            Pronta p/ salvar
                          </span>
                          <span className="text-xs text-slate-200 truncate block font-mono" title={assignedImage.name}>
                            {assignedImage.name}
                          </span>
                          <button
                            onClick={() => unassignCard(card.code)}
                            className="text-[11px] text-red-400 hover:text-red-300 hover:underline mt-1 flex items-center gap-1 cursor-pointer"
                          >
                            <X size={12} /> Remover
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full sm:w-44 py-3 px-3 rounded-xl border-2 border-dashed border-slate-700 hover:border-purple-500/70 bg-slate-950/60 text-center flex flex-col items-center justify-center transition">
                        <span className="text-xs text-slate-400 font-medium">
                          {isHovered ? 'Solte para vincular' : 'Solte a imagem aqui'}
                        </span>
                        <span className="text-[10px] text-purple-400/80 mt-0.5">
                          ou clique com uma selecionada
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
