import { describe, expect, it } from "vitest";

import { normalizeZonaImportValue } from "./zonaNormalize";

describe("normalizeZonaImportValue", () => {
  it.each([
    ["URBANA", "Urbana"],
    ["  rural  ", "Rural"],
    ["RURAL", "Rural"],
    ["urbana", "Urbana"],
    ["", ""],
  ])("%s → %s", (input, expected) => {
    expect(normalizeZonaImportValue(input)).toBe(expected);
  });
});
