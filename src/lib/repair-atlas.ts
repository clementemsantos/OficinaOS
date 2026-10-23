/**
 * Atlas Técnico OficinaOS — conteúdo original, genérico e revisto para PT-PT.
 * Não constitui documentação de serviço de um fabricante, esquema elétrico,
 * boardview ou instruções específicas de modelos.
 *
 * Esta biblioteca não contém dados de clientes e pode ser partilhada por
 * técnicos autenticados na mesma instância do OficinaOS.
 */
export type AtlasCategory =
  | "phone"
  | "tablet"
  | "laptop"
  | "desktop"
  | "console"
  | "printer"
  | "general";

export type AtlasDifficulty = "Inicial" | "Intermédio" | "Avançado";

export interface AtlasCheckpoint {
  question: string;
  check: string;
  meaning: string;
}

export interface AtlasGuide {
  id: string;
  title: string;
  category: AtlasCategory;
  difficulty: AtlasDifficulty;
  summary: string;
  symptoms: string[];
  tags: string[];
  tools: string[];
  precautions: string[];
  checkpoints: AtlasCheckpoint[];
  steps: string[];
  validation: string[];
  flow: string[];
}

export const ATLAS_CATEGORIES: { id: AtlasCategory | "all"; name: string; icon: string }[] = [
  { id: "all", name: "Todos", icon: "menu_book" },
  { id: "phone", name: "Telemóveis", icon: "smartphone" },
  { id: "tablet", name: "Tablets", icon: "tablet_mac" },
  { id: "laptop", name: "Portáteis", icon: "laptop_mac" },
  { id: "desktop", name: "Computadores", icon: "desk" },
  { id: "console", name: "Consolas", icon: "sports_esports" },
  { id: "printer", name: "Impressoras", icon: "print" },
  { id: "general", name: "Bancada e segurança", icon: "verified_user" },
];

