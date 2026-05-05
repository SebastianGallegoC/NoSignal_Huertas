import type { FormularioSnapshot } from "@/components/form/FormularioRespuestaReadOnly";
import type { FormReadItem } from "@/services/api";
import type { HistorialForm, PrecargaForm } from "@/services/db";
import { REQUIRED_FIELDS, type FormValues } from "@/types/formFields";

export type DisplayRow = {
  id_formulario: string;
  onServer: boolean;
  server?: FormReadItem;
  historial?: HistorialForm;
  /**
   * Fila solo por precarga en IndexedDB (p. ej. sin fila en historial cuando
   * el listado del servidor no está disponible offline).
   */
  precargaSolo?: PrecargaForm;
};

/**
 * Tras un `GET /forms` exitoso con sesión, el servidor es la fuente de verdad de qué
 * envíos siguen existiendo. Un `ENVIADO` local cuyo id ya no viene en la lista se
 * interpreta como borrado en otro dispositivo y debe dejar de mostrarse (y limpiarse
 * en IndexedDB en el caller).
 *
 * No usar cuando el listado falló o no hubo token: en ese caso no se infiere ausencia.
 */
export function reconcileLocalStateWithTrustedServerList(
  local: HistorialForm[],
  server: FormReadItem[],
  precargas: PrecargaForm[],
): {
  historialForMerge: HistorialForm[];
  precargasForMerge: PrecargaForm[];
  staleEnviadoIds: string[];
} {
  const serverIds = new Set(server.map((s) => s.id_formulario));
  const staleEnviadoIds = local
    .filter((h) => h.estado === "ENVIADO" && !serverIds.has(h.id_formulario))
    .map((h) => h.id_formulario);
  if (staleEnviadoIds.length === 0) {
    return {
      historialForMerge: local,
      precargasForMerge: precargas,
      staleEnviadoIds: [],
    };
  }
  const stale = new Set(staleEnviadoIds);
  return {
    historialForMerge: local.filter((h) => !stale.has(h.id_formulario)),
    precargasForMerge: precargas.filter((p) => !stale.has(p.id_formulario)),
    staleEnviadoIds,
  };
}

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

/** Une servidor + historial y agrega filas por precargas huérfanas (sin id en el merge). */
export function mergeFormsWithPrecargas(
  server: FormReadItem[],
  local: HistorialForm[],
  precargas: PrecargaForm[],
): DisplayRow[] {
  const merged = mergeForms(server, local);
  const ids = new Set(merged.map((r) => r.id_formulario));
  for (const p of precargas) {
    if (!ids.has(p.id_formulario)) {
      merged.push({
        id_formulario: p.id_formulario,
        onServer: false,
        precargaSolo: p,
      });
      ids.add(p.id_formulario);
    }
  }
  return merged.sort((a, b) => {
    const ta = getFechaReferenciaEnvio(a);
    const tb = getFechaReferenciaEnvio(b);
    const sa = Number.isNaN(ta) ? 0 : ta;
    const sb = Number.isNaN(tb) ? 0 : tb;
    return sb - sa;
  });
}

export function mapServerFotos(
  formId: string,
  raw: unknown,
): NonNullable<FormularioSnapshot["fotos"]> {
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
    if (p !== null && typeof p === "object" && "path" in p) {
      const path = String((p as { path: unknown }).path);
      const base = path.split(/[/\\]/).pop() || `foto_${i + 1}.jpg`;
      const v = (p as { visita?: unknown }).visita;
      const visita = v === 1 || v === 2 || v === 3 ? v : undefined;
      return {
        nombre_archivo: base,
        path,
        serverFormId: formId,
        serverIndex: i,
        ...(visita != null ? { visita } : {}),
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
  if (row.precargaSolo?.fecha_precarga) {
    return Date.parse(row.precargaSolo.fecha_precarga);
  }
  return NaN;
}

/** Nombre del beneficiario con prioridad servidor > precarga > historial local. */
export function getBeneficiarioDisplayName(row: DisplayRow): string {
  const h = row.historial;
  const s = row.server;
  const solo = row.precargaSolo?.datos_formulario;
  const rawServer = (s?.datos_formulario as Record<string, unknown> | undefined)
    ?.nombres_apellidos_beneficiario;
  if (typeof rawServer === "string" && rawServer.trim() !== "") {
    return rawServer.trim();
  }
  const raw = solo?.nombres_apellidos_beneficiario;
  if (typeof raw === "string" && raw.trim() !== "") {
    return raw.trim();
  }
  const rawHistorial = (h?.datos_formulario as Record<string, unknown> | undefined)
    ?.nombres_apellidos_beneficiario;
  if (typeof rawHistorial === "string" && rawHistorial.trim() !== "") {
    return rawHistorial.trim();
  }
  return "";
}

/** Normaliza texto para búsqueda insensible a mayúsculas y tildes. */
export function normalizeTextoBusqueda(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
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
