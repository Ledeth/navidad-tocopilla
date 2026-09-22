#!/usr/bin/env bash
# ============================================================================
#  Reinicia los datos de demostración.
#
#  Uso:
#    export DATABASE_URL="postgresql://postgres:CLAVE@db.xxxx.supabase.co:5432/postgres"
#    export SUPABASE_URL="https://xxxx.supabase.co"
#    export SUPABASE_SERVICE_ROLE_KEY="..."
#    ./scripts/reiniciar-demo.sh
#
#  Vuelve a aplicar el seed (borra tutores, beneficiarios, documentos,
#  observaciones, entregas y auditoría) y sube los documentos de ejemplo.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Falta DATABASE_URL (Supabase → Project Settings → Database → Connection string)."
  exit 1
fi

echo "1/3 · Regenerando supabase/seed.sql…"
node scripts/generar-seed.mjs

echo "2/3 · Aplicando el seed en la base de datos…"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql

if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "3/3 · Subiendo documentos de ejemplo…"
  node scripts/documentos-demo.mjs
else
  echo "3/3 · Omitido: defina SUPABASE_SERVICE_ROLE_KEY para subir los documentos de ejemplo."
fi

echo "Datos de demostración reiniciados."
