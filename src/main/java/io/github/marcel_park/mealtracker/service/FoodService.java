package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.CatalogScope;
import io.github.marcel_park.mealtracker.dto.FoodRequest;
import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.exception.ForbiddenException;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.User;
import io.github.marcel_park.mealtracker.repository.FoodRepository;
import io.github.marcel_park.mealtracker.repository.MealItemRepository;
import io.github.marcel_park.mealtracker.repository.RecipeItemRepository;
import io.github.marcel_park.mealtracker.repository.RecipeRepository;
import io.github.marcel_park.mealtracker.repository.RecipeVariationItemRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// Rules for foods:
// - Everybody sees their own foods and all public ones. A food that is neither is reported as
//   "not found", so its existence is not revealed.
// - Only the owner may edit or delete a food. Changes to a public food show up everywhere it is
//   used, in meals and recipes of other users too: that is the deal with public foods.
// - A food that is still used somewhere is never really deleted, or made private behind the back
//   of others. It loses its owner instead and stays public for good, so the meals and recipes
//   that contain it keep working. See delete() and update().
@Service
public class FoodService {

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
    public List<FoodResponse> find(Long userId, String query, CatalogScope scope) {
        CatalogSearch search = CatalogSearch.of(query, scope);
        return foodRepository.search(userId, search.namePattern(),
                        search.ownOnly(), search.publicOnly(), search.confirmedOnly()).stream()
                .map(food -> FoodResponse.from(food, userId))
                .toList();
    }

    @Transactional(readOnly = true)
    public FoodResponse get(Long userId, Long id) {
        return FoodResponse.from(getVisibleEntity(userId, id), userId);
    }

    @Transactional
    public FoodResponse create(Long userId, FoodRequest request) {
        Food food = new Food();
        food.setOwner(userRepository.getReferenceById(userId));
        apply(request, food);
        return FoodResponse.from(foodRepository.save(food), userId);
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
        boolean becomesPrivate = food.isPublic() && !request.published();

        if (becomesPrivate && isUsedByOthers(food, userId)) {
            User owner = food.getOwner();
            food.releaseOwnership();
            Food copy = new Food();
            copy.setOwner(owner);
            apply(request, copy);
            return FoodResponse.from(foodRepository.save(copy), userId);
        }

        apply(request, food);
        if (becomesPrivate) {
            recipeRepository.findPublishedByOwnerContainingFood(userId, id)
                    .forEach(recipe -> recipe.setPublished(false));
        }
        return FoodResponse.from(foodRepository.save(food), userId);
    }

    // Still in a meal, recipe or recipe variation of anybody, the owner's own included: the food
    // only loses its owner. It disappears from the owner's "own" foods but stays available, and
    // public, to all. Only a food nothing refers to is really deleted.
    @Transactional
    public void delete(Long userId, Long id) {
        Food food = getOwnedEntity(userId, id);
        if (mealItemRepository.existsByFoodId(id) || recipeItemRepository.existsByFoodId(id)
                || variationItemRepository.existsByFoodId(id)) {
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

    private boolean isUsedByOthers(Food food, Long userId) {
        return mealItemRepository.existsByFoodIdAndMealUserIdNot(food.getId(), userId)
                || recipeItemRepository.existsByFoodIdAndRecipeOwnerIdNot(food.getId(), userId)
                || variationItemRepository.existsByFoodIdAndVariationRecipeOwnerIdNot(food.getId(), userId);
    }

    private void apply(FoodRequest request, Food food) {
        food.setName(request.name());
        food.setKcalPer100g(request.kcalPer100g());
        food.setProtein(request.protein());
        food.setCarbs(request.carbs());
        food.setFat(request.fat());
        food.setPublished(request.published());
    }
}
