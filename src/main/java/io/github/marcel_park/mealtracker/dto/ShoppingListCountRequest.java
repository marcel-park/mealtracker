package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

// The new count of a user item on the shopping list. Replaces the count it had (no adding up).
public record ShoppingListCountRequest(@NotNull @Min(1) @Max(MAX_COUNT) Integer count) {

    // Only guards against absurd numbers; a list entry never needs more.
    public static final int MAX_COUNT = 999;
}
