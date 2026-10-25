import React, { useMemo, useState, useEffect } from 'react';
import { 
  X, 
  Zap, 
  BookOpen, 
  Box, 
  Hash, 
  Link as LinkIcon, 
  Edit2, 
  Check, 
  Trash, 
  Image as ImageIcon, 
  Sparkles, 
  Layers, 
  Plus, 
  Minus, 
  BookmarkCheck, 
  LogIn,
  Crown,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { CardData, CardVariationItem, LEGADO_RARITIES, MODERNO_RARITIES } from '../types';
import { Card } from './Card';
import { useCards, cleanCardCode, getBaseCardCode, getCardDisplayPriority, defaultCardsByBaseCode, defaultCardsGroupByBaseCode, getVersionRareKey, isLegacyCard } from '../CardContext';
import { compareCardCodes } from '../deckUtils';
import { auth, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth, isUserAdmin } from '../authService';
import { useUserAlbum } from '../albumService';
import { isCardRarePrint } from '../rarePrintService';
import { VerificationRequestModal } from './VerificationRequestModal';

interface CardDetailModalProps {
  card: CardData | null;
  onClose: () => void;
  onSelectRelated?: (card: CardData) => void;
  onOpenAuth?: () => void;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({ card: initialCard, onClose, onSelectRelated, onOpenAuth }) => {
  const { cards: allCards, archetypes, collections, saveCard, deleteCard, setCardCatalogCover, setCardRarePrintSettings } = useCards();
  const { user } = useAuth();
  const { getQuantity, incrementCard, decrementCard } = useUserAlbum(user?.uid);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [card, setCard] = useState<CardData | null>(initialCard);
  const [originalCode, setOriginalCode] = useState(initialCard?.code);
  const [selectedVarKey, setSelectedVarKey] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Modal de Verificação para jogadores comuns tentando adicionar Tiragem Rara
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  
  // Feedback ao definir capa ou alterar tiragem
  const [adminActionFeedback, setAdminActionFeedback] = useState<string | null>(null);
  const [isSavingRareSettings, setIsSavingRareSettings] = useState(false);

  const baseCardCode = initialCard ? getBaseCardCode(initialCard.code, initialCard.parentCode) : '';
  const canonicalBase = useMemo(
    () => allCards.find(c => getBaseCardCode(c.code, c.parentCode) === baseCardCode) || initialCard,
    [allCards, baseCardCode, initialCard]
  );
  const currentCoverUrl = canonicalBase?.catalogCoverImageUrl;

  // Find all variations (alternate arts, skins, frames) for this card in O(1) without scanning allCards+defaultCards repeatedly
  // Preserves individual rare print settings per version/image so marking 1 version never marks all versions!
  const cardVariations = useMemo(() => {
    if (!initialCard) return [];
    const baseCode = getBaseCardCode(initialCard.code, initialCard.parentCode);
    const canonicalCard = canonicalBase || initialCard;
    const coverUrl = canonicalCard.catalogCoverImageUrl;
    const rareMap = canonicalCard.rarePrintByImage;
    const hasExplicitRareMap = Boolean(rareMap && typeof rareMap === 'object' && Object.keys(rareMap).length > 0);

    const resolveVarRare = (
      imgUrl?: string,
      frame?: string,
      explicitRare?: boolean,
      explicitReqVer?: boolean,
      explicitMax?: number,
      rarity?: string
    ) => {
      if (rarity === 'Moderno Macroversal' || rarity === 'Macroversal') {
        return { isRarePrint: true, requiresAdminVerification: true, maxPrintCopies: 1 };
      }
      const vKey = getVersionRareKey(imgUrl, frame);
      if (rareMap && rareMap[vKey] !== undefined) {
        const entry = rareMap[vKey];
        return {
          isRarePrint: Boolean(entry.isRarePrint),
          requiresAdminVerification: Boolean(entry.isRarePrint),
          maxPrintCopies: entry.isRarePrint ? (entry.maxPrintCopies || 1) : 0
        };
      }
      if (rareMap && imgUrl && rareMap[imgUrl] !== undefined) {
        const entry = rareMap[imgUrl];
        return {
          isRarePrint: Boolean(entry.isRarePrint),
          requiresAdminVerification: Boolean(entry.isRarePrint),
          maxPrintCopies: entry.isRarePrint ? (entry.maxPrintCopies || 1) : 0
        };
      }
      if (hasExplicitRareMap) {
        return { isRarePrint: false, requiresAdminVerification: false, maxPrintCopies: 0 };
      }
      const isRare = Boolean(explicitRare || explicitReqVer);
      return {
        isRarePrint: isRare,
        requiresAdminVerification: isRare,
        maxPrintCopies: isRare ? (explicitMax || 1) : 0
      };
    };

    const defaultCardMatches = defaultCardsGroupByBaseCode.get(baseCode) || [];

    const list: CardData[] = [];
    const seenImages = new Set<string>();

    const addVersion = (c?: CardData | null, defaultFrame?: string, defaultVarType?: string) => {
      if (!c || !c.imageUrl) return;
      const frame = c.frame || defaultFrame || 'Legado';
      const isMod = frame === 'Moderno' || (c.code && c.code.endsWith('-M'));
      const effectiveFrame = isMod ? 'Moderno' : 'Legado';
      const variationType = c.variationType || defaultVarType || (effectiveFrame === 'Moderno' ? 'Novo Frame' : 'Legado');
      
      const imgKey = `${effectiveFrame}_${c.imageUrl}`;
      if (seenImages.has(imgKey)) return;
      seenImages.add(imgKey);

      let cRarity = c.rarity;
      if (effectiveFrame === 'Moderno' && (!cRarity || cRarity === 'Beta')) {
        cRarity = 'Comum';
      }

      const isVarCover = Boolean(coverUrl && c.imageUrl === coverUrl);
      const rareStatus = resolveVarRare(
        c.imageUrl,
        effectiveFrame,
        c.isRarePrint,
        c.requiresAdminVerification,
        c.maxPrintCopies,
        cRarity
      );

      list.push({
        ...c,
        name: canonicalCard.name || c.name,
        archetype: canonicalCard.archetype !== undefined ? canonicalCard.archetype : c.archetype,
        type: canonicalCard.type || c.type,
        collection: canonicalCard.collection || c.collection,
        description: canonicalCard.description !== undefined ? canonicalCard.description : c.description,
        ct: canonicalCard.ct !== undefined ? canonicalCard.ct : c.ct,
        attack: canonicalCard.attack !== undefined ? canonicalCard.attack : c.attack,
        defense: canonicalCard.defense !== undefined ? canonicalCard.defense : c.defense,
        lore: canonicalCard.lore !== undefined ? canonicalCard.lore : c.lore,
        isHidden: canonicalCard.isHidden !== undefined ? canonicalCard.isHidden : c.isHidden,

        code: cleanCardCode(c.code) || cleanCardCode(baseCode),
        parentCode: baseCode,
        imageUrl: c.imageUrl,
        frame: effectiveFrame,
        variationType,
        rarity: cRarity || 'Comum',
        isRarePrint: rareStatus.isRarePrint,
        requiresAdminVerification: rareStatus.requiresAdminVerification,
        maxPrintCopies: rareStatus.maxPrintCopies,
        catalogCoverImageUrl: coverUrl,
        isCatalogCover: isVarCover
      });
    };

    // 1. Canonical card itself
    addVersion(canonicalCard, canonicalCard.frame, canonicalCard.variationType);

    // 2. Initial card if different
    addVersion(initialCard, initialCard.frame, initialCard.variationType);

    // 3. All default cards for this baseCode (including skins and Moderno defaults)
    defaultCardMatches.forEach((d, idx) => {
      const dFrame = d.frame || (isLegacyCard(d) ? 'Legado' : 'Moderno');
      const isSkin = cleanCardCode(d.code) !== cleanCardCode(baseCode) || d.rarity === 'Evento';
      const dVarType = d.variationType || (isSkin ? 'Evento / Skin' : (idx > 0 && dFrame === 'Legado' ? 'Arte Alternativa' : dFrame));
      addVersion(d, dFrame, dVarType);
    });

    // 4. Candidate variants from canonicalCard.variants and initialCard.variants
    const allCandidateVariants: CardVariationItem[] = [];
    if (canonicalCard.variants) allCandidateVariants.push(...canonicalCard.variants);
    if (initialCard.variants) allCandidateVariants.push(...initialCard.variants);
    defaultCardMatches.forEach(d => {
      if (d.variants) allCandidateVariants.push(...d.variants);
    });

    allCandidateVariants.forEach(v => {
      if (v && v.imageUrl) {
        const vFrame = v.frame || 'Moderno';
        const vVarType = v.name || (vFrame === 'Moderno' ? 'Novo Frame' : 'Legado');
        const imgKey = `${vFrame}_${v.imageUrl}`;
        if (seenImages.has(imgKey)) return;
        seenImages.add(imgKey);

        let vRarity = v.rarity;
        if (vFrame === 'Moderno' && (!vRarity || vRarity === 'Beta')) {
          vRarity = 'Comum';
        }

        const isVarCover = Boolean(coverUrl && v.imageUrl === coverUrl);
        const rareStatus = resolveVarRare(
          v.imageUrl,
          vFrame,
          v.isRarePrint,
          v.requiresAdminVerification,
          v.maxPrintCopies,
          vRarity
        );

        list.push({
          ...canonicalCard,
          id: v.id || `var_${v.code || baseCode}_${list.length}`,
          code: cleanCardCode(v.code) || cleanCardCode(baseCode),
          parentCode: baseCode,
          imageUrl: v.imageUrl,
          frame: vFrame,
          variationType: vVarType,
          isVariation: true,
          rarity: vRarity || 'Comum',
          isRarePrint: rareStatus.isRarePrint,
          requiresAdminVerification: rareStatus.requiresAdminVerification,
          maxPrintCopies: rareStatus.maxPrintCopies,
          catalogCoverImageUrl: coverUrl,
          isCatalogCover: isVarCover
        });
      }
    });

    return list.sort((a, b) => {
      const pDiff = getCardDisplayPriority(b) - getCardDisplayPriority(a);
      if (pDiff !== 0) return pDiff;
      const codeDiff = compareCardCodes(a.code, b.code);
      if (codeDiff !== 0) return codeDiff;
      return (a.imageUrl || '').localeCompare(b.imageUrl || '');
    });
  }, [initialCard, canonicalBase]);

  useEffect(() => {
    if (!initialCard) {
      setCard(null);
      setOriginalCode(undefined);
      setIsEditing(false);
      setSelectedVarKey(null);
      return;
    }
    if (isEditing) return;

    if (selectedVarKey) {
      const found = cardVariations.find(v => (v.imageUrl || v.id || v.code) === selectedVarKey);
      if (found) {
        setCard(found);
        setOriginalCode(found.code);
        return;
      }
    }

    const freshCanonical = canonicalBase || initialCard;
    const initialMatch = initialCard ? cardVariations.find(v => 
      (initialCard.imageUrl && v.imageUrl === initialCard.imageUrl) || 
      (initialCard.id && v.id === initialCard.id)
    ) : null;
    const activeVersion = initialMatch || cardVariations.find(v => v.isCatalogCover) || 
      (cardVariations.length > 0 ? cardVariations[0] : freshCanonical);

    setCard(activeVersion);
    setOriginalCode(activeVersion.code);
  }, [initialCard?.code, canonicalBase, isEditing, selectedVarKey, cardVariations]);

  // --- Logic to find related cards (memoized on stable text/type fields to avoid lag while editing or toggling) ---
  const cardCode = card?.code;
  const cardName = card?.name;
  const cardType = card?.type;
  const cardArchetype = card?.archetype;
  const cardDescription = card?.description;

  const relatedCards = useMemo(() => {
    if (!cardCode || isEditing) return [];

    const extractQuotedTerms = (text?: string): string[] => {
      if (!text) return [];
      const matches = text.match(/«(.*?)»/g);
      if (!matches) return [];
      return matches.map(m => m.replace(/[«»]/g, '').toLowerCase().trim());
    };

    const isEquipmentValid = (equipDesc: string, targetType?: string, targetName?: string): boolean => {
      const desc = (equipDesc || "").toLowerCase();
      if (desc.includes('só pode ser equipada em heróis') || desc.includes('only equip to heroes')) {
        if (targetType !== 'Herói') return false;
      }
      if (desc.includes('só pode equipar') || desc.includes('can only equip')) {
        const restrictions = extractQuotedTerms(desc);
        if (restrictions.length > 0) {
          const matchesRestriction = restrictions.some(term => (targetName || "").toLowerCase().includes(term));
          if (!matchesRestriction) return false;
        }
      }
      return true;
    };

    const cDesc = (cardDescription || "").toLowerCase();
    const cName = (cardName || "").toLowerCase().trim();
    const cQuoted = extractQuotedTerms(cDesc);
    const cardArchetypes = (cardArchetype || "").toLowerCase().split(' / ').map(a => a.trim()).filter(a => a.length > 2);

    const scoredCards = allCards
      .filter(c => c && c.code && c.code !== cardCode)
      .map(candidate => {
        let score = 0;
        const candDesc = (candidate.description || "").toLowerCase();
        const candName = (candidate.name || "").toLowerCase().trim();

        if (cardType === 'Equipamento') {
          if (!isEquipmentValid(cDesc, candidate.type, candName)) return { card: candidate, score: 0 };
        }
        if (candidate.type === 'Equipamento') {
          if (!isEquipmentValid(candDesc, cardType, cName)) return { card: candidate, score: 0 };
        }

        if (candName.length > 2 && cDesc.includes(candName)) score += 50;
        if (cName.length > 2 && candDesc.includes(cName)) score += 50;

        cQuoted.forEach(term => {
          if (term.length > 2 && candName.includes(term)) score += 30;
        });

        if (candDesc.includes('«')) {
          const candQuoted = extractQuotedTerms(candDesc);
          candQuoted.forEach(term => {
            if (term.length > 2 && cName.includes(term)) score += 30;
          });
        }

        const candArchetypes = (candidate.archetype || "").toLowerCase().split(' / ');
        candArchetypes.forEach(arch => {
          const aTrim = arch.trim();
          if (aTrim.length > 2 && cDesc.includes(aTrim)) score += 15;
        });

        cardArchetypes.forEach(aTrim => {
          if (candDesc.includes(aTrim)) score += 15;
        });

        return { card: candidate, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return scoredCards.map(item => item.card);
  }, [cardCode, cardName, cardType, cardArchetype, cardDescription, allCards, isEditing]);

  if (!card) return null;

  const handleRelatedClick = (related: CardData) => {
    if (onSelectRelated) {
      onSelectRelated(related);
    }
  };

  const handleCopyFromCard = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    if (!code || !card) return;
    const sourceCard = allCards.find(c => c.code === code);
    if (sourceCard) {
      setCard({
        ...card,
        name: sourceCard.name,
        description: sourceCard.description || '',
        type: sourceCard.type || 'Herói',
        archetype: sourceCard.archetype || 'Desconhecido',
        ct: sourceCard.ct || 0,
        attack: sourceCard.attack || 0,
        defense: sourceCard.defense || 0,
        lore: sourceCard.lore || '',
        collection: sourceCard.collection,
        code: sourceCard.code
      });
    }
    e.target.value = '';
  };

  const processImageUpload = async (currentCard: CardData): Promise<CardData> => {
    let updatedCard = { ...currentCard };
    if (fileToUpload) {
      setIsUploading(true);
      const fileRef = ref(storage, `wb_images/${Date.now()}_${fileToUpload.name}`);
      await uploadBytes(fileRef, fileToUpload);
      const url = await getDownloadURL(fileRef);
      updatedCard.imageUrl = url;
      setIsUploading(false);
      setFileToUpload(null);
    }
    return updatedCard;
  };

  const sanitizeCardStats = (c: CardData): CardData => {
    if (c.type === 'Efeito' || c.type === 'Equipamento') {
      const sanitized = { ...c };
      delete sanitized.attack;
      delete sanitized.defense;
      return sanitized;
    }
    return c;
  };

  const handleSave = async () => {
    if (card) {
      try {
        const finalCard = sanitizeCardStats(await processImageUpload(card));
        await saveCard(finalCard);
        if (finalCard.isRarePrint !== undefined) {
          await setCardRarePrintSettings(
            { ...finalCard, parentCode: baseCardCode || finalCard.parentCode },
            Boolean(finalCard.isRarePrint),
            finalCard.maxPrintCopies || 1
          );
        }
        if (finalCard.isCatalogCover) {
          await setCardCatalogCover({ ...finalCard, parentCode: baseCardCode || finalCard.parentCode }, finalCard, false);
        }
        setOriginalCode(finalCard.code);
        setCard(finalCard);
        setIsEditing(false);
        setAdminActionFeedback('Carta salva com sucesso!');
        setTimeout(() => setAdminActionFeedback(null), 3500);
      } catch (err: any) {
        console.error('Erro ao salvar carta:', err);
        alert('Erro ao salvar carta: ' + (err?.message || 'Erro desconhecido'));
      }
    }
  };

  const isCurrentCover = Boolean(
    card && currentCoverUrl && card.imageUrl === currentCoverUrl
  );

  const handleToggleCatalogCover = async (targetCard?: CardData | CardVariationItem) => {
    const cardToUse = targetCard || card;
    if (!cardToUse || !card) return;
    const isTargetCover = Boolean(
      currentCoverUrl && cardToUse.imageUrl === currentCoverUrl
    );
    try {
      await setCardCatalogCover(
        { ...(canonicalBase || card), code: baseCardCode || card.code, parentCode: baseCardCode },
        cardToUse,
        isTargetCover
      );
      if (cardToUse.imageUrl === card.imageUrl) {
        setCard(prev => prev ? ({
          ...prev,
          catalogCoverImageUrl: isTargetCover ? undefined : cardToUse.imageUrl,
          isCatalogCover: !isTargetCover
        }) : null);
      }
      setAdminActionFeedback(isTargetCover ? 'Capa automática restaurada!' : `Definida "${(cardToUse as any).variationType || (cardToUse as any).name || cardToUse.frame || 'Versão'}" como capa do catálogo!`);
      setTimeout(() => setAdminActionFeedback(null), 3500);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSaveRarePrintSettings = async (
    isRare: boolean,
    maxCopies: number = 1,
    targetVersion?: CardData | CardVariationItem
  ) => {
    const versionToUse = targetVersion || card;
    if (!versionToUse || !card) return;
    try {
      setIsSavingRareSettings(true);
      const targetPayload: CardData = {
        ...card,
        id: versionToUse.id,
        code: cleanCardCode(versionToUse.code || card.code),
        parentCode: baseCardCode || card.parentCode,
        imageUrl: versionToUse.imageUrl,
        frame: versionToUse.frame || card.frame
      };
      await setCardRarePrintSettings(targetPayload, isRare, maxCopies);
      if (versionToUse.imageUrl === card.imageUrl) {
        setCard(prev => prev ? ({
          ...prev,
          isRarePrint: isRare,
          requiresAdminVerification: isRare,
          maxPrintCopies: isRare ? maxCopies : 0
        }) : null);
      }
      const label = (versionToUse as any).variationType || (versionToUse as any).name || versionToUse.frame || 'Versão';
      setAdminActionFeedback(
        isRare
          ? (maxCopies === 1 ? `1/1 Tiragem Única ativada apenas em "${label}"!` : `Tiragem rara (${maxCopies}x) ativada em "${label}"!`)
          : `Tiragem padrão restaurada em "${label}"!`
      );
      setTimeout(() => setAdminActionFeedback(null), 3500);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSavingRareSettings(false);
    }
  };

  const handleAlbumAddClick = () => {
    if (!card) return;
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }
    // Se a carta é de tiragem rara e o usuário logado NÃO é o administrador, abre o modal de solicitação!
    if (isCardRarePrint(card) && !isUserAdmin(user)) {
      setIsVerificationModalOpen(true);
      return;
    }
    incrementCard(card);
  };

  const handleDeleteSpecific = async () => {
    if (card) {
      await deleteCard(card, {
        specificId: card.id,
        frame: card.frame,
        imageUrl: card.imageUrl,
        variationType: card.variationType,
        deleteAllVersions: false,
        isSingleVariantOnly: true
      });
      setConfirmDelete(false);
      onClose();
    }
  };

  const handleDeleteAll = async () => {
    if (card) {
      await deleteCard(card, {
        specificId: card.id,
        deleteAllVersions: true
      });
      setConfirmDelete(false);
      onClose();
    }
  };

  const handleSaveAndAddAnother = async () => {
    if (card) {
      const finalCard = sanitizeCardStats(await processImageUpload(card));
      await saveCard(finalCard);
      
      const nextCode = `CUSTOM/${Date.now()}`;
      setOriginalCode(nextCode);
      
      // Mantém no modo de edição e reseta parcialmente
      setCard({
        ...card,
        name: "Nova Carta",
        code: nextCode,
        description: "Edite a carta para alterar sua descrição.",
        lore: "Nova entidade surgida no Macroverso.",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in duration-200">
      
      {/* MODAL DE CONFIRMAÇÃO CLARA DE EXCLUSÃO */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-red-500/60 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 text-left">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-700/50 flex items-center justify-center">
                <Trash size={20} />
              </div>
              <div>
                <h4 className="text-base font-black text-white">Excluir Carta do Jogo</h4>
                <p className="text-xs text-slate-400">Escolha exatamente o que deseja apagar:</p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 my-1">
              <button
                type="button"
                onClick={handleDeleteSpecific}
                className="p-3 bg-red-950/60 hover:bg-red-900/80 border border-red-700/60 rounded-xl text-left transition flex flex-col gap-1 group"
              >
                <span className="text-xs font-bold text-red-200 group-hover:text-white flex items-center gap-1.5">
                  <Trash size={14} className="text-red-400" />
                  Apagar APENAS este Frame / Variação
                </span>
                <span className="text-[11px] text-slate-400">
                  Remove somente a arte ativa ({card?.variationType || card?.frame || 'Moderno'}). A carta base e as outras variações continuam ativas no jogo.
                </span>
              </button>

              {cardVariations.length > 1 && (
                <button
                  type="button"
                  onClick={handleDeleteAll}
                  className="p-3 bg-red-900/50 hover:bg-red-800/80 border border-red-500/80 rounded-xl text-left transition flex flex-col gap-1 group"
                >
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-400" />
                    Apagar TODAS as {cardVariations.length} Versões desta Carta
                  </span>
                  <span className="text-[11px] text-red-300/80">
                    Exclui permanentemente todos os frames, artes e o registro base desta carta de todo o catálogo.
                  </span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition text-center"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE SOLICITAÇÃO DE VERIFICAÇÃO DE TIRAGEM RARA */}
      <VerificationRequestModal
        isOpen={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        card={card}
        user={user}
        onOpenAuth={onOpenAuth}
      />

      <div className="absolute top-4 right-4 flex gap-2 z-50">
        {isEditing ? (
          <>
            <button 
              type="button"
              onClick={() => setConfirmDelete(true)} 
              className="p-2 rounded-full text-white transition flex items-center gap-2 px-4 shadow-lg bg-red-600 hover:bg-red-500 shadow-red-900/50"
            >
              <Trash size={20} /> Apagar
            </button>
            <button 
              onClick={handleSaveAndAddAnother} 
              disabled={isUploading}
              className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500 transition flex items-center gap-2 px-4 shadow-lg shadow-blue-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={20} /> {isUploading ? 'Salvando...' : 'Salvar & Lote'}
            </button>
            <button 
              onClick={handleSave} 
              disabled={isUploading}
              className="p-2 bg-green-600 rounded-full text-white hover:bg-green-500 transition flex items-center gap-2 px-4 shadow-lg shadow-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={20} /> {isUploading ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        ) : isUserAdmin(user) ? (
          <>
            <button 
              type="button"
              onClick={() => setConfirmDelete(true)} 
              className="p-2 bg-slate-800 rounded-full text-red-400 hover:text-white hover:bg-red-600 transition"
              title="Apagar Carta ou Variação"
            >
              <Trash size={20} />
            </button>
            <button 
              onClick={() => setIsEditing(true)} 
              className="p-2 bg-slate-800 rounded-full text-purple-400 hover:text-white hover:bg-slate-700 transition"
              title="Editar Carta"
            >
              <Edit2 size={24} />
            </button>
          </>
        ) : null}
        <button 
          onClick={onClose} 
          className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition"
        >
          <X size={24} />
        </button>
      </div>

      <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-8 p-4 lg:p-8 custom-scrollbar">
        
        {/* Left Column: Image & Variations */}
        <div className="flex flex-col items-center gap-4">
          <div className="scale-110 origin-center relative">
            <Card {...card} priority={true} />
            {isCurrentCover && (
              <div className="absolute top-2 left-2 z-20 bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full shadow-lg border border-amber-300 flex items-center gap-1">
                <Crown size={12} className="fill-current" />
                <span>Capa do Catálogo</span>
              </div>
            )}
            {isCardRarePrint(card) && (
              <div className="absolute top-2 right-2 z-20 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full shadow-lg border border-yellow-200 flex items-center gap-1">
                <ShieldAlert size={12} />
                <span>{card.maxPrintCopies === 1 ? '1/1 Cópia Única' : `Tiragem (${card.maxPrintCopies || 1})`}</span>
              </div>
            )}
          </div>

          {/* Feedback de ação administrativa */}
          {adminActionFeedback && (
            <div className="w-full max-w-sm bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>{adminActionFeedback}</span>
            </div>
          )}

          {/* ADMIN TOOLBAR: DEFINIR CAPA DO CATÁLOGO & TIRAGEM RARA */}
          {isUserAdmin(user) && (
            <div className="w-full max-w-sm bg-slate-900/95 border border-amber-500/40 rounded-2xl p-3 shadow-xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5 uppercase tracking-wide">
                  <Crown size={14} className="text-amber-400 fill-amber-400/30" />
                  Controles de Administrador
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-mono font-bold">
                  {card.variationType || card.frame || 'Principal'}
                </span>
              </div>

              {/* Botão de Definir Capa */}
              <button
                type="button"
                onClick={() => handleToggleCatalogCover()}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md border ${
                  isCurrentCover
                    ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-amber-950/50 hover:bg-amber-400'
                    : 'bg-slate-950 text-amber-300 border-amber-500/40 hover:bg-amber-950/40 hover:border-amber-400'
                }`}
                title="Define qual imagem / frame aparece na vitrine principal do catálogo"
              >
                <Crown size={15} className={isCurrentCover ? 'fill-current' : ''} />
                <span>
                  {isCurrentCover
                    ? '✓ Capa Oficial do Catálogo (Clique para restaurar padrão)'
                    : `Definir "${card.variationType || card.frame || 'Esta Versão'}" como Capa`}
                </span>
              </button>

              {/* Seção de Tiragem Rara & Tiragem Única */}
              <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={Boolean(card.isRarePrint || card.requiresAdminVerification)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        handleSaveRarePrintSettings(checked, card.maxPrintCopies || 1);
                      }}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                    <span className="flex items-center gap-1 text-amber-300">
                      <ShieldAlert size={14} />
                      Tiragem Rara (Verificação Obrigatória)
                    </span>
                  </label>
                  {(card.isRarePrint || card.requiresAdminVerification) && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-bold">Cópias:</span>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={card.maxPrintCopies || 1}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          handleSaveRarePrintSettings(true, val);
                        }}
                        className="w-14 bg-slate-950 border border-amber-500/50 rounded p-1 text-center font-mono font-bold text-xs text-amber-300 outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Botões Rápidos de Tiragem */}
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSaveRarePrintSettings(true, 1)}
                    className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-black uppercase transition border ${
                      card.isRarePrint && card.maxPrintCopies === 1
                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                        : 'bg-slate-950/80 text-amber-400/90 border-amber-500/30 hover:border-amber-400 hover:bg-amber-950/30'
                    }`}
                  >
                    1/1 Tiragem Única
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveRarePrintSettings(true, 5)}
                    className={`py-1 px-2 rounded-lg text-[10px] font-bold transition border ${
                      card.isRarePrint && card.maxPrintCopies === 5
                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                        : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    5 Cópias
                  </button>
                  {Boolean(card.isRarePrint || card.requiresAdminVerification) && (
                    <button
                      type="button"
                      onClick={() => handleSaveRarePrintSettings(false, 0)}
                      className="py-1 px-2 rounded-lg text-[10px] font-bold text-red-400 border border-red-900/40 bg-red-950/30 hover:bg-red-900/50 transition"
                      title="Restaurar para tiragem comum"
                    >
                      Remover Rara
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-slate-400 leading-tight">
                  Quando ativo, a carta recebe o selo dourado e exige aprovação do Administrador no perfil do jogador para ser adicionada ao álbum.
                </p>
              </div>
            </div>
          )}

          {/* Meu Álbum Widget */}
          <div className="w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-lg flex items-center justify-between gap-3 mt-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-950 border border-purple-700/50 flex items-center justify-center text-purple-300">
                <BookmarkCheck size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 block">No Meu Álbum</span>
                <span className="text-[10px] text-slate-400">
                  {getQuantity(card) > 0 ? `${getQuantity(card)} cópia(s) na coleção` : 'Não possui na coleção'}
                </span>
              </div>
            </div>

            {user ? (
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => decrementCard(card)}
                  disabled={getQuantity(card) <= 0}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition text-xs font-bold ${
                    getQuantity(card) > 0 
                      ? 'bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-300' 
                      : 'text-slate-600 cursor-not-allowed'
                  }`}
                  title="Diminuir cópia"
                >
                  <Minus size={13} />
                </button>
                <span className="font-mono font-bold text-xs text-purple-300 px-2">
                  {getQuantity(card)}
                </span>
                <button
                  type="button"
                  onClick={handleAlbumAddClick}
                  className={`w-7 h-7 rounded-lg text-purple-200 flex items-center justify-center transition text-xs font-bold shadow-sm ${
                    isCardRarePrint(card) && !isUserAdmin(user)
                      ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-black'
                      : 'bg-purple-900/70 hover:bg-purple-700'
                  }`}
                  title={isCardRarePrint(card) && !isUserAdmin(user) ? 'Solicitar posse de tiragem rara' : 'Adicionar cópia'}
                >
                  <Plus size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-3 py-1.5 rounded-xl bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-700/50 text-[11px] font-bold transition flex items-center gap-1.5"
              >
                <LogIn size={13} />
                <span>Entrar</span>
              </button>
            )}
          </div>

          {/* Variations / Skins Selector */}
          {(cardVariations.length > 1 || isUserAdmin(user)) && (
            <div className="w-full max-w-sm bg-slate-900/90 border border-purple-500/30 rounded-2xl p-3 shadow-lg flex flex-col gap-2 mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-purple-300 font-bold">
                  <Sparkles size={14} className="text-amber-400" />
                  Variações, Frames & Skins ({cardVariations.length})
                </span>
                <span className="text-[10px] text-slate-500">Alternar visual</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cardVariations.map((v, idx) => {
                  const isCurrent = Boolean(
                    card && (
                      (v.id && card.id && v.id === card.id && v.imageUrl === card.imageUrl) ||
                      (v.imageUrl === card.imageUrl && (v.frame || 'Legado') === (card.frame || 'Legado'))
                    )
                  );
                  const isVarCover = Boolean(
                    currentCoverUrl && v.imageUrl === currentCoverUrl
                  );

                  return (
                    <div
                      key={`${v.id || ''}_${cleanCardCode(v.code)}_${v.imageUrl || idx}`}
                      onClick={() => {
                        setSelectedVarKey(v.imageUrl || v.id || v.code);
                        setCard(v);
                        setOriginalCode(v.code);
                      }}
                      className={`p-2.5 rounded-xl text-xs font-bold transition flex flex-col items-start gap-1.5 text-left border cursor-pointer ${
                        isCurrent
                          ? 'bg-purple-900/60 text-white border-purple-400 shadow-md shadow-purple-950/60 ring-1 ring-purple-300'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="flex items-center gap-1 min-w-0">
                          {isVarCover && <Crown size={13} className="text-amber-400 fill-amber-400 shrink-0" title="Capa do Catálogo" />}
                          <span className="truncate font-bold">{v.variationType || (v.frame === 'Moderno' ? 'Moderno' : 'Legado')}</span>
                        </span>
                        {isCurrent && <span className="text-[9px] bg-purple-600 px-1.5 py-0.2 rounded font-black shrink-0">Ativo</span>}
                      </div>

                      <div className="flex items-center gap-1 w-full flex-wrap">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${v.frame === 'Moderno' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' : 'bg-slate-900 text-slate-400'}`}>
                          {v.frame || 'Legado'}
                        </span>
                        {v.rarity && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-yellow-950/70 text-yellow-300 border border-yellow-800/40">
                            {v.rarity}
                          </span>
                        )}
                        {Boolean(v.isRarePrint || v.requiresAdminVerification) && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-amber-500 text-slate-950 flex items-center gap-0.5">
                            <ShieldAlert size={10} />
                            {v.maxPrintCopies === 1 ? '1/1 Única' : `${v.maxPrintCopies || 1}ex`}
                          </span>
                        )}
                      </div>

                      {/* Admin Quick Action Controls per Variation */}
                      {isUserAdmin(user) && (
                        <div className="flex items-center gap-1.5 w-full pt-1.5 border-t border-slate-800/80 mt-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleCatalogCover(v);
                            }}
                            className={`flex-1 py-1 px-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition ${
                              isVarCover
                                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-black'
                                : 'bg-slate-900 text-amber-300 hover:bg-slate-800 border border-amber-500/30'
                            }`}
                            title={isVarCover ? 'Capa atual do catálogo (Clique para restaurar padrão)' : 'Definir esta variação como capa'}
                          >
                            <Crown size={11} className={isVarCover ? 'fill-current' : ''} />
                            <span>{isVarCover ? 'Capa Oficial' : 'Definir Capa'}</span>
                          </button>
                          <button
                            type="button"
                            disabled={isSavingRareSettings}
                            onClick={(e) => {
                              e.stopPropagation();
                              const newRare = !Boolean(v.isRarePrint || v.requiresAdminVerification);
                              handleSaveRarePrintSettings(newRare, 1, v);
                            }}
                            className={`py-1 px-2 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition border ${
                              Boolean(v.isRarePrint || v.requiresAdminVerification)
                                ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                                : 'bg-slate-900 text-slate-400 hover:text-amber-300 border-slate-800 hover:border-amber-500/30'
                            }`}
                            title="Alternar Tiragem Única 1/1 apenas nesta versão"
                          >
                            <ShieldAlert size={11} />
                            <span>{Boolean(v.isRarePrint || v.requiresAdminVerification) ? '1/1' : 'Tiragem'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Info */}
        <div className="flex flex-col gap-6 text-slate-200">
          {isEditing && (
            <div className="bg-slate-800/50 p-3 rounded-lg border border-purple-500/50 mb-[-1rem]">
              <label className="text-xs font-bold text-purple-400 block mb-1">Copiar dados de outra carta</label>
              <select onChange={handleCopyFromCard} className="w-full bg-slate-900 border border-purple-700/50 rounded p-2 text-white text-sm outline-none">
                <option value="">Selecione uma carta base (copia todos os dados exceto Imagem e Frame)...</option>
                {allCards.map((c, idx) => <option key={`${c.code}-${idx}`} value={c.code}>{c.name} ({c.code})</option>)}
              </select>
            </div>
          )}
          <div className="border-b border-slate-800 pb-4">
            <div className="flex justify-between items-start mb-4 gap-4">
              {isEditing ? (
                <input 
                  type="text" 
                  value={card.name} 
                  onChange={(e) => setCard({...card, name: e.target.value})}
                  className="w-full text-3xl md:text-4xl font-black text-white tracking-tight bg-slate-900 border border-slate-700 rounded p-2 focus:border-purple-500 outline-none"
                />
              ) : (
                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">{card.name}</h2>
              )}
              
              {isEditing ? (
                <div className="flex flex-col items-center">
                  <label className="text-xs text-yellow-500 font-bold mb-1">Custo (CT)</label>
                  <input 
                    type="number" 
                    value={card.ct} 
                    onChange={(e) => setCard({...card, ct: parseInt(e.target.value) || 0})}
                    className="w-16 h-12 rounded border-2 border-yellow-600 bg-slate-900 font-mono font-bold text-yellow-400 text-xl text-center focus:border-purple-500 outline-none title='Custo (CT)'"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <label className="text-xs text-yellow-500 font-bold mb-1">Custo (CT)</label>
                  <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-yellow-600 bg-yellow-900/20 font-mono font-bold text-yellow-400 text-xl shadow-lg shrink-0" title="Custo (CT)">
                    {card.ct}
                  </div>
                </div>
              )}
            </div>
            
            {isEditing && (card.type === 'Herói' || card.type === 'Combatente') && (
              <div className="grid grid-cols-2 gap-4 mb-4 mt-2">
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Ataque (ATK)</label>
                  <input type="number" placeholder="ATK" value={card.attack || ''} onChange={(e) => setCard({...card, attack: e.target.value ? parseInt(e.target.value) : undefined})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-bold" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Defesa (DEF)</label>
                  <input type="number" placeholder="DEF" value={card.defense || ''} onChange={(e) => setCard({...card, defense: e.target.value ? parseInt(e.target.value) : undefined})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-bold" />
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 text-sm font-medium">
              {isEditing ? (
                 <select 
                   value={card.type} 
                   onChange={(e) => {
                     const newType = e.target.value as CardData['type'];
                     if (newType === 'Efeito' || newType === 'Equipamento') {
                       const next = { ...card, type: newType };
                       delete next.attack;
                       delete next.defense;
                       setCard(next);
                     } else {
                       setCard({ ...card, type: newType });
                     }
                   }} 
                   className="px-3 py-1.5 bg-slate-800 rounded text-slate-300 border border-slate-700 outline-none"
                 >
                    <option value="Herói">Herói</option>
                    <option value="Combatente">Combatente</option>
                    <option value="Equipamento">Equipamento</option>
                    <option value="Efeito">Efeito</option>
                 </select>
              ) : (
                 <span className="px-3 py-1 bg-slate-800 rounded text-slate-300 border border-slate-700">{card.type}</span>
              )}

              {isEditing ? (
                <div className="flex flex-col gap-1.5 w-full max-w-sm">
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="text" 
                      value={card.archetype || ''} 
                      onChange={(e) => setCard({...card, archetype: e.target.value})} 
                      placeholder="Arquétipo (ex: Reativo)"
                      className="flex-1 px-2.5 py-1 text-xs bg-slate-900 border border-purple-500/60 rounded text-purple-200 outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setCard({...card, archetype: ''})}
                      className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold transition"
                      title="Limpar Arquétipo"
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar p-1 bg-slate-950/60 rounded border border-slate-800">
                    {archetypes.map(a => {
                      const isSelected = (card.archetype || '').split(' / ').includes(a.name);
                      return (
                        <label key={a.name} className={`px-2 py-0.5 text-[10px] rounded cursor-pointer border transition-colors ${isSelected ? 'bg-purple-900 border-purple-500 text-purple-100 font-bold' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                          <input type="checkbox" className="hidden" checked={isSelected} onChange={(e) => {
                            let curr = (card.archetype || '').split(' / ').filter(x => x && x !== 'Desconhecido');
                            if (e.target.checked) curr.push(a.name);
                            else curr = curr.filter(x => x !== a.name);
                            setCard({...card, archetype: curr.length > 0 ? curr.join(' / ') : ''});
                          }} />
                          {a.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <span className="px-3 py-1 bg-purple-900/30 rounded text-purple-300 border border-purple-800/50">{card.archetype || "Sem Arquétipo"}</span>
              )}

              {isEditing ? (
                <>
                  <input list="collections-list" type="text" value={card.collection} onChange={(e) => setCard({...card, collection: e.target.value})} className="px-3 py-1.5 bg-blue-900/10 rounded text-blue-300 border border-blue-800/50 outline-none w-48 focus:border-purple-500" placeholder="Coleção" />
                  <datalist id="collections-list">
                    {collections.map(c => <option key={c} value={c} />)}
                  </datalist>
                </>
              ) : (
                <span className="px-3 py-1 bg-blue-900/30 rounded text-blue-300 border border-blue-800/50 flex items-center gap-1">
                  <Box size={14} /> {card.collection || "Coleção Base"}
                </span>
              )}
              
              {isEditing ? (
                 <select 
                   value={card.frame || 'Legado'} 
                   onChange={(e) => {
                     const newFrame = e.target.value as 'Legado' | 'Moderno';
                     let newRarity = card.rarity;
                     if (newFrame === 'Moderno' && (!newRarity || newRarity.startsWith('Legado') || newRarity === 'Beta' || newRarity === 'Comum')) {
                       newRarity = 'Moderno Comum';
                     } else if (newFrame === 'Legado' && (!newRarity || newRarity.startsWith('Moderno'))) {
                       newRarity = 'Legado Comum';
                     }
                     setCard({ ...card, frame: newFrame, rarity: newRarity });
                   }} 
                   className="px-3 py-1.5 bg-indigo-900/10 rounded text-indigo-300 border border-indigo-800/50 outline-none"
                 >
                    <option value="Legado">Frame Legado</option>
                    <option value="Moderno">Frame Moderno</option>
                 </select>
              ) : (
                 <span className="px-3 py-1 bg-indigo-900/30 rounded text-indigo-300 border border-indigo-800/50 hidden"></span>
              )}
              
              {isEditing ? (
                 <select 
                   value={card.rarity || (card.frame === 'Moderno' ? 'Moderno Comum' : 'Legado Comum')} 
                   onChange={(e) => {
                     const newRarity = e.target.value;
                     const isMacro = newRarity === 'Moderno Macroversal';
                     setCard({
                       ...card, 
                       rarity: newRarity,
                       ...(isMacro ? { isRarePrint: true, maxPrintCopies: 1, requiresAdminVerification: true } : {})
                     });
                   }} 
                   className="px-3 py-1.5 bg-yellow-900/10 rounded text-yellow-300 border border-yellow-800/50 outline-none font-bold"
                 >
                    {card.frame === 'Moderno' ? (
                      MODERNO_RARITIES.map(r => (
                        <option key={r} value={r}>
                          {r} {r === 'Moderno Macroversal' ? '★ (Tiragem Única • 1/ano)' : ''}
                        </option>
                      ))
                    ) : (
                      LEGADO_RARITIES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))
                    )}
                 </select>
              ) : (
                 card.rarity ? (
                   <span className={`px-3 py-1 rounded text-xs font-bold border flex items-center gap-1.5 ${
                     card.rarity === 'Moderno Macroversal'
                       ? 'bg-gradient-to-r from-amber-500/25 via-purple-500/20 to-cyan-500/25 text-amber-300 border-amber-500/70 shadow-[0_0_15px_rgba(245,158,11,0.35)] animate-pulse'
                       : 'bg-yellow-900/30 text-yellow-300 border-yellow-800/50'
                   }`}>
                     {card.rarity}
                     {card.rarity === 'Moderno Macroversal' && (
                       <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-950/90 px-1.5 py-0.5 rounded border border-amber-500/60 shadow-sm">
                         Tiragem Única (1 por ano)
                       </span>
                     )}
                   </span>
                 ) : null
              )}
            </div>
            
            {isEditing && (
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex gap-4 items-center mb-1">
                  <label className="cursor-pointer bg-slate-950 hover:bg-slate-900 border border-slate-700 p-2 rounded flex-1 flex items-center gap-2">
                    <ImageIcon size={16} className="text-purple-500" />
                    <span className="text-sm truncate text-slate-300">
                      {fileToUpload ? fileToUpload.name : (card.imageUrl ? 'Substituir Imagem do PC...' : 'Enviar do PC...')}
                    </span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      if (e.target.files?.[0]) {
                        setFileToUpload(e.target.files[0]);
                      }
                    }} />
                  </label>
                  {fileToUpload && <button onClick={() => setFileToUpload(null)} className="text-red-400 p-2"><X size={16}/></button>}
                </div>
                <input type="text" value={card.imageUrl || ''} onChange={(e) => setCard({...card, imageUrl: e.target.value})} className="w-full px-3 py-2 bg-slate-900 rounded text-slate-300 border border-slate-700 outline-none text-sm" placeholder="Ou URL da Imagem (https://...)" />
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="publicVisibility" checked={!card.isHidden} onChange={(e) => setCard({...card, isHidden: !e.target.checked})} className="w-4 h-4 accent-green-500 cursor-pointer" />
                  <label htmlFor="publicVisibility" className="text-sm font-bold text-green-400 cursor-pointer">Visível para o público (Desmarque para manter como Rascunho/Draft)</label>
                </div>

                <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl flex flex-col gap-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-300 text-xs">
                      <input
                        type="checkbox"
                        checked={Boolean(card.isRarePrint || card.requiresAdminVerification)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setCard({
                            ...card,
                            isRarePrint: checked,
                            requiresAdminVerification: checked,
                            maxPrintCopies: checked ? (card.maxPrintCopies || 1) : 0
                          });
                        }}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                      <ShieldAlert size={15} />
                      <span>Tiragem Rara (Verificação Obrigatória no Álbum)</span>
                    </label>
                    {Boolean(card.isRarePrint || card.requiresAdminVerification) && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-300 font-bold">Cópias:</span>
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={card.maxPrintCopies || 1}
                          onChange={(e) => setCard({ ...card, maxPrintCopies: parseInt(e.target.value) || 1 })}
                          className="w-14 bg-slate-900 border border-amber-500/50 rounded px-1.5 py-0.5 text-center font-mono font-bold text-xs text-amber-300 outline-none"
                        />
                        <span className="text-[10px] text-amber-400 font-bold">
                          {card.maxPrintCopies === 1 ? '(1/1 Única)' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-amber-500/20">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-200 text-xs">
                      <input
                        type="checkbox"
                        checked={Boolean(card.isCatalogCover)}
                        onChange={(e) => setCard({ ...card, isCatalogCover: e.target.checked })}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                      <Crown size={15} className="text-amber-400" />
                      <span>Definir esta versão como Capa do Catálogo</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700/50">
            <h4 className="text-sm font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
              <Zap size={16} /> Efeito da Carta
            </h4>
            {isEditing ? (
               <textarea 
                 value={card.description}
                 onChange={(e) => setCard({...card, description: e.target.value})}
                 className="w-full h-32 bg-slate-900 border border-slate-700 rounded p-3 text-slate-200 outline-none focus:border-purple-500 custom-scrollbar"
               />
            ) : (
              <p className="text-lg leading-relaxed text-slate-200 whitespace-pre-wrap">
                {card.description}
              </p>
            )}
          </div>

          <div className="bg-black/40 p-6 rounded-xl border-l-4 border-purple-600 italic">
            <h4 className="text-sm font-bold text-purple-400 uppercase mb-3 flex items-center gap-2">
              <BookOpen size={16} /> Lore
            </h4>
            {isEditing ? (
              <textarea 
                value={card.lore || ''}
                onChange={(e) => setCard({...card, lore: e.target.value})}
                className="w-full h-32 bg-slate-900/50 border border-purple-900/50 rounded p-3 text-slate-400 font-serif outline-none focus:border-purple-500 custom-scrollbar"
                placeholder="Uma história se perde no tempo sem ninguém para contá-la..."
              />
            ) : (
              <p 
                className="text-slate-400 font-serif leading-relaxed"
                dangerouslySetInnerHTML={{ __html: card.lore ? `"${card.lore}"` : '"Dados fragmentados... a história desta entidade perdeu-se no rasgo do Macroverso."' }}
              />
            )}
          </div>

          <div className="text-xs text-slate-600 font-mono pt-2 border-t border-slate-800 flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <Hash size={12}/> ID Código: 
              {isEditing ? (
                <input 
                  type="text" 
                  value={card.code} 
                  onChange={(e) => setCard({...card, code: cleanCardCode(e.target.value)})}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 outline-none focus:border-purple-500 w-full ml-2"
                />
              ) : (
                cleanCardCode(card.code)
              )}
            </div>
          </div>

          {/* Related Cards Section */}
          {relatedCards.length > 0 && (
            <div className="mt-4 animate-in slide-in-from-bottom-4 duration-500">
              <h4 className="text-sm font-bold text-blue-400 uppercase mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
                <LinkIcon size={16} /> Sinergias & Interações
              </h4>
              <div className="flex gap-4 overflow-x-auto pb-4 justify-start lg:justify-center custom-scrollbar">
                {relatedCards.map((related, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleRelatedClick(related)}
                    className="cursor-pointer group flex flex-col items-center flex-shrink-0 hover:scale-105 transition-transform"
                    title={related.name}
                  >
                    {/* Fixed container for the scaled card */}
                    <div className="relative w-[130px] h-[190px]">
                       <div className="absolute top-0 left-0 origin-top-left scale-[0.45] pointer-events-none">
                          <Card {...related} />
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
