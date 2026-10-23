package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.Food;

public record FoodResponse(
        Long id,
        String name,
        double kcalPer100g,
        double protein,
        double carbs,
        double fat
) {
    public static FoodResponse from(Food food) {
        return new FoodResponse(
                food.getId(),
                food.getName(),
                food.getKcalPer100g(),
                food.getProtein(),
                food.getCarbs(),
                food.getFat());
    }
}
