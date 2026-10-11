# Pruebas de base de datos (PGlite)

Ejecutan las **rutas y servicios reales** (`app/api/**`, `lib/services/**`) contra un
Postgres en memoria ([PGlite](https://pglite.dev)). No usan Neon, no leen `DATABASE_URL`
y no pueden tocar datos reales: la base se crea al iniciar y desaparece al terminar.

Esta carpeta es independiente: tiene su propio `package.json` y no modifica el del proyecto.

## Cómo correrlas

```bash
cd tests/db
npm install      # solo la primera vez (PGlite y tsx)
npm test
```

Requiere Node 22 o superior. Para correr un solo archivo: `node run.mjs charge`.

Para probar **otra copia** del proyecto (por ejemplo la versión anterior):

```bash
PROJECT_ROOT=/ruta/a/otra/copia node run.mjs
```

## Qué cubren

- `items.test.ts`: agregar, restar y quitar ítems (sin tocar el stock), cantidades inválidas,
  productos de otra sede, ítems de otra orden, órdenes ya cobradas, altas simultáneas, aviso de stock.
- `charge.test.ts`: el cobro descuenta el stock una sola vez, rechaza un segundo cobro,
  se bloquea si falta stock, cuentas divididas, autoservicio, y órdenes creadas con el sistema anterior.
- `extra.test.ts`: cocina, estado `bill_requested`, compatibilidad con órdenes viejas,
  cancelaciones dobles e idioma de los mensajes.

## Cómo está armado

1. `adapters/state.ts` crea la base y carga los scripts de `scripts/*.sql` en orden
   (omite `CREATE EXTENSION pgcrypto`, que PGlite no incluye; `gen_random_uuid()` ya es nativo).
2. `adapters/hooks.mjs` redirige, solo durante las pruebas, `lib/db.ts`, `lib/db-pool.ts`
   y `next/headers` a adaptadores que apuntan a PGlite.
3. `harness.ts` siembra datos (1 org, 2 sedes, usuarios por rol, mesas, productos)
   y llama a los handlers reales con su cookie de sesión.

## Lo que estas pruebas NO demuestran

- **Neon real**: latencia, arranque en frío, límites del plan.
- **Bloqueos de fila**: PGlite tiene una sola conexión y el adaptador serializa las
  transacciones por su cuenta. La protección contra operaciones simultáneas en producción
  depende de `SELECT ... FOR UPDATE` sobre la orden (está en el código), pero estas pruebas
  no pueden comprobar que ese bloqueo funcione en Postgres real.
- **La pantalla**: el estado de los botones, el refresco o los avisos visuales. Eso requiere
  pruebas de navegador.
