package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;

// Something for the shopping list that is no food: only a name ("Spülmittel"). Always has an
// owner; who else sees it is the owner's setting User.userItemVisibility. See UserItemService.
@Entity
@Table(name = "user_item",
        uniqueConstraints = @UniqueConstraint(name = "uq_user_item_owner_name", columnNames = {"owner_id", "name"}))
public class UserItem {

    public static final int MAX_NAME_LENGTH = 100;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = MAX_NAME_LENGTH)
    private String name;

    protected UserItem() {}

    public UserItem(User owner, String name) {
        this.owner = owner;
        this.name = name;
    }

    // getId() on a lazy proxy does not load the owner.
    public boolean isOwnedBy(Long userId) {
        return owner.getId().equals(userId);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getOwner() { return owner; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
