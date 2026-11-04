-- "user" is a reserved word in several databases (H2 among them), hence app_user.
CREATE TABLE app_user (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    email          VARCHAR(254) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    calorie_target INT          NOT NULL DEFAULT 2000,
    color_theme    VARCHAR(10)  NOT NULL DEFAULT 'LIGHT',
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    is_admin       BOOLEAN      NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    CONSTRAINT uq_app_user_email UNIQUE (email),
    CONSTRAINT chk_app_user_calorie_target CHECK (calorie_target > 0),
    CONSTRAINT chk_app_user_color_theme CHECK (color_theme IN ('LIGHT', 'DARK'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per logged-in device. Only the SHA-256 hash of the token is stored, so a leaked
-- database does not contain usable tokens. Logging out deletes the row.
CREATE TABLE auth_token (
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    user_id    BIGINT      NOT NULL,
    token_hash CHAR(64)    NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uq_auth_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_auth_token_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Nullable for now: meals booked before multi-user support have no owner yet. The first user who
-- registers takes them over (UserService.register). A later migration can make it NOT NULL.
ALTER TABLE meal
    ADD COLUMN user_id BIGINT NULL,
    ADD CONSTRAINT fk_meal_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE;
