package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.dto.FoodRequest;
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

    public List<FoodResponse> find(String query) {
        List<Food> foods = (query == null || query.isBlank())
                ? repository.findAll()
                : repository.findByNameContainingIgnoreCase(query);
        return foods.stream().map(FoodResponse::from).toList();
    }

    public FoodResponse get(Long id) {
        return FoodResponse.from(getEntity(id));
    }

    public FoodResponse create(FoodRequest request) {
        Food food = new Food();
        apply(request, food);
        return FoodResponse.from(repository.save(food));
    }

    public FoodResponse update(Long id, FoodRequest request) {
        Food food = getEntity(id);
        apply(request, food);
        return FoodResponse.from(repository.save(food));
    }

    public void delete(Long id) {
        repository.delete(getEntity(id));
    }

    private Food getEntity(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Food not found"));
    }

    private void apply(FoodRequest request, Food food) {
        food.setName(request.name());
        food.setKcalPer100g(request.kcalPer100g());
        food.setProtein(request.protein());
        food.setCarbs(request.carbs());
        food.setFat(request.fat());
    }
}