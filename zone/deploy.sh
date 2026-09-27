#!/bin/sh
# Выкладка на Zone с локальной машины: забрать main, собрать, перезапустить.
#   sh zone/deploy.sh
set -e
ssh virt140715@maksimtsikvasvili24.thkit.ee '
  set -e
  cd ~/tunniplaan-app
  git pull --ff-only
  npm ci --no-audit --no-fund
  NEXT_TELEMETRY_DISABLED=1 npm run build
  pm2 reload tunniplaan
'
