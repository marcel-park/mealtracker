package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
public class Meal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 100)
    private String title;

    @Column(nullable = false)
    private LocalDateTime bookedAt = LocalDateTime.now();

    @OneToMany(mappedBy = "meal", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MealItem> items = new ArrayList<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public LocalDateTime getBookedAt() { return bookedAt; }
    public void setBookedAt(LocalDateTime bookedAt) { this.bookedAt = bookedAt; }
    public List<MealItem> getItems() { return items; }

    public void addItem(Food food, double amountG) {
        for (MealItem item : items) {
            if (item.getFood().getId().equals(food.getId())) {
                item.setAmountG(item.getAmountG() + amountG);
                return;
            }
        }
        items.add(new MealItem(this, food, amountG));
    }
}