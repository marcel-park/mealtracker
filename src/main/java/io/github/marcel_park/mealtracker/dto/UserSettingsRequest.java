package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.ColorTheme;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record UserSettingsRequest(
        @NotNull @Min(1) @Max(UserSettingsRequest.MAX_CALORIE_TARGET) Integer calorieTarget,
        @NotNull ColorTheme colorTheme) {

    public static final int MAX_CALORIE_TARGET = 20000;
}
