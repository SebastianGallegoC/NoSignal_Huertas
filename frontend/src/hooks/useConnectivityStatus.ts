import { useEffect, useMemo, useState } from "react";

const HEALTH_CHECK_INTERVAL_MS = 15_000;
const HEALTH_CHECK_TIMEOUT_MS = 2_500;

const buildHealthUrl = (): string => {
  const apiBase = import.meta.env.VITE_API_URL ?? "";
  const base = apiBase || (typeof window !== "undefined" ? window.location.origin : "");
  return new URL("/health", base).toString();
};

export const useConnectivityStatus = (): boolean => {
  const initialOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const [isOnline, setIsOnline] = useState(initialOnline);
  const healthUrl = useMemo(() => buildHealthUrl(), []);

  useEffect(() => {
    if (import.meta.env.MODE === "test") {
      return;
    }

    let active = true;
    let intervalId: number | null = null;

    const probe = async () => {
      if (!active) {
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsOnline(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

      try {
        const response = await fetch(healthUrl, {
          cache: "no-store",
          credentials: "omit",
          signal: controller.signal,
        });
        if (active) {
          setIsOnline(response.ok);
        }
      } catch {
        if (active) {
          setIsOnline(false);
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    const refresh = () => {
      void probe();
    };

    const onOnline = () => {
      setIsOnline(true);
      refresh();
    };

    const onOffline = () => {
      setIsOnline(false);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    refresh();
    intervalId = window.setInterval(refresh, HEALTH_CHECK_INTERVAL_MS);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      if (intervalId != null) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [healthUrl]);

  return isOnline;
};