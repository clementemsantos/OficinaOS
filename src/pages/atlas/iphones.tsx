import { useMemo, useState } from "react";
import { Link } from "react-router";
import { DeviceDiagram } from "@/components/modules/atlas/device-diagram";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FAMILIES: { family: string; models: string[] }[] = [
  {
    family: "Primeiras gerações",
    models: [
      "iPhone (original)",
      "iPhone 3G",
      "iPhone 3GS",
      "iPhone 4",
      "iPhone 4s",
      "iPhone 5",
      "iPhone 5c",
      "iPhone 5s",
    ],
  },
  {
    family: "iPhone 6 e SE",
    models: [
      "iPhone 6",
      "iPhone 6 Plus",
      "iPhone 6s",
      "iPhone 6s Plus",
      "iPhone SE (1.ª geração)",
    ],
  },
  {
    family: "iPhone 7 e 8",
    models: ["iPhone 7", "iPhone 7 Plus", "iPhone 8", "iPhone 8 Plus"],
  },
  {
    family: "iPhone X",
    models: ["iPhone X", "iPhone XR", "iPhone XS", "iPhone XS Max"],
  },
  {
    family: "iPhone 11",
    models: [
      "iPhone 11",
      "iPhone 11 Pro",
      "iPhone 11 Pro Max",
      "iPhone SE (2.ª geração)",
    ],
  },
  {
    family: "iPhone 12",
    models: [
      "iPhone 12 mini",
      "iPhone 12",
      "iPhone 12 Pro",
      "iPhone 12 Pro Max",
    ],
  },
  {
    family: "iPhone 13",
    models: [
      "iPhone 13 mini",
      "iPhone 13",
      "iPhone 13 Pro",
      "iPhone 13 Pro Max",
      "iPhone SE (3.ª geração)",
    ],
  },
  {
    family: "iPhone 14",
    models: [
      "iPhone 14",
      "iPhone 14 Plus",
      "iPhone 14 Pro",
      "iPhone 14 Pro Max",
    ],
  },
  {
    family: "iPhone 15",
    models: [
      "iPhone 15",
      "iPhone 15 Plus",
      "iPhone 15 Pro",
      "iPhone 15 Pro Max",
    ],
  },
  {
    family: "iPhone 16",
    models: [
      "iPhone 16e",
      "iPhone 16",
      "iPhone 16 Plus",
      "iPhone 16 Pro",
      "iPhone 16 Pro Max",
    ],
  },
  {
    family: "iPhone 17 e Air",
    models: [
      "iPhone 17e",
      "iPhone 17",
      "iPhone 17 Pro",
      "iPhone 17 Pro Max",
      "iPhone Air",
    ],
  },
  {
    family: "iPhone 18 / Duo",
    models: ["iPhone 18 Pro", "iPhone 18 Pro Max", "iPhone Duo"],
  },
];

const ZONES = [
  {
    id: "battery",
    title: "Bateria",
    description: "Saúde, autonomia, alimentação e sinais de dano físico.",
  },
  {
    id: "display",
    title: "Ecrã e toque",
    description: "Imagem, retroiluminação, sensores e testes pós-reparação.",
  },
  {
    id: "charge",
    title: "Carregamento",
    description:
      "Verificar cabo, porta, carregador e diagnóstico não invasivo.",
  },
  {
    id: "camera",
    title: "Câmaras",
    description: "Focagem, imagem, sensores e testes dos módulos.",
  },
  {
    id: "board",
    title: "Placa e conectores",
    description: "Inspeção ESD, sinais de líquido e ligações frágeis.",
  },
  {
    id: "sound",
    title: "Áudio",
    description: "Altifalantes, microfones, auricular e testes funcionais.",
  },
];


