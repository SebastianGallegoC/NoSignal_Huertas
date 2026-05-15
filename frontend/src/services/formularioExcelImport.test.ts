import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  MATRIZ_F_PSA_HEADERS,
  MATRIZ_SHEET_NAME,
} from "@/services/matrizCaracterizacionExport";

import { GPS_PLACEHOLDER_WHEN_NOT_CAPTURED } from "@/constants/gpsConfig";

import {
  analyzeImportRow,
  buildOfflineFormFromImportCells,
  cellsToFormValuesRaw,
  formValuesToCells,
  normalizeSiNoImportValue,
  normalizeTriImportValue,
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

describe("normalizeTriImportValue", () => {
  it.each([
    ["SI", "Si"],
    ["  sí  ", "Si"],
    ["SÍ", "Si"],
    ["no", "No"],
    ["NO", "No"],
    ["NO APLICA", "No"],
    ["  no aplica  ", "No"],
    ["No Aplica.", "No"],
    ["Nr", "NR"],
    ["n.r.", "NR"],
    ["", ""],
    ["   ", ""],
  ])("%s → %s", (input, expected) => {
    expect(normalizeTriImportValue(input)).toBe(expected);
  });

  it("deja valores no reconocidos para que falle la validación", () => {
    expect(normalizeTriImportValue("quizás")).toBe("quizás");
    expect(normalizeTriImportValue("N/A")).toBe("N/A");
  });
});

describe("normalizeSiNoImportValue (área árbol / solo Si–No)", () => {
  it.each([
    ["SI", "Si"],
    ["sí", "Si"],
    ["NO", "No"],
    ["no aplica", "No"],
    ["NR", "NR"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeSiNoImportValue(input)).toBe(expected);
  });

  it("NR no se reinterpreta: queda para error de validación Si/No", () => {
    expect(normalizeSiNoImportValue("nr")).toBe("nr");
  });
});

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
    expect(ok[0].datos_formulario.longitud).toBe("-74.081750");
    expect(ok[0].datos_formulario.latitud).toBe("4.609710");
    expect(ok[0].datos_formulario.nombres_apellidos_beneficiario).toBe(
      "María Pérez",
    );
    expect(ok[0].modo_coordenadas).toBe("manual");
    expect(ok[0].id_formulario).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("no reutiliza el UUID de la columna A: siempre crea id_formulario nuevo", async () => {
    const excelId = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";
    const row = new Array<string | number | null>(76).fill(null);
    row[0] = excelId;
    row[7] = "Copia";
    row[29] = "-74.0";
    row[33] = "4.0";
    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer, "u");

    expect(errors).toHaveLength(0);
    expect(ok).toHaveLength(1);
    expect(ok[0].id_formulario).not.toBe(excelId);
    expect(ok[0].id_formulario).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("importa fila solo con beneficiario usando GPS placeholder si faltan coordenadas", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Sin GPS en Excel";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer, "demo_user");

    expect(errors).toHaveLength(0);
    expect(ok).toHaveLength(1);
    expect(ok[0].gps).toEqual({ ...GPS_PLACEHOLDER_WHEN_NOT_CAPTURED });
    expect(ok[0].datos_formulario.nombres_apellidos_beneficiario).toBe(
      "Sin GPS en Excel",
    );
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

  it("acepta SI/NO/NR en Excel con distinta capitalización y tildes (mujer_cabeza_hogar)", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Benef tri";
    row[37] = "  SÍ  ";
    row[29] = "-74.0";
    row[33] = "4.0";
    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer, "u");
    expect(errors).toHaveLength(0);
    expect(ok[0].datos_formulario.mujer_cabeza_hogar).toBe("Si");
  });

  it("analyzeImportRow normaliza tri en displayValues", () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Ana";
    row[37] = "no";
    row[29] = "-74.0";
    row[33] = "4.0";
    const cells = row.map((v) => (v == null ? "" : String(v)));
    const preview = analyzeImportRow(cells, 8, "u1", new Date().toISOString());
    expect(preview.isValid).toBe(true);
    expect(preview.displayValues.mujer_cabeza_hogar).toBe("No");
  });

  it("importa area_arbol_disponible como Si/No con flexibilidad (columna Excel ~49)", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Con árbol";
    row[48] = "  NO APLICA  ";
    row[29] = "-74.0";
    row[33] = "4.0";
    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer, "u");
    expect(errors).toHaveLength(0);
    expect(ok[0].datos_formulario.area_arbol_disponible).toBe("No");
  });

  it("normaliza teléfono «no tiene» al importar (columna ~13)", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Benef";
    row[12] = "  sin teléfono  ";
    row[29] = "-74.0";
    row[33] = "4.0";
    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer, "u");
    expect(errors).toHaveLength(0);
    expect(ok[0].datos_formulario.telefono).toBe("No tiene");
  });

  it("importa GMS con símbolos ° ′ ″ y deriva GPS si LONGITUD/LATITUD vacías", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Con GMS en Excel";
    row[26] = "73°";
    row[27] = "17'";
    row[28] = `47''`;
    row[30] = "8°";
    row[31] = "19'";
    row[32] = `11''`;

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer, "u");

    expect(errors).toHaveLength(0);
    expect(ok).toHaveLength(1);
    expect(ok[0].datos_formulario.x_grados).toBe("73");
    expect(ok[0].datos_formulario.x_minutos).toBe("17");
    expect(ok[0].datos_formulario.x_segundos).toBe("47");
    expect(ok[0].datos_formulario.y_grados).toBe("8");
    expect(ok[0].datos_formulario.y_minutos).toBe("19");
    expect(ok[0].datos_formulario.y_segundos).toBe("11");

    const lonMag = 73 + 17 / 60 + 47 / 3600;
    const latDec = 8 + 19 / 60 + 11 / 3600;
    expect(ok[0].gps.longitud).toBeCloseTo(-lonMag, 5);
    expect(ok[0].gps.latitud).toBeCloseTo(latDec, 5);
    expect(Number(ok[0].datos_formulario.longitud)).toBeCloseTo(-lonMag, 5);
    expect(Number(ok[0].datos_formulario.latitud)).toBeCloseTo(latDec, 5);
  });

  it("previewPlantillaWorkbook acepta fila GMS con símbolos (vista previa válida)", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Luis GMS";
    row[26] = "73°";
    row[27] = "17'";
    row[28] = `47''`;
    row[30] = "8°";
    row[31] = "19'";
    row[32] = `11''`;

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { rows, errors } = await previewPlantillaWorkbook(buffer, "u");

    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].isValid).toBe(true);
    expect(rows[0].displayValues.x_grados).toBe("73");
    expect(rows[0].displayValues.y_segundos).toBe("11");
  });

  it("LONGITUD/LATITUD con sufijo ° siguen siendo válidas", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Dec con símbolo";
    row[26] = "73°";
    row[29] = "-74,1°";
    row[33] = "4,05″";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer, "u");

    expect(errors).toHaveLength(0);
    expect(ok[0].gps.longitud).toBeCloseTo(-74.1, 5);
    expect(ok[0].gps.latitud).toBeCloseTo(4.05, 5);
    expect(ok[0].datos_formulario.longitud).toBe("-74.100000");
    expect(ok[0].datos_formulario.latitud).toBe("4.050000");
  });

  it("LATITUD/LONGITUD con prefijo ° o guion Unicode se importan bien", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Coord raras";
    row[29] = "\u221274,08175°";
    row[33] = "°4,60971";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer, "u");

    expect(errors).toHaveLength(0);
    expect(ok[0].gps.longitud).toBeCloseTo(-74.08175, 5);
    expect(ok[0].gps.latitud).toBeCloseTo(4.60971, 5);
    expect(Number(ok[0].datos_formulario.longitud)).toBeCloseTo(-74.08175, 5);
    expect(Number(ok[0].datos_formulario.latitud)).toBeCloseTo(4.60971, 5);
  });

  it("LONGITUD decimal y solo GMS en Y: completa latitud en vista previa y al confirmar celdas", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Mix coords";
    row[29] = "-74.08175";
    row[30] = "8";
    row[31] = "19";
    row[32] = "11";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { rows, errors } = await previewPlantillaWorkbook(buffer, "u");

    expect(errors).toHaveLength(0);
    expect(rows[0].isValid).toBe(true);
    expect(rows[0].displayValues.latitud).toBe(
      (8 + 19 / 60 + 11 / 3600).toFixed(6),
    );

    const cells = formValuesToCells(rows[0].displayValues, rows[0].idRaw);
    const { form, error } = buildOfflineFormFromImportCells(cells, "u");
    expect(error).toBeUndefined();
    expect(form?.gps.latitud).toBeCloseTo(8 + 19 / 60 + 11 / 3600, 5);
    expect(Number(form?.datos_formulario.latitud)).toBeCloseTo(
      8 + 19 / 60 + 11 / 3600,
      5,
    );
  });

  it("LATITUD decimal y solo GMS en X: completa longitud en vista previa", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Mix coords 2";
    row[26] = "73";
    row[27] = "17";
    row[28] = "47";
    row[33] = "4.60971";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { rows, errors } = await previewPlantillaWorkbook(buffer, "u");

    expect(errors).toHaveLength(0);
    expect(rows[0].isValid).toBe(true);
    const lonMag = 73 + 17 / 60 + 47 / 3600;
    expect(rows[0].displayValues.longitud).toBe((-lonMag).toFixed(6));
  });

  it("LONGITUD vacía y x_* en 0: no inventa longitud; conserva latitud decimal", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Sin lon inventada";
    row[26] = 0;
    row[27] = 0;
    row[28] = 0;
    row[33] = "4.60971";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { rows, errors } = await previewPlantillaWorkbook(buffer, "u");
    const { ok, errors: parseErrors } = await parsePlantillaWorkbook(buffer, "u");

    expect(errors).toHaveLength(0);
    expect(parseErrors).toHaveLength(0);
    expect(rows[0].isValid).toBe(true);
    expect(rows[0].displayValues.longitud).toBe("");
    expect(rows[0].displayValues.latitud).toBe("4.609710");

    expect(ok).toHaveLength(1);
    expect(ok[0].gps).toEqual(GPS_PLACEHOLDER_WHEN_NOT_CAPTURED);
    expect(ok[0].datos_formulario.longitud).toBeUndefined();
    expect(Number(ok[0].datos_formulario.latitud)).toBeCloseTo(4.60971, 5);
  });

  it("LONGITUD vacía y x_* como texto 0: no inventa longitud", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Cerosen texto";
    row[26] = "0";
    row[27] = "0";
    row[28] = "0";
    row[33] = "4.0";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer, "u");

    expect(errors).toHaveLength(0);
    expect(ok[0].datos_formulario.longitud).toBeUndefined();
    expect(ok[0].gps).toEqual(GPS_PLACEHOLDER_WHEN_NOT_CAPTURED);
  });

  it("normaliza «Distancia Infraestructura Adecuada» con sufijo M/m en Excel (columna ~51)", async () => {
    const row = new Array<string | number | null>(76).fill(null);
    row[7] = "Benef distancia";
    row[29] = "-74.0";
    row[33] = "4.0";
    row[50] = "  40 M  ";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer, "u");

    expect(errors).toHaveLength(0);
    expect(ok[0].datos_formulario.distancia_infraestructura_adecuada).toBe("40");
  });
});
