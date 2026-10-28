package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.MealItemRequest;
import io.github.marcel_park.mealtracker.dto.MealItemResponse;
import io.github.marcel_park.mealtracker.dto.MealRequest;
import io.github.marcel_park.mealtracker.dto.MealResponse;
import io.github.marcel_park.mealtracker.model.Meal;
import io.github.marcel_park.mealtracker.model.MealItem;
import io.github.marcel_park.mealtracker.repository.MealRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class MealService {

    private final MealRepository mealRepository;
    private final FoodService foodService;

    public MealService(MealRepository mealRepository, FoodService foodService) {
        this.mealRepository = mealRepository;
        this.foodService = foodService;
    }

    @Transactional
    public MealResponse book(MealRequest request) {
        Meal meal = new Meal();
        meal.setTitle(request.title());

        for (MealItemRequest item : request.items()) {
            meal.addItem(foodService.getEntity(item.foodId()), item.amountG());
        }

        return toResponse(mealRepository.save(meal));
    }

    @Transactional(readOnly = true)
    public List<MealResponse> findAll() {
        return mealRepository.findAllByOrderByBookedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void cancel(Long id) {
        if (!mealRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Meal not found: " + id);
        }
        mealRepository.deleteById(id);
    }

    private MealResponse toResponse(Meal meal) {
        List<MealItemResponse> items = meal.getItems().stream()
                .map(item -> new MealItemResponse(
                        item.getFood().getId(),
                        item.getFood().getName(),
                        item.getAmountG(),
                        kcal(item)))
                .toList();
        double total = items.stream().mapToDouble(MealItemResponse::kcal).sum();
        return new MealResponse(meal.getId(), meal.getTitle(), meal.getBookedAt(), total, items);
    }

    private double kcal(MealItem item) {
        return item.getAmountG() * item.getFood().getKcalPer100g() / 100;
    }
}
