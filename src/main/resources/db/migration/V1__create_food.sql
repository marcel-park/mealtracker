CREATE TABLE food (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    name          VARCHAR(100) NOT NULL,
    kcal_per100g  DOUBLE       NOT NULL,
    protein       DOUBLE       NOT NULL,
    carbs         DOUBLE       NOT NULL,
    fat           DOUBLE       NOT NULL,
    PRIMARY KEY (id)
);