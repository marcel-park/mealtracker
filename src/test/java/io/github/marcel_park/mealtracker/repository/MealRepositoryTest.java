package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.Meal;
import io.github.marcel_park.mealtracker.model.MealItem;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

@DataJpaTest
class MealRepositoryTest {

    @Autowired
    private MealRepository mealRepository;

    @Autowired
    private FoodRepository foodRepository;

    @Autowired
    private EntityManager entityManager;

    private Food oats;
    private Food milk;

    @BeforeEach
    void setUp() {
        oats = saveFood("Haferflocken", 372.0);
        milk = saveFood("Milch", 64.0);
    }

    // ---------- helpers ----------

    private Food saveFood(String name, double kcalPer100g) {
        Food food = new Food();
        food.setName(name);
        food.setKcalPer100g(kcalPer100g);
        food.setProtein(5.0);
        food.setCarbs(10.0);
        food.setFat(2.0);
        return foodRepository.save(food);
    }

    private Meal saveMeal(String title, LocalDateTime bookedAt) {
        Meal meal = new Meal();
        meal.setTitle(title);
        meal.setBookedAt(bookedAt);
        return mealRepository.save(meal);
    }

    private Meal saveMealWithOatsAndMilk() {
        Meal meal = new Meal();
        meal.setTitle("Haferflocken, Milch");
        meal.addItem(oats, 150);
        meal.addItem(milk, 200);
        return mealRepository.save(meal);
    }

    // Writes pending SQL and empties the persistence context, so the next read comes from the database.
    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }

    private long countAllMealItems() {
        return entityManager.createQuery("select count(i) from MealItem i", Long.class)
                .getSingleResult();
    }

    private long countMealItemsOf(Long mealId) {
        return entityManager.createQuery("select count(i) from MealItem i where i.meal.id = :mealId", Long.class)
                .setParameter("mealId", mealId)
                .getSingleResult();
    }

    // ---------- tests ----------

    @Test
    void findAllByOrderByBookedAtDesc_returnsNewestMealFirst() {
        saveMeal("Frühstück", LocalDateTime.of(2026, 11, 3, 8, 0));
        saveMeal("Abendessen", LocalDateTime.of(2026, 11, 3, 19, 0));
        saveMeal("Mittagessen", LocalDateTime.of(2026, 11, 3, 12, 0));

        List<Meal> result = mealRepository.findAllByOrderByBookedAtDesc();

        assertThat(result).extracting(Meal::getTitle)
                .containsExactly("Abendessen", "Mittagessen", "Frühstück");
    }

    @Test
    void save_cascadesItemsWithCompositeKeyOfMealAndFood() {
        Meal saved = saveMealWithOatsAndMilk();
        flushAndClear();

        Meal loaded = mealRepository.findById(saved.getId()).orElseThrow();

        // No @OrderBy on Meal.items, so the order after loading is not defined.
        assertThat(loaded.getItems())
                .extracting(
                        item -> item.getId().getMealId(),
                        item -> item.getId().getFoodId(),
                        MealItem::getAmountG)
                .containsExactlyInAnyOrder(
                        tuple(saved.getId(), oats.getId(), 150.0),
                        tuple(saved.getId(), milk.getId(), 200.0));
    }

    @Test
    void removeItemFromList_deletesOrphanedMealItem() {
        Long mealId = saveMealWithOatsAndMilk().getId();
        Long milkId = milk.getId();
        flushAndClear();
        Meal loaded = mealRepository.findById(mealId).orElseThrow();

        loaded.getItems().removeIf(item -> item.getFood().getId().equals(milkId));
        flushAndClear();

        assertThat(mealRepository.findById(mealId).orElseThrow().getItems())
                .extracting(item -> item.getFood().getId())
                .containsExactly(oats.getId());
    }

    @Test
    void delete_removesItsMealItemsButKeepsFoods() {
        Long mealId = saveMealWithOatsAndMilk().getId();
        flushAndClear();

        mealRepository.delete(mealRepository.findById(mealId).orElseThrow());
        flushAndClear();

        assertThat(countMealItemsOf(mealId)).isZero();
        assertThat(foodRepository.findAllById(List.of(oats.getId(), milk.getId()))).hasSize(2);
    }

    @Test
    void deleteAll_removesAllMealItems() {
        // MealService.deleteAll() relies on this: deleteAll() removes meal by meal, so the
        // cascade to meal_item applies (deleteAllInBatch() would bypass it).
        saveMealWithOatsAndMilk();
        saveMealWithOatsAndMilk();
        flushAndClear();

        mealRepository.deleteAll();
        flushAndClear();

        assertThat(mealRepository.count()).isZero();
        assertThat(countAllMealItems()).isZero();
    }
}
