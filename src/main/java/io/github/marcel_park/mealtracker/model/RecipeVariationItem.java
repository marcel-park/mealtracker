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

    // Absolute amount in the variation; 0 means the ingredient is left out.
    @Column(name = "amount_g", nullable = false)
    private double amountG;

    public RecipeVariationItem() {}

    public RecipeVariationItem(RecipeVariation variation, Food food, double amountG) {
        this.variation = variation;
        this.food = food;
        this.amountG = amountG;
    }

    public RecipeVariationItemId getId() { return id; }
    public RecipeVariation getVariation() { return variation; }
    public Food getFood() { return food; }
    public double getAmountG() { return amountG; }
    public void setAmountG(double amountG) { this.amountG = amountG; }
}
