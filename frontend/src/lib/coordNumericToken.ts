import type { FormFieldKey } from "@/types/formFields";

/** Campos numéricos de coordenadas (GMS o decimal) que suelen traer ° ′ ″ en Excel. */
export const COORD_NUMERIC_FIELD_KEYS = new Set<FormFieldKey>([
  "x_grados",
  "x_minutos",
  "x_segundos",
  "y_grados",
  "y_minutos",
  "y_segundos",
  "longitud",
  "latitud",
]);

/**
 * Extrae el primer número de una celda (GMS o decimal), tolerando símbolos y coma decimal.
 * Ej.: "73°" → "73", "17'" → "17", "47,5''" → "47.5", "  -74,1° " → "-74.1".
 */
export function normalizeCoordNumericCell(raw: string): string {
  const t = raw.replace(/\s/g, "").replace(",", ".");
  if (t === "") {
    return "";
  }
  const m = t.match(/^-?\d+(?:\.\d+)?/);
  return m ? m[0] : "";
}
