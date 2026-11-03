package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Meal;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MealRepository extends JpaRepository<Meal, Long> {

    List<Meal> findAllByOrderByBookedAtDesc();
}