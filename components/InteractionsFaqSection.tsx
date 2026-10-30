import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Scale,
  Plus,
  CheckCircle,
  MessageCircle,
  Shield,
  Trash2,
  Save,
  X,
  Edit2,
  UserCheck,
  HelpCircle,
  Loader2,
  Eye
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { db, readBrowserCache, writeBrowserCache } from '../firebase';
import { useAuth } from '../authService';
import { useCards, sanitizeForFirestore } from '../CardContext';
import { CardData } from '../types';
import { CardDetailModal } from './CardDetailModal';

export interface AmbassadorEntry {
  email: string;
  name: string;
  roleTitle: string;
  addedAt: string;
}

export interface FaqInteractionItem {
  id: string;
  question: string;
  answer: string;
  cardACode?: string;
  cardBCode?: string;
  tags?: string[];
  status: 'answered' | 'pending';
  askedByName?: string;
  askedByEmail?: string;
  answeredByName?: string;
  answeredByRole?: string;
  answeredByEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export const InteractionsFaqSection: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { cards: allCards } = useCards();

  const [ambassadors, setAmbassadors] = useState<AmbassadorEntry[]>(
    () => readBrowserCache<AmbassadorEntry[]>('ld_cache_faqAmbassadors_v1') || []
  );
  const [faqItems, setFaqItems] = useState<FaqInteractionItem[]>(
    () => readBrowserCache<FaqInteractionItem[]>('ld_cache_faqItems_v2') || []
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'answered' | 'pending'>('answered');
  const [inspectedCard, setInspectedCard] = useState<CardData | null>(null);

  // Ambassador management modal (Admin only)
  const [showAmbassadorManager, setShowAmbassadorManager] = useState(false);
  const [newAmbEmail, setNewAmbEmail] = useState('');
  const [newAmbName, setNewAmbName] = useState('');
  const [newAmbRole, setNewAmbRole] = useState('Embaixador Oficial / Juiz');
  const [savingAmbassadors, setSavingAmbassadors] = useState(false);

  // Ask question / Create ruling modal
  const [showAskForm, setShowAskForm] = useState(false);
  const [qText, setQText] = useState('');
  const [qAnswerText, setQAnswerText] = useState('');
  const [qCardA, setQCardA] = useState('');
  const [qCardB, setQCardB] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);

