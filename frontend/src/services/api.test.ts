import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteFormFromApi, listFormsFromApi, loginApi } from "./api";

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

describe("deleteFormFromApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resuelve sin error cuando el backend responde 204", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        text: async () => "",
      }),
    );
    await expect(deleteFormFromApi("f-1")).resolves.toBeUndefined();
  });

  it("lanza cuando el backend responde 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "not found",
      }),
    );
    await expect(deleteFormFromApi("missing")).rejects.toThrow("not found");
  });
});

describe("loginApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna token cuando responde 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "abc",
          token_type: "bearer",
          expires_in: 3600,
        }),
      }),
    );
    await expect(loginApi("demo", "demo")).resolves.toMatchObject({
      access_token: "abc",
    });
  });

  it("lanza LoginApiError con status y detail cuando backend falla", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "invalid_credentials",
      }),
    );
    await expect(loginApi("demo", "bad")).rejects.toMatchObject({
      name: "LoginApiError",
      status: 401,
      detail: "invalid_credentials",
    });
  });
});
