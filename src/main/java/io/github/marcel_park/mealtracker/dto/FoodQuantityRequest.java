package io.github.marcel_park.mealtracker.dto;

// A food and how much of it: the items of meal, recipe, variation and shopping list requests.
public interface FoodQuantityRequest extends QuantityRequest {

    Long foodId();
}
