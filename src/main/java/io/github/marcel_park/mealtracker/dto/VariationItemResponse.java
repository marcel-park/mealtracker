package io.github.marcel_park.mealtracker.dto;

public record VariationItemResponse(
        FoodResponse food,
        double amount) {}
