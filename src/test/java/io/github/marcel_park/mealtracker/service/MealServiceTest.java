package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.MealItemRequest;
import io.github.marcel_park.mealtracker.dto.MealItemResponse;
import io.github.marcel_park.mealtracker.dto.MealRequest;
import io.github.marcel_park.mealtracker.dto.MealResponse;
import io.github.marcel_park.mealtracker.dto.RecipeUseRequest;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.Meal;
import io.github.marcel_park.mealtracker.model.MealItem;
import io.github.marcel_park.mealtracker.model.User;
import io.github.marcel_park.mealtracker.repository.MealRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
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
class MealServiceTest {

    @Mock
    private MealRepository mealRepository;

    @Mock
    private FoodService foodService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RecipeService recipeService;

    private MealService service;

    // The logged-in user on whose behalf every call is made.
    private static final Long USER_ID = 7L;

    private final Food oats = food(1L, "Haferflocken", 372.0);
    private final Food milk = food(2L, "Milch", 64.0);
    private final Food apple = food(3L, "Apfel", 52.0);
    private final Food cheese = food(4L, "Gouda", 356.0);

    @BeforeEach
    void setUp() {
        service = new MealService(mealRepository, foodService, userRepository, recipeService);
    }

    // ---------- test data ----------

    private static Food food(Long id, String name, double kcalPer100) {
        Food food = new Food();
        food.setId(id);
        food.setName(name);
        food.setKcalPer100(kcalPer100);
        return food;
    }

    private static Meal meal(Long id, String title) {
        Meal meal = new Meal();
        meal.setId(id);
        meal.setTitle(title);
        return meal;
    }

    private static MealItemRequest item(Long foodId, double amount) {
        return new MealItemRequest(foodId, amount);
    }

    private static MealRequest request(String title, MealItemRequest... items) {
        return new MealRequest(title, List.of(items));
    }

    // ---------- findAll ----------

    @Nested
    class FindAll {

        @Test
        void findAll_keepsNewestFirstOrderFromRepository() {
            when(mealRepository.findAllByUserIdOrderByBookedAtDesc(USER_ID))
                    .thenReturn(List.of(meal(2L, "Mittagessen"), meal(1L, "Frühstück")));

            List<MealResponse> result = service.findAll(USER_ID);

            assertThat(result).extracting(MealResponse::id).containsExactly(2L, 1L);
        }

        @Test
        void findAll_mapsIdTitleAndBookedAt() {
            LocalDateTime bookedAt = LocalDateTime.of(2026, 11, 3, 7, 45);
            Meal meal = meal(1L, "Frühstück");
            meal.setBookedAt(bookedAt);
            when(mealRepository.findAllByUserIdOrderByBookedAtDesc(USER_ID)).thenReturn(List.of(meal));

            MealResponse result = service.findAll(USER_ID).get(0);

            assertThat(result.id()).isEqualTo(1L);
            assertThat(result.title()).isEqualTo("Frühstück");
            assertThat(result.bookedAt()).isEqualTo(bookedAt);
        }

        @Test
        void findAll_mapsItemsWithTheirFoodAndAmount() {
            Meal meal = meal(1L, "Frühstück");
            meal.addItem(oats, 150);
            meal.addItem(milk, 200);
            when(mealRepository.findAllByUserIdOrderByBookedAtDesc(USER_ID)).thenReturn(List.of(meal));

            MealResponse result = service.findAll(USER_ID).get(0);

            assertThat(result.items())
                    .extracting(item -> item.food().id(), item -> item.food().name(), MealItemResponse::amount)
                    .containsExactly(
                            tuple(1L, "Haferflocken", 150.0),
                            tuple(2L, "Milch", 200.0));
            // a booked food is used, so the app shows its unit as fixed
            assertThat(result.items()).allSatisfy(item -> assertThat(item.food().used()).isTrue());
        }
    }

    // ---------- kcal calculation (shared by all methods that return a MealResponse) ----------

    @Nested
    class KcalCalculation {

        @ParameterizedTest
        @CsvSource({
                "100, 372, 372.0",
                "150, 372, 558.0",
                "33,  372, 122.76",  // the service does not round, rounding is left to the client
                "0.5, 64,  0.32"
        })
        void itemKcal_isAmountTimesKcalPer100DividedBy100(double amount, double kcalPer100, double expectedKcal) {
            Meal meal = meal(1L, "Frühstück");
            meal.addItem(food(1L, "Haferflocken", kcalPer100), amount);
            when(mealRepository.findAllByUserIdOrderByBookedAtDesc(USER_ID)).thenReturn(List.of(meal));

            MealItemResponse item = service.findAll(USER_ID).get(0).items().get(0);

            assertThat(item.kcal()).isEqualTo(expectedKcal);
        }

