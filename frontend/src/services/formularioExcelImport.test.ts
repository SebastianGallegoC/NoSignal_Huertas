import { Workbook } from "exceljs";
import { describe, expect, it, vi } from "vitest";

import {
  MATRIZ_COLUMN_COUNT,
  MATRIZ_F_PSA_HEADERS,
  MATRIZ_SHEET_NAME,
} from "@/services/matrizCaracterizacionExport";

import {
  GPS_PLACEHOLDER_WHEN_NOT_CAPTURED,
  MIN_GPS_PRECISION_METERS,
} from "@/constants/gpsConfig";

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
  const wb = new Workbook();
  const ws = wb.addWorksheet(MATRIZ_SHEET_NAME);
  MATRIZ_F_PSA_HEADERS.forEach((h, i) => {
    ws.getCell(7, i + 1).value = h;
  });
  for (let c = 0; c < MATRIZ_COLUMN_COUNT; c++) {
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
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[0] = "";
    row[4] = "01/01/2026";
    row[7] = "Benef";
    row[27] = "-74.1";
    row[26] = "4.1";
    const cells = row.map((v) => (v == null ? "" : String(v)));
    const values = cellsToFormValuesRaw(cells);
    const back = formValuesToCells(values, cells[0] ?? "");
    expect(back).toEqual(cells);
  });
});

