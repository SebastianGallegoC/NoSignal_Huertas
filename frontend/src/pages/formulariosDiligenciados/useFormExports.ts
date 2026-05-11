import { useCallback } from 'react';

import type { FormularioSnapshot } from '@/components/form/FormularioRespuestaReadOnly';
import type { PrecargaForm } from '@/services/db';
import type { DisplayRow } from '@/services/formHistory';
import {
  downloadMatrizCaracterizacionBulkXlsx,
  downloadMatrizCaracterizacionXlsx,
} from '@/services/matrizCaracterizacionExport';
import { downloadPhotosBulkZip, downloadPhotosZip } from '@/services/photosExport';
import {
  fotosConVisitaDesdeDetalle,
  hydrateFotosFromServerIfNeeded,
  type FotoSnapshotLike,
} from '@/pages/formulariosDiligenciados/helpers';

type Args = {
  rows: DisplayRow[];
  detailSnapshot: FormularioSnapshot | null;
  detailPrecarga: PrecargaForm | null;
  setDescargaExcelError: (value: string | null) => void;
  setDescargaFotosError: (value: string | null) => void;
  setDescargandoExcelId: (value: string | null) => void;
  setDescargandoFotosId: (value: string | null) => void;
  setDescargandoTodosExcel: (value: boolean) => void;
  setDescargandoTodasFotos: (value: boolean) => void;
};

