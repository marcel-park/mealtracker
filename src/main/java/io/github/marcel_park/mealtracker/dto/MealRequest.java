package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.Valid;
import java.util.List;

// recipes: which recipes (and variations) the items were booked from. Optional; it only decides
// which variation is preselected next time, see RecipeService.markUsed.
public record MealRequest(
        @NotBlank String title,
        @NotEmpty List<@Valid MealItemRequest> items,
        List<@Valid RecipeUseRequest> recipes) {

    public MealRequest(String title, List<MealItemRequest> items) {
        this(title, items, List.of());
    }
}
