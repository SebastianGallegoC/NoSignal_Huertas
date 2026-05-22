import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { RemoveFotoConfirmModal } from "@/components/form/RemoveFotoConfirmModal";

describe("RemoveFotoConfirmModal", () => {
  it("no renderiza cuando open=false", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <RemoveFotoConfirmModal
          open={false}
          nombreArchivo="foto.jpg"
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toBe("");
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("llama onCancel y onConfirm", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <RemoveFotoConfirmModal
          open
          nombreArchivo="campo.jpg"
          visita={4}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />,
      );
    });

    expect(container.textContent).toContain("campo.jpg");
    expect(container.textContent).toContain("visita 4");

    const buttons = Array.from(container.querySelectorAll("button"));
    const cancelBtn = buttons.find((b) => b.textContent === "Cancelar");
    const confirmBtn = buttons.find((b) => b.textContent === "Sí, eliminar");

    await act(async () => {
      cancelBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      confirmBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
