import { act, type ChangeEvent } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, afterEach } from "vitest";

import { FORM_PHOTO_LIMIT_MESSAGE } from "@/lib/formPhotoLimits";
import type { FotoForm } from "@/services/db";
import { usePhotoCapture } from "@/pages/formulario/usePhotoCapture";

const compressionMocks = vi.hoisted(() => ({
  compressImageFile: vi.fn(async (file: File) => file),
  fileToDataUrl: vi.fn(async () => "data:image/jpeg;base64,AA=="),
}));

const cameraMocks = vi.hoisted(() => {
  let onCapturedFile: ((file: File) => Promise<void>) | null = null;
  let canCapture: (() => boolean) | undefined;
  let onCaptureBlocked: (() => void) | undefined;
  return {
    useCameraCapture: vi.fn(
      ({
        onCapturedFile: handler,
        canCapture: canCaptureArg,
        onCaptureBlocked: onBlocked,
      }) => {
        onCapturedFile = handler;
        canCapture = canCaptureArg;
        onCaptureBlocked = onBlocked;
        return {
          cameraOpen: false,
          captureFlash: false,
          captureBadge: null,
          cameraVideoRef: { current: null },
          openCamera: vi.fn(),
          stopCamera: vi.fn(),
          captureFromCamera: vi.fn(async () => {
            if (canCapture && !canCapture()) {
              onCaptureBlocked?.();
              return;
            }
            if (onCapturedFile) {
              await onCapturedFile(
                new File(["x"], "camera.jpg", { type: "image/jpeg" }),
              );
            }
          }),
        };
      },
    ),
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
      "Seleccioná visita 1, 2, 3 o 4 antes de cargar fotos.",
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

  it("no agrega fotos desde cámara al alcanzar el límite de 15", async () => {
    const setBanner = vi.fn();
    const setFotos = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let handlers: HookHandlers | null = null;

    const fotosMax: FotoForm[] = Array.from({ length: 15 }, (_, i) => ({
      nombre_archivo: `f${i}.jpg`,
      data: "data:image/jpeg;base64,AA==",
      visita: 1 as const,
    }));

    await act(async () => {
      root.render(
        <Harness
          fotos={fotosMax}
          visitaFotoSeleccionada={1}
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

    expect(setBanner).toHaveBeenCalledWith(FORM_PHOTO_LIMIT_MESSAGE);
    expect(compressionMocks.compressImageFile).not.toHaveBeenCalled();
    expect(setFotos).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("quitarFoto elimina la foto en el índice indicado", async () => {
    const setBanner = vi.fn();
    const setFotos = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let handlers: HookHandlers | null = null;

    const fotosIniciales: FotoForm[] = [
      { nombre_archivo: "a.jpg", data: "data:1", visita: 1 },
      { nombre_archivo: "b.jpg", data: "data:2", visita: 1 },
    ];

    await act(async () => {
      root.render(
        <Harness
          fotos={fotosIniciales}
          visitaFotoSeleccionada={1}
          setFotos={setFotos}
          setBanner={setBanner}
          onReady={(h) => {
            handlers = h;
          }}
        />,
      );
    });

    act(() => {
      handlers?.quitarFoto(0);
    });

    expect(setFotos).toHaveBeenCalledTimes(1);
    const updater = setFotos.mock.calls[0]?.[0];
    expect(typeof updater).toBe("function");
    const next = (updater as (prev: FotoForm[]) => FotoForm[])(fotosIniciales);
    expect(next).toHaveLength(1);
    expect(next[0]?.nombre_archivo).toBe("b.jpg");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
