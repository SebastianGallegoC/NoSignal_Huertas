import type { ChangeEvent, RefObject } from "react";

import { Button } from "@/components/ui/button";
import type { ImagePreview } from "@/components/form/ImagePreviewModal";

type Foto = { nombre_archivo: string; data: string };

type Props = {
  fotos: Foto[];
  pickerInputRef: RefObject<HTMLInputElement | null>;
  cameraOpen: boolean;
  cameraVideoRef: RefObject<HTMLVideoElement | null>;
  captureFlash: boolean;
  captureBadge: boolean;
  onOpenCamera: () => void;
  onStopCamera: () => void;
  onCaptureFromCamera: () => void;
  onFotosChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onQuitarFoto: (index: number) => void;
  onPreviewFoto: (image: ImagePreview) => void;
};

export const FormularioFotosSection = ({
  fotos,
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
}: Props) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Fotografías (0 a 15)</h2>
      <p className="text-xs text-slate-500">
        Podés seleccionar archivos o capturar desde la app. Se comprimen a máx.
        1280 px antes de guardar.
      </p>
      <p className="mt-1 text-xs text-slate-600">Cargadas: {fotos.length}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => pickerInputRef.current?.click()}
        >
          Elegir archivos
        </Button>
        {!cameraOpen ? (
          <Button type="button" variant="outline" onClick={onOpenCamera}>
            Abrir cámara
          </Button>
        ) : null}
      </div>
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
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 sm:flex-row sm:justify-end">
            <Button type="button" onClick={onCaptureFromCamera}>
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
              </button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onQuitarFoto(index)}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Aún no hay fotos cargadas.</p>
      )}
    </div>
  );
};
