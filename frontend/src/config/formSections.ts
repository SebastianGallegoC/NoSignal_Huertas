import { REQUIRED_FIELDS, type FormFieldKey } from '@/types/formFields';

export interface FormSectionDef {
  id: string;
  title: string;
  fields: readonly FormFieldKey[];
}

export const FORM_SECTIONS: readonly FormSectionDef[] = [
  {
    id: 'actividad',
    title: 'Actividad y entidad aportante',
    fields: [
      'entidad_aportante',
      'tipo_organizacion_entidad_aportante',
      'nombre_actividad',
      'fecha_inicio',
      'fecha_fin',
      'tipo_proyecto_financiacion',
    ],
  },
  {
    id: 'coordenadas',
    title: 'Coordenadas (grados / minutos / segundos)',
    fields: [
      'x_grados',
      'x_minutos',
      'x_segundos',
      'longitud',
      'y_grados',
      'y_minutos',
      'y_segundos',
      'latitud',
    ],
  },
  {
    id: 'beneficiario',
    title: 'Beneficiario y contacto',
    fields: [
      'nombres_apellidos_beneficiario',
      'edad',
      'genero',
      'tipo_documento',
      'numero_documento',
      'telefono',
      'usuario_cens',
      'estado_factura',
    ],
  },
  {
    id: 'ubicacion',
    title: 'Ubicación del predio',
    fields: [
      'departamento',
      'municipio',
      'vereda',
      'direccion',
      'zona',
      'estrato',
      'sisben',
      'nivel_ingreso_promedio',
      'nombre_predio',
      'residencia',
      'tenencia_predio',
    ],
  },
  {
    id: 'nucleo',
    title: 'Núcleo familiar y ocupación',
    fields: [
      'numero_personas_nucleo_familiar',
      'numero_menores_edad',
      'numero_adultos_mayores',
      'mujer_cabeza_hogar',
      'persona_discapacidad',
      'ocupacion_principal',
      'perfil_social_priorizado',
    ],
  },
  {
    id: 'huerta',
    title: 'Huerta y riego',
    fields: [
      'area_huerta_m2',
      'tipo_espacio_huerta',
      'acceso_agua',
      'tipo_riego',
      'exposicion_solar_adecuada',
      'suelo_o_recipientes',
      'disponibilidad_mantenimiento',
    ],
  },
  {
    id: 'arbol',
    title: 'Árbol, suelo e intereses',
    fields: [
      'area_arbol_disponible',
      'tipo_suelo',
      'distancia_infraestructura_adecuada',
      'distancia_redes_electricas_adecuada',
      'interes_autoconsumo',
      'interes_comercializacion',
      'asistencia_capacitaciones',
      'permite_visitas',
      'compromiso_cuidado_arbol',
    ],
  },
  {
    id: 'autorizacion',
    title: 'Autorizaciones y criterios',
    fields: [
      'firma_acuerdo',
      'autoriza_tratamiento_datos',
      'autoriza_registros_fotograficos',
      'cumple_criterios_huerta',
      'cumple_criterios_arbol',
      'observaciones',
    ],
  },
  {
    id: 'seguimiento',
    title: 'Visitas y resultados',
    fields: [
      'fecha_visita_1',
      'fecha_visita_2',
      'fecha_visita_3',
      'estado_huerta_final',
      'estado_arbol_final',
      'produccion_kg',
      'satisfaccion_1_5',
    ],
  },
  {
    id: 'ambiente',
    title: 'Biodiversidad y cobertura',
    fields: [
      'especies_flora_fauna',
      'ecosistema_estrategico',
      'tipo_cobertura',
      'cercania_ronda_hidrica',
      'superficie_total_intervenida_m2',
      'total_especies_semillas_sembradas',
    ],
  },
] as const;

const covered = new Set<FormFieldKey>(FORM_SECTIONS.flatMap((s) => [...s.fields]));
const missing = REQUIRED_FIELDS.filter((f) => !covered.has(f));
const extra = [...covered].filter((f) => !(REQUIRED_FIELDS as readonly string[]).includes(f));

if (import.meta.env.DEV && (missing.length > 0 || extra.length > 0)) {
  console.error('FORM_SECTIONS desalineado con REQUIRED_FIELDS', { missing, extra });
}
