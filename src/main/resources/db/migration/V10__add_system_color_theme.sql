-- The color theme can follow the device ("SYSTEM"), now the default. Nobody could choose a theme
-- before (the app always followed the device), so every existing account gets SYSTEM as well.
ALTER TABLE app_user DROP CONSTRAINT chk_app_user_color_theme;

UPDATE app_user SET color_theme = 'SYSTEM';

ALTER TABLE app_user
    ALTER COLUMN color_theme SET DEFAULT 'SYSTEM',
    ADD CONSTRAINT chk_app_user_color_theme CHECK (color_theme IN ('SYSTEM', 'LIGHT', 'DARK'));
