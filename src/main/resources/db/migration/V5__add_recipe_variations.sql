-- Variations of a recipe, e.g. "Gulasch with more meat". Only the owner of a recipe can create
-- variations of it, and only the owner sees them: sharing or publishing a recipe shares the
-- original only. Deleting the recipe deletes its variations.
-- servings / weight_g NULL: as in the original / the sum of the ingredients.
CREATE TABLE recipe_variation (
    id        BIGINT       NOT NULL AUTO_INCREMENT,
    recipe_id BIGINT       NOT NULL,
    name      VARCHAR(100) NOT NULL,
    servings  DOUBLE       NULL,
    weight_g  DOUBLE       NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_recipe_variation_recipe FOREIGN KEY (recipe_id) REFERENCES recipe (id) ON DELETE CASCADE,
    CONSTRAINT chk_recipe_variation_servings CHECK (servings IS NULL OR servings > 0),
    CONSTRAINT chk_recipe_variation_weight CHECK (weight_g IS NULL OR weight_g > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Only the ingredients the variation changes, with their absolute amount in the variation;
-- 0 means "left out". All other ingredients come from the original with its current amounts.
-- A food may also be one the original does not contain (added in the variation).
CREATE TABLE recipe_variation_item (
    variation_id BIGINT NOT NULL,
    food_id      BIGINT NOT NULL,
    amount_g     DOUBLE NOT NULL,
    PRIMARY KEY (variation_id, food_id),
    CONSTRAINT fk_recipe_variation_item_variation FOREIGN KEY (variation_id) REFERENCES recipe_variation (id) ON DELETE CASCADE,
    CONSTRAINT fk_recipe_variation_item_food FOREIGN KEY (food_id) REFERENCES food (id) ON DELETE RESTRICT,
    CONSTRAINT chk_recipe_variation_item_amount CHECK (amount_g >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- What the owner booked last: preselected in the booking view. NULL = the original.
ALTER TABLE recipe
    ADD COLUMN last_used_variation_id BIGINT NULL;

ALTER TABLE recipe
    ADD CONSTRAINT fk_recipe_last_used_variation FOREIGN KEY (last_used_variation_id)
        REFERENCES recipe_variation (id) ON DELETE SET NULL;
