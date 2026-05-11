FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Migraciones (alembic upgrade head) y metadatos; sin esto no existe `alembic.ini` en la imagen.
COPY backend/alembic.ini .
COPY backend/alembic ./alembic

COPY backend/app ./app
COPY config/gps-limits.json ./config/gps-limits.json

EXPOSE 8000

# --proxy-headers: confía en X-Forwarded-* cuando el cliente es Traefik (api.tudominio.com).
# En red Docker privada; endurecer --forwarded-allow-ips en producción si hace falta.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
