# NoSignal Frontend

PWA offline-first para captura de formularios (GPS, fotos, validación y sincronización diferida).

## Scripts
- `npm run dev`: servidor local de desarrollo.
- `npm run test`: pruebas unitarias con Vitest.
- `npm run lint`: validación ESLint.
- `npm run build`: type-check + build de producción.

## Stack
- React + TypeScript + Vite
- React Hook Form
- Dexie (IndexedDB)
- Vite PWA / Workbox
- Tailwind CSS

## Variables esperadas en build
- `VITE_API_URL`: URL base del backend.

## Notas de arquitectura
- El frontend guarda formularios localmente y sincroniza por lotes cuando hay conectividad.
- Las fotos en historial local se muestran desde `data:` URLs; para fotos del servidor se consumen endpoints autenticados.
