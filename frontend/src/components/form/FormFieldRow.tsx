import type { UseFormRegister } from 'react-hook-form';

import { fieldLabel, inputKindForField, triOptions } from '@/config/formFieldMeta';
import { fieldSelectOptions } from '@/config/formSelectOptions';
import type { FormFieldKey, FormValues } from '@/types/formFields';

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600';

interface FormFieldRowProps {
  name: FormFieldKey;
  register: UseFormRegister<FormValues>;
  error?: string;
}

export const FormFieldRow = ({ name, register, error }: FormFieldRowProps) => {
  const kind = inputKindForField(name);
  const label = fieldLabel(name);
  const datalistId = `options-${name}`;
  // Oculta flechas/indicadores nativos del <input list> (Chromium muestra uno propio + el nuestro).
  const searchableSelectClass = `${inputClass} pr-9 appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-list-button]:hidden`;

  if (kind === 'textarea') {
    return (
      <label className="flex flex-col text-sm font-medium text-slate-800 md:col-span-2">
        {label}
        <textarea rows={3} className={inputClass} {...register(name)} />
        {error ? <span className="mt-1 text-xs text-red-600">{error}</span> : null}
      </label>
    );
  }

  if (kind === 'select-tri') {
    return (
      <label className="flex flex-col text-sm font-medium text-slate-800">
        {label}
        <div className="relative mt-1">
          <input className={searchableSelectClass} list={datalistId} {...register(name)} />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </div>
        <datalist id={datalistId}>
          {triOptions.map((o) => (
            <option key={o.value || 'empty'} value={o.value}>
              {o.label}
            </option>
          ))}
        </datalist>
        {error ? <span className="mt-1 text-xs text-red-600">{error}</span> : null}
      </label>
    );
  }

  if (kind === 'select') {
    const options = fieldSelectOptions[name] ?? [{ value: '', label: 'Seleccione' }];
    return (
      <label className="flex flex-col text-sm font-medium text-slate-800">
        {label}
        <div className="relative mt-1">
          <input className={searchableSelectClass} list={datalistId} {...register(name)} />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </div>
        <datalist id={datalistId}>
          {options.map((o) => (
            <option key={o.value || 'empty'} value={o.value}>
              {o.label}
            </option>
          ))}
        </datalist>
        {error ? <span className="mt-1 text-xs text-red-600">{error}</span> : null}
      </label>
    );
  }

  const type = kind === 'date' ? 'date' : kind === 'number' ? 'number' : 'text';

  const isPositiveInt = name === 'estrato' || name === 'usuario_cens';
  const isSatisfaccion = name === 'satisfaccion_1_5';

  return (
    <label className="flex flex-col text-sm font-medium text-slate-800">
      {label}
      <input
        className={inputClass}
        type={type}
        min={isPositiveInt || isSatisfaccion ? 1 : undefined}
        max={isSatisfaccion ? 5 : undefined}
        step={type === 'number' ? ((isPositiveInt || isSatisfaccion) ? 1 : 'any') : undefined}
        {...register(name)}
      />
      {error ? <span className="mt-1 text-xs text-red-600">{error}</span> : null}
    </label>
  );
};
