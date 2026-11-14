package io.github.marcel_park.mealtracker.dto;

import java.math.BigDecimal;

// One entry of the shopping list. amount: in the unit of the food, also for entries in portions.
// portionId, portionCount: the portion and how many, or both null for an amount.
public record ShoppingListItemResponse(
        Long id,
        FoodResponse food,
        double amount,
        Long portionId,
        BigDecimal portionCount,
        boolean checked) {}
