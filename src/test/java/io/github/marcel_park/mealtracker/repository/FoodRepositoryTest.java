package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.Meal;
import jakarta.persistence.EntityManager;
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
    private EntityManager entityManager;

    private Food save(String name) {
        Food f = new Food();
        f.setName(name);
        f.setKcalPer100g(100);
        f.setProtein(5);
        f.setCarbs(10);
        f.setFat(2);
        return repository.save(f);
    }

    @Test
    void findByNameContainingIgnoreCase_matchesPartOfNameIgnoringCase() {
        save("Haferflocken");
        save("Haferdrink");
        save("Apfel");

        List<Food> result = repository.findByNameContainingIgnoreCase("HAFER");

        assertThat(result).extracting(Food::getName)
                .containsExactlyInAnyOrder("Haferflocken", "Haferdrink");
    }

    @Test
    void findByNameContainingIgnoreCase_noMatch_returnsEmptyList() {
        save("Apfel");

        List<Food> result = repository.findByNameContainingIgnoreCase("xyz");

        assertThat(result).isEmpty();
    }

    @Test
    void save_assignsGeneratedId() {
        Food saved = save("Apfel");

        assertThat(saved.getId()).isNotNull();
        assertThat(repository.findById(saved.getId())).isPresent();
    }

    @Test
    void delete_foodStillUsedInMeal_isRejectedByDatabase() {
        // FoodService.delete relies on this: meal_item.food_id references food with ON DELETE RESTRICT.
        Food oats = save("Haferflocken");
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