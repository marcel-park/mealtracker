package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.MealItem;
import io.github.marcel_park.mealtracker.model.MealItemId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Set;

// Only answers whether a food is in use; meal items themselves are changed through their meal.
public interface MealItemRepository extends JpaRepository<MealItem, MealItemId> {

    boolean existsByFoodId(Long foodId);

    // In a meal of somebody else.
    boolean existsByFoodIdAndMealUserIdNot(Long foodId, Long userId);

    // Which of the given foods are in any meal. One query for a whole list of foods, see
    // FoodService.find.
    @Query("select distinct i.food.id from MealItem i where i.food.id in :foodIds")
    Set<Long> findUsedFoodIds(@Param("foodIds") Collection<Long> foodIds);
}
