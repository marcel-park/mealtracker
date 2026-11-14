package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

// Every query filters by the user, so nobody reaches the tasks of somebody else.
public interface TaskRepository extends JpaRepository<Task, Long> {

    // In the order they were created.
    List<Task> findAllByUserIdOrderById(Long userId);

    Optional<Task> findByIdAndUserId(Long id, Long userId);
}
