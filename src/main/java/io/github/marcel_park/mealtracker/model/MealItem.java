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

    @Column(nullable = false)
    private double amountG;

    public MealItem() {}

    public MealItem(Meal meal, Food food, double amountG) {
        this.meal = meal;
        this.food = food;
        this.amountG = amountG;
    }

    public MealItemId getId() { return id; }
    public Meal getMeal() { return meal; }
    public void setMeal(Meal meal) { this.meal = meal; }
    public Food getFood() { return food; }
    public void setFood(Food food) { this.food = food; }
    public double getAmountG() { return amountG; }
    public void setAmountG(double amountG) { this.amountG = amountG; }
}