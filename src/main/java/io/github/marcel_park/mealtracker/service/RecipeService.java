package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.CatalogScope;
import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.dto.RecipeItemRequest;
import io.github.marcel_park.mealtracker.dto.RecipeItemResponse;
import io.github.marcel_park.mealtracker.dto.RecipeRequest;
import io.github.marcel_park.mealtracker.dto.RecipeResponse;
import io.github.marcel_park.mealtracker.dto.RecipeUseRequest;
import io.github.marcel_park.mealtracker.dto.VariationItemRequest;
import io.github.marcel_park.mealtracker.dto.VariationItemResponse;
import io.github.marcel_park.mealtracker.dto.VariationRequest;
import io.github.marcel_park.mealtracker.dto.VariationResponse;
import io.github.marcel_park.mealtracker.exception.ForbiddenException;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.Recipe;
import io.github.marcel_park.mealtracker.model.RecipeItem;
import io.github.marcel_park.mealtracker.model.RecipeVariation;
import io.github.marcel_park.mealtracker.model.RecipeVariationItem;
import io.github.marcel_park.mealtracker.repository.RecipeRepository;
import io.github.marcel_park.mealtracker.repository.RecipeVariationRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.function.ToDoubleFunction;
import java.util.stream.Collectors;

// Rules for recipes:
// - Everybody sees their own recipes and all public ones; others are reported as "not found".
// - Only the owner may edit or delete a recipe. Nothing references a recipe (booking one books
//   its foods), so it can always be changed, made private or deleted, for everybody at once.
// - A recipe may only contain foods the owner can see. Saving it as public also publishes the
//   owner's private foods in it, otherwise others could not book it. Making it private again
//   leaves the foods public; the owner can make them private one by one.
//
// Variations (see RecipeVariation):
// - Only the owner of a recipe can create them, and only the owner ever sees them. Others who
//   want their own version copy the recipe first (the app does that with create()).
// - A variation stores only what differs from the original. Requests may send any amounts:
//   amounts equal to the original's are dropped, so that ingredient keeps following the original.
@Service
public class RecipeService {

    private final RecipeRepository recipeRepository;
    private final RecipeVariationRepository variationRepository;
    private final FoodService foodService;
    private final UserRepository userRepository;

    public RecipeService(RecipeRepository recipeRepository, RecipeVariationRepository variationRepository,
                         FoodService foodService, UserRepository userRepository) {
        this.recipeRepository = recipeRepository;
        this.variationRepository = variationRepository;
        this.foodService = foodService;
        this.userRepository = userRepository;
    }

    // Items and their foods are loaded lazily, so toResponse() has to run inside a transaction.
    @Transactional(readOnly = true)
    public List<RecipeResponse> find(Long userId, String query, CatalogScope scope, boolean confirmedOnly) {
        CatalogSearch search = CatalogSearch.of(query, scope, confirmedOnly);
        return recipeRepository.search(userId, search.namePattern(),
                        search.ownOnly(), search.publicOnly(), search.confirmedOnly()).stream()
                .map(recipe -> toResponse(recipe, userId))
                .toList();
    }

    @Transactional(readOnly = true)
    public RecipeResponse get(Long userId, Long id) {
        return toResponse(getVisibleEntity(userId, id), userId);
    }

    @Transactional
    public RecipeResponse create(Long userId, RecipeRequest request) {
        Recipe recipe = new Recipe();
        recipe.setOwner(userRepository.getReferenceById(userId));
        applyFields(request, recipe);
        sumAmountsByFoodId(request.items(), RecipeItemRequest::foodId, RecipeItemRequest::amount)
                .forEach((foodId, amount) ->
                        recipe.addItem(foodService.getVisibleEntity(userId, foodId), amount));
        publishFoodsIfPublic(userId, recipe);
        return toResponse(recipeRepository.save(recipe), userId);
    }

