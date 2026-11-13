-- Foods can be measured in grams or millilitres, and get portions as a booking aid.
--
-- The unit decides how all amounts of a food are read: kcal_per100 is per 100 g or per 100 ml,
-- and every amount of a meal item, recipe item or variation item is in g or ml. Where amounts of
-- different foods are added up (the weight of a recipe), 100 ml count as 100 g.

-- 'G' or 'ML'. Existing foods were all measured in grams. The unit may change later; amounts then
-- keep their numbers in the new unit.
ALTER TABLE food
    ADD COLUMN unit VARCHAR(2) NOT NULL DEFAULT 'G' AFTER name,
    ADD CONSTRAINT chk_food_unit CHECK (unit IN ('G', 'ML'));

-- The amounts are no longer necessarily grams. The CHECK constraints refer to the old column
-- names, so they are dropped before the rename and added again afterwards.
ALTER TABLE food
    RENAME COLUMN kcal_per100g TO kcal_per100;

ALTER TABLE meal_item DROP CONSTRAINT chk_meal_item_amount;
ALTER TABLE meal_item RENAME COLUMN amount_g TO amount;
ALTER TABLE meal_item ADD CONSTRAINT chk_meal_item_amount CHECK (amount > 0);

ALTER TABLE recipe_item DROP CONSTRAINT chk_recipe_item_amount;
ALTER TABLE recipe_item RENAME COLUMN amount_g TO amount;
ALTER TABLE recipe_item ADD CONSTRAINT chk_recipe_item_amount CHECK (amount > 0);

ALTER TABLE recipe_variation_item DROP CONSTRAINT chk_recipe_variation_item_amount;
ALTER TABLE recipe_variation_item RENAME COLUMN amount_g TO amount;
ALTER TABLE recipe_variation_item ADD CONSTRAINT chk_recipe_variation_item_amount CHECK (amount >= 0);

-- Named amounts of a food, e.g. "Packung" = 250 (g) or "kleine Flasche" = 330 (ml), in the unit
-- of the food. Only a help for booking: the app turns a booked portion into its amount right
-- away, so nothing else ever references a portion. They belong to their food: only its owner
-- edits them (FoodService), and they go when the food goes.
--
-- Order: the favorite first, then the others in the order they were added (by id). The first one
-- is the default when booking. FoodService makes sure that a food with portions has exactly one
-- favorite (a partial unique index would say so here, but MariaDB has none).
-- The name is unique per food, compared by the collation: case and accents do not count. FoodService
-- checks the same before saving.
CREATE TABLE food_portion (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    food_id     BIGINT      NOT NULL,
    name        VARCHAR(20) NOT NULL,
    amount      DOUBLE      NOT NULL,
    is_favorite BOOLEAN     NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    CONSTRAINT uq_food_portion_name UNIQUE (food_id, name),
    CONSTRAINT fk_food_portion_food FOREIGN KEY (food_id) REFERENCES food (id) ON DELETE CASCADE,
    CONSTRAINT chk_food_portion_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
