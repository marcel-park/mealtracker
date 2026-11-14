package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.Nutrient;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.Map;

// The daily targets for the optional nutrients of foods, all the user should have afterwards: a
// nutrient left out has no target. Amounts in the unit of the nutrient (see Nutrient), per day.
public record NutrientTargetsRequest(
        @NotNull Map<@NotNull Nutrient, @NotNull @Positive Double> nutrientTargets) {}
