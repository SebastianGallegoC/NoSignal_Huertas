import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { FormularioFotosSection } from "@/components/form/FormularioFotosSection";

const JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBkNDRkYGBk1KysrNTY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

describe("FormularioFotosSection", () => {
  it("pide confirmación antes de quitar una foto", async () => {
    const onQuitarFoto = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <FormularioFotosSection
          fotos={[
            { nombre_archivo: "test.jpg", data: JPEG, visita: 2 },
          ]}
          visitaSeleccionada={2}
          onVisitaSeleccionadaChange={vi.fn()}
          pickerInputRef={{ current: null }}
          cameraOpen={false}
          cameraVideoRef={{ current: null }}
          captureFlash={false}
          captureBadge={false}
          onOpenCamera={vi.fn()}
          onStopCamera={vi.fn()}
          onCaptureFromCamera={vi.fn()}
          onFotosChange={vi.fn()}
          onQuitarFoto={onQuitarFoto}
          onPreviewFoto={vi.fn()}
        />,
      );
    });

    const quitarBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Quitar",
    );
    expect(quitarBtn).toBeDefined();

    await act(async () => {
      quitarBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onQuitarFoto).not.toHaveBeenCalled();
    expect(container.textContent).toContain("¿Eliminar esta foto?");

    const confirmBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Sí, eliminar",
    );
    await act(async () => {
      confirmBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onQuitarFoto).toHaveBeenCalledWith(0);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
