-- The daily targets of the further nutrients are no longer typed in: the app computes them from
-- the DGE/ÖGE reference values, by age, sex and calorie target. So the birth date is stored, and
-- the targets the users had set are dropped.
--
-- birth_date: required when registering and when saving the profile, but NULL for users who
-- registered before; they fill it in once in the profile. Whether it lies in the past is checked
-- by the app (a CHECK constraint cannot use the current date).
ALTER TABLE app_user
    ADD COLUMN birth_date DATE NULL,
    ADD CONSTRAINT chk_app_user_birth_date CHECK (birth_date IS NULL OR birth_date >= '1900-01-01');

DROP TABLE user_nutrient_target;
