package io.github.marcel_park.mealtracker.dto;

import java.math.BigDecimal;

// The whole food, so the app can show and change the amount the same way as when booking.
// amount: in the unit of the food, also for items in portions. portionId, portionCount: the
// portion and how many, or both null for an amount.
public record TaskItemResponse(
        FoodResponse food,
        double amount,
        Long portionId,
        BigDecimal portionCount,
        double kcal) {}
