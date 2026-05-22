import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  hasFormularioEditChanges,
  type FormularioEditBaseline,
} from "@/lib/formEditDirty";
import { handleDiligenciadoFormEnterKey } from "@/lib/formKeyboard";
import { useConnectivityStatus } from "@/hooks/useConnectivityStatus";
import { useGPS } from "@/hooks/useGPS";
import { useFormularioSubmit } from "@/hooks/useFormularioSubmit";
import type { VisitaNumero } from "@/services/db";
import {
  clearFormDraft,
  loadFormDraft,
  shouldPersistFormDraft,
} from "@/services/formDraftStorage";
import { isNetworkLikeError, syncPendingForms } from "@/services/sync";
import type { FotoForm } from "@/services/db";
import { randomUuid } from "@/lib/randomUuid";
import { useAuthStore } from "@/store/useAuthStore";
import { REQUIRED_FIELDS, type FormValues } from "@/types/formFields";
import { buildExternalMapUrl, buildMapUrl } from "@/pages/formulario/mapUtils";
import { useGpsFormFields } from "@/pages/formulario/useGpsFormFields";
import { useFormDraftPersistence } from "@/pages/formulario/useFormDraftPersistence";
import { usePhotoCapture } from "@/pages/formulario/usePhotoCapture";
import { FormClearModal } from "@/pages/formulario/FormClearModal";

