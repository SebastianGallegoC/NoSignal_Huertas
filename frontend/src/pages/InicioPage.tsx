import { Link } from 'react-router-dom';

export const InicioPage = () => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e2f2ee_0,_#f6f7f5_45%,_#f6f7f5_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">NoSignal</p>
          <h1 className="mt-2 text-3xl font-semibold">Selecciona una opción111111111111</h1>
          <p className="mt-2 text-sm text-slate-600">Puedes diligenciar un nuevo formulario o revisar los ya registrados.</p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <Link
            to="/formulario"
            className="rounded-2xl border border-teal-100 bg-white/90 p-6 shadow-[0_18px_40px_-35px_rgba(15,118,110,0.6)] transition hover:-translate-y-0.5"
          >
            <h2 className="text-lg font-semibold text-teal-800">Completar formularios</h2>
            <p className="mt-2 text-sm text-slate-600">
              Captura nuevos registros con GPS, fotos y sincronización offline-first.
            </p>
          </Link>

          <Link
            to="/formularios-diligenciados"
            className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-[0_18px_40px_-35px_rgba(30,41,59,0.45)] transition hover:-translate-y-0.5"
          >
            <h2 className="text-lg font-semibold text-slate-900">Ver formularios diligenciados</h2>
            <p className="mt-2 text-sm text-slate-600">
              Historial de este equipo y, si hay sesión, formularios ya guardados en el servidor.
            </p>
          </Link>
        </section>
      </div>
    </div>
  );
};
