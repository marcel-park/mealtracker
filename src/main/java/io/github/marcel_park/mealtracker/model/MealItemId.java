package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class MealItemId implements Serializable {

    private Long mealId;
    private Long foodId;

    public MealItemId() {}

    public MealItemId(Long mealId, Long foodId) {
        this.mealId = mealId;
        this.foodId = foodId;
    }

    public Long getMealId() { return mealId; }
    public void setMealId(Long mealId) { this.mealId = mealId; }
    public Long getFoodId() { return foodId; }
    public void setFoodId(Long foodId) { this.foodId = foodId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof MealItemId that)) return false;
        return Objects.equals(mealId, that.mealId) && Objects.equals(foodId, that.foodId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(mealId, foodId);
    }
}