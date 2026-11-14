package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.FoodQuantityRequest;
import io.github.marcel_park.mealtracker.dto.QuantityRequest;
import io.github.marcel_park.mealtracker.exception.InvalidRequestException;
import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.FoodPortion;
import io.github.marcel_park.mealtracker.model.Quantity;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

// Turns the items of a request (meal, recipe, variation, shopping list) into foods with their
// quantities. Used by the services that keep such items.
final class RequestedQuantities {

    // A requested food and how much of it.
    record Requested(Food food, Quantity quantity) {}

    private RequestedQuantities() {}

    // By food id, in request order (LinkedHashMap). A food listed more than once is added up in
    // the unit of its first listing, like the items themselves do (Quantity.plus). loadFood is
    // called once per food; it checks that the user may see the food.
    static Map<Long, Requested> byFoodId(List<? extends FoodQuantityRequest> requests,
                                         Function<Long, Food> loadFood) {
        Map<Long, Food> foods = new LinkedHashMap<>();
        Map<Long, Requested> result = new LinkedHashMap<>();
        for (FoodQuantityRequest request : requests) {
            Food food = foods.computeIfAbsent(request.foodId(), loadFood);
            Quantity quantity = quantityOf(food, request);
            result.merge(request.foodId(), new Requested(food, quantity),
                    (first, next) -> new Requested(food, first.quantity().plus(next.quantity())));
        }
        return result;
    }

    // The portion must be one of the food's own (the database checks that as well).
    static Quantity quantityOf(Food food, QuantityRequest request) {
        if (request.portionId() == null) {
            return Quantity.ofAmount(request.amount());
        }
        FoodPortion portion = food.getPortions().stream()
                .filter(candidate -> request.portionId().equals(candidate.getId()))
                .findFirst()
                .orElseThrow(() -> new InvalidRequestException("Portion with id " + request.portionId()
                        + " does not belong to food with id " + food.getId()));
        return Quantity.ofPortions(portion, request.portionCount());
    }
}
