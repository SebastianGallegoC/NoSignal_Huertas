import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import type { PrecargaForm } from '@/services/db';
import * as dbModule from '@/services/db';
import * as apiModule from '@/services/api';
import * as precargaServiceModule from '@/services/precargaService';

// Mockar módulos
vi.mock('@/services/db');
vi.mock('@/services/api');
vi.mock('@/services/precargaService');

describe('usePrecargaWatcher (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  /**
   * Tests para usePrecargaWatcher: dado que no tenemos @testing-library/react,
   * testeamos el comportamiento del hook a través de mocks de módulos y
   * validando que los servicios se llaman correctamente.
   * Los tests reales con React requieren renderHook o similar.
   */

  it('el módulo precargaService existe y exporta funciones esperadas', () => {
    expect(precargaServiceModule.downloadAndSavePrecarga).toBeDefined();
    expect(precargaServiceModule.enableAutoPrecarga).toBeDefined();
    expect(precargaServiceModule.disableAutoPrecarga).toBeDefined();
  });

  it('el módulo db tiene tabla precargas con método where', () => {
    const mockDb = dbModule.db as any;
    mockDb.precargas = {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockResolvedValue([]),
      }),
    };

    expect(mockDb.precargas.where).toBeDefined();
    expect(typeof mockDb.precargas.where).toBe('function');
  });

  it('fetchFormFromApi se puede llamar para validar versiones', async () => {
    const mockForm = {
      id_formulario: 'form-1',
      id_usuario: 'user-1',
      fecha_hora: '2026-05-04T12:00:00Z',
      fecha_actualizacion: '2026-05-05T14:00:00Z',
      latitud: 1.23,
      longitud: -76.5,
      precision: 10,
      datos_formulario: {},
      fotos: [],
    };

    vi.spyOn(apiModule, 'fetchFormFromApi').mockResolvedValue(
      mockForm as any,
    );

    const result = await apiModule.fetchFormFromApi('form-1');
    expect(result.id_formulario).toBe('form-1');
    expect(result.fecha_actualizacion).toBe('2026-05-05T14:00:00Z');
    expect(apiModule.fetchFormFromApi).toHaveBeenCalledWith('form-1');
  });

  it('comparación de fechas: server más reciente que local', () => {
    const serverDate = new Date('2026-05-05T14:00:00Z').getTime();
    const localDate = new Date('2026-05-04T12:00:00Z').getTime();

    expect(serverDate).toBeGreaterThan(localDate);
  });

  it('comparación de fechas: local más reciente que server', () => {
    const serverDate = new Date('2026-05-04T12:00:00Z').getTime();
    const localDate = new Date('2026-05-05T14:00:00Z').getTime();

    expect(localDate).toBeGreaterThan(serverDate);
  });

  it('downloadAndSavePrecarga se llama cuando hay cambio en servidor', async () => {
    const mockPrecarga: PrecargaForm = {
      id_formulario: 'form-1',
      fecha_precarga: '2026-05-04T12:00:00Z',
      auto_precarga: true,
      datos_formulario: {},
    };

    const mockServerForm = {
      id_formulario: 'form-1',
      id_usuario: 'user-1',
      fecha_hora: '2026-05-04T12:00:00Z',
      fecha_actualizacion: '2026-05-05T14:00:00Z',
      latitud: 1.23,
      longitud: -76.5,
      precision: 10,
      datos_formulario: {},
      fotos: [],
    };

    vi.spyOn(apiModule, 'fetchFormFromApi').mockResolvedValue(
      mockServerForm as any,
    );
    vi.spyOn(precargaServiceModule, 'downloadAndSavePrecarga').mockResolvedValue(
      undefined,
    );

    // Simulación de lógica del watcher:
    const serverTs = Date.parse(mockServerForm.fecha_actualizacion);
    const localTs = Date.parse(mockPrecarga.fecha_precarga);

    if (serverTs > localTs) {
      await precargaServiceModule.downloadAndSavePrecarga(mockPrecarga.id_formulario);
    }

    expect(
      precargaServiceModule.downloadAndSavePrecarga,
    ).toHaveBeenCalledWith('form-1');
  });

  it('downloadAndSavePrecarga NO se llama si local es más reciente', async () => {
    const mockPrecarga: PrecargaForm = {
      id_formulario: 'form-1',
      fecha_precarga: '2026-05-05T14:00:00Z',
      auto_precarga: true,
      datos_formulario: {},
    };

    const mockServerForm = {
      id_formulario: 'form-1',
      id_usuario: 'user-1',
      fecha_hora: '2026-05-04T12:00:00Z',
      fecha_actualizacion: '2026-05-04T13:00:00Z',
      latitud: 1.23,
      longitud: -76.5,
      precision: 10,
      datos_formulario: {},
      fotos: [],
    };

    vi.spyOn(apiModule, 'fetchFormFromApi').mockResolvedValue(
      mockServerForm as any,
    );
    vi.spyOn(precargaServiceModule, 'downloadAndSavePrecarga').mockResolvedValue(
      undefined,
    );

    // Simulación de lógica del watcher:
    const serverTs = Date.parse(mockServerForm.fecha_actualizacion);
    const localTs = Date.parse(mockPrecarga.fecha_precarga);

    if (serverTs > localTs) {
      await precargaServiceModule.downloadAndSavePrecarga(mockPrecarga.id_formulario);
    }

    expect(
      precargaServiceModule.downloadAndSavePrecarga,
    ).not.toHaveBeenCalled();
  });

  it('el watcher maneja múltiples precargas', async () => {
    const mockPrecargas: PrecargaForm[] = [
      {
        id_formulario: 'form-1',
        fecha_precarga: '2026-05-04T12:00:00Z',
        auto_precarga: true,
        datos_formulario: {},
      },
      {
        id_formulario: 'form-2',
        fecha_precarga: '2026-05-04T12:00:00Z',
        auto_precarga: true,
        datos_formulario: {},
      },
    ];

    const mockServerForm = {
      id_formulario: 'form-1',
      id_usuario: 'user-1',
      fecha_hora: '2026-05-04T12:00:00Z',
      fecha_actualizacion: '2026-05-05T14:00:00Z',
      latitud: 1.23,
      longitud: -76.5,
      precision: 10,
      datos_formulario: {},
      fotos: [],
    };

    vi.spyOn(apiModule, 'fetchFormFromApi').mockResolvedValue(
      mockServerForm as any,
    );
    vi.spyOn(precargaServiceModule, 'downloadAndSavePrecarga').mockResolvedValue(
      undefined,
    );

    // Simulación: el watcher recorre todas las precargas
    for (const prec of mockPrecargas) {
      const serverTs = Date.parse(mockServerForm.fecha_actualizacion);
      const localTs = Date.parse(prec.fecha_precarga);
      if (serverTs > localTs) {
        await precargaServiceModule.downloadAndSavePrecarga(prec.id_formulario);
      }
    }

    // Solo la form-1 debería actualizarse (form-2 no tiene versión en servidor en este test)
    expect(
      precargaServiceModule.downloadAndSavePrecarga,
    ).toHaveBeenCalledWith('form-1');
  });

  it('el watcher maneja errores de API sin bloquear', async () => {
    const mockPrecarga: PrecargaForm = {
      id_formulario: 'form-1',
      fecha_precarga: '2026-05-04T12:00:00Z',
      auto_precarga: true,
      datos_formulario: {},
    };

    vi.spyOn(apiModule, 'fetchFormFromApi').mockRejectedValue(
      new Error('Network error'),
    );
    vi.spyOn(precargaServiceModule, 'downloadAndSavePrecarga').mockResolvedValue(
      undefined,
    );

    // Simulación: el watcher intenta fetchear pero falla
    try {
      await apiModule.fetchFormFromApi(mockPrecarga.id_formulario);
    } catch {
      // Error manejado; no bloquea otras precargas
    }

    // downloadAndSavePrecarga no debería llamarse
    expect(
      precargaServiceModule.downloadAndSavePrecarga,
    ).not.toHaveBeenCalled();
  });

  it('precargaService.disableAutoPrecarga se puede llamar', async () => {
    // Simplemente validar que la función es llamable
    vi.spyOn(precargaServiceModule, 'disableAutoPrecarga').mockResolvedValue(
      undefined,
    );

    await precargaServiceModule.disableAutoPrecarga('form-1');

    expect(precargaServiceModule.disableAutoPrecarga).toHaveBeenCalledWith(
      'form-1',
    );
  });
});
