FROM node:20-alpine AS build

# Misma jerarquía que en el repo (frontend/ y config/ hermanos) para que Vite resuelva @gpsLimits.
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .
COPY config/gps-limits.json ../config/gps-limits.json

ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine

COPY frontend/docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
