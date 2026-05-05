import { db, type OfflineForm } from './db';
import { postForm } from './api';

const RETENTION_DAYS = 3;
const BACKOFF_STEPS_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000];
const MAX_GPS_ACCURACY_METERS = 100;
const MIN_PHOTOS = 0;
const MAX_PHOTOS = 15;

export const validateFormPayload = (form: OfflineForm): string[] => {
  const errors: string[] = [];

  if (!form.gps || form.gps.precision > MAX_GPS_ACCURACY_METERS) {
    errors.push('gps_precision');
  }
  if (!Array.isArray(form.fotos) || form.fotos.length < MIN_PHOTOS || form.fotos.length > MAX_PHOTOS) {
    errors.push('fotos_count');
  }

  return errors;
};

export const enqueueForm = async (form: OfflineForm): Promise<void> => {
  await db.formularios.put({
    ...form,
    estado_sincronizacion: 'PENDIENTE',
    errores_sync: 0,
  });
  await db.historialFormularios.put({
    id_formulario: form.id_formulario,
    id_usuario: form.id_usuario,
    fecha_hora: form.fecha_hora,
    estado: 'PENDIENTE',
    datos_formulario: form.datos_formulario,
    gps: form.gps,
    fotos: form.fotos,
  });
};

export const countPendingForms = async (): Promise<number> => {
  return db.formularios.where('estado_sincronizacion').equals('PENDIENTE').count();
};

export const countErrorForms = async (): Promise<number> => {
  return db.formularios.where('estado_sincronizacion').equals('ERROR').count();
};

export interface SyncErrorItem {
  id_formulario: string;
  id_usuario: string;
  errores_sync: number;
  fecha_intento?: string;
  ultimo_error?: string;
}

export interface SyncRunResult {
  sent: number;
  failed: number;
  skipped: number;
  first_error?: string;
}

export const listSyncErrors = async (limit = 5): Promise<SyncErrorItem[]> => {
  const rows = await db.formularios.where('estado_sincronizacion').equals('ERROR').sortBy('fecha_hora');
  return rows
    .slice(-limit)
    .reverse()
    .map((row) => ({
      id_formulario: row.id_formulario,
      id_usuario: row.id_usuario,
      errores_sync: row.errores_sync ?? 0,
      fecha_intento: row.fecha_intento,
      ultimo_error: row.ultimo_error,
    }));
};

export const purgeExpiredForms = async (): Promise<void> => {
  const now = Date.now();
  const cutoff = now - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const all = await db.formularios.toArray();

  for (const form of all) {
    const time = Date.parse(form.fecha_hora);
    if (!Number.isNaN(time) && time < cutoff) {
      await db.formularios.delete(form.id_formulario);
    }
  }
};

export const syncPendingForms = async (): Promise<SyncRunResult> => {
  const result: SyncRunResult = { sent: 0, failed: 0, skipped: 0 };
  if (!navigator.onLine) {
    return result;
  }

  const pending = await db.formularios
    .where('estado_sincronizacion')
    .anyOf(['PENDIENTE', 'ERROR'])
    .sortBy('fecha_hora');

  for (const form of pending) {
    const intentos = form.errores_sync ?? 0;
    // Backoff solo tras fallos previos: con intentos === 0, fecha_hora es reciente y
    // compararla con delay bloqueaba el primer envío ~30s (o hasta que pasara el backoff).
    if (intentos > 0) {
      const delay = BACKOFF_STEPS_MS[Math.min(intentos, BACKOFF_STEPS_MS.length - 1)];
      const lastAttempt = form.fecha_intento
        ? Date.parse(form.fecha_intento)
        : Date.parse(form.fecha_hora);
      if (!Number.isNaN(lastAttempt) && Date.now() - lastAttempt < delay) {
        result.skipped += 1;
        continue;
      }
    }

    await db.formularios.update(form.id_formulario, {
      estado_sincronizacion: 'SINCRONIZANDO',
      fecha_intento: new Date().toISOString(),
      ultimo_error: undefined,
    });

    try {
      const response = await postForm(form);
      if (!response.ok) {
        let detail = '';
        try {
          const ct = response.headers.get('content-type') ?? '';
          if (ct.includes('application/json')) {
            const j = (await response.json()) as { detail?: unknown };
            if (typeof j.detail === 'string') {
              detail = j.detail;
            } else if (Array.isArray(j.detail)) {
              detail = j.detail
                .map((e: { loc?: unknown[]; msg?: string }) =>
                  Array.isArray(e.loc) ? `${e.loc.join('.')}: ${e.msg ?? ''}` : JSON.stringify(e),
                )
                .join(' | ');
            } else if (j.detail != null) {
              detail = JSON.stringify(j.detail);
            }
          } else {
            detail = await response.text();
          }
        } catch {
          detail = '';
        }
        if (response.status === 422) {
          console.error('sync 422 payload_rejected', {
            id_formulario: form.id_formulario,
            id_usuario: form.id_usuario,
            gps_precision: form.gps?.precision,
            fotos_count: Array.isArray(form.fotos) ? form.fotos.length : -1,
            detail,
          });
        }
        const trimmed = detail.replace(/\s+/g, ' ').trim().slice(0, 800);
        throw new Error(trimmed ? `HTTP_${response.status}: ${trimmed}` : `HTTP_${response.status}`);
      }

      await db.historialFormularios.update(form.id_formulario, {
        estado: 'ENVIADO',
        fecha_envio: new Date().toISOString(),
        ultimo_error: undefined,
        datos_formulario: form.datos_formulario,
        gps: form.gps,
        fotos: form.fotos,
      });
      await db.formularios.delete(form.id_formulario);
      result.sent += 1;
    } catch (error) {
      result.failed += 1;
      const errores_sync = (form.errores_sync ?? 0) + 1;
      const message = error instanceof Error ? error.message : 'sync_error';
      if (!result.first_error) {
        result.first_error = message;
      }
      console.error('sync attempt failed', {
        id_formulario: form.id_formulario,
        id_usuario: form.id_usuario,
        message,
      });
      await db.formularios.update(form.id_formulario, {
        estado_sincronizacion: 'ERROR',
        errores_sync,
        fecha_intento: new Date().toISOString(),
        ultimo_error: message,
      });
      await db.historialFormularios.update(form.id_formulario, {
        estado: 'ERROR',
        ultimo_error: message,
      });
    }
  }
  return result;
};
