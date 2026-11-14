-- Tasks the user plans for certain weekdays, the foods each task books when it is ticked off, and
-- which tasks were ticked off on which day. The checklist of a day is not stored: it is the tasks
-- due on its weekday (or ticked off that day), see ChecklistService.

-- weekdays: one bit per day, Monday 1, Tuesday 2, ... Sunday 64; at least one.
CREATE TABLE task (
    id       BIGINT       NOT NULL AUTO_INCREMENT,
    user_id  BIGINT       NOT NULL,
    name     VARCHAR(100) NOT NULL,
    weekdays INT          NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_task_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT chk_task_weekdays CHECK (weekdays BETWEEN 1 AND 127)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Like meal_item: an amount, or a portion of the food and how many. Foods in tasks count as used,
-- so they are never deleted while a task contains them (see FoodService).
CREATE TABLE task_item (
    task_id       BIGINT        NOT NULL,
    food_id       BIGINT        NOT NULL,
    amount        DOUBLE        NULL,
    portion_id    BIGINT        NULL,
    portion_count DECIMAL(8, 2) NULL,
    PRIMARY KEY (task_id, food_id),
    CONSTRAINT fk_task_item_task FOREIGN KEY (task_id) REFERENCES task (id) ON DELETE CASCADE,
    CONSTRAINT fk_task_item_food FOREIGN KEY (food_id) REFERENCES food (id) ON DELETE RESTRICT,
    CONSTRAINT fk_task_item_portion FOREIGN KEY (portion_id, food_id)
        REFERENCES food_portion (id, food_id),
    CONSTRAINT chk_task_item_amount CHECK (amount > 0),
    CONSTRAINT chk_task_item_portion_count CHECK (portion_count > 0),
    CONSTRAINT chk_task_item_quantity CHECK (
        (amount IS NOT NULL AND portion_id IS NULL AND portion_count IS NULL)
        OR (amount IS NULL AND portion_id IS NOT NULL AND portion_count IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A task ticked off on a day, at most once. meal_id: the meal it booked, NULL for a task without
-- foods. Deleting the meal deletes the row (the task is open again); deleting the task deletes it
-- but keeps the meal as an ordinary one.
CREATE TABLE task_completion (
    id      BIGINT NOT NULL AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    done_on DATE   NOT NULL,
    meal_id BIGINT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_task_completion_day UNIQUE (task_id, done_on),
    CONSTRAINT uq_task_completion_meal UNIQUE (meal_id),
    CONSTRAINT fk_task_completion_task FOREIGN KEY (task_id) REFERENCES task (id) ON DELETE CASCADE,
    CONSTRAINT fk_task_completion_meal FOREIGN KEY (meal_id) REFERENCES meal (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
