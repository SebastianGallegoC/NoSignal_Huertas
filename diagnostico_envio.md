# Diagnostico: "Enviar" no hace nada

## Observacion reportada
- Al presionar "Guardar / enviar" no ocurre ninguna accion visible.

## Intentos de solucion aplicados
1. Se simplifico el handler del formulario para que use directamente `handleSubmit(onValid, onInvalid)` sin `setTimeout` ni `preventDefault` manual.
   - Motivo: el wrapper con `setTimeout` puede bloquear o no disparar el handler en algunos navegadores/dispositivos.
   - Cambio: [frontend/src/pages/FormularioPage.tsx](frontend/src/pages/FormularioPage.tsx)

## Hipotesis en revision (si el problema persiste)
- La validacion de GPS/fotos podría cortar el flujo sin mostrar feedback (ver `submitFeedback` y `banner`).
- El envio local falla por error de IndexedDB/Dexie (ver errores en consola del navegador).
- `react-hook-form` no llega a ejecutar `onValid` debido a errores no visibles.
- El flujo de autenticacion bloquea el post (token ausente o invalido).

## Proximo paso sugerido
- Confirmar si el mensaje `submitFeedback` cambia al presionar "Guardar / enviar".
- Revisar consola del navegador para errores Javascript o fallos de IndexedDB.
