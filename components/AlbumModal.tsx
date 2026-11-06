import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  BookOpen, 
  CheckCircle2, 
  Layers, 
  Plus, 
  Minus, 
  Sparkles, 
  LogIn,
  Crown,
  Star,
  Shield,
  Award,
  PackagePlus,
  RefreshCw,
  Check,
  Trash2,
  Trophy,
  Heart,
  Filter,
  SlidersHorizontal,
  BarChart2,
  ShoppingCart,
  Copy,
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import { CardData, MarketplaceListing, RarePrintOwner } from '../types';
import { useCards, cleanCardCode, getBaseCardCode, getCardDisplayPriority, resolveModernFrameOnly } from '../CardContext';
import { useAuth, isUserAdmin } from '../authService';
import { useUserAlbum, normalizeAlbumKey, FOIL_TYPES, FoilTypeInfo } from '../albumService';
import { compareCardCodes } from '../deckUtils';
import { syncUserCollectorStats, getCatalogueUniverse } from '../collectorsService';
import { useUserWishlist } from '../wishlistService';
import { subscribeMarketplaceListings } from '../storeService';
import { allCards as defaultCards } from '../data';
import {
  isCardRarePrint,
  fetchRegisteredUsers,
  RegisteredSiteUser,
  syncRarePrintOwnershipAcrossAlbums,
  getCardRarePrintOwners,
  hasAssignedRarePrintOwners,
  isUserOfficialRarePrintOwner
} from '../rarePrintService';
import { VerificationRequestModal } from './VerificationRequestModal';

interface AlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCard?: (card: CardData) => void;
  onOpenAuth?: () => void;
  onOpenRanking?: () => void;
  onOpenWishlist?: () => void;
}

export type AlbumEdition = 'legado' | 'moderno' | 'all';

/**
 * Metadados informativos para cada coleção / deck do jogo
 */
export const COLLECTION_METADATA: Record<string, { subtitle: string; heroName: string; category: 'deck' | 'booster' }> = {
  'Insanis': { subtitle: 'Deck Estrutural de Jim - O Senhor do Macroverso', heroName: 'Jim - O Senhor do Macroverso', category: 'deck' },
  'Príncipe do Macroverso': { subtitle: 'Deck Estrutural de Jenos', heroName: 'Jenos Senhor do Macroverso', category: 'deck' },
  'Mechs e Mangas': { subtitle: 'Deck Estrutural de Vellret', heroName: 'Spear Vellret', category: 'deck' },
  'Herdeiro do Caos': { subtitle: 'Deck Estrutural de Mahina', heroName: 'Mahina - O Herdeiro de Lúmeni', category: 'deck' },
  'Mundo em Chamas': { subtitle: 'Deck Estrutural de Donnie', heroName: 'Donnie - Samurai das Chamas', category: 'deck' },
  'Corruptor Profano': { subtitle: 'Deck Estrutural de Otto', heroName: 'Otto - Arauto da Corrupção', category: 'deck' },
  'O Escolhido': { subtitle: 'Deck Estrutural de Salazar', heroName: 'Salazar - Guia dos Escolhidos', category: 'deck' },
  'Deusa da Lua': { subtitle: 'Deck Estrutural de Selena', heroName: 'Selena - Deusa da Lua', category: 'deck' },
  'Invasão do Caos': { subtitle: 'Expansão & Deck Invasão do Caos', heroName: 'Mahina - O Arauto do Véu', category: 'deck' },
  'Booster Pack 1': { subtitle: 'Pacote de Expansão Clássico', heroName: '', category: 'booster' },
  'Booster Pack 2': { subtitle: 'Pacote de Expansão Série 2', heroName: '', category: 'booster' },
  'Booster Invasão do Caos': { subtitle: 'Pacote de Booster Invasão do Caos', heroName: 'A PRIMEIRA', category: 'booster' },
  'Reforço Macroversal': { subtitle: 'Expansão Reforço Macroversal', heroName: 'ASMONIOUS - A ESSÊNCIA DA CORRUPÇÃO', category: 'booster' },
  'LOUCURAS CAÓTICAS': { subtitle: 'Coleção Especial de Artes Alternativas e Skins', heroName: 'O Caos', category: 'booster' },
};

export interface AlbumProductPreset {
  id: string;
  name: string;
  subtitle: string;
  badge: string;
  includedCollections: string[];
  foilId?: string;
  foilLabel?: string;
  heroName?: string;
}

/**
 * Produtos Oficiais para adição rápida em lote no Álbum
 */
export const ALBUM_PRODUCTS: AlbumProductPreset[] = [
  {
    id: 'pacote_macroversal',
    name: 'Pacote Macroversal',
    subtitle: 'Adiciona de uma só vez os 9 Decks Estruturais + Todas as cartas do Booster Invasão do Caos (Todas em Foil 3D)',
    badge: '9 ESTRUTURAIS + BOOSTER INVASÃO DO CAOS • TODAS FOIL 3D',
    includedCollections: [
      'Insanis',
      'Príncipe do Macroverso',
      'Mechs e Mangas',
      'Herdeiro do Caos',
      'Mundo em Chamas',
      'Corruptor Profano',
      'O Escolhido',
      'Deusa da Lua',
      'Invasão do Caos',
      'Booster Invasão do Caos'
    ],
    foilId: 'confeti 3d',
    foilLabel: 'Foil 3D',
    heroName: 'Jim - O Senhor do Macroverso'
  },
  {
    id: 'colecao_reforco_macroversal',
    name: 'Coleção Reforço Macroversal',
    subtitle: 'Adiciona de uma só vez todas as cartas do Booster Reforço Macroversal ao seu álbum',
    badge: 'TODAS DO BOOSTER REFORÇO MACROVERSAL',
    includedCollections: [
      'Reforço Macroversal',
      'Booster Reforço Macroversal'
    ],
    heroName: 'ASMONIOUS - A ESSÊNCIA DA CORRUPÇÃO'
  }
];

/**
 * Identifica se a carta pertence ao formato / era Legado
 */
export const isLegacyCard = (c: CardData): boolean => {
  if (c.frame === 'Moderno') return false;
  if (c.code && c.code.endsWith('-M')) return false;
  if (c.collection === 'Invasão do Caos' || c.collection === 'Booster Invasão do Caos' || c.collection === 'Reforço Macroversal' || c.collection === 'LOUCURAS CAÓTICAS') return false;
  if (c.code && c.code.startsWith('2026')) return false;
  return true;
};

export const isSpecialCard = (c: CardData): boolean => {
  if (!c) return false;
  // Se for explicitamente tiragem rara ou verificação de admin: é especial
  if (c.isRarePrint || c.requiresAdminVerification || (typeof c.maxPrintCopies === 'number' && c.maxPrintCopies > 0)) {
    return true;
  }

  // Verifica se a carta base em defaultCards era comum ou beta
  const baseCode = getBaseCardCode(c.code, c.parentCode);
  const defMatch = defaultCards.find(d => getBaseCardCode(d.code, d.parentCode) === baseCode);
  if (defMatch) {
    const defRarity = (defMatch.rarity || '').trim().toLowerCase();
    // Se a carta original em defaultCards for Beta ou Comum (ou vazia), ela é uma carta comum!
    if (defRarity === 'beta' || defRarity === 'comum' || !defRarity) {
      const col = (c.collection || '').toLowerCase();
      if (!col.includes('evento especial') && !col.includes('promocional')) {
        return false;
      }
    }
  }

  const r = (c.rarity || '').trim().toLowerCase();
  if (r === 'comum' || r === 'beta' || !r) {
    return false;
  }

  if (
    r.includes('limitad') ||
    r === 'evento' ||
    r === 'especial' ||
    r === 'promo' ||
    r === 'muito rara' ||
    r === 'rara'
  ) {
    return true;
  }

  const col = (c.collection || '').toLowerCase();
  if (col.includes('evento especial') || col.includes('promocional')) {
    return true;
  }

  return false;
};

