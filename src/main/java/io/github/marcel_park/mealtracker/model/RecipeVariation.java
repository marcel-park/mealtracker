package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.List;

// A variation of a recipe, e.g. "Gulasch with more meat". It belongs to the owner of the recipe
// and is never shown to anybody else.
//
// Only the ingredients the variation changes are stored, with their absolute amount (0: left out).
// Every other ingredient is taken from the original with its current amount, so changes to the
// original reach the variation unless the variation changed that ingredient itself.
@Entity
public class RecipeVariation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipe_id", nullable = false)
    private Recipe recipe;

    @Column(nullable = false, length = 100)
    private String name;

    // null: as many as the original
    private Double servings;

    // Weight of the finished dish in g. null: the sum of the ingredients, where 100 ml of a food
    // measured in millilitres count as 100 g.
    @Column(name = "weight_g")
    private Double weightG;

    @OneToMany(mappedBy = "variation", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RecipeVariationItem> items = new ArrayList<>();

    public void addItem(Food food, Quantity quantity) {
        items.add(new RecipeVariationItem(this, food, quantity));
    }

    public void addItem(Food food, double amount) {
        addItem(food, Quantity.ofAmount(amount));
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Recipe getRecipe() { return recipe; }
    public void setRecipe(Recipe recipe) { this.recipe = recipe; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Double getServings() { return servings; }
    public void setServings(Double servings) { this.servings = servings; }
    public Double getWeightG() { return weightG; }
    public void setWeightG(Double weightG) { this.weightG = weightG; }
    public List<RecipeVariationItem> getItems() { return items; }
}
