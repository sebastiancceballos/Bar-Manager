-- Fase 5: división de cuenta
CREATE TABLE IF NOT EXISTS order_splits (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  split_index INTEGER NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMP,
  payment_method VARCHAR(20),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, split_index)
);

CREATE INDEX IF NOT EXISTS idx_order_splits_order_id ON order_splits(order_id);
