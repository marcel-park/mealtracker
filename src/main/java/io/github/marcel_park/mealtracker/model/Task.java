package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;

import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

// Something the user plans to do on certain weekdays, e.g. "Proteinshake" Monday to Friday. The
// checklist of a day lists the tasks due on its weekday (see ChecklistService). Ticking one off
// books its foods as a meal; a task without foods is only marked as done (see TaskCompletion).
@Entity
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 100)
    private String name;

    // One bit per weekday: Monday 1, Tuesday 2, Wednesday 4, ... Sunday 64. At least one is set.
    @Column(nullable = false)
    private int weekdays;

    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TaskItem> items = new ArrayList<>();

    public boolean isDueOn(DayOfWeek day) {
        return (weekdays & bitOf(day)) != 0;
    }

    public Set<DayOfWeek> getWeekdays() {
        Set<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);
        for (DayOfWeek day : DayOfWeek.values()) {
            if (isDueOn(day)) days.add(day);
        }
        return days;
    }

    public void setWeekdays(Set<DayOfWeek> days) {
        weekdays = days.stream().mapToInt(Task::bitOf).reduce(0, (a, b) -> a | b);
    }

    private static int bitOf(DayOfWeek day) {
        return 1 << (day.getValue() - 1);
    }

    // Same food twice: added up in the unit of the item already there, see Quantity.plus.
    public void addItem(Food food, Quantity quantity) {
        for (TaskItem item : items) {
            if (item.getFood().getId().equals(food.getId())) {
                item.setQuantity(item.getQuantity().plus(quantity));
                return;
            }
        }
        items.add(new TaskItem(this, food, quantity));
    }

    public boolean isOwnedBy(Long userId) {
        // getId() on a lazy proxy does not load the user
        return user.getId().equals(userId);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    // Changed through addItem() and by removing from this list (orphan removal deletes).
    public List<TaskItem> getItems() { return items; }
}
