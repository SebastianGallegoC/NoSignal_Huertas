import type { FormularioSnapshot } from "@/components/form/FormularioRespuestaReadOnly";
import type { FormReadItem } from "@/services/api";
import type { HistorialForm } from "@/services/db";
import { REQUIRED_FIELDS, type FormValues } from "@/types/formFields";

export type DisplayRow = {
  id_formulario: string;
  onServer: boolean;
  server?: FormReadItem;
  historial?: HistorialForm;
};

export function mergeForms(server: FormReadItem[], local: HistorialForm[]): DisplayRow[] {
  const map = new Map<string, DisplayRow>();
  for (const s of server) {
    map.set(s.id_formulario, {
      id_formulario: s.id_formulario,
      onServer: true,
      server: s,
    });
  }
  for (const h of local) {
    const ex = map.get(h.id_formulario);
    if (ex) {
      ex.historial = h;
    } else {
      map.set(h.id_formulario, {
        id_formulario: h.id_formulario,
        onServer: false,
        historial: h,
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    const ta = Date.parse(a.server?.fecha_hora ?? a.historial?.fecha_hora ?? "");
    const tb = Date.parse(b.server?.fecha_hora ?? b.historial?.fecha_hora ?? "");
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
}

export function mapServerFotos(formId: string, raw: unknown): FormularioSnapshot["fotos"] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? (() => {
          try {
            const j = JSON.parse(raw) as unknown;
            return Array.isArray(j) ? j : [];
          } catch {
            return [];
          }
        })()
      : [];
  return list.map((p, i) => {
    if (typeof p === "string") {
      const base = p.split(/[/\\]/).pop() || `foto_${i + 1}.jpg`;
      return {
        nombre_archivo: base,
        path: p,
        serverFormId: formId,
        serverIndex: i,
      };
    }
    return {
      nombre_archivo: `foto_${i + 1}`,
      path: String(p),
      serverFormId: formId,
      serverIndex: i,
    };
  });
}

export function getFechaReferenciaEnvio(row: DisplayRow): number {
  const h = row.historial;
  const s = row.server;
  if (h?.fecha_envio) {
    return Date.parse(h.fecha_envio);
  }
  if (s?.fecha_hora) {
    return Date.parse(s.fecha_hora);
  }
  if (h?.fecha_hora) {
    return Date.parse(h.fecha_hora);
  }
  return NaN;
}

export function parseFiltroDiaInicio(isoDay: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) {
    return NaN;
  }
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

export function parseFiltroDiaFin(isoDay: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDay)) {
    return NaN;
  }
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

export function precargaToSnapshot(precarga: {
  datos_formulario?: Record<string, unknown>;
  gps?: FormularioSnapshot["gps"];
  fotos?: FormularioSnapshot["fotos"];
}): FormularioSnapshot {
  return {
    datos_formulario: precarga.datos_formulario ?? {},
    gps: precarga.gps ?? null,
    fotos: precarga.fotos ?? [],
  };
}

export function buildFormValuesFromSnapshot(snapshot: FormularioSnapshot): FormValues {
  const base = Object.fromEntries(REQUIRED_FIELDS.map((k) => [k, ""])) as FormValues;
  const raw = snapshot.datos_formulario ?? {};
  for (const key of REQUIRED_FIELDS) {
    const value = (raw as Record<string, unknown>)[key];
    if (value == null) {
      continue;
    }
    if (typeof value === "string") {
      base[key] = value;
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      base[key] = String(value);
    }
  }
  return base;
}
