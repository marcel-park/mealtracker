-- How the user's calorie target splits into carbs, protein and fat, in whole percent of the
-- calories. The app turns them into grams (4 kcal per g of carbs or protein, 9 per g of fat) and
-- shows how much of each is booked today. Existing users get the default split 40 / 30 / 30.
ALTER TABLE app_user
    ADD COLUMN carbs_percent   INT NOT NULL DEFAULT 40,
    ADD COLUMN protein_percent INT NOT NULL DEFAULT 30,
    ADD COLUMN fat_percent     INT NOT NULL DEFAULT 30,
    ADD CONSTRAINT chk_app_user_macro_percent CHECK (
        carbs_percent BETWEEN 0 AND 100
        AND protein_percent BETWEEN 0 AND 100
        AND fat_percent BETWEEN 0 AND 100
        AND carbs_percent + protein_percent + fat_percent = 100);
