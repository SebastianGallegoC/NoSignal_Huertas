import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OfflineForm } from "./db";

const mocks = vi.hoisted(() => ({
  historialGet: vi.fn(),
  historialPut: vi.fn(),
  formulariosPut: vi.fn(),
  precargasGet: vi.fn(),
  precargasPut: vi.fn(),
}));

vi.mock("./db", () => ({
  db: {
    historialFormularios: {
      get: mocks.historialGet,
      put: mocks.historialPut,
    },
    formularios: {
      put: mocks.formulariosPut,
    },
    precargas: {
      get: mocks.precargasGet,
      put: mocks.precargasPut,
    },
  },
}));

import { enqueueForm } from "./sync";

const baseForm = (): OfflineForm => ({
  id_formulario: "f-1",
  id_usuario: "user",
  fecha_hora: "2026-05-04T12:00:00Z",
  fecha_actualizacion: "2026-05-10T15:00:00Z",
  gps: { latitud: 1.23, longitud: -76.5, precision: 5 },
  datos_formulario: { campo: "inicial" },
  fotos: [
    {
      nombre_archivo: "a.jpg",
      data: "data:image/jpeg;base64,AAA",
      visita: 1,
    },
  ],
  estado_sincronizacion: "PENDIENTE",
});

describe("enqueueForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.historialGet.mockResolvedValue(undefined);
    mocks.formulariosPut.mockResolvedValue(undefined);
    mocks.historialPut.mockResolvedValue(undefined);
    mocks.precargasPut.mockResolvedValue(undefined);
  });

  it("actualiza precarga cuando ya existe entrada para ese id", async () => {
    mocks.precargasGet.mockResolvedValue({
      id_formulario: "f-1",
      fecha_precarga: "2026-05-01T10:00:00Z",
      datos_formulario: { campo: "viejo" },
      auto_precarga: true,
    });
    const form = baseForm();
    form.datos_formulario = { campo: "editado", otro: 1 };

    await enqueueForm(form);

    expect(mocks.precargasPut).toHaveBeenCalledTimes(1);
    const saved = mocks.precargasPut.mock.calls[0][0];
    expect(saved.id_formulario).toBe("f-1");
    expect(saved.auto_precarga).toBe(true);
    expect(saved.datos_formulario).toEqual({ campo: "editado", otro: 1 });
    expect(saved.gps).toEqual(form.gps);
    expect(saved.fotos).toEqual(form.fotos);
    expect(saved.fecha_precarga).not.toBe("2026-05-01T10:00:00Z");
  });

  it("no llama precargas.put si no hay precarga previa", async () => {
    mocks.precargasGet.mockResolvedValue(undefined);
    await enqueueForm(baseForm());
    expect(mocks.precargasPut).not.toHaveBeenCalled();
  });
});
