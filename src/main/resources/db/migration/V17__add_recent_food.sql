-- The foods each user used last, for the search filter "Zuletzt" (scope RECENT, see FoodService):
-- one row per user and food, with when it was last booked or added to a recipe, a variation, a
-- task or the shopping list (see RecentFoodService). Deleting the food or the user deletes the row.
CREATE TABLE recent_food (
    user_id BIGINT      NOT NULL,
    food_id BIGINT      NOT NULL,
    used_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id, food_id),
    KEY idx_recent_food_user_used_at (user_id, used_at),
    CONSTRAINT fk_recent_food_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT fk_recent_food_food FOREIGN KEY (food_id) REFERENCES food (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Until now "Zuletzt" were the foods of the user's meals, by the time the meal was booked for:
-- they start the list, so nobody finds it empty after the update.
INSERT INTO recent_food (user_id, food_id, used_at)
SELECT m.user_id, i.food_id, MAX(m.booked_at)
FROM meal_item i
         JOIN meal m ON m.id = i.meal_id
WHERE m.user_id IS NOT NULL
GROUP BY m.user_id, i.food_id;