        @Test
        void mealKcal_isSumOfItemKcal() {
            Meal meal = meal(1L, "Frühstück");
            meal.addItem(oats, 150);   // 558 kcal
            meal.addItem(milk, 200);   // 128 kcal
            when(mealRepository.findAllByUserIdOrderByBookedAtDesc(USER_ID)).thenReturn(List.of(meal));

            MealResponse result = service.findAll(USER_ID).get(0);

            assertThat(result.kcal()).isEqualTo(686.0);
        }

        @Test
        void mealKcal_withoutItems_isZero() {
            when(mealRepository.findAllByUserIdOrderByBookedAtDesc(USER_ID)).thenReturn(List.of(meal(1L, "Leer")));

            MealResponse result = service.findAll(USER_ID).get(0);

            assertThat(result.kcal()).isZero();
        }

        @Test
        void mealKcal_foodCorrectedAfterBooking_usesCurrentKcalPer100() {
            // Calories are never stored, so correcting a food also corrects every meal that contains it.
            Meal meal = meal(1L, "Frühstück");
            meal.addItem(oats, 100);
            oats.setKcalPer100(380.0);
            when(mealRepository.findAllByUserIdOrderByBookedAtDesc(USER_ID)).thenReturn(List.of(meal));

            MealResponse result = service.findAll(USER_ID).get(0);

            assertThat(result.kcal()).isEqualTo(380.0);
        }
    }

    // ---------- findBookedOn ----------

    @Nested
    class FindBookedOn {

        @Test
        void findBookedOn_asksForTheWholeDayFromMidnightToMidnight() {
            when(mealRepository.findAllBookedBetween(USER_ID,
                    LocalDateTime.of(2026, 11, 11, 0, 0), LocalDateTime.of(2026, 11, 12, 0, 0)))
                    .thenReturn(List.of(meal(2L, "Mittagessen"), meal(1L, "Frühstück")));

            List<MealResponse> result = service.findBookedOn(USER_ID, LocalDate.of(2026, 11, 11));

            assertThat(result).extracting(MealResponse::id).containsExactly(2L, 1L);
        }

        @Test
        void findBookedOn_lastDayOfTheYear_endsAtNewYear() {
            when(mealRepository.findAllBookedBetween(USER_ID,
                    LocalDateTime.of(2026, 12, 31, 0, 0), LocalDateTime.of(2027, 1, 1, 0, 0)))
                    .thenReturn(List.of(meal(1L, "Silvester")));

            List<MealResponse> result = service.findBookedOn(USER_ID, LocalDate.of(2026, 12, 31));

            assertThat(result).extracting(MealResponse::title).containsExactly("Silvester");
        }
    }

    // ---------- create ----------

    @Nested
    class Create {

        @Test
        void create_savesNewMealWithTitleAndItemsInRequestOrder() {
            when(foodService.getVisibleEntity(USER_ID, 1L)).thenReturn(oats);
            when(foodService.getVisibleEntity(USER_ID, 2L)).thenReturn(milk);
            when(mealRepository.save(any(Meal.class))).thenAnswer(inv -> inv.getArgument(0));

            service.create(USER_ID, request("Haferflocken, Milch", item(1L, 150), item(2L, 200)));

            ArgumentCaptor<Meal> captor = ArgumentCaptor.forClass(Meal.class);
            verify(mealRepository).save(captor.capture());
            Meal saved = captor.getValue();
            assertThat(saved.getId()).isNull();
            assertThat(saved.getTitle()).isEqualTo("Haferflocken, Milch");
            assertThat(saved.getItems())
                    .extracting(MealItem::getFood, MealItem::getAmount)
                    .containsExactly(tuple(oats, 150.0), tuple(milk, 200.0));
        }

        @Test
        void create_setsLoggedInUserAsOwner() {
            User owner = new User();
            owner.setId(USER_ID);
            when(userRepository.getReferenceById(USER_ID)).thenReturn(owner);
            when(foodService.getVisibleEntity(USER_ID, 1L)).thenReturn(oats);
            when(mealRepository.save(any(Meal.class))).thenAnswer(inv -> inv.getArgument(0));

            service.create(USER_ID, request("Haferflocken", item(1L, 150)));

            ArgumentCaptor<Meal> captor = ArgumentCaptor.forClass(Meal.class);
            verify(mealRepository).save(captor.capture());
            assertThat(captor.getValue().getUser()).isSameAs(owner);
        }

