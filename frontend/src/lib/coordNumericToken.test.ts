import { describe, expect, it } from "vitest";

import { normalizeCoordNumericCell } from "./coordNumericToken";

describe("normalizeCoordNumericCell", () => {
  it.each([
    ["73°", "73"],
    ["  73 °  ", "73"],
    ["17'", "17"],
    ["17′", "17"],
    [`47''`, "47"],
    [`47″`, "47"],
    ["47,5''", "47.5"],
    ["-74.08175", "-74.08175"],
    ["  -74,1° ", "-74.1"],
    ["", ""],
    ["   ", ""],
    ["solo texto", ""],
  ])("%s → %s", (input, expected) => {
    expect(normalizeCoordNumericCell(input)).toBe(expected);
  });
});
