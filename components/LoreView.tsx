import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, readBrowserCache, writeBrowserCache } from '../firebase';
import {
  X, Clock, Grid, Feather, ChevronRight, ChevronUp, ChevronDown, Compass, Edit3, Plus, Trash2,
  ArrowUp, ArrowDown, Upload, Film, Image as ImageIcon, Type, Quote, Layers, Check, Loader2
} from 'lucide-react';
import { AdminPanel } from './AdminPanel';
import {
  CosmicLoreMap,
  CosmicNodeData,
  CosmicTerritoryData,
  DEFAULT_COSMIC_NODES,
  DEFAULT_COSMIC_TERRITORIES,
  LoreContentBlock
} from './CosmicLoreMap';
import { useCards, sanitizeForFirestore } from '../CardContext';
import { useAuth } from '../authService';
import { CardDetailModal } from './CardDetailModal';
import { CardData } from '../types';

export const LoreView = ({ onClose }: { onClose: () => void }) => {
  const { cards, archetypes } = useCards();
  const { isAdmin } = useAuth();

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [loading, setLoading] = useState(() => !readBrowserCache<any>('ld_cache_wbSettings_v2'));
  const [inspectedCard, setInspectedCard] = useState<CardData | null>(null);

  // Data hydrated from Browser Cache + Firebase
  const [wbSettings, setWbSettings] = useState<any>(() => readBrowserCache<any>('ld_cache_wbSettings_v2') || {
    mainTitle: 'ARCHIVUM',
    subtitle: 'Secretum · Archivum · Imperii',
    description: 'Um grande compêndio contendo universos esquecidos, personagens lendários e a cronologia dos mundos.',
    primaryColor: '#d4af37'
  });
  const [wbTabs, setWbTabs] = useState<any[]>(() => readBrowserCache<any[]>('ld_cache_wbTabs_v2') || []);
  const [wbItems, setWbItems] = useState<any[]>(() => readBrowserCache<any[]>('ld_cache_wbItems_v2') || []);
  const [wbTimelineEvents, setWbTimelineEvents] = useState<any[]>(() => readBrowserCache<any[]>('ld_cache_wbTimeline_v2') || []);
  const [cosmicNodes, setCosmicNodes] = useState<CosmicNodeData[]>(() => {
    const cached = readBrowserCache<CosmicNodeData[]>('ld_cache_wbCosmicNodes_v7');
    return cached && cached.length > 0 ? cached : DEFAULT_COSMIC_NODES;
  });
  const [cosmicTerritories, setCosmicTerritories] = useState<CosmicTerritoryData[]>(() => {
    const cached = readBrowserCache<CosmicTerritoryData[]>('ld_cache_wbTerritories_v3');
    return cached && cached.length > 0 ? cached : DEFAULT_COSMIC_TERRITORIES;
  });

  // Navigation State ('cosmic_map' is now available alongside 'home', 'tab_view', 'item_detail')
  const [currentView, setCurrentView] = useState<'home' | 'cosmic_map' | 'tab_view' | 'item_detail'>('home');
  const [isTopNavCollapsed, setIsTopNavCollapsed] = useState<boolean>(false);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // In-page Rich Editor state for standard Lore Items & Timeline
  const [isEditingItemDetail, setIsEditingItemDetail] = useState(false);
  const [editingItemDraft, setEditingItemDraft] = useState<any>(null);
  const [savingItemDetail, setSavingItemDetail] = useState(false);
  const [uploadingMediaSlot, setUploadingMediaSlot] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [isAdminOpen]);

  const LEGACY_NODE_IDS = new Set([
    'node_macroverso_13',
    'node_macroverso_1',
    'node_vazio_nada',
    'node_trono_conceitos',
    'node_santuario_paz',
    'node_abismo_asmonious',
    'node_universo_insanis',
    'node_poco_corrupcao',
    'node_bastiao_lordes_profanos',
    'node_altar_dragoes_poco',
    'node_conduite_caos_norte',
    'node_fenda_convergencia_caos'
  ]);

  const loadData = async () => {
    if (!readBrowserCache<any>('ld_cache_wbSettings_v2')) {
      setLoading(true);
    }
    try {
      const gSnap = await getDoc(doc(db, 'wbSettings', 'global'));
      if (gSnap.exists()) {
        const data = gSnap.data();
        setWbSettings(data);
        writeBrowserCache('ld_cache_wbSettings_v2', data);
      }

      const terrSnap = await getDoc(doc(db, 'wbSettings', 'cosmicTerritories'));
      if (terrSnap.exists() && Array.isArray(terrSnap.data()?.items)) {
        const loadedTerritories = terrSnap.data().items as CosmicTerritoryData[];
        const isPolarSectorGrid =
          loadedTerritories.length > 0 &&
          loadedTerritories.every(
            t => typeof t.innerRadius === 'number' && typeof t.startAngleDeg === 'number'
          );
        if (isPolarSectorGrid) {
          const hasNonNumericSectorNames = loadedTerritories.some(
            t => !/^Setor \d+$/i.test((t.name || '').trim())
          );
          const normalizedTerritories = hasNonNumericSectorNames
            ? loadedTerritories.map((t, idx) => ({
                ...t,
                name: `Setor ${idx + 1}`
              }))
            : loadedTerritories;
          setCosmicTerritories(normalizedTerritories);
          writeBrowserCache('ld_cache_wbTerritories_v3', normalizedTerritories);
          if (hasNonNumericSectorNames) {
            setDoc(doc(db, 'wbSettings', 'cosmicTerritories'), {
              items: sanitizeForFirestore(normalizedTerritories)
            }).catch(() => {});
          }
        } else {
          setCosmicTerritories(DEFAULT_COSMIC_TERRITORIES);
          writeBrowserCache('ld_cache_wbTerritories_v3', DEFAULT_COSMIC_TERRITORIES);
        }
      } else {
        setCosmicTerritories(DEFAULT_COSMIC_TERRITORIES);
        writeBrowserCache('ld_cache_wbTerritories_v3', DEFAULT_COSMIC_TERRITORIES);
      }

      const tabsSnap = await getDocs(collection(db, 'wbTabs'));
      const tbs = tabsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      tbs.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setWbTabs(tbs);
      writeBrowserCache('ld_cache_wbTabs_v2', tbs);

      const itemsSnap = await getDocs(collection(db, 'wbItems'));
      const itms = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      itms.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setWbItems(itms);
      writeBrowserCache('ld_cache_wbItems_v2', itms);

      const timeSnap = await getDocs(collection(db, 'wbTimelineEvents'));
      const times = timeSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      times.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setWbTimelineEvents(times);
      writeBrowserCache('ld_cache_wbTimeline_v2', times);

      const cosmicSnap = await getDocs(collection(db, 'wbCosmicNodes'));
      if (!cosmicSnap.empty) {
        const rawLoaded = cosmicSnap.docs.map(d => ({ id: d.id, ...d.data() })) as CosmicNodeData[];
        const hasV7Cosmology = rawLoaded.some(
          n => n.id === 'node_universo_principal' && n.cosmologyVersion === 7
        );

        if (!hasV7Cosmology) {
          const defaultMap = new Map(DEFAULT_COSMIC_NODES.map(n => [n.id, n]));
          const existingMap = new Map(rawLoaded.map(n => [n.id, n]));

          const updatedDefaultNodes = DEFAULT_COSMIC_NODES.map(defNode => {
            const prev = existingMap.get(defNode.id);
            return {
              ...defNode,
              linkedCardCodes: prev?.linkedCardCodes ?? defNode.linkedCardCodes,
              cardTrajectoryStep: prev?.cardTrajectoryStep ?? defNode.cardTrajectoryStep,
              timelineEvents: prev?.timelineEvents ?? [],
              cosmologyVersion: 7
            };
          });

          const customNodes = rawLoaded
            .filter(n => !defaultMap.has(n.id) && !LEGACY_NODE_IDS.has(n.id))
            .map(n => ({
              ...n,
              subtitle: '',
              summary: 'Lore será preenchida em breve',
              customStats: [],
              blocks: [],
              timelineEvents: n.timelineEvents || [],
              linkedArchetypes: [],
              linkedCollections: n.category === 'porta_corrupcao' ? [] : n.linkedCollections || [],
              cosmologyVersion: 7
            }));

          const mergedNodes = [...updatedDefaultNodes, ...customNodes];
          setCosmicNodes(mergedNodes);
          writeBrowserCache('ld_cache_wbCosmicNodes_v7', mergedNodes);

          for (const legacyId of Array.from(LEGACY_NODE_IDS)) {
            deleteDoc(doc(db, 'wbCosmicNodes', legacyId)).catch(() => {});
          }
          for (const nodeToSave of mergedNodes) {
            setDoc(doc(db, 'wbCosmicNodes', nodeToSave.id), sanitizeForFirestore(nodeToSave)).catch(
              () => {}
            );
          }
        } else {
          const cleanLoaded = rawLoaded.filter(n => !LEGACY_NODE_IDS.has(n.id));
          cleanLoaded.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
          setCosmicNodes(cleanLoaded);
          writeBrowserCache('ld_cache_wbCosmicNodes_v7', cleanLoaded);
        }
      } else {
        setCosmicNodes(DEFAULT_COSMIC_NODES);
        writeBrowserCache('ld_cache_wbCosmicNodes_v7', DEFAULT_COSMIC_NODES);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // Upload media helper for Firebase Storage
  const handleUploadMediaFile = async (file: File): Promise<string> => {
    const fileRef = ref(storage, `wb_images/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  };

  // Save or update a 3D Cosmic Node (and seed defaults if collection was empty)
  const handleSaveCosmicNode = async (node: CosmicNodeData) => {
    const cleanNode = sanitizeForFirestore({ ...node, cosmologyVersion: 7 });
    await setDoc(doc(db, 'wbCosmicNodes', node.id), cleanNode);

    const existingIds = new Set(cosmicNodes.map(n => n.id));
    let nextNodes: CosmicNodeData[];
    if (existingIds.has(node.id)) {
      nextNodes = cosmicNodes.map(n => (n.id === node.id ? cleanNode : n));
    } else {
      nextNodes = [...cosmicNodes, cleanNode];
    }

    for (const defNode of DEFAULT_COSMIC_NODES) {
      if (defNode.id !== node.id && !existingIds.has(defNode.id)) {
        await setDoc(doc(db, 'wbCosmicNodes', defNode.id), sanitizeForFirestore(defNode)).catch(() => {});
      }
    }

    setCosmicNodes(nextNodes);
    writeBrowserCache('ld_cache_wbCosmicNodes_v7', nextNodes);
  };

  const handleSaveTerritories = async (nextTerritories: CosmicTerritoryData[]) => {
    const cleanItems = sanitizeForFirestore(nextTerritories);
    await setDoc(doc(db, 'wbSettings', 'cosmicTerritories'), { items: cleanItems });
    setCosmicTerritories(cleanItems);
    writeBrowserCache('ld_cache_wbTerritories_v3', cleanItems);
  };

  const handleResetDefaultCosmology = async () => {
    for (const legacyId of Array.from(LEGACY_NODE_IDS)) {
      await deleteDoc(doc(db, 'wbCosmicNodes', legacyId)).catch(() => {});
    }
    for (const defNode of DEFAULT_COSMIC_NODES) {
      await setDoc(doc(db, 'wbCosmicNodes', defNode.id), sanitizeForFirestore(defNode)).catch(() => {});
    }
    await setDoc(doc(db, 'wbSettings', 'cosmicTerritories'), {
      items: sanitizeForFirestore(DEFAULT_COSMIC_TERRITORIES)
    }).catch(() => {});

    const defaultIds = new Set(DEFAULT_COSMIC_NODES.map(n => n.id));
    const customNodes = cosmicNodes.filter(n => !defaultIds.has(n.id) && !LEGACY_NODE_IDS.has(n.id));
    const nextNodes = [...DEFAULT_COSMIC_NODES, ...customNodes];
    setCosmicNodes(nextNodes);
    setCosmicTerritories(DEFAULT_COSMIC_TERRITORIES);
    writeBrowserCache('ld_cache_wbCosmicNodes_v7', nextNodes);
    writeBrowserCache('ld_cache_wbTerritories_v3', DEFAULT_COSMIC_TERRITORIES);
  };

  const handleDeleteCosmicNode = async (nodeId: string) => {
    await deleteDoc(doc(db, 'wbCosmicNodes', nodeId)).catch(() => {});
    const nextNodes = cosmicNodes.filter(n => n.id !== nodeId);
    setCosmicNodes(nextNodes);
    writeBrowserCache('ld_cache_wbCosmicNodes_v7', nextNodes);
  };

  // Reorder items in a tab directly with Up/Down arrows
  const handleMoveItemOrder = async (itemIndex: number, direction: -1 | 1) => {
    const list = [...currentTabItems];
    const targetIdx = itemIndex + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const itemA = list[itemIndex];
    const itemB = list[targetIdx];
    const orderA = itemIndex;
    const orderB = targetIdx;

    const updatedItems = wbItems.map(it => {
      if (it.id === itemA.id) return { ...it, orderIndex: orderB };
      if (it.id === itemB.id) return { ...it, orderIndex: orderA };
      return it;
    });
    updatedItems.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    setWbItems(updatedItems);
    writeBrowserCache('ld_cache_wbItems_v2', updatedItems);

    await updateDoc(doc(db, 'wbItems', itemA.id), { orderIndex: orderB }).catch(() => {});
    await updateDoc(doc(db, 'wbItems', itemB.id), { orderIndex: orderA }).catch(() => {});
  };

  // Reorder timeline events directly with Up/Down arrows
  const handleMoveTimelineOrder = async (evIndex: number, direction: -1 | 1) => {
    const list = [...currentTabEvents];
    const targetIdx = evIndex + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const evA = list[evIndex];
    const evB = list[targetIdx];

    const updatedEvents = wbTimelineEvents.map(ev => {
      if (ev.id === evA.id) return { ...ev, orderIndex: targetIdx };
      if (ev.id === evB.id) return { ...ev, orderIndex: evIndex };
      return ev;
    });
    updatedEvents.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    setWbTimelineEvents(updatedEvents);
    writeBrowserCache('ld_cache_wbTimeline_v2', updatedEvents);

    await updateDoc(doc(db, 'wbTimelineEvents', evA.id), { orderIndex: targetIdx }).catch(() => {});
    await updateDoc(doc(db, 'wbTimelineEvents', evB.id), { orderIndex: evIndex }).catch(() => {});
  };

  // Save rich blocks & media on an existing wbItem page
  const handleSaveRichItemDetail = async () => {
    if (!editingItemDraft || !editingItemDraft.id) return;
    setSavingItemDetail(true);
    try {
      const cleanDraft = sanitizeForFirestore(editingItemDraft);
      await setDoc(doc(db, 'wbItems', editingItemDraft.id), cleanDraft, { merge: true });
      const nextItems = wbItems.map(it => (it.id === editingItemDraft.id ? cleanDraft : it));
      setWbItems(nextItems);
      writeBrowserCache('ld_cache_wbItems_v2', nextItems);
      setSelectedItem(cleanDraft);
      setIsEditingItemDetail(false);
      setEditingItemDraft(null);
    } catch (e) {
      console.error(e);
    }
    setSavingItemDetail(false);
  };

  const navToTab = (tabId: string) => {
    setActiveTabId(tabId);
    setSelectedItem(null);
    setIsEditingItemDetail(false);
    setCurrentView('tab_view');
  };

  const primaryHex = wbSettings.primaryColor || '#d4af37';

  const styleVars = {
    '--primary-color': primaryHex,
    '--primary-rgb': hexToRgb(primaryHex),
  } as React.CSSProperties;

  function hexToRgb(hex: string) {
    let r = 212, g = 175, b = 55;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
      let c = hex.substring(1).split('');
      if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      const cNum = parseInt(c.join(''), 16);
      r = (cNum >> 16) & 255;
      g = (cNum >> 8) & 255;
      b = cNum & 255;
    }
    return `${r}, ${g}, ${b}`;
  }

  const getEmbedVideoUrl = (url?: string): { isIframe: boolean; src: string } => {
    if (!url) return { isIframe: false, src: '' };
    if (url.includes('youtube.com/watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      return { isIframe: true, src: `https://www.youtube.com/embed/${videoId}` };
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return { isIframe: true, src: `https://www.youtube.com/embed/${videoId}` };
    }
    if (url.includes('drive.google.com/file/d/')) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match?.[1]) {
        return { isIframe: true, src: `https://drive.google.com/file/d/${match[1]}/preview` };
      }
    }
    return { isIframe: false, src: url };
  };

  const currentTab = wbTabs.find(t => t.id === activeTabId);
  const currentTabItems = wbItems.filter(i => i.tabId === activeTabId);
  const currentTabEvents = wbTimelineEvents.filter(te => te.tabId === activeTabId);

  const TopNav = () => {
    if (currentView === 'cosmic_map' && isTopNavCollapsed) {
      return (
        <div className="fixed top-2 right-3 z-[100] flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsTopNavCollapsed(false)}
            className="bg-[#060608]/90 hover:bg-[#12121a] border border-[rgba(var(--primary-rgb),0.4)] text-[var(--primary-color)] px-3 py-1 rounded-lg text-[11px] font-cinzel font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xl transition"
            title="Expandir menu superior do Archivum"
          >
            <ChevronDown size={13} />
            <span>Menu {wbSettings.mainTitle || 'ARCHIVUM'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsTopNavCollapsed(false);
              setCurrentView('home');
            }}
            className="bg-[#060608]/90 hover:bg-[#12121a] border border-white/15 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-xl transition"
          >
            <X size={13} /> Voltar
          </button>
        </div>
      );
    }

    return (
      <nav className="fixed top-0 left-0 w-full h-14 z-[100] border-b border-[rgba(var(--primary-rgb),0.2)] bg-[#060608]/95 px-4 sm:px-6 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setCurrentView('home')}
            className="text-xl sm:text-2xl font-black tracking-widest font-cinzel mr-1 shrink-0 text-left"
            style={{ color: 'var(--primary-color)', textShadow: '0 0 10px rgba(var(--primary-rgb),0.4)' }}
          >
            {wbSettings.mainTitle || 'ARCHIVUM'}
          </button>
          <div className="flex items-center gap-4 text-[11px] tracking-[0.16em] uppercase text-[#a8a29e] font-bold">
            <button
              onClick={() => setCurrentView('home')}
              className={`hover:text-white transition whitespace-nowrap py-1 ${currentView === 'home' ? 'text-[var(--primary-color)] border-b border-[var(--primary-color)]' : ''}`}
            >
              Início
            </button>

            <button
              onClick={() => {
                setSelectedItem(null);
                setCurrentView('cosmic_map');
              }}
              className={`flex items-center gap-1.5 hover:text-white transition whitespace-nowrap px-2.5 py-1 rounded border ${
                currentView === 'cosmic_map'
                  ? 'bg-[rgba(var(--primary-rgb),0.18)] text-[var(--primary-color)] border-[var(--primary-color)]'
                  : 'border-[rgba(var(--primary-rgb),0.3)] text-[#d4af37]'
              }`}
            >
              <Compass size={13} /> Mapa 3D do Universo
            </button>

            {wbTabs.map(t => (
              <button
                key={t.id}
                onClick={() => navToTab(t.id)}
                className={`hover:text-white transition whitespace-nowrap py-1 ${activeTabId === t.id && (currentView === 'tab_view' || currentView === 'item_detail') ? 'text-[var(--primary-color)] border-b border-[var(--primary-color)]' : ''}`}
              >
                {t.name}
              </button>
            ))}

            <button
              onClick={() => setIsAdminOpen(true)}
              className="hover:text-purple-300 text-purple-400 transition whitespace-nowrap ml-1 border border-purple-900/60 px-2.5 py-1 rounded"
            >
              Área do Mestre
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {currentView === 'cosmic_map' && (
            <button
              type="button"
              onClick={() => setIsTopNavCollapsed(true)}
              className="text-slate-300 hover:text-white transition flex items-center gap-1 text-[11px] tracking-wider uppercase font-bold border border-white/15 px-2.5 py-1.5 rounded hover:bg-white/5"
              title="Recolher barra superior para ampliar o Mapa 3D"
            >
              <ChevronUp size={14} /> <span className="hidden sm:inline">Recolher Topo</span>
            </button>
          )}
          <button
            onClick={() => {
              if (currentView === 'item_detail') {
                setSelectedItem(null);
                setIsEditingItemDetail(false);
                setCurrentView('tab_view');
              } else if (currentView === 'tab_view' || currentView === 'cosmic_map') {
                setCurrentView('home');
              } else {
                onClose();
              }
            }}
            className="text-[#a8a29e] hover:text-white transition flex items-center gap-1.5 text-xs tracking-widest uppercase font-bold border border-[rgba(var(--primary-rgb),0.3)] px-3 py-1.5 hover:bg-[rgba(var(--primary-rgb),0.1)] shrink-0 rounded"
          >
            <X size={15} /> {currentView !== 'home' ? 'Voltar' : 'Fechar'}
          </button>
        </div>
      </nav>
    );
  };

  return (
    <div className="fixed inset-0 z-[90] bg-[#060608] text-slate-300 overflow-y-auto" style={styleVars}>
      <style dangerouslySetInnerHTML={{__html: `
        .font-cinzel { font-family: 'Cinzel', serif; }
        .font-playfair { font-family: 'Playfair Display', serif; }
        
        ::selection {
          background-color: rgba(var(--primary-rgb), 0.3);
          color: var(--primary-color);
        }
        
        .text-theme { color: var(--primary-color); }
        .bg-theme { background-color: var(--primary-color); }
        .border-theme { border-color: rgba(var(--primary-rgb), 0.4); }
        .drop-shadow-theme { filter: drop-shadow(0 0 15px rgba(var(--primary-rgb), 0.5)); }
        
        .gold-line {
          position: relative;
        }
        .gold-line::after {
          content: '';
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 50px;
          height: 1px;
          background: rgba(var(--primary-rgb), 0.5);
        }
      `}} />

      <TopNav />
      {isAdminOpen && <AdminPanel adminType="master" onClose={() => setIsAdminOpen(false)} />}
      {inspectedCard && (
        <CardDetailModal
          card={inspectedCard}
          onClose={() => setInspectedCard(null)}
        />
      )}

      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <Feather size={40} className="text-theme mb-4 opacity-50" />
            <p className="font-cinzel text-theme text-sm tracking-widest uppercase opacity-70">Desenterrando registros...</p>
          </div>
        </div>
      ) : (
        <div className={currentView === 'cosmic_map' ? (isTopNavCollapsed ? 'h-screen' : 'pt-14 h-screen') : 'pt-14 min-h-screen'}>
          {/* 3D INTERACTIVE MULTIVERSE / COSMOS MAP VIEW */}
          {currentView === 'cosmic_map' && (
            <CosmicLoreMap
              nodes={cosmicNodes}
              territories={cosmicTerritories}
              isAdmin={isAdmin}
              cards={cards}
              archetypes={archetypes}
              onSaveNode={handleSaveCosmicNode}
              onDeleteNode={handleDeleteCosmicNode}
              onSaveTerritories={handleSaveTerritories}
              onResetDefaultCosmology={handleResetDefaultCosmology}
              onUploadMedia={handleUploadMediaFile}
              onSelectCard={(card) => setInspectedCard(card)}
            />
          )}

          {/* HOME VIEW */}
          {currentView === 'home' && (
            <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 text-center relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none opacity-25" style={{ background: 'radial-gradient(ellipse at center, rgba(var(--primary-rgb),0.25), #060608, #060608)' }}></div>

              <p className="text-theme tracking-[0.3em] text-xs font-bold uppercase mb-4 opacity-80">{wbSettings.subtitle}</p>

              <h2 className="font-cinzel text-6xl sm:text-7xl md:text-9xl text-theme font-bold mb-8 drop-shadow-theme tracking-tight uppercase">
                {wbSettings.mainTitle}
              </h2>

              <div className="gold-line mb-10 w-full"></div>

              <p className="font-playfair text-xl md:text-2xl text-[#a8a29e] max-w-2xl mb-12 leading-relaxed whitespace-pre-wrap">
                {wbSettings.description}
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10">
                <button
                  onClick={() => setCurrentView('cosmic_map')}
                  className="font-cinzel border-2 border-theme bg-[rgba(var(--primary-rgb),0.2)] hover:bg-[rgba(var(--primary-rgb),0.35)] text-white px-8 py-4 tracking-widest uppercase text-sm font-bold transition duration-300 shadow-[0_0_25px_rgba(var(--primary-rgb),0.35)] flex items-center gap-3"
                >
                  <Compass size={18} className="text-theme" /> Explorar Mapa 3D do Universo
                </button>

                {wbTabs.length > 0 ? (
                  <button
                    onClick={() => navToTab(wbTabs[0].id)}
                    className="font-cinzel border border-theme/50 bg-[#0c0c12] hover:bg-[rgba(var(--primary-rgb),0.12)] text-theme px-8 py-4 tracking-widest uppercase text-sm font-bold transition duration-300"
                  >
                    Abrir Arquivos & Crônicas
                  </button>
                ) : (
                  <button
                    onClick={() => setIsAdminOpen(true)}
                    className="font-cinzel border border-purple-500 text-purple-400 px-8 py-4 tracking-widest uppercase text-sm font-bold transition hover:bg-purple-900/30"
                  >
                    Configurar Área do Mestre
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB VIEW (Grid and/or Timeline with Admin Direct Reordering) */}
          {currentView === 'tab_view' && currentTab && (
            <div className="animate-fade-in pb-32 pt-10 relative max-w-7xl mx-auto px-6">
              <div className="text-center mb-20 relative">
                <h2 className="font-cinzel text-5xl md:text-7xl font-black text-theme drop-shadow-theme uppercase tracking-wider">
                  {currentTab.name}
                </h2>
                <div className="gold-line mt-6 mx-auto w-10"></div>
              </div>

              <div className="flex flex-col gap-24">
                {/* ITEMS GRID */}
                {currentTab.hasItems && (
                  <div>
                    <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
                      <h3 className="font-cinzel text-3xl text-white uppercase tracking-widest flex items-center gap-4">
                        <Grid className="text-theme" size={28} /> Registros
                      </h3>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setIsAdminOpen(true)}
                          className="px-4 py-2 rounded border border-purple-500/50 bg-purple-950/50 hover:bg-purple-900/60 text-purple-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                        >
                          <Plus size={14} /> Gerenciar / Nova Página
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {currentTabItems.map((item, idx) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedItem(item);
                            setIsEditingItemDetail(false);
                            setCurrentView('item_detail');
                          }}
                          className="border border-[#333] hover:border-theme bg-[#0a0a0c] relative group cursor-pointer transition duration-500 overflow-hidden flex flex-col h-96 shadow-lg"
                        >
                          {/* Admin Reorder Controls */}
                          {isAdmin && (
                            <div
                              className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-black/85 border border-white/20 rounded-lg p-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveItemOrder(idx, -1)}
                                className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30"
                                title="Mover para trás na ordem"
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                disabled={idx === currentTabItems.length - 1}
                                onClick={() => handleMoveItemOrder(idx, 1)}
                                className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30"
                                title="Mover para frente na ordem"
                              >
                                <ArrowDown size={13} />
                              </button>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0a0a0c] z-10 opacity-90 group-hover:opacity-70 transition"></div>
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="absolute inset-0 w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition duration-700 ease-in-out scale-100 group-hover:scale-110" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03]">
                              <Feather size={100} className="text-white" />
                            </div>
                          )}

                          <div className="relative z-20 mt-auto p-6 transition-transform duration-500 transform translate-y-4 group-hover:translate-y-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent pt-12">
                            <h4 className="font-cinzel text-2xl text-theme mb-2 font-bold">{item.name}</h4>
                            <p className="font-playfair text-sm text-slate-400 line-clamp-2 italic mb-4 opacity-0 group-hover:opacity-100 transition duration-500 delay-100">
                              {item.description || 'Descrição ofuscada pelo tempo...'}
                            </p>
                            <div className="w-12 h-[2px] bg-theme opacity-50 group-hover:w-full transition-all duration-700"></div>
                          </div>
                        </div>
                      ))}

                      {currentTabItems.length === 0 && (
                        <div className="col-span-full border border-[#222] border-dashed p-12 text-center text-[#666] font-playfair italic text-lg">
                          Nenhum registro encontrado nesta aba.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TIMELINE */}
                {currentTab.hasTimeline && (
                  <div>
                    <h3 className="font-cinzel text-3xl text-white mb-16 uppercase tracking-widest flex items-center gap-4">
                      <Clock className="text-theme" size={28} /> Linha do Tempo
                    </h3>

                    <div className="relative max-w-4xl mx-auto">
                      <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-[2px] bg-theme opacity-20 transform md:-translate-x-1/2"></div>

                      {currentTabEvents.length === 0 && (
                        <div className="border border-[#222] border-dashed p-12 text-center text-[#666] font-playfair italic text-lg mt-8">
                          Nenhum evento registrado no tempo.
                        </div>
                      )}

                      <div className="space-y-16">
                        {currentTabEvents.map((ev, idx) => {
                          const isEven = idx % 2 === 0;
                          const embedVid = ev.videoUrl ? getEmbedVideoUrl(ev.videoUrl) : null;
                          return (
                            <div key={ev.id} className={`relative flex items-center flex-col md:flex-row ${isEven ? 'md:flex-row-reverse' : ''}`}>
                              <div className="absolute left-4 md:left-1/2 w-4 h-4 bg-[#0a0a0c] border-[3px] border-theme rounded-full transform -translate-x-[7px] md:-translate-x-1/2 z-10 shadow-[0_0_10px_rgba(var(--primary-rgb),0.8)]"></div>

                              <div className={`w-full md:w-1/2 pl-12 pr-4 md:px-12 ${isEven ? 'md:text-left' : 'md:text-right'}`}>
                                <div className={`flex items-center gap-2 mb-3 ${isEven ? 'md:justify-start' : 'md:justify-end'}`}>
                                  {ev.dateStr && (
                                    <div className="inline-block font-mono text-xs tracking-widest text-theme border border-theme/30 bg-theme/5 px-3 py-1">
                                      {ev.dateStr}
                                    </div>
                                  )}
                                  {isAdmin && (
                                    <div className="inline-flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5">
                                      <button
                                        type="button"
                                        disabled={idx === 0}
                                        onClick={() => handleMoveTimelineOrder(idx, -1)}
                                        className="text-slate-400 hover:text-white disabled:opacity-30 p-0.5"
                                        title="Subir Evento"
                                      >
                                        <ArrowUp size={12} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={idx === currentTabEvents.length - 1}
                                        onClick={() => handleMoveTimelineOrder(idx, 1)}
                                        className="text-slate-400 hover:text-white disabled:opacity-30 p-0.5"
                                        title="Descer Evento"
                                      >
                                        <ArrowDown size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <h4 className="font-cinzel text-2xl text-white font-bold mb-3 uppercase tracking-wider">{ev.title}</h4>
                                {ev.imageUrl && (
                                  <div className={`mb-4 rounded overflow-hidden border border-[#333] shadow-lg inline-block w-full max-w-sm ${isEven ? '' : 'ml-auto'}`}>
                                    <img src={ev.imageUrl} alt="" className="w-full h-48 object-cover filter brightness-75 contrast-125 hover:brightness-100 transition" />
                                  </div>
                                )}
                                {embedVid && embedVid.src && (
                                  <div className={`mb-4 rounded overflow-hidden border border-[#333] shadow-lg inline-block w-full max-w-sm aspect-video bg-black ${isEven ? '' : 'ml-auto'}`}>
                                    {embedVid.isIframe ? (
                                      <iframe src={embedVid.src} className="w-full h-full border-0" allow="autoplay; fullscreen" title={ev.title} />
                                    ) : (
                                      <video src={embedVid.src} controls className="w-full h-full object-contain" />
                                    )}
                                  </div>
                                )}
                                <p className="font-playfair text-[#cbd5e1] leading-relaxed whitespace-pre-wrap">{ev.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ITEM DETAIL VIEW WITH RICH MEDIA BLOCKS & IN-PAGE EDITOR */}
          {currentView === 'item_detail' && selectedItem && (
            <div className="animate-fade-in pb-24 pt-8 min-h-screen relative">
              <div className="max-w-5xl mx-auto px-6">
                <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
                  <button
                    onClick={() => {
                      setIsEditingItemDetail(false);
                      setCurrentView('tab_view');
                    }}
                    className="font-cinzel text-theme text-sm tracking-widest uppercase flex items-center gap-2 hover:text-white transition group"
                  >
                    <ChevronRight size={16} className="transform rotate-180 group-hover:-translate-x-1 transition" /> Retornar
                  </button>

                  {isAdmin && !isEditingItemDetail && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItemDraft({
                          ...selectedItem,
                          blocks: selectedItem.blocks ? [...selectedItem.blocks] : [],
                          customFields: selectedItem.customFields ? [...selectedItem.customFields] : []
                        });
                        setIsEditingItemDetail(true);
                      }}
                      className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg"
                    >
                      <Edit3 size={14} /> Editar Página, Anexar Fotos/Vídeos & Ordem
                    </button>
                  )}

                  {isAdmin && isEditingItemDetail && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={savingItemDetail}
                        onClick={handleSaveRichItemDetail}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                      >
                        {savingItemDetail ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        <span>Salvar Página</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingItemDetail(false);
                          setEditingItemDraft(null);
                        }}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {isEditingItemDetail && editingItemDraft ? (
                  <div className="bg-slate-900/95 border border-purple-500/40 rounded-2xl p-6 space-y-6">
                    <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
                      Editor Completo de Lore: {editingItemDraft.name}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Nome / Título Principal</label>
                        <input
                          type="text"
                          value={editingItemDraft.name || ''}
                          onChange={e => setEditingItemDraft({ ...editingItemDraft, name: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Imagem Principal (Retrato)</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingItemDraft.imageUrl || ''}
                            onChange={e => setEditingItemDraft({ ...editingItemDraft, imageUrl: e.target.value })}
                            placeholder="URL ou envie do PC..."
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
                          />
                          <label className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0">
                            {uploadingMediaSlot === 'main_img' ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                            <span>Subir Foto</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async e => {
                                if (e.target.files?.[0]) {
                                  setUploadingMediaSlot('main_img');
                                  try {
                                    const url = await handleUploadMediaFile(e.target.files[0]);
                                    setEditingItemDraft({ ...editingItemDraft, imageUrl: url });
                                  } finally {
                                    setUploadingMediaSlot(null);
                                  }
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Texto de Abertura / Descrição Principal</label>
                      <textarea
                        value={editingItemDraft.description || ''}
                        onChange={e => setEditingItemDraft({ ...editingItemDraft, description: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-white min-h-[140px]"
                      />
                    </div>

                    {/* Rich Media & Chapter Blocks inside any Lore Item */}
                    <div className="space-y-4 pt-4 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-[#d4af37]">
                            Seções Adicionais, Imagens, Vídeos & Galerias (Ordem Reorganizável)
                          </h4>
                          <p className="text-xs text-slate-400">
                            Anexe quantas imagens, vídeos ou capítulos desejar e ordene com as setas ↑ ↓.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {(editingItemDraft.blocks || []).map((blk: LoreContentBlock, bIdx: number) => (
                          <div key={blk.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                              <span className="text-xs font-bold text-purple-300 uppercase">
                                Bloco #{bIdx + 1} · {blk.type.toUpperCase()}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={bIdx === 0}
                                  onClick={() => {
                                    const list = [...(editingItemDraft.blocks || [])];
                                    const tmp = list[bIdx];
                                    list[bIdx] = list[bIdx - 1];
                                    list[bIdx - 1] = tmp;
                                    setEditingItemDraft({ ...editingItemDraft, blocks: list });
                                  }}
                                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200"
                                >
                                  <ArrowUp size={13} />
                                </button>
                                <button
                                  type="button"
                                  disabled={bIdx === (editingItemDraft.blocks || []).length - 1}
                                  onClick={() => {
                                    const list = [...(editingItemDraft.blocks || [])];
                                    const tmp = list[bIdx];
                                    list[bIdx] = list[bIdx + 1];
                                    list[bIdx + 1] = tmp;
                                    setEditingItemDraft({ ...editingItemDraft, blocks: list });
                                  }}
                                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200"
                                >
                                  <ArrowDown size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const list = (editingItemDraft.blocks || []).filter((_: any, i: number) => i !== bIdx);
                                    setEditingItemDraft({ ...editingItemDraft, blocks: list });
                                  }}
                                  className="p-1.5 rounded bg-red-950/60 hover:bg-red-900 text-red-300 ml-1"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {(blk.type === 'paragraph' || blk.type === 'heading' || blk.type === 'quote') && (
                              <textarea
                                value={blk.text || ''}
                                onChange={e => {
                                  const list = [...(editingItemDraft.blocks || [])];
                                  list[bIdx] = { ...list[bIdx], text: e.target.value };
                                  setEditingItemDraft({ ...editingItemDraft, blocks: list });
                                }}
                                placeholder="Digite o texto deste bloco..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white min-h-[80px]"
                              />
                            )}

                            {(blk.type === 'image' || blk.type === 'video') && (
                              <div className="space-y-2">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={blk.mediaUrl || ''}
                                    onChange={e => {
                                      const list = [...(editingItemDraft.blocks || [])];
                                      list[bIdx] = { ...list[bIdx], mediaUrl: e.target.value };
                                      setEditingItemDraft({ ...editingItemDraft, blocks: list });
                                    }}
                                    placeholder={blk.type === 'video' ? 'URL do vídeo (MP4, YouTube, Drive) ou envie do PC...' : 'URL da imagem ou envie do PC...'}
                                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                                  />
                                  <label className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0">
                                    {uploadingMediaSlot === blk.id ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                                    <span>Subir Arquivo</span>
                                    <input
                                      type="file"
                                      accept={blk.type === 'video' ? 'video/*' : 'image/*'}
                                      className="hidden"
                                      onChange={async e => {
                                        if (e.target.files?.[0]) {
                                          setUploadingMediaSlot(blk.id);
                                          try {
                                            const url = await handleUploadMediaFile(e.target.files[0]);
                                            const list = [...(editingItemDraft.blocks || [])];
                                            list[bIdx] = { ...list[bIdx], mediaUrl: url };
                                            setEditingItemDraft({ ...editingItemDraft, blocks: list });
                                          } finally {
                                            setUploadingMediaSlot(null);
                                          }
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                                <input
                                  type="text"
                                  value={blk.caption || ''}
                                  onChange={e => {
                                    const list = [...(editingItemDraft.blocks || [])];
                                    list[bIdx] = { ...list[bIdx], caption: e.target.value };
                                    setEditingItemDraft({ ...editingItemDraft, blocks: list });
                                  }}
                                  placeholder="Legenda opcional..."
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-300"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(['heading', 'paragraph', 'quote', 'image', 'video'] as const).map(bType => (
                          <button
                            key={bType}
                            type="button"
                            onClick={() => {
                              const nextBlk: LoreContentBlock = {
                                id: `iblk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                                type: bType,
                                text: '',
                                mediaUrl: '',
                                caption: ''
                              };
                              setEditingItemDraft({
                                ...editingItemDraft,
                                blocks: [...(editingItemDraft.blocks || []), nextBlk]
                              });
                            }}
                            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold border border-slate-700"
                          >
                            + {bType === 'heading' ? 'Subtítulo' : bType === 'paragraph' ? 'Parágrafo' : bType === 'quote' ? 'Citação' : bType === 'image' ? 'Anexar Imagem' : 'Anexar Vídeo'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row gap-12 items-start">
                    {/* Left Column (Image & Fields) */}
                    <div className="w-full md:w-1/3 shrink-0">
                      <div className="border-4 border-[#1a1a1a] p-2 bg-[#060608] shadow-[0_0_30px_rgba(var(--primary-rgb),0.15)] relative group">
                        <div className="absolute inset-0 bg-theme/10 opacity-0 group-hover:opacity-100 transition duration-700 pointer-events-none z-20 mix-blend-overlay"></div>
                        {selectedItem.imageUrl ? (
                          <div className="aspect-[3/4] overflow-hidden relative">
                            <img src={selectedItem.imageUrl} alt="" className="w-full h-full object-cover filter contrast-125" />
                            <div className="absolute inset-0 ring-1 ring-inset ring-theme/20 pointer-events-none"></div>
                          </div>
                        ) : (
                          <div className="aspect-[3/4] flex items-center justify-center bg-[#0a0a0c] border border-[#333]">
                            <Feather size={48} className="text-[#333]" />
                          </div>
                        )}
                      </div>

                      {selectedItem.customFields && selectedItem.customFields.length > 0 && (
                        <div className="mt-8 border border-theme/20 bg-[#0a0a0c] p-6">
                          <h5 className="font-cinzel text-theme mb-4 text-center uppercase tracking-widest border-b border-[#333] pb-2 text-sm">Registros Auxiliares</h5>
                          <div className="space-y-4 font-mono text-sm">
                            {selectedItem.customFields.map((field: any, idx: number) => (
                              <div key={idx}>
                                <span className="text-white block mb-1 uppercase tracking-wider text-[10px] opacity-70">{field.label}</span>
                                <span className="text-[#a8a29e]">{field.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column (Info + Rich Media Blocks) */}
                    <div className="flex-1 space-y-10 w-full">
                      <div>
                        <h2 className="font-cinzel text-4xl md:text-6xl font-black text-theme drop-shadow-theme mb-6 uppercase tracking-wider">{selectedItem.name}</h2>
                        <div className="w-24 h-[1px] bg-theme mb-8 opacity-70"></div>
                        <div className="font-playfair text-xl text-slate-300 leading-loose whitespace-pre-wrap first-letter:text-6xl first-letter:font-cinzel first-letter:text-theme first-letter:float-left first-letter:mr-3 first-letter:pr-1 first-letter:border-b-2 first-letter:border-theme">
                          {selectedItem.description}
                        </div>
                      </div>

                      {/* Render Additional Rich Media Blocks if present */}
                      {selectedItem.blocks && selectedItem.blocks.length > 0 && (
                        <div className="space-y-8 pt-6 border-t border-white/10">
                          {selectedItem.blocks.map((blk: LoreContentBlock) => {
                            if (blk.type === 'heading') {
                              return (
                                <h3 key={blk.id} className="font-cinzel text-2xl font-bold text-theme uppercase tracking-wider">
                                  {blk.text}
                                </h3>
                              );
                            }
                            if (blk.type === 'paragraph') {
                              return (
                                <p key={blk.id} className="font-playfair text-lg text-slate-300 leading-relaxed whitespace-pre-wrap">
                                  {blk.text}
                                </p>
                              );
                            }
                            if (blk.type === 'quote') {
                              return (
                                <blockquote key={blk.id} className="p-6 bg-[#0b0b12] border border-theme/30 rounded-xl italic font-playfair text-lg text-amber-100">
                                  "{blk.text}"
                                </blockquote>
                              );
                            }
                            if (blk.type === 'image' && blk.mediaUrl) {
                              return (
                                <figure key={blk.id} className="space-y-2">
                                  <img src={blk.mediaUrl} alt={blk.caption || ''} className="w-full rounded-xl border border-white/15 shadow-xl" />
                                  {blk.caption && <figcaption className="text-xs text-center text-slate-400 italic font-playfair">{blk.caption}</figcaption>}
                                </figure>
                              );
                            }
                            if (blk.type === 'video' && blk.mediaUrl) {
                              const embed = getEmbedVideoUrl(blk.mediaUrl);
                              return (
                                <figure key={blk.id} className="space-y-2">
                                  <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/15 bg-black shadow-xl">
                                    {embed.isIframe ? (
                                      <iframe src={embed.src} className="w-full h-full border-0" allow="autoplay; fullscreen" title={blk.caption || 'Vídeo'} />
                                    ) : (
                                      <video src={embed.src} controls className="w-full h-full object-contain" />
                                    )}
                                  </div>
                                  {blk.caption && <figcaption className="text-xs text-center text-slate-400 italic font-playfair">{blk.caption}</figcaption>}
                                </figure>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
