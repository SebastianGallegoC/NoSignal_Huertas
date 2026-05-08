import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  MATRIZ_F_PSA_HEADERS,
  MATRIZ_SHEET_NAME,
} from "@/services/matrizCaracterizacionExport";

import {
  analyzeImportRow,
  cellsToFormValuesRaw,
  formValuesToCells,
  parseFechaCellForDatos,
  parsePlantillaWorkbook,
  previewPlantillaWorkbook,
} from "./formularioExcelImport";

async function buildMinimalPlantillaBuffer(
  row8Values: (string | number | null)[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(MATRIZ_SHEET_NAME);
  MATRIZ_F_PSA_HEADERS.forEach((h, i) => {
    ws.getCell(7, i + 1).value = h;
  });
  for (let c = 0; c < 76; c++) {
    const v = row8Values[c];
    if (v != null && v !== "") {
      ws.getCell(8, c + 1).value = v;
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  const u8 = new Uint8Array(buf as ArrayBuffer);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

describe("parseFechaCellForDatos", () => {
  it("convierte DD/MM/AAAA a YYYY-MM-DD", () => {
    expect(parseFechaCellForDatos("15/03/2026")).toBe("2026-03-15");
  });

  it("deja prefijo ISO", () => {
    expect(parseFechaCellForDatos("2026-05-01T12:00:00Z")).toBe("2026-05-01");
  });
});

describe("formValuesToCells", () => {
  it("revierte cellsToFormValuesRaw usando el ID de la columna A", () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[0] = "";
    row[4] = "01/01/2026";
    row[7] = "Benef";
    row[29] = "-74.1";
    row[33] = "4.1";
    const cells = row.map((v) => (v == null ? "" : String(v)));
    const values = cellsToFormValuesRaw(cells);
    const back = formValuesToCells(values, cells[0] ?? "");
    expect(back).toEqual(cells);
  });
});

describe("parsePlantillaWorkbook", () => {
  it("importa una fila con LONGITUD/LATITUD y genera OfflineForm", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "María Pérez";
    row[29] = "-74.08175";
    row[33] = "4.60971";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer, "demo_user");

    expect(errors).toHaveLength(0);
    expect(ok).toHaveLength(1);
    expect(ok[0].id_usuario).toBe("demo_user");
    expect(ok[0].fotos).toEqual([]);
    expect(ok[0].gps).toEqual({
      latitud: 4.60971,
      longitud: -74.08175,
      precision: 5,
    });
    expect(ok[0].datos_formulario.nombres_apellidos_beneficiario).toBe(
      "María Pérez",
    );
    expect(ok[0].modo_coordenadas).toBe("manual");
    expect(ok[0].id_formulario).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("rechaza fila sin coordenadas", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Sin GPS";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer, "demo_user");

    expect(ok).toHaveLength(0);
    expect(errors.some((e) => e.row === 8)).toBe(true);
    expect(errors[0].message).toMatch(/LONGITUD|LATITUD/i);
  });

  it("importa aunque los textos de la fila 7 no coincidan con la plantilla oficial", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(MATRIZ_SHEET_NAME);
    ws.getCell(7, 1).value = "Encabezado arbitrario";
    ws.getCell(7, 2).value = "Otro título";

    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "María Pérez";
    row[29] = "-74.08175";
    row[33] = "4.60971";
    for (let c = 0; c < 76; c++) {
      const v = row[c];
      if (v != null && v !== "") {
        ws.getCell(8, c + 1).value = v;
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    const u8 = new Uint8Array(buf as ArrayBuffer);
    const buffer = u8.buffer.slice(
      u8.byteOffset,
      u8.byteOffset + u8.byteLength,
    );

    const { ok, errors } = await parsePlantillaWorkbook(buffer, "u");
    expect(errors).toHaveLength(0);
    expect(ok).toHaveLength(1);
    expect(ok[0].datos_formulario.nombres_apellidos_beneficiario).toBe(
      "María Pérez",
    );
  });

  it("rechaza id_usuario vacío", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[29] = "-74";
    row[33] = "4";
    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer, "  ");
    expect(ok).toHaveLength(0);
    expect(errors[0].row).toBe(0);
  });

  it("analyzeImportRow marca fecha inválida y coordenadas válidas", () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[4] = "no-es-una-fecha";
    row[7] = "Ana";
    row[29] = "-74.0";
    row[33] = "4.0";
    const cells = row.map((v) => (v == null ? "" : String(v)));
    const preview = analyzeImportRow(cells, 8, "u1", new Date().toISOString());
    expect(preview.isValid).toBe(false);
    expect(preview.fieldErrors.fecha_inicio).toBeDefined();
  });

  it("previewPlantillaWorkbook devuelve una fila por datos", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Luis";
    row[29] = "-74.05";
    row[33] = "4.05";
    const buffer = await buildMinimalPlantillaBuffer(row);
    const { rows, errors } = await previewPlantillaWorkbook(buffer, "u2");
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].sheetRow).toBe(8);
    expect(rows[0].isValid).toBe(true);
  });
});
