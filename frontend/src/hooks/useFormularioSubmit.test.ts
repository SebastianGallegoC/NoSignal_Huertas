import { describe, expect, it, vi } from "vitest";

import {
  buildDatosFormulario,
  buildOfflinePayload,
  getSectionsWithErrors,
} from "@/hooks/useFormularioSubmit";
import { GPS_PLACEHOLDER_WHEN_NOT_CAPTURED } from "@/constants/gpsConfig";
import { REQUIRED_FIELDS, type FormValues } from "@/types/formFields";

const buildEmptyValues = (): FormValues => {
  return Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, ""])) as FormValues;
};

describe("useFormularioSubmit helpers", () => {
  it("buildDatosFormulario incluye solo campos requeridos", () => {
    const values = buildEmptyValues();
    values.entidad_aportante = "Entidad A";
    values.nombre_actividad = "Visita";

    const data = buildDatosFormulario(values, REQUIRED_FIELDS);

    expect(data).toHaveProperty("entidad_aportante", "Entidad A");
    expect(data).toHaveProperty("nombre_actividad", "Visita");
    expect(Object.keys(data)).toHaveLength(REQUIRED_FIELDS.length);
  });

  it("buildOfflinePayload limita precision GPS y sanea usuario", () => {
    const values = buildEmptyValues();
    values.nombre_actividad = "Actividad";
    values.nombres_apellidos_beneficiario = "Beneficiario";

    const toSafeUserId = vi.fn((raw: string) => raw.trim().toLowerCase());
    const payload = buildOfflinePayload({
      values,
      requiredFields: REQUIRED_FIELDS,
      formId: "form-123",
      originalFechaHora: null,
      idUsuario: "",
      authUsername: "  Usuario Prueba  ",
      gps: { latitud: 4.1, longitud: -74.1, precision: 9.9 },
      fotos: [{ nombre_archivo: "f1.jpg", data: "data:image/jpg;base64,AA==" }],
      toSafeUserId,
    });

    expect(toSafeUserId).toHaveBeenCalledWith("  Usuario Prueba  ");
    expect(payload.id_formulario).toBe("form-123");
    expect(payload.id_usuario).toBe("usuario prueba");
    expect(payload.gps.precision).toBe(5);
    expect(payload.estado_sincronizacion).toBe("PENDIENTE");
    expect(payload.modo_coordenadas).toBe("automatico");
  });

  it("modo manual conserva decimales en datos_formulario y gps", () => {
    const values = buildEmptyValues();
    values.nombres_apellidos_beneficiario = "B";
    values.latitud = "4.6097";
    values.longitud = "-74.08";

    const payload = buildOfflinePayload({
      values,
      requiredFields: REQUIRED_FIELDS,
      formId: "form-decimals",
      originalFechaHora: null,
      idUsuario: "demo",
      authUsername: null,
      gps: { latitud: 4.6097123456, longitud: -74.081751234, precision: 1 },
      fotos: [],
      toSafeUserId: (raw) => raw,
      modoCoordenadas: "manual",
    });

    expect(payload.datos_formulario.latitud).toBe("4.6097");
    expect(payload.datos_formulario.longitud).toBe("-74.08");
    expect(payload.gps.latitud).toBe(4.6097);
    expect(payload.gps.longitud).toBe(-74.08);
  });

  it("modo automático redondea gps y datos a 6 decimales", () => {
    const values = buildEmptyValues();
    values.nombres_apellidos_beneficiario = "B";
    values.latitud = "4.6097123456";
    values.longitud = "-74.081751234";

    const payload = buildOfflinePayload({
      values,
      requiredFields: REQUIRED_FIELDS,
      formId: "form-gps-6",
      originalFechaHora: null,
      idUsuario: "demo",
      authUsername: null,
      gps: { latitud: 4.6097123456, longitud: -74.081751234, precision: 1 },
      fotos: [],
      toSafeUserId: (raw) => raw,
      modoCoordenadas: "automatico",
    });

    expect(payload.datos_formulario.latitud).toBe("4.609712");
    expect(payload.datos_formulario.longitud).toBe("-74.081751");
    expect(payload.gps.latitud).toBe(4.609712);
    expect(payload.gps.longitud).toBe(-74.081751);
  });

  it("buildOfflinePayload persiste modo_coordenadas manual", () => {
    const values = buildEmptyValues();
    values.nombre_actividad = "Actividad";
    values.nombres_apellidos_beneficiario = "B";

    const payload = buildOfflinePayload({
      values,
      requiredFields: REQUIRED_FIELDS,
      formId: "form-manual",
      originalFechaHora: null,
      idUsuario: "demo",
      authUsername: null,
      gps: { latitud: 4.1, longitud: -74.1, precision: 1 },
      fotos: [],
      toSafeUserId: (raw) => raw,
      modoCoordenadas: "manual",
    });

    expect(payload.modo_coordenadas).toBe("manual");
  });

  it("buildOfflinePayload corrige precision GPS <= 0 a mínimo válido", () => {
    const values = buildEmptyValues();
    values.nombres_apellidos_beneficiario = "B";
    const payload = buildOfflinePayload({
      values,
      requiredFields: REQUIRED_FIELDS,
      formId: "form-precision-0",
      originalFechaHora: null,
      idUsuario: "demo",
      authUsername: null,
      gps: { latitud: 4.1, longitud: -74.1, precision: 0 },
      fotos: [],
      toSafeUserId: (raw) => raw,
    });

    expect(payload.gps.precision).toBe(0.1);
  });

  it("buildOfflinePayload usa placeholder si no hay GPS", () => {
    const values = buildEmptyValues();
    values.nombres_apellidos_beneficiario = "Solo nombre";
    const payload = buildOfflinePayload({
      values,
      requiredFields: REQUIRED_FIELDS,
      formId: "form-sin-gps",
      originalFechaHora: null,
      idUsuario: "demo",
      authUsername: null,
      gps: null,
      fotos: [],
      toSafeUserId: (raw) => raw,
    });
    expect(payload.gps).toEqual({
      latitud: GPS_PLACEHOLDER_WHEN_NOT_CAPTURED.latitud,
      longitud: GPS_PLACEHOLDER_WHEN_NOT_CAPTURED.longitud,
      precision: 5,
    });
  });

  it("getSectionsWithErrors ubica secciones afectadas", () => {
    const sections = getSectionsWithErrors([
      "entidad_aportante",
      "nombres_apellidos_beneficiario",
    ]);

    expect(sections.has("actividad")).toBe(true);
    expect(sections.has("beneficiario")).toBe(true);
    expect(sections.has("nucleo")).toBe(false);
  });

  it("formulario nuevo: fecha_hora y fecha_actualizacion coinciden", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T10:20:30.000Z"));
    const values = buildEmptyValues();
    values.nombres_apellidos_beneficiario = "B";
    const payload = buildOfflinePayload({
      values,
      requiredFields: REQUIRED_FIELDS,
      formId: "form-nuevo",
      originalFechaHora: null,
      idUsuario: "demo",
      authUsername: null,
      gps: { latitud: 4.1, longitud: -74.1, precision: 1 },
      fotos: [],
      toSafeUserId: (raw) => raw,
    });
    expect(payload.fecha_hora).toBe("2026-05-01T10:20:30.000Z");
    expect(payload.fecha_actualizacion).toBe("2026-05-01T10:20:30.000Z");
    vi.useRealTimers();
  });

  it("reedición: conserva fecha_hora inicial y marca fecha_actualizacion al guardar", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T18:00:00.000Z"));
    const values = buildEmptyValues();
    values.nombres_apellidos_beneficiario = "B";
    const payload = buildOfflinePayload({
      values,
      requiredFields: REQUIRED_FIELDS,
      formId: "form-existente",
      originalFechaHora: "2026-01-10T08:00:00.000Z",
      idUsuario: "demo",
      authUsername: null,
      gps: { latitud: 4.1, longitud: -74.1, precision: 1 },
      fotos: [],
      toSafeUserId: (raw) => raw,
    });
    expect(payload.fecha_hora).toBe("2026-01-10T08:00:00.000Z");
    expect(payload.fecha_actualizacion).toBe("2026-06-15T18:00:00.000Z");
    vi.useRealTimers();
  });
});
