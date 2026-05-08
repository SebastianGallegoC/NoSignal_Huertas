import ExcelJS from "exceljs";

import { randomUuid } from "@/lib/randomUuid";
import type { OfflineForm } from "@/services/db";
import {
  MATRIZ_F_PSA_HEADERS,
  MATRIZ_ROW_CELL_SOURCES,
  MATRIZ_SHEET_NAME,
} from "@/services/matrizCaracterizacionExport";
import {
  joinValidationMessages,
  validateOfflineFormPayload,
} from "@/services/formValidation";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ImportRowError = { row: number; message: string };

export type PlantillaImportResult = {
  ok: OfflineForm[];
  errors: ImportRowError[];
};

function normalizeHeaderText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function headersMatchRow7(headerRow: ExcelJS.Row): boolean {
  for (let i = 0; i < MATRIZ_F_PSA_HEADERS.length; i++) {
    const expected = normalizeHeaderText(MATRIZ_F_PSA_HEADERS[i]);
    const got = normalizeHeaderText(
      cellValueToImportString(headerRow.getCell(i + 1)),
    );
    if (got.toLowerCase() !== expected.toLowerCase()) {
      return false;
    }
  }
  return true;
}

function valueToImportString(raw: unknown): string {
  if (raw == null) {
    return "";
  }
  if (typeof raw === "string") {
    return raw.trim();
  }
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? String(raw) : "";
  }
  if (typeof raw === "boolean") {
    return raw ? "Si" : "No";
  }
  if (raw instanceof Date) {
    const d = raw;
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = String(d.getUTCFullYear());
    return `${day}/${month}/${year}`;
  }
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    if ("result" in o) {
      return valueToImportString(o.result);
    }
    if (
      "richText" in o &&
      Array.isArray((o as { richText: { text: string }[] }).richText)
    ) {
      return (o as { richText: { text: string }[] }).richText
        .map((x) => x.text)
        .join("")
        .trim();
    }
  }
  return String(raw).trim();
}

function cellValueToImportString(cell: ExcelJS.Cell): string {
  return valueToImportString(cell.value);
}

function readDataRowStrings(row: ExcelJS.Row): string[] {
  const out: string[] = [];
  for (let c = 1; c <= 76; c++) {
    out.push(cellValueToImportString(row.getCell(c)));
  }
  return out;
}

function isRowCompletelyEmpty(cells: string[]): boolean {
  return cells.every((s) => s.trim() === "");
}

function isRowEndOfData(cells: string[]): boolean {
  const id = (cells[0] ?? "").trim();
  const benef = (cells[7] ?? "").trim();
  return id === "" && benef === "";
}

/** Convierte celda de fecha (DD/MM/AAAA, ISO, Excel) a YYYY-MM-DD para `datos_formulario`. */
export function parseFechaCellForDatos(raw: string): string {
  const t = raw.trim();
  if (!t) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    return t.slice(0, 10);
  }
  const dm = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dm) {
    const d = Number(dm[1]);
    const m = Number(dm[2]);
    let y = Number(dm[3]);
    if (y < 100) {
      y += 2000;
    }
    if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) {
      return t;
    }
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const ms = Date.parse(t);
  if (!Number.isNaN(ms)) {
    return new Date(ms).toISOString().slice(0, 10);
  }
  return t;
}

function parseCoord(s: string): number | null {
  const t = s.replace(",", ".").trim();
  if (t === "") {
    return null;
  }
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function rowToOfflineForm(
  cells: string[],
  idUsuario: string,
  nowIso: string,
): { form?: OfflineForm; error?: string } {
  const idRaw = (cells[0] ?? "").trim();
  let idFormulario: string;
  if (!idRaw) {
    idFormulario = randomUuid();
  } else if (!UUID_RE.test(idRaw)) {
    return {
      error: `ID inválido (usá UUID vacío para generar uno nuevo): "${idRaw.slice(0, 40)}${idRaw.length > 40 ? "…" : ""}"`,
    };
  } else {
    idFormulario = idRaw;
  }

  const datos: Record<string, unknown> = {};
  let lonStr = "";
  let latStr = "";

  for (let i = 0; i < MATRIZ_ROW_CELL_SOURCES.length; i++) {
    const src = MATRIZ_ROW_CELL_SOURCES[i];
    const val = cells[i] ?? "";
    switch (src.kind) {
      case "id_formulario":
        break;
      case "field":
        datos[src.key] = val;
        break;
      case "fecha":
        datos[src.key] = parseFechaCellForDatos(val);
        break;
      case "lon":
        lonStr = val;
        break;
      case "lat":
        latStr = val;
        break;
      default:
        break;
    }
  }

  const lon = parseCoord(lonStr);
  const lat = parseCoord(latStr);
  if (lon == null || lat == null) {
    return {
      error:
        "Faltan LONGITUD y/o LATITUD numéricas válidas en la fila (obligatorio para importar).",
    };
  }

  const form: OfflineForm = {
    id_formulario: idFormulario,
    id_usuario: idUsuario,
    modo_coordenadas: "manual",
    fecha_hora: nowIso,
    fecha_actualizacion: nowIso,
    gps: { latitud: lat, longitud: lon, precision: 5 },
    datos_formulario: datos,
    fotos: [],
    estado_sincronizacion: "PENDIENTE",
  };

  const payloadIssues = validateOfflineFormPayload(form);
  if (payloadIssues.length > 0) {
    return { error: joinValidationMessages(payloadIssues) };
  }

  return { form };
}

/**
 * Lee un .xlsx con estructura PLANTILLA (hoja F-PSA-08, encabezados fila 7, datos desde fila 8).
 */
export async function parsePlantillaWorkbook(
  buffer: ArrayBuffer,
  idUsuario: string,
): Promise<PlantillaImportResult> {
  const ok: OfflineForm[] = [];
  const errors: ImportRowError[] = [];

  if (!idUsuario.trim()) {
    return {
      ok: [],
      errors: [{ row: 0, message: "Falta usuario para asociar los formularios." }],
    };
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const ws = wb.getWorksheet(MATRIZ_SHEET_NAME) ?? wb.worksheets[0];
  if (!ws) {
    return {
      ok: [],
      errors: [{ row: 0, message: "El archivo no contiene hojas." }],
    };
  }

  const headerRow = ws.getRow(7);
  if (!headersMatchRow7(headerRow)) {
    errors.push({
      row: 7,
      message:
        "La fila 7 no coincide con los encabezados de PLANTILLA.xlsx (hoja F-PSA-08). Descargá la plantilla desde el enlace de esta página.",
    });
    return { ok, errors };
  }

  const nowIso = new Date().toISOString();
  let rowNum = 8;
  const maxRow = ws.rowCount || 8;

  while (rowNum <= maxRow) {
    const row = ws.getRow(rowNum);
    const cells = readDataRowStrings(row);

    if (isRowCompletelyEmpty(cells)) {
      rowNum += 1;
      continue;
    }
    if (isRowEndOfData(cells)) {
      break;
    }

    const { form, error } = rowToOfflineForm(cells, idUsuario.trim(), nowIso);
    if (form) {
      ok.push(form);
    } else if (error) {
      errors.push({ row: rowNum, message: error });
    }

    rowNum += 1;
  }

  return { ok, errors };
}
