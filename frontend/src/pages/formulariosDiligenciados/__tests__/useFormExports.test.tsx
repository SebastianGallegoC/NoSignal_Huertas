import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, afterEach } from "vitest";

import type { FormularioSnapshot } from "@/components/form/FormularioRespuestaReadOnly";
import type { FotoForm, PrecargaForm } from "@/services/db";
import type { DisplayRow } from "@/services/formHistory";
import { useFormExports } from "@/pages/formulariosDiligenciados/useFormExports";

const exportMocks = vi.hoisted(() => ({
  downloadMatrizCaracterizacionXlsx: vi.fn(),
  downloadMatrizCaracterizacionBulkXlsx: vi.fn(),
}));

const photoMocks = vi.hoisted(() => ({
  downloadPhotosZip: vi.fn(),
  downloadPhotosBulkZip: vi.fn(),
}));

const helperMocks = vi.hoisted(() => ({
  fotosConVisitaDesdeDetalle: vi.fn((): FotoForm[] => []),
  hydrateFotosFromServerIfNeeded: vi.fn(
    async (_row: DisplayRow, fotos: FotoForm[]): Promise<FotoForm[]> => fotos,
  ),
}));

const dbMocks = vi.hoisted(() => ({
  bulkGet: vi.fn(async () => [] as unknown[]),
}));

vi.mock("@/services/db", () => ({
  db: {
    formularios: {
      bulkGet: dbMocks.bulkGet,
    },
  },
}));

vi.mock("@/services/matrizCaracterizacionExport", () => exportMocks);
vi.mock("@/services/photosExport", () => photoMocks);
vi.mock("@/pages/formulariosDiligenciados/helpers", () => helperMocks);

const buildRow = (overrides?: Partial<DisplayRow>): DisplayRow => {
  return {
    id_formulario: "form-1",
    onServer: false,
    server: null,
    historial: null,
    precargaSolo: null,
    ...(overrides ?? {}),
  } as DisplayRow;
};

type HookHandlers = ReturnType<typeof useFormExports>;

type HarnessProps = {
  rows: DisplayRow[];
  detailSnapshot: FormularioSnapshot | null;
  detailPrecarga: PrecargaForm | null;
  onReady: (handlers: HookHandlers) => void;
  setDescargaExcelError: (value: string | null) => void;
  setDescargaFotosError: (value: string | null) => void;
  setDescargandoExcelId: (value: string | null) => void;
  setDescargandoFotosId: (value: string | null) => void;
  setDescargandoTodosExcel: (value: boolean) => void;
  setDescargandoTodasFotos: (value: boolean) => void;
};

const Harness = (props: HarnessProps) => {
  const handlers = useFormExports(props);
  props.onReady(handlers);
  return null;
};

