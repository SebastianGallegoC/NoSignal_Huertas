import { useCallback } from 'react';
import type { ChangeEvent, RefObject } from 'react';

import { useCameraCapture } from '@/hooks/useCameraCapture';
import { compressImageFile, fileToDataUrl } from '@/services/imageCompression';
import type { FotoForm } from '@/services/db';

type Args = {
  fotos: FotoForm[];
  setFotos: (value: FotoForm[] | ((prev: FotoForm[]) => FotoForm[])) => void;
  visitaFotoSeleccionada: 1 | 2 | 3 | null;
  setBanner: (value: string | null) => void;
};

type UsePhotoCaptureResult = {
  cameraOpen: boolean;
  captureFlash: boolean;
  captureBadge: string | null;
  cameraVideoRef: RefObject<HTMLVideoElement>;
  openCamera: () => Promise<void>;
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
    async (files: File[], visita: 1 | 2 | 3, saveToDevice = false) => {
      if (!files.length) {
        return;
      }
      setBanner(null);
      const combined = [...fotos];
      for (const file of files) {
        if (combined.length >= 15) {
          setBanner('Máximo 15 fotos. Se ignoraron archivos adicionales.');
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
      setFotos(combined);
    },
    [fotos, setBanner, setFotos],
  );

  const onFotosChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = '';
      if (!visitaFotoSeleccionada) {
        setBanner('Seleccioná visita 1, 2 o 3 antes de cargar fotos.');
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
        setBanner('Seleccioná visita 1, 2 o 3 antes de tomar fotos.');
        return;
      }
      await processIncomingFiles([file], visitaFotoSeleccionada, false);
    },
    setBanner,
  });

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
    openCamera,
    stopCamera,
    captureFromCamera,
    onFotosChange,
    quitarFoto,
  };
};
