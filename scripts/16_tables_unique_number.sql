-- Unicidad de número de mesa por local + limpieza básica de espacios
-- Si hay duplicados previos, resuélvelos antes de crear el índice único.

-- Opcional: ver duplicados
-- SELECT location_id, table_number, COUNT(*) FROM tables GROUP BY 1, 2 HAVING COUNT(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tables_location_number
  ON tables (location_id, table_number);
