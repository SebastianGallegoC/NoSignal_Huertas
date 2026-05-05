import ExcelJS from "exceljs";

import type { OfflineForm } from "@/services/db";
import type { FormFieldKey } from "@/types/formFields";

/** Hoja y columnas alineadas con `MATRIZ DE CARACTERIZACIÓN.xlsx` → pestaña F-PSA-08, fila 7. */
export const MATRIZ_SHEET_NAME = "F-PSA-08";

export const MATRIZ_F_PSA_HEADERS: readonly string[] = [
  "ID",
  "ENTIDAD APORTANTE",
  "TIPO DE ORGANIZACIÓN DE LA ENTIDAD APORTANTE",
  "NOMBRE DE ACTIVIDAD",
  "FECHA INICIO  (DD/MM/AÑO)",
  "FECHA FIN  (DD/MM/AÑO)",
  "TIPO DE PROYECTO O TIPO DE FINANCIACIÓN",
  "NOMBRES Y APELLIDOS BENEFICIARIO",
  "EDAD",
  "HOMBRE/MUJER",
  "TIPO DOCUMENTO",
  "NÚMERO DOCUMENTO",
  "Nº TELEFONICO",
  "Nº USUARIO CENS",
  "ESTADO FACTURA",
  "DEPARTAMENTO",
  "MUNICIPIO",
  "VEREDA",
  "DIRECCIÓN",
  "ZONA (URBANA-RURAL)",
  "ESTRATO",
  "SISBEN",
  "NIVEL DE INGRESO PROMEDIO DE LA FAMILIA",
  "NOMBRE DEL PREDIO",
  "RESIDENCIA",
  "TENENCIA DEL PREDIO",
  "X°",
  "X'",
  'X"',
  "LONGITUD",
  "Y°",
  "Y'",
  'Y"',
  "LATITUD",
  "Nº PERSONAS DEL NÚCLEO FAMILIAR",
  "NÚMERO DE MENORES DE EDAD",
  "NÚMERO DE ADULTOS MAYORES",
  "MUJER CABEZA DE HOGAR",
  "PERSONA CON DISCAPACIDAD",
  "OCUPACION PRINCIPAL",
  "PERFIL SOCIAL PRIORIZADO",
  "ÁREA HUERTA M2",
  "TIPO ESPACIO HUERTA",
  "ACCESO A AGUA",
  "TIPO RIEGO",
  "EXPOSICION SOLAR ADECUADA",
  "SUELO O RECIPIENTES",
  "DISPONIBILIDAD DE MANTENIMIENTO",
  "ÁREA DE ARBOL DISPONIBLES (SI/NO)",
  "TIPO SUELO",
  "DISTANCIA DE INFRAESTRUCTURA ADECUADA",
  "DISTANCIA DE REDES ELECTRICAS ADECUADA",
  "INTERES AUTOCONSUMO",
  "INTERES COMERCIALIZACIÓN",
  "ASINTENCIA A CAPACITACIONES",
  "PERMITE VISITAS",
  "COMPROMISO CUIDADO DE ARBOL",
  "FIRMA ACUERDO",
  "AUTORIZA TRATAMIENTO DE DATOS",
  "AUTORIZA REGISTROS FOTOGRAFICOS",
  "CUMPLE CRITERIOS DE HUERTA",
  "CUMPLE CRITERIOS DE ARBOL",
  "OBSERVACIONES",
  "FECHA VISITA 1",
  "FECHA VISITA 2",
  "FECHA VISITA 3",
  "ESTADO HUERTA FINAL",
  "ESTADO ARBOL FINAL",
  "PRODUCCIÓN KG",
  "SATISFACION 1-5",
  "ESPECIES DE FLORA Y FAUNA",
  "ECOSISTEMA ESTRATÉGICO",
  "TIPO DE COBERTURA",
  "CERCANIA RONDA HÍDRICA",
  "SUPERFICIE TOTAL INTERVENIDA M2",
  "TOTAL DE ESPECIES O SEMILLAS SEMBRADAS",
] as const;

