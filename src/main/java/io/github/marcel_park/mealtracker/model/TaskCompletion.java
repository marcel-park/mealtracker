package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;

import java.time.LocalDate;

// A task ticked off on a day, at most once per day. meal: what it booked, null for a task without
// foods. A meal of a task can only be deleted as a whole; deleting it also deletes this, so the
// task is open again (see MealService.delete). Deleting the task deletes this but keeps the meal,
// which then is an ordinary meal.
@Entity
@Table(name = "task_completion")
public class TaskCompletion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    // The day of the checklist, as the app sends it (its local date).
    @Column(name = "done_on", nullable = false)
    private LocalDate doneOn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "meal_id")
    private Meal meal;

    public TaskCompletion() {}

    public TaskCompletion(Task task, LocalDate doneOn, Meal meal) {
        this.task = task;
        this.doneOn = doneOn;
        this.meal = meal;
    }

    public Long getId() { return id; }
    public Task getTask() { return task; }
    public LocalDate getDoneOn() { return doneOn; }
    public Meal getMeal() { return meal; }
}
