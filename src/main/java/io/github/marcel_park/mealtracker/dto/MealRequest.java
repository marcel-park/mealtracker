package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.Valid;
import java.util.List;

public record MealRequest(
        @NotBlank String title,
        @NotEmpty List<@Valid MealItemRequest> items) {}
