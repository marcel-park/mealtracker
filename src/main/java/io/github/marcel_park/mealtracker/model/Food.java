package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;

@Entity
public class Food {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Only the owner may edit or delete the food. There is no separate "created by": once a food
    // loses its owner (see FoodService), nobody owns it any more and it stays public for good.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

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

    // The owner's choice. Without owner the food is public regardless, see isPublic().
    @Column(name = "is_public", nullable = false)
    private boolean published;

    // Checked by an official source. Nobody can set this yet.
    @Column(name = "is_confirmed", nullable = false)
    private boolean confirmed;

    public boolean isOwnedBy(Long userId) {
        // getId() on a lazy proxy does not load the user
        return owner != null && owner.getId().equals(userId);
    }

    public boolean isPublic() {
        return owner == null || published;
    }

    public boolean isVisibleTo(Long userId) {
        return isPublic() || isOwnedBy(userId);
    }

    // Used when the owner deletes or privatizes a food that meals or recipes still contain: the
    // food stays where it is, public and without owner, so nothing that references it breaks.
    public void releaseOwnership() {
        owner = null;
        published = true;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }
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
    public boolean isPublished() { return published; }
    public void setPublished(boolean published) { this.published = published; }
    public boolean isConfirmed() { return confirmed; }
    public void setConfirmed(boolean confirmed) { this.confirmed = confirmed; }
}
