import { parseVisitaNumero } from '@/lib/visitaNumero';
import { fetchFormPhotoDataUrl } from '@/services/api';
import type { FotoForm, HistorialForm, PrecargaForm } from '@/services/db';
import { mapServerFotos, type DisplayRow } from '@/services/formHistory';

export type FotoSnapshotLike = {
  nombre_archivo: string;
  data?: string;
  visita?: unknown;
};

export type DetailSourceKind = 'server' | 'precarga' | 'historial' | 'live';

export const estadoClass: Record<HistorialForm['estado'], string> = {
  PENDIENTE: 'text-amber-700',
  ERROR: 'text-rose-700',
  ENVIADO: 'text-emerald-700',
};

export const DETAIL_SOURCE_COLOR: Record<DetailSourceKind, string> = {
  server: 'bg-emerald-100 text-emerald-800',
  precarga: 'bg-indigo-100 text-indigo-800',
  historial: 'bg-amber-100 text-amber-800',
  live: 'bg-slate-100 text-slate-700',
};

export const DETAIL_SOURCE_LABEL: Record<DetailSourceKind, string> = {
  server: 'Servidor',
  precarga: 'Precarga',
  historial: 'Historial local',
  live: 'Local en edicion',
};

/** Preserva visita 1–4; si falta (p. ej. legado o map previo), asume 1 para pasar validacion al enviar. */
export function fotosConVisitaDesdeDetalle(source: FotoSnapshotLike[]): FotoForm[] {
  const out: FotoForm[] = [];
  for (const f of source) {
    if (!f.data?.trim()) {
      continue;
    }
    const visita = parseVisitaNumero(f.visita) ?? 1;
    out.push({ nombre_archivo: f.nombre_archivo, data: f.data, visita });
  }
  return out;
}

/** Si no hay fotos en base64 local, descarga desde el API usando metadatos del servidor. */
export async function hydrateFotosFromServerIfNeeded(
  row: DisplayRow,
  existing: FotoForm[],
): Promise<FotoForm[]> {
  if (existing.length > 0) {
    return existing;
  }
  const serverRow = row.server;
  if (!serverRow || (serverRow.fotos?.length ?? 0) === 0) {
    return existing;
  }
  const serverFotos = mapServerFotos(
    serverRow.id_formulario,
    serverRow.fotos ?? [],
  );
  const fetched: FotoForm[] = [];
  for (const foto of serverFotos) {
    if (foto.serverFormId == null || foto.serverIndex == null) {
      continue;
    }
    try {
      const data = await fetchFormPhotoDataUrl(
        foto.serverFormId,
        foto.serverIndex,
      );
      fetched.push({
        nombre_archivo: foto.nombre_archivo,
        data,
        visita: parseVisitaNumero(foto.visita) ?? 1,
      });
    } catch {
      // Si una foto falla, continuamos con las demas.
    }
  }
  return fetched;
}

/** Misma prioridad que al armar el detalle: servidor → precarga → historial → cola local. */
export function previewDetailSourceForRow(
  row: DisplayRow,
  precarga: PrecargaForm | null,
): DetailSourceKind {
  if (row.server) {
    return 'server';
  }
  if (precarga) {
    return 'precarga';
  }
  if (row.historial) {
    return 'historial';
  }
  return 'live';
}

