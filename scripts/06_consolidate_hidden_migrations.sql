-- Consolida cambios que hoy solo existen en producción porque ciertos endpoints
-- corren "ALTER TABLE ... IF NOT EXISTS" la primera vez que se llaman
-- (GET /api/setup-inventory y PATCH /api/owner/bars). Corre este script en
-- cualquier base de datos nueva para no depender de visitar esos endpoints.

ALTER TABLE locations ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL,
  reason TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
