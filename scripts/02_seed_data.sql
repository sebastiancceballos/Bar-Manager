-- Seed script for Bar Manager application
-- This adds initial test data

-- Insert test locations
INSERT INTO locations (name, address, city, phone, active)
VALUES 
  ('Bar Principal', 'Calle Principal 123', 'Madrid', '+34 91 234 5678', true),
  ('Bar Centro', 'Plaza Mayor 456', 'Madrid', '+34 91 987 6543', true)
ON CONFLICT (name) DO NOTHING;

-- Get location IDs for use in next inserts
WITH location_ids AS (
  SELECT id FROM locations WHERE name = 'Bar Principal' LIMIT 1
)

-- Insert test users (Admin)
INSERT INTO users (email, password_hash, name, role, location_id, active)
SELECT 
  'admin@barmanager.com',
  '$2b$10$5qF9.8gJTx6yYUv5s7Z8yuOlKq5FfHW5nKvBjJ1Z7vZ0U8qQ1j4g2', -- password: admin123
  'Administrador',
  'admin',
  location_ids.id,
  true
FROM location_ids
ON CONFLICT (email) DO NOTHING;

-- Insert test users (Waiter)
WITH location_ids AS (
  SELECT id FROM locations WHERE name = 'Bar Principal' LIMIT 1
)
INSERT INTO users (email, password_hash, name, role, location_id, active)
SELECT 
  'waiter@barmanager.com',
  '$2b$10$5qF9.8gJTx6yYUv5s7Z8yuOlKq5FfHW5nKvBjJ1Z7vZ0U8qQ1j4g2', -- password: waiter123
  'Camarero Test',
  'waiter',
  location_ids.id,
  true
FROM location_ids
ON CONFLICT (email) DO NOTHING;

-- Insert test products
WITH location_ids AS (
  SELECT id FROM locations WHERE name = 'Bar Principal' LIMIT 1
)
INSERT INTO products (name, category, price, location_id, active)
SELECT name, category, price, location_ids.id, true
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
) AS products_data(name, category, price)
ON CONFLICT DO NOTHING;

-- Insert test tables
WITH location_ids AS (
  SELECT id FROM locations WHERE name = 'Bar Principal' LIMIT 1
)
INSERT INTO tables (table_number, capacity, location_id, active)
SELECT 
  table_num,
  capacity_val,
  location_ids.id,
  true
FROM location_ids
CROSS JOIN (
  VALUES 
    (1, 2), (2, 2), (3, 4), (4, 4), (5, 6),
    (6, 2), (7, 4), (8, 6), (9, 8), (10, 2)
) AS tables_data(table_num, capacity_val)
ON CONFLICT DO NOTHING;
