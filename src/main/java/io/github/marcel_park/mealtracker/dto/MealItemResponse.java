package io.github.marcel_park.mealtracker.dto;

import java.math.BigDecimal;

// The whole food (unit and portions included), so the app can show and change the amount the same
// way as when booking. amount: in the unit of the food, also for items booked as portions.
// portionId, portionCount: the portion of the food and how many, or both null for an amount.
public record MealItemResponse(
        FoodResponse food,
        double amount,
        Long portionId,
        BigDecimal portionCount,
        double kcal) {

    // An item booked as an amount in g or ml.
    public MealItemResponse(FoodResponse food, double amount, double kcal) {
        this(food, amount, null, null, kcal);
    }
}
