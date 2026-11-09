package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.constraints.NotNull;

// A recipe booked with a meal, and in which variation (null: the original).
public record RecipeUseRequest(
        @NotNull Long recipeId,
        Long variationId) {}
