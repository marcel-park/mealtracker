package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.ColorTheme;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

// carbsPercent, proteinPercent, fatPercent: how the calorie target splits into the three
// nutrients, in whole percent of the calories. Each 0 to 100, together exactly 100.
public record UserSettingsRequest(
        @NotNull @Min(1) @Max(UserSettingsRequest.MAX_CALORIE_TARGET) Integer calorieTarget,
        @NotNull ColorTheme colorTheme,
        @NotNull @Min(0) @Max(100) Integer carbsPercent,
        @NotNull @Min(0) @Max(100) Integer proteinPercent,
        @NotNull @Min(0) @Max(100) Integer fatPercent) {

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
