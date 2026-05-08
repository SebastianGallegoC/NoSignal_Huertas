import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export type ImportResultVariant = "success" | "warning" | "error";

type Props = {
  open: boolean;
  variant: ImportResultVariant;
  title: string;
  message: string;
  onClose: () => void;
};

const variantStyles: Record<
  ImportResultVariant,
  { ring: string; iconBg: string; icon: string }
> = {
  success: {
    ring: "border-emerald-200 bg-emerald-50/90",
    iconBg: "bg-emerald-100 text-emerald-800",
    icon: "✓",
  },
  warning: {
    ring: "border-amber-200 bg-amber-50/90",
    iconBg: "bg-amber-100 text-amber-900",
    icon: "!",
  },
  error: {
    ring: "border-red-200 bg-red-50/90",
    iconBg: "bg-red-100 text-red-800",
    icon: "✕",
  },
};

export function ImportResultModal({
  open,
  variant,
  title,
  message,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const s = variantStyles[variant];

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-result-title"
      aria-describedby="import-result-desc"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-md rounded-2xl border p-6 shadow-xl ${s.ring}`}
      >
        <div className="flex gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold ${s.iconBg}`}
            aria-hidden
          >
            {s.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="import-result-title"
              className="text-lg font-semibold text-slate-900"
            >
              {title}
            </h2>
            <p
              id="import-result-desc"
              className="mt-2 text-sm leading-relaxed text-slate-800"
            >
              {message}
            </p>
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                className="bg-teal-700 text-white hover:bg-teal-800"
                onClick={onClose}
              >
                Aceptar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
