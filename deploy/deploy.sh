#!/usr/bin/env sh
# Despliegue rapido del backend: sh deploy/deploy.sh
# Las migraciones NO se aplican aqui: correr `pnpm db:deploy` desde tu PC antes (ver DESPLIEGUE.md).
set -e
cd "$(dirname "$0")"
git pull --ff-only
docker network inspect ariz-net >/dev/null 2>&1 || docker network create ariz-net
docker compose up -d --build
docker image prune -f >/dev/null
# Libera cache de build con mas de 24 h (mantiene la reciente para builds rapidos)
docker builder prune -f --filter "until=24h" >/dev/null
docker compose logs --tail=30 backend
