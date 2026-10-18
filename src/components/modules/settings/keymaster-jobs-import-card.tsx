import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import { readKeymasterPreviewXlsx } from "@/lib/keymaster-import";

interface LegacyRow {
  approval: string;
  assignedTo: string;
  customerName: string;
  dateOriginal: string;
  deviceName: string;
  jobRef: string;
  pvpText: string;
  sourceStatus: string;
  timeOriginal: string;
}

interface LegacyResult {
  created: number;
  existing: number;
  issues: { jobRef: string; reason: string }[];
  ready: number;
  total: number;
}

const COLUMNS = [
  "Nº Folha Obra",
  "Data original",
  "Hora",
  "PVP Cliente (EUR)",
  "Equipamento",
  "Cliente",
  "Etapa",
  "Estado original Keymaster",
  "Atribuído a",
];

function spreadsheetRows(matrix: unknown[][]): LegacyRow[] {
  const header = (matrix[0] ?? []).map((x) => String(x ?? "").trim());
  const indexes = COLUMNS.map((name) => header.indexOf(name));
  if (indexes.some((idx) => idx === -1)) {
    throw new Error("Faltam colunas. Utiliza o ficheiro das folhas de obra preparado para o Misto.");
  }
  const rows: LegacyRow[] = [];
  for (const values of matrix.slice(1)) {
    const fields = indexes.map((idx) => String(values[idx] ?? "").trim());
    if (fields.every((value) => value === "")) {
      continue;
    }
    rows.push({
      jobRef: fields[0] ?? "",
      dateOriginal: fields[1] ?? "",
      timeOriginal: fields[2] ?? "",
      pvpText: fields[3] ?? "",
      deviceName: fields[4] ?? "",
      customerName: fields[5] ?? "",
      approval: fields[6] ?? "",
      sourceStatus: fields[7] ?? "",
      assignedTo: fields[8] ?? "",
    });
  }
  if (rows.length === 0 || rows.length > 150) {
    throw new Error("A listagem deve conter de 1 a 150 folhas de obra.");
  }
  return rows;
}

export default function KeymasterJobsImportCard() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<LegacyRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<LegacyResult | null>(null);
  const [result, setResult] = useState<LegacyResult | null>(null);
  const [error, setError] = useState("");

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) {
      return;
    }
    setError("");
    setPreview(null);
    setResult(null);
    setFileName(file.name);
    setRows([]);
    try {
      if (!/\.xlsx$/i.test(file.name)) {
        throw new Error("Seleciona o Excel .xlsx da listagem de obras.");
      }
      const parsed = spreadsheetRows(
        readKeymasterPreviewXlsx(await file.arrayBuffer())
      );
      setRows(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ler o Excel.");
    }
  };

  const submit = async (dryRun: boolean) => {
    if (busy || rows.length === 0) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await api.post<LegacyResult>("/import/keymaster/jobs-list", {
        rows,
        dryRun,
      });
      if (dryRun) {
        setPreview(response.data);
      } else {
        setResult(response.data);
        setPreview(null);
        toast.success("Importação das folhas de obra terminada. Confirma as contagens.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na importação.");
    } finally {
      setBusy(false);
    }
  };

  const summary = result ?? preview;

  return (
    <div className="mt-4 rounded-xl border border-outline-variant p-4">
      <h4 className="font-semibold text-on-surface text-sm">
        Folhas de obra Keymaster — importação parcial
      </h4>
      <p className="mt-2 text-on-surface-variant text-xs">
        Esta opção importa listagens de obras (não importa históricos, notas ou
        fotografias). Só associa clientes com um único nome correspondente.
        Nunca regista pagamentos nem marca equipamentos como entregues.
      </p>
      <Input
        accept=".xlsx"
        className="hidden"
        onChange={onFile}
        ref={fileInput}
        type="file"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          size="sm"
          type="button"
          variant="secondary"
        >
          Selecionar Excel de reparações
        </Button>
        <Button
          disabled={busy || rows.length === 0}
          loading={busy}
          onClick={() => submit(true)}
          size="sm"
          type="button"
          variant="secondary"
        >
          Simular importação
        </Button>
        {preview && preview.ready > 0 && (
          <Button
            disabled={busy}
            loading={busy}
            onClick={() => submit(false)}
            size="sm"
            type="button"
          >
            Importar {preview.ready} fichas prontas
          </Button>
        )}
      </div>
      {fileName && (
        <p className="mt-2 text-on-surface-variant text-xs">
          {fileName} — {rows.length} folhas na listagem
        </p>
      )}
      {error && <p className="mt-2 text-error text-sm">{error}</p>}
      {summary && (
        <div aria-live="polite" className="mt-3 text-on-surface text-sm">
          <p>
            {result ? "Importação:" : "Simulação:"} {summary.total} obras ·
            {result ? " criadas" : " prontas"}: {result ? summary.created : summary.ready} ·
            já existentes: {summary.existing} · por resolver: {summary.issues.length}
          </p>
          {summary.issues.length > 0 && (
            <div className="mt-2">
              {summary.issues.map((issue) => (
                <p className="text-on-surface-variant text-xs" key={issue.jobRef}>
                  {issue.jobRef}: {issue.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
