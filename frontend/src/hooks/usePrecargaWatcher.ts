import { useEffect, useRef } from 'react';
import { db } from '@/services/db';
import { fetchFormFromApi } from '@/services/api';
import { downloadAndSavePrecarga } from '@/services/precargaService';

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos

export const usePrecargaWatcher = (enabled = true): void => {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let running = true;

    const checkAll = async () => {
      if (!navigator.onLine) return;
      try {
        const items = await db.precargas.where('auto_precarga').equals(true).toArray();
        for (const p of items) {
          try {
            const server = await fetchFormFromApi(p.id_formulario);
            const serverIso = server.fecha_actualizacion || server.fecha_hora || '';
            const localIso = p.fecha_precarga || '';
            if (serverIso && Date.parse(serverIso) > Date.parse(localIso)) {
              await downloadAndSavePrecarga(p.id_formulario);
            }
          } catch {
            // noop: skip this precarga if API call falla
          }
          if (!running) break;
        }
      } catch {
        // ignore errors
      }
    };

    const schedule = () => {
      if (timerRef.current != null) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        void checkAll();
      }, CHECK_INTERVAL_MS);
    };

    // run on start
    void checkAll();
    schedule();

    const onOnline = () => void checkAll();
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void checkAll();
      }
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [enabled]);
};
