package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.CatalogScope;
import io.github.marcel_park.mealtracker.dto.FoodPortionRequest;
import io.github.marcel_park.mealtracker.dto.FoodRequest;
import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.exception.ForbiddenException;
import io.github.marcel_park.mealtracker.exception.InvalidRequestException;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.FoodPortion;
import io.github.marcel_park.mealtracker.model.User;
import io.github.marcel_park.mealtracker.repository.FoodRepository;
import io.github.marcel_park.mealtracker.repository.MealItemRepository;
import io.github.marcel_park.mealtracker.repository.RecipeItemRepository;
import io.github.marcel_park.mealtracker.repository.RecipeRepository;
import io.github.marcel_park.mealtracker.repository.RecipeVariationItemRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

// Rules for foods:
// - Everybody sees their own foods and all public ones. A food that is neither is reported as
//   "not found", so its existence is not revealed.
// - Only the owner may edit or delete a food. Changes to a public food show up everywhere it is
//   used, in meals and recipes of other users too: that is the deal with public foods.
// - A food that is still used somewhere is never really deleted, or made private behind the back
//   of others. It loses its owner instead and stays public for good, so the meals and recipes
//   that contain it keep working. See delete() and update().
// - The unit (g or ml) may change at any time, even of a used food. Booked amounts stay the same
//   numbers in the new unit (100 g become 100 ml), and so do their kcal. That is meant for owners
//   correcting a mistake; the app points it out before saving.
// - Portions are part of the food: they are saved with it (the request lists all of them), only
//   the owner changes them, and they go when the food goes. A food without owner keeps its
//   portions, but nobody can change them any more. A food with portions has exactly one favorite.
@Service
public class FoodService {

    // Combining marks, i.e. the accents NFD splits off "ä", "é", ...
    private static final Pattern ACCENTS = Pattern.compile("\\p{M}+");

    private final FoodRepository foodRepository;
    private final MealItemRepository mealItemRepository;
    private final RecipeItemRepository recipeItemRepository;
    private final RecipeVariationItemRepository variationItemRepository;
    private final RecipeRepository recipeRepository;
    private final UserRepository userRepository;

