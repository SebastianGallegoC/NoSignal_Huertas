import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect, useRef } from "react";

const DEFAULT_UPDATE_CHECK_MS = 60_000;

export const usePwaRegister = () => {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const sw = useRegisterSW({
    onRegisteredSW: (_swUrl, registration) => {
      registrationRef.current = registration ?? null;
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

    const timer = window.setInterval(triggerUpdate, DEFAULT_UPDATE_CHECK_MS);
    window.addEventListener("online", triggerUpdate);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", triggerUpdate);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return sw;
};
