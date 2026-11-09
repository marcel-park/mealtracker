package io.github.marcel_park.mealtracker.dto;

import java.util.List;

// amountG and kcal are the totals of all items, i.e. of all servings together.
// variations and lastUsedVariationId are only filled for the owner; everybody else gets an empty
// list and null, so variations are never shared.
public record RecipeResponse(
        Long id,
        String name,
        double servings,
        boolean owned,
        boolean published,
        boolean confirmed,
        double amountG,
        double kcal,
        List<RecipeItemResponse> items,
        List<VariationResponse> variations,
        Long lastUsedVariationId) {}
