package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.RecipeVariation;
import org.springframework.data.jpa.repository.JpaRepository;

// Saving a new variation through here inserts it right away, so its id is known for the response.
// Reading and deleting goes through Recipe.getVariations().
public interface RecipeVariationRepository extends JpaRepository<RecipeVariation, Long> {
}
