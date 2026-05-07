import { formatDateTime } from "@/lib/formatDateTime";
import type { SyncErrorItem } from "@/services/sync";
import { Button } from "@/components/ui/button";

type Props = {
  estado: "idle" | "buscando" | "ok" | "error";
  progreso: string | null;
  gps: { latitud: number; longitud: number; precision: number } | null;
  error: string | null;
  cargando: boolean;
  pendientes: number;
  erroresSync: number;
  ultimosErrores: SyncErrorItem[];
  onSolicitarGps: () => void;
  buildMapUrl: (lat: number, lon: number) => string;
  buildExternalMapUrl: (lat: number, lon: number) => string;
};

export const FormularioOverviewPanel = ({
  estado,
  progreso,
  gps,
  error,
  cargando,
  pendientes,
  erroresSync,
  ultimosErrores,
  onSolicitarGps,
  buildMapUrl,
  buildExternalMapUrl,
}: Props) => {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-teal-100 bg-white/80 p-4 shadow-[0_18px_40px_-35px_rgba(15,118,110,0.6)]">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            GPS
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-700">
            Estado:{" "}
            {estado === "buscando"
              ? "Tomando ubicación..."
              : estado === "ok"
                ? "Ubicación capturada"
                : estado === "error"
                  ? "Error de GPS"
                  : "Sin lectura"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {estado === "buscando"
              ? (progreso ?? "Buscando señal GPS...")
              : gps
                ? `OK · precisión ${gps.precision.toFixed(1)} m`
                : error
                  ? `Error: ${error}`
                  : "Sin ubicación registrada"}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 border-teal-200 text-teal-800 hover:bg-teal-50"
            onClick={onSolicitarGps}
            disabled={cargando}
          >
            {cargando ? "Buscando GPS…" : "Tomar ubicación"}
          </Button>
          {gps ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-teal-100 bg-slate-50">
              <div className="h-48 overflow-hidden">
                {typeof navigator !== "undefined" && navigator.onLine ? (
                  <iframe
                    title="Mapa de ubicación capturada"
                    className="h-[calc(100%+36px)] w-full"
                    src={buildMapUrl(gps.latitud, gps.longitud)}
                    loading="lazy"
                    style={{ marginBottom: "-36px" }}
                  />
                ) : (
                  <div className="flex h-48 w-full items-center justify-center bg-slate-100">
                    <div className="text-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="96"
                        height="96"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#0f766e"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mx-auto mb-2"
                      >
                        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
                        <circle cx="12" cy="10" r="2" />
                      </svg>
                      <div className="text-sm font-medium text-slate-700">
                        Sin conexión: mapa no disponible.
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        Lat: {gps.latitud.toFixed(6)} · Lon:{" "}
                        {gps.longitud.toFixed(6)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-3 py-2 text-xs text-slate-700">
                Lat: {gps.latitud.toFixed(6)} · Lon: {gps.longitud.toFixed(6)} ·
                Precisión: {gps.precision.toFixed(1)} m
              </div>
              <a
                className={`block px-3 pb-3 text-xs font-medium ${navigator.onLine ? "text-teal-800 underline" : "text-slate-400"}`}
                href={
                  navigator.onLine
                    ? buildExternalMapUrl(gps.latitud, gps.longitud)
                    : undefined
                }
                target="_blank"
                rel="noreferrer"
                aria-disabled={!navigator.onLine}
                onClick={(e) => {
                  if (!navigator.onLine) e.preventDefault();
                }}
              >
                {navigator.onLine
                  ? "Abrir ubicación en OpenStreetMap"
                  : "Abrir ubicación (requiere conexión)"}
              </a>
            </div>
          ) : null}
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white/80 p-4 shadow-[0_18px_40px_-35px_rgba(180,83,9,0.6)]">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Pendientes
          </h2>
          <p className="mt-2 text-4xl font-semibold">{pendientes}</p>
          <p className="text-sm text-slate-600">Formularios en cola local.</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-white/80 p-4 shadow-[0_18px_40px_-35px_rgba(190,24,93,0.5)]">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            Errores sync
          </h2>
          <p className="mt-2 text-4xl font-semibold">{erroresSync}</p>
          <p className="text-sm text-slate-600">
            Registros con error de envío.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Últimos errores de sincronización
        </h2>
        {ultimosErrores.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Sin errores recientes.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {ultimosErrores.map((item) => (
              <li
                key={item.id_formulario}
                className="rounded-xl border border-rose-100 bg-rose-50/40 p-3"
              >
                <p className="font-medium text-slate-900">
                  {item.id_formulario} · usuario {item.id_usuario}
                </p>
                <p className="text-slate-600">
                  Intentos: {item.errores_sync}
                  {item.fecha_intento
                    ? ` · último: ${formatDateTime(item.fecha_intento)}`
                    : ""}
                </p>
                <p className="text-rose-700">
                  {item.ultimo_error ?? "Error no especificado"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
};
