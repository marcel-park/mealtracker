package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.Meal;
import io.github.marcel_park.mealtracker.model.MealItem;
import io.github.marcel_park.mealtracker.model.User;
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
    private UserRepository userRepository;

    @Autowired
    private EntityManager entityManager;

    private Food oats;
    private Food milk;
    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        oats = saveFood("Haferflocken", 372.0);
        milk = saveFood("Milch", 64.0);
        alice = saveUser("alice@example.com");
        bob = saveUser("bob@example.com");
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

    private User saveUser(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("{bcrypt}not-a-real-hash");
        return userRepository.save(user);
    }

    private Meal saveMeal(User owner, String title, LocalDateTime bookedAt) {
        Meal meal = new Meal();
        meal.setUser(owner);
        meal.setTitle(title);
        meal.setBookedAt(bookedAt);
        return mealRepository.save(meal);
    }

    private Meal saveMealWithOatsAndMilk(User owner) {
        Meal meal = new Meal();
        meal.setUser(owner);
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
    void findAllByUserIdOrderByBookedAtDesc_returnsNewestMealFirst() {
        saveMeal(alice, "Frühstück", LocalDateTime.of(2026, 11, 3, 8, 0));
        saveMeal(alice, "Abendessen", LocalDateTime.of(2026, 11, 3, 19, 0));
        saveMeal(alice, "Mittagessen", LocalDateTime.of(2026, 11, 3, 12, 0));

        List<Meal> result = mealRepository.findAllByUserIdOrderByBookedAtDesc(alice.getId());

        assertThat(result).extracting(Meal::getTitle)
                .containsExactly("Abendessen", "Mittagessen", "Frühstück");
    }

    @Test
    void findAllByUserIdOrderByBookedAtDesc_leavesOutMealsOfOtherUsers() {
        saveMeal(alice, "Alices Frühstück", LocalDateTime.of(2026, 11, 3, 8, 0));
        saveMeal(bob, "Bobs Frühstück", LocalDateTime.of(2026, 11, 3, 9, 0));

        List<Meal> result = mealRepository.findAllByUserIdOrderByBookedAtDesc(alice.getId());

        assertThat(result).extracting(Meal::getTitle).containsExactly("Alices Frühstück");
    }

    @Test
    void findByIdAndUserId_findsOwnMealButNotThatOfAnotherUser() {
        Long mealId = saveMeal(alice, "Frühstück", LocalDateTime.of(2026, 11, 3, 8, 0)).getId();

        assertThat(mealRepository.findByIdAndUserId(mealId, alice.getId())).isPresent();
        assertThat(mealRepository.findByIdAndUserId(mealId, bob.getId())).isEmpty();
    }

    @Test
    void findAllBookedBetween_includesTheStartButNotTheEnd() {
        saveMeal(alice, "Gestern spät", LocalDateTime.of(2026, 11, 2, 23, 59, 59));
        saveMeal(alice, "Mitternacht", LocalDateTime.of(2026, 11, 3, 0, 0));
        saveMeal(alice, "Frühstück", LocalDateTime.of(2026, 11, 3, 8, 0));
        saveMeal(alice, "Abendessen", LocalDateTime.of(2026, 11, 3, 23, 59, 59));
        saveMeal(alice, "Morgen", LocalDateTime.of(2026, 11, 4, 0, 0));

        List<Meal> result = mealRepository.findAllBookedBetween(alice.getId(),
                LocalDateTime.of(2026, 11, 3, 0, 0), LocalDateTime.of(2026, 11, 4, 0, 0));

        assertThat(result).extracting(Meal::getTitle)
                .containsExactly("Abendessen", "Frühstück", "Mitternacht");
    }

    @Test
    void findAllBookedBetween_leavesOutMealsOfOtherUsers() {
        saveMeal(alice, "Alices Frühstück", LocalDateTime.of(2026, 11, 3, 8, 0));
        saveMeal(bob, "Bobs Frühstück", LocalDateTime.of(2026, 11, 3, 9, 0));

        List<Meal> result = mealRepository.findAllBookedBetween(alice.getId(),
                LocalDateTime.of(2026, 11, 3, 0, 0), LocalDateTime.of(2026, 11, 4, 0, 0));

        assertThat(result).extracting(Meal::getTitle).containsExactly("Alices Frühstück");
    }

    @Test
    void assignOwnerlessMealsTo_givesMealsWithoutOwnerToTheUser() {
        // owner null = booked before multi-user support
        Long ownMealId = saveMeal(bob, "Bobs Frühstück", LocalDateTime.of(2026, 11, 3, 8, 0)).getId();
        Long oldMealId = saveMeal(null, "Alte Mahlzeit", LocalDateTime.of(2026, 11, 2, 8, 0)).getId();
        flushAndClear();

        int assigned = mealRepository.assignOwnerlessMealsTo(alice);
        flushAndClear();

        assertThat(assigned).isEqualTo(1);
        assertThat(mealRepository.findAllByUserIdOrderByBookedAtDesc(alice.getId()))
                .extracting(Meal::getId).containsExactly(oldMealId);
        assertThat(mealRepository.findAllByUserIdOrderByBookedAtDesc(bob.getId()))
                .extracting(Meal::getId).containsExactly(ownMealId);
    }

    @Test
    void save_cascadesItemsWithCompositeKeyOfMealAndFood() {
        Meal saved = saveMealWithOatsAndMilk(alice);
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
        Long mealId = saveMealWithOatsAndMilk(alice).getId();
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
        Long mealId = saveMealWithOatsAndMilk(alice).getId();
        flushAndClear();

        mealRepository.delete(mealRepository.findById(mealId).orElseThrow());
        flushAndClear();

        assertThat(countMealItemsOf(mealId)).isZero();
        assertThat(foodRepository.findAllById(List.of(oats.getId(), milk.getId()))).hasSize(2);
    }

    @Test
    void deleteAll_removesAllMealItems() {
        // deleteAll() removes meal by meal, so the cascade to meal_item applies
        // (deleteAllInBatch() would bypass it).
        saveMealWithOatsAndMilk(alice);
        saveMealWithOatsAndMilk(bob);
        flushAndClear();

        mealRepository.deleteAll();
        flushAndClear();

        assertThat(mealRepository.count()).isZero();
        assertThat(countAllMealItems()).isZero();
    }
}
