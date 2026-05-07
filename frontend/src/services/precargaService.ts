import { db, type FotoForm } from '@/services/db';
import { fetchFormFromApi, fetchFormPhotoDataUrl } from '@/services/api';

/** Opciones para optimizar fotos en precarga. */
const DEFAULT_MAX_WIDTH = 1600;
const DEFAULT_QUALITY = 0.8;

async function optimizeDataUrl(
  dataUrl: string,
  maxWidth = DEFAULT_MAX_WIDTH,
  quality = DEFAULT_QUALITY,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const out = canvas.toDataURL('image/jpeg', quality);
      resolve(out);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function downloadAndSavePrecarga(
  formId: string,
  options?: { optimizePhotos?: boolean; maxWidth?: number; quality?: number },
): Promise<void> {
  const opts = options ?? { optimizePhotos: true };
  const resp = await fetchFormFromApi(formId);
  const fotosRaw = Array.isArray(resp.fotos) ? resp.fotos : [];
  const fotosPromise: Promise<FotoForm>[] = fotosRaw.map(async (p, i) => {
    try {
      // intentamos obtener la foto desde el API en form-data URL
      const dataUrl = await fetchFormPhotoDataUrl(formId, i);
      const finalData = opts.optimizePhotos
        ? await optimizeDataUrl(dataUrl, opts.maxWidth ?? DEFAULT_MAX_WIDTH, opts.quality ?? DEFAULT_QUALITY)
        : dataUrl;
      const nombre = typeof p === 'string' ? (p.split(/[/\\]/).pop() || `foto_${i + 1}.jpg`) : (typeof (p as any).nombre_archivo === 'string' ? (p as any).nombre_archivo : `foto_${i + 1}.jpg`);
      return { nombre_archivo: nombre, data: finalData, visita: (p as any)?.visita as any } as FotoForm;
    } catch {
      return { nombre_archivo: `foto_${i + 1}.jpg`, data: '', visita: undefined } as FotoForm;
    }
  });
  const fotos = await Promise.all(fotosPromise);

  const historial = await db.historialFormularios.get(formId);
  const modoPrecarga =
    historial?.modo_coordenadas === "manual" ? "manual" : "automatico";

  await db.precargas.put({
    id_formulario: resp.id_formulario,
    fecha_precarga: new Date().toISOString(),
    modo_coordenadas: modoPrecarga,
    datos_formulario: resp.datos_formulario ?? {},
    gps:
      typeof (resp as any).latitud === 'number' && typeof (resp as any).longitud === 'number'
        ? { latitud: (resp as any).latitud, longitud: (resp as any).longitud, precision: (resp as any).precision }
        : undefined,
    fotos,
    auto_precarga: true,
  });
}

export async function enableAutoPrecarga(formId: string): Promise<void> {
  // marcar flag y forzar descarga inmediata
  const existing = await db.precargas.get(formId);
  if (existing) {
    await db.precargas.update(formId, { auto_precarga: true });
  } else {
    // crear precarga inicial
    await downloadAndSavePrecarga(formId);
  }
}

export async function disableAutoPrecarga(formId: string): Promise<void> {
  await db.precargas.delete(formId).catch(() => undefined);
}

export async function deletePrecarga(formId: string): Promise<void> {
  await db.precargas.delete(formId).catch(() => undefined);
}
