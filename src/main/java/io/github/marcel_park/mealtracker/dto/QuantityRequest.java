package io.github.marcel_park.mealtracker.dto;

import java.math.BigDecimal;

// How much of a food a request item holds: an amount in the unit of the food (g or ml), or a
// portion of that food (portionId) and how many of it (portionCount, two decimals). Exactly one of
// the two, see Quantity in the model. Item requests name their food as well, see
// FoodQuantityRequest; changing only the quantity of an existing item needs no food.
public interface QuantityRequest {

    // Largest portion count the app can type (four digits, two decimals).
    int MAX_COUNT_DIGITS = 4;

    Double amount();

    Long portionId();

    BigDecimal portionCount();

    // For the @AssertTrue of the implementing records.
    static boolean isComplete(QuantityRequest request) {
        boolean asAmount = request.amount() != null;
        boolean asPortion = request.portionId() != null && request.portionCount() != null;
        boolean partialPortion = (request.portionId() == null) != (request.portionCount() == null);
        return asAmount != asPortion && !partialPortion;
    }
}
