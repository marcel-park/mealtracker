package io.github.marcel_park.mealtracker.dto;

// The whole food, so the app can book the recipe without loading every food on its own.
public record RecipeItemResponse(
        FoodResponse food,
        double amountG,
        double kcal) {}
