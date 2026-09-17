-- "Marketed by" is a distinct legal declaration under LMR 2011, separate
-- from manufacturer/packer/importer -- it had no column to land in, so
-- fieldExtractor.js on the frontend was collapsing it into packer fields.
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS marketed_by_name VARCHAR(255) NULL;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS marketed_by_address TEXT NULL;