import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect, useRef } from "react";

const DEFAULT_UPDATE_CHECK_MS = 60_000;

export const usePwaRegister = () => {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const sw = useRegisterSW({
    onRegisteredSW: (_swUrl, registration) => {
      registrationRef.current = registration ?? null;
      // Al abrir la app, pedir de inmediato si hay SW nuevo (crítico para cold-start).
      void registration?.update();
    },
  });

  useEffect(() => {
    const triggerUpdate = () => {
      void registrationRef.current?.update();
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
