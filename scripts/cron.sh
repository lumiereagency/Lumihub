#!/bin/sh
# Chama uma rota de /api/cron do LUMIBASE com o CRON_SECRET do .env.
# Uso no crontab (a cada 15 min):
#   */15 * * * * sh /home/lumibase/app/scripts/cron.sh notifications
set -eu
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROUTE="${1:?informe a rota, ex: notifications}"
env_value() { grep -E "^$1=" "$APP_DIR/.env" | tail -n 1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }
SECRET="$(env_value CRON_SECRET)"
PORT="$(env_value PORT || true)"
curl -fsS -m 120 -X POST -H "Authorization: Bearer $SECRET" "http://127.0.0.1:${PORT:-3000}/api/cron/$ROUTE"
echo
