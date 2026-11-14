package io.github.marcel_park.mealtracker.dto;

import java.math.BigDecimal;

// amount: in the unit of the food, also for items in portions (0: left out). portionId,
// portionCount: the portion and how many, or both null for an amount.
public record VariationItemResponse(
        FoodResponse food,
        double amount,
        Long portionId,
        BigDecimal portionCount) {

    // An item saved as an amount in g or ml.
    public VariationItemResponse(FoodResponse food, double amount) {
        this(food, amount, null, null);
    }
}
