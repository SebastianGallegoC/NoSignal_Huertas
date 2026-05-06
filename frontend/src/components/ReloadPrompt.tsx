import { usePwaRegister } from "@/hooks/usePwaRegister";

export const ReloadPrompt = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = usePwaRegister();

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-[300] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-xl rounded-2xl border border-teal-200 bg-white p-4 shadow-xl ring-1 ring-teal-100"
      >
        <p className="text-sm font-medium text-slate-900">
          Hay una nueva versión disponible. Por favor, actualiza para aplicar los
          cambios.
        </p>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            Actualizar ahora
          </button>
        </div>
      </div>
    </div>
  );
};
