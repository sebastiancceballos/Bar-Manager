-- Organizaciones exactas: "Estadero la curva" y "BAR-DEMO"
-- No toca ventas, productos ni pedidos. Solo org + organization_id.

CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_locations_organization_id ON locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);

-- 1) Crear organizaciones con el nombre exacto
INSERT INTO organizations (name, status)
SELECT 'Estadero la curva', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE name = 'Estadero la curva'
);

INSERT INTO organizations (name, status)
SELECT 'BAR-DEMO', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE name = 'BAR-DEMO'
);

-- 2) Enlazar locations por nombre exacto de la sucursal
UPDATE locations
SET organization_id = (SELECT id FROM organizations WHERE name = 'Estadero la curva' LIMIT 1)
WHERE name = 'Estadero la curva';

UPDATE locations
SET organization_id = (SELECT id FROM organizations WHERE name = 'BAR-DEMO' LIMIT 1)
WHERE name = 'BAR-DEMO';

-- 3) Usuarios de esas sucursales → misma organización
UPDATE users u
SET organization_id = l.organization_id
FROM locations l
WHERE u.location_id = l.id
  AND l.name IN ('Estadero la curva', 'BAR-DEMO')
  AND l.organization_id IS NOT NULL;

-- 4) Verificación
SELECT o.id AS org_id, o.name AS organizacion,
       l.id AS location_id, l.name AS sucursal
FROM organizations o
LEFT JOIN locations l ON l.organization_id = o.id
WHERE o.name IN ('Estadero la curva', 'BAR-DEMO')
ORDER BY o.name, l.name;

SELECT u.id, u.email, u.role, u.location_id, u.organization_id, l.name AS sucursal
FROM users u
LEFT JOIN locations l ON l.id = u.location_id
WHERE u.organization_id IN (
  SELECT id FROM organizations WHERE name IN ('Estadero la curva', 'BAR-DEMO')
)
ORDER BY u.organization_id, u.role, u.email;