    public FoodService(FoodRepository foodRepository, MealItemRepository mealItemRepository,
                       RecipeItemRepository recipeItemRepository,
                       RecipeVariationItemRepository variationItemRepository,
                       RecipeRepository recipeRepository, UserRepository userRepository) {
        this.foodRepository = foodRepository;
        this.mealItemRepository = mealItemRepository;
        this.recipeItemRepository = recipeItemRepository;
        this.variationItemRepository = variationItemRepository;
        this.recipeRepository = recipeRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<FoodResponse> find(Long userId, String query, CatalogScope scope, boolean confirmedOnly) {
        CatalogSearch search = CatalogSearch.of(query, scope, confirmedOnly);
        List<Food> foods = foodRepository.search(userId, search.namePattern(),
                search.ownOnly(), search.publicOnly(), search.confirmedOnly());
        Set<Long> usedIds = findUsedIds(foods.stream().map(Food::getId).toList());
        return foods.stream()
                .map(food -> FoodResponse.from(food, userId, usedIds.contains(food.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public FoodResponse get(Long userId, Long id) {
        Food food = getVisibleEntity(userId, id);
        return FoodResponse.from(food, userId, isUsed(id));
    }

    @Transactional
    public FoodResponse create(Long userId, FoodRequest request) {
        Food food = new Food();
        food.setOwner(userRepository.getReferenceById(userId));
        apply(request, food);
        applyPortions(food, request.portions(), false);
        // Flushed so the new portions have their ids in the response.
        return FoodResponse.from(foodRepository.saveAndFlush(food), userId, false);
    }

    // Making a public food private while other users already have it in a meal or recipe would
    // take it away from them. In that case the food stays public as it is, without owner, and the
    // owner gets a private copy with the requested values instead. The response is that copy, so
    // its id differs from the requested one. The owner's own meals and recipes keep the original.
    //
    // Without such use the food simply becomes private, and so do the owner's public recipes that
    // contain it: a public recipe must not contain private foods.
    @Transactional
    public FoodResponse update(Long userId, Long id, FoodRequest request) {
        Food food = getOwnedEntity(userId, id);
        boolean used = isUsed(id);
        boolean becomesPrivate = food.isPublic() && !request.published();

        if (becomesPrivate && isUsedByOthers(food, userId)) {
            User owner = food.getOwner();
            food.releaseOwnership();
            Food copy = new Food();
            copy.setOwner(owner);
            apply(request, copy);
            // The requested portions refer to the original; the copy gets new ones like them.
            applyPortions(copy, request.portions(), false);
            return FoodResponse.from(foodRepository.saveAndFlush(copy), userId, false);
        }

        apply(request, food);
        applyPortions(food, request.portions(), true);
        if (becomesPrivate) {
            recipeRepository.findPublishedByOwnerContainingFood(userId, id)
                    .forEach(recipe -> recipe.setPublished(false));
        }
        return FoodResponse.from(foodRepository.saveAndFlush(food), userId, used);
    }

    // Still in a meal, recipe or recipe variation of anybody, the owner's own included: the food
    // only loses its owner. It disappears from the owner's "own" foods but stays available, and
    // public, to all. Only a food nothing refers to is really deleted.
    @Transactional
    public void delete(Long userId, Long id) {
        Food food = getOwnedEntity(userId, id);
        if (isUsed(id)) {
            food.releaseOwnership();
        } else {
            foodRepository.delete(food);
        }
    }

    // Package-private on purpose: MealService and RecipeService need the entity to attach it to
    // their items, while callers outside this package only ever get DTOs.
    Food getVisibleEntity(Long userId, Long id) {
        return foodRepository.findById(id)
                .filter(food -> food.isVisibleTo(userId))
                .orElseThrow(() -> new NotFoundException("Food", id));
    }

    // Publishing a recipe publishes the owner's private foods in it, so others can book it.
    void publishOwned(Long userId, Food food) {
        if (food.isOwnedBy(userId)) {
            food.setPublished(true);
        }
    }

    private Food getOwnedEntity(Long userId, Long id) {
        Food food = getVisibleEntity(userId, id);
        if (!food.isOwnedBy(userId)) {
            throw new ForbiddenException("Food", id);
        }
        return food;
    }

    // In a meal, recipe or variation of anybody, the owner's own included.
    private boolean isUsed(Long foodId) {
        return mealItemRepository.existsByFoodId(foodId) || recipeItemRepository.existsByFoodId(foodId)
                || variationItemRepository.existsByFoodId(foodId);
    }

    // isUsed() for a whole list of foods, with three queries instead of three per food.
    private Set<Long> findUsedIds(Collection<Long> foodIds) {
        if (foodIds.isEmpty()) {
            return Set.of(); // "in ()" is no valid SQL
        }
        Set<Long> usedIds = new HashSet<>(mealItemRepository.findUsedFoodIds(foodIds));
        usedIds.addAll(recipeItemRepository.findUsedFoodIds(foodIds));
        usedIds.addAll(variationItemRepository.findUsedFoodIds(foodIds));
        return usedIds;
    }

    private boolean isUsedByOthers(Food food, Long userId) {
        return mealItemRepository.existsByFoodIdAndMealUserIdNot(food.getId(), userId)
                || recipeItemRepository.existsByFoodIdAndRecipeOwnerIdNot(food.getId(), userId)
                || variationItemRepository.existsByFoodIdAndVariationRecipeOwnerIdNot(food.getId(), userId);
    }

    private void apply(FoodRequest request, Food food) {
        food.setName(request.name());
        food.setUnit(request.unit());
        food.setKcalPer100(request.kcalPer100());
        food.setProtein(request.protein());
        food.setCarbs(request.carbs());
        food.setFat(request.fat());
        food.setPublished(request.published());
    }

    // Makes the portions of the food match the request: listed ones with an id are updated, the
    // others are added, and portions not listed are removed. keepIds false: every listed portion
    // is added as a new one (a new food, or the private copy in update()).
    //
    // Names are trimmed and must differ ignoring case and accents, like the unique key in the
    // database (collation utf8mb4_unicode_ci) compares them. Exactly one portion ends up as the
    // favorite: the marked one, or the oldest if none is marked.
    //
    // The unique key is checked row by row, and Hibernate orders the statements of one flush its
    // own way (INSERTs before DELETEs). So the changes reach the database in steps, each flushed:
    // 1. removed portions are deleted, so a new portion may take the name of a removed one;
    // 2. renamed portions get a temporary name (" " + id: no stored name starts with a space), so
    //    renames may run in chains and swaps ("Packung" <-> "Becher") in one request;
    // 3. kept portions get their requested values;
    // 4. new portions are added (inserted by the caller's saveAndFlush).
    private void applyPortions(Food food, List<FoodPortionRequest> requests, boolean keepIds) {
        Set<String> names = new HashSet<>();
        for (FoodPortionRequest request : requests) {
            if (!names.add(comparableName(request.name()))) {
                throw new InvalidRequestException("Two portions of a food cannot both be called '"
                        + request.name().trim() + "'");
            }
        }
        if (requests.stream().filter(FoodPortionRequest::favorite).count() > 1) {
            throw new InvalidRequestException("A food can only have one favorite portion");
        }

        Map<Long, FoodPortion> existing = food.getPortions().stream()
                .collect(Collectors.toMap(FoodPortion::getId, Function.identity()));
        Set<Long> keptIds = new HashSet<>();
        if (keepIds) {
            for (FoodPortionRequest request : requests) {
                if (request.id() == null) continue;
                if (!existing.containsKey(request.id())) {
                    throw new InvalidRequestException("Portion with id " + request.id()
                            + " does not belong to food with id " + food.getId());
                }
                if (!keptIds.add(request.id())) {
                    throw new InvalidRequestException("Portion with id " + request.id() + " is listed twice");
                }
            }
        }
        FoodPortionRequest favorite = chooseFavorite(requests, keepIds);

        if (food.getPortions().removeIf(portion -> !keptIds.contains(portion.getId()))) {
            flushIfPersisted(food);
        }
        List<FoodPortionRequest> kept = requests.stream()
                .filter(request -> keepIds && request.id() != null)
                .toList();
        boolean renamed = false;
        for (FoodPortionRequest request : kept) {
            FoodPortion portion = existing.get(request.id());
            if (!portion.getName().equals(request.name().trim())) {
                portion.setName(" " + portion.getId());
                renamed = true;
            }
        }
        if (renamed) {
            flushIfPersisted(food);
        }
        for (FoodPortionRequest request : kept) {
            FoodPortion portion = existing.get(request.id());
            portion.setName(request.name().trim());
            portion.setAmount(request.amount());
            // Identity on purpose: favorite is one of these very request objects (or null).
            portion.setFavorite(request == favorite);
        }
        if (!kept.isEmpty()) {
            flushIfPersisted(food);
        }
        for (FoodPortionRequest request : requests) {
            if (!keepIds || request.id() == null) {
                food.addPortion(request.name().trim(), request.amount(), request == favorite);
            }
        }
    }

    // A portion name as the unique key compares it: trimmed, without accents, in lower case.
    // The app compares the same way (foods.js). The database collation also takes e.g. "ß" for
    // "ss"; such rare cases end with its unique key, see GlobalExceptionHandler.
    private static String comparableName(String name) {
        return ACCENTS.matcher(Normalizer.normalize(name.trim(), Normalizer.Form.NFD))
                .replaceAll("")
                .toLowerCase(Locale.ROOT);
    }

    // The marked portion; without one the oldest: the existing portion with the lowest id, or the
    // first new one if none of them exists yet. null if there are no portions.
    private static FoodPortionRequest chooseFavorite(List<FoodPortionRequest> requests, boolean keepIds) {
        return requests.stream().filter(FoodPortionRequest::favorite).findFirst()
                .or(() -> keepIds
                        ? requests.stream().filter(request -> request.id() != null)
                                .min(Comparator.comparingLong(FoodPortionRequest::id))
                        : Optional.<FoodPortionRequest>empty())
                .or(() -> requests.stream().findFirst())
                .orElse(null);
    }

    // A food that is not saved yet has nothing in the database to clash with.
    private void flushIfPersisted(Food food) {
        if (food.getId() != null) {
            foodRepository.flush();
        }
    }
}
