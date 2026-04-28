import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { db, type HistorialForm } from '@/services/db';

const estadoClass: Record<HistorialForm['estado'], string> = {
  PENDIENTE: 'text-amber-700',
  ERROR: 'text-rose-700',
  ENVIADO: 'text-emerald-700',
};

export const FormulariosDiligenciadosPage = () => {
  const [items, setItems] = useState<HistorialForm[]>([]);

  useEffect(() => {
    const load = async () => {
      const rows = await db.historialFormularios.orderBy('fecha_hora').reverse().toArray();
      setItems(rows);
    };
    void load();
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e2f2ee_0,_#f6f7f5_45%,_#f6f7f5_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">NoSignal</p>
            <h1 className="mt-2 text-3xl font-semibold">Formularios diligenciados</h1>
          </div>
          <Link to="/inicio" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            Volver
          </Link>
        </header>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 text-sm text-slate-600 shadow-sm">
            Aún no hay formularios diligenciados en el historial local.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id_formulario} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="font-medium text-slate-900">{item.id_formulario}</p>
                <p className="text-sm text-slate-600">Usuario: {item.id_usuario}</p>
                <p className="text-sm text-slate-600">Creado: {new Date(item.fecha_hora).toLocaleString()}</p>
                <p className={`text-sm font-semibold ${estadoClass[item.estado]}`}>Estado: {item.estado}</p>
                {item.fecha_envio ? (
                  <p className="text-sm text-slate-600">Enviado: {new Date(item.fecha_envio).toLocaleString()}</p>
                ) : null}
                {item.ultimo_error ? <p className="text-sm text-rose-700">Error: {item.ultimo_error}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
