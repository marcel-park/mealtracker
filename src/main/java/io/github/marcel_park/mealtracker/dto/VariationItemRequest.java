package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

// Either amount or portionId with portionCount, see QuantityRequest. 0 (as amount or as portions)
// means the ingredient is left out in the variation.
public record VariationItemRequest(
        @NotNull Long foodId,
        @PositiveOrZero Double amount,
        Long portionId,
        @PositiveOrZero @Digits(integer = QuantityRequest.MAX_COUNT_DIGITS, fraction = 2) BigDecimal portionCount)
        implements FoodQuantityRequest {

    // An amount in g or ml, without portion.
    public VariationItemRequest(Long foodId, double amount) {
        this(foodId, amount, null, null);
    }

    @AssertTrue(message = "Either amount or portionId and portionCount must be given")
    public boolean isQuantityComplete() {
        return QuantityRequest.isComplete(this);
    }
}
