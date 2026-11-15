package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Recipe;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

import static io.github.marcel_park.mealtracker.repository.NamePatterns.at;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {

    // Same scope filters and name patterns as FoodRepository.search. A recipe always has an owner,
    // and there are no confirmed recipes.
    default List<Recipe> search(Long userId, List<String> namePatterns, boolean ownOnly, boolean publicOnly,
                                Pageable pageable) {
        return searchByPatterns(userId, at(namePatterns, 0), at(namePatterns, 1), at(namePatterns, 2), at(namePatterns, 3),
                at(namePatterns, 4),
                ownOnly, publicOnly, pageable);
    }

    // p1 to p5: the patterns, see NamePatterns.
    @Query("""
            select r from Recipe r
            where (r.published = true or r.owner.id = :userId)
              and (:ownOnly = false or r.owner.id = :userId)
              and (:publicOnly = false or r.published = true)
              and (:p1 is null or lower(r.name) like :p1 escape '!')
              and (:p2 is null or lower(r.name) like :p2 escape '!')
              and (:p3 is null or lower(r.name) like :p3 escape '!')
              and (:p4 is null or lower(r.name) like :p4 escape '!')
              and (:p5 is null or lower(r.name) like :p5 escape '!')
            order by lower(r.name), r.id
            """)
    List<Recipe> searchByPatterns(@Param("userId") Long userId,
                             @Param("p1") String p1, @Param("p2") String p2, @Param("p3") String p3,
                             @Param("p4") String p4, @Param("p5") String p5,
                             @Param("ownOnly") boolean ownOnly,
                             @Param("publicOnly") boolean publicOnly,
                             Pageable pageable);

    // The owner's public recipes that contain the food. They become private together with it.
    @Query("""
            select r from Recipe r join r.items i
            where r.owner.id = :ownerId and r.published = true and i.food.id = :foodId
            """)
    List<Recipe> findPublishedByOwnerContainingFood(@Param("ownerId") Long ownerId,
                                                    @Param("foodId") Long foodId);
}
