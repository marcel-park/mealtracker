package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class RecipeItemId implements Serializable {

    private Long recipeId;
    private Long foodId;

    public RecipeItemId() {}

    public RecipeItemId(Long recipeId, Long foodId) {
        this.recipeId = recipeId;
        this.foodId = foodId;
    }

    public Long getRecipeId() { return recipeId; }
    public void setRecipeId(Long recipeId) { this.recipeId = recipeId; }
    public Long getFoodId() { return foodId; }
    public void setFoodId(Long foodId) { this.foodId = foodId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RecipeItemId that)) return false;
        return Objects.equals(recipeId, that.recipeId) && Objects.equals(foodId, that.foodId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(recipeId, foodId);
    }
}
