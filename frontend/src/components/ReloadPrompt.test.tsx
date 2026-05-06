import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  COLD_START_UPDATE_WINDOW_MS,
  ReloadPrompt,
} from "@/components/ReloadPrompt";

const mockUpdateServiceWorker = vi.fn<(reloadPage?: boolean) => Promise<void>>();

const pwaMock = { needRefresh: false };

const routerMock = { pathname: "/inicio" };

vi.mock("react-router-dom", () => ({
  useLocation: () => ({
    pathname: routerMock.pathname,
    search: "",
    hash: "",
    state: null,
    key: "test",
  }),
}));

vi.mock("@/hooks/usePwaRegister", () => ({
  usePwaRegister: () => ({
    needRefresh: [pwaMock.needRefresh, vi.fn()],
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
    vi.useFakeTimers();
    mockUpdateServiceWorker.mockReset();
    mockUpdateServiceWorker.mockResolvedValue(undefined);
    pwaMock.needRefresh = false;
    routerMock.pathname = "/inicio";
    window.sessionStorage.clear();
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
    vi.useRealTimers();
  });

  const renderPrompt = async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<ReloadPrompt />);
    });
  };

  const rerenderPrompt = async () => {
    await act(async () => {
      root?.render(<ReloadPrompt />);
    });
  };

  it("no renderiza aviso cuando no hay actualización", async () => {
    pwaMock.needRefresh = false;
    await renderPrompt();
    expect(container?.textContent ?? "").not.toContain(
      "Hay una nueva versión disponible.",
    );
  });

  it("renderiza aviso cuando needRefresh es true fuera de la ventana cold-start", async () => {
    pwaMock.needRefresh = false;
    await renderPrompt();
    await act(async () => {
      vi.advanceTimersByTime(COLD_START_UPDATE_WINDOW_MS + 1);
    });
    pwaMock.needRefresh = true;
    await rerenderPrompt();
    expect(container?.textContent ?? "").toContain(
      "Hay una nueva versión disponible.",
    );
    expect(container?.textContent ?? "").toContain("Actualizar ahora");
  });

  it("ejecuta updateServiceWorker(true) al hacer clic en actualizar", async () => {
    pwaMock.needRefresh = false;
    await renderPrompt();
    await act(async () => {
      vi.advanceTimersByTime(COLD_START_UPDATE_WINDOW_MS + 1);
    });
    pwaMock.needRefresh = true;
    await rerenderPrompt();
    const button = container?.querySelector("button");
    expect(button).not.toBeNull();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(mockUpdateServiceWorker).toHaveBeenCalledTimes(1);
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });

  it("oculta el modal después de pulsar actualizar", async () => {
    pwaMock.needRefresh = false;
    await renderPrompt();
    await act(async () => {
      vi.advanceTimersByTime(COLD_START_UPDATE_WINDOW_MS + 1);
    });
    pwaMock.needRefresh = true;
    await rerenderPrompt();
    const button = container?.querySelector("button");
    expect(button).not.toBeNull();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container?.textContent ?? "").not.toContain(
      "Hay una nueva versión disponible.",
    );
  });

  it("auto-aplica update si needRefresh es true en cold start", async () => {
    pwaMock.needRefresh = true;
    await renderPrompt();
    expect(mockUpdateServiceWorker).toHaveBeenCalledTimes(1);
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
    expect(container?.textContent ?? "").toContain(
      "Actualizando a la última versión...",
    );
    expect(container?.textContent ?? "").not.toContain("Actualizar ahora");
  });

  it("no auto-aplica si needRefresh pasa a true después de la ventana cold-start", async () => {
    pwaMock.needRefresh = false;
    await renderPrompt();
    await act(async () => {
      vi.advanceTimersByTime(COLD_START_UPDATE_WINDOW_MS + 1);
    });
    pwaMock.needRefresh = true;
    await rerenderPrompt();
    expect(mockUpdateServiceWorker).not.toHaveBeenCalled();
    expect(container?.textContent ?? "").toContain("Actualizar ahora");
  });

  it("no auto-aplica en /formulario (muestra modal)", async () => {
    routerMock.pathname = "/formulario";
    pwaMock.needRefresh = true;
    await renderPrompt();
    expect(mockUpdateServiceWorker).not.toHaveBeenCalled();
    expect(container?.textContent ?? "").toContain("Hay una nueva versión disponible.");
    expect(container?.textContent ?? "").toContain("Actualizar ahora");
  });

  it("no auto-aplica en /formularios-diligenciados (muestra modal)", async () => {
    routerMock.pathname = "/formularios-diligenciados";
    pwaMock.needRefresh = true;
    await renderPrompt();
    expect(mockUpdateServiceWorker).not.toHaveBeenCalled();
    expect(container?.textContent ?? "").toContain("Actualizar ahora");
  });
});
