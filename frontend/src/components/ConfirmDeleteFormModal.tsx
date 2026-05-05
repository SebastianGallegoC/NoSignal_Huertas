import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  passwordError?: string | null;
  onConfirm: (password: string) => void;
  onCancel: () => void;
  confirming?: boolean;
};

export function ConfirmDeleteFormModal({
  open,
  title,
  description,
  confirmLabel = "Eliminar",
  passwordLabel = "Contraseña",
  passwordPlaceholder = "Ingresá tu contraseña",
  passwordError = null,
  onConfirm,
  onCancel,
  confirming = false,
}: Props) {
  const [password, setPassword] = useState("");

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
    setPassword("");
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirming) {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, confirming, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
        aria-label="Cerrar"
        disabled={confirming}
        onClick={() => {
          if (!confirming) {
            onCancel();
          }
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-form-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-delete-form-title"
          className="text-lg font-semibold text-slate-900"
        >
          {title}
        </h2>
        <div className="mt-3 text-sm leading-relaxed text-slate-600">
          {description}
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-800">
          {passwordLabel}
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            placeholder={passwordPlaceholder}
            onChange={(e) => setPassword(e.target.value)}
            disabled={confirming}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          />
        </label>
        {passwordError ? (
          <p className="mt-2 text-xs text-rose-700">{passwordError}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={confirming}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onConfirm(password)}
            disabled={confirming || password.trim() === ""}
            className="border-rose-200 text-rose-800 hover:bg-rose-50"
          >
            {confirming ? "Eliminando…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
