CREATE TABLE meal (
    id        BIGINT       NOT NULL AUTO_INCREMENT,
    title     VARCHAR(100) NOT NULL,
    booked_at DATETIME(6)  NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE meal_item (
    meal_id  BIGINT NOT NULL,
    food_id  BIGINT NOT NULL,
    amount_g DOUBLE NOT NULL,
    PRIMARY KEY (meal_id, food_id),
    CONSTRAINT fk_meal_item_meal FOREIGN KEY (meal_id) REFERENCES meal (id) ON DELETE CASCADE,
    CONSTRAINT fk_meal_item_food FOREIGN KEY (food_id) REFERENCES food (id) ON DELETE RESTRICT,
    CONSTRAINT chk_meal_item_amount CHECK (amount_g > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;