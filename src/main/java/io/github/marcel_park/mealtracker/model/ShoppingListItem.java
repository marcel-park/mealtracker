package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;

// An entry on the shopping list of a user: a food with its quantity, or a user item with a count
// (exactly one of the two, see the V16 migration). Each food and each user item is on a list at
// most once (unique keys with the user): adding it again adds to its quantity or count. See
// ShoppingListService.
@Entity
@Table(name = "shopping_list_item",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_shopping_list_item_food", columnNames = {"user_id", "food_id"}),
                @UniqueConstraint(name = "uq_shopping_list_item_user_item",
                        columnNames = {"user_id", "user_item_id"})})
public class ShoppingListItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // null for a user item entry
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "food_id")
    private Food food;

    // null for a user item entry
    @Embedded
    private Quantity quantity;

    // null for a food entry
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_item_id")
    private UserItem userItem;

    // How many of the user item; null for a food entry.
    @Column(name = "item_count")
    private Integer count;

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

    public ShoppingListItem(User user, UserItem userItem, int count, int position) {
        this.user = user;
        this.userItem = userItem;
        this.count = count;
        this.position = position;
    }

    public boolean isUserItem() {
        return userItem != null;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public Food getFood() { return food; }
    public Quantity getQuantity() { return quantity; }
    public void setQuantity(Quantity quantity) { this.quantity = quantity; }
    public UserItem getUserItem() { return userItem; }
    public Integer getCount() { return count; }
    public void setCount(Integer count) { this.count = count; }
    public boolean isChecked() { return checked; }
    public void setChecked(boolean checked) { this.checked = checked; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
}
