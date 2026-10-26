import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Trash2,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Users,
  Link2,
  Eye,
  Check,
  X,
  Edit3,
  ArrowRight,
  Sparkles,
  Move
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, readBrowserCache, writeBrowserCache } from '../firebase';
import { CardData } from '../types';
import { sanitizeForFirestore } from '../CardContext';

export interface CharacterRelationNode {
  id: string;
  name: string;
  subtitle?: string;
  imageUrl?: string;
  cardCode?: string;
  x: number;
  y: number;
  borderColor?: string;
}

export interface CharacterRelationEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationLabel: string; // Ex: "Pai de", "Rival", "Aliado", "Divisão", etc.
  relationColor: string;
  bidirectional?: boolean;
  description?: string;
}

export interface CharacterRelationsGraph {
  nodes: CharacterRelationNode[];
  edges: CharacterRelationEdge[];
}

const RELATION_PRESETS: { label: string; color: string }[] = [
  { label: 'Pai / Filho(a)', color: '#eab308' },
  { label: 'Aliado', color: '#10b981' },
  { label: 'Rival / Inimigo', color: '#ef4444' },
  { label: 'Amante', color: '#ec4899' },
  { label: 'Criador / Criação', color: '#a855f7' },
  { label: 'Divisão / Fragmento', color: '#06b6d4' },
  { label: 'Mestre / Discípulo', color: '#3b82f6' },
  { label: 'Corrompido por', color: '#f97316' }
];

const CACHE_KEY = 'ld_cache_wbCharRelations_v1';

interface CharacterRelationsTreeProps {
  cards: CardData[];
  isAdmin?: boolean;
  onInspectCard?: (card: CardData) => void;
}

