import { describe, expect, it } from "vitest";
import { inspectKeymasterRows } from "../keymaster-import";

function cells(data: Record<number, unknown>): unknown[] {
  const out: unknown[] = Array.from({ length: 31 }, () => null);
  for (const [key, value] of Object.entries(data)) {
    out[Number(key)] = value;
  }
  return out;
}

function sheet(
  marker: string,
  headerRow: number,
  headers: Record<number, string>,
  data: Record<number, unknown>[]
): unknown[][] {
  const rows: unknown[][] = [cells({ 30: marker })];
  if (headerRow === 3) {
    rows.push(cells({}));
  }
  rows.push(cells(headers));
  rows.push(...data.map(cells));
  return rows;
}

describe("Keymaster export preview", () => {
  it("reads customer IDs from row 2 without merging matching phones", () => {
    const rows = sheet(
      "CLIENTS",
      2,
      { 1: "ID KEYMASTER", 3: "NOME", 12: "TELEFONE 1" },
      [
        { 1: "100", 3: "Cliente A", 12: "900000000" },
        { 1: "101", 3: "Cliente B", 12: "900000000" },
      ]
    );
    expect(inspectKeymasterRows(rows, "clientes.xlsx")).toMatchObject({
      sourceSystem: "KEYMASTER",
      entity: "customers",
      headerRow: 2,
      recordCount: 2,
      missingReferences: 0,
      duplicateReferences: 0,
    });
  });

  it("reads equipment from row 3 and detects missing customer links", () => {
    const rows = sheet(
      "ITEMS",
      3,
      { 1: "ID", 4: "TIPO DE EQUIPAMENTO", 5: "MARCA", 6: "MODELO" },
      [{ 1: "550029", 4: "Smartphone", 5: "Xiaomi", 6: "M1903C3EG" }]
    );
    expect(inspectKeymasterRows(rows, "equipamento.xlsx")).toMatchObject({
      entity: "equipment",
      recordCount: 1,
      missingCustomerLinks: 1,
    });
  });

  it("reads the supplier sheet", () => {
    const rows = sheet("SUPPLIERS", 2, { 1: "ID", 3: "NOME", 10: "NIF" }, [
      { 1: "8", 3: "Fornecedor", 10: "000000000" },
    ]);
    expect(inspectKeymasterRows(rows, "fornecedores.xlsx").entity).toBe(
      "suppliers"
    );
  });

  it("warns when a service has no unit price", () => {
    const rows = sheet(
      "SERVICES",
      2,
      { 2: "DESCRIÇÃO", 4: "REF.", 6: "PVP UNITÁRIO" },
      [{ 2: "Serviço", 4: "SVC1" }]
    );
    expect(inspectKeymasterRows(rows, "servicos.xlsx")).toMatchObject({
      entity: "services",
      recordCount: 1,
      missingPrices: 1,
    });
  });

  it("recognises the stock export", () => {
    const rows = sheet(
      "PRODUCTS",
      2,
      { 3: "DESCRIÇÃO DA PEÇA", 4: "REF.", 6: "CUSTO", 7: "QTD." },
      [{ 3: "Peça", 4: "PRT1", 6: 2.5, 7: 1 }]
    );
    expect(inspectKeymasterRows(rows, "stock.xlsx").entity).toBe("stock");
  });

  it("detects repeated and missing IDs", () => {
    const rows = sheet(
      "CLIENTS",
      2,
      { 1: "ID KEYMASTER", 3: "NOME", 12: "TELEFONE 1" },
      [
        { 1: "100", 3: "Cliente A" },
        { 1: "100", 3: "Cliente B" },
        { 3: "Cliente C" },
      ]
    );
    expect(inspectKeymasterRows(rows, "clientes.xlsx")).toMatchObject({
      duplicateReferences: 1,
      missingReferences: 1,
    });
  });

  it("rejects unknown exports", () => {
    expect(() => inspectKeymasterRows([["NOME"]], "x.xlsx")).toThrow(
      "Keymaster"
    );
  });
});
