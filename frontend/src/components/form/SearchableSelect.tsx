import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { Control, ControllerRenderProps } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import type { FormFieldKey, FormValues } from '@/types/formFields';

export type SelectOption = { value: string; label: string };

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600';

const inputWithChevronClass = `${inputClass} pr-9 appearance-none`;

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function labelForValue(value: string, options: SelectOption[]): string {
  const o = options.find((x) => x.value === value);
  return o ? o.label : '';
}

function resolveOption(query: string, options: SelectOption[]): SelectOption | null {
  const t = query.trim();
  if (t === '') {
    return options.find((o) => o.value === '') ?? null;
  }
  const byValue = options.find((o) => o.value === t);
  if (byValue) {
    return byValue;
  }
  const n = normalize(t);
  return options.find((o) => normalize(o.label) === n) ?? null;
}

function filterOptions(options: SelectOption[], text: string): SelectOption[] {
  const q = text.trim().toLowerCase();
  if (!q) {
    return options;
  }
  return options.filter(
    (o) =>
      o.label.toLowerCase().includes(q) ||
      String(o.value).toLowerCase().includes(q) ||
      normalize(o.label).includes(normalize(text)),
  );
}

type InnerProps = {
  field: ControllerRenderProps<FormValues, FormFieldKey>;
  options: SelectOption[];
  label: string;
  listId: string;
  error?: string;
};

const SearchableSelectInner = ({ field, options, label, listId, error }: InnerProps) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => labelForValue(String(field.value ?? ''), options));

  useEffect(() => {
    setText(labelForValue(String(field.value ?? ''), options));
  }, [field.value, options]);

  const filtered = useMemo(() => filterOptions(options, text), [options, text]);

  const commitOrRevert = useCallback(() => {
    const resolved = resolveOption(text, options);
    if (resolved) {
      field.onChange(resolved.value);
      setText(labelForValue(resolved.value, options));
    } else {
      setText(labelForValue(String(field.value ?? ''), options));
    }
  }, [field.onChange, field.value, options, text]);

  return (
    <label className="flex flex-col text-sm font-medium text-slate-800">
      {label}
      <div className="relative mt-1">
        <input
          ref={field.ref}
          name={field.name}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className={inputWithChevronClass}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            field.onBlur();
            setOpen(false);
            commitOrRevert();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setOpen(false);
              setText(labelForValue(String(field.value ?? ''), options));
            }
            if (e.key === 'Enter' && open && filtered.length === 1) {
              e.preventDefault();
              const only = filtered[0];
              field.onChange(only.value);
              setText(labelForValue(only.value, options));
              setOpen(false);
            }
          }}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        {open && filtered.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          >
            {filtered.map((o) => (
              <li
                key={o.value === '' ? '__empty__' : o.value}
                role="option"
                aria-selected={field.value === o.value}
                className="cursor-pointer px-3 py-2 text-sm text-slate-800 hover:bg-teal-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  field.onChange(o.value);
                  setText(labelForValue(o.value, options));
                  setOpen(false);
                }}
              >
                {o.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {error ? <span className="mt-1 text-xs text-red-600">{error}</span> : null}
    </label>
  );
};

type SearchableSelectProps = {
  name: FormFieldKey;
  control: Control<FormValues>;
  options: SelectOption[];
  error?: string;
  label: string;
};

export const SearchableSelect = ({ name, control, options, error, label }: SearchableSelectProps) => {
  const listId = useId();

  const allowedValues = useMemo(() => new Set(options.map((o) => o.value)), [options]);

  return (
    <Controller
      name={name}
      control={control}
      rules={{
        validate: (v: string) =>
          allowedValues.has(v) ? true : 'Elegí una opción de la lista',
      }}
      render={({ field }) => (
        <SearchableSelectInner field={field} options={options} label={label} listId={listId} error={error} />
      )}
    />
  );
};