        @Test
        void create_passesBookedRecipesOnForThePreselection() {
            when(foodService.getVisibleEntity(USER_ID, 1L)).thenReturn(oats);
            when(mealRepository.save(any(Meal.class))).thenAnswer(inv -> inv.getArgument(0));
            List<RecipeUseRequest> uses = List.of(new RecipeUseRequest(5L, 9L));

            service.create(USER_ID, new MealRequest("Porridge", List.of(item(1L, 150)), uses));

            verify(recipeService).markUsed(USER_ID, uses);
        }

        @Test
        void create_returnsResponseWithIdFromRepositoryAndComputedKcal() {
            when(foodService.getVisibleEntity(USER_ID, 1L)).thenReturn(oats);
            when(mealRepository.save(any(Meal.class))).thenAnswer(inv -> {
                Meal saved = inv.getArgument(0);
                saved.setId(42L);
                return saved;
            });

            MealResponse result = service.create(USER_ID, request("Haferflocken", item(1L, 150)));

            assertThat(result.id()).isEqualTo(42L);
            assertThat(result.title()).isEqualTo("Haferflocken");
            assertThat(result.kcal()).isEqualTo(558.0);
        }

        @Test
        void create_unknownFood_throwsNotFoundAndSavesNothing() {
            when(foodService.getVisibleEntity(USER_ID, 99L)).thenThrow(new NotFoundException("Food", 99L));

            assertThatThrownBy(() -> service.create(USER_ID, request("Unbekannt", item(99L, 50))))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("Food with id 99 not found");

            verify(mealRepository, never()).save(any());
        }
    }

    // ---------- update ----------

    @Nested
    class Update {

        // Existing meal: oats 150 g, milk 200 g.
        private Meal existing;
        private MealItem oatsItem;
        private MealItem milkItem;

        @BeforeEach
        void setUpExistingMeal() {
            existing = meal(1L, "Haferflocken, Milch");
            existing.addItem(oats, 150);
            existing.addItem(milk, 200);
            oatsItem = existing.getItems().get(0);
            milkItem = existing.getItems().get(1);
        }

        @Test
        void update_passesBookedRecipesOnForThePreselection() {
            when(mealRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(existing));
            List<RecipeUseRequest> uses = List.of(new RecipeUseRequest(5L, null));

            service.update(USER_ID, 1L,
                    new MealRequest("Haferflocken, Milch", List.of(item(1L, 150), item(2L, 200)), uses));

            verify(recipeService).markUsed(USER_ID, uses);
        }

