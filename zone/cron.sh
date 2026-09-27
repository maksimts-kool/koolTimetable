#!/bin/sh
# Суточная синхронизация на Zone: Crontab в панели запускает этот файл.
# Секрет читаем из .env.local рядом с приложением, чтобы он не лежал в панели.
# Ходим напрямую на loopback-адрес приложения, мимо внешнего прокси.
cd "$(dirname "$0")/.." || exit 1
SECRET=$(sed -n 's/^CRON_SECRET=//p' .env.local)
exec curl -fsS --max-time 300 -H "Authorization: Bearer $SECRET" http://127.2.76.187:3210/api/cron/sync
