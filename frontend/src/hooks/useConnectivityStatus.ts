import { useEffect, useMemo, useState } from "react";

const HEALTH_CHECK_BASE_MS = 15_000;
const HEALTH_CHECK_MAX_MS = 60_000;
const HEALTH_CHECK_TIMEOUT_MS = 2_500;

export const buildHealthUrl = (apiBase = import.meta.env.VITE_API_URL ?? ""): string => {
  const base = apiBase || (typeof window !== "undefined" ? window.location.origin : "");
  return new URL("/health", base).toString();
};

export const checkConnectivity = async (
  healthUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

  try {
    const response = await fetchImpl(healthUrl, {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

/** Tras fallos consecutivos, espaciar el ping para reducir ruido en consola (el navegador igual puede loguear el fallo). */
function delayAfterFailure(failCount: number): number {
  if (failCount <= 0) {
    return HEALTH_CHECK_BASE_MS;
  }
  return Math.min(
    HEALTH_CHECK_MAX_MS,
    HEALTH_CHECK_BASE_MS * Math.pow(2, Math.min(failCount, 3)),
  );
}

export const useConnectivityStatus = (): boolean => {
  const initialOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const [isOnline, setIsOnline] = useState(initialOnline);
  const healthUrl = useMemo(() => buildHealthUrl(), []);

  useEffect(() => {
    if (import.meta.env.MODE === "test") {
      return;
    }

    let active = true;
    let timeoutId: number | null = null;
    let failCount = 0;

    const clearTimer = () => {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const schedule = (delayMs: number) => {
      clearTimer();
      timeoutId = window.setTimeout(() => {
        void probe();
      }, delayMs);
    };

    const probe = async () => {
      if (!active) {
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        schedule(HEALTH_CHECK_BASE_MS);
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (active) {
          setIsOnline(false);
        }
        failCount = Math.min(failCount + 1, 10);
        schedule(delayAfterFailure(failCount));
        return;
      }

      const ok = await checkConnectivity(healthUrl);
      if (!active) {
        return;
      }

      setIsOnline(ok);
      if (ok) {
        failCount = 0;
        schedule(HEALTH_CHECK_BASE_MS);
      } else {
        failCount = Math.min(failCount + 1, 10);
        schedule(delayAfterFailure(failCount));
      }
    };

    const onOnline = () => {
      failCount = 0;
      setIsOnline(true);
      clearTimer();
      void probe();
    };

    const onOffline = () => {
      failCount = Math.min(failCount + 1, 10);
      setIsOnline(false);
      clearTimer();
      schedule(delayAfterFailure(failCount));
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        clearTimer();
        void probe();
      }
    };

    void probe();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      clearTimer();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [healthUrl]);

  return isOnline;
};
