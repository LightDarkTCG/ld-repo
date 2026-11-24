import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  X,
  Compass,
  Upload,
  Image as ImageIcon,
  Check,
  Trash2
} from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, readBrowserCache, writeBrowserCache } from '../firebase';
import { CyberArcaneCornerFrame } from './ArcaneCyberTheme';

export type TourEnvironmentView =
  | 'home'
  | 'home_account'
  | 'catalog_grid'
  | 'catalog_card_open'
  | 'lore_home'
  | 'lore_map'
  | 'lore_relations'
  | 'lore_quiz'
  | 'game_setup'
  | 'game_board'
  | 'tournament_config'
  | 'tournament_bracket'
  | 'deckbuilder_build'
  | 'deckbuilder_mulligan'
  | 'deckbuilder_neural'
  | 'deckbuilder_compare'
  | 'deckbuilder_stats'
  | 'popular_modal'
  | 'store_modal';

export interface BlairTourSlide {
  id: string;
  stepNumber: string;
  title: string;
  targetTourId?: string;
  targetSelector?: string;
  envView: TourEnvironmentView;
  manualSection?: string;
  padding?: number;
  blairPoseSuggestion: string;
  blairSpeech: string;
}

export const BLAIR_TOUR_SLIDES: BlairTourSlide[] = [
  {
    id: 'step_01_welcome',
    stepNumber: '01',
    title: 'Boas-Vindas ao Light Dark TCG',
    targetTourId: 'tour-hero-main',
    envView: 'home',
    padding: 14,
    blairPoseSuggestion: 'Pose 01 • Blair Saudando com Sorriso Confiante',
    blairSpeech:
      'Olá, viajante! Eu sou a Blair e vou apresentar cada área e ferramenta de Light Dark TCG ao vivo na tela. Você pode interagir e clicar livremente em cada setor destacado enquanto avançamos!'
  },
  {
    id: 'step_02_btn_conheca',
    stepNumber: '02',
    title: 'Conheça o Site',
    targetTourId: 'tour-btn-conheca',
    envView: 'home',
    padding: 8,
    blairPoseSuggestion: 'Pose 02 • Blair Apontando com Piscadinha',
    blairSpeech:
      'Sempre que quiser rever esta apresentação guiada, basta clicar aqui para me chamar novamente.'
  },
  {
    id: 'step_03_site_effects',
    stepNumber: '03',
    title: 'Efeitos do Site',
    targetTourId: 'tour-btn-effects',
    envView: 'home',
    padding: 8,
    blairPoseSuggestion: 'Pose 03 • Blair Ajustando Controle Holográfico',
    blairSpeech:
      'Aqui você ativa ou desativa as luzes, partículas reativas ao mouse no computador e animações visuais, deixando o site mais leve sempre que preferir.'
  },
  {
    id: 'step_04_music_player',
    stepNumber: '04',
    title: 'Player de Música Oficial',
    targetTourId: 'tour-music-player',
    envView: 'home',
    padding: 8,
    blairPoseSuggestion: 'Pose 04 • Blair com Fones / Notas Musicais',
    blairSpeech:
      'Nosso Player reproduz as trilhas sonoras originais de Light Dark. Enquanto estamos no tutorial ele aguarda em silêncio, e assim que terminarmos a música começa a tocar!'
  },
  {
    id: 'step_05_novidades',
    stepNumber: '05',
    title: 'Destaques & Novidades',
    targetTourId: 'tour-sec-novidades',
    envView: 'home',
    padding: 12,
    blairPoseSuggestion: 'Pose 05 • Blair Apresentando o Carrossel de Lançamentos',
    blairSpeech:
      'Nesta vitrine ficam os lançamentos, pré-vendas, eventos e produtos em destaque. Você pode clicar em qualquer card do carrossel para ver todos os detalhes.'
  },
  {
    id: 'step_06_card_types',
    stepNumber: '06',
    title: 'Tipos de Cartas',
    targetTourId: 'tour-sec-cartas',
    envView: 'home',
    padding: 12,
    blairPoseSuggestion: 'Pose 06 • Blair Apresentando as 5 Categorias de Cartas',
    blairSpeech:
      'Aqui estão os 5 Tipos de Cartas do jogo: Herói, Combatente, Equipamento, Efeito e Token. Pode clicar em qualquer uma das 5 cartas para ver o resumo daquela categoria!'
  },
  {
    id: 'step_07_manual_modes',
    stepNumber: '07',
    title: 'Manual Oficial — 1v1 e Mesão',
    targetTourId: 'tour-manual-header',
    envView: 'home',
    padding: 12,
    blairPoseSuggestion: 'Pose 07 • Blair Segurando o Códice de Regras',
    blairSpeech:
      'Este é o Manual Oficial para o Modo Normal (1v1) e para o Modo Mesão. Basta alternar entre os dois modos aqui em cima para consultar as regras de cada formato!'
  },
  {
    id: 'step_08_manual_patch',
    stepNumber: '08',
    title: '01. Patch Atual',
    targetSelector: '#section-patch',
    envView: 'home',
    manualSection: 'patch',
    padding: 10,
    blairPoseSuggestion: 'Pose 08 • Blair Apontando as Notas da Versão',
    blairSpeech:
      'Em Patch Atual ficam todas as notas da versão vigente, atualizações recentes e ajustes oficiais do jogo.'
  },
  {
    id: 'step_09_manual_basico',
    stepNumber: '09',
    title: '02. Básico',
    targetSelector: '#section-basico',
    envView: 'home',
    manualSection: 'basico',
    padding: 10,
    blairPoseSuggestion: 'Pose 09 • Blair Mostrando os Fundamentos no Manual',
    blairSpeech:
      'Em Básico você consulta os requisitos de montagem de deck, os status essenciais e a estrutura geral de uma partida.'
  },
  {
    id: 'step_10_manual_cartas',
    stepNumber: '10',
    title: '03. Cartas',
    targetSelector: '#section-cartas',
    envView: 'home',
    manualSection: 'cartas',
    padding: 10,
    blairPoseSuggestion: 'Pose 10 • Blair Explicando a Anatomia das Cartas',
    blairSpeech:
      'Na seção Cartas você vê a anatomia completa de uma carta, identificando Custo (CT), Ataque, Vida, Arquétipo, Raridade e efeitos.'
  },
  {
    id: 'step_11_manual_turnos_regras',
    stepNumber: '11',
    title: '04. Turnos e 05. Regras',
    targetSelector: '#section-turnos',
    envView: 'home',
    manualSection: 'turnos_regras',
    padding: 10,
    blairPoseSuggestion: 'Pose 11 • Blair Mostrando a Ordem dos Turnos e Regras',
    blairSpeech:
      'Em Turnos e Regras ficam a sequência das fases da rodada e o glossário oficial de termos e interações das partidas.'
  },
  {
    id: 'step_12_manual_arquetipos',
    stepNumber: '12',
    title: '06. Arquétipos',
    targetSelector: '#section-arquetipos',
    envView: 'home',
    manualSection: 'arquetipos',
    padding: 10,
    blairPoseSuggestion: 'Pose 12 • Blair Destacando a Matriz de Arquétipos',
    blairSpeech:
      'Aqui estão os Arquétipos! Todo o balanceamento oficial do jogo vem desta parte, detalhando as habilidades, vantagens e sinergias de cada arquétipo.'
  },
  {
    id: 'step_13_manual_campos',
    stepNumber: '13',
    title: '07. Campos',
    targetSelector: '#section-campos',
    envView: 'home',
    manualSection: 'campos',
    padding: 10,
    blairPoseSuggestion: 'Pose 13 • Blair Apontando o Mapa do Tabuleiro',
    blairSpeech:
      'Este é o Campo interativo! Clique livremente em qualquer zona do tabuleiro aí na tela para ver a explicação detalhada de onde ficam os Heróis, Combatentes, Equipamentos, Mana, Vida e Runas.'
  },
  {
    id: 'step_14_manual_raridades',
    stepNumber: '14',
    title: '08. Raridade das Cartas',
    targetSelector: '#section-raridades',
    envView: 'home',
    manualSection: 'raridades',
    padding: 10,
    blairPoseSuggestion: 'Pose 14 • Blair Exibindo os Selos de Raridade',
    blairSpeech:
      'Em Raridade das Cartas você conhece todas as raridades oficiais do jogo, podendo alternar entre os selos do Frame Moderno e do Frame Legado.'
  },
  {
    id: 'step_15_manual_faq',
    stepNumber: '15',
    title: '09. FAQ Rápido',
    targetSelector: '#section-faq',
    envView: 'home',
    manualSection: 'faq',
    padding: 10,
    blairPoseSuggestion: 'Pose 15 • Blair Consultando o Juiz Digital',
    blairSpeech:
      'E no FAQ Rápido você pesquisa respostas oficiais sobre cartas e interações ou envia sua própria dúvida!'
  },
  {
    id: 'step_16_btn_catalog',
    stepNumber: '16',
    title: 'Catálogo',
    targetTourId: 'tour-btn-catalog',
    envView: 'home',
    padding: 8,
    blairPoseSuggestion: 'Pose 16 • Blair Apresentando o Catálogo',
    blairSpeech:
      'Agora vamos conhecer o Catálogo Oficial com todas as cartas lançadas de Light Dark TCG!'
  },
  {
    id: 'step_17_catalog_open',
    stepNumber: '17',
    title: 'Catálogo de Cartas',
    targetTourId: 'tour-catalog-first-card',
    envView: 'catalog_grid',
    padding: 14,
    blairPoseSuggestion: 'Pose 17 • Blair Navegando pelo Catálogo de Cartas',
    blairSpeech:
      'No Catálogo você pesquisa qualquer carta por nome, código ou efeito e filtra por Coleção, Frame (Moderno ou Legado), Raridade, Tipo, Arquétipo, CT, ATK e VIDA. Vamos abrir uma carta para ver todos os detalhes!'
  },
  {
    id: 'step_18_catalog_card_detail',
    stepNumber: '18',
    title: 'Detalhes da Carta',
    targetTourId: 'tour-card-detail-modal',
    envView: 'catalog_card_open',
    padding: 10,
    blairPoseSuggestion: 'Pose 18 • Blair Examinando uma Carta Holográfica Aberta',
    blairSpeech:
      'Ao abrir uma carta, você confere a Descrição completa do efeito e da história, todas as Versões disponíveis (Frame Moderno, Frame Legado e skins), a Raridade, informações de Tiragem, marcação no seu Álbum e cartas com sinergia!'
  },
  {
    id: 'step_19_btn_lore',
    stepNumber: '19',
    title: 'Lore',
    targetTourId: 'tour-btn-lore',
    envView: 'home',
    padding: 8,
    blairPoseSuggestion: 'Pose 19 • Blair Apresentando a Lore',
    blairSpeech:
      'Ao lado do Catálogo fica a Lore, onde toda a história do universo Light Dark está reunida. Vamos entrar!'
  },
  {
    id: 'step_20_lore_archivum',
    stepNumber: '20',
    title: 'Lore — Archivum',
    targetTourId: 'tour-lore-main',
    envView: 'lore_home',
    padding: 10,
    blairPoseSuggestion: 'Pose 20 • Blair Abrindo os Arquivos da Lore',
    blairSpeech:
      'No Archivum você alterna entre o Macroverso 13 e o Macroverso 1 e explora as histórias, personagens, contos, conceitos e capítulos ilustrados.'
  },
  {
    id: 'step_21_lore_map3d',
    stepNumber: '21',
    title: 'Lore — Mapa 3D & Linha do Tempo',
    targetTourId: 'tour-lore-main',
    envView: 'lore_map',
    padding: 10,
    blairPoseSuggestion: 'Pose 21 • Blair Diante do Mapa Estelar 3D',
    blairSpeech:
      'Este é o Mapa 3D Interativo com a Linha do Tempo aberta no rodapé! Você pode girar o cosmos, dar zoom nos setores, clicar nos mundos para ler a história de cada local e navegar pelas eras do Macroverso 13.'
  },
  {
    id: 'step_22_lore_relations_quiz',
    stepNumber: '22',
    title: 'Lore — Árvore de Relações, Quiz & Músicas',
    targetTourId: 'tour-lore-main',
    envView: 'lore_relations',
    padding: 10,
    blairPoseSuggestion: 'Pose 22 • Blair Mostrando a Árvore de Relações e o Quiz',
    blairSpeech:
      'Também temos a Árvore Interativa de Relações (que conecta alianças, famílias e rivalidades entre personagens), o Quiz Diário que vale pontos no seu perfil e a aba de Músicas oficiais!'
  },
  {
    id: 'step_23_btn_duelo',
    stepNumber: '23',
    title: 'App Duelo',
    targetTourId: 'tour-btn-duelo',
    envView: 'home',
    padding: 8,
    blairPoseSuggestion: 'Pose 23 • Blair Apresentando o App Duelo',
    blairSpeech:
      'Agora vamos abrir o App Duelo, o marcador oficial para acompanhar suas partidas presenciais ou online!'
  },
  {
    id: 'step_24_duelo_setup',
    stepNumber: '24',
    title: 'App Duelo — Modos de Partida',
    targetTourId: 'tour-gameboard-setup',
    envView: 'game_setup',
    padding: 12,
    blairPoseSuggestion: 'Pose 24 • Blair Configurando uma Partida no App Duelo',
    blairSpeech:
      'Aqui você escolhe se vai jogar no Mesmo Aparelho ou via Conexão Online (criando uma sala para cada jogador usar seu próprio celular), tanto no Modo Normal (2 jogadores) quanto no Modo Mesão (4 jogadores).'
  },
  {
    id: 'step_25_duelo_board',
    stepNumber: '25',
    title: 'App Duelo — Marcador em Partida',
    targetTourId: 'tour-gameboard-active',
    envView: 'game_board',
    padding: 10,
    blairPoseSuggestion: 'Pose 25 • Blair Ativando as 3 Runas no Campo de Batalha',
    blairSpeech:
      'Durante o duelo, o marcador controla Pontos de Vida, Mana da rodada, Redução de CT, Dano Primordial, ativação de Runas, Sanidade, contador de Rodadas e o Log completo da partida!'
  },
  {
    id: 'step_26_btn_duel_ia',
    stepNumber: '26',
    title: 'Duelo vs IA',
    targetTourId: 'tour-btn-duel-ia',
    envView: 'home',
    padding: 8,
    blairPoseSuggestion: 'Pose 26 • Blair com Sorriso Misterioso',
    blairSpeech:
      'Em breve poderei falar disso... mas o Mestre ainda não terminou de montar..'
  },
  {
    id: 'step_27_btn_torneio',
    stepNumber: '27',
    title: 'Torneios',
    targetTourId: 'tour-btn-torneio',
    envView: 'home',
    padding: 8,
    blairPoseSuggestion: 'Pose 27 • Blair Apresentando os Torneios',
    blairSpeech:
      'Em Torneios ficam os campeonatos da comunidade e os oficiais, assim como as Ligas e Copas presenciais e online!'
  },
  {
    id: 'step_28_torneio_open',
    stepNumber: '28',
    title: 'Torneios, Ligas e Copas',
    targetTourId: 'tour-tournament-main',
    envView: 'tournament_bracket',
    padding: 10,
    blairPoseSuggestion: 'Pose 28 • Blair Erguendo o Troféu de Campeã',
    blairSpeech:
      'Aqui você acompanha os torneios da comunidade e os torneios oficiais, além das Ligas e Copas presenciais e online, podendo conferir a classificação, a agenda de duelos e assistir às partidas ao vivo!'
  },
  {
    id: 'step_29_btn_deckbuilder',
    stepNumber: '29',
    title: 'Monte Seu Deck',
    targetTourId: 'tour-btn-deckbuilder',
    envView: 'home',
    padding: 8,
    blairPoseSuggestion: 'Pose 29 • Blair Apresentando o DeckBuilder',
    blairSpeech:
      'Agora vamos entrar no DeckBuilder para ver cada ferramenta de construção e análise de decks em ação!'
  },
  {
    id: 'step_30_deckbuilder_build',
    stepNumber: '30',
    title: 'Monte Seu Deck — Construtor',
    targetTourId: 'tour-deckbuilder-main',
    envView: 'deckbuilder_build',
    padding: 10,
    blairPoseSuggestion: 'Pose 30 • Blair Montando o Deck Insanis',
    blairSpeech:
      'Carreguei o Deck Insanis como exemplo! À esquerda você filtra todas as cartas do jogo e à direita monta seu Deck Principal (Modo Normal ou Modo Mesão) e Side Deck, além de acessar o Mural da Comunidade, Decks na Nuvem e gerar PDF/PNG para torneios.'
  },
  {
    id: 'step_31_deckbuilder_mulligan',
    stepNumber: '31',
    title: 'Monte Seu Deck — Mão Inicial e Mulligan',
    targetTourId: 'tour-deckbuilder-main',
    envView: 'deckbuilder_mulligan',
    padding: 10,
    blairPoseSuggestion: 'Pose 31 • Blair Simulando a Mão Inicial do Deck Insanis',
    blairSpeech:
      'Na aba Mão Inicial / Mulligan, simulamos a compra das 5 cartas iniciais do Deck Insanis, testamos o Mulligan e conferimos as probabilidades exatas de comprar cada carta!'
  },
  {
    id: 'step_32_deckbuilder_neural',
    stepNumber: '32',
    title: 'Monte Seu Deck — Mapa Neural',
    targetTourId: 'tour-deckbuilder-main',
    envView: 'deckbuilder_neural',
    padding: 10,
    blairPoseSuggestion: 'Pose 32 • Blair Explorando o Mapa Neural do Deck Insanis',
    blairSpeech:
      'Este é o Mapa Neural! Ele desenha uma rede interativa conectando todas as sinergias, citações e combos entre as cartas do Deck Insanis.'
  },
  {
    id: 'step_33_deckbuilder_compare',
    stepNumber: '33',
    title: 'Monte Seu Deck — Comparador de Decks',
    targetTourId: 'tour-deckbuilder-main',
    envView: 'deckbuilder_compare',
    padding: 10,
    blairPoseSuggestion: 'Pose 33 • Blair Comparando Deck Insanis vs. Príncipe do Macroverso',
    blairSpeech:
      'No Comparador de Decks coloquei lado a lado o Deck Insanis e o Deck Príncipe do Macroverso! Aqui você analisa as cartas em comum, as cartas exclusivas de cada lista e compara as curvas de custo.'
  },
  {
    id: 'step_34_deckbuilder_stats',
    stepNumber: '34',
    title: 'Monte Seu Deck — Estatísticas',
    targetTourId: 'tour-deckbuilder-main',
    envView: 'deckbuilder_stats',
    padding: 10,
    blairPoseSuggestion: 'Pose 34 • Blair Analisando os Gráficos do Deck Insanis',
    blairSpeech:
      'E na aba Estatísticas você confere a distribuição de tipos de cartas, o painel de validação completa das regras e o gráfico da Curva de Custo (CT) do Deck Insanis!'
  },
  {
    id: 'step_35_btn_populares',
    stepNumber: '35',
    title: 'Cartas Populares',
    targetTourId: 'tour-btn-populares',
    envView: 'home',
    padding: 8,
    blairPoseSuggestion: 'Pose 35 • Blair Apresentando as Cartas Populares',
    blairSpeech:
      'Ao lado do DeckBuilder temos as Cartas Populares, com o ranking das cartas mais usadas pela comunidade!'
  },
  {
    id: 'step_36_populares_open',
    stepNumber: '36',
    title: 'Cartas Populares — Ranking da Comunidade',
    targetTourId: 'tour-popular-modal',
    envView: 'popular_modal',
    padding: 10,
    blairPoseSuggestion: 'Pose 36 • Blair Analisando o Ranking em Chamas',
    blairSpeech:
      'Aqui você acompanha em tempo real o Top 10 das cartas mais presentes nos decks da comunidade nos últimos 30 dias, podendo alternar entre Modo Normal e Modo Mesão e filtrar por categoria.'
  },
  {
    id: 'step_37_btn_mercado',
    stepNumber: '37',
    title: 'Mercado',
    targetTourId: 'tour-btn-mercado',
    envView: 'home',
    padding: 8,
    blairPoseSuggestion: 'Pose 37 • Blair Apresentando o Mercado',
    blairSpeech:
      'Aqui fica o Mercado oficial e da comunidade junto ao seu Carrinho de compras. Vamos abrir!'
  },
  {
    id: 'step_38_mercado_open',
    stepNumber: '38',
    title: 'Mercado — Loja Oficial e da Comunidade',
    targetTourId: 'tour-store-main',
    envView: 'store_modal',
    padding: 10,
    blairPoseSuggestion: 'Pose 38 • Blair Mostrando Decks, Playmats e Cartas',
    blairSpeech:
      'No Mercado você encontra os Produtos Oficiais (Decks, Cartas Avulsas, Playmats, Promoções, Pré-venda e Kits), além de Cartas e Coleções anunciadas por jogadores da comunidade, acompanhamento de pedidos e Carrinho com cálculo de frete!'
  },
  {
    id: 'step_39_btn_conta',
    stepNumber: '39',
    title: 'Sua Conta — Perfil, Álbum e Coleção',
    targetTourId: 'tour-btn-conta',
    envView: 'home_account',
    padding: 10,
    blairPoseSuggestion: 'Pose 39 • Blair Despedindo-se e Desejando Bons Duelos',
    blairSpeech:
      'E por fim, aqui no menu da Sua Conta (aberto na tela para você ver todas as opções), você acessa Meu Perfil e Cartas que Procuro, Cartas Mais Procuradas, Meu Álbum de Coleção, Hall da Fama, Meus Decks Salvos, Histórico de Campeonatos e Meus Pedidos! Clique em "Concluir" para fechar o tutorial e curtir o site ao som da nossa música!'
  }
];

