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

export default function IphoneAtlasPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("iPhone 13");
  const [zone, setZone] = useState(ZONES[0].id);
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
