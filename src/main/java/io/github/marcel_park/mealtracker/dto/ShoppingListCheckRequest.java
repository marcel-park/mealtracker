package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.constraints.NotNull;

public record ShoppingListCheckRequest(@NotNull Boolean checked) {}
