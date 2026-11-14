-- Optional nutrients of foods (fiber, sugar, fatty acids, salt, vitamins, minerals) and the daily
-- target of each user for them. Only stated values get a row: a missing row means unknown, not 0.
-- The nutrient is stored by its name in the app (enum Nutrient), which also knows its unit.

-- Per 100 g or 100 ml of the food, like its kcal.
CREATE TABLE food_nutrient (
    food_id  BIGINT      NOT NULL,
    nutrient VARCHAR(30) NOT NULL,
    amount   DOUBLE      NOT NULL,
    PRIMARY KEY (food_id, nutrient),
    CONSTRAINT fk_food_nutrient_food FOREIGN KEY (food_id) REFERENCES food (id) ON DELETE CASCADE,
    CONSTRAINT chk_food_nutrient_amount CHECK (amount >= 0),
    CONSTRAINT chk_food_nutrient_nutrient CHECK (nutrient IN (
        'FIBER', 'SUGAR', 'SATURATED_FAT', 'MONOUNSATURATED_FAT', 'POLYUNSATURATED_FAT', 'OMEGA_3', 'SALT',
        'VITAMIN_A', 'VITAMIN_D', 'VITAMIN_E', 'VITAMIN_K', 'VITAMIN_C', 'VITAMIN_B1', 'VITAMIN_B2',
        'VITAMIN_B3', 'VITAMIN_B5', 'VITAMIN_B6', 'VITAMIN_B7', 'VITAMIN_B9', 'VITAMIN_B12',
        'POTASSIUM', 'CALCIUM', 'MAGNESIUM', 'PHOSPHORUS',
        'IRON', 'ZINC', 'IODINE', 'SELENIUM', 'COPPER', 'MANGANESE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per day. For sugar, saturated fat and salt the app treats it as an upper limit.
CREATE TABLE user_nutrient_target (
    user_id  BIGINT      NOT NULL,
    nutrient VARCHAR(30) NOT NULL,
    amount   DOUBLE      NOT NULL,
    PRIMARY KEY (user_id, nutrient),
    CONSTRAINT fk_user_nutrient_target_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT chk_user_nutrient_target_amount CHECK (amount > 0),
    CONSTRAINT chk_user_nutrient_target_nutrient CHECK (nutrient IN (
        'FIBER', 'SUGAR', 'SATURATED_FAT', 'MONOUNSATURATED_FAT', 'POLYUNSATURATED_FAT', 'OMEGA_3', 'SALT',
        'VITAMIN_A', 'VITAMIN_D', 'VITAMIN_E', 'VITAMIN_K', 'VITAMIN_C', 'VITAMIN_B1', 'VITAMIN_B2',
        'VITAMIN_B3', 'VITAMIN_B5', 'VITAMIN_B6', 'VITAMIN_B7', 'VITAMIN_B9', 'VITAMIN_B12',
        'POTASSIUM', 'CALCIUM', 'MAGNESIUM', 'PHOSPHORUS',
        'IRON', 'ZINC', 'IODINE', 'SELENIUM', 'COPPER', 'MANGANESE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
