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

    @Column(name = "amount_g", nullable = false)
    private double amountG;

    public RecipeItem() {}

    public RecipeItem(Recipe recipe, Food food, double amountG) {
        this.recipe = recipe;
        this.food = food;
        this.amountG = amountG;
    }

    public RecipeItemId getId() { return id; }
    public Recipe getRecipe() { return recipe; }
    public void setRecipe(Recipe recipe) { this.recipe = recipe; }
    public Food getFood() { return food; }
    public void setFood(Food food) { this.food = food; }
    public double getAmountG() { return amountG; }
    public void setAmountG(double amountG) { this.amountG = amountG; }
}
