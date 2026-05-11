import type { Dispatch, SetStateAction } from "react";
import type { FieldErrors, UseFormSetFocus } from "react-hook-form";

import type { FormEnvioResultState } from "@/components/form/FormEnvioResultModal";
import { fieldLabel } from "@/config/formFieldMeta";
import { FORM_SECTIONS } from "@/config/formSections";
import type { OfflineForm } from "@/services/db";
import type { FotoForm } from "@/services/db";
import { clearFormDraft } from "@/services/formDraftStorage";
import {
  enqueueForm,
  isNetworkLikeError,
  syncPendingForms,
} from "@/services/sync";
import {
  joinValidationMessages,
  validateOfflineFormPayload,
} from "@/services/formValidation";
import type { FormFieldKey, FormValues } from "@/types/formFields";
import {
  GPS_PLACEHOLDER_WHEN_NOT_CAPTURED,
  MAX_GPS_PRECISION_METERS,
  MIN_GPS_PRECISION_METERS,
} from "@/constants/gpsConfig";

type Args = {
  /** Ubicación capturada; si es null se usa un punto placeholder para el payload. */
  gps: { latitud: number; longitud: number; precision: number } | null;
  fotos: FotoForm[];
  formId: string;
  originalFechaHora: string | null;
  idUsuario: string;
  authUsername: string | null;
  draftUserKey: string;
  modoCoordenadas: "automatico" | "manual";
  setBanner: (v: string | null) => void;
  setEnvioModal: (v: FormEnvioResultState | null) => void;
  setEnviando: (v: boolean) => void;
  refreshPendientes: () => Promise<void>;
  setOpenSections: Dispatch<SetStateAction<Set<string>>>;
  setFocus: UseFormSetFocus<FormValues>;
  toSafeUserId: (raw: string) => string;
  requiredFields: readonly FormFieldKey[];
};

type BuildPayloadArgs = {
  values: FormValues;
  requiredFields: readonly FormFieldKey[];
  formId: string;
  originalFechaHora: string | null;
  idUsuario: string;
  authUsername: string | null;
  gps: { latitud: number; longitud: number; precision: number } | null;
  fotos: FotoForm[];
  toSafeUserId: (raw: string) => string;
  modoCoordenadas?: "automatico" | "manual";
};

export const buildDatosFormulario = (
  values: FormValues,
  requiredFields: readonly FormFieldKey[],
): Record<string, unknown> => {
  const datos_formulario: Record<string, unknown> = {};
  for (const key of requiredFields) {
    datos_formulario[key] = values[key];
  }
  return datos_formulario;
};

export const buildOfflinePayload = ({
  values,
  requiredFields,
  formId,
  originalFechaHora: _originalFechaHora,
  idUsuario,
  authUsername,
  gps,
  fotos,
  toSafeUserId,
  modoCoordenadas = "automatico",
}: BuildPayloadArgs): OfflineForm => {
  const now = new Date().toISOString();
  const fechaPrimerEnvio = _originalFechaHora ?? now;
  const fechaActualizacion = _originalFechaHora ? now : fechaPrimerEnvio;
  const gpsResolved = gps ?? GPS_PLACEHOLDER_WHEN_NOT_CAPTURED;
  return {
    id_formulario: formId,
    id_usuario: toSafeUserId(idUsuario || authUsername || "sin_usuario"),
    modo_coordenadas: modoCoordenadas === "manual" ? "manual" : "automatico",
    fecha_hora: fechaPrimerEnvio,
    fecha_actualizacion: fechaActualizacion,
    gps: {
      latitud: gpsResolved.latitud,
      longitud: gpsResolved.longitud,
      precision: Math.max(
        MIN_GPS_PRECISION_METERS,
        Math.min(gpsResolved.precision, MAX_GPS_PRECISION_METERS),
      ),
    },
    datos_formulario: buildDatosFormulario(values, requiredFields),
    fotos,
    estado_sincronizacion: "PENDIENTE",
  };
};

export const getSectionsWithErrors = (
  fields: FormFieldKey[],
): Set<string> => {
  return new Set(
    FORM_SECTIONS.filter((section) =>
      section.fields.some((f) => fields.includes(f)),
    ).map((s) => s.id),
  );
};

