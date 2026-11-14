package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.CatalogScope;
import io.github.marcel_park.mealtracker.dto.FoodPortionRequest;
import io.github.marcel_park.mealtracker.dto.FoodPortionResponse;
import io.github.marcel_park.mealtracker.dto.FoodRequest;
import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.exception.ForbiddenException;
import io.github.marcel_park.mealtracker.exception.InvalidRequestException;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.FoodPortion;
import io.github.marcel_park.mealtracker.model.FoodUnit;
import io.github.marcel_park.mealtracker.model.Meal;
import io.github.marcel_park.mealtracker.model.MealItem;
import io.github.marcel_park.mealtracker.model.Quantity;
import io.github.marcel_park.mealtracker.model.Recipe;
import io.github.marcel_park.mealtracker.model.RecipeItem;
import io.github.marcel_park.mealtracker.model.ShoppingListItem;
import io.github.marcel_park.mealtracker.model.User;
import io.github.marcel_park.mealtracker.repository.FoodRepository;
import io.github.marcel_park.mealtracker.repository.MealItemRepository;
import io.github.marcel_park.mealtracker.repository.RecipeItemRepository;
import io.github.marcel_park.mealtracker.repository.RecipeRepository;
import io.github.marcel_park.mealtracker.repository.RecipeVariationItemRepository;
import io.github.marcel_park.mealtracker.repository.ShoppingListItemRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FoodServiceTest {

    @Mock
    private FoodRepository repository;

    @Mock
    private MealItemRepository mealItemRepository;

    @Mock
    private RecipeItemRepository recipeItemRepository;

    @Mock
    private RecipeVariationItemRepository variationItemRepository;

    @Mock
    private ShoppingListItemRepository shoppingListItemRepository;

    @Mock
    private RecipeRepository recipeRepository;

    @Mock
    private UserRepository userRepository;

    private FoodService service;

    // The logged-in user on whose behalf every call is made, and somebody else.
    private static final Long USER_ID = 7L;
    private final User me = user(USER_ID);
    private final User other = user(8L);

    @BeforeEach
    void setUp() {
        service = new FoodService(repository, mealItemRepository, recipeItemRepository,
                variationItemRepository, shoppingListItemRepository, recipeRepository, userRepository);
    }

    // ---------- test data ----------

    private static User user(Long id) {
        User user = new User();
        user.setId(id);
        return user;
    }

    private static Food food(Long id, String name, User owner, boolean published) {
        Food f = new Food();
        f.setId(id);
        f.setName(name);
        f.setOwner(owner);
        f.setPublished(published);
        f.setKcalPer100(372);
        f.setProtein(13.5);
        f.setCarbs(58.7);
        f.setFat(7);
        return f;
    }

    private static FoodRequest request(String name, boolean published) {
        return new FoodRequest(name, FoodUnit.G, 372.0, 13.5, 58.7, 7.0, published, List.of());
    }

    private static FoodRequest request(FoodUnit unit, List<FoodPortionRequest> portions) {
        return new FoodRequest("Haferflocken", unit, 372.0, 13.5, 58.7, 7.0, false, portions);
    }

    // A portion as already saved, with the id the database would have given it.
    private static FoodPortion savedPortion(Food food, Long id, String name, double amount, boolean favorite) {
        FoodPortion portion = food.addPortion(name, amount, favorite);
        ReflectionTestUtils.setField(portion, "id", id);
        return portion;
    }

    private static FoodPortionRequest newPortion(String name, double amount, boolean favorite) {
        return new FoodPortionRequest(null, name, amount, favorite);
    }

    private void stubFind(Food food) {
        when(repository.findById(food.getId())).thenReturn(Optional.of(food));
    }

    private void stubSaveReturnsArgument() {
        when(repository.saveAndFlush(any(Food.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    // ---------- find ----------

    @Nested
    class Find {

        @Test
        void withoutScope_searchesEverythingVisibleWithEscapedPattern() {
            when(repository.search(USER_ID, "%50!% fett%", false, false, false))
                    .thenReturn(List.of(food(1L, "Quark 50% Fett", me, false)));

            List<FoodResponse> result = service.find(USER_ID, " 50% Fett ", null, false);

            assertThat(result).extracting(FoodResponse::name).containsExactly("Quark 50% Fett");
        }

        @Test
        void withoutQuery_matchesEveryName() {
            service.find(USER_ID, "  ", null, false);

            verify(repository).search(USER_ID, "%", false, false, false);
        }

        @Test
        void ownScope_setsOnlyOwnFlag() {
            service.find(USER_ID, "hafer", CatalogScope.OWN, false);

            verify(repository).search(USER_ID, "%hafer%", true, false, false);
        }

        @Test
        void publicScope_setsOnlyPublicFlag() {
            service.find(USER_ID, null, CatalogScope.PUBLIC, false);

            verify(repository).search(USER_ID, "%", false, true, false);
        }

        @Test
        void confirmedOnly_setsOnlyConfirmedFlag() {
            service.find(USER_ID, null, null, true);

            verify(repository).search(USER_ID, "%", false, false, true);
        }

        @Test
        void confirmedOnly_combinesWithScope() {
            service.find(USER_ID, null, CatalogScope.OWN, true);

            verify(repository).search(USER_ID, "%", true, false, true);
        }

        @Test
        void mapsOwnershipAndVisibilityFromTheCallersPointOfView() {
            when(repository.search(USER_ID, "%", false, false, false)).thenReturn(List.of(
                    food(1L, "Mein Brot", me, false),
                    food(2L, "Fremdes Brot", other, true),
                    food(3L, "Altes Brot", null, false)));

            List<FoodResponse> result = service.find(USER_ID, null, null, false);

            assertThat(result)
                    .extracting(FoodResponse::owned, FoodResponse::published)
                    .containsExactly(
                            tuple(true, false),
                            tuple(false, true),
                            // without owner a food is always public
                            tuple(false, true));
        }

        @Test
        void marksFoodsUsedInAMealRecipeVariationOrShoppingList_withOneQueryPerKindForTheWholeList() {
            when(repository.search(USER_ID, "%", false, false, false)).thenReturn(List.of(
                    food(1L, "Brot", me, false),
                    food(2L, "Milch", me, false),
                    food(3L, "Quark", me, false),
                    food(4L, "Butter", me, false),
                    food(5L, "Käse", me, false)));
            List<Long> ids = List.of(1L, 2L, 3L, 4L, 5L);
            when(mealItemRepository.findUsedFoodIds(ids)).thenReturn(Set.of(1L));
            when(recipeItemRepository.findUsedFoodIds(ids)).thenReturn(Set.of(2L));
            when(variationItemRepository.findUsedFoodIds(ids)).thenReturn(Set.of(3L));
            when(shoppingListItemRepository.findUsedFoodIds(ids)).thenReturn(Set.of(5L));

            List<FoodResponse> result = service.find(USER_ID, null, null, false);

            assertThat(result).extracting(FoodResponse::used).containsExactly(true, true, true, false, true);
            verify(mealItemRepository, never()).existsByFoodId(anyLong());
        }

        @Test
        void emptyResult_doesNotAskWhichFoodsAreUsed() {
            when(repository.search(USER_ID, "%", false, false, false)).thenReturn(List.of());

            assertThat(service.find(USER_ID, null, null, false)).isEmpty();

            verifyNoInteractions(mealItemRepository, recipeItemRepository, variationItemRepository,
                    shoppingListItemRepository);
        }
    }

    // ---------- get ----------

    @Nested
    class Get {

        @Test
        void ownPrivateFood_isReturned() {
            stubFind(food(1L, "Haferflocken", me, false));

            FoodResponse result = service.get(USER_ID, 1L);

            assertThat(result.name()).isEqualTo("Haferflocken");
            assertThat(result.owned()).isTrue();
            assertThat(result.published()).isFalse();
        }

        @Test
        void publicFoodOfOtherUser_isReturnedAsNotOwned() {
            stubFind(food(1L, "Haferflocken", other, true));

            FoodResponse result = service.get(USER_ID, 1L);

            assertThat(result.owned()).isFalse();
        }

        @Test
        void privateFoodOfOtherUser_isReportedAsNotFound() {
            stubFind(food(1L, "Haferflocken", other, false));

            assertThatThrownBy(() -> service.get(USER_ID, 1L))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessageContaining("1");
        }

        @Test
        void missingId_throwsNotFound() {
            when(repository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.get(USER_ID, 999L))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessageContaining("999");
        }
    }

    // ---------- create ----------

    @Nested
    class Create {

        @Test
        void belongsToCallerWithRequestedValuesAndVisibility() {
            when(userRepository.getReferenceById(USER_ID)).thenReturn(me);
            stubSaveReturnsArgument();

            service.create(USER_ID, request("Haferflocken", true));

            ArgumentCaptor<Food> captor = ArgumentCaptor.forClass(Food.class);
            verify(repository).saveAndFlush(captor.capture());
            Food passed = captor.getValue();
            assertThat(passed.getId()).isNull();
            assertThat(passed.getOwner()).isSameAs(me);
            assertThat(passed)
                    .extracting(Food::getName, Food::getKcalPer100, Food::getProtein, Food::getCarbs,
                            Food::getFat, Food::isPublished, Food::isConfirmed)
                    .containsExactly("Haferflocken", 372.0, 13.5, 58.7, 7.0, true, false);
        }

        @Test
        void returnsResponseWithIdFromRepository() {
            when(userRepository.getReferenceById(USER_ID)).thenReturn(me);
            when(repository.saveAndFlush(any(Food.class))).thenAnswer(inv -> {
                Food saved = inv.getArgument(0);
                saved.setId(42L);
                return saved;
            });

            FoodResponse result = service.create(USER_ID, request("Haferflocken", false));

            assertThat(result.id()).isEqualTo(42L);
            assertThat(result.owned()).isTrue();
            assertThat(result.published()).isFalse();
        }
    }

    // ---------- update ----------

    @Nested
    class Update {

        @Test
        void ownFood_overwritesAllFields() {
            Food existing = food(1L, "Haferflocken", me, false);
            stubFind(existing);
            stubSaveReturnsArgument();

            FoodResponse result = service.update(USER_ID, 1L,
                    new FoodRequest("Haferflocken zart", FoodUnit.G, 370.0, 13.0, 59.0, 6.5, false, List.of()));

            assertThat(existing)
                    .extracting(Food::getName, Food::getKcalPer100, Food::getProtein, Food::getCarbs, Food::getFat)
                    .containsExactly("Haferflocken zart", 370.0, 13.0, 59.0, 6.5);
            assertThat(result).isEqualTo(
                    new FoodResponse(1L, "Haferflocken zart", FoodUnit.G, 370.0, 13.0, 59.0, 6.5, List.of(), true, false, false, false));
        }

        @Test
        void ownPublicFoodStayingPublic_isChangedInPlaceEvenIfOthersUseIt() {
            // Changes to public foods reach everybody who uses them: no check for use by others.
            Food existing = food(1L, "Haferflocken", me, true);
            stubFind(existing);
            stubSaveReturnsArgument();

            FoodResponse result = service.update(USER_ID, 1L, request("Haferflocken grob", true));

            assertThat(result.id()).isEqualTo(1L);
            assertThat(existing.getName()).isEqualTo("Haferflocken grob");
            verify(mealItemRepository, never()).existsByFoodIdAndMealUserIdNot(anyLong(), anyLong());
            verify(recipeItemRepository, never()).existsByFoodIdAndRecipeOwnerIdNot(anyLong(), anyLong());
        }

        @Test
        void makingPrivateFoodPublic_publishesIt() {
            Food existing = food(1L, "Haferflocken", me, false);
            stubFind(existing);
            stubSaveReturnsArgument();

            service.update(USER_ID, 1L, request("Haferflocken", true));

            assertThat(existing.isPublished()).isTrue();
        }

        @Test
        void makingPublicFoodPrivate_notUsedByOthers_makesItAndOwnPublicRecipesPrivate() {
            Food existing = food(1L, "Haferflocken", me, true);
            stubFind(existing);
            stubSaveReturnsArgument();
            Recipe porridge = new Recipe();
            porridge.setPublished(true);
            when(recipeRepository.findPublishedByOwnerContainingFood(USER_ID, 1L)).thenReturn(List.of(porridge));

            FoodResponse result = service.update(USER_ID, 1L, request("Haferflocken", false));

            assertThat(result.id()).isEqualTo(1L);
            assertThat(existing.getOwner()).isSameAs(me);
            assertThat(existing.isPublished()).isFalse();
            assertThat(porridge.isPublished()).isFalse();
        }

        @Test
        void makingPublicFoodPrivate_usedInMealOfOther_keepsOriginalAndReturnsPrivateCopy() {
            Food existing = food(1L, "Haferflocken", me, true);
            stubFind(existing);
            when(mealItemRepository.existsByFoodIdAndMealUserIdNot(1L, USER_ID)).thenReturn(true);
            when(repository.saveAndFlush(any(Food.class))).thenAnswer(inv -> {
                Food saved = inv.getArgument(0);
                saved.setId(2L);
                return saved;
            });

            FoodResponse result = service.update(USER_ID, 1L,
                    new FoodRequest("Haferflocken", FoodUnit.G, 380.0, 13.5, 58.7, 7.0, false, List.of()));

            // The original stays exactly as the others know it, public and without owner
            assertThat(existing.getOwner()).isNull();
            assertThat(existing.isPublic()).isTrue();
            assertThat(existing.getKcalPer100()).isEqualTo(372.0);

            // The owner continues with a private copy carrying the requested values
            ArgumentCaptor<Food> captor = ArgumentCaptor.forClass(Food.class);
            verify(repository).saveAndFlush(captor.capture());
            Food copy = captor.getValue();
            assertThat(copy).isNotSameAs(existing);
            assertThat(copy.getOwner()).isSameAs(me);
            assertThat(copy.isPublished()).isFalse();
            assertThat(copy.getKcalPer100()).isEqualTo(380.0);
            assertThat(result.id()).isEqualTo(2L);
            assertThat(result.owned()).isTrue();
            assertThat(result.published()).isFalse();
            verifyNoInteractions(recipeRepository);
        }

        @Test
        void makingPublicFoodPrivate_usedInRecipeOfOther_keepsOriginalAndReturnsPrivateCopy() {
            Food existing = food(1L, "Haferflocken", me, true);
            stubFind(existing);
            when(recipeItemRepository.existsByFoodIdAndRecipeOwnerIdNot(1L, USER_ID)).thenReturn(true);
            stubSaveReturnsArgument();

            FoodResponse result = service.update(USER_ID, 1L, request("Haferflocken", false));

            assertThat(existing.getOwner()).isNull();
            assertThat(existing.isPublic()).isTrue();
            assertThat(result.owned()).isTrue();
            assertThat(result.published()).isFalse();
        }

        @Test
        void makingPublicFoodPrivate_usedInVariationOfOther_keepsOriginalAndReturnsPrivateCopy() {
            Food existing = food(1L, "Haferflocken", me, true);
            stubFind(existing);
            when(variationItemRepository.existsByFoodIdAndVariationRecipeOwnerIdNot(1L, USER_ID)).thenReturn(true);
            stubSaveReturnsArgument();

            FoodResponse result = service.update(USER_ID, 1L, request("Haferflocken", false));

            assertThat(existing.getOwner()).isNull();
            assertThat(result.published()).isFalse();
        }

        @Test
        void makingPublicFoodPrivate_onShoppingListOfOther_keepsOriginalAndReturnsPrivateCopy() {
            Food existing = food(1L, "Haferflocken", me, true);
            stubFind(existing);
            when(shoppingListItemRepository.existsByFoodIdAndUserIdNot(1L, USER_ID)).thenReturn(true);
            stubSaveReturnsArgument();

            FoodResponse result = service.update(USER_ID, 1L, request("Haferflocken", false));

            assertThat(existing.getOwner()).isNull();
            assertThat(existing.isPublic()).isTrue();
            assertThat(result.published()).isFalse();
        }

        @Test
        void publicFoodOfOtherUser_isForbiddenAndSavesNothing() {
            stubFind(food(1L, "Haferflocken", other, true));

            assertThatThrownBy(() -> service.update(USER_ID, 1L, request("Gekapert", true)))
                    .isInstanceOf(ForbiddenException.class);

            verify(repository, never()).saveAndFlush(any());
        }

        @Test
        void foodWithoutOwner_cannotBeChangedByAnybody() {
            stubFind(food(1L, "Haferflocken", null, true));

            assertThatThrownBy(() -> service.update(USER_ID, 1L, request("Gekapert", true)))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        void privateFoodOfOtherUser_isReportedAsNotFound() {
            stubFind(food(1L, "Haferflocken", other, false));

            assertThatThrownBy(() -> service.update(USER_ID, 1L, request("Gekapert", true)))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void missingId_throwsNotFoundAndSavesNothing() {
            when(repository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.update(USER_ID, 999L, request("Egal", false)))
                    .isInstanceOf(NotFoundException.class);

            verify(repository, never()).saveAndFlush(any());
        }
    }

    // ---------- unit ----------

    @Nested
    class Unit {

        @Test
        void unusedFood_canChangeItsUnit() {
            Food existing = food(1L, "Milch", me, false);
            stubFind(existing);
            stubSaveReturnsArgument();

            FoodResponse result = service.update(USER_ID, 1L, request(FoodUnit.ML, List.of()));

            assertThat(existing.getUnit()).isEqualTo(FoodUnit.ML);
            assertThat(result.unit()).isEqualTo(FoodUnit.ML);
            assertThat(result.used()).isFalse();
        }

        @Test
        void usedFood_canChangeItsUnit_too() {
            // A correction by the owner: the booked amounts keep their numbers in the new unit.
            Food existing = food(1L, "Milch", me, false);
            stubFind(existing);
            when(recipeItemRepository.existsByFoodId(1L)).thenReturn(true);
            stubSaveReturnsArgument();

            FoodResponse result = service.update(USER_ID, 1L, request(FoodUnit.ML, List.of()));

            assertThat(existing.getUnit()).isEqualTo(FoodUnit.ML);
            assertThat(result.used()).isTrue();
        }

        @Test
        void usedFood_keepingItsUnit_canChangeEverythingElse() {
            Food existing = food(1L, "Milch", me, false);
            stubFind(existing);
            when(mealItemRepository.existsByFoodId(1L)).thenReturn(true);
            stubSaveReturnsArgument();

            FoodResponse result = service.update(USER_ID, 1L, request(FoodUnit.G, List.of()));

            assertThat(existing.getName()).isEqualTo("Haferflocken");
            assertThat(result.used()).isTrue();
        }

        @Test
        void get_reportsWhetherTheFoodIsUsed() {
            stubFind(food(1L, "Milch", me, false));
            when(variationItemRepository.existsByFoodId(1L)).thenReturn(true);

            assertThat(service.get(USER_ID, 1L).used()).isTrue();
        }
    }

    // ---------- portions ----------

    @Nested
    class Portions {

        @Test
        void create_addsThePortions_firstOneIsTheFavoriteIfNoneIsMarked() {
            when(userRepository.getReferenceById(USER_ID)).thenReturn(me);
            stubSaveReturnsArgument();

            FoodResponse result = service.create(USER_ID, request(FoodUnit.G, List.of(
                    newPortion(" Packung ", 250, false),
                    newPortion("Esslöffel", 15, false))));

            assertThat(result.portions())
                    .extracting(FoodPortionResponse::name, FoodPortionResponse::amount, FoodPortionResponse::favorite)
                    .containsExactly(tuple("Packung", 250.0, true), tuple("Esslöffel", 15.0, false));
        }

        @Test
        void create_keepsTheMarkedFavorite_andListsItFirst() {
            when(userRepository.getReferenceById(USER_ID)).thenReturn(me);
            stubSaveReturnsArgument();

            FoodResponse result = service.create(USER_ID, request(FoodUnit.G, List.of(
                    newPortion("Packung", 250, false),
                    newPortion("Esslöffel", 15, true))));

            assertThat(result.portions())
                    .extracting(FoodPortionResponse::name, FoodPortionResponse::favorite)
                    .containsExactly(tuple("Esslöffel", true), tuple("Packung", false));
        }

        @Test
        void update_changesListedPortions_addsNewOnes_removesTheRest() {
            Food existing = food(1L, "Quark", me, false);
            savedPortion(existing, 10L, "Packung", 250, true);
            FoodPortion spoon = savedPortion(existing, 11L, "Löffel", 15, false);
            stubFind(existing);
            stubSaveReturnsArgument();

            service.update(USER_ID, 1L, request(FoodUnit.G, List.of(
                    new FoodPortionRequest(11L, "Esslöffel", 20.0, true),
                    newPortion("Becher", 500, false))));

            assertThat(existing.getPortions())
                    .extracting(FoodPortion::getName, FoodPortion::getAmount, FoodPortion::isFavorite)
                    .containsExactly(tuple("Esslöffel", 20.0, true), tuple("Becher", 500.0, false));
            assertThat(existing.getPortions().get(0)).isSameAs(spoon);
            // removals and updates reach the database before the new portion is inserted
            verify(repository, atLeastOnce()).flush();
        }

        @Test
        void update_withoutMarkedFavorite_theOldestKeptPortionBecomesTheFavorite() {
            Food existing = food(1L, "Quark", me, false);
            savedPortion(existing, 10L, "Packung", 250, true);
            savedPortion(existing, 11L, "Löffel", 15, false);
            savedPortion(existing, 12L, "Becher", 500, false);
            stubFind(existing);
            stubSaveReturnsArgument();

            // The favorite "Packung" is deleted; the others are listed favorite-first by the app.
            FoodResponse result = service.update(USER_ID, 1L, request(FoodUnit.G, List.of(
                    newPortion("Glas", 300, false),
                    new FoodPortionRequest(12L, "Becher", 500.0, false),
                    new FoodPortionRequest(11L, "Löffel", 15.0, false))));

            assertThat(result.portions())
                    .extracting(FoodPortionResponse::name, FoodPortionResponse::favorite)
                    .containsExactly(tuple("Löffel", true), tuple("Becher", false), tuple("Glas", false));
        }

        @Test
        void update_withEmptyList_removesAllPortions() {
            Food existing = food(1L, "Quark", me, false);
            savedPortion(existing, 10L, "Packung", 250, true);
            stubFind(existing);
            stubSaveReturnsArgument();

            FoodResponse result = service.update(USER_ID, 1L, request(FoodUnit.G, List.of()));

            assertThat(existing.getPortions()).isEmpty();
            assertThat(result.portions()).isEmpty();
        }

        @Test
        void removedPortion_turnsItsItemsIntoAmounts_beforeThePortionIsDeleted() {
            Food existing = food(1L, "Ei", me, false);
            FoodPortion egg = savedPortion(existing, 10L, "Stück", 60, true);
            MealItem mealItem = new MealItem(new Meal(), existing, Quantity.ofPortions(egg, new BigDecimal("2.5")));
            RecipeItem recipeItem = new RecipeItem(new Recipe(), existing, Quantity.ofPortions(egg, BigDecimal.ONE));
            ShoppingListItem listItem = new ShoppingListItem(me, existing, Quantity.ofPortions(egg, new BigDecimal("6")), 0);
            when(mealItemRepository.findByPortionId(10L)).thenReturn(List.of(mealItem));
            when(recipeItemRepository.findByPortionId(10L)).thenReturn(List.of(recipeItem));
            when(shoppingListItemRepository.findByPortionId(10L)).thenReturn(List.of(listItem));
            stubFind(existing);
            stubSaveReturnsArgument();
            // The portion must still be there when the converted items are flushed.
            List<Boolean> portionPresentAtFlush = new ArrayList<>();
            doAnswer(inv -> portionPresentAtFlush.add(existing.getPortions().contains(egg)))
                    .when(repository).flush();

            service.update(USER_ID, 1L, request(FoodUnit.G, List.of()));

            assertThat(mealItem.getQuantity().isPortion()).isFalse();
            assertThat(mealItem.getAmount()).isEqualTo(150.0);
            assertThat(recipeItem.getQuantity().getAmount()).isEqualTo(60.0);
            assertThat(listItem.getQuantity().getAmount()).isEqualTo(360.0);
            assertThat(existing.getPortions()).isEmpty();
            assertThat(portionPresentAtFlush).startsWith(true);
        }

        @Test
        void changedPortionAmount_isACorrection_itemsStayPortionsAndFollowIt() {
            Food existing = food(1L, "Ei", me, false);
            FoodPortion egg = savedPortion(existing, 10L, "Stück", 60, true);
            MealItem mealItem = new MealItem(new Meal(), existing, Quantity.ofPortions(egg, new BigDecimal("2")));
            stubFind(existing);
            stubSaveReturnsArgument();

            service.update(USER_ID, 1L, request(FoodUnit.G, List.of(
                    new FoodPortionRequest(10L, "Stück", 55.0, true))));

            assertThat(mealItem.getQuantity().isPortion()).isTrue();
            assertThat(mealItem.getAmount()).isEqualTo(110.0);
            verify(mealItemRepository, never()).findByPortionId(anyLong());
        }

        @Test
        void sameNameTwice_ignoringCaseAndSpaces_isRejected() {
            Food existing = food(1L, "Quark", me, false);
            stubFind(existing);

            assertThatThrownBy(() -> service.update(USER_ID, 1L, request(FoodUnit.G, List.of(
                    newPortion("Packung", 250, true),
                    newPortion(" packung", 500, false)))))
                    .isInstanceOf(InvalidRequestException.class);

            verify(repository, never()).saveAndFlush(any());
        }

        @Test
        void sameNameIgnoringAccents_isRejected_asTheDatabaseCollationWould() {
            stubFind(food(1L, "Quark", me, false));

            assertThatThrownBy(() -> service.update(USER_ID, 1L, request(FoodUnit.G, List.of(
                    newPortion("Glas", 250, true),
                    newPortion("Gläs", 500, false)))))
                    .isInstanceOf(InvalidRequestException.class);
        }

        @Test
        void swappingNames_goesThroughTemporaryNames_soTheUniqueKeyNeverSeesTwoEqualNames() {
            Food existing = food(1L, "Quark", me, false);
            FoodPortion pack = savedPortion(existing, 10L, "Packung", 250, true);
            FoodPortion cup = savedPortion(existing, 11L, "Becher", 500, false);
            stubFind(existing);
            List<String> namesAtFlush = new ArrayList<>();
            doAnswer(inv -> {
                namesAtFlush.add(pack.getName() + "|" + cup.getName());
                return null;
            }).when(repository).flush();
            stubSaveReturnsArgument();

            service.update(USER_ID, 1L, request(FoodUnit.G, List.of(
                    new FoodPortionRequest(10L, "Becher", 250.0, true),
                    new FoodPortionRequest(11L, "Packung", 500.0, false))));

            assertThat(namesAtFlush).containsExactly(" 10| 11", "Becher|Packung");
        }

        @Test
        void favoriteLeftOut_countsAsFalse() {
            assertThat(new FoodPortionRequest(null, "Packung", 250.0, null).favorite()).isFalse();
        }

        @Test
        void twoFavorites_areRejected() {
            stubFind(food(1L, "Quark", me, false));

            assertThatThrownBy(() -> service.update(USER_ID, 1L, request(FoodUnit.G, List.of(
                    newPortion("Packung", 250, true),
                    newPortion("Becher", 500, true)))))
                    .isInstanceOf(InvalidRequestException.class);
        }

        @Test
        void portionOfAnotherFood_isRejected() {
            Food existing = food(1L, "Quark", me, false);
            savedPortion(existing, 10L, "Packung", 250, true);
            stubFind(existing);

            assertThatThrownBy(() -> service.update(USER_ID, 1L, request(FoodUnit.G, List.of(
                    new FoodPortionRequest(99L, "Fremd", 100.0, true)))))
                    .isInstanceOf(InvalidRequestException.class)
                    .hasMessageContaining("99");

            assertThat(existing.getPortions()).extracting(FoodPortion::getName).containsExactly("Packung");
        }

        @Test
        void privateCopy_getsNewPortionsLikeTheRequested_originalKeepsItsOwn() {
            Food existing = food(1L, "Quark", me, true);
            FoodPortion pack = savedPortion(existing, 10L, "Packung", 250, true);
            stubFind(existing);
            when(mealItemRepository.existsByFoodIdAndMealUserIdNot(1L, USER_ID)).thenReturn(true);
            stubSaveReturnsArgument();

            service.update(USER_ID, 1L, new FoodRequest("Quark", FoodUnit.G, 70.0, 12.0, 4.0, 0.2, false,
                    List.of(new FoodPortionRequest(10L, "Packung", 500.0, true))));

            assertThat(existing.getPortions()).containsExactly(pack);
            assertThat(pack.getAmount()).isEqualTo(250.0);
            ArgumentCaptor<Food> captor = ArgumentCaptor.forClass(Food.class);
            verify(repository).saveAndFlush(captor.capture());
            assertThat(captor.getValue().getPortions())
                    .extracting(FoodPortion::getId, FoodPortion::getName, FoodPortion::getAmount)
                    .containsExactly(tuple(null, "Packung", 500.0));
        }
    }

    // ---------- delete ----------

    @Nested
    class Delete {

        @Test
        void unusedFood_isDeleted() {
            Food existing = food(1L, "Haferflocken", me, false);
            stubFind(existing);

            service.delete(USER_ID, 1L);

            verify(repository).delete(existing);
        }

        @Test
        void foodInAMeal_onlyLosesItsOwnerAndBecomesPublic() {
            // Also when the meal is the owner's own: the food is never deleted while in use.
            Food existing = food(1L, "Haferflocken", me, false);
            stubFind(existing);
            when(mealItemRepository.existsByFoodId(1L)).thenReturn(true);

            service.delete(USER_ID, 1L);

            verify(repository, never()).delete(any());
            assertThat(existing.getOwner()).isNull();
            assertThat(existing.isPublic()).isTrue();
        }

        @Test
        void foodInARecipe_onlyLosesItsOwner() {
            Food existing = food(1L, "Haferflocken", me, true);
            stubFind(existing);
            when(recipeItemRepository.existsByFoodId(1L)).thenReturn(true);

            service.delete(USER_ID, 1L);

            verify(repository, never()).delete(any());
            assertThat(existing.getOwner()).isNull();
        }

        @Test
        void foodOnlyInARecipeVariation_onlyLosesItsOwner() {
            Food existing = food(1L, "Haferflocken", me, true);
            stubFind(existing);
            when(variationItemRepository.existsByFoodId(1L)).thenReturn(true);

            service.delete(USER_ID, 1L);

            verify(repository, never()).delete(any());
            assertThat(existing.getOwner()).isNull();
        }

        @Test
        void foodOnlyOnAShoppingList_onlyLosesItsOwner() {
            Food existing = food(1L, "Haferflocken", me, false);
            stubFind(existing);
            when(shoppingListItemRepository.existsByFoodId(1L)).thenReturn(true);

            service.delete(USER_ID, 1L);

            verify(repository, never()).delete(any());
            assertThat(existing.getOwner()).isNull();
            assertThat(existing.isPublic()).isTrue();
        }

        @Test
        void foodOfOtherUser_isForbiddenAndDeletesNothing() {
            stubFind(food(1L, "Haferflocken", other, true));

            assertThatThrownBy(() -> service.delete(USER_ID, 1L))
                    .isInstanceOf(ForbiddenException.class);

            verify(repository, never()).delete(any());
        }

        @Test
        void missingId_throwsNotFoundAndDeletesNothing() {
            when(repository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.delete(USER_ID, 999L))
                    .isInstanceOf(NotFoundException.class);

            verify(repository, never()).delete(any());
        }
    }

    // ---------- helpers for other services ----------

    @Test
    void publishOwned_publishesOnlyTheCallersOwnFoods() {
        Food mine = food(1L, "Mein Brot", me, false);
        Food theirs = food(2L, "Fremdes Brot", other, false);

        service.publishOwned(USER_ID, mine);
        service.publishOwned(USER_ID, theirs);

        assertThat(mine.isPublished()).isTrue();
        assertThat(theirs.isPublished()).isFalse();
    }
}
