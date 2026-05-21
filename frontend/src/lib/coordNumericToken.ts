import type { FormFieldKey } from "@/types/formFields";

/** Campos numéricos WGS84 (grados decimales y altitud) en formulario e importación Excel. */
export const COORD_NUMERIC_FIELD_KEYS = new Set<FormFieldKey>([
  "latitud",
  "longitud",
  "metros_sobre_nivel_mar",
]);

/** Decimales al capturar ubicación con GPS (modo automático). */
export const COORD_DECIMAL_PLACES = 6;

export function roundCoordDecimal(n: number): number {
  if (!Number.isFinite(n)) {
    return n;
  }
  const factor = 10 ** COORD_DECIMAL_PLACES;
  return Math.round(n * factor) / factor;
}

/** Formato fijo de 6 decimales para coordenadas obtenidas por GPS. */
export function formatGpsCoordDecimal(n: number): string {
  return roundCoordDecimal(n).toFixed(COORD_DECIMAL_PLACES);
}

/**
 * Normaliza entrada de coordenadas sin recortar decimales (modo manual).
 * Solo limpia símbolos, espacios y coma decimal.
 */
export function formatCoordDecimalFromCell(raw: string): string {
  return normalizeCoordNumericCell(raw);
}

export function formatCoordForDatosFormulario(
  raw: string,
  modoCoordenadas: "automatico" | "manual",
): string {
  const normalized = normalizeCoordNumericCell(raw);
  if (normalized === "") {
    return "";
  }
  if (modoCoordenadas === "manual") {
    return normalized;
  }
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? formatGpsCoordDecimal(n) : normalized;
}

/**
 * Extrae el primer número de una celda (GMS o decimal), tolerando símbolos y coma decimal.
 * Incluye LONGITUD/LATITUD con sufijo o prefijo °, guion Unicode (Excel), y NFKC (ancho completo).
 * Ej.: "73°" → "73", "  -74,1° " → "-74.1", "°4,5" → "4.5", "−74,08°" (U+2212) → "-74.08".
 */
export function normalizeCoordNumericCell(raw: string): string {
  let t = raw.trim().normalize("NFKC").replace(/\s/g, "").replace(/,/g, ".");
  t = t.replace(/\u2212/g, "-");
  if (t === "") {
    return "";
  }
  t = t.replace(/^[^0-9.-]+/, "");
  const m = t.match(/^-?\d+(?:\.\d+)?/);
  return m ? m[0] : "";
}
