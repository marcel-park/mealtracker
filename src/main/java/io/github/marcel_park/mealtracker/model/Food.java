package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;

import java.util.ArrayList;
import java.util.List;

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

    // Stored as plain VARCHAR "G" / "ML", see FoodUnitConverter. Every amount of the food is in
    // this unit: changing it turns 100 g into 100 ml everywhere the food is used.
    @Convert(converter = FoodUnitConverter.class)
    @Column(nullable = false, length = 2)
    private FoodUnit unit = FoodUnit.G;

    // Per 100 g or 100 ml, depending on the unit. Protein, carbs and fat likewise.
    @Column(name = "kcal_per100", nullable = false)
    private double kcalPer100;

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

    // The favorite first, then in the order they were added. Loaded in batches, so a list of foods
    // does not need one query per food for its portions.
    @OneToMany(mappedBy = "food", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("favorite DESC, id ASC")
    @BatchSize(size = 50)
    private List<FoodPortion> portions = new ArrayList<>();

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
    public FoodUnit getUnit() { return unit; }
    public void setUnit(FoodUnit unit) { this.unit = unit; }
    public double getKcalPer100() { return kcalPer100; }
    public void setKcalPer100(double kcalPer100) { this.kcalPer100 = kcalPer100; }
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
    // Changed through addPortion() and by removing from this list (orphan removal deletes).
    public List<FoodPortion> getPortions() { return portions; }

    public FoodPortion addPortion(String name, double amount, boolean favorite) {
        FoodPortion portion = new FoodPortion(this, name, amount, favorite);
        portions.add(portion);
        return portion;
    }
}
