import { Button } from "@/components/ui/button";

type Props = {
  estado: "idle" | "buscando" | "ok" | "error";
  progreso: string | null;
  gps: { latitud: number; longitud: number; precision: number } | null;
  error: string | null;
  cargando: boolean;
  onSolicitarGps: () => void;
  modoCoordenadas: "automatico" | "manual";
  onChangeModoCoordenadas: (modo: "automatico" | "manual") => void;
  buildMapUrl: (lat: number, lon: number) => string;
  buildExternalMapUrl: (lat: number, lon: number) => string;
};

export const FormularioOverviewPanel = ({
  estado,
  progreso,
  gps,
  error,
  cargando,
  onSolicitarGps,
  modoCoordenadas,
  onChangeModoCoordenadas,
  buildMapUrl,
  buildExternalMapUrl,
}: Props) => {
  const isGps = modoCoordenadas === "automatico";

  return (
    <section className="rounded-2xl border border-teal-100 bg-white/80 p-4 shadow-[0_18px_40px_-35px_rgba(15,118,110,0.6)] sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          Ubicación
        </h2>
        <p className="text-xs text-slate-500">
          Elegí si usás el GPS del dispositivo o coordenadas manuales.
        </p>
      </div>

      <div
        className="mt-4 flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
        role="group"
        aria-label="Modo de coordenadas"
      >
        <div className="inline-flex w-full rounded-xl border border-slate-200 bg-slate-50/90 p-1 lg:w-auto lg:min-w-[320px]">
          <button
            type="button"
            aria-pressed={isGps}
            onClick={() => onChangeModoCoordenadas("automatico")}
            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition lg:flex-none lg:min-w-[150px] ${
              isGps
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-white/80"
            }`}
          >
            GPS
          </button>
          <button
            type="button"
            aria-pressed={!isGps}
            onClick={() => onChangeModoCoordenadas("manual")}
            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition lg:flex-none lg:min-w-[150px] ${
              !isGps
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-white/80"
            }`}
          >
            Manual
          </button>
        </div>

        {isGps ? (
          <Button
            type="button"
            onClick={onSolicitarGps}
            disabled={cargando}
            className="w-full shrink-0 bg-teal-600 text-white hover:bg-teal-700 lg:w-auto"
          >
            {cargando ? "Buscando GPS…" : "Tomar ubicación"}
          </Button>
        ) : null}
      </div>

      <p className="mt-3 text-sm font-medium text-slate-700">
        Estado:{" "}
        {isGps
          ? estado === "buscando"
            ? "Tomando ubicación..."
            : estado === "ok"
              ? "Ubicación capturada"
              : estado === "error"
                ? "Error de GPS"
                : "Sin lectura"
          : "Coordenadas manuales"}
      </p>
      <p className="mt-1 text-sm text-slate-600">
        {isGps
          ? estado === "buscando"
            ? (progreso ?? "Buscando señal GPS...")
            : gps
              ? `OK · precisión ${gps.precision.toFixed(1)} m`
              : error
                ? `Error: ${error}`
                : "Sin ubicación registrada"
          : "Editá latitud y longitud en los campos del formulario (sección correspondiente)."}
      </p>

      {!isGps ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 text-xs text-slate-600">
          En modo Manual no se usa el mapa ni el botón de ubicación; el envío
          tomará las coordenadas que ingreses en el formulario.
        </p>
      ) : null}

      {isGps && gps ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-teal-100 bg-slate-50">
          <div className="h-48 overflow-hidden sm:h-56">
            {typeof navigator !== "undefined" && navigator.onLine ? (
              <iframe
                title="Mapa de ubicación capturada"
                className="h-[calc(100%+36px)] w-full"
                src={buildMapUrl(gps.latitud, gps.longitud)}
                loading="lazy"
                style={{ marginBottom: "-36px" }}
              />
            ) : (
              <div className="flex h-48 w-full items-center justify-center bg-slate-100 sm:h-56">
                <div className="text-center px-4">
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
    </section>
  );
};
