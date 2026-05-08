import { FORM_SECTIONS } from "@/config/formSections";
import { fieldLabel, inputKindForField } from "@/config/formFieldMeta";
import type { ImportPreviewRow } from "@/services/formularioExcelImport";
import type { FormFieldKey } from "@/types/formFields";

const inputBase =
  "mt-1 w-full min-w-0 rounded-xl border bg-slate-50/80 px-3 py-2 text-sm text-slate-900 shadow-sm [overflow-wrap:anywhere] focus-visible:outline-none";

type PreviewFieldProps = {
  label: string;
  value: string;
  error?: string;
  multiline?: boolean;
};

const PreviewField = ({ label, value, error, multiline }: PreviewFieldProps) => {
  const invalid = Boolean(error);
  const ring = invalid
    ? "border-red-600 ring-1 ring-red-500/40"
    : "border-slate-200";

  return (
    <label className="flex min-w-0 flex-col text-sm font-medium text-slate-800 md:col-span-2">
      {label}
      {multiline ? (
        <textarea
          readOnly
          rows={3}
          className={`${inputBase} ${ring}`}
          value={value}
        />
      ) : (
        <input readOnly className={`${inputBase} ${ring}`} value={value} />
      )}
      {error ? (
        <span className="mt-1 text-xs font-normal text-red-600">{error}</span>
      ) : null}
    </label>
  );
};

const ID_FIELD_LABEL = "ID (columna A)";

export const ImportPreviewRowCard = ({ row }: { row: ImportPreviewRow }) => {
  const { displayValues, fieldErrors, rowMessages, sheetRow, idRaw, isValid } =
    row;

  return (
    <details
      open={!isValid}
      className="rounded-2xl border border-slate-200 bg-white/95 shadow-sm"
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-center gap-2">
          <span>Fila {sheetRow} (Excel)</span>
          {isValid ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
              Lista para importar
            </span>
          ) : (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">
              Revisar errores
            </span>
          )}
        </span>
      </summary>
      <div className="border-t border-slate-100 px-4 pb-4 pt-2">
        {rowMessages.length > 0 ? (
          <ul className="mb-3 list-inside list-disc rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {rowMessages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        ) : null}

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Identificador
            </h3>
            <div className="mt-2 grid gap-4 md:grid-cols-2">
              <PreviewField
                label={ID_FIELD_LABEL}
                value={idRaw}
                error={fieldErrors.id_formulario}
              />
            </div>
          </section>

          {FORM_SECTIONS.map((section) => (
            <section
              key={section.id}
              className="rounded-xl border border-slate-100 bg-slate-50/50 p-3"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                {section.title}
              </h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {section.fields.map((field) => {
                  const fk = field as FormFieldKey;
                  const kind = inputKindForField(fk);
                  const multiline = kind === "textarea";
                  const err =
                    fk === "longitud"
                      ? fieldErrors.longitud
                      : fk === "latitud"
                        ? fieldErrors.latitud
                        : fieldErrors[fk];
                  return (
                    <PreviewField
                      key={field}
                      label={fieldLabel(fk)}
                      value={displayValues[fk] ?? ""}
                      error={err}
                      multiline={multiline}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </details>
  );
};
