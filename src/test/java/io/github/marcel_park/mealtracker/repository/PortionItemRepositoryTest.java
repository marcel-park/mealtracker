package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.FoodPortion;
import io.github.marcel_park.mealtracker.model.Meal;
import io.github.marcel_park.mealtracker.model.Quantity;
import io.github.marcel_park.mealtracker.model.Recipe;
import io.github.marcel_park.mealtracker.model.RecipeVariation;
import io.github.marcel_park.mealtracker.model.ShoppingListItem;
import io.github.marcel_park.mealtracker.model.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

// The queries on items booked as portions (Quantity) and the shopping list queries, run against H2.
@DataJpaTest
class PortionItemRepositoryTest {

    @Autowired private FoodRepository foodRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private MealRepository mealRepository;
    @Autowired private RecipeRepository recipeRepository;
    @Autowired private MealItemRepository mealItemRepository;
    @Autowired private RecipeItemRepository recipeItemRepository;
    @Autowired private RecipeVariationItemRepository variationItemRepository;
    @Autowired private ShoppingListItemRepository shoppingListItemRepository;
    @Autowired private EntityManager entityManager;

    private User alice;
    private User bob;
    private Food egg;
    private FoodPortion piece;
    private Food milk;

    @BeforeEach
    void setUp() {
        alice = saveUser("alice@example.com");
        bob = saveUser("bob@example.com");
        egg = new Food();
        egg.setName("Ei");
        egg.setKcalPer100(144);
        piece = egg.addPortion("Stück", 60, true);
        egg = foodRepository.save(egg);
        milk = new Food();
        milk.setName("Milch");
        milk.setKcalPer100(64);
        milk = foodRepository.save(milk);
    }

    private User saveUser(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("{bcrypt}not-a-real-hash");
        return userRepository.save(user);
    }

    private ShoppingListItem listItem(User user, Food food, Quantity quantity, boolean checked, int position) {
        ShoppingListItem item = new ShoppingListItem(user, food, quantity, position);
        item.setChecked(checked);
        return shoppingListItemRepository.save(item);
    }

    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }

    @Test
    void itemsOfAPortion_areFoundInMealsRecipesVariationsAndShoppingLists() {
        Quantity twoPieces = Quantity.ofPortions(piece, new BigDecimal("2"));
        Meal meal = new Meal();
        meal.setUser(alice);
        meal.setTitle("Ei");
        meal.addItem(egg, twoPieces);
        meal.addItem(milk, 200);
        mealRepository.save(meal);
        Recipe recipe = new Recipe();
        recipe.setOwner(alice);
        recipe.setName("Omelette");
        recipe.setServings(2);
        recipe.addItem(egg, twoPieces);
        RecipeVariation variation = new RecipeVariation();
        variation.setRecipe(recipe);
        variation.setName("Mehr Ei");
        variation.addItem(egg, Quantity.ofPortions(piece, new BigDecimal("3")));
        recipe.getVariations().add(variation);
        recipeRepository.save(recipe);
        listItem(alice, egg, twoPieces, false, 0);
        flushAndClear();

        assertThat(mealItemRepository.findByPortionId(piece.getId())).hasSize(1);
        assertThat(recipeItemRepository.findByPortionId(piece.getId())).hasSize(1);
        assertThat(variationItemRepository.findByPortionId(piece.getId())).hasSize(1);
        assertThat(shoppingListItemRepository.findByPortionId(piece.getId())).hasSize(1);
        // read back from the database: count kept with two decimals, amount resolved via the portion
        assertThat(mealItemRepository.findByPortionId(piece.getId()).get(0).getAmount()).isEqualTo(120.0);
    }

    @Test
    void shoppingList_uncheckedFirst_eachInItsOrder_andOnlyOfTheUser() {
        listItem(alice, milk, Quantity.ofAmount(1000), true, 0);
        listItem(alice, egg, Quantity.ofAmount(120), false, 5);
        listItem(bob, egg, Quantity.ofAmount(60), false, 1);
        flushAndClear();

        assertThat(shoppingListItemRepository.findListOf(alice.getId()))
                .extracting(item -> item.getFood().getName())
                .containsExactly("Ei", "Milch");
        assertThat(shoppingListItemRepository.nextPosition(alice.getId())).isEqualTo(6);
        assertThat(shoppingListItemRepository.nextPosition(saveUser("carol@example.com").getId())).isZero();
        assertThat(shoppingListItemRepository.findByUserIdAndFoodId(alice.getId(), egg.getId())).isPresent();
        assertThat(shoppingListItemRepository.existsByFoodIdAndUserIdNot(milk.getId(), alice.getId())).isFalse();
        assertThat(shoppingListItemRepository.existsByFoodIdAndUserIdNot(egg.getId(), alice.getId())).isTrue();
        assertThat(shoppingListItemRepository.findUsedFoodIds(List.of(egg.getId(), milk.getId())))
                .containsExactlyInAnyOrder(egg.getId(), milk.getId());

        shoppingListItemRepository.deleteAllOf(alice.getId());
        flushAndClear();

        assertThat(shoppingListItemRepository.findListOf(alice.getId())).isEmpty();
        assertThat(shoppingListItemRepository.findListOf(bob.getId())).hasSize(1);
    }
}
