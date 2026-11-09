package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.RecipeVariationItem;
import io.github.marcel_park.mealtracker.model.RecipeVariationItemId;
import org.springframework.data.jpa.repository.JpaRepository;

// Only answers whether a food is in use, like MealItemRepository and RecipeItemRepository.
public interface RecipeVariationItemRepository extends JpaRepository<RecipeVariationItem, RecipeVariationItemId> {

    boolean existsByFoodId(Long foodId);

    // In a variation of somebody else (a variation belongs to the owner of its recipe).
    boolean existsByFoodIdAndVariationRecipeOwnerIdNot(Long foodId, Long userId);
}
