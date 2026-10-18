import { describe, expect, it } from "vitest";
import { inspectKeymasterRows } from "../keymaster-import";

function sheet(
  marker: string,
  headerRow: number,
  headers: Record<number, string>,
  data: unknown[][]
) {
  const rows: unknown[][] = Array.from(
    { length: headerRow },
    () => Array.from({ length: 31 }, () => null)
  );
  rows[0]![30] = marker;
  for (const [index, title] of Object.entries(headers)) {
    rows[headerRow - 1]![Number(index)] = title;
  }
  return [...rows, ...data];
}

describe("Keymaster export preview", () => {
  it("reads clients from row 2 and retains distinct source references", () => {
    const rows = sheet(
      "CLIENTS",
      2,
      { 1: "ID KEYMASTER", 3: "NOME", 12: "TELEFONE 1" },
      [
        ["inove", "100", null, "Primeiro cliente", null, null, null, null, null, null, null, null, "900000000"],
        ["inove", "101", null, "Segundo cliente", null, null, null, null, null, null, null, null, "900000000"],
      ]
    );
    const out = inspectKeymasterRows(rows, "clientes.xlsx");
    expect(out).toMatchObject({
      sourceSystem: "KEYMASTER",
      entity: "customers",
      headerRow: 2,
      recordCount: 2,
      missingReferences: 0,
      duplicateReferences: 0,
    });
  });

  it("reads equipment from row 3 and warns when customer linkage is absent", () => {
    const rows = sheet(
      "ITEMS",
      3,
      { 1: "ID", 4: "TIPO DE EQUIPAMENTO", 5: "MARCA", 6: "MODELO" },
      [["inove", "550029", "", "", "Smartphone", "Xiaomi", "M1903C3EG"]]
    );
    expect(inspectKeymasterRows(rows, "equipamento.xlsx")).toMatchObject({
      entity: "equipment",
      recordCount: 1,
      missingCustomerLinks: 1,
    });
  });

  it.each([
    ["SUPPLIERS", "suppliers", { 1: "ID", 3: "NOME", 10: "NIF" }, ["inove", "8", "", "Fornecedor"]],
    ["SERVICES", "services", { 2: "DESCRIÇÃO", 4: "REF.", 6: "PVP UNITÁRIO" }, ["inove", "", "Serviço", "", "SVC1"]],
    ["PRODUCTS", "stock", { 3: "DESCRIÇÃO DA PEÇA", 4: "REF.", 6: "CUSTO", 7: "QTD." }, ["inove", "", "", "Peça", "PRT1", "", 2.5, 1]],
  ] as const)("accepts %s", (marker, entity, headers, record) => {
    const result = inspectKeymasterRows(
      sheet(marker, 2, headers, [record]),
      "dados.xlsx"
    );
    expect(result.entity).toBe(entity);
    expect(result.recordCount).toBe(1);
    expect(result.missingReferences).toBe(0);
    if (entity === "services") {
      expect(result.missingPrices).toBe(1);
    }
  });

  it("warns about repeated source IDs without attempting to merge customers", () => {
    const headers = { 1: "ID KEYMASTER", 3: "NOME", 12: "TELEFONE 1" };
    const data = [
      ["inove", "100", "", "Cliente A"],
      ["inove", "100", "", "Cliente B"],
      ["inove", "", "", "Cliente C"],
    ];
    const result = inspectKeymasterRows(
      sheet("CLIENTS", 2, headers, data),
      "dados.xlsx"
    );
    expect(result.duplicateReferences).toBe(1);
    expect(result.missingReferences).toBe(1);
  });

  it("refuses an unexpected spreadsheet rather than importing as Keymaster", () => {
    expect(() => inspectKeymasterRows([["NOME"], ["Alice"]], "x.xlsx")).toThrow(
      "Keymaster"
    );
  });
});
