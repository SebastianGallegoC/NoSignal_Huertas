import { useEffect } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

export type ImagePreview = {
  nombre_archivo: string;
  src: string;
};

type Props = {
  image: ImagePreview | null;
  onClose: () => void;
  showDownload?: boolean;
};

export const ImagePreviewModal = ({
  image,
  onClose,
  showDownload = false,
}: Props) => {
  useEffect(() => {
    if (!image) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [image, onClose]);

  if (!image) {
    return null;
  }

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = image.src;
    link.download = image.nombre_archivo || "foto.jpg";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
        aria-label="Cerrar vista previa"
        onClick={onClose}
      />
      <div className="relative z-10 flex w-full max-w-4xl flex-col gap-4 rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-slate-200 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900">
              {image.nombre_archivo}
            </h2>
            <p className="text-sm text-slate-500">Vista ampliada de la imagen</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cerrar
          </button>
        </div>
        <div className="flex max-h-[70dvh] items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
          <img
            src={image.src}
            alt={image.nombre_archivo}
            className="max-h-[70dvh] w-full object-contain"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {showDownload ? (
            <Button
              type="button"
              onClick={handleDownload}
              className="w-full bg-teal-700 text-white hover:bg-teal-800 sm:w-auto"
            >
              Descargar imagen
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Volver
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
