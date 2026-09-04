#!/bin/bash
# Aplica el esquema real de la base de datos.
# Este proyecto usa SQL crudo (no Prisma migrate) — los scripts numerados en
# /scripts son la fuente de verdad. Antes este archivo llamaba a
# `prisma migrate deploy` y `ts-node prisma/seed.ts`, pero ni `prisma` ni
# `ts-node` están instalados en package.json, así que nunca funcionó.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "Error: define la variable DATABASE_URL antes de correr este script."
  exit 1
fi

echo "Aplicando esquema y migraciones..."
for f in ../scripts/01_create_schema_clean.sql ../scripts/05_add_modified_by.sql ../scripts/06_consolidate_hidden_migrations.sql ../scripts/07_add_comanda_status.sql; do
  echo "-> $f"
  psql "$DATABASE_URL" -f "$f"
done

echo "Sembrando datos de prueba..."
npx tsx seed.ts

echo "Listo."
