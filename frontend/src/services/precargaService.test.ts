import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { PrecargaForm } from '@/services/db';
import * as precargaService from '@/services/precargaService';
import * as apiModule from '@/services/api';
import * as dbModule from '@/services/db';

// Mockar módulos
vi.mock('@/services/api');
vi.mock('@/services/db');

describe('precargaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('downloadAndSavePrecarga', () => {
    it('guarda coordenadas GPS correctamente', async () => {
      const mockForm = {
        id_formulario: 'form-1',
        id_usuario: 'user-1',
        fecha_hora: '2026-05-04T12:00:00Z',
        latitud: 4.5678,
        longitud: -74.1234,
        precision: 5,
        datos_formulario: {},
        fotos: [],
      };

      vi.spyOn(apiModule, 'fetchFormFromApi').mockResolvedValue(
        mockForm as any,
      );

      const mockDb = dbModule.db as any;
      mockDb.precargas = { put: vi.fn().mockResolvedValue(undefined) };

      await precargaService.downloadAndSavePrecarga('form-1');

      expect(mockDb.precargas.put).toHaveBeenCalled();
      const savedData = (mockDb.precargas.put as any).mock.calls[0][0];
      expect(savedData.gps).toEqual({
        latitud: 4.5678,
        longitud: -74.1234,
        precision: 5,
      });
    });

    it('preserva datos del formulario en precarga', async () => {
      const mockForm = {
        id_formulario: 'form-1',
        id_usuario: 'user-1',
        fecha_hora: '2026-05-04T12:00:00Z',
        latitud: 1.23,
        longitud: -76.5,
        precision: 10,
        datos_formulario: { nombres_apellidos_beneficiario: 'Juan García' },
        fotos: [],
      };

      vi.spyOn(apiModule, 'fetchFormFromApi').mockResolvedValue(
        mockForm as any,
      );

      const mockDb = dbModule.db as any;
      mockDb.precargas = { put: vi.fn().mockResolvedValue(undefined) };

      await precargaService.downloadAndSavePrecarga('form-1');

      expect(mockDb.precargas.put).toHaveBeenCalled();
      const savedData = (mockDb.precargas.put as any).mock.calls[0][0];
      expect(savedData.datos_formulario).toEqual(mockForm.datos_formulario);
    });

    it('marca auto_precarga como true al guardar', async () => {
      const mockForm = {
        id_formulario: 'form-1',
        id_usuario: 'user-1',
        fecha_hora: '2026-05-04T12:00:00Z',
        latitud: 1.23,
        longitud: -76.5,
        precision: 10,
        datos_formulario: {},
        fotos: [],
      };

      vi.spyOn(apiModule, 'fetchFormFromApi').mockResolvedValue(
        mockForm as any,
      );

      const mockDb = dbModule.db as any;
      mockDb.precargas = { put: vi.fn().mockResolvedValue(undefined) };

      await precargaService.downloadAndSavePrecarga('form-1');

      expect(mockDb.precargas.put).toHaveBeenCalled();
      const savedData = (mockDb.precargas.put as any).mock.calls[0][0];
      expect(savedData.auto_precarga).toBe(true);
    });
  });

  describe('enableAutoPrecarga', () => {
    it('activa precarga si ya existe', async () => {
      const existingPrecarga: PrecargaForm = {
        id_formulario: 'form-1',
        fecha_precarga: '2026-05-04T12:00:00Z',
        datos_formulario: {},
        auto_precarga: false,
      };

      const mockDb = dbModule.db as any;
      mockDb.precargas = {
        get: vi.fn().mockResolvedValue(existingPrecarga),
        update: vi.fn().mockResolvedValue(undefined),
      };

      await precargaService.enableAutoPrecarga('form-1');

      expect(mockDb.precargas.update).toHaveBeenCalledWith('form-1', {
        auto_precarga: true,
      });
    });

    it('crea nueva precarga si no existe', async () => {
      const mockForm = {
        id_formulario: 'form-1',
        id_usuario: 'user-1',
        fecha_hora: '2026-05-04T12:00:00Z',
        latitud: 1.23,
        longitud: -76.5,
        precision: 10,
        datos_formulario: {},
        fotos: [],
      };

      const mockDb = dbModule.db as any;
      mockDb.precargas = {
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
      };

      vi.spyOn(apiModule, 'fetchFormFromApi').mockResolvedValue(
        mockForm as any,
      );

      await precargaService.enableAutoPrecarga('form-1');

      expect(mockDb.precargas.put).toHaveBeenCalled();
      const savedData = (mockDb.precargas.put as any).mock.calls[0][0];
      expect(savedData.auto_precarga).toBe(true);
    });
  });

  describe('disableAutoPrecarga', () => {
    it('elimina la precarga del formulario', async () => {
      const mockDb = dbModule.db as any;
      mockDb.precargas = { delete: vi.fn().mockResolvedValue(undefined) };

      await precargaService.disableAutoPrecarga('form-1');

      expect(mockDb.precargas.delete).toHaveBeenCalledWith('form-1');
    });

    it('no lanza error si precarga no existe', async () => {
      const mockDb = dbModule.db as any;
      mockDb.precargas = {
        delete: vi.fn().mockRejectedValue(new Error('Not found')),
      };

      // Should not throw
      await expect(
        precargaService.disableAutoPrecarga('form-1'),
      ).resolves.not.toThrow();
    });
  });

  describe('deletePrecarga', () => {
    it('elimina una precarga', async () => {
      const mockDb = dbModule.db as any;
      mockDb.precargas = { delete: vi.fn().mockResolvedValue(undefined) };

      await precargaService.deletePrecarga('form-1');

      expect(mockDb.precargas.delete).toHaveBeenCalledWith('form-1');
    });
  });

  describe('exports', () => {
    it('exporta todas las funciones esperadas', () => {
      expect(precargaService.downloadAndSavePrecarga).toBeDefined();
      expect(precargaService.enableAutoPrecarga).toBeDefined();
      expect(precargaService.disableAutoPrecarga).toBeDefined();
      expect(precargaService.deletePrecarga).toBeDefined();
    });
  });
});
