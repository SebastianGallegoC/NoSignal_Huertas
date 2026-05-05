import type { Dispatch, SetStateAction } from "react";
import type { FieldErrors, UseFormReset, UseFormSetFocus } from "react-hook-form";

import type { FormEnvioResultState } from "@/components/form/FormEnvioResultModal";
import { FORM_SECTIONS } from "@/config/formSections";
import { randomUuid } from "@/lib/randomUuid";
import type { OfflineForm } from "@/services/db";
import { clearFormDraft } from "@/services/formDraftStorage";
import { enqueueForm, syncPendingForms } from "@/services/sync";
import {
  joinValidationMessages,
  validateOfflineFormPayload,
} from "@/services/formValidation";
import type { FormFieldKey, FormValues } from "@/types/formFields";

type Args = {
  gps: { latitud: number; longitud: number; precision: number } | null;
  fotos: Array<{ nombre_archivo: string; data: string }>;
  formId: string;
  idUsuario: string;
  authUsername: string | null;
  draftUserKey: string;
  defaults: FormValues;
  setBanner: (v: string | null) => void;
  setSubmitFeedback: (v: string | null) => void;
  setEnvioModal: (v: FormEnvioResultState | null) => void;
  setEnviando: (v: boolean) => void;
  setFotos: (v: Array<{ nombre_archivo: string; data: string }>) => void;
  setFormId: (v: string) => void;
  refreshPendientes: () => Promise<void>;
  reset: UseFormReset<FormValues>;
  setOpenSections: Dispatch<SetStateAction<Set<string>>>;
  setFocus: UseFormSetFocus<FormValues>;
  toSafeUserId: (raw: string) => string;
  requiredFields: readonly FormFieldKey[];
};

type BuildPayloadArgs = {
  values: FormValues;
  requiredFields: readonly FormFieldKey[];
  formId: string;
  idUsuario: string;
  authUsername: string | null;
  gps: { latitud: number; longitud: number; precision: number };
  fotos: Array<{ nombre_archivo: string; data: string }>;
  toSafeUserId: (raw: string) => string;
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
  idUsuario,
  authUsername,
  gps,
  fotos,
  toSafeUserId,
}: BuildPayloadArgs): OfflineForm => {
  return {
    id_formulario: formId,
    id_usuario: toSafeUserId(idUsuario || authUsername || "sin_usuario"),
    fecha_hora: new Date().toISOString(),
    gps: {
      latitud: gps.latitud,
      longitud: gps.longitud,
      precision: Math.min(gps.precision, 5),
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
  idUsuario,
  authUsername,
  draftUserKey,
  defaults,
  setBanner,
  setSubmitFeedback,
  setEnvioModal,
  setEnviando,
  setFotos,
  setFormId,
  refreshPendientes,
  reset,
  setOpenSections,
  setFocus,
  toSafeUserId,
  requiredFields,
}: Args) => {
  const onValid = async (values: FormValues) => {
    setBanner(null);
    setSubmitFeedback("Validando formulario...");
    if (!gps) {
      setBanner("Tomá la ubicación GPS antes de enviar.");
      setSubmitFeedback("No se pudo enviar: falta ubicación GPS.");
      return;
    }
    if (fotos.length > 15) {
      const message = `Máximo 15 fotos. Actual: ${fotos.length}.`;
      setBanner(message);
      setSubmitFeedback(message);
      return;
    }

    const payload = buildOfflinePayload({
      values,
      requiredFields,
      formId,
      idUsuario,
      authUsername,
      gps,
      fotos,
      toSafeUserId,
    });

    const validationIssues = validateOfflineFormPayload(payload);
    if (validationIssues.length > 0) {
      const message =
        joinValidationMessages(validationIssues) ||
        "No se pudo enviar: hay validaciones pendientes.";
      setBanner(message);
      setSubmitFeedback(message);
      return;
    }

    setEnviando(true);
    setSubmitFeedback("Guardando formulario...");
    try {
      await enqueueForm(payload);
      clearFormDraft(draftUserKey);
      setBanner(null);
      setSubmitFeedback(null);
      if (!navigator.onLine) {
        setEnvioModal({
          tone: "warning",
          title: "Guardado localmente (sin red)",
          message:
            "El formulario quedó guardado en este dispositivo y en cola. Se intentará enviar al servidor cuando recuperes Wi‑Fi o datos móviles.",
          submittedForm: payload,
        });
      } else {
        const result = await syncPendingForms();
        if (result.failed > 0) {
          const detail = result.first_error?.trim();
          setEnvioModal({
            tone: "danger",
            title: "Guardado local; falló el envío al servidor",
            message:
              detail && detail.length > 0
                ? `Hay conexión, pero la sincronización no se completó. Detalle: ${detail}`
                : "Hay conexión, pero la sincronización no se completó. Revisá «Errores sync» más abajo. Podés usar «Sincronizar ahora» cuando quieras reintentar.",
            submittedForm: payload,
          });
        } else if (result.sent > 0) {
          setEnvioModal({
            tone: "success",
            title: "Enviado correctamente",
            message:
              "El formulario se guardó y se sincronizó con el servidor. Ya podés cargar un nuevo registro si lo necesitás.",
            submittedForm: payload,
          });
        } else {
          setEnvioModal({
            tone: "warning",
            title: "En cola para sincronizar",
            message:
              "El formulario quedó guardado localmente en espera de envío (por ejemplo, otro intento en curso o reintento con espera). Se enviará automáticamente cuando corresponda.",
            submittedForm: payload,
          });
        }
      }
      reset(defaults);
      setFotos([]);
      setFormId(randomUuid());
      await refreshPendientes();
    } catch {
      setBanner(null);
      setSubmitFeedback(null);
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
    if (fields.length > 0) {
      const first = fields[0];
      setBanner(
        `Faltan campos por completar o corregir (${fields.length}). Revisá el formulario.`,
      );
      setSubmitFeedback(
        `No se pudo enviar: ${fields.length} campo(s) por corregir.`,
      );
      setFocus(first);
      return;
    }
    setBanner("El formulario tiene errores. Revisá los campos e intentá nuevamente.");
    setSubmitFeedback("El formulario tiene errores.");
  };

  return { onValid, onInvalid };
};
