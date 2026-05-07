import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import type { OfflineForm } from "@/services/db";
import { downloadMatrizCaracterizacionXlsx } from "@/services/matrizCaracterizacionExport";
import { downloadPhotosZip } from "@/services/photosExport";

export type FormEnvioModalTone = "success" | "warning" | "danger";

export type FormEnvioResultState = {
  tone: FormEnvioModalTone;
  title: string;
  message: string;
  /** Formulario guardado en cola; permite descargar la matriz F-PSA-08. */
  submittedForm?: OfflineForm;
  /** Indica si el modal corresponde al resultado de editar un formulario */
  isEdit?: boolean;
};

type Props = {
  open: boolean;
  tone: FormEnvioModalTone;
  title: string;
  message: string;
  submittedForm?: OfflineForm;
  onClose: () => void;
};

const toneStyles: Record<
  FormEnvioModalTone,
  { border: string; title: string }
> = {
  success: {
    border: "border-emerald-200 ring-emerald-100",
    title: "text-emerald-900",
  },
  warning: {
    border: "border-amber-200 ring-amber-100",
    title: "text-amber-950",
  },
  danger: {
    border: "border-rose-200 ring-rose-100",
    title: "text-rose-950",
  },
};

export const FormEnvioResultModal = ({
  open,
  tone,
  title,
  message,
  submittedForm,
  onClose,
}: Props) => {
  const [excelError, setExcelError] = useState<string | null>(null);
  const [fotosError, setFotosError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setExcelError(null);
    setFotosError(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const s = toneStyles[tone];

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 z-0 bg-slate-900/55 backdrop-blur-[1px]"
        aria-label="Cerrar diálogo"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-envio-modal-title"
        className={`relative z-10 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border bg-white p-5 shadow-2xl ring-2 sm:p-6 ${s.border}`}
      >
        <h2
          id="form-envio-modal-title"
          className={`text-lg font-semibold ${s.title}`}
        >
          {title}
        </h2>
        <p className="mt-3 max-h-[50dvh] overflow-y-auto text-sm leading-relaxed text-slate-700 sm:max-h-none">
          {message}
        </p>
        {submittedForm ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">
                Matriz de caracterización (Excel)
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Se descarga un archivo con la misma estructura de la matriz oficial (columnas de caracterización
                social).
              </p>
              {excelError ? (
                <p className="mt-2 text-xs text-rose-700">{excelError}</p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full border-teal-200 text-teal-900 hover:bg-teal-50"
                onClick={() => {
                  void (async () => {
                    try {
                      setExcelError(null);
                      await downloadMatrizCaracterizacionXlsx(submittedForm);
                    } catch {
                      setExcelError(
                        "No se pudo generar el archivo. Reintentá o comprobá el espacio disponible.",
                      );
                    }
                  })();
                }}
              >
                Descargar Excel
              </Button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Fotos por visita</p>
              <p className="mt-1 text-xs text-slate-600">
                Se descarga un ZIP con carpetas «Visita 1», «Visita 2» y «Visita
                3» dentro de «Fotos-[nombre del beneficiario]».
              </p>
              {(submittedForm.fotos?.length ?? 0) === 0 ? (
                <p className="mt-2 text-xs text-slate-600">
                  Este formulario no tiene fotos cargadas.
                </p>
              ) : null}
              {fotosError ? (
                <p className="mt-2 text-xs text-rose-700">{fotosError}</p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full border-teal-200 text-teal-900 hover:bg-teal-50"
                disabled={(submittedForm.fotos?.length ?? 0) === 0}
                onClick={() => {
                  void (async () => {
                    try {
                      setFotosError(null);
                      await downloadPhotosZip(submittedForm);
                    } catch {
                      setFotosError(
                        "No se pudo generar el ZIP de fotos. Reintentá o comprobá el espacio disponible.",
                      );
                    }
                  })();
                }}
              >
                Descargar fotos
              </Button>
            </div>
          </div>
        ) : null}
        <Button
          type="button"
          onClick={onClose}
          className="mt-6 w-full bg-teal-700 text-white hover:bg-teal-800"
        >
          Entendido
        </Button>
      </div>
    </div>,
    document.body,
  );
};
