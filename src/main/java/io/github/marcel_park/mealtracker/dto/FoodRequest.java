package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.FoodUnit;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.List;

// Nutrition values are per 100 of the unit (g or ml). portions: all portions the food should have
// afterwards, see FoodPortionRequest; an empty list removes them all.
public record FoodRequest(
    @NotBlank @Size(max = 100) String name,
    @NotNull FoodUnit unit,
    @NotNull @PositiveOrZero Double kcalPer100,
    @NotNull @PositiveOrZero Double protein,
    @NotNull @PositiveOrZero Double carbs,
    @NotNull @PositiveOrZero Double fat,
    @NotNull Boolean published,
    // The limit only guards against absurd requests; the app has no use for that many.
    @NotNull @Size(max = 50) List<@Valid @NotNull FoodPortionRequest> portions
) {}
