import Dexie, { type Table } from 'dexie';

export type SyncStatus = 'PENDIENTE' | 'SINCRONIZANDO' | 'ERROR';

export interface OfflineForm {
  id_formulario: string;
  id_usuario: string;
  fecha_hora: string;
  gps: {
    latitud: number;
    longitud: number;
    precision: number;
  };
  datos_formulario: Record<string, unknown>;
  fotos: Array<{
    nombre_archivo: string;
    data: string;
  }>;
  estado_sincronizacion: SyncStatus;
  fecha_intento?: string;
  errores_sync?: number;
  ultimo_error?: string;
}

export type EstadoHistorial = 'PENDIENTE' | 'ERROR' | 'ENVIADO';

export interface HistorialForm {
  id_formulario: string;
  id_usuario: string;
  fecha_hora: string;
  estado: EstadoHistorial;
  fecha_envio?: string;
  ultimo_error?: string;
  /** Copia local de respuestas (necesaria tras ENVIADO: se borra la fila en `formularios`). */
  datos_formulario?: Record<string, unknown>;
  gps?: OfflineForm['gps'];
  fotos?: OfflineForm['fotos'];
}

export interface SesionLocalRow {
  id: 'current';
  accessToken: string;
  username: string;
}

export class NoSignalDB extends Dexie {
  formularios!: Table<OfflineForm>;
  historialFormularios!: Table<HistorialForm>;
  sesionLocal!: Table<SesionLocalRow>;

  constructor() {
    super('NoSignalDB');
    this.version(1).stores({
      formularios: '&id_formulario, estado_sincronizacion, fecha_hora',
    });
    this.version(2).stores({
      formularios: '&id_formulario, estado_sincronizacion, fecha_hora',
      sesionLocal: 'id',
    });
    this.version(3).stores({
      formularios: '&id_formulario, estado_sincronizacion, fecha_hora',
      historialFormularios: '&id_formulario, estado, fecha_hora',
      sesionLocal: 'id',
    });
    this.version(4).stores({
      formularios: '&id_formulario, estado_sincronizacion, fecha_hora',
      historialFormularios: '&id_formulario, estado, fecha_hora',
      sesionLocal: 'id',
    });
  }
}

export const db = new NoSignalDB();
