import { act, type ChangeEvent } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, afterEach } from "vitest";

import type { FotoForm } from "@/services/db";
import { usePhotoCapture } from "@/pages/formulario/usePhotoCapture";

const compressionMocks = vi.hoisted(() => ({
  compressImageFile: vi.fn(async (file: File) => file),
  fileToDataUrl: vi.fn(async () => "data:image/jpeg;base64,AA=="),
}));

const cameraMocks = vi.hoisted(() => {
  let onCapturedFile: ((file: File) => Promise<void>) | null = null;
  return {
    useCameraCapture: vi.fn(({ onCapturedFile: handler }) => {
      onCapturedFile = handler;
      return {
        cameraOpen: false,
        captureFlash: false,
        captureBadge: null,
        cameraVideoRef: { current: null },
        openCamera: vi.fn(),
        stopCamera: vi.fn(),
        captureFromCamera: vi.fn(async () => {
          if (onCapturedFile) {
            await onCapturedFile(
              new File(["x"], "camera.jpg", { type: "image/jpeg" }),
            );
          }
        }),
      };
    }),
    triggerCapture: async (file: File) => {
      if (onCapturedFile) {
        await onCapturedFile(file);
      }
    },
  };
});

vi.mock("@/services/imageCompression", () => compressionMocks);
vi.mock("@/hooks/useCameraCapture", () => ({
  useCameraCapture: cameraMocks.useCameraCapture,
}));

type HookHandlers = ReturnType<typeof usePhotoCapture>;

type HarnessProps = {
  fotos: FotoForm[];
  visitaFotoSeleccionada: 1 | 2 | 3 | null;
  setFotos: (value: FotoForm[] | ((prev: FotoForm[]) => FotoForm[])) => void;
  setBanner: (value: string | null) => void;
  onReady: (handlers: HookHandlers) => void;
};

const Harness = (props: HarnessProps) => {
  const handlers = usePhotoCapture({
    fotos: props.fotos,
    setFotos: props.setFotos,
    visitaFotoSeleccionada: props.visitaFotoSeleccionada,
    setBanner: props.setBanner,
  });
  props.onReady(handlers);
  return null;
};

describe("usePhotoCapture", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("advierte si no hay visita seleccionada", async () => {
    const setBanner = vi.fn();
    const setFotos = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let handlers: HookHandlers | null = null;

    await act(async () => {
      root.render(
        <Harness
          fotos={[]}
          visitaFotoSeleccionada={null}
          setFotos={setFotos}
          setBanner={setBanner}
          onReady={(h) => {
            handlers = h;
          }}
        />,
      );
    });

    const file = new File(["abc"], "foto.jpg", { type: "image/jpeg" });
    await act(async () => {
      await handlers?.onFotosChange({
        target: { files: [file], value: "x" },
      } as unknown as ChangeEvent<HTMLInputElement>);
    });

    expect(setBanner).toHaveBeenCalledWith(
      "Seleccioná visita 1, 2 o 3 antes de cargar fotos.",
    );
    expect(compressionMocks.compressImageFile).not.toHaveBeenCalled();
    expect(setFotos).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("agrega fotos cuando hay visita seleccionada", async () => {
    const setBanner = vi.fn();
    const setFotos = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let handlers: HookHandlers | null = null;

    await act(async () => {
      root.render(
        <Harness
          fotos={[]}
          visitaFotoSeleccionada={1}
          setFotos={setFotos}
          setBanner={setBanner}
          onReady={(h) => {
            handlers = h;
          }}
        />,
      );
    });

    const file = new File(["abc"], "foto.jpg", { type: "image/jpeg" });
    await act(async () => {
      await handlers?.onFotosChange({
        target: { files: [file], value: "x" },
      } as unknown as ChangeEvent<HTMLInputElement>);
    });

    expect(compressionMocks.compressImageFile).toHaveBeenCalledTimes(1);
    expect(compressionMocks.fileToDataUrl).toHaveBeenCalledTimes(1);
    expect(setFotos).toHaveBeenCalledTimes(1);
    const payload = setFotos.mock.calls[0]?.[0] as FotoForm[];
    expect(payload[0]?.nombre_archivo).toBe("foto.jpg");
    expect(payload[0]?.visita).toBe(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("captura desde camara cuando hay visita seleccionada", async () => {
    const setBanner = vi.fn();
    const setFotos = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let handlers: HookHandlers | null = null;

    await act(async () => {
      root.render(
        <Harness
          fotos={[]}
          visitaFotoSeleccionada={2}
          setFotos={setFotos}
          setBanner={setBanner}
          onReady={(h) => {
            handlers = h;
          }}
        />,
      );
    });

    await act(async () => {
      await handlers?.captureFromCamera();
    });

    expect(compressionMocks.compressImageFile).toHaveBeenCalledTimes(1);
    expect(setFotos).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
