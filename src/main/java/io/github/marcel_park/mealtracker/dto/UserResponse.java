package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.ColorTheme;
import io.github.marcel_park.mealtracker.model.User;

// Never contains the password hash. carbsPercent, proteinPercent, fatPercent: the split of the
// calorie target, see UserSettingsRequest.
public record UserResponse(
        Long id,
        String email,
        int calorieTarget,
        int carbsPercent,
        int proteinPercent,
        int fatPercent,
        ColorTheme colorTheme,
        boolean admin) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getCalorieTarget(),
                user.getCarbsPercent(),
                user.getProteinPercent(),
                user.getFatPercent(),
                user.getColorTheme(),
                user.isAdmin());
    }
}
