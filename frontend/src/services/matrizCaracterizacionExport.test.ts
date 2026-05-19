import ExcelJS from "exceljs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GPS_PLACEHOLDER_WHEN_NOT_CAPTURED } from "@/constants/gpsConfig";
import { COORD_NUMERIC_FIELD_KEYS } from "@/lib/coordNumericToken";
import type { OfflineForm } from "@/services/db";
import { REQUIRED_FIELDS, type FormFieldKey } from "@/types/formFields";

import {
  MATRIZ_F_PSA_HEADERS,
  MATRIZ_ROW_CELL_SOURCES,
  MATRIZ_SHEET_NAME,
  buildMatrizCaracterizacionWorkbookBulk,
  buildMatrizCaracterizacionRow,
  buildMatrizCaracterizacionWorkbook,
  downloadMatrizCaracterizacionBulkXlsx,
  downloadMatrizCaracterizacionXlsx,
  formatFechaMatriz,
  matrizCaracterizacionBulkFilename,
  matrizCaracterizacionFilename,
} from "./matrizCaracterizacionExport";

const minimalForm = (): OfflineForm => ({
  id_formulario: "test-id",
  id_usuario: "u1",
  fecha_hora: "2026-05-05T12:00:00.000Z",
  gps: { latitud: 7.5, longitud: -72.25, precision: 4 },
  datos_formulario: {},
  fotos: [],
  estado_sincronizacion: "PENDIENTE",
});

describe("matrizCaracterizacionExport — encabezados y definición de fila", () => {
  it("define 76 encabezados y 76 fuentes de celda", () => {
    expect(MATRIZ_F_PSA_HEADERS.length).toBe(76);
    expect(MATRIZ_ROW_CELL_SOURCES.length).toBe(76);
    expect(MATRIZ_F_PSA_HEADERS[0]).toBe("ID");
    expect(MATRIZ_F_PSA_HEADERS[7]).toContain("BENEFICIARIO");
  });

  it("cada campo del formulario (salvo longitud/latitud decimales) aparece en la definición de exportación", () => {
    const keysInSources = new Set<FormFieldKey>();
    for (const src of MATRIZ_ROW_CELL_SOURCES) {
      if (src.kind === "field" || src.kind === "fecha") {
        keysInSources.add(src.key);
      }
    }
    for (const k of REQUIRED_FIELDS) {
      if (k === "longitud" || k === "latitud") {
        expect(keysInSources.has(k)).toBe(false);
        continue;
      }
      expect(keysInSources.has(k), `falta en matriz: ${k}`).toBe(true);
    }
    expect(keysInSources.size).toBe(REQUIRED_FIELDS.length - 2);
  });
});

describe("formatFechaMatriz", () => {
  it("convierte ISO a DD/MM/AAAA (UTC)", () => {
    expect(formatFechaMatriz("2026-03-15T00:00:00.000Z")).toBe("15/03/2026");
  });

  it("convierte YYYY-MM-DD sin desfase de zona horaria", () => {
    expect(formatFechaMatriz("2026-03-15")).toBe("15/03/2026");
  });

  it("deja DD/MM/AAAA sin cambios", () => {
    expect(formatFechaMatriz("05/04/2026")).toBe("05/04/2026");
  });

  it("cadena vacía → vacío", () => {
    expect(formatFechaMatriz("")).toBe("");
    expect(formatFechaMatriz("   ")).toBe("");
  });

  it("texto no parseable se devuelve tal cual", () => {
    expect(formatFechaMatriz("pronto")).toBe("pronto");
  });
});