    // Variations keep their own amounts; ingredients they do not change follow the new original.
    @Transactional
    public RecipeResponse update(Long userId, Long id, RecipeRequest request) {
        Recipe recipe = getOwnedEntity(userId, id);
        applyFields(request, recipe);

        // Updated in place for the same reason as in MealService.update: the primary key is
        // (recipe_id, food_id) and Hibernate flushes INSERTs before DELETEs.
        Map<Long, Double> requestedAmounts =
                sumAmountsByFoodId(request.items(), RecipeItemRequest::foodId, RecipeItemRequest::amount);
        recipe.getItems().removeIf(item -> !requestedAmounts.containsKey(item.getFood().getId()));

        Map<Long, RecipeItem> keptItems = recipe.getItems().stream()
                .collect(Collectors.toMap(item -> item.getFood().getId(), item -> item));
        requestedAmounts.forEach((foodId, amount) -> {
            RecipeItem keptItem = keptItems.get(foodId);
            if (keptItem != null) {
                keptItem.setAmount(amount);
            } else {
                recipe.addItem(foodService.getVisibleEntity(userId, foodId), amount);
            }
        });

        publishFoodsIfPublic(userId, recipe);
        return toResponse(recipe, userId);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        recipeRepository.delete(getOwnedEntity(userId, id));
    }

    // ---------- variations ----------

    @Transactional
    public VariationResponse createVariation(Long userId, Long recipeId, VariationRequest request) {
        Recipe recipe = getOwnedEntity(userId, recipeId);
        RecipeVariation variation = new RecipeVariation();
        variation.setRecipe(recipe);
        applyVariation(userId, recipe, request, variation);
        recipe.getVariations().add(variation);
        return toVariationResponse(variationRepository.save(variation), userId);
    }

    @Transactional
    public VariationResponse updateVariation(Long userId, Long recipeId, Long variationId,
                                             VariationRequest request) {
        Recipe recipe = getOwnedEntity(userId, recipeId);
        RecipeVariation variation = getVariation(recipe, variationId);
        applyVariation(userId, recipe, request, variation);
        return toVariationResponse(variation, userId);
    }

    @Transactional
    public void deleteVariation(Long userId, Long recipeId, Long variationId) {
        Recipe recipe = getOwnedEntity(userId, recipeId);
        RecipeVariation variation = getVariation(recipe, variationId);
        recipe.getVariations().remove(variation);
        if (variationId.equals(recipe.getLastUsedVariationId())) {
            recipe.setLastUsedVariationId(null);
        }
    }

    // Remembers what the owner booked last, to preselect it next time. Called when a meal is
    // saved. Lenient on purpose: the meal is booked anyway, so recipes deleted meanwhile, recipes
    // of others (they have no variations for this user) and unknown variations are ignored.
    @Transactional
    public void markUsed(Long userId, List<RecipeUseRequest> uses) {
        if (uses == null) return;
        for (RecipeUseRequest use : uses) {
            recipeRepository.findById(use.recipeId())
                    .filter(recipe -> recipe.isOwnedBy(userId))
                    .filter(recipe -> use.variationId() == null || recipe.getVariations().stream()
                            .anyMatch(variation -> variation.getId().equals(use.variationId())))
                    .ifPresent(recipe -> recipe.setLastUsedVariationId(use.variationId()));
        }
    }

    // ---------- helpers ----------

    private Recipe getVisibleEntity(Long userId, Long id) {
        return recipeRepository.findById(id)
                .filter(recipe -> recipe.isVisibleTo(userId))
                .orElseThrow(() -> new NotFoundException("Recipe", id));
    }

    private Recipe getOwnedEntity(Long userId, Long id) {
        Recipe recipe = getVisibleEntity(userId, id);
        if (!recipe.isOwnedBy(userId)) {
            throw new ForbiddenException("Recipe", id);
        }
        return recipe;
    }

