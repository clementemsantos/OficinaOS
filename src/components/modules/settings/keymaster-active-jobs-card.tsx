import { type ChangeEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";
import { parsePtNumber, readTableFile } from "@/lib/import-table";
import { readKeymasterPreviewXlsx } from "@/lib/keymaster-import";

interface ActiveJobRow {
  attributedTo: string;
  customer: string;
  dateOriginal: string;
  equipment: string;
  pvp: number;
  reference: string;
  stage: string;
  stateOriginal: string;
  timeOriginal: string;
}
interface Decision {
  action: "create" | "already_imported" | "needs_review";
  customerId: string | null;
  reason: string;
  reference: string;
  status: string;
}
interface PreviewResponse {
  items: Decision[];
}
const NON_LETTER = /[^A-Z0-9]/g;
const DIACRITICS = /[\u0300-\u036f]/g;
const refCheck = /^20\d{2}\/\d{1,7}$/;

function normalized(s: string): string {
  return s
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toUpperCase()
    .replace(NON_LETTER, "");
}

function extract(rows: Record<string, string>[]): ActiveJobRow[] {
  return rows.map((raw, index) => {
    const byKey = new Map(
      Object.entries(raw).map(([key, value]) => [normalized(key), value])
    );
    const get = (key: string) => (byKey.get(key) ?? "").trim();
    const reference = get("NFOLHAOBRA");
    const priceText = get("PVPCLIENTE");
    const pvp = parsePtNumber(priceText);
    if (!refCheck.test(reference)) {
      throw new Error(
        `Linha ${index + 2}: referência de folha de obra inválida.`
      );
    }
    if (pvp === null || pvp < 0) {
      throw new Error(`Linha ${index + 2}: PVP inválido.`);
    }
    return {
      attributedTo: get("ATRIBUIDOA"),
      customer: get("CLIENTE"),
      dateOriginal: get("DATAORIGINAL"),
      equipment: get("EQUIPAMENTO"),
      pvp,
      reference,
      stage: get("ETAPA"),
      stateOriginal: get("ESTADOORIGINALKEYMASTER"),
      timeOriginal: get("HORA"),
    };
  });
}

function counts(items: Decision[]) {
  return {
    possible: items.filter((r) => r.action === "create").length,
    existing: items.filter((r) => r.action === "already_imported").length,
    review: items.filter((r) => r.action === "needs_review").length,
  };
}

export default function KeymasterActiveJobsCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ActiveJobRow[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) {
      return;
    }
    setBusy(true);
    setError("");
    setFileName(file.name);
    setDecisions([]);
    setComplete(false);
    try {
      let sourceRows: Record<string, string>[];
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        // Use the small, already-tested OOXML reader. It reads the first
        // worksheet directly and does not turn dates into JS Date objects.
        const sheet = readKeymasterPreviewXlsx(await file.arrayBuffer());
        const headers = (sheet[0] ?? []).map((head) =>
          String(head ?? "")
            .trim()
            .toLowerCase()
        );
        sourceRows = sheet
          .slice(1)
          .map((cells) =>
            Object.fromEntries(
              headers.map((head, index) => [
                head,
                String(cells[index] ?? "").trim(),
              ])
            )
          );
      } else {
        const parsed = await readTableFile(file);
        sourceRows = parsed.rows;
      }
      const next = extract(sourceRows);
      if (next.length === 0 || next.length > 100) {
        throw new Error("O ficheiro deve ter entre 1 e 100 obras.");
      }
      const res = await api.post<PreviewResponse>(
        "/import/keymaster/active-jobs/preview",
        { rows: next }
      );
      setRows(next);
      setDecisions(res.data.items);
    } catch (cause) {
      setRows([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível validar a listagem de obras."
      );
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (busy || counts(decisions).possible === 0) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.post<PreviewResponse>(
        "/import/keymaster/active-jobs/apply",
        { rows, confirm: "IMPORTAR_OBRAS_ATIVAS_KEYMASTER" }
      );
      setDecisions(res.data.items);
      setComplete(true);
    } catch {
      setError(
        "Falha na transferência. A operação é retomável: volta a validar o mesmo ficheiro."
      );
    } finally {
      setBusy(false);
    }
  };

  const summary = counts(decisions);
  return (
    <div className="mt-4 rounded-xl border border-outline-variant p-4">
      <h4 className="font-bold text-on-surface text-sm">
        Keymaster — obras ativas
      </h4>
      <p className="mt-2 text-on-surface-variant text-xs">
        Importação independente das fichas de clientes. Seleciona a folha Excel
        «obras_ativas_keymaster_32.xlsx». O sistema liga apenas clientes
        identificados de forma inequívoca e mantém a referência e o estado
        originais. Não cria pagamentos, documentos fiscais, diagnósticos,
        entrega nem históricos inexistentes.
      </p>
      <Input
        accept=".xlsx,.csv"
        className="hidden"
        onChange={onFile}
        ref={fileRef}
        type="file"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={busy}
          loading={busy}
          onClick={() => fileRef.current?.click()}
          size="sm"
          type="button"
          variant="secondary"
        >
          Selecionar lista de obras ativas...
        </Button>
        {decisions.length > 0 && !complete && (
          <Button
            disabled={busy || summary.possible === 0}
            loading={busy}
            onClick={apply}
            size="sm"
            type="button"
          >
            Criar {summary.possible} obras nas reparações
          </Button>
        )}
      </div>
      {fileName && (
        <p className="mt-2 text-on-surface-variant text-xs">{fileName}</p>
      )}
      {error && (
        <p aria-live="polite" className="mt-3 text-error text-sm">
          {error}
        </p>
      )}
      {decisions.length > 0 && (
        <>
          <p aria-live="polite" className="mt-3 text-on-surface text-sm">
            {complete
              ? "Resultado da transferência"
              : "Simulação sem alterações"}
            : {summary.possible} elegíveis, {summary.existing} já existentes,{" "}
            {summary.review} para rever.
          </p>
          <div className="mt-3 max-h-80 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-outline-variant border-b">
                  <th className="py-2 pe-2">Folha</th>
                  <th className="py-2 pe-2">Cliente</th>
                  <th className="py-2 pe-2">Estado OficinaOS</th>
                  <th className="py-2 pe-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((item, index) => (
                  <tr
                    className="border-outline-variant border-b"
                    key={item.reference}
                  >
                    <td className="py-2 pe-2">{item.reference}</td>
                    <td className="py-2 pe-2">
                      {rows[index]?.customer || "Sem cliente"}
                    </td>
                    <td className="py-2 pe-2">{item.status}</td>
                    <td className="py-2 pe-2">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
