export type VisitaNumero = 1 | 2 | 3 | 4;

export const VISITA_NUMEROS: readonly VisitaNumero[] = [1, 2, 3, 4];

/** Normaliza visita desde API/JSON (número o string "1"–"4"). */
export function parseVisitaNumero(value: unknown): VisitaNumero | undefined {
  if (value === 1 || value === 2 || value === 3 || value === 4) {
    return value;
  }
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (n === 1 || n === 2 || n === 3 || n === 4) {
      return n as VisitaNumero;
    }
  }
  return undefined;
}

export function isVisitaNumero(value: unknown): value is VisitaNumero {
  return parseVisitaNumero(value) !== undefined;
}
