-- The EAN (GTIN) of a food from the shop, optional: 8, 12, 13 or 14 digits as printed under the
-- barcode. Not unique: users may enter the same product themselves. The index serves the barcode
-- scanner that comes later. The app checks the check digit, see Gtin.
ALTER TABLE food
    ADD COLUMN ean_code VARCHAR(14) NULL AFTER name,
    ADD CONSTRAINT chk_food_ean_code CHECK (ean_code IS NULL OR ean_code REGEXP '^([0-9]{8}|[0-9]{12,14})$');

CREATE INDEX idx_food_ean_code ON food (ean_code);
