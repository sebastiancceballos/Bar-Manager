# Fases 5 y 6

## Fase 5 — Dividir cuenta
- SQL: `scripts/15_order_splits.sql`
- `lib/order-split.ts` — computeSplit / houseRemainder
- `POST/GET /api/orders/[id]/split`
- `PATCH /api/orders/[id]/split/[splitIndex]`
- UI: botón "Dividir cuenta" en OrderModal
- Test: `tests/order-split.test.mjs` (10000/3 → residuo 1 casa)

## Fase 6
- `lib/errors.ts` + `toErrorResponse`
- `lib/services/order-totals.ts`, `reports-scope.ts`
- InsufficientStockError unificado vía errors.ts
