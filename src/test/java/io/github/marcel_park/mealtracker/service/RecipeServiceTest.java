package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.CatalogScope;
import io.github.marcel_park.mealtracker.dto.RecipeItemRequest;
import io.github.marcel_park.mealtracker.dto.RecipeItemResponse;
import io.github.marcel_park.mealtracker.dto.RecipeRequest;
import io.github.marcel_park.mealtracker.dto.RecipeResponse;
import io.github.marcel_park.mealtracker.dto.RecipeUseRequest;
import io.github.marcel_park.mealtracker.dto.VariationItemRequest;
import io.github.marcel_park.mealtracker.dto.VariationRequest;
import io.github.marcel_park.mealtracker.dto.VariationResponse;
import io.github.marcel_park.mealtracker.exception.ForbiddenException;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.Recipe;
import io.github.marcel_park.mealtracker.model.RecipeItem;
import io.github.marcel_park.mealtracker.model.RecipeVariation;
import io.github.marcel_park.mealtracker.model.RecipeVariationItem;
import io.github.marcel_park.mealtracker.model.User;
import io.github.marcel_park.mealtracker.repository.RecipeRepository;
import io.github.marcel_park.mealtracker.repository.RecipeVariationRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecipeServiceTest {

    @Mock
    private RecipeRepository recipeRepository;

    @Mock
    private RecipeVariationRepository variationRepository;

    @Mock
    private FoodService foodService;

    @Mock
    private UserRepository userRepository;

    private RecipeService service;

    private static final Long USER_ID = 7L;
    private final User me = user(USER_ID);
    private final User other = user(8L);

    private final Food beans = food(1L, "Kidneybohnen", 100.0);
    private final Food tomatoes = food(2L, "Tomaten", 20.0);
    private final Food mince = food(3L, "Hackfleisch", 250.0);

    @BeforeEach
    void setUp() {
        service = new RecipeService(recipeRepository, variationRepository, foodService, userRepository);
    }

    // ---------- test data ----------

    private static User user(Long id) {
        User user = new User();
        user.setId(id);
        return user;
    }

    private Food food(Long id, String name, double kcalPer100g) {
        Food food = new Food();
        food.setId(id);
        food.setName(name);
        food.setKcalPer100g(kcalPer100g);
        food.setOwner(me);
        return food;
    }

    private static Recipe recipe(Long id, User owner, boolean published) {
        Recipe recipe = new Recipe();
        recipe.setId(id);
        recipe.setOwner(owner);
        recipe.setName("Chili");
        recipe.setServings(4);
        recipe.setPublished(published);
        return recipe;
    }

    private static RecipeItemRequest item(Long foodId, double amountG) {
        return new RecipeItemRequest(foodId, amountG);
    }

    private static RecipeRequest request(boolean published, RecipeItemRequest... items) {
        return new RecipeRequest("Chili", 4.0, published, List.of(items));
    }

    private void stubFoods() {
        when(foodService.getVisibleEntity(USER_ID, 1L)).thenReturn(beans);
        when(foodService.getVisibleEntity(USER_ID, 2L)).thenReturn(tomatoes);
    }

    private void stubFind(Recipe recipe) {
        when(recipeRepository.findById(recipe.getId())).thenReturn(Optional.of(recipe));
    }

    // ---------- find and get ----------

    @Nested
    class FindAndGet {

        @Test
        void find_passesScopeFlagsAndMapsTotals() {
            Recipe chili = recipe(1L, me, false);
            chili.addItem(beans, 400);     // 400 kcal
            chili.addItem(tomatoes, 500);  // 100 kcal
            when(recipeRepository.search(USER_ID, "%chili%", true, false, false)).thenReturn(List.of(chili));

            RecipeResponse result = service.find(USER_ID, "Chili", CatalogScope.OWN).get(0);

            assertThat(result.name()).isEqualTo("Chili");
            assertThat(result.servings()).isEqualTo(4.0);
            assertThat(result.owned()).isTrue();
            assertThat(result.published()).isFalse();
            assertThat(result.amountG()).isEqualTo(900.0);
            assertThat(result.kcal()).isEqualTo(500.0);
            assertThat(result.items())
                    .extracting(i -> i.food().id(), RecipeItemResponse::amountG, RecipeItemResponse::kcal)
                    .containsExactly(tuple(1L, 400.0, 400.0), tuple(2L, 500.0, 100.0));
        }

        @Test
        void get_publicRecipeOfOtherUser_isReturnedAsNotOwned() {
            stubFind(recipe(1L, other, true));

            assertThat(service.get(USER_ID, 1L).owned()).isFalse();
        }

        @Test
        void get_privateRecipeOfOtherUser_isReportedAsNotFound() {
            stubFind(recipe(1L, other, false));

            assertThatThrownBy(() -> service.get(USER_ID, 1L))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("Recipe with id 1 not found");
        }
    }

    // ---------- create ----------

    @Nested
    class Create {

        @Test
        void savesRecipeOfCallerWithSummedItemsInRequestOrder() {
            when(userRepository.getReferenceById(USER_ID)).thenReturn(me);
            stubFoods();
            when(recipeRepository.save(any(Recipe.class))).thenAnswer(inv -> inv.getArgument(0));

            service.create(USER_ID, request(false, item(2L, 300), item(1L, 400), item(2L, 200)));

            ArgumentCaptor<Recipe> captor = ArgumentCaptor.forClass(Recipe.class);
            verify(recipeRepository).save(captor.capture());
            Recipe saved = captor.getValue();
            assertThat(saved.getOwner()).isSameAs(me);
            assertThat(saved.getName()).isEqualTo("Chili");
            assertThat(saved.getServings()).isEqualTo(4.0);
            assertThat(saved.isPublished()).isFalse();
            assertThat(saved.getItems())
                    .extracting(RecipeItem::getFood, RecipeItem::getAmountG)
                    .containsExactly(tuple(tomatoes, 500.0), tuple(beans, 400.0));
        }

        @Test
        void privateRecipe_leavesFoodsAlone() {
            when(userRepository.getReferenceById(USER_ID)).thenReturn(me);
            stubFoods();
            when(recipeRepository.save(any(Recipe.class))).thenAnswer(inv -> inv.getArgument(0));

            service.create(USER_ID, request(false, item(1L, 400), item(2L, 500)));

            verify(foodService, never()).publishOwned(anyLong(), any());
        }

        @Test
        void publicRecipe_publishesItsFoods() {
            when(userRepository.getReferenceById(USER_ID)).thenReturn(me);
            stubFoods();
            when(recipeRepository.save(any(Recipe.class))).thenAnswer(inv -> inv.getArgument(0));

            service.create(USER_ID, request(true, item(1L, 400), item(2L, 500)));

            verify(foodService).publishOwned(USER_ID, beans);
            verify(foodService).publishOwned(USER_ID, tomatoes);
        }

        @Test
        void foodTheCallerCannotSee_throwsNotFoundAndSavesNothing() {
            when(userRepository.getReferenceById(USER_ID)).thenReturn(me);
            when(foodService.getVisibleEntity(USER_ID, 99L)).thenThrow(new NotFoundException("Food", 99L));

            assertThatThrownBy(() -> service.create(USER_ID, request(false, item(99L, 100))))
                    .isInstanceOf(NotFoundException.class);

            verify(recipeRepository, never()).save(any());
        }
    }

    // ---------- update ----------

    @Nested
    class Update {

        @Test
        void keepsChangesAddsAndRemovesItems() {
            Recipe chili = recipe(1L, me, false);
            chili.addItem(beans, 400);
            chili.addItem(tomatoes, 500);
            stubFind(chili);
            when(foodService.getVisibleEntity(USER_ID, 3L)).thenReturn(mince);

            RecipeResponse result = service.update(USER_ID, 1L,
                    new RecipeRequest("Chili con carne", 6.0, false, List.of(item(2L, 800), item(3L, 500))));

            assertThat(chili.getName()).isEqualTo("Chili con carne");
            assertThat(chili.getServings()).isEqualTo(6.0);
            assertThat(chili.getItems())
                    .extracting(RecipeItem::getFood, RecipeItem::getAmountG)
                    .containsExactly(tuple(tomatoes, 800.0), tuple(mince, 500.0));
            assertThat(result.amountG()).isEqualTo(1300.0);
            // kept items need no lookup
            verify(foodService, never()).getVisibleEntity(USER_ID, 2L);
        }

        @Test
        void publishing_publishesItsFoods() {
            Recipe chili = recipe(1L, me, false);
            chili.addItem(beans, 400);
            stubFind(chili);

            service.update(USER_ID, 1L, request(true, item(1L, 400)));

            assertThat(chili.isPublished()).isTrue();
            verify(foodService).publishOwned(USER_ID, beans);
        }

        @Test
        void makingPrivate_leavesFoodsPublic() {
            Recipe chili = recipe(1L, me, true);
            chili.addItem(beans, 400);
            stubFind(chili);

            service.update(USER_ID, 1L, request(false, item(1L, 400)));

            assertThat(chili.isPublished()).isFalse();
            verify(foodService, never()).publishOwned(anyLong(), any());
        }

        @Test
        void publicRecipeOfOtherUser_isForbidden() {
            Recipe chili = recipe(1L, other, true);
            chili.addItem(beans, 400);
            stubFind(chili);

            assertThatThrownBy(() -> service.update(USER_ID, 1L, request(true, item(1L, 1))))
                    .isInstanceOf(ForbiddenException.class);

            assertThat(chili.getItems()).extracting(RecipeItem::getAmountG).containsExactly(400.0);
        }

        @Test
        void privateRecipeOfOtherUser_isReportedAsNotFound() {
            stubFind(recipe(1L, other, false));

            assertThatThrownBy(() -> service.update(USER_ID, 1L, request(false, item(1L, 1))))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    // ---------- delete ----------

    @Nested
    class Delete {

        @Test
        void ownPublicRecipe_isDeletedForEverybody() {
            Recipe chili = recipe(1L, me, true);
            stubFind(chili);

            service.delete(USER_ID, 1L);

            verify(recipeRepository).delete(chili);
        }

        @Test
        void recipeOfOtherUser_isForbiddenAndDeletesNothing() {
            stubFind(recipe(1L, other, true));

            assertThatThrownBy(() -> service.delete(USER_ID, 1L))
                    .isInstanceOf(ForbiddenException.class);

            verify(recipeRepository, never()).delete(any());
        }
    }

    // ---------- variations ----------

    private static RecipeVariation variation(Long id, Recipe recipe, String name) {
        RecipeVariation variation = new RecipeVariation();
        variation.setId(id);
        variation.setRecipe(recipe);
        variation.setName(name);
        recipe.getVariations().add(variation);
        return variation;
    }

    private static VariationItemRequest change(Long foodId, double amountG) {
        return new VariationItemRequest(foodId, amountG);
    }

    // Chili of the caller: 400 g beans, 500 g tomatoes, 4 servings.
    private Recipe ownChili() {
        Recipe chili = recipe(1L, me, false);
        chili.addItem(beans, 400);
        chili.addItem(tomatoes, 500);
        return chili;
    }

    @Nested
    class Variations {

        @Test
        void create_storesOnlyWhatDiffersFromTheOriginal() {
            Recipe chili = ownChili();
            stubFind(chili);
            when(foodService.getVisibleEntity(USER_ID, 1L)).thenReturn(beans);
            when(foodService.getVisibleEntity(USER_ID, 3L)).thenReturn(mince);
            when(variationRepository.save(any(RecipeVariation.class))).thenAnswer(inv -> {
                RecipeVariation saved = inv.getArgument(0);
                saved.setId(9L);
                return saved;
            });

            // beans changed, tomatoes as in the original, mince added; servings as in the original
            VariationResponse result = service.createVariation(USER_ID, 1L, new VariationRequest(
                    "Mehr Bohnen", 4.0, 1800.0,
                    List.of(change(1L, 600), change(2L, 500), change(3L, 200))));

            RecipeVariation saved = chili.getVariations().get(0);
            assertThat(saved.getRecipe()).isSameAs(chili);
            assertThat(saved.getName()).isEqualTo("Mehr Bohnen");
            assertThat(saved.getServings()).isNull();
            assertThat(saved.getWeightG()).isEqualTo(1800.0);
            assertThat(saved.getItems())
                    .extracting(RecipeVariationItem::getFood, RecipeVariationItem::getAmountG)
                    .containsExactly(tuple(beans, 600.0), tuple(mince, 200.0));
            assertThat(result.id()).isEqualTo(9L);
            assertThat(result.items()).extracting(i -> i.food().id()).containsExactly(1L, 3L);
        }

        @Test
        void create_leftOutIngredientIsStoredWithZeroAndOtherServingsAreKept() {
            Recipe chili = ownChili();
            stubFind(chili);
            when(foodService.getVisibleEntity(USER_ID, 2L)).thenReturn(tomatoes);
            when(variationRepository.save(any(RecipeVariation.class))).thenAnswer(inv -> inv.getArgument(0));

            service.createVariation(USER_ID, 1L,
                    new VariationRequest("Ohne Tomaten", 3.0, null, List.of(change(2L, 0))));

            RecipeVariation saved = chili.getVariations().get(0);
            assertThat(saved.getServings()).isEqualTo(3.0);
            assertThat(saved.getWeightG()).isNull();
            assertThat(saved.getItems())
                    .extracting(RecipeVariationItem::getFood, RecipeVariationItem::getAmountG)
                    .containsExactly(tuple(tomatoes, 0.0));
        }

        @Test
        void create_onRecipeOfOtherUser_isForbidden() {
            Recipe bobs = recipe(1L, other, true);
            bobs.addItem(beans, 400);
            stubFind(bobs);

            assertThatThrownBy(() -> service.createVariation(USER_ID, 1L,
                    new VariationRequest("Meine", null, null, List.of(change(1L, 500)))))
                    .isInstanceOf(ForbiddenException.class);

            assertThat(bobs.getVariations()).isEmpty();
            verify(variationRepository, never()).save(any());
        }

        @Test
        void update_changesItemsInPlaceAndDropsAmountsEqualToTheOriginal() {
            Recipe chili = ownChili();
            RecipeVariation moreBeans = variation(9L, chili, "Mehr Bohnen");
            moreBeans.addItem(beans, 600);
            stubFind(chili);
            when(foodService.getVisibleEntity(USER_ID, 2L)).thenReturn(tomatoes);

            service.updateVariation(USER_ID, 1L, 9L, new VariationRequest(
                    "Ohne Tomaten", null, null, List.of(change(1L, 400), change(2L, 0))));

            assertThat(moreBeans.getName()).isEqualTo("Ohne Tomaten");
            assertThat(moreBeans.getItems())
                    .extracting(RecipeVariationItem::getFood, RecipeVariationItem::getAmountG)
                    .containsExactly(tuple(tomatoes, 0.0));
        }

        @Test
        void overwritingTheOriginal_keepsVariationsWithTheirOwnAmounts() {
            Recipe chili = ownChili();
            RecipeVariation moreBeans = variation(9L, chili, "Mehr Bohnen");
            moreBeans.addItem(beans, 600);
            chili.setLastUsedVariationId(9L);
            stubFind(chili);

            // beans 400 -> 450, tomatoes 500 -> 300
            service.update(USER_ID, 1L, new RecipeRequest("Chili", 4.0, false,
                    List.of(new RecipeItemRequest(1L, 450), new RecipeItemRequest(2L, 300))));

            assertThat(chili.getVariations()).containsExactly(moreBeans);
            assertThat(moreBeans.getItems())
                    .extracting(RecipeVariationItem::getFood, RecipeVariationItem::getAmountG)
                    .containsExactly(tuple(beans, 600.0));
            assertThat(chili.getLastUsedVariationId()).isEqualTo(9L);
        }

        @Test
        void update_unknownVariation_throwsNotFound() {
            stubFind(ownChili());

            assertThatThrownBy(() -> service.updateVariation(USER_ID, 1L, 99L,
                    new VariationRequest("X", null, null, List.of())))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("Variation with id 99 not found");
        }

        @Test
        void delete_removesItAndFallsBackToTheOriginalForThePreselection() {
            Recipe chili = ownChili();
            variation(9L, chili, "Mehr Bohnen");
            RecipeVariation spicy = variation(10L, chili, "Scharf");
            chili.setLastUsedVariationId(9L);
            stubFind(chili);

            service.deleteVariation(USER_ID, 1L, 9L);

            assertThat(chili.getVariations()).containsExactly(spicy);
            assertThat(chili.getLastUsedVariationId()).isNull();
        }

        @Test
        void responses_showVariationsOnlyToTheOwner() {
            Recipe bobs = recipe(1L, other, true);
            bobs.addItem(beans, 400);
            variation(9L, bobs, "Bobs Geheimnis");
            bobs.setLastUsedVariationId(9L);
            stubFind(bobs);

            RecipeResponse result = service.get(USER_ID, 1L);

            assertThat(result.variations()).isEmpty();
            assertThat(result.lastUsedVariationId()).isNull();
        }

        @Test
        void responses_showOwnVariationsAndTheLastUsedOne() {
            Recipe chili = ownChili();
            variation(9L, chili, "Mehr Bohnen").addItem(beans, 600);
            chili.setLastUsedVariationId(9L);
            stubFind(chili);

            RecipeResponse result = service.get(USER_ID, 1L);

            assertThat(result.variations()).extracting(VariationResponse::name).containsExactly("Mehr Bohnen");
            assertThat(result.variations().get(0).items()).extracting(i -> i.amountG()).containsExactly(600.0);
            assertThat(result.lastUsedVariationId()).isEqualTo(9L);
        }
    }

    // ---------- markUsed ----------

    @Nested
    class MarkUsed {

        @Test
        void ownRecipe_remembersTheVariation() {
            Recipe chili = ownChili();
            variation(9L, chili, "Mehr Bohnen");
            stubFind(chili);

            service.markUsed(USER_ID, List.of(new RecipeUseRequest(1L, 9L)));

            assertThat(chili.getLastUsedVariationId()).isEqualTo(9L);
        }

        @Test
        void bookingTheOriginalAgain_resetsThePreselection() {
            Recipe chili = ownChili();
            variation(9L, chili, "Mehr Bohnen");
            chili.setLastUsedVariationId(9L);
            stubFind(chili);

            service.markUsed(USER_ID, List.of(new RecipeUseRequest(1L, null)));

            assertThat(chili.getLastUsedVariationId()).isNull();
        }

        @Test
        void recipeOfOtherUser_isIgnored() {
            Recipe bobs = recipe(1L, other, true);
            variation(9L, bobs, "Bobs Geheimnis");
            stubFind(bobs);

            service.markUsed(USER_ID, List.of(new RecipeUseRequest(1L, 9L)));

            assertThat(bobs.getLastUsedVariationId()).isNull();
        }

        @Test
        void unknownVariationOrDeletedRecipe_isIgnored() {
            Recipe chili = ownChili();
            stubFind(chili);
            when(recipeRepository.findById(2L)).thenReturn(Optional.empty());

            service.markUsed(USER_ID, List.of(new RecipeUseRequest(1L, 99L), new RecipeUseRequest(2L, null)));

            assertThat(chili.getLastUsedVariationId()).isNull();
        }

        @Test
        void withoutRecipes_doesNothing() {
            service.markUsed(USER_ID, null);

            verify(recipeRepository, never()).findById(any());
        }
    }
}
