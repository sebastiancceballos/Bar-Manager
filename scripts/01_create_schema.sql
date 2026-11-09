-- Drop existing constraints and recreate cleanly
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS daily_income CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'waiter',
  location_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create locations table
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key to users
ALTER TABLE users ADD CONSTRAINT users_location_fk FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

-- Create tables table
CREATE TABLE tables (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL,
  table_number VARCHAR(50) NOT NULL,
  capacity INTEGER DEFAULT 4,
  x_position FLOAT DEFAULT 0,
  y_position FLOAT DEFAULT 0,
  width FLOAT DEFAULT 80,
  height FLOAT DEFAULT 80,
  status VARCHAR(50) DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tables_location_fk FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

-- Create products table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT products_location_fk FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

-- Create orders table
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  table_id INTEGER NOT NULL,
  waiter_id INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'open',
  total_amount DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  CONSTRAINT orders_table_fk FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
  CONSTRAINT orders_waiter_fk FOREIGN KEY (waiter_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create order_items table
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT order_items_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Create daily_income table
CREATE TABLE daily_income (
  id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL,
  date DATE NOT NULL,
  total_income DECIMAL(10, 2) DEFAULT 0,
  order_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT daily_income_location_fk FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_location_id ON users(location_id);
CREATE INDEX idx_tables_location_id ON tables(location_id);
CREATE INDEX idx_products_location_id ON products(location_id);
CREATE INDEX idx_orders_table_id ON orders(table_id);
CREATE INDEX idx_orders_waiter_id ON orders(waiter_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_daily_income_location_id ON daily_income(location_id);
