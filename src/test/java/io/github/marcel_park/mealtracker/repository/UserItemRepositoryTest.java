package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.UserItem;
import io.github.marcel_park.mealtracker.model.ShoppingListItem;
import io.github.marcel_park.mealtracker.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
class UserItemRepositoryTest {

    @Autowired
    private UserItemRepository repository;

    @Autowired
    private ShoppingListItemRepository shoppingListItemRepository;

    @Autowired
    private UserRepository userRepository;

    private static final Pageable ALL = Pageable.unpaged();

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = saveUser("alice@example.com");
        bob = saveUser("bob@example.com");
    }

    private User saveUser(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("{bcrypt}not-a-real-hash");
        return userRepository.save(user);
    }

    private UserItem save(User owner, String name) {
        return repository.save(new UserItem(owner, name));
    }

    private static List<String> names(List<UserItem> items) {
        return items.stream().map(UserItem::getName).toList();
    }

    @Test
    void searchOwn_findsOnlyOwnItems_byPartOfTheName_sortedWithoutCase() {
        save(alice, "Spülmittel");
        save(alice, "batterien");
        save(alice, "Brot-Tüten");
        save(bob, "Spülschwamm");

        assertThat(names(repository.searchOwn(alice.getId(), "%", ALL)))
                .containsExactly("batterien", "Brot-Tüten", "Spülmittel");
        assertThat(names(repository.searchOwn(alice.getId(), "%spül%", ALL))).containsExactly("Spülmittel");
        assertThat(names(repository.searchOwn(bob.getId(), "%", ALL))).containsExactly("Spülschwamm");
    }

    @Test
    void searchOwn_comesInPages() {
        save(alice, "A");
        save(alice, "B");
        save(alice, "C");

        assertThat(names(repository.searchOwn(alice.getId(), "%", PageRequest.of(1, 2)))).containsExactly("C");
    }

    @Test
    void existsNameOf_ignoresCase_otherUsers_andTheExcludedItem() {
        UserItem milk = save(alice, "Milch");

        assertThat(repository.existsNameOf(alice.getId(), "milch", null)).isTrue();
        assertThat(repository.existsNameOf(alice.getId(), "MILCH", null)).isTrue();
        assertThat(repository.existsNameOf(alice.getId(), "Hafermilch", null)).isFalse();
        assertThat(repository.existsNameOf(bob.getId(), "Milch", null)).isFalse();
        assertThat(repository.existsNameOf(alice.getId(), "milch", milk.getId())).isFalse();
    }

    @Test
    void deleteAllWithUserItem_takesItOffEveryList_andLeavesTheOthers() {
        UserItem detergent = save(alice, "Spülmittel");
        UserItem batteries = save(alice, "Batterien");
        shoppingListItemRepository.save(new ShoppingListItem(alice, detergent, 2, 0));
        shoppingListItemRepository.save(new ShoppingListItem(alice, batteries, 1, 1));

        int deleted = shoppingListItemRepository.deleteAllWithUserItem(detergent.getId());

        assertThat(deleted).isEqualTo(1);
        assertThat(shoppingListItemRepository.findListOf(alice.getId()))
                .extracting(item -> item.getUserItem().getName())
                .containsExactly("Batterien");
        assertThat(shoppingListItemRepository.findByUserIdAndUserItemId(alice.getId(), batteries.getId()))
                .get()
                .extracting(ShoppingListItem::getCount)
                .isEqualTo(1);
    }
}
