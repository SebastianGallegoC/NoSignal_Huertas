import type { GpsDraft } from "@/services/formDraftStorage";
import type { FotoForm } from "@/services/db";
import { REQUIRED_FIELDS, type FormValues } from "@/types/formFields";

export type FormularioEditBaseline = {
  formValues: FormValues;
  fotos: FotoForm[];
  gps: GpsDraft | null;
  modoCoordenadas: "automatico" | "manual";
};

function normalizeFieldValue(raw: unknown): string {
  return String(raw ?? "").trim();
}

export function formValuesEqualForEdit(a: FormValues, b: FormValues): boolean {
  for (const key of REQUIRED_FIELDS) {
    if (normalizeFieldValue(a[key]) !== normalizeFieldValue(b[key])) {
      return false;
    }
  }
  return true;
}

export function fotosEqualForEdit(a: FotoForm[], b: FotoForm[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (left.nombre_archivo !== right.nombre_archivo) {
      return false;
    }
    if (left.data !== right.data) {
      return false;
    }
    if (left.visita !== right.visita) {
      return false;
    }
  }
  return true;
}

export function gpsEqualForEdit(
  a: GpsDraft | null,
  b: GpsDraft | null,
): boolean {
  if (a == null && b == null) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  return (
    a.latitud === b.latitud &&
    a.longitud === b.longitud &&
    a.precision === b.precision
  );
}

/** True si el estado actual difiere del cargado al abrir «Editar». */
export function hasFormularioEditChanges(
  baseline: FormularioEditBaseline,
  current: FormularioEditBaseline,
): boolean {
  if (baseline.modoCoordenadas !== current.modoCoordenadas) {
    return true;
  }
  if (!formValuesEqualForEdit(baseline.formValues, current.formValues)) {
    return true;
  }
  if (!fotosEqualForEdit(baseline.fotos, current.fotos)) {
    return true;
  }
  if (!gpsEqualForEdit(baseline.gps, current.gps)) {
    return true;
  }
  return false;
}
