package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.UserItemVisibility;
import jakarta.validation.constraints.NotNull;

// Switched on its own, right when it is tapped in the profile (like the color theme).
public record UserItemVisibilityRequest(@NotNull UserItemVisibility userItemVisibility) {}
