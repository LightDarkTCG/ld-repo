import { jsPDF } from 'jspdf';

export interface GuideSection {
  number: string;
  title: string;
  subtitle: string;
  route?: string;
  TalkingPoints: string[];
  PublicHighlights: string[];
}

export const PRESENTATION_GUIDE_SECTIONS: GuideSection[] = [
  {
    number: '01',
    title: 'PÁGINA INICIAL & PRIMEIRO CONTATO',
    subtitle: 'O que o visitante vê assim que entra no site oficial de Light Dark TCG',
    route: 'Página Principal (/)',
    TalkingPoints: [
      'A página inicial apresenta o tema/evento atual no topo (ex: Halloween, Novo Patch ou Lançamento) com identidade visual e vídeos ambientados.',
      'Logo abaixo do cabeçalho ficam os Destaques e Novidades em carrossel interativo: o jogador pode clicar nos banners para abrir produtos, eventos ou anúncios importantes.',
      'Na seção "SOBRE LIGHT DARK", o visitante entende em poucos segundos a proposta do jogo: um TCG estratégico de Ação e Reação nascido de uma campanha de RPG com mais de 10 anos de história.',
      'Clicando em "Ler História Completa", o público pode mergulhar na introdução "O Fim do Macroverso?", conhecendo a origem do Mestre, dos Conceitos e a transição do Macroverso 1 até o Macroverso 13.',
      'Abaixo, o visitante encontra as 4 Categorias de Cartas (Herói, Combatente, Equipamento e Efeito) com um mostruário vivo de cartas reais que alternam automaticamente e explicam o papel de cada tipo ao clicar.'
    ],
    PublicHighlights: [
      'Entendimento imediato de como o jogo funciona (20 de Vida, decks de 30 a 35 cartas sem cópias repetidas, sistema de Mana e Runas).',
      'Acesso rápido no menu superior para todas as ferramentas do ecossistema Light Dark.'
    ]
  },
  {
    number: '02',
    title: 'MANUAL COMPLETO, ARQUÉTIPOS & FAQ RÁPIDO',
    subtitle: 'Todas as regras oficiais organizadas em gavetas retráteis + tira-dúvidas da comunidade',
    route: 'Seção Manual na Home ou /manual',
    TalkingPoints: [
      'O Manual Oficial fica integrado na página inicial (com botões "Expandir Tudo" e "Recolher Tudo") dividido em 9 seções retráteis fáceis de consultar durante ou antes da partida.',
      'Seções 01 a 07 cobrem: Condições de Vitória (1v1 e 2v2), Regras de Construção de Deck (Principal e Auxiliar), Economia de Mana, Vida e as 3 Runas (Fogo, Gelo e Raio), Zonas do Tabuleiro Interativo, Fases do Turno, Sistema de Correntes (Ação e Reação no turno do oponente) e Combate/Palavras-Chave.',
      'Seção 08 — Guia Oficial de Arquétipos: mostra todos os arquétipos do jogo, seus ícones, estilo de jogo e a data do patch de atualização.',
      'Seção 09 — FAQ Rápido de Interações: funciona como um "Juiz Digital". O jogador pesquisa o nome de uma carta ou mecânica para ver respostas oficiais sobre interações complexas.',
      'Qualquer jogador logado pode enviar uma nova dúvida no FAQ, que é respondida oficialmente pelos Administradores ou pelos Embaixadores Autorizados da comunidade.'
    ],
    PublicHighlights: [
      'Tabuleiro interativo onde o jogador clica em cada zona para entender onde posicionar Heróis, Combatentes, Equipamentos e Efeitos Constantes.',
      'FAQ colaborativo com selo de resposta oficial de Embaixadores e da Equipe Light Dark.'
    ]
  },
  {
    number: '03',
    title: 'CATÁLOGO OFICIAL DE CARTAS & VARIAÇÕES',
    subtitle: 'Banco de dados completo com filtros avançados, artes alternativas e Rare Prints',
    route: 'Botão "Catálogo" (/catalog)',
    TalkingPoints: [
      'O Catálogo Oficial reúne todas as cartas lançadas em Light Dark TCG com busca instantânea por nome, código (ex: LD-001), descrição de efeito ou coleção.',
      'Filtros inteligentes permitem refinar por Tipo de Carta, Arquétipo, Coleção, Raridade, Frame (Moderno ou Legado) e valores exatos de CT (Custo), ATK (Ataque) e DEF (Defesa), além de ordenação customizada.',
      'Ao clicar em qualquer carta, abre-se a visualização detalhada em alta definição com todas as Variações/Skins daquela carta (Frame Legado, Novo Frame Moderno, artes especiais e cartas promocionais).',
      'Cartas especiais de tiragem limitada exibem o selo "Rare Print / Verificação Oficial" com a quantidade máxima de cópias impressas.',
      'Direto na tela da carta, o jogador logado pode marcar se já possui aquela versão no seu Álbum ou adicioná-la à sua lista de "Cartas que Procuro" (Wishlist).'
    ],
    PublicHighlights: [
      'Alternância com 1 clique entre versão Legado e versão Moderno de cada carta.',
      'Opção de expandir todas as variações na grade para visualizar todas as skins existentes.'
    ]
  },
  {
    number: '04',
    title: 'MONTE SEU DECK, META DA COMUNIDADE & PDF DE TORNEIO',
    subtitle: 'Deck Builder na nuvem com validação automática de regras e exportação de Decklist A4',
    route: 'Botão "Monte seu Deck" (/decks) e "Populares" (/populares)',
    TalkingPoints: [
      'No construtor "Monte seu Deck", o jogador monta seu Deck Principal (30 a 35 cartas) e seu Deck Auxiliar (até 10 cartas) pesquisando e clicando nas cartas do catálogo.',
      'O sistema valida automaticamente as regras oficiais de construção (como o limite de 1 cópia por carta pelo nome base e restrições de tipo/custo), avisando se o deck está pronto para jogo.',
      'O jogador logado pode salvar múltiplos decks na nuvem ("Meus Decks Salvos") para acessar de qualquer dispositivo, editar ou carregar depois.',
      'Botão "Exportar PDF (Torneio)": gera instantaneamente um documento PDF oficial em formato A4 contendo nome do jogador, nome do deck, tabela organizada do Deck Principal e Deck Auxiliar com códigos e espaço para conferência da arbitragem em torneios presenciais.',
      'Na aba "Populares" (/populares), qualquer pessoa pode consultar o termômetro do Meta: o ranking em tempo real das cartas mais usadas nos decks salvos pelos jogadores.'
    ],
    PublicHighlights: [
      'Validação automática de regras para iniciantes não errarem na montagem do deck.',
      'Geração de Decklist Oficial em PDF pronta para imprimir e levar para campeonatos.'
    ]
  },
  {
    number: '05',
    title: 'LORE, MAPA 3D COM LINHA DO TEMPO & QUIZ DIÁRIO',
    subtitle: 'Imersão completa na história dos Macroversos 1 e 13 com recompensas de pontuação',
    route: 'Botão "Lore" (/lore)',
    TalkingPoints: [
      'A central de Lore organiza toda a história de Light Dark em categorias: Conceitos Cósmicos, Personagens, Locais/Reinos, Organizações, Grandes Eventos e Contos.',
      'Ao ler sobre um personagem ou evento, o leitor vê as cartas do jogo conectadas àquela história e pode navegar entre conexões de personagens.',
      'Mapa 3D Interativo: os jogadores podem explorar espacialmente o universo em 3D (girar a câmera, dar zoom em setores e clicar nos planetas/locais para abrir a ficha histórica daquele mundo).',
      'Seletor de Macroverso & Linha do Tempo Retrátil (parte inferior do Mapa 3D): permite alternar entre o Macroverso 13 (onde ocorre 90% da história atual) e o Macroverso 1. No Macroverso 13, a barra retrátil de Linha do Tempo na base do mapa permite viajar entre épocas — e o Mapa 3D se transforma de acordo com a época escolhida, mudando territórios de facções e locais visíveis!',
      'Quiz Diário do Macroverso (dentro de Lore): libera 1 pergunta inédita por dia sobre lore, regras ou cartas (incluindo desafios de imagem borrada). Quem acerta logado na conta ganha Pontos de Quiz permanentes no perfil, aumenta sua sequência de acertos (ofensiva) e sobe no Ranking Oficial do Quiz.'
    ],
    PublicHighlights: [
      'Mapa 3D vivo que muda de acordo com a época selecionada na Linha do Tempo retrátil.',
      'Quiz Diário com pontuação acumulativa na conta do usuário e placar de líderes.'
    ]
  },
  {
    number: '06',
    title: 'SIMULADOR DE BOOSTER, APP DUELO & DUELO VS IA',
    subtitle: 'Ferramentas interativas para abrir pacotes virtuais, treinar contra robô e marcar partidas',
    route: 'Botões "Booster", "App Duelo" (/duelo) e "Duelo vs IA" (/duelo-ia)',
    TalkingPoints: [
      'Simulador de Abertura de Booster (botão dourado "Booster"): o público escolhe entre os pacotes configurados e abre boosters virtuais gratuitamente para testar a sorte, com animação de revelação carta a carta, efeitos de brilho por raridade e resumo do pacote.',
      'App Duelo (/duelo): o aplicativo companheiro para partidas físicas ou remotas. Controla os 20 Pontos de Vida, progressão de Mana (1 a 10), ativação das 3 Runas, contadores de turno, rolagem de dados e suporta tanto duelos 1v1 quanto partidas em dupla (2v2).',
      'Duelo vs IA (/duelo-ia): simulador de partida completo dentro do navegador onde o jogador enfrenta uma Inteligência Artificial programada (Deck Insanis). Ideal para novos jogadores aprenderem na prática como funcionam as fases do turno, invocação, equipamentos, combate e correntes.'
    ],
    PublicHighlights: [
      'Abertura de pacotes (Pack Opener) com taxas reais de raridade e coleções específicas.',
      'Treino solo contra IA direto no navegador sem precisar instalar nada.'
    ]
  },
  {
    number: '07',
    title: 'TORNEIOS AO VIVO & HISTÓRICO DE CAMPEONATOS',
    subtitle: 'Acompanhamento de chaves, confrontos e mural eterno de campeões',
    route: 'Botão "Torneio" (/torneios)',
    TalkingPoints: [
      'A página de Torneios exibe os campeonatos oficiais ativos e finalizados, permitindo compartilhar o link direto de um torneio específico.',
      'Os jogadores acompanham ao vivo as chaves (Eliminatória Simples, Dupla ou formato Suíço/Pontos Corridos), resultados das rodadas e classificação.',
      'Os vencedores (1º, 2º e 3º lugares) recebem troféus e medalhas digitais registradas permanentemente em suas contas, que ficam visíveis no "Histórico de Campeonatos" e no perfil público do jogador.'
    ],
    PublicHighlights: [
      'Chaveamento atualizado em tempo real durante os eventos.',
      'Medalhas e títulos de torneio vinculados ao perfil do jogador.'
    ]
  },
  {
    number: '08',
    title: 'MERCADO OFICIAL, LOJA DA COMUNIDADE & FRETE',
    subtitle: 'Compra de produtos oficiais, cartas avulsas anunciadas por jogadores e rastreamento',
    route: 'Botão verde "Mercado" (/mercado) e ícone do Carrinho',
    TalkingPoints: [
      'Vitrine Oficial Light Dark: venda de Boosters físicos, Decks, Boxes e produtos exclusivos com fotos, seleção de variações e estoque em tempo real.',
      'Mercado da Comunidade: jogadores podem anunciar suas próprias cartas avulsas para venda ou negociação com outros colecionadores.',
      'Carrinho Integrado & Cálculo de Frete: o comprador digita seu CEP para calcular o frete (PAC/SEDEX) automaticamente, finaliza o pedido com pagamento online (PIX / Mercado Pago) e acompanha tudo em "Meus Pedidos & Rastreio" dentro do seu perfil.'
    ],
    PublicHighlights: [
      'Links diretos compartilháveis para qualquer produto ou anúncio específico.',
      'Acompanhamento de status do pedido e código de rastreio dos Correios direto no site.'
    ]
  },
  {
    number: '09',
    title: 'PERFIL DO JOGADOR, ÁLBUM DE COLEÇÃO & HALL DA FAMA',
    subtitle: 'Identidade do colecionador, lista de trocas (Wishlist) e rankings globais',
    route: 'Menu da Conta (canto superior direito), /album e /ranking',
    TalkingPoints: [
      'Criar uma conta é rápido (Google ou E-mail/Senha) e libera o menu pessoal do jogador no canto superior direito, onde ele pode personalizar seu Nome de Exibição.',
      'Meu Álbum de Coleção (/album): o jogador marca todas as cartas e variações que possui fisicamente, acompanha sua barra de progresso percentual rumo aos 100% e solicita verificação oficial para suas cartas Rare Print numeradas.',
      'Meu Perfil & Cartas que Procuro (Wishlist): página pública do jogador que mostra suas medalhas de torneio, pontos acumulados no Quiz Diário, progresso do álbum e a lista de cartas que ele está procurando para troca/compra.',
      'Cartas Mais Procuradas: mostra quais cartas têm maior demanda entre todos os jogadores.',
      'Hall da Fama (/ranking): o ranking oficial dos maiores colecionadores do Macroverso, permitindo clicar em qualquer colecionador para visitar o perfil e a lista de desejos dele.'
    ],
    PublicHighlights: [
      'Ecossistema social completo: Coleção + Lista de Desejos + Pontos de Quiz + Troféus de Campeonatos em um único perfil.'
    ]
  }
];

