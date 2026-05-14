import { MAX_GPS_ACCURACY_METERS } from "@/constants/gpsConfig";
import {
  normalizeTelefonoStoredValue,
  TELEFONO_NO_TIENE_VALUE,
} from "@/lib/telefonoNormalize";
import {
  fieldLabel,
  inputKindForField,
  SI_NO_IMPORT_NORMALIZE_FIELDS,
} from "@/config/formFieldMeta";
import {
  COORD_NUMERIC_FIELD_KEYS,
  normalizeCoordNumericCell,
} from "@/lib/coordNumericToken";
import type { OfflineForm } from "@/services/db";
import { REQUIRED_FIELDS, type FormFieldKey, type FormValues } from "@/types/formFields";
const MIN_PHOTOS = 0;
const MAX_PHOTOS = 15;
const TRI_ALLOWED = new Set(["Si", "No", "NR"]);
const PHONE_RE = /^[0-9+\-()\s]{6,20}$/;

export interface ValidationIssue {
  code: string;
  message: string;
}

/** Mensaje unificado para fechas en Excel/importación y validación de valores. */
export const FECHA_FORMATO_MSG =
  "Fecha no válida. Ejemplos: 15/03/2026 (día/mes/año) o 2026-03-15.";

export type FormValueFieldIssue = {
  field: FormFieldKey;
  code: string;
  message: string;
};

export type FormValueRowIssue = {
  code: string;
  message: string;
};

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
 * Validación por campo (y mensajes de fila) para mostrar errores en UI de importación.
 * El envío a cola solo exige nombre del beneficiario (vía `validateOfflineFormPayload`);
 * el resto de campos puede ir vacío. Si hay fotos, deben tener visita 1–3.
 */
export const validateFormValuesWithFieldDetails = (
  values: FormValues,
): { fieldIssues: FormValueFieldIssue[]; rowIssues: FormValueRowIssue[] } => {
  const fieldIssues: FormValueFieldIssue[] = [];
  const rowIssues: FormValueRowIssue[] = [];

  if (!isBlank(values.edad)) {
    const edad = Number(values.edad);
    if (!Number.isFinite(edad) || edad < 0 || edad > 120) {
      fieldIssues.push({
        field: "edad",
        code: "edad_range",
        message: "Edad fuera de rango (0-120).",
      });
    }
  }

  if (!isBlank(values.telefono)) {
    const tel = normalizeTelefonoStoredValue(String(values.telefono));
    if (
      tel !== TELEFONO_NO_TIENE_VALUE &&
      !PHONE_RE.test(tel.trim())
    ) {
      fieldIssues.push({
        field: "telefono",
        code: "telefono_format",
        message:
          "Teléfono inválido. Usá 6–20 caracteres (dígitos, +, -, espacios, paréntesis) o la opción «No tiene».",
      });
    }
  }

  if (!isBlank(values.satisfaccion_1_5)) {
    const score = Number(values.satisfaccion_1_5);
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      fieldIssues.push({
        field: "satisfaccion_1_5",
        code: "satisfaccion_range",
        message: "Satisfacción debe ser un entero entre 1 y 5.",
      });
    }
  }

  for (const key of REQUIRED_FIELDS) {
    const fk = key as FormFieldKey;
    if (
      inputKindForField(fk) === "number" &&
      fk !== "edad" &&
      fk !== "satisfaccion_1_5" &&
      !isBlank(values[key])
    ) {
      const raw = COORD_NUMERIC_FIELD_KEYS.has(fk)
        ? normalizeCoordNumericCell(String(values[key]))
        : String(values[key]).replace(/\s/g, "").replace(",", ".");
      if (raw === "" || !Number.isFinite(Number(raw))) {
        fieldIssues.push({
          field: fk,
          code: "number_invalid",
          message: `«${fieldLabel(fk)}» debe ser un número válido (podés usar punto o coma decimal).`,
        });
      }
    }
    if (inputKindForField(fk) === "select-tri" && !isBlank(values[key])) {
      if (!TRI_ALLOWED.has(String(values[key]).trim())) {
        fieldIssues.push({
          field: fk,
          code: `tri_${key}`,
          message: `En «${fieldLabel(fk)}» usá exactamente: Si, No o NR.`,
        });
      }
    }
    if (SI_NO_IMPORT_NORMALIZE_FIELDS.has(fk) && !isBlank(values[key])) {
      const v = String(values[key]).trim();
      if (v !== "Si" && v !== "No") {
        fieldIssues.push({
          field: fk,
          code: `si_no_${key}`,
          message: `En «${fieldLabel(fk)}» usá Si o No.`,
        });
      }
    }
  }

  for (const key of ["fecha_inicio", "fecha_fin"] as const) {
    if (!isBlank(values[key]) && parseDateSafe(values[key]) == null) {
      fieldIssues.push({
        field: key,
        code: "fecha_invalid",
        message: FECHA_FORMATO_MSG,
      });
    }
  }

  const visitaKeys = ["fecha_visita_1", "fecha_visita_2", "fecha_visita_3"] as const;
  let visitaParseOk = true;
  for (const key of visitaKeys) {
    if (!isBlank(values[key]) && parseDateSafe(values[key]) == null) {
      visitaParseOk = false;
      fieldIssues.push({
        field: key,
        code: "fecha_invalid",
        message: FECHA_FORMATO_MSG,
      });
    }
  }

  const f1 = parseDateSafe(values.fecha_visita_1);
  const f2 = parseDateSafe(values.fecha_visita_2);
  const f3 = parseDateSafe(values.fecha_visita_3);
  if (
    visitaParseOk &&
    ((f1 != null && f2 != null && f1 > f2) || (f2 != null && f3 != null && f2 > f3))
  ) {
    rowIssues.push({
      code: "fechas_visita_order",
      message:
        "Las fechas de visita deben estar en orden cronológico: visita 1 ≤ visita 2 ≤ visita 3.",
    });
  }

  return { fieldIssues, rowIssues };
};

