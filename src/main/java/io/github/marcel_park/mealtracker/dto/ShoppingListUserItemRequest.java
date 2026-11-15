package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

// Puts count of a user item on the shopping list; added to its entry if it is there already.
public record ShoppingListUserItemRequest(
        @NotNull Long userItemId,
        @NotNull @Min(1) @Max(ShoppingListCountRequest.MAX_COUNT) Integer count) {}
