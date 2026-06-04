import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { X, Clock, Grid, Feather, ChevronRight, Layers } from 'lucide-react';
import { AdminPanel } from './AdminPanel';

export const LoreView = ({ onClose }: { onClose: () => void }) => {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Data
  const [wbSettings, setWbSettings] = useState<any>({
    mainTitle: 'ARCHIVUM',
    subtitle: 'Secretum · Archivum · Imperii',
    description: 'Um grande compêndio contendo universos esquecidos, personagens lendários e a cronologia dos mundos.',
    primaryColor: '#d4af37'
  });
  const [wbTabs, setWbTabs] = useState<any[]>([]);
  const [wbItems, setWbItems] = useState<any[]>([]);
  const [wbTimelineEvents, setWbTimelineEvents] = useState<any[]>([]);

  // Navigation State
  const [currentView, setCurrentView] = useState<'home' | 'tab_view' | 'item_detail'>('home');
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [isAdminOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const gSnap = await getDoc(doc(db, 'wbSettings', 'global'));
      if (gSnap.exists()) {
        setWbSettings(gSnap.data());
      }

      const tabsSnap = await getDocs(collection(db, 'wbTabs'));
      const tbs = tabsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      tbs.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setWbTabs(tbs);

      const itemsSnap = await getDocs(collection(db, 'wbItems'));
      const itms = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      itms.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setWbItems(itms);

      const timeSnap = await getDocs(collection(db, 'wbTimelineEvents'));
      const times = timeSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      times.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setWbTimelineEvents(times);

    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const navToTab = (tabId: string) => {
    setActiveTabId(tabId);
    setSelectedItem(null);
    setCurrentView('tab_view');
  };

  const primaryHex = wbSettings.primaryColor || '#d4af37';

  // Helper to safely inject CSS vars
  const styleVars = {
    '--primary-color': primaryHex,
    '--primary-rgb': hexToRgb(primaryHex),
  } as React.CSSProperties;

  function hexToRgb(hex: string) {
    let r = 212, g = 175, b = 55; // default gold
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
      let c= hex.substring(1).split('');
      if(c.length== 3){
        c= [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      let cNum= parseInt(c.join(''), 16);
      r = (cNum >> 16) & 255;
      g = (cNum >> 8) & 255;
      b = cNum & 255;
    }
    return `${r}, ${g}, ${b}`;
  }

  const currentTab = wbTabs.find(t => t.id === activeTabId);
  const currentTabItems = wbItems.filter(i => i.tabId === activeTabId);
  const currentTabEvents = wbTimelineEvents.filter(te => te.tabId === activeTabId);

  const TopNav = () => (
    <nav className="fixed top-0 left-0 w-full z-[100] border-b border-[rgba(var(--primary-rgb),0.2)] bg-[#060608]/90 backdrop-blur-md px-6 py-4 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-8 overflow-x-auto no-scrollbar">
        <h1 className="text-3xl font-black tracking-widest text-[#primary-color] font-cinzel mr-4 shrink-0" style={{ color: 'var(--primary-color)', textShadow: '0 0 10px rgba(var(--primary-rgb),0.4)' }}>
          {wbSettings.mainTitle || 'CMS'}
        </h1>
        <div className="flex items-center gap-6 text-xs tracking-[0.2em] uppercase text-[#a8a29e] font-bold">
          <button onClick={() => setCurrentView('home')} className={`hover:text-white transition whitespace-nowrap ${currentView === 'home' ? 'text-[var(--primary-color)]' : ''}`}>Início</button>
          
          {wbTabs.map(t => (
            <button 
              key={t.id} 
              onClick={() => navToTab(t.id)} 
              className={`hover:text-white transition whitespace-nowrap py-1 ${activeTabId === t.id && currentView !== 'home' ? 'text-[var(--primary-color)] border-b border-[var(--primary-color)]' : ''}`}
            >
              {t.name}
            </button>
          ))}
          
          <button onClick={() => setIsAdminOpen(true)} className="hover:text-purple-400 text-purple-600 transition whitespace-nowrap ml-4 border border-purple-900/50 px-3 py-1 rounded">
            Área do Mestre
          </button>
        </div>
      </div>
      <div>
        <button onClick={onClose} className="text-[#a8a29e] hover:text-white transition flex items-center gap-2 text-xs tracking-widest uppercase font-bold border border-[rgba(var(--primary-rgb),0.3)] px-4 py-2 hover:bg-[rgba(var(--primary-rgb),0.1)] shrink-0">
          <X size={16} /> Fechar
        </button>
      </div>
    </nav>
  );

  return (
    <div className="fixed inset-0 z-[90] bg-[#060608] text-slate-300 overflow-y-auto" style={styleVars}>
      <style dangerouslySetInnerHTML={{__html: `
        .font-cinzel { font-family: 'Cinzel', serif; }
        .font-playfair { font-family: 'Playfair Display', serif; }
        
        ::selection {
          background-color: rgba(var(--primary-rgb), 0.3);
          color: var(--primary-color);
        }
        
        .text-theme { color: var(--primary-color); }
        .bg-theme { background-color: var(--primary-color); }
        .border-theme { border-color: rgba(var(--primary-rgb), 0.4); }
        .drop-shadow-theme { filter: drop-shadow(0 0 15px rgba(var(--primary-rgb), 0.5)); }
        
        .gold-line {
          position: relative;
        }
        .gold-line::after {
          content: '';
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 50px;
          height: 1px;
          background: rgba(var(--primary-rgb), 0.5);
        }
      `}} />

      <TopNav />
      {isAdminOpen && <AdminPanel adminType="master" onClose={() => setIsAdminOpen(false)} />}

      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <Feather size={40} className="text-theme mb-4 opacity-50" />
            <p className="font-cinzel text-theme text-sm tracking-widest uppercase opacity-70">Desenterrando registros...</p>
          </div>
        </div>
      ) : (
        <div className="pt-24 min-h-screen">
          
          {/* HOME VIEW */}
          {currentView === 'home' && (
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: 'radial-gradient(ellipse at center, rgba(var(--primary-rgb),0.2), #060608, #060608)' }}></div>
              
              <p className="text-theme tracking-[0.3em] text-xs font-bold uppercase mb-4 opacity-70">{wbSettings.subtitle}</p>
              
              <h2 className="font-cinzel text-7xl md:text-9xl text-theme font-bold mb-8 drop-shadow-theme tracking-tight uppercase">
                {wbSettings.mainTitle}
              </h2>
              
              <div className="gold-line mb-10 w-full"></div>
              
              <p className="font-playfair text-xl md:text-2xl text-[#a8a29e] max-w-2xl mb-12 leading-relaxed whitespace-pre-wrap">
                {wbSettings.description}
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {wbTabs.length > 0 ? (
                  <button 
                    onClick={() => navToTab(wbTabs[0].id)}
                    className="font-cinzel border border-theme bg-[rgba(var(--primary-rgb),0.1)] hover:bg-[rgba(var(--primary-rgb),0.2)] text-theme px-8 py-3 tracking-widest uppercase text-sm font-bold transition duration-500 shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)] hover:shadow-[0_0_25px_rgba(var(--primary-rgb),0.4)]"
                  >
                    Abrir o Arquivo
                  </button>
                ) : (
                  <button onClick={() => setIsAdminOpen(true)} className="font-cinzel border border-purple-500 text-purple-400 px-8 py-3 tracking-widest uppercase text-sm font-bold transition hover:bg-purple-900/30">
                    Configurar Área do Mestre
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB VIEW (Grid and/or Timeline) */}
          {currentView === 'tab_view' && currentTab && (
            <div className="animate-fade-in pb-32 pt-10 relative max-w-7xl mx-auto px-6">
              
              <div className="text-center mb-20 relative">
                 <h2 className="font-cinzel text-5xl md:text-7xl font-black text-theme drop-shadow-theme uppercase tracking-wider">
                    {currentTab.name}
                 </h2>
                 <div className="gold-line mt-6 mx-auto w-10"></div>
              </div>

              <div className="flex flex-col gap-24">
                
                {/* ITEMS GRID */}
                {currentTab.hasItems && (
                  <div>
                    <h3 className="font-cinzel text-3xl text-white mb-10 uppercase tracking-widest flex items-center gap-4">
                      <Grid className="text-theme" size={28} /> Registros
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {currentTabItems.map(item => (
                        <div 
                          key={item.id} 
                          onClick={() => { setSelectedItem(item); setCurrentView('item_detail'); }}
                          className="border border-[#333] hover:border-theme bg-[#0a0a0c] relative group cursor-pointer transition duration-500 overflow-hidden flex flex-col h-96 shadow-lg"
                        >
                          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0a0a0c] z-10 opacity-90 group-hover:opacity-70 transition"></div>
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name} className="absolute inset-0 w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition duration-700 ease-in-out scale-100 group-hover:scale-110" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03]">
                              <Feather size={100} className="text-white" />
                            </div>
                          )}
                          
                          <div className="relative z-20 mt-auto p-6 transition-transform duration-500 transform translate-y-4 group-hover:translate-y-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent pt-12">
                            <h4 className="font-cinzel text-2xl text-theme mb-2 font-bold">{item.name}</h4>
                            <p className="font-playfair text-sm text-slate-400 line-clamp-2 italic mb-4 opacity-0 group-hover:opacity-100 transition duration-500 delay-100">
                              {item.description || "Descrição ofuscada pelo tempo..."}
                            </p>
                            <div className="w-12 h-[2px] bg-theme opacity-50 group-hover:w-full transition-all duration-700"></div>
                          </div>
                        </div>
                      ))}

                      {currentTabItems.length === 0 && (
                        <div className="col-span-full border border-[#222] border-dashed p-12 text-center text-[#666] font-playfair italic text-lg">
                          Nenhum registro encontrado nesta aba.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TIMELINE */}
                {currentTab.hasTimeline && (
                  <div>
                    <h3 className="font-cinzel text-3xl text-white mb-16 uppercase tracking-widest flex items-center gap-4">
                      <Clock className="text-theme" size={28} /> Linha do Tempo
                    </h3>
                    
                    <div className="relative max-w-4xl mx-auto">
                      {/* Central Line */}
                      <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-[2px] bg-theme opacity-20 transform md:-translate-x-1/2"></div>
                      
                      {currentTabEvents.length === 0 && (
                        <div className="border border-[#222] border-dashed p-12 text-center text-[#666] font-playfair italic text-lg mt-8">
                          Nenhum evento registrado no tempo.
                        </div>
                      )}

                      <div className="space-y-16">
                        {currentTabEvents.map((ev, idx) => {
                          const isEven = idx % 2 === 0;
                          return (
                            <div key={ev.id} className={`relative flex items-center flex-col md:flex-row ${isEven ? 'md:flex-row-reverse' : ''}`}>
                              
                              {/* Connector Dot */}
                              <div className="absolute left-4 md:left-1/2 w-4 h-4 bg-[#0a0a0c] border-[3px] border-theme rounded-full transform -translate-x-[7px] md:-translate-x-1/2 z-10 shadow-[0_0_10px_rgba(var(--primary-rgb),0.8)]"></div>
                              
                              <div className={`w-full md:w-1/2 pl-12 pr-4 md:px-12 ${isEven ? 'md:text-left' : 'md:text-right'}`}>
                                 {ev.dateStr && (
                                   <div className="inline-block font-mono text-xs tracking-widest text-theme border border-theme/30 bg-theme/5 px-3 py-1 mb-3">
                                      {ev.dateStr}
                                   </div>
                                 )}
                                 <h4 className="font-cinzel text-2xl text-white font-bold mb-3 uppercase tracking-wider">{ev.title}</h4>
                                 {ev.imageUrl && (
                                   <div className={`mb-4 rounded overflow-hidden border border-[#333] shadow-lg inline-block w-full max-w-sm ${isEven ? '' : 'ml-auto'}`}>
                                     <img src={ev.imageUrl} alt="" className="w-full h-48 object-cover filter brightness-75 contrast-125 hover:brightness-100 transition" />
                                   </div>
                                 )}
                                 <p className="font-playfair text-[#cbd5e1] leading-relaxed whitespace-pre-wrap">{ev.description}</p>
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ITEM DETAIL VIEW */}
          {currentView === 'item_detail' && selectedItem && (
            <div className="animate-fade-in pb-20 pt-8 min-h-screen relative">
              <div className="max-w-5xl mx-auto px-6">
                
                <button 
                  onClick={() => setCurrentView('tab_view')}
                  className="mb-10 font-cinzel text-theme text-sm tracking-widest uppercase flex items-center gap-2 hover:text-white transition group"
                >
                  <ChevronRight size={16} className="transform rotate-180 group-hover:-translate-x-1 transition" /> Retornar
                </button>

                <div className="flex flex-col md:flex-row gap-12 items-start">
                  
                  {/* Left Column (Image & Fields) */}
                  <div className="w-full md:w-1/3 shrink-0">
                    <div className="border-4 border-[#1a1a1a] p-2 bg-[#060608] shadow-[0_0_30px_rgba(var(--primary-rgb),0.15)] relative group">
                      <div className="absolute inset-0 bg-theme/10 opacity-0 group-hover:opacity-100 transition duration-700 pointer-events-none z-20 mix-blend-overlay"></div>
                      {selectedItem.imageUrl ? (
                        <div className="aspect-[3/4] overflow-hidden relative">
                           <img src={selectedItem.imageUrl} alt="" className="w-full h-full object-cover filter contrast-125" />
                           <div className="absolute inset-0 ring-1 ring-inset ring-theme/20 pointer-events-none"></div>
                        </div>
                      ) : (
                        <div className="aspect-[3/4] flex items-center justify-center bg-[#0a0a0c] border border-[#333]">
                           <Feather size={48} className="text-[#333]" />
                        </div>
                      )}
                    </div>
                    
                    {/* Custom Fields Box */}
                    {selectedItem.customFields && selectedItem.customFields.length > 0 && (
                      <div className="mt-8 border border-theme/20 bg-[#0a0a0c] p-6">
                        <h5 className="font-cinzel text-theme mb-4 text-center uppercase tracking-widest border-b border-[#333] pb-2 text-sm">Registros Auxiliares</h5>
                        <div className="space-y-4 font-mono text-sm">
                          {selectedItem.customFields.map((field: any, idx: number) => (
                            <div key={idx}>
                              <span className="text-white block mb-1 uppercase tracking-wider text-[10px] opacity-70">{field.label}</span>
                              <span className="text-[#a8a29e]">{field.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column (Info) */}
                  <div className="flex-1 space-y-12 w-full">
                     <div>
                       <h2 className="font-cinzel text-4xl md:text-6xl font-black text-theme drop-shadow-theme mb-6 uppercase tracking-wider">{selectedItem.name}</h2>
                       <div className="w-24 h-[1px] bg-theme mb-8 opacity-70"></div>
                       <div className="font-playfair text-xl text-slate-300 leading-loose whitespace-pre-wrap first-letter:text-6xl first-letter:font-cinzel first-letter:text-theme first-letter:float-left first-letter:mr-3 first-letter:pr-1 first-letter:border-b-2 first-letter:border-theme">
                         {selectedItem.description}
                       </div>
                     </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
