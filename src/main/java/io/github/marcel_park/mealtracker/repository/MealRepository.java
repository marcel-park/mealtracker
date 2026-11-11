package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Meal;
import io.github.marcel_park.mealtracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

// Every query filters by the owner, so a user can never read or change another user's meals.
public interface MealRepository extends JpaRepository<Meal, Long> {

    List<Meal> findAllByUserIdOrderByBookedAtDesc(Long userId);

    // Meals booked from `from` (inclusive) up to `to` (exclusive), newest first.
    @Query("""
            select m from Meal m
            where m.user.id = :userId and m.bookedAt >= :from and m.bookedAt < :to
            order by m.bookedAt desc
            """)
    List<Meal> findAllBookedBetween(@Param("userId") Long userId, @Param("from") LocalDateTime from,
                                    @Param("to") LocalDateTime to);

    Optional<Meal> findByIdAndUserId(Long id, Long userId);

    // Hands meals booked before multi-user support (no owner yet) over to the given user.
    @Modifying
    @Query("update Meal m set m.user = :user where m.user is null")
    int assignOwnerlessMealsTo(@Param("user") User user);
}
