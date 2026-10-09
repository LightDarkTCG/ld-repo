import React, { useState } from 'react';
import { X, LogIn, User as UserIcon, Mail, Lock, AlertCircle, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { 
  loginWithGoogle, 
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
  const [tab, setTab] = useState<'google' | 'guest' | 'email'>('google');
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

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await loginWithGoogle();
      const name = user.displayName || 'Jogador';
      setSuccessMsg(`Bem-vindo, ${name}!`);
      if (onSuccess) onSuccess(name);
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 700);
    } catch (err: any) {
      console.error('Falha no login Google:', err);
      const friendly = getFriendlyAuthErrorMessage(err);
      setErrorMsg(friendly);
    } finally {
      setIsLoading(false);
    }
  };

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
      }, 700);
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
      }, 700);
    } catch (err: any) {
      console.error('Falha na autenticação por email:', err);
      setErrorMsg(getFriendlyAuthErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
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
              Sincronize seu Álbum de Coleção e Decks salvos
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
              {tab === 'google' && (
                <div className="mt-2 pt-2 border-t border-red-800/60 flex items-center justify-between">
                  <span className="text-[11px] text-red-300">Prefere entrar com seu apelido?</span>
                  <button
                    type="button"
                    onClick={() => { setErrorMsg(null); setTab('guest'); }}
                    className="text-[11px] font-bold text-amber-300 underline hover:text-amber-200"
                  >
                    Entrar com Apelido →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Abas */}
        <div className="flex border-b border-slate-800 mb-4 text-xs font-bold">
          <button
            onClick={() => { setTab('google'); setErrorMsg(null); }}
            className={`pb-2.5 px-3 border-b-2 transition ${tab === 'google' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            Google
          </button>
          <button
            onClick={() => { setTab('guest'); setErrorMsg(null); }}
            className={`pb-2.5 px-3 border-b-2 transition ${tab === 'guest' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            Apelido Rápido
          </button>
          <button
            onClick={() => { setTab('email'); setErrorMsg(null); }}
            className={`pb-2.5 px-3 border-b-2 transition ${tab === 'email' ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            E-mail
          </button>
        </div>

        {/* Conteúdo Aba: GOOGLE */}
        {tab === 'google' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-300 leading-relaxed">
              Clique abaixo para fazer login com sua conta do Google. Uma janela se abrirá para confirmação.
            </p>

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition shadow-lg active:scale-98 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-purple-600" />
                  <span>Conectando com o Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Continuar com o Google</span>
                </>
              )}
            </button>

            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-[11px] text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300 block">💡 Nota sobre a janela pop-up:</span>
              <p>Caso a janela feche rapidamente ou o domínio não esteja autorizado, você pode usar a aba <b>Apelido Rápido</b> logo acima para salvar seus dados imediatamente.</p>
            </div>
          </div>
        )}

        {/* Conteúdo Aba: APELIDO RÁPIDO */}
        {tab === 'guest' && (
          <form onSubmit={handleGuestLogin} className="space-y-4">
            <p className="text-xs text-slate-300">
              Entre instantaneamente com um apelido para começar a salvar suas cartas no álbum e seus decks na nuvem sem precisar de senha:
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Seu Nome / Apelido
              </label>
              <div className="relative">
                <UserIcon size={16} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ex: GuerreiroCaos"
                  maxLength={30}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg active:scale-98 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-white" />
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Entrar como Jogador</span>
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
