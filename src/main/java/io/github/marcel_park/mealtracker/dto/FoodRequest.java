package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.FoodUnit;
import io.github.marcel_park.mealtracker.model.Nutrient;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

// Nutrition values are per 100 of the unit (g or ml). nutrients: the optional ones the food should
// have afterwards (see Nutrient), an empty map removes them all. portions: all portions the food
// should have afterwards, see FoodPortionRequest; an empty list removes them all.
public record FoodRequest(
    @NotBlank @Size(max = 100) String name,
    @NotNull FoodUnit unit,
    @NotNull @PositiveOrZero Double kcalPer100,
    @NotNull @PositiveOrZero Double protein,
    @NotNull @PositiveOrZero Double carbs,
    @NotNull @PositiveOrZero Double fat,
    @NotNull Map<@NotNull Nutrient, @NotNull @PositiveOrZero Double> nutrients,
    @NotNull Boolean published,
    // The limit only guards against absurd requests; the app has no use for that many.
    @NotNull @Size(max = 50) List<@Valid @NotNull FoodPortionRequest> portions
) {

    // A part never exceeds what it is part of: sugar the carbs, each kind of fatty acid the fat,
    // omega-3 the polyunsaturated fat. Each part on its own, not their sum: labels round each
    // value, so the fatty acids may add up to a bit more than the fat. Reported as the field
    // "nutrientParts". Missing values are reported by @NotNull instead.
    @AssertTrue(message = "a part of a nutrient must not exceed the nutrient")
    public boolean isNutrientParts() {
        if (nutrients == null || carbs == null || fat == null) {
            return true;
        }
        Double polyunsaturatedFat = nutrients.get(Nutrient.POLYUNSATURATED_FAT);
        return isWithin(Nutrient.SUGAR, carbs)
                && isWithin(Nutrient.SATURATED_FAT, fat)
                && isWithin(Nutrient.MONOUNSATURATED_FAT, fat)
                && isWithin(Nutrient.POLYUNSATURATED_FAT, fat)
                && isWithin(Nutrient.OMEGA_3, polyunsaturatedFat != null ? polyunsaturatedFat : fat);
    }

    private boolean isWithin(Nutrient part, double whole) {
        Double amount = nutrients.get(part);
        return amount == null || amount <= whole;
    }
}
