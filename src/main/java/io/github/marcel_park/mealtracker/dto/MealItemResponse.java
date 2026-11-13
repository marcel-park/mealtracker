package io.github.marcel_park.mealtracker.dto;

// The whole food (unit and portions included), so the app can show and change the amount the same
// way as when booking. amount: in the unit of the food.
public record MealItemResponse(
        FoodResponse food,
        double amount,
        double kcal) {}
