package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;

@Entity
public class RecipeItem {

    @EmbeddedId
    private RecipeItemId id = new RecipeItemId();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("recipeId")
    private Recipe recipe;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("foodId")
    private Food food;

    // How much of the food, see Quantity.
    @Embedded
    private Quantity quantity;

    public RecipeItem() {}

    public RecipeItem(Recipe recipe, Food food, Quantity quantity) {
        this.recipe = recipe;
        this.food = food;
        this.quantity = quantity;
    }

    public RecipeItemId getId() { return id; }
    public Recipe getRecipe() { return recipe; }
    public void setRecipe(Recipe recipe) { this.recipe = recipe; }
    public Food getFood() { return food; }
    public void setFood(Food food) { this.food = food; }
    public Quantity getQuantity() { return quantity; }
    public void setQuantity(Quantity quantity) { this.quantity = quantity; }
    // In the unit of the food, also for portion items.
    public double getAmount() { return quantity.resolvedAmount(); }
}