interface BlairTourSettingsDoc {
  defaultBlairPngUrl?: string;
  stepBlairPngUrls?: Record<string, string>;
  updatedAt?: number;
}

const LAST_VISIT_STORAGE_KEY = 'ld_site_last_visit_ts_v1';
const PROMPT_DISMISSED_STORAGE_KEY = 'ld_site_tour_prompt_seen_ts_v1';
// 7 dias sem entrar no site exibe novamente o convite para conhecer a plataforma
const INACTIVITY_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

const checkShouldPromptTourOnStartup = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const now = Date.now();
    const rawLastVisit = window.localStorage.getItem(LAST_VISIT_STORAGE_KEY);
    const rawPromptSeen = window.localStorage.getItem(PROMPT_DISMISSED_STORAGE_KEY);

    const lastVisitTs = rawLastVisit ? parseInt(rawLastVisit, 10) : 0;
    const lastPromptTs = rawPromptSeen ? parseInt(rawPromptSeen, 10) : 0;

    const isFirstTime = !lastVisitTs || !lastPromptTs;
    const isLongTimeAway = lastVisitTs > 0 && now - lastVisitTs > INACTIVITY_THRESHOLD_MS;

    return isFirstTime || isLongTimeAway;
  } catch {
    return false;
  }
};

export const useBlairSiteTour = () => {
  // Inicializa sincronamente para que a música NÃO toque antes do tutorial acabar
  const [isWelcomePromptOpen, setIsWelcomePromptOpen] = useState<boolean>(() =>
    checkShouldPromptTourOnStartup()
  );
  const [isTourModalOpen, setIsTourModalOpen] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [tourSettings, setTourSettings] = useState<BlairTourSettingsDoc>(() => {
    return (
      readBrowserCache<BlairTourSettingsDoc>('ld_cache_blair_tour_v1') || {
        defaultBlairPngUrl: '',
        stepBlairPngUrls: {}
      }
    );
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(LAST_VISIT_STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'appSettings', 'blairTour'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as BlairTourSettingsDoc;
          const normalized: BlairTourSettingsDoc = {
            defaultBlairPngUrl: data.defaultBlairPngUrl || '',
            stepBlairPngUrls: data.stepBlairPngUrls || {},
            updatedAt: data.updatedAt
          };
          setTourSettings(normalized);
          writeBrowserCache('ld_cache_blair_tour_v1', normalized);
        }
      },
      (err) => {
        console.warn('Erro ao carregar configurações de PNGs da Blair:', err);
      }
    );
    return () => unsub();
  }, []);

  const markPromptSeen = () => {
    try {
      const now = Date.now();
      window.localStorage.setItem(PROMPT_DISMISSED_STORAGE_KEY, String(now));
      window.localStorage.setItem(LAST_VISIT_STORAGE_KEY, String(now));
    } catch {
      // ignore
    }
  };

  const handleAcceptWelcomePrompt = () => {
    markPromptSeen();
    setIsWelcomePromptOpen(false);
    setCurrentSlideIndex(0);
    setIsTourModalOpen(true);
  };

  const handleDeclineWelcomePrompt = () => {
    markPromptSeen();
    setIsWelcomePromptOpen(false);
  };

  const openTourAtSlide = (idx = 0) => {
    markPromptSeen();
    setIsWelcomePromptOpen(false);
    setCurrentSlideIndex(Math.max(0, Math.min(BLAIR_TOUR_SLIDES.length - 1, idx)));
    setIsTourModalOpen(true);
  };

  const saveBlairStepPng = async (stepId: string, url: string, setAsDefault = false) => {
    const nextSteps = {
      ...(tourSettings.stepBlairPngUrls || {}),
      [stepId]: url.trim()
    };
    const nextDoc: BlairTourSettingsDoc = {
      defaultBlairPngUrl: setAsDefault
        ? url.trim()
        : tourSettings.defaultBlairPngUrl || '',
      stepBlairPngUrls: nextSteps,
      updatedAt: Date.now()
    };
    setTourSettings(nextDoc);
    writeBrowserCache('ld_cache_blair_tour_v1', nextDoc);
    await setDoc(doc(db, 'appSettings', 'blairTour'), nextDoc, { merge: true });
  };

  const saveDefaultBlairPng = async (url: string) => {
    const nextDoc: BlairTourSettingsDoc = {
      ...tourSettings,
      defaultBlairPngUrl: url.trim(),
      updatedAt: Date.now()
    };
    setTourSettings(nextDoc);
    writeBrowserCache('ld_cache_blair_tour_v1', nextDoc);
    await setDoc(doc(db, 'appSettings', 'blairTour'), nextDoc, { merge: true });
  };

  return {
    isWelcomePromptOpen,
    setIsWelcomePromptOpen,
    isTourModalOpen,
    setIsTourModalOpen,
    currentSlideIndex,
    setCurrentSlideIndex,
    openTourAtSlide,
    handleAcceptWelcomePrompt,
    handleDeclineWelcomePrompt,
    tourSettings,
    saveBlairStepPng,
    saveDefaultBlairPng
  };
};

