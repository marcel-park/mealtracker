package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.dto.ShoppingListAddRequest;
import io.github.marcel_park.mealtracker.dto.ShoppingListCheckRequest;
import io.github.marcel_park.mealtracker.dto.ShoppingListItemResponse;
import io.github.marcel_park.mealtracker.dto.ShoppingListQuantityRequest;
import io.github.marcel_park.mealtracker.security.CurrentUser;
import io.github.marcel_park.mealtracker.service.ShoppingListService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// The shopping list of the logged-in user. Every change answers with the whole list in the order
// the app shows it (unchecked first), see ShoppingListService.
@RestController
@RequestMapping("/api/shopping-list")
public class ShoppingListController {

    private final ShoppingListService shoppingListService;

    public ShoppingListController(ShoppingListService shoppingListService) {
        this.shoppingListService = shoppingListService;
    }

    @GetMapping
    public List<ShoppingListItemResponse> list(@AuthenticationPrincipal CurrentUser user) {
        return shoppingListService.find(user.userId());
    }

    // Foods already on the list are added to their item.
    @PostMapping("/items")
    public List<ShoppingListItemResponse> add(@AuthenticationPrincipal CurrentUser user,
                                              @Valid @RequestBody ShoppingListAddRequest request) {
        return shoppingListService.add(user.userId(), request);
    }

    @PutMapping("/items/{id}/checked")
    public List<ShoppingListItemResponse> setChecked(@AuthenticationPrincipal CurrentUser user,
                                                     @PathVariable Long id,
                                                     @Valid @RequestBody ShoppingListCheckRequest request) {
        return shoppingListService.setChecked(user.userId(), id, request.checked());
    }

    // Replaces the quantity of the item.
    @PutMapping("/items/{id}/quantity")
    public List<ShoppingListItemResponse> setQuantity(@AuthenticationPrincipal CurrentUser user,
                                                      @PathVariable Long id,
                                                      @Valid @RequestBody ShoppingListQuantityRequest request) {
        return shoppingListService.setQuantity(user.userId(), id, request);
    }

    // to: the new place among the unchecked items, 0 for the first (out of range: first or last).
    @PostMapping("/items/{id}/move")
    public List<ShoppingListItemResponse> move(@AuthenticationPrincipal CurrentUser user,
                                               @PathVariable Long id,
                                               @RequestParam int to) {
        return shoppingListService.move(user.userId(), id, to);
    }

    @DeleteMapping("/items/{id}")
    public List<ShoppingListItemResponse> remove(@AuthenticationPrincipal CurrentUser user,
                                                 @PathVariable Long id) {
        return shoppingListService.remove(user.userId(), id);
    }

    // Resets the list: every item goes, checked or not.
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clear(@AuthenticationPrincipal CurrentUser user) {
        shoppingListService.clear(user.userId());
    }
}
