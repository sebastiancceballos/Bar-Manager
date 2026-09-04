-- Añade seguimiento de estado por ítem para el tablero de Comandas (barra/cocina)
-- Estados posibles: 'pendiente' -> 'preparando' -> 'listo' -> 'entregado'
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pendiente';

CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);
