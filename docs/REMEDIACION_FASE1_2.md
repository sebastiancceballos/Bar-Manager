# Remediación Fase 1–2

## Rutas adicionales con IDOR (además de tables/products/orders)
- products/[id]/stock, products/[id]/history
- orders/[id]/items, orders/[id]/items/[itemId], orders/[id]/ticket
- reservations/[id]
- cash-sessions/[id]
- locations/[id]
- self-service/orders/[id]/status

## Públicos por diseño (no llevan assert de staff)
- tracking/[token]
- self-service/menu/[locationId]
- self-service POST create order (cliente)

## Owner-only
- organizations/[id]
- owner/*

## Rotar en producción (manual)
Ver final del mensaje de entrega.
