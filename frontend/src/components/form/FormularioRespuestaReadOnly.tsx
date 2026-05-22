import { useState } from "react";

import { FotoServidorAutenticada } from "@/components/form/FotoServidorAutenticada";
import {
  ImagePreviewModal,
  type ImagePreview,
} from "@/components/form/ImagePreviewModal";
import { FORM_SECTIONS } from "@/config/formSections";
import {
  fieldLabel,
  inputKindForField,
  triOptions,
} from "@/config/formFieldMeta";
import { fieldSelectOptions } from "@/config/formSelectOptions";
import { parseVisitaNumero } from "@/lib/visitaNumero";
import type { FormFieldKey } from "@/types/formFields";

const rowClass =
  "flex flex-col gap-0.5 border-b border-slate-100 py-2.5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4";

function displayFieldValue(key: FormFieldKey, raw: unknown): string {
  const s = raw == null ? "" : String(raw).trim();
  if (!s) {
    return "—";
  }
  const kind = inputKindForField(key);
  if (kind === "select-tri") {
    const found = triOptions.find((o) => o.value === s);
    const lbl = found?.label != null ? String(found.label).trim() : "";
    return lbl.length > 0 ? lbl : s;
  }
  if (kind === "select") {
    const opts = fieldSelectOptions[key];
    const found = opts?.find((o) => o.value === s);
    return found?.label ?? s;
  }
  return s;
}

export interface FormularioSnapshot {
  datos_formulario: Record<string, unknown>;
  gps?: { latitud: number; longitud: number; precision?: number | null } | null;
  /** `data` = data URL local; `path` = ruta en servidor; `serverFormId` + `serverIndex` = imagen vía API autenticado. */
  fotos?: Array<{
    nombre_archivo: string;
    data?: string;
    path?: string;
    serverFormId?: string;
    serverIndex?: number;
    visita?: 1 | 2 | 3 | 4;
  }>;
}

const buildMapLink = (lat: number, lon: number) =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;

