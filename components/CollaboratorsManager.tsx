import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Trash2,
  Check,
  Search,
  BookOpen,
  Layers,
  KeyRound,
  Mail,
  UserCheck,
  AlertCircle,
  Sparkles,
  X
} from 'lucide-react';
import { CollaboratorProfile } from '../types';
import {
  createOrSaveCollaboratorUser,
  fetchCollaboratorsList,
  removeCollaboratorUser
} from '../authService';
import { fetchRegisteredUsers, RegisteredSiteUser } from '../rarePrintService';

export const CollaboratorsManager: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [collaborators, setCollaborators] = useState<CollaboratorProfile[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredSiteUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Mode: 'new_account' (creates new user with email+password) or 'existing_user' (selects from site database)
  const [mode, setMode] = useState<'new_account' | 'existing_user'>('new_account');

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleTitle, setRoleTitle] = useState('Colaborador de Lore & Dados');
  const [canEditLore, setCanEditLore] = useState(true);
  const [canEditCardLore, setCanEditCardLore] = useState(true);
  const [selectedExistingUid, setSelectedExistingUid] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchCollaboratorsList(), fetchRegisteredUsers()])
      .then(([collabs, regUsers]) => {
        if (!mounted) return;
        setCollaborators(collabs);
        setRegisteredUsers(regUsers);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!email.trim() || !email.includes('@')) {
      setFeedback({ type: 'err', text: 'Informe um e-mail válido para o colaborador.' });
      return;
    }

    if (mode === 'new_account' && password.trim().length > 0 && password.trim().length < 6) {
      setFeedback({ type: 'err', text: 'A senha precisa ter pelo menos 6 caracteres.' });
      return;
    }

    setSaving(true);
    try {
      const res = await createOrSaveCollaboratorUser({
        email: email.trim(),
        password: mode === 'new_account' && password.trim() ? password.trim() : undefined,
        displayName: displayName.trim() || email.split('@')[0],
        roleTitle: roleTitle.trim() || 'Colaborador de Lore & Dados',
        canEditLore,
        canEditCardLore,
        existingUid: selectedExistingUid || undefined
      });

      setCollaborators(res.list);
      setFeedback({
        type: 'ok',
        text: res.createdNewAuthAccount
          ? `Novo usuário colaborador "${displayName || email}" criado com sucesso! Ele já pode entrar no site usando este e-mail e senha.`
          : `Usuário "${displayName || email}" autorizado como colaborador com sucesso!`
      });

      setDisplayName('');
      setEmail('');
      setPassword('');
      setSelectedExistingUid('');
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err.message || 'Erro ao salvar colaborador.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePermission = async (
    collab: CollaboratorProfile,
    field: 'canEditLore' | 'canEditCardLore'
  ) => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await createOrSaveCollaboratorUser({
        email: collab.email,
        displayName: collab.displayName,
        roleTitle: collab.roleTitle,
        canEditLore: field === 'canEditLore' ? !collab.canEditLore : collab.canEditLore,
        canEditCardLore: field === 'canEditCardLore' ? !collab.canEditCardLore : collab.canEditCardLore,
        existingUid: collab.uid
      });
      setCollaborators(res.list);
    } catch (err: any) {
      setFeedback({ type: 'err', text: err.message || 'Erro ao atualizar permissão.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (collab: CollaboratorProfile) => {
    setSaving(true);
    setFeedback(null);
    try {
      const next = await removeCollaboratorUser(collab.email, collab.uid);
      setCollaborators(next);
      setFeedback({
        type: 'ok',
        text: `Acesso de colaborador removido de ${collab.displayName} (${collab.email}).`
      });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err.message || 'Erro ao remover colaborador.' });
    } finally {
      setSaving(false);
    }
  };

  const filteredRegisteredUsers = registeredUsers.filter((u) => {
    if (!u.email && !u.displayName) return false;
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-amber-950/40 border border-purple-500/40 rounded-2xl p-5 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <Users size={20} className="text-amber-400" />
            <span>Equipe de Colaboradores (Lore, Archivum & Dados de Cartas)</span>
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
            Crie novas contas de usuário para colaboradores (com e-mail e senha definidos por você, sem deslogar sua conta Admin) ou promova usuários já cadastrados no site. Colaboradores podem preencher e editar toda a <strong>Lore do Macroverso</strong> (Archivum, Páginas, Linha do Tempo, Mapa 3D, Árvore de Relações e Quiz) e a <strong>Lore/Dados das Cartas</strong>, sem acesso às vendas ou configurações financeiras da loja.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition shrink-0"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
              : 'bg-red-950/70 border-red-500/50 text-red-200'
          }`}
        >
          {feedback.type === 'ok' ? (
            <Check size={16} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-red-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Create / Authorize Collaborator Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-purple-400" />
            <span className="text-sm font-black text-white uppercase tracking-wide">
              Adicionar ou Criar Novo Usuário Colaborador
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('new_account');
                setSelectedExistingUid('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                mode === 'new_account'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <KeyRound size={13} />
              <span>Criar Novo Usuário (E-mail + Senha)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('existing_user')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                mode === 'existing_user'
                  ? 'bg-amber-500 text-slate-950 font-black shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck size={13} />
              <span>Selecionar do Banco de Cadastros</span>
            </button>
          </div>
        </div>

        {mode === 'existing_user' && (
          <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-3.5 space-y-2.5">
            <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Search size={13} />
              <span>Buscar Usuário Cadastrado no Site para Tornar Colaborador:</span>
            </label>
            <input
              type="text"
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              placeholder="Digite o nome ou e-mail do usuário cadastrado..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
            />
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/80 border border-slate-800 rounded-lg bg-slate-900/60 custom-scrollbar">
              {filteredRegisteredUsers.filter((u) => u.email).length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500">
                  Nenhum usuário com e-mail encontrado para esta busca. Você também pode digitar o e-mail abaixo manualmente.
                </div>
              ) : (
                filteredRegisteredUsers
                  .filter((u) => u.email)
                  .map((regUser) => {
                    const isSelected =
                      email.toLowerCase() === regUser.email.toLowerCase() &&
                      selectedExistingUid === regUser.userId;
                    return (
                      <button
                        key={regUser.userId}
                        type="button"
                        onClick={() => {
                          setDisplayName(regUser.displayName);
                          setEmail(regUser.email);
                          setSelectedExistingUid(regUser.userId);
                        }}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs transition ${
                          isSelected
                            ? 'bg-amber-500/20 text-amber-200 font-bold'
                            : 'hover:bg-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="font-bold block truncate">{regUser.displayName}</span>
                          <span className="text-[11px] font-mono text-slate-400 block truncate">
                            {regUser.email}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase shrink-0">
                          {isSelected ? 'Selecionado ✓' : 'Selecionar'}
                        </span>
                      </button>
                    );
                  })
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Nome / Apelido do Colaborador
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: Cronista Solus"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1 flex items-center gap-1">
              <Mail size={12} className="text-purple-400" />
              <span>E-mail de Login</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colaborador@email.com"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-purple-500"
              required
            />
          </div>

          {mode === 'new_account' && (
            <div>
              <label className="text-xs font-bold text-emerald-300 block mb-1 flex items-center gap-1">
                <KeyRound size={12} className="text-emerald-400" />
                <span>Senha da Nova Conta (Mín. 6 díg.)</span>
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Crie uma senha p/ o colaborador..."
                className="w-full bg-slate-950 border border-emerald-600/50 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-emerald-400"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">
              Título / Cargo na Equipe
            </label>
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Ex: Colaborador de Lore & Dados"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Permissions Checkboxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-amber-500/40 transition">
            <input
              type="checkbox"
              checked={canEditLore}
              onChange={(e) => setCanEditLore(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-amber-500 rounded"
            />
            <div>
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <BookOpen size={14} />
                <span>Preencher & Editar Lore (Archivum / Mapa 3D / Relações / Quiz)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Permite criar e editar abas da Lore, páginas de história, eventos da linha do tempo, locais e épocas do Mapa Cósmico 3D, Árvore de Relações e Quiz.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-purple-500/40 transition">
            <input
              type="checkbox"
              checked={canEditCardLore}
              onChange={(e) => setCanEditCardLore(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-purple-500 rounded"
            />
            <div>
              <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Layers size={14} />
                <span>Preencher & Editar Lore e Dados de Cartas no Catálogo</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Permite abrir qualquer carta no Catálogo ou no painel e preencher a história (Lore), descrição e arquétipos (sem poder excluir cartas ou alterar donos de tiragem única).
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-lg transition flex items-center gap-2 disabled:opacity-50"
          >
            <UserPlus size={15} />
            <span>
              {saving
                ? 'Salvando Colaborador...'
                : mode === 'new_account' && password.trim()
                ? 'Criar Conta de Colaborador & Liberar Acesso'
                : 'Autorizar Colaborador'}
            </span>
          </button>
        </div>
      </form>

      {/* Active Collaborators List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h4 className="text-sm font-black text-white flex items-center gap-2">
            <ShieldCheck size={17} className="text-emerald-400" />
            <span>Colaboradores Autorizados ({collaborators.length})</span>
          </h4>
          <span className="text-[11px] text-slate-400">
            Clique nos botões de permissão para ativar ou desativar funções a qualquer momento
          </span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-xs text-slate-400">Carregando equipe de colaboradores...</div>
        ) : collaborators.length === 0 ? (
          <div className="text-center py-8 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-400">
            Nenhum colaborador cadastrado ainda. Use o formulário acima para criar um novo usuário colaborador ou promover um jogador cadastrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {collaborators.map((collab) => (
              <div
                key={collab.email}
                className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-white truncate">
                        {collab.displayName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase flex items-center gap-1">
                        <Sparkles size={10} />
                        {collab.roleTitle || 'Colaborador'}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-400 truncate mt-0.5">
                      {collab.email}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleRemove(collab)}
                    className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 hover:text-white transition shrink-0"
                    title="Remover acesso de colaborador"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleTogglePermission(collab, 'canEditLore')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1.5 ${
                      collab.canEditLore !== false
                        ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                    }`}
                  >
                    <BookOpen size={12} />
                    <span>Lore / Archivum / Mapa 3D: {collab.canEditLore !== false ? 'ATIVO' : 'OFF'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleTogglePermission(collab, 'canEditCardLore')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1.5 ${
                      collab.canEditCardLore !== false
                        ? 'bg-purple-950/60 border-purple-500/50 text-purple-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500 line-through'
                    }`}
                  >
                    <Layers size={12} />
                    <span>Lore & Dados de Cartas: {collab.canEditCardLore !== false ? 'ATIVO' : 'OFF'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
