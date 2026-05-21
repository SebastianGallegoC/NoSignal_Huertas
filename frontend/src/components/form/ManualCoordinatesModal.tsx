import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { formatCoordDecimalFromCell } from "@/lib/coordNumericToken";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (coords: {
    latitud: number;
    longitud: number;
    precision: number;
  }) => void;
};

export const ManualCoordinatesModal = ({
  isOpen,
  onClose,
  onSubmit,
}: Props) => {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [precision, setPrecision] = useState("5");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setLat("");
      setLon("");
      setPrecision("5");
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    setError(null);

    // Validar que los campos no estén vacíos
    if (!lat.trim() || !lon.trim()) {
      setError("Ingresa latitud y longitud.");
      return;
    }

    const latFormatted = formatCoordDecimalFromCell(lat);
    const lonFormatted = formatCoordDecimalFromCell(lon);
    if (!latFormatted || !lonFormatted) {
      setError("Ingresa coordenadas decimales válidas.");
      return;
    }
    const latNum = Number.parseFloat(latFormatted);
    const lonNum = Number.parseFloat(lonFormatted);
    const precisionNum = parseFloat(precision) || 0;

    // Validar rango de latitud (-90 a 90)
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setError("Latitud debe estar entre -90 y 90.");
      return;
    }

    // Validar rango de longitud (-180 a 180)
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      setError("Longitud debe estar entre -180 y 180.");
      return;
    }

    // Validar precisión (>= 0)
    if (isNaN(precisionNum) || precisionNum < 0) {
      setError("Precisión debe ser un número >= 0.");
      return;
    }

    onSubmit({ latitud: latNum, longitud: lonNum, precision: precisionNum });
    setLat("");
    setLon("");
    setPrecision("5");
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Ingresar coordenadas manualmente
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Latitud (-90 a 90)
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="ej: 4.710989"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Longitud (-180 a 180)
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="ej: -74.009008"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Precisión en metros (opcional, default 5)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="ej: 10"
              value={precision}
              onChange={(e) => setPrecision(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            className="bg-teal-600 text-white hover:bg-teal-700"
          >
            Guardar ubicación
          </Button>
        </div>
      </div>
    </div>
  );
};
