# NoSignal

Aplicación offline-first para diligenciamiento y sincronización de formularios con GPS y fotos.

## Arquitectura
- `frontend/`: PWA (React + Vite + TypeScript + Dexie).
- `backend/`: API FastAPI + SQLAlchemy async.
- `db`: PostgreSQL/PostGIS.
- `traefik/`: routing HTTPS y certificados Let's Encrypt.

Traefik está configurado con **provider de archivo** (`traefik/dynamic.yml`), no por labels Docker.

## Requisitos
- Docker + Docker Compose
- Dominio(s) apuntando al servidor (para HTTPS en producción)

## DNS y dominio (evitar `ERR_CONNECTION_REFUSED` / IP equivocada)

El frontend en producción llama al API en la URL fijada al **build** (`VITE_API_URL`). Esa URL debe resolver a la **misma IP pública** del host donde Traefik escucha en **443**.

**Checklist**

1. **Registros A** del dominio raíz (`@`) y del subdominio del API (`api`) → IP pública del VPS (la que devuelve `curl -4 ifconfig.me` en el servidor).
2. **`VITE_API_URL`** en `.env` debe ser exactamente el origen HTTPS del API (mismo host que las reglas `Host` en `traefik/dynamic.yml`).
3. Tras **cambiar de servidor o IP**, volvé a hacer `docker compose build --no-cache frontend` (o al menos rebuild del servicio frontend) para embebér la URL correcta en el bundle.

**Namecheap**

En Nameservers elegí **«Namecheap BasicDNS»**, no **«Custom DNS»** aunque pongas manualmente `dns1.registrar-servers.com` / `dns2.registrar-servers.com`. Con *Custom DNS* la pestaña **Advanced DNS** puede quedar sin efecto sobre la zona pública y los resolvers (p. ej. `8.8.8.8`) pueden seguir devolviendo una **IP de parking** distinta de tu VPS. Con *BasicDNS* editás los **Host records** y esa zona es la autoritativa.

**Si el navegador falla pero el stack en el servidor está bien**

```bash
curl -vk --resolve api.tu-dominio:443:127.0.0.1 https://api.tu-dominio/health
```

Si eso responde **200** y `curl https://api.tu-dominio/health` no, el problema es **DNS o propagación**, no Docker.

**Comprobar zona vs caché pública** (en el servidor o en tu PC):

```bash
dig +short @dns1.registrar-servers.com api.tu-dominio A
dig +short @8.8.8.8 api.tu-dominio A
```

Cuando el primero ya muestra tu IP y el segundo aún no, es **propagación/TTL**; suele resolverse en minutos u horas. Si el autoritativo (`dns1`) no coincide con lo que configuraste en el panel, revisá el panel o el modo de nameservers.

## Variables críticas
Usar `.env` en la raíz (puedes partir de `.env.example`). Es la fuente de verdad para Docker; `backend/.env` solo aplica si corrés el API fuera de contenedores.
- `JWT_SECRET` (mínimo 32 chars)
- `JWT_EXPIRES_MINUTES` (p. ej. `525600` ≈ 1 año de sesión)
- `POSTGRES_PASSWORD`
- `NOSIGNAL_AUTH_USERS`
- `ACME_EMAIL`
- `CORS_ORIGINS`
- `VITE_API_URL`
- `ENVIRONMENT` (`production` / `development`)
- `ALLOW_INSECURE_DEFAULTS` (solo desarrollo)
- `AUTO_CREATE_SCHEMA` (solo desarrollo)

Para generar hash bcrypt de un usuario:
```bash
cd backend
python scripts/hash_password.py
```

## Levantar en local/servidor
```bash
docker compose build
docker compose up -d
```

Tras cambiar `JWT_EXPIRES_MINUTES` o `JWT_SECRET`, reiniciá el backend y volvé a iniciar sesión en la app (los tokens ya emitidos conservan la expiración anterior):

```bash
docker compose up -d backend
```

## Migraciones (Alembic)
Tras cada despliegue que incluya cambios en `backend/alembic/versions/`, **aplicá las migraciones** antes de usar la app en producción. Si no lo hacés, el API puede responder **500** en rutas como `GET /api/v1/forms/`; el navegador a veces muestra además un error de **CORS** porque la respuesta de error no llega como JSON con cabeceras CORS esperadas.

Con Docker (recomendado en servidor; `WORKDIR` del contenedor es `/app`):
```bash
docker compose exec backend python -m alembic upgrade head
```

En la máquina host, solo si tenés el entorno Python del backend instalado:
```bash
cd backend
python -m alembic upgrade head
```

En desarrollo rápido (no recomendado en producción):
```bash
AUTO_CREATE_SCHEMA=true
```

Comprobación rápida del esquema: `GET https://<tu-api>/health` incluye `schema_forms_fecha_actualizacion` (debe ser `true`).

## Calidad y pruebas
Frontend:
```bash
cd frontend
npm run test
npm run lint
npm run build
```

Backend:
```bash
cd backend
python -m pip install -r requirements.txt -r requirements-dev.txt
python -m pytest -q
python -m compileall app
```

## CI
Workflow en `.github/workflows/ci.yml`:
- Frontend: lint + build + tests
- Backend: install + `pip check` + compile + tests
