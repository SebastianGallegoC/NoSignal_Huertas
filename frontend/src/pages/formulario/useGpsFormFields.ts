import { useEffect } from 'react';
import type { UseFormSetValue } from 'react-hook-form';

import type { FormValues } from '@/types/formFields';

type GpsCoords = { latitud: number; longitud: number; precision: number } | null;

type Args = {
  gps: GpsCoords;
  modoCoordenadas: 'automatico' | 'manual';
  latitud: string;
  longitud: string;
  setValue: UseFormSetValue<FormValues>;
};

const decimalToDms = (decimal: number) => {
  const abs = Math.abs(decimal);
  const grados = Math.floor(abs);
  const minutosFloat = (abs - grados) * 60;
  const minutos = Math.floor(minutosFloat);
  const segundos = (minutosFloat - minutos) * 60;
  return { grados, minutos, segundos };
};

export const useGpsFormFields = ({
  gps,
  modoCoordenadas,
  latitud,
  longitud,
  setValue,
}: Args) => {
  useEffect(() => {
    if (!gps || modoCoordenadas === 'manual') {
      return;
    }
    const longDms = decimalToDms(gps.longitud);
    const latDms = decimalToDms(gps.latitud);

    setValue('longitud', gps.longitud.toFixed(6));
    setValue('latitud', gps.latitud.toFixed(6));
    setValue('x_grados', String(longDms.grados));
    setValue('x_minutos', String(longDms.minutos));
    setValue('x_segundos', longDms.segundos.toFixed(3));
    setValue('y_grados', String(latDms.grados));
    setValue('y_minutos', String(latDms.minutos));
    setValue('y_segundos', latDms.segundos.toFixed(3));
  }, [gps, modoCoordenadas, setValue]);

  useEffect(() => {
    if (modoCoordenadas !== 'manual') {
      return;
    }

    const longNum = Number.parseFloat(longitud);
    const latNum = Number.parseFloat(latitud);

    if (!Number.isFinite(longNum) || !Number.isFinite(latNum)) {
      return;
    }

    const longDms = decimalToDms(longNum);
    const latDms = decimalToDms(latNum);

    setValue('x_grados', String(longDms.grados));
    setValue('x_minutos', String(longDms.minutos));
    setValue('x_segundos', longDms.segundos.toFixed(3));
    setValue('y_grados', String(latDms.grados));
    setValue('y_minutos', String(latDms.minutos));
    setValue('y_segundos', latDms.segundos.toFixed(3));
  }, [latitud, longitud, modoCoordenadas, setValue]);
};
