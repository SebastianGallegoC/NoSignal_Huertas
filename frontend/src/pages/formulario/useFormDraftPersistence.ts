import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { UseFormGetValues } from 'react-hook-form';

import { clearFormDraft, saveFormDraft, shouldPersistFormDraft } from '@/services/formDraftStorage';
import type { FotoForm } from '@/services/db';
import type { FormValues } from '@/types/formFields';

type GpsCoords = { latitud: number; longitud: number; precision: number } | null;

type Args = {
  draftUserKey: string;
  defaults: FormValues;
  formValues: FormValues;
  fotos: FotoForm[];
  formId: string;
  originalFechaHora: string | null;
  gps: GpsCoords;
  modoCoordenadas: 'automatico' | 'manual';
  getValues: UseFormGetValues<FormValues>;
  /** Si es true, no guardar borrador (p. ej. al abandonar edición con Regresar). */
  skipPersistRef?: RefObject<boolean>;
};

export const useFormDraftPersistence = ({
  draftUserKey,
  defaults,
  formValues,
  fotos,
  formId,
  originalFechaHora,
  gps,
  modoCoordenadas,
  getValues,
  skipPersistRef,
}: Args) => {
  const draftUserKeyRef = useRef(draftUserKey);
  draftUserKeyRef.current = draftUserKey;
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;
  const formIdRef = useRef(formId);
  formIdRef.current = formId;
  const originalFechaHoraRef = useRef(originalFechaHora);
  originalFechaHoraRef.current = originalFechaHora;
  const gpsRef = useRef(gps);
  gpsRef.current = gps;
  const modoCoordenadasRef = useRef(modoCoordenadas);
  modoCoordenadasRef.current = modoCoordenadas;

  const flushDraftToStorage = useCallback(() => {
    if (skipPersistRef?.current) {
      return;
    }
    const userKey = draftUserKeyRef.current;
    const values = getValues();
    const def = defaultsRef.current;
    const f = fotosRef.current;
    const fid = formIdRef.current;
    const fFecha = originalFechaHoraRef.current;
    const g = gpsRef.current;
    const modo = modoCoordenadasRef.current;
    if (!shouldPersistFormDraft(values, def, f.length, g !== null)) {
      clearFormDraft(userKey);
      return;
    }
    saveFormDraft(userKey, {
      v: 1,
      savedAt: new Date().toISOString(),
      formId: fid,
      originalFechaHora: fFecha,
      modoCoordenadas: modo,
      formValues: values,
      fotos: f,
      gps: g
        ? { latitud: g.latitud, longitud: g.longitud, precision: g.precision }
        : null,
    });
  }, [getValues, skipPersistRef]);

  useEffect(() => {
    return () => {
      flushDraftToStorage();
    };
  }, [flushDraftToStorage]);

  useEffect(() => {
    const userKey = draftUserKey;
    if (!shouldPersistFormDraft(formValues, defaults, fotos.length, gps !== null)) {
      clearFormDraft(userKey);
      return;
    }
    const handle = window.setTimeout(() => {
      flushDraftToStorage();
    }, 450);
    return () => window.clearTimeout(handle);
  }, [
    formValues,
    defaults,
    draftUserKey,
    fotos,
    formId,
    gps,
    originalFechaHora,
    flushDraftToStorage,
  ]);
};
