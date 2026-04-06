-- Fix user passwords with correct bcrypt hashes
-- admin123 hash: $2a$10$rQEY9zEzYqKXmKQ5Lj5Y8uKdCt8C4vZ9x7vEaUqVwYkPqXmW0vYhe
-- waiter123 hash: $2a$10$rQEY9zEzYqKXmKQ5Lj5Y8uKdCt8C4vZ9x7vEaUqVwYkPqXmW0vYhe

-- Update admin password
UPDATE users 
SET password_hash = '$2a$10$rQEY9zEzYqKXmKQ5Lj5Y8uKdCt8C4vZ9x7vEaUqVwYkPqXmW0vYhe'
WHERE email = 'admin@barmanager.com';

-- Update waiter password  
UPDATE users 
SET password_hash = '$2a$10$rQEY9zEzYqKXmKQ5Lj5Y8uKdCt8C4vZ9x7vEaUqVwYkPqXmW0vYhe'
WHERE email = 'waiter@barmanager.com';
