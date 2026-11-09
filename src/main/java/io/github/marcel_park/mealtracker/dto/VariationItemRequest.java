package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

// 0 g: the ingredient is left out in the variation.
public record VariationItemRequest(
        @NotNull Long foodId,
        @PositiveOrZero double amountG) {}
