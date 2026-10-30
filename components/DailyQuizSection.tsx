import React, { useState, useEffect, useMemo } from 'react';
import {
  HelpCircle,
  CheckCircle,
  X,
  Plus,
  Trash2,
  Save,
  Settings,
  Eye,
  Calendar,
  Award,
  Upload,
  Loader2,
  ArrowUp,
  ArrowDown,
  Trophy
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, readBrowserCache, writeBrowserCache } from '../firebase';
import { CardData } from '../types';
import { useCards, sanitizeForFirestore } from '../CardContext';
import { useAuth } from '../authService';
import { CardDetailModal } from './CardDetailModal';

export type DailyQuestionType = 'blurred_art' | 'effect_guess' | 'lore_question' | 'ruling_question';

export interface DailyQuizQuestion {
  id: string;
  type: DailyQuestionType;
  releaseDate?: string; // Optional YYYY-MM-DD; if empty, unlocked sequentially 1 per day
  pointsReward?: number; // Pontos concedidos à conta ao acertar
  prompt: string;
  cardCode?: string;
  customImageUrl?: string;
  clueText?: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

const QUESTION_TYPE_LABELS: Record<DailyQuestionType, string> = {
  blurred_art: 'Arte Borrada (Adivinhe a Carta)',
  effect_guess: 'Adivinhe pelo Efeito / Status',
  lore_question: 'Pergunta de Lore do Macroverso',
  ruling_question: 'Desafio de Regra / Interação'
};

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDayNumberSinceEpoch(): number {
  const now = new Date();
  const utc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(utc / (1000 * 60 * 60 * 24));
}

export const DailyQuizSection: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const { cards: allCards } = useCards();
  const { user } = useAuth();

