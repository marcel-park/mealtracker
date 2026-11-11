package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.CatalogScope;
import io.github.marcel_park.mealtracker.dto.FoodRequest;
import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.exception.ForbiddenException;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.Recipe;
import io.github.marcel_park.mealtracker.model.User;
import io.github.marcel_park.mealtracker.repository.FoodRepository;
import io.github.marcel_park.mealtracker.repository.MealItemRepository;
import io.github.marcel_park.mealtracker.repository.RecipeItemRepository;
import io.github.marcel_park.mealtracker.repository.RecipeRepository;
import io.github.marcel_park.mealtracker.repository.RecipeVariationItemRepository;
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
                variationItemRepository, recipeRepository, userRepository);
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
        f.setKcalPer100g(372);
        f.setProtein(13.5);
        f.setCarbs(58.7);
        f.setFat(7);
        return f;
    }

    private static FoodRequest request(String name, boolean published) {
        return new FoodRequest(name, 372.0, 13.5, 58.7, 7.0, published);
    }

    private void stubFind(Food food) {
        when(repository.findById(food.getId())).thenReturn(Optional.of(food));
    }

    private void stubSaveReturnsArgument() {
        when(repository.save(any(Food.class))).thenAnswer(inv -> inv.getArgument(0));
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
            verify(repository).save(captor.capture());
            Food passed = captor.getValue();
            assertThat(passed.getId()).isNull();
            assertThat(passed.getOwner()).isSameAs(me);
            assertThat(passed)
                    .extracting(Food::getName, Food::getKcalPer100g, Food::getProtein, Food::getCarbs,
                            Food::getFat, Food::isPublished, Food::isConfirmed)
                    .containsExactly("Haferflocken", 372.0, 13.5, 58.7, 7.0, true, false);
        }

        @Test
        void returnsResponseWithIdFromRepository() {
            when(userRepository.getReferenceById(USER_ID)).thenReturn(me);
            when(repository.save(any(Food.class))).thenAnswer(inv -> {
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
                    new FoodRequest("Haferflocken zart", 370.0, 13.0, 59.0, 6.5, false));

            assertThat(existing)
                    .extracting(Food::getName, Food::getKcalPer100g, Food::getProtein, Food::getCarbs, Food::getFat)
                    .containsExactly("Haferflocken zart", 370.0, 13.0, 59.0, 6.5);
            assertThat(result).isEqualTo(
                    new FoodResponse(1L, "Haferflocken zart", 370.0, 13.0, 59.0, 6.5, true, false, false));
        }

        @Test
        void ownPublicFoodStayingPublic_isChangedInPlaceEvenIfOthersUseIt() {
            // Changes to public foods reach everybody who uses them: no usage check at all.
            Food existing = food(1L, "Haferflocken", me, true);
            stubFind(existing);
            stubSaveReturnsArgument();

            FoodResponse result = service.update(USER_ID, 1L, request("Haferflocken grob", true));

            assertThat(result.id()).isEqualTo(1L);
            assertThat(existing.getName()).isEqualTo("Haferflocken grob");
            verifyNoInteractions(mealItemRepository, recipeItemRepository);
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
            when(repository.save(any(Food.class))).thenAnswer(inv -> {
                Food saved = inv.getArgument(0);
                saved.setId(2L);
                return saved;
            });

            FoodResponse result = service.update(USER_ID, 1L,
                    new FoodRequest("Haferflocken", 380.0, 13.5, 58.7, 7.0, false));

            // The original stays exactly as the others know it, public and without owner
            assertThat(existing.getOwner()).isNull();
            assertThat(existing.isPublic()).isTrue();
            assertThat(existing.getKcalPer100g()).isEqualTo(372.0);

            // The owner continues with a private copy carrying the requested values
            ArgumentCaptor<Food> captor = ArgumentCaptor.forClass(Food.class);
            verify(repository).save(captor.capture());
            Food copy = captor.getValue();
            assertThat(copy).isNotSameAs(existing);
            assertThat(copy.getOwner()).isSameAs(me);
            assertThat(copy.isPublished()).isFalse();
            assertThat(copy.getKcalPer100g()).isEqualTo(380.0);
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
        void publicFoodOfOtherUser_isForbiddenAndSavesNothing() {
            stubFind(food(1L, "Haferflocken", other, true));

            assertThatThrownBy(() -> service.update(USER_ID, 1L, request("Gekapert", true)))
                    .isInstanceOf(ForbiddenException.class);

            verify(repository, never()).save(any());
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

            verify(repository, never()).save(any());
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
