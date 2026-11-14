package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

// The new quantity of a shopping list item: either amount or portionId with portionCount, see
// QuantityRequest. Replaces the quantity it had (no adding up).
public record ShoppingListQuantityRequest(
        @Positive Double amount,
        Long portionId,
        @Positive @Digits(integer = QuantityRequest.MAX_COUNT_DIGITS, fraction = 2) BigDecimal portionCount)
        implements QuantityRequest {

    @AssertTrue(message = "Either amount or portionId and portionCount must be given")
    public boolean isQuantityComplete() {
        return QuantityRequest.isComplete(this);
    }
}
