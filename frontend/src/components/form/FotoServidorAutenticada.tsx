import { useEffect, useRef, useState } from "react";

import { ACCESS_TOKEN_KEY } from "@/lib/authStorage";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type Props = {
  formId: string;
  photoIndex: number;
  alt: string;
  className?: string;
  onSrcChange?: (src: string | null) => void;
  /** Si true, el fetch arranca al acercarse al viewport (menos consultas en paralelo). */
  loadDeferred?: boolean;
};

export const FotoServidorAutenticada = ({
  formId,
  photoIndex,
  alt,
  className,
  onSrcChange,
  loadDeferred = false,
}: Props) => {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const onSrcChangeRef = useRef<Props["onSrcChange"]>(onSrcChange);
  const [visible, setVisible] = useState(!loadDeferred);

  useEffect(() => {
    onSrcChangeRef.current = onSrcChange;
  }, [onSrcChange]);

  useEffect(() => {
    if (!loadDeferred) {
      setVisible(true);
      return;
    }
    const el = wrapRef.current;
    if (!el) {
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "160px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadDeferred]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    let cancelled = false;
    setSrc(null);
    onSrcChangeRef.current?.(null);
    setFailed(false);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    const run = async () => {
      const token =
        typeof localStorage !== "undefined"
          ? localStorage.getItem(ACCESS_TOKEN_KEY)
          : null;
      const url = `${API_BASE}/api/v1/forms/${encodeURIComponent(formId)}/fotos/${photoIndex}`;
      try {
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "default",
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
        onSrcChangeRef.current?.(created);
      } catch {
        if (!cancelled) {
          setFailed(true);
          onSrcChangeRef.current?.(null);
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
      onSrcChangeRef.current?.(null);
    };
  }, [visible, formId, photoIndex]);

  const inner = failed ? (
    <div
      className={`flex aspect-square flex-col items-center justify-center gap-1 bg-rose-50 p-2 text-center text-[11px] text-rose-800 ${className ?? ""}`}
    >
      No se pudo cargar la imagen
    </div>
  ) : !src ? (
    <div
      className={`flex aspect-square animate-pulse items-center justify-center bg-slate-200 text-[11px] text-slate-500 ${className ?? ""}`}
    >
      Cargando…
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className={`aspect-square w-full object-cover ${className ?? ""}`}
      loading="lazy"
    />
  );

  if (loadDeferred) {
    return (
      <div ref={wrapRef} className="h-full w-full min-h-[6rem]">
        {inner}
      </div>
    );
  }

  return inner;
};
