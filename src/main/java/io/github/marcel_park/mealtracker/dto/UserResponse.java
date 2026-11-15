package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.ColorTheme;
import io.github.marcel_park.mealtracker.model.UserItemVisibility;
import io.github.marcel_park.mealtracker.model.Sex;
import io.github.marcel_park.mealtracker.model.User;

import java.math.BigDecimal;
import java.time.LocalDate;

// Never contains the password hash. carbsPercent, proteinPercent, fatPercent: the split of the
// calorie target, see UserSettingsRequest. weightKg, heightCm, sex, birthDate: null for users who
// registered before they were asked for. The daily targets of the further nutrients are not stored:
// the app computes them from birthDate, sex and the calorie target.
// shareShoppingList: not changeable yet (comes with friends). userItemVisibility: who sees the
// user's items, see UserItemVisibilityRequest.
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
        LocalDate birthDate,
        ColorTheme colorTheme,
        boolean shareShoppingList,
        UserItemVisibility userItemVisibility,
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
                user.getBirthDate(),
                user.getColorTheme(),
                user.isShareShoppingList(),
                user.getUserItemVisibility(),
                user.isAdmin());
    }
}
