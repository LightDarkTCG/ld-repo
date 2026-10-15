import React, { useState } from 'react';
import { X, LogIn, User as UserIcon, Mail, Lock, AlertCircle, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { 
  loginWithGuest, 
  loginWithEmail, 
  registerWithEmail, 
  getFriendlyAuthErrorMessage 
} from '../authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (userName: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [tab, setTab] = useState<'guest' | 'email'>('guest');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Guest state
  const [nickname, setNickname] = useState('');

  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  if (!isOpen) return null;

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = nickname.trim() || 'Jogador';
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await loginWithGuest(name);
      setSuccessMsg(`Bem-vindo, ${name}!`);
      if (onSuccess) onSuccess(name);
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 600);
    } catch (err: any) {
      console.error('Falha no login como convidado:', err);
      setErrorMsg(getFriendlyAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Preencha o e-mail e a senha.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      let user;
      if (isRegistering) {
        user = await registerWithEmail(email, password, nickname || 'Jogador');
      } else {
        user = await loginWithEmail(email, password);
      }
      const name = user.displayName || 'Jogador';
      setSuccessMsg(`Bem-vindo, ${name}!`);
      if (onSuccess) onSuccess(name);
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 600);
    } catch (err: any) {
      console.error('Falha na autenticação por email:', err);
      setErrorMsg(getFriendlyAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/80 w-full max-w-md rounded-2xl shadow-2xl p-5 sm:p-6 relative text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão Fechar */}
        <button 
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          title="Fechar"
        >
          <X size={20} />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <LogIn size={20} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
              Entrar na sua Conta
            </h2>
            <p className="text-xs text-slate-400">
              Sincronize seu Álbum de Coleção e Decks salvos na nuvem
            </p>
          </div>
        </div>

        {/* Mensagens de Sucesso / Erro */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-500/80 text-red-200 text-xs flex items-start gap-2">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{errorMsg}</span>
            </div>
          </div>
        )}

        {/* Abas */}
        <div className="flex border-b border-slate-800 mb-4 text-xs font-bold">
          <button
            onClick={() => { setTab('guest'); setErrorMsg(null); }}
            className={`pb-2.5 px-4 border-b-2 transition flex items-center gap-1.5 ${tab === 'guest' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <UserIcon size={14} />
            <span>Apelido Rápido</span>
          </button>
          <button
            onClick={() => { setTab('email'); setErrorMsg(null); }}
            className={`pb-2.5 px-4 border-b-2 transition flex items-center gap-1.5 ${tab === 'email' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            <Mail size={14} />
            <span>E-mail e Senha</span>
          </button>
        </div>

        {/* Conteúdo Aba: APELIDO RÁPIDO */}
        {tab === 'guest' && (
          <form onSubmit={handleGuestLogin} className="space-y-4">
            <div className="bg-purple-950/30 border border-purple-500/30 rounded-xl p-3 text-xs text-purple-200/90 leading-relaxed">
              💡 <b>Entrada Instantânea</b>: basta informar seu apelido de jogador para começar a jogar, montar decks e preencher seu álbum na nuvem.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Seu Nome ou Apelido
              </label>
              <div className="relative">
                <UserIcon size={16} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ex: GuerreiroLumen, Salazar..."
                  maxLength={30}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !nickname.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-purple-950/60 active:scale-98 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-white" />
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Entrar e Jogar Agora</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Conteúdo Aba: E-MAIL */}
        {tab === 'email' && (
          <form onSubmit={handleEmailAuth} className="space-y-3">
            {isRegistering && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Nome ou Apelido
                </label>
                <div className="relative">
                  <UserIcon size={16} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Seu nome no jogo"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                E-mail
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Senha
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Pelo menos 6 caracteres"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg active:scale-98 disabled:opacity-60 text-sm mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Processando...</span>
                </>
              ) : (
                <span>{isRegistering ? 'Cadastrar e Entrar' : 'Entrar com E-mail'}</span>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setIsRegistering(!isRegistering); setErrorMsg(null); }}
                className="text-xs text-purple-400 hover:text-purple-300 font-semibold underline"
              >
                {isRegistering ? 'Já tem conta? Entrar com e-mail' : 'Não tem conta? Criar uma agora'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
