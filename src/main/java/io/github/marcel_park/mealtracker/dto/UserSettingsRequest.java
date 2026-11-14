package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.ColorTheme;
import io.github.marcel_park.mealtracker.model.Sex;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

// carbsPercent, proteinPercent, fatPercent: how the calorie target splits into the three
// nutrients, in whole percent of the calories. Each 0 to 100, together exactly 100.
// stepGoal: steps per day. weightKg, heightCm, sex: required here as well, so saving the profile
// completes the body data of users who registered before it existed.
public record UserSettingsRequest(
        @NotNull @Min(1) @Max(UserSettingsRequest.MAX_CALORIE_TARGET) Integer calorieTarget,
        @NotNull ColorTheme colorTheme,
        @NotNull @Min(0) @Max(100) Integer carbsPercent,
        @NotNull @Min(0) @Max(100) Integer proteinPercent,
        @NotNull @Min(0) @Max(100) Integer fatPercent,
        @NotNull @Min(1) @Max(BodyData.MAX_STEP_GOAL) Integer stepGoal,
        @NotNull @DecimalMin(BodyData.MIN_WEIGHT_KG) @DecimalMax(BodyData.MAX_WEIGHT_KG)
        @Digits(integer = 3, fraction = BodyData.WEIGHT_FRACTION_DIGITS) BigDecimal weightKg,
        @NotNull @Min(BodyData.MIN_HEIGHT_CM) @Max(BodyData.MAX_HEIGHT_CM) Integer heightCm,
        @NotNull Sex sex) {

    public static final int MAX_CALORIE_TARGET = 20000;

    // Reported as the field "macroPercentSum". Missing values are reported by @NotNull instead.
    @AssertTrue(message = "carbsPercent, proteinPercent and fatPercent must add up to 100")
    public boolean isMacroPercentSum() {
        if (carbsPercent == null || proteinPercent == null || fatPercent == null) {
            return true;
        }
        return carbsPercent + proteinPercent + fatPercent == 100;
    }
}
