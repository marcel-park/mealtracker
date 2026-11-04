package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.ColorTheme;
import io.github.marcel_park.mealtracker.model.User;

// Never contains the password hash.
public record UserResponse(
        Long id,
        String email,
        int calorieTarget,
        ColorTheme colorTheme,
        boolean admin) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getCalorieTarget(),
                user.getColorTheme(),
                user.isAdmin());
    }
}
