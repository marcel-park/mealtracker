package io.github.marcel_park.mealtracker.dto;

import java.time.LocalDateTime;
import java.util.List;

// taskId: the task that booked the meal when it was ticked off, or null. Such a meal can only be
// deleted as a whole, not changed.
public record MealResponse(
        Long id,
        String title,
        LocalDateTime bookedAt,
        double kcal,
        List<MealItemResponse> items,
        Long taskId) {}
