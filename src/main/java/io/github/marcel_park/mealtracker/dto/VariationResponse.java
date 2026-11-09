package io.github.marcel_park.mealtracker.dto;

import java.util.List;

// items: only the ingredients the variation changes, with their amount in the variation (0: left
// out). Everything else comes from the original. servings / weightG null: as in the original /
// the sum of the ingredients.
public record VariationResponse(
        Long id,
        String name,
        Double servings,
        Double weightG,
        List<VariationItemResponse> items) {}
