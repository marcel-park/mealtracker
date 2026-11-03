package io.github.marcel_park.mealtracker.dto;

import java.time.LocalDateTime;
import java.util.List;

public record MealResponse(
        Long id,
        String title,
        LocalDateTime bookedAt,
        double kcal,
        List<MealItemResponse> items) {}
