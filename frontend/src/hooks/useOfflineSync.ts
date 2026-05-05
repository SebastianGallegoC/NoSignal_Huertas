import { useEffect } from 'react';

import { purgeExpiredForms, syncPendingForms } from '../services/sync';

const ONLINE_SYNC_DEBOUNCE_MS = 1200;

export const useOfflineSync = (): void => {
  useEffect(() => {
    const runSync = async () => {
      await purgeExpiredForms();
      await syncPendingForms();
    };

    void runSync();

    let onlineTimer: number | null = null;
    const handleOnline = () => {
      if (onlineTimer != null) {
        window.clearTimeout(onlineTimer);
      }
      onlineTimer = window.setTimeout(() => {
        onlineTimer = null;
        void runSync();
      }, ONLINE_SYNC_DEBOUNCE_MS);
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
      if (onlineTimer != null) {
        window.clearTimeout(onlineTimer);
      }
    };
  }, []);
};
