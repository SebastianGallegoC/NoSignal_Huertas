import ExcelJS from "exceljs";

import { inputKindForField } from "@/config/formFieldMeta";
import { GPS_PLACEHOLDER_WHEN_NOT_CAPTURED } from "@/constants/gpsConfig";
import { randomUuid } from "@/lib/randomUuid";
import type { OfflineForm } from "@/services/db";
import {
  MATRIZ_ROW_CELL_SOURCES,
  MATRIZ_SHEET_NAME,
} from "@/services/matrizCaracterizacionExport";
import {
  FECHA_FORMATO_MSG,
  joinValidationMessages,
  validateFormValuesWithFieldDetails,
  validateOfflineFormPayload,
} from "@/services/formValidation";
import type { FormFieldKey, FormValues } from "@/types/formFields";
import { REQUIRED_FIELDS } from "@/types/formFields";

export type ImportRowError = { row: number; message: string };

export type PlantillaImportResult = {
  ok: OfflineForm[];
  errors: ImportRowError[];
};

export type ImportPreviewExtraKey = "id_formulario" | "longitud" | "latitud";

export type ImportPreviewFieldErrors = Partial<
  Record<FormFieldKey | ImportPreviewExtraKey, string>
>;

export type ImportPreviewRow = {
  /** Número de fila en el Excel (1-based). */
  sheetRow: number;
  idRaw: string;
  displayValues: FormValues;
  fieldErrors: ImportPreviewFieldErrors;
  rowMessages: string[];
  isValid: boolean;
};

export type PlantillaPreviewResult = {
  rows: ImportPreviewRow[];
  errors: ImportRowError[];
};

/** Solo letras ASCII para comparar SI/NO/NR sin importar tildes ni puntuación. */
function foldTriLetters(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/**
 * Normaliza valores tri-estado (Si / No / NR) al importar desde Excel:
 * ignora mayúsculas, espacios extra, tildes y signos (p. ej. " SÍ ", "no", "N.R.").
 * Si no reconoce el valor, devuelve el texto recortado (la validación marcará error).
 */
export function normalizeTriImportValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return "";
  }
  const key = foldTriLetters(trimmed);
  if (key === "si") {
    return "Si";
  }
  if (key === "no") {
    return "No";
  }
  if (key === "nr") {
    return "NR";
  }
  return trimmed;
}

function normalizeTriFieldsInFormValues(out: FormValues): void {
  for (const key of REQUIRED_FIELDS) {
    const fk = key as FormFieldKey;
    if (inputKindForField(fk) !== "select-tri") {
      continue;
    }
    const v = out[fk];
    if (typeof v !== "string" || v.trim() === "") {
      continue;
    }
    out[fk] = normalizeTriImportValue(v);
  }
}

function isValidYmd(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return false;
  }
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return false;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function mergeFieldError(
  acc: ImportPreviewFieldErrors,
  field: FormFieldKey | ImportPreviewExtraKey,
  message: string,
) {
  if (!acc[field]) {
    acc[field] = message;
  }
}

/** Valores mostrados tal como vienen del Excel (texto por celda). */
export function cellsToFormValuesRaw(cells: string[]): FormValues {
  const out = {} as FormValues;
  for (const key of REQUIRED_FIELDS) {
    out[key] = "";
  }
  for (let i = 0; i < MATRIZ_ROW_CELL_SOURCES.length; i++) {
    const src = MATRIZ_ROW_CELL_SOURCES[i];
    const val = cells[i] ?? "";
    switch (src.kind) {
      case "field":
        out[src.key] = val;
        break;
      case "fecha":
        out[src.key] = val;
        break;
      case "lon":
        out.longitud = val;
        break;
      case "lat":
        out.latitud = val;
        break;
      default:
        break;
    }
  }
  return out;
}

