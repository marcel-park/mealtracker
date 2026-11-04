package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Meal;
import io.github.marcel_park.mealtracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

// Every query filters by the owner, so a user can never read or change another user's meals.
public interface MealRepository extends JpaRepository<Meal, Long> {

    List<Meal> findAllByUserIdOrderByBookedAtDesc(Long userId);

    Optional<Meal> findByIdAndUserId(Long id, Long userId);

    // Derived delete: loads the meals and removes them one by one, so the cascade to meal_item
    // applies. Needs a running transaction (MealService.deleteAll is @Transactional).
    void deleteAllByUserId(Long userId);

    // Hands meals booked before multi-user support (no owner yet) over to the given user.
    @Modifying
    @Query("update Meal m set m.user = :user where m.user is null")
    int assignOwnerlessMealsTo(@Param("user") User user);
}
