package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.Task;
import io.github.marcel_park.mealtracker.model.TaskItem;

import java.time.DayOfWeek;
import java.util.List;

// weekdays: Monday first. kcal: what ticking it off books, from the foods' current values.
public record TaskResponse(
        Long id,
        String name,
        List<DayOfWeek> weekdays,
        double kcal,
        List<TaskItemResponse> items) {

    public static TaskResponse from(Task task, Long userId) {
        List<TaskItemResponse> items = task.getItems().stream()
                .map(item -> itemFrom(item, userId))
                .toList();
        return new TaskResponse(
                task.getId(),
                task.getName(),
                task.getWeekdays().stream().sorted().toList(),
                items.stream().mapToDouble(TaskItemResponse::kcal).sum(),
                items);
    }

    private static TaskItemResponse itemFrom(TaskItem item, Long userId) {
        return new TaskItemResponse(
                FoodResponse.ofUsed(item.getFood(), userId),
                item.getAmount(),
                item.getQuantity().getPortionId(),
                item.getQuantity().getPortionCount(),
                item.getAmount() * item.getFood().getKcalPer100() / 100);
    }
}
