import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { RefreshCw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { ConfirmDeleteFormModal } from "@/components/ConfirmDeleteFormModal";
import type { FormularioSnapshot } from "@/components/form/FormularioRespuestaReadOnly";
import { Button } from "@/components/ui/button";
import { ACCESS_TOKEN_KEY } from "@/lib/authStorage";
import { isVisitaNumero } from "@/lib/visitaNumero";
import {
  formatDateTimeNoSeconds,
  formatISODateTimeForDisplay,
} from "@/lib/formatDateTime";
import {
  deleteFormFromApi,
  fetchFormPhotoDataUrl,
  loginApi,
  listFormsFromApi,
  type FormReadItem,
} from "@/services/api";
import { saveFormDraft, type FormDraftV1 } from "@/services/formDraftStorage";
import { db, type FotoForm, type PrecargaForm } from "@/services/db";
import {
  clearAllPrecargas,
  eliminarCopiaLocalFormulario,
  eliminarFormularioDeDispositivo,
  loadHiddenFormIds,
} from "@/services/formLocalDelete";
import { useConnectivityStatus } from "@/hooks/useConnectivityStatus";
import {
  buildFormValuesFromSnapshot,
  getBeneficiarioDisplayName,
  getFechaReferenciaEnvio,
  mapServerFotos,
  mergeFormsWithPrecargas,
  filterDisplayRowsWithPrecarga,
  normalizeTextoBusqueda,
  rowsForOfflineAwareList,
  reconcileLocalStateWithTrustedServerList,
  parseFiltroDiaFin,
  parseFiltroDiaInicio,
  precargaToSnapshot,
  type DisplayRow,
} from "@/services/formHistory";
import { useAuthStore } from "@/store/useAuthStore";
import {
  DETAIL_SOURCE_COLOR,
  DETAIL_SOURCE_LABEL,
  estadoClass,
  fotosConVisitaDesdeDetalle,
  hydrateFotosFromServerIfNeeded,
  previewDetailSourceForRow,
  type DetailSourceKind,
} from "@/pages/formulariosDiligenciados/helpers";
import { FiltersPanel } from "@/pages/formulariosDiligenciados/FiltersPanel";
import { StatusBanners } from "@/pages/formulariosDiligenciados/StatusBanners";
import { FormularioRespuestaReadOnly } from "@/components/form/FormularioRespuestaReadOnly";
import { useFormExports } from "@/pages/formulariosDiligenciados/useFormExports";
import { isBulkDeleteAllPasswordValid } from "@/pages/formulariosDiligenciados/bulkDeleteAllFormularios";

// Helpers moved to pages/formulariosDiligenciados/helpers.ts

export const FormulariosDiligenciadosPage = () => {
  const authUsername = useAuthStore((s) => s.username);
  const online = useConnectivityStatus();
  const navigate = useNavigate();
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [filtroBeneficiario, setFiltroBeneficiario] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const [detailSnapshot, setDetailSnapshot] =
    useState<FormularioSnapshot | null>(null);
  const [detailSource, setDetailSource] = useState<DetailSourceKind | null>(
    null,
  );
  const [detailPrecarga, setDetailPrecarga] = useState<PrecargaForm | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [precargas, setPrecargas] = useState<PrecargaForm[]>([]);
  const [precargaLoadingId, setPrecargaLoadingId] = useState<string | null>(
    null,
  );
  const [eliminandoPrecargaId, setEliminandoPrecargaId] = useState<
    string | null
  >(null);
  const [precargaError, setPrecargaError] = useState<string | null>(null);
  const [descargandoExcelId, setDescargandoExcelId] = useState<string | null>(
    null,
  );
  const [descargaExcelError, setDescargaExcelError] = useState<string | null>(
    null,
  );
  const [descargandoFotosId, setDescargandoFotosId] = useState<string | null>(
    null,
  );
  const [descargaFotosError, setDescargaFotosError] = useState<string | null>(
    null,
  );
  const [descargandoTodosExcel, setDescargandoTodosExcel] = useState(false);
  const [descargandoTodasFotos, setDescargandoTodasFotos] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [eliminarError, setEliminarError] = useState<string | null>(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState<DisplayRow | null>(
    null,
  );
  const [deletePasswordError, setDeletePasswordError] = useState<string | null>(
    null,
  );
  const [modalEliminarTodasPrecargas, setModalEliminarTodasPrecargas] =
    useState(false);
  const [eliminandoTodasPrecargas, setEliminandoTodasPrecargas] =
    useState(false);
  const [modalEliminarTodosFormularios, setModalEliminarTodosFormularios] =
    useState(false);
  const [bulkDeletePasswordError, setBulkDeletePasswordError] = useState<
    string | null
  >(null);
  const [eliminandoTodosFormularios, setEliminandoTodosFormularios] =
    useState(false);

  const precargaMap = useMemo(() => {
    const m = new Map<string, PrecargaForm>();
    for (const p of precargas) {
      m.set(p.id_formulario, p);
    }
    return m;
  }, [precargas]);

  const rowsMostrados = useMemo(
    () =>
      rowsForOfflineAwareList(rows, precargas, {
        connectivityOnline: online,
        navigatorOnLine:
          typeof navigator !== "undefined" ? navigator.onLine : true,
      }),
    [rows, precargas, online],
  );

  const rowsFiltrados = useMemo(() => {
    const q = normalizeTextoBusqueda(filtroBeneficiario);
    const inicio = filtroDesde ? parseFiltroDiaInicio(filtroDesde) : Number.NaN;
    const fin = filtroHasta ? parseFiltroDiaFin(filtroHasta) : Number.NaN;
    return rowsMostrados.filter((r) => {
      if (q) {
        const nombre = normalizeTextoBusqueda(getBeneficiarioDisplayName(r));
        if (!nombre.includes(q)) {
          return false;
        }
      }
      if (!Number.isNaN(inicio) || !Number.isNaN(fin)) {
        const ref = getFechaReferenciaEnvio(r);
        if (Number.isNaN(ref)) {
          return false;
        }
        if (!Number.isNaN(inicio) && ref < inicio) {
          return false;
        }
        if (!Number.isNaN(fin) && ref > fin) {
          return false;
        }
      }
      return true;
    });
  }, [rowsMostrados, filtroBeneficiario, filtroDesde, filtroHasta]);

  /** Total en servidor; `sin_red` = sin Wi‑Fi/datos: no se muestra ningún mensaje en UI. */
  const contadorServidor = useMemo(() => {
    const navOnLine =
      typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!online || !navOnLine) {
      return { estado: "sin_red" as const };
    }
    const token =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(ACCESS_TOKEN_KEY)
        : null;
    if (!token) {
      return { estado: "sin_sesion" as const };
    }
    if (remoteError) {
      return { estado: "error_listado" as const };
    }
    if (!remoteLoaded) {
      return { estado: "cargando" as const };
    }
    const n = rows.filter((r) => r.onServer).length;
    return { estado: "listo" as const, count: n };
  }, [online, remoteLoaded, remoteError, rows]);

  const loadList = useCallback(async (): Promise<DisplayRow[]> => {
    setRemoteError(null);

    const precargasLocal = await db.precargas.toArray();
    const historialLocal = await db.historialFormularios.toArray();

    const token =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(ACCESS_TOKEN_KEY)
        : null;

    if (!token) {
      setRemoteLoaded(false);
      setPrecargas(precargasLocal);
      const mergedLocal = mergeFormsWithPrecargas(
        [],
        historialLocal,
        precargasLocal,
      );
      setRows(mergedLocal);
      return mergedLocal;
    }

    let visibleServerItems: FormReadItem[] = [];
    try {
      const serverItems = await listFormsFromApi(500);
      const hiddenIds = await loadHiddenFormIds();
      visibleServerItems = serverItems.filter(
        (it) => !hiddenIds.has(it.id_formulario),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/\b401\b|forms_list_401/i.test(msg)) {
        navigate("/login", { replace: true });
        return [];
      }
      setRemoteError(msg);
      setRemoteLoaded(true);
      setPrecargas(precargasLocal);
      const mergedFull = mergeFormsWithPrecargas(
        [],
        historialLocal,
        precargasLocal,
      );
      const mergedOffline = filterDisplayRowsWithPrecarga(
        mergedFull,
        precargasLocal,
      );
      setRows(mergedOffline);
      return mergedOffline;
    }

    const reconciled = reconcileLocalStateWithTrustedServerList(
      historialLocal,
      visibleServerItems,
      precargasLocal,
    );

    await Promise.all([
      ...reconciled.staleEnviadoIds.map((id) =>
        db.historialFormularios.delete(id).catch(() => undefined),
      ),
      ...reconciled.orphanPrecargaIds.map((id) =>
        db.precargas.delete(id).catch(() => undefined),
      ),
    ]);

    const precargasFresh = await db.precargas.toArray();
    const historialFresh = await db.historialFormularios.toArray();

    setPrecargas(precargasFresh);
    const merged = mergeFormsWithPrecargas(
      visibleServerItems,
      historialFresh,
      precargasFresh,
    );
    setRows(merged);
    setRemoteLoaded(true);
    return merged;
  }, [navigate]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const wasOnlineRef = useRef(online);
  useEffect(() => {
    if (online && !wasOnlineRef.current) {
      void loadList();
    }
    wasOnlineRef.current = online;
  }, [online, loadList]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    const stillExists = rowsFiltrados.some(
      (r) => r.id_formulario === selectedId,
    );
    if (!stillExists) {
      setSelectedId(null);
      setDetailSnapshot(null);
      setDetailSource(null);
      setDetailPrecarga(null);
    }
  }, [rowsFiltrados, selectedId]);

  const selectRow = useCallback(
    async (row: DisplayRow, opts?: { refreshOnly?: boolean }) => {
      const refreshOnly = opts?.refreshOnly === true;
      const isStillThisRow = () => selectedIdRef.current === row.id_formulario;

      if (!refreshOnly) {
        selectedIdRef.current = row.id_formulario;
        setSelectedId(row.id_formulario);
        setDetailSnapshot(null);
        setDetailSource(null);
        setDetailPrecarga(null);
      }
      setDetailLoading(true);
      try {
        const precargaLocal =
          precargaMap.get(row.id_formulario) ?? row.precargaSolo ?? null;

        const queued = await db.formularios.get(row.id_formulario);
        if (!isStillThisRow()) {
          return;
        }
        if (queued) {
          setDetailPrecarga(precargaLocal);
          setDetailSnapshot({
            datos_formulario: queued.datos_formulario ?? {},
            gps: queued.gps ?? null,
            fotos: queued.fotos ?? [],
          });
          setDetailSource("live");
          return;
        }

        if (row.server) {
          setDetailPrecarga(precargaLocal);
          const baseFotos = mapServerFotos(
            row.server.id_formulario,
            row.server.fotos ?? [],
          );
          const fotos: FotoForm[] = [];
          for (const foto of baseFotos) {
            if (foto.serverFormId == null || foto.serverIndex == null) {
              continue;
            }
            try {
              const data = await fetchFormPhotoDataUrl(
                foto.serverFormId,
                foto.serverIndex,
              );
              if (!isStillThisRow()) {
                return;
              }
              fotos.push({
                nombre_archivo: foto.nombre_archivo,
                data,
                ...(isVisitaNumero(foto.visita) ? { visita: foto.visita } : {}),
              });
            } catch {
              // omitimos fotos que fallen al descargar
            }
          }
          if (!isStillThisRow()) {
            return;
          }
          setDetailSnapshot({
            datos_formulario: (row.server.datos_formulario ?? {}) as Record<
              string,
              unknown
            >,
            gps: {
              latitud: row.server.latitud,
              longitud: row.server.longitud,
              precision: row.server.precision ?? null,
            },
            fotos,
          });
          setDetailSource("server");
          return;
        }

        if (precargaLocal) {
          if (!isStillThisRow()) {
            return;
          }
          setDetailPrecarga(precargaLocal);
          setDetailSnapshot(precargaToSnapshot(precargaLocal));
          setDetailSource("precarga");
          return;
        }

        if (row.historial) {
          setDetailPrecarga(precargaLocal);
          const h = row.historial;
          let fotos = fotosConVisitaDesdeDetalle(h.fotos ?? []);
          fotos = await hydrateFotosFromServerIfNeeded(row, fotos);
          if (!isStillThisRow()) {
            return;
          }
          setDetailSnapshot({
            datos_formulario: h.datos_formulario ?? {},
            gps: h.gps ?? null,
            fotos,
          });
          setDetailSource("historial");
          return;
        }

        if (!isStillThisRow()) {
          return;
        }
        setDetailSnapshot(null);
        setDetailSource(null);
        setDetailPrecarga(null);
      } finally {
        if (isStillThisRow()) {
          setDetailLoading(false);
        }
      }
    },
    [precargaMap],
  );

  const toggleOrSelectRow = useCallback(
    (row: DisplayRow) => {
      if (selectedId === row.id_formulario) {
        selectedIdRef.current = null;
        setSelectedId(null);
        setDetailSnapshot(null);
        setDetailSource(null);
        setDetailPrecarga(null);
        setDetailLoading(false);
        return;
      }
      void selectRow(row);
    },
    [selectedId, selectRow],
  );

  const precargarRow = useCallback(
    async (row: DisplayRow) => {
      if (precargaLoadingId === row.id_formulario) {
        return;
      }
      setPrecargaError(null);
      if (!navigator.onLine) {
        setPrecargaError("Necesitás conexión para precargar este formulario.");
        return;
      }
      const token =
        typeof localStorage !== "undefined"
          ? localStorage.getItem(ACCESS_TOKEN_KEY)
          : null;
      if (!token) {
        setPrecargaError("Iniciá sesión para precargar formularios.");
        return;
      }
      if (!row.server && !row.historial) {
        setPrecargaError("No hay datos disponibles para precargar.");
        return;
      }

      setPrecargaLoadingId(row.id_formulario);
      try {
        let snapshot: FormularioSnapshot | null = null;
        let failedFotos = 0;
        if (row.server) {
          const baseFotos = mapServerFotos(
            row.server.id_formulario,
            row.server.fotos ?? [],
          );
          const fotos: Array<{
            nombre_archivo: string;
            data: string;
            visita?: 1 | 2 | 3 | 4;
          }> = [];
          for (const foto of baseFotos) {
            if (foto.serverFormId == null || foto.serverIndex == null) {
              continue;
            }
            try {
              const data = await fetchFormPhotoDataUrl(
                foto.serverFormId,
                foto.serverIndex,
              );
              fotos.push({
                nombre_archivo: foto.nombre_archivo,
                data,
                ...(isVisitaNumero(foto.visita) ? { visita: foto.visita } : {}),
              });
            } catch {
              failedFotos += 1;
            }
          }
          snapshot = {
            datos_formulario: (row.server.datos_formulario ?? {}) as Record<
              string,
              unknown
            >,
            gps: {
              latitud: row.server.latitud,
              longitud: row.server.longitud,
              precision: row.server.precision ?? null,
            },
            fotos,
          };
        } else if (row.historial) {
          snapshot = {
            datos_formulario: row.historial.datos_formulario ?? {},
            gps: row.historial.gps ?? null,
            fotos: row.historial.fotos ?? [],
          };
        }

        if (!snapshot) {
          setPrecargaError("No se pudo preparar la precarga.");
          return;
        }

        const fotosPrecarga = (snapshot.fotos ?? [])
          .map((f) => {
            if (!f.data) {
              return null;
            }
            const base = {
              nombre_archivo: f.nombre_archivo,
              data: f.data,
            };
            if (isVisitaNumero(f.visita)) {
              return { ...base, visita: f.visita };
            }
            return base;
          })
          .filter(
            (
              f,
            ): f is {
              nombre_archivo: string;
              data: string;
              visita?: 1 | 2 | 3 | 4;
            } => f !== null,
          );

        const modoPrecarga =
          row.historial?.modo_coordenadas === "manual"
            ? "manual"
            : "automatico";

        const precarga: PrecargaForm = {
          id_formulario: row.id_formulario,
          fecha_precarga: new Date().toISOString(),
          modo_coordenadas: modoPrecarga,
          datos_formulario: snapshot.datos_formulario ?? {},
          gps: snapshot.gps ?? null,
          fotos: fotosPrecarga,
        };

        await db.precargas.put(precarga);
        await loadList();
        if (selectedId === row.id_formulario) {
          setDetailPrecarga(precarga);
          setDetailSnapshot(precargaToSnapshot(precarga));
        }
        if (failedFotos > 0) {
          setPrecargaError(
            `Se precargaron los datos, pero fallaron ${failedFotos} foto(s).`,
          );
        }
      } catch (e) {
        setPrecargaError(
          e instanceof Error
            ? e.message
            : "No se pudo precargar el formulario.",
        );
      } finally {
        setPrecargaLoadingId(null);
      }
    },
    [loadList, precargaLoadingId, selectedId],
  );

  const eliminarPrecargaRow = useCallback(
    async (row: DisplayRow) => {
      if (eliminandoPrecargaId === row.id_formulario) {
        return;
      }
      if (!navigator.onLine) {
        setPrecargaError(
          "Necesitás conexión para eliminar la copia local de este formulario.",
        );
        return;
      }
      const tieneCopiaLocal =
        precargaMap.has(row.id_formulario) || !!row.historial;
      if (!tieneCopiaLocal) {
        return;
      }
      setEliminandoPrecargaId(row.id_formulario);
      setPrecargaError(null);
      try {
        await eliminarCopiaLocalFormulario(row.id_formulario);
        const visible = await loadList();
        if (selectedId === row.id_formulario) {
          const fresh = visible.find(
            (r) => r.id_formulario === row.id_formulario,
          );
          if (fresh) {
            await selectRow(fresh, { refreshOnly: true });
          } else {
            setSelectedId(null);
            setDetailSnapshot(null);
            setDetailSource(null);
            setDetailPrecarga(null);
          }
        }
      } catch (e) {
        setPrecargaError(
          e instanceof Error
            ? e.message
            : "No se pudo eliminar la copia local de este formulario.",
        );
      } finally {
        setEliminandoPrecargaId(null);
      }
    },
    [eliminandoPrecargaId, loadList, precargaMap, selectRow, selectedId],
  );

  const confirmarEliminarTodasPrecargas = useCallback(async () => {
    if (eliminandoTodasPrecargas || precargas.length === 0) {
      return;
    }
    if (!navigator.onLine) {
      setPrecargaError(
        "Necesitás conexión a internet para quitar las precargas.",
      );
      setModalEliminarTodasPrecargas(false);
      return;
    }
    setEliminandoTodasPrecargas(true);
    setPrecargaError(null);
    try {
      await clearAllPrecargas();
      setModalEliminarTodasPrecargas(false);
      const visible = await loadList();
      if (selectedId) {
        const fresh = visible.find((r) => r.id_formulario === selectedId);
        if (fresh) {
          await selectRow(fresh, { refreshOnly: true });
        } else {
          setSelectedId(null);
          setDetailSnapshot(null);
          setDetailSource(null);
          setDetailPrecarga(null);
        }
      }
    } catch (e) {
      setPrecargaError(
        e instanceof Error
          ? e.message
          : "No se pudieron eliminar las copias precargadas.",
      );
    } finally {
      setEliminandoTodasPrecargas(false);
    }
  }, [
    eliminandoTodasPrecargas,
    precargas.length,
    loadList,
    selectedId,
    selectRow,
  ]);

  const usarComoBase = useCallback(
    async (row: DisplayRow) => {
      if (!detailSnapshot) {
        return;
      }
      const formValues = buildFormValuesFromSnapshot(detailSnapshot);
      const sourceFotos = detailPrecarga?.fotos ?? detailSnapshot.fotos ?? [];
      let fotos = fotosConVisitaDesdeDetalle(sourceFotos);
      fotos = await hydrateFotosFromServerIfNeeded(row, fotos);
      const gps = detailSnapshot.gps
        ? {
            latitud: detailSnapshot.gps.latitud,
            longitud: detailSnapshot.gps.longitud,
            precision: detailSnapshot.gps.precision ?? 0,
          }
        : null;
      const draft: FormDraftV1 = {
        v: 1,
        savedAt: new Date().toISOString(),
        // Reutilizar el mismo id para editar el formulario existente (no clonar).
        formId: row.id_formulario,
        originalFechaHora:
          row.server?.fecha_hora ??
          row.historial?.fecha_envio ??
          row.historial?.fecha_hora ??
          null,
        modoCoordenadas:
          (detailPrecarga?.modo_coordenadas ??
            row.historial?.modo_coordenadas) === "manual"
            ? "manual"
            : "automatico",
        formValues,
        fotos,
        gps,
      };
      saveFormDraft(authUsername ?? "", draft);
      navigate("/formulario", { state: { fromEdit: true } });
    },
    [authUsername, detailPrecarga, detailSnapshot, navigate],
  );

  const {
    descargarExcelDelRegistro,
    descargarFotosDelRegistro,
    descargarExcelDeTodos,
    descargarFotosDeTodos,
  } = useFormExports({
    rows: rowsMostrados,
    detailSnapshot,
    detailPrecarga,
    setDescargaExcelError,
    setDescargaFotosError,
    setDescargandoExcelId,
    setDescargandoFotosId,
    setDescargandoTodosExcel,
    setDescargandoTodasFotos,
  });

  const solicitarEliminar = useCallback((row: DisplayRow) => {
    setEliminarError(null);
    setDeletePasswordError(null);
    if (!navigator.onLine) {
      setEliminarError(
        "Solo podés eliminar formularios con conexión a internet.",
      );
      return;
    }
    setPendingDeleteRow(row);
  }, []);

  const ejecutarEliminacionConfirmada = useCallback(
    async (password: string) => {
      const row = pendingDeleteRow;
      if (!row) {
        return;
      }
      setEliminarError(null);
      setDeletePasswordError(null);
      const pass = password.trim();
      if (!pass) {
        setDeletePasswordError("Ingresá tu contraseña para continuar.");
        return;
      }
      if (!navigator.onLine) {
        setEliminarError(
          "Perdiste la conexión. Volvé a conectarte para eliminar.",
        );
        return;
      }
      const token =
        typeof localStorage !== "undefined"
          ? localStorage.getItem(ACCESS_TOKEN_KEY)
          : null;
      if (!authUsername) {
        setDeletePasswordError(
          "No hay una sesión activa para validar contraseña.",
        );
        return;
      }
      try {
        await loginApi(authUsername, pass);
      } catch {
        setDeletePasswordError("Contraseña incorrecta.");
        return;
      }
      const puedeBorrarEnServidor = row.onServer && !!token;
      setEliminandoId(row.id_formulario);
      try {
        if (puedeBorrarEnServidor) {
          try {
            await deleteFormFromApi(row.id_formulario);
          } catch (e) {
            setEliminarError(
              e instanceof Error
                ? e.message
                : "No se pudo borrar en el servidor.",
            );
            return;
          }
        }
        await eliminarFormularioDeDispositivo(row.id_formulario);
        if (selectedId === row.id_formulario) {
          setSelectedId(null);
          setDetailSnapshot(null);
          setDetailPrecarga(null);
        }
        await loadList();
        setPendingDeleteRow(null);
      } catch (e) {
        setEliminarError(
          e instanceof Error ? e.message : "No se pudo eliminar el registro.",
        );
      } finally {
        setEliminandoId(null);
      }
    },
    [authUsername, loadList, pendingDeleteRow, selectedId],
  );

  const cancelarEliminacionPendiente = useCallback(() => {
    if (eliminandoId) {
      return;
    }
    setDeletePasswordError(null);
    setPendingDeleteRow(null);
  }, [eliminandoId]);

  const hayFormulariosEnServidor = useMemo(
    () => rowsMostrados.some((r) => r.onServer),
    [rowsMostrados],
  );

  const solicitarEliminarTodosFormularios = useCallback(() => {
    setEliminarError(null);
    setBulkDeletePasswordError(null);
    if (!navigator.onLine) {
      setEliminarError(
        "Solo podés eliminar formularios con conexión a internet.",
      );
      return;
    }
    if (rowsMostrados.length === 0) {
      return;
    }
    const token =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(ACCESS_TOKEN_KEY)
        : null;
    if (hayFormulariosEnServidor && !token) {
      setEliminarError(
        "Iniciá sesión para poder borrar los formularios que están en el servidor.",
      );
      return;
    }
    setModalEliminarTodosFormularios(true);
  }, [hayFormulariosEnServidor, rowsMostrados.length]);

  const cancelarEliminarTodosFormularios = useCallback(() => {
    if (eliminandoTodosFormularios) {
      return;
    }
    setBulkDeletePasswordError(null);
    setModalEliminarTodosFormularios(false);
  }, [eliminandoTodosFormularios]);

  const ejecutarEliminarTodosFormularios = useCallback(
    async (password: string) => {
      setEliminarError(null);
      setBulkDeletePasswordError(null);
      const pass = password.trim();
      if (!isBulkDeleteAllPasswordValid(pass)) {
        setBulkDeletePasswordError("Contraseña incorrecta.");
        return;
      }
      if (!navigator.onLine) {
        setEliminarError(
          "Perdiste la conexión. Volvé a conectarte para eliminar.",
        );
        return;
      }
      const token =
        typeof localStorage !== "undefined"
          ? localStorage.getItem(ACCESS_TOKEN_KEY)
          : null;
      const snapshot = [...rowsMostrados];
      const requiereToken = snapshot.some((r) => r.onServer);
      if (requiereToken && !token) {
        setBulkDeletePasswordError(
          "No hay sesión activa para borrar en el servidor.",
        );
        return;
      }
      setEliminandoTodosFormularios(true);
      try {
        for (const row of snapshot) {
          if (row.onServer && token) {
            try {
              await deleteFormFromApi(row.id_formulario);
            } catch (e) {
              setEliminarError(
                e instanceof Error
                  ? e.message
                  : "No se pudo borrar un formulario en el servidor. Reintentá con «Recargar».",
              );
              await loadList();
              return;
            }
          }
          await eliminarFormularioDeDispositivo(row.id_formulario);
        }
        setSelectedId(null);
        setDetailSnapshot(null);
        setDetailPrecarga(null);
        setDetailSource(null);
        setDetailLoading(false);
        setModalEliminarTodosFormularios(false);
        await loadList();
      } catch (e) {
        setEliminarError(
          e instanceof Error
            ? e.message
            : "No se pudo completar el borrado masivo.",
        );
        await loadList();
      } finally {
        setEliminandoTodosFormularios(false);
      }
    },
    [loadList, rowsMostrados],
  );

  const deleteModalDescription: ReactNode = useMemo(() => {
    if (!pendingDeleteRow) {
      return null;
    }
    const token =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(ACCESS_TOKEN_KEY)
        : null;
    const borraEnServidor = pendingDeleteRow.onServer && !!token;
    if (borraEnServidor) {
      return (
        <>
          <p>
            Este formulario está guardado en el servidor. Con tu sesión activa
            también se borrará allí la base de datos y las fotos asociadas.
          </p>
          <p className="mt-2">
            Además se quita la copia local (historial, precarga y cola) en este
            equipo. Esta acción no se puede deshacer.
          </p>
        </>
      );
    }
    return (
      <>
        <p>
          Solo se quitará la copia en este equipo (historial, precarga y
          formularios en cola).
        </p>
        <p className="mt-2">
          {pendingDeleteRow.onServer
            ? "Para borrar también en el servidor iniciá sesión y repetí la eliminación."
            : "Esta acción no se puede deshacer."}
        </p>
      </>
    );
  }, [pendingDeleteRow]);

  useEffect(() => {
    if (!modalEliminarTodasPrecargas) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !eliminandoTodasPrecargas) {
        setModalEliminarTodasPrecargas(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [modalEliminarTodasPrecargas, eliminandoTodasPrecargas]);

  useEffect(() => {
    if (!online && modalEliminarTodasPrecargas) {
      setModalEliminarTodasPrecargas(false);
    }
  }, [online, modalEliminarTodasPrecargas]);

  useEffect(() => {
    if (!online && modalEliminarTodosFormularios) {
      setModalEliminarTodosFormularios(false);
      setBulkDeletePasswordError(null);
    }
  }, [online, modalEliminarTodosFormularios]);

  const bulkDeleteModalDescription: ReactNode = useMemo(
    () => (
      <>
        <p>
          Se van a eliminar <strong>todos</strong> los formularios de esta lista
          en este dispositivo
          {hayFormulariosEnServidor
            ? " y, si iniciaste sesión, también en el servidor"
            : ""}
          . Las fotos asociadas en servidor se borran con cada formulario. Esta
          acción no se puede deshacer.
        </p>
        <p className="mt-2 text-sm text-slate-700">
          Ingresá la contraseña de confirmación indicada por el equipo para
          continuar.
        </p>
      </>
    ),
    [hayFormulariosEnServidor],
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top,_#e2f2ee_0,_#f6f7f5_45%,_#f6f7f5_100%)] px-3 py-6 text-slate-900 sm:px-4 sm:py-10">
      <div className="mx-auto w-full min-w-0 max-w-5xl overflow-x-clip">
        <header className="mb-4 flex min-w-0 flex-col gap-3 overflow-x-clip sm:mb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">
              NoSignal
            </p>
            <h1 className="mt-1 text-2xl font-semibold sm:mt-2 sm:text-3xl">
              Formularios diligenciados
            </h1>
            {contadorServidor.estado !== "sin_red" ? (
              <p className="mt-2 max-w-xl text-sm leading-snug text-slate-600">
                {contadorServidor.estado === "sin_sesion" ? (
                  <>
                    <span className="font-medium text-slate-700">
                      En el servidor:
                    </span>{" "}
                    iniciá sesión para ver el total de formularios guardados allí.
                  </>
                ) : contadorServidor.estado === "error_listado" ? (
                  <>
                    <span className="font-medium text-slate-700">
                      En el servidor:
                    </span>{" "}
                    no se pudo obtener el total (revisá la conexión o reintentá
                    con «Recargar»).
                  </>
                ) : contadorServidor.estado === "cargando" ? (
                  <>
                    <span className="font-medium text-slate-700">
                      En el servidor:
                    </span>{" "}
                    consultando…
                  </>
                ) : contadorServidor.count === 1 ? (
                  <>
                    <span className="font-medium text-slate-700">
                      En el servidor:
                    </span>{" "}
                    hay{" "}
                    <span className="font-semibold tabular-nums text-teal-800">
                      1
                    </span>{" "}
                    formulario diligenciado.
                  </>
                ) : (
                  <>
                    <span className="font-medium text-slate-700">
                      En el servidor:
                    </span>{" "}
                    hay{" "}
                    <span className="font-semibold tabular-nums text-teal-800">
                      {contadorServidor.count}
                    </span>{" "}
                    formularios diligenciados.
                  </>
                )}
              </p>
            ) : null}
          </div>
          <div className="page-toolbar w-full shrink-0 lg:max-w-md xl:max-w-lg">
            <div className="page-toolbar-icons">
              <Button variant="outline" size="sm" asChild>
                <Link to="/inicio">Regresar</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => window.location.reload()}
                className="text-slate-800"
                aria-label="Recargar página"
                title="Recargar"
              >
                <RefreshCw size={16} strokeWidth={2} aria-hidden />
              </Button>
            </div>
            <div className="page-toolbar-actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!navigator.onLine) {
                    return;
                  }
                  setPrecargaError(null);
                  setModalEliminarTodasPrecargas(true);
                }}
                disabled={
                  !online ||
                  precargas.length === 0 ||
                  eliminandoTodasPrecargas ||
                  eliminandoPrecargaId !== null
                }
                title={!online ? "Requiere conexión a internet" : undefined}
                className="toolbar-btn toolbar-full-row border-amber-200 text-amber-950 hover:bg-amber-50"
              >
                {eliminandoTodasPrecargas
                  ? "Quitando precargas…"
                  : precargas.length === 0
                    ? "Quitar todas las precargas"
                    : `Quitar todas las precargas (${precargas.length})`}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void descargarExcelDeTodos()}
                disabled={descargandoTodosExcel || !online}
                className="toolbar-btn"
                title={
                  !online
                    ? "Requiere conexión a internet"
                    : "Descargar Excel de todos los formularios"
                }
              >
                {descargandoTodosExcel
                  ? "Descargando Excel…"
                  : "Excel (todos)"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void descargarFotosDeTodos()}
                disabled={descargandoTodasFotos || !online}
                className="toolbar-btn"
                title={
                  !online
                    ? "Requiere conexión a internet"
                    : "Descargar fotos de todos los formularios"
                }
              >
                {descargandoTodasFotos
                  ? "Descargando fotos…"
                  : "Fotos (todos)"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => solicitarEliminarTodosFormularios()}
                disabled={
                  !online ||
                  rowsMostrados.length === 0 ||
                  !!pendingDeleteRow ||
                  eliminandoTodosFormularios ||
                  (hayFormulariosEnServidor &&
                    (typeof localStorage === "undefined" ||
                      !localStorage.getItem(ACCESS_TOKEN_KEY)))
                }
                title={
                  !online
                    ? "Requiere conexión a internet"
                    : hayFormulariosEnServidor &&
                        (typeof localStorage === "undefined" ||
                          !localStorage.getItem(ACCESS_TOKEN_KEY))
                      ? "Iniciá sesión para borrar formularios del servidor"
                      : undefined
                }
                className="toolbar-btn toolbar-full-row border-rose-300 text-rose-900 hover:bg-rose-50"
              >
                {eliminandoTodosFormularios
                  ? "Eliminando…"
                  : "Eliminar todos los formularios"}
              </Button>
            </div>
          </div>
        </header>

        {eliminarError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-900">
            {eliminarError}
          </div>
        ) : null}

        <StatusBanners
          precargaError={precargaError}
          descargaFotosError={descargaFotosError}
          remoteLoaded={remoteLoaded}
          remoteError={remoteError}
          online={online}
        />

        {rowsMostrados.length > 0 ? (
          <FiltersPanel
            filtroBeneficiario={filtroBeneficiario}
            filtroDesde={filtroDesde}
            filtroHasta={filtroHasta}
            onChangeBeneficiario={setFiltroBeneficiario}
            onChangeDesde={setFiltroDesde}
            onChangeHasta={setFiltroHasta}
            onClear={() => {
              setFiltroDesde("");
              setFiltroHasta("");
              setFiltroBeneficiario("");
            }}
            rowsTotal={rowsMostrados.length}
            rowsFiltered={rowsFiltrados.length}
            hasActiveFilters={
              !!(
                filtroDesde ||
                filtroHasta ||
                normalizeTextoBusqueda(filtroBeneficiario)
              )
            }
          />
        ) : null}

        {rowsMostrados.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 text-sm text-slate-600 shadow-sm">
            No hay registros en el historial local ni en el servidor (con tu
            sesión actual).
          </div>
        ) : rowsFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 text-sm text-slate-600 shadow-sm">
            Ningún registro coincide con los filtros (nombre del beneficiario o
            rango de fechas). Prueba otro texto, ampliar fechas o usar «Limpiar
            filtros».
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {rowsFiltrados.map((row) => {
              const isOpen = selectedId === row.id_formulario;
              const h = row.historial;
              const precarga = precargaMap.get(row.id_formulario) ?? null;
              const precargado = !!precarga;
              const nombreBenef = getBeneficiarioDisplayName(row);
              const tituloUsuario = nombreBenef || "No diligenciado";
              const refTs = getFechaReferenciaEnvio(row);
              const tituloFechaLabel = formatDateTimeNoSeconds(refTs);
              const ultimaActualizacionIso =
                row.server?.fecha_actualizacion ??
                row.historial?.fecha_actualizacion ??
                row.historial?.fecha_hora ??
                row.server?.fecha_hora ??
                row.precargaSolo?.fecha_precarga;
              const ultimaActualizacionLabel = formatISODateTimeForDisplay(
                ultimaActualizacionIso,
              );
              const effectiveDetailSource: DetailSourceKind =
                isOpen && detailSource != null
                  ? detailSource
                  : previewDetailSourceForRow(row, precarga);
              return (
                <article
                  key={row.id_formulario}
                  className={`min-w-0 overflow-x-clip rounded-xl border bg-white/90 shadow-sm transition-shadow sm:rounded-2xl ${
                    isOpen
                      ? "border-teal-400 ring-2 ring-teal-200"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex min-w-0 items-stretch gap-1.5 overflow-x-clip p-1.5 sm:gap-3 sm:p-3">
                    <button
                      type="button"
                      onClick={() => toggleOrSelectRow(row)}
                      className="flex min-w-0 flex-1 items-start justify-between gap-2 overflow-x-clip rounded-lg p-1.5 text-left sm:gap-3 sm:rounded-xl sm:p-3"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          {row.onServer ? (
                            <span className="rounded bg-emerald-100 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-900 sm:rounded-md sm:px-2 sm:py-0.5 sm:text-[10px]">
                              Servidor
                            </span>
                          ) : null}
                          {row.precargaSolo ? (
                            <span className="rounded bg-indigo-100 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-indigo-900 sm:rounded-md sm:px-2 sm:py-0.5 sm:text-[10px]">
                              Precarga offline
                            </span>
                          ) : null}
                          {!row.onServer && !row.precargaSolo ? (
                            <span className="rounded bg-slate-200 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-slate-800 sm:rounded-md sm:px-2 sm:py-0.5 sm:text-[10px]">
                              Solo este equipo
                            </span>
                          ) : null}
                          {precargado ? (
                            <span className="rounded bg-indigo-100 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-indigo-900 sm:rounded-md sm:px-2 sm:py-0.5 sm:text-[10px]">
                              Precargado
                            </span>
                          ) : null}
                          <span
                            className={`rounded px-1.5 py-px text-[9px] font-semibold sm:rounded-md sm:px-2 sm:py-0.5 sm:text-[10px] ${DETAIL_SOURCE_COLOR[effectiveDetailSource]}`}
                            title="Fuente usada para el detalle del formulario al expandir"
                          >
                            Origen: {DETAIL_SOURCE_LABEL[effectiveDetailSource]}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-snug text-slate-900 sm:text-base sm:leading-normal">
                          Beneficiario: {tituloUsuario}
                        </p>
                        <p className="text-xs leading-snug text-slate-600 sm:text-sm sm:leading-normal">
                          Fecha de envío del formulario: {tituloFechaLabel}
                        </p>
                        <p className="text-xs leading-snug text-slate-600 sm:text-sm sm:leading-normal">
                          Última actualización: {ultimaActualizacionLabel}
                        </p>
                        {h ? (
                          <p
                            className={`text-xs font-semibold leading-snug sm:text-sm sm:leading-normal ${estadoClass[h.estado]}`}
                          >
                            Estado en este dispositivo: {h.estado}
                          </p>
                        ) : row.onServer ? (
                          <p className="text-xs font-semibold leading-snug text-emerald-700 sm:text-sm sm:leading-normal">
                            Sincronizado en servidor
                          </p>
                        ) : row.precargaSolo ? (
                          <p className="text-xs font-semibold leading-snug text-indigo-800 sm:text-sm sm:leading-normal">
                            Copia guardada en este dispositivo para uso sin red
                          </p>
                        ) : null}
                        {h?.ultimo_error ? (
                          <p className="text-xs leading-snug text-rose-700 sm:text-sm sm:leading-normal">
                            Error: {h.ultimo_error}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`mt-0.5 shrink-0 self-start rounded-md border px-1.5 py-0.5 text-[11px] font-medium sm:mt-1 sm:rounded-lg sm:px-2 sm:py-1 sm:text-xs ${
                          isOpen
                            ? "border-teal-600 bg-teal-50 text-teal-800"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {isOpen ? "Cerrar" : "Ver formulario"}
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!online || eliminandoId === row.id_formulario}
                      title={
                        !online ? "Requiere conexión a internet" : undefined
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        solicitarEliminar(row);
                      }}
                      className="h-8 shrink-0 self-center border-rose-200 px-2 text-xs text-rose-800 hover:bg-rose-50 sm:h-9 sm:px-3 sm:text-sm"
                    >
                      {eliminandoId === row.id_formulario ? "…" : "Eliminar"}
                    </Button>
                  </div>

                  {isOpen ? (
                    <div className="border-t border-slate-200 bg-[linear-gradient(180deg,_#fafcfb_0%,_#fff_12%)] px-3 py-3 sm:px-4 sm:py-5">
                      {detailLoading ? (
                        <p className="text-center text-sm text-slate-600">
                          Cargando…
                        </p>
                      ) : detailSnapshot ? (
                        <div className="space-y-3 sm:space-y-4">
                          <div className="flex items-center justify-end">
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold ${DETAIL_SOURCE_COLOR[effectiveDetailSource]}`}
                            >
                              Origen:{" "}
                              {DETAIL_SOURCE_LABEL[effectiveDetailSource]}
                            </span>
                          </div>
                          <FormularioRespuestaReadOnly
                            snapshot={detailSnapshot}
                          />
                          <div className="page-actions-bar justify-start">
                            {(() => {
                              const fotosDetalle =
                                detailPrecarga?.fotos ??
                                detailSnapshot.fotos ??
                                [];
                              const fotosConData =
                                fotosConVisitaDesdeDetalle(fotosDetalle)
                                  .length > 0;
                              const hayFotosServidor =
                                (row.server?.fotos?.length ?? 0) > 0;
                              const canDownloadPhotos =
                                !detailLoading &&
                                (fotosConData || hayFotosServidor);
                              return (
                                <>
                                  {row.server ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => void precargarRow(row)}
                                      disabled={
                                        precargaLoadingId === row.id_formulario
                                      }
                                      className="h-auto min-w-0 whitespace-normal"
                                    >
                                      {precargaMap.has(row.id_formulario)
                                        ? "Actualizar precarga"
                                        : "Precargar para visita"}
                                    </Button>
                                  ) : null}
                                  {online &&
                                  (precargaMap.has(row.id_formulario) ||
                                    row.historial) ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() =>
                                        void eliminarPrecargaRow(row)
                                      }
                                      disabled={
                                        precargaLoadingId ===
                                          row.id_formulario ||
                                        eliminandoPrecargaId ===
                                          row.id_formulario
                                      }
                                      className="h-auto min-w-0 whitespace-normal border-rose-200 text-rose-800 hover:bg-rose-50"
                                    >
                                      {eliminandoPrecargaId ===
                                      row.id_formulario
                                        ? "Eliminando…"
                                        : precargaMap.has(row.id_formulario)
                                          ? "Eliminar precarga"
                                          : "Eliminar datos locales"}
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      void usarComoBase(row);
                                    }}
                                    className="h-auto min-w-0 whitespace-normal"
                                  >
                                    Editar este formulario
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                      void descargarExcelDelRegistro(row)
                                    }
                                    disabled={
                                      detailLoading ||
                                      descargandoExcelId === row.id_formulario
                                    }
                                    className="h-auto min-w-0 whitespace-normal"
                                  >
                                    {descargandoExcelId === row.id_formulario
                                      ? "Descargando Excel…"
                                      : "Descargar Excel"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                      void descargarFotosDelRegistro(row)
                                    }
                                    disabled={
                                      !canDownloadPhotos ||
                                      descargandoFotosId === row.id_formulario
                                    }
                                    className="h-auto min-w-0 whitespace-normal"
                                  >
                                    {descargandoFotosId === row.id_formulario
                                      ? "Descargando fotos…"
                                      : "Descargar fotos"}
                                  </Button>
                                </>
                              );
                            })()}
                            {precargaMap.has(row.id_formulario) ? (
                              <span className="text-xs text-slate-500">
                                Precargado el{" "}
                                {formatDateTimeNoSeconds(
                                  Date.parse(
                                    precargaMap.get(row.id_formulario)
                                      ?.fecha_precarga ?? "",
                                  ),
                                )}
                              </span>
                            ) : null}
                          </div>
                          {descargaExcelError &&
                          selectedId === row.id_formulario ? (
                            <p className="text-xs text-rose-600">
                              {descargaExcelError}
                            </p>
                          ) : null}
                          {descargaFotosError &&
                          selectedId === row.id_formulario ? (
                            <p className="text-xs text-rose-600">
                              {descargaFotosError}
                            </p>
                          ) : null}
                          {precargaLoadingId === row.id_formulario ? (
                            <p className="text-xs text-slate-500">
                              Precargando datos para uso offline…
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {modalEliminarTodasPrecargas ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
            aria-label="Cerrar"
            disabled={eliminandoTodasPrecargas}
            onClick={() => {
              if (!eliminandoTodasPrecargas) {
                setModalEliminarTodasPrecargas(false);
              }
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="eliminar-todas-precargas-title"
            className="relative z-10 w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-xl ring-1 ring-amber-100"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="eliminar-todas-precargas-title"
              className="text-lg font-semibold text-slate-900"
            >
              ¿Quitar todas las copias precargadas?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Se eliminarán <strong>{precargas.length}</strong> precarga
              {precargas.length === 1 ? "" : "s"} guardada
              {precargas.length === 1 ? "" : "s"} en este dispositivo para uso
              sin conexión. El historial local y los datos en servidor no se
              modifican.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={eliminandoTodasPrecargas}
                onClick={() => setModalEliminarTodasPrecargas(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-amber-700 text-white hover:bg-amber-800"
                disabled={eliminandoTodasPrecargas || precargas.length === 0}
                onClick={() => void confirmarEliminarTodasPrecargas()}
              >
                {eliminandoTodasPrecargas ? "Quitando…" : "Sí, quitar todas"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteFormModal
        open={!!pendingDeleteRow}
        title="¿Eliminar este formulario?"
        description={deleteModalDescription}
        passwordError={deletePasswordError}
        onCancel={cancelarEliminacionPendiente}
        onConfirm={(password) => void ejecutarEliminacionConfirmada(password)}
        confirming={
          !!pendingDeleteRow && eliminandoId === pendingDeleteRow.id_formulario
        }
      />

      <ConfirmDeleteFormModal
        open={modalEliminarTodosFormularios}
        title="¿Eliminar todos los formularios?"
        description={bulkDeleteModalDescription}
        passwordLabel="Contraseña de confirmación"
        passwordPlaceholder="Contraseña indicada por el equipo"
        passwordError={bulkDeletePasswordError}
        confirmLabel="Eliminar todo"
        onCancel={cancelarEliminarTodosFormularios}
        onConfirm={(password) => void ejecutarEliminarTodosFormularios(password)}
        confirming={eliminandoTodosFormularios}
      />
    </div>
  );
};
