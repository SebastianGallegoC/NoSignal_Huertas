import { inputKindForField } from "@/config/formFieldMeta";
import type { OfflineForm } from "@/services/db";
import { REQUIRED_FIELDS, type FormFieldKey, type FormValues } from "@/types/formFields";

const MAX_GPS_ACCURACY_METERS = 100;
const MIN_PHOTOS = 0;
const MAX_PHOTOS = 15;
const TRI_ALLOWED = new Set(["Si", "No", "NR"]);
const PHONE_RE = /^[0-9+\-()\s]{6,20}$/;

export interface ValidationIssue {
  code: string;
  message: string;
}

function isBlank(value: unknown): boolean {
  return value == null || String(value).trim() === "";
}

function parseDateSafe(value: unknown): number | null {
  if (isBlank(value)) {
    return null;
  }
  const ts = Date.parse(String(value));
  return Number.isNaN(ts) ? null : ts;
}

/**
 * Validación de contenido del cuestionario cuando hay datos ingresados.
 * No exige completar el formulario: el envío offline solo exige GPS (y fotos
 * dentro de rango) vía `validateOfflineFormPayload`; el API acepta
 * `datos_formulario` parcial o vacío.
 */
export const validateFormValues = (values: FormValues): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  if (!isBlank(values.edad)) {
    const edad = Number(values.edad);
    if (!Number.isFinite(edad) || edad < 0 || edad > 120) {
      issues.push({ code: "edad_range", message: "Edad fuera de rango (0-120)." });
    }
  }

  if (!isBlank(values.telefono) && !PHONE_RE.test(values.telefono.trim())) {
    issues.push({ code: "telefono_format", message: "Formato de teléfono inválido." });
  }

  if (!isBlank(values.satisfaccion_1_5)) {
    const score = Number(values.satisfaccion_1_5);
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      issues.push({ code: "satisfaccion_range", message: "Satisfacción debe estar entre 1 y 5." });
    }
  }

  for (const key of REQUIRED_FIELDS) {
    if (inputKindForField(key as FormFieldKey) === "select-tri" && !isBlank(values[key])) {
      if (!TRI_ALLOWED.has(String(values[key]).trim())) {
        issues.push({
          code: `tri_${key}`,
          message: `Respuesta inválida en ${key}. Debe ser Si/No/NR.`,
        });
      }
    }
  }

  const f1 = parseDateSafe(values.fecha_visita_1);
  const f2 = parseDateSafe(values.fecha_visita_2);
  const f3 = parseDateSafe(values.fecha_visita_3);
  if (
    (!isBlank(values.fecha_visita_1) && f1 == null) ||
    (!isBlank(values.fecha_visita_2) && f2 == null) ||
    (!isBlank(values.fecha_visita_3) && f3 == null)
  ) {
    issues.push({
      code: "fechas_visita_invalid",
      message: "Las fechas de visita deben tener formato válido.",
    });
  } else if ((f1 != null && f2 != null && f1 > f2) || (f2 != null && f3 != null && f2 > f3)) {
    issues.push({
      code: "fechas_visita_order",
      message: "Las fechas deben estar en orden: visita 1 <= visita 2 <= visita 3.",
    });
  }

  return issues;
};

const toFormValuesFromPayload = (payload: OfflineForm): FormValues => {
  const out = {} as FormValues;
  for (const key of REQUIRED_FIELDS) {
    const v = payload.datos_formulario[key];
    out[key] = typeof v === "string" ? v : v == null ? "" : String(v);
  }
  return out;
};

export const validateOfflineFormPayload = (form: OfflineForm): ValidationIssue[] => {
  const issues = validateFormValues(toFormValuesFromPayload(form));

  if (!form.gps || form.gps.precision > MAX_GPS_ACCURACY_METERS) {
    issues.push({
      code: "gps_precision",
      message: "GPS con precisión ≤ 100 m (usá “Tomar ubicación”).",
    });
  }

  if (!Array.isArray(form.fotos) || form.fotos.length < MIN_PHOTOS || form.fotos.length > MAX_PHOTOS) {
    issues.push({
      code: "fotos_count",
      message: "Máximo 15 fotos comprimidas.",
    });
  }

  return issues;
};

export const joinValidationMessages = (issues: ValidationIssue[]): string =>
  issues.map((i) => i.message).join(" ");