export const validateFormValues = (values: FormValues): ValidationIssue[] => {
  const { fieldIssues, rowIssues } = validateFormValuesWithFieldDetails(values);
  return [
    ...fieldIssues.map((i) => ({ code: i.code, message: i.message })),
    ...rowIssues.map((i) => ({ code: i.code, message: i.message })),
  ];
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

  if (
    isBlank(
      (form.datos_formulario as Record<string, unknown>)
        .nombres_apellidos_beneficiario,
    )
  ) {
    issues.push({
      code: "beneficiario_required",
      message: "El nombre del beneficiario es obligatorio para enviar.",
    });
  }

  const tsEnvio = parseDateSafe(form.fecha_hora);
  if (tsEnvio == null) {
    issues.push({
      code: "fecha_hora_invalid",
      message: "La fecha del formulario no es válida.",
    });
  }
  if (form.fecha_actualizacion != null && String(form.fecha_actualizacion).trim() !== "") {
    const tsAct = parseDateSafe(form.fecha_actualizacion);
    if (tsAct == null) {
      issues.push({
        code: "fecha_actualizacion_invalid",
        message: "La fecha de actualización no es válida.",
      });
    } else if (tsEnvio != null && tsAct < tsEnvio) {
      issues.push({
        code: "fecha_actualizacion_before_envio",
        message: "La fecha de actualización no puede ser anterior al primer guardado.",
      });
    }
  }

  if (form.gps.precision > MAX_GPS_ACCURACY_METERS) {
    issues.push({
      code: "gps_precision",
      message: `GPS con precisión ≤ ${MAX_GPS_ACCURACY_METERS} m (usá “Tomar ubicación”).`,
    });
  }

  if (!Array.isArray(form.fotos) || form.fotos.length < MIN_PHOTOS || form.fotos.length > MAX_PHOTOS) {
    issues.push({
      code: "fotos_count",
      message: "Máximo 15 fotos comprimidas.",
    });
  }

  if (
    Array.isArray(form.fotos) &&
    form.fotos.some((f) => f.visita !== 1 && f.visita !== 2 && f.visita !== 3)
  ) {
    issues.push({
      code: "fotos_visita_required",
      message: "Cada foto debe estar asociada a visita 1, 2 o 3.",
    });
  }

  return issues;
};

export const joinValidationMessages = (issues: ValidationIssue[]): string =>
  issues.map((i) => i.message).join(" ");
