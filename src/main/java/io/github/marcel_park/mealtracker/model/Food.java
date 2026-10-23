package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

@Entity
public class Food {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private double kcalPer100g;

    @Column(nullable = false)
    private double protein;

    @Column(nullable = false)
    private double carbs;

    @Column(nullable = false)
    private double fat;

    // Getter und Setter für alle Felder (siehe Tipp unten)
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public double getKcalPer100g() { return kcalPer100g; }
    public void setKcalPer100g(double kcalPer100g) { this.kcalPer100g = kcalPer100g; }
    public double getProtein() { return protein; }
    public void setProtein(double protein) { this.protein = protein; }
    public double getCarbs() { return carbs; }
    public void setCarbs(double carbs) { this.carbs = carbs; }
    public double getFat() { return fat; }
    public void setFat(double fat) { this.fat = fat; }
}