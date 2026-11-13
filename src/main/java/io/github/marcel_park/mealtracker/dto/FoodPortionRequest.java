package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.FoodPortion;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

// One portion of a food as the owner wants it saved. id: an existing portion of that food to
// update, null for a new one. amount: in the unit of the food. Exactly one portion of a food is the
// favorite (the default when booking); if none is marked, FoodService picks the oldest. favorite may
// be left out, which means false.
public record FoodPortionRequest(
        Long id,
        @NotBlank @Size(max = FoodPortion.MAX_NAME_LENGTH) String name,
        @NotNull @Positive Double amount,
        Boolean favorite) {

    public FoodPortionRequest {
        favorite = Boolean.TRUE.equals(favorite);
    }
}
