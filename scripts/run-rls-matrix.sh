#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -z "${COOKINGAPP_DATABASE_URL:-}" ]]; then
  echo "Set COOKINGAPP_DATABASE_URL to the Supabase direct or session-pooler Postgres URL." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to run the RLS privacy matrix." >&2
  exit 2
fi

psql "$COOKINGAPP_DATABASE_URL" \
  --no-psqlrc \
  --set ON_ERROR_STOP=1 \
  --file "$PROJECT_DIR/supabase/tests/rls_privacy_matrix.sql"