function ReadOnlySection({
  sectionTitle,
  fieldKeys,
  datos,
  initiallyOpen,
}: {
  sectionTitle: string;
  fieldKeys: readonly FormFieldKey[];
  datos: Record<string, unknown>;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details
      className="rounded-xl border border-slate-200 bg-white shadow-sm open:shadow-md"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold text-slate-900">
        {sectionTitle}
      </summary>
      <dl className="border-t border-slate-100 px-4 pb-3 pt-1">
        {fieldKeys.map((key) => (
          <div key={key} className={rowClass}>
            <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500 sm:w-[42%]">
              {fieldLabel(key)}
            </dt>
            <dd className="min-w-0 break-words text-sm text-slate-900 [overflow-wrap:anywhere] sm:text-right">
              {displayFieldValue(key, datos[key])}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export const FormularioRespuestaReadOnly = ({
  snapshot,
}: {
  snapshot: FormularioSnapshot;
}) => {
  const { datos_formulario: datos, gps, fotos = [] } = snapshot;
  const visitaDeFoto = (f: (typeof fotos)[number]) => parseVisitaNumero(f.visita);
  const fotosVisita1 = fotos.filter((f) => visitaDeFoto(f) === 1);
  const fotosVisita2 = fotos.filter((f) => visitaDeFoto(f) === 2);
  const fotosVisita3 = fotos.filter((f) => visitaDeFoto(f) === 3);
  const fotosVisita4 = fotos.filter((f) => visitaDeFoto(f) === 4);
  const fotosSinVisita = fotos.filter((f) => visitaDeFoto(f) == null);
  const [previewFoto, setPreviewFoto] = useState<ImagePreview | null>(null);
  const [remoteSrcMap, setRemoteSrcMap] = useState<
    Record<string, string | null>
  >({});
  const hasAnyField = FORM_SECTIONS.some((sec) =>
    sec.fields.some((key) => {
      const v = datos[key];
      return v != null && String(v).trim() !== "";
    }),
  );

  if (!hasAnyField && !gps && fotos.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
        No hay respuestas de campos para mostrar (p. ej. registro antiguo sin
        copia local o datos vacíos en servidor).
      </div>
    );
  }

  const openPreview = (foto: ImagePreview) => setPreviewFoto(foto);

  const resolveRemoteSrc = (photoKey: string, src: string | null) => {
    setRemoteSrcMap((prev) => ({ ...prev, [photoKey]: src }));
  };

  return (
    <div className="space-y-4 text-slate-800">
      {gps ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50/90 p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Ubicación GPS
          </h3>
          <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Latitud
              </dt>
              <dd className="font-mono text-slate-900">{gps.latitud}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Longitud
              </dt>
              <dd className="font-mono text-slate-900">{gps.longitud}</dd>
            </div>
          </dl>
          <a
            href={buildMapLink(gps.latitud, gps.longitud)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex text-sm font-medium text-teal-700 underline-offset-2 hover:underline"
          >
            Ver en OpenStreetMap
          </a>
        </section>
      ) : null}

      {fotos.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Fotos ({fotos.length})
          </h3>
          {[
            { title: "Visita 1", items: fotosVisita1 },
            { title: "Visita 2", items: fotosVisita2 },
            { title: "Visita 3", items: fotosVisita3 },
            { title: "Visita 4", items: fotosVisita4 },
            { title: "Sin visita registrada", items: fotosSinVisita },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <div key={group.title} className="mt-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {group.title} ({group.items.length})
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {group.items.map((f, idx) => (
                    <button
                      key={`${group.title}-${f.nombre_archivo}-${idx}`}
                      type="button"
                      onClick={() => {
                        if (f.data) {
                          openPreview({
                            nombre_archivo: f.nombre_archivo,
                            src: f.data,
                          });
                          return;
                        }
                        const photoKey = `${group.title}-${f.nombre_archivo}-${idx}`;
                        const remoteSrc = remoteSrcMap[photoKey];
                        if (remoteSrc) {
                          openPreview({
                            nombre_archivo: f.nombre_archivo,
                            src: remoteSrc,
                          });
                        }
                      }}
                      className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left"
                    >
                      <figure className="overflow-hidden">
                        {f.data ? (
                          <img
                            src={f.data}
                            alt={f.nombre_archivo}
                            className="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                            loading="lazy"
                          />
                        ) : f.serverFormId != null && f.serverIndex != null ? (
                          <FotoServidorAutenticada
                            formId={f.serverFormId}
                            photoIndex={f.serverIndex}
                            alt={f.nombre_archivo}
                            loadDeferred={f.serverIndex > 0}
                            onSrcChange={(src) =>
                              resolveRemoteSrc(
                                `${group.title}-${f.nombre_archivo}-${idx}`,
                                src,
                              )
                            }
                            className="transition-transform duration-200 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex aspect-square flex-col items-center justify-center gap-1 bg-slate-100 p-2 text-center text-[11px] text-slate-600">
                            <span className="font-medium text-slate-700">
                              Sin vista previa
                            </span>
                            <span className="break-all font-mono text-[9px] leading-tight text-slate-500">
                              {(f.path ?? f.nombre_archivo).split(/[/\\]/).pop()}
                            </span>
                          </div>
                        )}
                        <figcaption
                          className="truncate px-1.5 py-1 text-center text-[10px] text-slate-600"
                          title={f.nombre_archivo}
                        >
                          {f.nombre_archivo}
                        </figcaption>
                      </figure>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </section>
      ) : null}

      <ImagePreviewModal
        image={previewFoto}
        onClose={() => setPreviewFoto(null)}
        showDownload
      />

      <div className="space-y-2">
        {FORM_SECTIONS.map((section, idx) => (
          <ReadOnlySection
            key={section.id}
            sectionTitle={section.title}
            fieldKeys={section.fields}
            datos={datos}
            initiallyOpen={idx === 0}
          />
        ))}
      </div>
    </div>
  );
};
