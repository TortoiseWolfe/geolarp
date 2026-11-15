#!/usr/bin/env bash
# Writes wordpress/.env with throwaway passwords. The file is gitignored and never leaves
# this machine. Run once; re-running keeps the existing file.
set -euo pipefail
cd "$(dirname "$0")"
if [ -f .env ]; then echo ".env already exists, keeping it"; exit 0; fi
umask 077
{
  echo "WP_PORT=8095"
  echo "WP_URL=http://127.0.0.1:8095"
  echo "WP_ADMIN_USER=geolarp-admin"
  echo "DB_PASSWORD=$(openssl rand -hex 16)"
  echo "WP_ADMIN_PASSWORD=$(openssl rand -hex 16)"
} > .env
echo "wrote wordpress/.env (view it with redact_view.py; never paste it)"
