import { describe, expect, it } from "vitest";

import {
  fotosEqualForEdit,
  formValuesEqualForEdit,
  hasFormularioEditChanges,
  type FormularioEditBaseline,
} from "@/lib/formEditDirty";
import { REQUIRED_FIELDS, type FormValues } from "@/types/formFields";

function emptyValues(): FormValues {
  return Object.fromEntries(REQUIRED_FIELDS.map((k) => [k, ""])) as FormValues;
}

function baseline(overrides: Partial<FormularioEditBaseline> = {}): FormularioEditBaseline {
  return {
    formValues: emptyValues(),
    fotos: [],
    gps: null,
    modoCoordenadas: "automatico",
    ...overrides,
  };
}

describe("hasFormularioEditChanges", () => {
  it("detecta cambio en un campo de texto", () => {
    const base = baseline();
    const current = baseline({
      formValues: { ...emptyValues(), nombres_apellidos_beneficiario: "Ana" },
    });
    expect(hasFormularioEditChanges(base, current)).toBe(true);
  });

  it("detecta cambio en fotos", () => {
    const base = baseline();
    const current = baseline({
      fotos: [
        {
          nombre_archivo: "a.jpg",
          data: "data:image/jpeg;base64,AA==",
          visita: 1,
        },
      ],
    });
    expect(hasFormularioEditChanges(base, current)).toBe(true);
  });

  it("devuelve false si no hubo cambios", () => {
    const base = baseline({
      formValues: { ...emptyValues(), entidad_aportante: "CENS" },
      fotos: [
        {
          nombre_archivo: "a.jpg",
          data: "data:1",
          visita: 2,
        },
      ],
      gps: { latitud: 4.6, longitud: -74.1, precision: 5 },
      modoCoordenadas: "manual",
    });
    expect(hasFormularioEditChanges(base, { ...base })).toBe(false);
  });
});

describe("formValuesEqualForEdit", () => {
  it("ignora espacios al comparar", () => {
    const a = { ...emptyValues(), telefono: " 300 " };
    const b = { ...emptyValues(), telefono: "300" };
    expect(formValuesEqualForEdit(a, b)).toBe(true);
  });
});

describe("fotosEqualForEdit", () => {
  it("distingue visita", () => {
    const foto = {
      nombre_archivo: "a.jpg",
      data: "data:1",
      visita: 1 as const,
    };
    expect(
      fotosEqualForEdit([foto], [{ ...foto, visita: 4 }]),
    ).toBe(false);
  });
});
