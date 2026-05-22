import { Button } from "@/components/ui/button";
import type { VisitaNumero } from "@/services/db";

type Props = {
  open: boolean;
  nombreArchivo: string;
  visita?: VisitaNumero;
  onCancel: () => void;
  onConfirm: () => void;
};

const visitaLabel = (v?: VisitaNumero) => (v ? `visita ${v}` : "sin visita asignada");

export const RemoveFotoConfirmModal = ({
  open,
  nombreArchivo,
  visita,
  onCancel,
  onConfirm,
}: Props) => {
  if (!open) {
    return null;
  }

  const displayName = nombreArchivo.trim() || "esta foto";

  return (
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
        aria-label="Cerrar"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quitar-foto-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-xl ring-1 ring-rose-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="quitar-foto-title"
          className="text-lg font-semibold text-slate-900"
        >
          ¿Eliminar esta foto?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Se quitará <span className="font-medium text-slate-800">{displayName}</span>{" "}
          ({visitaLabel(visita)}). Esta acción no se puede deshacer.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-rose-700 text-white hover:bg-rose-800"
            onClick={onConfirm}
          >
            Sí, eliminar
          </Button>
        </div>
      </div>
    </div>
  );
};
