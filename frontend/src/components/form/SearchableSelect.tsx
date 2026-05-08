import { useEffect, useId, useMemo, useRef, useState, type Ref } from 'react';
import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import type { FormFieldKey, FormValues } from '@/types/formFields';

export type SelectOption = { value: string; label: string };

const inputClass =
  'mt-1 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600';

const inputWithChevronClass = `${inputClass} pr-9 appearance-none`;

const inputErrorClass = 'border-red-600 ring-1 ring-red-500/40';

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

type SelectBinding = {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  name: string;
  inputRef: Ref<HTMLInputElement>;
};

type InnerProps = {
  binding: SelectBinding;
  options: SelectOption[];
  label: string;
  listId: string;
  error?: string;
  /** Borde rojo (validación) */
  invalid?: boolean;
};

const SearchableSelectInner = ({
  binding,
  options,
  label,
  listId,
  error,
  invalid,
}: InnerProps) => {
  const [open, setOpen] = useState(false);
  const fieldValue = String(binding.value ?? '');
  const [text, setText] = useState(() => labelForValue(fieldValue, options));

  useEffect(() => {
    setText(labelForValue(fieldValue, options));
  }, [fieldValue, options]);

  const filtered = useMemo(() => filterOptions(options, text), [options, text]);

  const commitOrRevert = () => {
    const resolved = resolveOption(text, options);
    if (resolved) {
      binding.onChange(resolved.value);
      setText(labelForValue(resolved.value, options));
    } else {
      setText(labelForValue(fieldValue, options));
    }
  };

  const inputRing = invalid || error ? inputErrorClass : '';

  return (
    <label className="flex min-w-0 flex-col text-sm font-medium text-slate-800 md:col-span-2">
      {label}
      <div className="relative z-20 mt-1">
        <input
          ref={binding.inputRef}
          name={binding.name}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className={`${inputWithChevronClass} ${inputRing}`.trim()}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            binding.onBlur();
            setOpen(false);
            commitOrRevert();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setOpen(false);
              setText(labelForValue(fieldValue, options));
            }
            if (e.key === 'Enter' && open && filtered.length === 1) {
              e.preventDefault();
              const only = filtered[0];
              binding.onChange(only.value);
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
            className="absolute z-[100] mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          >
            {filtered.map((o) => (
              <li
                key={o.value === '' ? '__empty__' : o.value}
                role="option"
                aria-selected={binding.value === o.value}
                className="cursor-pointer px-3 py-2 text-sm text-slate-800 hover:bg-teal-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  binding.onChange(o.value);
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
        validate: (v: string) => {
          const t = String(v ?? "").trim();
          if (t === "") {
            return true;
          }
          return allowedValues.has(v) ? true : "Elegí una opción de la lista";
        },
      }}
      render={({ field }) => (
        <SearchableSelectInner
          binding={{
            value: String(field.value ?? ''),
            onChange: field.onChange,
            onBlur: field.onBlur,
            name: field.name,
            inputRef: field.ref,
          }}
          options={options}
          label={label}
          listId={listId}
          error={error}
        />
      )}
    />
  );
};

export type SearchableSelectControlledProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label: string;
  error?: string;
  /** id estable para accesibilidad (opcional) */
  id?: string;
};

/** Mismo combobox que el formulario, sin react-hook-form (p. ej. importación Excel). */
export const SearchableSelectControlled = ({
  value,
  onChange,
  options,
  label,
  error,
  id: idProp,
}: SearchableSelectControlledProps) => {
  const genId = useId();
  const listId = idProp ? `${idProp}-list` : genId;
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <SearchableSelectInner
      binding={{
        value: String(value ?? ''),
        onChange,
        onBlur: () => {},
        name: idProp ?? 'import-select',
        inputRef,
      }}
      options={options}
      label={label}
      listId={listId}
      error={error}
      invalid={Boolean(error)}
    />
  );
};
