-- Foods get an owner and a visibility. Only the owner may edit or delete a food.
-- A food without owner is always public: the foods that existed before this migration, and foods
-- whose owner deleted them or made them private while they were still used in a meal or recipe.
-- Default RESTRICT on owner_id: no user can be deleted while foods still belong to them.
ALTER TABLE food
    ADD COLUMN owner_id     BIGINT  NULL,
    ADD COLUMN is_public    BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN is_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE food
    ADD CONSTRAINT fk_food_owner FOREIGN KEY (owner_id) REFERENCES app_user (id),
    ADD CONSTRAINT chk_food_ownerless_is_public CHECK (owner_id IS NOT NULL OR is_public);

-- A recipe always has an owner. Deleting it removes it for everybody: meals never reference a
-- recipe, booking one books its foods.
CREATE TABLE recipe (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    owner_id     BIGINT       NOT NULL,
    name         VARCHAR(100) NOT NULL,
    servings     DOUBLE       NOT NULL,
    is_public    BOOLEAN      NOT NULL DEFAULT FALSE,
    is_confirmed BOOLEAN      NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    CONSTRAINT fk_recipe_owner FOREIGN KEY (owner_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT chk_recipe_servings CHECK (servings > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Same shape as meal_item: each food at most once per recipe, and a food cannot be deleted while
-- a recipe still contains it (FoodService then only takes the owner away).
CREATE TABLE recipe_item (
    recipe_id BIGINT NOT NULL,
    food_id   BIGINT NOT NULL,
    amount_g  DOUBLE NOT NULL,
    PRIMARY KEY (recipe_id, food_id),
    CONSTRAINT fk_recipe_item_recipe FOREIGN KEY (recipe_id) REFERENCES recipe (id) ON DELETE CASCADE,
    CONSTRAINT fk_recipe_item_food FOREIGN KEY (food_id) REFERENCES food (id) ON DELETE RESTRICT,
    CONSTRAINT chk_recipe_item_amount CHECK (amount_g > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
