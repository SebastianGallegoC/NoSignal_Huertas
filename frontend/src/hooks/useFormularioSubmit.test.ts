import { describe, expect, it, vi } from "vitest";

import {
  buildDatosFormulario,
  buildOfflinePayload,
  getSectionsWithErrors,
} from "@/hooks/useFormularioSubmit";
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

    const toSafeUserId = vi.fn((raw: string) => raw.trim().toLowerCase());
    const payload = buildOfflinePayload({
      values,
      requiredFields: REQUIRED_FIELDS,
      formId: "form-123",
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
});
