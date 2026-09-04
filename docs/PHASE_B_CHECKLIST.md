# Fase B — Checklist de validación (post-deploy)

## Código centralizado
- [x] `lib/permissions.ts` — canCharge, canManageCashSession, canUseComandas, canAccessDashboardPath
- [x] `middleware.ts` — protege `/dashboard/*` según rol
- [x] APIs caja, cobro mesa, status/listado autoservicio usan permissions
- [x] OrderModal usa canCharge / canRequestBill

## Prueba manual (staging)

### Mesero
1. Login mesero → solo Mesas, Comandas, Reservas, Turno
2. Abrir mesa, agregar productos, **Cuenta pedida**
3. No debe aparecer **Cobrar y Cerrar**
4. URL `/dashboard/orders` o `/dashboard/caja` → redirect (no acceso)

### Cajero
1. Login cajero → Mesas, Comandas, Pedidos autoservicio, Caja, Turno
2. Cobrar mesa con vuelto
3. Confirmar pago de ficho autoservicio
4. En comandas, marcar pedido **listo**
5. Abrir/cerrar caja

### Admin
1. Acceso a productos, reportes, usuarios, y todo lo operativo

## Si algo falla
- Confirmar que el deploy incluye `middleware.ts` y `lib/permissions.ts`
- Hard refresh / nueva sesión (cookie JWT con rol correcto)
