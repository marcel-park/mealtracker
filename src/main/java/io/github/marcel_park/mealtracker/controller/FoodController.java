package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.dto.CatalogScope;
import io.github.marcel_park.mealtracker.dto.FoodRequest;
import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.security.CurrentUser;
import io.github.marcel_park.mealtracker.service.FoodService;
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

// Visibility and ownership rules: see FoodService.
@RestController
@RequestMapping("/api/foods")
public class FoodController {

    private final FoodService foodService;

    public FoodController(FoodService foodService) {
        this.foodService = foodService;
    }

    // ?scope=PUBLIC|OWN (without: everything the user may see), ?confirmed=true: confirmed ones only.
    @GetMapping
    public List<FoodResponse> list(@AuthenticationPrincipal CurrentUser user,
                                   @RequestParam(required = false) String query,
                                   @RequestParam(required = false) CatalogScope scope,
                                   @RequestParam(defaultValue = "false") boolean confirmed) {
        return foodService.find(user.userId(), query, scope, confirmed);
    }

    @GetMapping("/{id}")
    public FoodResponse get(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id) {
        return foodService.get(user.userId(), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FoodResponse create(@AuthenticationPrincipal CurrentUser user,
                               @Valid @RequestBody FoodRequest request) {
        return foodService.create(user.userId(), request);
    }

    // The response can have another id than the request: see FoodService.update.
    @PutMapping("/{id}")
    public FoodResponse update(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id,
                               @Valid @RequestBody FoodRequest request) {
        return foodService.update(user.userId(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id) {
        foodService.delete(user.userId(), id);
    }
}
