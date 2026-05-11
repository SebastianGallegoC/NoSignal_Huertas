import { describe, expect, it } from "vitest";

import gpsLimits from "@gpsLimits";
import {
  LEGACY_API_MAX_GPS_ACCURACY_METERS,
  MAX_GPS_ACCURACY_METERS,
  MAX_GPS_PRECISION_METERS,
  MIN_GPS_PRECISION_METERS,
} from "@/constants/gpsConfig";

describe("gpsConfig (config/gps-limits.json)", () => {
  it("exporta los mismos valores que el JSON canónico", () => {
    expect(MIN_GPS_PRECISION_METERS).toBe(gpsLimits.minGpsPrecisionMeters);
    expect(MAX_GPS_PRECISION_METERS).toBe(gpsLimits.maxGpsPrecisionCapMeters);
    expect(MAX_GPS_ACCURACY_METERS).toBe(gpsLimits.maxGpsAccuracyMeters);
    expect(LEGACY_API_MAX_GPS_ACCURACY_METERS).toBe(
      gpsLimits.legacyApiMaxGpsAccuracyMeters,
    );
  });

  it("mantiene reglas mínimas esperadas", () => {
    expect(MIN_GPS_PRECISION_METERS).toBeGreaterThan(0);
    expect(MAX_GPS_ACCURACY_METERS).toBeLessThanOrEqual(
      MAX_GPS_PRECISION_METERS,
    );
  });
});
