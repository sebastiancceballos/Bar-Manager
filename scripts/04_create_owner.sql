-- Create the owner user (platform creator)
-- Password: owner123
-- Hash generated with bcrypt saltRounds=10

-- First, delete any existing owner user to avoid conflicts
DELETE FROM users WHERE role = 'owner';

-- Insert the owner user
-- You should change this password after first login
INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Platform Owner',
  'owner@barmanager.com',
  '$2b$10$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdKr5O4C5XvBMUe',
  'owner'
);

-- Verify the owner was created
SELECT id, name, email, role, created_at FROM users WHERE role = 'owner';