export const ATLAS_GUIDES: AtlasGuide[] = [
  {
    id: "telemovel-nao-liga",
    title: "Telemóvel não liga",
    category: "phone",
    difficulty: "Intermédio",
    summary: "Sequência de diagnóstico para um telemóvel sem sinais de arranque, evitando substituições por tentativa.",
    symptoms: ["Sem reação ao botão de ligar", "Ecrã preto", "Não vibra", "Não arranca"],
    tags: ["alimentação", "bateria", "arranque", "USB", "ecrã"],
    tools: ["Carregador e cabo comprovadamente funcionais", "Fonte de alimentação de bancada adequada", "Multímetro", "Lupa ou microscópio"],
    precautions: [
      "Registar o estado e obter autorização antes da abertura do equipamento.",
      "Não alimentar diretamente células de lítio nem contornar os respetivos circuitos de proteção.",
      "Se houver bateria inchada, odor anormal ou aquecimento excessivo, interromper os testes e isolar o equipamento.",
    ],
    checkpoints: [
      { question: "Existe qualquer sinal de vida?", check: "Verificar vibração, sons, indicadores e eventual deteção pelo computador.", meaning: "Se existir, investigar ecrã, retroiluminação ou software antes de concluir que falta alimentação." },
      { question: "O conjunto cabo/carregador funciona?", check: "Repetir com acessórios conhecidos e inspecionar visualmente a porta sem forçar o conector.", meaning: "Falhas externas de carregamento são frequentes e devem ser excluídas primeiro." },
      { question: "Existem danos externos?", check: "Observar impacto, líquido, corrosão e sinais de deformação.", meaning: "Dano ou humidade alteram o plano e as condições de segurança." },
    ],
    steps: [
      "Confirmar o sintoma com o cliente e documentar os sinais observados.",
      "Testar uma fonte e cabo adequados, sem insistir perante calor anormal.",
      "Pesquisar indícios de arranque sem imagem; testar apenas os reinícios previstos pelo fabricante.",
      "Com autorização, inspecionar conectores e alimentação segundo o manual técnico do modelo.",
      "Só substituir componentes depois de identificar evidência técnica que sustente a causa.",
    ],
    validation: ["Arranca repetidamente sem falhas", "Carrega de forma estável", "Ecrã, botões e sensores principais funcionam", "Registar resultado antes/depois na reparação"],
    flow: ["Confirmar sinais", "Excluir carregador", "Distinguir arranque / imagem", "Inspecionar alimentação", "Validar reparação"],
  },
  {
    id: "telemovel-nao-carrega",
    title: "Telemóvel não carrega ou carrega lentamente",
    category: "phone",
    difficulty: "Inicial",
    summary: "Separar problemas de acessórios, porta USB, bateria e circuito de carga.",
    symptoms: ["Não carrega", "Carregamento lento", "Carrega apenas numa posição", "Ligação USB intermitente"],
    tags: ["USB-C", "Lightning", "conector", "carga", "bateria", "cabo"],
    tools: ["Cabo e carregador de referência", "Luz e ampliação", "Medidor USB adequado, se disponível", "Ferramenta de inspeção não condutora"],
    precautions: ["Desligar a fonte antes de inspecionar a porta.", "Nunca introduzir peças metálicas num conector energizado.", "Não aplicar calor nem pressionar baterias deformadas."],
    checkpoints: [
      { question: "O problema repete-se com outro cabo?", check: "Testar acessórios compatíveis e conhecidos.", meaning: "Se desaparecer, a avaria pode ser externa." },
      { question: "A porta apresenta desgaste ou resíduos?", check: "Inspecionar sem danificar os contactos.", meaning: "A sujidade e a folga mecânica podem interromper a ligação." },
      { question: "O aquecimento é normal?", check: "Observar temperatura e mensagens de proteção.", meaning: "Aquecimento anormal exige suspensão do teste." },
    ],
    steps: ["Registar se falha a carga por fio, sem fios ou ambas.", "Confirmar cabo, carregador, tomada e compatibilidade.", "Inspecionar a porta e limpeza segura conforme procedimento do fabricante.", "Comparar comportamento com o equipamento desligado, quando aplicável.", "Identificar a causa antes de propor porta, bateria ou intervenção na placa."],
    validation: ["Carga reconhecida", "Ligação estável sem mover cabo", "Sem aquecimento anormal", "Percentagem evolui de forma consistente"],
    flow: ["Acessórios", "Porta", "Comunicação de carga", "Bateria / circuito", "Teste final"],
  },
  {
    id: "ecra-sem-imagem",
    title: "Ecrã sem imagem, com riscos ou toque defeituoso",
    category: "phone",
    difficulty: "Intermédio",
    summary: "Distinguir falha no módulo de imagem de falha no arranque ou na placa.",
    symptoms: ["Imagem preta", "Riscos no ecrã", "Toque não responde", "Imagem intermitente", "Vidro partido"],
    tags: ["LCD", "OLED", "display", "touch", "flat", "retroiluminação"],
    tools: ["Lanterna", "Lupa", "Módulo de teste compatível, se disponível", "Ferramentas específicas do modelo"],
    precautions: ["Fazer backup quando possível e respeitar os dados do cliente.", "Desligar a alimentação antes de mexer nos conectores internos.", "Alguns modelos exigem procedimentos de calibração ou emparelhamento pós-reparação."],
    checkpoints: [
      { question: "O telemóvel arranca sem imagem?", check: "Procurar vibração, sons ou reconhecimento por computador.", meaning: "A alimentação pode estar funcional." },
      { question: "O dano é visível ou provocado por impacto?", check: "Verificar fissuras, manchas, linhas e deformações.", meaning: "Indícios mecânicos podem apontar para o módulo de ecrã." },
      { question: "A falha é só no toque?", check: "Confirmar imagem normal e ausência de resposta tátil.", meaning: "Investigar digitalizador, conector e software." },
    ],
    steps: ["Registar imagem e resposta tátil antes da abertura.", "Confirmar que não é apenas brilho ou suspensão do ecrã.", "Consultar documentação específica do modelo para desmontagem e segurança.", "Inspecionar conectores e sinais de líquido após desligar a alimentação.", "Testar com peça compatível e fiável antes da montagem definitiva."],
    validation: ["Imagem uniforme", "Toque em toda a superfície", "Brilho e sensores", "Ausência de folgas", "Testes finais registados"],
    flow: ["Arranca?", "Há imagem?", "Há toque?", "Conectores / módulo", "Calibração e testes"],
  },
  {
    id: "equipamento-com-liquidos",
    title: "Equipamento com contacto com líquidos",
    category: "general",
    difficulty: "Avançado",
    summary: "Triagem segura de entrada de líquidos, com documentação e avaliação do risco de corrosão.",
    symptoms: ["Molhou-se", "Oxidação", "Falha após derrame", "Cheiro estranho", "Corrosão"],
    tags: ["água", "humidade", "oxidação", "desoxidação", "segurança"],
    tools: ["Equipamento de proteção adequado", "Lupa ou microscópio", "Material antiestático", "Documentação do fabricante"],
    precautions: ["Não ligar nem carregar um equipamento molhado.", "Não aquecer, secar em forno doméstico ou mergulhar em arroz.", "Não usar solventes sem conhecer as características do material e da bateria.", "Baterias danificadas requerem procedimento apropriado de contenção e gestão de resíduos."],
    checkpoints: [
      { question: "O equipamento foi ligado depois do contacto?", check: "Registar tentativas de utilização e carga.", meaning: "Pode existir risco de curto-circuito e dano adicional." },
      { question: "Há sinais externos de humidade?", check: "Fotografar manchas, indicadores e corrosão visíveis.", meaning: "A extensão interna pode ser maior do que a aparente." },
      { question: "O cliente precisa dos dados?", check: "Priorizar avaliação de recuperação de dados antes de ações irreversíveis.", meaning: "Reparação funcional e recuperação de dados são objetivos diferentes." },
    ],
    steps: ["Desligar e suspender energização; documentar a ocorrência.", "Obter consentimento para abertura e avaliação sem garantia de recuperação.", "Aplicar precauções antiestáticas e específicas do fabricante.", "Fazer diagnóstico visual e técnico antes de qualquer limpeza profissional.", "Explicar risco de corrosão tardia e testar funções após intervenção."],
    validation: ["Resultados e limitações documentados", "Ausência de riscos imediatos conhecidos", "Funções críticas verificadas", "Cliente informado sobre possíveis falhas posteriores"],
    flow: ["Não energizar", "Documentar", "Inspeção controlada", "Diagnóstico", "Comunicar risco"],
  },
  {
    id: "portatil-sem-imagem",
    title: "Computador portátil liga mas não dá imagem",
    category: "laptop",
    difficulty: "Intermédio",
    summary: "Separar falhas do painel, saída de vídeo, memória e inicialização do sistema.",
    symptoms: ["Ecrã preto", "Liga mas não dá imagem", "Sem vídeo", "Led ligado", "Ventoinha arranca"],
    tags: ["portátil", "RAM", "HDMI", "BIOS", "painel", "POST"],
    tools: ["Monitor externo e cabo de teste", "Lanterna", "Multímetro quando aplicável", "Documentação de serviço do modelo"],
    precautions: ["Desligar a alimentação e bateria interna conforme manual antes de abrir.", "Evitar testes de placa energizada sem competência e instrumentos próprios.", "Não executar atualizações de firmware sem alimentação estável e confirmação de compatibilidade."],
    checkpoints: [
      { question: "O equipamento termina o arranque?", check: "Observar indicadores e sinais sonoros/códigos de erro.", meaning: "Diferencia ausência de vídeo de falha no POST." },
      { question: "Há imagem no monitor externo?", check: "Testar saída compatível respeitando combinações de teclas do modelo.", meaning: "Pode apontar para painel ou ligação de vídeo." },
      { question: "Há sinais de retroiluminação?", check: "Usar iluminação externa sem desmontagem.", meaning: "Imagem muito ténue pode indicar problema na iluminação do painel." },
    ],
    steps: ["Reproduzir a falha e fotografar indicadores.", "Remover periféricos externos não essenciais.", "Consultar códigos de erro do fabricante.", "Testar monitor externo compatível.", "Com alimentação desligada, verificar módulos acessíveis apenas segundo documentação de serviço.", "Validar o diagnóstico antes de substituir painel ou placa."],
    validation: ["Arranque fiável", "Imagem estável no painel", "Suspensão e retoma", "Vídeo externo quando aplicável"],
    flow: ["Energia", "POST", "Vídeo externo", "Painel / memória", "Reteste"],
  },
  {
    id: "portatil-sobreaquece",
    title: "Portátil aquece demasiado ou desliga-se",
    category: "laptop",
    difficulty: "Intermédio",
    summary: "Diagnóstico de ventilação, dissipação térmica e carga de processamento.",
    symptoms: ["Aquece muito", "Desliga sozinho", "Ventoinha ruidosa", "Lentidão sob carga"],
    tags: ["temperatura", "ventoinha", "poeira", "dissipador", "thermal throttling"],
    tools: ["Software de monitorização fiável", "Ar comprimido adequado", "Ferramentas do fabricante", "Material térmico aprovado para o modelo"],
    precautions: ["Desligar e remover alimentação antes da limpeza interna.", "Não permitir que a ventoinha rode livremente com jatos de ar.", "Não obstruir grelhas nem usar o computador sobre materiais inflamáveis."],
    checkpoints: [
      { question: "A temperatura aumenta em repouso?", check: "Verificar utilização de CPU, GPU e processos em segundo plano.", meaning: "Carga de software também pode explicar aquecimento." },
      { question: "O fluxo de ar parece reduzido?", check: "Observar grelhas, ruído e velocidade da ventoinha.", meaning: "Obstrução ou ventilador avariado podem limitar a refrigeração." },
      { question: "Há desligamento de proteção?", check: "Registar condições exatas da falha.", meaning: "Não repetir testes de stress perante sinais de sobreaquecimento extremo." },
    ],
    steps: ["Guardar os dados importantes e medir o comportamento em repouso.", "Confirmar software, drivers e perfil de energia.", "Inspecionar entradas e saídas de ar.", "Fazer limpeza ou manutenção térmica apenas seguindo instruções do fabricante.", "Testar estabilidade com carga moderada e vigilância de temperaturas."],
    validation: ["Temperaturas estáveis para o modelo", "Sem desligamentos", "Ventoinha funcional", "Registo das condições de teste"],
    flow: ["Sintoma", "Carga de software", "Fluxo de ar", "Sistema térmico", "Validação"],
  },
  {
    id: "desktop-sem-arranque",
    title: "Desktop não arranca",
    category: "desktop",
    difficulty: "Intermédio",
    summary: "Diagnóstico inicial de energia, POST e periféricos de um computador de secretária.",
    symptoms: ["Computador não liga", "Sem arranque", "Reinicia", "Não dá imagem", "Sem POST"],
    tags: ["fonte", "alimentação", "placa-mãe", "memória", "POST"],
    tools: ["Cabo/tomada conhecidos", "Documentação da placa-mãe", "Fonte de teste apropriada", "Diagnóstico POST compatível"],
    precautions: ["Nunca abrir uma fonte de alimentação ATX: os condensadores podem reter tensão perigosa.", "Desligar o cabo de alimentação antes de alterar componentes.", "Confirmar ligações e requisitos de potência antes de ligar uma fonte de teste."],
    checkpoints: [
      { question: "Há energia na tomada e no cabo?", check: "Confirmar fonte externa e interruptores.", meaning: "Excluir uma causa simples antes da desmontagem." },
      { question: "Há LEDs, ventoinhas ou códigos de erro?", check: "Documentar todos os sinais.", meaning: "Códigos POST podem apontar para memória, gráfica ou placa." },
      { question: "O computador inicia com periféricos mínimos?", check: "Aplicar configuração mínima recomendada pelo fabricante.", meaning: "Ajuda a isolar acessórios ou módulos." },
    ],
    steps: ["Confirmar cabo, tomada e interruptores.", "Registar sons, LEDs e mensagens.", "Desligar da rede e verificar cabos internos apenas depois da descarga indicada pelo fabricante.", "Consultar códigos POST do modelo.", "Testar componentes individualmente com peças de referência adequadas."],
    validation: ["POST sem erro", "Arranque fiável", "Reconhecimento dos dispositivos", "Teste de estabilidade documentado"],
    flow: ["Energia externa", "Sinais POST", "Configuração mínima", "Componente suspeito", "Arranque final"],
  },
  {
    id: "consola-nao-da-imagem",
    title: "Consola liga mas não apresenta imagem",
    category: "console",
    difficulty: "Intermédio",
    summary: "Verificar primeiro a cadeia HDMI, a resolução e o arranque antes de intervir na placa.",
    symptoms: ["Sem sinal HDMI", "Ecrã preto na TV", "Consola sem imagem", "Imagem intermitente"],
    tags: ["HDMI", "porta", "resolução", "cabo", "consola", "Nintendo", "PlayStation", "Xbox"],
    tools: ["Cabo HDMI de referência", "Monitor compatível", "Iluminação de inspeção", "Manual do fabricante"],
    precautions: ["Desligar consola e monitor antes de mexer em cabos ou conectores danificados.", "Não forçar portas HDMI nem usar conectores deformados.", "A reparação de micro-soldadura exige ferramentas e experiência adequadas."],
    checkpoints: [
      { question: "O cabo e o monitor estão bons?", check: "Testar conjunto alternativo e entrada HDMI correta.", meaning: "Falhas externas devem ser excluídas." },
      { question: "A consola emite sinais de arranque?", check: "Observar LED, áudio e indicadores do fabricante.", meaning: "Ajuda a separar software/vídeo de energia." },
      { question: "A porta tem danos?", check: "Inspecionar o conector sem o energizar.", meaning: "Pinos deformados podem provocar falha intermitente." },
    ],
    steps: ["Verificar canal de entrada, cabo, monitor e modos de vídeo oficiais.", "Reiniciar apenas pelos procedimentos suportados.", "Documentar sinais de alimentação e vídeo.", "Inspecionar a porta de forma não invasiva.", "Encaminhar para diagnóstico de placa quando há evidência de falha interna."],
    validation: ["Imagem e som consistentes", "Resolução correta", "Sem falhas ao mudar de ecrã", "Ligação estável"],
    flow: ["Cabo / TV", "Modo de vídeo", "Arranque", "Conector", "Teste final"],
  },
  {
    id: "impressora-nao-imprime",
    title: "Impressora não imprime",
    category: "printer",
    difficulty: "Inicial",
    summary: "Confirmar ligação, fila de impressão, consumíveis e alertas antes de intervir no equipamento.",
    symptoms: ["Não imprime", "Documento preso na fila", "Offline", "Erro de tinteiro", "Papel não avança"],
    tags: ["impressora", "Wi-Fi", "driver", "tinteiro", "toner", "fila", "papel"],
    tools: ["Página de teste do equipamento", "Computador de referência", "Manual de assistência", "Consumíveis compatíveis de teste quando apropriado"],
    precautions: ["Não tocar em unidades de fusão de impressoras laser ainda quentes.", "Desligar antes de remover papel preso, conforme instruções do fabricante.", "Não abrir ou modificar cartuchos de toner sem equipamento adequado."],
    checkpoints: [
      { question: "A impressora faz autoteste?", check: "Imprimir o relatório interno sem computador, quando suportado.", meaning: "Se imprimir, a falha pode estar na ligação ou no software." },
      { question: "Aparece offline ou com erro?", check: "Confirmar visor, papel, consumíveis e conectividade.", meaning: "A mensagem específica orienta o diagnóstico." },
      { question: "O problema é de um único computador?", check: "Comparar com outro dispositivo autorizado.", meaning: "Ajuda a isolar drivers e fila de impressão." },
    ],
    steps: ["Registar o código de erro e verificar consumíveis e papel.", "Executar autoteste do equipamento.", "Confirmar rede ou cabo USB.", "Verificar fila e driver correto para o sistema operativo.", "Testar uma página simples antes de concluir."],
    validation: ["Autoteste impresso", "Impressão a partir do PC", "Alimentação correta do papel", "Qualidade aceitável"],
    flow: ["Erro no painel", "Autoteste", "Consumíveis", "Ligação / driver", "Impressão final"],
  },
  {
    id: "boas-praticas-bancada",
    title: "Preparação da bancada e segurança ESD",
    category: "general",
    difficulty: "Inicial",
    summary: "Rotina antes de abrir qualquer equipamento: identificação, proteção de dados, descarga eletrostática e peças.",
    symptoms: ["Checklist pré-reparação", "Preparação de ferramentas", "Segurança da oficina"],
    tags: ["ESD", "bancada", "fotografias", "dados", "inventário", "qualidade"],
    tools: ["Tapete e pulseira ESD verificados", "Tapete ou organizador de parafusos", "Iluminação", "Câmara", "Ferramenta adequada"],
    precautions: ["Desligar e isolar fontes de energia antes da desmontagem.", "O manuseamento de baterias de lítio implica medidas específicas do fabricante.", "Nunca aceder a dados pessoais sem necessidade e autorização."],
    checkpoints: [
      { question: "O equipamento está identificado?", check: "Confirmar marca, modelo, número de série e ordem de reparação.", meaning: "Evita trocas de equipamentos e peças." },
      { question: "Existe consentimento e registo do estado?", check: "Fotografar danos e acessórios entregues.", meaning: "Garante rastreabilidade e reduz conflitos." },
      { question: "A bancada está preparada?", check: "Verificar limpeza, ferramentas, ESD e organização de parafusos.", meaning: "Evita danos adicionais durante a intervenção." },
    ],
    steps: ["Conferir ficha de reparação e consentimento.", "Fotografar e registar o estado inicial.", "Preparar ferramentas e proteção ESD adequada.", "Confirmar manual de serviço e procedimentos de bateria.", "Organizar parafusos, peças, consumíveis e testes necessários."],
    validation: ["Estado inicial documentado", "Peças rastreáveis", "Checklist final realizada", "Cliente informado dos resultados"],
    flow: ["Identificação", "Consentimento", "Segurança", "Intervenção", "Controlo final"],
  },
];

