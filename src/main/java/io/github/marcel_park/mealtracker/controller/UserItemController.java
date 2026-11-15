package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.dto.UserItemRequest;
import io.github.marcel_park.mealtracker.dto.UserItemResponse;
import io.github.marcel_park.mealtracker.dto.UserItemScope;
import io.github.marcel_park.mealtracker.security.CurrentUser;
import io.github.marcel_park.mealtracker.service.UserItemService;
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

// User items for the shopping list. Visibility and ownership rules: see UserItemService.
// A name the user already has (any case) is answered with 409.
@RestController
@RequestMapping("/api/user-items")
public class UserItemController {

    private final UserItemService userItemService;

    public UserItemController(UserItemService userItemService) {
        this.userItemService = userItemService;
    }

    // ?query= part of the name (without: all), ?scope=OWN|FRIENDS (without: everything the user may
    // see), ?page=0, 1, ... of ?size= results (at most 100).
    @GetMapping
    public List<UserItemResponse> list(@AuthenticationPrincipal CurrentUser user,
                                         @RequestParam(required = false) String query,
                                         @RequestParam(required = false) UserItemScope scope,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "50") int size) {
        return userItemService.find(user.userId(), query, scope, page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserItemResponse create(@AuthenticationPrincipal CurrentUser user,
                                     @Valid @RequestBody UserItemRequest request) {
        return userItemService.create(user.userId(), request);
    }

    @PutMapping("/{id}")
    public UserItemResponse update(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id,
                                     @Valid @RequestBody UserItemRequest request) {
        return userItemService.update(user.userId(), id, request);
    }

    // Also takes the item off every shopping list.
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id) {
        userItemService.delete(user.userId(), id);
    }
}
