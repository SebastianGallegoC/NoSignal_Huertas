import { useCallback, useEffect, useRef } from 'react';
import type { UseFormGetValues } from 'react-hook-form';

import { clearFormDraft, saveFormDraft, shouldPersistFormDraft } from '@/services/formDraftStorage';
import type { FotoForm } from '@/services/db';
import type { FormValues } from '@/types/formFields';

type GpsCoords = { latitud: number; longitud: number; precision: number } | null;

type Args = {
  draftUserKey: string;
  defaults: FormValues;
  formValues: FormValues;
  idUsuario: string;
  fotos: FotoForm[];
  formId: string;
  originalFechaHora: string | null;
  gps: GpsCoords;
  modoCoordenadas: 'automatico' | 'manual';
  getValues: UseFormGetValues<FormValues>;
};

export const useFormDraftPersistence = ({
  draftUserKey,
  defaults,
  formValues,
  idUsuario,
  fotos,
  formId,
  originalFechaHora,
  gps,
  modoCoordenadas,
  getValues,
}: Args) => {
  const draftUserKeyRef = useRef(draftUserKey);
  draftUserKeyRef.current = draftUserKey;
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const idUsuarioRef = useRef(idUsuario);
  idUsuarioRef.current = idUsuario;
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
    const userKey = draftUserKeyRef.current;
    const values = getValues();
    const def = defaultsRef.current;
    const idU = idUsuarioRef.current;
    const f = fotosRef.current;
    const fid = formIdRef.current;
    const fFecha = originalFechaHoraRef.current;
    const g = gpsRef.current;
    const modo = modoCoordenadasRef.current;
    if (!shouldPersistFormDraft(values, def, idU, f.length, g !== null)) {
      clearFormDraft(userKey);
      return;
    }
    saveFormDraft(userKey, {
      v: 1,
      savedAt: new Date().toISOString(),
      formId: fid,
      originalFechaHora: fFecha,
      idUsuario: idU,
      modoCoordenadas: modo,
      formValues: values,
      fotos: f,
      gps: g
        ? { latitud: g.latitud, longitud: g.longitud, precision: g.precision }
        : null,
    });
  }, [getValues]);

  useEffect(() => {
    return () => {
      flushDraftToStorage();
    };
  }, [flushDraftToStorage]);

  useEffect(() => {
    const userKey = draftUserKey;
    if (!shouldPersistFormDraft(formValues, defaults, idUsuario, fotos.length, gps !== null)) {
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
    idUsuario,
    fotos,
    formId,
    gps,
    originalFechaHora,
    flushDraftToStorage,
  ]);
};