describe("buildMatrizCaracterizacionRow", () => {
  it("produce 76 celdas string y usa GPS si faltan longitud/latitud en datos", () => {
    const f = minimalForm();
    f.datos_formulario = {
      entidad_aportante: "Entidad X",
      nombres_apellidos_beneficiario: "María López",
    };
    const row = buildMatrizCaracterizacionRow(f);
    expect(row).toHaveLength(76);
    expect(row.every((c) => typeof c === "string")).toBe(true);
    expect(row[0]).toBe("test-id");
    expect(row[1]).toBe("Entidad X");
    expect(row[7]).toBe("María López");
    expect(row[29]).toContain("-72.25");
    expect(row[33]).toContain("7.5");
  });

  it("deja vacías longitud/latitud y GMS en 0 cuando no hay GPS real", () => {
    const f = minimalForm();
    f.gps = { ...GPS_PLACEHOLDER_WHEN_NOT_CAPTURED };
    f.datos_formulario = {
      x_grados: "0",
      x_minutos: "0",
      x_segundos: "0",
      latitud: "4.60971",
    };
    const row = buildMatrizCaracterizacionRow(f);
    expect(row[26]).toBe("");
    expect(row[27]).toBe("");
    expect(row[28]).toBe("");
    expect(row[29]).toBe("");
    expect(row[33]).toBe("4.60971");
  });

  it("exporta minutos/segundos vacíos en lugar de 0 cuando no se diligenciaron", () => {
    const f = minimalForm();
    f.gps = { ...GPS_PLACEHOLDER_WHEN_NOT_CAPTURED };
    f.datos_formulario = {
      x_grados: "73",
      x_minutos: "0",
      x_segundos: "0",
    };
    const row = buildMatrizCaracterizacionRow(f);
    expect(row[26]).toBe("73");
    expect(row[27]).toBe("");
    expect(row[28]).toBe("");
  });

  it("prioriza longitud y latitud del formulario sobre el objeto gps", () => {
    const f = minimalForm();
    f.datos_formulario = {
      longitud: "-74.123456",
      latitud: "5.987654",
    };
    const row = buildMatrizCaracterizacionRow(f);
    expect(row[29]).toBe("-74.123456");
    expect(row[33]).toBe("5.987654");
  });

  it("alinea cada columna con MATRIZ_ROW_CELL_SOURCES cuando los datos llevan prefijo único", () => {
    const datos: Record<string, string> = {};
    for (const k of REQUIRED_FIELDS) {
      if (COORD_NUMERIC_FIELD_KEYS.has(k)) {
        if (k === "longitud") {
          datos[k] = "-74.1";
        } else if (k === "latitud") {
          datos[k] = "4.6";
        } else {
          datos[k] = "12";
        }
        continue;
      }
      datos[k] = `v:${k}`;
    }
    const f = minimalForm();
    f.datos_formulario = datos;

    const row = buildMatrizCaracterizacionRow(f);
    MATRIZ_ROW_CELL_SOURCES.forEach((src, i) => {
      if (src.kind === "id_formulario") {
        expect(row[i]).toBe("test-id");
        return;
      }
      if (src.kind === "field") {
        if (COORD_NUMERIC_FIELD_KEYS.has(src.key)) {
          expect(row[i]).toBe(datos[src.key]);
          return;
        }
        expect(row[i]).toBe(`v:${src.key}`);
        return;
      }
      if (src.kind === "fecha") {
        expect(row[i]).toBe(formatFechaMatriz(`v:${src.key}`));
        return;
      }
      if (src.kind === "lon") {
        expect(row[i]).toBe("-74.1");
        return;
      }
      if (src.kind === "lat") {
        expect(row[i]).toBe("4.6");
      }
    });
  });
});

describe("matrizCaracterizacionFilename", () => {
  it("usa beneficiario y fecha_hora del envío en el nombre", () => {
    const f = minimalForm();
    f.fecha_hora = "2026-05-05T17:42:10.000Z";
    f.datos_formulario = {
      nombres_apellidos_beneficiario: "María José Pérez",
    };
    const name = matrizCaracterizacionFilename(f);
    expect(name).toBe("Maria_Jose_Perez-2026-05-05_17-42.xlsx");
  });

  it("usa fallback cuando no hay beneficiario o fecha válida", () => {
    const f = minimalForm();
    f.fecha_hora = "fecha-rara";
    f.datos_formulario = {};
    expect(matrizCaracterizacionFilename(f)).toBe("sin_beneficiario-sin_fecha.xlsx");
  });
});

describe("matrizCaracterizacionBulkFilename", () => {
  it("genera nombre consolidado solo con fecha UTC", () => {
    const name = matrizCaracterizacionBulkFilename(
      new Date("2026-05-05T17:42:10.000Z"),
    );
    expect(name).toBe("Formularios_diligenciados_2026-05-05.xlsx");
  });
});