/** Fotografias reais com licença de reutilização; não trocar fotos entre modelos. */
const REAL_PHOTOS: { model: string; part: string; title: string; file: string; author: string; license: string }[] = [
  { model: "iPhone 6s", part: "battery", title: "Bateria e interior após abertura", file: "IPhone 6s - opened-92987.jpg", author: "Raimond Spekking", license: "CC BY-SA 4.0" },
  { model: "iPhone 6s", part: "display", title: "Parte posterior do ecrã", file: "IPhone 6s - display rear view with controller chip 343S00014-92993.jpg", author: "Raimond Spekking", license: "CC BY-SA 4.0" },
  { model: "iPhone 6s", part: "camera", title: "Módulo da câmara traseira separado", file: "IPhone 6s - rear camera - separated-93114.jpg", author: "Raimond Spekking", license: "CC BY-SA 4.0" },
  { model: "iPhone 6s", part: "front", title: "Módulo de câmara frontal FaceTime", file: "IPhone 6s - FaceTime camera module-7552.jpg", author: "Raimond Spekking", license: "CC BY-SA 4.0" },
  { model: "iPhone 6s", part: "board", title: "Placa lógica", file: "IPhone 6s - motherboard-93106.jpg", author: "Raimond Spekking", license: "CC BY-SA 4.0" },
  { model: "iPhone 6s", part: "taptic", title: "Taptic Engine", file: "IPhone 6s - Taptic Engine-92995.jpg", author: "Raimond Spekking", license: "CC BY-SA 4.0" },
  { model: "iPhone 6s", part: "biometric", title: "Botão Touch ID", file: "IPhone 6s - Touch ID front view-93104.jpg", author: "Raimond Spekking", license: "CC BY-SA 4.0" },
  { model: "iPhone 12", part: "display", title: "Vista real do equipamento com ecrã removido", file: "IPhone 12 screen removed.jpg", author: "茅野ふたば", license: "CC BY-SA 4.0" },
];
const REAL_PARTS = [
  {
    id: "battery", title: "Bateria", difficulty: "Intermédio", description: "Célula de iões de lítio, adesivos, ligação flex e controlo de alimentação.",
    tools: ["Proteção ESD", "Chaves próprias do modelo", "Ferramentas de abertura não metálicas", "Adesivo de bateria e vedação novos"],
    steps: ["Registar o estado e testar a saúde da bateria antes da intervenção.", "Desligar o equipamento e identificar o procedimento de abertura deste modelo.", "Abrir segundo o manual específico; não forçar cabos nem vidro.", "Desligar a bateria antes de mexer nos restantes conectores.", "Remover o adesivo e a bateria apenas pelo método previsto no manual; nunca perfurar ou dobrar a célula.", "Instalar a peça e adesivos corretos; montar, executar calibração quando aplicável e testar carga/autonomia."],
    checks: ["Carregamento estável", "Sem aquecimento anormal", "Histórico de peças e assistência verificado"],
    caution: "Bateria inchada, perfurada, quente ou danificada: interromper e seguir o protocolo de segurança."
  },
  {
    id: "display", title: "Ecrã e digitalizador", difficulty: "Intermédio", description: "Painel OLED/LCD, vidro, camada tátil, cabos flex e sensores ligados ao conjunto.",
    tools: ["Ferramenta de remoção de ecrã apropriada", "Ventosa e palhetas", "Chaves de precisão", "Vedação/adesivo de ecrã", "Tapete e pulseira ESD"],
    steps: ["Fotografar fissuras e testar imagem, brilho e toque antes da desmontagem.", "Desligar o iPhone e consultar a abertura e os limites de inserção para o modelo exato.", "Remover os parafusos e libertar o adesivo conforme o manual.", "Apoiar o ecrã sem esticar os cabos; desligar a bateria antes dos cabos do ecrã.", "Transferir apenas os conjuntos previstos no manual para preservar sensores.", "Testar imagem, toque, brilho e sensores; aplicar nova vedação e concluir a reparação no iOS, se aplicável."],
    checks: ["Toque em toda a superfície", "Imagem e brilho normais", "Sensores e Face ID/Touch ID testados"],
    caution: "Não confundir a posição dos cabos entre gerações nem usar parafusos de comprimento errado."
  },
  {
    id: "charge", title: "Conector de carga", difficulty: "Avançado", description: "Porta Lightning ou USB-C, contactos e, em certos modelos, flex com microfones.",
    tools: ["Carregador e cabo de teste", "Lupa ou microscópio", "Ferramentas ESD", "Chaves do modelo", "Módulo/flex compatível"],
    steps: ["Excluir defeito do cabo, carregador e tomada.", "Verificar se o problema é carregamento com fio, sem fios ou dados USB.", "Inspecionar a porta sem introduzir objetos metálicos em contactos energizados.", "Consultar o manual da variante: o acesso ao módulo muda entre modelos.", "Só substituir o conjunto depois de confirmar a causa e os flex associados.", "Testar carga, transmissão de dados e microfone quando partilharem módulo."],
    checks: ["Carga estável", "Dados USB funcionais", "Microfones funcionais"],
    caution: "Nem todas as portas são peças de substituição disponibilizadas pelo fabricante."
  },
  {
    id: "camera", title: "Câmara traseira", difficulty: "Intermédio", description: "Conjunto ótico, sensor, foco e estabilização; composição varia por modelo.",
    tools: ["Chaves de precisão", "Proteção ESD", "Pinça ESD", "Peça exata do modelo"],
    steps: ["Testar todas as objetivas, focagem e vídeo.", "Desligar o aparelho e consultar acesso ao módulo na documentação exata.", "Isolar a alimentação antes de desconectar o flex.", "Desmontar proteções e fixações previstas no guia, sem tocar nas lentes.", "Montar componente compatível e executar calibração quando indicada.", "Testar foto, vídeo, zoom, estabilização e flash."],
    checks: ["Imagem limpa", "Foco estável", "Todas as câmaras testadas"],
    caution: "Em algumas gerações há calibração/validação pós-substituição."
  },
  {
    id: "front", title: "Câmara frontal / sensores", difficulty: "Avançado", description: "Conjunto frontal e, nos modelos compatíveis, partes do sistema TrueDepth.",
    tools: ["Proteção ESD", "Chaves do fabricante", "Ampliação", "Peças e ferramentas especificadas no manual"],
    steps: ["Verificar câmara frontal, sensores e Face ID separadamente.", "Confirmar disponibilidade e regras de substituição para o modelo exato.", "Desligar a bateria e seguir a ordem do manual.", "Evitar pressão sobre sensores e lentes e não separar subconjuntos não reparáveis.", "Montar apenas a peça correta e completar configuração de reparação quando indicada.", "Testar selfies, proximidade, luminosidade e autenticação biométrica."],
    checks: ["Câmara frontal", "Proximidade e luminosidade", "Face ID quando existente"],
    caution: "Os componentes biométricos podem necessitar de emparelhamento e procedimentos oficiais."
  },
  {
    id: "sound", title: "Áudio e microfones", difficulty: "Intermédio", description: "Colunas superior/inferior, auricular, microfones e contactos.",
    tools: ["Ferramentas ESD", "Chaves próprias", "Lupa", "Peça de substituição comprovada"],
    steps: ["Testar chamadas, alta-voz, gravação e reprodução.", "Excluir obstrução de grelhas e falha de software.", "Desligar e seguir o acesso à peça no manual do modelo.", "Inspecionar os flex e remover as fixações corretas.", "Substituir apenas o módulo identificado como defeituoso.", "Testar volume, microfones e chamadas após montar."],
    checks: ["Áudio de chamadas", "Alta-voz", "Gravação sem ruído"],
    caution: "Microfones podem fazer parte de flex diferentes consoante a versão."
  },
  {
    id: "taptic", title: "Taptic Engine", difficulty: "Intermédio", description: "Atuador de vibração e feedback háptico.",
    tools: ["Chaves de precisão", "Ferramentas ESD", "Peça compatível"],
    steps: ["Confirmar vibração e feedback háptico nas definições.", "Desligar e consultar o acesso ao módulo para o modelo.", "Isolar a bateria e identificar fixações sem misturar parafusos.", "Desligar o conector e substituir o módulo, se o diagnóstico o justificar.", "Montar e testar vibração, toque háptico e ausência de ruídos anormais."],
    checks: ["Vibração", "Resposta háptica", "Sem ruídos soltos"],
    caution: "A posição e os suportes mudam entre modelos."
  },
  {
    id: "board", title: "Placa lógica e conectores", difficulty: "Avançado", description: "Placa principal, blindagens, conectores e circuitos eletrónicos.",
    tools: ["Tapete e pulseira ESD", "Microscópio", "Multímetro", "Documentação técnica de serviço", "Equipamento de microssoldadura apenas com formação"],
    steps: ["Registar sintomas e fazer diagnóstico não invasivo.", "Verificar impacto, humidade e histórico de intervenção.", "Consultar a documentação de desmontagem da variante Axxxx.", "Inspecionar conectores sem forçar ou alterar proteções.", "Só avançar para reparação eletrónica após diagnóstico e autorização adequados.", "Executar testes completos de arranque, rede, carga e sensores."],
    checks: ["Arranque", "Rede e Wi-Fi", "Carga e temperaturas"],
    caution: "Microssoldadura e manipulação da placa exigem formação e controlo ESD."
  },
  {
    id: "biometric", title: "Touch ID / Face ID", difficulty: "Avançado", description: "Sensores biométricos e conectores relacionados com autenticação.",
    tools: ["Diagnóstico de software", "Ferramentas ESD", "Manual oficial", "Equipamento de calibração quando aplicável"],
    steps: ["Confirmar mensagem e estado do sensor antes de abrir.", "Identificar se o modelo usa Touch ID ou Face ID.", "Verificar danos físicos e compatibilidade das peças.", "Consultar procedimento e limitações de configuração da Apple.", "Executar apenas a reparação suportada para o modelo.", "Testar desbloqueio, sensores e histórico de peças."],
    checks: ["Autenticação", "Sensor de proximidade", "Configuração completa"],
    caution: "Não tentar contornar mecanismos de segurança nem prometer funcionalidade sem validação."
  },
  {
    id: "back", title: "Vidro posterior / estrutura", difficulty: "Avançado", description: "Tampa, chassis, bobina MagSafe e vedação; acesso pode ser traseiro ou frontal.",
    tools: ["Equipamento de proteção ocular", "Ferramentas de abertura adequadas", "Adesivos e juntas", "Proteção térmica", "Chaves próprias"],
    steps: ["Documentar a quebra e conferir o estado da estrutura.", "Consultar o manual do modelo para o lado correto de abertura.", "Proteger componentes, bateria e câmaras antes de qualquer operação.", "Substituir o módulo suportado sem expor a bateria a risco térmico.", "Repor vedação e fixações recomendadas.", "Testar carregamento sem fios, antenas e câmaras."],
    checks: ["Sem estilhaços", "Vedação substituída", "Carregamento sem fios"],
    caution: "A abertura traseira não é igual em todos os iPhones; evitar improvisar aquecimento ou laser."
  }
] as const;
const VERIFIED_REPAIR_GUIDES: Record<string, { part: string; url: string; title: string; time?: string }[]> = {
  "iPhone 13": [{ part: "battery", title: "Substituição da bateria — passos fotografados", url: "https://pt.ifixit.com/Guide/Substitui%C3%A7%C3%A3o+da+bateria+do+iPhone+13/145896", time: "1–2 h (referência iFixit)" }],
  "iPhone 14": [{ part: "display", title: "Substituição do ecrã — passos fotografados", url: "https://www.ifixit.com/Guide/iPhone+14+Screen+Replacement/152975", time: "45–60 min (referência iFixit)" }]
};
const OFFICIAL_MANUALS: Record<string, string> = {
  "iPhone 13": "https://support.apple.com/pt-pt/100402",
  "iPhone 15 Pro": "https://support.apple.com/pt-pt/104872",
  "iPhone 16": "https://support.apple.com/pt-pt/120652",
  "iPhone 17": "https://support.apple.com/pt-pt/123029",
  "iPhone 17 Pro": "https://support.apple.com/pt-pt/124262"
};

