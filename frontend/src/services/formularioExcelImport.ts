import { Workbook, type Cell, type Row, type Worksheet } from "exceljs";

import {
  inputKindForField,
  SI_NO_IMPORT_NORMALIZE_FIELDS,
} from "@/config/formFieldMeta";
import { GPS_PLACEHOLDER_WHEN_NOT_CAPTURED } from "@/constants/gpsConfig";
import { randomUuid } from "@/lib/randomUuid";
import type { OfflineForm } from "@/services/db";
import {
  MATRIZ_ROW_CELL_SOURCES,
  MATRIZ_SHEET_NAME,
} from "@/services/matrizCaracterizacionExport";
import {
  COORD_NUMERIC_FIELD_KEYS,
  normalizeCoordNumericCell,
} from "@/lib/coordNumericToken";
import { normalizeDistanciaInfraestructuraMetersCell } from "@/lib/distanciaInfraestructuraNormalize";
import { normalizeTelefonoStoredValue } from "@/lib/telefonoNormalize";
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
 * "NO APLICA" (y variantes) se interpreta como No.
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
  if (key === "no" || key === "noaplica") {
    return "No";
  }
  if (key === "nr") {
    return "NR";
  }
  return trimmed;
}

/**
 * Solo Si / No (p. ej. «Área árbol disponible»): misma flexibilidad que tri sin aceptar NR.
 */
export function normalizeSiNoImportValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return "";
  }
  const key = foldTriLetters(trimmed);
  if (key === "si") {
    return "Si";
  }
  if (key === "no" || key === "noaplica") {
    return "No";
  }
  return trimmed;
}

function normalizeImportEnumerationFieldsInFormValues(out: FormValues): void {
  for (const key of REQUIRED_FIELDS) {
    const fk = key as FormFieldKey;
    const v = out[fk];
    if (typeof v !== "string" || v.trim() === "") {
      continue;
    }
    if (inputKindForField(fk) === "select-tri") {
      out[fk] = normalizeTriImportValue(v);
    } else if (SI_NO_IMPORT_NORMALIZE_FIELDS.has(fk)) {
      out[fk] = normalizeSiNoImportValue(v);
    }
  }
  const tel = out.telefono;
  if (typeof tel === "string" && tel.trim() !== "") {
    out.telefono = normalizeTelefonoStoredValue(tel);
  }
}

function normalizeCoordFieldsInFormValues(out: FormValues): void {
  for (const key of COORD_NUMERIC_FIELD_KEYS) {
    const v = out[key];
    if (typeof v !== "string") {
      continue;
    }
    out[key] = normalizeCoordNumericCell(v);
  }
}

function normalizeDistanciaInfraestructuraInFormValues(out: FormValues): void {
  const v = out.distancia_infraestructura_adecuada;
  if (typeof v !== "string") {
    return;
  }
  out.distancia_infraestructura_adecuada =
    normalizeDistanciaInfraestructuraMetersCell(v);
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

function cellValueToImportString(cell: Cell): string {
  return valueToImportString(cell.value);
}

function readDataRowStrings(row: Row): string[] {
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
  const token = normalizeCoordNumericCell(s);
  if (token === "") {
    return null;
  }
  const n = Number.parseFloat(token);
  return Number.isFinite(n) ? n : null;
}

/** Decimal en celdas LONGITUD/LATITUD; no se infiere desde GMS para no inventar datos. */
function mergeLonLatWithDms(
  lonStr: string,
  latStr: string,
  _datos: Record<string, unknown>,
): { lon: number | null; lat: number | null } {
  return { lon: parseCoord(lonStr), lat: parseCoord(latStr) };
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
      case "field": {
        let stored = val;
        if (COORD_NUMERIC_FIELD_KEYS.has(src.key)) {
          stored = normalizeCoordNumericCell(val);
        } else if (src.key === "distancia_infraestructura_adecuada") {
          stored = normalizeDistanciaInfraestructuraMetersCell(val);
        } else if (inputKindForField(src.key) === "select-tri") {
          stored = normalizeTriImportValue(val);
        } else if (SI_NO_IMPORT_NORMALIZE_FIELDS.has(src.key)) {
          stored = normalizeSiNoImportValue(val);
        } else if (src.key === "telefono") {
          stored = normalizeTelefonoStoredValue(val);
        }
        datos[src.key] = stored;
        break;
      }
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

  const { lon, lat } = mergeLonLatWithDms(lonStr, latStr, datos);
  const gps: OfflineForm["gps"] =
    lon != null && lat != null
      ? { latitud: lat, longitud: lon, precision: 5 }
      : { ...GPS_PLACEHOLDER_WHEN_NOT_CAPTURED };

  if (lon != null) {
    datos.longitud = lon.toFixed(6);
  }
  if (lat != null) {
    datos.latitud = lat.toFixed(6);
  }

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
  normalizeImportEnumerationFieldsInFormValues(out);
  normalizeCoordFieldsInFormValues(out);
  normalizeDistanciaInfraestructuraInFormValues(out);
  return out;
}

export function analyzeImportRow(
  cells: string[],
  sheetRow: number,
  idUsuario: string,
  nowIso: string,
): ImportPreviewRow {
  let displayValues = cellsToFormValuesNormalized(cells);
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
  const datosForDms = displayValues as unknown as Record<string, unknown>;
  const { lon: mergedLon, lat: mergedLat } = mergeLonLatWithDms(
    lonStr,
    latStr,
    datosForDms,
  );
  if (mergedLon != null) {
    displayValues = { ...displayValues, longitud: mergedLon.toFixed(6) };
  }
  if (mergedLat != null) {
    displayValues = { ...displayValues, latitud: mergedLat.toFixed(6) };
  }

  if (lonTrim !== "" && parseCoord(lonStr) == null && mergedLon == null) {
    mergeFieldError(
      fieldErrors,
      "longitud",
      "LONGITUD debe ser un número decimal (ej. -74.08175; también se admite coma como separador).",
    );
  }
  if (latTrim !== "" && parseCoord(latStr) == null && mergedLat == null) {
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

  const { fieldIssues, rowIssues } =
    validateFormValuesWithFieldDetails(displayValues);
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
): Promise<{ worksheet: Worksheet } | { error: ImportRowError }> {
  const wb = new Workbook();
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
