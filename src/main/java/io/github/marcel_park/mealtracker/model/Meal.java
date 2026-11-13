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

    // The owner. MealService sets it for every new meal. It is nullable like the database column
    // only because meals booked before multi-user support have no owner until the first user
    // registers (see V3 migration). Once a migration makes the column NOT NULL, add
    // optional = false and nullable = false here as well.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(length = 100)
    private String title;

    @Column(nullable = false)
    private LocalDateTime bookedAt = LocalDateTime.now();

    @OneToMany(mappedBy = "meal", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MealItem> items = new ArrayList<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public LocalDateTime getBookedAt() { return bookedAt; }
    public void setBookedAt(LocalDateTime bookedAt) { this.bookedAt = bookedAt; }
    public List<MealItem> getItems() { return items; }

    public void addItem(Food food, double amount) {
        for (MealItem item : items) {
            if (item.getFood().getId().equals(food.getId())) {
                item.setAmount(item.getAmount() + amount);
                return;
            }
        }
        items.add(new MealItem(this, food, amount));
    }
}