package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.RecipeVariationItem;
import io.github.marcel_park.mealtracker.model.RecipeVariationItemId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

// Answers whether a food is in use and finds the items of a portion, like MealItemRepository.
public interface RecipeVariationItemRepository extends JpaRepository<RecipeVariationItem, RecipeVariationItemId> {

    boolean existsByFoodId(Long foodId);

    // The items booked with the portion, to turn them into amounts before it is deleted.
    // Written out: a derived findByPortionId would take Quantity.getPortionId() for an
    // attribute, which JPA does not know.
    @Query("select i from RecipeVariationItem i where i.quantity.portion.id = :portionId")
    List<RecipeVariationItem> findByPortionId(@Param("portionId") Long portionId);

    // In a variation of somebody else (a variation belongs to the owner of its recipe).
    boolean existsByFoodIdAndVariationRecipeOwnerIdNot(Long foodId, Long userId);
}
