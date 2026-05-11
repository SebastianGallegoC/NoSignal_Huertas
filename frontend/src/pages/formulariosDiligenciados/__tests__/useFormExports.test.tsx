import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, afterEach } from "vitest";

import type { FormularioSnapshot } from "@/components/form/FormularioRespuestaReadOnly";
import type { PrecargaForm } from "@/services/db";
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
  fotosConVisitaDesdeDetalle: vi.fn(() => []),
  hydrateFotosFromServerIfNeeded: vi.fn(
    async (_row: DisplayRow, fotos: unknown[]) => fotos,
  ),
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
});
