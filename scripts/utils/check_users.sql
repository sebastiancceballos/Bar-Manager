-- Verificar usuarios en la base de datos
SELECT id, email, name, role, password_hash FROM users;

-- Contar todos los usuarios
SELECT COUNT(*) as total_users FROM users;
