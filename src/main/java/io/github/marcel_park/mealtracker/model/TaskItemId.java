package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class TaskItemId implements Serializable {

    private Long taskId;
    private Long foodId;

    public TaskItemId() {}

    public TaskItemId(Long taskId, Long foodId) {
        this.taskId = taskId;
        this.foodId = foodId;
    }

    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public Long getFoodId() { return foodId; }
    public void setFoodId(Long foodId) { this.foodId = foodId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof TaskItemId that)) return false;
        return Objects.equals(taskId, that.taskId) && Objects.equals(foodId, that.foodId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(taskId, foodId);
    }
}
