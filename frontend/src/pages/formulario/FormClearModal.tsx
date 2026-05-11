import { Button } from "@/components/ui/button";

interface FormClearModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const FormClearModal = ({
  open,
  onCancel,
  onConfirm,
}: FormClearModalProps) => {
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
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="limpiar-formulario-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-xl ring-1 ring-amber-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="limpiar-formulario-title"
          className="text-lg font-semibold text-slate-900"
        >
          ¿Vaciar todo el formulario?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Se borrarán los datos diligenciados, las fotos y la ubicación (GPS o
          manual). Vas a obtener un formulario nuevo vacío. Esta acción no se
          puede deshacer.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-amber-700 text-white hover:bg-amber-800"
            onClick={onConfirm}
          >
            Sí, vaciar
          </Button>
        </div>
      </div>
    </div>
  );
};
