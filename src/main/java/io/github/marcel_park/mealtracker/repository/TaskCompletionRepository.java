package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.TaskCompletion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TaskCompletionRepository extends JpaRepository<TaskCompletion, Long> {

    // The tasks of the user ticked off on that day.
    List<TaskCompletion> findAllByTaskUserIdAndDoneOn(Long userId, LocalDate doneOn);

    Optional<TaskCompletion> findByTaskIdAndDoneOn(Long taskId, LocalDate doneOn);

    // Which of the given meals were booked by a task.
    List<TaskCompletion> findAllByMealIdIn(Collection<Long> mealIds);

    boolean existsByMealId(Long mealId);

    // Before the meal is deleted: its task is open again.
    @Modifying
    @Query("delete from TaskCompletion c where c.meal.id = :mealId")
    void deleteByMealId(@Param("mealId") Long mealId);

    // Before the task is deleted: its meals stay, as ordinary meals.
    @Modifying
    @Query("delete from TaskCompletion c where c.task.id = :taskId")
    void deleteByTaskId(@Param("taskId") Long taskId);
}
