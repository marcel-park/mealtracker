# Data model and migrations

[English](data-model.md) | [Deutsch](de/data-model.md)

Flyway versions the database schema under `src/main/resources/db/migration`. Hibernate is configured with `ddl-auto=validate` and expects the migrations to have created the schema.

## Entities

- `Food`: name and nutrition values (calories, protein, carbohydrates, and fat) per 100 g.
- `Meal`: title and booking timestamp.
- `MealItem`: links a meal to a food and stores the amount in grams. A food can occur only once in each meal.

## Relationships and integrity

`meal_item` has a composite primary key made up of `meal_id` and `food_id`. Deleting a meal cascades to its items. Foods already used in a meal cannot be deleted because of `ON DELETE RESTRICT`. The amount must be greater than zero.

## Migrations

- `V1__create_food.sql`: creates the foods table.
- `V2__create_meal_tables.sql`: creates meals and their food items, including foreign keys.