import { useCallback, useEffect, useRef, useState } from 'react';

export interface GPSState {
  latitud: number;
  longitud: number;
  precision: number;
}

export type UseGPSOptions = {
  /** Ubicación ya capturada restaurada desde borrador local (sin nuevo watchPosition). */
  restoredPosition?: GPSState | null;
};

interface GPSHookState {
  gps: GPSState | null;
  cargando: boolean;
  error: string | null;
  estado: 'idle' | 'buscando' | 'ok' | 'error';
  progreso: string | null;
  solicitarGPS: () => void;
}

const MAX_ACCURACY_METERS = 5;
const GPS_TIMEOUT_MS = 60000;

export const useGPS = (opts?: UseGPSOptions): GPSHookState => {
  const initial = opts?.restoredPosition ?? null;
  const [gps, setGps] = useState<GPSState | null>(() => initial);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<'idle' | 'buscando' | 'ok' | 'error'>(() => (initial ? 'ok' : 'idle'));
  const [progreso, setProgreso] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const solicitarGPS = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('GPS no disponible en este dispositivo.');
      setEstado('error');
      return;
    }

    stopTracking();
    setCargando(true);
    setError(null);
    setProgreso('Iniciando GPS de alta precisión...');
    setEstado('buscando');
    setGps(null);

    let bestPosition: GPSState | null = null;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const precision = pos.coords.accuracy;
        const currentPosition = {
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
          precision,
        };

        if (!bestPosition || precision < bestPosition.precision) {
          bestPosition = currentPosition;
          setProgreso(`Buscando precisión ≤ 5m. Mejor lectura: ${precision.toFixed(1)}m.`);
        }

        if (precision <= MAX_ACCURACY_METERS) {
          setGps(currentPosition);
          setError(null);
          setProgreso(`Ubicación obtenida con ${precision.toFixed(1)}m de precisión.`);
          setEstado('ok');
          setCargando(false);
          stopTracking();
        }
      },
      () => {
        setError('No se pudo obtener la ubicacion.');
        setProgreso(null);
        setEstado('error');
        setCargando(false);
        stopTracking();
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );

    timeoutRef.current = window.setTimeout(() => {
      const bestAccuracy = bestPosition?.precision.toFixed(1);
      setError(
        bestAccuracy
          ? `Precisión insuficiente. Mejor lectura: ${bestAccuracy}m. Muévete a zona abierta e intenta nuevamente.`
          : 'No se logró obtener una lectura GPS suficientemente precisa.',
      );
      setProgreso(null);
      setEstado('error');
      setGps(null);
      setCargando(false);
      stopTracking();
    }, GPS_TIMEOUT_MS);
  }, [stopTracking]);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return { gps, cargando, error, estado, progreso, solicitarGPS };
};