export const AlbumModal: React.FC<AlbumModalProps> = ({ isOpen, onClose, onSelectCard, onOpenAuth, onOpenRanking, onOpenWishlist }) => {
  const { user } = useAuth();
  const { cards: allCards, setCardRarePrintSettings } = useCards();
  const { 
    album,
    getQuantity, 
    getCardFoils,
    hasFoil,
    toggleCardFoil,
    incrementCard, 
    decrementCard, 
    addCollectionCards, 
    removeCollectionCards 
  } = useUserAlbum(user?.uid);

  // Cartas que procuro (Wishlist)
  const { wishlist, isCardWanted, addCard: addWantedCard, removeCard: removeWantedCard } = useUserWishlist(user?.uid, user);

  // Anúncios ativos do Mercado para cruzar com a Lista de Desejos e Fichário
  const [marketListings, setMarketListings] = useState<MarketplaceListing[]>([]);
  React.useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeMarketplaceListings(list => {
      setMarketListings(list.filter(item => item.status === 'active' && item.stockQuantity > 0));
    });
    return () => unsub();
  }, [isOpen]);

  const marketCardCodesSet = useMemo(() => {
    const codes = new Set<string>();
    const names = new Set<string>();
    marketListings.forEach(item => {
      if (item.cardId) codes.add(cleanCardCode(item.cardId).toUpperCase());
      if (item.cardName) names.add(item.cardName.trim().toLowerCase());
      if (item.includedCards) {
        item.includedCards.forEach(ic => {
          if (ic.cardId) codes.add(cleanCardCode(ic.cardId).toUpperCase());
          if (ic.cardName) names.add(ic.cardName.trim().toLowerCase());
        });
      }
    });
    return { codes, names };
  }, [marketListings]);

  const isCardAvailableInMarket = React.useCallback((card: CardData) => {
    const cCode = cleanCardCode(card.code || '').toUpperCase();
    const bCode = getBaseCardCode(card.code, card.parentCode).toUpperCase();
    const cName = (card.name || '').trim().toLowerCase();
    return (
      (cCode && marketCardCodesSet.codes.has(cCode)) ||
      (bCode && marketCardCodesSet.codes.has(bCode)) ||
      (cName && marketCardCodesSet.names.has(cName))
    );
  }, [marketCardCodesSet]);

  // Sincroniza estatísticas de colecionador na nuvem sempre que o acervo mudar
  React.useEffect(() => {
    if (user && user.uid && album && Object.keys(album).length > 0 && allCards.length > 0) {
      syncUserCollectorStats(user.uid, user, album, allCards);
    }
  }, [album, user?.uid, allCards.length]);

  // Edição do Álbum (Padrão: Álbum Completo 'all' - reflete 100% o catálogo geral)
  const [albumEdition, setAlbumEdition] = useState<AlbumEdition>('all');
  const [onlySpecials, setOnlySpecials] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('Todas');
  const [filterMode, setFilterMode] = useState<'all' | 'owned' | 'missing' | 'wanted' | 'duplicates'>('all');
  const [selectedFoilFilter, setSelectedFoilFilter] = useState<'all' | 'any_foil' | string>('all');
  const [cardForFoilModal, setCardForFoilModal] = useState<CardData | null>(null);

  // Estados para inserção de produtos e coleções completas em lote
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMode, setBulkMode] = useState<'add' | 'ensure_at_least'>('add');
  const [bulkTab, setBulkTab] = useState<'all' | 'products' | 'deck' | 'booster'>('all');
  const [bulkLoadingName, setBulkLoadingName] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal para solicitação de tiragem rara ao tentar adicionar ao álbum
  const [rareVerificationCard, setRareVerificationCard] = useState<CardData | null>(null);

  // Modal do Administrador para definir Tiragem Limitada & Dono Oficial direto pelo Álbum
  const [cardForRareOwnerModal, setCardForRareOwnerModal] = useState<CardData | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredSiteUser[]>([]);
  const [ownerSearchTerm, setOwnerSearchTerm] = useState('');
  const [isSavingOwner, setIsSavingOwner] = useState(false);

  React.useEffect(() => {
    if (isOpen && isUserAdmin(user)) {
      fetchRegisteredUsers().then(setRegisteredUsers);
    }
  }, [isOpen, user]);

  // Estados exclusivos para a interface mobile compacta
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobileStats, setShowMobileStats] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCollection !== 'Todas') count++;
    if (selectedFoilFilter !== 'all') count++;
    if (onlySpecials) count++;
    return count;
  }, [selectedCollection, selectedFoilFilter, onlySpecials]);

  // Pool de cartas conforme o Álbum selecionado:
  // Inclui todas as cartas e variações (artes alternativas, skins e frames) de forma 100% individual,
  // exatamente em sincronia com o Hall da Fama e as regras do catálogo.
  const albumPoolCards = useMemo(() => {
    const universe = getCatalogueUniverse(allCards);
    let pool = universe.cardsList;
    if (albumEdition === 'legado') {
      pool = pool.filter(isLegacyCard);
    } else if (albumEdition === 'moderno') {
      pool = pool.filter(c => !isLegacyCard(c));
    }
    return [...pool].sort((a, b) => compareCardCodes(a.code, b.code));
  }, [allCards, albumEdition]);

  // Auto-remoção automática no álbum caso o usuário possua alguma carta de tiragem limitada cujo dono oficial seja outra pessoa
  React.useEffect(() => {
    if (!user || !user.uid || !album || Object.keys(album).length === 0 || allCards.length === 0) return;
    const universe = getCatalogueUniverse(allCards);
    const unauthorizedCards = universe.cardsList.filter(c =>
      hasAssignedRarePrintOwners(c) &&
      !isUserOfficialRarePrintOwner(c, user.uid) &&
      getQuantity(c) > 0
    );
    if (unauthorizedCards.length > 0) {
      removeCollectionCards(unauthorizedCards).then(() => {
        setToastMessage(
          `${unauthorizedCards.length} carta(s) de tiragem limitada com dono oficial registrado foram removidas automaticamente do seu álbum.`
        );
        setTimeout(() => setToastMessage(null), 5000);
      });
    }
  }, [user?.uid, album, allCards]);

  const handleSaveAlbumCardRareSettings = async (
    targetCard: CardData,
    isRare: boolean,
    maxCopies: number,
    owners: RarePrintOwner[]
  ) => {
    try {
      setIsSavingOwner(true);
      const effectiveOwners = isRare ? owners : [];
      const baseCode = getBaseCardCode(targetCard.code, targetCard.parentCode);
      const payload: CardData = {
        ...targetCard,
        parentCode: baseCode || targetCard.parentCode,
        isRarePrint: isRare,
        requiresAdminVerification: isRare,
        maxPrintCopies: isRare ? maxCopies : 0,
        rarePrintOwners: effectiveOwners
      };
      await setCardRarePrintSettings(payload, isRare, maxCopies, effectiveOwners);

      let extraMsg = '';
      if (isRare && effectiveOwners.length > 0) {
        const res = await syncRarePrintOwnershipAcrossAlbums(payload, effectiveOwners);
        const names = effectiveOwners.map(o => o.displayName).join(', ');
        if (res.removedFromUsersCount > 0) {
          extraMsg = ` Dono: ${names} (removida automaticamente de ${res.removedFromUsersCount} outro(s) álbum(ns))!`;
        } else {
          extraMsg = ` Dono: ${names} (adicionada ao álbum do dono e bloqueada para outros)!`;
        }
      }

      setCardForRareOwnerModal(payload);
      setToastMessage(
        isRare
          ? `Tiragem limitada (${maxCopies}x) salva para "${targetCard.name}"!${extraMsg}`
          : `Tiragem padrão restaurada para "${targetCard.name}"!`
      );
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err) {
      console.error('Erro ao salvar dono da carta limitada:', err);
    } finally {
      setIsSavingOwner(false);
    }
  };

  // Lista estruturada de coleções disponíveis com contagem de posse baseada nas cartas do álbum ativo
  const collectionsSummary = useMemo(() => {
    const colNames = new Set<string>();
    albumPoolCards.forEach(card => {
      if (card.collection) colNames.add(card.collection);
      if (card.variants) {
        card.variants.forEach((v: any) => {
          if (v.collection) colNames.add(v.collection);
        });
      }
    });

    return Array.from(colNames).map(name => {
      const cards = albumPoolCards.filter(card => 
        card.collection === name || 
        Boolean(card.variants && card.variants.some((v: any) => v.collection === name))
      );

      let ownedCount = 0;
      let totalCopies = 0;
      cards.forEach(c => {
        const q = getQuantity(c);
        if (q > 0) {
          ownedCount++;
          totalCopies += q;
        }
      });

      const meta = COLLECTION_METADATA[name] || {
        subtitle: 'Coleção de cartas do jogo',
        heroName: '',
        category: (cards.length <= 35 ? 'deck' : 'booster') as 'deck' | 'booster'
      };

      const heroCard = meta.heroName 
        ? cards.find(c => c.name.toLowerCase().includes(meta.heroName.toLowerCase())) || cards[0]
        : cards[0];

      return {
        name,
        subtitle: meta.subtitle,
        category: meta.category,
        totalCards: cards.length,
        ownedCount,
        totalCopies,
        percent: cards.length > 0 ? Math.round((ownedCount / cards.length) * 100) : 0,
        cards,
        coverImage: heroCard?.imageUrl
      };
    }).sort((a, b) => {
      if (a.category !== b.category) {
        return a.category === 'deck' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [albumPoolCards, getQuantity]);

  // Resumo dos Produtos Oficiais (Pacote Macroversal, Coleção Reforço Macroversal, etc.)
  const productsSummary = useMemo(() => {
    const universe = getCatalogueUniverse(allCards);
    const fullCards = universe.cardsList;

    return ALBUM_PRODUCTS.map(prod => {
      const targetCols = new Set(prod.includedCollections.map(c => c.trim().toLowerCase()));
      // Busca primeiro no pool ativo (ou no universo completo caso o filtro de edição oculte cartas do produto)
      let matched = albumPoolCards.filter(card => {
        const cCol = (card.collection || '').trim().toLowerCase();
        if (targetCols.has(cCol)) return true;
        return Boolean(card.variants && card.variants.some((v: any) => targetCols.has((v.collection || '').trim().toLowerCase())));
      });

      if (matched.length === 0) {
        matched = fullCards.filter(card => {
          const cCol = (card.collection || '').trim().toLowerCase();
          if (targetCols.has(cCol)) return true;
          return Boolean(card.variants && card.variants.some((v: any) => targetCols.has((v.collection || '').trim().toLowerCase())));
        });
      }

      // Garante que todas as coleções integrantes do produto estejam representadas mesmo que o usuário esteja em outra aba
      const matchedCols = new Set(matched.map(c => (c.collection || '').trim().toLowerCase()));
      targetCols.forEach(tc => {
        if (!matchedCols.has(tc)) {
          const fromFull = fullCards.filter(card => (card.collection || '').trim().toLowerCase() === tc);
          if (fromFull.length > 0) {
            matched = [...matched, ...fromFull];
          }
        }
      });

      // Deduplica por chave do álbum
      const uniqueMap = new Map<string, CardData>();
      matched.forEach(c => {
        const k = normalizeAlbumKey(c);
        if (k && !uniqueMap.has(k)) {
          uniqueMap.set(k, c);
        }
      });
      const cards = Array.from(uniqueMap.values());

      let ownedCount = 0;
      let totalCopies = 0;
      let foilCount = 0;
      cards.forEach(c => {
        const q = getQuantity(c);
        if (q > 0) {
          ownedCount++;
          totalCopies += q;
        }
        if (prod.foilId && hasFoil(c, prod.foilId)) {
          foilCount++;
        }
      });

      const heroCard = prod.heroName
        ? cards.find(c => c.name.toLowerCase().includes(prod.heroName!.toLowerCase())) || cards[0]
        : cards[0];

      return {
        ...prod,
        totalCards: cards.length,
        ownedCount,
        totalCopies,
        foilCount,
        percent: cards.length > 0 ? Math.round((ownedCount / cards.length) * 100) : 0,
        cards,
        coverImage: heroCard?.imageUrl
      };
    });
  }, [allCards, albumPoolCards, getQuantity, hasFoil]);

  // Coleção atualmente selecionada no filtro (se for uma coleção real)
  const currentCollectionData = useMemo(() => {
    if (selectedCollection === 'Todas' || selectedCollection.startsWith('★')) return null;
    return collectionsSummary.find(c => c.name === selectedCollection) || null;
  }, [collectionsSummary, selectedCollection]);

  const handleAddProduct = async (productId: string, mode: 'add' | 'ensure_at_least' = bulkMode) => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      else alert('Faça login com sua conta para salvar seus produtos no álbum.');
      return;
    }

    const prod = productsSummary.find(p => p.id === productId);
    if (!prod || prod.cards.length === 0) return;

    setBulkLoadingName(prod.id);
    try {
      const eligibleCards = isUserAdmin(user)
        ? prod.cards
        : prod.cards.filter(c => !isCardRarePrint(c));

      const foilsToApply = prod.foilId ? [prod.foilId] : undefined;
      const count = await addCollectionCards(eligibleCards, mode, 1, foilsToApply);
      const foilMsg = prod.foilLabel ? ` (todas marcadas com ${prod.foilLabel})` : '';
      const actionText = mode === 'add' ? 'adicionadas (+1 cópia de cada)' : 'completadas com sucesso';
      let message = `Produto "${prod.name}": ${count} cartas foram ${actionText}${foilMsg}!`;
      if (prod.cards.length > eligibleCards.length) {
        message += ' (Cartas de tiragem rara requerem aprovação individual do administrador).';
      }
      setToastMessage(message);
      setTimeout(() => setToastMessage(null), 4500);
    } catch (err) {
      console.error('Erro ao adicionar produto:', err);
      alert('Houve um erro ao atualizar o álbum. Tente novamente.');
    } finally {
      setBulkLoadingName(null);
    }
  };

  const handleRemoveProduct = async (productId: string) => {
    if (!user) return;
    const prod = productsSummary.find(p => p.id === productId);
    if (!prod || prod.cards.length === 0) return;

    if (!window.confirm(`Deseja realmente zerar no seu álbum todas as cartas do produto "${prod.name}"?`)) {
      return;
    }

    setBulkLoadingName(prod.id);
    try {
      await removeCollectionCards(prod.cards);
      setToastMessage(`Cartas do produto "${prod.name}" foram zeradas no seu álbum.`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error('Erro ao remover produto:', err);
    } finally {
      setBulkLoadingName(null);
    }
  };

  const handleAddCollection = async (collectionName: string, mode: 'add' | 'ensure_at_least' = bulkMode) => {
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      else alert('Faça login com sua conta para salvar suas cartas no álbum.');
      return;
    }

    const col = collectionsSummary.find(c => c.name === collectionName);
    if (!col || col.cards.length === 0) return;

    setBulkLoadingName(collectionName);
    try {
      // Jogadores comuns não adicionam cartas de tiragem rara em lote (devem ser verificadas individualmente)
      const eligibleCards = isUserAdmin(user) 
        ? col.cards 
        : col.cards.filter(c => !isCardRarePrint(c));

      const count = await addCollectionCards(eligibleCards, mode, 1);
      const actionText = mode === 'add' ? 'adicionadas (+1 cópia de cada)' : 'completadas com sucesso';
      let message = `${count} cartas de "${collectionName}" foram ${actionText}!`;
      if (col.cards.length > eligibleCards.length) {
        message += ' (Cartas de tiragem rara requerem aprovação individual do administrador).';
      }
      setToastMessage(message);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error('Erro ao adicionar coleção:', err);
      alert('Houve um erro ao atualizar o álbum. Tente novamente.');
    } finally {
      setBulkLoadingName(null);
    }
  };

  const handleRemoveCollection = async (collectionName: string) => {
    if (!user) return;
    const col = collectionsSummary.find(c => c.name === collectionName);
    if (!col || col.cards.length === 0) return;

    if (!window.confirm(`Deseja realmente zerar a quantidade de todas as cartas de "${collectionName}" no seu álbum?`)) {
      return;
    }

    setBulkLoadingName(collectionName);
    try {
      await removeCollectionCards(col.cards);
      setToastMessage(`Cartas de "${collectionName}" foram zeradas no seu álbum.`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error('Erro ao remover coleção:', err);
    } finally {
      setBulkLoadingName(null);
    }
  };

  // Coleções disponíveis no álbum atual
  const availableCollections = useMemo(() => {
    const cols = new Set<string>();
    albumPoolCards.forEach(c => {
      if (c.collection) cols.add(c.collection);
      if (c.variants) {
        c.variants.forEach((v: any) => {
          if (v.collection) cols.add(v.collection);
        });
      }
    });
    return Array.from(cols).sort();
  }, [albumPoolCards]);

  // Contagem de cartas especiais deste álbum
  const specialCardsCount = useMemo(() => {
    return albumPoolCards.filter(isSpecialCard).length;
  }, [albumPoolCards]);

  // Estatísticas de posse do Álbum ativo
  const stats = useMemo(() => {
    let totalUniqueOwned = 0;
    let totalCopies = 0;

    const baseCards = onlySpecials 
      ? albumPoolCards.filter(isSpecialCard) 
      : albumPoolCards;

    baseCards.forEach(card => {
      const qty = getQuantity(card);
      if (qty > 0) {
        totalUniqueOwned++;
        totalCopies += qty;
      }
    });

    const percent = baseCards.length > 0 
      ? Math.round((totalUniqueOwned / baseCards.length) * 100) 
      : 0;

    return {
      totalCards: baseCards.length,
      totalUniqueOwned,
      totalCopies,
      percent
    };
  }, [albumPoolCards, onlySpecials, getQuantity]);

  // Cartas filtradas para exibição no grid
  const filteredCards = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return albumPoolCards.filter(card => {
      const qty = getQuantity(card);
      const isOwned = qty > 0;
      const cardSpecial = isSpecialCard(card);

      // Filtro rápido de somente especiais
      if (onlySpecials && !cardSpecial) return false;

      // Filtro de posse, lista de desejos e repetidas
      if (filterMode === 'owned' && !isOwned) return false;
      if (filterMode === 'missing' && isOwned) return false;
      if (filterMode === 'wanted' && !isCardWanted(card)) return false;
      if (filterMode === 'duplicates' && qty <= 1) return false;

      // Filtro de coleção
      if (selectedCollection === '★ Especiais' && !cardSpecial) {
        return false;
      } else if (selectedCollection === '★ Limitadas' && !(card.rarity || '').toLowerCase().includes('limitad')) {
        return false;
      } else if (selectedCollection === '★ Raras' && !(card.rarity || '').toLowerCase().includes('rara')) {
        return false;
      } else if (selectedCollection === '★ Eventos' && !(card.rarity || '').toLowerCase().includes('evento')) {
        return false;
      } else if (selectedCollection !== 'Todas' && !selectedCollection.startsWith('★')) {
        const matchesCol = card.collection === selectedCollection || 
          Boolean(card.variants && card.variants.some((v: any) => v.collection === selectedCollection));
        if (!matchesCol) return false;
      }

      // Filtro de Foil
      if (selectedFoilFilter === 'any_foil' && !hasFoil(card)) return false;
      if (selectedFoilFilter !== 'all' && selectedFoilFilter !== 'any_foil' && !hasFoil(card, selectedFoilFilter)) return false;

      // Filtro de busca textual
      if (term) {
        const nameMatch = (card.name || '').toLowerCase().includes(term);
        const codeMatch = (card.code || '').toLowerCase().includes(term);
        const typeMatch = (card.type || '').toLowerCase().includes(term);
        const archetypeMatch = (card.archetype || '').toLowerCase().includes(term);
        const rarityMatch = (card.rarity || '').toLowerCase().includes(term);
        if (!nameMatch && !codeMatch && !typeMatch && !archetypeMatch && !rarityMatch) return false;
      }

      return true;
    });
  }, [albumPoolCards, searchTerm, selectedCollection, filterMode, onlySpecials, selectedFoilFilter, getQuantity, hasFoil, isCardWanted]);

  const wantedCountInPool = useMemo(() => {
    return albumPoolCards.filter(c => isCardWanted(c)).length;
  }, [albumPoolCards, isCardWanted]);

  const duplicatesCountInPool = useMemo(() => {
    return albumPoolCards.filter(c => getQuantity(c) > 1).length;
  }, [albumPoolCards, getQuantity]);

  const handleCopyCollectorChecklist = () => {
    const wantedList = albumPoolCards.filter(c => isCardWanted(c));
    const dupesList = albumPoolCards.filter(c => getQuantity(c) > 1);
    const lines: string[] = [
      `📘 MEU FICHÁRIO & CHECKLIST - LIGHT DARK TCG`,
      `Progresso: ${stats.totalUniqueOwned}/${stats.totalCards} cartas únicas (${stats.percent}%) | Total de cópias: ${stats.totalCopies}`,
      ``
    ];
    if (wantedList.length > 0) {
      lines.push(`🎯 LISTA DE DESEJOS (PROCURANDO - ${wantedList.length}):`);
      wantedList.forEach(c => {
        const inMkt = isCardAvailableInMarket(c) ? ' [À VENDA NO MERCADO]' : '';
        lines.push(`• ${c.name} (${c.code}) - ${c.collection || 'Geral'}${inMkt}`);
      });
      lines.push(``);
    }
    if (dupesList.length > 0) {
      lines.push(`🔄 REPETIDAS PARA TROCA / VENDA (${dupesList.length}):`);
      dupesList.forEach(c => {
        const extra = getQuantity(c) - 1;
        lines.push(`• ${extra}x ${c.name} (${c.code}) - ${c.collection || 'Geral'}`);
      });
      lines.push(``);
    }
    navigator.clipboard.writeText(lines.join('\n'));
    setToastMessage('Checklist de Colecionador (Desejos + Repetidas) copiado para a área de transferência!');
    setTimeout(() => setToastMessage(null), 3500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b0f19] w-full max-w-7xl h-full sm:h-[94vh] rounded-none sm:rounded-2xl border-0 sm:border border-purple-900/40 shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* ============================================================== */}
        {/* INTERFACE EXCLUSIVA PARA CELULAR (COMPACTA, RÁPIDA E DIRETA)   */}
        {/* ============================================================== */}
        <div className="sm:hidden flex flex-col shrink-0 bg-[#0a0d17] border-b border-slate-800/80">
          {/* TOPO: Título, Progresso rápido e Ações */}
          <div className="px-3 py-2 bg-gradient-to-r from-purple-950/80 via-slate-900 to-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
                <BookOpen size={16} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-white truncate tracking-tight leading-none">
                  Meu Álbum
                </h2>
                <button
                  type="button"
                  onClick={() => setShowMobileStats(true)}
                  className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-mono active:scale-95"
                >
                  <span className="text-purple-400 font-black">{stats.percent}%</span>
                  <span>•</span>
                  <span>{stats.totalUniqueOwned}/{stats.totalCards} un.</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-purple-950 border border-purple-700/50 text-purple-300">📊</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Inserir Produto / Coleção Rápido */}
              <button
                type="button"
                onClick={() => setShowBulkModal(true)}
                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 active:scale-95 shadow-sm"
                title="Adicionar Produtos, Coleções ou Decks Completos"
              >
                <PackagePlus size={13} />
                <span>+ Produto / Deck</span>
              </button>

              {/* Ranking Hall da Fama */}
              {onOpenRanking && (
                <button
                  type="button"
                  onClick={onOpenRanking}
                  className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 active:scale-95"
                  title="Hall da Fama dos Colecionadores"
                >
                  <Trophy size={14} />
                </button>
              )}

              {/* Usuário / Auth */}
              {!user ? (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="p-1.5 rounded-lg bg-purple-600 text-white active:scale-95"
                  title="Entrar na Conta"
                >
                  <LogIn size={14} />
                </button>
              ) : (
                <div className="w-7 h-7 rounded-full bg-purple-900/60 border border-purple-500/40 flex items-center justify-center text-[10px] text-purple-200 font-bold overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (user.displayName || 'U')[0]
                  )}
                </div>
              )}

              {/* Fechar Álbum */}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 active:scale-95 ml-0.5"
                title="Fechar Álbum"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* LINHA 1: Seletor de Edição (Completo / Moderno / Legado) */}
          <div className="px-2.5 py-1.5 bg-slate-950/95 border-b border-slate-800/80 flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setAlbumEdition('all');
                setSelectedCollection('Todas');
                setOnlySpecials(false);
              }}
              className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                albumEdition === 'all'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800'
              }`}
            >
              <Sparkles size={11} className={albumEdition === 'all' ? 'text-purple-200' : 'text-slate-500'} />
              <span>Completo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAlbumEdition('moderno');
                setSelectedCollection('Todas');
                setOnlySpecials(false);
              }}
              className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                albumEdition === 'moderno'
                  ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800'
              }`}
            >
              <Sparkles size={11} className={albumEdition === 'moderno' ? 'text-purple-200' : 'text-slate-500'} />
              <span>Moderno</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAlbumEdition('legado');
                setSelectedCollection('Todas');
                setOnlySpecials(false);
              }}
              className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                albumEdition === 'legado'
                  ? 'bg-gradient-to-r from-amber-600 to-purple-600 text-white shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800'
              }`}
            >
              <Shield size={11} className={albumEdition === 'legado' ? 'text-amber-200' : 'text-slate-500'} />
              <span>Legado</span>
            </button>
          </div>

          {/* LINHA 2: Busca Rápida + Botão de Filtros */}
          <div className="px-2.5 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 focus-within:border-purple-500 transition">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Buscar card por nome, cód..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent text-xs text-white placeholder-slate-500 outline-none w-full"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-white p-0.5">
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowMobileFilters(true)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition active:scale-95 shrink-0 ${
                activeFilterCount > 0
                  ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>Filtros</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* LINHA 3: Abas de Posse (Todas / Tenho / Faltam) & Chips Rápidos */}
          <div className="px-2.5 py-1.5 bg-slate-950 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition whitespace-nowrap ${
                  filterMode === 'all' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-400'
                }`}
              >
                Todas ({albumPoolCards.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('owned')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition whitespace-nowrap ${
                  filterMode === 'owned' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400'
                }`}
              >
                Tenho ({stats.totalUniqueOwned})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('missing')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition whitespace-nowrap ${
                  filterMode === 'missing' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-400'
                }`}
              >
                Faltam ({stats.totalCards - stats.totalUniqueOwned})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('wanted')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition whitespace-nowrap ${
                  filterMode === 'wanted' ? 'bg-pink-600 text-white shadow-xs' : 'text-pink-300'
                }`}
              >
                ★ Desejos ({wantedCountInPool})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('duplicates')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition whitespace-nowrap ${
                  filterMode === 'duplicates' ? 'bg-cyan-600 text-white shadow-xs' : 'text-cyan-300'
                }`}
              >
                Repetidas ({duplicatesCountInPool})
              </button>
            </div>

            {/* Especiais chip */}
            {specialCardsCount > 0 && (
              <button
                type="button"
                onClick={() => setOnlySpecials(prev => !prev)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition whitespace-nowrap shrink-0 flex items-center gap-1 ${
                  onlySpecials
                    ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                    : 'bg-slate-900 text-amber-300 border-amber-600/40'
                }`}
              >
                <Crown size={11} className={onlySpecials ? 'fill-slate-950' : 'fill-amber-400'} />
                <span>★ Especiais ({specialCardsCount})</span>
              </button>
            )}

            {/* Active Collection Chip */}
            {selectedCollection !== 'Todas' && (
              <button
                type="button"
                onClick={() => { setSelectedCollection('Todas'); setOnlySpecials(false); }}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-950 border border-purple-500/60 text-purple-200 flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <span className="truncate max-w-[100px]">{selectedCollection}</span>
                <X size={10} />
              </button>
            )}

            {/* Active Foil Chip */}
            {selectedFoilFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedFoilFilter('all')}
                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-yellow-950 border border-yellow-500/60 text-yellow-200 flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <span className="truncate max-w-[90px]">
                  {selectedFoilFilter === 'any_foil' ? 'Foils' : FOIL_TYPES.find(f => f.id === selectedFoilFilter)?.shortName || 'Foil'}
                </span>
                <X size={10} />
              </button>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* INTERFACE DESKTOP (MANTIDA 100% INTACTA PARA TELAS MAIORES)    */}
        {/* ============================================================== */}
        <div className="hidden sm:block shrink-0">
          {/* HEADER */}
          <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-slate-950 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-lg shadow-purple-950">
              <BookOpen size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide flex items-center gap-2">
                  Meu Álbum de Coleção
                </h2>
                {user && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700/50 font-mono hidden sm:inline-block">
                    Sincronizado na Nuvem
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                {albumEdition === 'legado' 
                  ? 'Álbum Legado: Coleções estruturais clássicas, Booster Packs 1 & 2 e cartas especiais.' 
                  : albumEdition === 'moderno'
                  ? 'Álbum Moderno: Cartas do novo frame e expansão Invasão do Caos.'
                  : 'Catálogo Geral: Visualizando todos os cards registrados.'}
              </p>
            </div>
          </div>

          {/* SELETOR DE EDIÇÃO DO ÁLBUM (COMPLETO vs MODERNO vs LEGADO) */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl shadow-inner">
            <button
              onClick={() => {
                setAlbumEdition('all');
                setSelectedCollection('Todas');
                setOnlySpecials(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                albumEdition === 'all'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-950/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles size={14} className={albumEdition === 'all' ? 'text-purple-300' : 'text-slate-400'} />
              <span>Álbum Completo</span>
            </button>

            <button
              onClick={() => {
                setAlbumEdition('moderno');
                setSelectedCollection('Todas');
                setOnlySpecials(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                albumEdition === 'moderno'
                  ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-md shadow-purple-950/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles size={14} className={albumEdition === 'moderno' ? 'text-purple-300' : 'text-slate-400'} />
              <span>Álbum Moderno</span>
            </button>

            <button
              onClick={() => {
                setAlbumEdition('legado');
                setSelectedCollection('Todas');
                setOnlySpecials(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                albumEdition === 'legado'
                  ? 'bg-gradient-to-r from-amber-600 to-purple-600 text-white shadow-md shadow-amber-950/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield size={14} className={albumEdition === 'legado' ? 'text-amber-200' : 'text-slate-400'} />
              <span>Álbum Legado</span>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* BOTÃO PARA VISUALIZAR RANKING TOP 10 COLECIONADORES */}
            {onOpenRanking && (
              <button
                onClick={onOpenRanking}
                className="px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                title="Visualizar Ranking Top 10 dos Maiores Colecionadores"
              >
                <Trophy size={16} className="text-amber-400 fill-amber-400/20" />
                <span className="hidden sm:inline">Hall da Fama</span>
                <span className="sm:hidden">Hall da Fama</span>
              </button>
            )}

            {/* BOTÃO PARA INSERIR PRODUTOS / COLEÇÕES / DECKS COMPLETOS */}
            <button
              onClick={() => setShowBulkModal(true)}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 active:scale-95 shrink-0"
              title="Adicionar Produtos Oficiais (Pacote Macroversal, Coleção Reforço Macroversal), Decks Estruturais ou Coleções inteiras de uma só vez ao seu álbum"
            >
              <PackagePlus size={16} />
              <span className="hidden sm:inline">Adicionar Produto / Coleção</span>
              <span className="sm:hidden">+ Produto</span>
            </button>

            {!user ? (
              <button
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-purple-600 hover:bg-purple-500 text-white transition flex items-center gap-2 shadow-lg shadow-purple-900/40 active:scale-95"
              >
                <LogIn size={16} />
                <span>Entrar na Conta</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/60 px-3 py-1.5 rounded-xl">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'Usuário'} className="w-6 h-6 rounded-full border border-purple-400/50" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-purple-700 flex items-center justify-center text-xs font-bold text-white">
                    {(user.displayName || 'J')[0]}
                  </div>
                )}
                <span className="text-xs font-semibold text-slate-200 max-w-[120px] truncate">
                  {user.displayName || user.email}
                </span>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Fechar Álbum"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* PROGRESS BANNER */}
        <div className="px-4 sm:px-6 py-3 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-8 flex-wrap">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
                {albumEdition === 'legado' ? 'Progresso Álbum Legado' : albumEdition === 'moderno' ? 'Progresso Álbum Moderno' : 'Progresso Total'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-black text-purple-400">{stats.percent}%</span>
                <span className="text-xs text-slate-500 font-medium">({stats.totalUniqueOwned}/{stats.totalCards} únicas)</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">Total de Cópias</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-black text-emerald-400">{stats.totalCopies}</span>
                <span className="text-xs text-slate-500 font-medium">cartas físicas</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">Faltando</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-black text-amber-400">{stats.totalCards - stats.totalUniqueOwned}</span>
                <span className="text-xs text-slate-500 font-medium">para completar</span>
              </div>
            </div>

            {specialCardsCount > 0 && (
              <div>
                <span className="text-[11px] uppercase tracking-wider text-amber-400 font-bold block">Cartas Especiais</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg sm:text-xl font-black text-amber-300">
                    {albumPoolCards.filter(c => isSpecialCard(c) && getQuantity(c) > 0).length}/{specialCardsCount}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">no álbum</span>
                </div>
              </div>
            )}
          </div>

          {/* BARRA DE PROGRESSO */}
          <div className="w-full sm:w-64">
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/50">
              <div 
                className="bg-gradient-to-r from-purple-600 to-emerald-400 h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* FILTROS E BUSCA */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-1.5 focus-within:border-purple-500 transition">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nome, código ou arquétipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none w-full"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-white text-xs">
                Limpar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* BOTÃO DE FILTRO DE ESPECIAIS (REQUISITO EXPLÍCITO) */}
            {specialCardsCount > 0 && (
              <button
                onClick={() => setOnlySpecials(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border active:scale-95 ${
                  onlySpecials
                    ? 'bg-gradient-to-r from-amber-600 to-purple-600 text-white border-amber-300 shadow-md shadow-amber-950/50'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-amber-300 hover:border-amber-700/60'
                }`}
                title="Filtrar apenas as cartas especiais deste álbum (Limitadas, Raras e Eventos)"
              >
                <Crown size={14} className={onlySpecials ? 'text-amber-200 fill-amber-300' : 'text-amber-400'} />
                <span>★ Especiais ({specialCardsCount})</span>
              </button>
            )}

            {/* MODO DE POSSE */}
            <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterMode === 'all' 
                    ? 'bg-purple-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todas ({albumPoolCards.length})
              </button>
              <button
                onClick={() => setFilterMode('owned')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterMode === 'owned' 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tenho ({stats.totalUniqueOwned})
              </button>
              <button
                onClick={() => setFilterMode('missing')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterMode === 'missing' 
                    ? 'bg-amber-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Faltando ({stats.totalCards - stats.totalUniqueOwned})
              </button>
              <button
                onClick={() => setFilterMode('wanted')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  filterMode === 'wanted' 
                    ? 'bg-pink-600 text-white shadow-sm' 
                    : 'text-pink-300 hover:text-white'
                }`}
                title="Filtrar apenas cartas marcadas na sua Lista de Desejos"
              >
                <Heart size={11} className="fill-current" />
                <span>Desejos ({wantedCountInPool})</span>
              </button>
              <button
                onClick={() => setFilterMode('duplicates')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterMode === 'duplicates' 
                    ? 'bg-cyan-600 text-white shadow-sm' 
                    : 'text-cyan-300 hover:text-white'
                }`}
                title="Filtrar cartas com 2 ou mais cópias (disponíveis para troca/venda)"
              >
                Repetidas ({duplicatesCountInPool})
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyCollectorChecklist}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
              title="Copiar resumo de Lista de Desejos + Cartas Repetidas para WhatsApp/Discord"
            >
              <Copy size={13} />
              <span>Exportar Checklist</span>
            </button>

            {/* FILTRO DE ACABAMENTO FOIL */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <Sparkles size={14} className="text-yellow-400" />
              <select
                value={selectedFoilFilter}
                onChange={(e) => setSelectedFoilFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer font-medium max-w-[150px] truncate"
              >
                <option value="all" className="bg-slate-900">Todos os Acabamentos</option>
                <option value="any_foil" className="bg-slate-900 text-yellow-300 font-bold">✨ Apenas Foils</option>
                <optgroup label="11 Tipos de Foil" className="bg-slate-900 text-purple-300">
                  {FOIL_TYPES.map(foil => (
                    <option key={foil.id} value={foil.id} className="bg-slate-900 text-slate-200">
                      Foil {foil.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* SELEÇÃO DE COLEÇÃO */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <Layers size={14} className="text-purple-400" />
              <select
                value={selectedCollection}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCollection(val);
                  if (val === '★ Especiais') {
                    setOnlySpecials(true);
                  } else {
                    setOnlySpecials(false);
                  }
                }}
                className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer font-medium max-w-[170px] truncate"
              >
                <option value="Todas" className="bg-slate-900">
                  {albumEdition === 'legado' ? 'Todas do Álbum Legado' : albumEdition === 'moderno' ? 'Todas do Álbum Moderno' : 'Todas as Coleções'}
                </option>
                {specialCardsCount > 0 && (
                  <optgroup label="Especiais do Álbum" className="bg-slate-900 text-amber-400 font-bold">
                    <option value="★ Especiais" className="bg-slate-900 text-amber-400">
                      ★ Todas as Especiais ({specialCardsCount})
                    </option>
                    <option value="★ Limitadas" className="bg-slate-900 text-amber-300">
                      ★ Limitadas ({albumPoolCards.filter(c => (c.rarity || '').toLowerCase().includes('limitad')).length})
                    </option>
                    <option value="★ Raras" className="bg-slate-900 text-amber-300">
                      ★ Raras ({albumPoolCards.filter(c => (c.rarity || '').toLowerCase().includes('rara')).length})
                    </option>
                    <option value="★ Eventos" className="bg-slate-900 text-amber-300">
                      ★ Eventos ({albumPoolCards.filter(c => (c.rarity || '').toLowerCase().includes('evento')).length})
                    </option>
                  </optgroup>
                )}
                <optgroup label="Coleções do Álbum" className="bg-slate-900 text-purple-300">
                  {availableCollections.map(col => (
                    <option key={col} value={col} className="bg-slate-900 text-slate-200">{col}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* BOTAO PARA ABRIR CARTAS QUE PROCURO */}
            {onOpenWishlist && (
              <button
                onClick={() => {
                  onOpenWishlist();
                }}
                className="px-3 py-1.5 rounded-xl bg-pink-950/70 hover:bg-pink-900 border border-pink-700/60 text-pink-200 text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                title="Abrir minha lista de Cartas que Procuro"
              >
                <Heart size={14} className="fill-pink-400 text-pink-400" />
                <span>Cartas que Procuro</span>
              </button>
            )}
          </div>
        </div>

        {/* BARRA HORIZONTAL DE COLEÇÕES E ESPECIAIS (ACESSO RÁPIDO) */}
        <div className="px-4 py-2 bg-slate-950 border-b border-slate-800/70 flex items-center gap-1.5 overflow-x-auto scrollbar-thin shrink-0">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Layers size={11} className="text-purple-400" /> Coleções:
          </span>
          <button
            onClick={() => { setSelectedCollection('Todas'); setOnlySpecials(false); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 ${
              selectedCollection === 'Todas' && !onlySpecials
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Todas ({albumPoolCards.length})
          </button>

          {specialCardsCount > 0 && (
            <button
              onClick={() => { setSelectedCollection('★ Especiais'); setOnlySpecials(true); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition whitespace-nowrap shrink-0 flex items-center gap-1 border ${
                selectedCollection === '★ Especiais' || onlySpecials
                  ? 'bg-gradient-to-r from-amber-600 to-purple-600 text-white border-amber-300 shadow-md shadow-amber-950/40'
                  : 'bg-slate-900 text-amber-300 border-amber-600/40 hover:bg-slate-800'
              }`}
            >
              <Crown size={12} className="fill-amber-300" />
              <span>★ Especiais ({specialCardsCount})</span>
            </button>
          )}

          {availableCollections.map(col => {
            const count = albumPoolCards.filter(c => c.collection === col).length;
            const isSelected = selectedCollection === col && !onlySpecials;
            return (
              <button
                key={col}
                onClick={() => { setSelectedCollection(col); setOnlySpecials(false); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {col} <span className="opacity-60 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div> {/* Fim de INTERFACE DESKTOP */}

        {/* LISTA / GRID DE CARTAS */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-6 bg-[#070a12]">
          {/* BANNER DE INSERÇÃO RÁPIDA QUANDO UMA COLEÇÃO ESPECÍFICA ESTÁ SELECIONADA */}
          {currentCollectionData && (
            <div className="mb-3 sm:mb-4 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-950 border border-purple-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-900/60 border border-purple-500/50 flex items-center justify-center text-purple-300 shrink-0">
                  <PackagePlus size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      Coleção: {currentCollectionData.name}
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-purple-300 font-semibold border border-purple-700/40">
                      {currentCollectionData.ownedCount}/{currentCollectionData.totalCards} ({currentCollectionData.percent}%)
                    </span>
                    {currentCollectionData.ownedCount >= currentCollectionData.totalCards && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-semibold border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Completa
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
                    {currentCollectionData.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleAddCollection(currentCollectionData.name, 'add')}
                  disabled={bulkLoadingName === currentCollectionData.name}
                  className="flex-1 sm:flex-initial px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-950/40 active:scale-95 disabled:opacity-50"
                  title="Adicionar 1 cópia de cada carta desta coleção ao seu álbum"
                >
                  {bulkLoadingName === currentCollectionData.name ? (
                    <RefreshCw size={13} className="animate-spin text-white" />
                  ) : (
                    <Plus size={13} />
                  )}
                  <span>+1 Todas</span>
                </button>

                <button
                  onClick={() => handleAddCollection(currentCollectionData.name, 'ensure_at_least')}
                  disabled={bulkLoadingName === currentCollectionData.name}
                  className="flex-1 sm:flex-initial px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-indigo-950/40 active:scale-95 disabled:opacity-50"
                  title="Preencher as cartas faltantes desta coleção"
                >
                  <CheckCircle2 size={13} />
                  <span>Completar</span>
                </button>
              </div>
            </div>
          )}

          {/* BANNER PROMINENTE PARA INSERIR COLEÇÕES COMPLETAS QUANDO EM TODAS (APENAS DESKTOP) */}
          {!currentCollectionData && (
            <div className="hidden sm:flex mb-4 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-slate-950 border border-purple-500/30 flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <PackagePlus size={20} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    Possui Decks Estruturais ou Coleções Físicas?
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Insira todas as cartas de um deck inteiro (Corruptor Profano, O Escolhido, Deusa da Lua, etc.) de uma vez só no seu álbum!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowBulkModal(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-950/40 active:scale-95"
              >
                <PackagePlus size={15} />
                <span>Inserir Coleções & Decks Completos</span>
              </button>
            </div>
          )}

          {filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-slate-400 text-base mb-2">Nenhuma carta encontrada com os filtros selecionados.</p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCollection('Todas');
                  setOnlySpecials(false);
                  setFilterMode('all');
                }}
                className="text-xs text-purple-400 hover:underline font-bold"
              >
                Redefinir Filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredCards.map((card, cardIdx) => {
                const qty = getQuantity(card);
                const isOwned = qty > 0;
                const cardSpecial = isSpecialCard(card);
                const cardFoils = getCardFoils(card);
                const hasAnyFoil = cardFoils.length > 0;
                const isWanted = isCardWanted(card);
                const cardKey = normalizeAlbumKey(card) || `card_${card.id || cardIdx}`;

                return (
                  <div
                    key={`${cardKey}_${card.imageUrl || cardIdx}`}
                    className={`relative rounded-xl transition-all duration-200 group flex flex-col items-center p-2 border ${
                      hasAnyFoil
                        ? 'bg-slate-900/95 border-pink-500/80 shadow-lg shadow-pink-950/40 foil-card-rainbow'
                        : cardSpecial
                        ? isOwned
                          ? 'bg-slate-900/95 border-amber-500/70 shadow-lg shadow-amber-950/30'
                          : 'bg-slate-950/70 border-amber-600/40 opacity-80 hover:opacity-100'
                        : isOwned 
                        ? 'bg-slate-900/90 border-purple-500/50 shadow-md shadow-purple-950/30' 
                        : 'bg-slate-950/60 border-slate-800/80 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {/* BOTOES DE TOPO (QUANTIDADE, ESPECIAL E WISHLIST) */}
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                      {/* Botão de Lista de Desejos (Cartas que Procuro) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!user) {
                            if (onOpenAuth) onOpenAuth();
                            return;
                          }
                          if (isWanted) {
                            removeWantedCard(card);
                          } else {
                            addWantedCard(card, 'qualquer', '', 1, 'media');
                          }
                        }}
                        className={`p-1 rounded-full transition shadow-md ${
                          isWanted
                            ? 'bg-pink-600 text-white border border-pink-400'
                            : 'bg-slate-950/80 text-slate-400 hover:text-pink-400 hover:bg-slate-900 border border-slate-800'
                        }`}
                        title={isWanted ? 'Remover das Cartas que Procuro' : 'Adicionar às Cartas que Procuro'}
                      >
                        <Heart size={11} className={isWanted ? 'fill-white' : ''} />
                      </button>

                      {/* Quantidade */}
                      {isOwned ? (
                        <div className="bg-emerald-600 text-white font-black text-xs px-2 py-0.5 rounded-full shadow-lg border border-emerald-400 font-mono flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          <span>x{qty}</span>
                        </div>
                      ) : (
                        <div className="bg-slate-800/90 text-slate-400 font-bold text-[10px] px-2 py-0.5 rounded-full border border-slate-700">
                          Falta
                        </div>
                      )}
                    </div>

                    {/* BADGE SE DISPONÍVEL NO MERCADO */}
                    {isCardAvailableInMarket(card) && (!isOwned || isWanted) && (
                      <div className="absolute bottom-[106px] left-3 right-3 z-10 pointer-events-none flex justify-center">
                        <div className="bg-emerald-950/95 border border-emerald-400/70 text-emerald-200 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                          <ShoppingCart size={9} className="text-emerald-400" />
                          <span>À Venda no Mercado!</span>
                        </div>
                      </div>
                    )}

                    {/* BADGE DE CARTA ESPECIAL (LIMITADA, EVENTO, RARA) */}
                    {cardSpecial && (
                      <div className="absolute top-3 left-3 z-10">
                        <div className={`text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg border flex items-center gap-1 ${
                          (card.rarity || '').toLowerCase().includes('limitad') 
                            ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-amber-950/70'
                            : (card.rarity || '').toLowerCase() === 'evento'
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white border-pink-300 shadow-pink-950/70'
                            : (card.rarity || '').toLowerCase().includes('rara')
                            ? 'bg-indigo-600 text-white border-indigo-300 shadow-indigo-950/70'
                            : 'bg-cyan-600 text-white border-cyan-300 shadow-cyan-950/70'
                        }`}>
                          <Star size={10} className="fill-current" />
                          <span>{card.rarity || 'Especial'}</span>
                        </div>
                      </div>
                    )}

                    {/* MINIATURA DA CARTA */}
                    <div 
                      className={`w-full aspect-[2.5/3.5] rounded-lg overflow-hidden bg-slate-950 relative flex items-center justify-center cursor-pointer transition-transform ${
                        !isOwned ? 'grayscale-[50%] group-hover:grayscale-0' : ''
                      }`}
                      onClick={() => onSelectCard && onSelectCard(card)}
                    >
                      {card.imageUrl ? (
                        <img 
                          src={card.imageUrl} 
                          alt={card.name} 
                          className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                          loading="lazy" 
                        />
                      ) : (
                        <div className="p-3 text-center">
                          <span className="text-xs font-bold text-slate-300 block mb-1">{card.name}</span>
                          <span className="text-[10px] text-purple-400 font-mono">{card.code}</span>
                        </div>
                      )}
                    </div>

                    {/* INFORMAÇÕES DA CARTA */}
                    <div className="w-full mt-2 text-left">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-bold text-slate-200 group-hover:text-purple-300 transition" title={card.name}>
                          {card.name}
                        </span>
                        {card.isVariation && card.variationType && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-700/50 shrink-0 font-bold max-w-[85px] truncate" title={card.variationType}>
                            {card.variationType}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5 font-mono">
                        <span>{card.code}</span>
                        <span className="text-purple-400 truncate max-w-[85px]" title={card.collection}>{card.collection}</span>
                      </div>

                      {/* BADGE DE DONO OFICIAL DE TIRAGEM LIMITADA */}
                      {hasAssignedRarePrintOwners(card) && (
                        <div className="mt-1 px-2 py-0.5 rounded-md bg-amber-950/90 border border-amber-500/60 text-amber-200 text-[10px] font-black flex items-center gap-1 truncate" title={`Dono Oficial: ${getCardRarePrintOwners(card).map(o => o.displayName).join(', ')}`}>
                          <Crown size={10} className="text-amber-400 fill-amber-400 shrink-0" />
                          <span className="truncate">
                            Dono: {getCardRarePrintOwners(card).map(o => o.displayName).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* BOTÃO DO ADMIN PARA DEFINIR TIRAGEM LIMITADA & DONO OFICIAL */}
                    {isUserAdmin(user) && (
                      <div className="w-full mt-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOwnerSearchTerm('');
                            setCardForRareOwnerModal(card);
                          }}
                          className={`w-full py-1 px-1.5 rounded-lg text-[10px] font-black transition flex items-center justify-center gap-1 border ${
                            isCardRarePrint(card)
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/70 text-amber-300'
                              : 'bg-slate-900/90 hover:bg-amber-950/50 border-slate-800 hover:border-amber-500/50 text-slate-400 hover:text-amber-300'
                          }`}
                          title="Definir Tiragem Limitada e escolher o Dono da Carta no banco de cadastros"
                        >
                          <Crown size={10} className={isCardRarePrint(card) ? 'text-amber-400 fill-amber-400' : 'text-amber-400'} />
                          <span className="truncate">
                            {hasAssignedRarePrintOwners(card)
                              ? `Dono: ${getCardRarePrintOwners(card)[0].displayName}`
                              : isCardRarePrint(card)
                              ? `Tiragem (${card.maxPrintCopies || 1}) • Definir Dono`
                              : 'Tiragem Limitada / Dono'}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* SELETOR E STATUS DE FOIL */}
                    <div className="w-full mt-1.5 pt-1.5 border-t border-slate-800/70">
                      {hasAnyFoil ? (
                        <button
                          type="button"
                          onClick={() => setCardForFoilModal(card)}
                          className="w-full py-1 px-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-between bg-gradient-to-r from-pink-950/80 via-purple-950/80 to-amber-950/80 border border-purple-500/70 text-purple-100 hover:border-pink-400 shadow-sm"
                          title="Clique para ver ou alterar os acabamentos Foil desta carta"
                        >
                          <span className="flex items-center gap-1 truncate">
                            <Sparkles size={11} className="text-yellow-400 animate-pulse shrink-0" />
                            <span className="truncate">
                              {cardFoils.map(f => FOIL_TYPES.find(ft => ft.id === f)?.shortName || f).join(', ')}
                            </span>
                          </span>
                          <span className="text-[9px] px-1 py-0.2 bg-black/50 text-amber-300 rounded font-mono shrink-0 ml-1">
                            {cardFoils.length} {cardFoils.length === 1 ? 'foil' : 'foils'}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCardForFoilModal(card)}
                          className="w-full py-1 px-1.5 rounded-lg text-[10px] font-semibold transition flex items-center justify-center gap-1 bg-slate-900/80 hover:bg-purple-950/70 border border-slate-800 hover:border-purple-600/60 text-slate-400 hover:text-purple-300"
                          title="Marcar acabamentos Foil (Arco-íris, Estilhaço, Ouro, etc.)"
                        >
                          <Sparkles size={11} className="text-slate-500" />
                          <span>+ Tipo Foil</span>
                        </button>
                      )}
                    </div>

                    {/* CONTROLES DE QUANTIDADE (+ / -) */}
                    <div className="w-full mt-1.5 pt-1.5 border-t border-slate-800/70 flex items-center justify-between gap-1">
                      {hasAssignedRarePrintOwners(card) && !isUserOfficialRarePrintOwner(card, user?.uid) && !isUserAdmin(user) ? (
                        <div className="w-full py-1.5 px-2 rounded-lg bg-amber-950/50 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center justify-center gap-1 truncate">
                          <Crown size={11} className="fill-current shrink-0" />
                          <span className="truncate">Exclusiva do Dono</span>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => decrementCard(card)}
                            disabled={qty <= 0}
                            className={`flex-1 py-2 sm:py-1 min-h-[36px] sm:min-h-0 rounded-lg flex items-center justify-center transition text-xs font-bold active:scale-95 ${
                              qty > 0 
                                ? 'bg-slate-800 hover:bg-red-950/80 hover:text-red-400 text-slate-300 border border-slate-700/60' 
                                : 'bg-slate-900/40 text-slate-600 cursor-not-allowed border border-transparent'
                            }`}
                            title="Diminuir quantidade"
                          >
                            <Minus size={14} />
                          </button>

                          <span className="px-2 font-mono font-bold text-xs text-slate-200">
                            {qty}
                          </span>

                          <button
                            onClick={() => {
                              if (!user) {
                                if (onOpenAuth) onOpenAuth();
                                return;
                              }
                              if (isCardRarePrint(card) && !isUserAdmin(user)) {
                                setRareVerificationCard(card);
                                return;
                              }
                              incrementCard(card);
                            }}
                            className={`flex-1 py-2 sm:py-1 min-h-[36px] sm:min-h-0 rounded-lg flex items-center justify-center transition text-xs font-bold active:scale-95 ${
                              isCardRarePrint(card) && !isUserAdmin(user)
                                ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-black'
                                : 'bg-purple-950/70 hover:bg-purple-800 text-purple-200 border border-purple-700/50'
                            }`}
                            title={isCardRarePrint(card) && !isUserAdmin(user) ? 'Solicitar verificação de posse' : 'Aumentar quantidade'}
                          >
                            <Plus size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER (APENAS DESKTOP) */}
        <div className="hidden sm:flex p-3 sm:p-4 bg-slate-950 border-t border-slate-800/80 flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" />
            <span>
              {albumEdition === 'legado' 
                ? 'Exibindo Álbum Legado com coleções clássicas e edições especiais.' 
                : albumEdition === 'moderno' 
                ? 'Exibindo Álbum Moderno com a era Invasão do Caos.' 
                : 'Exibindo Coleção Completa.'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
          >
            Fechar Álbum
          </button>
        </div>

        {/* DRAWER / MODAL MOBILE: FILTROS & ESTATÍSTICAS */}
        {(showMobileFilters || showMobileStats) && (
          <div className="sm:hidden fixed inset-0 z-[120] flex flex-col justify-end bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
            <div 
              className="absolute inset-0" 
              onClick={() => { setShowMobileFilters(false); setShowMobileStats(false); }}
            />
            <div className="relative z-10 bg-[#0d1222] border-t border-purple-500/40 rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200">
              {/* Handle */}
              <div className="w-12 h-1.5 rounded-full bg-slate-700 mx-auto mt-3 mb-1" />

              {/* Header do Drawer */}
              <div className="px-4 py-2.5 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-600/20 text-purple-400">
                    {showMobileStats ? <BarChart2 size={16} /> : <SlidersHorizontal size={16} />}
                  </div>
                  <h3 className="font-bold text-white text-base">
                    {showMobileStats ? 'Estatísticas do Álbum' : 'Filtros & Opções'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowMobileFilters(false); setShowMobileStats(false); }}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Conteúdo rolável */}
              <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
                {/* Estatísticas Detalhadas */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase text-slate-400">
                      {albumEdition === 'legado' ? 'Progresso Álbum Legado' : albumEdition === 'moderno' ? 'Progresso Álbum Moderno' : 'Progresso Total'}
                    </span>
                    <span className="text-base font-black text-purple-400 font-mono">{stats.percent}%</span>
                  </div>

                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/50">
                    <div 
                      className="bg-gradient-to-r from-purple-600 to-emerald-400 h-2 rounded-full transition-all" 
                      style={{ width: `${stats.percent}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                      <span className="text-[9px] uppercase font-bold text-slate-500 block">Únicas</span>
                      <span className="text-xs font-black text-purple-300 font-mono">{stats.totalUniqueOwned}/{stats.totalCards}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                      <span className="text-[9px] uppercase font-bold text-slate-500 block">Cópias</span>
                      <span className="text-xs font-black text-emerald-400 font-mono">{stats.totalCopies}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                      <span className="text-[9px] uppercase font-bold text-slate-500 block">Faltam</span>
                      <span className="text-xs font-black text-amber-400 font-mono">{stats.totalCards - stats.totalUniqueOwned}</span>
                    </div>
                  </div>

                  {specialCardsCount > 0 && (
                    <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-600/30 flex items-center justify-between text-xs">
                      <span className="text-amber-300 font-bold flex items-center gap-1">
                        <Crown size={12} className="fill-amber-400 text-amber-400" />
                        Cartas Especiais:
                      </span>
                      <span className="font-mono font-black text-amber-300">
                        {albumPoolCards.filter(c => isSpecialCard(c) && getQuantity(c) > 0).length}/{specialCardsCount} no álbum
                      </span>
                    </div>
                  )}
                </div>

                {/* Filtro de Coleção */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                    <Layers size={13} className="text-purple-400" />
                    Filtrar por Coleção ou Deck:
                  </label>
                  <select
                    value={selectedCollection}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedCollection(val);
                      if (val === '★ Especiais') setOnlySpecials(true);
                      else setOnlySpecials(false);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-medium outline-none focus:border-purple-500"
                  >
                    <option value="Todas">
                      {albumEdition === 'legado' ? 'Todas do Álbum Legado' : albumEdition === 'moderno' ? 'Todas do Álbum Moderno' : 'Todas as Coleções'} ({albumPoolCards.length})
                    </option>
                    {specialCardsCount > 0 && (
                      <optgroup label="Especiais do Álbum" className="text-amber-400 font-bold">
                        <option value="★ Especiais">★ Todas as Especiais ({specialCardsCount})</option>
                        <option value="★ Limitadas">★ Limitadas ({albumPoolCards.filter(c => (c.rarity || '').toLowerCase().includes('limitad')).length})</option>
                        <option value="★ Raras">★ Raras ({albumPoolCards.filter(c => (c.rarity || '').toLowerCase().includes('rara')).length})</option>
                        <option value="★ Eventos">★ Eventos ({albumPoolCards.filter(c => (c.rarity || '').toLowerCase().includes('evento')).length})</option>
                      </optgroup>
                    )}
                    <optgroup label="Coleções & Decks" className="text-purple-300">
                      {availableCollections.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Filtro de Foil */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-yellow-400" />
                    Filtrar por Acabamento Foil:
                  </label>
                  <select
                    value={selectedFoilFilter}
                    onChange={(e) => setSelectedFoilFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white font-medium outline-none focus:border-purple-500"
                  >
                    <option value="all">Todos os Acabamentos</option>
                    <option value="any_foil">✨ Apenas Cartas Foil</option>
                    <optgroup label="11 Tipos de Foil">
                      {FOIL_TYPES.map(foil => (
                        <option key={foil.id} value={foil.id}>Foil {foil.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Ações Rápidas */}
                <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2">
                  {onOpenWishlist && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileFilters(false);
                        setShowMobileStats(false);
                        onClose();
                        onOpenWishlist();
                      }}
                      className="p-2.5 rounded-xl bg-pink-950/60 hover:bg-pink-900/60 border border-pink-700/50 text-pink-300 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Heart size={14} className="fill-pink-400 text-pink-400" />
                      <span>Cartas que Procuro</span>
                    </button>
                  )}

                  {onOpenRanking && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileFilters(false);
                        setShowMobileStats(false);
                        onOpenRanking();
                      }}
                      className="p-2.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-600/50 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <Trophy size={14} className="text-amber-400" />
                      <span>Hall da Fama</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileFilters(false);
                      setShowMobileStats(false);
                      setShowBulkModal(true);
                    }}
                    className="col-span-2 p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-emerald-950/40"
                  >
                    <PackagePlus size={15} />
                    <span>Inserir Decks / Coleções em Lote</span>
                  </button>
                </div>
              </div>

              {/* Rodapé do Drawer */}
              <div className="p-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCollection('Todas');
                    setSelectedFoilFilter('all');
                    setOnlySpecials(false);
                    setSearchTerm('');
                    setFilterMode('all');
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Limpar Filtros
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMobileFilters(false); setShowMobileStats(false); }}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-lg shadow-purple-900/40 active:scale-95"
                >
                  Ver {filteredCards.length} Cartas
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TOAST FLUTUANTE DE SUCESSO */}
        {toastMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl bg-emerald-600/95 text-white font-bold text-xs sm:text-sm shadow-2xl flex items-center gap-2.5 border border-emerald-400 backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-200">
            <CheckCircle2 size={18} className="text-white shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

      </div>

      {/* MODAL DE INSERÇÃO DE PRODUTOS, COLEÇÕES & DECKS COMPLETOS */}
      {showBulkModal && (
        <div className="fixed inset-0 z-[160] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div 
            className="bg-[#0b0f19] border border-purple-500/40 w-full max-w-4xl max-h-[90vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
            onClick={e => e.stopPropagation()}
          >
            {/* HEADER DO MODAL */}
            <div className="p-4 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-purple-950/40 to-slate-950 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-950/60 shrink-0">
                  <PackagePlus size={24} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                    Adicionar Produtos, Coleções & Decks
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                    Adicione produtos completos (ex: Pacote Macroversal em Foil 3D ou Coleção Reforço Macroversal), Decks ou Boosters de uma só vez!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* BARRA DE CONFIGURAÇÕES (MODO + ABAS) */}
            <div className="p-3 sm:p-4 bg-slate-900/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Ação:</span>
                <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setBulkMode('add')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 text-xs ${
                      bulkMode === 'add'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Plus size={13} />
                    <span>+1 Cópia de Cada Carta</span>
                  </button>
                  <button
                    onClick={() => setBulkMode('ensure_at_least')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 text-xs ${
                      bulkMode === 'ensure_at_least'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <CheckCircle2 size={13} />
                    <span>Completar Faltantes (ao menos 1)</span>
                  </button>
                </div>
              </div>

              {/* ABAS */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1 flex-wrap">
                <button
                  onClick={() => setBulkTab('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition text-xs ${
                    bulkTab === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tudo
                </button>
                <button
                  onClick={() => setBulkTab('products')}
                  className={`px-3 py-1 rounded-lg font-bold transition text-xs flex items-center gap-1 ${
                    bulkTab === 'products'
                      ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 shadow-sm'
                      : 'text-emerald-400 hover:text-emerald-200'
                  }`}
                >
                  <PackagePlus size={12} />
                  <span>Produtos ({productsSummary.length})</span>
                </button>
                <button
                  onClick={() => setBulkTab('deck')}
                  className={`px-3 py-1 rounded-lg font-bold transition text-xs flex items-center gap-1 ${
                    bulkTab === 'deck' ? 'bg-amber-950/80 text-amber-300 border border-amber-600/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Shield size={12} />
                  <span>Decks ({collectionsSummary.filter(c => c.category === 'deck').length})</span>
                </button>
                <button
                  onClick={() => setBulkTab('booster')}
                  className={`px-3 py-1 rounded-lg font-bold transition text-xs flex items-center gap-1 ${
                    bulkTab === 'booster' ? 'bg-purple-950/80 text-purple-300 border border-purple-600/40' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles size={12} />
                  <span>Boosters ({collectionsSummary.filter(c => c.category === 'booster').length})</span>
                </button>
              </div>
            </div>

            {/* LISTA DE PRODUTOS E COLEÇÕES */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#08080c] space-y-4 custom-scrollbar">
              {/* SEÇÃO DE PRODUTOS OFICIAIS (Pacote Macroversal / Coleção Reforço Macroversal) */}
              {(bulkTab === 'all' || bulkTab === 'products') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                      <PackagePlus size={15} />
                      Produtos Oficiais (Adição Completa em 1 Clique)
                    </h4>
                  </div>

                  {productsSummary.map(prod => {
                    const isLoading = bulkLoadingName === prod.id;
                    const isComplete = prod.totalCards > 0 && prod.ownedCount >= prod.totalCards;
                    const isFoilComplete = prod.foilId ? (prod.totalCards > 0 && prod.foilCount >= prod.totalCards) : true;

                    return (
                      <div
                        key={prod.id}
                        className={`p-4 rounded-2xl border-2 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                          isComplete && isFoilComplete
                            ? 'bg-gradient-to-r from-emerald-950/30 via-slate-900/80 to-slate-900/70 border-emerald-500/50 shadow-lg shadow-emerald-950/20'
                            : 'bg-gradient-to-r from-purple-950/35 via-slate-900/70 to-slate-900/50 border-purple-500/40 hover:border-emerald-500/50'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          <div className="w-14 h-20 sm:w-16 sm:h-22 rounded-xl bg-slate-950 overflow-hidden shrink-0 border-2 border-purple-500/50 shadow-lg flex items-center justify-center relative">
                            {prod.coverImage ? (
                              <img src={prod.coverImage} alt={prod.name} className="w-full h-full object-cover" />
                            ) : (
                              <PackagePlus size={24} className="text-emerald-400" />
                            )}
                            {prod.foilLabel && (
                              <span className="absolute bottom-0 inset-x-0 bg-emerald-600/95 text-[8px] font-black text-white text-center py-0.5 uppercase tracking-tighter">
                                {prod.foilLabel}
                              </span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-base sm:text-lg font-black text-white">
                                {prod.name}
                              </h4>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-emerald-950/90 text-emerald-300 border border-emerald-500/50">
                                {prod.badge}
                              </span>
                              {isComplete && isFoilComplete && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-600 text-white flex items-center gap-1">
                                  <CheckCircle2 size={11} /> No Álbum
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-300 mt-1">
                              {prod.subtitle} • <strong className="text-white">{prod.totalCards} cartas incluídas</strong>
                            </p>

                            {/* Lista resumida das coleções inclusas */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {prod.includedCollections.map(colName => (
                                <span
                                  key={colName}
                                  className="px-1.5 py-0.5 rounded bg-slate-950/90 border border-slate-800 text-[10px] text-slate-300 font-semibold"
                                >
                                  {colName}
                                </span>
                              ))}
                            </div>

                            {/* Progresso no Álbum */}
                            <div className="mt-2.5 space-y-1 max-w-md">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">Posse deste Produto:</span>
                                <span className="font-bold text-slate-200">
                                  {prod.ownedCount} de {prod.totalCards} cartas ({prod.percent}%)
                                  {prod.foilId ? ` • ${prod.foilCount} com ${prod.foilLabel}` : ''}
                                </span>
                              </div>
                              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                                <div
                                  className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400"
                                  style={{ width: `${prod.percent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Botões de Ação do Produto */}
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                          {prod.ownedCount > 0 && (
                            <button
                              onClick={() => handleRemoveProduct(prod.id)}
                              disabled={isLoading}
                              className="p-2.5 rounded-xl bg-slate-900 hover:bg-red-950/80 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-700/60 transition text-xs font-bold"
                              title="Zerar cartas deste produto no álbum"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}

                          <button
                            onClick={() => handleAddProduct(prod.id)}
                            disabled={isLoading}
                            className="flex-1 sm:flex-initial px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950/50 active:scale-95 disabled:opacity-50"
                          >
                            {isLoading ? (
                              <>
                                <RefreshCw size={15} className="animate-spin" />
                                <span>Adicionando Produto...</span>
                              </>
                            ) : (
                              <>
                                <PackagePlus size={16} />
                                <span>
                                  {prod.foilLabel
                                    ? `Adicionar Produto (${prod.foilLabel})`
                                    : 'Adicionar Produto Completo'}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SEÇÃO DE DECKS E BOOSTERS INDIVIDUAIS */}
              {bulkTab !== 'products' && (
                <div className="space-y-3">
                  {bulkTab === 'all' && (
                    <h4 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-2 pt-2">
                      <Layers size={15} />
                      Decks Estruturais & Boosters Individuais
                    </h4>
                  )}

                  {collectionsSummary
                    .filter(col => bulkTab === 'all' || col.category === bulkTab)
                    .map(col => {
                      const isLoading = bulkLoadingName === col.name;
                      const isComplete = col.ownedCount >= col.totalCards;

                      return (
                        <div
                          key={col.name}
                          className={`p-3.5 sm:p-4 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                            isComplete
                              ? 'bg-slate-900/70 border-emerald-500/40 shadow-sm'
                              : 'bg-slate-900/40 border-slate-800 hover:border-purple-500/40'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 flex-1 min-w-0">
                            <div className="w-12 h-16 sm:w-14 sm:h-20 rounded-xl bg-slate-950 overflow-hidden shrink-0 border border-slate-700/80 shadow-md flex items-center justify-center">
                              {col.coverImage ? (
                                <img src={col.coverImage} alt={col.name} className="w-full h-full object-cover" />
                              ) : (
                                <Layers size={22} className="text-purple-400" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm sm:text-base font-black text-white">
                                  {col.name}
                                </h4>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                                  col.category === 'deck' 
                                    ? 'bg-amber-950/80 text-amber-300 border border-amber-600/40' 
                                    : 'bg-purple-950/80 text-purple-300 border border-purple-600/40'
                                }`}>
                                  {col.category === 'deck' ? 'Deck Estrutural (30)' : 'Booster Pack'}
                                </span>
                                {isComplete && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                    <CheckCircle2 size={11} /> Completo
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {col.subtitle} • {col.totalCards} cartas registradas
                              </p>

                              {/* Progresso no Álbum */}
                              <div className="mt-2 space-y-1 max-w-md">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400">Posse no Álbum:</span>
                                  <span className="font-bold text-slate-200">
                                    {col.ownedCount} de {col.totalCards} únicas ({col.percent}%) • {col.totalCopies} cópias
                                  </span>
                                </div>
                                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      isComplete ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-purple-600 to-indigo-500'
                                    }`}
                                    style={{ width: `${col.percent}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Botões de Ação */}
                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                            {col.ownedCount > 0 && (
                              <button
                                onClick={() => handleRemoveCollection(col.name)}
                                disabled={isLoading}
                                className="p-2.5 rounded-xl bg-slate-900 hover:bg-red-950/80 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-700/60 transition text-xs font-bold"
                                title="Zerar cópias desta coleção no álbum"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}

                            <button
                              onClick={() => handleAddCollection(col.name)}
                              disabled={isLoading}
                              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950/40 active:scale-95 disabled:opacity-50"
                            >
                              {isLoading ? (
                                <>
                                  <RefreshCw size={15} className="animate-spin" />
                                  <span>Salvando...</span>
                                </>
                              ) : (
                                <>
                                  <Plus size={15} />
                                  <span>
                                    {bulkMode === 'add'
                                      ? `Inserir Coleção (+1 cada)`
                                      : `Completar Faltantes`}
                                  </span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* FOOTER DO MODAL */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Sincronizado automaticamente com a sua conta na nuvem.</span>
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE GERENCIAMENTO DE TIPOS FOIL DA CARTA */}
      {cardForFoilModal && (
        <div className="fixed inset-0 z-[170] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div 
            className="bg-[#0e111c] border border-purple-500/50 w-full max-w-2xl max-h-[90vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-purple-900/40 bg-gradient-to-r from-pink-950/60 via-purple-950/50 to-slate-950 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-pink-950/60 shrink-0">
                  <Sparkles size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    Acabamentos Foil da Carta
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {cardForFoilModal.name} <span className="font-mono text-purple-400">({cardForFoilModal.code})</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCardForFoilModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
              {/* Preview e Resumo */}
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-14 bg-slate-950 rounded-lg overflow-hidden shrink-0 border border-slate-700">
                    {cardForFoilModal.imageUrl ? (
                      <img src={cardForFoilModal.imageUrl} alt={cardForFoilModal.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px] font-bold">LDT</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white block truncate">{cardForFoilModal.name}</span>
                    <span className="text-xs text-slate-400 font-mono">
                      {cardForFoilModal.collection} • Posse: <strong className="text-emerald-400 font-bold">{getQuantity(cardForFoilModal)}x</strong>
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Foils Ativas:</span>
                  <span className="text-xs font-bold text-yellow-300 font-mono">
                    {getCardFoils(cardForFoilModal).length} de 11 tipos
                  </span>
                </div>
              </div>

              {/* Botões Rápidos */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-purple-400" />
                  Selecione os Tipos Foil que possui:
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        if (onOpenAuth) onOpenAuth();
                        return;
                      }
                      FOIL_TYPES.forEach(f => {
                        if (!hasFoil(cardForFoilModal, f.id)) {
                          toggleCardFoil(cardForFoilModal, f.id);
                        }
                      });
                    }}
                    className="text-[11px] text-purple-400 hover:text-purple-300 font-bold px-2 py-1 rounded bg-purple-950/50 hover:bg-purple-900 border border-purple-800/60 transition"
                  >
                    Marcar Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        if (onOpenAuth) onOpenAuth();
                        return;
                      }
                      FOIL_TYPES.forEach(f => {
                        if (hasFoil(cardForFoilModal, f.id)) {
                          toggleCardFoil(cardForFoilModal, f.id);
                        }
                      });
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-200 font-bold px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* Grid dos 11 Tipos de Foil */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {FOIL_TYPES.map((foil) => {
                  const isActive = hasFoil(cardForFoilModal, foil.id);

                  return (
                    <button
                      key={foil.id}
                      type="button"
                      onClick={() => {
                        if (!user) {
                          if (onOpenAuth) onOpenAuth();
                          return;
                        }
                        toggleCardFoil(cardForFoilModal, foil.id);
                      }}
                      className={`p-3 rounded-2xl border text-left transition duration-200 flex items-start justify-between gap-3 group ${
                        isActive
                          ? `${foil.badgeBg} border-2 ${foil.border} shadow-lg shadow-purple-950/50`
                          : 'bg-slate-900/60 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-black tracking-wide ${isActive ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                            Foil {foil.name}
                          </span>
                          <span className="text-[10px] text-purple-300 font-mono">
                            ({foil.id})
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">
                          {foil.description}
                        </p>
                      </div>

                      {/* Checkbox visual */}
                      <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition ${
                        isActive 
                          ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-md' 
                          : 'border border-slate-700 bg-slate-950/70 text-transparent'
                      }`}>
                        <Check size={13} className={isActive ? 'opacity-100' : 'opacity-0'} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span>As alterações de Foil são salvas automaticamente na nuvem.</span>
              <button
                type="button"
                onClick={() => setCardForFoilModal(null)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-md"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO ADMINISTRADOR: DEFINIR TIRAGEM LIMITADA & DONO DA CARTA (DIRETO NO ÁLBUM) */}
      {cardForRareOwnerModal && isUserAdmin(user) && (
        <div
          className="fixed inset-0 z-[185] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200"
          onClick={() => setCardForRareOwnerModal(null)}
        >
          <div
            className="bg-[#0e111c] border border-amber-500/60 w-full max-w-lg max-h-[90vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-amber-900/40 bg-gradient-to-r from-amber-950/70 via-slate-950 to-slate-950 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 shadow-lg shrink-0">
                  <Crown size={20} className="fill-current" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Tiragem Limitada & Dono Oficial
                  </h3>
                  <p className="text-xs text-amber-300/90 mt-0.5">
                    {cardForRareOwnerModal.name} <span className="font-mono text-slate-400">({cardForRareOwnerModal.code})</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCardForRareOwnerModal(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto custom-scrollbar space-y-4">
              {/* Resumo da Carta */}
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center gap-3">
                <div className="w-12 h-16 bg-slate-950 rounded-lg overflow-hidden shrink-0 border border-amber-500/40">
                  {cardForRareOwnerModal.imageUrl ? (
                    <img src={cardForRareOwnerModal.imageUrl} alt={cardForRareOwnerModal.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] font-bold">LDT</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-black text-white block truncate">{cardForRareOwnerModal.name}</span>
                  <span className="text-xs text-slate-400 block">
                    {cardForRareOwnerModal.variationType || cardForRareOwnerModal.frame || 'Moderno'} • {cardForRareOwnerModal.collection}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    {isCardRarePrint(cardForRareOwnerModal) ? (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500 text-slate-950 flex items-center gap-1">
                        <ShieldAlert size={11} />
                        Tiragem Limitada ({cardForRareOwnerModal.maxPrintCopies || 1} cópia(s))
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        Tiragem Comum
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Ativar / Quantidade de Cópias */}
              <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-black text-amber-300">
                    <input
                      type="checkbox"
                      checked={isCardRarePrint(cardForRareOwnerModal)}
                      disabled={isSavingOwner}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        handleSaveAlbumCardRareSettings(
                          cardForRareOwnerModal,
                          checked,
                          cardForRareOwnerModal.maxPrintCopies || 1,
                          checked ? getCardRarePrintOwners(cardForRareOwnerModal) : []
                        );
                      }}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                    <span>Ativar Tiragem Limitada / Rara nesta versão</span>
                  </label>

                  {isCardRarePrint(cardForRareOwnerModal) && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400 font-bold">Máx. Cópias:</span>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        disabled={isSavingOwner}
                        value={cardForRareOwnerModal.maxPrintCopies || 1}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          handleSaveAlbumCardRareSettings(
                            cardForRareOwnerModal,
                            true,
                            val,
                            getCardRarePrintOwners(cardForRareOwnerModal)
                          );
                        }}
                        className="w-16 bg-slate-950 border border-amber-500/50 rounded-lg p-1 text-center font-mono font-black text-xs text-amber-300 outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isSavingOwner}
                    onClick={() =>
                      handleSaveAlbumCardRareSettings(
                        cardForRareOwnerModal,
                        true,
                        1,
                        getCardRarePrintOwners(cardForRareOwnerModal).slice(0, 1)
                      )
                    }
                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-black transition border ${
                      isCardRarePrint(cardForRareOwnerModal) && (cardForRareOwnerModal.maxPrintCopies || 1) === 1
                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                        : 'bg-slate-950 text-amber-300 border-amber-500/30 hover:border-amber-400'
                    }`}
                  >
                    1/1 Tiragem Única
                  </button>
                  <button
                    type="button"
                    disabled={isSavingOwner}
                    onClick={() =>
                      handleSaveAlbumCardRareSettings(
                        cardForRareOwnerModal,
                        true,
                        5,
                        getCardRarePrintOwners(cardForRareOwnerModal)
                      )
                    }
                    className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition border ${
                      isCardRarePrint(cardForRareOwnerModal) && cardForRareOwnerModal.maxPrintCopies === 5
                        ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    5 Cópias
                  </button>
                  {isCardRarePrint(cardForRareOwnerModal) && (
                    <button
                      type="button"
                      disabled={isSavingOwner}
                      onClick={() => handleSaveAlbumCardRareSettings(cardForRareOwnerModal, false, 0, [])}
                      className="py-1.5 px-3 rounded-xl text-xs font-bold text-red-300 bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 transition"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>

              {/* Seleção do Dono Oficial no Banco de Cadastros */}
              <div className="p-3.5 bg-amber-950/20 border border-amber-500/40 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <UserCheck size={15} className="text-amber-400" />
                    Dono(s) Oficial(is) da Carta (Banco de Cadastros)
                  </span>
                  <span className="text-[11px] font-mono text-amber-300/80">
                    {getCardRarePrintOwners(cardForRareOwnerModal).length}/{cardForRareOwnerModal.maxPrintCopies || 1}
                  </span>
                </div>

                {/* Donos atualmente selecionados */}
                {getCardRarePrintOwners(cardForRareOwnerModal).length > 0 ? (
                  <div className="space-y-1.5">
                    {getCardRarePrintOwners(cardForRareOwnerModal).map(owner => (
                      <div
                        key={owner.userId}
                        className="flex items-center justify-between gap-2 bg-amber-950/60 border border-amber-500/50 rounded-xl px-3 py-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
                            <Crown size={14} className="fill-current" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-black text-white block truncate">{owner.displayName}</span>
                            {owner.email && (
                              <span className="text-[10px] text-amber-300/80 font-mono block truncate">{owner.email}</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isSavingOwner}
                          onClick={() => {
                            const remaining = getCardRarePrintOwners(cardForRareOwnerModal).filter(
                              o => o.userId !== owner.userId
                            );
                            handleSaveAlbumCardRareSettings(
                              cardForRareOwnerModal,
                              true,
                              cardForRareOwnerModal.maxPrintCopies || 1,
                              remaining
                            );
                          }}
                          className="p-1.5 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-300 hover:text-white transition shrink-0"
                          title="Remover este dono"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400">
                    Nenhum jogador selecionado como dono ainda. Escolha abaixo um usuário cadastrado no site:
                  </div>
                )}

                {/* Campo de Busca de Usuários Cadastrados */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 focus-within:border-amber-400">
                    <Search size={14} className="text-amber-400 shrink-0" />
                    <input
                      type="text"
                      value={ownerSearchTerm}
                      onChange={(e) => setOwnerSearchTerm(e.target.value)}
                      placeholder="Pesquisar usuário por nome ou e-mail..."
                      className="w-full bg-transparent text-xs text-white placeholder-slate-500 outline-none"
                    />
                    {ownerSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setOwnerSearchTerm('')}
                        className="text-slate-500 hover:text-white"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800/80 custom-scrollbar">
                    {registeredUsers
                      .filter(u => {
                        const q = ownerSearchTerm.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          u.displayName.toLowerCase().includes(q) ||
                          u.email.toLowerCase().includes(q)
                        );
                      })
                      .map(regUser => {
                        const currentOwners = getCardRarePrintOwners(cardForRareOwnerModal);
                        const isAlreadyOwner = currentOwners.some(o => o.userId === regUser.userId);
                        return (
                          <button
                            key={regUser.userId}
                            type="button"
                            disabled={isSavingOwner || isAlreadyOwner}
                            onClick={() => {
                              const maxCopies = cardForRareOwnerModal.maxPrintCopies || 1;
                              const newOwner: RarePrintOwner = {
                                userId: regUser.userId,
                                displayName: regUser.displayName,
                                email: regUser.email,
                                photoURL: regUser.photoURL,
                                copies: 1,
                                assignedAt: new Date().toISOString()
                              };
                              const nextOwners = maxCopies <= 1
                                ? [newOwner]
                                : [...currentOwners.slice(0, maxCopies - 1), newOwner];
                              handleSaveAlbumCardRareSettings(
                                cardForRareOwnerModal,
                                true,
                                maxCopies,
                                nextOwners
                              );
                            }}
                            className={`w-full px-3 py-2.5 text-left flex items-center justify-between gap-2 transition ${
                              isAlreadyOwner
                                ? 'bg-amber-950/30 text-amber-300/60 cursor-default'
                                : 'hover:bg-amber-500/20 text-slate-200 hover:text-white'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="text-xs font-bold block truncate">{regUser.displayName}</span>
                              {regUser.email && (
                                <span className="text-[10px] text-slate-400 font-mono block truncate">{regUser.email}</span>
                              )}
                            </div>
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-amber-500 text-slate-950 shrink-0">
                              {isAlreadyOwner ? 'Dono Atual' : 'Selecionar Dono'}
                            </span>
                          </button>
                        );
                      })}
                    {registeredUsers.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-500">
                        Nenhum usuário cadastrado encontrado.
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  ⚡ Ao selecionar o dono, a carta é <strong>creditada automaticamente no álbum dele</strong> e <strong>removida automaticamente do álbum de qualquer outro usuário</strong> que a tivesse marcada.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span>{isSavingOwner ? 'Sincronizando álbuns...' : 'Sincronização automática ativa'}</span>
              <button
                type="button"
                onClick={() => setCardForRareOwnerModal(null)}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Solicitação de Tiragem Rara */}
      <VerificationRequestModal
        isOpen={Boolean(rareVerificationCard)}
        onClose={() => setRareVerificationCard(null)}
        card={rareVerificationCard}
        user={user}
        onOpenAuth={onOpenAuth}
      />

    </div>
  );
};
