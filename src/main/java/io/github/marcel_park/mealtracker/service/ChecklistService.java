package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.ChecklistEntryResponse;
import io.github.marcel_park.mealtracker.dto.TaskResponse;
import io.github.marcel_park.mealtracker.exception.InvalidRequestException;
import io.github.marcel_park.mealtracker.model.Meal;
import io.github.marcel_park.mealtracker.model.Task;
import io.github.marcel_park.mealtracker.model.TaskCompletion;
import io.github.marcel_park.mealtracker.model.TaskItem;
import io.github.marcel_park.mealtracker.repository.MealRepository;
import io.github.marcel_park.mealtracker.repository.TaskCompletionRepository;
import io.github.marcel_park.mealtracker.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

// The checklist of a day is not stored: it is computed whenever it is asked for. On it are the
// user's tasks due on the day's weekday, and those ticked off that day even if no longer due.
// The day is the app's local date, like for the meals of a day (see MealService.findBookedOn).
//
// Ticking a task off books its foods as one meal, titled like the task, and records that in a
// TaskCompletion. Ticking it on again deletes that meal; deleting the meal elsewhere opens the task
// again as well (see MealService.delete).
@Service
public class ChecklistService {

    private final TaskRepository taskRepository;
    private final TaskCompletionRepository completionRepository;
    private final MealRepository mealRepository;
    private final TaskService taskService;

    public ChecklistService(TaskRepository taskRepository, TaskCompletionRepository completionRepository,
                            MealRepository mealRepository, TaskService taskService) {
        this.taskRepository = taskRepository;
        this.completionRepository = completionRepository;
        this.mealRepository = mealRepository;
        this.taskService = taskService;
    }

    // Open tasks first, then the ticked off ones, each in the order the tasks were created.
    @Transactional(readOnly = true)
    public List<ChecklistEntryResponse> get(Long userId, LocalDate day) {
        Map<Long, TaskCompletion> completions = completionRepository.findAllByTaskUserIdAndDoneOn(userId, day)
                .stream()
                .collect(Collectors.toMap(completion -> completion.getTask().getId(), Function.identity()));
        return taskRepository.findAllByUserIdOrderById(userId).stream()
                .filter(task -> task.isDueOn(day.getDayOfWeek()) || completions.containsKey(task.getId()))
                .map(task -> entry(task, completions.get(task.getId()), userId))
                .sorted(Comparator.comparing(ChecklistEntryResponse::done))
                .toList();
    }

    // Ticking off a task already ticked off that day changes nothing.
    @Transactional
    public List<ChecklistEntryResponse> complete(Long userId, Long taskId, LocalDate day) {
        Task task = taskService.getEntity(userId, taskId);
        if (completionRepository.findByTaskIdAndDoneOn(taskId, day).isEmpty()) {
            if (!task.isDueOn(day.getDayOfWeek())) {
                throw new InvalidRequestException("Task with id " + taskId + " is not due on " + day);
            }
            completionRepository.save(new TaskCompletion(task, day, bookMeal(task)));
        }
        return get(userId, day);
    }

    // Opens the task again: its completion of that day and the meal it booked are deleted.
    @Transactional
    public List<ChecklistEntryResponse> reopen(Long userId, Long taskId, LocalDate day) {
        taskService.getEntity(userId, taskId);
        completionRepository.findByTaskIdAndDoneOn(taskId, day).ifPresent(completion -> {
            Meal meal = completion.getMeal();
            completionRepository.delete(completion);
            // The completion references the meal, so it has to go first.
            completionRepository.flush();
            if (meal != null) {
                mealRepository.delete(meal);
            }
        });
        return get(userId, day);
    }

    // null for a task without foods. The meal gets copies of the task's quantities, so changing
    // the task later does not change it.
    private Meal bookMeal(Task task) {
        if (task.getItems().isEmpty()) {
            return null;
        }
        Meal meal = new Meal();
        meal.setUser(task.getUser());
        meal.setTitle(task.getName());
        for (TaskItem item : task.getItems()) {
            meal.addItem(item.getFood(), item.getQuantity().copy());
        }
        return mealRepository.save(meal);
    }

    private static ChecklistEntryResponse entry(Task task, TaskCompletion completion, Long userId) {
        Meal meal = completion == null ? null : completion.getMeal();
        return new ChecklistEntryResponse(
                TaskResponse.from(task, userId), completion != null, meal == null ? null : meal.getId());
    }
}
