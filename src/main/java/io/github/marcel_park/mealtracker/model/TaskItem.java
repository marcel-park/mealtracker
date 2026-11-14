package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;

// A food the task books when it is ticked off, and how much of it.
@Entity
public class TaskItem {

    @EmbeddedId
    private TaskItemId id = new TaskItemId();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("taskId")
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("foodId")
    private Food food;

    // How much of the food, see Quantity.
    @Embedded
    private Quantity quantity;

    public TaskItem() {}

    public TaskItem(Task task, Food food, Quantity quantity) {
        this.task = task;
        this.food = food;
        this.quantity = quantity;
    }

    public TaskItemId getId() { return id; }
    public Task getTask() { return task; }
    public void setTask(Task task) { this.task = task; }
    public Food getFood() { return food; }
    public void setFood(Food food) { this.food = food; }
    public Quantity getQuantity() { return quantity; }
    public void setQuantity(Quantity quantity) { this.quantity = quantity; }
    // In the unit of the food, also for portion items.
    public double getAmount() { return quantity.resolvedAmount(); }
}
