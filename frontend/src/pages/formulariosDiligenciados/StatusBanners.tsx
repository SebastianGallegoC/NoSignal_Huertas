interface StatusBannersProps {
  precargaError: string | null;
  descargaFotosError: string | null;
  remoteLoaded: boolean;
  remoteError: string | null;
  online: boolean;
}

export const StatusBanners = ({
  precargaError,
  descargaFotosError,
  remoteLoaded,
  remoteError,
  online,
}: StatusBannersProps) => {
  return (
    <>
      {precargaError ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-900">
          {precargaError}
        </div>
      ) : null}

      {descargaFotosError ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-900">
          {descargaFotosError}
        </div>
      ) : null}

      {remoteLoaded && remoteError ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          No se pudo cargar la lista del servidor: {remoteError}. Se muestra
          solo el historial de este equipo.
        </div>
      ) : null}

      {!remoteLoaded ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
          Iniciá sesión para ver también los formularios sincronizados desde
          otros dispositivos.
        </div>
      ) : null}

      {!online ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/95 px-4 py-3 text-sm text-slate-800">
          Sin conexión a internet: no podés eliminar formularios. Vuelve a estar
          en línea para usar esa opción.
        </div>
      ) : null}
    </>
  );
};
