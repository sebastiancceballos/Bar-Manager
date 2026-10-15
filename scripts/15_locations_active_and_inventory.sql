-- Esquema que antes se “arreglaba” en runtime (owner/stats, owner/bars, setup-inventory).
-- Ejecutar una vez en Neon; las rutas de aplicación ya no hacen ALTER.

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id);
