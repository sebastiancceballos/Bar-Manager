# Roles — Bar Manager

## Valores técnicos (DB / JWT)

| Valor   | Etiqueta UI                 | Alcance                         |
|---------|-----------------------------|---------------------------------|
| owner   | Superadmin                  | Plataforma (todos los negocios) |
| admin   | Administrador del negocio   | Su bar / negocio                |
| cashier | Cajero                      | Mostrador del local             |
| waiter  | Mesero                      | Salón del local                 |
| kitchen | Comandas                    | Preparación (legado)            |

## Operación del local

- **Mesero:** mesas, comandas, reservas, cuenta pedida. **No cobra ni cierra.**
- **Cajero:** mesas, comandas, autoservicio, caja, turno. **Cobra y cierra.**
- **Administrador del negocio:** configuración, reportes, usuarios del bar, y todo lo operativo.
- **Superadmin:** bares, crear administradores de negocio, stats globales.

Fuente de permisos en código: `lib/permissions.ts` y etiquetas en `lib/roles.ts`.