export default function IphoneAtlasPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("iPhone 13");
  const [zone, setZone] = useState(ZONES[0].id);
  const [activePart, setActivePart] = useState<(typeof REAL_PARTS)[number]["id"]>("battery");
  const selectedPart = REAL_PARTS.find((item) => item.id === activePart) ?? REAL_PARTS[0];
  const selectedPhotos = REAL_PHOTOS.filter((photo) => photo.model === selected && photo.part === activePart);
  const verifiedGuide = VERIFIED_REPAIR_GUIDES[selected]?.find((guide) => guide.part === activePart);
  const hasSpecificManual = Boolean(OFFICIAL_MANUALS[selected]);
  const manualLink = OFFICIAL_MANUALS[selected] ?? "https://support.apple.com/pt-pt/docs/iphone";

  const filtered = useMemo(
    () =>
      FAMILIES.map((family) => ({
        ...family,
        models: family.models.filter((model) =>
          model.toLowerCase().includes(query.trim().toLowerCase())
        ),
      })).filter((family) => family.models.length > 0),
    [query]
  );
  const selectedZone = ZONES.find((item) => item.id === zone) ?? ZONES[0];
  const total = FAMILIES.reduce((sum, family) => sum + family.models.length, 0);
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="rounded-2xl bg-surface-container p-5 sm:p-8">
        <Link
          className="inline-flex items-center gap-2 text-primary text-sm"
          to="/atlas"
        >
          <Icon name="arrow_back" /> Atlas de Reparações
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-extrabold text-3xl">Atlas visual de iPhones</h1>
            <p className="mt-2 text-on-surface-variant">
              {total} modelos organizados por gerações, com zonas técnicas,
              notas e acesso à documentação oficial.
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 font-semibold text-on-primary"
            to="/atlas/colaborativo"
          >
            <Icon name="add" /> Adicionar guia técnico
          </Link>
        </div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(250px,1fr)_minmax(0,2fr)]">
        <aside className="space-y-4">
          <div className="rounded-2xl bg-surface-container p-4">
            <Label htmlFor="iphone-atlas-search">Procurar modelo</Label>
            <Input
              className="mt-2"
              id="iphone-atlas-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ex.: iPhone 13 Pro"
              type="search"
              value={query}
            />
          </div>
          <div className="max-h-[650px] space-y-4 overflow-y-auto rounded-2xl bg-surface-container p-4">
            {filtered.length === 0 && (
              <p className="text-on-surface-variant">
                Não foi encontrado esse modelo.
              </p>
            )}
            {filtered.map((family) => (
              <section key={family.family}>
                <h2 className="mb-2 font-bold text-sm">{family.family}</h2>
                <div className="space-y-1">
                  {family.models.map((model) => (
                    <button
                      aria-pressed={selected === model}
                      className={
                        "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors" +
                        (selected === model
                          ? "bg-primary text-on-primary"
                          : "hover:bg-surface-container-high")
                      }
                      key={model}
                      onClick={() => setSelected(model)}
                      type="button"
                    >
                      {model}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </aside>
        <section className="space-y-5">
          <div className="rounded-2xl bg-surface-container p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-2xl">{selected}</h2>
              <span className="rounded-full bg-amber-500/10 px-3 py-1 font-semibold text-amber-600 text-xs">
                Esquema didático
              </span>
            </div>
            <p className="mt-2 text-on-surface-variant text-sm">
              Este desenho é ilustrativo e{" "}
              <strong>não representa a posição real dos componentes</strong>{" "}
              deste modelo. As vistas internas específicas serão adicionadas
              apenas após validação técnica e dos direitos das imagens.
            </p>
            <div className="mt-4">
              <DeviceDiagram category="phone" />
            </div>
            <h3 className="mt-6 mb-3 font-bold">
              Explorar componentes e sintomas
            </h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {ZONES.map((item) => (
                <button
                  aria-pressed={zone === item.id}
                  className={
                    "min-h-11 rounded-xl border px-3 py-2 text-left font-semibold text-sm" +
                    (zone === item.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant/50")
                  }
                  key={item.id}
                  onClick={() => setZone(item.id)}
                  type="button"
                >
                  {item.title}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-surface-container-high p-4">
              <h3 className="font-bold">{selectedZone.title}</h3>
              <p className="mt-1 text-on-surface-variant text-sm">
                {selectedZone.description}
              </p>
              <p className="mt-2 text-on-surface-variant text-xs">
                Consulta orientadora; valida os procedimentos para a variante
                exata do equipamento.
              </p>
            </div>
          </div>

          <section className="space-y-4 rounded-2xl bg-surface-container p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-extrabold text-xl">Peças, ferramentas e reparação passo a passo</h2>
              <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary text-xs">Atlas técnico · PT-PT</span>
            </div>
            <p className="text-on-surface-variant text-sm">
              Seleciona uma peça para consultar a função, a dificuldade, o material necessário,
              a sequência de diagnóstico/intervenção e os testes finais.
              Os passos são orientadores até existir um guia específico validado para este modelo.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {REAL_PARTS.map((item) => (
                <button
                  aria-pressed={activePart === item.id}
                  className={`rounded-xl border p-3 text-left text-sm ${activePart === item.id ? "border-primary bg-primary/10" : "border-outline-variant/50 hover:bg-surface-container-high"}`}
                  key={item.id}
                  onClick={() => setActivePart(item.id)}
                  type="button"
                >
                  <span className="block font-bold">{item.title}</span>
                  <span className="mt-1 block text-on-surface-variant text-xs">{item.difficulty}</span>
                </button>
              ))}
            </div>
            <div className="space-y-5 rounded-xl bg-surface-container-high p-4 sm:p-6">
              <div>
                <h3 className="font-extrabold text-xl">{selectedPart.title}</h3>
                <span className="mt-2 inline-flex rounded-lg border border-outline-variant px-2 py-1 text-xs">Dificuldade: {selectedPart.difficulty}</span>
                <p className="mt-3 text-sm">{selectedPart.description}</p>
              </div>
              <div>
                <h4 className="font-bold">Material e ferramentas</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {selectedPart.tools.map((tool) => <li key={tool}>{tool}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="font-bold">Passos de trabalho</h4>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                  {selectedPart.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              </div>
              <div className="rounded-lg border border-amber-500/40 p-3 text-sm">
                <strong>Precaução:</strong> {selectedPart.caution}
              </div>
              <div>
                <h4 className="font-bold">Verificações finais</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {selectedPart.checks.map((check) => <li key={check}>{check}</li>)}
                </ul>
              </div>
              {verifiedGuide && (
                <div className="rounded-lg border border-primary/40 p-4">
                  <p className="font-bold text-sm">Guia com fotografias para este modelo e peça</p>
                  <a className="mt-2 inline-flex items-center gap-2 font-semibold text-primary text-sm underline" href={verifiedGuide.url} rel="noreferrer" target="_blank">
                    {verifiedGuide.title} <Icon name="open_in_new" />
                  </a>
                  {verifiedGuide.time && <p className="mt-1 text-on-surface-variant text-xs">{verifiedGuide.time}</p>}
                  <p className="mt-2 text-on-surface-variant text-xs">As fotografias da iFixit são consultadas no site de origem, sem republicação no OficinaOS.</p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <h3 className="font-bold">Fotografias reais da peça no modelo selecionado</h3>
                <p className="text-on-surface-variant text-sm">Só são mostradas fotografias identificadas para o mesmo iPhone, nunca de um modelo parecido.</p>
              </div>
              {selectedPhotos.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedPhotos.map((photo) => {
                    const originalUrl = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(photo.file.replaceAll(" ", "_"))}`;
                    const imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(photo.file.replaceAll(" ", "_"))}?width=700`;
                    return (
                      <figure className="overflow-hidden rounded-xl border border-outline-variant/50" key={photo.file}>
                        <a href={originalUrl} rel="noopener noreferrer" target="_blank" title="Abrir fotografia original e licença">
                          <img alt={`${photo.title} — ${selected}`} className="h-56 w-full bg-black/5 object-contain" height={700} loading="lazy" src={imageUrl} width={700} />
                        </a>
                        <figcaption className="space-y-1 p-3 text-xs">
                          <strong className="block text-sm">{photo.title}</strong>
                          <span>© {photo.author} · {photo.license} · Wikimedia Commons</span>
                          <a className="block font-semibold text-primary underline" href={originalUrl} rel="noopener noreferrer" target="_blank">Origem, resolução e licença</a>
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-outline-variant border-dashed p-4 text-on-surface-variant text-sm">
                  Ainda não existe uma fotografia licenciada e validada desta peça para {selected}.
                  Consulta o manual do fabricante abaixo, com as imagens originais, ou acrescenta fotografias próprias
                  através do editor do Atlas.
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <a className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 font-bold text-primary text-sm" href={manualLink} rel="noopener noreferrer" target="_blank">
                  {hasSpecificManual ? "Manual Apple para este modelo" : "Localizar manual Apple do modelo"} <Icon name="open_in_new" />
                </a>
                <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 font-bold text-primary text-sm" to="/atlas/colaborativo">
                  <Icon name="add_photo_alternate" /> Adicionar fotos/guia próprios
                </Link>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-outline-variant/50 bg-surface-container p-5">
            <Icon className="text-primary" name="verified" />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold">Documentação técnica verificada</h3>
              <p className="text-on-surface-variant text-sm">
                Consulta a identificação e documentação da Apple para confirmar
                diferenças por modelo.
              </p>
            </div>
            <a
              className="inline-flex min-h-11 items-center rounded-xl bg-primary/10 px-4 font-semibold text-primary text-sm"
              href="https://support.apple.com/pt-pt/108044"
              rel="noopener noreferrer"
              target="_blank"
            >
              Suporte Apple <Icon name="open_in_new" />
            </a>
          </div>
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 font-semibold text-primary"
            to="/atlas/colaborativo"
          >
            <Icon name="edit_note" /> Escrever solução para {selected}
          </Link>
        </section>
      </div>
    </div>
  );
}