export const CharacterRelationsTree: React.FC<CharacterRelationsTreeProps> = ({
  cards,
  isAdmin,
  onInspectCard
}) => {
  const [graph, setGraph] = useState<CharacterRelationsGraph>(() => {
    return readBrowserCache<CharacterRelationsGraph>(CACHE_KEY) || { nodes: [], edges: [] };
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');

  // Canvas Pan & Zoom
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Node Dragging (Admin)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Selection & Filters
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [relationTypeFilter, setRelationTypeFilter] = useState<string>('all');

  // Admin Modals / Panels
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [showAddEdgeModal, setShowAddEdgeModal] = useState(false);

  // Add Node Form
  const [cardPickerSearch, setCardPickerSearch] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [nodeSubtitle, setNodeSubtitle] = useState('');
  const [nodeImageUrl, setNodeImageUrl] = useState('');
  const [nodeCardCode, setNodeCardCode] = useState('');
  const [nodeBorderColor, setNodeBorderColor] = useState('#d4af37');

  // Add Edge Form
  const [edgeSourceId, setEdgeSourceId] = useState('');
  const [edgeTargetId, setEdgeTargetId] = useState('');
  const [edgeLabel, setEdgeLabel] = useState('Aliado');
  const [edgeColor, setEdgeColor] = useState('#10b981');
  const [edgeBidirectional, setEdgeBidirectional] = useState(true);
  const [edgeDescription, setEdgeDescription] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadRelations = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'wbSettings', 'characterRelations'));
        if (snap.exists() && mounted) {
          const data = snap.data() as CharacterRelationsGraph;
          const normalized = {
            nodes: Array.isArray(data.nodes) ? data.nodes : [],
            edges: Array.isArray(data.edges) ? data.edges : []
          };
          setGraph(normalized);
          writeBrowserCache(CACHE_KEY, normalized);
        }
      } catch (e) {
        console.warn('Erro ao carregar characterRelations:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadRelations();
    return () => {
      mounted = false;
    };
  }, []);

  const persistGraph = async (nextGraph: CharacterRelationsGraph) => {
    setGraph(nextGraph);
    writeBrowserCache(CACHE_KEY, nextGraph);
    if (!isAdmin) return;
    setSaving(true);
    try {
      const clean = sanitizeForFirestore(nextGraph);
      await setDoc(doc(db, 'wbSettings', 'characterRelations'), clean, { merge: true });
      setSaveFeedback('Salvo!');
      setTimeout(() => setSaveFeedback(''), 2000);
    } catch (e) {
      console.error('Erro ao salvar árvore de relações:', e);
    } finally {
      setSaving(false);
    }
  };

  // Catalog cards for character picker
  const catalogCards = useMemo(() => {
    return (cards || []).filter((c) => c && !c.deleted && !c.isHidden);
  }, [cards]);

  const filteredPickerCards = useMemo(() => {
    const q = cardPickerSearch.toLowerCase().trim();
    if (!q) return catalogCards.slice(0, 24);
    return catalogCards
      .filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.code || '').toLowerCase().includes(q) ||
          (c.archetype || '').toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [catalogCards, cardPickerSearch]);

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) || null,
    [graph.nodes, selectedNodeId]
  );

  // Connections for selected node
  const selectedNodeConnections = useMemo(() => {
    if (!selectedNodeId) return [];
    return graph.edges
      .filter((e) => e.sourceId === selectedNodeId || e.targetId === selectedNodeId)
      .map((edge) => {
        const isOutgoing = edge.sourceId === selectedNodeId;
        const otherId = isOutgoing ? edge.targetId : edge.sourceId;
        const otherNode = graph.nodes.find((n) => n.id === otherId);
        return {
          edge,
          otherNode,
          isOutgoing
        };
      })
      .filter((item) => Boolean(item.otherNode));
  }, [graph.edges, graph.nodes, selectedNodeId]);

  // Unique relation labels for filter
  const uniqueRelationLabels = useMemo(() => {
    return Array.from(new Set(graph.edges.map((e) => e.relationLabel).filter(Boolean)));
  }, [graph.edges]);

  // Visible edges after filter
  const visibleEdges = useMemo(() => {
    return graph.edges.filter((edge) => {
      if (relationTypeFilter !== 'all' && edge.relationLabel !== relationTypeFilter) {
        return false;
      }
      return true;
    });
  }, [graph.edges, relationTypeFilter]);

  const handleAddNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeName.trim()) return;

    // Place new node near center with slight offset so nodes don't overlap
    const count = graph.nodes.length;
    const angle = count * 1.1;
    const radius = 140 + (count % 4) * 55;
    const defaultX = Math.round(500 + Math.cos(angle) * radius);
    const defaultY = Math.round(320 + Math.sin(angle) * radius);

    const newNode: CharacterRelationNode = {
      id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: nodeName.trim(),
      subtitle: nodeSubtitle.trim() || undefined,
      imageUrl: nodeImageUrl.trim() || undefined,
      cardCode: nodeCardCode.trim() || undefined,
      x: defaultX,
      y: defaultY,
      borderColor: nodeBorderColor || '#d4af37'
    };

    const nextGraph = {
      ...graph,
      nodes: [...graph.nodes, newNode]
    };
    await persistGraph(nextGraph);
    setSelectedNodeId(newNode.id);
    setNodeName('');
    setNodeSubtitle('');
    setNodeImageUrl('');
    setNodeCardCode('');
    setShowAddNodeModal(false);
  };

  const handleDeleteNode = async (nodeId: string) => {
    const nextGraph = {
      nodes: graph.nodes.filter((n) => n.id !== nodeId),
      edges: graph.edges.filter((e) => e.sourceId !== nodeId && e.targetId !== nodeId)
    };
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    await persistGraph(nextGraph);
  };

  const handleAddEdge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edgeSourceId || !edgeTargetId || edgeSourceId === edgeTargetId || !edgeLabel.trim()) {
      return;
    }

    const newEdge: CharacterRelationEdge = {
      id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sourceId: edgeSourceId,
      targetId: edgeTargetId,
      relationLabel: edgeLabel.trim(),
      relationColor: edgeColor || '#d4af37',
      bidirectional: edgeBidirectional,
      description: edgeDescription.trim() || 'Lore será preenchida em breve'
    };

    const nextGraph = {
      ...graph,
      edges: [...graph.edges, newEdge]
    };
    await persistGraph(nextGraph);
    setEdgeDescription('');
    setShowAddEdgeModal(false);
  };

  const handleDeleteEdge = async (edgeId: string) => {
    const nextGraph = {
      ...graph,
      edges: graph.edges.filter((e) => e.id !== edgeId)
    };
    await persistGraph(nextGraph);
  };

  // Pointer handlers for canvas pan & node drag
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingNodeId) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingNodeId && isAdmin) {
      const rect = svgContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldX = (e.clientX - rect.left - pan.x) / zoom - dragOffsetRef.current.x;
      const worldY = (e.clientY - rect.top - pan.y) / zoom - dragOffsetRef.current.y;

      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === draggingNodeId
            ? { ...n, x: Math.round(worldX), y: Math.round(worldY) }
            : n
        )
      }));
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      });
    }
  };

  const handleCanvasMouseUp = () => {
    if (draggingNodeId && isAdmin) {
      setDraggingNodeId(null);
      persistGraph(graph);
    }
    setIsPanning(false);
  };

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] bg-[#060609] overflow-hidden flex flex-col lg:flex-row">
      {/* ================= TOP FLOATING TOOLBAR ================= */}
      <div className="absolute top-4 left-4 right-4 lg:right-96 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="bg-[#0b0b12]/95 border border-[#d4af37]/30 rounded-2xl p-2.5 flex flex-wrap items-center gap-2 shadow-2xl pointer-events-auto">
          <div className="flex items-center gap-2 px-2">
            <Users size={16} className="text-[#d4af37]" />
            <span className="font-cinzel font-black text-xs sm:text-sm text-white tracking-wider uppercase">
              Árvore de Relações
            </span>
          </div>

          {/* Search character */}
          <div className="relative">
            <Search
              size={13}
              className="text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Localizar personagem..."
              className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-[#d4af37] w-44"
            />
          </div>

          {uniqueRelationLabels.length > 0 && (
            <select
              value={relationTypeFilter}
              onChange={(e) => setRelationTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-bold outline-none"
            >
              <option value="all">Todos os Vínculos ({graph.edges.length})</option>
              {uniqueRelationLabels.map((lbl) => (
                <option key={lbl} value={lbl}>
                  {lbl}
                </option>
              ))}
            </select>
          )}

          {isAdmin && (
            <div className="flex items-center gap-1.5 pl-1 border-l border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddNodeModal(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer transition"
              >
                <Plus size={13} />
                <span>+ Personagem</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedNodeId) setEdgeSourceId(selectedNodeId);
                  setShowAddEdgeModal(true);
                }}
                disabled={graph.nodes.length < 2}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition"
              >
                <Link2 size={13} />
                <span>+ Criar Relação</span>
              </button>
              {saving && (
                <span className="text-[11px] text-amber-300 font-bold px-2">Salvando...</span>
              )}
              {saveFeedback && (
                <span className="text-[11px] text-emerald-400 font-bold px-2">
                  ✓ {saveFeedback}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="bg-[#0b0b12]/95 border border-slate-800 rounded-2xl p-1.5 flex items-center gap-1 shadow-xl pointer-events-auto">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.2, +(z + 0.15).toFixed(2)))}
            className="p-2 rounded-xl hover:bg-slate-900 text-slate-300 hover:text-white cursor-pointer"
            title="Aproximar"
          >
            <ZoomIn size={15} />
          </button>
          <span className="text-[11px] font-mono text-slate-400 px-1.5">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}
            className="p-2 rounded-xl hover:bg-slate-900 text-slate-300 hover:text-white cursor-pointer"
            title="Afastar"
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-2 rounded-xl hover:bg-slate-900 text-slate-300 hover:text-white cursor-pointer"
            title="Centralizar Visão"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* ================= INTERACTIVE GRAPH CANVAS ================= */}
      <div
        ref={svgContainerRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        className="flex-1 h-full relative cursor-grab active:cursor-grabbing select-none overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, rgba(212, 175, 55, 0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px'
        }}
      >
        {graph.nodes.length === 0 && !loading ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
            <div className="bg-[#0d0d14]/95 border border-[#d4af37]/30 rounded-2xl p-8 max-w-md text-center space-y-4 pointer-events-auto shadow-2xl">
              <Users size={42} className="mx-auto text-[#d4af37]" />
              <h3 className="font-cinzel text-lg font-black text-white">
                Árvore de Relações entre Personagens
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isAdmin
                  ? 'Nenhum personagem foi adicionado ainda. Clique abaixo para adicionar personagens (vinculados às cartas do catálogo ou personalizados) e traçar os vínculos entre eles.'
                  : 'A Árvore de Relações será preenchida em breve pelo Mestre.'}
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowAddNodeModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer"
                >
                  + Adicionar Primeiro Personagem
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: '2000px',
              height: '1400px',
              position: 'relative'
            }}
          >
            {/* SVG Edges Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
              <defs>
                <marker
                  id="relation-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#d4af37" />
                </marker>
              </defs>

              {visibleEdges.map((edge) => {
                const source = graph.nodes.find((n) => n.id === edge.sourceId);
                const target = graph.nodes.find((n) => n.id === edge.targetId);
                if (!source || !target) return null;

                const isHighlighted =
                  !selectedNodeId ||
                  edge.sourceId === selectedNodeId ||
                  edge.targetId === selectedNodeId;

                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;

                return (
                  <g
                    key={edge.id}
                    style={{ opacity: isHighlighted ? 1 : 0.22 }}
                    className="transition-opacity duration-200"
                  >
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={edge.relationColor || '#d4af37'}
                      strokeWidth={isHighlighted && selectedNodeId ? 3 : 2}
                      strokeDasharray={edge.bidirectional ? undefined : '6 4'}
                    />
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x={-65}
                        y={-12}
                        width={130}
                        height={24}
                        rx={8}
                        fill="#090910"
                        stroke={edge.relationColor || '#d4af37'}
                        strokeWidth={1.2}
                      />
                      <text
                        x={0}
                        y={4}
                        textAnchor="middle"
                        fill="#f8fafc"
                        fontSize={10}
                        fontWeight="bold"
                      >
                        {edge.relationLabel}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>

            {/* HTML Nodes Layer */}
            {graph.nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isConnectedToSelected =
                !selectedNodeId ||
                isSelected ||
                graph.edges.some(
                  (e) =>
                    (e.sourceId === selectedNodeId && e.targetId === node.id) ||
                    (e.targetId === selectedNodeId && e.sourceId === node.id)
                );
              const matchesSearch =
                !searchTerm.trim() ||
                node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (node.subtitle || '').toLowerCase().includes(searchTerm.toLowerCase());

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                    if (isAdmin) {
                      const rect = svgContainerRef.current?.getBoundingClientRect();
                      if (rect) {
                        const clickWorldX = (e.clientX - rect.left - pan.x) / zoom;
                        const clickWorldY = (e.clientY - rect.top - pan.y) / zoom;
                        dragOffsetRef.current = {
                          x: clickWorldX - node.x,
                          y: clickWorldY - node.y
                        };
                        setDraggingNodeId(node.id);
                      }
                    }
                  }}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    transform: 'translate(-50%, -50%)',
                    borderColor: isSelected
                      ? '#ffffff'
                      : node.borderColor || 'rgba(212, 175, 55, 0.6)',
                    opacity: isConnectedToSelected && matchesSearch ? 1 : 0.25
                  }}
                  className={`absolute w-36 bg-[#0d0d16]/95 border-2 rounded-2xl p-2.5 shadow-2xl transition-opacity cursor-pointer group ${
                    isSelected ? 'ring-4 ring-amber-400/40 scale-105 z-10' : 'hover:scale-105'
                  }`}
                >
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <div
                      className="w-16 h-16 rounded-full overflow-hidden bg-black border-2 shrink-0 flex items-center justify-center"
                      style={{ borderColor: node.borderColor || '#d4af37' }}
                    >
                      {node.imageUrl ? (
                        <img
                          src={node.imageUrl}
                          alt={node.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      ) : (
                        <span className="font-cinzel font-black text-lg text-[#d4af37]">
                          {node.name.charAt(0)}
                        </span>
                      )}
                    </div>

                    <div className="w-full">
                      <div className="text-xs font-black text-white leading-tight line-clamp-2">
                        {node.name}
                      </div>
                      {node.subtitle && (
                        <div className="text-[10px] text-amber-300/90 truncate mt-0.5">
                          {node.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= RIGHT INSPECTOR SIDEBAR ================= */}
      <aside className="w-full lg:w-96 bg-[#0b0b12] border-t lg:border-t-0 lg:border-l border-slate-800/90 p-4 sm:p-5 overflow-y-auto z-20 space-y-5">
        {selectedNode ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-full overflow-hidden bg-black border-2 shrink-0 flex items-center justify-center"
                  style={{ borderColor: selectedNode.borderColor || '#d4af37' }}
                >
                  {selectedNode.imageUrl ? (
                    <img
                      src={selectedNode.imageUrl}
                      alt={selectedNode.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-cinzel font-black text-lg text-[#d4af37]">
                      {selectedNode.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-cinzel text-base font-black text-white">
                    {selectedNode.name}
                  </h3>
                  {selectedNode.subtitle && (
                    <p className="text-xs text-amber-300">{selectedNode.subtitle}</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Inspect Linked Catalog Card */}
            {selectedNode.cardCode && onInspectCard && (
              <button
                type="button"
                onClick={() => {
                  const found = catalogCards.find(
                    (c) => c.code === selectedNode.cardCode || c.name === selectedNode.name
                  );
                  if (found) onInspectCard(found);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Eye size={14} />
                <span>Ver Carta no Catálogo ({selectedNode.cardCode})</span>
              </button>
            )}

            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEdgeSourceId(selectedNode.id);
                    setShowAddEdgeModal(true);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Link2 size={13} />
                  <span>+ Vincular a Outro Personagem</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  className="p-2 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-700/50 text-red-300 cursor-pointer"
                  title="Remover personagem da árvore"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}

            {/* Direct Connections List */}
            <div className="space-y-2.5 pt-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                Relações & Vínculos ({selectedNodeConnections.length})
              </h4>

              {selectedNodeConnections.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center bg-slate-950 rounded-xl border border-slate-800">
                  Nenhuma relação cadastrada para este personagem ainda.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {selectedNodeConnections.map(({ edge, otherNode }) => {
                    if (!otherNode) return null;
                    return (
                      <div
                        key={edge.id}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-[10px] font-black uppercase px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: `${edge.relationColor}22`,
                              color: edge.relationColor,
                              border: `1px solid ${edge.relationColor}66`
                            }}
                          >
                            {edge.relationLabel}
                          </span>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteEdge(edge.id)}
                              className="text-slate-500 hover:text-red-400 cursor-pointer"
                              title="Remover vínculo"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedNodeId(otherNode.id)}
                          className="w-full flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 transition text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {otherNode.imageUrl && (
                              <img
                                src={otherNode.imageUrl}
                                alt={otherNode.name}
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 rounded-full object-cover shrink-0 bg-black"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">
                                {otherNode.name}
                              </div>
                              {otherNode.subtitle && (
                                <div className="text-[10px] text-slate-400 truncate">
                                  {otherNode.subtitle}
                                </div>
                              )}
                            </div>
                          </div>
                          <ArrowRight size={14} className="text-slate-400 shrink-0" />
                        </button>

                        {edge.description && (
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {edge.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="font-cinzel text-sm font-black uppercase tracking-wider text-[#d4af37]">
              Guia da Árvore de Relações
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Clique em qualquer personagem na árvore para destacar todos os seus vínculos diretos e ler a descrição de cada relação.
            </p>
            {isAdmin && (
              <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-3.5 space-y-2 text-xs text-slate-300">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Move size={14} />
                  <span>Controles do Mestre (Admin)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  • Arraste qualquer personagem com o mouse para posicioná-lo livremente na árvore (a posição é salva automaticamente).
                  <br />• Use <strong>+ Personagem</strong> para incluir cartas do catálogo ou personagens da lore.
                  <br />• Use <strong>+ Criar Relação</strong> para ligar dois personagens.
                </p>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ================= MODAL 1: ADD CHARACTER NODE (ADMIN) ================= */}
      {showAddNodeModal && isAdmin && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAddNodeModal(false)}
        >
          <div
            className="bg-[#0e0e16] border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                Adicionar Personagem à Árvore
              </h3>
              <button
                type="button"
                onClick={() => setShowAddNodeModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Pick from Card Catalog */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
              <label className="text-xs font-bold text-purple-300 block">
                Importar Dados de uma Carta do Catálogo (Opcional)
              </label>
              <input
                type="text"
                value={cardPickerSearch}
                onChange={(e) => setCardPickerSearch(e.target.value)}
                placeholder="Buscar carta por nome ou código..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-purple-500"
              />
              <div className="max-h-36 overflow-y-auto grid grid-cols-2 gap-1.5 pr-1">
                {filteredPickerCards.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setNodeName(c.name);
                      setNodeSubtitle(c.archetype || c.type || '');
                      setNodeImageUrl(c.catalogCoverImageUrl || c.imageUrl || '');
                      setNodeCardCode(c.code);
                    }}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left flex items-center gap-2 cursor-pointer"
                  >
                    {(c.catalogCoverImageUrl || c.imageUrl) && (
                      <img
                        src={c.catalogCoverImageUrl || c.imageUrl}
                        alt={c.name}
                        referrerPolicy="no-referrer"
                        className="w-7 h-9 object-cover rounded shrink-0 bg-black"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-white truncate">{c.name}</div>
                      <div className="text-[9px] text-slate-400 font-mono truncate">{c.code}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddNode} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Nome do Personagem *
                </label>
                <input
                  type="text"
                  required
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                  placeholder="Ex: Salazar"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Título / Epíteto Opcional
                </label>
                <input
                  type="text"
                  value={nodeSubtitle}
                  onChange={(e) => setNodeSubtitle(e.target.value)}
                  placeholder="Ex: Conceito da Paz / O Escolhido"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    URL da Foto / Arte
                  </label>
                  <input
                    type="text"
                    value={nodeImageUrl}
                    onChange={(e) => setNodeImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Cor da Borda
                  </label>
                  <input
                    type="color"
                    value={nodeBorderColor}
                    onChange={(e) => setNodeBorderColor(e.target.value)}
                    className="w-full h-9 bg-slate-950 border border-slate-800 rounded-xl p-1 cursor-pointer"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
              >
                Adicionar à Árvore
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: ADD RELATIONSHIP EDGE (ADMIN) ================= */}
      {showAddEdgeModal && isAdmin && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAddEdgeModal(false)}
        >
          <div
            className="bg-[#0e0e16] border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                Criar Relação entre Personagens
              </h3>
              <button
                type="button"
                onClick={() => setShowAddEdgeModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddEdge} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Personagem A *
                  </label>
                  <select
                    required
                    value={edgeSourceId}
                    onChange={(e) => setEdgeSourceId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none"
                  >
                    <option value="">-- Selecione --</option>
                    {graph.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Personagem B *
                  </label>
                  <select
                    required
                    value={edgeTargetId}
                    onChange={(e) => setEdgeTargetId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none"
                  >
                    <option value="">-- Selecione --</option>
                    {graph.nodes
                      .filter((n) => n.id !== edgeSourceId)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Tipo de Relação (escolha um preset ou digite abaixo)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {RELATION_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setEdgeLabel(preset.label);
                        setEdgeColor(preset.color);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition"
                      style={{
                        backgroundColor:
                          edgeLabel === preset.label ? `${preset.color}33` : '#090910',
                        borderColor:
                          edgeLabel === preset.label ? preset.color : 'rgba(255,255,255,0.1)',
                        color: preset.color
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <input
                    type="text"
                    required
                    value={edgeLabel}
                    onChange={(e) => setEdgeLabel(e.target.value)}
                    placeholder="Ex: Pai de / Rival / Criador"
                    className="col-span-3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                  <input
                    type="color"
                    value={edgeColor}
                    onChange={(e) => setEdgeColor(e.target.value)}
                    className="w-full h-9 bg-slate-950 border border-slate-800 rounded-xl p-1 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Descrição do Vínculo (escrita por você)
                </label>
                <textarea
                  rows={3}
                  value={edgeDescription}
                  onChange={(e) => setEdgeDescription(e.target.value)}
                  placeholder="Se deixar vazio, ficará como 'Lore será preenchida em breve'..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs cursor-pointer"
              >
                Salvar Relação na Árvore
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
