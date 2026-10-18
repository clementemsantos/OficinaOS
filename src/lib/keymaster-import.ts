/**
 * Read-only preview of Keymaster spreadsheet exports.
 *
 * No rows are sent to the API and no database records are changed.
 * Keymaster exports have their displayed headers on row 2, except
 * equipment exports whose headers are on row 3.
 */
import { unzipSync } from "fflate";
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

interface KeymasterSheetConfig {
  entity: KeymasterEntity;
  headerRow: number;
  idColumn: number;
  marker: string;
  requiredHeaders: string[];
}

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
  duplicateReferences: number;
  entity: KeymasterEntity;
  fileName: string;
  headerRow: number;
  /** Records that cannot be directly associated with a customer. */
  missingCustomerLinks: number;
  /** Records without a selling price (not treated as a zero price). */
  missingPrices: number;
  missingReferences: number;
  recordCount: number;
  sourceSystem: "KEYMASTER";
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
    throw new Error(
      "Ficheiro não reconhecido como uma das cinco exportações Keymaster."
    );
  }

  const header = rows[config.headerRow - 1] ?? [];
  const headers = new Set(header.map(normalizeHeader));
  if (
    config.requiredHeaders.some(
      (needed) => !headers.has(normalizeHeader(needed))
    )
  ) {
    throw new Error(
      "As colunas deste ficheiro não correspondem ao modelo Keymaster esperado."
    );
  }

  const records = rows
    .slice(config.headerRow)
    .filter((r) => r.some((cell) => String(cell ?? "").trim() !== ""));
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
const XML_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const FIRST_SHEET = "xl/worksheets/sheet1.xml";
const MAX_WORKSHEET_XML_BYTES = 12 * 1024 * 1024;

/**
 * Keymaster exports use ordinary OOXML worksheets with inline strings.
 * Decode the first sheet directly so the 2,634-row customers export doesn't
 * stall in read-excel-file's full workbook/cell processing.
 *
 * This is for read-only preview, NOT the audited importer or any DB write.
 * Do not evaluate formulas or open network resources from the workbook.
 */
export function readKeymasterPreviewXlsx(buffer: ArrayBuffer): unknown[][] {
  // Reject oversized ZIP expansions before decompressing user content.
  const inflated = xlsxUncompressedSize(buffer);
  if (!Number.isFinite(inflated) || inflated > MAX_XLSX_UNCOMPRESSED_BYTES) {
    throw new ImportFileError("data_io.xlsx_too_large");
  }
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new Error("O ficheiro Excel está danificado ou não é um XLSX válido.");
  }
  const sheetBytes = files[FIRST_SHEET];
  if (!sheetBytes) {
    throw new Error("Não foi encontrada a primeira folha do Excel Keymaster.");
  }
  if (sheetBytes.byteLength > MAX_WORKSHEET_XML_BYTES) {
    throw new ImportFileError("data_io.xlsx_too_large");
  }

  const parser = new DOMParser();
  function parseXml(bytes: Uint8Array): Document {
    const document = parser.parseFromString(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      "application/xml"
    );
    if (document.getElementsByTagName("parsererror").length > 0) {
      throw new Error("O Excel tem XML inválido.");
    }
    return document;
  }
  function textNodes(element: Element): string {
    return Array.from(
      element.getElementsByTagNameNS(XML_NS, "t"),
      (node) => node.textContent ?? ""
    ).join("");
  }

  const sharedStrings: string[] = [];
  if (files["xl/sharedStrings.xml"]) {
    const shared = parseXml(files["xl/sharedStrings.xml"]);
    for (const entry of Array.from(
      shared.getElementsByTagNameNS(XML_NS, "si")
    )) {
      sharedStrings.push(textNodes(entry));
    }
  }

  const sheet = parseXml(sheetBytes);
  const out: unknown[][] = [];
  const sheetRows = sheet.getElementsByTagNameNS(XML_NS, "row");
  for (const xmlRow of Array.from(sheetRows)) {
    const rowNumber = Number(xmlRow.getAttribute("r"));
    // Stop crafted files from allocating unbounded sparse rows.
    if (
      !Number.isSafeInteger(rowNumber) ||
      rowNumber < 1 ||
      rowNumber > MAX_IMPORT_ROWS + 3
    ) {
      throw new ImportFileError("data_io.too_many_rows");
    }
    const cells: unknown[] = [];
    for (const cell of Array.from(
      xmlRow.getElementsByTagNameNS(XML_NS, "c")
    )) {
      const cellRef = cell.getAttribute("r") ?? "";
      const letters = /^[A-Z]+/.exec(cellRef)?.[0];
      if (!letters) {
        continue;
      }
      let index = 0;
      for (let i = 0; i < letters.length; i++) {
        index = index * 26 + letters.charCodeAt(i) - 64;
      }
      index--;
      if (index > 127) {
        continue; // Only 31 columns are used in the five Keymaster exports.
      }

      let value = "";
      const type = cell.getAttribute("t");
      if (type === "inlineStr") {
        value = textNodes(cell);
      } else {
        value =
          cell.getElementsByTagNameNS(XML_NS, "v")[0]?.textContent ?? "";
        if (type === "s") {
          value = sharedStrings[Number(value)] ?? "";
        }
      }
      cells[index] = value;
    }
    // Preserve worksheet physical row numbers: headers are on rows 2 or 3.
    out[rowNumber - 1] = cells;
  }
  for (let i = 0; i < out.length; i++) {
    out[i] ??= [];
  }
  return out;
}

/** Browser-only preview: neither customer data nor XLSX is uploaded. */
export async function previewKeymasterFile(
  file: File
): Promise<KeymasterPreview> {
  if (!XLSX.test(file.name)) {
    throw new Error("As exportações Keymaster devem estar em formato .xlsx.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportFileError("data_io.file_too_large");
  }
  const rows = readKeymasterPreviewXlsx(await file.arrayBuffer());
  return inspectKeymasterRows(rows, file.name);
}
