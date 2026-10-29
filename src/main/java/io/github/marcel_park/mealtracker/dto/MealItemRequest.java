package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record MealItemRequest(
        @NotNull Long foodId,
        @Positive double amountG) {}
