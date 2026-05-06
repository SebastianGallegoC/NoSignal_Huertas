import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { useAuthStore } from "@/store/useAuthStore";

// En tests de rutas no necesitamos el flujo de actualización PWA.
// Evita resolver imports virtuales del plugin PWA en entorno de vitest.
vi.mock("@/components/ReloadPrompt", () => ({
  ReloadPrompt: () => <div data-testid="reload-prompt-mock" />,
}));

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe("App lazy routes", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(async () => {
    useAuthStore.setState({ token: null, username: null, ready: true });
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
  });

  it("renderiza login al navegar a /login", async () => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    const [{ default: App }] = await Promise.all([
      import("@/App"),
      import("@/pages/LoginPage"),
    ]);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/login"]}>
          <App />
        </MemoryRouter>,
      );
      await flush();
      await flush();
      await flush();
    });

    expect(container.textContent).toContain("Iniciar sesión");
  });

  it("redirige a login cuando ruta protegida no tiene token", async () => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    const [{ default: App }] = await Promise.all([
      import("@/App"),
      import("@/pages/InicioPage"),
      import("@/pages/LoginPage"),
    ]);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useAuthStore.setState({ token: null, username: null, ready: true });

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/inicio"]}>
          <App />
        </MemoryRouter>,
      );
      await flush();
      await flush();
      await flush();
    });

    expect(container.textContent).toContain("Iniciar sesión");
  });

  it("monta ReloadPrompt en la raíz de la app", async () => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    const [{ default: App }] = await Promise.all([
      import("@/App"),
      import("@/pages/LoginPage"),
    ]);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter initialEntries={["/login"]}>
          <App />
        </MemoryRouter>,
      );
      await flush();
      await flush();
      await flush();
    });

    expect(container.querySelector('[data-testid="reload-prompt-mock"]')).not.toBeNull();
  });
});
