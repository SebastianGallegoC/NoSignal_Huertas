import { useEffect, useRef, useState } from 'react';

import { ACCESS_TOKEN_KEY } from '@/lib/authStorage';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

type Props = {
  formId: string;
  photoIndex: number;
  alt: string;
  className?: string;
};

export const FotoServidorAutenticada = ({ formId, photoIndex, alt, className }: Props) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    const run = async () => {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
      const url = `${API_BASE}/api/v1/forms/${encodeURIComponent(formId)}/fotos/${photoIndex}`;
      try {
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          if (!cancelled) {
            setFailed(true);
          }
          return;
        }
        const blob = await res.blob();
        const created = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(created);
          return;
        }
        blobUrlRef.current = created;
        setSrc(created);
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [formId, photoIndex]);

  if (failed) {
    return (
      <div
        className={`flex aspect-square flex-col items-center justify-center gap-1 bg-rose-50 p-2 text-center text-[11px] text-rose-800 ${className ?? ''}`}
      >
        No se pudo cargar la imagen
      </div>
    );
  }

  if (!src) {
    return (
      <div
        className={`flex aspect-square animate-pulse items-center justify-center bg-slate-200 text-[11px] text-slate-500 ${className ?? ''}`}
      >
        Cargando…
      </div>
    );
  }

  return <img src={src} alt={alt} className={`aspect-square w-full object-cover ${className ?? ''}`} loading="lazy" />;
};
