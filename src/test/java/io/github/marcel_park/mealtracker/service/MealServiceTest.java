package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.MealItemRequest;
import io.github.marcel_park.mealtracker.dto.MealItemResponse;
import io.github.marcel_park.mealtracker.dto.MealRequest;
import io.github.marcel_park.mealtracker.dto.MealResponse;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.Meal;
import io.github.marcel_park.mealtracker.model.MealItem;
import io.github.marcel_park.mealtracker.repository.MealRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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

    private MealService service;

    private final Food oats = food(1L, "Haferflocken", 372.0);
    private final Food milk = food(2L, "Milch", 64.0);
    private final Food apple = food(3L, "Apfel", 52.0);
    private final Food cheese = food(4L, "Gouda", 356.0);

    @BeforeEach
    void setUp() {
        service = new MealService(mealRepository, foodService);
    }

    // ---------- test data ----------

    private static Food food(Long id, String name, double kcalPer100g) {
        Food food = new Food();
        food.setId(id);
        food.setName(name);
        food.setKcalPer100g(kcalPer100g);
        return food;
    }

    private static Meal meal(Long id, String title) {
        Meal meal = new Meal();
        meal.setId(id);
        meal.setTitle(title);
        return meal;
    }

    private static MealItemRequest item(Long foodId, double amountG) {
        return new MealItemRequest(foodId, amountG);
    }

    private static MealRequest request(String title, MealItemRequest... items) {
        return new MealRequest(title, List.of(items));
    }

    // ---------- findAll ----------

    @Nested
    class FindAll {

        @Test
        void findAll_keepsNewestFirstOrderFromRepository() {
            when(mealRepository.findAllByOrderByBookedAtDesc())
                    .thenReturn(List.of(meal(2L, "Mittagessen"), meal(1L, "Frühstück")));

            List<MealResponse> result = service.findAll();

            assertThat(result).extracting(MealResponse::id).containsExactly(2L, 1L);
        }

        @Test
        void findAll_mapsIdTitleAndBookedAt() {
            LocalDateTime bookedAt = LocalDateTime.of(2026, 11, 3, 7, 45);
            Meal meal = meal(1L, "Frühstück");
            meal.setBookedAt(bookedAt);
            when(mealRepository.findAllByOrderByBookedAtDesc()).thenReturn(List.of(meal));

            MealResponse result = service.findAll().get(0);

            assertThat(result.id()).isEqualTo(1L);
            assertThat(result.title()).isEqualTo("Frühstück");
            assertThat(result.bookedAt()).isEqualTo(bookedAt);
        }

        @Test
        void findAll_mapsItemsWithFoodIdNameAndAmount() {
            Meal meal = meal(1L, "Frühstück");
            meal.addItem(oats, 150);
            meal.addItem(milk, 200);
            when(mealRepository.findAllByOrderByBookedAtDesc()).thenReturn(List.of(meal));

            MealResponse result = service.findAll().get(0);

            assertThat(result.items())
                    .extracting(MealItemResponse::foodId, MealItemResponse::foodName, MealItemResponse::amountG)
                    .containsExactly(
                            tuple(1L, "Haferflocken", 150.0),
                            tuple(2L, "Milch", 200.0));
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
        void itemKcal_isAmountTimesKcalPer100gDividedBy100(double amountG, double kcalPer100g, double expectedKcal) {
            Meal meal = meal(1L, "Frühstück");
            meal.addItem(food(1L, "Haferflocken", kcalPer100g), amountG);
            when(mealRepository.findAllByOrderByBookedAtDesc()).thenReturn(List.of(meal));

            MealItemResponse item = service.findAll().get(0).items().get(0);

            assertThat(item.kcal()).isEqualTo(expectedKcal);
        }

        @Test
        void mealKcal_isSumOfItemKcal() {
            Meal meal = meal(1L, "Frühstück");
            meal.addItem(oats, 150);   // 558 kcal
            meal.addItem(milk, 200);   // 128 kcal
            when(mealRepository.findAllByOrderByBookedAtDesc()).thenReturn(List.of(meal));

            MealResponse result = service.findAll().get(0);

            assertThat(result.kcal()).isEqualTo(686.0);
        }

        @Test
        void mealKcal_withoutItems_isZero() {
            when(mealRepository.findAllByOrderByBookedAtDesc()).thenReturn(List.of(meal(1L, "Leer")));

            MealResponse result = service.findAll().get(0);

            assertThat(result.kcal()).isZero();
        }

        @Test
        void mealKcal_foodCorrectedAfterBooking_usesCurrentKcalPer100g() {
            // Calories are never stored, so correcting a food also corrects every meal that contains it.
            Meal meal = meal(1L, "Frühstück");
            meal.addItem(oats, 100);
            oats.setKcalPer100g(380.0);
            when(mealRepository.findAllByOrderByBookedAtDesc()).thenReturn(List.of(meal));

            MealResponse result = service.findAll().get(0);

            assertThat(result.kcal()).isEqualTo(380.0);
        }
    }

    // ---------- create ----------

    @Nested
    class Create {

        @Test
        void create_savesNewMealWithTitleAndItemsInRequestOrder() {
            when(foodService.getEntity(1L)).thenReturn(oats);
            when(foodService.getEntity(2L)).thenReturn(milk);
            when(mealRepository.save(any(Meal.class))).thenAnswer(inv -> inv.getArgument(0));

            service.create(request("Haferflocken, Milch", item(1L, 150), item(2L, 200)));

            ArgumentCaptor<Meal> captor = ArgumentCaptor.forClass(Meal.class);
            verify(mealRepository).save(captor.capture());
            Meal saved = captor.getValue();
            assertThat(saved.getId()).isNull();
            assertThat(saved.getTitle()).isEqualTo("Haferflocken, Milch");
            assertThat(saved.getItems())
                    .extracting(MealItem::getFood, MealItem::getAmountG)
                    .containsExactly(tuple(oats, 150.0), tuple(milk, 200.0));
        }

        @Test
        void create_returnsResponseWithIdFromRepositoryAndComputedKcal() {
            when(foodService.getEntity(1L)).thenReturn(oats);
            when(mealRepository.save(any(Meal.class))).thenAnswer(inv -> {
                Meal saved = inv.getArgument(0);
                saved.setId(42L);
                return saved;
            });

            MealResponse result = service.create(request("Haferflocken", item(1L, 150)));

            assertThat(result.id()).isEqualTo(42L);
            assertThat(result.title()).isEqualTo("Haferflocken");
            assertThat(result.kcal()).isEqualTo(558.0);
        }

        @Test
        void create_unknownFood_throwsNotFoundAndSavesNothing() {
            when(foodService.getEntity(99L)).thenThrow(new NotFoundException("Food", 99L));

            assertThatThrownBy(() -> service.create(request("Unbekannt", item(99L, 50))))
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
        void update_unknownMeal_throwsNotFoundAndLoadsNoFood() {
            when(mealRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.update(99L, request("Egal", item(1L, 100))))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("Meal with id 99 not found");

            verifyNoInteractions(foodService);
        }

        @Test
        void update_newTitle_replacesTitle() {
            when(mealRepository.findById(1L)).thenReturn(Optional.of(existing));

            MealResponse result = service.update(1L, request("Frühstück", item(1L, 150), item(2L, 200)));

            assertThat(result.title()).isEqualTo("Frühstück");
            assertThat(existing.getTitle()).isEqualTo("Frühstück");
        }

        @Test
        void update_unchangedItems_keepsExistingItemInstances() {
            // meal_item's primary key is (meal_id, food_id) and Hibernate flushes INSERTs before
            // DELETEs. Replacing the item of a kept food with a new instance would insert a
            // duplicate key, so the existing instance must stay in the list.
            when(mealRepository.findById(1L)).thenReturn(Optional.of(existing));

            service.update(1L, request("Haferflocken, Milch", item(1L, 150), item(2L, 200)));

            assertThat(existing.getItems()).containsExactly(oatsItem, milkItem);
            verifyNoInteractions(foodService);
        }

        @Test
        void update_changedAmount_updatesExistingItemInPlace() {
            when(mealRepository.findById(1L)).thenReturn(Optional.of(existing));

            service.update(1L, request("Haferflocken, Milch", item(1L, 80), item(2L, 200)));

            assertThat(existing.getItems()).containsExactly(oatsItem, milkItem);
            assertThat(oatsItem.getAmountG()).isEqualTo(80.0);
            verifyNoInteractions(foodService);
        }

        @Test
        void update_foodMissingFromRequest_removesItsItem() {
            when(mealRepository.findById(1L)).thenReturn(Optional.of(existing));

            service.update(1L, request("Haferflocken", item(1L, 150)));

            assertThat(existing.getItems()).containsExactly(oatsItem);
        }

        @Test
        void update_newFood_appendsItemAfterKeptItems() {
            when(mealRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(foodService.getEntity(3L)).thenReturn(apple);

            // the new food comes first in the request, but kept items keep their position
            service.update(1L, request("Apfel, Haferflocken, Milch", item(3L, 120), item(1L, 150), item(2L, 200)));

            assertThat(existing.getItems())
                    .extracting(MealItem::getFood, MealItem::getAmountG)
                    .containsExactly(tuple(oats, 150.0), tuple(milk, 200.0), tuple(apple, 120.0));
        }

        @Test
        void update_severalNewFoods_addsThemInRequestOrder() {
            when(mealRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(foodService.getEntity(4L)).thenReturn(cheese);
            when(foodService.getEntity(3L)).thenReturn(apple);

            service.update(1L, request("Gouda, Apfel", item(4L, 30), item(3L, 120)));

            assertThat(existing.getItems())
                    .extracting(MealItem::getFood)
                    .containsExactly(cheese, apple);
        }

        @Test
        void update_sameKeptFoodTwice_sumsAmountsIntoExistingItem() {
            when(mealRepository.findById(1L)).thenReturn(Optional.of(existing));

            service.update(1L, request("Haferflocken, Milch", item(1L, 100), item(1L, 50), item(2L, 200)));

            assertThat(existing.getItems()).containsExactly(oatsItem, milkItem);
            assertThat(oatsItem.getAmountG()).isEqualTo(150.0);
        }

        @Test
        void update_sameNewFoodTwice_addsOneItemWithSummedAmount() {
            // a meal can hold each food only once (primary key), so duplicates are merged
            when(mealRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(foodService.getEntity(3L)).thenReturn(apple);

            service.update(1L, request("Apfel", item(3L, 70), item(3L, 50)));

            assertThat(existing.getItems())
                    .extracting(MealItem::getFood, MealItem::getAmountG)
                    .containsExactly(tuple(apple, 120.0));
            verify(foodService).getEntity(3L);
        }

        @Test
        void update_unknownFood_throwsNotFound() {
            when(mealRepository.findById(1L)).thenReturn(Optional.of(existing));
            when(foodService.getEntity(99L)).thenThrow(new NotFoundException("Food", 99L));

            assertThatThrownBy(() -> service.update(1L, request("Unbekannt", item(99L, 50))))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("Food with id 99 not found");
        }

        @Test
        void update_returnsResponseWithSameIdAndRecomputedKcal() {
            when(mealRepository.findById(1L)).thenReturn(Optional.of(existing));

            MealResponse result = service.update(1L, request("Haferflocken, Milch", item(1L, 100), item(2L, 200)));

            assertThat(result.id()).isEqualTo(1L);
            assertThat(result.items())
                    .extracting(MealItemResponse::amountG, MealItemResponse::kcal)
                    .containsExactly(tuple(100.0, 372.0), tuple(200.0, 128.0));
            assertThat(result.kcal()).isEqualTo(500.0);
        }
    }

    // ---------- delete / deleteAll ----------

    @Nested
    class Delete {

        @Test
        void delete_existingId_deletesEntity() {
            Meal existing = meal(1L, "Frühstück");
            when(mealRepository.findById(1L)).thenReturn(Optional.of(existing));

            service.delete(1L);

            verify(mealRepository).delete(existing);
        }

        @Test
        void delete_missingId_throwsNotFoundAndDeletesNothing() {
            when(mealRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.delete(99L))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("Meal with id 99 not found");

            verify(mealRepository, never()).delete(any());
        }

        @Test
        void deleteAll_deletesAllMeals() {
            service.deleteAll();

            verify(mealRepository).deleteAll();
        }
    }
}
