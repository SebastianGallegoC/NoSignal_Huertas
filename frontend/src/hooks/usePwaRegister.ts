import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect, useRef } from "react";

const DEFAULT_UPDATE_CHECK_MS = 60_000;

export const usePwaRegister = () => {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const safeUpdate = (registration: ServiceWorkerRegistration | null) => {
    if (!registration) {
      return;
    }
    void registration.update().catch((error) => {
      // Offline o fallo de fetch del sw.js: no lo tratamos como error fatal.
      // eslint-disable-next-line no-console
      console.warn('ServiceWorker update failed (ignored)', error);
    });
  };
  const sw = useRegisterSW({
    onRegisteredSW: (_swUrl, registration) => {
      registrationRef.current = registration ?? null;
      // Al abrir la app, pedir de inmediato si hay SW nuevo (crítico para cold-start).
      if (typeof navigator === 'undefined' || navigator.onLine) {
        safeUpdate(registration ?? null);
      }
    },
  });

  useEffect(() => {
    const triggerUpdate = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      safeUpdate(registrationRef.current);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        triggerUpdate();
      }
    };

    triggerUpdate();
    const bootDelays = [250, 1500, 4000].map((ms) =>
      window.setTimeout(triggerUpdate, ms),
    );

    const timer = window.setInterval(triggerUpdate, DEFAULT_UPDATE_CHECK_MS);
    window.addEventListener("online", triggerUpdate);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      for (const id of bootDelays) {
        window.clearTimeout(id);
      }
      window.clearInterval(timer);
      window.removeEventListener("online", triggerUpdate);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return sw;
};
