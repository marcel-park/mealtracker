package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.FoodRequest;
import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.repository.FoodRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class FoodService {

    private final FoodRepository foodRepository;

    public FoodService(FoodRepository foodRepository) {
        this.foodRepository = foodRepository;
    }

    @Transactional(readOnly = true)
    public List<FoodResponse> find(String query) {
        List<Food> foods = (query == null || query.isBlank())
                ? foodRepository.findAll()
                : foodRepository.findByNameContainingIgnoreCase(query);
        return foods.stream().map(FoodResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public FoodResponse get(Long id) {
        return FoodResponse.from(getEntity(id));
    }

    @Transactional
    public FoodResponse create(FoodRequest request) {
        Food food = new Food();
        apply(request, food);
        return FoodResponse.from(foodRepository.save(food));
    }

    @Transactional
    public FoodResponse update(Long id, FoodRequest request) {
        Food food = getEntity(id);
        apply(request, food);
        return FoodResponse.from(foodRepository.save(food));
    }

    // While a meal still contains this food, the database rejects the delete
    // (meal_item.food_id is ON DELETE RESTRICT).
    @Transactional
    public void delete(Long id) {
        foodRepository.delete(getEntity(id));
    }

    // Package-private on purpose: MealService needs the entity to attach it to meal items,
    // while callers outside this package only ever get DTOs.
    Food getEntity(Long id) {
        return foodRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Food", id));
    }

    private void apply(FoodRequest request, Food food) {
        food.setName(request.name());
        food.setKcalPer100g(request.kcalPer100g());
        food.setProtein(request.protein());
        food.setCarbs(request.carbs());
        food.setFat(request.fat());
    }
}