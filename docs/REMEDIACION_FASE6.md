# Fase 6 al 100%

- `lib/services/orders.ts` — transfer, closeOrderWithPayment, setOrderManualStatus, attachOrderItems
- `app/api/orders/[id]/route.ts` — ~120 líneas, usa toErrorResponse
- `lib/services/reports-handlers.ts` — org_summary, by-waiter, top-products, payment, order-type, timeseries
- `app/api/reports/route.ts` — router delgado
- `lib/errors.ts` + catches críticos con toErrorResponse
- Tests: order-totals, order-split, tenant
