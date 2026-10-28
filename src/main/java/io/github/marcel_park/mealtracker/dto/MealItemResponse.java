package io.github.marcel_park.mealtracker.dto;

public record MealItemResponse(
        Long foodId,
        String foodName,
        double amountG,
        double kcal) {}
