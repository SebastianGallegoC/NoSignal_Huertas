import { create } from 'zustand';

import { randomUuid } from '@/lib/randomUuid';

interface FormState {
  id_formulario: string;
  pasoActual: number;
  datosPrincipales: Record<string, unknown>;
  fotos: Array<{ file: File; url_temporal: string }>;
  gps: { latitud: number; longitud: number; precision: number } | null;

  setDato: (campo: string, valor: unknown) => void;
  avanzarPaso: () => void;
  retrocederPaso: () => void;
  setGPS: (lat: number, lng: number, acc: number) => void;
  agregarFoto: (file: File, url: string) => void;
  quitarFoto: (index: number) => void;
  resetearFormulario: () => void;
}

export const useFormStore = create<FormState>((set) => ({
  id_formulario: randomUuid(),
  pasoActual: 1,
  datosPrincipales: {},
  fotos: [],
  gps: null,

  setDato: (campo, valor) =>
    set((state) => ({
      datosPrincipales: { ...state.datosPrincipales, [campo]: valor },
    })),

  avanzarPaso: () => set((state) => ({ pasoActual: state.pasoActual + 1 })),
  retrocederPaso: () => set((state) => ({ pasoActual: state.pasoActual > 1 ? state.pasoActual - 1 : 1 })),

  setGPS: (lat, lng, acc) => set({ gps: { latitud: lat, longitud: lng, precision: acc } }),

  agregarFoto: (file, url) => set((state) => ({ fotos: [...state.fotos, { file, url_temporal: url }] })),
  quitarFoto: (index) =>
    set((state) => ({
      fotos: state.fotos.filter((_, i) => i !== index),
    })),

  resetearFormulario: () =>
    set({
      id_formulario: randomUuid(),
      pasoActual: 1,
      datosPrincipales: {},
      fotos: [],
      gps: null,
    }),
}));
