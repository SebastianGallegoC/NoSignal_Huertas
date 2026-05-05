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

  it("validateOfflineFormPayload exige visita 1/2/3 en cada foto", () => {
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
      fotos: [{ nombre_archivo: "a.jpg", data: "data:image/jpeg;base64,AA==" }],
      estado_sincronizacion: "PENDIENTE",
    };
    const issues = validateOfflineFormPayload(form);
    expect(issues.map((i) => i.code)).toContain("fotos_visita_required");
  });

  it("validateOfflineFormPayload rechaza fecha_actualizacion anterior a fecha_hora", () => {
    const datos: Record<string, unknown> = {};
    for (const k of REQUIRED_FIELDS) {
      datos[k] = "";
    }
    const form: OfflineForm = {
      id_formulario: "x",
      id_usuario: "u",
      fecha_hora: "2026-05-10T12:00:00.000Z",
      fecha_actualizacion: "2026-05-01T12:00:00.000Z",
      gps: { latitud: 4.6, longitud: -74.08, precision: 10 },
      datos_formulario: datos,
      fotos: [],
      estado_sincronizacion: "PENDIENTE",
    };
    const issues = validateOfflineFormPayload(form);
    expect(issues.map((i) => i.code)).toContain("fecha_actualizacion_before_envio");
  });
});
