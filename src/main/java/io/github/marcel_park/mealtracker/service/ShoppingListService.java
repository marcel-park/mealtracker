package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.dto.ShoppingListAddRequest;
import io.github.marcel_park.mealtracker.dto.ShoppingListItemResponse;
import io.github.marcel_park.mealtracker.dto.ShoppingListQuantityRequest;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.ShoppingListItem;
import io.github.marcel_park.mealtracker.repository.ShoppingListItemRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

// Rules for the shopping list (one per user):
// - Every method takes the id of the logged-in user and only touches that user's list. An item
//   of somebody else is reported as "not found".
// - Only foods the user may see can be added. Each food is on the list at most once: adding it
//   again adds to the existing item, in that item's unit (Quantity.plus), and keeps it checked
//   or unchecked as it is.
// - Unchecked items come first, then the checked ones, each group in its own order. New items,
//   and items that are checked or unchecked, go to the end of their group. Unchecked items can be
//   moved to any place among the unchecked ones.
// - Every change answers with the whole list, so the app shows the order the server decided.
@Service
public class ShoppingListService {

    private final ShoppingListItemRepository itemRepository;
    private final FoodService foodService;
    private final RecipeService recipeService;
    private final UserRepository userRepository;

    public ShoppingListService(ShoppingListItemRepository itemRepository, FoodService foodService,
                               RecipeService recipeService, UserRepository userRepository) {
        this.itemRepository = itemRepository;
        this.foodService = foodService;
        this.recipeService = recipeService;
        this.userRepository = userRepository;
    }

    // Foods and portions are loaded lazily, so the response has to be built inside a transaction.
    @Transactional(readOnly = true)
    public List<ShoppingListItemResponse> find(Long userId) {
        return toResponse(itemRepository.findListOf(userId), userId);
    }

    // Recipes listed in the request count as booked last in that variation, like for meals.
    @Transactional
    public List<ShoppingListItemResponse> add(Long userId, ShoppingListAddRequest request) {
        int nextPosition = itemRepository.nextPosition(userId);
        for (RequestedQuantities.Requested wanted : RequestedQuantities.byFoodId(request.items(),
                foodId -> foodService.getVisibleEntity(userId, foodId)).values()) {
            var existing = itemRepository.findByUserIdAndFoodId(userId, wanted.food().getId());
            if (existing.isPresent()) {
                ShoppingListItem item = existing.get();
                item.setQuantity(item.getQuantity().plus(wanted.quantity()));
            } else {
                itemRepository.save(new ShoppingListItem(
                        userRepository.getReferenceById(userId), wanted.food(), wanted.quantity(), nextPosition++));
            }
        }
        recipeService.markUsed(userId, request.recipes());
        return find(userId);
    }

    // Checked or unchecked, the item goes to the end of its new group.
    @Transactional
    public List<ShoppingListItemResponse> setChecked(Long userId, Long id, boolean checked) {
        ShoppingListItem item = getEntity(userId, id);
        if (item.isChecked() != checked) {
            item.setChecked(checked);
            item.setPosition(itemRepository.nextPosition(userId));
        }
        return find(userId);
    }

    // Moves an unchecked item to place `index` among the unchecked items (0: first; beyond the
    // end: last), the others close up behind it. Checked items stay where they are, and so does
    // a checked item asked to move.
    @Transactional
    public List<ShoppingListItemResponse> move(Long userId, Long id, int index) {
        ShoppingListItem item = getEntity(userId, id);
        if (!item.isChecked()) {
            List<ShoppingListItem> unchecked = new ArrayList<>(itemRepository.findListOf(userId).stream()
                    .filter(other -> !other.isChecked())
                    .toList());
            unchecked.remove(item);
            unchecked.add(Math.max(0, Math.min(index, unchecked.size())), item);
            // Unchecked items get positions 0, 1, 2 ...; checked ones are sorted on their own.
            for (int position = 0; position < unchecked.size(); position++) {
                unchecked.get(position).setPosition(position);
            }
        }
        return find(userId);
    }

    // Replaces the quantity, e.g. 6 Stück instead of 4, or grams instead of portions. Place and
    // checked state stay as they are.
    @Transactional
    public List<ShoppingListItemResponse> setQuantity(Long userId, Long id, ShoppingListQuantityRequest request) {
        ShoppingListItem item = getEntity(userId, id);
        item.setQuantity(RequestedQuantities.quantityOf(item.getFood(), request));
        return find(userId);
    }

    @Transactional
    public List<ShoppingListItemResponse> remove(Long userId, Long id) {
        itemRepository.delete(getEntity(userId, id));
        return find(userId);
    }

    // Empties the whole list, checked and unchecked items alike.
    @Transactional
    public void clear(Long userId) {
        itemRepository.deleteAllOf(userId);
    }

    private ShoppingListItem getEntity(Long userId, Long id) {
        return itemRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Shopping list item", id));
    }

    private static List<ShoppingListItemResponse> toResponse(List<ShoppingListItem> items, Long userId) {
        return items.stream()
                .map(item -> new ShoppingListItemResponse(
                        item.getId(),
                        FoodResponse.ofUsed(item.getFood(), userId),
                        item.getQuantity().resolvedAmount(),
                        item.getQuantity().getPortionId(),
                        item.getQuantity().getPortionCount(),
                        item.isChecked()))
                .toList();
    }
}
