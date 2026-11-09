package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Recipe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {

    // Same filters as FoodRepository.search. A recipe always has an owner.
    @Query("""
            select r from Recipe r
            where (r.published = true or r.owner.id = :userId)
              and (:ownOnly = false or r.owner.id = :userId)
              and (:publicOnly = false or r.published = true)
              and (:confirmedOnly = false or r.confirmed = true)
              and lower(r.name) like :namePattern escape '!'
            order by lower(r.name), r.id
            """)
    List<Recipe> search(@Param("userId") Long userId,
                        @Param("namePattern") String namePattern,
                        @Param("ownOnly") boolean ownOnly,
                        @Param("publicOnly") boolean publicOnly,
                        @Param("confirmedOnly") boolean confirmedOnly);

    // The owner's public recipes that contain the food. They become private together with it.
    @Query("""
            select r from Recipe r join r.items i
            where r.owner.id = :ownerId and r.published = true and i.food.id = :foodId
            """)
    List<Recipe> findPublishedByOwnerContainingFood(@Param("ownerId") Long ownerId,
                                                    @Param("foodId") Long foodId);
}
