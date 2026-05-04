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

## Variables críticas
Usar `.env` en la raíz (puedes partir de `.env.example`):
- `JWT_SECRET` (mínimo 32 chars)
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

## Migraciones (Alembic)
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