/**
 * Botão "Conheça o Site" na Barra Superior
 */
export const ConhecaOSiteNavbarButton: React.FC<{
  onClick: () => void;
  className?: string;
}> = ({ onClick, className = '' }) => {
  return (
    <button
      type="button"
      data-tour-id="tour-btn-conheca"
      onClick={onClick}
      title="Iniciar tour guiado com a Blair apresentando cada parte do site"
      className={`cyber-arcane-btn bg-gradient-to-r from-amber-500/20 via-purple-900/80 to-cyan-500/20 hover:from-amber-500/35 hover:to-cyan-500/35 text-amber-200 border border-[#d4af37]/65 hover:border-cyan-400 px-2.5 py-1.5 text-[11px] font-cinzel font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 shadow-[0_0_14px_rgba(212,175,55,0.22)] active:scale-95 whitespace-nowrap ${className}`}
    >
      <Compass size={13} className="text-cyan-300 shrink-0" />
      <span>Conheça o Site</span>
    </button>
  );
};

/**
 * Janela de 1ª Visita ou Longo Tempo sem Entrar:
 * "Primeira vez no site? Deseja conhecer a plataforma?" -> "Sim" / "Não"
 */
export const BlairFirstVisitPromptModal: React.FC<{
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  blairPngUrl?: string;
}> = ({ isOpen, onAccept, onDecline, blairPngUrl }) => {
  if (!isOpen) return null;

  return (
    <div
      data-blair-tour-blur="true"
      className="fixed inset-0 z-[220] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-lg bg-[#07060e] border-2 border-[#d4af37]/75 shadow-[0_0_55px_rgba(0,0,0,0.95)] overflow-hidden"
        style={{
          clipPath:
            'polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)'
        }}
      >
        <CyberArcaneCornerFrame accent="gold" />

        <div className="p-3.5 sm:p-6 flex flex-row items-center gap-3 sm:gap-5">
          {/* Espaço reservado para o PNG da Blair (sempre à esquerda, estilo Visual Novel) */}
          <div className="w-20 h-28 sm:w-32 sm:h-40 shrink-0 relative bg-gradient-to-b from-[#16102c] via-[#0d0a1a] to-[#06050c] border border-[#d4af37]/50 flex flex-col items-center justify-center overflow-hidden">
            {blairPngUrl ? (
              <img
                src={blairPngUrl}
                alt="Blair"
                className="w-full h-full object-contain object-bottom p-1"
              />
            ) : (
              <div className="p-1.5 sm:p-2 text-center flex flex-col items-center justify-center gap-1">
                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-purple-950/80 border border-[#d4af37]/60 flex items-center justify-center text-amber-300">
                  <Sparkles size={14} />
                </div>
                <span className="text-[9px] sm:text-[10px] font-cinzel font-black uppercase tracking-wider text-amber-300">
                  BLAIR
                </span>
                <span className="text-[7px] sm:text-[8px] font-mono text-cyan-300/90 leading-tight">
                  [PNG da Blair]
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 text-left space-y-2 sm:space-y-3.5">
            <h3 className="font-cinzel text-sm sm:text-xl font-black text-white leading-snug">
              Primeira vez no site? Deseja conhecer a plataforma?
            </h3>

            <p className="text-[11px] sm:text-xs text-slate-300 leading-snug sm:leading-relaxed">
              A <strong className="text-amber-300">Blair</strong> pode guiar você abrindo e
              mostrando cada área e ferramenta do site em destaque!
            </p>

            <div className="pt-0.5 sm:pt-1 flex items-center justify-start gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onAccept}
                className="cyber-arcane-btn px-4 sm:px-6 py-1.5 sm:py-2 bg-gradient-to-r from-amber-500 to-cyan-400 hover:from-amber-400 hover:to-cyan-300 text-slate-950 font-cinzel font-black text-[11px] sm:text-xs uppercase tracking-wider shadow-[0_0_18px_rgba(212,175,55,0.4)] transition flex items-center gap-1"
              >
                <Check size={13} className="stroke-[2.5]" />
                <span>Sim</span>
              </button>

              <button
                type="button"
                onClick={onDecline}
                className="cyber-arcane-btn px-4 sm:px-6 py-1.5 sm:py-2 bg-[#120e22] hover:bg-slate-800 text-slate-300 hover:text-white border border-white/15 font-cyber font-bold text-[11px] sm:text-xs uppercase tracking-wider transition"
              >
                Não
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Apresentação Dinâmica Estilo Visual Novel + Spotlight Cutout (Site inteiro em desfoque,
 * exceto o setor/janela que a Blair está mostrando no momento, permitindo interação total
 * dentro do setor destacado e bloqueando apenas o scroll geral do site).
 */
export const BlairSiteTourModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  currentSlideIndex: number;
  onChangeSlideIndex: (index: number) => void;
  isAdmin?: boolean;
  tourSettings: BlairTourSettingsDoc;
  onSaveStepPng: (stepId: string, url: string, setAsDefault?: boolean) => Promise<void>;
  onSaveDefaultPng: (url: string) => Promise<void>;
}> = ({
  isOpen,
  onClose,
  currentSlideIndex,
  onChangeSlideIndex,
  isAdmin = false,
  tourSettings,
  onSaveStepPng
}) => {
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800
  });
  const [isAdminEditorOpen, setIsAdminEditorOpen] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [applyAsDefault, setApplyAsDefault] = useState(false);
  const [isUploadingPng, setIsUploadingPng] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);

  const slide = BLAIR_TOUR_SLIDES[currentSlideIndex] || BLAIR_TOUR_SLIDES[0];
  const totalSlides = BLAIR_TOUR_SLIDES.length;

  const stepSpecificPng = tourSettings.stepBlairPngUrls?.[slide.id] || '';
  const activeBlairPng = stepSpecificPng || tourSettings.defaultBlairPngUrl || '';

  useEffect(() => {
    setCustomUrlInput(stepSpecificPng || tourSettings.defaultBlairPngUrl || '');
  }, [currentSlideIndex, stepSpecificPng, tourSettings.defaultBlairPngUrl]);

  // Localiza o elemento real no DOM para deixá-lo SEM desfoque e 100% interativo
  const findTargetElement = useCallback((): HTMLElement | null => {
    if (typeof document === 'undefined') return null;

    const selector = slide.targetSelector
      ? slide.targetSelector
      : slide.targetTourId
      ? `[data-tour-id="${slide.targetTourId}"]`
      : '';

    if (!selector) return null;

    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        return el;
      }
    }
    if (
      (slide.envView === 'home' || slide.envView === 'home_account') &&
      slide.targetTourId?.startsWith('tour-btn-')
    ) {
      const mobileNav = document.querySelector<HTMLElement>('[data-tour-id="tour-mobile-nav-bar"]');
      if (mobileNav) {
        const r = mobileNav.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return mobileNav;
      }
    }
    return candidates[0] || null;
  }, [slide.targetSelector, slide.targetTourId, slide.envView]);

  const measureTargetRect = useCallback(() => {
    if (typeof window === 'undefined') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setViewportSize({ w: vw, h: vh });

    const el = findTargetElement();
    if (!el) {
      setSpotlightRect(null);
      return;
    }

    const raw = el.getBoundingClientRect();
    if (raw.width === 0 || raw.height === 0) {
      setSpotlightRect(null);
      return;
    }

    let boxTop = raw.top;
    let boxLeft = raw.left;
    let boxRight = raw.left + raw.width;
    let boxBottom = raw.top + raw.height;

    // No último passo (Sua Conta), une a área do botão com a aba retrátil aberta abaixo dele
    if (slide.envView === 'home_account' && typeof document !== 'undefined') {
      const dropdown = document.querySelector<HTMLElement>(
        '[data-tour-id="tour-account-menu-dropdown"]'
      );
      if (dropdown) {
        const dr = dropdown.getBoundingClientRect();
        if (dr.width > 0 && dr.height > 0) {
          boxTop = Math.min(boxTop, dr.top);
          boxLeft = Math.min(boxLeft, dr.left);
          boxRight = Math.max(boxRight, dr.left + dr.width);
          boxBottom = Math.max(boxBottom, dr.top + dr.height);
        }
      }
    }

    const pad = slide.padding ?? 10;
    const top = Math.max(2, boxTop - pad);
    const left = Math.max(2, boxLeft - pad);
    const right = Math.min(vw - 2, boxRight + pad);
    const bottom = Math.min(vh - 2, boxBottom + pad);

    setSpotlightRect({
      top,
      left,
      width: Math.max(36, right - left),
      height: Math.max(26, bottom - top)
    });
  }, [findTargetElement, slide.padding, slide.envView]);

  // Posiciona o setor na tela ao mudar de passo
  useEffect(() => {
    if (!isOpen) return;

    const scrollAndMeasure = () => {
      const el = findTargetElement();
      const isHomeView = slide.envView === 'home' || slide.envView === 'home_account';
      if (isHomeView) {
        const isNavbarItem =
          (slide.targetTourId && slide.targetTourId.startsWith('tour-btn-')) ||
          slide.targetTourId === 'tour-music-player' ||
          slide.targetTourId === 'tour-hero-main';

        if (isNavbarItem) {
          if (window.scrollY !== 0) {
            window.scrollTo({ top: 0, behavior: 'auto' });
          }
        } else if (el) {
          const r = el.getBoundingClientRect();
          const vh = window.innerHeight;
          const availableHeight = vh - 76 - 150;
          let desiredTopInViewport = 78;
          if (r.height > availableHeight && slide.manualSection === 'campos') {
            desiredTopInViewport = Math.max(12, vh - 155 - r.height);
          }
          const targetScrollY = Math.max(0, window.scrollY + r.top - desiredTopInViewport);
          if (Math.abs(window.scrollY - targetScrollY) > 2) {
            window.scrollTo({ top: targetScrollY, behavior: 'auto' });
          }
        }
      }
      measureTargetRect();
    };

    scrollAndMeasure();
    const t1 = setTimeout(scrollAndMeasure, 60);
    const t2 = setTimeout(scrollAndMeasure, 180);
    const t3 = setTimeout(measureTargetRect, 350);
    const t4 = setTimeout(measureTargetRect, 550);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [
    isOpen,
    currentSlideIndex,
    findTargetElement,
    measureTargetRect,
    slide.envView,
    slide.targetTourId,
    slide.manualSection
  ]);

  // Bloqueia apenas o scroll geral do site para fora do setor atual, permitindo interações, cliques e rolagem interna de janelas/setores grandes
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const findScrollableModalAncestor = (target: EventTarget | null): HTMLElement | null => {
      let node = target instanceof HTMLElement ? target : null;
      while (node && node !== document.body && node !== document.documentElement) {
        const style = window.getComputedStyle(node);
        const canScrollY =
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          node.scrollHeight > node.clientHeight + 2;
        const canScrollX =
          (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
          node.scrollWidth > node.clientWidth + 2;
        if (canScrollY || canScrollX) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    };

    const handleWheel = (e: WheelEvent) => {
      const isHomeView = slide.envView === 'home' || slide.envView === 'home_account';

      if (!isHomeView) {
        const scrollableAncestor = findScrollableModalAncestor(e.target);
        if (scrollableAncestor) {
          return;
        }
        e.preventDefault();
        return;
      }

      e.preventDefault();
      const el = findTargetElement();
      if (!el) return;

      const isNavbarItem =
        (slide.targetTourId && slide.targetTourId.startsWith('tour-btn-')) ||
        slide.targetTourId === 'tour-music-player' ||
        slide.targetTourId === 'tour-hero-main';
      if (isNavbarItem) return;

      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const elAbsTop = window.scrollY + r.top;
      const elAbsBottom = elAbsTop + r.height;

      const minScrollY = Math.max(0, elAbsTop - 84);
      const maxScrollY = Math.max(minScrollY, elAbsBottom - (vh - 155));

      if (maxScrollY > minScrollY) {
        const nextY = Math.max(minScrollY, Math.min(maxScrollY, window.scrollY + e.deltaY));
        if (Math.abs(nextY - window.scrollY) > 0.5) {
          window.scrollTo({ top: nextY, behavior: 'auto' });
          measureTargetRect();
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const isHomeView = slide.envView === 'home' || slide.envView === 'home_account';
      if (!isHomeView) {
        const scrollableAncestor = findScrollableModalAncestor(e.target);
        if (scrollableAncestor) {
          return;
        }
      }
      e.preventDefault();
    };

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });

    return () => {
      window.removeEventListener('wheel', handleWheel, {
        capture: true
      } as EventListenerOptions);
      window.removeEventListener('touchmove', handleTouchMove, {
        capture: true
      } as EventListenerOptions);
    };
  }, [isOpen, slide.envView, slide.targetTourId, findTargetElement, measureTargetRect]);

  // Atualiza recorte em tempo real ao clicar em elementos interativos (ex: zonas do Campo), rolar ou redimensionar
  useEffect(() => {
    if (!isOpen) return;
    const handleUpdate = () => measureTargetRect();
    const handleDelayedClickUpdate = () => {
      measureTargetRect();
      setTimeout(measureTargetRect, 80);
      setTimeout(measureTargetRect, 220);
    };
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('click', handleDelayedClickUpdate, true);
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('click', handleDelayedClickUpdate, true);
    };
  }, [isOpen, measureTargetRect]);

  // Navegação por teclado (Setas Esquerda / Direita / ESC)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === 'ArrowRight') {
        if (currentSlideIndex < totalSlides - 1) {
          onChangeSlideIndex(currentSlideIndex + 1);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentSlideIndex > 0) {
          onChangeSlideIndex(currentSlideIndex - 1);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentSlideIndex, totalSlides, onChangeSlideIndex, onClose]);

  if (!isOpen) return null;

  const handlePrev = () => {
    if (currentSlideIndex > 0) {
      onChangeSlideIndex(currentSlideIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentSlideIndex < totalSlides - 1) {
      onChangeSlideIndex(currentSlideIndex + 1);
    } else {
      onClose();
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploadingPng(true);
    try {
      const storageRef = ref(
        storage,
        `blair_tour/${slide.id}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      );
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      await onSaveStepPng(slide.id, downloadUrl, applyAsDefault);
      setCustomUrlInput(downloadUrl);
      setAdminFeedback('PNG salvo!');
      setTimeout(() => setAdminFeedback(null), 2500);
    } catch (err) {
      console.error('Erro ao enviar PNG da Blair:', err);
    } finally {
      setIsUploadingPng(false);
    }
  };

  const handleSaveManualUrl = async () => {
    await onSaveStepPng(slide.id, customUrlInput, applyAsDefault);
    setAdminFeedback('PNG atualizado!');
    setTimeout(() => setAdminFeedback(null), 2500);
  };

  // Cálculo das 4 cortinas de desfoque que cercam o setor explicado (deixando o interior 100% SEM desfoque e 100% clicável/interativo)
  const rect = spotlightRect;
  const vw = viewportSize.w;
  const vh = viewportSize.h;

  return (
    <div className="fixed inset-0 z-[210] pointer-events-none select-none overflow-hidden">
      {/* 1. CAMADA DE DESFOQUE COM RECORTE NÍTIDO E INTERATIVO (SPOTLIGHT CUTOUT) */}
      {rect ? (
        <>
          {/* Cortina Superior Desfocada */}
          <div
            data-blair-tour-blur="true"
            className="fixed left-0 right-0 top-0 bg-black/65 backdrop-blur-[6px] pointer-events-auto transition-all duration-150"
            style={{ height: Math.max(0, rect.top) }}
          />
          {/* Cortina Inferior Desfocada */}
          <div
            data-blair-tour-blur="true"
            className="fixed left-0 right-0 bottom-0 bg-black/65 backdrop-blur-[6px] pointer-events-auto transition-all duration-150"
            style={{ top: Math.min(vh, rect.top + rect.height) }}
          />
          {/* Cortina Esquerda Desfocada */}
          <div
            data-blair-tour-blur="true"
            className="fixed left-0 bg-black/65 backdrop-blur-[6px] pointer-events-auto transition-all duration-150"
            style={{
              top: Math.max(0, rect.top),
              height: Math.max(0, rect.height),
              width: Math.max(0, rect.left)
            }}
          />
          {/* Cortina Direita Desfocada */}
          <div
            data-blair-tour-blur="true"
            className="fixed right-0 bg-black/65 backdrop-blur-[6px] pointer-events-auto transition-all duration-150"
            style={{
              top: Math.max(0, rect.top),
              height: Math.max(0, rect.height),
              left: Math.min(vw, rect.left + rect.width)
            }}
          />

          {/* Moldura Luminosa ao redor da Área Explicada (pointer-events-none para permitir clicar no Campo e em todos os elementos do setor!) */}
          <div
            className="fixed border-2 border-[#d4af37] shadow-[0_0_25px_rgba(212,175,55,0.55),inset_0_0_15px_rgba(6,182,212,0.2)] pointer-events-none transition-all duration-150 z-[215]"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            }}
          />
        </>
      ) : (
        <div
          data-blair-tour-blur="true"
          className="fixed inset-0 bg-black/65 backdrop-blur-[6px] pointer-events-none"
        />
      )}

      {/* 2. BARRA INFERIOR ESTILO VISUAL NOVEL (SEMPRE LADO A LADO: BLAIR À ESQUERDA + BALÃO DE FALA À DIREITA, INCLUSIVE NO CELULAR) */}
      <div className="fixed bottom-0 inset-x-0 z-[230] p-1.5 sm:p-3 pointer-events-none flex justify-center">
        <div className="w-full max-w-5xl relative flex flex-row items-end gap-0 pointer-events-auto">
          {/* RETRATO / SPRITE DA BLAIR (SEMPRE À ESQUERDA ESTILO VISUAL NOVEL) */}
          <div className="relative w-20 h-28 sm:w-40 sm:h-44 md:w-44 md:h-48 shrink-0 bg-gradient-to-t from-[#07060e] via-[#120d24]/95 to-[#191233]/85 border-2 border-[#d4af37]/75 border-r-0 flex flex-col items-center justify-end overflow-hidden shadow-[0_-8px_30px_rgba(0,0,0,0.85)]">
            <CyberArcaneCornerFrame accent="cyan" />

            {activeBlairPng ? (
              <img
                src={activeBlairPng}
                alt={`Blair — ${slide.title}`}
                className="w-full h-full object-contain object-bottom select-none"
              />
            ) : (
              <div className="p-1 sm:p-2 text-center flex flex-col items-center justify-center h-full gap-0.5 sm:gap-1">
                <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-full bg-purple-950/90 border border-[#d4af37]/60 flex items-center justify-center text-amber-300">
                  <ImageIcon size={13} />
                </div>
                <div className="text-[8px] sm:text-[10px] font-cinzel font-black uppercase tracking-wider text-amber-200 leading-tight">
                  PNG da Blair
                </div>
                <p className="text-[7px] sm:text-[8px] font-mono text-cyan-300 leading-tight px-0.5 line-clamp-2">
                  {slide.blairPoseSuggestion}
                </p>
              </div>
            )}

            {/* Botão discreto para o Admin preencher o PNG da Blair desta fala */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsAdminEditorOpen((v) => !v)}
                className="absolute top-1 right-1 px-1.5 py-0.5 bg-[#d4af37] hover:bg-amber-400 text-slate-950 font-mono font-bold text-[8px] sm:text-[9px] uppercase tracking-wider shadow transition flex items-center gap-0.5 z-20"
                title="Definir PNG da Blair para esta fala"
              >
                <Upload size={9} />
                <span>#{slide.stepNumber}</span>
              </button>
            )}
          </div>

          {/* BALÃO DE FALA VISUAL NOVEL DA BLAIR (COMPACTO NO CELULAR PARA CABER TUDO LADO A LADO) */}
          <div className="flex-1 min-w-0 bg-[#07060e]/95 border-2 border-[#d4af37]/75 shadow-[0_-10px_40px_rgba(0,0,0,0.95)] p-2 sm:p-4 flex flex-col justify-between min-h-[112px] sm:min-h-[150px] relative">
            {/* Crachá com o nome da personagem estilo Visual Novel */}
            <div className="flex items-center justify-between gap-1.5 mb-1 sm:mb-1.5 border-b border-[#d4af37]/25 pb-1 sm:pb-1.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="px-2 sm:px-3 py-0.5 bg-gradient-to-r from-[#d4af37] to-amber-500 text-slate-950 font-cinzel font-black text-[10px] sm:text-xs uppercase tracking-widest shrink-0">
                  BLAIR
                </span>
                <span className="text-[10px] sm:text-sm font-cinzel font-bold text-amber-200 truncate">
                  {slide.stepNumber}/{totalSlides} — {slide.title}
                </span>
              </div>

              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {/* Seletor rápido discreto para pular para qualquer função */}
                <select
                  value={currentSlideIndex}
                  onChange={(e) => onChangeSlideIndex(Number(e.target.value))}
                  className="bg-[#0d0a1a] border border-purple-500/40 text-[9px] sm:text-[11px] text-amber-200 px-1 sm:px-2 py-0.5 font-mono outline-none focus:border-cyan-400 max-w-[82px] sm:max-w-[200px]"
                  title="Pular para qualquer função"
                >
                  {BLAIR_TOUR_SLIDES.map((s, idx) => (
                    <option key={s.id} value={idx}>
                      {s.stepNumber}. {s.title}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-1.5 sm:px-2 py-0.5 bg-slate-900 hover:bg-red-950/80 text-slate-400 hover:text-white border border-white/15 text-[9px] sm:text-[10px] font-mono uppercase tracking-wider transition flex items-center gap-0.5"
                  title="Encerrar apresentação (a música começará a tocar)"
                >
                  <span className="hidden xs:inline sm:inline">Pular</span>
                  <X size={11} />
                </button>
              </div>
            </div>

            {/* Editor Rápido de PNG da Blair (visível apenas quando o Admin clica em "PNG #XX") */}
            {isAdmin && isAdminEditorOpen && (
              <div className="mb-1.5 p-1.5 sm:p-2 bg-[#110d22] border border-cyan-500/45 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs">
                <input
                  type="text"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  placeholder="URL do PNG transparente da Blair..."
                  className="flex-1 min-w-[120px] bg-[#05040a] border border-white/20 px-1.5 py-0.5 text-[10px] sm:text-xs text-white font-mono outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={handleSaveManualUrl}
                  className="px-2 py-0.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] sm:text-xs transition"
                >
                  Salvar
                </button>
                <label className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] sm:text-xs cursor-pointer inline-flex items-center gap-1 transition">
                  <Upload size={11} />
                  <span>{isUploadingPng ? '...' : 'Upload'}</span>
                  <input
                    type="file"
                    accept="image/png,image/webp,image/*"
                    className="hidden"
                    disabled={isUploadingPng}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                </label>
                <label className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyAsDefault}
                    onChange={(e) => setApplyAsDefault(e.target.checked)}
                    className="accent-cyan-400"
                  />
                  <span>Padrão</span>
                </label>
                {stepSpecificPng && (
                  <button
                    type="button"
                    onClick={() => onSaveStepPng(slide.id, '', false)}
                    className="px-1.5 py-0.5 bg-red-950/80 text-red-300 border border-red-500/40 text-[10px]"
                    title="Remover PNG específico desta fala"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
                {adminFeedback && (
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">
                    {adminFeedback}
                  </span>
                )}
              </div>
            )}

            {/* FALA DA BLAIR (FONTE COMPACTA NO CELULAR PARA CABER TUDO IGUAL VISUAL NOVEL) */}
            <p className="text-[11px] sm:text-sm md:text-[15px] text-slate-100 leading-snug sm:leading-relaxed font-sans pr-0.5 max-h-[58px] sm:max-h-none overflow-y-auto">
              “{slide.blairSpeech}”
            </p>

            {/* Controles "Anterior" e "Seguinte" no rodapé do balão */}
            <div className="mt-1.5 sm:mt-2.5 pt-1 sm:pt-2 border-t border-white/10 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentSlideIndex === 0}
                className={`cyber-arcane-btn px-2.5 sm:px-3.5 py-1 sm:py-1.5 font-cinzel font-bold text-[10px] sm:text-xs uppercase tracking-wider flex items-center gap-1 border transition ${
                  currentSlideIndex === 0
                    ? 'bg-slate-900/40 text-slate-600 border-slate-800 cursor-not-allowed'
                    : 'bg-[#120d24] hover:bg-purple-900/70 text-amber-200 border-[#d4af37]/50 hover:border-cyan-400'
                }`}
              >
                <ChevronLeft size={12} />
                <span>Anterior</span>
              </button>

              <span className="text-[9px] sm:text-[10px] font-mono text-slate-400">
                {currentSlideIndex + 1}/{totalSlides}
              </span>

              <button
                type="button"
                onClick={handleNext}
                className="cyber-arcane-btn px-3 sm:px-5 py-1 sm:py-1.5 bg-gradient-to-r from-[#d4af37] via-amber-400 to-cyan-400 hover:from-amber-300 hover:to-cyan-300 text-slate-950 font-cinzel font-black text-[10px] sm:text-xs uppercase tracking-wider shadow-[0_0_18px_rgba(212,175,55,0.4)] transition flex items-center gap-1"
              >
                <span>{currentSlideIndex === totalSlides - 1 ? 'Concluir' : 'Seguinte'}</span>
                <ChevronRight size={12} className="stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
