package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.MealItem;
import io.github.marcel_park.mealtracker.model.MealItemId;
import org.springframework.data.jpa.repository.JpaRepository;

// Only answers whether a food is in use; meal items themselves are changed through their meal.
public interface MealItemRepository extends JpaRepository<MealItem, MealItemId> {

    boolean existsByFoodId(Long foodId);

    // In a meal of somebody else.
    boolean existsByFoodIdAndMealUserIdNot(Long foodId, Long userId);
}
