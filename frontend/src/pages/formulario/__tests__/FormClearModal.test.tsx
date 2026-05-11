import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { FormClearModal } from "@/pages/formulario/FormClearModal";

describe("FormClearModal", () => {
  it("no renderiza cuando open=false", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <FormClearModal open={false} onCancel={vi.fn()} onConfirm={vi.fn()} />,
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
        <FormClearModal open onCancel={onCancel} onConfirm={onConfirm} />,
      );
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    const cancelBtn = buttons.find((b) => b.textContent === "Cancelar");
    const confirmBtn = buttons.find((b) => b.textContent === "Sí, vaciar");

    expect(cancelBtn).toBeDefined();
    expect(confirmBtn).toBeDefined();

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
