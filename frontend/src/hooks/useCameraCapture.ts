import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

type Args = {
  onCapturedFile: (file: File) => Promise<void>;
  setBanner: (message: string | null) => void;
  /** Si devuelve false, no se captura ni se muestra animación de éxito. */
  canCapture?: () => boolean;
  onCaptureBlocked?: () => void;
};

type UseCameraCaptureResult = {
  cameraOpen: boolean;
  captureFlash: boolean;
  captureBadge: boolean;
  cameraVideoRef: MutableRefObject<HTMLVideoElement | null>;
  openCamera: () => void;
  stopCamera: () => void;
  captureFromCamera: () => Promise<void>;
};

export const useCameraCapture = ({
  onCapturedFile,
  setBanner,
  canCapture,
  onCaptureBlocked,
}: Args): UseCameraCaptureResult => {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);
  const [captureBadge, setCaptureBadge] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const captureFlashTimeoutRef = useRef<number | null>(null);
  const captureBadgeTimeoutRef = useRef<number | null>(null);

  const waitForVideoReady = (video: HTMLVideoElement): Promise<void> => {
    if (
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0
    ) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("video_not_ready"));
      }, 8000);
      const onReady = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener("loadedmetadata", onReady);
        video.removeEventListener("canplay", onReady);
      };
      video.addEventListener("loadedmetadata", onReady);
      video.addEventListener("canplay", onReady);
    });
  };

  const stopCamera = useCallback(() => {
    setCameraOpen(false);
  }, []);

  /** Monta el stream después de que React pinte el <video> (evita carrera con openCamera). */
  useEffect(() => {
    if (!cameraOpen) {
      const stream = cameraStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        cameraStreamRef.current = null;
      }
      const video = cameraVideoRef.current;
      if (video) {
        video.srcObject = null;
      }
      return;
    }

    let cancelled = false;

    const run = async () => {
      for (let i = 0; i < 40; i += 1) {
        if (cancelled) {
          return;
        }
        const video = cameraVideoRef.current;
        if (video) {
          let stream: MediaStream;
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
              audio: false,
            });
          } catch {
            setBanner(
              "No se pudo abrir la cámara. Verificá permisos del navegador.",
            );
            setCameraOpen(false);
            return;
          }
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          video.srcObject = stream;
          video.muted = true;
          video.setAttribute("playsinline", "true");
          try {
            await video.play();
            await waitForVideoReady(video);
          } catch {
            stream.getTracks().forEach((t) => t.stop());
            setBanner(
              "La cámara no mostró imagen. Probá cerrar y abrir de nuevo.",
            );
            setCameraOpen(false);
            return;
          }
          cameraStreamRef.current = stream;
          setBanner(null);
          return;
        }
        await new Promise<void>((r) => {
          requestAnimationFrame(() => r());
        });
      }
      setBanner("No se pudo inicializar la vista de cámara.");
      setCameraOpen(false);
    };

    if (!navigator.mediaDevices?.getUserMedia) {
      setBanner("Este navegador no permite capturar cámara desde la app.");
      setCameraOpen(false);
      return;
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [cameraOpen, setBanner]);

  const openCamera = useCallback(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setBanner("Este navegador no permite capturar cámara desde la app.");
      return;
    }
    setBanner(null);
    setCameraOpen(true);
  }, [setBanner]);

  const triggerCaptureFeedback = () => {
    setCaptureFlash(true);
    setCaptureBadge(true);
    if (captureFlashTimeoutRef.current) {
      window.clearTimeout(captureFlashTimeoutRef.current);
    }
    if (captureBadgeTimeoutRef.current) {
      window.clearTimeout(captureBadgeTimeoutRef.current);
    }
    captureFlashTimeoutRef.current = window.setTimeout(() => {
      setCaptureFlash(false);
    }, 150);
    captureBadgeTimeoutRef.current = window.setTimeout(() => {
      setCaptureBadge(false);
    }, 900);
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  };

  const captureFromCamera = useCallback(async () => {
    if (canCapture && !canCapture()) {
      onCaptureBlocked?.();
      return;
    }
    const video = cameraVideoRef.current;
    if (!video) {
      return;
    }
    try {
      await waitForVideoReady(video);
    } catch {
      setBanner(
        "La cámara aún no está lista. Esperá un segundo e intentá de nuevo.",
      );
      return;
    }

    let blob: Blob | null = null;
    const stream = cameraStreamRef.current;
    const track = stream?.getVideoTracks?.()[0];
    const ImageCaptureCtor = (
      window as unknown as {
        ImageCapture?: new (t: MediaStreamTrack) => {
          grabFrame: () => Promise<ImageBitmap>;
        };
      }
    ).ImageCapture;
    if (track && ImageCaptureCtor) {
      try {
        const imageCapture = new ImageCaptureCtor(track);
        const bitmap = await imageCapture.grabFrame();
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d");
        if (context) {
          context.drawImage(bitmap, 0, 0);
          blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, "image/jpeg", 0.88);
          });
        }
        bitmap.close?.();
      } catch {
        // fallback a canvas con el frame del video
      }
    }

    if (!blob) {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        setBanner("No se pudo capturar la foto en este navegador.");
        return;
      }
      context.drawImage(video, 0, 0, width, height);
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.88);
      });
    }

    if (!blob) {
      setBanner("No se pudo generar la imagen capturada.");
      return;
    }
    if (canCapture && !canCapture()) {
      onCaptureBlocked?.();
      return;
    }
    const fileName = `captura_${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
    const file = new File([blob], fileName, { type: "image/jpeg" });
    triggerCaptureFeedback();
    await onCapturedFile(file);
  }, [canCapture, onCaptureBlocked, onCapturedFile, setBanner]);

  useEffect(() => {
    return () => {
      stopCamera();
      if (captureFlashTimeoutRef.current) {
        window.clearTimeout(captureFlashTimeoutRef.current);
      }
      if (captureBadgeTimeoutRef.current) {
        window.clearTimeout(captureBadgeTimeoutRef.current);
      }
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!cameraOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [cameraOpen]);

  return {
    cameraOpen,
    captureFlash,
    captureBadge,
    cameraVideoRef,
    openCamera,
    stopCamera,
    captureFromCamera,
  };
};