export const FormularioPage = () => {
  const authUsername = useAuthStore((s) => s.username);
  const isOnline = useConnectivityStatus();
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

  const {
    gps,
    cargando,
    error,
    estado,
    progreso,
    solicitarGPS,
    limpiarUbicacion,
  } = useGPS({
    restoredPosition: loadedDraft?.gps ?? null,
  });
  const [fotos, setFotos] = useState<FotoForm[]>(
    () => loadedDraft?.fotos ?? [],
  );
  const [visitaFotoSeleccionada, setVisitaFotoSeleccionada] =
    useState<VisitaNumero | null>(null);
  const [previewFoto, setPreviewFoto] = useState<ImagePreview | null>(null);
  const [formId, setFormId] = useState(
    () => loadedDraft?.formId ?? randomUuid(),
  );
  const [originalFechaHora, setOriginalFechaHora] = useState<string | null>(
    () => loadedDraft?.originalFechaHora ?? null,
  );
  const [sincronizando, setSincronizando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
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
  const [modalLimpiarAbierto, setModalLimpiarAbierto] = useState(false);
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

  const isEditMode = originalFechaHora != null;

  const editBaseline = useMemo((): FormularioEditBaseline | null => {
    if (!loadedDraft?.originalFechaHora) {
      return null;
    }
    return {
      formValues: initialFormValues,
      fotos: loadedDraft.fotos ?? [],
      gps: loadedDraft.gps ?? null,
      modoCoordenadas: loadedDraft.modoCoordenadas ?? "automatico",
    };
  }, [initialFormValues, loadedDraft]);

  const hasEditChanges = useMemo(() => {
    if (!isEditMode || !editBaseline) {
      return true;
    }
    const current: FormularioEditBaseline = {
      formValues,
      fotos,
      gps: gps
        ? {
            latitud: gps.latitud,
            longitud: gps.longitud,
            precision: gps.precision,
          }
        : null,
      modoCoordenadas,
    };
    return hasFormularioEditChanges(editBaseline, current);
  }, [
    editBaseline,
    formValues,
    fotos,
    gps,
    isEditMode,
    modoCoordenadas,
  ]);

  const puedeEnviarFormulario = !isEditMode || hasEditChanges;

  const hayContenidoDiligenciado = useMemo(
    () =>
      shouldPersistFormDraft(
        formValues,
        defaults,
        fotos.length,
        gps !== null,
      ),
    [formValues, defaults, fotos.length, gps],
  );

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

  useFormDraftPersistence({
    draftUserKey,
    defaults,
    formValues,
    fotos,
    formId,
    originalFechaHora,
    gps,
    modoCoordenadas,
    getValues,
  });

  const refreshPendientes = useCallback(async () => {
    // Contadores viven en Inicio; el hook de envío sigue esperando esta firma.
  }, []);

  const {
    cameraOpen,
    captureFlash,
    captureBadge,
    cameraVideoRef,
    openCamera,
    stopCamera,
    captureFromCamera,
    onFotosChange,
    quitarFoto,
  } = usePhotoCapture({
    fotos,
    setFotos,
    visitaFotoSeleccionada,
    setBanner,
  });

  const restablecerFormularioAVacio = useCallback(() => {
    stopCamera();
    limpiarUbicacion();
    reset(defaults);
    setFotos([]);
    setFormId(randomUuid());
    setOriginalFechaHora(null);
    setModoCoordenadas("automatico");
    clearFormDraft(draftUserKey);
    setBanner(null);
    setVisitaFotoSeleccionada(null);
    setPreviewFoto(null);
    setOpenSections(new Set(["actividad"]));
    if (pickerInputRef.current) {
      pickerInputRef.current.value = "";
    }
  }, [limpiarUbicacion, reset, defaults, draftUserKey, stopCamera]);

  const confirmarLimpiarFormulario = useCallback(() => {
    restablecerFormularioAVacio();
    setModalLimpiarAbierto(false);
  }, [restablecerFormularioAVacio]);

  useEffect(() => {
    if (!modalLimpiarAbierto) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalLimpiarAbierto(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [modalLimpiarAbierto]);

  const sincronizarAhora = async () => {
    setSincronizando(true);
    setBanner("Sincronizando formularios pendientes…");
    const result = await syncPendingForms();
    await refreshPendientes();
    if (
      result.skipped > 0 ||
      (result.failed > 0 && isNetworkLikeError(result.first_error ?? ""))
    ) {
      setBanner(null);
      setEnvioModal({
        tone: "warning",
        title: "Sin conexión estable",
        message:
          "El formulario quedó guardado localmente y la sincronización se reintentará automáticamente cuando vuelva internet.",
      });
    } else if (result.failed > 0) {
      const detail = result.first_error?.trim();
      setBanner(null);
      setEnvioModal({
        tone: "danger",
        title: "Error al sincronizar",
        message:
          detail && detail.length > 0
            ? `No se pudo sincronizar ${result.failed} formulario(s). Detalle: ${detail}`
            : `No se pudo sincronizar ${result.failed} formulario(s). Revisá el contador de errores en Inicio y reintentá cuando tengas conexión estable.`,
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

  useGpsFormFields({
    gps,
    modoCoordenadas,
    latitud: formValues.latitud,
    longitud: formValues.longitud,
    setValue,
  });

  const { onValid, onInvalid } = useFormularioSubmit({
    gps: gpsFormulario,
    fotos,
    formId,
    originalFechaHora,
    draftUserKey,
    modoCoordenadas,
    setBanner,
    setEnvioModal,
    setEnviando,
    refreshPendientes,
    setOpenSections,
    setFocus,
    requiredFields: REQUIRED_FIELDS,
  });
  const coordenadasSection = useMemo(
    () => FORM_SECTIONS.find((section) => section.id === "coordenadas") ?? null,
    [],
  );
  const formSectionsWithoutCoordinates = useMemo(
    () => FORM_SECTIONS.filter((section) => section.id !== "coordenadas"),
    [],
  );

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
            const modal = envioModal;
            const shouldGo = modal?.isEdit;
            const limpiarTrasEnvio = modal?.submittedForm != null;
            setEnvioModal(null);
            if (shouldGo) {
              navigate("/formularios-diligenciados");
              return;
            }
            if (limpiarTrasEnvio) {
              restablecerFormularioAVacio();
              requestAnimationFrame(() => {
                window.scrollTo({ top: 0, left: 0, behavior: "instant" });
              });
            }
          }}
        />
      ) : null}
      <FormClearModal
        open={modalLimpiarAbierto}
        onCancel={() => setModalLimpiarAbierto(false)}
        onConfirm={confirmarLimpiarFormulario}
      />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-teal-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">
              NoSignal
            </p>
            <h1 className="text-3xl font-semibold">Formulario de visita</h1>
            <p className="text-sm text-slate-600">
              {isEditMode ? "Editando formulario existente · " : null}
              Sesión: {authUsername ?? "—"} · Red:{" "}
              {isOnline ? "online" : "offline"}
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-row items-center justify-between gap-2 sm:gap-6">
            <div className="flex min-w-0 flex-wrap gap-2">
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
            {hayContenidoDiligenciado ? (
              <div className="flex shrink-0 border-l border-slate-200 pl-3 sm:pl-6">
                <Button
                  type="button"
                  variant="outline"
                  className="border-amber-200 text-amber-950 hover:bg-amber-50"
                  onClick={() => setModalLimpiarAbierto(true)}
                >
                  Limpiar
                </Button>
              </div>
            ) : null}
          </div>
        </header>

        <FormularioOverviewPanel
          estado={estado}
          progreso={progreso}
          gps={gpsFormulario}
          error={error}
          cargando={cargando}
          onSolicitarGps={() => {
            setModoCoordenadas("automatico");
            solicitarGPS();
          }}
          modoCoordenadas={modoCoordenadas}
          onChangeModoCoordenadas={(m) => {
            if (m === "manual") {
              setValue("latitud", "");
              setValue("longitud", "");
              setValue("metros_sobre_nivel_mar", "");
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
          className="flex min-w-0 flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
          }}
          onKeyDown={handleDiligenciadoFormEnterKey}
        >
          {coordenadasSection ? (
            <details
              key={coordenadasSection.id}
              open={openSections.has(coordenadasSection.id)}
              onToggle={(e) => {
                const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                setOpenSections((prev) => {
                  const next = new Set(prev);
                  if (isOpen) {
                    next.add(coordenadasSection.id);
                  } else {
                    next.delete(coordenadasSection.id);
                  }
                  return next;
                });
              }}
              className="form-section-panel group"
            >
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                {coordenadasSection.title}
              </summary>
              <div className="form-fields-grid">
                {coordenadasSection.fields.map((field) => (
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
          ) : null}

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
            cameraNotice={cameraOpen ? banner : null}
          />

          <ImagePreviewModal
            image={previewFoto}
            onClose={() => setPreviewFoto(null)}
          />

          {formSectionsWithoutCoordinates.map((section) => (
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
              className="form-section-panel group"
            >
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                {section.title}
              </summary>
              <div className="form-fields-grid">
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
            {isEditMode && !hasEditChanges ? (
              <p className="text-center text-xs text-slate-500">
                No hay cambios para actualizar.
              </p>
            ) : null}
            <Button
              type="button"
              disabled={enviando || !puedeEnviarFormulario}
              className="bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50"
              onClick={() => void handleSubmit(onValid, onInvalid)()}
            >
              {enviando
                ? isEditMode
                  ? "Actualizando…"
                  : "Guardando…"
                : isEditMode
                  ? "Actualizar"
                  : "Guardar / enviar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
