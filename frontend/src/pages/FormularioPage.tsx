import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

import {
  FormEnvioResultModal,
  type FormEnvioResultState,
} from "@/components/form/FormEnvioResultModal";
import {
  ImagePreviewModal,
  type ImagePreview,
} from "@/components/form/ImagePreviewModal";
import { FormularioFotosSection } from "@/components/form/FormularioFotosSection";
import { FormularioOverviewPanel } from "@/components/form/FormularioOverviewPanel";
import { FormFieldRow } from "@/components/form/FormFieldRow";
import { Button } from "@/components/ui/button";
import { FORM_SECTIONS } from "@/config/formSections";
import { USUARIOS_FORMULARIO } from "@/config/usuariosFormulario";
import { useGPS } from "@/hooks/useGPS";
import { useCameraCapture } from "@/hooks/useCameraCapture";
import { useFormularioSubmit } from "@/hooks/useFormularioSubmit";
import { compressImageFile, fileToDataUrl } from "@/services/imageCompression";
import {
  clearFormDraft,
  loadFormDraft,
  saveFormDraft,
  shouldPersistFormDraft,
} from "@/services/formDraftStorage";
import {
  countErrorForms,
  countPendingForms,
  listSyncErrors,
  syncPendingForms,
  type SyncErrorItem,
} from "@/services/sync";
import type { FotoForm } from "@/services/db";
import { randomUuid } from "@/lib/randomUuid";
import { useAuthStore } from "@/store/useAuthStore";
import { REQUIRED_FIELDS, type FormValues } from "@/types/formFields";

const buildExternalMapUrl = (latitud: number, longitud: number): string => {
  return `https://www.openstreetmap.org/?mlat=${latitud}&mlon=${longitud}#map=18/${latitud}/${longitud}`;
};

