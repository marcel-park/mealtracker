package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record FoodRequest(
    @NotBlank @Size(max = 100) String name,
    @NotNull @PositiveOrZero Double kcalPer100g,
    @NotNull @PositiveOrZero Double protein,
    @NotNull @PositiveOrZero Double carbs,
    @NotNull @PositiveOrZero Double fat
) {}
