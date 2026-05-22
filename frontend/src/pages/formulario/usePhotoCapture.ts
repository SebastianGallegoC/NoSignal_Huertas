import { useCallback } from 'react';
import type { ChangeEvent, MutableRefObject } from 'react';

import { useCameraCapture } from '@/hooks/useCameraCapture';
import {
  FORM_PHOTO_LIMIT_MESSAGE,
  isAtFormPhotoLimit,
  MAX_FORM_PHOTOS,
} from '@/lib/formPhotoLimits';
import { compressImageFile, fileToDataUrl } from '@/services/imageCompression';
import type { VisitaNumero } from '@/lib/visitaNumero';
import type { FotoForm } from '@/services/db';

type Args = {
  fotos: FotoForm[];
  setFotos: (value: FotoForm[] | ((prev: FotoForm[]) => FotoForm[])) => void;
  visitaFotoSeleccionada: VisitaNumero | null;
  setBanner: (value: string | null) => void;
};

type UsePhotoCaptureResult = {
  cameraOpen: boolean;
  captureFlash: boolean;
  captureBadge: boolean;
  cameraVideoRef: MutableRefObject<HTMLVideoElement | null>;
  openCamera: () => void;
  stopCamera: () => void;
  captureFromCamera: () => Promise<void>;
  onFotosChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  quitarFoto: (index: number) => void;
};

export const usePhotoCapture = ({
  fotos,
  setFotos,
  visitaFotoSeleccionada,
  setBanner,
}: Args): UsePhotoCaptureResult => {
  const processIncomingFiles = useCallback(
    async (files: File[], visita: VisitaNumero, saveToDevice = false) => {
      if (!files.length) {
        return;
      }
      if (isAtFormPhotoLimit(fotos.length)) {
        setBanner(FORM_PHOTO_LIMIT_MESSAGE);
        return;
      }
      setBanner(null);
      const combined = [...fotos];
      let limitReached = false;
      for (const file of files) {
        if (combined.length >= MAX_FORM_PHOTOS) {
          limitReached = true;
          break;
        }
        try {
          const compressed = await compressImageFile(file);
          const data = await fileToDataUrl(compressed);
          const nombre =
            compressed.name.replace(/[^\w.-]+/g, '_') ||
            `foto_${combined.length + 1}.jpg`;
          combined.push({ nombre_archivo: nombre, data, visita });
          if (saveToDevice) {
            const downloadUrl = URL.createObjectURL(compressed);
            const anchor = document.createElement('a');
            anchor.href = downloadUrl;
            anchor.download = nombre;
            anchor.click();
            URL.revokeObjectURL(downloadUrl);
          }
        } catch {
          setBanner(
            'No se pudo procesar una de las imágenes. Probá con otra foto.',
          );
        }
      }
      if (limitReached) {
        setBanner(FORM_PHOTO_LIMIT_MESSAGE);
      }
      setFotos(combined);
    },
    [fotos, setBanner, setFotos],
  );

  const onFotosChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = '';
      if (!visitaFotoSeleccionada) {
        setBanner('Seleccioná visita 1, 2, 3 o 4 antes de cargar fotos.');
        return;
      }
      await processIncomingFiles(files, visitaFotoSeleccionada, false);
    },
    [processIncomingFiles, setBanner, visitaFotoSeleccionada],
  );

  const {
    cameraOpen,
    captureFlash,
    captureBadge,
    cameraVideoRef,
    openCamera,
    stopCamera,
    captureFromCamera,
  } = useCameraCapture({
    onCapturedFile: async (file) => {
      if (!visitaFotoSeleccionada) {
        setBanner('Seleccioná visita 1, 2, 3 o 4 antes de tomar fotos.');
        return;
      }
      await processIncomingFiles([file], visitaFotoSeleccionada, false);
    },
    setBanner,
    canCapture: () => !isAtFormPhotoLimit(fotos.length),
    onCaptureBlocked: () => setBanner(FORM_PHOTO_LIMIT_MESSAGE),
  });

  const openCameraWithLimit = useCallback(() => {
    if (isAtFormPhotoLimit(fotos.length)) {
      setBanner(FORM_PHOTO_LIMIT_MESSAGE);
      openCamera();
      return;
    }
    setBanner(null);
    openCamera();
  }, [fotos.length, openCamera, setBanner]);

  const quitarFoto = useCallback(
    (index: number) => {
      setFotos((prev) => prev.filter((_, i) => i !== index));
    },
    [setFotos],
  );

  return {
    cameraOpen,
    captureFlash,
    captureBadge,
    cameraVideoRef,
    openCamera: openCameraWithLimit,
    stopCamera,
    captureFromCamera,
    onFotosChange,
    quitarFoto,
  };
};
