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
        <select className={inputClass} {...register(name)}>
          {triOptions.map((o) => (
            <option key={o.value || 'empty'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error ? <span className="mt-1 text-xs text-red-600">{error}</span> : null}
      </label>
    );
  }

  if (kind === 'select') {
    const options = fieldSelectOptions[name] ?? [{ value: '', label: 'Seleccione' }];
    return (
      <label className="flex flex-col text-sm font-medium text-slate-800">
        {label}
        <select className={inputClass} {...register(name)}>
          {options.map((o) => (
            <option key={o.value || 'empty'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
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