describe("buildMatrizCaracterizacionWorkbook", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("usa PLANTILLA.xlsx por defecto para construir el libro", async () => {
    const template = new ExcelJS.Workbook();
    const ws = template.addWorksheet("F-PSA-08");
    ws.getCell(7, 1).value = "ID";
    const templateBuffer = await template.xlsx.writeBuffer();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => templateBuffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const f = minimalForm();
    f.datos_formulario = { entidad_aportante: "Desde plantilla" };
    const wb = await buildMatrizCaracterizacionWorkbook(f);

    expect(String(fetchMock.mock.calls[0][0])).toContain("/PLANTILLA.xlsx");
    const wsOut = wb.getWorksheet("F-PSA-08");
    expect(wsOut?.getCell(8, 2).value).toBe("Desde plantilla");
  });

  it("escribe título, cabeceras fila 7 y datos fila 8; roundtrip conserva valores", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) }),
    );
    const f = minimalForm();
    f.datos_formulario = {
      entidad_aportante: "CENS",
      nombres_apellidos_beneficiario: "Ana Gómez",
      observaciones: "Nota fin",
    };

    const wb = await buildMatrizCaracterizacionWorkbook(f);
    const ws = wb.getWorksheet(MATRIZ_SHEET_NAME);
    expect(ws).toBeTruthy();
    expect(ws!.getCell(5, 5).value).toBe("CARACTERIZACIÓN SOCIAL");
    expect(ws!.getCell(7, 1).value).toBe(MATRIZ_F_PSA_HEADERS[0]);
    expect(ws!.getCell(7, 76).value).toBe(MATRIZ_F_PSA_HEADERS[75]);
    expect(ws!.getCell(8, 2).value).toBe("CENS");
    expect(ws!.getCell(8, 8).value).toBe("Ana Gómez");

    const buf = await wb.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(2500);

    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(buf);
    const ws2 = wb2.getWorksheet(MATRIZ_SHEET_NAME);
    expect(ws2!.getCell(8, 63).value).toBe("Nota fin");
  });
});

describe("buildMatrizCaracterizacionWorkbookBulk", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("escribe fecha_inicio del primer formulario en la columna FECHA INICIO", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) }),
    );
    const f1 = minimalForm();
    f1.datos_formulario = { fecha_inicio: "2026-05-01" };
    const wb = await buildMatrizCaracterizacionWorkbookBulk([f1]);
    const ws = wb.getWorksheet(MATRIZ_SHEET_NAME);
    expect(ws?.getCell(8, 5).value).toBe("01/05/2026");
  });

  it("escribe múltiples formularios desde la fila 8 en una sola hoja", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) }),
    );
    const f1 = minimalForm();
    f1.id_formulario = "f-1";
    f1.datos_formulario = { nombres_apellidos_beneficiario: "Ana Uno" };
    const f2 = minimalForm();
    f2.id_formulario = "f-2";
    f2.datos_formulario = { nombres_apellidos_beneficiario: "Beto Dos" };

    const wb = await buildMatrizCaracterizacionWorkbookBulk([f1, f2]);
    const ws = wb.getWorksheet(MATRIZ_SHEET_NAME);
    expect(ws?.getCell(8, 8).value).toBe("Ana Uno");
    expect(ws?.getCell(9, 8).value).toBe("Beto Dos");
  });
});

describe("downloadMatrizCaracterizacionXlsx", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("genera blob, enlace temporal y revoca la URL", async () => {
    const f = minimalForm();
    f.datos_formulario = { entidad_aportante: "X" };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) }),
    );
    const createSpy = vi.fn(() => "blob:test-matriz");
    const revokeSpy = vi.fn();
    const origCreate = (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    const origRevoke = (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createSpy,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeSpy,
    });

    const clickSpy = vi.fn();
    const removeSpy = vi.fn();
    const mockAnchor = {
      href: "",
      download: "",
      rel: "",
      click: clickSpy,
      remove: removeSpy,
    } as unknown as HTMLAnchorElement;

    const createElSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        if (tag === "a") {
          return mockAnchor;
        }
        return document.createElement.bind(document)(tag as "div");
      });
    const appendSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation(() => mockAnchor);

    await downloadMatrizCaracterizacionXlsx(f);

    expect(createSpy).toHaveBeenCalled();
    expect(mockAnchor.download).toBe("sin_beneficiario-2026-05-05_12-00.xlsx");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledWith(mockAnchor);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith("blob:test-matriz");

    createElSpy.mockRestore();
    appendSpy.mockRestore();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: origCreate,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: origRevoke,
    });
  });
});

describe("downloadMatrizCaracterizacionBulkXlsx", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("descarga un solo archivo consolidado", async () => {
    const f = minimalForm();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) }),
    );
    const createSpy = vi.fn(() => "blob:test-matriz-bulk");
    const revokeSpy = vi.fn();
    const origCreate = (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    const origRevoke = (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createSpy,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeSpy,
    });
    const clickSpy = vi.fn();
    const removeSpy = vi.fn();
    const mockAnchor = {
      href: "",
      download: "",
      rel: "",
      click: clickSpy,
      remove: removeSpy,
    } as unknown as HTMLAnchorElement;
    const createElSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        if (tag === "a") {
          return mockAnchor;
        }
        return document.createElement.bind(document)(tag as "div");
      });
    const appendSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation(() => mockAnchor);

    await downloadMatrizCaracterizacionBulkXlsx([f]);

    expect(mockAnchor.download).toMatch(
      /^Formularios_diligenciados_\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith("blob:test-matriz-bulk");
    createElSpy.mockRestore();
    appendSpy.mockRestore();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: origCreate,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: origRevoke,
    });
  });
});
