package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

// When a user last used a food: booked it, or added it to a recipe, a variation, a task or the
// shopping list (see RecentFoodService). Only ids: the row is only read for the search filter
// "Zuletzt", and the database deletes it with its food or user (see the V17 migration).
@Entity
@Table(name = "recent_food")
public class RecentFood {

    @EmbeddedId
    private RecentFoodId id;

    @Column(name = "used_at", nullable = false)
    private LocalDateTime usedAt;

    public RecentFood() {}

    public RecentFood(RecentFoodId id, LocalDateTime usedAt) {
        this.id = id;
        this.usedAt = usedAt;
    }

    public RecentFoodId getId() { return id; }
    public LocalDateTime getUsedAt() { return usedAt; }
    public void setUsedAt(LocalDateTime usedAt) { this.usedAt = usedAt; }
}
