import { ACCESS_TOKEN_KEY } from '@/lib/authStorage';
import {
  agentSessionLog,
  beneficiaryFieldProbe,
  idSuffix,
} from '@/debug/agentSessionLog';

import type { OfflineForm } from './db';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const LEGACY_API_MAX_GPS_ACCURACY_METERS = 100;
const MIN_GPS_PRECISION_METERS = 0.1;

type ApiFormPayload = {
  id_formulario: string;
  id_usuario: string;
  fecha_hora: string;
  fecha_actualizacion?: string;
  gps: {
    latitud: number;
    longitud: number;
    precision: number;
  };
  datos_formulario: Record<string, unknown>;
  fotos: Array<{ nombre_archivo: string; data: string; visita?: 1 | 2 | 3 | null }>;
};

/** Normaliza imágenes para el validador del API (prefijo data:image/…). */
function ensureFotoDataUrl(data: string): string {
  const s = typeof data === 'string' ? data : '';
  const t = s.trim();
  if (/^data:image\//i.test(t)) {
    return t;
  }
  const compact = t.replace(/\s+/g, '');
  if (compact.length >= 64 && /^[A-Za-z0-9+/]+=*$/.test(compact)) {
    return `data:image/jpeg;base64,${compact}`;
  }
  return s;
}

/** Ajusta id_usuario a formato seguro para backends con validación estricta. */
function ensureSafeUserId(raw: string): string {
  const base = (raw || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return base || 'sin_usuario';
}

function payloadForApi(form: OfflineForm): ApiFormPayload {
  const fechaAct = form.fecha_actualizacion?.trim() || form.fecha_hora;
  const out: ApiFormPayload = {
    id_formulario: form.id_formulario,
    id_usuario: ensureSafeUserId(form.id_usuario),
    fecha_hora: form.fecha_hora,
    gps: {
      ...form.gps,
      // Compatibilidad con backend productivo antiguo (rechaza precisión > 5m con 422).
      precision: Math.max(
        MIN_GPS_PRECISION_METERS,
        Math.min(form.gps.precision, LEGACY_API_MAX_GPS_ACCURACY_METERS),
      ),
    },
    datos_formulario: form.datos_formulario,
    fotos: form.fotos.map((f) => ({
      nombre_archivo: f.nombre_archivo,
      data: ensureFotoDataUrl(f.data),
      visita:
        f.visita === 1 || f.visita === 2 || f.visita === 3 ? f.visita : null,
    })),
  };
  if (fechaAct !== form.fecha_hora) {
    out.fecha_actualizacion = fechaAct;
  }
  return out;
}

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('blob_read_failed'));
    reader.readAsDataURL(blob);
  });

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export class LoginApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail || `login_${status}`);
    this.name = "LoginApiError";
    this.status = status;
    this.detail = detail || `login_${status}`;
  }
}

export const loginApi = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new LoginApiError(response.status, detail || `login_${response.status}`);
  }
  return response.json() as Promise<LoginResponse>;
};

/** Respuesta de `GET /api/v1/forms/` (datos en servidor; fotos = rutas de archivo). */
export interface FormReadItem {
  id_formulario: string;
  id_usuario: string;
  fecha_hora: string;
  fecha_actualizacion: string;
  latitud: number;
  longitud: number;
  precision: number | null;
  datos_formulario: Record<string, unknown>;
  fotos: unknown[];
}

/** Elimina el formulario en el servidor (requiere JWT). */
export const deleteFormFromApi = async (formId: string): Promise<void> => {
  const url = `${API_BASE}/api/v1/forms/${encodeURIComponent(formId)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  if (response.status === 404) {
    const t = await response.text();
    throw new Error(t || 'form_not_found');
  }
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || `forms_delete_${response.status}`);
  }
};

export const listFormsFromApi = async (limit = 200): Promise<FormReadItem[]> => {
  const response = await fetch(`${API_BASE}/api/v1/forms/?limit=${limit}`, {
    headers: { ...authHeaders() },
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || `forms_list_${response.status}`);
  }
  const body = (await response.json()) as { items?: FormReadItem[] };
  const items = Array.isArray(body.items) ? body.items : [];
  // #region agent log
  agentSessionLog({
    hypothesisId: "H2",
    location: "api.ts:listFormsFromApi",
    message: "forms_list_response",
    data: {
      limit,
      count: items.length,
      cacheControl: response.headers?.get?.("cache-control") ?? null,
      age: response.headers?.get?.("age") ?? null,
      date: response.headers?.get?.("date") ?? null,
      probes: items.slice(0, 80).map((it) => ({
        idSuf: idSuffix(it.id_formulario),
        ben: beneficiaryFieldProbe(it.datos_formulario),
        datosJsonLen: JSON.stringify(it.datos_formulario ?? {}).length,
      })),
    },
  });
  // #endregion
  return items;
};

/** Devuelve detalle de un formulario por id (incluye fotos como rutas en `fotos`). */
export const fetchFormFromApi = async (formId: string): Promise<FormReadItem> => {
  const url = `${API_BASE}/api/v1/forms/${encodeURIComponent(formId)}`;
  const response = await fetch(url, {
    headers: { ...authHeaders() },
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(t || `forms_get_${response.status}`);
  }
  return (await response.json()) as FormReadItem;
};

export const postForm = async (payload: OfflineForm): Promise<Response> => {
  const body = payloadForApi(payload);
  // #region agent log
  agentSessionLog({
    hypothesisId: "H1",
    location: "api.ts:postForm",
    message: "forms_post_payload",
    data: {
      idSuf: idSuffix(body.id_formulario),
      ben: beneficiaryFieldProbe(body.datos_formulario),
      datosJsonLen: JSON.stringify(body.datos_formulario ?? {}).length,
      datosKeysSample: Object.keys(body.datos_formulario ?? {}).slice(0, 40),
    },
  });
  // #endregion
  // FastAPI suele redirigir /forms -> /forms/ (307). En algunos despliegues ese redirect
  // no incluye cabeceras CORS y el navegador lo bloquea; por eso usamos la ruta final.
  const res = await fetch(`${API_BASE}/api/v1/forms/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': body.id_formulario,
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });
  // #region agent log
  agentSessionLog({
    hypothesisId: "H1",
    location: "api.ts:postForm",
    message: "forms_post_response",
    data: {
      idSuf: idSuffix(body.id_formulario),
      ok: res.ok,
      status: res.status,
    },
  });
  // #endregion
  return res;
};

export const fetchFormPhotoDataUrl = async (
  formId: string,
  photoIndex: number,
): Promise<string> => {
  const url = `${API_BASE}/api/v1/forms/${encodeURIComponent(formId)}/fotos/${photoIndex}`;
  const res = await fetch(url, {
    headers: { ...authHeaders() },
    cache: 'default',
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `foto_${res.status}`);
  }
  const blob = await res.blob();
  return blobToDataUrl(blob);
};
