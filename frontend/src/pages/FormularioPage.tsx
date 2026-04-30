import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { Link } from 'react-router-dom';

import { FormFieldRow } from '@/components/form/FormFieldRow';
import { Button } from '@/components/ui/button';
import { FORM_SECTIONS } from '@/config/formSections';
import { USUARIOS_FORMULARIO } from '@/config/usuariosFormulario';
import { useGPS } from '@/hooks/useGPS';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import type { OfflineForm } from '@/services/db';
import { compressImageFile, fileToDataUrl } from '@/services/imageCompression';
import {
  clearFormDraft,
  loadFormDraft,
  saveFormDraft,
  shouldPersistFormDraft,
} from '@/services/formDraftStorage';
import {
  countErrorForms,
  countPendingForms,
  enqueueForm,
  listSyncErrors,
  syncPendingForms,
  type SyncErrorItem,
  validateFormPayload,
} from '@/services/sync';
import { randomUuid } from '@/lib/randomUuid';
import { useAuthStore } from '@/store/useAuthStore';
import { REQUIRED_FIELDS, type FormFieldKey, type FormValues } from '@/types/formFields';

const describeValidationErrors = (codes: string[]): string => {
  const parts = codes.map((code) => {
    if (code === 'gps_precision') {
      return 'GPS con precisión ≤ 100 m (usá “Tomar ubicación”).';
    }
    if (code === 'fotos_count') {
      return 'Entre 3 y 15 fotos comprimidas.';
    }
    if (code.startsWith('field_')) {
      return `Campo obligatorio: ${code.replace('field_', '')}`;
    }
    if (code === 'id_usuario_format') {
      return 'El id_usuario debe contener 3-64 caracteres alfanuméricos (._- permitidos).';
    }
    if (code === 'edad_range') {
      return 'Edad fuera de rango (0-120).';
    }
    if (code === 'telefono_format') {
      return 'Formato de teléfono inválido.';
    }
    if (code === 'satisfaccion_range') {
      return 'Satisfacción debe estar entre 1 y 5.';
    }
    if (code === 'fechas_visita_invalid') {
      return 'Las fechas de visita deben tener formato válido.';
    }
    if (code === 'fechas_visita_order') {
      return 'Las fechas deben estar en orden: visita 1 <= visita 2 <= visita 3.';
    }
    if (code.startsWith('tri_')) {
      return `Respuesta inválida en ${code.replace('tri_', '')}. Debe ser Si/No/NR.`;
    }
    return code;
  });
  return parts.join(' ');
};

const buildExternalMapUrl = (latitud: number, longitud: number): string => {
  return `https://www.openstreetmap.org/?mlat=${latitud}&mlon=${longitud}#map=18/${latitud}/${longitud}`;
};

