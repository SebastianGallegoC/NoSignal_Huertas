import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { usePwaRegister } from "@/hooks/usePwaRegister";

const UPDATE_PROMPT_SUPPRESS_KEY = "nosignal:pwa:update-clicked-at";
const UPDATE_PROMPT_SUPPRESS_MS = 3 * 60 * 1000;

/**
 * Ventana desde el primer montaje para auto-actualizar sin modal.
 * En móvil/PWA suele tardar varios segundos en detectar el SW nuevo; 5s era corto.
 */
export const COLD_START_UPDATE_WINDOW_MS = 30_000;

/**
 * Rutas donde no se auto-recarga al detectar actualización (evita cortar edición / listas).
 */
export function shouldBlockPwaAutoReload(pathname: string): boolean {
  if (pathname === "/formulario") {
    return true;
  }
  if (pathname === "/formularios" || pathname.startsWith("/formularios-diligenciados")) {
    return true;
  }
  return false;
}

const shouldStartSuppressed = (): boolean => {
  try {
    const raw = window.sessionStorage.getItem(UPDATE_PROMPT_SUPPRESS_KEY);
    const ts = raw ? Number(raw) : NaN;
    if (!Number.isFinite(ts)) {
      return false;
    }
    return Date.now() - ts < UPDATE_PROMPT_SUPPRESS_MS;
  } catch {
    return false;
  }
};

export const ReloadPrompt = () => {
  const { pathname } = useLocation();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = usePwaRegister();
  const [isUpdating, setIsUpdating] = useState(false);
  const [autoApplying, setAutoApplying] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(() =>
    shouldStartSuppressed(),
  );

  const mountedAtRef = useRef(Date.now());
  const coldStartTriggeredRef = useRef(false);

  useEffect(() => {
    if (!needRefresh) {
      setIsUpdating(false);
      setAutoApplying(false);
      setPromptDismissed(false);
      coldStartTriggeredRef.current = false;
      try {
        window.sessionStorage.removeItem(UPDATE_PROMPT_SUPPRESS_KEY);
      } catch {
        // ignore
      }
    }
  }, [needRefresh]);

  const handleReload = useCallback(async () => {
    setPromptDismissed(true);
    setIsUpdating(true);
    try {
      window.sessionStorage.setItem(
        UPDATE_PROMPT_SUPPRESS_KEY,
        String(Date.now()),
      );
    } catch {
      // ignore
    }
    try {
      await updateServiceWorker(true);
    } catch {
      // Safari iOS en modo standalone puede ignorar el flujo del plugin.
    } finally {
      window.setTimeout(() => {
        if (document.visibilityState === "visible") {
          window.location.reload();
        }
      }, 900);
      window.setTimeout(() => setIsUpdating(false), 1800);
    }
  }, [updateServiceWorker]);

  useLayoutEffect(() => {
    if (!needRefresh || coldStartTriggeredRef.current) {
      return;
    }
    if (shouldBlockPwaAutoReload(pathname)) {
      return;
    }
    const elapsed = Date.now() - mountedAtRef.current;
    if (elapsed <= COLD_START_UPDATE_WINDOW_MS) {
      coldStartTriggeredRef.current = true;
      setAutoApplying(true);
      void handleReload();
    }
  }, [needRefresh, handleReload, pathname]);

  const showUpdatingOverlay =
    needRefresh && (autoApplying || isUpdating);

  if (showUpdatingOverlay) {
    return (
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-[1px]"
        role="status"
        aria-live="polite"
      >
        <div className="max-w-sm rounded-2xl border border-teal-200 bg-white px-6 py-5 text-center shadow-xl ring-1 ring-teal-100">
          <div
            className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-teal-200 border-t-teal-700"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-slate-900">
            Actualizando a la última versión...
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Esto solo tomará un momento.
          </p>
        </div>
      </div>
    );
  }

  if (!needRefresh || promptDismissed) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-[300] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-xl rounded-2xl border border-teal-200 bg-white p-4 shadow-xl ring-1 ring-teal-100"
      >
        <p className="text-sm font-medium text-slate-900">
          Hay una nueva versión disponible. Por favor, actualiza para aplicar los
          cambios.
        </p>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void handleReload()}
            disabled={isUpdating}
            className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            {isUpdating ? "Actualizando..." : "Actualizar ahora"}
          </button>
        </div>
      </div>
    </div>
  );
};
