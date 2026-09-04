-- Módulo de autoservicio para clientes: menú público, fichos de pedido,
-- seguimiento en tiempo real (por polling) y paneles de caja/cocina.
--
-- Decisiones de arquitectura (adaptadas a lo que YA tenemos: Neon Postgres +
-- Vercel serverless, sin Prisma Client en runtime, SQL crudo vía lib/db.ts):
--   * NO se usa Redis/BullMQ (no hay proceso persistente en Vercel). El
--     ficho se genera con una SECUENCIA de Postgres (atómica y segura ante
--     condiciones de carrera) y el tiempo real se resuelve con polling
--     simple desde /tracking/[token] (según tu elección).
--   * El número de ficho (ej. #0042) es secuencial y SÍ es adivinable por
--     diseño (es lo que el cliente necesita gritar en el mostrador). Para la
--     URL de seguimiento usamos un token aparte, impredecible (UUID), así
--     nadie puede espiar el pedido de otro cliente cambiando un número en
--     la URL.
--   * Reutilizamos las tablas orders/order_items/products que ya existen en
--     vez de crear MenuItem/Order nuevos: menos tablas duplicadas, mismo
--     dashboard de reportes/auditoría ya funciona para estos pedidos.

-- 1) Extensión necesaria para generar UUIDs en la base (Neon la trae disponible)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) orders: permitir pedidos sin mesa/mesero asignado (autoservicio) y
--    añadir los campos propios del flujo de ficho + seguimiento
ALTER TABLE orders ALTER COLUMN table_id DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN waiter_id DROP NOT NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) NOT NULL DEFAULT 'dine_in';
-- 'dine_in' (flujo mesero/mesa que ya existía) | 'self_service' (nuevo)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT gen_random_uuid();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_notes TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_ticket_number ON orders(ticket_number) WHERE ticket_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_public_token ON orders(public_token) WHERE public_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_order_type_status ON orders(order_type, status);

-- 3) order_items: notas de personalización del cliente (ej. "sin hielo")
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4) products: imagen y disponibilidad para el menú público
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS available BOOLEAN NOT NULL DEFAULT true;

-- 5) Contador atómico para el número de ficho (arranca en 1, formato #0001)
--    Al ser una SEQUENCE de Postgres, dos clientes confirmando pedido al
--    mismo tiempo nunca pueden recibir el mismo número.
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START WITH 1;

-- 6) Locations: activar/desactivar el autoservicio por bar
ALTER TABLE locations ADD COLUMN IF NOT EXISTS self_service_enabled BOOLEAN NOT NULL DEFAULT true;