export const useFormularioSubmit = ({
  gps,
  fotos,
  formId,
  originalFechaHora: _originalFechaHora,
  idUsuario,
  authUsername,
  draftUserKey,
  modoCoordenadas,
  setBanner,
  setEnvioModal,
  setEnviando,
  refreshPendientes,
  setOpenSections,
  setFocus,
  toSafeUserId,
  requiredFields,
}: Args) => {
  const showEnvioBloqueadoModal = (title: string, message: string) => {
    setBanner(null);
    setEnvioModal({
      tone: "warning",
      title,
      message,
    });
  };

  const onValid = async (values: FormValues) => {
    setBanner(null);
    const nombreBenef = (values.nombres_apellidos_beneficiario ?? "").trim();
    if (!nombreBenef) {
      setOpenSections((prev) => new Set([...prev, "beneficiario"]));
      setFocus("nombres_apellidos_beneficiario");
      showEnvioBloqueadoModal(
        "No se puede enviar",
        "Completá el nombre del beneficiario antes de guardar o enviar el formulario.",
      );
      return;
    }
    if (fotos.length > 15) {
      showEnvioBloqueadoModal(
        "No se puede enviar",
        `Máximo 15 fotos. Actualmente tenés ${fotos.length}. Quitá algunas e intentá de nuevo.`,
      );
      return;
    }

    const payload = buildOfflinePayload({
      values,
      requiredFields,
      formId,
      originalFechaHora: _originalFechaHora,
      idUsuario,
      authUsername,
      gps: gps ?? null,
      fotos,
      toSafeUserId,
      modoCoordenadas,
    });

    const validationIssues = validateOfflineFormPayload(payload);
    if (validationIssues.length > 0) {
      const message =
        joinValidationMessages(validationIssues) ||
        "Hay validaciones pendientes. Revisá los datos e intentá de nuevo.";
      showEnvioBloqueadoModal("No se puede enviar", message);
      return;
    }

    setEnviando(true);
    try {
      await enqueueForm(payload);
      clearFormDraft(draftUserKey);
      setBanner(null);
      if (!navigator.onLine) {
        setEnvioModal({
          tone: "warning",
          title: "Guardado localmente (sin red)",
          message:
            "El formulario quedó guardado en este dispositivo y en cola. Se intentará enviar al servidor cuando recuperes Wi‑Fi o datos móviles.",
          submittedForm: payload,
          isEdit: !!_originalFechaHora,
        });
      } else {
        const result = await syncPendingForms();
        const firstErr = result.first_error?.trim() ?? "";
        const networkLikeFailure =
          result.failed > 0 && isNetworkLikeError(firstErr);
        const skippedWithoutHardFail = result.skipped > 0 && result.failed === 0;
        if (networkLikeFailure || skippedWithoutHardFail) {
          const detail = firstErr;
          setEnvioModal({
            tone: "warning",
            title: "Guardado localmente (sin conexión)",
            message:
              detail.length > 0
                ? `No hubo conexión estable para sincronizar ahora. El formulario quedó guardado localmente y se reintentará automáticamente. Detalle: ${detail}`
                : "No hubo conexión estable para sincronizar ahora. El formulario quedó guardado localmente y se reintentará automáticamente cuando vuelva internet.",
            submittedForm: payload,
            isEdit: !!_originalFechaHora,
          });
        } else if (result.failed > 0) {
          const detail = result.first_error?.trim();
          setEnvioModal({
            tone: "danger",
            title: "Guardado local; falló el envío al servidor",
            message:
              detail && detail.length > 0
                ? `Hay conexión, pero la sincronización no se completó. Detalle: ${detail}`
                : "Hay conexión, pero la sincronización no se completó. Revisá el contador en Inicio. Podés usar «Sincronizar ahora» cuando quieras reintentar.",
            submittedForm: payload,
            isEdit: !!_originalFechaHora,
          });
        } else if (result.sent > 0) {
          setEnvioModal({
            tone: "success",
            title: "Enviado correctamente",
            message:
              "El formulario se guardó y se sincronizó con el servidor.",
            submittedForm: payload,
            isEdit: !!_originalFechaHora,
          });
        } else {
          const skipHint =
            result.skipped > 0
              ? ` Hay ${result.skipped} envío(s) con espera de reintento (la app espera unos segundos tras un fallo de red); podés usar «Sincronizar ahora» en un momento.`
              : "";
          setEnvioModal({
            tone: "warning",
            title: "En cola para sincronizar",
            message:
              "El formulario quedó guardado localmente en espera de envío (por ejemplo, otro intento en curso o la cola está procesando otro formulario)." +
              skipHint +
              " Se enviará automáticamente al recuperar conexión estable.",
            submittedForm: payload,
            isEdit: !!_originalFechaHora,
          });
        }
      }
      await refreshPendientes();
    } catch {
      setBanner(null);
      setEnvioModal({
        tone: "danger",
        title: "No se pudo guardar",
        message:
          "No se pudo guardar el formulario en este dispositivo. Reintentá; si el problema continúa, revisá espacio de almacenamiento y permisos del navegador.",
      });
    } finally {
      setEnviando(false);
    }
  };

  const onInvalid = (formErrors: FieldErrors<FormValues>) => {
    const fields = Object.keys(formErrors) as FormFieldKey[];
    if (fields.length > 0) {
      const sectionsWithErrors = getSectionsWithErrors(fields);
      setOpenSections((prev) => new Set([...prev, ...sectionsWithErrors]));
    }
    const lines = fields.map((f) => {
      const e = formErrors[f];
      const m = e?.message;
      if (typeof m === "string" && m.trim()) {
        return `• ${fieldLabel(f)}: ${m.trim()}`;
      }
      return `• ${fieldLabel(f)}`;
    });
    const message =
      lines.length > 0
        ? lines.join("\n")
        : "Revisá los campos del formulario e intentá nuevamente.";
    const first = fields[0];
    if (first) {
      setFocus(first);
    }
    showEnvioBloqueadoModal("No se puede enviar", message);
  };

  return { onValid, onInvalid };
};
