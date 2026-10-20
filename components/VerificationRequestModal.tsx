import React, { useState } from 'react';
import { X, ShieldAlert, Sparkles, CheckCircle2, Send, Lock, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { CardData } from '../types';
import { User } from 'firebase/auth';
import { createVerificationRequest } from '../rarePrintService';
import { cleanCardCode } from '../CardContext';
import { Card } from './Card';

interface VerificationRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardData | null;
  user: User | null;
  onOpenAuth?: () => void;
  onSuccess?: () => void;
}

export const VerificationRequestModal: React.FC<VerificationRequestModalProps> = ({
  isOpen,
  onClose,
  card,
  user,
  onOpenAuth,
  onSuccess
}) => {
  const [proofNote, setProofNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !card) return null;

  const maxCopies = card.maxPrintCopies || 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await createVerificationRequest(user, card, proofNote);
      setIsSubmitted(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setIsSubmitted(false);
        setProofNote('');
        onClose();
      }, 3000);
    } catch (err: any) {
      console.error('Erro ao enviar solicitação de verificação:', err);
      setError(err.message || 'Erro ao enviar a solicitação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b0f19] w-full max-w-lg rounded-2xl border border-amber-500/50 shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-950/60 via-slate-900/80 to-purple-950/60 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-300 shadow-lg shadow-amber-950/60">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                Tiragem Rara de Colecionador
              </h3>
              <p className="text-xs text-amber-300/80 font-medium">
                Verificação Obrigatória do Administrador
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {isSubmitted ? (
            <div className="py-8 flex flex-col items-center text-center gap-3 animate-in fade-in zoom-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-950/60">
                <CheckCircle2 size={36} />
              </div>
              <h4 className="text-xl font-black text-white">Solicitação Enviada!</h4>
              <p className="text-sm text-slate-300 max-w-sm">
                Uma notificação com os dados da carta foi enviada diretamente para o perfil do <strong className="text-amber-300">Administrador</strong> para validação.
              </p>
              <p className="text-xs text-slate-400">
                Assim que sua posse física for confirmada, a carta será creditada automaticamente no seu álbum.
              </p>
            </div>
          ) : (
            <>
              {/* Card Summary Banner */}
              <div className="flex items-center gap-4 bg-slate-950 border border-amber-500/30 p-3 rounded-xl">
                <div className="w-16 h-22 rounded overflow-hidden bg-slate-900 border border-slate-800 shrink-0 shadow-md">
                  {card.imageUrl ? (
                    <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <ImageIcon size={20} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {maxCopies === 1 ? '💎 Cópia Única (1 de 1)' : `💎 Tiragem Rara (${maxCopies} cópias)`}
                    </span>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/40">
                      {cleanCardCode(card.code)}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white truncate mt-1">{card.name}</h4>
                  <p className="text-xs text-slate-400 truncate">
                    {card.collection || 'Coleção Especial'} • Frame {card.frame || 'Moderno'}
                  </p>
                </div>
              </div>

              {/* Notice Explanation */}
              <div className="bg-amber-950/30 border border-amber-700/40 p-3.5 rounded-xl flex items-start gap-3 text-xs text-amber-200/90 leading-relaxed">
                <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-amber-300 font-bold mb-0.5">Por que essa confirmação é necessária?</strong>
                  Esta carta possui tiragem física estritamente limitada no mundo real. Para garantir a veracidade do ranking de colecionadores e o valor das cópias únicas, o Administrador valida a posse antes de ativá-la no seu álbum digital.
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Comprovante de Posse / Observação <span className="text-slate-500 font-normal">(Opcional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={proofNote}
                    onChange={(e) => setProofNote(e.target.value)}
                    placeholder="Ex: Número de série da carta impressa, link da foto com comprovante, data do sorteio/evento..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-xs text-white placeholder-slate-600 outline-none transition custom-scrollbar"
                  />
                </div>

                {error && (
                  <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-medium">
                    {error}
                  </div>
                )}

                {user ? (
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-amber-950/60 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span>Enviando...</span>
                      ) : (
                        <>
                          <Send size={14} />
                          <span>Enviar Solicitação ao Administrador</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-purple-950/50"
                    >
                      <Lock size={14} />
                      <span>Faça Login para Solicitar Verificação</span>
                    </button>
                  </div>
                )}
              </form>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
