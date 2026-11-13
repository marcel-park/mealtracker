package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.RecipeVariationItem;
import io.github.marcel_park.mealtracker.model.RecipeVariationItemId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Set;

// Only answers whether a food is in use, like MealItemRepository and RecipeItemRepository.
public interface RecipeVariationItemRepository extends JpaRepository<RecipeVariationItem, RecipeVariationItemId> {

    boolean existsByFoodId(Long foodId);

    // In a variation of somebody else (a variation belongs to the owner of its recipe).
    boolean existsByFoodIdAndVariationRecipeOwnerIdNot(Long foodId, Long userId);

    // Which of the given foods are in any variation. One query for a whole list of foods, see
    // FoodService.find.
    @Query("select distinct i.food.id from RecipeVariationItem i where i.food.id in :foodIds")
    Set<Long> findUsedFoodIds(@Param("foodIds") Collection<Long> foodIds);
}
