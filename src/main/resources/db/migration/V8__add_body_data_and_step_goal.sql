-- What the app needs to turn steps into calories, and a daily step goal.
--
-- Steps are read from Health Connect on the phone and stay there; only these settings are stored
-- here. The app estimates the calories of steps from the distance walked (steps × step length,
-- which follows height and sex) and the body weight.
--
-- weight_kg, height_cm, sex: required when registering, but NULL for users who registered before;
-- they fill them in once in the profile. sex: 'MALE', 'FEMALE' or 'DIVERSE'.
ALTER TABLE app_user
    ADD COLUMN weight_kg DECIMAL(4, 1) NULL,
    ADD COLUMN height_cm INT           NULL,
    ADD COLUMN sex       VARCHAR(10)   NULL,
    ADD COLUMN step_goal INT           NOT NULL DEFAULT 10000,
    ADD CONSTRAINT chk_app_user_weight CHECK (weight_kg IS NULL OR weight_kg BETWEEN 30 AND 300),
    ADD CONSTRAINT chk_app_user_height CHECK (height_cm IS NULL OR height_cm BETWEEN 100 AND 250),
    ADD CONSTRAINT chk_app_user_sex CHECK (sex IS NULL OR sex IN ('MALE', 'FEMALE', 'DIVERSE')),
    ADD CONSTRAINT chk_app_user_step_goal CHECK (step_goal > 0);
