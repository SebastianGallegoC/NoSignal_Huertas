ACME / Let's Encrypt (acme.json)
================================

Traefik guarda los certificados en el archivo montado: letsencrypt/acme.json

En el servidor Linux (recomendado antes del primer docker compose up):

  sh scripts/init-letsencrypt.sh

  O manualmente:

  mkdir -p letsencrypt
  touch letsencrypt/acme.json
  chmod 600 letsencrypt/acme.json

Sin el fichero o con permisos incorrectos, Traefik puede fallar al escribir certificados.

No subas acme.json al repositorio (está en .gitignore).

Windows + Docker Desktop: crea letsencrypt\acme.json vacío; en WSL2 para
producción usa chmod 600 desde la shell de Linux sobre el volumen si aplica.

DNS obligatorio: tudominio.com y api.tudominio.com deben apuntar a la IP
pública del host antes de solicitar certificados.

Namecheap: en el dominio usar "Namecheap BasicDNS" (no "Custom DNS" con
dns1/dns2 manual), así la zona en Advanced DNS es la que responde Internet;
si no, el navegador puede resolver otra IP (parking) y ver ERR_CONNECTION_REFUSED
aunque Traefik en el VPS funcione (comprobar con dig @dns1.registrar-servers.com).

Variables (archivo .env en la raíz; plantilla: .env.example):

  NO_SIGNAL_APP_DOMAIN=tudominio.com
  NO_SIGNAL_API_DOMAIN=api.tudominio.com
  ACME_EMAIL=tu@tudominio.com
  CORS_ORIGINS=https://tudominio.com
  VITE_API_URL=https://api.tudominio.com

Tras cambiar dominios: ajusta .env y ejecuta
  docker compose build --no-cache frontend && docker compose up -d
