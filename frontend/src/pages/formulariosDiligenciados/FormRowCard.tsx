import { Button } from "@/components/ui/button";
import {
  FormularioRespuestaReadOnly,
  type FormularioSnapshot,
} from "@/components/form/FormularioRespuestaReadOnly";
import type { DisplayRow } from "@/services/formHistory";
import type { HistorialForm, PrecargaForm } from "@/services/db";
import {
  DETAIL_SOURCE_COLOR,
  DETAIL_SOURCE_LABEL,
  estadoClass,
  fotosConVisitaDesdeDetalle,
  type DetailSourceKind,
} from "@/pages/formulariosDiligenciados/helpers";

interface FormRowCardProps {
  row: DisplayRow;
  isOpen: boolean;
  online: boolean;
  eliminandoId: string | null;
  precarga: PrecargaForm | null;
  precargaFechaLabel: string | null;
  tituloUsuario: string;
  tituloFechaLabel: string;
  ultimaActualizacionLabel: string;
  historial: HistorialForm | null;
  effectiveDetailSource: DetailSourceKind;
  detailLoading: boolean;
  detailSnapshot: FormularioSnapshot | null;
  detailPrecarga: PrecargaForm | null;
  precargaLoadingId: string | null;
  eliminandoPrecargaId: string | null;
  descargandoExcelId: string | null;
  descargandoFotosId: string | null;
  descargaExcelError: string | null;
  descargaFotosError: string | null;
  selectedId: string | null;
  onSelectRow: (row: DisplayRow) => void;
  onSolicitarEliminar: (row: DisplayRow) => void;
  onPrecargarRow: (row: DisplayRow) => void;
  onEliminarPrecargaRow: (row: DisplayRow) => void;
  onUsarComoBase: (row: DisplayRow) => void;
  onDescargarExcelDelRegistro: (row: DisplayRow) => void;
  onDescargarFotosDelRegistro: (row: DisplayRow) => void;
}

