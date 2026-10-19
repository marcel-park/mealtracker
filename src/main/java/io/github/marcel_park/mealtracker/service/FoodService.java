package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.repository.FoodRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;

@Service
public class FoodService {

    private final FoodRepository repository;

    public FoodService(FoodRepository repository) {
        this.repository = repository;
    }

    public List<Food> find(String query) {
        if (query == null || query.isBlank()) {
            return repository.findAll();
        }
        return repository.findByNameContainingIgnoreCase(query);
    }

    public Food get(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Food not found"));
    }

    public Food create(Food food) {
        food.setId(null);
        return repository.save(food);
    }

    public void delete(Long id) {
        repository.delete(get(id));
    }
}