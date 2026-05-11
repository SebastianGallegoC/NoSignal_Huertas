import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockUseConnectivityStatus = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useConnectivityStatus", () => ({
  useConnectivityStatus: () => mockUseConnectivityStatus(),
}));

import { FormularioOverviewPanel } from "../FormularioOverviewPanel";

const defaultProps = {
  estado: "idle" as const,
  progreso: null,
  gps: { latitud: 1, longitud: 2, precision: 5 },
  error: null,
  cargando: false,
  onSolicitarGps: vi.fn(),
  modoCoordenadas: "automatico" as const,
  onChangeModoCoordenadas: vi.fn(),
  buildMapUrl: (lat: number, lon: number) => `https://map/${lat},${lon}`,
  buildExternalMapUrl: (lat: number, lon: number) =>
    `https://osm/${lat},${lon}`,
};

describe("FormularioOverviewPanel connectivity", () => {
  beforeEach(() => {
    mockUseConnectivityStatus.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("cuando está offline oculta el iframe y deshabilita el enlace externo", async () => {
    mockUseConnectivityStatus.mockReturnValue(false);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<FormularioOverviewPanel {...defaultProps} />);
    });

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.textContent).toContain(
      "Sin conexión: mapa no disponible.",
    );
    const link = container.querySelector("a");
    expect(link?.textContent).toContain("Abrir ubicación (requiere conexión)");
    expect(link?.getAttribute("href")).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("cuando está online muestra el mapa y el enlace externo", async () => {
    mockUseConnectivityStatus.mockReturnValue(true);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<FormularioOverviewPanel {...defaultProps} />);
    });

    const iframe = container.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("src")).toContain("https://map/1,2");
    const link = container.querySelector("a");
    expect(link?.textContent).toContain("Abrir ubicación en OpenStreetMap");
    expect(link?.getAttribute("href")).toBe("https://osm/1,2");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
