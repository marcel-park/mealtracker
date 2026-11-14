package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

// Either amount or portionId with portionCount, see QuantityRequest. amount: in the unit of the food (g or ml).
public record RecipeItemRequest(
        @NotNull Long foodId,
        @Positive Double amount,
        Long portionId,
        @Positive @Digits(integer = QuantityRequest.MAX_COUNT_DIGITS, fraction = 2) BigDecimal portionCount)
        implements FoodQuantityRequest {

    // An amount in g or ml, without portion.
    public RecipeItemRequest(Long foodId, double amount) {
        this(foodId, amount, null, null);
    }

    @AssertTrue(message = "Either amount or portionId and portionCount must be given")
    public boolean isQuantityComplete() {
        return QuantityRequest.isComplete(this);
    }
}
