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

    // How much of the food in the variation, see Quantity. 0 (as amount or as portions) means the
    // ingredient is left out.
    @Embedded
    private Quantity quantity;

    public RecipeVariationItem() {}

    public RecipeVariationItem(RecipeVariation variation, Food food, Quantity quantity) {
        this.variation = variation;
        this.food = food;
        this.quantity = quantity;
    }

    public RecipeVariationItemId getId() { return id; }
    public RecipeVariation getVariation() { return variation; }
    public Food getFood() { return food; }
    public Quantity getQuantity() { return quantity; }
    public void setQuantity(Quantity quantity) { this.quantity = quantity; }
    // In the unit of the food, also for portion items.
    public double getAmount() { return quantity.resolvedAmount(); }
}