if (MATRIZ_F_PSA_HEADERS.length !== 76) {
  throw new Error("matriz: se esperan 76 columnas");
}

function strFromDatos(
  datos: Record<string, unknown>,
  key: FormFieldKey,
): string {
  const v = datos[key];
  if (v == null) {
    return "";
  }
  return String(v).trim();
}

/** Origen de cada celda de la fila 8 (76 columnas), alineado con la matriz F-PSA-08. */
export type MatrizRowCellSource =
  | { kind: "id_formulario" }
  | { kind: "field"; key: FormFieldKey }
  | { kind: "fecha"; key: FormFieldKey }
  | { kind: "lon" }
  | { kind: "lat" };

export const MATRIZ_ROW_CELL_SOURCES: readonly MatrizRowCellSource[] = [
  { kind: "id_formulario" },
  { kind: "field", key: "entidad_aportante" },
  { kind: "field", key: "tipo_organizacion_entidad_aportante" },
  { kind: "field", key: "nombre_actividad" },
  { kind: "fecha", key: "fecha_inicio" },
  { kind: "fecha", key: "fecha_fin" },
  { kind: "field", key: "tipo_proyecto_financiacion" },
  { kind: "field", key: "nombres_apellidos_beneficiario" },
  { kind: "field", key: "edad" },
  { kind: "field", key: "genero" },
  { kind: "field", key: "tipo_documento" },
  { kind: "field", key: "numero_documento" },
  { kind: "field", key: "telefono" },
  { kind: "field", key: "usuario_cens" },
  { kind: "field", key: "estado_factura" },
  { kind: "field", key: "departamento" },
  { kind: "field", key: "municipio" },
  { kind: "field", key: "vereda" },
  { kind: "field", key: "direccion" },
  { kind: "field", key: "zona" },
  { kind: "field", key: "estrato" },
  { kind: "field", key: "sisben" },
  { kind: "field", key: "nivel_ingreso_promedio" },
  { kind: "field", key: "nombre_predio" },
  { kind: "field", key: "residencia" },
  { kind: "field", key: "tenencia_predio" },
  { kind: "field", key: "x_grados" },
  { kind: "field", key: "x_minutos" },
  { kind: "field", key: "x_segundos" },
  { kind: "lon" },
  { kind: "field", key: "y_grados" },
  { kind: "field", key: "y_minutos" },
  { kind: "field", key: "y_segundos" },
  { kind: "lat" },
  { kind: "field", key: "numero_personas_nucleo_familiar" },
  { kind: "field", key: "numero_menores_edad" },
  { kind: "field", key: "numero_adultos_mayores" },
  { kind: "field", key: "mujer_cabeza_hogar" },
  { kind: "field", key: "persona_discapacidad" },
  { kind: "field", key: "ocupacion_principal" },
  { kind: "field", key: "perfil_social_priorizado" },
  { kind: "field", key: "area_huerta_m2" },
  { kind: "field", key: "tipo_espacio_huerta" },
  { kind: "field", key: "acceso_agua" },
  { kind: "field", key: "tipo_riego" },
  { kind: "field", key: "exposicion_solar_adecuada" },
  { kind: "field", key: "suelo_o_recipientes" },
  { kind: "field", key: "disponibilidad_mantenimiento" },
  { kind: "field", key: "area_arbol_disponible" },
  { kind: "field", key: "tipo_suelo" },
  { kind: "field", key: "distancia_infraestructura_adecuada" },
  { kind: "field", key: "distancia_redes_electricas_adecuada" },
  { kind: "field", key: "interes_autoconsumo" },
  { kind: "field", key: "interes_comercializacion" },
  { kind: "field", key: "asistencia_capacitaciones" },
  { kind: "field", key: "permite_visitas" },
  { kind: "field", key: "compromiso_cuidado_arbol" },
  { kind: "field", key: "firma_acuerdo" },
  { kind: "field", key: "autoriza_tratamiento_datos" },
  { kind: "field", key: "autoriza_registros_fotograficos" },
  { kind: "field", key: "cumple_criterios_huerta" },
  { kind: "field", key: "cumple_criterios_arbol" },
  { kind: "field", key: "observaciones" },
  { kind: "fecha", key: "fecha_visita_1" },
  { kind: "fecha", key: "fecha_visita_2" },
  { kind: "fecha", key: "fecha_visita_3" },
  { kind: "field", key: "estado_huerta_final" },
  { kind: "field", key: "estado_arbol_final" },
  { kind: "field", key: "produccion_kg" },
  { kind: "field", key: "satisfaccion_1_5" },
  { kind: "field", key: "especies_flora_fauna" },
  { kind: "field", key: "ecosistema_estrategico" },
  { kind: "field", key: "tipo_cobertura" },
  { kind: "field", key: "cercania_ronda_hidrica" },
  { kind: "field", key: "superficie_total_intervenida_m2" },
  { kind: "field", key: "total_especies_semillas_sembradas" },
] as const;