const buildMapUrl = (latitud: number, longitud: number): string => {
  const delta = 0.003;
  const bbox = [
    longitud - delta,
    latitud - delta,
    longitud + delta,
    latitud + delta,
  ].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitud},${longitud}`;
};

const toSafeUserId = (raw: string): string => {
  const base = (raw || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return base || "sin_usuario";
};

export const FormularioPage = () => {
  const authUsername = useAuthStore((s) => s.username);
  const draftUserKey = authUsername ?? "";

  const loadedDraft = useMemo(
    () => loadFormDraft(draftUserKey),
    [draftUserKey],
  );

  const defaults = useMemo(() => {
    return Object.fromEntries(
      REQUIRED_FIELDS.map((k) => [k, ""]),
    ) as FormValues;
  }, []);

  const initialFormValues = useMemo(() => {
    if (!loadedDraft?.formValues) {
      return defaults;
    }
    return { ...defaults, ...loadedDraft.formValues } as FormValues;
  }, [defaults, loadedDraft]);

  const { gps, cargando, error, estado, progreso, solicitarGPS } = useGPS({
    restoredPosition: loadedDraft?.gps ?? null,
  });
  const [idUsuario, setIdUsuario] = useState(
    () => loadedDraft?.idUsuario ?? "",
  );
  const [fotos, setFotos] = useState<FotoForm[]>(
    () => loadedDraft?.fotos ?? [],
  );
  const [visitaFotoSeleccionada, setVisitaFotoSeleccionada] = useState<
    1 | 2 | 3 | null
  >(null);
  const [previewFoto, setPreviewFoto] = useState<ImagePreview | null>(null);
  const [formId, setFormId] = useState(
    () => loadedDraft?.formId ?? randomUuid(),
  );
  const [originalFechaHora, setOriginalFechaHora] = useState<string | null>(
    () => loadedDraft?.originalFechaHora ?? null,
  );
  const [pendientes, setPendientes] = useState(0);
  const [erroresSync, setErroresSync] = useState(0);
  const [ultimosErrores, setUltimosErrores] = useState<SyncErrorItem[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);
  const [envioModal, setEnvioModal] = useState<FormEnvioResultState | null>(
    null,
  );
  const [modoCoordenadas, setModoCoordenadas] = useState<
    "automatico" | "manual"
  >(() => loadedDraft?.modoCoordenadas ?? "automatico");
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(["actividad"]),
  );
  const pickerInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setFocus,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: initialFormValues,
  });

  const formValues = watch();
  const gpsFormulario = useMemo(() => {
    if (modoCoordenadas !== "manual") {
      return gps;
    }
    const latitud = Number.parseFloat(formValues.latitud);
    const longitud = Number.parseFloat(formValues.longitud);
    if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
      return null;
    }
    return {
      latitud,
      longitud,
      precision: gps?.precision ?? 5,
    };
  }, [formValues.latitud, formValues.longitud, gps, modoCoordenadas]);

  const draftUserKeyRef = useRef(draftUserKey);
  draftUserKeyRef.current = draftUserKey;
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const idUsuarioRef = useRef(idUsuario);
  idUsuarioRef.current = idUsuario;
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;
  const formIdRef = useRef(formId);
  formIdRef.current = formId;
  const originalFechaHoraRef = useRef(originalFechaHora);
  originalFechaHoraRef.current = originalFechaHora;
  const gpsRef = useRef(gps);
  gpsRef.current = gps;
  const modoCoordenadasRef = useRef(modoCoordenadas);
  modoCoordenadasRef.current = modoCoordenadas;

  const flushDraftToStorage = useCallback(() => {
    const userKey = draftUserKeyRef.current;
    const values = getValues();
    const def = defaultsRef.current;
    const idU = idUsuarioRef.current;
    const f = fotosRef.current;
    const fid = formIdRef.current;
    const fFecha = originalFechaHoraRef.current;
    const g = gpsRef.current;
    const modo = modoCoordenadasRef.current;
    if (!shouldPersistFormDraft(values, def, idU, f.length, g !== null)) {
      clearFormDraft(userKey);
      return;
    }
    saveFormDraft(userKey, {
      v: 1,
      savedAt: new Date().toISOString(),
      formId: fid,
      originalFechaHora: fFecha,
      idUsuario: idU,
      modoCoordenadas: modo,
      formValues: values,
      fotos: f,
      gps: g
        ? { latitud: g.latitud, longitud: g.longitud, precision: g.precision }
        : null,
    });
  }, [getValues]);

  useEffect(() => {
    return () => {
      flushDraftToStorage();
    };
  }, [flushDraftToStorage]);

  useEffect(() => {
    const userKey = draftUserKey;
    if (
      !shouldPersistFormDraft(
        formValues,
        defaults,
        idUsuario,
        fotos.length,
        gps !== null,
      )
    ) {
      clearFormDraft(userKey);
      return;
    }
    const handle = window.setTimeout(() => {
      flushDraftToStorage();
    }, 450);
    return () => window.clearTimeout(handle);
  }, [
    formValues,
    defaults,
    draftUserKey,
    idUsuario,
    fotos,
    formId,
    gps,
    originalFechaHora,
    flushDraftToStorage,
  ]);

  const refreshPendientes = useCallback(async () => {
    const [pendingCount, errorCount, lastErrors] = await Promise.all([
      countPendingForms(),
      countErrorForms(),
      listSyncErrors(5),
    ]);
    setPendientes(pendingCount);
    setErroresSync(errorCount);
    setUltimosErrores(lastErrors);
  }, []);

  useEffect(() => {
    void refreshPendientes();
  }, [refreshPendientes]);

  const processIncomingFiles = async (
    files: File[],
    visita: 1 | 2 | 3,
    saveToDevice = false,
  ) => {
    if (!files.length) {
      return;
    }
    setBanner(null);
    const combined = [...fotos];
    for (const file of files) {
      if (combined.length >= 15) {
        setBanner("Máximo 15 fotos. Se ignoraron archivos adicionales.");
        break;
      }
      try {
        const compressed = await compressImageFile(file);
        const data = await fileToDataUrl(compressed);
        const nombre =
          compressed.name.replace(/[^\w.-]+/g, "_") ||
          `foto_${combined.length + 1}.jpg`;
        combined.push({ nombre_archivo: nombre, data, visita });
        if (saveToDevice) {
          const downloadUrl = URL.createObjectURL(compressed);
          const anchor = document.createElement("a");
          anchor.href = downloadUrl;
          anchor.download = nombre;
          anchor.click();
          URL.revokeObjectURL(downloadUrl);
        }
      } catch {
        setBanner(
          "No se pudo procesar una de las imágenes. Probá con otra foto.",
        );
      }
    }
    setFotos(combined);
  };

  const onFotosChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!visitaFotoSeleccionada) {
      setBanner("Seleccioná visita 1, 2 o 3 antes de cargar fotos.");
      return;
    }
    await processIncomingFiles(files, visitaFotoSeleccionada, false);
  };
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
        setBanner("Seleccioná visita 1, 2 o 3 antes de tomar fotos.");
        return;
      }
      // Sin descarga automática: en móvil suele bloquearse o demorar y no aporta al envío.
      await processIncomingFiles([file], visitaFotoSeleccionada, false);
    },
    setBanner,
  });

  const quitarFoto = (index: number) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  };

  const sincronizarAhora = async () => {
    setSincronizando(true);
    setBanner(null);
    setSubmitFeedback("Sincronizando formularios pendientes...");
    const result = await syncPendingForms();
    await refreshPendientes();
    setSubmitFeedback(null);
    if (result.failed > 0) {
      const detail = result.first_error?.trim();
      setBanner(null);
      setEnvioModal({
        tone: "danger",
        title: "Error al sincronizar",
        message:
          detail && detail.length > 0
            ? `No se pudo sincronizar ${result.failed} formulario(s). Detalle: ${detail}`
            : `No se pudo sincronizar ${result.failed} formulario(s). Revisá la sección «Errores sync» y reintentá cuando tengas conexión estable.`,
      });
    } else if (result.sent > 0) {
      setBanner(null);
      setEnvioModal({
        tone: "success",
        title: "Sincronización completada",
        message: `Se enviaron correctamente ${result.sent} formulario(s) al servidor.`,
      });
    } else {
      setBanner(null);
      setEnvioModal({
        tone: "warning",
        title: "Sin formularios para enviar",
        message:
          "No había registros pendientes de sincronizar en este momento, o aún aplican tiempos de espera entre reintentos.",
      });
    }
    setSincronizando(false);
  };

  const decimalToDms = (decimal: number) => {
    const abs = Math.abs(decimal);
    const grados = Math.floor(abs);
    const minutosFloat = (abs - grados) * 60;
    const minutos = Math.floor(minutosFloat);
    const segundos = (minutosFloat - minutos) * 60;
    return { grados, minutos, segundos };
  };

  useEffect(() => {
    if (!gps || modoCoordenadas === "manual") {
      return;
    }
    const longDms = decimalToDms(gps.longitud);
    const latDms = decimalToDms(gps.latitud);

    setValue("longitud", gps.longitud.toFixed(6));
    setValue("latitud", gps.latitud.toFixed(6));
    setValue("x_grados", String(longDms.grados));
    setValue("x_minutos", String(longDms.minutos));
    setValue("x_segundos", longDms.segundos.toFixed(3));
    setValue("y_grados", String(latDms.grados));
    setValue("y_minutos", String(latDms.minutos));
    setValue("y_segundos", latDms.segundos.toFixed(3));
  }, [gps, modoCoordenadas, setValue]);

  useEffect(() => {
    if (modoCoordenadas !== "manual") {
      return;
    }

    const longitud = Number.parseFloat(formValues.longitud);
    const latitud = Number.parseFloat(formValues.latitud);

    if (!Number.isFinite(longitud) || !Number.isFinite(latitud)) {
      return;
    }

    const longDms = decimalToDms(longitud);
    const latDms = decimalToDms(latitud);

    setValue("x_grados", String(longDms.grados));
    setValue("x_minutos", String(longDms.minutos));
    setValue("x_segundos", longDms.segundos.toFixed(3));
    setValue("y_grados", String(latDms.grados));
    setValue("y_minutos", String(latDms.minutos));
    setValue("y_segundos", latDms.segundos.toFixed(3));
  }, [formValues.latitud, formValues.longitud, modoCoordenadas, setValue]);

  const { onValid, onInvalid } = useFormularioSubmit({
    gps: gpsFormulario,
    fotos,
    formId,
    idUsuario,
    originalFechaHora,
    authUsername,
    draftUserKey,
    defaults,
    setBanner,
    setSubmitFeedback,
    setEnvioModal,
    setEnviando,
    setFotos,
    setFormId,
    setOriginalFechaHora,
    refreshPendientes,
    reset,
    setOpenSections,
    setFocus,
    toSafeUserId,
    requiredFields: REQUIRED_FIELDS,
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e2f2ee_0,_#f6f7f5_45%,_#f6f7f5_100%)] px-4 py-8 text-slate-900 sm:px-6">
      {envioModal ? (
        <FormEnvioResultModal
          open
          tone={envioModal.tone}
          title={envioModal.title}
          message={envioModal.message}
          submittedForm={envioModal.submittedForm}
          onClose={() => {
            const shouldGo = envioModal?.isEdit;
            setEnvioModal(null);
            if (shouldGo) {
              navigate("/formularios-diligenciados");
            }
          }}
        />
      ) : null}
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-teal-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">
              NoSignal
            </p>
            <h1 className="text-3xl font-semibold">Formulario de visita</h1>
            <p className="text-sm text-slate-600">
              Sesión: {authUsername ?? "—"} · Red:{" "}
              {navigator.onLine ? "online" : "offline"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/inicio" className="inline-flex">
              <Button
                type="button"
                variant="outline"
                className="border-slate-200"
              >
                Regresar
              </Button>
            </Link>
            <Button
              type="button"
              onClick={() => void sincronizarAhora()}
              disabled={sincronizando}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {sincronizando ? "Sincronizando…" : "Sincronizar ahora"}
            </Button>
          </div>
        </header>

        <FormularioOverviewPanel
          estado={estado}
          progreso={progreso}
          gps={gpsFormulario}
          error={error}
          cargando={cargando}
          pendientes={pendientes}
          erroresSync={erroresSync}
          ultimosErrores={ultimosErrores}
          onSolicitarGps={() => {
            setModoCoordenadas("automatico");
            solicitarGPS();
          }}
          modoCoordenadas={modoCoordenadas}
          onChangeModoCoordenadas={(m) => {
            if (m === "manual") {
              // limpiar campos y habilitar edición
              setValue("longitud", "");
              setValue("latitud", "");
              setValue("x_grados", "");
              setValue("x_minutos", "");
              setValue("x_segundos", "");
              setValue("y_grados", "");
              setValue("y_minutos", "");
              setValue("y_segundos", "");
            }
            setModoCoordenadas(m);
          }}
          buildMapUrl={buildMapUrl}
          buildExternalMapUrl={buildExternalMapUrl}
        />

        {banner ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            {banner}
          </div>
        ) : null}

        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit(onValid, onInvalid)}
        >
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Usuario del registro
            </h2>
            <label className="mt-3 flex flex-col text-sm font-medium text-slate-800">
              Selección
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                value={idUsuario}
                onChange={(e) => setIdUsuario(e.target.value)}
              >
                <option value=""></option>
                {USUARIOS_FORMULARIO.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <FormularioFotosSection
            fotos={fotos}
            visitaSeleccionada={visitaFotoSeleccionada}
            onVisitaSeleccionadaChange={setVisitaFotoSeleccionada}
            pickerInputRef={pickerInputRef}
            cameraOpen={cameraOpen}
            cameraVideoRef={cameraVideoRef}
            captureFlash={captureFlash}
            captureBadge={captureBadge}
            onOpenCamera={() => void openCamera()}
            onStopCamera={stopCamera}
            onCaptureFromCamera={() => void captureFromCamera()}
            onFotosChange={(e) => void onFotosChange(e)}
            onQuitarFoto={quitarFoto}
            onPreviewFoto={setPreviewFoto}
          />

          <ImagePreviewModal
            image={previewFoto}
            onClose={() => setPreviewFoto(null)}
          />

          {FORM_SECTIONS.map((section) => (
            <details
              key={section.id}
              open={openSections.has(section.id)}
              onToggle={(e) => {
                const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                setOpenSections((prev) => {
                  const next = new Set(prev);
                  if (isOpen) {
                    next.add(section.id);
                  } else {
                    next.delete(section.id);
                  }
                  return next;
                });
              }}
              className="group rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
            >
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                {section.title}
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {section.fields.map((field) => (
                  <FormFieldRow
                    key={field}
                    name={field}
                    register={register}
                    control={control}
                    error={errors[field]?.message as string | undefined}
                    editableGpsFields={modoCoordenadas === "manual"}
                  />
                ))}
              </div>
            </details>
          ))}

          <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
            <Button
              type="submit"
              disabled={enviando}
              className="bg-teal-700 text-white hover:bg-teal-800"
            >
              {enviando ? "Guardando…" : "Guardar / enviar"}
            </Button>
            {submitFeedback ? (
              <p className="text-xs font-medium text-slate-700">
                {submitFeedback}
              </p>
            ) : null}
            {banner ? <p className="text-xs text-slate-600">{banner}</p> : null}
          </div>
        </form>
      </div>
    </div>
  );
};
