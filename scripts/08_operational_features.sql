-- Funciones operativas: pagos/propinas/descuentos, turno de caja, bitácora,
-- bloqueo de fuerza bruta en login, y una zona horaria por bar para que los
-- reportes de "hoy" corten a medianoche LOCAL en vez de a medianoche UTC.

-- 1) Pagos, propinas y descuentos en la orden
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_authorized_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- 2) Impuesto (IVA) configurable y zona horaria por bar
ALTER TABLE locations ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 4) NOT NULL DEFAULT 0;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'America/Bogota';

-- 3) Bloqueo por intentos fallidos de login (mitigación de fuerza bruta)
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- 4) Evitar condición de carrera: nunca más de una orden abierta por mesa
--    (si dos meseros abren la misma mesa vacía casi al mismo tiempo, uno de
--    los dos INSERT fallará limpiamente en vez de crear dos órdenes abiertas)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_order_per_table
  ON orders(table_id)
  WHERE status = 'open';

-- 5) Turnos de caja (apertura/cierre con arqueo)
CREATE TABLE IF NOT EXISTS cash_sessions (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  opened_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  opening_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
  closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  closing_amount NUMERIC(10, 2),
  expected_amount NUMERIC(10, 2),
  difference NUMERIC(10, 2),
  closed_at TIMESTAMP,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_location ON cash_sessions(location_id);

-- Solo puede haber un turno abierto (closed_at IS NULL) por bar a la vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_session_per_location
  ON cash_sessions(location_id)
  WHERE closed_at IS NULL;

-- 6) Bitácora de auditoría
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_location ON audit_log(location_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- 7) Reservas de mesas
CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  party_size INTEGER NOT NULL DEFAULT 2,
  reservation_time TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmada', -- confirmada | cancelada | completada | no_show
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reservations_location_time ON reservations(location_id, reservation_time);

-- 8) Turnos de trabajo del personal (entrada/salida)
CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  clock_in TIMESTAMP NOT NULL DEFAULT NOW(),
  clock_out TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shifts_user ON shifts(user_id);

-- Solo un turno abierto (clock_out IS NULL) por usuario a la vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_shift_per_user
  ON shifts(user_id)
  WHERE clock_out IS NULL;
