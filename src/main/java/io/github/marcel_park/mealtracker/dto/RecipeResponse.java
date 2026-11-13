package io.github.marcel_park.mealtracker.dto;

import java.util.List;

// amount and kcal are the totals of all items, i.e. of all servings together. In amount, 100 ml of
// a food measured in millilitres count as 100 g.
// variations and lastUsedVariationId are only filled for the owner; everybody else gets an empty
// list and null, so variations are never shared.
public record RecipeResponse(
        Long id,
        String name,
        double servings,
        boolean owned,
        boolean published,
        boolean confirmed,
        double amount,
        double kcal,
        List<RecipeItemResponse> items,
        List<VariationResponse> variations,
        Long lastUsedVariationId) {}
