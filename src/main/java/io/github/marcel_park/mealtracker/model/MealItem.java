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

    // In the unit of the food (g or ml).
    @Column(nullable = false)
    private double amount;

    public MealItem() {}

    public MealItem(Meal meal, Food food, double amount) {
        this.meal = meal;
        this.food = food;
        this.amount = amount;
    }

    public MealItemId getId() { return id; }
    public Meal getMeal() { return meal; }
    public void setMeal(Meal meal) { this.meal = meal; }
    public Food getFood() { return food; }
    public void setFood(Food food) { this.food = food; }
    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }
}