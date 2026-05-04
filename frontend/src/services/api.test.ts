import { afterEach, describe, expect, it, vi } from "vitest";

import { listFormsFromApi } from "./api";

describe("listFormsFromApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("devuelve items del backend cuando la respuesta es 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id_formulario: "f-1",
              id_usuario: "u-1",
              fecha_hora: "2026-05-04T12:00:00Z",
              latitud: 1.2,
              longitud: -76.5,
              precision: null,
              datos_formulario: {},
              fotos: [],
            },
          ],
        }),
      }),
    );
    const rows = await listFormsFromApi(20);
    expect(rows).toHaveLength(1);
    expect(rows[0].id_formulario).toBe("f-1");
  });

  it("lanza error cuando el backend no responde OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        text: async () => "boom",
      }),
    );
    await expect(listFormsFromApi()).rejects.toThrow("boom");
  });
});