describe("useFormExports", () => {
  afterEach(() => {
    vi.clearAllMocks();
    dbMocks.bulkGet.mockReset();
    dbMocks.bulkGet.mockResolvedValue([]);
    helperMocks.fotosConVisitaDesdeDetalle.mockReset();
    helperMocks.fotosConVisitaDesdeDetalle.mockImplementation(() => []);
    helperMocks.hydrateFotosFromServerIfNeeded.mockReset();
    helperMocks.hydrateFotosFromServerIfNeeded.mockImplementation(
      async (_row: DisplayRow, fotos: FotoForm[]) => fotos,
    );
  });

  it("reporta error si falta detailSnapshot al exportar Excel", async () => {
    const onReady = vi.fn();
    const setDescargaExcelError = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let handlers: HookHandlers | null = null;

    await act(async () => {
      root.render(
        <Harness
          rows={[buildRow()]}
          detailSnapshot={null}
          detailPrecarga={null}
          onReady={(h) => {
            handlers = h;
            onReady(h);
          }}
          setDescargaExcelError={setDescargaExcelError}
          setDescargaFotosError={vi.fn()}
          setDescargandoExcelId={vi.fn()}
          setDescargandoFotosId={vi.fn()}
          setDescargandoTodosExcel={vi.fn()}
          setDescargandoTodasFotos={vi.fn()}
        />,
      );
    });

    await act(async () => {
      await handlers?.descargarExcelDelRegistro(buildRow());
    });

    expect(setDescargaExcelError).toHaveBeenCalledWith(
      "No hay datos cargados del formulario para exportar.",
    );
    expect(
      exportMocks.downloadMatrizCaracterizacionXlsx,
    ).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("exporta Excel consolidado con filas preparadas", async () => {
    const onReady = vi.fn();
    const setDescargandoTodosExcel = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let handlers: HookHandlers | null = null;

    const row = buildRow({
      server: {
        id_formulario: "form-1",
        id_usuario: "user",
        fecha_hora: "2026-01-01T10:00:00.000Z",
        fecha_actualizacion: "2026-01-01T10:00:00.000Z",
        latitud: 1,
        longitud: 2,
        precision: 3,
        datos_formulario: { a: "b" },
        fotos: [],
      },
    });

    await act(async () => {
      root.render(
        <Harness
          rows={[row]}
          detailSnapshot={null}
          detailPrecarga={null}
          onReady={(h) => {
            handlers = h;
            onReady(h);
          }}
          setDescargaExcelError={vi.fn()}
          setDescargaFotosError={vi.fn()}
          setDescargandoExcelId={vi.fn()}
          setDescargandoFotosId={vi.fn()}
          setDescargandoTodosExcel={setDescargandoTodosExcel}
          setDescargandoTodasFotos={vi.fn()}
        />,
      );
    });

    await act(async () => {
      await handlers?.descargarExcelDeTodos();
    });

    expect(
      exportMocks.downloadMatrizCaracterizacionBulkXlsx,
    ).toHaveBeenCalledTimes(1);
    const payload =
      exportMocks.downloadMatrizCaracterizacionBulkXlsx.mock.calls[0]?.[0];
    expect(Array.isArray(payload)).toBe(true);
    expect(payload[0]?.id_formulario).toBe("form-1");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("exporta Excel consolidado con datos del servidor si hay historial local distinto", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let handlers: HookHandlers | null = null;

    const row = buildRow({
      server: {
        id_formulario: "form-1",
        id_usuario: "user",
        fecha_hora: "2026-01-01T10:00:00.000Z",
        fecha_actualizacion: "2026-01-01T10:00:00.000Z",
        latitud: 1,
        longitud: 2,
        precision: 3,
        datos_formulario: { fecha_inicio: "2026-05-10" },
        fotos: [],
      },
      historial: {
        id_formulario: "form-1",
        id_usuario: "user",
        fecha_hora: "2026-01-01T10:00:00.000Z",
        estado: "ENVIADO",
        datos_formulario: { fecha_inicio: "2020-01-01" },
      },
    });

    await act(async () => {
      root.render(
        <Harness
          rows={[row]}
          detailSnapshot={null}
          detailPrecarga={null}
          onReady={(h) => {
            handlers = h;
          }}
          setDescargaExcelError={vi.fn()}
          setDescargaFotosError={vi.fn()}
          setDescargandoExcelId={vi.fn()}
          setDescargandoFotosId={vi.fn()}
          setDescargandoTodosExcel={vi.fn()}
          setDescargandoTodasFotos={vi.fn()}
        />,
      );
    });

    await act(async () => {
      await handlers?.descargarExcelDeTodos();
    });

    const payload =
      exportMocks.downloadMatrizCaracterizacionBulkXlsx.mock.calls[0]?.[0];
    expect(payload[0]?.datos_formulario?.fecha_inicio).toBe("2026-05-10");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("reporta error si falta detailSnapshot al exportar fotos", async () => {
    const setDescargaFotosError = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let handlers: HookHandlers | null = null;

    await act(async () => {
      root.render(
        <Harness
          rows={[buildRow()]}
          detailSnapshot={null}
          detailPrecarga={null}
          onReady={(h) => {
            handlers = h;
          }}
          setDescargaExcelError={vi.fn()}
          setDescargaFotosError={setDescargaFotosError}
          setDescargandoExcelId={vi.fn()}
          setDescargandoFotosId={vi.fn()}
          setDescargandoTodosExcel={vi.fn()}
          setDescargandoTodasFotos={vi.fn()}
        />,
      );
    });

    await act(async () => {
      await handlers?.descargarFotosDelRegistro(buildRow());
    });

    expect(setDescargaFotosError).toHaveBeenCalledWith(
      "No hay datos cargados del formulario para exportar fotos.",
    );
    expect(photoMocks.downloadPhotosZip).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("exporta Excel del registro cuando hay snapshot y GPS", async () => {
    const snapshot: FormularioSnapshot = {
      datos_formulario: { entidad_aportante: "Org" },
      gps: { latitud: 4.6, longitud: -74.08, precision: 5 },
      fotos: [],
    };
    const row = buildRow({
      id_formulario: "exp-1",
      server: {
        id_formulario: "exp-1",
        id_usuario: "usr-1",
        fecha_hora: "2026-02-01T12:00:00.000Z",
        fecha_actualizacion: "2026-02-01T12:00:00.000Z",
        latitud: 1,
        longitud: 2,
        precision: 3,
        datos_formulario: {},
        fotos: [],
      },
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let handlers: HookHandlers | null = null;

    await act(async () => {
      root.render(
        <Harness
          rows={[row]}
          detailSnapshot={snapshot}
          detailPrecarga={null}
          onReady={(h) => {
            handlers = h;
          }}
          setDescargaExcelError={vi.fn()}
          setDescargaFotosError={vi.fn()}
          setDescargandoExcelId={vi.fn()}
          setDescargandoFotosId={vi.fn()}
          setDescargandoTodosExcel={vi.fn()}
          setDescargandoTodasFotos={vi.fn()}
        />,
      );
    });

    await act(async () => {
      await handlers?.descargarExcelDelRegistro(row);
    });

    expect(exportMocks.downloadMatrizCaracterizacionXlsx).toHaveBeenCalledTimes(1);
    const arg = exportMocks.downloadMatrizCaracterizacionXlsx.mock.calls[0]?.[0];
    expect(arg?.id_formulario).toBe("exp-1");
    expect(arg?.gps).toEqual({
      latitud: 4.6,
      longitud: -74.08,
      precision: 5,
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("exporta ZIP de fotos del registro cuando hay snapshot y fotos", async () => {
    helperMocks.fotosConVisitaDesdeDetalle.mockReturnValueOnce([
      {
        nombre_archivo: "a.jpg",
        data: "data:image/jpeg;base64,AA==",
        visita: 1 as const,
      },
    ]);
    helperMocks.hydrateFotosFromServerIfNeeded.mockResolvedValueOnce([
      {
        nombre_archivo: "a.jpg",
        data: "data:image/jpeg;base64,AA==",
        visita: 1 as const,
      },
    ]);

    const snapshot: FormularioSnapshot = {
      datos_formulario: {},
      gps: { latitud: 1, longitud: 2, precision: 1 },
      fotos: [{ nombre_archivo: "a.jpg", data: "data:image/jpeg;base64,AA==", visita: 1 }],
    };
    const row = buildRow({
      id_formulario: "foto-1",
      server: {
        id_formulario: "foto-1",
        id_usuario: "u",
        fecha_hora: "2026-01-01T10:00:00.000Z",
        fecha_actualizacion: "2026-01-01T10:00:00.000Z",
        latitud: 1,
        longitud: 2,
        precision: 1,
        datos_formulario: {},
        fotos: [],
      },
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let handlers: HookHandlers | null = null;

    await act(async () => {
      root.render(
        <Harness
          rows={[row]}
          detailSnapshot={snapshot}
          detailPrecarga={null}
          onReady={(h) => {
            handlers = h;
          }}
          setDescargaExcelError={vi.fn()}
          setDescargaFotosError={vi.fn()}
          setDescargandoExcelId={vi.fn()}
          setDescargandoFotosId={vi.fn()}
          setDescargandoTodosExcel={vi.fn()}
          setDescargandoTodasFotos={vi.fn()}
        />,
      );
    });

    await act(async () => {
      await handlers?.descargarFotosDelRegistro(row);
    });

    expect(photoMocks.downloadPhotosZip).toHaveBeenCalledTimes(1);
    expect(photoMocks.downloadPhotosZip.mock.calls[0]?.[0]?.id_formulario).toBe(
      "foto-1",
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("descargarFotosDeTodos llama al ZIP masivo", async () => {
    helperMocks.fotosConVisitaDesdeDetalle.mockReturnValue([
      {
        nombre_archivo: "b.jpg",
        data: "data:image/jpeg;base64,QQ==",
        visita: 2 as const,
      },
    ]);
    helperMocks.hydrateFotosFromServerIfNeeded.mockImplementation(
      async (_row, fotos) => fotos,
    );

    const row = buildRow({
      id_formulario: "bulk-f",
      server: {
        id_formulario: "bulk-f",
        id_usuario: "u",
        fecha_hora: "2026-03-01T10:00:00.000Z",
        fecha_actualizacion: "2026-03-01T10:00:00.000Z",
        latitud: 3,
        longitud: -70,
        precision: 2,
        datos_formulario: {},
        fotos: [],
      },
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let handlers: HookHandlers | null = null;

    await act(async () => {
      root.render(
        <Harness
          rows={[row]}
          detailSnapshot={null}
          detailPrecarga={null}
          onReady={(h) => {
            handlers = h;
          }}
          setDescargaExcelError={vi.fn()}
          setDescargaFotosError={vi.fn()}
          setDescargandoExcelId={vi.fn()}
          setDescargandoFotosId={vi.fn()}
          setDescargandoTodosExcel={vi.fn()}
          setDescargandoTodasFotos={vi.fn()}
        />,
      );
    });

    await act(async () => {
      await handlers?.descargarFotosDeTodos();
    });

    expect(photoMocks.downloadPhotosBulkZip).toHaveBeenCalledTimes(1);
    const bulk = photoMocks.downloadPhotosBulkZip.mock.calls[0]?.[0];
    expect(Array.isArray(bulk)).toBe(true);
    expect(bulk[0]?.id_formulario).toBe("bulk-f");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
