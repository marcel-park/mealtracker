package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

// items: the amounts in the variation. Ingredients not listed, and listed ones with the same amount
// as in the original, follow the original. servings null: as in the original; weightG null: the
// sum of the ingredients.
public record VariationRequest(
        @NotBlank @Size(max = 100) String name,
        @Positive Double servings,
        @Positive Double weightG,
        @NotNull List<@Valid VariationItemRequest> items) {}
