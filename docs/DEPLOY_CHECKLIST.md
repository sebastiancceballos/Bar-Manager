# Checklist de deploy — Bar Manager

Usar **antes de dar por cerrado** un deploy a producción (Vercel + Neon).  
No marcar el release como listo hasta completar A → E.

---

## A. Base de datos (Neon)

Ejecutar solo lo que **aún no** se haya corrido en ese entorno.  
Orden sugerido para entornos nuevos o incompletos:

### Esquema base (solo instalación nueva)
- [ ] `scripts/01_create_schema_clean.sql` (o el flujo de esquema que uses en prod)
- [ ] `scripts/02_seed_data.sql` (solo demo; **no** en prod con datos reales)

### Migraciones operativas (si faltan)
- [ ] `scripts/05_add_modified_by.sql`
- [ ] `scripts/06_consolidate_hidden_migrations.sql`
- [ ] `scripts/07_add_comanda_status.sql`
- [ ] `scripts/08_operational_features.sql`
- [ ] `scripts/09_self_service.sql`
- [ ] `scripts/11_organizations.sql`
- [ ] `scripts/13_perf_indexes.sql`
- [ ] `scripts/14_must_change_password.sql`
- [ ] `scripts/15_order_splits.sql`
- [ ] `scripts/16_locations_active_and_inventory.sql`
- [ ] `scripts/17_tables_unique_number.sql` (mesas: número único por bar)  
  - Si falla por duplicados: revisar  
    `SELECT location_id, table_number, COUNT(*) FROM tables GROUP BY 1, 2 HAVING COUNT(*) > 1;`

### Datos de cliente (solo si aplica)
- [ ] `scripts/12_orgs_estadero_bardemo.sql` u orgs/locales específicos del cliente

### Comprobación rápida SQL
```sql
-- ¿Hay al menos un local y un admin?
SELECT id, name FROM locations LIMIT 5;
SELECT id, email, role FROM users WHERE role IN ('owner','admin') LIMIT 10;
```

---

## B. Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | ¿Obligatoria? | Notas |
|----------|---------------|--------|
| `DATABASE_URL` | Sí | Connection string de **Neon producción** (no la de test) |
| `JWT_SECRET` | Sí | Cadena larga y aleatoria; no reutilizar la de dev |
| `CRON_SECRET` | Si usas cron | Debe coincidir con lo que envía Vercel Cron |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Si hay push | Par VAPID |
| `VAPID_PRIVATE_KEY` | Si hay push | Nunca en el cliente |
| `VAPID_SUBJECT` | Si hay push | Ej. `mailto:ops@tudominio.com` |

- [ ] Prod y Preview no comparten `JWT_SECRET` débil ni DB de test por error  
- [ ] No hay passwords demo (`admin123`, etc.) en usuarios reales de producción  
- [ ] Redeploy después de cambiar env vars

---

## C. Build y deploy

- [ ] Push / deploy en Vercel en **verde** (`next build` OK)
- [ ] Sin errores TypeScript de filas Neon (ver `docs/TYPES_NEON.md`)
- [ ] Anotar: **commit SHA**, **hora**, **URL** de producción

---

## D. Prueba de cobro (smoke test, ~5 min)

Hacerlo en la **URL de producción** (o preview que apunte a DB de prueba controlada).

### Login
- [ ] Login **admin** del bar
- [ ] Login **cajero** (si existe)

### Mesa
- [ ] Abrir / usar una mesa → agregar producto
- [ ] Cobrar (efectivo **o** transferencia)
- [ ] Tras cobro: aparece pregunta de impresión (si está desplegado ese cambio)
- [ ] La mesa queda libre

### Stock (si el producto lleva inventario)
- [ ] El stock baja al cobrar (no al solo agregar ítem)

### Reportes / números
- [ ] **Admin → Reportes → Hoy**: el cobro aparece en total y en método de pago
- [ ] **Superadmin** (si aplica): la tarjeta de **ese bar** refleja el ingreso de hoy  
  - El total global es *todos los bares*, no un solo local

### Autoservicio (si el cliente lo usa)
- [ ] Crear pedido desde el menú público
- [ ] En caja: ver ficho → marcar pagado / flujo de estados
- [ ] No cuenta como ingreso si está cancelado

### Cajero — reimpresión
- [ ] **Historial → Pedidos de hoy → Imprimir** (pedido recién cobrado)

---

## E. Prueba de impresión

- [ ] Ticket / factura se abre (ventana o diálogo del sistema)
- [ ] Formato usable en térmica 58 mm (si usan PT-210 u similar)
- [ ] Si falla Bluetooth: reimpresión desde Historial (cajero) o detalle del día (admin)

---

## F. Cierre del deploy

| Campo | Valor |
|--------|--------|
| Fecha / hora | |
| Commit | |
| Entorno | producción / preview |
| SQL corrido | (lista o “ninguno, ya estaba”) |
| Smoke test cobro | OK / falló |
| Smoke test impresión | OK / falló / N/A |
| Responsable | |

**Listo para clientes solo si:** build verde + SQL al día + cobro OK.

---

## Notas

1. **Nunca** apuntes desarrollo local a la `DATABASE_URL` de producción al correr tests destructivos.  
2. Si solo cambias frontend, igual conviene el smoke de cobro e impresión.  
3. Tras migraciones de mesas (`17_...`), verificar que no se puedan crear dos mesas con el mismo número en el mismo bar.
