package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;

// A food on the shopping list of a user. Each food is on a list at most once (unique key with the
// user): adding it again adds to its quantity. See ShoppingListService.
@Entity
@Table(name = "shopping_list_item",
        uniqueConstraints = @UniqueConstraint(name = "uq_shopping_list_item_food", columnNames = {"user_id", "food_id"}))
public class ShoppingListItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "food_id", nullable = false)
    private Food food;

    @Embedded
    private Quantity quantity;

    // Bought already: shown crossed out, after the unchecked items.
    @Column(name = "is_checked", nullable = false)
    private boolean checked;

    // Order within the list; checked and unchecked items are sorted by it separately.
    @Column(nullable = false)
    private int position;

    protected ShoppingListItem() {}

    public ShoppingListItem(User user, Food food, Quantity quantity, int position) {
        this.user = user;
        this.food = food;
        this.quantity = quantity;
        this.position = position;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public Food getFood() { return food; }
    public Quantity getQuantity() { return quantity; }
    public void setQuantity(Quantity quantity) { this.quantity = quantity; }
    public boolean isChecked() { return checked; }
    public void setChecked(boolean checked) { this.checked = checked; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
}
