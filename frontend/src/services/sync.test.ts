import { describe, expect, it } from "vitest";

import type { OfflineForm } from "./db";
import { validateFormPayload } from "./sync";

const baseForm = (): OfflineForm => ({
  id_formulario: "f-1",
  id_usuario: "user",
  fecha_hora: "2026-05-04T12:00:00Z",
  gps: { latitud: 1.23, longitud: -76.5, precision: 10 },
  datos_formulario: {},
  fotos: [],
  estado_sincronizacion: "PENDIENTE",
});

describe("validateFormPayload", () => {
  it("acepta payload válido", () => {
    const errors = validateFormPayload(baseForm());
    expect(errors).toEqual([]);
  });

  it("marca error cuando la precisión GPS supera el umbral", () => {
    const form = baseForm();
    form.gps.precision = 101;
    const errors = validateFormPayload(form);
    expect(errors).toContain("gps_precision");
  });

  it("marca error cuando excede el máximo de fotos", () => {
    const form = baseForm();
    form.fotos = new Array(16).fill(0).map((_, i) => ({
      nombre_archivo: `f${i}.jpg`,
      data: "data:image/jpeg;base64,abc",
    }));
    const errors = validateFormPayload(form);
    expect(errors).toContain("fotos_count");
  });
});