export const useFormExports = ({
  rows,
  detailSnapshot,
  detailPrecarga,
  setDescargaExcelError,
  setDescargaFotosError,
  setDescargandoExcelId,
  setDescargandoFotosId,
  setDescargandoTodosExcel,
  setDescargandoTodasFotos,
}: Args) => {
  const descargarExcelDelRegistro = useCallback(
    async (row: DisplayRow) => {
      if (!detailSnapshot) {
        setDescargaExcelError('No hay datos cargados del formulario para exportar.');
        return;
      }
      setDescargaExcelError(null);
      setDescargandoExcelId(row.id_formulario);
      try {
        const fotos = fotosConVisitaDesdeDetalle(
          detailPrecarga?.fotos ?? detailSnapshot.fotos ?? [],
        );

        const fallbackGps = row.server
          ? {
              latitud: row.server.latitud,
              longitud: row.server.longitud,
              precision: row.server.precision ?? 1,
            }
          : null;
        const gps = detailSnapshot.gps
          ? {
              latitud: detailSnapshot.gps.latitud,
              longitud: detailSnapshot.gps.longitud,
              precision:
                typeof detailSnapshot.gps.precision === 'number' &&
                detailSnapshot.gps.precision > 0
                  ? detailSnapshot.gps.precision
                  : 1,
            }
          : fallbackGps;
        if (!gps) {
          setDescargaExcelError('No hay coordenadas disponibles para exportar este formulario.');
          return;
        }

        await downloadMatrizCaracterizacionXlsx({
          id_formulario: row.id_formulario,
          id_usuario:
            row.server?.id_usuario ?? row.historial?.id_usuario ?? 'sin_usuario',
          fecha_hora:
            row.server?.fecha_hora ??
            row.historial?.fecha_envio ??
            row.historial?.fecha_hora ??
            new Date().toISOString(),
          gps,
          datos_formulario: detailSnapshot.datos_formulario ?? {},
          fotos,
          estado_sincronizacion: 'PENDIENTE',
        });
      } catch (e) {
        setDescargaExcelError(
          e instanceof Error
            ? e.message
            : 'No se pudo descargar el Excel de este formulario.',
        );
      } finally {
        setDescargandoExcelId(null);
      }
    },
    [detailPrecarga, detailSnapshot, setDescargaExcelError, setDescargandoExcelId],
  );

  const descargarFotosDelRegistro = useCallback(
    async (row: DisplayRow) => {
      if (!detailSnapshot) {
        setDescargaFotosError('No hay datos cargados del formulario para exportar fotos.');
        return;
      }
      setDescargaFotosError(null);
      setDescargandoFotosId(row.id_formulario);
      try {
        let fotos = fotosConVisitaDesdeDetalle(
          detailPrecarga?.fotos ?? detailSnapshot.fotos ?? [],
        );
        fotos = await hydrateFotosFromServerIfNeeded(row, fotos);
        if (fotos.length === 0) {
          setDescargaFotosError('Este formulario no tiene fotos cargadas.');
          return;
        }
        const fallbackGps = row.server
          ? {
              latitud: row.server.latitud,
              longitud: row.server.longitud,
              precision: row.server.precision ?? 1,
            }
          : { latitud: 0, longitud: 0, precision: 1 };
        const gps = detailSnapshot.gps
          ? {
              latitud: detailSnapshot.gps.latitud,
              longitud: detailSnapshot.gps.longitud,
              precision:
                typeof detailSnapshot.gps.precision === 'number' &&
                detailSnapshot.gps.precision > 0
                  ? detailSnapshot.gps.precision
                  : 1,
            }
          : fallbackGps;

        await downloadPhotosZip({
          id_formulario: row.id_formulario,
          id_usuario:
            row.server?.id_usuario ?? row.historial?.id_usuario ?? 'sin_usuario',
          fecha_hora:
            row.server?.fecha_hora ??
            row.historial?.fecha_envio ??
            row.historial?.fecha_hora ??
            new Date().toISOString(),
          gps,
          datos_formulario: detailSnapshot.datos_formulario ?? {},
          fotos,
          estado_sincronizacion: 'PENDIENTE',
        });
      } catch (e) {
        setDescargaFotosError(
          e instanceof Error
            ? e.message
            : 'No se pudo descargar el ZIP de fotos de este formulario.',
        );
      } finally {
        setDescargandoFotosId(null);
      }
    },
    [detailPrecarga, detailSnapshot, setDescargaFotosError, setDescargandoFotosId],
  );

  const descargarExcelDeTodos = useCallback(async () => {
    setDescargaExcelError(null);
    setDescargandoTodosExcel(true);
    try {
      const exportables = rows.map((row) => {
        const datos =
          (row.historial?.datos_formulario as
            | Record<string, unknown>
            | undefined) ??
          (row.server?.datos_formulario as
            | Record<string, unknown>
            | undefined) ??
          row.precargaSolo?.datos_formulario ??
          {};
        const gps = row.historial?.gps
          ? {
              latitud: row.historial.gps.latitud,
              longitud: row.historial.gps.longitud,
              precision:
                typeof row.historial.gps.precision === 'number' &&
                row.historial.gps.precision > 0
                  ? row.historial.gps.precision
                  : 1,
            }
          : row.server
            ? {
                latitud: row.server.latitud,
                longitud: row.server.longitud,
                precision:
                  typeof row.server.precision === 'number' &&
                  row.server.precision > 0
                    ? row.server.precision
                    : 1,
              }
            : { latitud: 0, longitud: 0, precision: 1 };
        const fotos = (
          row.historial?.fotos ?? row.precargaSolo?.fotos ?? []
        ).filter(
          (f): f is { nombre_archivo: string; data: string } =>
            typeof f?.data === 'string' && f.data.trim() !== '',
        );
        return {
          id_formulario: row.id_formulario,
          id_usuario:
            row.server?.id_usuario ?? row.historial?.id_usuario ?? 'sin_usuario',
          fecha_hora:
            row.server?.fecha_hora ??
            row.historial?.fecha_envio ??
            row.historial?.fecha_hora ??
            row.precargaSolo?.fecha_precarga ??
            new Date().toISOString(),
          gps,
          datos_formulario: datos,
          fotos,
          estado_sincronizacion: 'PENDIENTE' as const,
        };
      });
      await downloadMatrizCaracterizacionBulkXlsx(exportables);
    } catch (e) {
      setDescargaExcelError(
        e instanceof Error
          ? e.message
          : 'No se pudo descargar el Excel consolidado.',
      );
    } finally {
      setDescargandoTodosExcel(false);
    }
  }, [rows, setDescargaExcelError, setDescargandoTodosExcel]);

  const descargarFotosDeTodos = useCallback(async () => {
    setDescargaFotosError(null);
    setDescargandoTodasFotos(true);
    try {
      const exportables = [];
      for (const row of rows) {
        const datos =
          (row.historial?.datos_formulario as
            | Record<string, unknown>
            | undefined) ??
          (row.server?.datos_formulario as
            | Record<string, unknown>
            | undefined) ??
          row.precargaSolo?.datos_formulario ??
          {};
        const gps = row.historial?.gps
          ? {
              latitud: row.historial.gps.latitud,
              longitud: row.historial.gps.longitud,
              precision:
                typeof row.historial.gps.precision === 'number' &&
                row.historial.gps.precision > 0
                  ? row.historial.gps.precision
                  : 1,
            }
          : row.server
            ? {
                latitud: row.server.latitud,
                longitud: row.server.longitud,
                precision:
                  typeof row.server.precision === 'number' &&
                  row.server.precision > 0
                    ? row.server.precision
                    : 1,
              }
            : { latitud: 0, longitud: 0, precision: 1 };
        let fotos = fotosConVisitaDesdeDetalle(
          (row.historial?.fotos ??
            row.precargaSolo?.fotos ??
            []) as FotoSnapshotLike[],
        );
        fotos = await hydrateFotosFromServerIfNeeded(row, fotos);
        exportables.push({
          id_formulario: row.id_formulario,
          id_usuario:
            row.server?.id_usuario ?? row.historial?.id_usuario ?? 'sin_usuario',
          fecha_hora:
            row.server?.fecha_hora ??
            row.historial?.fecha_envio ??
            row.historial?.fecha_hora ??
            row.precargaSolo?.fecha_precarga ??
            new Date().toISOString(),
          gps,
          datos_formulario: datos,
          fotos,
          estado_sincronizacion: 'PENDIENTE' as const,
        });
      }
      await downloadPhotosBulkZip(exportables);
    } catch (e) {
      setDescargaFotosError(
        e instanceof Error
          ? e.message
          : 'No se pudo descargar el ZIP de fotos consolidado.',
      );
    } finally {
      setDescargandoTodasFotos(false);
    }
  }, [rows, setDescargaFotosError, setDescargandoTodasFotos]);

  return {
    descargarExcelDelRegistro,
    descargarFotosDelRegistro,
    descargarExcelDeTodos,
    descargarFotosDeTodos,
  };
};
