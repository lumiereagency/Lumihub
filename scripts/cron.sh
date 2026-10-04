#!/bin/sh
# Chama uma rota de /api/cron do LUMIBASE com o CRON_SECRET do .env.
# Uso no crontab:
#   */15 * * * * sh /home/lumibase/app/scripts/cron.sh notifications
#   */15 * * * * sh /home/lumibase/app/scripts/cron.sh process-reminders
set -eu
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROUTE="${1:?informe a rota, ex: notifications}"
env_value() { grep -E "^$1=" "$APP_DIR/.env" | tail -n 1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true; }
SECRET="$(env_value CRON_SECRET)"
PORT="$(env_value PORT)"
BASE="http://127.0.0.1:${PORT:-3000}"
# Se o app não responder na porta local, usa o endereço público (APP_URL).
if ! curl -s -o /dev/null -m 5 "$BASE/login"; then
  BASE="$(env_value APP_URL)"
fi
curl -fsS -m 300 -X POST -H "Authorization: Bearer $SECRET" "${BASE%/}/api/cron/$ROUTE"
echo