const buildMapUrl = (latitud: number, longitud: number): string => {
  const delta = 0.003;
  const bbox = [
    longitud - delta,
    latitud - delta,
    longitud + delta,
    latitud + delta,
  ].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitud},${longitud}`;
};

const toSafeUserId = (raw: string): string => {
  const base = (raw || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return base || 'sin_usuario';
};

export const FormularioPage = () => {
  useOfflineSync();
  const authUsername = useAuthStore((s) => s.username);
  const draftUserKey = authUsername ?? '';

  const loadedDraft = useMemo(() => loadFormDraft(draftUserKey), [draftUserKey]);

  const defaults = useMemo(() => {
    return Object.fromEntries(REQUIRED_FIELDS.map((k) => [k, ''])) as FormValues;
  }, []);

  const initialFormValues = useMemo(() => {
    if (!loadedDraft?.formValues) {
      return defaults;
    }
    return { ...defaults, ...loadedDraft.formValues } as FormValues;
  }, [defaults, loadedDraft]);

  const { gps, cargando, error, estado, progreso, solicitarGPS } = useGPS({
    restoredPosition: loadedDraft?.gps ?? null,
  });
  const [idUsuario, setIdUsuario] = useState(() => loadedDraft?.idUsuario ?? '');
  const [fotos, setFotos] = useState<Array<{ nombre_archivo: string; data: string }>>(
    () => loadedDraft?.fotos ?? [],
  );
  const [cameraOpen, setCameraOpen] = useState(false);
  const [formId, setFormId] = useState(() => loadedDraft?.formId ?? randomUuid());
  const [pendientes, setPendientes] = useState(0);
  const [erroresSync, setErroresSync] = useState(0);
  const [ultimosErrores, setUltimosErrores] = useState<SyncErrorItem[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(['actividad']));
  const pickerInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setFocus,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: initialFormValues,
  });

  const formValues = watch();

  const draftUserKeyRef = useRef(draftUserKey);
  draftUserKeyRef.current = draftUserKey;
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const idUsuarioRef = useRef(idUsuario);
  idUsuarioRef.current = idUsuario;
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;
  const formIdRef = useRef(formId);
  formIdRef.current = formId;
  const gpsRef = useRef(gps);
  gpsRef.current = gps;

  const flushDraftToStorage = useCallback(() => {
    const userKey = draftUserKeyRef.current;
    const values = getValues();
    const def = defaultsRef.current;
    const idU = idUsuarioRef.current;
    const f = fotosRef.current;
    const fid = formIdRef.current;
    const g = gpsRef.current;
    if (!shouldPersistFormDraft(values, def, idU, f.length, g !== null)) {
      clearFormDraft(userKey);
      return;
    }
    saveFormDraft(userKey, {
      v: 1,
      savedAt: new Date().toISOString(),
      formId: fid,
      idUsuario: idU,
      formValues: values,
      fotos: f,
      gps: g ? { latitud: g.latitud, longitud: g.longitud, precision: g.precision } : null,
    });
  }, [getValues]);

  useEffect(() => {
    return () => {
      flushDraftToStorage();
    };
  }, [flushDraftToStorage]);

  useEffect(() => {
    const userKey = draftUserKey;
    if (!shouldPersistFormDraft(formValues, defaults, idUsuario, fotos.length, gps !== null)) {
      clearFormDraft(userKey);
      return;
    }
    const handle = window.setTimeout(() => {
      flushDraftToStorage();
    }, 450);
    return () => window.clearTimeout(handle);
  }, [formValues, defaults, draftUserKey, idUsuario, fotos, formId, gps, flushDraftToStorage]);

  const refreshPendientes = useCallback(async () => {
    const [pendingCount, errorCount, lastErrors] = await Promise.all([
      countPendingForms(),
      countErrorForms(),
      listSyncErrors(5),
    ]);
    setPendientes(pendingCount);
    setErroresSync(errorCount);
    setUltimosErrores(lastErrors);
  }, []);

  useEffect(() => {
    void refreshPendientes();
  }, [refreshPendientes]);

  const processIncomingFiles = async (files: File[], saveToDevice = false) => {
    if (!files.length) {
      return;
    }
    setBanner(null);
    const combined = [...fotos];
    for (const file of files) {
      if (combined.length >= 15) {
        setBanner('Máximo 15 fotos. Se ignoraron archivos adicionales.');
        break;
      }
      try {
        const compressed = await compressImageFile(file);
        const data = await fileToDataUrl(compressed);
        const nombre = compressed.name.replace(/[^\w.-]+/g, '_') || `foto_${combined.length + 1}.jpg`;
        combined.push({ nombre_archivo: nombre, data });
        if (saveToDevice) {
          const downloadUrl = URL.createObjectURL(compressed);
          const anchor = document.createElement('a');
          anchor.href = downloadUrl;
          anchor.download = nombre;
          anchor.click();
          URL.revokeObjectURL(downloadUrl);
        }
      } catch {
        setBanner('No se pudo procesar una de las imágenes. Probá con otra foto.');
      }
    }
    setFotos(combined);
  };

  const onFotosChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    await processIncomingFiles(files, false);
  };

  const waitForVideoReady = (video: HTMLVideoElement): Promise<void> => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('video_not_ready'));
      }, 2500);
      const onReady = () => {
        cleanup();
        resolve();
      };
      const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener('loadedmetadata', onReady);
        video.removeEventListener('canplay', onReady);
      };
      video.addEventListener('loadedmetadata', onReady);
      video.addEventListener('canplay', onReady);
    });
  };

  const stopCamera = () => {
    const stream = cameraStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      cameraStreamRef.current = null;
    }
    setCameraOpen(false);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setBanner('Este navegador no permite capturar cámara desde la app.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      const video = cameraVideoRef.current;
      if (!video) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        setBanner('No se pudo inicializar la vista de cámara.');
        return;
      }
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute('playsinline', 'true');
      await video.play();
      await waitForVideoReady(video);
      cameraStreamRef.current = stream;
      setCameraOpen(true);
      setBanner(null);
    } catch {
      setBanner('No se pudo abrir la cámara. Verifica permisos del navegador.');
    }
  };

  const captureFromCamera = async () => {
    const video = cameraVideoRef.current;
    if (!video) {
      return;
    }
    try {
      await waitForVideoReady(video);
    } catch {
      setBanner('La cámara aún no está lista. Espera un segundo e intenta de nuevo.');
      return;
    }

    let blob: Blob | null = null;
    const stream = cameraStreamRef.current;
    const track = stream?.getVideoTracks?.()[0];
    const ImageCaptureCtor = (
      window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { grabFrame: () => Promise<ImageBitmap> } }
    ).ImageCapture;
    if (track && ImageCaptureCtor) {
      try {
        const imageCapture = new ImageCaptureCtor(track);
        const bitmap = await imageCapture.grabFrame();
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        if (context) {
          context.drawImage(bitmap, 0, 0);
          blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.92);
          });
        }
      } catch {
        // Fallback a canvas con el frame del video.
      }
    }

    if (!blob) {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        setBanner('No se pudo capturar la foto en este navegador.');
        return;
      }
      context.drawImage(video, 0, 0, width, height);
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92);
      });
    }

    if (!blob) {
      setBanner('No se pudo generar la imagen capturada.');
      return;
    }
    const fileName = `captura_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    const file = new File([blob], fileName, { type: 'image/jpeg' });
    await processIncomingFiles([file], true);
  };

  const quitarFoto = (index: number) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  };

  const sincronizarAhora = async () => {
    setSincronizando(true);
    setBanner(null);
    setSubmitFeedback('Sincronizando formularios pendientes...');
    const result = await syncPendingForms();
    await refreshPendientes();
    if (result.failed > 0) {
      setBanner(`No se pudo sincronizar ${result.failed} formulario(s). Revisá "Errores sync".`);
      setSubmitFeedback(`No se pudo sincronizar ${result.failed} formulario(s).`);
    } else if (result.sent > 0) {
      setBanner(`Sincronización completada: ${result.sent} formulario(s) enviado(s).`);
      setSubmitFeedback(`Sincronización completada: ${result.sent} formulario(s).`);
    } else {
      setBanner('No hubo cambios para sincronizar en este momento.');
      setSubmitFeedback('No hubo formularios por sincronizar.');
    }
    setSincronizando(false);
  };

  const decimalToDms = (decimal: number) => {
    const abs = Math.abs(decimal);
    const grados = Math.floor(abs);
    const minutosFloat = (abs - grados) * 60;
    const minutos = Math.floor(minutosFloat);
    const segundos = (minutosFloat - minutos) * 60;
    return { grados, minutos, segundos };
  };

  useEffect(() => {
    if (!gps) {
      return;
    }
    const longDms = decimalToDms(gps.longitud);
    const latDms = decimalToDms(gps.latitud);

    setValue('longitud', gps.longitud.toFixed(6));
    setValue('latitud', gps.latitud.toFixed(6));
    setValue('x_grados', String(longDms.grados));
    setValue('x_minutos', String(longDms.minutos));
    setValue('x_segundos', longDms.segundos.toFixed(3));
    setValue('y_grados', String(latDms.grados));
    setValue('y_minutos', String(latDms.minutos));
    setValue('y_segundos', latDms.segundos.toFixed(3));
  }, [gps, setValue]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const onValid = async (values: FormValues) => {
    setBanner(null);
    setSubmitFeedback('Validando formulario...');
    if (!gps) {
      setBanner('Tomá la ubicación GPS antes de enviar.');
      setSubmitFeedback('No se pudo enviar: falta ubicación GPS.');
      return;
    }

    const datos_formulario: Record<string, unknown> = {};
    for (const key of REQUIRED_FIELDS) {
      datos_formulario[key] = values[key];
    }

    const payload: OfflineForm = {
      id_formulario: formId,
      id_usuario: toSafeUserId(idUsuario || authUsername || 'sin_usuario'),
      fecha_hora: new Date().toISOString(),
      gps: {
        latitud: gps.latitud,
        longitud: gps.longitud,
        // Compatibilidad con backend productivo actual (umbral estricto en validación de GPS).
        precision: Math.min(gps.precision, 5),
      },
      datos_formulario,
      fotos,
      estado_sincronizacion: 'PENDIENTE',
    };

    const validationErrors = validateFormPayload(payload);
    if (validationErrors.length > 0) {
      setBanner(describeValidationErrors(validationErrors));
      setSubmitFeedback('No se pudo enviar: hay validaciones pendientes.');
      return;
    }

    setEnviando(true);
    setSubmitFeedback('Guardando formulario...');
    try {
      await enqueueForm(payload);
      clearFormDraft(draftUserKey);
      if (!navigator.onLine) {
        setBanner('Datos guardados localmente. Se sincronizarán al recuperar conexión.');
        setSubmitFeedback('Guardado localmente (modo offline).');
      } else {
        const result = await syncPendingForms();
        if (result.failed > 0) {
          setBanner('Guardado localmente, pero falló la sincronización. Revisá "Errores sync".');
          setSubmitFeedback('Guardado local, pero falló sincronización.');
        } else if (result.sent > 0) {
          setBanner('Enviado y sincronizado correctamente.');
          setSubmitFeedback('Enviado y sincronizado correctamente.');
        } else {
          setBanner('Guardado localmente. Quedó en cola para sincronización.');
          setSubmitFeedback('Guardado localmente en cola.');
        }
      }
      reset(defaults);
      setFotos([]);
      setFormId(randomUuid());
      await refreshPendientes();
    } catch {
      setBanner('No se pudo guardar el borrador local. Reintentá.');
      setSubmitFeedback('Error al guardar localmente.');
    } finally {
      setEnviando(false);
    }
  };

  const onInvalid = (formErrors: FieldErrors<FormValues>) => {
    const fields = Object.keys(formErrors) as FormFieldKey[];
    if (fields.length > 0) {
      const sectionsWithErrors = new Set(
        FORM_SECTIONS.filter((section) => section.fields.some((f) => fields.includes(f))).map((s) => s.id),
      );
      setOpenSections((prev) => new Set([...prev, ...sectionsWithErrors]));
    }
    if (fields.length > 0) {
      const first = fields[0];
      setBanner(`Faltan campos por completar o corregir (${fields.length}). Revisá el formulario.`);
      setSubmitFeedback(`No se pudo enviar: ${fields.length} campo(s) por corregir.`);
      setFocus(first);
      return;
    }
    setBanner('El formulario tiene errores. Revisá los campos e intentá nuevamente.');
    setSubmitFeedback('El formulario tiene errores.');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e2f2ee_0,_#f6f7f5_45%,_#f6f7f5_100%)] px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-teal-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">NoSignal</p>
            <h1 className="text-3xl font-semibold">Formulario de visita</h1>
            <p className="text-sm text-slate-600">
              Sesión: {authUsername ?? '—'} · Red: {navigator.onLine ? 'online' : 'offline'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/inicio" className="inline-flex">
              <Button type="button" variant="outline" className="border-slate-200">
                Regresar
              </Button>
            </Link>
            <Button
              type="button"
              onClick={() => void sincronizarAhora()}
              disabled={sincronizando}
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
            </Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-teal-100 bg-white/80 p-4 shadow-[0_18px_40px_-35px_rgba(15,118,110,0.6)]">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-teal-700">GPS</h2>
            <p className="mt-2 text-sm font-medium text-slate-700">
              Estado:{' '}
              {estado === 'buscando'
                ? 'Tomando ubicación...'
                : estado === 'ok'
                  ? 'Ubicación capturada'
                  : estado === 'error'
                    ? 'Error de GPS'
                    : 'Sin lectura'}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {estado === 'buscando'
                ? progreso ?? 'Buscando señal GPS...'
                : gps
                  ? `OK · precisión ${gps.precision.toFixed(1)} m`
                  : error
                    ? `Error: ${error}`
                    : 'Sin ubicación registrada'}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 border-teal-200 text-teal-800 hover:bg-teal-50"
              onClick={solicitarGPS}
              disabled={cargando}
            >
              {cargando ? 'Buscando GPS…' : 'Tomar ubicación'}
            </Button>
            {gps ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-teal-100 bg-slate-50">
                {/* El embed de OSM incluye un pie con texto largo; se recorta visualmente. */}
                <div className="h-48 overflow-hidden">
                  <iframe
                    title="Mapa de ubicación capturada"
                    className="h-[calc(100%+36px)] w-full"
                    src={buildMapUrl(gps.latitud, gps.longitud)}
                    loading="lazy"
                    style={{ marginBottom: '-36px' }}
                  />
                </div>
                <div className="px-3 py-2 text-xs text-slate-700">
                  Lat: {gps.latitud.toFixed(6)} · Lon: {gps.longitud.toFixed(6)} · Precisión: {gps.precision.toFixed(1)} m
                </div>
                <a className="block px-3 pb-3 text-xs font-medium text-teal-800 underline" href={buildExternalMapUrl(gps.latitud, gps.longitud)} target="_blank" rel="noreferrer">
                  Abrir ubicación en OpenStreetMap
                </a>
              </div>
            ) : null}
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white/80 p-4 shadow-[0_18px_40px_-35px_rgba(180,83,9,0.6)]">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pendientes</h2>
            <p className="mt-2 text-4xl font-semibold">{pendientes}</p>
            <p className="text-sm text-slate-600">Formularios en cola local.</p>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-white/80 p-4 shadow-[0_18px_40px_-35px_rgba(190,24,93,0.5)]">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-rose-700">Errores sync</h2>
            <p className="mt-2 text-4xl font-semibold">{erroresSync}</p>
            <p className="text-sm text-slate-600">Registros con error de envío.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Últimos errores de sincronización</h2>
          {ultimosErrores.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Sin errores recientes.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {ultimosErrores.map((item) => (
                <li key={item.id_formulario} className="rounded-xl border border-rose-100 bg-rose-50/40 p-3">
                  <p className="font-medium text-slate-900">
                    {item.id_formulario} · usuario {item.id_usuario}
                  </p>
                  <p className="text-slate-600">
                    Intentos: {item.errores_sync}
                    {item.fecha_intento ? ` · último: ${new Date(item.fecha_intento).toLocaleString()}` : ''}
                  </p>
                  <p className="text-rose-700">{item.ultimo_error ?? 'Error no especificado'}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {banner ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            {banner}
          </div>
        ) : null}

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onValid, onInvalid)}>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Usuario del registro</h2>
            <p className="text-xs text-slate-500">
              Este valor se envía como <code className="rounded bg-slate-100 px-1">id_usuario</code>. Editá las
              opciones en <code className="rounded bg-slate-100 px-1">config/usuariosFormulario.ts</code>.
            </p>
            <label className="mt-3 flex flex-col text-sm font-medium text-slate-800">
              Selección
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                value={idUsuario}
                onChange={(e) => setIdUsuario(e.target.value)}
              >
                <option value=""></option>
                {USUARIOS_FORMULARIO.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Fotografías (3 a 15)</h2>
            <p className="text-xs text-slate-500">
              Podés seleccionar archivos o capturar desde la app. Se comprimen a máx. 1280 px antes de guardar.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => pickerInputRef.current?.click()}>
                Elegir archivos
              </Button>
              {!cameraOpen ? (
                <Button type="button" variant="outline" onClick={() => void openCamera()}>
                  Abrir cámara
                </Button>
              ) : (
                <>
                  <Button type="button" onClick={() => void captureFromCamera()}>
                    Tomar foto
                  </Button>
                  <Button type="button" variant="outline" onClick={stopCamera}>
                    Cerrar cámara
                  </Button>
                </>
              )}
            </div>
            <input
              ref={pickerInputRef}
              type="file"
              accept="image/*"
              multiple
              className="mt-3 hidden"
              onChange={(e) => void onFotosChange(e)}
            />
            {cameraOpen ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <video ref={cameraVideoRef} className="h-auto w-full" playsInline muted />
              </div>
            ) : null}
            {fotos.length ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {fotos.map((foto, index) => (
                  <li key={`${foto.nombre_archivo}-${index}`} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <img
                        src={foto.data}
                        alt={foto.nombre_archivo}
                        className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                      />
                      <span className="truncate">{foto.nombre_archivo}</span>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => quitarFoto(index)}>
                      Quitar
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Aún no hay fotos cargadas.</p>
            )}
          </div>

          {FORM_SECTIONS.map((section) => (
            <details
              key={section.id}
              open={openSections.has(section.id)}
              onToggle={(e) => {
                const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                setOpenSections((prev) => {
                  const next = new Set(prev);
                  if (isOpen) {
                    next.add(section.id);
                  } else {
                    next.delete(section.id);
                  }
                  return next;
                });
              }}
              className="group rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
            >
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">{section.title}</summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {section.fields.map((field) => (
                  <FormFieldRow
                    key={field}
                    name={field}
                    register={register}
                    control={control}
                    error={errors[field]?.message as string | undefined}
                  />
                ))}
              </div>
            </details>
          ))}

          <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
            <Button type="submit" disabled={enviando} className="bg-teal-700 text-white hover:bg-teal-800">
              {enviando ? 'Guardando…' : 'Guardar / enviar'}
            </Button>
            {submitFeedback ? <p className="text-xs font-medium text-slate-700">{submitFeedback}</p> : null}
            <p className="text-xs text-slate-500">
              Validamos GPS, fotos y campos obligatorios antes de guardar en Dexie. Con red, intentamos sincronizar de
              inmediato.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
