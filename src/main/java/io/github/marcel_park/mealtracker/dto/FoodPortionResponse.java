package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.FoodPortion;

// amount: in the unit of the food.
public record FoodPortionResponse(
        Long id,
        String name,
        double amount,
        boolean favorite) {

    public static FoodPortionResponse from(FoodPortion portion) {
        return new FoodPortionResponse(
                portion.getId(), portion.getName(), portion.getAmount(), portion.isFavorite());
    }
}
