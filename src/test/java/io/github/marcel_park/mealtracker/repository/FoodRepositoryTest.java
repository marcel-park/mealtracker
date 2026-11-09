package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.Meal;
import io.github.marcel_park.mealtracker.model.Recipe;
import io.github.marcel_park.mealtracker.model.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest
class FoodRepositoryTest {

    @Autowired
    private FoodRepository repository;

    @Autowired
    private MealRepository mealRepository;

    @Autowired
    private RecipeRepository recipeRepository;

    @Autowired
    private MealItemRepository mealItemRepository;

    @Autowired
    private RecipeItemRepository recipeItemRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EntityManager entityManager;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = saveUser("alice@example.com");
        bob = saveUser("bob@example.com");
    }

    // ---------- helpers ----------

    private User saveUser(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("{bcrypt}not-a-real-hash");
        return userRepository.save(user);
    }

    private Food save(String name, User owner, boolean published) {
        Food f = new Food();
        f.setName(name);
        f.setOwner(owner);
        f.setPublished(published);
        f.setKcalPer100g(100);
        f.setProtein(5);
        f.setCarbs(10);
        f.setFat(2);
        return repository.save(f);
    }

    // Everything alice may see whose name contains the pattern, no filter.
    private List<String> visibleToAlice(String namePattern) {
        return names(repository.search(alice.getId(), namePattern, false, false, false));
    }

    private static List<String> names(List<Food> foods) {
        return foods.stream().map(Food::getName).toList();
    }

    // ---------- search: name ----------

    @Test
    void search_matchesPartOfNameIgnoringCaseSortedByName() {
        save("Haferflocken", alice, false);
        save("haferdrink", alice, false);
        save("Apfel", alice, false);

        assertThat(visibleToAlice("%hafer%")).containsExactly("haferdrink", "Haferflocken");
    }

    @Test
    void search_escapedWildcard_matchesItLiterally() {
        save("Quark 50% Fett", alice, false);
        save("Quark 500 g", alice, false);

        assertThat(visibleToAlice("%50!%%")).containsExactly("Quark 50% Fett");
    }

    // ---------- search: visibility and filters ----------

    @Test
    void search_withoutFilter_returnsOwnAndPublicButNotOthersPrivateFoods() {
        save("Alice privat", alice, false);
        save("Alice öffentlich", alice, true);
        save("Bob privat", bob, false);
        save("Bob öffentlich", bob, true);
        save("Ohne Besitzer", null, true);

        assertThat(visibleToAlice("%"))
                .containsExactlyInAnyOrder("Alice privat", "Alice öffentlich", "Bob öffentlich", "Ohne Besitzer");
    }

    @Test
    void search_ownOnly_returnsOwnPrivateAndPublicFoods() {
        save("Alice privat", alice, false);
        save("Alice öffentlich", alice, true);
        save("Bob öffentlich", bob, true);
        save("Ohne Besitzer", null, true);

        assertThat(names(repository.search(alice.getId(), "%", true, false, false)))
                .containsExactlyInAnyOrder("Alice privat", "Alice öffentlich");
    }

    @Test
    void search_publicOnly_returnsPublicFoodsOfEverybodyIncludingOwnAndOwnerless() {
        save("Alice privat", alice, false);
        save("Alice öffentlich", alice, true);
        save("Bob privat", bob, false);
        save("Bob öffentlich", bob, true);
        save("Ohne Besitzer", null, true);

        assertThat(names(repository.search(alice.getId(), "%", false, true, false)))
                .containsExactlyInAnyOrder("Alice öffentlich", "Bob öffentlich", "Ohne Besitzer");
    }

    @Test
    void search_confirmedOnly_returnsOnlyConfirmedVisibleFoods() {
        Food confirmed = save("Bestätigt", bob, true);
        confirmed.setConfirmed(true);
        Food hidden = save("Bestätigt, aber privat", bob, false);
        hidden.setConfirmed(true);
        save("Nicht bestätigt", bob, true);
        repository.flush();

        assertThat(names(repository.search(alice.getId(), "%", false, false, true)))
                .containsExactly("Bestätigt");
    }

    // ---------- usage checks (FoodService.delete and update) ----------

    @Test
    void usageChecks_distinguishOwnFromOthersMealsAndRecipes() {
        Food oats = save("Haferflocken", alice, true);
        Food milk = save("Milch", alice, true);
        Food apple = save("Apfel", alice, true);

        Meal aliceMeal = new Meal();
        aliceMeal.setUser(alice);
        aliceMeal.setTitle("Frühstück");
        aliceMeal.addItem(oats, 100);
        mealRepository.save(aliceMeal);

        Meal bobMeal = new Meal();
        bobMeal.setUser(bob);
        bobMeal.setTitle("Frühstück");
        bobMeal.addItem(milk, 200);
        mealRepository.save(bobMeal);

        Recipe bobRecipe = new Recipe();
        bobRecipe.setOwner(bob);
        bobRecipe.setName("Apfelmus");
        bobRecipe.setServings(2);
        bobRecipe.addItem(apple, 500);
        recipeRepository.saveAndFlush(bobRecipe);

        assertThat(mealItemRepository.existsByFoodId(oats.getId())).isTrue();
        assertThat(mealItemRepository.existsByFoodIdAndMealUserIdNot(oats.getId(), alice.getId())).isFalse();
        assertThat(mealItemRepository.existsByFoodIdAndMealUserIdNot(milk.getId(), alice.getId())).isTrue();
        assertThat(recipeItemRepository.existsByFoodId(apple.getId())).isTrue();
        assertThat(recipeItemRepository.existsByFoodIdAndRecipeOwnerIdNot(apple.getId(), alice.getId())).isTrue();
        assertThat(recipeItemRepository.existsByFoodIdAndRecipeOwnerIdNot(apple.getId(), bob.getId())).isFalse();
        assertThat(recipeItemRepository.existsByFoodId(oats.getId())).isFalse();
    }

    // ---------- basics ----------

    @Test
    void save_assignsGeneratedId() {
        Food saved = save("Apfel", alice, false);

        assertThat(saved.getId()).isNotNull();
        assertThat(repository.findById(saved.getId())).isPresent();
    }

    @Test
    void delete_foodStillUsedInMeal_isRejectedByDatabase() {
        // Why FoodService.delete checks usage first: meal_item.food_id references food with ON DELETE RESTRICT.
        Food oats = save("Haferflocken", alice, false);
        Meal meal = new Meal();
        meal.setTitle("Haferbrei");
        meal.addItem(oats, 100);
        mealRepository.saveAndFlush(meal);
        entityManager.clear();   // only the food is in the persistence context when it is deleted

        repository.delete(repository.findById(oats.getId()).orElseThrow());

        assertThatThrownBy(repository::flush)
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
