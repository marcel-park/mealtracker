package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.ColorTheme;
import io.github.marcel_park.mealtracker.model.Sex;
import io.github.marcel_park.mealtracker.model.User;

import java.math.BigDecimal;

// Never contains the password hash. carbsPercent, proteinPercent, fatPercent: the split of the
// calorie target, see UserSettingsRequest. weightKg, heightCm, sex: null for users who registered
// before they were asked for. shareShoppingList: not changeable yet (comes with friends).
public record UserResponse(
        Long id,
        String email,
        int calorieTarget,
        int carbsPercent,
        int proteinPercent,
        int fatPercent,
        int stepGoal,
        BigDecimal weightKg,
        Integer heightCm,
        Sex sex,
        ColorTheme colorTheme,
        boolean shareShoppingList,
        boolean admin) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getCalorieTarget(),
                user.getCarbsPercent(),
                user.getProteinPercent(),
                user.getFatPercent(),
                user.getStepGoal(),
                user.getWeightKg(),
                user.getHeightCm(),
                user.getSex(),
                user.getColorTheme(),
                user.isShareShoppingList(),
                user.isAdmin());
    }
}