  // Answering / editing a specific item (Admin or Ambassador)
  const [answeringItemId, setAnsweringItemId] = useState<string | null>(null);
  const [draftAnswer, setDraftAnswer] = useState('');
  const [draftQuestion, setDraftQuestion] = useState('');
  const [savingAnswer, setSavingAnswer] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'homeSettings', 'faqAmbassadors'))
      .then((snap) => {
        if (snap.exists() && Array.isArray(snap.data()?.list)) {
          const loaded = snap.data().list as AmbassadorEntry[];
          setAmbassadors(loaded);
          writeBrowserCache('ld_cache_faqAmbassadors_v1', loaded);
        }
      })
      .catch(() => {});

    const unsub = onSnapshot(
      collection(db, 'faqInteractions'),
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) } as FaqInteractionItem))
          .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        setFaqItems(docs);
        writeBrowserCache('ld_cache_faqItems_v2', docs);
      },
      () => {}
    );

    return () => unsub();
  }, []);

  // Check if current logged-in user is an authorized Ambassador or Admin
  const currentAmbassador = useMemo(() => {
    if (!user?.email) return null;
    const cleanEmail = user.email.trim().toLowerCase();
    return ambassadors.find((a) => a.email.trim().toLowerCase() === cleanEmail) || null;
  }, [user, ambassadors]);

  const canAnswerQuestions = Boolean(isAdmin || currentAmbassador);

  const pendingCount = useMemo(
    () => faqItems.filter((item) => item.status === 'pending').length,
    [faqItems]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return faqItems.filter((item) => {
      if (filterTab === 'answered' && item.status !== 'answered') return false;
      if (filterTab === 'pending' && item.status !== 'pending') return false;
      if (!q) return true;
      const cardA = item.cardACode ? allCards.find((c) => c.code === item.cardACode) : null;
      const cardB = item.cardBCode ? allCards.find((c) => c.code === item.cardBCode) : null;
      return (
        item.question.toLowerCase().includes(q) ||
        (item.answer && item.answer.toLowerCase().includes(q)) ||
        (cardA && cardA.name.toLowerCase().includes(q)) ||
        (cardB && cardB.name.toLowerCase().includes(q))
      );
    });
  }, [faqItems, filterTab, searchQuery, allCards]);

  const handleAddAmbassador = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailClean = newAmbEmail.trim().toLowerCase();
    if (!emailClean || !emailClean.includes('@')) return;

    const updated: AmbassadorEntry[] = [
      ...ambassadors.filter((a) => a.email.toLowerCase() !== emailClean),
      {
        email: emailClean,
        name: newAmbName.trim() || emailClean.split('@')[0],
        roleTitle: newAmbRole.trim() || 'Embaixador Oficial / Juiz',
        addedAt: new Date().toISOString()
      }
    ];

    try {
      setSavingAmbassadors(true);
      await setDoc(
        doc(db, 'homeSettings', 'faqAmbassadors'),
        sanitizeForFirestore({ list: updated, updatedAt: new Date().toISOString() }),
        { merge: true }
      );
      setAmbassadors(updated);
      writeBrowserCache('ld_cache_faqAmbassadors_v1', updated);
      setNewAmbEmail('');
      setNewAmbName('');
    } catch (err) {
      console.error('Erro ao salvar embaixador:', err);
      alert('Erro ao autorizar embaixador.');
    } finally {
      setSavingAmbassadors(false);
    }
  };

  const handleRemoveAmbassador = async (email: string) => {
    const updated = ambassadors.filter((a) => a.email.toLowerCase() !== email.toLowerCase());
    try {
      setSavingAmbassadors(true);
      await setDoc(
        doc(db, 'homeSettings', 'faqAmbassadors'),
        sanitizeForFirestore({ list: updated, updatedAt: new Date().toISOString() }),
        { merge: true }
      );
      setAmbassadors(updated);
      writeBrowserCache('ld_cache_faqAmbassadors_v1', updated);
    } catch (err) {
      console.error('Erro ao remover embaixador:', err);
    } finally {
      setSavingAmbassadors(false);
    }
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qText.trim()) return;

    const now = new Date().toISOString();
    const isDirectAnswer = canAnswerQuestions && qAnswerText.trim().length > 0;
    const itemId = `faq_${Date.now()}`;

    const newItem: FaqInteractionItem = {
      id: itemId,
      question: qText.trim(),
      answer: isDirectAnswer ? qAnswerText.trim() : '',
      cardACode: qCardA || '',
      cardBCode: qCardB || '',
      status: isDirectAnswer ? 'answered' : 'pending',
      askedByName: user?.displayName || 'Duelista da Comunidade',
      askedByEmail: user?.email || '',
      answeredByName: isDirectAnswer
        ? isAdmin
          ? 'Mestre (Oficial)'
          : currentAmbassador?.name || user?.displayName || 'Embaixador'
        : '',
      answeredByRole: isDirectAnswer
        ? isAdmin
          ? 'Criador do Jogo'
          : currentAmbassador?.roleTitle || 'Embaixador Oficial'
        : '',
      answeredByEmail: isDirectAnswer ? user?.email || '' : '',
      createdAt: now,
      updatedAt: now
    };

    try {
      setSubmittingQuestion(true);
      await setDoc(doc(db, 'faqInteractions', itemId), sanitizeForFirestore(newItem));
      setQText('');
      setQAnswerText('');
      setQCardA('');
      setQCardB('');
      setShowAskForm(false);
      if (!isDirectAnswer) {
        setFilterTab('pending');
      }
    } catch (err) {
      console.error('Erro ao enviar dúvida:', err);
      alert('Erro ao publicar dúvida. Verifique sua conexão.');
    } finally {
      setSubmittingQuestion(false);
    }
  };

  const handleSaveOfficialAnswer = async (item: FaqInteractionItem) => {
    if (!draftAnswer.trim() || !canAnswerQuestions) return;
    try {
      setSavingAnswer(true);
      const now = new Date().toISOString();
      const updated: FaqInteractionItem = {
        ...item,
        question: draftQuestion.trim() || item.question,
        answer: draftAnswer.trim(),
        status: 'answered',
        answeredByName: isAdmin
          ? 'Mestre (Oficial)'
          : currentAmbassador?.name || user?.displayName || 'Embaixador Oficial',
        answeredByRole: isAdmin
          ? 'Criador do Jogo'
          : currentAmbassador?.roleTitle || 'Embaixador Oficial / Juiz',
        answeredByEmail: user?.email || '',
        updatedAt: now
      };
      await setDoc(doc(db, 'faqInteractions', item.id), sanitizeForFirestore(updated));
      setAnsweringItemId(null);
      setFilterTab('answered');
    } catch (err) {
      console.error('Erro ao salvar resposta oficial:', err);
      alert('Erro ao salvar resposta.');
    } finally {
      setSavingAnswer(false);
    }
  };

  const handleDeleteFaqItem = async (itemId: string) => {
    if (!canAnswerQuestions) return;
    try {
      await deleteDoc(doc(db, 'faqInteractions', itemId));
      setFaqItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      console.error('Erro ao remover item do FAQ:', err);
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-500/40 bg-slate-950 overflow-hidden shadow-lg shadow-black/40 p-4 sm:p-6 space-y-5">
      {inspectedCard && (
        <CardDetailModal card={inspectedCard} onClose={() => setInspectedCard(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
            <Scale size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">
                Juiz Digital & Rulings
              </span>
              {canAnswerQuestions && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <Shield size={11} />
                  <span>{isAdmin ? 'Mestre / Admin' : `Embaixador: ${currentAmbassador?.roleTitle}`}</span>
                </span>
              )}
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-wide">
              FAQ Rápido de Interações entre Cartas
            </h3>
            <p className="text-xs text-slate-400">
              Pesquise decisões oficiais sobre combos e interações ou envie sua dúvida para o Mestre e os Embaixadores Oficiais responderem!
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAmbassadorManager((prev) => !prev)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                showAmbassadorManager
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-500/40'
              }`}
            >
              <UserCheck size={14} />
              <span>Autorizar Embaixadores ({ambassadors.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAskForm((prev) => !prev)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <Plus size={14} />
            <span>{canAnswerQuestions ? 'Nova Interação / Pergunta' : 'Perguntar Interação'}</span>
          </button>
        </div>
      </div>

      {/* Ambassador Manager Panel (Admin Only) */}
      {isAdmin && showAmbassadorManager && (
        <div className="bg-slate-900/95 border-2 border-amber-500/50 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div>
              <h4 className="text-sm font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <UserCheck size={16} />
                <span>Gerenciar Embaixadores Autorizados a Responder no FAQ</span>
              </h4>
              <p className="text-xs text-slate-400">
                Adicione o e-mail da conta Google do jogador. Quando ele entrar no site com esse e-mail, poderá responder dúvidas pendentes e cadastrar decisões oficiais!
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAmbassadorManager(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleAddAmbassador} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <input
              type="email"
              required
              value={newAmbEmail}
              onChange={(e) => setNewAmbEmail(e.target.value)}
              placeholder="E-mail do Embaixador (ex: jogador@gmail.com)"
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              value={newAmbName}
              onChange={(e) => setNewAmbName(e.target.value)}
              placeholder="Nome / Apelido do Embaixador"
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              value={newAmbRole}
              onChange={(e) => setNewAmbRole(e.target.value)}
              placeholder="Título (ex: Embaixador Oficial / Juiz)"
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-300 font-bold"
            />
            <button
              type="submit"
              disabled={savingAmbassadors}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5"
            >
              {savingAmbassadors ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              <span>Autorizar Embaixador</span>
            </button>
          </form>

          {ambassadors.length === 0 ? (
            <div className="text-xs text-slate-500 italic">
              Nenhum embaixador cadastrado ainda. Adicione um e-mail acima para autorizar!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {ambassadors.map((amb) => (
                <div
                  key={amb.email}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{amb.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">{amb.email}</div>
                    <div className="text-[10px] text-amber-400 font-bold">{amb.roleTitle}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveAmbassador(amb.email)}
                    className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 shrink-0"
                    title="Remover Permissão"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ask Question / Add Ruling Form */}
      {showAskForm && (
        <form
          onSubmit={handleSubmitQuestion}
          className="bg-slate-900/95 border border-indigo-500/50 rounded-2xl p-4 sm:p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-sm font-black text-white uppercase">
              {canAnswerQuestions
                ? 'Publicar Interação Oficial ou Enviar Dúvida'
                : 'Enviar Dúvida de Interação para os Embaixadores'}
            </h4>
            <button
              type="button"
              onClick={() => setShowAskForm(false)}
              className="text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                Carta 1 Envolvida (Opcional)
              </label>
              <select
                value={qCardA}
                onChange={(e) => setQCardA(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
              >
                <option value="">-- Nenhuma / Geral --</option>
                {allCards.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                Carta 2 Envolvida (Opcional)
              </label>
              <select
                value={qCardB}
                onChange={(e) => setQCardB(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
              >
                <option value="">-- Nenhuma / Geral --</option>
                {allCards.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-300 block mb-1">
              Qual é a dúvida de interação ou situação de jogo?
            </label>
            <textarea
              required
              rows={2}
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Ex: Se a Carta X atacar um combatente equipado com a Carta Y..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white"
            />
          </div>

          {canAnswerQuestions && (
            <div>
              <label className="text-[11px] font-bold text-emerald-300 block mb-1">
                Resposta Oficial Imediata (Como você é Admin/Embaixador, já pode publicar respondida!)
              </label>
              <textarea
                rows={3}
                value={qAnswerText}
                onChange={(e) => setQAnswerText(e.target.value)}
                placeholder="Digite a resolução oficial..."
                className="w-full bg-slate-950 border border-emerald-500/40 rounded-lg p-2.5 text-xs text-white"
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAskForm(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submittingQuestion}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5"
            >
              {submittingQuestion ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{canAnswerQuestions && qAnswerText.trim() ? 'Publicar Decisão Oficial' : 'Enviar Pergunta'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar carta, efeito ou dúvida no FAQ de Interações..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setFilterTab('answered')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterTab === 'answered'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Respondidas ({faqItems.filter((i) => i.status === 'answered').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              filterTab === 'pending'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Dúvidas Pendentes</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* FAQ Items List */}
      <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
            Nenhuma interação encontrada para este filtro.
          </div>
        ) : (
          filteredItems.map((item) => {
            const cardA = item.cardACode ? allCards.find((c) => c.code === item.cardACode) : null;
            const cardB = item.cardBCode ? allCards.find((c) => c.code === item.cardBCode) : null;
            const isEditingThis = answeringItemId === item.id;

            return (
              <div
                key={item.id}
                className="bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 rounded-xl p-4 space-y-3 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    {(cardA || cardB) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {cardA && (
                          <button
                            type="button"
                            onClick={() => setInspectedCard(cardA)}
                            className="px-2.5 py-0.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold flex items-center gap-1"
                          >
                            <Eye size={11} />
                            <span>{cardA.name}</span>
                          </button>
                        )}
                        {cardA && cardB && <span className="text-xs text-slate-500 font-black">×</span>}
                        {cardB && (
                          <button
                            type="button"
                            onClick={() => setInspectedCard(cardB)}
                            className="px-2.5 py-0.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-500/30 text-[11px] font-bold flex items-center gap-1"
                          >
                            <Eye size={11} />
                            <span>{cardB.name}</span>
                          </button>
                        )}
                      </div>
                    )}

                    <h4 className="text-sm sm:text-base font-bold text-white flex items-start gap-2">
                      <HelpCircle size={16} className="text-indigo-400 shrink-0 mt-0.5" />
                      <span>{item.question}</span>
                    </h4>
                  </div>

                  {canAnswerQuestions && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingThis) {
                            setAnsweringItemId(null);
                          } else {
                            setAnsweringItemId(item.id);
                            setDraftQuestion(item.question);
                            setDraftAnswer(item.answer || '');
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1"
                      >
                        <Edit2 size={12} />
                        <span>{item.status === 'pending' ? 'Responder' : 'Editar'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFaqItem(item.id)}
                        className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900 text-rose-300"
                        title="Excluir pergunta"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {isEditingThis ? (
                  <div className="space-y-2.5 pt-2 border-t border-slate-800">
                    <input
                      type="text"
                      value={draftQuestion}
                      onChange={(e) => setDraftQuestion(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white font-bold"
                    />
                    <textarea
                      rows={3}
                      value={draftAnswer}
                      onChange={(e) => setDraftAnswer(e.target.value)}
                      placeholder="Digite a resposta oficial do Juiz / Embaixador..."
                      className="w-full bg-slate-950 border border-emerald-500/50 rounded-lg p-2.5 text-xs text-white"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setAnsweringItemId(null)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={savingAnswer}
                        onClick={() => handleSaveOfficialAnswer(item)}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        {savingAnswer ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                        <span>Salvar Resposta Oficial</span>
                      </button>
                    </div>
                  </div>
                ) : item.status === 'answered' ? (
                  <div className="bg-slate-950/90 border-l-4 border-emerald-500 rounded-r-xl p-3.5 space-y-2">
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {item.answer}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                      <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                        <CheckCircle size={12} />
                        <span>
                          Respondido por {item.answeredByName || 'Mestre'} ({item.answeredByRole || 'Juiz Oficial'})
                        </span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-500/30 rounded-lg p-2.5 flex items-center justify-between">
                    <span>Aguardando resposta oficial do Mestre ou de um Embaixador...</span>
                    {item.askedByName && (
                      <span className="text-[11px] text-slate-400">Enviada por {item.askedByName}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
