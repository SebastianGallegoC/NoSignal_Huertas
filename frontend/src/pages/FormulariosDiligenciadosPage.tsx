import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";

import { ConfirmDeleteFormModal } from "@/components/ConfirmDeleteFormModal";
import {
  agentSessionLog,
  beneficiaryFieldProbe,
  idSuffix,
} from "@/debug/agentSessionLog";
import {
  FormularioRespuestaReadOnly,
  type FormularioSnapshot,
} from "@/components/form/FormularioRespuestaReadOnly";
import { Button } from "@/components/ui/button";
import { ACCESS_TOKEN_KEY } from "@/lib/authStorage";
import { formatDateTime } from "@/lib/formatDateTime";
import {
  deleteFormFromApi,
  fetchFormPhotoDataUrl,
  loginApi,
  listFormsFromApi,
  type FormReadItem,
} from "@/services/api";
import { saveFormDraft, type FormDraftV1 } from "@/services/formDraftStorage";
import { db, type HistorialForm, type PrecargaForm } from "@/services/db";
import {
  downloadMatrizCaracterizacionBulkXlsx,
  downloadMatrizCaracterizacionXlsx,
} from "@/services/matrizCaracterizacionExport";
import {
  eliminarFormularioDeDispositivo,
  loadHiddenFormIds,
} from "@/services/formLocalDelete";
import {
  buildFormValuesFromSnapshot,
  getBeneficiarioDisplayName,
  getFechaReferenciaEnvio,
  mapServerFotos,
  mergeFormsWithPrecargas,
  normalizeTextoBusqueda,
  reconcileLocalStateWithTrustedServerList,
  parseFiltroDiaFin,
  parseFiltroDiaInicio,
  precargaToSnapshot,
  type DisplayRow,
} from "@/services/formHistory";
import { useAuthStore } from "@/store/useAuthStore";

const estadoClass: Record<HistorialForm["estado"], string> = {
  PENDIENTE: "text-amber-700",
  ERROR: "text-rose-700",
  ENVIADO: "text-emerald-700",
};

type DetailSourceKind = "server" | "precarga" | "historial" | "live";

const DETAIL_SOURCE_COLOR: Record<DetailSourceKind, string> = {
  server: "bg-emerald-100 text-emerald-800",
  precarga: "bg-indigo-100 text-indigo-800",
  historial: "bg-amber-100 text-amber-800",
  live: "bg-slate-100 text-slate-700",
};

const DETAIL_SOURCE_LABEL: Record<DetailSourceKind, string> = {
  server: "Servidor",
  precarga: "Precarga",
  historial: "Historial local",
  live: "Local en edición",
};

/** Misma prioridad que al armar el detalle: servidor → precarga → historial → cola local. */
function previewDetailSourceForRow(
  row: DisplayRow,
  precarga: PrecargaForm | null,
): DetailSourceKind {
  if (row.server) {
    return "server";
  }
  if (precarga) {
    return "precarga";
  }
  if (row.historial) {
    return "historial";
  }
  return "live";
}

