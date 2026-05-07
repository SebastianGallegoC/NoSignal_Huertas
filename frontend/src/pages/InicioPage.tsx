import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { countErrorForms, countPendingForms } from "@/services/sync";

export const InicioPage = () => {
  const [pendientes, setPendientes] = useState(0);
  const [erroresSync, setErroresSync] = useState(0);

  const refreshCounts = useCallback(async () => {
    const [pendingCount, errorCount] = await Promise.all([
      countPendingForms(),
      countErrorForms(),
    ]);
    setPendientes(pendingCount);
    setErroresSync(errorCount);
  }, []);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    const onOnline = () => {
      void refreshCounts();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshCounts();
      }
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshCounts]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e2f2ee_0,_#f6f7f5_45%,_#f6f7f5_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">
            NoSignal
          </p>
          <section className="mb-5 mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-amber-200/80 bg-white/95 p-4 shadow-sm ring-1 ring-amber-100/60 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                    Pendientes
                  </p>
                  <p className="mt-2 text-4xl font-semibold leading-none text-slate-900">
                    {pendientes}
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                  Cola local
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Formularios guardados en este equipo y pendientes por sincronizar.
              </p>
            </div>
            <div className="rounded-2xl border border-rose-200/80 bg-white/95 p-4 shadow-sm ring-1 ring-rose-100/60 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700">
                    Errores sync
                  </p>
                  <p className="mt-2 text-4xl font-semibold leading-none text-slate-900">
                    {erroresSync}
                  </p>
                </div>
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700">
                  Requiere revisión
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Registros que fallaron al enviar y necesitan reintento.
              </p>
            </div>
          </section>
          <h1 className="mt-2 text-3xl font-semibold">
            Selecciona una opción V.1
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Puedes diligenciar un nuevo formulario o revisar los ya registrados.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <Link
            to="/formulario"
            className="rounded-2xl border border-teal-100 bg-white/90 p-6 shadow-[0_18px_40px_-35px_rgba(15,118,110,0.6)] transition hover:-translate-y-0.5"
          >
            <h2 className="text-lg font-semibold text-teal-800">
              Completar formularios
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Captura nuevos registros con GPS, fotos y sincronización
              offline-first.
            </p>
          </Link>

          <Link
            to="/formularios-diligenciados"
            className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-[0_18px_40px_-35px_rgba(30,41,59,0.45)] transition hover:-translate-y-0.5"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              Ver formularios diligenciados
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Historial de este equipo y, si hay sesión, formularios ya
              guardados en el servidor.
            </p>
          </Link>
        </section>
      </div>
    </div>
  );
};
