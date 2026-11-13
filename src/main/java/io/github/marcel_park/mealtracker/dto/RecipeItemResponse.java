package io.github.marcel_park.mealtracker.dto;

// The whole food, so the app can book the recipe without loading every food on its own.
// amount: in the unit of the food.
public record RecipeItemResponse(
        FoodResponse food,
        double amount,
        double kcal) {}
