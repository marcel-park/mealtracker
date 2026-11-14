package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.ColorTheme;
import jakarta.validation.constraints.NotNull;

// The color theme is switched on its own, right when it is tapped in the profile.
public record ColorThemeRequest(@NotNull ColorTheme colorTheme) {}
