package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.UserItemRequest;
import io.github.marcel_park.mealtracker.dto.UserItemResponse;
import io.github.marcel_park.mealtracker.dto.UserItemScope;
import io.github.marcel_park.mealtracker.exception.ConflictException;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.UserItem;
import io.github.marcel_park.mealtracker.repository.UserItemRepository;
import io.github.marcel_park.mealtracker.repository.ShoppingListItemRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// Rules for user items (things for the shopping list that are no food, only a name):
// - Every item belongs to the user who created it; only the owner renames or deletes it.
// - Who else sees them is one setting of the owner for all their items (User.userItemVisibility):
//   nobody (PRIVATE) or their friends (FRIENDS). Never the public. Friends do not exist yet, so for
//   now everybody sees exactly their own items; an item of somebody else is reported as "not found".
// - A name exists at most once per owner, regardless of case: "Milch" and "milch" are the same item.
//   Names are stored trimmed.
// - Deleting an item takes it off every shopping list it is on.
@Service
public class UserItemService {

    private final UserItemRepository itemRepository;
    private final ShoppingListItemRepository shoppingListItemRepository;
    private final UserRepository userRepository;

    public UserItemService(UserItemRepository itemRepository,
                             ShoppingListItemRepository shoppingListItemRepository,
                             UserRepository userRepository) {
        this.itemRepository = itemRepository;
        this.shoppingListItemRepository = shoppingListItemRepository;
        this.userRepository = userRepository;
    }

    // One page of the items whose name contains every term of the query (see
    // CatalogSearch.namePatterns; all of them without query), sorted by name. scope null: everything the user may see. FRIENDS: none yet (no friends yet).
    @Transactional(readOnly = true)
    public List<UserItemResponse> find(Long userId, String query, UserItemScope scope, int page, int size) {
        var pageable = CatalogSearch.page(page, size);
        if (scope == UserItemScope.FRIENDS) {
            return List.of();
        }
        return itemRepository.searchOwn(userId, CatalogSearch.namePatterns(query), pageable).stream()
                .map(item -> UserItemResponse.from(item, userId))
                .toList();
    }

    @Transactional
    public UserItemResponse create(Long userId, UserItemRequest request) {
        String name = request.name().trim();
        checkNameFree(userId, name, null);
        UserItem item = itemRepository.save(new UserItem(userRepository.getReferenceById(userId), name));
        return UserItemResponse.from(item, userId);
    }

    @Transactional
    public UserItemResponse update(Long userId, Long id, UserItemRequest request) {
        UserItem item = getOwnEntity(userId, id);
        String name = request.name().trim();
        checkNameFree(userId, name, id);
        item.setName(name);
        return UserItemResponse.from(item, userId);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        UserItem item = getOwnEntity(userId, id);
        shoppingListItemRepository.deleteAllWithUserItem(id);
        itemRepository.delete(item);
    }

    // An item the user may put on their shopping list. For now only their own (see the rules
    // above); with friends, the items of friends who share theirs come along here.
    UserItem getVisibleEntity(Long userId, Long id) {
        return itemRepository.findById(id)
                .filter(item -> item.isOwnedBy(userId))
                .orElseThrow(() -> new NotFoundException("User item", id));
    }

    private UserItem getOwnEntity(Long userId, Long id) {
        return getVisibleEntity(userId, id);
    }

    private void checkNameFree(Long userId, String name, Long excludedId) {
        if (itemRepository.existsNameOf(userId, name, excludedId)) {
            throw new ConflictException("A user item named '" + name + "' exists already");
        }
    }
}
