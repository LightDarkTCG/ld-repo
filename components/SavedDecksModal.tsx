import React, { useState } from 'react';
import { 
  X, 
  Layers, 
  Cloud, 
  Save, 
  Trash2, 
  Play, 
  Copy, 
  Check, 
  LogIn, 
  Calendar, 
  Plus, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { CardData } from '../types';
import { useAuth } from '../authService';
import { useSavedDecks, UserSavedDeck } from '../savedDecksService';
import { cleanCardCode } from '../CardContext';

interface SavedDecksModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMainDeck?: CardData[];
  currentSideDeck?: CardData[];
  onLoadDeck: (mainDeck: CardData[], sideDeck: CardData[]) => void;
  allCards: CardData[];
}

export const SavedDecksModal: React.FC<SavedDecksModalProps> = ({
  isOpen,
  onClose,
  currentMainDeck = [],
  currentSideDeck = [],
  onLoadDeck,
  allCards
}) => {
  const { user, loginWithGoogle } = useAuth();
  const { decks, loading, saveDeck, deleteDeck } = useSavedDecks(user?.uid);

  const [deckNameInput, setDeckNameInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Encontra hero para capa
  const detectedHero = currentMainDeck.find(c => c.type === 'Herói') || currentMainDeck[0];

  const handleSaveCurrentDeck = async () => {
    if (!user) {
      await loginWithGoogle();
      return;
    }

    if (currentMainDeck.length === 0) {
      alert('Seu deck atual está vazio. Adicione cartas antes de salvar.');
      return;
    }

    const name = (deckNameInput.trim() || `Deck de ${detectedHero?.name || 'Light Dark'}`);
    setIsSaving(true);
    try {
      await saveDeck({
        name,
        heroName: detectedHero?.name || '',
        mainDeckCodes: currentMainDeck.map(c => cleanCardCode(c.code)),
        sideDeckCodes: currentSideDeck.map(c => cleanCardCode(c.code)),
        coverImageUrl: detectedHero?.imageUrl || ''
      });
      setDeckNameInput('');
      alert(`Deck "${name}" salvo na nuvem com sucesso!`);
    } catch (err: any) {
      console.error('Erro ao salvar deck:', err);
      alert('Não foi possível salvar o deck. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadSavedDeck = (savedDeck: UserSavedDeck) => {
    // Reconstruir o Main Deck a partir dos códigos
    const mainList: CardData[] = [];
    (savedDeck.mainDeckCodes || []).forEach(code => {
      const cleanTarget = cleanCardCode(code).toLowerCase();
      const match = allCards.find(c => cleanCardCode(c.code).toLowerCase() === cleanTarget);
      if (match) {
        mainList.push(match);
      }
    });

    // Reconstruir o Side Deck a partir dos códigos
    const sideList: CardData[] = [];
    (savedDeck.sideDeckCodes || []).forEach(code => {
      const cleanTarget = cleanCardCode(code).toLowerCase();
      const match = allCards.find(c => cleanCardCode(c.code).toLowerCase() === cleanTarget);
      if (match) {
        sideList.push(match);
      }
    });

    onLoadDeck(mainList, sideList);
    onClose();
  };

  const handleCopyDeckCodes = (savedDeck: UserSavedDeck) => {
    const lines = [
      `// --- DECK: ${savedDeck.name} ---`,
      `// MAIN DECK (${savedDeck.mainDeckCodes.length} cartas):`,
      ...savedDeck.mainDeckCodes,
      ...(savedDeck.sideDeckCodes?.length ? [`// SIDE DECK (${savedDeck.sideDeckCodes.length} cartas):`, ...savedDeck.sideDeckCodes] : [])
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedId(savedDeck.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0c101c] w-full max-w-4xl max-h-[90vh] rounded-2xl border border-purple-900/50 shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* HEADER */}
        <div className="p-4 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-950 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Cloud size={22} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                Meus Decks na Nuvem
              </h2>
              <p className="text-xs text-slate-400">
                Salve, carregue e organize seus decks oficiais sincronizados com sua conta Google.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={22} />
          </button>
        </div>

        {/* ÁREA DE SALVAR O DECK ATUAL */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300">Deck em Edição:</span>
            <span className="text-xs font-mono font-bold bg-purple-950 text-purple-300 border border-purple-700/50 px-2 py-0.5 rounded-lg">
              {currentMainDeck.length} cartas
            </span>
            {currentSideDeck.length > 0 && (
              <span className="text-xs font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg">
                +{currentSideDeck.length} side
              </span>
            )}
            {detectedHero && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                ({detectedHero.name})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[280px]">
            <input
              type="text"
              placeholder="Nome do deck (ex: Insanis Controle)"
              value={deckNameInput}
              onChange={(e) => setDeckNameInput(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 flex-1 outline-none focus:border-purple-500 transition"
            />
            <button
              onClick={handleSaveCurrentDeck}
              disabled={isSaving || currentMainDeck.length === 0}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md ${
                currentMainDeck.length > 0
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/50'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Save size={14} />
              <span>{isSaving ? 'Salvando...' : 'Salvar Deck'}</span>
            </button>
          </div>
        </div>

        {/* AVISO SE NÃO ESTIVER LOGADO */}
        {!user && (
          <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-xl bg-purple-950/40 border border-purple-600/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-purple-400 shrink-0" />
              <div className="text-xs text-slate-300">
                <span className="font-bold text-white block">Acesse com sua conta Google</span>
                Conecte-se para manter seus decks salvos para sempre e acessíveis em qualquer dispositivo.
              </div>
            </div>
            <button
              onClick={loginWithGoogle}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition flex items-center gap-2 shadow-md shadow-purple-950"
            >
              <LogIn size={14} />
              <span>Entrar com Google</span>
            </button>
          </div>
        )}

        {/* LISTA DE DECKS SALVOS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              Carregando seus decks salvos...
            </div>
          ) : decks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-center text-slate-400">
              <Layers size={36} className="text-slate-600 mb-2" />
              <p className="text-sm font-bold text-slate-300">Você ainda não tem decks salvos na nuvem.</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Monte seu deck no construtor e use o campo acima para salvar com um nome personalizado.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {decks.map((deck) => (
                <div
                  key={deck.id}
                  className="bg-slate-900/90 border border-slate-800 hover:border-purple-600/50 rounded-xl p-3 sm:p-4 flex flex-col justify-between transition group shadow-md"
                >
                  <div className="flex items-start gap-3">
                    {/* MINIATURA DA CAPA */}
                    <div className="w-14 h-20 rounded-lg overflow-hidden bg-slate-950 border border-slate-700/60 shrink-0 flex items-center justify-center">
                      {deck.coverImageUrl ? (
                        <img src={deck.coverImageUrl} alt={deck.name} className="w-full h-full object-cover" />
                      ) : (
                        <Layers size={20} className="text-purple-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm sm:text-base font-bold text-white truncate group-hover:text-purple-300 transition">
                        {deck.name}
                      </h4>
                      {deck.heroName && (
                        <span className="text-xs text-slate-400 block truncate">
                          Herói: {deck.heroName}
                        </span>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/40">
                          {deck.cardCount || deck.mainDeckCodes.length} cartas
                        </span>
                        {deck.sideDeckCodes?.length > 0 && (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            +{deck.sideDeckCodes.length} side
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* AÇÕES */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleLoadSavedDeck(deck)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
                      title="Carregar este deck no Construtor"
                    >
                      <Play size={13} />
                      <span>Carregar</span>
                    </button>

                    <button
                      onClick={() => handleCopyDeckCodes(deck)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                      title="Copiar códigos do deck"
                    >
                      {copiedId === deck.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>

                    <button
                      onClick={() => {
                        if (confirmDeleteId === deck.id) {
                          deleteDeck(deck.id);
                          setConfirmDeleteId(null);
                        } else {
                          setConfirmDeleteId(deck.id);
                          setTimeout(() => setConfirmDeleteId(null), 3000);
                        }
                      }}
                      className={`p-1.5 rounded-lg transition ${
                        confirmDeleteId === deck.id 
                          ? 'bg-red-600 text-white animate-pulse' 
                          : 'bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400'
                      }`}
                      title={confirmDeleteId === deck.id ? 'Confirmar exclusão?' : 'Excluir deck'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-purple-400" />
            <span>Decks salvos incluem tanto o Main Deck quanto o Side Deck.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
