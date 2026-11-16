package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class RecentFoodId implements Serializable {

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "food_id", nullable = false)
    private Long foodId;

    public RecentFoodId() {}

    public RecentFoodId(Long userId, Long foodId) {
        this.userId = userId;
        this.foodId = foodId;
    }

    public Long getUserId() { return userId; }
    public Long getFoodId() { return foodId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RecentFoodId that)) return false;
        return Objects.equals(userId, that.userId) && Objects.equals(foodId, that.foodId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, foodId);
    }
}
