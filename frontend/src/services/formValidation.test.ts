import { describe, expect, it } from "vitest";

import type { OfflineForm } from "@/services/db";
import {
  validateFormValues,
  validateOfflineFormPayload,
} from "@/services/formValidation";
import { REQUIRED_FIELDS, type FormValues } from "@/types/formFields";

const emptyValues = (): FormValues =>
  Object.fromEntries(REQUIRED_FIELDS.map((k) => [k, ""])) as FormValues;

describe("formValidation — envío mínimo", () => {
  it("validateFormValues no marca obligatorios en formulario vacío", () => {
    const issues = validateFormValues(emptyValues());
    expect(issues.filter((i) => i.code.startsWith("field_"))).toHaveLength(0);
  });

  it("validateOfflineFormPayload solo exige GPS válido y fotos en rango", () => {
    const datos: Record<string, unknown> = {};
    for (const k of REQUIRED_FIELDS) {
      datos[k] = "";
    }
    const form: OfflineForm = {
      id_formulario: "x",
      id_usuario: "u",
      fecha_hora: new Date().toISOString(),
      gps: { latitud: 4.6, longitud: -74.08, precision: 10 },
      datos_formulario: datos,
      fotos: [],
      estado_sincronizacion: "PENDIENTE",
    };
    const issues = validateOfflineFormPayload(form);
    expect(issues).toHaveLength(0);
  });
});
