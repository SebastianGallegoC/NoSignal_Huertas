import { describe, expect, it } from "vitest";

import type { FormReadItem } from "@/services/api";
import type { HistorialForm, PrecargaForm } from "@/services/db";
import {
  filterDisplayRowsWithPrecarga,
  getBeneficiarioDisplayName,
  mapServerFotos,
  mergeFormsWithPrecargas,
  normalizeTextoBusqueda,
  reconcileLocalStateWithTrustedServerList,
  rowsForOfflineAwareList,
  type DisplayRow,
} from "@/services/formHistory";

describe("formHistory — beneficiario", () => {
  it("getBeneficiarioDisplayName prioriza servidor y recorta espacios", () => {
    const row: DisplayRow = {
      id_formulario: "a",
      onServer: true,
      server: {
        id_formulario: "a",
        id_usuario: "u",
        fecha_hora: "2026-01-01T00:00:00Z",
        fecha_actualizacion: "2026-01-01T00:00:00Z",
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
    expect(getBeneficiarioDisplayName(row)).toBe("Ana Pérez");
  });

  it("getBeneficiarioDisplayName usa servidor si no hay historial", () => {
    const row: DisplayRow = {
      id_formulario: "b",
      onServer: true,
      server: {
        id_formulario: "b",
        id_usuario: "u",
        fecha_hora: "2026-01-01T00:00:00Z",
        fecha_actualizacion: "2026-01-01T00:00:00Z",
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

  it("mapServerFotos incluye visita cuando el API devuelve objetos { path, visita }", () => {
    const out = mapServerFotos("fid", [
      { path: "uploads/x/foto_1.jpg", visita: 2 },
      "uploads/y/foto_2.jpg",
    ]);
    expect(out).toHaveLength(2);
    const a = out[0];
    const b = out[1];
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a!.visita).toBe(2);
    expect(a!.path).toContain("foto_1.jpg");
    expect(b!.visita).toBeUndefined();
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

  it("getBeneficiarioDisplayName prioriza precarga sobre historial cuando no hay servidor", () => {
    const row: DisplayRow = {
      id_formulario: "p2",
      onServer: false,
      historial: {
        id_formulario: "p2",
        id_usuario: "u",
        fecha_hora: "2026-01-01T00:00:00Z",
        estado: "ENVIADO",
        datos_formulario: {
          nombres_apellidos_beneficiario: "Nombre Historial",
        },
      } satisfies HistorialForm,
      precargaSolo: {
        id_formulario: "p2",
        fecha_precarga: "2026-05-01T12:00:00Z",
        datos_formulario: {
          nombres_apellidos_beneficiario: "Nombre Precarga",
        },
      } satisfies PrecargaForm,
    };
    expect(getBeneficiarioDisplayName(row)).toBe("Nombre Precarga");
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

  it("filterDisplayRowsWithPrecarga: offline muestra precarga y cola PENDIENTE/ERROR", () => {
    const precarga: PrecargaForm = {
      id_formulario: "con-p",
      fecha_precarga: "2026-05-02T10:00:00Z",
      datos_formulario: {},
    };
    const historialPendienteSinPrecarga: HistorialForm = {
      id_formulario: "solo-h",
      id_usuario: "u",
      fecha_hora: "2026-01-01T00:00:00Z",
      estado: "PENDIENTE",
      datos_formulario: {},
    };
    const merged = mergeFormsWithPrecargas(
      [],
      [historialPendienteSinPrecarga],
      [precarga],
    );
    expect(merged).toHaveLength(2);
    const visible = filterDisplayRowsWithPrecarga(merged, [precarga]);
    expect(visible).toHaveLength(2);
    expect(new Set(visible.map((r) => r.id_formulario))).toEqual(
      new Set(["con-p", "solo-h"]),
    );
  });

  it("filterDisplayRowsWithPrecarga oculta ENVIADO sin precarga (sin listado servidor)", () => {
    const historialEnviado: HistorialForm = {
      id_formulario: "solo-env",
      id_usuario: "u",
      fecha_hora: "2026-01-01T00:00:00Z",
      estado: "ENVIADO",
      datos_formulario: {},
    };
    const merged = mergeFormsWithPrecargas([], [historialEnviado], []);
    const visible = filterDisplayRowsWithPrecarga(merged, []);
    expect(visible).toHaveLength(0);
  });

  it("reconcileLocalStateWithTrustedServerList quita ENVIADO que ya no está en servidor", () => {
    const borradoEnOtroEquipo: HistorialForm = {
      id_formulario: "gone",
      id_usuario: "u",
      fecha_hora: "2026-01-01T00:00:00Z",
      estado: "ENVIADO",
    };
    const pendiente: HistorialForm = {
      id_formulario: "local-only",
      id_usuario: "u",
      fecha_hora: "2026-01-02T00:00:00Z",
      estado: "PENDIENTE",
    };
    const server = [
      {
        id_formulario: "still",
        id_usuario: "u",
        fecha_hora: "2026-01-03T00:00:00Z",
        fecha_actualizacion: "2026-01-03T00:00:00Z",
        latitud: 0,
        longitud: 0,
        precision: 1,
        datos_formulario: {},
        fotos: [],
      },
    ];
    const precarga: PrecargaForm = {
      id_formulario: "gone",
      fecha_precarga: "2026-05-01T12:00:00Z",
      datos_formulario: {},
    };
    const out = reconcileLocalStateWithTrustedServerList(
      [borradoEnOtroEquipo, pendiente],
      server,
      [precarga],
    );
    expect(out.staleEnviadoIds).toEqual(["gone"]);
    expect(out.orphanPrecargaIds).toEqual([]);
    expect(out.historialForMerge.map((h) => h.id_formulario)).toEqual([
      "local-only",
    ]);
    expect(out.precargasForMerge).toHaveLength(0);
  });

  it("reconcileLocalStateWithTrustedServerList conserva ENVIADO que sigue en servidor", () => {
    const h: HistorialForm = {
      id_formulario: "x",
      id_usuario: "u",
      fecha_hora: "2026-01-01T00:00:00Z",
      estado: "ENVIADO",
    };
    const server = [
      {
        id_formulario: "x",
        id_usuario: "u",
        fecha_hora: "2026-01-01T00:00:00Z",
        fecha_actualizacion: "2026-01-01T00:00:00Z",
        latitud: 0,
        longitud: 0,
        precision: 1,
        datos_formulario: {},
        fotos: [],
      },
    ];
    const out = reconcileLocalStateWithTrustedServerList([h], server, []);
    expect(out.staleEnviadoIds).toHaveLength(0);
    expect(out.orphanPrecargaIds).toHaveLength(0);
    expect(out.historialForMerge).toEqual([h]);
  });

  it("reconcileLocalStateWithTrustedServerList elimina precarga huérfana cuando el id ya no está en el servidor", () => {
    const server = [
      {
        id_formulario: "still",
        id_usuario: "u",
        fecha_hora: "2026-01-03T00:00:00Z",
        fecha_actualizacion: "2026-01-03T00:00:00Z",
        latitud: 0,
        longitud: 0,
        precision: 1,
        datos_formulario: {},
        fotos: [],
      },
    ];
    const precarga: PrecargaForm = {
      id_formulario: "borrado-en-otro-dispositivo",
      fecha_precarga: "2026-05-01T12:00:00Z",
      datos_formulario: {},
    };
    const out = reconcileLocalStateWithTrustedServerList([], server, [precarga]);
    expect(out.orphanPrecargaIds).toEqual(["borrado-en-otro-dispositivo"]);
    expect(out.precargasForMerge).toHaveLength(0);
  });

  it("reconcileLocalStateWithTrustedServerList conserva precarga si historial PENDIENTE (id aún no en listado)", () => {
    const pendiente: HistorialForm = {
      id_formulario: "solo-local",
      id_usuario: "u",
      fecha_hora: "2026-01-02T00:00:00Z",
      estado: "PENDIENTE",
    };
    const prec: PrecargaForm = {
      id_formulario: "solo-local",
      fecha_precarga: "2026-05-01T12:00:00Z",
      datos_formulario: {},
    };
    const out = reconcileLocalStateWithTrustedServerList(
      [pendiente],
      [],
      [prec],
    );
    expect(out.orphanPrecargaIds).toHaveLength(0);
    expect(out.precargasForMerge).toHaveLength(1);
    expect(out.precargasForMerge[0].id_formulario).toBe("solo-local");
  });

  it("reconcileLocalStateWithTrustedServerList conserva precarga si historial ERROR (reintento pendiente)", () => {
    const err: HistorialForm = {
      id_formulario: "sync-error",
      id_usuario: "u",
      fecha_hora: "2026-01-02T00:00:00Z",
      estado: "ERROR",
    };
    const prec: PrecargaForm = {
      id_formulario: "sync-error",
      fecha_precarga: "2026-05-01T12:00:00Z",
      datos_formulario: {},
    };
    const out = reconcileLocalStateWithTrustedServerList([err], [], [prec]);
    expect(out.orphanPrecargaIds).toHaveLength(0);
    expect(out.precargasForMerge).toHaveLength(1);
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

function itemServidor(id: string): FormReadItem {
  return {
    id_formulario: id,
    id_usuario: "u",
    fecha_hora: "2026-01-01T00:00:00Z",
    fecha_actualizacion: "2026-01-01T00:00:00Z",
    latitud: 0,
    longitud: 0,
    precision: 1,
    datos_formulario: {},
    fotos: [],
  };
}

describe("formHistory — listado según conectividad (Formularios diligenciados)", () => {
  /** Simula merge tras GET /forms cacheado: varios en servidor + uno en cola local. */
  const rowsComoListadoCacheado: DisplayRow[] = [
    { id_formulario: "s1", onServer: true, server: itemServidor("s1") },
    {
      id_formulario: "s2",
      onServer: true,
      server: itemServidor("s2"),
      historial: {
        id_formulario: "s2",
        id_usuario: "u",
        fecha_hora: "2026-01-01T00:00:00Z",
        estado: "ENVIADO",
        datos_formulario: {},
      } satisfies HistorialForm,
    },
    {
      id_formulario: "cola",
      onServer: false,
      historial: {
        id_formulario: "cola",
        id_usuario: "u",
        fecha_hora: "2026-01-02T00:00:00Z",
        estado: "PENDIENTE",
        datos_formulario: {},
      } satisfies HistorialForm,
    },
  ];

  it("rowsForOfflineAwareList con conexión OK deja el merge completo (incluye solo servidor)", () => {
    const out = rowsForOfflineAwareList(rowsComoListadoCacheado, [], {
      connectivityOnline: true,
      navigatorOnLine: true,
    });
    expect(out).toHaveLength(3);
    expect(new Set(out.map((r) => r.id_formulario))).toEqual(
      new Set(["s1", "s2", "cola"]),
    );
  });

  it("rowsForOfflineAwareList con hook offline oculta filas solo servidor / ENVIADO sin precarga", () => {
    const out = rowsForOfflineAwareList(rowsComoListadoCacheado, [], {
      connectivityOnline: false,
      navigatorOnLine: true,
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.id_formulario).toBe("cola");
  });

  it("rowsForOfflineAwareList con navigator offline aplica el mismo filtro", () => {
    const out = rowsForOfflineAwareList(rowsComoListadoCacheado, [], {
      connectivityOnline: true,
      navigatorOnLine: false,
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.id_formulario).toBe("cola");
  });

  it("rowsForOfflineAwareList offline conserva id con precarga aunque también esté en servidor", () => {
    const prec: PrecargaForm = {
      id_formulario: "ambos",
      fecha_precarga: "2026-05-01T12:00:00Z",
      datos_formulario: {},
    };
    const merged = mergeFormsWithPrecargas([itemServidor("ambos")], [], [prec]);
    const offline = rowsForOfflineAwareList(merged, [prec], {
      connectivityOnline: false,
      navigatorOnLine: true,
    });
    expect(offline).toHaveLength(1);
    expect(offline[0]?.id_formulario).toBe("ambos");
    expect(offline[0]?.onServer).toBe(true);
  });
});
