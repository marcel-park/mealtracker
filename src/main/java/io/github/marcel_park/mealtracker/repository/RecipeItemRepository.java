package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.RecipeItem;
import io.github.marcel_park.mealtracker.model.RecipeItemId;
import org.springframework.data.jpa.repository.JpaRepository;

// Only answers whether a food is in use; recipe items themselves are changed through their recipe.
public interface RecipeItemRepository extends JpaRepository<RecipeItem, RecipeItemId> {

    boolean existsByFoodId(Long foodId);

    // In a recipe of somebody else.
    boolean existsByFoodIdAndRecipeOwnerIdNot(Long foodId, Long userId);
}
