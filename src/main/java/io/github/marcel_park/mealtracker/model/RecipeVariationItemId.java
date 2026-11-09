package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class RecipeVariationItemId implements Serializable {

    private Long variationId;
    private Long foodId;

    public RecipeVariationItemId() {}

    public RecipeVariationItemId(Long variationId, Long foodId) {
        this.variationId = variationId;
        this.foodId = foodId;
    }

    public Long getVariationId() { return variationId; }
    public void setVariationId(Long variationId) { this.variationId = variationId; }
    public Long getFoodId() { return foodId; }
    public void setFoodId(Long foodId) { this.foodId = foodId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RecipeVariationItemId that)) return false;
        return Objects.equals(variationId, that.variationId) && Objects.equals(foodId, that.foodId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(variationId, foodId);
    }
}
