package io.github.marcel_park.mealtracker.dto;

import java.math.BigDecimal;

// One entry of the shopping list: either a food with its quantity, or a user item with a count.
// Food entries: food, amount (in the unit of the food, also for entries in portions), portionId and
// portionCount (the portion and how many, or both null for an amount); userItem and count null.
// User item entries: userItem and count (how many); food, amount, portionId, portionCount null.
public record ShoppingListItemResponse(
        Long id,
        FoodResponse food,
        Double amount,
        Long portionId,
        BigDecimal portionCount,
        boolean checked,
        UserItemResponse userItem,
        Integer count) {

    // A food entry.
    public ShoppingListItemResponse(Long id, FoodResponse food, Double amount, Long portionId,
                                    BigDecimal portionCount, boolean checked) {
        this(id, food, amount, portionId, portionCount, checked, null, null);
    }

    // A user item entry.
    public static ShoppingListItemResponse ofUserItem(Long id, UserItemResponse userItem, int count,
                                                        boolean checked) {
        return new ShoppingListItemResponse(id, null, null, null, null, checked, userItem, count);
    }
}
