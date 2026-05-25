import { describe, expect, it } from "vitest";

import {
  isEditFormDraft,
  resolveInitialFormDraft,
  type FormDraftV1,
} from "@/services/formDraftStorage";
import { REQUIRED_FIELDS, type FormValues } from "@/types/formFields";

function emptyValues(): FormValues {
  return Object.fromEntries(REQUIRED_FIELDS.map((k) => [k, ""])) as FormValues;
}

function draft(overrides: Partial<FormDraftV1> = {}): FormDraftV1 {
  return {
    v: 1,
    savedAt: "2026-01-01T00:00:00Z",
    formId: "id-1",
    formValues: { ...emptyValues(), nombres_apellidos_beneficiario: "Ana" },
    fotos: [],
    gps: null,
    ...overrides,
  };
}

describe("resolveInitialFormDraft", () => {
  it("freshForm ignora borrador de edición", () => {
    const d = draft({ originalFechaHora: "2026-01-01T00:00:00Z" });
    expect(resolveInitialFormDraft(d, { freshForm: true })).toBeNull();
  });

  it("fromEdit carga borrador de edición", () => {
    const d = draft({ originalFechaHora: "2026-01-01T00:00:00Z" });
    expect(resolveInitialFormDraft(d, { fromEdit: true })).toBe(d);
  });

  it("sin fromEdit descarta borrador de edición (formulario nuevo)", () => {
    const d = draft({ originalFechaHora: "2026-01-01T00:00:00Z" });
    expect(resolveInitialFormDraft(d, null)).toBeNull();
  });

  it("carga borrador de formulario nuevo sin originalFechaHora", () => {
    const d = draft();
    expect(resolveInitialFormDraft(d, { freshForm: true })).toBeNull();
    expect(resolveInitialFormDraft(d, null)).toBe(d);
  });
});

describe("isEditFormDraft", () => {
  it("detecta edición por originalFechaHora", () => {
    expect(isEditFormDraft(draft({ originalFechaHora: "2026-01-01" }))).toBe(
      true,
    );
    expect(isEditFormDraft(draft())).toBe(false);
  });
});
