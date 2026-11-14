-- Items can be booked as a number of portions ("2,25 × Stück") instead of an amount in g or ml,
-- and every user gets a shopping list.
--
-- An item stores either its amount (portion_id and portion_count NULL) or a portion and how many
-- of it (amount NULL). The amount of a portion item is never stored: it is portion_count times the
-- amount of the portion, so correcting a portion corrects everything booked with it. Before a
-- portion is deleted, the app turns its items back into amounts (FoodService), so the foreign keys
-- below never have to cascade.
--
-- The foreign keys reference (id, food_id) of the portion, so an item can only use a portion of
-- its own food. A NULL portion_id is not checked (MATCH SIMPLE).

ALTER TABLE food_portion
    ADD CONSTRAINT uq_food_portion_id_food UNIQUE (id, food_id);

-- Meals ----------------------------------------------------------------------------------------

ALTER TABLE meal_item
    MODIFY COLUMN amount DOUBLE NULL,
    ADD COLUMN portion_id BIGINT NULL,
    ADD COLUMN portion_count DECIMAL(8, 2) NULL,
    ADD CONSTRAINT fk_meal_item_portion FOREIGN KEY (portion_id, food_id)
        REFERENCES food_portion (id, food_id),
    ADD CONSTRAINT chk_meal_item_portion_count CHECK (portion_count > 0),
    ADD CONSTRAINT chk_meal_item_quantity CHECK (
        (amount IS NOT NULL AND portion_id IS NULL AND portion_count IS NULL)
        OR (amount IS NULL AND portion_id IS NOT NULL AND portion_count IS NOT NULL));

-- Recipes --------------------------------------------------------------------------------------

ALTER TABLE recipe_item
    MODIFY COLUMN amount DOUBLE NULL,
    ADD COLUMN portion_id BIGINT NULL,
    ADD COLUMN portion_count DECIMAL(8, 2) NULL,
    ADD CONSTRAINT fk_recipe_item_portion FOREIGN KEY (portion_id, food_id)
        REFERENCES food_portion (id, food_id),
    ADD CONSTRAINT chk_recipe_item_portion_count CHECK (portion_count > 0),
    ADD CONSTRAINT chk_recipe_item_quantity CHECK (
        (amount IS NOT NULL AND portion_id IS NULL AND portion_count IS NULL)
        OR (amount IS NULL AND portion_id IS NOT NULL AND portion_count IS NOT NULL));

-- 0 portions: left out in the variation, like amount 0.
ALTER TABLE recipe_variation_item
    MODIFY COLUMN amount DOUBLE NULL,
    ADD COLUMN portion_id BIGINT NULL,
    ADD COLUMN portion_count DECIMAL(8, 2) NULL,
    ADD CONSTRAINT fk_recipe_variation_item_portion FOREIGN KEY (portion_id, food_id)
        REFERENCES food_portion (id, food_id),
    ADD CONSTRAINT chk_recipe_variation_item_portion_count CHECK (portion_count >= 0),
    ADD CONSTRAINT chk_recipe_variation_item_quantity CHECK (
        (amount IS NOT NULL AND portion_id IS NULL AND portion_count IS NULL)
        OR (amount IS NULL AND portion_id IS NOT NULL AND portion_count IS NOT NULL));

-- Shopping list --------------------------------------------------------------------------------

-- One list per user, each food at most once: adding a food that is already on the list adds to
-- its quantity (in the unit of the existing item). position orders the items; checked ones are
-- shown after the unchecked ones, both groups by position.
CREATE TABLE shopping_list_item (
    id            BIGINT        NOT NULL AUTO_INCREMENT,
    user_id       BIGINT        NOT NULL,
    food_id       BIGINT        NOT NULL,
    amount        DOUBLE        NULL,
    portion_id    BIGINT        NULL,
    portion_count DECIMAL(8, 2) NULL,
    is_checked    BOOLEAN       NOT NULL DEFAULT FALSE,
    position      INT           NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_shopping_list_item_food UNIQUE (user_id, food_id),
    CONSTRAINT fk_shopping_list_item_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT fk_shopping_list_item_food FOREIGN KEY (food_id) REFERENCES food (id) ON DELETE RESTRICT,
    CONSTRAINT fk_shopping_list_item_portion FOREIGN KEY (portion_id, food_id)
        REFERENCES food_portion (id, food_id),
    CONSTRAINT chk_shopping_list_item_amount CHECK (amount > 0),
    CONSTRAINT chk_shopping_list_item_portion_count CHECK (portion_count > 0),
    CONSTRAINT chk_shopping_list_item_quantity CHECK (
        (amount IS NOT NULL AND portion_id IS NULL AND portion_count IS NULL)
        OR (amount IS NULL AND portion_id IS NOT NULL AND portion_count IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sharing the list with friends comes with the friends feature; the profile shows the setting
-- disabled until then.
ALTER TABLE app_user
    ADD COLUMN share_shopping_list BOOLEAN NOT NULL DEFAULT FALSE;
