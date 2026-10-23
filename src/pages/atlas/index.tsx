import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { DeviceDiagram } from "@/components/modules/atlas/device-diagram";
import { Icon } from "@/components/ui/icon";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  ATLAS_CATEGORIES,
  ATLAS_GUIDES,
  type AtlasGuide,
  categoryForDevice,
  searchAtlasGuides,
} from "@/lib/repair-atlas";

function AtlasFlow({ guide }: { guide: AtlasGuide }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {guide.flow.map((item, index) => (
        <div className="flex items-center gap-2" key={item}>
          {index > 0 && (
            <Icon
              className="text-on-surface-variant text-sm"
              name="arrow_forward"
            />
          )}
          <span className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 font-semibold text-on-surface text-sm">
            <span className="me-2 text-primary">{index + 1}.</span>
            {item}
          </span>
        </div>
      ))}
    </div>
  );
}

function AtlasGuideContent({
  guide,
  onBack,
}: {
  guide: AtlasGuide;
  onBack: () => void;
}) {
  const [completed, setCompleted] = useState<Record<number, boolean>>({});
  const share = async () => {
    // Não incluir texto da reparação, identificadores de clientes ou filtros
    // no URL partilhado. A rota continua protegida por autenticação.
    const url = new URL("/atlas", window.location.origin);
    url.searchParams.set("guia", guide.id);
    const ok = await copyTextToClipboard(url.toString());
    if (ok) {
      toast.success("Ligação interna do guia copiada");
    } else {
      toast.error("Não foi possível copiar a ligação");
    }
  };
  const progress = guide.validation.filter((_, i) => completed[i]).length;
  return (
    <article className="mx-auto max-w-5xl space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-semibold text-primary hover:bg-primary/10"
          onClick={onBack}
          type="button"
        >
          <Icon name="arrow_back" /> Voltar à biblioteca
        </button>
        <button
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface-container-high px-4 font-semibold text-on-surface hover:bg-surface-container-highest"
          onClick={share}
          type="button"
        >
          <Icon name="share" /> Partilhar guia
        </button>
      </div>

      <header className="rounded-2xl bg-surface-container p-5 sm:p-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary text-xs">
            {ATLAS_CATEGORIES.find((c) => c.id === guide.category)?.name}
          </span>
          <span className="rounded-full bg-surface-container-high px-3 py-1 text-on-surface-variant text-xs">
            Nível: {guide.difficulty}
          </span>
        </div>
        <h1 className="font-extrabold font-headline text-2xl text-on-surface sm:text-3xl">
          {guide.title}
        </h1>
        <p className="mt-3 max-w-3xl text-on-surface-variant leading-relaxed">
          {guide.summary}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {guide.symptoms.map((symptom) => (
            <span
              className="rounded-lg border border-outline-variant/50 px-3 py-1.5 text-on-surface-variant text-xs"
              key={symptom}
            >
              {symptom}
            </span>
          ))}
        </div>
      </header>

      <DeviceDiagram category={guide.category} />

      <section className="rounded-2xl bg-surface-container p-5 sm:p-7">
        <h2 className="mb-4 flex items-center gap-2 font-bold font-headline text-lg">
          <Icon className="text-primary" name="timeline" /> Percurso do
          diagnóstico
        </h2>
        <AtlasFlow guide={guide} />
      </section>

      <section className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 sm:p-7">
        <h2 className="mb-3 flex items-center gap-2 font-bold font-headline text-lg">
          <Icon name="warning" /> Segurança antes de começar
        </h2>
        <ul className="list-disc space-y-2 ps-5 text-sm leading-relaxed">
          {guide.precautions.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl bg-surface-container p-5 lg:col-span-1">
          <h2 className="mb-4 flex items-center gap-2 font-bold font-headline text-lg">
            <Icon className="text-primary" name="build" /> Ferramentas
          </h2>
          <ul className="space-y-3">
            {guide.tools.map((tool) => (
              <li className="flex gap-2 text-sm" key={tool}>
                <Icon
                  className="shrink-0 text-primary text-sm"
                  name="check_circle"
                />
                <span>{tool}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl bg-surface-container p-5 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 font-bold font-headline text-lg">
            <Icon className="text-primary" name="troubleshoot" /> Pontos de
            verificação
          </h2>
          <div className="space-y-4">
            {guide.checkpoints.map((checkpoint, i) => (
              <div
                className="rounded-xl bg-surface-container-low p-4"
                key={checkpoint.question}
              >
                <h3 className="font-bold text-sm">
                  {i + 1}. {checkpoint.question}
                </h3>
                <p className="mt-2 text-on-surface-variant text-sm">
                  <strong className="text-on-surface">Verificar:</strong>{" "}
                  {checkpoint.check}
                </p>
                <p className="mt-1 text-on-surface-variant text-sm">
                  <strong className="text-on-surface">Interpretação:</strong>{" "}
                  {checkpoint.meaning}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl bg-surface-container p-5 sm:p-7">
        <h2 className="mb-4 flex items-center gap-2 font-bold font-headline text-lg">
          <Icon className="text-primary" name="fact_check" /> Procedimento
          recomendado
        </h2>
        <ol className="space-y-4">
          {guide.steps.map((step, i) => (
            <li className="flex gap-4" key={step}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-sm">
                {i + 1}
              </span>
              <p className="pt-1 text-sm leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl bg-surface-container p-5 sm:p-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-bold font-headline text-lg">
            <Icon className="text-primary" name="verified" /> Checklist de
            verificação final
          </h2>
          <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary text-xs">
            {progress}/{guide.validation.length} verificados
          </span>
        </div>
        <div className="space-y-3">
          {guide.validation.map((item, i) => (
            <label
              className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-container-low p-3 text-sm"
              key={item}
            >
              <input
                checked={Boolean(completed[i])}
                className="mt-0.5 size-4 accent-primary"
                onChange={(event) =>
                  setCompleted((prev) => ({
                    ...prev,
                    [i]: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span
                className={
                  completed[i] ? "text-on-surface-variant line-through" : ""
                }
              >
                {item}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-4 text-on-surface-variant text-xs">
          Esta checklist é temporária e não altera a ficha da reparação. Regista
          os resultados oficiais na ordem de serviço.
        </p>
      </section>
      <p className="rounded-xl bg-surface-container-low p-4 text-on-surface-variant text-xs leading-relaxed">
        Atlas Técnico OficinaOS — referência de formação e triagem. Os diagramas
        são genéricos; não são esquemas elétricos nem instruções específicas do
        fabricante. A decisão final e os trabalhos em circuitos energizados
        cabem a técnicos habilitados.
      </p>
    </article>
  );
}

export default function RepairAtlasPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const deviceType = params.get("tipo");
  const [category, setCategory] = useState(
    params.get("categoria") ?? categoryForDevice(deviceType)
  );
  const guideId = params.get("guia");
  const selected = ATLAS_GUIDES.find((item) => item.id === guideId);
  const matching = useMemo(
    () => searchAtlasGuides(query, category),
    [query, category]
  );
  const fromJob = params.get("obra");

  const selectGuide = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) {
      next.set("guia", id);
    } else {
      next.delete("guia");
    }
    setParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (selected) {
    return (
      <AtlasGuideContent
        guide={selected}
        key={selected.id}
        onBack={() => selectGuide(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-7 pb-10">
      <header className="rounded-2xl bg-surface-container p-5 sm:p-8">
        <div className="mb-3 flex items-center gap-2 text-primary">
          <Icon name="menu_book" size="lg" />
          <span className="font-bold text-xs uppercase tracking-wider">
            Biblioteca técnica • OficinaOS
          </span>
        </div>
        <h1 className="font-extrabold font-headline text-3xl text-on-surface sm:text-4xl">
          Atlas de Reparações
        </h1>
        <p className="mt-3 max-w-2xl text-on-surface-variant leading-relaxed">
          Guias práticos para a bancada: identificar sintomas, seguir um
          diagnóstico estruturado e confirmar os resultados antes de entregar o
          equipamento.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-on-surface-variant text-xs">
          <span>{ATLAS_GUIDES.length} guias originais</span>
          <span aria-hidden="true">•</span>
          <span>Português de Portugal</span>
          <span aria-hidden="true">•</span>
          <span>Consulta interna para técnicos</span>
        </div>
        {fromJob && (
          <Link
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary/10 px-4 font-semibold text-primary text-sm hover:bg-primary/20"
            to={`/jobs/${encodeURIComponent(fromJob)}`}
          >
            <Icon name="arrow_back" /> Voltar à ficha de reparação
          </Link>
        )}
      </header>

      <div className="relative">
        <Icon
          className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          name="search"
        />
        <input
          aria-label="Pesquisar avaria, sintoma, componente ou ferramenta"
          className="min-h-14 w-full rounded-2xl border border-outline-variant/50 bg-surface-container ps-12 pe-4 text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex.: não carrega, ecrã preto, HDMI, ventoinha, impressora..."
          type="search"
          value={query}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {ATLAS_CATEGORIES.map((item) => (
          <button
            aria-pressed={category === item.id}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 font-semibold text-xs transition-colors ${
              category === item.id
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant/50 bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
            }`}
            key={item.id}
            onClick={() => setCategory(item.id)}
            type="button"
          >
            <Icon className="text-sm" name={item.icon} />
            {item.name}
          </button>
        ))}
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold font-headline text-xl">Guias disponíveis</h2>
          <span className="text-on-surface-variant text-sm">
            {matching.length} resultado(s)
          </span>
        </div>
        {matching.length === 0 ? (
          <div className="rounded-2xl bg-surface-container p-10 text-center">
            <Icon
              className="mx-auto text-3xl text-on-surface-variant"
              name="search_off"
            />
            <p className="mt-3 font-semibold">
              Não encontrámos guias com estes critérios.
            </p>
            <button
              className="mt-4 min-h-11 rounded-xl bg-primary px-5 font-semibold text-on-primary text-sm"
              onClick={() => {
                setQuery("");
                setCategory("all");
              }}
              type="button"
            >
              Mostrar todos os guias
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {matching.map((guide) => (
              <button
                className="group flex h-full min-h-56 flex-col rounded-2xl border border-outline-variant/30 bg-surface-container p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                key={guide.id}
                onClick={() => selectGuide(guide.id)}
                type="button"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 font-semibold text-primary text-xs">
                    <Icon
                      className="text-sm"
                      name={
                        ATLAS_CATEGORIES.find((c) => c.id === guide.category)
                          ?.icon ?? "build"
                      }
                    />
                    {
                      ATLAS_CATEGORIES.find((c) => c.id === guide.category)
                        ?.name
                    }
                  </span>
                  <Icon
                    className="text-on-surface-variant group-hover:text-primary"
                    name="arrow_forward"
                  />
                </div>
                <h3 className="font-bold font-headline text-lg text-on-surface">
                  {guide.title}
                </h3>
                <p className="mt-2 flex-1 text-on-surface-variant text-sm leading-relaxed">
                  {guide.summary}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {guide.tags.slice(0, 3).map((tag) => (
                    <span
                      className="rounded-md bg-surface-container-high px-2 py-1 text-on-surface-variant text-xs"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-4 text-on-surface-variant text-xs">
                  Nível: {guide.difficulty}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="rounded-2xl border border-outline-variant/50 bg-surface-container-low p-5 text-on-surface-variant text-sm leading-relaxed">
        <strong className="text-on-surface">Sobre a partilha:</strong> a ligação
        de cada guia pode ser enviada a outros técnicos com acesso ao OficinaOS.
        Os guias não incluem dados de clientes nem acesso público, e não
        substituem os manuais técnicos dos fabricantes.
      </aside>
    </div>
  );
}
