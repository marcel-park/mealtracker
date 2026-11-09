package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.Recipe;
import io.github.marcel_park.mealtracker.model.RecipeVariation;
import io.github.marcel_park.mealtracker.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
class RecipeRepositoryTest {

    @Autowired
    private RecipeRepository repository;

    @Autowired
    private FoodRepository foodRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RecipeVariationRepository variationRepository;

    @Autowired
    private RecipeVariationItemRepository variationItemRepository;

    private User alice;
    private User bob;
    private Food beans;

    @BeforeEach
    void setUp() {
        alice = saveUser("alice@example.com");
        bob = saveUser("bob@example.com");
        beans = saveFood("Kidneybohnen", alice);
    }

    // ---------- helpers ----------

    private User saveUser(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("{bcrypt}not-a-real-hash");
        return userRepository.save(user);
    }

    private Food saveFood(String name, User owner) {
        Food food = new Food();
        food.setName(name);
        food.setOwner(owner);
        food.setPublished(true);
        food.setKcalPer100g(100);
        return foodRepository.save(food);
    }

    private Recipe save(String name, User owner, boolean published, Food... foods) {
        Recipe recipe = new Recipe();
        recipe.setName(name);
        recipe.setOwner(owner);
        recipe.setServings(4);
        recipe.setPublished(published);
        for (Food food : foods) {
            recipe.addItem(food, 100);
        }
        return repository.saveAndFlush(recipe);
    }

    private List<String> search(User user, boolean ownOnly, boolean publicOnly) {
        return repository.search(user.getId(), "%", ownOnly, publicOnly, false).stream()
                .map(Recipe::getName)
                .toList();
    }

    // ---------- search ----------

    @Test
    void search_withoutFilter_returnsOwnAndPublicRecipes() {
        save("Alice privat", alice, false);
        save("Alice öffentlich", alice, true);
        save("Bob privat", bob, false);
        save("Bob öffentlich", bob, true);

        assertThat(search(alice, false, false))
                .containsExactlyInAnyOrder("Alice öffentlich", "Alice privat", "Bob öffentlich");
    }

    @Test
    void search_ownOnly_returnsOwnRecipes() {
        save("Alice privat", alice, false);
        save("Alice öffentlich", alice, true);
        save("Bob öffentlich", bob, true);

        assertThat(search(alice, true, false)).containsExactlyInAnyOrder("Alice öffentlich", "Alice privat");
    }

    @Test
    void search_publicOnly_returnsPublicRecipesOfEverybody() {
        save("Alice privat", alice, false);
        save("Alice öffentlich", alice, true);
        save("Bob privat", bob, false);
        save("Bob öffentlich", bob, true);

        assertThat(search(alice, false, true)).containsExactlyInAnyOrder("Alice öffentlich", "Bob öffentlich");
    }

    @Test
    void search_matchesPartOfNameIgnoringCase() {
        save("Chili con Carne", alice, false);
        save("Linsensuppe", alice, false);

        assertThat(repository.search(alice.getId(), "%carne%", false, false, false))
                .extracting(Recipe::getName)
                .containsExactly("Chili con Carne");
    }

    // ---------- findPublishedByOwnerContainingFood ----------

    @Test
    void findPublishedByOwnerContainingFood_onlyReturnsTheOwnersPublicRecipesWithThatFood() {
        Food rice = saveFood("Reis", alice);
        save("Chili öffentlich", alice, true, beans, rice);
        save("Chili privat", alice, false, beans);
        save("Reis öffentlich", alice, true, rice);
        save("Bobs Chili", bob, true, beans);

        assertThat(repository.findPublishedByOwnerContainingFood(alice.getId(), beans.getId()))
                .extracting(Recipe::getName)
                .containsExactly("Chili öffentlich");
    }

    @Test
    void deletingRecipe_removesItsItemsButNotTheFoods() {
        Recipe chili = save("Chili", alice, false, beans);

        repository.delete(chili);
        repository.flush();

        assertThat(repository.findById(chili.getId())).isEmpty();
        assertThat(foodRepository.findById(beans.getId())).isPresent();
    }

    // ---------- variations ----------

    @Test
    void variationUsageChecks_seeFoodsOnlyTheVariationContains() {
        // FoodService.delete and update rely on these: a food only in a variation is still in use.
        Food rice = saveFood("Reis", bob);
        Recipe chili = save("Chili", alice, false, beans);
        RecipeVariation withRice = new RecipeVariation();
        withRice.setRecipe(chili);
        withRice.setName("Mit Reis");
        withRice.addItem(rice, 200);
        chili.getVariations().add(withRice);
        variationRepository.saveAndFlush(withRice);   // as RecipeService.createVariation does

        assertThat(variationItemRepository.existsByFoodId(rice.getId())).isTrue();
        assertThat(variationItemRepository.existsByFoodId(beans.getId())).isFalse();
        // the variation belongs to alice (owner of the recipe), so for bob it is "somebody else"
        assertThat(variationItemRepository.existsByFoodIdAndVariationRecipeOwnerIdNot(rice.getId(), bob.getId())).isTrue();
        assertThat(variationItemRepository.existsByFoodIdAndVariationRecipeOwnerIdNot(rice.getId(), alice.getId())).isFalse();
    }

    @Test
    void deletingRecipe_deletesItsVariationsEvenThePreselectedOne() {
        Recipe chili = save("Chili", alice, false, beans);
        RecipeVariation moreBeans = new RecipeVariation();
        moreBeans.setRecipe(chili);
        moreBeans.setName("Mehr Bohnen");
        moreBeans.addItem(beans, 600);
        chili.getVariations().add(moreBeans);
        variationRepository.saveAndFlush(moreBeans);
        chili.setLastUsedVariationId(moreBeans.getId());
        repository.flush();

        repository.delete(chili);
        repository.flush();

        assertThat(repository.findById(chili.getId())).isEmpty();
        assertThat(variationItemRepository.existsByFoodId(beans.getId())).isFalse();
        assertThat(foodRepository.findById(beans.getId())).isPresent();
    }
}