    private static RecipeVariation getVariation(Recipe recipe, Long variationId) {
        return recipe.getVariations().stream()
                .filter(variation -> variation.getId().equals(variationId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Variation", variationId));
    }

    private void applyFields(RecipeRequest request, Recipe recipe) {
        recipe.setName(request.name());
        recipe.setServings(request.servings());
        recipe.setPublished(request.published());
    }

    // Keeps only what differs from the original: changed amounts of its ingredients (0: left out)
    // and foods it does not contain. Servings equal to the original's are stored as null.
    private void applyVariation(Long userId, Recipe recipe, VariationRequest request,
                                RecipeVariation variation) {
        variation.setName(request.name());
        boolean sameServings = Objects.equals(request.servings(), recipe.getServings());
        variation.setServings(sameServings ? null : request.servings());
        variation.setWeightG(request.weightG());

        Map<Long, Double> originalAmounts = recipe.getItems().stream()
                .collect(Collectors.toMap(item -> item.getFood().getId(), RecipeItem::getAmount));
        Map<Long, Double> changedAmounts = new LinkedHashMap<>();
        sumAmountsByFoodId(request.items(), VariationItemRequest::foodId, VariationItemRequest::amount)
                .forEach((foodId, amount) -> {
                    double originalAmount = originalAmounts.getOrDefault(foodId, 0.0);
                    if (Double.compare(amount, originalAmount) != 0) {
                        changedAmounts.put(foodId, amount);
                    }
                });

        // In place, see update()
        variation.getItems().removeIf(item -> !changedAmounts.containsKey(item.getFood().getId()));
        Map<Long, RecipeVariationItem> keptItems = variation.getItems().stream()
                .collect(Collectors.toMap(item -> item.getFood().getId(), item -> item));
        changedAmounts.forEach((foodId, amount) -> {
            RecipeVariationItem keptItem = keptItems.get(foodId);
            if (keptItem != null) {
                keptItem.setAmount(amount);
            } else {
                variation.addItem(foodService.getVisibleEntity(userId, foodId), amount);
            }
        });
    }

    private void publishFoodsIfPublic(Long userId, Recipe recipe) {
        if (recipe.isPublished()) {
            recipe.getItems().forEach(item -> foodService.publishOwned(userId, item.getFood()));
        }
    }

    // Same food listed twice: the amounts are added up. LinkedHashMap keeps the request order.
    // Used for recipe items and variation items, which are different request types.
    private static <T> Map<Long, Double> sumAmountsByFoodId(List<T> items, Function<T, Long> foodId,
                                                            ToDoubleFunction<T> amount) {
        Map<Long, Double> amounts = new LinkedHashMap<>();
        for (T item : items) {
            amounts.merge(foodId.apply(item), amount.applyAsDouble(item), Double::sum);
        }
        return amounts;
    }

    // Calories are computed from the foods' current values, like for meals. Variations only for
    // the owner, so they are never shared.
    private RecipeResponse toResponse(Recipe recipe, Long userId) {
        List<RecipeItemResponse> items = recipe.getItems().stream()
                .map(item -> new RecipeItemResponse(
                        FoodResponse.ofUsed(item.getFood(), userId),
                        item.getAmount(),
                        item.getAmount() * item.getFood().getKcalPer100() / 100))
                .toList();
        boolean owned = recipe.isOwnedBy(userId);
        return new RecipeResponse(
                recipe.getId(),
                recipe.getName(),
                recipe.getServings(),
                owned,
                recipe.isPublished(),
                recipe.isConfirmed(),
                items.stream().mapToDouble(RecipeItemResponse::amount).sum(),
                items.stream().mapToDouble(RecipeItemResponse::kcal).sum(),
                items,
                owned
                        ? recipe.getVariations().stream().map(v -> toVariationResponse(v, userId)).toList()
                        : List.of(),
                owned ? recipe.getLastUsedVariationId() : null);
    }

    private static VariationResponse toVariationResponse(RecipeVariation variation, Long userId) {
        return new VariationResponse(
                variation.getId(),
                variation.getName(),
                variation.getServings(),
                variation.getWeightG(),
                variation.getItems().stream()
                        .map(item -> new VariationItemResponse(
                                FoodResponse.ofUsed(item.getFood(), userId), item.getAmount()))
                        .toList());
    }
}
