-- Índices de rendimiento (Fase 4 remediación). Idempotente.
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_location_id ON products(location_id);
CREATE INDEX IF NOT EXISTS idx_tables_location_id ON tables(location_id);
