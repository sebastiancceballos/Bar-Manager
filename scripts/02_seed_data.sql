-- Seed script for Bar Manager application
-- This adds initial test data

-- Insert test locations
INSERT INTO locations (name, address)
VALUES 
  ('Bar Principal', 'Calle Principal 123, Madrid'),
  ('Bar Centro', 'Plaza Mayor 456, Madrid')
ON CONFLICT DO NOTHING;

-- Get location IDs for use in next inserts
WITH location_ids AS (
  SELECT id FROM locations WHERE name = 'Bar Principal' LIMIT 1
)

-- Insert test users (Admin)
-- Password: admin123
-- Hash: $2b$10$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YmMxSUGyMuFm
INSERT INTO users (email, password_hash, name, role, location_id)
SELECT 
  'admin@barmanager.com',
  '$2b$10$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YmMxSUGyMuFm',
  'Administrador',
  'admin',
  location_ids.id
FROM location_ids
ON CONFLICT (email) DO NOTHING;

-- Insert test users (Waiter)
-- Password: waiter123
-- Hash: $2b$10$V9h8/cIPz0gi.URNNV3C.OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW
WITH location_ids AS (
  SELECT id FROM locations WHERE name = 'Bar Principal' LIMIT 1
)
INSERT INTO users (email, password_hash, name, role, location_id)
SELECT 
  'waiter@barmanager.com',
  '$2b$10$V9h8/cIPz0gi.URNNV3C.OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW',
  'Camarero Test',
  'waiter',
  location_ids.id
FROM location_ids
ON CONFLICT (email) DO NOTHING;

-- Insert test products
WITH location_ids AS (
  SELECT id FROM locations WHERE name = 'Bar Principal' LIMIT 1
)
INSERT INTO products (name, category, price, location_id)
SELECT name, category, price, location_ids.id
FROM location_ids
CROSS JOIN (
  VALUES 
    ('Cerveza', 'Bebidas', 3.50),
    ('Vino Tinto', 'Bebidas', 5.00),
    ('Mojito', 'Cócteles', 8.00),
    ('Agua', 'Bebidas', 2.00),
    ('Refresco', 'Bebidas', 2.50),
    ('Tapa de Jamón', 'Tapas', 4.50),
    ('Pulpo a la Gallega', 'Tapas', 7.00),
    ('Tabla de Quesos', 'Tapas', 12.00),
    ('Croquetas', 'Tapas', 6.00),
    ('Aceitunas', 'Tapas', 2.50)
) AS products_data(name, category, price);

-- Insert test tables
WITH location_ids AS (
  SELECT id FROM locations WHERE name = 'Bar Principal' LIMIT 1
)
INSERT INTO tables (table_number, capacity, location_id)
SELECT 
  table_num::VARCHAR,
  capacity_val,
  location_ids.id
FROM location_ids
CROSS JOIN (
  VALUES 
    (1, 2), (2, 2), (3, 4), (4, 4), (5, 6),
    (6, 2), (7, 4), (8, 6), (9, 8), (10, 2)
) AS tables_data(table_num, capacity_val)
ON CONFLICT DO NOTHING;