describe("parsePlantillaWorkbook", () => {
  it("importa una fila con LONGITUD/LATITUD y genera OfflineForm", async () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[7] = "María Pérez";
    row[27] = "-74.08175";
    row[26] = "4.60971";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer);

    expect(errors).toHaveLength(0);
    expect(ok).toHaveLength(1);
    expect(ok[0].fotos).toEqual([]);
    expect(ok[0].gps).toEqual({
      latitud: 4.60971,
      longitud: -74.08175,
      precision: MIN_GPS_PRECISION_METERS,
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
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[0] = excelId;
    row[7] = "Copia";
    row[27] = "-74.0";
    row[26] = "4.0";
    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer);

    expect(errors).toHaveLength(0);
    expect(ok).toHaveLength(1);
    expect(ok[0].id_formulario).not.toBe(excelId);
    expect(ok[0].id_formulario).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("importa fila solo con beneficiario usando GPS placeholder si faltan coordenadas", async () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[7] = "Sin GPS en Excel";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer);

    expect(errors).toHaveLength(0);
    expect(ok).toHaveLength(1);
    expect(ok[0].gps).toEqual({ ...GPS_PLACEHOLDER_WHEN_NOT_CAPTURED });
    expect(ok[0].datos_formulario.nombres_apellidos_beneficiario).toBe(
      "Sin GPS en Excel",
    );
  });

  it("analyzeImportRow marca fecha inválida y coordenadas válidas", () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[4] = "no-es-una-fecha";
    row[7] = "Ana";
    row[27] = "-74.0";
    row[26] = "4.0";
    const cells = row.map((v) => (v == null ? "" : String(v)));
    const preview = analyzeImportRow(cells, 8, new Date().toISOString());
    expect(preview.isValid).toBe(false);
    expect(preview.fieldErrors.fecha_inicio).toBeDefined();
  });

  it("previewPlantillaWorkbook devuelve una fila por datos", async () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[7] = "Luis";
    row[27] = "-74.05";
    row[26] = "4.05";
    const buffer = await buildMinimalPlantillaBuffer(row);
    const { rows, errors } = await previewPlantillaWorkbook(buffer);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].sheetRow).toBe(8);
    expect(rows[0].isValid).toBe(true);
  });

  it("acepta SI/NO/NR en Excel con distinta capitalización y tildes (mujer_cabeza_hogar)", async () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[7] = "Benef tri";
    row[32] = "  SÍ  ";
    row[27] = "-74.0";
    row[26] = "4.0";
    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer);
    expect(errors).toHaveLength(0);
    expect(ok[0].datos_formulario.mujer_cabeza_hogar).toBe("Si");
  });

  it("analyzeImportRow normaliza tri en displayValues", () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[7] = "Ana";
    row[32] = "no";
    row[27] = "-74.0";
    row[26] = "4.0";
    const cells = row.map((v) => (v == null ? "" : String(v)));
    const preview = analyzeImportRow(cells, 8, new Date().toISOString());
    expect(preview.isValid).toBe(true);
    expect(preview.displayValues.mujer_cabeza_hogar).toBe("No");
  });

  it("importa area_arbol_disponible como Si/No con flexibilidad (columna Excel ~49)", async () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[7] = "Con árbol";
    row[43] = "  NO APLICA  ";
    row[27] = "-74.0";
    row[26] = "4.0";
    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer);
    expect(errors).toHaveLength(0);
    expect(ok[0].datos_formulario.area_arbol_disponible).toBe("No");
  });

  it("normaliza teléfono «no tiene» al importar (columna ~13)", async () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[7] = "Benef";
    row[12] = "  sin teléfono  ";
    row[27] = "-74.0";
    row[26] = "4.0";
    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer);
    expect(errors).toHaveLength(0);
    expect(ok[0].datos_formulario.telefono).toBe("No tiene");
  });

  it("importa LATITUD, LONGITUD y metros sobre el nivel del mar", async () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[7] = "Con coords DD";
    row[26] = "4.60971";
    row[27] = "-74.08175";
    row[28] = "2650";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer);

    expect(errors).toHaveLength(0);
    expect(ok).toHaveLength(1);
    expect(ok[0].datos_formulario.metros_sobre_nivel_mar).toBe("2650");
    expect(ok[0].gps.latitud).toBeCloseTo(4.60971, 5);
    expect(ok[0].gps.longitud).toBeCloseTo(-74.08175, 5);
  });

  it("LONGITUD/LATITUD con sufijo ° siguen siendo válidas", async () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[7] = "Dec con símbolo";
    row[27] = "-74,1°";
    row[26] = "4,05″";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer);

    expect(errors).toHaveLength(0);
    expect(ok[0].gps.longitud).toBeCloseTo(-74.1, 5);
    expect(ok[0].gps.latitud).toBeCloseTo(4.05, 5);
    expect(ok[0].datos_formulario.longitud).toBe("-74.100000");
    expect(ok[0].datos_formulario.latitud).toBe("4.050000");
  });

  it("LATITUD/LONGITUD con prefijo ° o guion Unicode se importan bien", async () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[7] = "Coord raras";
    row[27] = "\u221274,08175°";
    row[26] = "°4,60971";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer);

    expect(errors).toHaveLength(0);
    expect(ok[0].gps.longitud).toBeCloseTo(-74.08175, 5);
    expect(ok[0].gps.latitud).toBeCloseTo(4.60971, 5);
    expect(Number(ok[0].datos_formulario.longitud)).toBeCloseTo(-74.08175, 5);
    expect(Number(ok[0].datos_formulario.latitud)).toBeCloseTo(4.60971, 5);
  });

  it("LONGITUD sin LATITUD: GPS placeholder y solo longitud en datos", async () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[7] = "Solo lon";
    row[27] = "-74.08175";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { rows, errors } = await previewPlantillaWorkbook(buffer);

    expect(errors).toHaveLength(0);
    expect(rows[0].isValid).toBe(true);
    expect(rows[0].displayValues.longitud).toBe("-74.081750");
    expect(rows[0].displayValues.latitud).toBe("");

    const cells = formValuesToCells(rows[0].displayValues, rows[0].idRaw);
    const { form, error } = buildOfflineFormFromImportCells(cells);
    expect(error).toBeUndefined();
    expect(form?.gps).toEqual(GPS_PLACEHOLDER_WHEN_NOT_CAPTURED);
    expect(form?.datos_formulario.longitud).toBe("-74.081750");
    expect(form?.datos_formulario.latitud).toBeUndefined();
  });

  it("LATITUD sin LONGITUD: no completa longitud automáticamente", async () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[7] = "Solo lat";
    row[26] = "4.60971";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { rows, errors } = await previewPlantillaWorkbook(buffer);

    expect(errors).toHaveLength(0);
    expect(rows[0].isValid).toBe(true);
    expect(rows[0].displayValues.longitud).toBe("");
    expect(rows[0].displayValues.latitud).toBe("4.609710");
  });

  it("importa Excel exportado por la app (roundtrip matriz → import)", async () => {
    const { buildMatrizCaracterizacionWorkbook } = await import(
      "./matrizCaracterizacionExport"
    );
    const f = {
      id_formulario: "00000000-0000-4000-8000-000000000099",
      modo_coordenadas: "manual" as const,
      fecha_hora: new Date().toISOString(),
      fecha_actualizacion: new Date().toISOString(),
      gps: { latitud: 4.6, longitud: -74.1, precision: 4 },
      datos_formulario: {
        entidad_aportante: "CENS",
        nombres_apellidos_beneficiario: "Roundtrip Test",
        latitud: "4.6",
        longitud: "-74.1",
        metros_sobre_nivel_mar: "2500",
      },
      fotos: [],
      estado_sincronizacion: "PENDIENTE" as const,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) }),
    );
    const wb = await buildMatrizCaracterizacionWorkbook(f);
    const buf = await wb.xlsx.writeBuffer();
    const u8 = new Uint8Array(buf as ArrayBuffer);
    const buffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);

    const { ok, errors } = await parsePlantillaWorkbook(buffer);
    expect(errors).toHaveLength(0);
    expect(ok).toHaveLength(1);
    expect(ok[0].datos_formulario.nombres_apellidos_beneficiario).toBe(
      "Roundtrip Test",
    );
    expect(ok[0].datos_formulario.metros_sobre_nivel_mar).toBe("2500");
    expect(ok[0].gps.latitud).toBeCloseTo(4.6, 4);
    expect(ok[0].gps.longitud).toBeCloseTo(-74.1, 4);
  });

  it("lee LAT/LON/MSNM por encabezado aunque estén desplazadas (plantilla 76 cols)", async () => {
    const wb = new Workbook();
    const ws = wb.addWorksheet(MATRIZ_SHEET_NAME);
    MATRIZ_F_PSA_HEADERS.forEach((h, i) => {
      let col = i + 1;
      if (i >= 26) {
        col = i + 7;
      }
      ws.getCell(7, col).value = h;
    });
    const benefCol = 8;
    const latCol = 33;
    const lonCol = 34;
    const msnmCol = 35;
    ws.getCell(8, benefCol).value = "Benef desplazado";
    ws.getCell(8, latCol).value = "4.5";
    ws.getCell(8, lonCol).value = "-74.2";
    ws.getCell(8, msnmCol).value = "2600";
    const buf = await wb.xlsx.writeBuffer();
    const u8 = new Uint8Array(buf as ArrayBuffer);
    const buffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    const { ok, errors } = await parsePlantillaWorkbook(buffer);
    expect(errors).toHaveLength(0);
    expect(ok).toHaveLength(1);
    expect(ok[0].datos_formulario.nombres_apellidos_beneficiario).toBe(
      "Benef desplazado",
    );
    expect(ok[0].gps.latitud).toBeCloseTo(4.5, 4);
    expect(ok[0].gps.longitud).toBeCloseTo(-74.2, 4);
    expect(ok[0].datos_formulario.metros_sobre_nivel_mar).toBe("2600");
  });

  it("rechaza plantilla antigua con encabezados GMS en columnas 27–28", async () => {
    const wb = new Workbook();
    const ws = wb.addWorksheet(MATRIZ_SHEET_NAME);
    ws.getCell(7, 27).value = "X GRADOS";
    ws.getCell(7, 28).value = "X MINUTOS";
    ws.getCell(8, 7).value = "Benef legacy";
    ws.getCell(8, 27).value = "73";
    ws.getCell(8, 33).value = "4.6";

    const buf = await wb.xlsx.writeBuffer();
    const u8 = new Uint8Array(buf as ArrayBuffer);
    const buffer = u8.buffer.slice(
      u8.byteOffset,
      u8.byteOffset + u8.byteLength,
    );

    const { ok, errors } = await parsePlantillaWorkbook(buffer);
    expect(ok).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/plantilla antigua/i);
  });

  it("elimina claves GMS si vinieran en celdas de campo del Excel", async () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[7] = "Con GMS en datos";
    row[26] = "4.0";
    row[27] = "-74.0";
    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer);
    expect(errors).toHaveLength(0);
    expect(ok[0].datos_formulario).not.toHaveProperty("x_grados");
    expect(ok[0].datos_formulario).not.toHaveProperty("y_minutos");
  });

  it("importa matriz actualizada de 70 columnas (LON/LAT invertidas, sin MSNM)", async () => {
    const wb = new Workbook();
    const ws = wb.addWorksheet(MATRIZ_SHEET_NAME);
    const headers70 = [
      "ID",
      "ENTIDAD APORTANTE",
      "TIPO DE ORGANIZACIÓN DE LA ENTIDAD APORTANTE",
      "NOMBRE DE ACTIVIDAD",
      "FECHA INICIO  (DD/MM/AÑO)",
      "FECHA FIN  (DD/MM/AÑO)",
      "TIPO DE PROYECTO O TIPO DE FINANCIACIÓN",
      "NOMBRES Y APELLIDOS BENEFICIARIO",
      "EDAD",
      "HOMBRE/MUJER",
      "TIPO DOCUMENTO",
      "NÚMERO DOCUMENTO",
      "N° TELEFONICO",
      "N° USUARIO CENS",
      "ESTADO FACTURA",
      "DEPARTAMENTO",
      "MUNICIPIO",
      "VEREDA",
      "DIRECCIÓN",
      "ZONA (URBANA-RURAL)",
      "ESTRATO",
      "SISBEN",
      "NIVEL DE INGRESO PROMEDIO DE LA FAMILIA",
      "NOMBRE DEL PREDIO",
      "RESIDENCIA",
      "TENENCIA DEL PREDIO",
      "LONGITUD",
      "LATITUD",
      "N° PERSONAS DEL NÚCLEO FAMILAR",
      "NÚMERO DE MENORES DE EDAD",
      "NÚMERO DE ADULTOS MAYORES",
      "MUJER CABEZA DE HOGAR",
      "PERSONA CON DISCAPACIDAD",
      "OCUPACION PRINCIPAL",
      "PERFIL SOCIAL PRIORIZADO",
      "ÁREA HUERTA M2",
      "TIPO ESPACIO HUERTA",
      "ACCESO A AGUA",
      "TIPO RIEGO",
      "EXPOSICION SOLAR ADECUADA",
      "SUELO O RECIPIENTES",
      "DISPONIBILIDAD DE MANTENIMIENTO",
      "ÁREA DE ARBOL DISPONIBLES (SI/NO)",
      "TIPO SUELO",
      "DISTANCIA DE INFRAESTRUCTURA ADECUADA APROXIMADA",
      "DISTANCIA APROXIMADA DE REDES ELECTRICAS ADECUADA",
      "INTERES AUTOCONSUMO",
      "INTERES COMERCIALIZACIÓN",
      "ASINTENCIA A CAPACITACIONES",
      "PERMITE VISITAS",
      "COMPROMISO CUIDADO DE ARBOL",
      "FIRMA ACUERDO",
      "AUTORIZA TRATAMIENTO DE DATOS",
      "AUTORIZA REGISTROS FOTOGRAFICOS",
      "CUMPLE CRITERIOS DE HUERTA",
      "CUMPLE CRITERIOS DE ARBOL",
      "OBSERVACIONES",
      "FECHA VISITA 1",
      "FECHA VISITA 2",
      "FECHA VISITA 3",
      "ESTADO HUERTA FINAL",
      "ESTADO ARBOL FINAL",
      "PRODUCCIÓN KG",
      "SATISFACION 1-5",
      "ESPECIES DE FLORA Y FAUNA",
      "ECOSISTEMA ESTRATÉGICO",
      "TIPO DE COBERTURA",
      "CERCANIA RONDA HÍDRICA",
      "SUPERFICIE TOTAL INTERVENIDA M2",
      "TOTAL DE ESECIES O SEMILLAS SEMBRADAS",
    ];
    headers70.forEach((h, i) => {
      ws.getCell(7, i + 1).value = h;
    });
    ws.getCell(8, 8).value = "Benef 70 cols";
    ws.getCell(8, 20).value = "URBANA";
    ws.getCell(8, 27).value = "-74.08175";
    ws.getCell(8, 28).value = "4.60971";
    ws.getCell(8, 29).value = 4;
    ws.getCell(8, 40).value = "Sol directo mañana";
    ws.getCell(8, 45).value = "40 M";
    ws.getCell(8, 46).value = "25";

    const buf = await wb.xlsx.writeBuffer();
    const u8 = new Uint8Array(buf as ArrayBuffer);
    const buffer = u8.buffer.slice(
      u8.byteOffset,
      u8.byteOffset + u8.byteLength,
    );

    const { ok, errors } = await parsePlantillaWorkbook(buffer);
    expect(errors).toHaveLength(0);
    expect(ok).toHaveLength(1);
    expect(ok[0].datos_formulario.nombres_apellidos_beneficiario).toBe(
      "Benef 70 cols",
    );
    expect(ok[0].gps.latitud).toBeCloseTo(4.60971, 5);
    expect(ok[0].gps.longitud).toBeCloseTo(-74.08175, 5);
    expect(ok[0].datos_formulario.metros_sobre_nivel_mar).toBe("");
    expect(ok[0].datos_formulario.zona).toBe("Urbana");
    expect(ok[0].datos_formulario.numero_personas_nucleo_familiar).toBe("4");
    expect(ok[0].datos_formulario.exposicion_solar_adecuada).toBe(
      "Sol directo mañana",
    );
    expect(ok[0].datos_formulario.distancia_infraestructura_adecuada).toBe(
      "40 M",
    );
    expect(ok[0].datos_formulario.distancia_redes_electricas_adecuada).toBe(
      "25",
    );
  });

  it("conserva texto libre en distancia infraestructura al importar", async () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[7] = "Benef distancia";
    row[27] = "-74.0";
    row[26] = "4.0";
    row[45] = "  40 M  ";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer);

    expect(errors).toHaveLength(0);
    expect(ok[0].datos_formulario.distancia_infraestructura_adecuada).toBe(
      "40 M",
    );
  });

  it("normaliza zona en mayúsculas al importar", async () => {
    const row = new Array<string | number | null>(MATRIZ_COLUMN_COUNT).fill(null);
    row[7] = "Benef zona";
    row[19] = "RURAL";
    row[27] = "-74.0";
    row[26] = "4.0";

    const buffer = await buildMinimalPlantillaBuffer(row);
    const { ok, errors } = await parsePlantillaWorkbook(buffer);

    expect(errors).toHaveLength(0);
    expect(ok[0].datos_formulario.zona).toBe("Rural");
  });
});
