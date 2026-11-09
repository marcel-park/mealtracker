package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

public record RecipeRequest(
        @NotBlank @Size(max = 100) String name,
        @NotNull @Positive Double servings,
        @NotNull Boolean published,
        @NotEmpty List<@Valid RecipeItemRequest> items) {}
