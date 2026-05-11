interface FiltersPanelProps {
  filtroBeneficiario: string;
  filtroDesde: string;
  filtroHasta: string;
  onChangeBeneficiario: (value: string) => void;
  onChangeDesde: (value: string) => void;
  onChangeHasta: (value: string) => void;
  onClear: () => void;
  rowsTotal: number;
  rowsFiltered: number;
  hasActiveFilters: boolean;
}

export const FiltersPanel = ({
  filtroBeneficiario,
  filtroDesde,
  filtroHasta,
  onChangeBeneficiario,
  onChangeDesde,
  onChangeHasta,
  onClear,
  rowsTotal,
  rowsFiltered,
  hasActiveFilters,
}: FiltersPanelProps) => {
  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Filtros</h2>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Nombre del beneficiario
        </h3>
        <input
          type="search"
          value={filtroBeneficiario}
          onChange={(e) => onChangeBeneficiario(e.target.value)}
          placeholder="Ej.: García, María…"
          className="mt-2 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
          autoComplete="off"
        />
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Fecha de envío / del formulario
        </h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs font-medium text-slate-700">
            Desde
            <input
              type="date"
              value={filtroDesde}
              onChange={(e) => onChangeDesde(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
            />
          </label>
          <label className="flex flex-col text-xs font-medium text-slate-700">
            Hasta
            <input
              type="date"
              value={filtroHasta}
              onChange={(e) => onChangeHasta(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
            />
          </label>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {hasActiveFilters && rowsFiltered !== rowsTotal ? (
        <p className="mt-3 text-xs text-slate-600">
          Mostrando <strong>{rowsFiltered}</strong> de {rowsTotal} registros.
        </p>
      ) : null}
    </div>
  );
};
