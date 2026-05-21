import { Controller, type Control, type UseFormRegister } from "react-hook-form";

import {
  fieldLabel,
  inputKindForField,
  triOptions,
} from "@/config/formFieldMeta";
import { fieldSelectOptions } from "@/config/formSelectOptions";
import {
  normalizeTelefonoStoredValue,
  TELEFONO_NO_TIENE_VALUE,
} from "@/lib/telefonoNormalize";
import type { FormFieldKey, FormValues } from "@/types/formFields";

import { SearchableSelect, type SelectOption } from "./SearchableSelect";

const inputClass =
  "mt-1 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600";

const SELECT_FALLBACK: SelectOption[] = [{ value: "", label: "" }];

const TRIO_OPTIONS_LIST: SelectOption[] = triOptions.map((o) => ({
  value: o.value,
  label: o.label,
}));

interface FormFieldRowProps {
  name: FormFieldKey;
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
  error?: string;
  editableGpsFields?: boolean;
}

export const FormFieldRow = ({
  name,
  register,
  control,
  error,
  editableGpsFields = false,
}: FormFieldRowProps) => {
  const kind = inputKindForField(name);
  const label = fieldLabel(name);

  if (name === "telefono") {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => {
          const { onBlur: fieldOnBlur, ref, ...fieldRest } = field;
          return (
            <label className="flex min-w-0 flex-col text-sm font-medium text-slate-800 md:col-span-2">
              {label}
              <input
                {...fieldRest}
                ref={ref}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className={inputClass}
                onBlur={(e) => {
                  fieldOnBlur();
                  const n = normalizeTelefonoStoredValue(e.target.value);
                  if (n !== String(field.value ?? "")) {
                    field.onChange(n);
                  }
                }}
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Atajo:</span>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-900"
                  onClick={() => field.onChange(TELEFONO_NO_TIENE_VALUE)}
                >
                  No tiene
                </button>
              </div>
              {error ? (
                <span className="mt-1 text-xs text-red-600">{error}</span>
              ) : null}
            </label>
          );
        }}
      />
    );
  }

  if (kind === "textarea") {
    return (
      <label className="flex min-w-0 flex-col text-sm font-medium text-slate-800 md:col-span-2">
        {label}
        <textarea rows={3} className={inputClass} {...register(name)} />
        {error ? (
          <span className="mt-1 text-xs text-red-600">{error}</span>
        ) : null}
      </label>
    );
  }

  if (kind === "select-tri") {
    return (
      <SearchableSelect
        name={name}
        control={control}
        options={TRIO_OPTIONS_LIST}
        label={label}
        error={error}
      />
    );
  }

  if (kind === "select") {
    const options = fieldSelectOptions[name] ?? SELECT_FALLBACK;
    return (
      <SearchableSelect
        name={name}
        control={control}
        options={options}
        label={label}
        error={error}
      />
    );
  }

  const type = kind === "date" ? "date" : kind === "number" ? "number" : "text";

  const isPositiveInt = name === "estrato" || name === "usuario_cens";
  const isSatisfaccion = name === "satisfaccion_1_5";
  const isGpsDerivedField = name === "latitud" || name === "longitud";
  const isManualCoordField = isGpsDerivedField && editableGpsFields;
  const isReadOnly = isGpsDerivedField && !editableGpsFields;
  const gpsReadOnlyClass = isReadOnly ? " bg-slate-100 text-slate-600" : "";
  const inputType = isManualCoordField ? "text" : type;

  return (
    <label className="flex min-w-0 flex-col text-sm font-medium text-slate-800">
      {label}
      <input
        className={`${inputClass}${gpsReadOnlyClass}`}
        type={inputType}
        inputMode={isManualCoordField ? "decimal" : undefined}
        min={isPositiveInt || isSatisfaccion ? 1 : undefined}
        max={isSatisfaccion ? 5 : undefined}
        step={
          type === "number" && !isManualCoordField
            ? isPositiveInt || isSatisfaccion
              ? 1
              : "any"
            : undefined
        }
        readOnly={isReadOnly}
        title={
          isGpsDerivedField
            ? isReadOnly
              ? "Este campo se actualiza al tomar ubicación GPS (6 decimales)."
              : "Podés ingresar las coordenadas con la precisión decimal que necesites."
            : undefined
        }
        {...register(name)}
      />
      {error ? (
        <span className="mt-1 text-xs text-red-600">{error}</span>
      ) : null}
    </label>
  );
};
