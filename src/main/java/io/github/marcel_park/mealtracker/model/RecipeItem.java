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

    // In the unit of the food (g or ml).
    @Column(nullable = false)
    private double amount;

    public RecipeItem() {}

    public RecipeItem(Recipe recipe, Food food, double amount) {
        this.recipe = recipe;
        this.food = food;
        this.amount = amount;
    }

    public RecipeItemId getId() { return id; }
    public Recipe getRecipe() { return recipe; }
    public void setRecipe(Recipe recipe) { this.recipe = recipe; }
    public Food getFood() { return food; }
    public void setFood(Food food) { this.food = food; }
    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }
}