if (MATRIZ_ROW_CELL_SOURCES.length !== 76) {
  throw new Error("matriz: MATRIZ_ROW_CELL_SOURCES debe tener 76 entradas");
}

/** Si parece ISO 8601, devuelve DD/MM/AAAA; si no, el texto original. */
export function formatFechaMatriz(raw: string): string {
  const t = raw.trim();
  if (!t) {
    return "";
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(t)) {
    return t;
  }
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) {
    return t;
  }
  const d = new Date(ms);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = String(d.getUTCFullYear());
  return `${day}/${month}/${year}`;
}

/** Una fila de datos (columnas 1–76) para la matriz F-PSA-08. */
export function buildMatrizCaracterizacionRow(form: OfflineForm): string[] {
  const d = form.datos_formulario as Record<string, unknown>;
  const g = (k: FormFieldKey) => strFromDatos(d, k);

  const lonStr = g("longitud");
  const latStr = g("latitud");
  const lon =
    lonStr ||
    (Number.isFinite(form.gps.longitud)
      ? String(form.gps.longitud)
      : "");
  const lat =
    latStr ||
    (Number.isFinite(form.gps.latitud) ? String(form.gps.latitud) : "");

  return MATRIZ_ROW_CELL_SOURCES.map((src) => {
    switch (src.kind) {
      case "id_formulario":
        return form.id_formulario;
      case "field":
        return g(src.key);
      case "fecha":
        return formatFechaMatriz(g(src.key));
      case "lon":
        return lon;
      case "lat":
        return lat;
    }
  });
}

export function matrizCaracterizacionFilename(form: OfflineForm): string {
  const datos = form.datos_formulario as Record<string, unknown>;
  const rawBenef = String(datos.nombres_apellidos_beneficiario ?? "").trim();
  const safeBenef =
    rawBenef
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "sin_beneficiario";

  const sendDate = Date.parse(form.fecha_hora);
  const safeFecha = Number.isNaN(sendDate)
    ? "sin_fecha"
    : (() => {
        const d = new Date(sendDate);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        const hh = String(d.getUTCHours()).padStart(2, "0");
        const mm = String(d.getUTCMinutes()).padStart(2, "0");
        return `${y}-${m}-${day}_${hh}-${mm}`;
      })();

  return `${safeBenef}-${safeFecha}.xlsx`;
}

export function matrizCaracterizacionBulkFilename(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `Formularios_diligenciados_${y}-${m}-${day}_${hh}-${mm}.xlsx`;
}

async function loadTemplateWorkbook(): Promise<ExcelJS.Workbook | null> {
  const templateUrl = import.meta.env.VITE_MATRIZ_TEMPLATE_URL ??
    "/PLANTILLA.xlsx";
  const resolvedTemplateUrl =
    templateUrl.startsWith("/") && typeof window !== "undefined"
      ? new URL(templateUrl, window.location.origin).toString()
      : templateUrl;

  try {
    const res = await fetch(resolvedTemplateUrl);
    if (!res.ok) {
      return null;
    }
    const buf = await res.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    return wb;
  } catch (e) {
    console.warn("matriz: no se pudo cargar plantilla, usando builder interno", e);
    return null;
  }
}

