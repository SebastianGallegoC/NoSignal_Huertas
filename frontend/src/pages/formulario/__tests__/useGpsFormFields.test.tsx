import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { useGpsFormFields } from "@/pages/formulario/useGpsFormFields";

type Props = Parameters<typeof useGpsFormFields>[0];

const Harness = (props: Props) => {
  useGpsFormFields(props);
  return null;
};

describe("useGpsFormFields", () => {
  it("en modo automático solo rellena latitud y longitud decimales desde GPS", async () => {
    const setValue = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Harness
          gps={{ latitud: 4.60971, longitud: -74.08175, precision: 5 }}
          modoCoordenadas="automatico"
          latitud=""
          longitud=""
          setValue={setValue}
        />,
      );
    });

    expect(setValue).toHaveBeenCalledWith("longitud", "-74.081750");
    expect(setValue).toHaveBeenCalledWith("latitud", "4.609710");
    expect(
      setValue.mock.calls.some(([field]) =>
        String(field).startsWith("x_") || String(field).startsWith("y_"),
      ),
    ).toBe(false);

    act(() => root.unmount());
    container.remove();
  });

  it("en modo manual no recalcula GMS desde latitud y longitud", async () => {
    const setValue = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Harness
          gps={null}
          modoCoordenadas="manual"
          latitud="4.60971"
          longitud="-74.08175"
          setValue={setValue}
        />,
      );
    });

    expect(setValue).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });
});
