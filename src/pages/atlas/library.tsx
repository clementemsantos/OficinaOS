import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import api, { getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

interface AtlasImage {
  id: string;
  filename: string;
}
interface AtlasEntry {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  brand: string | null;
  model: string | null;
  tags: string[];
  difficulty: string;
  status: "DRAFT" | "SHOP";
  authorId: string;
  images: AtlasImage[];
}
interface EditorState {
  id: string | null;
  title: string;
  summary: string;
  content: string;
  category: string;
  brand: string;
  model: string;
  tags: string;
  difficulty: string;
}
const EMPTY: EditorState = {
  id: null, title: "", summary: "", content: "",
  category: "phone", brand: "", model: "", tags: "", difficulty: "Intermédio",
};
const CATEGORIES = [
  ["phone", "Telemóveis"], ["tablet", "Tablets"],
  ["laptop", "Portáteis"], ["desktop", "Computadores"],
  ["console", "Consolas"], ["printer", "Impressoras"],
  ["general", "Segurança e bancada"],
];

function editForm(entry: AtlasEntry): EditorState {
  return {
    id: entry.id, title: entry.title, summary: entry.summary, content: entry.content,
    category: entry.category, brand: entry.brand ?? "", model: entry.model ?? "",
    tags: entry.tags.join(", "), difficulty: entry.difficulty,
  };
}

function AtlasEditor(props: {
  initial: EditorState;
  onCancel: () => void;
  onSaved: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState(props.initial);
  const [saving, setSaving] = useState(false);
  const update = (key: keyof EditorState, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title, summary: form.summary, content: form.content,
        category: form.category, brand: form.brand || null, model: form.model || null,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        difficulty: form.difficulty,
      };
      const result = form.id
        ? await api.patch<{ data: AtlasEntry }>("/atlas/entries/" + form.id, payload)
        : await api.post<{ data: AtlasEntry }>("/atlas/entries", payload);
      toast.success("Guia guardado como rascunho");
      await props.onSaved(result.data.data.id);
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível guardar o guia"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="space-y-5 rounded-2xl bg-surface-container p-5 sm:p-8"
      onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <h2 className="font-bold text-2xl">{form.id ? "Editar guia" : "Novo guia"}</h2>
      <p className="text-on-surface-variant text-sm">As alterações são rascunhos. O responsável aprova a publicação na loja.</p>
      <div className="space-y-2">
        <Label htmlFor="atlas-title">Título</Label>
        <Input id="atlas-title" minLength={5} maxLength={180} required value={form.title} onChange={(event) => update("title", event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="atlas-summary">Resumo e sintomas</Label>
        <Textarea id="atlas-summary" minLength={10} maxLength={600} required rows={3} value={form.summary} onChange={(event) => update("summary", event.target.value)} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="atlas-category">Categoria</Label>
          <select className="oos-field min-h-11 w-full px-3" id="atlas-category" value={form.category} onChange={(event) => update("category", event.target.value)}>
            {CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="atlas-brand">Marca</Label>
          <Input id="atlas-brand" maxLength={80} value={form.brand} onChange={(event) => update("brand", event.target.value)} placeholder="Apple" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="atlas-model">Modelo</Label>
          <Input id="atlas-model" maxLength={120} value={form.model} onChange={(event) => update("model", event.target.value)} placeholder="iPhone 13" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="atlas-content">Procedimento e testes</Label>
        <Textarea className="min-h-56" id="atlas-content" minLength={20} maxLength={50_000} required rows={9} value={form.content} onChange={(event) => update("content", event.target.value)} placeholder="1. Identificar os sintomas&#10;2. Verificar os componentes&#10;3. Registar os resultados" />
        <p className="text-on-surface-variant text-xs">Não incluas nomes de clientes, IMEI, códigos ou outros dados pessoais.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="atlas-tags">Etiquetas separadas por vírgulas</Label>
          <Input id="atlas-tags" value={form.tags} onChange={(event) => update("tags", event.target.value)} placeholder="bateria, carga, ecrã" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="atlas-difficulty">Dificuldade</Label>
          <select className="oos-field min-h-11 w-full px-3" id="atlas-difficulty" value={form.difficulty} onChange={(event) => update("difficulty", event.target.value)}>
            {["Inicial", "Intermédio", "Avançado"].map((level) => <option key={level}>{level}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button disabled={saving} type="submit" icon="save">{saving ? "A guardar..." : "Guardar rascunho"}</Button>
        <Button type="button" variant="secondary" onClick={props.onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}

function GuideDetails(props: {
  entry: AtlasEntry;
  canEdit: boolean;
  canPublish: boolean;
  onEdit: () => void;
  onRefresh: () => Promise<void>;
}) {
  const { entry } = props;
  const [busy, setBusy] = useState(false);
  const publish = async () => {
    setBusy(true);
    try {
      await api.post("/atlas/entries/" + entry.id + "/publish");
      toast.success("Guia publicado para a equipa");
      await props.onRefresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "Erro ao publicar"));
    } finally { setBusy(false); }
  };
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const data = new FormData();
      data.append("file", file);
      await api.post("/atlas/entries/" + entry.id + "/media", data);
      toast.success("Imagem adicionada");
      await props.onRefresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "Erro ao carregar imagem"));
    } finally { setBusy(false); }
  };
  return (
    <article className="space-y-5 rounded-2xl bg-surface-container p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary text-xs">{entry.status === "SHOP" ? "Publicado na loja" : "Rascunho privado"}</span>
        <div className="flex flex-wrap gap-2">
          {props.canEdit && <Button onClick={props.onEdit} variant="secondary" icon="edit">Editar</Button>}
          {props.canPublish && entry.status !== "SHOP" && <Button disabled={busy} onClick={() => { void publish(); }} icon="publish">Publicar na loja</Button>}
        </div>
      </div>
      <h2 className="font-extrabold text-2xl">{entry.title}</h2>
      <p className="text-on-surface-variant">{entry.summary}</p>
      <div className="flex flex-wrap gap-2 text-xs">
        {[entry.brand, entry.model, entry.difficulty, ...entry.tags].filter(Boolean).map((label, i) =>
          <span key={String(label) + i} className="rounded-full bg-surface-container-high px-3 py-1">{label}</span>)}
      </div>
      <div className="whitespace-pre-wrap border-t border-outline-variant/30 pt-5 text-sm leading-7">{entry.content}</div>
      <section className="space-y-4 border-t border-outline-variant/30 pt-6">
        <h3 className="font-bold text-lg">Fotografias e diagramas próprios</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {entry.images.map((image) => (
            <figure className="overflow-hidden rounded-xl bg-surface-container-high p-3" key={image.id}>
              <img alt={"Imagem técnica: " + image.filename} className="max-h-80 w-full rounded-lg object-contain" loading="lazy" src={"/api/atlas/entries/" + entry.id + "/media/" + image.id} />
              <figcaption className="mt-2 break-all text-on-surface-variant text-xs">{image.filename}</figcaption>
            </figure>
          ))}
        </div>
        {props.canEdit && (
          <div className="space-y-2">
            <Label htmlFor="atlas-image">Adicionar fotografia própria (até 5 MB)</Label>
            <Input id="atlas-image" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || entry.images.length >= 12}
              onChange={(event) => { const file = event.target.files?.[0]; if (file) { void upload(file); } event.target.value = ""; }} />
            <p className="text-on-surface-variant text-xs">Até 12 imagens originais por guia, sem dados pessoais e apenas nesta instalação.</p>
          </div>
        )}
      </section>
    </article>
  );
}

export default function AtlasLibraryPage() {
  const user = useAuthStore((state) => state.user);
  const isEditor = user?.role === "OWNER" || user?.role === "TECHNICIAN";
  const [entries, setEntries] = useState<AtlasEntry[]>([]);
  const [selected, setSelected] = useState<AtlasEntry | null>(null);
  const [editing, setEditing] = useState<EditorState | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: AtlasEntry[] }>("/atlas/entries");
      setEntries(data.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Erro ao carregar biblioteca"));
    } finally { setLoading(false); }
  }, []);
  const open = async (id: string) => {
    try {
      const { data } = await api.get<{ data: AtlasEntry }>("/atlas/entries/" + id);
      setSelected(data.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Erro ao abrir o guia"));
    }
  };
  useEffect(() => { void load(); }, [load]);
  const refresh = async () => { await load(); if (selected) { await open(selected.id); } };
  const normalize = (value: string) => value.toLocaleLowerCase("pt").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const visible = entries.filter((entry) =>
    normalize([entry.title, entry.summary, entry.brand, entry.model, ...entry.tags].join(" ")).includes(normalize(search)));
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <header className="rounded-2xl bg-surface-container p-5 sm:p-8">
        <Link className="inline-flex items-center gap-2 text-primary text-sm" to="/atlas"><Icon name="arrow_back" /> Atlas de Reparações</Link>
        <h1 className="mt-3 font-extrabold text-3xl">Biblioteca colaborativa da loja</h1>
        <p className="mt-2 text-on-surface-variant">Cria guias, adiciona fotografias e partilha soluções com a equipa. A partilha entre lojas ainda não está ativa.</p>
        {isEditor && <Button className="mt-4" icon="add" onClick={() => { setSelected(null); setEditing({ ...EMPTY }); }}>Novo guia</Button>}
      </header>
      {editing ? (
        <AtlasEditor initial={editing} onCancel={() => setEditing(null)}
          onSaved={async (id) => { setEditing(null); await load(); await open(id); }} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)]">
          <section className="space-y-3">
            <Label htmlFor="atlas-library-search">Pesquisar guias da loja</Label>
            <Input id="atlas-library-search" type="search" placeholder="Modelo, avaria, palavra-chave..." value={search} onChange={(event) => setSearch(event.target.value)} />
            {loading && <p>A carregar biblioteca...</p>}
            {!loading && visible.length === 0 && <p className="rounded-xl bg-surface-container p-5 text-on-surface-variant">Ainda não há guias com estes critérios. Podes criar o primeiro.</p>}
            {visible.map((entry) => (
              <button
                className={"w-full rounded-xl border p-4 text-left transition-colors hover:border-primary/70 " + (selected?.id === entry.id ? "border-primary bg-primary/10" : "border-outline-variant/40 bg-surface-container")}
                key={entry.id} onClick={() => { void open(entry.id); }} type="button">
                <span className="text-xs text-primary">{entry.status === "SHOP" ? "Da loja" : "Rascunho"}</span>
                <h2 className="mt-1 font-bold">{entry.title}</h2>
                <p className="mt-2 line-clamp-2 text-on-surface-variant text-sm">{entry.summary}</p>
                <span className="mt-2 inline-block text-on-surface-variant text-xs">{entry.brand} {entry.model}</span>
              </button>
            ))}
          </section>
          {selected ? (
            <GuideDetails entry={selected}
              canEdit={Boolean(isEditor && (user?.role === "OWNER" || selected.authorId === user?.id))}
              canPublish={user?.role === "OWNER"} onEdit={() => setEditing(editForm(selected))} onRefresh={refresh} />
          ) : (
            <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl bg-surface-container p-8 text-center">
              <Icon name="menu_book" size="lg" className="text-primary" />
              <p className="mt-3 text-on-surface-variant">Seleciona um guia para consultar os passos, imagens e estado de publicação.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
