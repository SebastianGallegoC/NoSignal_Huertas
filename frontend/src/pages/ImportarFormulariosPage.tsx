import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ImportPreviewRowCard } from "@/components/import/ImportPreviewRowCard";
import { Button } from "@/components/ui/button";
import type { ImportPreviewRowPatch } from "@/components/import/ImportPreviewRowCard";
import {
  analyzeImportRow,
  buildOfflineFormFromImportCells,
  formValuesToCells,
  type ImportPreviewRow,
  previewPlantillaWorkbook,
} from "@/services/formularioExcelImport";
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
  const [busyImport, setBusyImport] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [importBuffer, setImportBuffer] = useState<ArrayBuffer | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [previewErrors, setPreviewErrors] = useState<
    { row: number; message: string }[]
  >([]);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[] | null>(
    null,
  );

  const validCount = useMemo(
    () => previewRows?.filter((r) => r.isValid).length ?? 0,
    [previewRows],
  );
  const invalidCount = useMemo(
    () => previewRows?.filter((r) => !r.isValid).length ?? 0,
    [previewRows],
  );

  const resetPreview = useCallback(() => {
    setImportBuffer(null);
    setFileLabel(null);
    setPreviewRows(null);
    setPreviewErrors([]);
    setMessage(null);
  }, []);

  const onFile = useCallback(
    async (file: File | null) => {
      setMessage(null);
      setPreviewRows(null);
      setPreviewErrors([]);
      setImportBuffer(null);
      setFileLabel(null);
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
        const { rows, errors } = await previewPlantillaWorkbook(buffer, idUsuario);
        setImportBuffer(buffer);
        setFileLabel(file.name);
        setPreviewErrors(errors);
        setPreviewRows(rows);
        if (errors.length > 0) {
          setMessage(null);
        } else if (rows.length === 0) {
          setMessage("No había filas de datos para previsualizar (desde la fila 8).");
        } else {
          setMessage(
            `Vista previa de ${rows.length} fila(s). Podés editar los campos aquí abajo; los errores se actualizan al escribir. También podés corregir el Excel y volver a subirlo.`,
          );
        }
      } catch (e) {
        setMessage(
          e instanceof Error
            ? e.message
            : "No se pudo leer el archivo. Verificá que sea un .xlsx válido.",
        );
      } finally {
        setBusy(false);
      }
    },
    [authUsername],
  );

  const handlePreviewRowPatch = useCallback(
    (sheetRow: number, patch: ImportPreviewRowPatch) => {
      const idUsuario = toSafeUserId(authUsername ?? "");
      setPreviewRows((prev) => {
        if (!prev) {
          return prev;
        }
        return prev.map((r) => {
          if (r.sheetRow !== sheetRow) {
            return r;
          }
          const idRaw = patch.idRaw ?? r.idRaw;
          const displayValues = { ...r.displayValues, ...patch.displayValues };
          const cells = formValuesToCells(displayValues, idRaw);
          return analyzeImportRow(
            cells,
            sheetRow,
            idUsuario,
            new Date().toISOString(),
          );
        });
      });
    },
    [authUsername],
  );

  const onConfirmImport = useCallback(async () => {
    if (!previewRows || previewRows.length === 0) {
      return;
    }
    const idUsuario = toSafeUserId(authUsername ?? "");
    setBusyImport(true);
    setMessage(null);
    try {
      let n = 0;
      const failedRows: number[] = [];
      for (const r of previewRows) {
        if (!r.isValid) {
          continue;
        }
        const cells = formValuesToCells(r.displayValues, r.idRaw);
        const { form, error } = buildOfflineFormFromImportCells(
          cells,
          idUsuario,
          new Date().toISOString(),
        );
        if (form) {
          await enqueueForm(form);
          n += 1;
        } else if (error) {
          failedRows.push(r.sheetRow);
        }
      }
      if (failedRows.length === 0 && n > 0) {
        setMessage(
          `Se importaron ${n} formulario(s) a la cola local. Podés sincronizar cuando tengas conexión.`,
        );
        resetPreview();
      } else if (n > 0 && failedRows.length > 0) {
        setMessage(
          `Se importaron ${n} formulario(s). No se pudo completar la importación en la(s) fila(s) ${failedRows.join(", ")} (revisá la vista previa).`,
        );
      } else if (n === 0) {
        setMessage(
          "No se importó ningún registro. Asegurate de tener al menos una fila marcada como válida.",
        );
      }
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "No se pudo completar la importación.",
      );
    } finally {
      setBusyImport(false);
    }
  }, [authUsername, previewRows, resetPreview]);

  const globalPreviewError =
    previewErrors.length > 0 ? previewErrors[0] : null;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e2f2ee_0,_#f6f7f5_45%,_#f6f7f5_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-3xl">
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
            : hoja <strong>F-PSA-08</strong>, fila 7 reservada a títulos (no hace
            falta que coincidan con la plantilla), datos desde la fila 8 en el
            mismo orden de columnas (1–76) que la plantilla.
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
              disabled={busy || busyImport}
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
          {fileLabel ? (
            <p className="mt-2 text-xs text-slate-600">
              Archivo: <span className="font-medium">{fileLabel}</span>
            </p>
          ) : null}
          {busy ? (
            <p className="mt-4 text-sm text-slate-600">Leyendo vista previa…</p>
          ) : null}
          {message ? (
            <p className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {message}
            </p>
          ) : null}
          {globalPreviewError ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-900">
              {globalPreviewError.row === 0 ? "General" : `Fila ${globalPreviewError.row}`}:{" "}
              {globalPreviewError.message}
            </div>
          ) : null}

          {previewRows && previewRows.length > 0 ? (
            <div className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <p className="text-sm text-slate-700">
                  <strong>{validCount}</strong> fila(s) válida(s)
                  {invalidCount > 0 ? (
                    <>
                      {" "}
                      · <strong className="text-red-700">{invalidCount}</strong>{" "}
                      con errores
                    </>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-slate-200"
                    disabled={busy || busyImport}
                    onClick={() => resetPreview()}
                  >
                    Quitar archivo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-teal-700 text-white hover:bg-teal-800"
                    disabled={busy || busyImport || validCount === 0}
                    onClick={() => void onConfirmImport()}
                  >
                    {busyImport
                      ? "Importando…"
                      : `Importar ${validCount} fila(s) válida(s)`}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Podés editar cualquier campo en la vista previa. Los campos con
                borde rojo no cumplen formato o tipo de dato. Las fechas deben ser
                interpretables (por ejemplo <strong>15/03/2026</strong> o{" "}
                <strong>2026-03-15</strong>).
              </p>
              <div className="max-h-[min(70vh,720px)] space-y-3 overflow-y-auto pr-1">
                {previewRows.map((row) => (
                  <ImportPreviewRowCard
                    key={row.sheetRow}
                    row={row}
                    onPatch={handlePreviewRowPatch}
                  />
                ))}
              </div>
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
