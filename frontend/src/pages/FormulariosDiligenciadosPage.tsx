import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { FormularioRespuestaReadOnly, type FormularioSnapshot } from '@/components/form/FormularioRespuestaReadOnly';
import { ACCESS_TOKEN_KEY } from '@/lib/authStorage';
import { listFormsFromApi, type FormReadItem } from '@/services/api';
import { db, type HistorialForm } from '@/services/db';

const estadoClass: Record<HistorialForm['estado'], string> = {
  PENDIENTE: 'text-amber-700',
  ERROR: 'text-rose-700',
  ENVIADO: 'text-emerald-700',
};

type DisplayRow = {
  id_formulario: string;
  onServer: boolean;
  server?: FormReadItem;
  historial?: HistorialForm;
};

function mergeForms(server: FormReadItem[], local: HistorialForm[]): DisplayRow[] {
  const map = new Map<string, DisplayRow>();
  for (const s of server) {
    map.set(s.id_formulario, {
      id_formulario: s.id_formulario,
      onServer: true,
      server: s,
    });
  }
  for (const h of local) {
    const ex = map.get(h.id_formulario);
    if (ex) {
      ex.historial = h;
    } else {
      map.set(h.id_formulario, {
        id_formulario: h.id_formulario,
        onServer: false,
        historial: h,
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    const ta = Date.parse(a.server?.fecha_hora ?? a.historial?.fecha_hora ?? '');
    const tb = Date.parse(b.server?.fecha_hora ?? b.historial?.fecha_hora ?? '');
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
}

function mapServerFotos(raw: unknown[]): FormularioSnapshot['fotos'] {
  return raw.map((p, i) => {
    if (typeof p === 'string') {
      const base = p.split(/[/\\]/).pop() || `foto_${i + 1}.jpg`;
      return { nombre_archivo: base, path: p };
    }
    return { nombre_archivo: `foto_${i + 1}`, path: String(p) };
  });
}

export const FormulariosDiligenciadosPage = () => {
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailSnapshot, setDetailSnapshot] = useState<FormularioSnapshot | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [remoteLoaded, setRemoteLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const local = await db.historialFormularios.orderBy('fecha_hora').reverse().toArray();
      let server: FormReadItem[] = [];
      let err: string | null = null;
      const hasToken = typeof localStorage !== 'undefined' && !!localStorage.getItem(ACCESS_TOKEN_KEY);
      if (hasToken) {
        try {
          server = await listFormsFromApi();
        } catch (e) {
          err = e instanceof Error ? e.message : 'Error al cargar desde el servidor';
        }
      }
      if (cancelled) {
        return;
      }
      setRows(mergeForms(server, local));
      setRemoteError(err);
      setRemoteLoaded(hasToken);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectRow = useCallback(async (row: DisplayRow) => {
    if (selectedId === row.id_formulario) {
      setSelectedId(null);
      setDetailSnapshot(null);
      return;
    }
    setSelectedId(row.id_formulario);
    setDetailLoading(true);
    setDetailSnapshot(null);
    const live = await db.formularios.get(row.id_formulario);
    if (live) {
      setDetailSnapshot({
        datos_formulario: live.datos_formulario ?? {},
        gps: live.gps,
        fotos: live.fotos ?? [],
      });
    } else if (row.server) {
      setDetailSnapshot({
        datos_formulario: (row.server.datos_formulario ?? {}) as Record<string, unknown>,
        gps: {
          latitud: row.server.latitud,
          longitud: row.server.longitud,
          precision: row.server.precision ?? null,
        },
        fotos: mapServerFotos(row.server.fotos ?? []),
      });
    } else if (row.historial) {
      const h = row.historial;
      setDetailSnapshot({
        datos_formulario: h.datos_formulario ?? {},
        gps: h.gps ?? null,
        fotos: h.fotos ?? [],
      });
    }
    setDetailLoading(false);
  }, [selectedId]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e2f2ee_0,_#f6f7f5_45%,_#f6f7f5_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">NoSignal</p>
            <h1 className="mt-2 text-3xl font-semibold">Formularios diligenciados</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Con sesión iniciada se listan los envíos guardados en el <strong>servidor</strong> (todos los
              equipos) y se unen con el historial <strong>solo de este dispositivo</strong> (pendientes o errores
              que aún no están en la nube).
            </p>
          </div>
          <Link to="/inicio" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
            Volver
          </Link>
        </header>

        {remoteLoaded && remoteError ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            No se pudo cargar la lista del servidor: {remoteError}. Se muestra solo el historial de este equipo.
          </div>
        ) : null}

        {!remoteLoaded ? (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
            Iniciá sesión para ver también los formularios sincronizados desde otros dispositivos.
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 text-sm text-slate-600 shadow-sm">
            No hay registros en el historial local ni en el servidor (con tu sesión actual).
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const isOpen = selectedId === row.id_formulario;
              const h = row.historial;
              const s = row.server;
              const tituloUsuario = h?.id_usuario ?? s?.id_usuario ?? '—';
              const tituloFecha = s?.fecha_hora ?? h?.fecha_hora ?? '';
              return (
                <article
                  key={row.id_formulario}
                  className={`overflow-hidden rounded-2xl border bg-white/90 shadow-sm transition-shadow ${
                    isOpen ? 'border-teal-400 ring-2 ring-teal-200' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void selectRow(row)}
                    className="flex w-full items-start justify-between gap-3 p-4 text-left"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {row.onServer ? (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
                            Servidor
                          </span>
                        ) : null}
                        {!row.onServer ? (
                          <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-800">
                            Solo este equipo
                          </span>
                        ) : null}
                        {row.onServer && h ? (
                          <span className="rounded-md bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-900">
                            + copia local
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate font-mono text-xs text-slate-500">{row.id_formulario}</p>
                      <p className="font-medium text-slate-900">Usuario: {tituloUsuario}</p>
                      <p className="text-sm text-slate-600">
                        Fecha (referencia):{' '}
                        {tituloFecha ? new Date(tituloFecha).toLocaleString() : '—'}
                      </p>
                      {h ? (
                        <p className={`text-sm font-semibold ${estadoClass[h.estado]}`}>
                          Estado en este dispositivo: {h.estado}
                        </p>
                      ) : row.onServer ? (
                        <p className="text-sm font-semibold text-emerald-700">Sincronizado en servidor</p>
                      ) : null}
                      {h?.fecha_envio ? (
                        <p className="text-sm text-slate-600">Enviado (local): {new Date(h.fecha_envio).toLocaleString()}</p>
                      ) : null}
                      {h?.ultimo_error ? <p className="text-sm text-rose-700">Error: {h.ultimo_error}</p> : null}
                    </div>
                    <span
                      className={`mt-1 shrink-0 rounded-lg border px-2 py-1 text-xs font-medium ${
                        isOpen ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {isOpen ? 'Cerrar' : 'Ver formulario'}
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="border-t border-slate-200 bg-[linear-gradient(180deg,_#fafcfb_0%,_#fff_12%)] px-4 py-5">
                      {detailLoading ? (
                        <p className="text-center text-sm text-slate-600">Cargando…</p>
                      ) : detailSnapshot ? (
                        <FormularioRespuestaReadOnly snapshot={detailSnapshot} />
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