  // Sem perguntas pré-preenchidas: inicia vazio até o Admin cadastrar
  const [questions, setQuestions] = useState<DailyQuizQuestion[]>(
    () => readBrowserCache<DailyQuizQuestion[]>('ld_cache_dailyQuiz_v2') || []
  );
  const [baseStartDate, setBaseStartDate] = useState<string>('2026-10-29');

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasAnsweredToday, setHasAnsweredToday] = useState(false);
  const [streak, setStreak] = useState<number>(0);
  const [inspectedCard, setInspectedCard] = useState<CardData | null>(null);

  // Pontuação oficial da conta do jogador logado + Ranking
  const [accountQuizPoints, setAccountQuizPoints] = useState<number>(0);
  const [accountAnsweredIds, setAccountAnsweredIds] = useState<string[]>([]);
  const [pointsEarnedToast, setPointsEarnedToast] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<
    { userId: string; displayName: string; photoURL?: string; quizPoints: number }[]
  >([]);

  // Admin modal state
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [uploadingQId, setUploadingQId] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [previewQuestionIdx, setPreviewQuestionIdx] = useState<number | null>(null);

  const todayKey = getTodayKey();

  const loadLeaderboard = async () => {
    try {
      const snap = await getDocs(collection(db, 'collectorsRanking'));
      const entries = snap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            userId: d.id,
            displayName: data.displayName || 'Duelista',
            photoURL: data.photoURL || '',
            quizPoints: Number(data.quizPoints) || 0
          };
        })
        .filter((e) => e.quizPoints > 0)
        .sort((a, b) => b.quizPoints - a.quizPoints)
        .slice(0, 10);
      setLeaderboard(entries);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    getDoc(doc(db, 'homeSettings', 'dailyQuizSettings'))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data?.questions)) {
            setQuestions(data.questions as DailyQuizQuestion[]);
            writeBrowserCache('ld_cache_dailyQuiz_v2', data.questions);
          }
          if (data?.baseStartDate) {
            setBaseStartDate(data.baseStartDate);
          }
        }
      })
      .catch(() => {});

    loadLeaderboard();
  }, []);

  // Carrega pontuação da conta do usuário no Firestore
  useEffect(() => {
    if (!user?.uid) {
      setAccountQuizPoints(0);
      setAccountAnsweredIds([]);
      return;
    }
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as any;
          setAccountQuizPoints(Number(data.quizPoints) || 0);
          setAccountAnsweredIds(Array.isArray(data.quizAnsweredIds) ? data.quizAnsweredIds : []);
          if (typeof data.quizStreak === 'number') {
            setStreak(data.quizStreak);
          }
        }
      })
      .catch(() => {});
  }, [user?.uid]);

  // Determina a pergunta ativa do dia (ou pré-visualização do Admin)
  const activeQuestion = useMemo<DailyQuizQuestion | null>(() => {
    if (previewQuestionIdx !== null && questions[previewQuestionIdx]) {
      return questions[previewQuestionIdx];
    }
    if (questions.length === 0) return null;

    const exactMatch = questions.find((q) => q.releaseDate === todayKey);
    if (exactMatch) return exactMatch;

    const rotatingPool = questions.filter((q) => !q.releaseDate);
    const pool = rotatingPool.length > 0 ? rotatingPool : questions;

    const startParts = baseStartDate.split('-').map(Number);
    const startUtc =
      startParts.length === 3
        ? Date.UTC(startParts[0], startParts[1] - 1, startParts[2])
        : Date.UTC(2026, 9, 29);
    const startDay = Math.floor(startUtc / (1000 * 60 * 60 * 24));
    const currentDay = getDayNumberSinceEpoch();
    const diff = Math.max(0, currentDay - startDay);

    return pool[diff % pool.length];
  }, [questions, todayKey, baseStartDate, previewQuestionIdx]);

  // Sincroniza estado se o usuário já respondeu a pergunta ativa hoje
  useEffect(() => {
    if (!activeQuestion) return;
    if (previewQuestionIdx !== null) return;

    const answeredKey = `ld_daily_quiz_ans_${todayKey}_${activeQuestion.id}`;
    try {
      const savedAns = localStorage.getItem(answeredKey);
      if (savedAns !== null) {
        setSelectedOption(Number(savedAns));
        setHasAnsweredToday(true);
        return;
      }
    } catch {
      // ignore
    }

    if (accountAnsweredIds.includes(`${todayKey}_${activeQuestion.id}`) || accountAnsweredIds.includes(activeQuestion.id)) {
      setSelectedOption(activeQuestion.correctIndex);
      setHasAnsweredToday(true);
    } else {
      setSelectedOption(null);
      setHasAnsweredToday(false);
    }
  }, [activeQuestion?.id, todayKey, accountAnsweredIds, previewQuestionIdx]);

  const questionCard = useMemo<CardData | null>(() => {
    if (!activeQuestion?.cardCode) return null;
    return allCards.find((c) => c.code === activeQuestion.cardCode) || null;
  }, [activeQuestion, allCards]);

  const handleSelectOption = async (idx: number) => {
    if (hasAnsweredToday && previewQuestionIdx === null) return;
    setSelectedOption(idx);
    setHasAnsweredToday(true);

    if (!activeQuestion || previewQuestionIdx !== null) return;

    const isCorrect = idx === activeQuestion.correctIndex;
    const reward = Number(activeQuestion.pointsReward) || 10;
    const answerToken = `${todayKey}_${activeQuestion.id}`;

    try {
      localStorage.setItem(`ld_daily_quiz_ans_${todayKey}_${activeQuestion.id}`, String(idx));
    } catch {
      // ignore
    }

    const nextStreak = isCorrect ? streak + 1 : 0;
    setStreak(nextStreak);

    // Se o jogador estiver logado e acertou (e ainda não pontuou nesta pergunta)
    if (user?.uid) {
      const alreadyScored =
        accountAnsweredIds.includes(answerToken) || accountAnsweredIds.includes(activeQuestion.id);
      const nextPoints = isCorrect && !alreadyScored ? accountQuizPoints + reward : accountQuizPoints;
      const nextAnsweredIds = alreadyScored
        ? accountAnsweredIds
        : [...accountAnsweredIds, answerToken, activeQuestion.id];

      setAccountQuizPoints(nextPoints);
      setAccountAnsweredIds(nextAnsweredIds);

      if (isCorrect && !alreadyScored) {
        setPointsEarnedToast(reward);
        setTimeout(() => setPointsEarnedToast(null), 5000);
      }

      try {
        await setDoc(
          doc(db, 'users', user.uid),
          sanitizeForFirestore({
            displayName: user.displayName || user.email?.split('@')[0] || 'Duelista',
            email: user.email || '',
            photoURL: user.photoURL || '',
            quizPoints: nextPoints,
            quizStreak: nextStreak,
            quizAnsweredIds: nextAnsweredIds,
            quizUpdatedAt: new Date().toISOString()
          }),
          { merge: true }
        );

        await setDoc(
          doc(db, 'collectorsRanking', user.uid),
          sanitizeForFirestore({
            userId: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'Duelista',
            photoURL: user.photoURL || '',
            quizPoints: nextPoints,
            updatedAt: new Date().toISOString()
          }),
          { merge: true }
        );

        loadLeaderboard();
      } catch (err) {
        console.error('Erro ao salvar pontuação do Quiz na conta:', err);
      }
    }
  };

  const handleSaveQuizSettings = async () => {
    try {
      setSavingQuiz(true);
      const payload = sanitizeForFirestore({
        questions,
        baseStartDate,
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'homeSettings', 'dailyQuizSettings'), payload, { merge: true });
      writeBrowserCache('ld_cache_dailyQuiz_v2', questions);
      setSaveFeedback('Banco de perguntas salvo! Uma pergunta será liberada por dia.');
      setTimeout(() => setSaveFeedback(null), 3500);
    } catch (err) {
      console.error('Erro ao salvar Quiz Diário:', err);
      alert('Erro ao salvar o banco de perguntas.');
    } finally {
      setSavingQuiz(false);
    }
  };

  const handleUploadQuestionImage = async (qId: string, file: File) => {
    try {
      setUploadingQId(qId);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageRef = ref(storage, `daily_quiz/${Date.now()}_${safeName}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setQuestions((prev) =>
        prev.map((q) => (q.id === qId ? { ...q, customImageUrl: url } : q))
      );
    } catch (err) {
      console.error('Erro no upload da imagem do quiz:', err);
      alert('Erro ao enviar imagem.');
    } finally {
      setUploadingQId(null);
    }
  };

  const handleAddQuestion = () => {
    const newQ: DailyQuizQuestion = {
      id: `dq-${Date.now()}`,
      type: 'lore_question',
      releaseDate: '',
      pointsReward: 10,
      prompt: '',
      clueText: '',
      cardCode: '',
      customImageUrl: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      explanation: ''
    };
    setQuestions((prev) => [...prev, newQ]);
  };

  const handleMoveQuestion = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    setQuestions((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  const handleAutoFillFromCard = (qId: string, selectedCode: string) => {
    const targetCard = allCards.find((c) => c.code === selectedCode);
    if (!targetCard) return;

    const distractors = allCards
      .filter((c) => c.code !== targetCard.code && c.name !== targetCard.name)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((c) => c.name);

    while (distractors.length < 3) {
      distractors.push(`Carta #${distractors.length + 1}`);
    }

    const correctPos = Math.floor(Math.random() * 4);
    const opts: [string, string, string, string] = ['', '', '', ''];
    let dIdx = 0;
    for (let i = 0; i < 4; i++) {
      if (i === correctPos) {
        opts[i] = targetCard.name;
      } else {
        opts[i] = distractors[dIdx++];
      }
    }

    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? {
              ...q,
              cardCode: targetCard.code,
              prompt:
                q.type === 'blurred_art'
                  ? 'Qual carta do universo Light Dark pertence a esta arte?'
                  : 'Qual carta possui este efeito/identidade?',
              clueText:
                q.type === 'effect_guess'
                  ? targetCard.description || `${targetCard.type} • ${targetCard.archetype}`
                  : `${targetCard.type} • Arquétipo: ${targetCard.archetype || 'Nenhum'}`,
              options: opts,
              correctIndex: correctPos,
              explanation: `A resposta correta é ${targetCard.name} (${targetCard.collection}).`
            }
          : q
      )
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {inspectedCard && (
        <CardDetailModal card={inspectedCard} onClose={() => setInspectedCard(null)} />
      )}

      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 border-b border-amber-500/20 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400 mb-2">
            <Calendar size={14} /> Desafio Diário do Archivum ({todayKey.split('-').reverse().join('/')})
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white uppercase tracking-tight">
            QUIZ DIÁRIO DO MACROVERSO
          </h2>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Teste seu conhecimento sobre a história e as regras de Light Dark TCG. Acertar desafios soma pontos permanentes na sua conta!
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-3.5 py-2 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-300 text-xs font-black flex items-center gap-2 shadow">
            <Trophy size={15} className="text-amber-400" />
            <span>
              {user ? `Sua Pontuação: ${accountQuizPoints} pts` : 'Entre na conta p/ pontuar'}
            </span>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold flex items-center gap-2">
            <Award size={15} className="text-purple-400" />
            <span>Ofensiva: {streak} {streak === 1 ? 'dia' : 'dias'}</span>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsAdminPanelOpen((prev) => !prev)}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition border ${
                isAdminPanelOpen
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg'
                  : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400/40 shadow-lg'
              }`}
            >
              <Settings size={14} />
              {isAdminPanelOpen ? 'Fechar Painel do Quiz' : 'Gerenciar Perguntas (Admin)'}
            </button>
          )}
        </div>
      </div>

      {/* Admin Panel for Managing Questions (1 released per day) */}
      {isAdmin && isAdminPanelOpen && (
        <div className="mb-10 rounded-3xl border border-amber-500/40 bg-slate-950 p-4 sm:p-6 space-y-5 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-black text-amber-300 flex items-center gap-2">
                <Settings size={18} />
                Banco de Perguntas do Quiz (Liberadas 1 por Dia)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cadastre suas perguntas. As perguntas sem data fixa entram na fila automática liberando 1 por dia.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-400">Início da Fila:</span>
                <input
                  type="date"
                  value={baseStartDate}
                  onChange={(e) => setBaseStartDate(e.target.value)}
                  className="bg-transparent text-xs text-white font-mono outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Plus size={14} className="text-amber-400" />
                Nova Pergunta
              </button>
              <button
                type="button"
                onClick={handleSaveQuizSettings}
                disabled={savingQuiz}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg transition disabled:opacity-50"
              >
                {savingQuiz ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar Banco ({questions.length})
              </button>
            </div>
          </div>

          {saveFeedback && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle size={15} />
              {saveFeedback}
            </div>
          )}

          {questions.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl text-slate-400 text-xs space-y-3">
              <p>Nenhuma pergunta cadastrada ainda.</p>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs inline-flex items-center gap-1.5"
              >
                <Plus size={14} /> Criar Primeira Pergunta
              </button>
            </div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {questions.map((q, qIdx) => (
                <div
                  key={q.id}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-700/50 text-[11px] font-mono font-bold">
                        Dia #{qIdx + 1}
                      </span>
                      <select
                        value={q.type}
                        onChange={(e) => {
                          const val = e.target.value as DailyQuestionType;
                          setQuestions((prev) =>
                            prev.map((item, i) => (i === qIdx ? { ...item, type: val } : item))
                          );
                        }}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-bold"
                      >
                        {Object.entries(QUESTION_TYPE_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-slate-400 font-mono">Pontos:</span>
                        <input
                          type="number"
                          min={1}
                          value={q.pointsReward ?? 10}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value) || 10);
                            setQuestions((prev) =>
                              prev.map((item, i) =>
                                i === qIdx ? { ...item, pointsReward: val } : item
                              )
                            );
                          }}
                          className="w-12 bg-transparent text-xs text-amber-300 font-bold text-right outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewQuestionIdx(previewQuestionIdx === qIdx ? null : qIdx);
                          setSelectedOption(null);
                          setHasAnsweredToday(false);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition ${
                          previewQuestionIdx === qIdx
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
                        }`}
                      >
                        <Eye size={12} />
                        {previewQuestionIdx === qIdx ? 'Testando Agora' : 'Testar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(qIdx, -1)}
                        disabled={qIdx === 0}
                        className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(qIdx, 1)}
                        disabled={qIdx === questions.length - 1}
                        className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setQuestions((prev) => prev.filter((item) => item.id !== q.id))
                        }
                        className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Enunciado da Pergunta
                      </label>
                      <input
                        type="text"
                        value={q.prompt}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuestions((prev) =>
                            prev.map((item, i) => (i === qIdx ? { ...item, prompt: val } : item))
                          );
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Data Fixa (Opcional - ou Vazio p/ Fila Diária)
                      </label>
                      <input
                        type="date"
                        value={q.releaseDate || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuestions((prev) =>
                            prev.map((item, i) =>
                              i === qIdx ? { ...item, releaseDate: val } : item
                            )
                          );
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Carta do Desafio (Autopreencher Opções)
                      </label>
                      <select
                        value={q.cardCode || ''}
                        onChange={(e) => handleAutoFillFromCard(q.id, e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      >
                        <option value="">-- Selecionar Carta do Catálogo --</option>
                        {allCards.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Dica / Texto do Efeito / Contexto
                      </label>
                      <input
                        type="text"
                        value={q.clueText || ''}
                        placeholder="Dica exibida abaixo da pergunta..."
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuestions((prev) =>
                            prev.map((item, i) => (i === qIdx ? { ...item, clueText: val } : item))
                          );
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Imagem Personalizada (Opcional)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={q.customImageUrl || ''}
                          placeholder="URL ou Upload ->"
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuestions((prev) =>
                              prev.map((item, i) =>
                                i === qIdx ? { ...item, customImageUrl: val } : item
                              )
                            );
                          }}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono"
                        />
                        <label className="cursor-pointer px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center gap-1 shrink-0">
                          {uploadingQId === q.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Upload size={12} />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadQuestionImage(q.id, file);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* 4 Options + Correct selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[0, 1, 2, 3].map((optIdx) => (
                      <div
                        key={optIdx}
                        className={`flex items-center gap-2 p-2 rounded-xl border ${
                          q.correctIndex === optIdx
                            ? 'bg-emerald-950/30 border-emerald-500/50'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`correct-${q.id}`}
                          checked={q.correctIndex === optIdx}
                          onChange={() => {
                            setQuestions((prev) =>
                              prev.map((item, i) =>
                                i === qIdx ? { ...item, correctIndex: optIdx } : item
                              )
                            );
                          }}
                          className="accent-emerald-500 cursor-pointer"
                          title="Marcar como alternativa correta"
                        />
                        <input
                          type="text"
                          value={q.options[optIdx] || ''}
                          placeholder={`Alternativa ${optIdx + 1}`}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuestions((prev) =>
                              prev.map((item, i) => {
                                if (i !== qIdx) return item;
                                const nextOpts = [...item.options] as [
                                  string,
                                  string,
                                  string,
                                  string
                                ];
                                nextOpts[optIdx] = val;
                                return { ...item, options: nextOpts };
                              })
                            );
                          }}
                          className="flex-1 bg-transparent text-xs text-white outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Explicação da Resposta (Exibida após o jogador responder)
                    </label>
                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuestions((prev) =>
                          prev.map((item, i) =>
                            i === qIdx ? { ...item, explanation: val } : item
                          )
                        );
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Quiz + Leaderboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Quiz Card */}
        <div className="lg:col-span-8 rounded-3xl border border-amber-500/30 bg-gradient-to-b from-slate-900/90 to-slate-950 p-5 sm:p-7 flex flex-col justify-between shadow-xl">
          {!activeQuestion ? (
            <div className="py-16 text-center space-y-3">
              <HelpCircle size={40} className="mx-auto text-slate-600" />
              <h3 className="text-base font-bold text-white">
                Nenhuma pergunta ativa no Quiz hoje
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {isAdmin
                  ? 'Clique em "Gerenciar Perguntas (Admin)" acima para cadastrar as perguntas que serão liberadas 1 por dia.'
                  : 'O Mestre ainda não liberou o desafio de hoje. Volte em breve!'}
              </p>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300">
                    <HelpCircle size={18} />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 block">
                      {QUESTION_TYPE_LABELS[activeQuestion.type]}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      DESAFIO DO DIA (+{activeQuestion.pointsReward || 10} PTS)
                    </h3>
                  </div>
                </div>

                {previewQuestionIdx !== null && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase">
                    Modo Teste Admin (Dia #{previewQuestionIdx + 1})
                  </span>
                )}
              </div>

              {/* Blurred Art or Custom Image when applicable */}
              {(activeQuestion.type === 'blurred_art' ||
                activeQuestion.customImageUrl ||
                questionCard?.imageUrl) && (
                <div className="mb-5 flex justify-center">
                  <div className="relative w-44 sm:w-52 aspect-[2.5/3.5] rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-950 shadow-xl">
                    <img
                      src={activeQuestion.customImageUrl || questionCard?.imageUrl}
                      alt="Desafio Misterioso"
                      className={`w-full h-full object-cover transition-all duration-700 ${
                        activeQuestion.type === 'blurred_art' && !hasAnsweredToday
                          ? 'blur-xl scale-125 brightness-75'
                          : 'blur-0 scale-100'
                      }`}
                    />
                    {activeQuestion.type === 'blurred_art' && !hasAnsweredToday && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="px-3 py-1 rounded-full bg-slate-950/90 border border-amber-400/50 text-amber-300 text-[11px] font-black uppercase tracking-wider">
                          Arte Oculta
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Question Prompt & Clue */}
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 mb-5">
                <h4 className="text-sm sm:text-base font-bold text-white leading-snug">
                  {activeQuestion.prompt}
                </h4>
                {activeQuestion.clueText && (
                  <p className="text-xs text-purple-300/90 mt-2 font-mono bg-purple-950/30 border border-purple-800/30 rounded-xl p-2.5">
                    💡 Dica / Contexto: &ldquo;{activeQuestion.clueText}&rdquo;
                  </p>
                )}
              </div>

              {/* 4 Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeQuestion.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = idx === activeQuestion.correctIndex;

                  let btnStyle =
                    'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200 hover:border-purple-500/50';
                  if (hasAnsweredToday) {
                    if (isCorrect) {
                      btnStyle =
                        'bg-emerald-950/70 border-emerald-500 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.2)]';
                    } else if (isSelected && !isCorrect) {
                      btnStyle = 'bg-red-950/70 border-red-500 text-red-200';
                    } else {
                      btnStyle = 'bg-slate-950/50 border-slate-800/60 text-slate-500 opacity-70';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={hasAnsweredToday && previewQuestionIdx === null}
                      onClick={() => handleSelectOption(idx)}
                      className={`p-3.5 rounded-2xl border text-left text-xs sm:text-sm font-bold transition flex items-center justify-between gap-2 ${btnStyle}`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-slate-950/80 border border-slate-700 flex items-center justify-center text-[11px] font-mono text-amber-400 shrink-0">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span>{opt}</span>
                      </span>
                      {hasAnsweredToday && isCorrect && (
                        <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                      )}
                      {hasAnsweredToday && isSelected && !isCorrect && (
                        <X size={16} className="text-red-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {pointsEarnedToast !== null && (
                <div className="mt-4 p-3 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-200 text-xs font-black flex items-center gap-2">
                  <Trophy size={16} className="text-amber-400 shrink-0" />
                  <span>
                    Parabéns! +{pointsEarnedToast} pontos foram creditados permanentemente na sua conta!
                  </span>
                </div>
              )}

              {/* Answer Explanation */}
              {hasAnsweredToday && (
                <div
                  className={`mt-5 p-4 rounded-2xl border animate-in fade-in duration-200 ${
                    selectedOption === activeQuestion.correctIndex
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                      : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  }`}
                >
                  <div className="font-black text-xs uppercase tracking-wider mb-1">
                    {selectedOption === activeQuestion.correctIndex
                      ? '🎉 Resposta Correta!'
                      : '⚡ Resposta Incorreta — Veja a Explicação:'}
                  </div>
                  <p className="text-xs leading-relaxed text-slate-200">
                    {activeQuestion.explanation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ranking de Pontuação do Quiz */}
        <div className="lg:col-span-4 rounded-3xl border border-white/10 bg-[#0b0b12] p-5 sm:p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
              <Trophy size={18} className="text-amber-400" />
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                Ranking de Sabedoria (Quiz)
              </h3>
            </div>

            {leaderboard.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">
                Nenhum jogador pontuou ainda. Acertar perguntas logado na sua conta adiciona pontos ao seu perfil!
              </p>
            ) : (
              <div className="space-y-2.5">
                {leaderboard.map((entry, idx) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${
                      user?.uid === entry.userId
                        ? 'bg-amber-950/40 border-amber-500/50'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                          idx === 0
                            ? 'bg-amber-400 text-slate-950'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-950'
                            : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-white truncate">
                        {entry.displayName}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-black text-amber-300 shrink-0">
                      {entry.quizPoints} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-white/10 text-[11px] text-slate-400">
            {user ? (
              <span>
                Logado como <strong className="text-white">{user.displayName || user.email}</strong> · Seus pontos ficam salvos na sua conta.
              </span>
            ) : (
              <span>Faça login na sua conta para acumular pontos no ranking oficial.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
