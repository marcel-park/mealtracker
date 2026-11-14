package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

// Foods to put on the shopping list. recipes: the recipe (and variation) they were taken from,
// remembered as booked last like when booking a meal (RecipeService.markUsed). Optional.
public record ShoppingListAddRequest(
        @NotEmpty List<@Valid ShoppingListItemRequest> items,
        List<@Valid RecipeUseRequest> recipes) {}
