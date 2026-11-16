package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.TaskRequest;
import io.github.marcel_park.mealtracker.dto.TaskResponse;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.Task;
import io.github.marcel_park.mealtracker.model.TaskItem;
import io.github.marcel_park.mealtracker.repository.TaskCompletionRepository;
import io.github.marcel_park.mealtracker.repository.TaskRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Rules for tasks:
// - Every user only ever sees and changes their own tasks; others are reported as "not found".
// - Foods can only be added if the user may see them (see FoodService). Foods in tasks count as
//   used, like in meals and recipes, so they are never deleted while a task contains them.
// - Changing a task changes what it books from then on; meals it booked before stay as they are.
// - Deleting a task keeps the meals it booked, as ordinary meals.
@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final TaskCompletionRepository completionRepository;
    private final FoodService foodService;
    private final UserRepository userRepository;
    private final RecentFoodService recentFoodService;

    public TaskService(TaskRepository taskRepository, TaskCompletionRepository completionRepository,
                       FoodService foodService, UserRepository userRepository,
                       RecentFoodService recentFoodService) {
        this.taskRepository = taskRepository;
        this.completionRepository = completionRepository;
        this.foodService = foodService;
        this.userRepository = userRepository;
        this.recentFoodService = recentFoodService;
    }

    // In the order they were created.
    @Transactional(readOnly = true)
    public List<TaskResponse> findAll(Long userId) {
        return taskRepository.findAllByUserIdOrderById(userId).stream()
                .map(task -> TaskResponse.from(task, userId))
                .toList();
    }

    @Transactional
    public TaskResponse create(Long userId, TaskRequest request) {
        Task task = new Task();
        task.setUser(userRepository.getReferenceById(userId));
        task.setName(request.name().trim());
        task.setWeekdays(request.weekdays());
        Map<Long, RequestedQuantities.Requested> requested = RequestedQuantities.byFoodId(request.items(),
                foodId -> foodService.getVisibleEntity(userId, foodId));
        requested.values().forEach(wanted -> task.addItem(wanted.food(), wanted.quantity()));
        TaskResponse response = TaskResponse.from(taskRepository.save(task), userId);
        recentFoodService.record(userId, requested.keySet());
        return response;
    }

    // The items are updated in place, like those of a meal (see MealService.update): task_item's
    // primary key is (task_id, food_id), and Hibernate flushes INSERTs before DELETEs.
    @Transactional
    public TaskResponse update(Long userId, Long id, TaskRequest request) {
        Task task = getEntity(userId, id);
        task.setName(request.name().trim());
        task.setWeekdays(request.weekdays());

        // Foods already in the task are not loaded again; the user saw them when adding them.
        Map<Long, TaskItem> keptItems = task.getItems().stream()
                .collect(Collectors.toMap(item -> item.getFood().getId(), item -> item));
        Map<Long, RequestedQuantities.Requested> requested = RequestedQuantities.byFoodId(request.items(),
                foodId -> keptItems.containsKey(foodId)
                        ? keptItems.get(foodId).getFood()
                        : foodService.getVisibleEntity(userId, foodId));
        task.getItems().removeIf(item -> !requested.containsKey(item.getFood().getId()));
        requested.forEach((foodId, wanted) -> {
            TaskItem keptItem = keptItems.get(foodId);
            if (keptItem != null) {
                keptItem.setQuantity(wanted.quantity());
            } else {
                task.addItem(wanted.food(), wanted.quantity());
            }
        });
        recentFoodService.recordAdded(userId, requested.keySet(), keptItems.keySet());
        return TaskResponse.from(task, userId);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        Task task = getEntity(userId, id);
        completionRepository.deleteByTaskId(id);
        taskRepository.delete(task);
    }

    Task getEntity(Long userId, Long id) {
        return taskRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Task", id));
    }
}
