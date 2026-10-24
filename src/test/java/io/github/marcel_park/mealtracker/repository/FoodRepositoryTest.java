package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Food;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
class FoodRepositoryTest {

    @Autowired
    private FoodRepository repository;

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
}