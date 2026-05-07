import { db } from "@/services/db";

/**
 * Quita cola (`formularios`), historial y precarga para ese id, sin ocultar la fila
 * del listado cuando el formulario sigue existiendo en el servidor.
 */
export async function eliminarCopiaLocalFormulario(
  id_formulario: string,
): Promise<void> {
  await Promise.all([
    db.formularios.delete(id_formulario).catch(() => undefined),
    db.historialFormularios.delete(id_formulario).catch(() => undefined),
    db.precargas.delete(id_formulario).catch(() => undefined),
  ]);
}

/** Quita cola, historial y precarga; marca id como oculto en listados locales (p. ej. fila solo-servidor). */
export async function eliminarFormularioDeDispositivo(
  id_formulario: string,
): Promise<void> {
  await eliminarCopiaLocalFormulario(id_formulario);
  await db.formulariosOcultos.put({ id_formulario });
}

export async function loadHiddenFormIds(): Promise<Set<string>> {
  const rows = await db.formulariosOcultos.toArray();
  return new Set(rows.map((r) => r.id_formulario));
}

/** Borra todas las copias precargadas (IndexedDB). No elimina historial ni datos en servidor. */
export async function clearAllPrecargas(): Promise<void> {
  await db.precargas.clear();
}
