import { useState, type ChangeEvent, type Ref, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import type { ImagePreview } from "@/components/form/ImagePreviewModal";
import { RemoveFotoConfirmModal } from "@/components/form/RemoveFotoConfirmModal";
import { isAtFormPhotoLimit, MAX_FORM_PHOTOS } from "@/lib/formPhotoLimits";
import type { FotoForm, VisitaNumero } from "@/services/db";

const visitaLabel = (v?: VisitaNumero) => (v ? `Visita ${v}` : "Sin visita");

type Props = {
  fotos: FotoForm[];
  visitaSeleccionada: VisitaNumero | null;
  onVisitaSeleccionadaChange: (v: VisitaNumero | null) => void;
  pickerInputRef: RefObject<HTMLInputElement | null>;
  cameraOpen: boolean;
  cameraVideoRef: Ref<HTMLVideoElement | null>;
  captureFlash: boolean;
  captureBadge: boolean;
  onOpenCamera: () => void;
  onStopCamera: () => void;
  onCaptureFromCamera: () => void;
  onFotosChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onQuitarFoto: (index: number) => void;
  onPreviewFoto: (image: ImagePreview) => void;
  /** Aviso visible sobre la vista de cámara (p. ej. límite de 15 fotos). */
  cameraNotice?: string | null;
};

export const FormularioFotosSection = ({
  fotos,
  visitaSeleccionada,
  onVisitaSeleccionadaChange,
  pickerInputRef,
  cameraOpen,
  cameraVideoRef,
  captureFlash,
  captureBadge,
  onOpenCamera,
  onStopCamera,
  onCaptureFromCamera,
  onFotosChange,
  onQuitarFoto,
  onPreviewFoto,
  cameraNotice,
}: Props) => {
  const atPhotoLimit = isAtFormPhotoLimit(fotos.length);
  const [fotoIndexToRemove, setFotoIndexToRemove] = useState<number | null>(null);
  const fotoPendingRemove =
    fotoIndexToRemove != null ? fotos[fotoIndexToRemove] : undefined;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">
        Fotografías (0 a {MAX_FORM_PHOTOS})
      </h2>
      <p className="text-xs text-slate-500">
        Podés seleccionar archivos o capturar desde la app.
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Cargadas: {fotos.length}/{MAX_FORM_PHOTOS}
        {atPhotoLimit ? (
          <span className="ml-2 font-medium text-amber-700">— límite alcanzado</span>
        ) : null}
      </p>
      <label className="mt-3 block text-sm font-medium text-slate-800">
        Relacionar fotos con visita
        <select
          value={visitaSeleccionada ? String(visitaSeleccionada) : ""}
          onChange={(e) =>
            onVisitaSeleccionadaChange(
              e.target.value ? (Number(e.target.value) as VisitaNumero) : null,
            )
          }
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          <option value="">Seleccioná visita</option>
          <option value="1">Visita 1</option>
          <option value="2">Visita 2</option>
          <option value="3">Visita 3</option>
          <option value="4">Visita 4</option>
        </select>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => pickerInputRef.current?.click()}
          disabled={!visitaSeleccionada}
        >
          Elegir archivos
        </Button>
        {!cameraOpen ? (
          <Button
            type="button"
            variant="outline"
            onClick={onOpenCamera}
            disabled={!visitaSeleccionada}
          >
            Abrir cámara
          </Button>
        ) : null}
      </div>
      {!visitaSeleccionada ? (
        <p className="mt-2 text-xs text-amber-700">
          Primero seleccioná si las fotos corresponden a visita 1, 2, 3 o 4.
        </p>
      ) : null}
      <input
        ref={pickerInputRef}
        type="file"
        accept="image/*"
        multiple
        className="mt-3 hidden"
        onChange={onFotosChange}
      />
      {cameraOpen ? (
        <div className="fixed inset-0 z-[220] bg-black">
          <video
            ref={cameraVideoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
          />
          <div
            className="pointer-events-none absolute inset-0 bg-white transition-opacity duration-150"
            style={{ opacity: captureFlash ? 0.6 : 0 }}
          />
          <div
            className={`pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-emerald-500/90 px-4 py-2 text-xs font-semibold text-white shadow-lg transition-all duration-200 ${
              captureBadge ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
            }`}
          >
            Foto capturada
          </div>
          {cameraNotice ? (
            <div
              role="alert"
              className="absolute inset-x-3 top-3 z-10 rounded-xl border border-amber-300/80 bg-amber-50/95 px-3 py-2 text-center text-sm font-medium text-amber-950 shadow-lg"
            >
              {cameraNotice}
            </div>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              onClick={onCaptureFromCamera}
              disabled={atPhotoLimit}
            >
              Tomar foto
            </Button>
            <Button type="button" variant="outline" onClick={onStopCamera}>
              Cerrar cámara
            </Button>
          </div>
        </div>
      ) : null}
      {fotos.length ? (
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {fotos.map((foto, index) => (
            <li
              key={`${foto.nombre_archivo}-${index}`}
              className="flex items-center justify-between gap-3"
            >
              <button
                type="button"
                onClick={() =>
                  onPreviewFoto({
                    nombre_archivo: foto.nombre_archivo,
                    src: foto.data,
                  })
                }
                className="flex min-w-0 items-center gap-3 text-left"
              >
                <img
                  src={foto.data}
                  alt={foto.nombre_archivo}
                  className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                />
                <span className="truncate">{foto.nombre_archivo}</span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                  {visitaLabel(foto.visita)}
                </span>
              </button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFotoIndexToRemove(index)}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Aún no hay fotos cargadas.</p>
      )}
      <RemoveFotoConfirmModal
        open={fotoIndexToRemove != null}
        nombreArchivo={fotoPendingRemove?.nombre_archivo ?? ""}
        visita={fotoPendingRemove?.visita}
        onCancel={() => setFotoIndexToRemove(null)}
        onConfirm={() => {
          if (fotoIndexToRemove != null) {
            onQuitarFoto(fotoIndexToRemove);
          }
          setFotoIndexToRemove(null);
        }}
      />
    </div>
  );
};
