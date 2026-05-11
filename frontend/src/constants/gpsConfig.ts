import gpsLimits from "@gpsLimits";

export const MIN_GPS_PRECISION_METERS = gpsLimits.minGpsPrecisionMeters;
export const MAX_GPS_PRECISION_METERS = gpsLimits.maxGpsPrecisionCapMeters;
export const MAX_GPS_ACCURACY_METERS = gpsLimits.maxGpsAccuracyMeters;
export const LEGACY_API_MAX_GPS_ACCURACY_METERS =
  gpsLimits.legacyApiMaxGpsAccuracyMeters;

/**
 * Punto usado cuando no hay captura GPS: cumple el esquema del API y la validación
 * de envío (solo se exige nombre del beneficiario).
 */
export const GPS_PLACEHOLDER_WHEN_NOT_CAPTURED = {
  latitud: 0,
  longitud: 0,
  precision: MAX_GPS_ACCURACY_METERS,
} as const;
