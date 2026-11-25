#!/usr/bin/env bash
# One-command local run (SQLite). Requires Python 3.10+ and Node 18+.
set -e
cd "$(dirname "$0")"
(cd frontend && npm install --no-audit --no-fund && npm run build)
cd backend
python3 -m pip install -r requirements.txt
ONS_SECRET_KEY="${ONS_SECRET_KEY:-$(python3 -c 'import secrets;print(secrets.token_hex(32))')}" \
  python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
