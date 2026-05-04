# Stack Tecnológico: NoSignal (Offline-first)

## 1. Frontend (PWA mobile-first)
- **Framework:** React + Vite + TypeScript.
- **Persistencia local:** Dexie (IndexedDB) para cola offline, historial y sesión local.
- **Estado:** React Hook Form + estado local; Zustand para sesión de autenticación.
- **PWA:** `vite-plugin-pwa` (service worker por `injectManifest`) y Workbox para cache/sync.
- **UI:** Tailwind CSS + componentes propios.

## 2. Backend (API)
- **Framework:** FastAPI (Python 3.11).
- **Validación:** Pydantic v2.
- **Persistencia:** SQLAlchemy async + `asyncpg`.
- **Auth:** JWT Bearer (exp/iat); usuarios de auth configurables por `NOSIGNAL_AUTH_USERS`.
- **Imágenes:** Pillow para verificación y persistencia en volumen.

## 3. Datos e infraestructura
- **Base de datos:** PostgreSQL + PostGIS.
- **Archivos:** volumen Docker `nosignal_uploads`.
- **Proxy TLS:** Traefik v3 con Let's Encrypt (TLS challenge).
- **Routing:** Traefik mediante **provider de archivo** en `traefik/dynamic.yml`.
- **Contenedores principales:** `traefik`, `frontend`, `backend`, `db`.

## 4. Gestión de esquema y despliegue
- **Migraciones:** Alembic (`backend/alembic`).
- **Modo desarrollo opcional:** `AUTO_CREATE_SCHEMA=true` crea tablas al arrancar (no usar en producción).
- **Producción recomendada:** ejecutar `alembic upgrade head` y mantener `AUTO_CREATE_SCHEMA=false`.

## 5. Utilidades críticas
- **Geolocalización:** API Geolocation del navegador con captura de alta precisión.
- **Compresión de imágenes en cliente:** `browser-image-compression`.