package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.Food;

// owned: the requesting user owns the food and may edit it. published: everybody can see it.
public record FoodResponse(
        Long id,
        String name,
        double kcalPer100g,
        double protein,
        double carbs,
        double fat,
        boolean owned,
        boolean published,
        boolean confirmed
) {
    public static FoodResponse from(Food food, Long userId) {
        return new FoodResponse(
                food.getId(),
                food.getName(),
                food.getKcalPer100g(),
                food.getProtein(),
                food.getCarbs(),
                food.getFat(),
                food.isOwnedBy(userId),
                food.isPublic(),
                food.isConfirmed());
    }
}
