-- 007_products_name_nullable.sql
-- Same reasoning as 006 (barcode_value): a real capture can have OCR/field-
-- extraction fail to produce a product name at all (font-size/placement/OCR
-- coverage is still partial). product_name NOT NULL would make such a capture
-- unstorable in the products table the moment product creation is wired up
-- (Step A1b). Make it nullable -- product_name being empty is a real, valid
-- state to record, not an error condition.

ALTER TABLE products ALTER COLUMN product_name DROP NOT NULL;