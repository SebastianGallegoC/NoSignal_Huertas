const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'America/Bogota',
});

const DATE_TIME_FORMATTER_NO_SECONDS = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value == null || value === '') {
    return '—';
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE_TIME_FORMATTER.format(date);
}

export function formatDateTimeNoSeconds(value: string | number | Date | null | undefined): string {
  if (value == null || value === '') {
    return '—';
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE_TIME_FORMATTER_NO_SECONDS.format(date);
}

/**
 * Parse ISO 8601 date strings robustly, handling timezone info correctly.
 * Returns timestamp in milliseconds, or NaN if parsing fails.
 * Handles strings with or without timezone (assumes UTC if not specified).
 */
export function parseISODate(dateString: string | null | undefined): number {
  if (!dateString || dateString === '') {
    return NaN;
  }

  const trimmed = dateString.trim();
  
  // If string ends with 'Z', it's already UTC - safe to parse
  if (trimmed.endsWith('Z')) {
    return new Date(trimmed).getTime();
  }
  
  // If no timezone indicator, assume UTC for consistency across devices
  if (!trimmed.match(/[+-]\d{2}:\d{2}$|[+-]\d{4}$/)) {
    return new Date(`${trimmed}Z`).getTime();
  }
  
  // Has timezone offset - parse as-is
  return new Date(trimmed).getTime();
}

/** Formatea un instante ISO (p. ej. desde PostgreSQL/FastAPI) para mostrar en UI. */
export function formatISODateTimeForDisplay(iso: string | null | undefined): string {
  if (iso == null || String(iso).trim() === '') {
    return '—';
  }
  const ts = parseISODate(String(iso).trim());
  return Number.isNaN(ts) ? '—' : formatDateTimeNoSeconds(ts);
}