-- Add modified_by column to orders table to track who last modified the order
ALTER TABLE orders ADD COLUMN IF NOT EXISTS modified_by INTEGER;
ALTER TABLE orders ADD CONSTRAINT orders_modified_by_fk FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL;

-- Add index for modified_by
CREATE INDEX IF NOT EXISTS idx_orders_modified_by ON orders(modified_by);
