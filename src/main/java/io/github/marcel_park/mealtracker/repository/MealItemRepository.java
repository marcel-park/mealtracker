package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.MealItem;
import io.github.marcel_park.mealtracker.model.MealItemId;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

// Answers whether a food is in use and finds the items of a portion; meal items are otherwise
// changed through their meal.
public interface MealItemRepository extends JpaRepository<MealItem, MealItemId> {

    boolean existsByFoodId(Long foodId);

    // The items booked with the portion, to turn them into amounts before it is deleted.
    // Written out: a derived findByPortionId would take Quantity.getPortionId() for an
    // attribute, which JPA does not know.
    @Query("select i from MealItem i where i.quantity.portion.id = :portionId")
    List<MealItem> findByPortionId(@Param("portionId") Long portionId);

    // In a meal of somebody else.
    boolean existsByFoodIdAndMealUserIdNot(Long foodId, Long userId);

    // The foods the user booked, the most recently booked first (the search with scope RECENT, see
    // FoodService.find); pageable limits how many.
    @Query("""
            select i.food.id from MealItem i
            where i.meal.user.id = :userId
            group by i.food.id
            order by max(i.meal.bookedAt) desc, i.food.id
            """)
    List<Long> findRecentlyBookedFoodIds(@Param("userId") Long userId, Pageable pageable);
}
