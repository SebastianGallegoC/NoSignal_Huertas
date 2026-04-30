import { ACCESS_TOKEN_KEY } from '@/lib/authStorage';

import type { OfflineForm } from './db';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const LEGACY_API_MAX_GPS_ACCURACY_METERS = 5;

type ApiFormPayload = {
  id_formulario: string;
  id_usuario: string;
  fecha_hora: string;
  gps: {
    latitud: number;
    longitud: number;
    precision: number;
  };
  datos_formulario: Record<string, unknown>;
  fotos: Array<{ nombre_archivo: string; data: string }>;
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
  return {
    id_formulario: form.id_formulario,
    id_usuario: ensureSafeUserId(form.id_usuario),
    fecha_hora: form.fecha_hora,
    gps: {
      ...form.gps,
      // Compatibilidad con backend productivo antiguo (rechaza precisión > 5m con 422).
      precision: Math.min(form.gps.precision, LEGACY_API_MAX_GPS_ACCURACY_METERS),
    },
    datos_formulario: form.datos_formulario,
    fotos: form.fotos.map((f) => ({
      ...f,
      data: ensureFotoDataUrl(f.data),
    })),
  };
}

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
};

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export const loginApi = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `login_${response.status}`);
  }
  return response.json() as Promise<LoginResponse>;
};

export const postForm = async (payload: OfflineForm): Promise<Response> => {
  const body = payloadForApi(payload);
  return fetch(`${API_BASE}/api/v1/forms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': body.id_formulario,
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });
};
