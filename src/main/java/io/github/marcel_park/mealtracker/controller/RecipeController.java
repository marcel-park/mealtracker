package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.dto.CatalogScope;
import io.github.marcel_park.mealtracker.dto.RecipeRequest;
import io.github.marcel_park.mealtracker.dto.RecipeResponse;
import io.github.marcel_park.mealtracker.dto.VariationRequest;
import io.github.marcel_park.mealtracker.dto.VariationResponse;
import io.github.marcel_park.mealtracker.security.CurrentUser;
import io.github.marcel_park.mealtracker.service.RecipeService;
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

// Visibility and ownership rules: see RecipeService. Booking a recipe goes through /api/meals
// with the recipe's foods. Variations are part of the recipe response (for the owner only) and
// are changed through /api/recipes/{id}/variations.
@RestController
@RequestMapping("/api/recipes")
public class RecipeController {

    private final RecipeService recipeService;

    public RecipeController(RecipeService recipeService) {
        this.recipeService = recipeService;
    }

    // ?scope=PUBLIC|OWN (without: everything the user may see), ?confirmed=true: confirmed ones only.
    @GetMapping
    public List<RecipeResponse> list(@AuthenticationPrincipal CurrentUser user,
                                     @RequestParam(required = false) String query,
                                     @RequestParam(required = false) CatalogScope scope,
                                     @RequestParam(defaultValue = "false") boolean confirmed) {
        return recipeService.find(user.userId(), query, scope, confirmed);
    }

    @GetMapping("/{id}")
    public RecipeResponse get(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id) {
        return recipeService.get(user.userId(), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RecipeResponse create(@AuthenticationPrincipal CurrentUser user,
                                 @Valid @RequestBody RecipeRequest request) {
        return recipeService.create(user.userId(), request);
    }

    @PutMapping("/{id}")
    public RecipeResponse update(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id,
                                 @Valid @RequestBody RecipeRequest request) {
        return recipeService.update(user.userId(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id) {
        recipeService.delete(user.userId(), id);
    }

    @PostMapping("/{id}/variations")
    @ResponseStatus(HttpStatus.CREATED)
    public VariationResponse createVariation(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id,
                                             @Valid @RequestBody VariationRequest request) {
        return recipeService.createVariation(user.userId(), id, request);
    }

    @PutMapping("/{id}/variations/{variationId}")
    public VariationResponse updateVariation(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id,
                                             @PathVariable Long variationId,
                                             @Valid @RequestBody VariationRequest request) {
        return recipeService.updateVariation(user.userId(), id, variationId, request);
    }

    @DeleteMapping("/{id}/variations/{variationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteVariation(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id,
                                @PathVariable Long variationId) {
        recipeService.deleteVariation(user.userId(), id, variationId);
    }
}