export const FormRowCard = ({
  row,
  isOpen,
  online,
  eliminandoId,
  precarga,
  precargaFechaLabel,
  tituloUsuario,
  tituloFechaLabel,
  ultimaActualizacionLabel,
  historial,
  effectiveDetailSource,
  detailLoading,
  detailSnapshot,
  detailPrecarga,
  precargaLoadingId,
  eliminandoPrecargaId,
  descargandoExcelId,
  descargandoFotosId,
  descargaExcelError,
  descargaFotosError,
  selectedId,
  onSelectRow,
  onSolicitarEliminar,
  onPrecargarRow,
  onEliminarPrecargaRow,
  onUsarComoBase,
  onDescargarExcelDelRegistro,
  onDescargarFotosDelRegistro,
}: FormRowCardProps) => {
  const precargado = !!precarga;

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-white/90 shadow-sm transition-shadow sm:rounded-2xl ${
        isOpen
          ? "border-teal-400 ring-2 ring-teal-200"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-stretch gap-1.5 p-1.5 sm:gap-3 sm:p-3">
        <button
          type="button"
          onClick={() => onSelectRow(row)}
          className="flex min-w-0 flex-1 items-start justify-between gap-2 rounded-lg p-1.5 text-left sm:gap-3 sm:rounded-xl sm:p-3"
        >
          <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {row.onServer ? (
                <span className="rounded bg-emerald-100 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-900 sm:rounded-md sm:px-2 sm:py-0.5 sm:text-[10px]">
                  Servidor
                </span>
              ) : null}
              {row.precargaSolo ? (
                <span className="rounded bg-indigo-100 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-indigo-900 sm:rounded-md sm:px-2 sm:py-0.5 sm:text-[10px]">
                  Precarga offline
                </span>
              ) : null}
              {!row.onServer && !row.precargaSolo ? (
                <span className="rounded bg-slate-200 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-slate-800 sm:rounded-md sm:px-2 sm:py-0.5 sm:text-[10px]">
                  Solo este equipo
                </span>
              ) : null}
              {precargado ? (
                <span className="rounded bg-indigo-100 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-indigo-900 sm:rounded-md sm:px-2 sm:py-0.5 sm:text-[10px]">
                  Precargado
                </span>
              ) : null}
              <span
                className={`rounded px-1.5 py-px text-[9px] font-semibold sm:rounded-md sm:px-2 sm:py-0.5 sm:text-[10px] ${DETAIL_SOURCE_COLOR[effectiveDetailSource]}`}
                title="Fuente usada para el detalle del formulario al expandir"
              >
                Origen: {DETAIL_SOURCE_LABEL[effectiveDetailSource]}
              </span>
            </div>
            <p className="text-sm font-medium leading-snug text-slate-900 sm:text-base sm:leading-normal">
              Beneficiario: {tituloUsuario}
            </p>
            <p className="text-xs leading-snug text-slate-600 sm:text-sm sm:leading-normal">
              Fecha de envío del formulario: {tituloFechaLabel}
            </p>
            <p className="text-xs leading-snug text-slate-600 sm:text-sm sm:leading-normal">
              Última actualización: {ultimaActualizacionLabel}
            </p>
            {historial ? (
              <p
                className={`text-xs font-semibold leading-snug sm:text-sm sm:leading-normal ${estadoClass[historial.estado]}`}
              >
                Estado en este dispositivo: {historial.estado}
              </p>
            ) : row.onServer ? (
              <p className="text-xs font-semibold leading-snug text-emerald-700 sm:text-sm sm:leading-normal">
                Sincronizado en servidor
              </p>
            ) : row.precargaSolo ? (
              <p className="text-xs font-semibold leading-snug text-indigo-800 sm:text-sm sm:leading-normal">
                Copia guardada en este dispositivo para uso sin red
              </p>
            ) : null}
            {historial?.ultimo_error ? (
              <p className="text-xs leading-snug text-rose-700 sm:text-sm sm:leading-normal">
                Error: {historial.ultimo_error}
              </p>
            ) : null}
          </div>
          <span
            className={`mt-0.5 shrink-0 self-start rounded-md border px-1.5 py-0.5 text-[11px] font-medium sm:mt-1 sm:rounded-lg sm:px-2 sm:py-1 sm:text-xs ${
              isOpen
                ? "border-teal-600 bg-teal-50 text-teal-800"
                : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            {isOpen ? "Cerrar" : "Ver formulario"}
          </span>
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!online || eliminandoId === row.id_formulario}
          title={!online ? "Requiere conexión a internet" : undefined}
          onClick={(e) => {
            e.stopPropagation();
            onSolicitarEliminar(row);
          }}
          className="h-8 shrink-0 self-center border-rose-200 px-2 text-xs text-rose-800 hover:bg-rose-50 sm:h-9 sm:px-3 sm:text-sm"
        >
          {eliminandoId === row.id_formulario ? "…" : "Eliminar"}
        </Button>
      </div>

      {isOpen ? (
        <div className="border-t border-slate-200 bg-[linear-gradient(180deg,_#fafcfb_0%,_#fff_12%)] px-3 py-3 sm:px-4 sm:py-5">
          {detailLoading ? (
            <p className="text-center text-sm text-slate-600">Cargando…</p>
          ) : detailSnapshot ? (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-end">
                <span
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${DETAIL_SOURCE_COLOR[effectiveDetailSource]}`}
                >
                  Origen: {DETAIL_SOURCE_LABEL[effectiveDetailSource]}
                </span>
              </div>
              <FormularioRespuestaReadOnly snapshot={detailSnapshot} />
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {(() => {
                  const fotosDetalle =
                    detailPrecarga?.fotos ?? detailSnapshot.fotos ?? [];
                  const fotosConData =
                    fotosConVisitaDesdeDetalle(fotosDetalle).length > 0;
                  const hayFotosServidor = (row.server?.fotos?.length ?? 0) > 0;
                  const canDownloadPhotos =
                    !detailLoading && (fotosConData || hayFotosServidor);
                  return (
                    <>
                      {row.server ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void onPrecargarRow(row)}
                          disabled={precargaLoadingId === row.id_formulario}
                        >
                          {precargado
                            ? "Actualizar precarga"
                            : "Precargar para visita"}
                        </Button>
                      ) : null}
                      {online && (precargado || row.historial) ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void onEliminarPrecargaRow(row)}
                          disabled={
                            precargaLoadingId === row.id_formulario ||
                            eliminandoPrecargaId === row.id_formulario
                          }
                          className="shrink-0 border-rose-200 text-rose-800 hover:bg-rose-50"
                        >
                          {eliminandoPrecargaId === row.id_formulario
                            ? "Eliminando…"
                            : precargado
                              ? "Eliminar precarga"
                              : "Eliminar datos locales"}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        onClick={() => void onUsarComoBase(row)}
                      >
                        Editar este formulario
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void onDescargarExcelDelRegistro(row)}
                        disabled={
                          detailLoading ||
                          descargandoExcelId === row.id_formulario
                        }
                      >
                        {descargandoExcelId === row.id_formulario
                          ? "Descargando Excel…"
                          : "Descargar Excel"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void onDescargarFotosDelRegistro(row)}
                        disabled={
                          !canDownloadPhotos ||
                          descargandoFotosId === row.id_formulario
                        }
                      >
                        {descargandoFotosId === row.id_formulario
                          ? "Descargando fotos…"
                          : "Descargar fotos"}
                      </Button>
                    </>
                  );
                })()}
                {precargaFechaLabel ? (
                  <span className="text-xs text-slate-500">
                    Precargado el {precargaFechaLabel}
                  </span>
                ) : null}
              </div>
              {descargaExcelError && selectedId === row.id_formulario ? (
                <p className="text-xs text-rose-600">{descargaExcelError}</p>
              ) : null}
              {descargaFotosError && selectedId === row.id_formulario ? (
                <p className="text-xs text-rose-600">{descargaFotosError}</p>
              ) : null}
              {precargaLoadingId === row.id_formulario ? (
                <p className="text-xs text-slate-500">
                  Precargando datos para uso offline…
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};