export function normalizeAtlasSearch(text: string): string {
  return text.toLocaleLowerCase("pt-PT").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const COMMON_WORDS = new Set([
  "com", "sem", "para", "que", "uma", "uns", "por", "mas", "dos", "das",
  "tem", "está", "esta", "não", "nao", "quando", "depois", "antes",
  "equipamento", "problema", "cliente", "meu", "minha",
]);

export function searchAtlasGuides(query: string, category: string = "all"): AtlasGuide[] {
  const words = normalizeAtlasSearch(query)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !COMMON_WORDS.has(word));
  const candidates = ATLAS_GUIDES.filter(
    (guide) => category === "all" || guide.category === category
  );
  if (words.length === 0) return candidates;
  return candidates.map((guide) => {
    const title = normalizeAtlasSearch(guide.title);
    const symptoms = normalizeAtlasSearch(guide.symptoms.join(" "));
    const body = normalizeAtlasSearch([
      guide.summary, ...guide.tags, ...guide.tools, ...guide.flow,
    ].join(" "));
    const score = words.reduce((total, word) =>
      total + (title.includes(word) ? 5 : 0)
        + (symptoms.includes(word) ? 3 : 0)
        + (body.includes(word) ? 1 : 0), 0);
    return { guide, score };
  }).filter(({score}) => score > 0)
    .sort((a,b) => b.score - a.score || a.guide.title.localeCompare(b.guide.title, "pt"))
    .map(({guide}) => guide);
}

export function categoryForDevice(deviceCategory?: string | null): string {
  const map: Record<string, string> = {
    phone: "phone", tablet: "tablet", laptop: "laptop",
    desktop: "desktop", console: "console", printer: "printer",
  };
  return map[deviceCategory ?? ""] ?? "all";
}
