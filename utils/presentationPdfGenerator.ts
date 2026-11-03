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
      'Abaixo, o visitante encontra as 5 Categorias de Cartas — Herói (Vermelho), Combatente (Azul), Equipamento (Verde), Efeito (Roxo) e o novo tipo Token (Amarelo) — com mostruário vivo de cartas reais e explicação completa do papel de cada tipo ao clicar.'
    ],
    PublicHighlights: [
      'Entendimento imediato de como o jogo funciona (20 de Vida, decks de 30 a 35 cartas sem cópias repetidas, sistema de Mana, Runas e Deck de Heróis com Tokens).',
      'Acesso rápido no menu superior para todas as ferramentas do ecossistema Light Dark.'
    ]
  },
  {
    number: '02',
    title: 'MANUAL COMPLETO, TOKENS, ARQUÉTIPOS & FAQ RÁPIDO',
    subtitle: 'Todas as regras oficiais organizadas em gavetas retráteis + tira-dúvidas da comunidade',
    route: 'Seção Manual na Home ou /manual',
    TalkingPoints: [
      'O Manual Oficial fica integrado na página inicial (com botões "Expandir Tudo" e "Recolher Tudo") dividido em 9 seções retráteis fáceis de consultar durante ou antes da partida.',
      'Seções 01 a 07 cobrem: Condições de Vitória (1v1 e 2v2), Regras de Construção de Deck (Deck Principal de 30 a 35 cartas, Deck Auxiliar de até 10 cartas e Deck de Heróis com até 15 Tokens), Economia de Mana, Vida e as 3 Runas (Fogo, Gelo e Raio), Zonas do Tabuleiro Interativo, Fases do Turno, Sistema de Correntes (Ação e Reação no turno do oponente) e Combate/Palavras-Chave.',
      'Regras Oficiais de Tokens (Cor Amarela): Tokens são cartas vinculadas a cartas que se utilizam delas; só podem ser afetadas por cartas que as afetam diretamente; ocupam espaço em campo mas não declaram ataques, não possuem efeitos e não podem ser equipados. Ficam no Deck de Heróis (máximo de 15) e, quando deixam o campo, retornam ao Deck de Heróis.',
      'Seção 08 — Guia Oficial de Arquétipos: mostra todos os arquétipos do jogo, seus ícones, estilo de jogo e a data do patch de atualização.',
      'Seção 09 — FAQ Rápido de Interações: funciona como um "Juiz Digital". O jogador pesquisa o nome de uma carta ou mecânica para ver respostas oficiais sobre interações complexas.',
      'Qualquer jogador logado pode enviar uma nova dúvida no FAQ, que é respondida oficialmente pelos Administradores ou pelos Embaixadores Autorizados da comunidade.'
    ],
    PublicHighlights: [
      'Tabuleiro interativo onde o jogador clica em cada zona para entender onde posicionar Heróis, Combatentes, Tokens, Equipamentos e Efeitos Constantes.',
      'FAQ colaborativo com selo de resposta oficial de Embaixadores e da Equipe Light Dark.'
    ]
  },
  {
    number: '03',
    title: 'CATÁLOGO OFICIAL DE CARTAS, VARIAÇÕES & MAPA NEURAL',
    subtitle: 'Banco de dados completo com filtros avançados, artes alternativas, Rare Prints e sinergias',
    route: 'Botão "Catálogo" (/catalog)',
    TalkingPoints: [
      'O Catálogo Oficial reúne todas as cartas lançadas em Light Dark TCG (incluindo Heróis, Combatentes, Equipamentos, Efeitos e Tokens) com busca instantânea por nome, código (ex: LD-001), descrição de efeito ou coleção.',
      'Filtros inteligentes permitem refinar por Tipo de Carta (incluindo Token), Arquétipo, Coleção, Raridade, Frame (Moderno ou Legado) e valores exatos de CT (Custo), ATK (Ataque) e DEF (Defesa), além de ordenação customizada.',
      'Ao clicar em qualquer carta, abre-se a visualização detalhada em alta definição com todas as Variações/Skins daquela carta (Frame Legado, Novo Frame Moderno, artes especiais e cartas promocionais).',
      'Mapa Neural de Sinergias: dentro da visualização da carta, o jogador pode explorar o grafo interativo de conexões que mostra cartas do mesmo arquétipo, suporte direto e ligações de personagem.',
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
    title: 'MONTE SEU DECK, FERRAMENTAS PRO & PDF/IMAGEM EM CASCATA',
    subtitle: 'Deck Builder na nuvem, Simulador de Mulligan, Comparador, Decks da Comunidade e Exportação Anti-Pirataria',
    route: 'Botão "Monte seu Deck" (/decks) e "Populares" (/populares)',
    TalkingPoints: [
      'No construtor "Monte seu Deck", o jogador monta seu Deck Principal (30 a 35 cartas), seu Deck Auxiliar (até 10 cartas) e inclui seus Tokens no Deck de Heróis (até 15 Tokens) com validação automática das regras oficiais (sem banlist, respeitando o limite de 1 cópia por carta pelo nome base).',
      'O jogador logado pode salvar múltiplos decks na nuvem ("Meus Decks Salvos") para acessar de qualquer dispositivo, bem como importar e exportar listas instantaneamente via Código do Deck (LDT:...).',
      'Decks da Comunidade: galeria integrada onde os jogadores publicam seus decks para a comunidade, dão curtidas nas melhores listas, copiam o código ou abrem direto no construtor.',
      'Simulador de Mão Inicial & Mulligan: permite sortear mãos de 5 cartas, escolher quais cartas devolver ao deck para testar o Mulligan oficial e consultar a probabilidade matemática de comprar cartas de custo baixo no turno 1.',
      'Comparador de Decks (Lado a Lado): compara duas listas quaisquer mostrando a taxa de similaridade (%), cartas em comum, cartas exclusivas de cada deck e o comparativo de curva de custo (CT).',
      'Imagem do Deck & PDF Oficial de Torneio Unificado: gera tanto a Imagem PNG do Deck quanto o PDF Oficial A4 de Torneio. No PDF, a Página 1 traz a lista formal de cartas (Principal, Auxiliar e Tokens) pronta para a arbitragem, e a última página traz a Imagem Visual do Deck com o Código do Deck e as cartas reais sobrepostas em cascata (mostrando arte, status e nome da carta, mas ocultando a metade inferior do efeito para evitar pirataria).',
      'Na aba "Populares" (/populares), qualquer pessoa pode consultar o termômetro do Meta: o ranking em tempo real das cartas mais usadas nos decks salvos pelos jogadores.'
    ],
    PublicHighlights: [
      'Exportação unificada: Lista A4 de Torneio na Página 1 + Imagem Visual do Deck em Cascata Anti-Pirataria na última página.',
      'Ferramentas competitivas completas: Simulador de Mulligan, Comparador de Decks e Galeria de Decks da Comunidade.'
    ]
  },
  {
    number: '05',
    title: 'LORE, MAPA 3D, ÁRVORE DE RELAÇÕES & QUIZ DIÁRIO',
    subtitle: 'Imersão completa na história dos Macroversos 1 e 13 com recompensas de pontuação',
    route: 'Botão "Lore" (/lore)',
    TalkingPoints: [
      'A central de Lore organiza toda a história de Light Dark em categorias: Conceitos Cósmicos, Personagens, Locais/Reinos, Organizações, Grandes Eventos e Contos.',
      'Ao ler sobre um personagem ou evento, o leitor vê as cartas do jogo conectadas àquela história e pode explorar a Árvore Interativa de Relações entre Personagens (alianças, rivalidades, família e origens).',
      'Mapa 3D Interativo: os jogadores podem explorar espacialmente o universo em 3D (girar a câmera, dar zoom em setores e clicar nos planetas/locais para abrir a ficha histórica daquele mundo).',
      'Seletor de Macroverso & Linha do Tempo Retrátil (parte inferior do Mapa 3D): permite alternar entre o Macroverso 13 (onde ocorre 90% da história atual) e o Macroverso 1. No Macroverso 13, a barra retrátil de Linha do Tempo na base do mapa permite viajar entre épocas — e o Mapa 3D se transforma de acordo com a época escolhida, mudando territórios de facções e locais visíveis!',
      'Quiz Diário do Macroverso (dentro de Lore): libera 1 pergunta inédita por dia sobre lore, regras ou cartas (incluindo desafios de imagem borrada). Quem acerta logado na conta ganha Pontos de Quiz permanentes no perfil, aumenta sua sequência de acertos (ofensiva) e sobe no Ranking Oficial do Quiz.'
    ],
    PublicHighlights: [
      'Mapa 3D vivo que muda de acordo com a época selecionada na Linha do Tempo retrátil + Árvore de Relações de Personagens.',
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
      'App Duelo (/duelo): o marcador de partida companheiro para jogos físicos ou remotos. Controla os 20 Pontos de Vida, progressão de Mana (1 a 10), ativação das 3 Runas, contadores de turno, rolagem de dados e suporta tanto duelos 1v1 quanto partidas em dupla (2v2).',
      'Duelo vs IA (/duelo-ia): simulador de partida completo dentro do navegador onde o jogador enfrenta uma Inteligência Artificial programada (Deck Insanis). Ideal para novos jogadores aprenderem na prática como funcionam as fases do turno, invocação, equipamentos, combate e correntes.'
    ],
    PublicHighlights: [
      'Abertura de pacotes (Pack Opener) com taxas reais de raridade e coleções específicas.',
      'Marcador de Partida completo (1v1 e 2v2) e Treino solo contra IA direto no navegador sem precisar instalar nada.'
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
    title: 'PERFIL, INSÍGNIAS OFICIAIS, ÁLBUM COM PRODUTOS & HALL DA FAMA',
    subtitle: 'Identidade do colecionador, adição rápida de produtos fechados, títulos exclusivos e rankings',
    route: 'Menu da Conta (canto superior direito), /album e /ranking',
    TalkingPoints: [
      'Criar uma conta é rápido (Google ou E-mail/Senha) e libera o menu pessoal do jogador no canto superior direito, onde ele pode personalizar seu Nome de Exibição.',
      'Meu Álbum de Coleção (/album): o jogador marca todas as cartas e variações que possui fisicamente, acompanha sua barra de progresso percentual rumo aos 100% e solicita verificação oficial para suas cartas Rare Print numeradas.',
      'Botão "Adicionar Produto" no Álbum: permite adicionar de uma só vez todas as cartas de produtos oficiais fechados! Quem possui o "Pacote Macroversal" adiciona automaticamente os 9 Decks Estruturais completos + todas as cartas do Booster Invasão do Caos já com acabamento Foil 3D (Confeti 3D); e quem possui a "Coleção Reforço Macroversal" adiciona de uma vez todas as cartas do Booster Reforço Macroversal.',
      'Insígnias & Títulos Exclusivos de Perfil: além dos troféus de torneio e conquistas automáticas, os jogadores exibem Insígnias e Títulos especiais concedidos pela Administração (por campeonatos, colecionismo ou títulos honorários exclusivos), visíveis no Perfil Público e no Hall da Fama.',
      'Meu Perfil & Cartas que Procuro (Wishlist): página pública do jogador com suas insígnias, medalhas de torneio, pontos acumulados no Quiz Diário, progresso do álbum e a lista de cartas que ele procura para troca/compra ("Cartas Mais Procuradas").',
      'Hall da Fama (/ranking): o ranking oficial dos maiores colecionadores do Macroverso, permitindo clicar em qualquer colecionador para visitar o perfil, ver suas insígnias e consultar a lista de desejos dele.'
    ],
    PublicHighlights: [
      'Adição em 1 clique de pacotes completos (Pacote Macroversal em Foil 3D e Coleção Reforço Macroversal) direto no Álbum.',
      'Ecossistema social completo: Insígnias Exclusivas + Coleção + Lista de Desejos + Pontos de Quiz + Troféus de Campeonatos em um único perfil.'
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
  doc.text('DOCUMENTO OFICIAL ATUALIZADO • ROTEIRO DE VÍDEO & GUIA DO PÚBLICO', marginX + 6, cursorY + 9);

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
    '1. Home e 5 Tipos de Carta (com Token) -> 2. Manual Retrátil, Arquétipos e FAQ -> 3. Catálogo, Skins e Mapa Neural -> 4. Monte seu Deck, Mulligan, Comparador e PDF/Imagem em Cascata -> 5. Lore, Mapa 3D, Árvore de Relações e Quiz -> 6. Booster, App Duelo e Duelo vs IA -> 7. Torneios, Mercado, Álbum (Adição de Produtos) e Insígnias.';
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
