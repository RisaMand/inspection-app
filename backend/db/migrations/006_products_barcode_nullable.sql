-- 006_products_barcode_nullable.sql
-- Barcode scanning isn't built yet (Person 3's Phase 6), so barcode_value being
-- UNIQUE NOT NULL blocks creating a product record for any capture without a
-- barcode -- currently all of them. Make it nullable, and replace the blanket
-- UNIQUE constraint with a partial unique index that only applies once a real
-- barcode is present, so future barcode collisions are still caught.

ALTER TABLE products ALTER COLUMN barcode_value DROP NOT NULL;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_value_key;

CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_value_unique_idx
    ON products (barcode_value)
    WHERE barcode_value IS NOT NULL;