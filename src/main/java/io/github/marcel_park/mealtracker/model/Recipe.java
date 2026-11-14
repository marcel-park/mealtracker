package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.List;

// A list of foods with amounts that can be booked in one go. Meals never reference a recipe:
// booking one adds its foods (scaled to the booked portion) to the meal.
@Entity
public class Recipe {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 100)
    private String name;

    // How many portions the listed amounts make.
    @Column(nullable = false)
    private double servings;

    @Column(name = "is_public", nullable = false)
    private boolean published;

    // Checked by an official source. Nobody can set this yet.
    @Column(name = "is_confirmed", nullable = false)
    private boolean confirmed;

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RecipeItem> items = new ArrayList<>();

    // The owner's variations, oldest first. Never shown to anybody else.
    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<RecipeVariation> variations = new ArrayList<>();

    // The variation the owner booked last (null: the original), preselected when booking.
    // A plain id instead of a relation: the database sets it to NULL when the variation is
    // deleted (ON DELETE SET NULL), RecipeService does the same in memory.
    @Column(name = "last_used_variation_id")
    private Long lastUsedVariationId;

    public boolean isOwnedBy(Long userId) {
        return owner.getId().equals(userId);
    }

    public boolean isVisibleTo(Long userId) {
        return published || isOwnedBy(userId);
    }

    // Primary key (recipe_id, food_id), so each food only once.
    // Same food twice: added up in the unit of the item already there, see Quantity.plus.
    public void addItem(Food food, Quantity quantity) {
        for (RecipeItem item : items) {
            if (item.getFood().getId().equals(food.getId())) {
                item.setQuantity(item.getQuantity().plus(quantity));
                return;
            }
        }
        items.add(new RecipeItem(this, food, quantity));
    }

    public void addItem(Food food, double amount) {
        addItem(food, Quantity.ofAmount(amount));
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public double getServings() { return servings; }
    public void setServings(double servings) { this.servings = servings; }
    public boolean isPublished() { return published; }
    public void setPublished(boolean published) { this.published = published; }
    public boolean isConfirmed() { return confirmed; }
    public void setConfirmed(boolean confirmed) { this.confirmed = confirmed; }
    public List<RecipeItem> getItems() { return items; }
    public List<RecipeVariation> getVariations() { return variations; }
    public Long getLastUsedVariationId() { return lastUsedVariationId; }
    public void setLastUsedVariationId(Long lastUsedVariationId) { this.lastUsedVariationId = lastUsedVariationId; }
}
