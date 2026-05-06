import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReloadPrompt } from "@/components/ReloadPrompt";

const mockUpdateServiceWorker = vi.fn<(reloadPage?: boolean) => Promise<void>>();
let needRefreshState = false;

vi.mock("@/hooks/usePwaRegister", () => ({
  usePwaRegister: () => ({
    needRefresh: [needRefreshState, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: mockUpdateServiceWorker,
  }),
}));

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe("ReloadPrompt", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    mockUpdateServiceWorker.mockReset();
    needRefreshState = false;
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
  });

  const renderPrompt = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<ReloadPrompt />);
    });
  };

  it("no renderiza aviso cuando no hay actualización", async () => {
    needRefreshState = false;
    await renderPrompt();
    expect(container?.textContent ?? "").not.toContain(
      "Hay una nueva versión disponible.",
    );
  });

  it("renderiza aviso cuando needRefresh es true", async () => {
    needRefreshState = true;
    await renderPrompt();
    expect(container?.textContent ?? "").toContain(
      "Hay una nueva versión disponible.",
    );
    expect(container?.textContent ?? "").toContain("Actualizar ahora");
  });

  it("ejecuta updateServiceWorker(true) al hacer clic en actualizar", async () => {
    needRefreshState = true;
    await renderPrompt();
    const button = container?.querySelector("button");
    expect(button).not.toBeNull();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(mockUpdateServiceWorker).toHaveBeenCalledTimes(1);
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });
});
