import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

type Args = {
  onCapturedFile: (file: File) => Promise<void>;
  setBanner: (message: string | null) => void;
};

type UseCameraCaptureResult = {
  cameraOpen: boolean;
  captureFlash: boolean;
  captureBadge: boolean;
  cameraVideoRef: MutableRefObject<HTMLVideoElement | null>;
  openCamera: () => Promise<void>;
  stopCamera: () => void;
  captureFromCamera: () => Promise<void>;
};

export const useCameraCapture = ({
  onCapturedFile,
  setBanner,
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
      }, 2500);
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

  const waitForVideoElement = async (): Promise<HTMLVideoElement | null> => {
    for (let i = 0; i < 6; i += 1) {
      const video = cameraVideoRef.current;
      if (video) {
        return video;
      }
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    }
    return null;
  };

  const stopCamera = useCallback(() => {
    const stream = cameraStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      cameraStreamRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  const openCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setBanner("Este navegador no permite capturar cámara desde la app.");
      return;
    }
    try {
      setCameraOpen(true);
      const video = await waitForVideoElement();
      if (!video) {
        setBanner("No se pudo inicializar la vista de cámara.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute("playsinline", "true");
      await video.play();
      await waitForVideoReady(video);
      cameraStreamRef.current = stream;
      setBanner(null);
    } catch {
      setBanner("No se pudo abrir la cámara. Verifica permisos del navegador.");
      setCameraOpen(false);
    }
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
    const video = cameraVideoRef.current;
    if (!video) {
      return;
    }
    try {
      await waitForVideoReady(video);
    } catch {
      setBanner(
        "La cámara aún no está lista. Espera un segundo e intenta de nuevo.",
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
            canvas.toBlob(resolve, "image/jpeg", 0.92);
          });
        }
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
        canvas.toBlob(resolve, "image/jpeg", 0.92);
      });
    }

    if (!blob) {
      setBanner("No se pudo generar la imagen capturada.");
      return;
    }
    const fileName = `captura_${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
    const file = new File([blob], fileName, { type: "image/jpeg" });
    triggerCaptureFeedback();
    await onCapturedFile(file);
  }, [onCapturedFile, setBanner]);

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
