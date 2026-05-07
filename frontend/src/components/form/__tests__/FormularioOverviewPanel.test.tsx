import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, it, expect, vi } from "vitest";
import { FormularioOverviewPanel } from "../FormularioOverviewPanel";

const defaultProps = {
  estado: "idle" as const,
  progreso: null,
  gps: { latitud: 1, longitud: 2, precision: 5 },
  error: null,
  cargando: false,
  pendientes: 0,
  erroresSync: 0,
  ultimosErrores: [],
  onSolicitarGps: vi.fn(),
  modoCoordenadas: "automatico" as const,
  onChangeModoCoordenadas: vi.fn(),
  buildMapUrl: (lat: number, lon: number) => `https://map/${lat},${lon}`,
  buildExternalMapUrl: (lat: number, lon: number) =>
    `https://osm/${lat},${lon}`,
};

describe("FormularioOverviewPanel", () => {
  it("llama onChangeModoCoordenadas al activar switch con click", () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <FormularioOverviewPanel
          {...defaultProps}
          modoCoordenadas="automatico"
          onChangeModoCoordenadas={onChange}
        />,
      );
    });

    const sw = container.querySelector('[role="switch"]') as HTMLElement;
    sw.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onChange).toHaveBeenCalled();
    root.unmount();
    container.remove();
  });

  it("responde a teclado (Enter/Space) sobre el switch", () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <FormularioOverviewPanel
          {...defaultProps}
          modoCoordenadas="automatico"
          onChangeModoCoordenadas={onChange}
        />,
      );
    });

    const sw = container.querySelector('[role="switch"]') as HTMLElement;
    sw.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    sw.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(2);
    root.unmount();
    container.remove();
  });
});
