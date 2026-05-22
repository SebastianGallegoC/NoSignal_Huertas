import type { FormFieldKey } from '@/types/formFields';
import { fieldSelectOptions } from '@/config/formSelectOptions';

const TRI_FIELDS = new Set<FormFieldKey>([
  'mujer_cabeza_hogar',
  'persona_discapacidad',
  'interes_autoconsumo',
  'interes_comercializacion',
  'asistencia_capacitaciones',
  'permite_visitas',
  'compromiso_cuidado_arbol',
  'firma_acuerdo',
  'autoriza_tratamiento_datos',
  'autoriza_registros_fotograficos',
  'cumple_criterios_huerta',
  'cumple_criterios_arbol',
]);

const NUMBER_FIELDS = new Set<FormFieldKey>([
  'edad',
  'numero_personas_nucleo_familiar',
  'numero_menores_edad',
  'numero_adultos_mayores',
  'area_huerta_m2',
  'produccion_kg',
  'satisfaccion_1_5',
  'superficie_total_intervenida_m2',
  'total_especies_semillas_sembradas',
  'metros_sobre_nivel_mar',
  'estrato',
  'usuario_cens',
]);

export type InputKind = 'date' | 'number' | 'select' | 'select-tri' | 'textarea' | 'text';

export const inputKindForField = (field: FormFieldKey): InputKind => {
  if (field === 'observaciones') {
    return 'textarea';
  }
  if (field.includes('fecha')) {
    return 'date';
  }
  if (TRI_FIELDS.has(field)) {
    return 'select-tri';
  }
  if (fieldSelectOptions[field]) {
    return 'select';
  }
  if (NUMBER_FIELDS.has(field)) {
    return 'number';
  }
  if (
    field === 'latitud' ||
    field === 'longitud' ||
    field === 'metros_sobre_nivel_mar'
  ) {
    return 'number';
  }
  return 'text';
};

/** Campos tipo select solo Si/No: en importación se normalizan variantes (tildes, NO APLICA, etc.). */
export const SI_NO_IMPORT_NORMALIZE_FIELDS = new Set<FormFieldKey>([
  'area_arbol_disponible',
]);

export const triOptions = [
  { value: '', label: '' },
  { value: 'Si', label: 'Sí' },
  { value: 'No', label: 'No' },
  { value: 'NR', label: 'NR' },
] as const;

export const fieldLabel = (field: FormFieldKey): string =>
  (
    {
      tipo_proyecto_financiacion: 'Tipo Proyecto/Financiación',
      usuario_cens: 'N° Usuario Cens',
      zona: 'Zona(Urbana-Rural)',
      suelo_o_recipientes: 'Suelo o Recipientes',
      satisfaccion_1_5: 'Nivel de Satisfacción 1-5',
      distancia_infraestructura_adecuada:
        'Distancia Infraestructura Adecuada',
      metros_sobre_nivel_mar: 'Metros sobre el nivel del mar',
    } as Partial<Record<FormFieldKey, string>>
  )[field] ??
  field
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
