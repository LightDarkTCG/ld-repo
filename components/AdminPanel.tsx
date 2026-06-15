import React, { useState, useEffect } from 'react';
import { Settings, Lock, Plus, Trash2, X, Image as ImageIcon, Edit2, Check, Layout, Clock, Grid, Palette, ChevronRight, Layers, BookOpen, Database, Box } from 'lucide-react';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { useCards } from '../CardContext';
import { ArchetypeData } from '../types';

export type AdminType = 'home' | 'catalog' | 'master';

export const AdminPanel = ({ onClose, adminType = 'master' }: { onClose: () => void, adminType?: AdminType }) => {
  const { archetypes, saveArchetype, collections, saveCollection, deleteCollection, cards, saveCard, deleteCard } = useCards();
  const [user, setUser] = useState(auth.currentUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [activeAdminTab, setActiveAdminTab] = useState<'settings' | 'tabs' | 'items' | 'timeline' | 'archetypes' | 'collections' | 'cards' | 'batch_cards' | 'apendices' | 'add_card'>(() => {
    if (adminType === 'home') return 'settings';
    if (adminType === 'catalog') return 'add_card';
    return 'settings'; // Default for master
  });

  // Data
  const [wbSettings, setWbSettings] = useState<any>({
    mainTitle: 'ARCHIVUM',
    subtitle: 'Secretum · Archivum · Imperii',
    description: 'Um grande compêndio contendo universos esquecidos, personagens lendários e a cronologia dos mundos.',
    primaryColor: '#d4af37'
  });
  const [homeSettings, setHomeSettings] = useState<any>({
    synopsis: 'O Caos começou a invadir, Escolhidos, Arautos, precisamos de vocês! Monte seu deck, escolha seu Herói e domine os duelos neste TCG frenético.',
    title: 'LIGHT DARK',
    topSubtitle: 'Invasão do Caos',
    sideText: '1/5',
    titleEffect: 'glitch', 
    primaryColor: '#a855f7',
    titleShadowColor: '#a855f7',
    titleShadowIntensity: 15,
    sideTextColor: '#a855f7',
    sideTextShadowColor: '#a855f7',
    sideTextShadowIntensity: 10,
    videos: [],
    videoTransition: 'fade'
  });
  const [wbTabs, setWbTabs] = useState<any[]>([]);
  const [wbItems, setWbItems] = useState<any[]>([]);
  const [wbTimelineEvents, setWbTimelineEvents] = useState<any[]>([]);

  // Form States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // General Form
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formOrderIndex, setFormOrderIndex] = useState('0');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  // Cards
  const [cardCollection, setCardCollection] = useState('');
  const [cardFrame, setCardFrame] = useState<'Legado' | 'Moderno'>('Legado');

  const [cardEditCode, setCardEditCode] = useState('');
  const [cardEditAttack, setCardEditAttack] = useState('0');
  const [cardEditDefense, setCardEditDefense] = useState('0');
  const [cardEditCT, setCardEditCT] = useState('0');
  const [cardEditType, setCardEditType] = useState<any>('Herói');
  const [cardEditArchetype, setCardEditArchetype] = useState('Desconhecido');
  const [cardEditLore, setCardEditLore] = useState('');
  const [cardEditIsHidden, setCardEditIsHidden] = useState(false);

  const [batchCardsInput, setBatchCardsInput] = useState('');
  const [batchCardsDraft, setBatchCardsDraft] = useState(false);
  const [batchStep, setBatchStep] = useState<1 | 2>(1);
  const [parsedBatchCards, setParsedBatchCards] = useState<any[]>([]);
  const [batchImages, setBatchImages] = useState<{ [code: string]: File }>({});
  const [batchCollection, setBatchCollection] = useState('');
  const [batchFrame, setBatchFrame] = useState<'Legado' | 'Moderno'>('Legado');

  // Collections
  const [collectionEditName, setCollectionEditName] = useState('');

  // Specifics
  const [tabHasItems, setTabHasItems] = useState(true);
  const [tabHasTimeline, setTabHasTimeline] = useState(false);
  
  const [itemTabId, setItemTabId] = useState('');
  const [itemFields, setItemFields] = useState<{label: string, value: string}[]>([]);

  const [timelineTabId, setTimelineTabId] = useState('');
  const [timelineDate, setTimelineDate] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) loadData();
    });
    return unsub;
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const gSnap = await getDoc(doc(db, 'wbSettings', 'global'));
      if (gSnap.exists()) {
        setWbSettings((prev: any) => ({...prev, ...gSnap.data()}));
      }

      const hSnap = await getDoc(doc(db, 'homeSettings', 'global'));
      if (hSnap.exists()) {
        setHomeSettings((prev: any) => ({...prev, ...hSnap.data()}));
      }

      const tabsSnap = await getDocs(collection(db, 'wbTabs'));
      let tbs = tabsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      tbs.sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setWbTabs(tbs);

      const itemsSnap = await getDocs(collection(db, 'wbItems'));
      let itms = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      itms.sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setWbItems(itms);

      const timeSnap = await getDocs(collection(db, 'wbTimelineEvents'));
      let times = timeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      times.sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setWbTimelineEvents(times);

    } catch (e: any) {
      console.error(e);
      setError('Erro ao carregar dados.');
    }
    setLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || 'Erro de autenticação.');
    }
  };

  const syncStorageCards = async () => {
    setLoading(true);
    try {
      const { listAll } = await import('firebase/storage');
      
      const getAllFiles = async (dirRef: any): Promise<any[]> => {
        let files: any[] = [];
        const res = await listAll(dirRef);
        for (const item of res.items) {
          files.push(item);
        }
        for (const prefix of res.prefixes) {
           const subFiles = await getAllFiles(prefix);
           files = files.concat(...subFiles);
        }
        return files;
      };

      const rootRef = ref(storage, 'cards');
      const allFiles = await getAllFiles(rootRef);
      
      let newCount = 0;

      for (const fileRef of allFiles) {
        // fileRef.fullPath is like "cards/Legado/Deck Principal/Mago.png" or "cards/Frame/Deck/Carta.png"
        const pathParts = fileRef.fullPath.split('/');
        
        let frame = 'Legado';
        let col = 'Nova Coleção';
        let name = fileRef.name.replace(/\.[^/.]+$/, "");
        
        if (pathParts.length >= 4) {
          frame = pathParts[1];
          col = pathParts[2];
        } else if (pathParts.length === 3) {
           col = pathParts[1];
        }

        const url = await getDownloadURL(fileRef);
        const codeId = fileRef.fullPath.replace(/\//g, '_');
        
        const exists = cards.some(c => c.code === codeId || c.imageUrl === url);
        
        if (!exists) {
           await saveCard({
             code: codeId,
             name: name,
             type: 'Herói',
             archetype: 'Desconhecido',
             collection: col,
             frame: frame,
             description: '',
             ct: 0,
             attack: 0,
             defense: 0,
             imageUrl: url
           });
           newCount++;
        }
      }
      alert(`Sincronização concluída! ${newCount} novas cartas lidas do Storage.`);
    } catch(e:any) {
      if (e.code === 'storage/object-not-found') {
         setError('A pasta "cards" não foi encontrada no Storage.');
      } else {
         setError(e.message);
      }
    }
    setLoading(false);
  };

  const handleCopyFromCard = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    if (!code) return;
    const sourceCard = cards.find(c => c.code === code);
    if (sourceCard) {
      setFormName(sourceCard.name);
      setFormDescription(sourceCard.description || '');
      setCardEditType(sourceCard.type || 'Herói');
      setCardEditArchetype(sourceCard.archetype || 'Desconhecido');
      setCardEditCT(String(sourceCard.ct || 0));
      setCardEditAttack(String(sourceCard.attack || 0));
      setCardEditDefense(String(sourceCard.defense || 0));
      setCardEditLore(sourceCard.lore || '');
      setCardCollection(sourceCard.collection);
      setCardEditCode(sourceCard.code);
    }
    e.target.value = '';
  };

  const startEditCard = (c: any) => {
    resetForm();
    setActiveAdminTab('add_card');
    setEditingId(c.code);
    setFormName(c.name);
    setFormDescription(c.description || '');
    setFormImageUrl(c.imageUrl || '');
    setCardCollection(c.collection);
    setCardFrame(c.frame || 'Legado');
    setCardEditCode(c.code);
    setCardEditAttack(String(c.attack || 0));
    setCardEditDefense(String(c.defense || 0));
    setCardEditCT(String(c.ct || 0));
    setCardEditType(c.type || 'Herói');
    setCardEditArchetype(c.archetype || 'Desconhecido');
    setCardEditLore(c.lore || '');
    setCardEditIsHidden(!!c.isHidden);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormOrderIndex('0');
    setFormImageUrl('');
    setFileToUpload(null);
    setTabHasItems(true);
    setTabHasTimeline(false);
    setItemTabId('');
    setItemFields([]);
    setTimelineTabId('');
    setTimelineDate('');
    setCardEditIsHidden(false);
    setBatchStep(1);
    setParsedBatchCards([]);
    setBatchImages({});
    setBatchCollection('');
    setError('');
  };

  const handleSaveUpload = async () => {
    let finalImageUrl = formImageUrl;
    if (fileToUpload) {
      const fileRef = ref(storage, `wb_images/${Date.now()}_${fileToUpload.name}`);
      await uploadBytes(fileRef, fileToUpload);
      finalImageUrl = await getDownloadURL(fileRef);
    } else if (finalImageUrl.startsWith('gs://')) {
      const gsRef = ref(storage, finalImageUrl);
      finalImageUrl = await getDownloadURL(gsRef);
    }
    return finalImageUrl;
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      if (adminType === 'home') {
        await setDoc(doc(db, 'homeSettings', 'global'), homeSettings);
      } else {
        await setDoc(doc(db, 'wbSettings', 'global'), wbSettings);
      }
      alert('Configurações salvas!');
    } catch(e:any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const saveTab = async () => {
    if (!formName.trim()) return setError('Nome é obrigatório.');
    setLoading(true);
    try {
      const data = {
        name: formName, orderIndex: Number(formOrderIndex),
        hasItems: tabHasItems, hasTimeline: tabHasTimeline
      };
      if (editingId) await updateDoc(doc(db, 'wbTabs', editingId), data);
      else await addDoc(collection(db, 'wbTabs'), data);
      resetForm();
      loadData();
    } catch(e:any) { setError(e.message); }
    setLoading(false);
  };

  const saveItem = async () => {
    if (!formName.trim() || !itemTabId) return setError('Nome e Aba são obrigatórios.');
    setLoading(true);
    try {
      const finalImg = await handleSaveUpload();
      const data = {
        tabId: itemTabId, name: formName, description: formDescription,
        imageUrl: finalImg, orderIndex: Number(formOrderIndex), customFields: itemFields
      };
      if (editingId) await updateDoc(doc(db, 'wbItems', editingId), data);
      else await addDoc(collection(db, 'wbItems'), data);
      resetForm();
      loadData();
    } catch(e:any) { setError(e.message); }
    setLoading(false);
  };

  const saveTimelineEvent = async () => {
    if (!formName.trim() || !timelineTabId) return setError('Nome e Aba são obrigatórios.');
    setLoading(true);
    try {
      const finalImg = await handleSaveUpload();
      const data = {
        tabId: timelineTabId, dateStr: timelineDate, title: formName, 
        description: formDescription, imageUrl: finalImg, orderIndex: Number(formOrderIndex)
      };
      if (editingId) await updateDoc(doc(db, 'wbTimelineEvents', editingId), data);
      else await addDoc(collection(db, 'wbTimelineEvents'), data);
      resetForm();
      loadData();
    } catch(e:any) { setError(e.message); }
    setLoading(false);
  };

  const deleteEntity = async (id: string, collectionName: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setLoading(true);
    try {
      await deleteDoc(doc(db, collectionName, id));
      loadData();
    } catch(e:any) { setError(e.message); }
    setLoading(false);
    setConfirmId(null);
  };

  const saveCardData = async () => {
    if (!formName.trim() || !cardCollection.trim()) return setError('Nome e Coleção obrigatórios.');
    setLoading(true);
    try {
      const finalImg = await handleSaveUpload();
      
      if (editingId && editingId !== cardEditCode) {
        await deleteCard(editingId as string);
      }
      
      await saveCard({
        code: cardEditCode,
        name: formName,
        type: cardEditType,
        archetype: cardEditArchetype,
        collection: cardCollection,
        frame: cardFrame,
        description: formDescription,
        ct: Number(cardEditCT),
        attack: Number(cardEditAttack),
        defense: Number(cardEditDefense),
        lore: cardEditLore,
        imageUrl: finalImg,
        isHidden: cardEditIsHidden
      });
      resetForm();
    } catch(e:any) { setError(e.message); }
    setLoading(false);
  };

  const handleParseBatch = () => {
    if (!batchCardsInput.trim()) return setError('Insira os dados brutos.');
    setError('');
    
    try {
      let fixedInput = batchCardsInput.trim();
      if (fixedInput.endsWith(',')) {
        fixedInput = fixedInput.slice(0, -1);
      }
      
      let parsedCards: any[] = [];
      try {
        const createObj = new Function('return [' + fixedInput + '];');
        parsedCards = createObj();
      } catch (err: any) {
        throw new Error('Erro ao interpretar as cartas. Verifique a sintaxe. ' + err.message);
      }
      
      if (parsedCards.length === 0) throw new Error('Nenhuma carta encontrada.');
      
      let initialCollection = parsedCards[0]?.collection || '';
      setBatchCollection(initialCollection);
      setParsedBatchCards(parsedCards);
      setBatchStep(2);
    } catch(e:any) {
      setError(e.message);
    }
  };

  const handleConfirmBatchSave = async () => {
    setLoading(true);
    setError('');
    
    try {
      let itemsAdded = 0;
      for (const c of parsedBatchCards) {
        if (!c.name || !c.code) continue;
        
        let finalImageUrl = c.imageUrl && c.imageUrl !== 'INSIRA O CODIGO' ? c.imageUrl : '';
        const fileToUpload = batchImages[c.code];
        
        if (fileToUpload) {
          const fileRef = ref(storage, `wb_images/${Date.now()}_${fileToUpload.name}`);
          await uploadBytes(fileRef, fileToUpload);
          finalImageUrl = await getDownloadURL(fileRef);
        } else if (finalImageUrl.startsWith('gs://')) {
          const gsRef = ref(storage, finalImageUrl);
          finalImageUrl = await getDownloadURL(gsRef);
        }
        
        await saveCard({
          code: c.code,
          name: c.name,
          type: c.type || 'Combatente',
          archetype: c.archetype || 'Desconhecido',
          collection: batchCollection || c.collection || '',
          frame: c.frame || batchFrame,
          description: c.description || '',
          ct: Number(c.ct || 0),
          attack: Number(c.attack || 0),
          defense: Number(c.defense || 0),
          lore: c.lore || '',
          imageUrl: finalImageUrl,
          isHidden: batchCardsDraft
        });
        itemsAdded++;
      }
      
      alert(`${itemsAdded} cartas adicionadas com sucesso!`);
      resetForm();
      setActiveAdminTab('cards');
    } catch(e:any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const startEditTab = (t: any) => {
    resetForm(); setEditingId(t.id); setFormName(t.name); setFormOrderIndex(String(t.orderIndex||0));
    setTabHasItems(t.hasItems); setTabHasTimeline(t.hasTimeline);
  };

  const startEditItem = (i: any) => {
    resetForm(); setEditingId(i.id); setFormName(i.name); setFormDescription(i.description||'');
    setFormImageUrl(i.imageUrl||''); setFormOrderIndex(String(i.orderIndex||0));
    setItemTabId(i.tabId); setItemFields(i.customFields||[]);
  };

  const startEditTimeline = (te: any) => {
    resetForm(); setEditingId(te.id); setFormName(te.title); setFormDescription(te.description||'');
    setTimelineDate(te.dateStr||''); setFormImageUrl(te.imageUrl||'');
    setFormOrderIndex(String(te.orderIndex||0)); setTimelineTabId(te.tabId);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur flex items-center justify-center p-4">
      <div className="bg-slate-900 w-full max-w-6xl h-[90vh] flex flex-col rounded-xl border border-purple-500 shadow-2xl relative overflow-hidden">
        
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="text-purple-500" /> 
            {adminType === 'home' && 'Admin da Tela Inicial'}
            {adminType === 'catalog' && 'Admin do Catálogo'}
            {adminType === 'master' && 'Área do Mestre'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {!user ? (
            <div className="max-w-sm mx-auto bg-slate-800 p-6 rounded-lg border border-slate-700 mt-10">
              <h3 className="text-lg font-bold text-white mb-4 text-center">Acesso CMS restrito</h3>
              <form onSubmit={handleAuth} className="space-y-4">
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <input type="email" placeholder="Email..." value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" required />
                <input type="password" placeholder="Senha..." value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" required />
                <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded transition">
                  Entrar
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-6">
              {/* Sidebar */}
              <div className="w-full md:w-56 shrink-0 flex flex-col gap-2">
                {(adminType === 'home' || adminType === 'master') && (
                  <button onClick={() => { setActiveAdminTab('settings'); resetForm(); }} className={`text-left p-3 rounded font-bold transition flex items-center gap-2 ${activeAdminTab === 'settings' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                    <Palette size={18}/> Aparência & Global
                  </button>
                )}
                
                {adminType === 'master' && (
                  <>
                    <button onClick={() => { setActiveAdminTab('tabs'); resetForm(); }} className={`text-left p-3 rounded font-bold transition flex items-center gap-2 ${activeAdminTab === 'tabs' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                      <Layout size={18}/> Gerenciar Abas
                    </button>
                    <button onClick={() => { setActiveAdminTab('items'); resetForm(); }} className={`text-left p-3 rounded font-bold transition flex items-center gap-2 ${activeAdminTab === 'items' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                      <Grid size={18}/> Adicionar Páginas
                    </button>
                    <button onClick={() => { setActiveAdminTab('timeline'); resetForm(); }} className={`text-left p-3 rounded font-bold transition flex items-center gap-2 ${activeAdminTab === 'timeline' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                      <Clock size={18}/> Linha do Tempo
                    </button>
                    <button onClick={() => { setActiveAdminTab('apendices'); resetForm(); }} className={`text-left p-3 rounded font-bold transition flex items-center gap-2 ${activeAdminTab === 'apendices' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                      <BookOpen size={18}/> Apêndices
                    </button>
                  </>
                )}

                {adminType === 'home' && (
                  <button onClick={() => { setActiveAdminTab('archetypes'); resetForm(); }} className={`text-left p-3 rounded font-bold transition flex items-center gap-2 ${activeAdminTab === 'archetypes' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                    <ImageIcon size={18}/> Arquétipos
                  </button>
                )}

                {adminType === 'catalog' && (
                  <>
                    <button onClick={() => { setActiveAdminTab('add_card'); resetForm(); }} className={`text-left p-3 rounded font-bold transition flex items-center gap-2 ${activeAdminTab === 'add_card' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                      <Plus size={18}/> Adicionar Cartas
                    </button>
                    <button onClick={() => { setActiveAdminTab('batch_cards'); resetForm(); }} className={`text-left p-3 rounded font-bold transition flex items-center gap-2 ${activeAdminTab === 'batch_cards' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                      <Layers size={18}/> Adicionar Cartas em Lote
                    </button>
                    <button onClick={() => { setActiveAdminTab('collections'); resetForm(); }} className={`text-left p-3 rounded font-bold transition flex items-center gap-2 ${activeAdminTab === 'collections' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                      <Box size={18}/> Decks e Coleções
                    </button>
                    <button onClick={() => { setActiveAdminTab('cards'); resetForm(); }} className={`text-left p-3 rounded font-bold transition flex items-center gap-2 ${activeAdminTab === 'cards' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                      <Database size={18}/> Cartas Firestore
                    </button>
                  </>
                )}

                <div className="mt-auto pt-4 border-t border-slate-800">
                  <button onClick={() => signOut(auth)} className="w-full bg-red-900/50 hover:bg-red-900 text-red-200 p-2 rounded text-sm transition">
                    Desconectar
                  </button>
                </div>
              </div>

              {/* Main Area */}
              <div className="flex-1 min-w-0 pb-12">
                {error && <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4">{error}</div>}

                {/* SETTINGS TAB */}
                {activeAdminTab === 'settings' && (
                  <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-8 shadow-inner">
                    <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">
                      {adminType === 'home' ? 'Configurações da Tela Inicial' : 'Configurações de Lore'}
                    </h3>
                    
                    {adminType === 'home' ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-4 border border-slate-700 p-4 rounded bg-slate-900/50">
                            <h4 className="font-bold text-purple-400">Título Principal (LIGHT DARK)</h4>
                            <div>
                              <label className="text-sm font-bold text-slate-400 block mb-1">Título</label>
                              <input type="text" value={homeSettings.title || ''} onChange={e => setHomeSettings({...homeSettings, title: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                            </div>
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <label className="text-sm font-bold text-slate-400 block mb-1">Cor</label>
                                <div className="flex gap-2 items-center">
                                  <input type="color" value={homeSettings.primaryColor || '#a855f7'} onChange={e => setHomeSettings({...homeSettings, primaryColor: e.target.value})} className="w-10 h-10 rounded cursor-pointer bg-slate-950" />
                                </div>
                              </div>
                              <div className="flex-1">
                                <label className="text-sm font-bold text-slate-400 block mb-1">Cor do Brilho/Sombra</label>
                                <div className="flex gap-2 items-center">
                                  <input type="color" value={homeSettings.titleShadowColor || '#a855f7'} onChange={e => setHomeSettings({...homeSettings, titleShadowColor: e.target.value})} className="w-10 h-10 rounded cursor-pointer bg-slate-950" />
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-bold text-slate-400 block mb-1">Intensidade do Brilho: {homeSettings.titleShadowIntensity || 15}px</label>
                              <input type="range" min="0" max="100" value={homeSettings.titleShadowIntensity || 15} onChange={e => setHomeSettings({...homeSettings, titleShadowIntensity: Number(e.target.value)})} className="w-full accent-purple-500" />
                            </div>
                            <div>
                              <label className="text-sm font-bold text-slate-400 block mb-1">Efeito</label>
                              <select value={homeSettings.titleEffect || 'none'} onChange={e => setHomeSettings({...homeSettings, titleEffect: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                                <option value="none">Nenhum</option>
                                <option value="glitch">Glitch</option>
                                <option value="pulse">Pulse</option>
                              </select>
                            </div>
                          </div>

                          <div className="space-y-4 border border-slate-700 p-4 rounded bg-slate-900/50">
                            <h4 className="font-bold text-purple-400">Texto Lateral (Ex: 16/06)</h4>
                            <div>
                              <label className="text-sm font-bold text-slate-400 block mb-1">Texto</label>
                              <input type="text" value={homeSettings.sideText || ''} onChange={e => setHomeSettings({...homeSettings, sideText: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                            </div>
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <label className="text-sm font-bold text-slate-400 block mb-1">Cor</label>
                                <div className="flex gap-2 items-center">
                                  <input type="color" value={homeSettings.sideTextColor || '#a855f7'} onChange={e => setHomeSettings({...homeSettings, sideTextColor: e.target.value})} className="w-10 h-10 rounded cursor-pointer bg-slate-950" />
                                </div>
                              </div>
                              <div className="flex-1">
                                <label className="text-sm font-bold text-slate-400 block mb-1">Cor do Brilho/Sombra</label>
                                <div className="flex gap-2 items-center">
                                  <input type="color" value={homeSettings.sideTextShadowColor || '#a855f7'} onChange={e => setHomeSettings({...homeSettings, sideTextShadowColor: e.target.value})} className="w-10 h-10 rounded cursor-pointer bg-slate-950" />
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-bold text-slate-400 block mb-1">Intensidade do Brilho: {homeSettings.sideTextShadowIntensity || 10}px</label>
                              <input type="range" min="0" max="100" value={homeSettings.sideTextShadowIntensity || 10} onChange={e => setHomeSettings({...homeSettings, sideTextShadowIntensity: Number(e.target.value)})} className="w-full accent-purple-500" />
                            </div>
                            <div>
                              <label className="text-sm font-bold text-slate-400 block mb-1">Efeito</label>
                              <select value={homeSettings.sideTextEffect || 'none'} onChange={e => setHomeSettings({...homeSettings, sideTextEffect: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                                <option value="none">Nenhum</option>
                                <option value="flicker">Flicker</option>
                                <option value="pulse">Pulse</option>
                                <option value="glitch">Glitch</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">Subtítulo Superior / TopText</label>
                          <input type="text" value={homeSettings.topSubtitle || ''} onChange={e => setHomeSettings({...homeSettings, topSubtitle: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">Sinopse (Abaixo do Título)</label>
                          <textarea value={homeSettings.synopsis || ''} onChange={e => setHomeSettings({...homeSettings, synopsis: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white h-24 resize-none" />
                        </div>

                        <div className="mt-8 border-t border-slate-700 pt-6">
                          <h4 className="font-bold text-white mb-4">Gerenciar Vídeos de Fundo (Hero Section)</h4>
                          {homeSettings.videos?.map((vid: any, i: number) => (
                            <div key={i} className="flex flex-wrap gap-4 mb-4 p-4 bg-slate-900 rounded border border-slate-700">
                              <div className="w-full flex items-center justify-between">
                                <span className="text-purple-400 font-bold text-sm">Vídeo {i + 1}</span>
                                <button onClick={() => {
                                  const nv = homeSettings.videos.filter((_:any, idx:number) => idx !== i);
                                  setHomeSettings({...homeSettings, videos: nv});
                                }} className="text-red-400 hover:text-red-300">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                              <div className="w-full">
                                <label className="text-xs text-slate-400 block mb-1">URL do Vídeo</label>
                                <input type="text" value={vid.url} onChange={e => {
                                  const nv = [...(homeSettings.videos || [])]; nv[i].url = e.target.value; setHomeSettings({...homeSettings, videos: nv});
                                }} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" placeholder="https://..." />
                              </div>
                              <div className="grid grid-cols-3 gap-4 w-full">
                                <div>
                                  <label className="text-xs text-slate-400 block mb-1">Duração (segundos, 0 = loop)</label>
                                  <input type="number" min="0" value={vid.duration} onChange={e => {
                                    const nv = [...(homeSettings.videos || [])]; nv[i].duration = Number(e.target.value); setHomeSettings({...homeSettings, videos: nv});
                                  }} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm" />
                                </div>
                                <div>
                                  <label className="text-xs text-slate-400 block mb-1">Posicionamento</label>
                                  <select value={vid.position} onChange={e => {
                                    const nv = [...(homeSettings.videos || [])]; nv[i].position = e.target.value; setHomeSettings({...homeSettings, videos: nv});
                                  }} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm">
                                    <option value="center">Centralizado</option>
                                    <option value="top">Superior</option>
                                    <option value="bottom">Inferior</option>
                                    <option value="left">Esquerda</option>
                                    <option value="right">Direita</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs text-slate-400 block mb-1">Transição (Entrada)</label>
                                  <select value={vid.transition} onChange={e => {
                                    const nv = [...(homeSettings.videos || [])]; nv[i].transition = e.target.value; setHomeSettings({...homeSettings, videos: nv});
                                  }} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm">
                                    <option value="fade">Fade</option>
                                    <option value="none">Seca</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className="flex flex-wrap gap-4 mt-4">
                            <button onClick={() => {
                              const nv = [...(homeSettings.videos || []), { url: '', duration: 0, position: 'center', transition: 'fade' }];
                              setHomeSettings({...homeSettings, videos: nv});
                            }} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded flex items-center gap-2 transition font-bold">
                              <Plus size={16} /> Adicionar Vídeo
                            </button>
                            
                            <button onClick={async () => {
                              try {
                                const { ref: storageRef, listAll, getDownloadURL } = await import('firebase/storage');
                                const listRef = storageRef(storage, 'home_videos');
                                const res = await listAll(listRef);
                                if (res.items.length > 0) {
                                  const urls = await Promise.all(res.items.map(item => getDownloadURL(item)));
                                  const existingUrls = (homeSettings.videos || []).map((v:any) => v.url);
                                  const newVideos = urls.filter(u => !existingUrls.includes(u)).map(url => ({
                                    url, duration: 0, position: 'center', transition: 'fade'
                                  }));
                                  if (newVideos.length > 0) {
                                    setHomeSettings({...homeSettings, videos: [...(homeSettings.videos || []), ...newVideos]});
                                    alert(`Foram adicionados ${newVideos.length} novos vídeos do Storage!`);
                                  } else {
                                    alert("Nenhum vídeo novo encontrado no Storage.");
                                  }
                                } else {
                                  alert("Nenhum vídeo encontrado no Storage em /home_videos.");
                                }
                              } catch (e: any) {
                                alert("Erro ao buscar vídeos: " + e.message);
                              }
                            }} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded flex items-center gap-2 transition font-bold">
                              <Database size={16} /> Sincronizar Storage
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-slate-700 mt-6">
                          <button onClick={saveSettings} disabled={loading} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded transition">
                            Salvar Configurações da Home
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <label className="text-sm font-bold text-slate-400 block mb-1">Título Principal (Lore)</label>
                            <input type="text" value={wbSettings.mainTitle} onChange={e => setWbSettings({...wbSettings, mainTitle: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                          </div>
                          <div className="w-32">
                            <label className="text-sm font-bold text-slate-400 block mb-1">Cor Primária</label>
                            <div className="flex gap-2 items-center">
                              <input type="color" value={wbSettings.primaryColor} onChange={e => setWbSettings({...wbSettings, primaryColor: e.target.value})} className="w-10 h-10 rounded cursor-pointer bg-slate-950" />
                              <span className="text-white text-xs">{wbSettings.primaryColor}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">Subtítulo (Abaixo do Título)</label>
                          <input type="text" value={wbSettings.subtitle} onChange={e => setWbSettings({...wbSettings, subtitle: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">Texto de Boas Vindas (Lore)</label>
                          <textarea value={wbSettings.description} onChange={e => setWbSettings({...wbSettings, description: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white h-24 resize-none" />
                        </div>
                        <div className="flex justify-end pt-4">
                          <button onClick={saveSettings} disabled={loading} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded transition">
                            Salvar Global da Lore
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TABS CREATION */}
                {activeAdminTab === 'tabs' && (
                  <>
                    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-8 shadow-inner">
                      <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">{editingId ? 'Editar Aba' : 'Nova Aba'}</h3>
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <label className="text-sm font-bold text-slate-400 block mb-1">Nome da Aba (ex: Feitiços, Universos)</label>
                            <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                          </div>
                          <div className="w-24">
                            <label className="text-sm font-bold text-slate-400 block mb-1">Ordem</label>
                            <input type="number" value={formOrderIndex} onChange={e => setFormOrderIndex(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                          </div>
                        </div>
                        <div className="flex gap-6 mt-4">
                          <label className="flex items-center gap-2 text-white cursor-pointer">
                            <input type="checkbox" checked={tabHasItems} onChange={e => setTabHasItems(e.target.checked)} className="w-5 h-5 accent-purple-500" />
                            Possui Grade de Itens?
                          </label>
                          <label className="flex items-center gap-2 text-white cursor-pointer">
                            <input type="checkbox" checked={tabHasTimeline} onChange={e => setTabHasTimeline(e.target.checked)} className="w-5 h-5 accent-purple-500" />
                            Possui Linha do Tempo?
                          </label>
                        </div>
                        <div className="flex justify-end pt-4 gap-2">
                          {editingId && <button onClick={resetForm} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-white font-bold">Cancelar</button>}
                          <button onClick={saveTab} disabled={loading} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded transition">
                            Salvar Aba
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {wbTabs.map(t => (
                        <div key={t.id} className="bg-slate-900 border border-slate-700 p-4 rounded flex justify-between items-center group">
                          <div>
                            <h4 className="font-bold text-white text-lg">{t.name}</h4>
                            <div className="flex gap-2 text-xs mt-1">
                              {t.hasItems && <span className="bg-blue-900/40 text-blue-300 px-2 rounded">Itens</span>}
                              {t.hasTimeline && <span className="bg-purple-900/40 text-purple-300 px-2 rounded">Timeline</span>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => startEditTab(t)} className="bg-slate-800 hover:bg-purple-600 p-2 rounded text-slate-300 hover:text-white transition"><Edit2 size={16}/></button>
                            <button onClick={() => deleteEntity(t.id, 'wbTabs')} className="bg-slate-800 hover:bg-red-600 p-2 rounded text-red-400 hover:text-white transition"><Trash2 size={16}/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ITEMS CREATION */}
                {activeAdminTab === 'items' && (
                  <>
                    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-8 shadow-inner">
                      <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">{editingId ? 'Editar Item' : 'Novo Item'}</h3>
                      <div className="space-y-4">
                        
                        <div className="flex gap-4 flex-col md:flex-row">
                          <div className="flex-1">
                            <label className="text-sm font-bold text-slate-400 block mb-1">Título / Nome</label>
                            <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                          </div>
                          <div className="w-full md:w-64">
                            <label className="text-sm font-bold text-slate-400 block mb-1">Pertence à Aba</label>
                            <select value={itemTabId} onChange={e => setItemTabId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                              <option value="">Selecione a Aba (que aceita itens)...</option>
                              {wbTabs.filter(t => t.hasItems).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                          <div className="w-24">
                            <label className="text-sm font-bold text-slate-400 block mb-1">Ordem</label>
                            <input type="number" value={formOrderIndex} onChange={e => setFormOrderIndex(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                          </div>
                        </div>

                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">Imagem Principal</label>
                          <div className="flex gap-4 items-center">
                            <label className="cursor-pointer bg-slate-950 hover:bg-slate-900 border border-slate-700 p-2 rounded flex-1 flex items-center gap-2">
                              <ImageIcon size={16} className="text-purple-500" />
                              <span className="text-sm truncate text-slate-300">
                                {fileToUpload ? fileToUpload.name : (formImageUrl ? 'Imagem atual via Link' : 'Enviar do PC...')}
                              </span>
                              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && setFileToUpload(e.target.files[0])} />
                            </label>
                            {fileToUpload && <button onClick={() => setFileToUpload(null)} className="text-red-400 p-2"><X size={16}/></button>}
                          </div>
                          <input type="text" value={formImageUrl} onChange={e => setFormImageUrl(e.target.value)} placeholder="Ou URL Direto (Imgur, etc)" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-300 mt-2" />
                        </div>

                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">Descrição Detalhada / Texto</label>
                          <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white min-h-[150px]" />
                        </div>

                        <div className="bg-slate-900/50 p-4 rounded border border-slate-700/50">
                          <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-bold text-purple-400">Campos Customizados (Box de Info)</label>
                            <button onClick={() => setItemFields([...itemFields, {label: '', value: ''}])} className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded flex items-center gap-1"><Plus size={12}/> Adicionar Campo</button>
                          </div>
                          {itemFields.map((f, idx) => (
                            <div key={idx} className="flex gap-2 mb-2 items-start">
                              <input type="text" placeholder="Nome do Campo (Ex: Classe)" value={f.label} onChange={e => { const n = [...itemFields]; n[idx].label = e.target.value; setItemFields(n); }} className="w-1/3 bg-slate-950 border border-slate-700 text-sm rounded p-2 text-white" />
                              <input type="text" placeholder="Valor (Ex: Mago Negro)" value={f.value} onChange={e => { const n = [...itemFields]; n[idx].value = e.target.value; setItemFields(n); }} className="flex-1 bg-slate-950 border border-slate-700 text-sm rounded p-2 text-white" />
                              <button onClick={() => setItemFields(itemFields.filter((_, i) => i !== idx))} className="text-red-400 p-2 hover:bg-slate-800 rounded text-xl">&times;</button>
                            </div>
                          ))}
                          {itemFields.length === 0 && <p className="text-xs text-slate-500 italic">Adicione campos para exibir detalhes extras na ficha do item.</p>}
                        </div>

                        <div className="flex justify-end pt-4 gap-2">
                          {editingId && <button onClick={resetForm} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-white font-bold">Cancelar</button>}
                          <button onClick={saveItem} disabled={loading} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded transition">
                            {editingId ? 'Salvar Alterações' : 'Salvar Item'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                       {wbItems.map(item => (
                         <div key={item.id} className="bg-slate-900 border border-slate-700 p-3 rounded flex justify-between items-center group">
                            <div className="flex items-center gap-4">
                              {item.imageUrl ? <img src={item.imageUrl} className="w-10 h-10 rounded object-cover" alt=""/> : <div className="w-10 h-10 rounded bg-slate-800 border border-slate-700"></div>}
                              <div>
                                <h4 className="font-bold text-white leading-tight">{item.name}</h4>
                                <p className="text-xs text-purple-400">Aba: {wbTabs.find(t=>t.id===item.tabId)?.name}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => startEditItem(item)} className="bg-slate-800 hover:bg-purple-600 p-2 rounded text-slate-300 hover:text-white transition"><Edit2 size={16}/></button>
                              <button onClick={() => deleteEntity(item.id, 'wbItems')} className="bg-slate-800 hover:bg-red-600 p-2 rounded text-red-400 hover:text-white transition"><Trash2 size={16}/></button>
                            </div>
                         </div>
                       ))}
                    </div>
                  </>
                )}

                {/* TIMELINE CREATION */}
                {activeAdminTab === 'timeline' && (
                  <>
                    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-8 shadow-inner">
                      <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">{editingId ? 'Editar Evento' : 'Novo Evento na Timeline'}</h3>
                      <div className="space-y-4">
                        
                        <div className="flex gap-4 flex-col md:flex-row">
                          <div className="w-full md:w-32">
                            <label className="text-sm font-bold text-slate-400 block mb-1">Ano / Topo Date</label>
                            <input type="text" placeholder="Ex: 990 d.C" value={timelineDate} onChange={e => setTimelineDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                          </div>
                          <div className="flex-1">
                            <label className="text-sm font-bold text-slate-400 block mb-1">Título do Evento</label>
                            <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                          </div>
                          
                        </div>

                        <div className="flex gap-4 flex-col md:flex-row">
                           <div className="w-full md:w-64">
                            <label className="text-sm font-bold text-slate-400 block mb-1">Pertence à Aba</label>
                            <select value={timelineTabId} onChange={e => setTimelineTabId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                              <option value="">Selecione a Aba (com timeline)...</option>
                              {wbTabs.filter(t => t.hasTimeline).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                          <div className="w-24">
                            <label className="text-sm font-bold text-slate-400 block mb-1">Ordem (Pos)</label>
                            <input type="number" value={formOrderIndex} onChange={e => setFormOrderIndex(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                          </div>
                        </div>

                        <div>
                           <label className="text-sm font-bold text-slate-400 block mb-1">Imagem Opcional</label>
                           <input type="text" value={formImageUrl} onChange={e => setFormImageUrl(e.target.value)} placeholder="URL Direto (Imgur, etc)" className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-300" />
                        </div>

                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">Descrição</label>
                          <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white min-h-[100px]" />
                        </div>

                        <div className="flex justify-end pt-4 gap-2">
                          {editingId && <button onClick={resetForm} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-white font-bold">Cancelar</button>}
                          <button onClick={saveTimelineEvent} disabled={loading} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded transition">
                            {editingId ? 'Salvar Alterações' : 'Salvar Evento'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                       {wbTimelineEvents.map(event => (
                         <div key={event.id} className="bg-slate-900 border border-slate-700 p-3 rounded flex justify-between items-center group">
                            <div>
                               <h4 className="font-bold text-white leading-tight">
                                 <span className="text-purple-400 mr-2">{event.dateStr}</span>
                                 {event.title}
                               </h4>
                               <p className="text-xs text-slate-500 mt-1">Aba: {wbTabs.find(t=>t.id===event.tabId)?.name}</p>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => startEditTimeline(event)} className="bg-slate-800 hover:bg-purple-600 p-2 rounded text-slate-300 hover:text-white transition"><Edit2 size={16}/></button>
                              <button onClick={() => deleteEntity(event.id, 'wbTimelineEvents')} className="bg-slate-800 hover:bg-red-600 p-2 rounded text-red-400 hover:text-white transition"><Trash2 size={16}/></button>
                            </div>
                         </div>
                       ))}
                    </div>
                  </>
                )}

                {/* ARCHETYPES TAB */}
                {activeAdminTab === 'archetypes' && (
                  <>
                    <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">Gerenciar Arquétipos</h3>
                    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-8 shadow-inner">
                      <h4 className="font-bold text-slate-300 mb-4">{editingId ? 'Editar Arquétipo' : 'Novo Arquétipo'}</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">Nome do Arquétipo</label>
                          <input type="text" value={formName} onChange={e => setFormName(e.target.value)} disabled={!!editingId} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">URL da Imagem (Opcional)</label>
                          <input type="text" value={formImageUrl} onChange={e => setFormImageUrl(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">Descrição</label>
                          <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white h-24 resize-none" />
                        </div>
                        <div className="flex justify-end pt-4 gap-2">
                          {editingId && <button onClick={resetForm} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-white font-bold">Cancelar</button>}
                          <button onClick={async () => {
                            if (!formName) return;
                            setLoading(true);
                            await saveArchetype({
                              name: formName,
                              imageUrl: formImageUrl,
                              description: formDescription
                            });
                            resetForm();
                            setLoading(false);
                          }} disabled={loading} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-6 rounded transition">
                            {editingId ? 'Salvar Alterações' : 'Salvar Arquétipo'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                       {archetypes.map(a => (
                         <div key={a.name} className="bg-slate-900 border border-slate-700 p-3 rounded flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                               {a.imageUrl ? (
                                 <img src={a.imageUrl} className="w-10 h-10 object-cover rounded" alt="" />
                               ) : (
                                 <div className="w-10 h-10 bg-slate-800 rounded flex items-center justify-center"><ImageIcon size={16} className="text-slate-500" /></div>
                               )}
                               <div>
                                 <h4 className="font-bold text-white leading-tight">{a.name}</h4>
                                 <p className="text-xs text-slate-500 line-clamp-1">{a.description}</p>
                               </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => {
                                resetForm();
                                setEditingId(a.name);
                                setFormName(a.name);
                                setFormImageUrl(a.imageUrl || '');
                                setFormDescription(a.description || '');
                              }} className="bg-slate-800 hover:bg-purple-600 p-2 rounded text-slate-300 hover:text-white transition"><Edit2 size={16}/></button>
                            </div>
                         </div>
                       ))}
                    </div>
                  </>
                )}

                {/* COLLECTIONS TAB */}
                {activeAdminTab === 'collections' && (
                  <>
                    <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">Decks e Coleções</h3>
                    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-8 shadow-inner">
                      <h4 className="font-bold text-slate-300 mb-4">Nova Coleção / Deck</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">Nome da Coleção</label>
                          <input type="text" value={collectionEditName} onChange={e => setCollectionEditName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" placeholder="Ex: Deck Estrutural de Início" />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setCollectionEditName('')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-white font-bold transition">Limpar</button>
                          <button onClick={async () => {
                            if (!collectionEditName.trim()) return setError('Nome é obrigatório');
                            setLoading(true);
                            await saveCollection(collectionEditName.trim());
                            setCollectionEditName('');
                            setLoading(false);
                          }} disabled={loading} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded transition">
                            {loading ? 'Salvando...' : 'Salvar Coleção'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                       {collections.map(c => (
                         <div key={c} className="bg-slate-900 border border-slate-700 p-3 rounded flex justify-between items-center group">
                            <span className="text-white font-bold">{c}</span>
                            <div className="flex gap-2">
                              <button onClick={async () => {
                                if(confirm(`Deseja apagar a coleção "${c}"?`) && deleteCollection) {
                                  await deleteCollection(c);
                                }
                              }} className="bg-red-900/50 hover:bg-red-600 p-2 rounded text-red-200 transition opacity-0 group-hover:opacity-100">
                                <Trash2 size={16} />
                              </button>
                            </div>
                         </div>
                       ))}
                       {collections.length === 0 && <p className="text-slate-500 text-sm italic">Nenhuma coleção encontrada.</p>}
                    </div>
                  </>
                )}

                {/* ADD CARD TAB */}
                {activeAdminTab === 'add_card' && (
                  <>
                    <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">{editingId ? 'Editar Carta' : 'Adicionar Carta'}</h3>
                    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-8 shadow-inner">
                      <h4 className="font-bold text-slate-300 mb-4 text-purple-400">{editingId ? `Editando Carta: ${formName}` : 'Criar Nova Carta'}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        <div className="md:col-span-2 lg:col-span-3">
                          <label className="text-sm font-bold text-slate-400 block mb-1">Copiar dados de outra carta</label>
                          <select onChange={handleCopyFromCard} className="w-full bg-slate-900 border border-purple-700 rounded p-2 text-white">
                            <option value="">Selecione uma carta base (copia todos os dados exceto Imagem e Frame)...</option>
                            {cards.map((c, idx) => <option key={`${c.code}-${idx}`} value={c.code}>{c.name} ({c.code}) - {c.frame}</option>)}
                          </select>
                        </div>
                        
                        <div className="md:col-span-2">
                          <label className="text-sm font-bold text-slate-400 block mb-1">Nome da Carta</label>
                          <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">Código da Carta</label>
                          <input type="text" value={cardEditCode} onChange={e => setCardEditCode(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        
                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">Coleção</label>
                          <input type="text" list="collections-list" value={cardCollection} onChange={e => setCardCollection(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                          <datalist id="collections-list">
                             {collections.map(c => <option key={c} value={c} />)}
                          </datalist>
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">Frame</label>
                          <select value={cardFrame} onChange={e => setCardFrame(e.target.value as any)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                            <option value="Legado">Legado</option>
                            <option value="Moderno">Moderno</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">Tipo</label>
                          <select value={cardEditType} onChange={e => setCardEditType(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                            <option value="Herói">Herói</option>
                            <option value="Combatente">Combatente</option>
                            <option value="Equipamento">Equipamento</option>
                            <option value="Efeito">Efeito</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">Arquétipo</label>
                          <select value={cardEditArchetype} onChange={e => setCardEditArchetype(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white">
                            {archetypes.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
                            <option value="Desconhecido">Desconhecido (Sem Arq)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-400 block mb-1">CT (Custo)</label>
                          <input type="number" value={cardEditCT} onChange={e => setCardEditCT(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" />
                        </div>
                        <div>
                          <label className="text-sm font-bold text-slate-500 block mb-1">Ataque / Defesa</label>
                          <div className="flex gap-2">
                            <input type="number" value={cardEditAttack} onChange={e => setCardEditAttack(e.target.value)} className="w-1/2 bg-slate-950 border border-slate-700 rounded p-2 text-white" placeholder="ATK" />
                            <input type="number" value={cardEditDefense} onChange={e => setCardEditDefense(e.target.value)} className="w-1/2 bg-slate-950 border border-slate-700 rounded p-2 text-white" placeholder="DEF" />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-bold text-slate-400 block mb-1">Descrição</label>
                        <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-white h-24 resize-none mb-4" />
                      </div>

                      <div className="flex items-center gap-2 mb-4 bg-slate-800/50 border border-slate-700 p-3 rounded">
                        <input type="checkbox" id="cardEditPublic" checked={!cardEditIsHidden} onChange={e => setCardEditIsHidden(!e.target.checked)} className="w-5 h-5 accent-green-600 cursor-pointer" />
                        <label htmlFor="cardEditPublic" className="text-sm font-bold text-green-400 cursor-pointer">Visível para o Público (Habilitar para todos verem)</label>
                      </div>
                      
                      <div>
                        <label className="text-sm font-bold text-slate-400 block mb-1">ID Código (Lore)</label>
                        <textarea value={cardEditLore} onChange={e => setCardEditLore(e.target.value)} className="w-full bg-slate-900 border border-purple-900/50 rounded p-3 text-slate-400 font-serif h-24 resize-none mb-4 focus:border-purple-500" placeholder="Uma história se perde no tempo..." />
                      </div>

                      <div className="flex justify-end gap-2 items-center">
                        {editingId && (() => {
                          const existingCard = cards.find(c => c.code === editingId);
                          if (existingCard && (!existingCard.frame || existingCard.frame === 'Legado') && cardFrame !== 'Moderno') {
                            return <span className="text-red-400 text-sm font-bold mr-4">⚠️ Cartas do frame Legado não podem ser modificadas (Mude para Moderno para editar).</span>;
                          }
                          return null;
                        })()}
                        <button onClick={resetForm} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-white font-bold">Limpar</button>
                        <button 
                          onClick={async () => { await saveCardData(); if(!error && !loading) { setActiveAdminTab('cards'); resetForm(); } }} 
                          disabled={loading || (editingId ? (() => {
                            const existingCard = cards.find(c => c.code === editingId);
                            return existingCard ? (!existingCard.frame || existingCard.frame === 'Legado') && cardFrame !== 'Moderno' : false;
                          })() : false)} 
                          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2 px-6 rounded transition"
                        >
                          {editingId ? 'Salvar Alterações' : 'Criar Carta'}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* CARDS TAB */}
                {activeAdminTab === 'cards' && (
                  <>
                    <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">Gerenciar Cartas</h3>
                    
                    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-8 shadow-inner">
                      <h4 className="font-bold text-slate-300 mb-4 flex items-center gap-2"><Layers size={18}/> Sincronizar Cartas</h4>
                      <p className="text-sm text-slate-400 mb-4">
                        Suba as pastas com imagens diretamente no <strong>Firebase Storage</strong> no caminho <code>cards/FRAME/DECK/</code>. Ao clicar no botão abaixo, o site lerá todas as imagens novas que ainda não estão configuradas e as listará abaixo para você organizar.
                      </p>
                      <div className="flex justify-start">
                        <button onClick={syncStorageCards} disabled={loading} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-2 px-6 rounded transition flex items-center gap-2">
                          {loading ? 'Sincronizando...' : 'Ler Imagens do Storage'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 mb-8 shadow-inner">
                      <h4 className="font-bold text-slate-300 mb-2">Restaurar Cartas Padrão Excluídas</h4>
                      <p className="text-sm text-slate-400 mb-4">Caso alguma das cartas padrão (como as de Legado ou Booster Pack) tenha sumido por uma exclusão acidental ou sobrescrita, você pode limpá-las da lixeira interna e restaurá-las para que fiquem visíveis de novo.</p>
                      <button onClick={async () => {
                        if(confirm('Tem certeza? Isso fará com que qualquer carta padrão que foi oculta ou sobrescrita volte ao normal.')) {
                          import('firebase/firestore').then(async ({ collection, getDocs, deleteDoc, db }) => {
                            const snap = await getDocs(collection(db, 'customCards'));
                            let c = 0;
                            const deletePromises: any[] = [];
                            snap.forEach(d => {
                              if(!d.id.startsWith('CUST-') && !d.id.startsWith('C-')) {
                                deletePromises.push(deleteDoc(d.ref));
                                c++;
                              }
                            });
                            await Promise.all(deletePromises);
                            alert(`Operação concluída. ${c} carta(s) padrão restauradas! A lista será recarregada.`);
                            window.location.reload();
                          });
                        }
                      }} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded text-sm transition">
                        Restaurar Cartões Padrão
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {cards.filter(c => c.code.startsWith('CUST-') || c.code.startsWith('C-')).map((c, idx) => (
                        <div key={`${c.code}-${idx}`} className="bg-slate-900 border border-slate-700 p-2 rounded flex gap-3 relative item-center h-24 overflow-hidden group">
                           {c.imageUrl && <img src={c.imageUrl} className="w-16 h-full object-cover rounded bg-slate-800" />}
                           <div className="flex-1 py-1">
                             <div className="flex items-center gap-2">
                               <h4 className="font-bold text-white leading-tight truncate">{c.name}</h4>
                               {c.isHidden && <span className="text-[9px] bg-red-900/50 text-red-300 font-bold px-2 py-0.5 rounded border border-red-800">DRAFT</span>}
                             </div>
                             <p className="text-xs text-purple-400">{c.collection}</p>
                             <div className="flex gap-2 text-xs text-slate-500 mt-1">
                               <span>CT: {c.ct}</span> • <span>{c.type}</span>
                               {(c.type === 'Herói' || c.type === 'Combatente') && (
                                 <span>• {c.attack}/{c.defense}</span>
                               )}
                             </div>
                           </div>
                           <div className="absolute right-2 top-0 bottom-0 flex flex-col justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             {(!c.frame || c.frame === 'Legado') ? (
                               <span className="text-[10px] text-slate-500 bg-slate-950/80 px-2 py-1 rounded font-bold border border-slate-700 writing-vertical" style={{writingMode: 'vertical-rl'}}>LEGADO PROTEGIDO</span>
                             ) : (
                               <>
                                 <button onClick={() => startEditCard(c)} className="bg-blue-600 p-2 rounded text-white"><Edit2 size={14}/></button>
                                 <button onClick={async () => {
                                   if (confirmId !== c.code) {
                                     setConfirmId(c.code);
                                     return;
                                   }
                                   await deleteCard(c.code);
                                   setConfirmId(null);
                                 }} className={`p-2 rounded text-white ${confirmId === c.code ? 'bg-red-800 animate-pulse' : 'bg-red-600'}`}><Trash2 size={14}/></button>
                               </>
                             )}
                           </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                
                {activeAdminTab === 'batch_cards' && (
                  <div className="bg-slate-900 border border-slate-700/50 rounded-lg p-6 text-left mt-2">
                    <h3 className="text-xl font-bold text-white mb-4 border-b border-slate-700 pb-2">Adição em Lote (RAW)</h3>
                    
                    {batchStep === 1 && (
                      <>
                        <p className="text-slate-400 mb-6 text-sm">
                          Cole aqui a lista de cartas no formato objeto JavaScript bruto. As propriedades exigidas são name, type, archetype, collection, ct, attack, defense, description, imageUrl, code, lore.
                        </p>

                        <div className="flex items-center gap-2 mb-4 bg-slate-800/50 border border-slate-700 p-3 rounded">
                          <input type="checkbox" id="batchCardsPublic" checked={!batchCardsDraft} onChange={e => setBatchCardsDraft(!e.target.checked)} className="w-5 h-5 accent-green-600 cursor-pointer" />
                          <label htmlFor="batchCardsPublic" className="text-sm font-bold text-green-400 cursor-pointer">Visível para o Público (Habilitar para todos verem)</label>
                        </div>

                        <textarea
                          value={batchCardsInput}
                          onChange={e => setBatchCardsInput(e.target.value)}
                          className="w-full h-96 bg-slate-950 border border-slate-700 rounded p-4 text-slate-300 font-mono text-xs custom-scrollbar resize-y mb-4 focus:border-purple-500 outline-none"
                          placeholder={`{ name: "Exemplo", type: "Herói", archetype: "Nenhum", collection: "Exemplo", ct: 1, attack: 1, defense: 1, description: "...", imageUrl: "...", code: "EX-001", lore: "..." },\n{ ... }`}
                        />

                        <div className="flex justify-end gap-2">
                          <button onClick={() => setBatchCardsInput('')} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-white font-bold transition">Limpar</button>
                          <button onClick={handleParseBatch} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded transition flex items-center gap-2">
                            <Layers size={16} /> Analisar Código
                          </button>
                        </div>
                      </>
                    )}

                    {batchStep === 2 && (
                      <>
                        <div className="mb-6 bg-slate-800 p-4 rounded border border-slate-700 flex flex-col xl:flex-row gap-4">
                          <div className="flex-1">
                            <label className="text-sm font-bold text-slate-400 block mb-2">Coleção Global (Deixe vazio para manter a da carta, ou preencha para criar/sobrescrever a coleção destas cartas)</label>
                            <input 
                              type="text" 
                              list="collections-list-batch"
                              value={batchCollection} 
                              onChange={e => setBatchCollection(e.target.value)} 
                              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white" 
                              placeholder="Ex: Reforço Macroversal" 
                            />
                            <datalist id="collections-list-batch">
                               {collections.map(c => <option key={c} value={c} />)}
                            </datalist>
                          </div>
                          <div className="w-full xl:w-1/4">
                            <label className="text-sm font-bold text-slate-400 block mb-2">Frame Padrão</label>
                            <select 
                              value={batchFrame} 
                              onChange={e => setBatchFrame(e.target.value as any)} 
                              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                            >
                              <option value="Legado">Legado</option>
                              <option value="Moderno">Moderno</option>
                            </select>
                          </div>
                        </div>

                        <div className="mb-6 max-h-96 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                          <h4 className="font-bold text-purple-400 mb-2">Cartas Encontradas ({parsedBatchCards.length})</h4>
                          {parsedBatchCards.map(c => (
                            <div key={c.code} className="bg-slate-950 border border-slate-800 p-3 rounded flex flex-col xl:flex-row xl:items-start gap-4">
                              <div className="flex-1 min-w-0">
                                <h5 className="font-bold text-white text-sm truncate">{c.name}</h5>
                                <p className="text-xs text-slate-500">{c.code} • {c.type} • {c.collection || 'Sem Coleção'}</p>
                                <div className="mt-2 text-xs">
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Frame Específico (Vazio = Usa o Padrão)</label>
                                  <select 
                                    className="bg-slate-900 border border-slate-700 rounded p-1 text-white text-xs w-full max-w-xs"
                                    value={c.frame || ''}
                                    onChange={(e) => {
                                      const newCards = [...parsedBatchCards];
                                      const idx = newCards.findIndex(card => card.code === c.code);
                                      if (idx > -1) {
                                        newCards[idx].frame = e.target.value === '' ? undefined : e.target.value;
                                        setParsedBatchCards(newCards);
                                      }
                                    }}
                                  >
                                    <option value="">Usar Frame Padrão da Lote</option>
                                    <option value="Legado">Legado</option>
                                    <option value="Moderno">Moderno</option>
                                  </select>
                                </div>
                              </div>
                              <div className="w-full xl:w-96 flex flex-col gap-2">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">URL da Imagem</label>
                                  <input 
                                    type="text"
                                    value={c.imageUrl && c.imageUrl !== 'INSIRA O CODIGO' ? c.imageUrl : ''}
                                    placeholder="Apenas se não for fazer upload"
                                    onChange={(e) => {
                                      const newCards = [...parsedBatchCards];
                                      const idx = newCards.findIndex(card => card.code === c.code);
                                      if (idx > -1) {
                                        newCards[idx].imageUrl = e.target.value;
                                        setParsedBatchCards(newCards);
                                      }
                                    }}
                                    className="w-full text-xs bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Ou fazer Upload</label>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e: any) => {
                                      if(e.target.files && e.target.files[0]) {
                                        setBatchImages(prev => ({...prev, [c.code]: e.target.files[0]}));
                                      }
                                    }}
                                    className="text-[10px] text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:font-semibold file:bg-purple-900 file:text-white hover:file:bg-purple-800 w-full cursor-pointer"
                                  />
                                  {batchImages[c.code] && <span className="text-[10px] text-green-400 mt-1 block">Arquivo {batchImages[c.code].name} selecionado.</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded border border-slate-700">
                           <button onClick={() => setBatchStep(1)} disabled={loading} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-white font-bold transition">Voltar</button>
                           <button onClick={handleConfirmBatchSave} disabled={loading} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-8 rounded transition flex items-center gap-2">
                             {loading ? <Layers className="animate-spin" size={16}/> : <Check size={16} />} 
                             {loading ? 'Salvando...' : 'Finalizar Salve'}
                           </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                
                {activeAdminTab === 'apendices' && (
                  <div className="flex flex-col items-center justify-center py-24 bg-slate-900 border border-slate-700/50 rounded-lg text-center mt-2 group relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-purple-900/20 to-transparent pointer-events-none"></div>
                    <BookOpen className="text-purple-500/50 mb-4" size={48} />
                    <h3 className="text-2xl font-bold text-white mb-2 relative z-10">Apêndices (Em breve)</h3>
                    <p className="text-slate-400 max-w-md mx-auto relative z-10">Aqui você poderá adicionar glossários, documentos detalhados e referências expandidas para a lore do seu universo.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
