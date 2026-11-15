package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.FoodUnit;

import java.util.List;

// A food in the search results: what the list shows and what booking needs (unit, kcal, carbs,
// protein and fat for the amount view and the totals of a meal or recipe, and the portions for "+"
// and the amount view). The macros are columns of the food itself, so they cost no query. The
// optional nutrients, EAN and "used" only come with the whole food (GET /api/foods/{id},
// FoodResponse), when its details or its form are opened, so a page of results needs no query for
// nutrients. Fields as in FoodResponse.
public record FoodSummaryResponse(
        Long id,
        String name,
        FoodUnit unit,
        double kcalPer100,
        double protein,
        double carbs,
        double fat,
        List<FoodPortionResponse> portions,
        boolean owned,
        boolean published,
        boolean confirmed
) {
    public static FoodSummaryResponse from(Food food, Long userId) {
        return new FoodSummaryResponse(
                food.getId(),
                food.getName(),
                food.getUnit(),
                food.getKcalPer100(),
                food.getProtein(),
                food.getCarbs(),
                food.getFat(),
                FoodResponse.portionsOf(food),
                food.isOwnedBy(userId),
                food.isPublic(),
                food.isConfirmed());
    }
}
