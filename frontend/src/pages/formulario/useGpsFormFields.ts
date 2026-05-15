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

export const useGpsFormFields = ({
  gps,
  modoCoordenadas,
  setValue,
}: Args) => {
  useEffect(() => {
    if (!gps || modoCoordenadas === 'manual') {
      return;
    }

    setValue('longitud', gps.longitud.toFixed(6));
    setValue('latitud', gps.latitud.toFixed(6));
  }, [gps, modoCoordenadas, setValue]);
};
