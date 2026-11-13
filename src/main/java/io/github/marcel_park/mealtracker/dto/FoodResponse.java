package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.FoodPortion;
import io.github.marcel_park.mealtracker.model.FoodUnit;

import java.util.Comparator;
import java.util.List;

// owned: the requesting user owns the food and may edit it. published: everybody can see it.
// portions: the favorite (the default when booking) first, then in the order they were added.
// used: the food is in a meal, recipe or variation of anybody. The app then warns that changing the
// unit keeps the booked amounts as numbers (100 g become 100 ml).
public record FoodResponse(
        Long id,
        String name,
        FoodUnit unit,
        double kcalPer100,
        double protein,
        double carbs,
        double fat,
        List<FoodPortionResponse> portions,
        boolean owned,
        boolean published,
        boolean confirmed,
        boolean used
) {
    // Sorted here as well, not only by @OrderBy on Food.portions: that order only applies when
    // the list is loaded from the database, not after FoodService changed it in the same
    // transaction (a new favorite, new portions appended at the end).
    private static final Comparator<FoodPortion> PORTION_ORDER =
            Comparator.comparing((FoodPortion portion) -> !portion.isFavorite())
                    // ids are only missing if a caller did not flush; such portions were added last
                    .thenComparing(FoodPortion::getId, Comparator.nullsLast(Comparator.naturalOrder()));

    public static FoodResponse from(Food food, Long userId, boolean used) {
        return new FoodResponse(
                food.getId(),
                food.getName(),
                food.getUnit(),
                food.getKcalPer100(),
                food.getProtein(),
                food.getCarbs(),
                food.getFat(),
                food.getPortions().stream().sorted(PORTION_ORDER).map(FoodPortionResponse::from).toList(),
                food.isOwnedBy(userId),
                food.isPublic(),
                food.isConfirmed(),
                used);
    }

    // A food inside a meal, recipe or variation: used by definition.
    public static FoodResponse ofUsed(Food food, Long userId) {
        return from(food, userId, true);
    }
}
