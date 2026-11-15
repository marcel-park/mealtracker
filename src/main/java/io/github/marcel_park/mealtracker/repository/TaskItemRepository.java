package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.TaskItem;
import io.github.marcel_park.mealtracker.model.TaskItemId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

// Answers whether a food is in use and finds the items of a portion; task items are otherwise
// changed through their task.
public interface TaskItemRepository extends JpaRepository<TaskItem, TaskItemId> {

    boolean existsByFoodId(Long foodId);

    // In a task of somebody else.
    boolean existsByFoodIdAndTaskUserIdNot(Long foodId, Long userId);

    // The items with the portion, to turn them into amounts before it is deleted.
    // Written out: a derived findByPortionId would take Quantity.getPortionId() for an
    // attribute, which JPA does not know.
    @Query("select i from TaskItem i where i.quantity.portion.id = :portionId")
    List<TaskItem> findByPortionId(@Param("portionId") Long portionId);
}
