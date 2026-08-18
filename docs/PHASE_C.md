# Fase C ampliada

## Deploy

1. Neon: `scripts/11_organizations.sql` y, si aplica, `12_orgs_estadero_bardemo.sql`
2. Desplegar este código
3. Superadmin → **Organizaciones** (alta guiada + CRUD)
4. Admin multi-sucursal: selector **Sucursal** en el header

## Qué incluye

- `resolveLocationId` en productos, reportes, stats, mesas, caja, SS, reservas, shifts, audit, users
- Reportes: `type=org_summary` + bloque consolidado en UI
- CRUD organizaciones: crear, renombrar, suspender/activar, eliminar (vacías)
- Wizard: org → sucursal → admin del negocio
- Medio de pago en cobro de fichos (fase C anterior)

## Notas

- Suspender org intenta poner `locations.active = false`
- Consolidado usa la org de la **sucursal activa**
- "Entrar como" (impersonation) no está incluido
