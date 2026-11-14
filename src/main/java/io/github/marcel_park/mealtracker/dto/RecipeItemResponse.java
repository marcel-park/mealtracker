package io.github.marcel_park.mealtracker.dto;

import java.math.BigDecimal;

// The whole food, so the app can book the recipe without loading every food on its own.
// amount: in the unit of the food, also for items in portions. portionId, portionCount: the
// portion and how many, or both null for an amount.
public record RecipeItemResponse(
        FoodResponse food,
        double amount,
        Long portionId,
        BigDecimal portionCount,
        double kcal) {

    // An item saved as an amount in g or ml.
    public RecipeItemResponse(FoodResponse food, double amount, double kcal) {
        this(food, amount, null, null, kcal);
    }
}
