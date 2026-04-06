-- Fix user passwords with correct bcrypt hashes
-- admin123: $2b$10$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YmMxSUGyMuFm
-- waiter123: $2b$10$V9h8/cIPz0gi.URNNV3C.OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW

-- Update admin password
UPDATE users 
SET password_hash = '$2b$10$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5YmMxSUGyMuFm'
WHERE email = 'admin@barmanager.com';

-- Update waiter password  
UPDATE users 
SET password_hash = '$2b$10$V9h8/cIPz0gi.URNNV3C.OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'
WHERE email = 'waiter@barmanager.com';