/** Reconstruye las 76 celdas de fila a partir de valores editados en la vista previa. */
export function formValuesToCells(displayValues: FormValues, idRaw: string): string[] {
  const cells = new Array<string>(76).fill("");
  for (let i = 0; i < MATRIZ_ROW_CELL_SOURCES.length; i++) {
    const src = MATRIZ_ROW_CELL_SOURCES[i];
    switch (src.kind) {
      case "id_formulario":
        cells[i] = idRaw;
        break;
      case "field":
        cells[i] = displayValues[src.key] ?? "";
        break;
      case "fecha":
        cells[i] = displayValues[src.key] ?? "";
        break;
      case "lon":
        cells[i] = displayValues.longitud ?? "";
        break;
      case "lat":
        cells[i] = displayValues.latitud ?? "";
        break;
      default:
        break;
    }
  }
  return cells;
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

/**
 * Cada fila importada es un formulario nuevo en cola local: no se reutiliza el UUID
 * de la columna A (p. ej. si el Excel viene de una exportación de otro registro).
 */
function rowToOfflineForm(
  cells: string[],
  idUsuario: string,
  nowIso: string,
): { form?: OfflineForm; error?: string } {
  const idFormulario = randomUuid();

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
        datos[src.key] =
          inputKindForField(src.key) === "select-tri"
            ? normalizeTriImportValue(val)
            : val;
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

  const nombreBenef = String(
    datos.nombres_apellidos_beneficiario ?? "",
  ).trim();
  if (!nombreBenef) {
    return {
      error: "Falta el nombre del beneficiario en la fila (obligatorio para importar).",
    };
  }

  const lon = parseCoord(lonStr);
  const lat = parseCoord(latStr);
  const gps: OfflineForm["gps"] =
    lon != null && lat != null
      ? { latitud: lat, longitud: lon, precision: 5 }
      : { ...GPS_PLACEHOLDER_WHEN_NOT_CAPTURED };

  const form: OfflineForm = {
    id_formulario: idFormulario,
    id_usuario: idUsuario,
    modo_coordenadas: "manual",
    fecha_hora: nowIso,
    fecha_actualizacion: nowIso,
    gps,
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

/** Construye un `OfflineForm` desde celdas ya validadas (p. ej. tras editar la vista previa). */
export function buildOfflineFormFromImportCells(
  cells: string[],
  idUsuario: string,
  nowIso?: string,
): { form?: OfflineForm; error?: string } {
  return rowToOfflineForm(
    cells,
    idUsuario.trim(),
    nowIso ?? new Date().toISOString(),
  );
}

/** Valores para validar: igual que la fila en bruto, con fechas normalizadas a YYYY-MM-DD cuando el Excel es válido. */
function cellsToFormValuesNormalized(cells: string[]): FormValues {
  const out = cellsToFormValuesRaw(cells);
  for (let i = 0; i < MATRIZ_ROW_CELL_SOURCES.length; i++) {
    const src = MATRIZ_ROW_CELL_SOURCES[i];
    if (src.kind !== "fecha") {
      continue;
    }
    const cellRaw = cells[i] ?? "";
    const parsed = parseFechaCellForDatos(cellRaw);
    out[src.key] = isValidYmd(parsed) ? parsed : "";
  }
  normalizeTriFieldsInFormValues(out);
  return out;
}

export function analyzeImportRow(
  cells: string[],
  sheetRow: number,
  idUsuario: string,
  nowIso: string,
): ImportPreviewRow {
  const displayValues = cellsToFormValuesNormalized(cells);
  const idRaw = (cells[0] ?? "").trim();
  const fieldErrors: ImportPreviewFieldErrors = {};
  const rowMessages: string[] = [];

  let lonStr = "";
  let latStr = "";
  for (let i = 0; i < MATRIZ_ROW_CELL_SOURCES.length; i++) {
    const src = MATRIZ_ROW_CELL_SOURCES[i];
    if (src.kind === "lon") {
      lonStr = cells[i] ?? "";
    }
    if (src.kind === "lat") {
      latStr = cells[i] ?? "";
    }
  }

  const lonTrim = lonStr.trim();
  const latTrim = latStr.trim();
  if (lonTrim !== "" && parseCoord(lonStr) == null) {
    mergeFieldError(
      fieldErrors,
      "longitud",
      "LONGITUD debe ser un número decimal (ej. -74.08175; también se admite coma como separador).",
    );
  }
  if (latTrim !== "" && parseCoord(latStr) == null) {
    mergeFieldError(
      fieldErrors,
      "latitud",
      "LATITUD debe ser un número decimal (ej. 4.60971; también se admite coma como separador).",
    );
  }

  for (let i = 0; i < MATRIZ_ROW_CELL_SOURCES.length; i++) {
    const src = MATRIZ_ROW_CELL_SOURCES[i];
    if (src.kind !== "fecha") {
      continue;
    }
    const cellRaw = (cells[i] ?? "").trim();
    if (!cellRaw) {
      continue;
    }
    const parsed = parseFechaCellForDatos(cellRaw);
    if (!isValidYmd(parsed)) {
      mergeFieldError(fieldErrors, src.key, FECHA_FORMATO_MSG);
    }
  }

  const normalized = cellsToFormValuesNormalized(cells);
  const { fieldIssues, rowIssues } = validateFormValuesWithFieldDetails(normalized);
  for (const fi of fieldIssues) {
    mergeFieldError(fieldErrors, fi.field, fi.message);
  }
  for (const ri of rowIssues) {
    rowMessages.push(ri.message);
  }

  const { form, error } = rowToOfflineForm(cells, idUsuario.trim(), nowIso);
  const hasGranular =
    Object.keys(fieldErrors).length > 0 || rowMessages.length > 0;
  let isValid = Boolean(form) && !hasGranular;
  if (!form && error) {
    if (!hasGranular) {
      rowMessages.push(error);
    }
    isValid = false;
  }
  if (form && hasGranular) {
    isValid = false;
  }

  return {
    sheetRow,
    idRaw,
    displayValues,
    fieldErrors,
    rowMessages,
    isValid,
  };
}

async function loadPlantillaSheet(
  buffer: ArrayBuffer,
): Promise<{ worksheet: ExcelJS.Worksheet } | { error: ImportRowError }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet(MATRIZ_SHEET_NAME) ?? wb.worksheets[0];
  if (!ws) {
    return { error: { row: 0, message: "El archivo no contiene hojas." } };
  }
  return { worksheet: ws };
}

/**
 * Vista previa por fila (errores por campo) sin importar aún a la cola.
 */
export async function previewPlantillaWorkbook(
  buffer: ArrayBuffer,
  idUsuario: string,
): Promise<PlantillaPreviewResult> {
  if (!idUsuario.trim()) {
    return {
      rows: [],
      errors: [{ row: 0, message: "Falta usuario para asociar los formularios." }],
    };
  }

  const loaded = await loadPlantillaSheet(buffer);
  if ("error" in loaded) {
    return { rows: [], errors: [loaded.error] };
  }

  const ws = loaded.worksheet;
  const nowIso = new Date().toISOString();
  const rows: ImportPreviewRow[] = [];
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

    rows.push(analyzeImportRow(cells, rowNum, idUsuario.trim(), nowIso));
    rowNum += 1;
  }

  return { rows, errors: [] };
}

/**
 * Lee un .xlsx alineado a la plantilla: hoja F-PSA-08 (o la primera hoja), fila 7 reservada a
 * encabezados (no se validan los textos), datos desde la fila 8 por posición de columna (1–76).
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

  const loaded = await loadPlantillaSheet(buffer);
  if ("error" in loaded) {
    return { ok: [], errors: [loaded.error] };
  }
  const ws = loaded.worksheet;

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
