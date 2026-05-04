import { db } from "@/services/db";

/** Quita cola, historial y precarga; marca id como oculto en listados locales (p. ej. fila solo-servidor). */
export async function eliminarFormularioDeDispositivo(
  id_formulario: string,
): Promise<void> {
  await Promise.all([
    db.formularios.delete(id_formulario).catch(() => undefined),
    db.historialFormularios.delete(id_formulario).catch(() => undefined),
    db.precargas.delete(id_formulario).catch(() => undefined),
  ]);
  await db.formulariosOcultos.put({ id_formulario });
}

export async function loadHiddenFormIds(): Promise<Set<string>> {
  const rows = await db.formulariosOcultos.toArray();
  return new Set(rows.map((r) => r.id_formulario));
}
