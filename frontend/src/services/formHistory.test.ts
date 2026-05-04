import { describe, expect, it } from "vitest";

import type { HistorialForm, PrecargaForm } from "@/services/db";
import {
  getBeneficiarioDisplayName,
  mergeFormsWithPrecargas,
  normalizeTextoBusqueda,
  type DisplayRow,
} from "@/services/formHistory";

describe("formHistory — beneficiario", () => {
  it("getBeneficiarioDisplayName prioriza historial y recorta espacios", () => {
    const row: DisplayRow = {
      id_formulario: "a",
      onServer: true,
      server: {
        id_formulario: "a",
        id_usuario: "u",
        fecha_hora: "2026-01-01T00:00:00Z",
        latitud: 0,
        longitud: 0,
        precision: 1,
        datos_formulario: { nombres_apellidos_beneficiario: "  Ana Pérez  " },
        fotos: [],
      },
      historial: {
        id_formulario: "a",
        id_usuario: "u",
        fecha_hora: "2026-01-01T00:00:00Z",
        estado: "ENVIADO",
        datos_formulario: {
          nombres_apellidos_beneficiario: "  Local Gómez  ",
        },
      } satisfies HistorialForm,
    };
    expect(getBeneficiarioDisplayName(row)).toBe("Local Gómez");
  });

  it("getBeneficiarioDisplayName usa servidor si no hay historial", () => {
    const row: DisplayRow = {
      id_formulario: "b",
      onServer: true,
      server: {
        id_formulario: "b",
        id_usuario: "u",
        fecha_hora: "2026-01-01T00:00:00Z",
        latitud: 0,
        longitud: 0,
        precision: 1,
        datos_formulario: { nombres_apellidos_beneficiario: "Remoto Solo" },
        fotos: [],
      },
    };
    expect(getBeneficiarioDisplayName(row)).toBe("Remoto Solo");
  });

  it("normalizeTextoBusqueda quita tildes para comparar", () => {
    expect(normalizeTextoBusqueda("  José  ")).toBe("jose");
  });

  it("getBeneficiarioDisplayName lee precargaSolo", () => {
    const row: DisplayRow = {
      id_formulario: "p1",
      onServer: false,
      precargaSolo: {
        id_formulario: "p1",
        fecha_precarga: "2026-05-01T12:00:00Z",
        datos_formulario: {
          nombres_apellidos_beneficiario: "  Ana Offline  ",
        },
      } satisfies PrecargaForm,
    };
    expect(getBeneficiarioDisplayName(row)).toBe("Ana Offline");
  });

  it("mergeFormsWithPrecargas agrega fila huérfana cuando no hay server ni historial", () => {
    const precarga: PrecargaForm = {
      id_formulario: "solo-p",
      fecha_precarga: "2026-05-02T10:00:00Z",
      datos_formulario: { nombres_apellidos_beneficiario: "X" },
    };
    const merged = mergeFormsWithPrecargas([], [], [precarga]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id_formulario).toBe("solo-p");
    expect(merged[0].precargaSolo).toEqual(precarga);
  });

  it("mergeFormsWithPrecargas no duplica si el id ya está en historial", () => {
    const h: HistorialForm = {
      id_formulario: "a",
      id_usuario: "u",
      fecha_hora: "2026-01-01T00:00:00Z",
      estado: "ENVIADO",
    };
    const precarga: PrecargaForm = {
      id_formulario: "a",
      fecha_precarga: "2026-05-02T10:00:00Z",
      datos_formulario: {},
    };
    const merged = mergeFormsWithPrecargas([], [h], [precarga]);
    expect(merged).toHaveLength(1);
    expect(merged[0].historial).toEqual(h);
    expect(merged[0].precargaSolo).toBeUndefined();
  });
});
