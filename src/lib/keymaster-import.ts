/**
 * Read-only preview of Keymaster spreadsheet exports.
 *
 * No rows are sent to the API and no database records are changed.
 * Keymaster exports have their displayed headers on row 2, except
 * equipment exports whose headers are on row 3.
 */
import {
  ImportFileError,
  MAX_FILE_BYTES,
  MAX_IMPORT_ROWS,
  MAX_XLSX_UNCOMPRESSED_BYTES,
  xlsxUncompressedSize,
} from "@/lib/import-table";

export type KeymasterEntity =
  | "customers"
  | "equipment"
  | "suppliers"
  | "services"
  | "stock";

type KeymasterSheetConfig = {
  entity: KeymasterEntity;
  marker: string;
  headerRow: number;
  idColumn: number;
  requiredHeaders: string[];
};

const CONFIGS: KeymasterSheetConfig[] = [
  {
    entity: "customers",
    marker: "CLIENTS",
    headerRow: 2,
    idColumn: 1,
    requiredHeaders: ["ID KEYMASTER", "NOME", "TELEFONE 1"],
  },
  {
    entity: "equipment",
    marker: "ITEMS",
    headerRow: 3,
    idColumn: 1,
    requiredHeaders: ["ID", "TIPO DE EQUIPAMENTO", "MARCA", "MODELO"],
  },
  {
    entity: "suppliers",
    marker: "SUPPLIERS",
    headerRow: 2,
    idColumn: 1,
    requiredHeaders: ["ID", "NOME", "NIF"],
  },
  {
    entity: "services",
    marker: "SERVICES",
    headerRow: 2,
    idColumn: 4,
    requiredHeaders: ["DESCRIÇÃO", "REF.", "PVP UNITÁRIO"],
  },
  {
    entity: "stock",
    marker: "PRODUCTS",
    headerRow: 2,
    idColumn: 4,
    requiredHeaders: ["DESCRIÇÃO DA PEÇA", "REF.", "QTD.", "CUSTO"],
  },
];

export interface KeymasterPreview {
  sourceSystem: "KEYMASTER";
  entity: KeymasterEntity;
  fileName: string;
  headerRow: number;
  recordCount: number;
  missingReferences: number;
  duplicateReferences: number;
  /** Records that cannot be directly associated with a customer. */
  missingCustomerLinks: number;
  /** Records without a selling price (not treated as a zero price). */
  missingPrices: number;
}

const NON_ALNUM = /[^A-Z0-9]/g;
function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(NON_ALNUM, "");
}
function valueAt(row: unknown[], index: number): string {
  return String(row[index] ?? "").trim();
}

/** Pure mapping/validation: accepts the first worksheet as exported by Keymaster. */
export function inspectKeymasterRows(
  input: unknown[][],
  fileName: string
): KeymasterPreview {
  const rows = input.map((row) => row ?? []);
  const marker = valueAt(rows[0] ?? [], 30).toUpperCase();
  const config = CONFIGS.find((c) => c.marker === marker);
  if (!config) {
    throw new Error("Ficheiro não reconhecido como uma das cinco exportações Keymaster.");
  }

  const header = rows[config.headerRow - 1] ?? [];
  const headers = new Set(header.map(normalizeHeader));
  if (
    config.requiredHeaders.some(
      (needed) => !headers.has(normalizeHeader(needed))
    )
  ) {
    throw new Error("As colunas deste ficheiro não correspondem ao modelo Keymaster esperado.");
  }

  const records = rows.slice(config.headerRow).filter((r) =>
    r.some((cell) => valueAt(r, r.indexOf(cell)) !== "")
  );
  if (records.length > MAX_IMPORT_ROWS) {
    throw new ImportFileError("data_io.too_many_rows");
  }

  const ids = new Set<string>();
  let missingReferences = 0;
  let duplicateReferences = 0;
  let missingCustomerLinks = 0;
  let missingPrices = 0;
  for (const row of records) {
    const sourceId = valueAt(row, config.idColumn);
    if (!sourceId) {
      missingReferences++;
    } else if (ids.has(sourceId)) {
      duplicateReferences++;
    } else {
      ids.add(sourceId);
    }
    // Equipment exports supplied by Keymaster can have no customer foreign key.
    if (config.entity === "equipment" && !valueAt(row, 2)) {
      missingCustomerLinks++;
    }
    // Services export "PVP UNITÁRIO" in column G (index 6).
    if (config.entity === "services" && !valueAt(row, 6)) {
      missingPrices++;
    }
  }
  return {
    sourceSystem: "KEYMASTER",
    entity: config.entity,
    fileName,
    headerRow: config.headerRow,
    recordCount: records.length,
    missingReferences,
    duplicateReferences,
    missingCustomerLinks,
    missingPrices,
  };
}

const XLSX = /\.xlsx$/i;

/** Browser-only preview — never uploads customers or suppliers to a server. */
export async function previewKeymasterFile(file: File): Promise<KeymasterPreview> {
  if (!XLSX.test(file.name)) {
    throw new Error("As exportações Keymaster devem estar em formato .xlsx.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportFileError("data_io.file_too_large");
  }
  const buffer = await file.arrayBuffer();
  if (xlsxUncompressedSize(buffer) > MAX_XLSX_UNCOMPRESSED_BYTES) {
    throw new ImportFileError("data_io.xlsx_too_large");
  }
  const { default: readXlsxFile } = await import("read-excel-file/browser");
  const worksheets = await readXlsxFile(file);
  const rows = (worksheets[0]?.data ?? []) as unknown[][];
  return inspectKeymasterRows(rows, file.name);
}
