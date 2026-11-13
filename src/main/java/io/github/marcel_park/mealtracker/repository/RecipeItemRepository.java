package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.RecipeItem;
import io.github.marcel_park.mealtracker.model.RecipeItemId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.Set;

// Only answers whether a food is in use; recipe items themselves are changed through their recipe.
public interface RecipeItemRepository extends JpaRepository<RecipeItem, RecipeItemId> {

    boolean existsByFoodId(Long foodId);

    // In a recipe of somebody else.
    boolean existsByFoodIdAndRecipeOwnerIdNot(Long foodId, Long userId);

    // Which of the given foods are in any recipe. One query for a whole list of foods, see
    // FoodService.find.
    @Query("select distinct i.food.id from RecipeItem i where i.food.id in :foodIds")
    Set<Long> findUsedFoodIds(@Param("foodIds") Collection<Long> foodIds);
}
