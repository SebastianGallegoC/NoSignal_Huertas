import { useEffect } from 'react';
import type { UseFormSetValue } from 'react-hook-form';

import { formatGpsCoordDecimal } from '@/lib/coordNumericToken';
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

    setValue('longitud', formatGpsCoordDecimal(gps.longitud));
    setValue('latitud', formatGpsCoordDecimal(gps.latitud));
  }, [gps, modoCoordenadas, setValue]);
};
