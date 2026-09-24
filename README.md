# Bar Manager

Sistema de gestión para bares y restaurantes (POS multi-sucursal): mesas, comandas, caja, autoservicio, inventario y reportes.

## Stack real

| Capa | Tecnología |
|------|------------|
| App | Next.js 15 (App Router), React 19, TypeScript, Tailwind |
| API | Route Handlers de Next.js |
| DB | PostgreSQL en **Neon** con SQL parametrizado (`@neondatabase/serverless`) |
| Auth | JWT en cookie HTTP-only + bcryptjs |
| Transacciones | Pool WebSocket (`lib/db-pool.ts` + `withTransaction`) |

> **Nota:** la carpeta `prisma/` es legado y **no** se usa en runtime. El esquema vivo está en `scripts/*.sql`.

## Roles

| Rol | Uso |
|-----|-----|
| `owner` | Superadmin de la plataforma |
| `admin` | Dueño del negocio / sucursal |
| `cashier` | Caja, mesas, comandas, autoservicio, historial |
| `waiter` | Mesas y comandas |
| `kitchen` | Comandas (legado unificado) |

Detalle: `docs/ROLES.md`.

## Scripts útiles

```bash
pnpm install
pnpm dev          # desarrollo
pnpm build        # producción
pnpm test         # tests unitarios en tests/
```

Migraciones y setup: carpeta `scripts/` (ver `docs/DEPLOY_CHECKLIST.md`).

## Variables de entorno

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | Sí | Connection string Neon (prod) |
| `JWT_SECRET` | Sí | Secreto fuerte para firmar tokens |
| `CRON_SECRET` | Si usas cron | Auth de jobs |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Si hay push | Web Push |

## Estructura

```
app/           # UI + API routes
lib/           # auth, permisos, org, servicios, pure
scripts/       # migraciones SQL
docs/          # checklists y notas de fase
tests/         # tests unitarios
```

## Seguridad

- Contraseñas con bcryptjs
- JWT en cookie HTTP-only
- Permisos centralizados (`lib/permissions.ts`) y aislamiento multi-tenant (`lib/tenant.ts`)
- SQL parametrizado (sin concatenar input de usuario)
- `must_change_password` forzado por middleware

**No uses contraseñas de demo en producción.** Rota cualquier clave que haya estado en repos o demos públicas.

## Deploy

Sigue `docs/DEPLOY_CHECKLIST.md` (SQL → env → build → smoke cobro/impresión).

## Firewall / tablets en el local

El panel de mesas/comandas hace polling moderado. Si Vercel muestra *DDoS Mitigation (deny)*:

1. System Bypass de la IP pública del local (plan Pro)
2. Mantener polling con pestaña oculta sin fetch (ya en código)

## Licencia

Uso privado del proyecto Bar Manager.
