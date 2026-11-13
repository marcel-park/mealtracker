package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

// amount: in the unit of the food (g or ml). Portions only exist in the app; it sends their amount.
public record MealItemRequest(
        @NotNull Long foodId,
        @Positive double amount) {}