export async function buildMatrizCaracterizacionWorkbook(
  form: OfflineForm,
): Promise<ExcelJS.Workbook> {
  const wb = await loadTemplateWorkbook();
  if (wb) {
    const ws = wb.getWorksheet(MATRIZ_SHEET_NAME) ?? wb.worksheets[0];
    if (!ws) {
      console.warn(
        `matriz: plantilla cargada pero no contiene la hoja ${MATRIZ_SHEET_NAME}`,
      );
      return buildMatrizCaracterizacionWorkbookFromScratch(form);
    }
    const cells = buildMatrizCaracterizacionRow(form);
    for (let i = 0; i < cells.length; i++) {
      const col = i + 1;
      const cell = ws.getCell(8, col);
      cell.value = cells[i] as string;
      if (!cell.alignment) {
        cell.alignment = { wrapText: true, vertical: "top" };
      }
    }
    return wb;
  }
  return buildMatrizCaracterizacionWorkbookFromScratch(form);
}

async function buildMatrizCaracterizacionWorkbookFromScratch(
  form: OfflineForm,
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(MATRIZ_SHEET_NAME);

  ws.mergeCells(5, 5, 5, 14);
  const title = ws.getCell(5, 5);
  title.value = "CARACTERIZACIÓN SOCIAL";
  title.font = { bold: true, size: 12 };
  title.alignment = { horizontal: "center", vertical: "middle" };

  MATRIZ_F_PSA_HEADERS.forEach((header, i) => {
    const c = ws.getCell(7, i + 1);
    c.value = header;
    c.font = { bold: true };
    c.alignment = { wrapText: true, vertical: "top" };
  });

  const cells = buildMatrizCaracterizacionRow(form);
  cells.forEach((v, i) => {
    ws.getCell(8, i + 1).value = v;
    ws.getCell(8, i + 1).alignment = { wrapText: true, vertical: "top" };
  });

  ws.columns = MATRIZ_F_PSA_HEADERS.map((h) => ({
    width: Math.min(42, Math.max(14, Math.ceil(h.length * 0.55 + 6))),
  }));

  return wb;
}

export async function downloadMatrizCaracterizacionXlsx(
  form: OfflineForm,
): Promise<void> {
  const wb = await buildMatrizCaracterizacionWorkbook(form);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = matrizCaracterizacionFilename(form);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function buildMatrizCaracterizacionWorkbookBulk(
  forms: OfflineForm[],
): Promise<ExcelJS.Workbook> {
  const wb = (await loadTemplateWorkbook()) ??
    (await buildMatrizCaracterizacionWorkbookFromScratch(forms[0] ?? {
      id_formulario: "tmp",
      id_usuario: "sin_usuario",
      fecha_hora: new Date().toISOString(),
      gps: { latitud: 0, longitud: 0, precision: 1 },
      datos_formulario: {},
      fotos: [],
      estado_sincronizacion: "PENDIENTE",
    }));
  const ws = wb.getWorksheet(MATRIZ_SHEET_NAME) ?? wb.worksheets[0];
  if (!ws) {
    throw new Error("No se encontró la hoja de matriz para exportación masiva.");
  }
  for (let idx = 0; idx < forms.length; idx++) {
    const rowNumber = 8 + idx;
    const cells = buildMatrizCaracterizacionRow(forms[idx]);
    for (let i = 0; i < cells.length; i++) {
      const col = i + 1;
      const cell = ws.getCell(rowNumber, col);
      cell.value = cells[i] as string;
      if (!cell.alignment) {
        cell.alignment = { wrapText: true, vertical: "top" };
      }
    }
  }
  return wb;
}

export async function downloadMatrizCaracterizacionBulkXlsx(
  forms: OfflineForm[],
): Promise<void> {
  const wb = await buildMatrizCaracterizacionWorkbookBulk(forms);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = matrizCaracterizacionBulkFilename();
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
