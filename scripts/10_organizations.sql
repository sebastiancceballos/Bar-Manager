-- Fase C: organizaciones (cliente/negocio) con N sucursales
-- Idempotente: se puede correr más de una vez.

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

-- Backfill: cada location sin org → una organización propia
DO $$
DECLARE
  loc RECORD;
  new_org_id INTEGER;
BEGIN
  FOR loc IN
    SELECT id, name FROM locations WHERE organization_id IS NULL
  LOOP
    INSERT INTO organizations (name, status)
    VALUES (COALESCE(NULLIF(trim(loc.name), ''), 'Negocio') || ' (org)', 'active')
    RETURNING id INTO new_org_id;

    UPDATE locations SET organization_id = new_org_id WHERE id = loc.id;

    -- Admins/staff de esa sucursal heredan la org
    UPDATE users
    SET organization_id = new_org_id
    WHERE location_id = loc.id AND organization_id IS NULL;
  END LOOP;
END $$;

-- Usuarios admin/staff con location pero sin org (por si el loop no los tomó)
UPDATE users u
SET organization_id = l.organization_id
FROM locations l
WHERE u.location_id = l.id
  AND u.organization_id IS NULL
  AND l.organization_id IS NOT NULL;
