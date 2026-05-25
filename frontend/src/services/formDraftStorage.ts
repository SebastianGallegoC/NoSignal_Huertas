import { REQUIRED_FIELDS, type FormValues } from '@/types/formFields';
import type { FotoForm } from '@/services/db';

const KEY_PREFIX = 'nosignal:formulario-borrador:';

export type GpsDraft = {
  latitud: number;
  longitud: number;
  precision: number;
};

export type FormDraftV1 = {
  v: 1;
  savedAt: string;
  formId: string;
  /** Fecha original del formulario al editar uno existente (no regenerar al reenviar). */
  originalFechaHora?: string | null;
  modoCoordenadas?: 'automatico' | 'manual';
  formValues: FormValues;
  fotos: FotoForm[];
  gps: GpsDraft | null;
};

function storageKey(username: string): string {
  return `${KEY_PREFIX}${username || 'anon'}`;
}

export function loadFormDraft(username: string): FormDraftV1 | null {
  try {
    const raw = localStorage.getItem(storageKey(username));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const o = parsed as Record<string, unknown>;
    if (o.v !== 1 || typeof o.formId !== 'string') {
      return null;
    }
    if (!o.formValues || typeof o.formValues !== 'object') {
      return null;
    }
    return {
      v: 1,
      savedAt: typeof o.savedAt === 'string' ? o.savedAt : new Date().toISOString(),
      formId: o.formId,
      originalFechaHora:
        typeof o.originalFechaHora === 'string' && o.originalFechaHora.trim() !== ''
          ? o.originalFechaHora
          : null,
      modoCoordenadas: o.modoCoordenadas === 'manual' ? 'manual' : 'automatico',
      formValues: o.formValues as FormValues,
      fotos: Array.isArray(o.fotos) ? (o.fotos as FormDraftV1['fotos']) : [],
      gps:
        o.gps &&
        typeof o.gps === 'object' &&
        typeof (o.gps as GpsDraft).latitud === 'number' &&
        typeof (o.gps as GpsDraft).longitud === 'number' &&
        typeof (o.gps as GpsDraft).precision === 'number'
          ? (o.gps as GpsDraft)
          : null,
    };
  } catch {
    return null;
  }
}

export function saveFormDraft(username: string, draft: FormDraftV1): void {
  try {
    localStorage.setItem(storageKey(username), JSON.stringify(draft));
  } catch {
    // QuotaExceeded u otro: no bloquear la UI
  }
}

export function isEditFormDraft(draft: FormDraftV1 | null | undefined): boolean {
  return (
    draft != null &&
    typeof draft.originalFechaHora === 'string' &&
    draft.originalFechaHora.trim() !== ''
  );
}

export type FormularioDraftNavigation = {
  /** Entrada desde Inicio → «Completar formularios»: formulario nuevo vacío. */
  freshForm?: boolean;
  /** Entrada desde «Editar» en formularios diligenciados. */
  fromEdit?: boolean;
};

/**
 * Decide si cargar el borrador en localStorage al abrir /formulario.
 * Los borradores de edición abandonados no deben aparecer en un formulario nuevo.
 */
export function resolveInitialFormDraft(
  draft: FormDraftV1 | null,
  nav: FormularioDraftNavigation | null | undefined,
): FormDraftV1 | null {
  if (nav?.freshForm) {
    return null;
  }
  if (!draft) {
    return null;
  }
  if (isEditFormDraft(draft) && !nav?.fromEdit) {
    return null;
  }
  return draft;
}

export function clearFormDraft(username: string): void {
  try {
    localStorage.removeItem(storageKey(username));
  } catch {
    /* ignore */
  }
}

/** True si hay algo distinto a un formulario totalmente vacío (vale la pena guardar en localStorage). */
export function shouldPersistFormDraft(
  values: FormValues,
  emptyDefaults: FormValues,
  fotosCount: number,
  hasGps: boolean,
): boolean {
  if (fotosCount > 0 || hasGps) {
    return true;
  }
  for (const k of REQUIRED_FIELDS) {
    if ((values[k] ?? '').trim() !== (emptyDefaults[k] ?? '').trim()) {
      return true;
    }
  }
  return false;
}
