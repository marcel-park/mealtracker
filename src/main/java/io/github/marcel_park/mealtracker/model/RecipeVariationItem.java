package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;

// One changed ingredient of a variation, see RecipeVariation.
@Entity
public class RecipeVariationItem {

    @EmbeddedId
    private RecipeVariationItemId id = new RecipeVariationItemId();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("variationId")
    private RecipeVariation variation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("foodId")
    private Food food;

    // Absolute amount in the variation, in the unit of the food (g or ml); 0 means the ingredient
    // is left out.
    @Column(nullable = false)
    private double amount;

    public RecipeVariationItem() {}

    public RecipeVariationItem(RecipeVariation variation, Food food, double amount) {
        this.variation = variation;
        this.food = food;
        this.amount = amount;
    }

    public RecipeVariationItemId getId() { return id; }
    public RecipeVariation getVariation() { return variation; }
    public Food getFood() { return food; }
    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }
}