export const FormulariosDiligenciadosPage = () => {
  const authUsername = useAuthStore((s) => s.username);
  const navigate = useNavigate();
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");
  const [filtroBeneficiario, setFiltroBeneficiario] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const [precargaError, setPrecargaError] = useState<string | null>(null);
  const [descargandoExcelId, setDescargandoExcelId] = useState<string | null>(
    null,
  );
  const [descargaExcelError, setDescargaExcelError] = useState<string | null>(
    null,
  );
  const [descargandoTodosExcel, setDescargandoTodosExcel] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [eliminarError, setEliminarError] = useState<string | null>(null);
  const [online, setOnline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine,
  );
  const [pendingDeleteRow, setPendingDeleteRow] = useState<DisplayRow | null>(
    null,
  );
  const [deletePasswordError, setDeletePasswordError] = useState<string | null>(
    null,
  );

  const precargaMap = useMemo(() => {
    return new Map(precargas.map((p) => [p.id_formulario, p]));
  }, [precargas]);

  const rowsFiltrados = useMemo(() => {
    let out = rows;
    const tieneFechas = filtroDesde.trim() !== "" || filtroHasta.trim() !== "";
    if (tieneFechas) {
      const tDesde = filtroDesde.trim()
        ? parseFiltroDiaInicio(filtroDesde.trim())
        : NaN;
      const tHasta = filtroHasta.trim()
        ? parseFiltroDiaFin(filtroHasta.trim())
        : NaN;
      if (filtroDesde.trim() && Number.isNaN(tDesde)) {
        out = rows;
      } else if (filtroHasta.trim() && Number.isNaN(tHasta)) {
        out = rows;
      } else {
        out = rows.filter((row) => {
          const ts = getFechaReferenciaEnvio(row);
          if (Number.isNaN(ts)) {
            return false;
          }
          if (!Number.isNaN(tDesde) && ts < tDesde) {
            return false;
          }
          if (!Number.isNaN(tHasta) && ts > tHasta) {
            return false;
          }
          return true;
        });
      }
    }
    const q = normalizeTextoBusqueda(filtroBeneficiario);
    if (q) {
      out = out.filter((row) => {
        const nombre = getBeneficiarioDisplayName(row);
        if (!nombre) {
          return false;
        }
        return normalizeTextoBusqueda(nombre).includes(q);
      });
    }
    return out;
  }, [rows, filtroDesde, filtroHasta, filtroBeneficiario]);

  const loadList = useCallback(async () => {
    const local = await db.historialFormularios
      .orderBy("fecha_hora")
      .reverse()
      .toArray();
    const precargaRows = await db.precargas.toArray();
    let server: FormReadItem[] = [];
    let err: string | null = null;
    const hasToken =
      typeof localStorage !== "undefined" &&
      !!localStorage.getItem(ACCESS_TOKEN_KEY);
    if (hasToken) {
      try {
        server = await listFormsFromApi();
      } catch (e) {
        err =
          e instanceof Error
            ? e.message
            : "Error al cargar desde el servidor";
      }
    }

    let localForMerge = local;
    let precargaForMerge = precargaRows;
    if (hasToken && !err) {
      const reconciled = reconcileLocalStateWithTrustedServerList(
        local,
        server,
        precargaRows,
      );
      localForMerge = reconciled.historialForMerge;
      precargaForMerge = reconciled.precargasForMerge;
      if (reconciled.staleEnviadoIds.length > 0) {
        await Promise.all(
          reconciled.staleEnviadoIds.flatMap((id) => [
            db.historialFormularios.delete(id).catch(() => undefined),
            db.precargas.delete(id).catch(() => undefined),
            db.formulariosOcultos.delete(id).catch(() => undefined),
            db.formularios.delete(id).catch(() => undefined),
          ]),
        );
      }
    }

    const merged = mergeFormsWithPrecargas(
      server,
      localForMerge,
      precargaForMerge,
    );
    const ocultos = await loadHiddenFormIds();
    setRows(merged.filter((r) => !ocultos.has(r.id_formulario)));
    setRemoteError(err);
    setRemoteLoaded(hasToken);
    setPrecargas(precargaForMerge);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void loadList();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    if (!rowsFiltrados.some((r) => r.id_formulario === selectedId)) {
      setSelectedId(null);
      setDetailSnapshot(null);
      setDetailSource(null);
      setDetailPrecarga(null);
    }
  }, [rowsFiltrados, selectedId]);

  const selectRow = useCallback(
    async (row: DisplayRow) => {
      if (selectedId === row.id_formulario) {
        setSelectedId(null);
        setDetailSnapshot(null);
        setDetailSource(null);
        setDetailPrecarga(null);
        return;
      }
      setSelectedId(row.id_formulario);
      setDetailLoading(true);
      setDetailSnapshot(null);
      setDetailSource(null);
      setDetailPrecarga(null);
      setPrecargaError(null);
      const live = await db.formularios.get(row.id_formulario);
      const precarga = await db.precargas.get(row.id_formulario);
      if (precarga) {
        setDetailPrecarga(precarga);
      }
      if (row.server) {
        // #region agent log
        agentSessionLog({
          hypothesisId: "H3",
          location: "FormulariosDiligenciadosPage.tsx:selectRow",
          message: "detail_snapshot_server",
          data: {
            idSuf: idSuffix(row.id_formulario),
            ben: beneficiaryFieldProbe(
              row.server.datos_formulario as Record<string, unknown>,
            ),
            datosJsonLen: JSON.stringify(row.server.datos_formulario ?? {})
              .length,
          },
        });
        // #endregion

        const serverFotos = mapServerFotos(
          row.server.id_formulario,
          row.server.fotos ?? [],
        );
        const localFotos =
          row.historial?.fotos ??
          precarga?.fotos ??
          live?.fotos ??
          [];

        const localVisitas = {
          v1: localFotos.filter((f) => f.visita === 1).length,
          v2: localFotos.filter((f) => f.visita === 2).length,
          v3: localFotos.filter((f) => f.visita === 3).length,
          null: localFotos.filter((f) => f.visita == null).length,
          typeCounts: {
            number: localFotos.filter((f) => typeof f.visita === "number").length,
            undefined: localFotos.filter((f) => f.visita === undefined).length,
          },
          total: localFotos.length,
        };
        const serverVisitas = {
          v1: serverFotos.filter((f) => f.visita === 1).length,
          v2: serverFotos.filter((f) => f.visita === 2).length,
          v3: serverFotos.filter((f) => f.visita === 3).length,
          null: serverFotos.filter((f) => f.visita == null).length,
          total: serverFotos.length,
        };

        // #region agent log
        agentSessionLog({
          hypothesisId: "H6",
          location: "FormulariosDiligenciadosPage.tsx:selectRow",
          message: "server_vs_local_fotos_visita",
          data: {
            idSuf: idSuffix(row.id_formulario),
            serverVisitas,
            localVisitas,
          },
        });
        // #endregion

        const fotosConVisita = serverFotos.map((sf, i) => {
          const v = localFotos[i]?.visita;
          if (v === 1 || v === 2 || v === 3) {
            return { ...sf, visita: v };
          }
          return sf;
        });

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
          fotos: fotosConVisita,
        });
        setDetailSource("server");
      } else if (precarga) {
        setDetailSnapshot(precargaToSnapshot(precarga));
        setDetailSource("precarga");
      } else if (row.historial) {
        const h = row.historial;
        setDetailSnapshot({
          datos_formulario: h.datos_formulario ?? {},
          gps: h.gps ?? null,
          fotos: h.fotos ?? [],
        });
        setDetailSource("historial");
      } else if (live) {
        setDetailSnapshot({
          datos_formulario: live.datos_formulario ?? {},
          gps: live.gps,
          fotos: live.fotos ?? [],
        });
        setDetailSource("live");
      }
      setDetailLoading(false);
    },
    [selectedId],
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
            visita?: 1 | 2 | 3;
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
                ...(foto.visita === 1 || foto.visita === 2 || foto.visita === 3
                  ? { visita: foto.visita }
                  : {}),
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
            if (f.visita === 1 || f.visita === 2 || f.visita === 3) {
              return { ...base, visita: f.visita };
            }
            return base;
          })
          .filter(
            (f): f is { nombre_archivo: string; data: string; visita?: 1 | 2 | 3 } =>
              f !== null,
          );

        const precarga: PrecargaForm = {
          id_formulario: row.id_formulario,
          fecha_precarga: new Date().toISOString(),
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

  const usarComoBase = useCallback(
    (row: DisplayRow) => {
      if (!detailSnapshot) {
        return;
      }
      const formValues = buildFormValuesFromSnapshot(detailSnapshot);
      const sourceFotos = detailPrecarga?.fotos ?? detailSnapshot.fotos ?? [];
      const fotos = sourceFotos
        .map((f) =>
          f.data ? { nombre_archivo: f.nombre_archivo, data: f.data } : null,
        )
        .filter(
          (f): f is { nombre_archivo: string; data: string } => f !== null,
        );
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
        idUsuario: (() => {
          const u = row.server?.id_usuario ?? row.historial?.id_usuario;
          if (u) {
            return u;
          }
          const raw = row.precargaSolo?.datos_formulario?.usuario_cens;
          if (typeof raw === "string" && raw.trim() !== "") {
            return raw.trim();
          }
          return "";
        })(),
        formValues,
        fotos,
        gps,
      };
      saveFormDraft(authUsername ?? "", draft);
      navigate("/formulario");
    },
    [authUsername, detailPrecarga, detailSnapshot, navigate],
  );

  const descargarExcelDelRegistro = useCallback(
    async (row: DisplayRow) => {
      if (!detailSnapshot) {
        setDescargaExcelError(
          "No hay datos cargados del formulario para exportar.",
        );
        return;
      }
      setDescargaExcelError(null);
      setDescargandoExcelId(row.id_formulario);
      try {
        const fotos = (detailPrecarga?.fotos ?? detailSnapshot.fotos ?? [])
          .map((f) =>
            f.data ? { nombre_archivo: f.nombre_archivo, data: f.data } : null,
          )
          .filter(
            (f): f is { nombre_archivo: string; data: string } => f !== null,
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
                typeof detailSnapshot.gps.precision === "number" &&
                detailSnapshot.gps.precision > 0
                  ? detailSnapshot.gps.precision
                  : 1,
            }
          : fallbackGps;
        if (!gps) {
          setDescargaExcelError(
            "No hay coordenadas disponibles para exportar este formulario.",
          );
          return;
        }

        await downloadMatrizCaracterizacionXlsx({
          id_formulario: row.id_formulario,
          id_usuario:
            row.server?.id_usuario ??
            row.historial?.id_usuario ??
            "sin_usuario",
          fecha_hora:
            row.server?.fecha_hora ??
            row.historial?.fecha_envio ??
            row.historial?.fecha_hora ??
            new Date().toISOString(),
          gps,
          datos_formulario: detailSnapshot.datos_formulario ?? {},
          fotos,
          estado_sincronizacion: "PENDIENTE",
        });
      } catch (e) {
        setDescargaExcelError(
          e instanceof Error
            ? e.message
            : "No se pudo descargar el Excel de este formulario.",
        );
      } finally {
        setDescargandoExcelId(null);
      }
    },
    [detailPrecarga, detailSnapshot],
  );

  const descargarExcelDeTodos = useCallback(async () => {
    setDescargaExcelError(null);
    setDescargandoTodosExcel(true);
    try {
      const exportables = rows.map((row) => {
        const datos =
          (row.historial?.datos_formulario as Record<string, unknown> | undefined) ??
          (row.server?.datos_formulario as Record<string, unknown> | undefined) ??
          row.precargaSolo?.datos_formulario ??
          {};
        const gps = row.historial?.gps
          ? {
              latitud: row.historial.gps.latitud,
              longitud: row.historial.gps.longitud,
              precision:
                typeof row.historial.gps.precision === "number" &&
                row.historial.gps.precision > 0
                  ? row.historial.gps.precision
                  : 1,
            }
          : row.server
            ? {
                latitud: row.server.latitud,
                longitud: row.server.longitud,
                precision:
                  typeof row.server.precision === "number" &&
                  row.server.precision > 0
                    ? row.server.precision
                    : 1,
              }
            : { latitud: 0, longitud: 0, precision: 1 };
        const fotos =
          (row.historial?.fotos ?? row.precargaSolo?.fotos ?? []).filter(
            (
              f,
            ): f is {
              nombre_archivo: string;
              data: string;
            } => typeof f?.data === "string" && f.data.trim() !== "",
          );
        return {
          id_formulario: row.id_formulario,
          id_usuario:
            row.server?.id_usuario ?? row.historial?.id_usuario ?? "sin_usuario",
          fecha_hora:
            row.server?.fecha_hora ??
            row.historial?.fecha_envio ??
            row.historial?.fecha_hora ??
            row.precargaSolo?.fecha_precarga ??
            new Date().toISOString(),
          gps,
          datos_formulario: datos,
          fotos,
          estado_sincronizacion: "PENDIENTE" as const,
        };
      });
      await downloadMatrizCaracterizacionBulkXlsx(exportables);
    } catch (e) {
      setDescargaExcelError(
        e instanceof Error
          ? e.message
          : "No se pudo descargar el Excel consolidado.",
      );
    } finally {
      setDescargandoTodosExcel(false);
    }
  }, [rows]);

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

  const ejecutarEliminacionConfirmada = useCallback(async (password: string) => {
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
      setDeletePasswordError("No hay una sesión activa para validar contraseña.");
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
  }, [authUsername, loadList, pendingDeleteRow, selectedId]);

  const cancelarEliminacionPendiente = useCallback(() => {
    if (eliminandoId) {
      return;
    }
    setDeletePasswordError(null);
    setPendingDeleteRow(null);
  }, [eliminandoId]);

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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e2f2ee_0,_#f6f7f5_45%,_#f6f7f5_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">
              NoSignal
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Formularios diligenciados
            </h1>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto"
            >
              Recargar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void descargarExcelDeTodos()}
              disabled={descargandoTodosExcel}
              className="w-full sm:w-auto"
            >
              {descargandoTodosExcel
                ? "Descargando Excel (todos)…"
                : "Descargar Excel de todos"}
            </Button>
            <Link
              to="/inicio"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm sm:w-auto"
            >
              Volver
            </Link>
          </div>
        </header>

        {eliminarError ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-900">
            {eliminarError}
          </div>
        ) : null}

        {remoteLoaded && remoteError ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            No se pudo cargar la lista del servidor: {remoteError}. Se muestra
            solo el historial de este equipo.
          </div>
        ) : null}

        {!remoteLoaded ? (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
            Iniciá sesión para ver también los formularios sincronizados desde
            otros dispositivos.
          </div>
        ) : null}

        {!online ? (
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/95 px-4 py-3 text-sm text-slate-800">
            Sin conexión a internet: no podés eliminar formularios. Volvé a
            estar en línea para usar esa opción.
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Filtros</h2>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Nombre del beneficiario
              </h3>
              <input
                type="search"
                value={filtroBeneficiario}
                onChange={(e) => setFiltroBeneficiario(e.target.value)}
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
                    onChange={(e) => setFiltroDesde(e.target.value)}
                    className="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <label className="flex flex-col text-xs font-medium text-slate-700">
                  Hasta
                  <input
                    type="date"
                    value={filtroHasta}
                    onChange={(e) => setFiltroHasta(e.target.value)}
                    className="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setFiltroDesde("");
                    setFiltroHasta("");
                    setFiltroBeneficiario("");
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>

            {(filtroDesde ||
              filtroHasta ||
              normalizeTextoBusqueda(filtroBeneficiario)) &&
            rowsFiltrados.length !== rows.length ? (
              <p className="mt-3 text-xs text-slate-600">
                Mostrando <strong>{rowsFiltrados.length}</strong> de{" "}
                {rows.length} registros.
              </p>
            ) : null}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 text-sm text-slate-600 shadow-sm">
            No hay registros en el historial local ni en el servidor (con tu
            sesión actual).
          </div>
        ) : rowsFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 text-sm text-slate-600 shadow-sm">
            Ningún registro coincide con los filtros (nombre del beneficiario o
            rango de fechas). Probá otro texto, ampliar fechas o usar «Limpiar
            filtros».
          </div>
        ) : (
          <div className="space-y-3">
            {rowsFiltrados.map((row) => {
              const isOpen = selectedId === row.id_formulario;
              const h = row.historial;
              const precarga = precargaMap.get(row.id_formulario) ?? null;
              const precargado = !!precarga;
              const nombreBenef = getBeneficiarioDisplayName(row);
              const tituloUsuario = nombreBenef || "No diligenciado";
              const refTs = getFechaReferenciaEnvio(row);
              const tituloFechaLabel = formatDateTime(refTs);
              const ultimaActualizacionTs = Date.parse(
                h?.fecha_envio ??
                  row.server?.fecha_hora ??
                  h?.fecha_hora ??
                  precarga?.fecha_precarga ??
                  "",
              );
              const ultimaActualizacionLabel = Number.isNaN(ultimaActualizacionTs)
                ? "—"
                : formatDateTime(ultimaActualizacionTs);
              const effectiveDetailSource: DetailSourceKind =
                isOpen && detailSource != null
                  ? detailSource
                  : previewDetailSourceForRow(row, precarga);
              return (
                <article
                  key={row.id_formulario}
                  className={`overflow-hidden rounded-2xl border bg-white/90 shadow-sm transition-shadow ${
                    isOpen
                      ? "border-teal-400 ring-2 ring-teal-200"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-stretch gap-2 p-2 sm:gap-3 sm:p-3">
                    <button
                      type="button"
                      onClick={() => void selectRow(row)}
                      className="flex min-w-0 flex-1 items-start justify-between gap-3 rounded-xl p-2 text-left sm:p-3"
                    >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {row.onServer ? (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
                            Servidor
                          </span>
                        ) : null}
                        {row.precargaSolo ? (
                          <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-900">
                            Precarga offline
                          </span>
                        ) : null}
                        {!row.onServer && !row.precargaSolo ? (
                          <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-800">
                            Solo este equipo
                          </span>
                        ) : null}
                        {precargado ? (
                          <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-900">
                            Precargado
                          </span>
                        ) : null}
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${DETAIL_SOURCE_COLOR[effectiveDetailSource]}`}
                          title="Fuente usada para el detalle del formulario al expandir"
                        >
                          Origen: {DETAIL_SOURCE_LABEL[effectiveDetailSource]}
                        </span>
                      </div>
                      <p className="font-medium text-slate-900">
                        Beneficiario: {tituloUsuario}
                      </p>
                      <p className="text-sm text-slate-600">
                        Fecha de envío / del formulario: {tituloFechaLabel}
                      </p>
                      <p className="text-sm text-slate-600">
                        Última actualización: {ultimaActualizacionLabel}
                      </p>
                      {h ? (
                        <p
                          className={`text-sm font-semibold ${estadoClass[h.estado]}`}
                        >
                          Estado en este dispositivo: {h.estado}
                        </p>
                      ) : row.onServer ? (
                        <p className="text-sm font-semibold text-emerald-700">
                          Sincronizado en servidor
                        </p>
                      ) : row.precargaSolo ? (
                        <p className="text-sm font-semibold text-indigo-800">
                          Copia guardada en este dispositivo para uso sin red
                        </p>
                      ) : null}
                      {h?.ultimo_error ? (
                        <p className="text-sm text-rose-700">
                          Error: {h.ultimo_error}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`mt-1 shrink-0 rounded-lg border px-2 py-1 text-xs font-medium ${
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
                      disabled={
                        !online || eliminandoId === row.id_formulario
                      }
                      title={
                        !online
                          ? "Requiere conexión a internet"
                          : undefined
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        solicitarEliminar(row);
                      }}
                      className="shrink-0 self-center border-rose-200 text-rose-800 hover:bg-rose-50"
                    >
                      {eliminandoId === row.id_formulario
                        ? "…"
                        : "Eliminar"}
                    </Button>
                  </div>

                  {isOpen ? (
                    <div className="border-t border-slate-200 bg-[linear-gradient(180deg,_#fafcfb_0%,_#fff_12%)] px-4 py-5">
                      {detailLoading ? (
                        <p className="text-center text-sm text-slate-600">
                          Cargando…
                        </p>
                      ) : detailSnapshot ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-end">
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold ${DETAIL_SOURCE_COLOR[effectiveDetailSource]}`}
                            >
                              Origen: {DETAIL_SOURCE_LABEL[effectiveDetailSource]}
                            </span>
                          </div>
                          <FormularioRespuestaReadOnly
                            snapshot={detailSnapshot}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            {row.server ? (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => void precargarRow(row)}
                                disabled={
                                  precargaLoadingId === row.id_formulario
                                }
                              >
                                {precargaMap.has(row.id_formulario)
                                  ? "Actualizar precarga"
                                  : "Precargar para visita"}
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              onClick={() => usarComoBase(row)}
                            >
                              Editar este formulario
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void descargarExcelDelRegistro(row)}
                              disabled={
                                detailLoading ||
                                descargandoExcelId === row.id_formulario
                              }
                            >
                              {descargandoExcelId === row.id_formulario
                                ? "Descargando Excel…"
                                : "Descargar Excel"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={
                                !online || eliminandoId === row.id_formulario
                              }
                              title={
                                !online
                                  ? "Requiere conexión a internet"
                                  : undefined
                              }
                              onClick={() => solicitarEliminar(row)}
                              className="border-rose-200 text-rose-800 hover:bg-rose-50"
                            >
                              Eliminar de este equipo
                            </Button>
                            {precargaMap.has(row.id_formulario) ? (
                              <span className="text-xs text-slate-500">
                                Precargado el{" "}
                                {formatDateTime(
                                  Date.parse(
                                    precargaMap.get(row.id_formulario)
                                      ?.fecha_precarga ?? "",
                                  ),
                                )}
                              </span>
                            ) : null}
                          </div>
                          {precargaError && selectedId === row.id_formulario ? (
                            <p className="text-xs text-rose-600">
                              {precargaError}
                            </p>
                          ) : null}
                          {descargaExcelError &&
                          selectedId === row.id_formulario ? (
                            <p className="text-xs text-rose-600">
                              {descargaExcelError}
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

      <ConfirmDeleteFormModal
        open={!!pendingDeleteRow}
        title="¿Eliminar este formulario?"
        description={deleteModalDescription}
        passwordError={deletePasswordError}
        onCancel={cancelarEliminacionPendiente}
        onConfirm={(password) => void ejecutarEliminacionConfirmada(password)}
        confirming={
          !!pendingDeleteRow &&
          eliminandoId === pendingDeleteRow.id_formulario
        }
      />
    </div>
  );
};
