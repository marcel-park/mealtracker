package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.RecentFood;
import io.github.marcel_park.mealtracker.model.RecentFoodId;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RecentFoodRepository extends JpaRepository<RecentFood, RecentFoodId> {

    // The foods the user used, the most recently used first (the search with scope RECENT, see
    // FoodService.find); pageable limits how many. Foods used at the same time by their id.
    @Query("""
            select r.id.foodId from RecentFood r
            where r.id.userId = :userId
            order by r.usedAt desc, r.id.foodId
            """)
    List<Long> findFoodIdsMostRecentFirst(@Param("userId") Long userId, Pageable pageable);
}
