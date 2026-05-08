import { useCallback, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { parsePlantillaWorkbook } from "@/services/formularioExcelImport";
import { enqueueForm } from "@/services/sync";
import { useAuthStore } from "@/store/useAuthStore";

const toSafeUserId = (raw: string): string => {
  const base = (raw || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return base || "sin_usuario";
};

export const ImportarFormulariosPage = () => {
  const authUsername = useAuthStore((s) => s.username);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<{ row: number; message: string }[]>(
    [],
  );

  const onFile = useCallback(
    async (file: File | null) => {
      setMessage(null);
      setRowErrors([]);
      if (!file) {
        return;
      }
      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        setMessage("Elegí un archivo .xlsx.");
        return;
      }
      const idUsuario = toSafeUserId(authUsername ?? "");
      setBusy(true);
      try {
        const buffer = await file.arrayBuffer();
        const { ok, errors } = await parsePlantillaWorkbook(buffer, idUsuario);
        setRowErrors(errors);
        let n = 0;
        for (const form of ok) {
          await enqueueForm(form);
          n += 1;
        }
        if (errors.length === 0 && n > 0) {
          setMessage(`Se importaron ${n} formulario(s) a la cola local. Podés sincronizar cuando tengas conexión.`);
        } else if (n > 0 && errors.length > 0) {
          setMessage(
            `Se importaron ${n} formulario(s). Hubo ${errors.length} fila(s) con error (ver abajo).`,
          );
        } else if (n === 0 && errors.length > 0) {
          setMessage("No se importó ningún registro. Revisá los errores abajo.");
        } else {
          setMessage("No había filas de datos para importar.");
        }
      } catch (e) {
        setMessage(
          e instanceof Error
            ? e.message
            : "No se pudo leer el archivo. Verificá que sea una copia de la plantilla.",
        );
      } finally {
        setBusy(false);
      }
    },
    [authUsername],
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e2f2ee_0,_#f6f7f5_45%,_#f6f7f5_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">
            NoSignal
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Importar formularios</h1>
          <p className="mt-2 text-sm text-slate-600">
            Subí un Excel con la misma estructura que la{" "}
            <a
              href="/PLANTILLA.xlsx"
              download
              className="font-medium text-teal-800 underline decoration-teal-300 underline-offset-2 hover:text-teal-950"
            >
              plantilla oficial (PLANTILLA.xlsx)
            </a>
            : hoja <strong>F-PSA-08</strong>, encabezados en la fila 7 y datos
            desde la fila 8.
          </p>
          <ul className="mt-3 list-inside list-disc text-sm text-slate-600">
            <li>
              Solo se cargan los <strong>campos del formulario</strong> (no hay
              fotos). Cada fila debe incluir <strong>LONGITUD</strong> y{" "}
              <strong>LATITUD</strong> numéricas.
            </li>
            <li>
              La columna <strong>ID</strong> puede ir vacía (se genera un UUID)
              o con un UUID existente (si coincide con un borrador en cola, se
              reemplaza).
            </li>
            <li>
              Los registros quedan en <strong>cola local</strong> como pendientes
              de sincronizar (igual que al guardar desde el formulario).
            </li>
          </ul>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">
            Archivo .xlsx
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={busy}
              className="text-sm font-normal file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:px-3 file:py-2 file:text-sm file:font-medium"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = "";
                void onFile(f);
              }}
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Usuario asociado:{" "}
            <span className="font-mono text-slate-700">{authUsername ?? "—"}</span>{" "}
            ({toSafeUserId(authUsername ?? "")})
          </p>
          {busy ? (
            <p className="mt-4 text-sm text-slate-600">Importando…</p>
          ) : null}
          {message ? (
            <p className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {message}
            </p>
          ) : null}
          {rowErrors.length > 0 ? (
            <div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm">
              <p className="font-semibold text-amber-950">Errores por fila</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-amber-900">
                {rowErrors.map((err, i) => (
                  <li key={`${err.row}-${i}`}>
                    {err.row === 0 ? "General" : `Fila ${err.row}`}:{" "}
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/inicio">
            <Button type="button" variant="outline" className="border-slate-200">
              Volver al inicio
            </Button>
          </Link>
          <Link to="/formularios-diligenciados">
            <Button type="button" variant="outline" className="border-slate-200">
              Ver formularios diligenciados
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
