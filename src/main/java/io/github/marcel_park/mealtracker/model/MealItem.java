package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;

@Entity
public class MealItem {

    @EmbeddedId
    private MealItemId id = new MealItemId();

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("mealId")
    private Meal meal;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("foodId")
    private Food food;

    // How much of the food, see Quantity.
    @Embedded
    private Quantity quantity;

    public MealItem() {}

    public MealItem(Meal meal, Food food, Quantity quantity) {
        this.meal = meal;
        this.food = food;
        this.quantity = quantity;
    }

    public MealItemId getId() { return id; }
    public Meal getMeal() { return meal; }
    public void setMeal(Meal meal) { this.meal = meal; }
    public Food getFood() { return food; }
    public void setFood(Food food) { this.food = food; }
    public Quantity getQuantity() { return quantity; }
    public void setQuantity(Quantity quantity) { this.quantity = quantity; }
    // In the unit of the food, also for portion items.
    public double getAmount() { return quantity.resolvedAmount(); }
}