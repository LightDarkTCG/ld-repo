import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Download, FileText, Image as ImageIcon, Copy, Check, RefreshCw, User, Layers, Trophy } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { CardData } from '../types';
import { cleanCardCode } from '../CardContext';
import { encodeDeckCode, compareCardCodes } from '../deckUtils';
import { useAuth } from '../authService';

interface DeckImageGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck: CardData[];
  sideDeck: CardData[];
  isValidDeck?: boolean;
}

function getTypeBorderColor(type: string): string {
  switch (type) {
    case 'Herói':
      return '#ef4444';
    case 'Combatente':
      return '#3b82f6';
    case 'Equipamento':
      return '#22c55e';
    case 'Token':
      return '#eab308';
    case 'Efeito':
    default:
      return '#a855f7';
  }
}

/**
 * Carrega a imagem da carta para o Canvas usando o proxy local (/api/image-proxy)
 * para garantir que imagens do Imgur/externas sempre apareçam no Canvas e no PDF sem bloqueio de CORS/Referer.
 * Possui fallback direto com referrerPolicy="no-referrer".
 */
function loadCardImageForCanvas(url?: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }

    // Se já for data URL ou caminho local
    if (url.startsWith('data:') || url.startsWith('/')) {
      const directImg = new Image();
      directImg.onload = () => resolve(directImg);
      directImg.onerror = () => resolve(null);
      directImg.src = url;
      return;
    }

    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      resolve(null);
    }, 9000);

    img.onload = () => {
      clearTimeout(timeout);
      resolve(img);
    };

    img.onerror = () => {
      // Fallback tentando carregar diretamente sem Referer
      const fallbackImg = new Image();
      fallbackImg.crossOrigin = 'anonymous';
      fallbackImg.referrerPolicy = 'no-referrer';
      fallbackImg.onload = () => {
        clearTimeout(timeout);
        resolve(fallbackImg);
      };
      fallbackImg.onerror = () => {
        clearTimeout(timeout);
        resolve(null);
      };
      fallbackImg.src = url + (url.includes('?') ? '&' : '?') + 'cors=1';
    };

    img.src = proxyUrl;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export const DeckImageGeneratorModal: React.FC<DeckImageGeneratorModalProps> = ({
  isOpen,
  onClose,
  deck,
  sideDeck,
  isValidDeck = false
}) => {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const detectedHero = useMemo(() => {
    return deck.find((c) => c.type === 'Herói') || deck[0] || null;
  }, [deck]);

  const [playerName, setPlayerName] = useState('');
  const [deckTitle, setDeckTitle] = useState('');
  const [tournamentName, setTournamentName] = useState('Torneio Oficial Light Dark TCG');
  const [isRendering, setIsRendering] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (!deckTitle && detectedHero) {
        setDeckTitle(`Deck ${detectedHero.name.split(' - ')[0]}`);
      }
      if (!playerName && user) {
        setPlayerName(user.displayName || user.email?.split('@')[0] || '');
      }
    }
  }, [isOpen, detectedHero, user]);

  // Código compacto oficial do deck (sempre gerado mesmo que em montagem)
  const deckCode = useMemo(() => {
    if (deck.length === 0 && sideDeck.length === 0) return '';
    return encodeDeckCode(deck, sideDeck);
  }, [deck, sideDeck]);

  // Ordenação das cartas para a imagem (Herói -> Combatente -> Equipamento -> Efeito -> Token)
  const sortedMainDeck = useMemo(() => {
    const typeRank: Record<string, number> = {
      'Herói': 1,
      'Combatente': 2,
      'Equipamento': 3,
      'Efeito': 4,
      'Token': 5
    };
    return [...deck].sort((a, b) => {
      const rA = typeRank[a.type] || 9;
      const rB = typeRank[b.type] || 9;
      if (rA !== rB) return rA - rB;
      if ((a.ct || 0) !== (b.ct || 0)) return (a.ct || 0) - (b.ct || 0);
      return compareCardCodes(a.code, b.code);
    });
  }, [deck]);

  const sortedSideDeck = useMemo(() => {
    return [...sideDeck].sort((a, b) => compareCardCodes(a.code, b.code));
  }, [sideDeck]);

  // Renderiza o Canvas com a arte real das cartas + código do deck
  const renderDeckCanvas = async (): Promise<HTMLCanvasElement | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    setIsRendering(true);

    try {
      const allToLoad = [...sortedMainDeck, ...sortedSideDeck];
      const loadedImages = new Map<string, HTMLImageElement | null>();

      await Promise.all(
        allToLoad.map(async (c) => {
          const key = `${c.code}_${c.name}_${c.imageUrl || ''}`;
          if (!loadedImages.has(key) && c.imageUrl) {
            const img = await loadCardImageForCanvas(c.imageUrl);
            loadedImages.set(key, img);
          }
        })
      );

      const cols = 6;
      const mainRows = Math.max(1, Math.ceil(sortedMainDeck.length / cols));
      const hasSide = sortedSideDeck.length > 0;

      const cardW = 224;
      const cardH = 314;
      const gapX = 12;
      // Passo vertical (~72% da altura da carta) para deixar arte, status (ATK/DEF/Arquétipos) e NOME
      // 100% visíveis, cobrindo apenas a caixa de texto de efeito inferior para evitar pirataria
      const rowStepY = Math.round(cardH * 0.72); // 226px
      // Altura visível máxima na última fileira (mantém arte, status e nome visíveis e corta o final do texto)
      const lastRowVisibleH = Math.round(cardH * 0.75); // 236px
      const padX = 36;

      const canvasW = padX * 2 + cols * cardW + (cols - 1) * gapX; // 1476px
      const headerH = 186;
      const mainGridH = (mainRows - 1) * rowStepY + lastRowVisibleH;
      const sideSectionH = hasSide ? 54 + lastRowVisibleH : 0;
      const footerH = 86;

      const canvasH = headerH + 22 + mainGridH + sideSectionH + footerH;

      canvas.width = canvasW;
      canvas.height = canvasH;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Fundo Oficial Escuro de Light Dark TCG
      ctx.fillStyle = '#0a0a0e';
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Cabeçalho
      drawRoundedRect(ctx, padX, 20, canvasW - padX * 2, headerH - 20, 16);
      ctx.fillStyle = '#12131c';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#334155';
      ctx.stroke();

      const pName = (playerName || 'Duelista').trim();
      const dName = (deckTitle || 'Deck Principal').trim();
      const tName = (tournamentName || 'Torneio Oficial Light Dark TCG').trim();
      const nowStr = new Date().toLocaleDateString('pt-BR');

      ctx.fillStyle = '#a855f7';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`LIGHT DARK TCG • ${tName.toUpperCase()} (${nowStr})`, padX + 26, 58);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 36px sans-serif';
      ctx.fillText(dName.slice(0, 38), padX + 26, 102);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 19px sans-serif';
      const heroStr = detectedHero ? `Herói: ${detectedHero.name}` : 'Sem Herói';
      ctx.fillText(
        `Jogador: ${pName}   |   ${heroStr}   |   Principal: ${deck.length} cartas   |   Side: ${sideDeck.length} cartas`,
        padX + 26,
        136
      );

      // Código do Deck no Cabeçalho
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 14px monospace';
      const headerCode = deckCode.length > 105 ? deckCode.slice(0, 102) + '...' : deckCode;
      ctx.fillText(`Código do Deck: ${headerCode}`, padX + 26, 166);

      // Função para desenhar cada carta empilhada/amontoada (com sombra sobre a fileira anterior
      // e corte/proteção inferior quando não houver outra carta por cima dela)
      const drawCard = (card: CardData, x: number, y: number, hasCardBelow: boolean) => {
        const key = `${card.code}_${card.name}_${card.imageUrl || ''}`;
        const img = loadedImages.get(key);
        const borderColor = getTypeBorderColor(card.type);
        // Se não houver outra carta cobrindo esta coluna na linha de baixo,
        // limita a área exibida para nunca expor a carta inteira (proteção anti-pirataria)
        const visibleH = hasCardBelow ? cardH : lastRowVisibleH;

        // Sombra projetada sobre a carta da fileira de cima para dar o efeito de cartas amontoadas
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.88)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = -5;
        drawRoundedRect(ctx, x, y, cardW, visibleH, 10);
        ctx.fillStyle = '#0f111a';
        ctx.fill();
        ctx.restore();

        ctx.save();
        drawRoundedRect(ctx, x, y, cardW, visibleH, 10);
        ctx.fillStyle = '#161822';
        ctx.fill();
        ctx.clip();

        if (img) {
          // Desenha a carta real completa dentro do recorte empilhado
          ctx.drawImage(img, x, y, cardW, cardH);
        } else {
          // Apenas se for uma carta sem imagem cadastrada (ex: Token Placeholder)
          ctx.fillStyle = '#1e1b2e';
          ctx.fillRect(x, y, cardW, cardH);

          ctx.fillStyle = borderColor;
          ctx.font = 'bold 15px sans-serif';
          ctx.fillText(card.type.toUpperCase(), x + 16, y + 42);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px sans-serif';
          const words = card.name.split(' ');
          let line = '';
          let ly = y + 82;
          words.forEach((w) => {
            if ((line + w).length > 18) {
              ctx.fillText(line, x + 16, ly);
              line = w + ' ';
              ly += 24;
            } else {
              line += w + ' ';
            }
          });
          if (line) ctx.fillText(line, x + 16, ly);

          ctx.fillStyle = '#facc15';
          ctx.font = 'bold 15px monospace';
          ctx.fillText(`CT ${card.ct ?? 0}`, x + 16, y + 150);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '13px monospace';
          ctx.fillText(cleanCardCode(card.code || ''), x + 16, y + 174);
        }

        ctx.restore();

        // Contorno na cor do tipo da carta
        drawRoundedRect(ctx, x, y, cardW, visibleH, 10);
        ctx.lineWidth = 3;
        ctx.strokeStyle = borderColor;
        ctx.stroke();
      };

      // Desenha todas as cartas do Deck Principal em fileiras sobrepostas (de cima para baixo)
      const gridStartY = headerH + 18;
      sortedMainDeck.forEach((card, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = padX + col * (cardW + gapX);
        const cy = gridStartY + row * rowStepY;
        const hasCardBelow = idx + cols < sortedMainDeck.length;
        drawCard(card, cx, cy, hasCardBelow);
      });

      // Desenha Side Deck se houver (também com proteção parcial)
      let curY = gridStartY + mainGridH;
      if (hasSide) {
        curY += 22;
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 19px sans-serif';
        ctx.fillText(`SIDE DECK (${sortedSideDeck.length} / 5 CARTAS)`, padX, curY);

        curY += 12;
        sortedSideDeck.forEach((card, idx) => {
          const cx = padX + idx * (cardW + gapX);
          drawCard(card, cx, curY, false);
        });
        curY += lastRowVisibleH;
      }

      // Rodapé sobreposto/integrado com Código do Deck completo e validação
      const footY = canvasH - 68;
      drawRoundedRect(ctx, padX, footY, canvasW - padX * 2, 50, 12);
      ctx.fillStyle = '#12131c';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#334155';
      ctx.stroke();

      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 15px monospace';
      const footCode = deckCode.length > 95 ? deckCode.slice(0, 92) + '...' : deckCode;
      ctx.fillText(`CÓDIGO DO DECK: ${footCode}`, padX + 20, footY + 31);

      const statusText = isValidDeck
        ? '✓ DECK VÁLIDO PARA TORNEIO (30-35 CARTAS)'
        : `DECK: ${deck.length} PRINCIPAL / ${sideDeck.length} SIDE`;
      ctx.fillStyle = isValidDeck ? '#4ade80' : '#fbbf24';
      ctx.font = 'bold 15px sans-serif';
      const stW = ctx.measureText(statusText).width;
      ctx.fillText(statusText, canvasW - padX - stW - 20, footY + 31);

      return canvas;
    } finally {
      setIsRendering(false);
    }
  };

  useEffect(() => {
    if (isOpen && (deck.length > 0 || sideDeck.length > 0)) {
      renderDeckCanvas();
    }
  }, [isOpen, deck, sideDeck, playerName, deckTitle, tournamentName]);

  if (!isOpen) return null;

  // Exporta o PDF Unificado: Página 1 = Lista de Cartas + Código | Última Página = Imagem Visual do Deck
  const handleDownloadUnifiedPdf = async () => {
    const renderedCanvas = await renderDeckCanvas();
    const docPdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const nowStr = new Date().toLocaleDateString('pt-BR');
    const pName = playerName.trim() || 'Duelista';
    const dName = deckTitle.trim() || 'Deck Principal';
    const tName = tournamentName.trim() || 'Torneio Oficial Light Dark TCG';

    // --- PÁGINA 1: LISTA ESCRITA DE CARTAS PARA CHECK-IN ---
    docPdf.setFillColor(18, 18, 26);
    docPdf.rect(0, 0, 210, 38, 'F');
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(14);
    docPdf.text('LIGHT DARK TCG - LISTA DE DECK PARA TORNEIO', 14, 12);

    docPdf.setFontSize(9);
    docPdf.setTextColor(210, 180, 255);
    docPdf.text(`Torneio: ${tName}   |   Data: ${nowStr}`, 14, 19);
    docPdf.text(
      `Jogador: ${pName}   |   Deck: ${dName}   |   Principal: ${deck.length} cartas   |   Side: ${sideDeck.length} cartas`,
      14,
      25
    );

    // Código do Deck impresso no cabeçalho da Página 1
    docPdf.setFont('courier', 'bold');
    docPdf.setFontSize(8);
    docPdf.setTextColor(134, 239, 172);
    const pdfCodeLine = `Codigo do Deck: ${deckCode}`;
    const splitCode = docPdf.splitTextToSize(pdfCodeLine, 182);
    docPdf.text(splitCode[0] || pdfCodeLine, 14, 33);

    let y = 45;

    const addCategorySection = (title: string, list: CardData[]) => {
      if (list.length === 0) return;
      if (y > 265) {
        docPdf.addPage();
        y = 20;
      }
      docPdf.setFillColor(238, 238, 246);
      docPdf.rect(14, y - 4.5, 182, 6.5, 'F');
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(9.5);
      docPdf.setTextColor(30, 20, 60);
      docPdf.text(`${title} (${list.length})`, 16, y);
      y += 5.5;

      docPdf.setFont('helvetica', 'normal');
      docPdf.setFontSize(8.2);
      docPdf.setTextColor(25, 25, 25);

      list.forEach((c, idx) => {
        if (y > 276) {
          docPdf.addPage();
          y = 20;
        }
        const codeStr = cleanCardCode(c.code || '');
        const statsStr =
          c.type === 'Herói' || c.type === 'Combatente'
            ? `ATK:${c.attack ?? 0} / VIDA:${c.defense ?? 0}`
            : c.type;
        const lineLeft = `[  ] ${String(idx + 1).padStart(2, '0')}. ${c.name}`;
        const lineRight = `${codeStr}  |  CT ${c.ct ?? 0}  |  ${statsStr}  |  ${c.frame || 'Legado'}`;
        docPdf.text(lineLeft, 16, y);
        docPdf.text(lineRight, 118, y);
        y += 4.5;
      });
      y += 2.8;
    };

    const heroes = deck.filter((c) => c.type === 'Herói');
    const tokens = deck.filter((c) => c.type === 'Token');
    const combatants = deck.filter((c) => c.type === 'Combatente');
    const equipments = deck.filter((c) => c.type === 'Equipamento');
    const effects = deck.filter((c) => c.type === 'Efeito');

    addCategorySection('HEROIS', heroes);
    addCategorySection('TOKENS (DECK DE HEROIS - MAX 15)', tokens);
    addCategorySection('COMBATENTES', combatants);
    addCategorySection('EQUIPAMENTOS', equipments);
    addCategorySection('CARTAS DE EFEITO', effects);
    addCategorySection('SIDE DECK (ATE 5 CARTAS)', sideDeck);

    if (y > 245) {
      docPdf.addPage();
      y = 25;
    } else {
      y += 4;
    }

    docPdf.setDrawColor(160, 160, 175);
    docPdf.line(14, y, 196, y);
    y += 5.5;
    docPdf.setFont('courier', 'bold');
    docPdf.setFontSize(7.5);
    docPdf.setTextColor(30, 30, 30);
    const wrappedCode = docPdf.splitTextToSize(`CODIGO DO DECK: ${deckCode}`, 182);
    docPdf.text(wrappedCode, 14, y);
    y += wrappedCode.length * 4 + 3;

    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(8.5);
    docPdf.text(
      `Status pelas Regras Oficiais: ${
        isValidDeck ? 'DECK VALIDO PARA TORNEIO (30-35 Cartas, Singleton)' : 'DECK EM MONTAGEM / FORA DO PADRAO'
      }`,
      14,
      y
    );
    y += 10;
    docPdf.setFont('helvetica', 'normal');
    docPdf.text('Assinatura do Jogador: _______________________________', 14, y);
    docPdf.text('Check-in Juiz / Staff: _______________________________', 115, y);

    // --- ÚLTIMA PÁGINA: IMAGEM VISUAL DO DECK ---
    if (renderedCanvas) {
      docPdf.addPage();
      // Fundo escuro elegante na página da imagem do deck
      docPdf.setFillColor(10, 10, 14);
      docPdf.rect(0, 0, 210, 297, 'F');

      const imgData = renderedCanvas.toDataURL('image/jpeg', 0.92);
      const pageW = 194; // 210 - 16mm margem
      const pageH = 281; // 297 - 16mm margem
      const ratio = renderedCanvas.width / renderedCanvas.height;

      let drawW = pageW;
      let drawH = drawW / ratio;
      if (drawH > pageH) {
        drawH = pageH;
        drawW = drawH * ratio;
      }

      const offsetX = (210 - drawW) / 2;
      const offsetY = (297 - drawH) / 2;
      docPdf.addImage(imgData, 'JPEG', offsetX, offsetY, drawW, drawH);
    }

    const safeFile = dName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'decklist';
    docPdf.save(`decklist-torneio-${safeFile}.pdf`);
  };

  // Baixar apenas a Imagem PNG se o usuário desejar
  const handleDownloadOnlyPng = async () => {
    const renderedCanvas = await renderDeckCanvas();
    if (!renderedCanvas) return;
    const dataUrl = renderedCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    const safeName = (deckTitle || 'deck-light-dark').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.download = `${safeName}-imagem.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div
      className="fixed inset-0 z-[195] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[#0d0f18] border border-emerald-500/40 rounded-2xl max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider flex items-center gap-2 flex-wrap">
                <span>Lista de Torneio & Imagem do Deck (PDF + PNG)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold">
                  Pág. 1: Lista Escrita • Última Pág.: Imagem do Deck
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Gera o PDF oficial de torneio com a lista de check-in na Página 1, o código do deck e a imagem completa com todas as cartas na última página.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
          {/* Painel Esquerdo: Dados do Jogador + Código + Botões de Exportação */}
          <div className="lg:col-span-4 space-y-4 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 h-fit">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <User size={13} className="text-emerald-400" />
                <span>Nome do Jogador (Duelista)</span>
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Digite seu nome ou nick..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Layers size={13} className="text-emerald-400" />
                <span>Nome do Deck</span>
              </label>
              <input
                type="text"
                value={deckTitle}
                onChange={(e) => setDeckTitle(e.target.value)}
                placeholder="Ex: Deck Jim Controle"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Trophy size={13} className="text-emerald-400" />
                <span>Nome do Evento / Torneio</span>
              </label>
              <input
                type="text"
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
                placeholder="Torneio Oficial Light Dark TCG"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
              />
            </div>

            {/* Código do Deck sempre visível */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  Código Oficial do Deck (Incluído no PDF/Imagem)
                </span>
                {deckCode && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(deckCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    className="text-[10px] font-bold text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded"
                  >
                    {copiedCode ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copiedCode ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                )}
              </div>
              <input
                readOnly
                value={deckCode || 'Adicione cartas ao deck...'}
                className="w-full bg-black border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-green-400 select-all outline-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
              <span>
                Total: <strong className="text-white">{deck.length} Principal</strong> +{' '}
                <strong className="text-white">{sideDeck.length} Side</strong>
              </span>
              <span className={`font-bold ${isValidDeck ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isValidDeck ? '✓ Válido p/ Torneio' : '⚠ Em montagem'}
              </span>
            </div>

            {/* Botões de Download */}
            <div className="pt-2 space-y-2.5">
              <button
                type="button"
                onClick={handleDownloadUnifiedPdf}
                disabled={isRendering || (deck.length === 0 && sideDeck.length === 0)}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition cursor-pointer"
              >
                <Download size={16} />
                <span>Baixar PDF (Pág 1 Lista + Última Pág Imagem)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadOnlyPng}
                disabled={isRendering || (deck.length === 0 && sideDeck.length === 0)}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <ImageIcon size={15} />
                <span>Baixar Somente Imagem do Deck (PNG)</span>
              </button>

              <button
                type="button"
                onClick={renderDeckCanvas}
                disabled={isRendering}
                className="w-full py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1.5 border border-slate-800 transition cursor-pointer"
              >
                <RefreshCw size={13} className={isRendering ? 'animate-spin text-emerald-400' : ''} />
                <span>{isRendering ? 'Carregando Imagens das Cartas...' : 'Atualizar Imagem'}</span>
              </button>
            </div>
          </div>

          {/* Painel Direito: Prévia da Imagem do Deck com as Cartas Reais */}
          <div className="lg:col-span-8 flex flex-col bg-slate-950/90 border border-slate-800 rounded-2xl p-3 sm:p-4 overflow-auto relative min-h-[420px]">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <ImageIcon size={15} className="text-purple-400" />
                <span>Prévia da Última Página do PDF / Imagem do Deck</span>
              </span>
              {isRendering && (
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <RefreshCw size={13} className="animate-spin" />
                  Renderizando cartas em alta resolução...
                </span>
              )}
            </div>

            {deck.length === 0 && sideDeck.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-16">
                <FileText size={40} className=" mb-2 opacity-40" />
                <p className="text-sm font-bold">Adicione cartas ao seu deck para gerar o PDF e a Imagem.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Canvas oficial de exportação */}
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto rounded-xl shadow-2xl border border-slate-800"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
