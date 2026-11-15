-- User items: things for the shopping list that are no food with nutrition values ("Spülmittel",
-- "Batterien"). They only have a name and belong to the user who created them.
--
-- Who sees them is one setting of the owner for all their user items (user_item_visibility):
-- PRIVATE (only the owner, the default) or FRIENDS. User items are never public. Friends do not
-- exist yet, so for now FRIENDS changes nothing.

ALTER TABLE app_user
    ADD COLUMN user_item_visibility VARCHAR(10) NOT NULL DEFAULT 'PRIVATE',
    ADD CONSTRAINT chk_app_user_user_item_visibility CHECK (user_item_visibility IN ('PRIVATE', 'FRIENDS'));

-- A name at most once per owner. The collation compares without case, so "Milch" and "milch" are
-- the same name, as in the app.
CREATE TABLE user_item (
    id       BIGINT       NOT NULL AUTO_INCREMENT,
    owner_id BIGINT       NOT NULL,
    name     VARCHAR(100) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_user_item_owner_name UNIQUE (owner_id, name),
    CONSTRAINT fk_user_item_owner FOREIGN KEY (owner_id) REFERENCES app_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A shopping list entry is now either a food with its quantity (as before) or a user item with a
-- count ("3 ×"). Each user item is on a list at most once, like each food. Deleting a user item
-- takes it off every list (UserItemService does that itself first; the cascade is the safety net).
ALTER TABLE shopping_list_item DROP CONSTRAINT chk_shopping_list_item_quantity;

ALTER TABLE shopping_list_item
    MODIFY COLUMN food_id BIGINT NULL,
    ADD COLUMN user_item_id BIGINT NULL AFTER food_id,
    ADD COLUMN item_count INT NULL AFTER portion_count,
    ADD CONSTRAINT uq_shopping_list_item_user_item UNIQUE (user_id, user_item_id),
    ADD CONSTRAINT fk_shopping_list_item_user_item FOREIGN KEY (user_item_id)
        REFERENCES user_item (id) ON DELETE CASCADE,
    ADD CONSTRAINT chk_shopping_list_item_count CHECK (item_count > 0),
    ADD CONSTRAINT chk_shopping_list_item_quantity CHECK (
        (food_id IS NOT NULL AND user_item_id IS NULL AND item_count IS NULL
            AND ((amount IS NOT NULL AND portion_id IS NULL AND portion_count IS NULL)
                OR (amount IS NULL AND portion_id IS NOT NULL AND portion_count IS NOT NULL)))
        OR (food_id IS NULL AND user_item_id IS NOT NULL AND item_count IS NOT NULL
            AND amount IS NULL AND portion_id IS NULL AND portion_count IS NULL));