        @Test
        void update_unknownMeal_throwsNotFoundAndLoadsNoFood() {
            when(mealRepository.findByIdAndUserId(99L, USER_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.update(USER_ID, 99L, request("Egal", item(1L, 100))))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("Meal with id 99 not found");

            verifyNoInteractions(foodService);
        }

        @Test
        void update_mealOfAnotherUser_throwsNotFound() {
            // findByIdAndUserId finds nothing for a meal that belongs to someone else
            when(mealRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.update(USER_ID, 1L, request("Egal", item(1L, 100))))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("Meal with id 1 not found");

            assertThat(existing.getTitle()).isEqualTo("Haferflocken, Milch");
        }

        @Test
        void update_newTitle_replacesTitle() {
            when(mealRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(existing));

            MealResponse result = service.update(USER_ID, 1L, request("Frühstück", item(1L, 150), item(2L, 200)));

            assertThat(result.title()).isEqualTo("Frühstück");
            assertThat(existing.getTitle()).isEqualTo("Frühstück");
        }

        @Test
        void update_unchangedItems_keepsExistingItemInstances() {
            // meal_item's primary key is (meal_id, food_id) and Hibernate flushes INSERTs before
            // DELETEs. Replacing the item of a kept food with a new instance would insert a
            // duplicate key, so the existing instance must stay in the list.
            when(mealRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(existing));

            service.update(USER_ID, 1L, request("Haferflocken, Milch", item(1L, 150), item(2L, 200)));

            assertThat(existing.getItems()).containsExactly(oatsItem, milkItem);
            verifyNoInteractions(foodService);
        }

        @Test
        void update_changedAmount_updatesExistingItemInPlace() {
            when(mealRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(existing));

            service.update(USER_ID, 1L, request("Haferflocken, Milch", item(1L, 80), item(2L, 200)));

            assertThat(existing.getItems()).containsExactly(oatsItem, milkItem);
            assertThat(oatsItem.getAmount()).isEqualTo(80.0);
            verifyNoInteractions(foodService);
        }

        @Test
        void update_foodMissingFromRequest_removesItsItem() {
            when(mealRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(existing));

            service.update(USER_ID, 1L, request("Haferflocken", item(1L, 150)));

            assertThat(existing.getItems()).containsExactly(oatsItem);
        }

        @Test
        void update_newFood_appendsItemAfterKeptItems() {
            when(mealRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(existing));
            when(foodService.getVisibleEntity(USER_ID, 3L)).thenReturn(apple);

            // the new food comes first in the request, but kept items keep their position
            service.update(USER_ID, 1L, request("Apfel, Haferflocken, Milch", item(3L, 120), item(1L, 150), item(2L, 200)));

            assertThat(existing.getItems())
                    .extracting(MealItem::getFood, MealItem::getAmount)
                    .containsExactly(tuple(oats, 150.0), tuple(milk, 200.0), tuple(apple, 120.0));
        }

        @Test
        void update_severalNewFoods_addsThemInRequestOrder() {
            when(mealRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(existing));
            when(foodService.getVisibleEntity(USER_ID, 4L)).thenReturn(cheese);
            when(foodService.getVisibleEntity(USER_ID, 3L)).thenReturn(apple);

            service.update(USER_ID, 1L, request("Gouda, Apfel", item(4L, 30), item(3L, 120)));

            assertThat(existing.getItems())
                    .extracting(MealItem::getFood)
                    .containsExactly(cheese, apple);
        }

        @Test
        void update_sameKeptFoodTwice_sumsAmountsIntoExistingItem() {
            when(mealRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(existing));

            service.update(USER_ID, 1L, request("Haferflocken, Milch", item(1L, 100), item(1L, 50), item(2L, 200)));

            assertThat(existing.getItems()).containsExactly(oatsItem, milkItem);
            assertThat(oatsItem.getAmount()).isEqualTo(150.0);
        }

        @Test
        void update_sameNewFoodTwice_addsOneItemWithSummedAmount() {
            // a meal can hold each food only once (primary key), so duplicates are merged
            when(mealRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(existing));
            when(foodService.getVisibleEntity(USER_ID, 3L)).thenReturn(apple);

            service.update(USER_ID, 1L, request("Apfel", item(3L, 70), item(3L, 50)));

            assertThat(existing.getItems())
                    .extracting(MealItem::getFood, MealItem::getAmount)
                    .containsExactly(tuple(apple, 120.0));
            verify(foodService).getVisibleEntity(USER_ID, 3L);
        }

        @Test
        void update_unknownFood_throwsNotFound() {
            when(mealRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(existing));
            when(foodService.getVisibleEntity(USER_ID, 99L)).thenThrow(new NotFoundException("Food", 99L));

            assertThatThrownBy(() -> service.update(USER_ID, 1L, request("Unbekannt", item(99L, 50))))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("Food with id 99 not found");
        }

        @Test
        void update_returnsResponseWithSameIdAndRecomputedKcal() {
            when(mealRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(existing));

            MealResponse result = service.update(USER_ID, 1L, request("Haferflocken, Milch", item(1L, 100), item(2L, 200)));

            assertThat(result.id()).isEqualTo(1L);
            assertThat(result.items())
                    .extracting(MealItemResponse::amount, MealItemResponse::kcal)
                    .containsExactly(tuple(100.0, 372.0), tuple(200.0, 128.0));
            assertThat(result.kcal()).isEqualTo(500.0);
        }
    }

    // ---------- delete ----------

    @Nested
    class Delete {

        @Test
        void delete_existingId_deletesEntity() {
            Meal existing = meal(1L, "Frühstück");
            when(mealRepository.findByIdAndUserId(1L, USER_ID)).thenReturn(Optional.of(existing));

            service.delete(USER_ID, 1L);

            verify(mealRepository).delete(existing);
        }

        @Test
        void delete_missingId_throwsNotFoundAndDeletesNothing() {
            when(mealRepository.findByIdAndUserId(99L, USER_ID)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.delete(USER_ID, 99L))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("Meal with id 99 not found");

            verify(mealRepository, never()).delete(any());
        }
    }
}
