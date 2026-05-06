/** Sesión de depuración del agente (sin PII: solo hashes y longitudes). */

const DEBUG_SESSION_ID = "7b6477";

/** Solo si definís `VITE_AGENT_INGEST_URL` en `.env.local` (recolector local activo). */
const AGENT_INGEST_URL = String(
  import.meta.env.VITE_AGENT_INGEST_URL ?? "",
).trim();

export function beneficiaryFieldProbe(
  datos: Record<string, unknown> | undefined,
): { len: number; h: number | null } {
  const v = datos?.nombres_apellidos_beneficiario;
  if (typeof v !== "string") {
    return { len: -1, h: null };
  }
  let h = 0;
  for (let i = 0; i < v.length; i++) {
    h = ((h << 5) - h + v.charCodeAt(i)) | 0;
  }
  return { len: v.length, h };
}

export function idSuffix(id: string): string {
  return id.length <= 10 ? id : id.slice(-10);
}

// #region agent log
export function agentSessionLog(payload: {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId?: string;
}): void {
  const body = {
    sessionId: DEBUG_SESSION_ID,
    timestamp: Date.now(),
    ...payload,
    data: payload.data ?? {},
  };
  console.debug("[dbg-session-7b6477]", body);
  if (!AGENT_INGEST_URL) {
    return;
  }
  void fetch(AGENT_INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": DEBUG_SESSION_ID,
    },
    body: JSON.stringify(body),
  }).catch(() => {});
}
// #endregion