export function generatePresentationGuidePdf(): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  let cursorY = 18;

  const drawPageBackground = () => {
    doc.setFillColor(12, 12, 18);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    // Top subtle accent bar
    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, pageWidth, 3, 'F');
  };

  const drawFooter = (pageNum: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 145, 165);
    doc.text(
      `Light Dark TCG — Guia Oficial de Funcionalidades & Roteiro de Apresentação • Página ${pageNum}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  };

  let currentPage = 1;
  drawPageBackground();

  // Cover / Header Banner on Page 1
  doc.setFillColor(24, 20, 44);
  doc.roundedRect(marginX, cursorY, contentWidth, 36, 4, 4, 'F');
  doc.setDrawColor(139, 92, 246);
  doc.setLineWidth(0.5);
  doc.roundedRect(marginX, cursorY, contentWidth, 36, 4, 4, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(192, 132, 252);
  doc.text('DOCUMENTO OFICIAL • ROTEIRO DE VÍDEO & GUIA DO PÚBLICO', marginX + 6, cursorY + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text('LIGHT DARK TCG — TODAS AS FUNÇÕES DO SITE', marginX + 6, cursorY + 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    'Resumo completo de todas as ferramentas, páginas e recursos interativos disponíveis para os jogadores.',
    marginX + 6,
    cursorY + 27
  );
  doc.text(
    'Organizado na ordem ideal para gravação de vídeo de apresentação e divulgação para a comunidade.',
    marginX + 6,
    cursorY + 32.5
  );

  cursorY += 44;

  // Quick Summary Box (Dica de Roteiro)
  doc.setFillColor(20, 28, 46);
  doc.roundedRect(marginX, cursorY, contentWidth, 24, 3, 3, 'F');
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.35);
  doc.roundedRect(marginX, cursorY, contentWidth, 24, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(96, 165, 250);
  doc.text('ESTRUTURA SUGERIDA PARA O SEU VÍDEO DE APRESENTAÇÃO:', marginX + 5, cursorY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  const introFlow =
    '1. Home, Novidades e Sobre o Jogo -> 2. Manual Retrátil, Arquétipos e FAQ -> 3. Catálogo e Skins -> 4. Monte seu Deck + PDF de Torneio -> 5. Lore, Mapa 3D com Linha do Tempo e Quiz Diário -> 6. Booster, App Duelo e Duelo vs IA -> 7. Torneios, Mercado e Álbum/Hall da Fama.';
  const wrappedIntro = doc.splitTextToSize(introFlow, contentWidth - 10);
  doc.text(wrappedIntro, marginX + 5, cursorY + 13);

  cursorY += 30;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - 16) {
      drawFooter(currentPage);
      doc.addPage();
      currentPage += 1;
      drawPageBackground();
      cursorY = 16;
    }
  };

  for (const section of PRESENTATION_GUIDE_SECTIONS) {
    // Calculate approximate height of section header + items
    let talkingLinesCount = 0;
    for (const pt of section.TalkingPoints) {
      const lines = doc.splitTextToSize(`• ${pt}`, contentWidth - 10);
      talkingLinesCount += lines.length;
    }
    let highlightLinesCount = 0;
    for (const hl of section.PublicHighlights) {
      const lines = doc.splitTextToSize(`★ ${hl}`, contentWidth - 12);
      highlightLinesCount += lines.length;
    }

    const totalEstimatedHeight =
      18 + talkingLinesCount * 4.5 + section.TalkingPoints.length * 1.5 + highlightLinesCount * 4.5 + 14;

    ensureSpace(Math.min(totalEstimatedHeight, 75));

    // Section Header Bar
    doc.setFillColor(30, 27, 56);
    doc.roundedRect(marginX, cursorY, contentWidth, 14, 2.5, 2.5, 'F');
    doc.setDrawColor(124, 58, 237);
    doc.setLineWidth(0.4);
    doc.roundedRect(marginX, cursorY, contentWidth, 14, 2.5, 2.5, 'S');

    // Badge number
    doc.setFillColor(124, 58, 237);
    doc.roundedRect(marginX + 3, cursorY + 2.5, 10, 9, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(section.number, marginX + 8, cursorY + 8.5, { align: 'center' });

    // Title & Subtitle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.text(section.title, marginX + 16, cursorY + 6.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(196, 181, 253);
    doc.text(section.subtitle, marginX + 16, cursorY + 11.2);

    if (section.route) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(167, 243, 208);
      doc.text(section.route, pageWidth - marginX - 4, cursorY + 6.2, { align: 'right' });
    }

    cursorY += 18;

    // Talking points
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(226, 232, 240);

    for (const pt of section.TalkingPoints) {
      const wrapped = doc.splitTextToSize(`•  ${pt}`, contentWidth - 6);
      const blockH = wrapped.length * 4.4 + 1.8;
      ensureSpace(blockH + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(226, 232, 240);
      doc.text(wrapped, marginX + 3, cursorY);
      cursorY += blockH;
    }

    // Highlights box
    if (section.PublicHighlights.length > 0) {
      let hlLines: string[] = [];
      for (const hl of section.PublicHighlights) {
        const w = doc.splitTextToSize(`>> DESTAQUE PARA O PÚBLICO: ${hl}`, contentWidth - 10);
        hlLines = hlLines.concat(w);
      }
      const boxHeight = hlLines.length * 4.3 + 5;
      ensureSpace(boxHeight + 6);

      doc.setFillColor(16, 38, 34);
      doc.roundedRect(marginX + 2, cursorY - 1, contentWidth - 4, boxHeight, 2, 2, 'F');
      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX + 2, cursorY - 1, contentWidth - 4, boxHeight, 2, 2, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.3);
      doc.setTextColor(110, 231, 183);
      doc.text(hlLines, marginX + 6, cursorY + 3.2);
      cursorY += boxHeight + 5;
    } else {
      cursorY += 4;
    }
  }

  drawFooter(currentPage);
  return doc;
}

export function downloadPresentationGuidePdf(): void {
  const doc = generatePresentationGuidePdf();
  doc.save('Guia_Apresentacao_Light_Dark_TCG.pdf');
}
