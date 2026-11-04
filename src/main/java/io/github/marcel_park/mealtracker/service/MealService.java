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
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Every method takes the id of the logged-in user and only ever touches that user's meals.
// A meal of another user is reported as "not found", so its existence is not revealed either.
@Service
public class MealService {

    private final MealRepository mealRepository;
    private final FoodService foodService;
    private final UserRepository userRepository;

    public MealService(MealRepository mealRepository, FoodService foodService, UserRepository userRepository) {
        this.mealRepository = mealRepository;
        this.foodService = foodService;
        this.userRepository = userRepository;
    }

    // Items and their foods are loaded lazily, so toResponse() has to run inside a transaction.
    @Transactional(readOnly = true)
    public List<MealResponse> findAll(Long userId) {
        return mealRepository.findAllByUserIdOrderByBookedAtDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public MealResponse create(Long userId, MealRequest request) {
        Meal meal = new Meal();
        // A reference is enough to set the foreign key; it does not load the user.
        meal.setUser(userRepository.getReferenceById(userId));
        meal.setTitle(request.title());
        for (MealItemRequest item : request.items()) {
            meal.addItem(foodService.getEntity(item.foodId()), item.amountG());
        }
        return toResponse(mealRepository.save(meal));
    }

    @Transactional
    public MealResponse update(Long userId, Long id, MealRequest request) {
        Meal meal = getEntity(userId, id);
        meal.setTitle(request.title());

        // Update the item list in place instead of clear() + addItem() for every requested food:
        // meal_item's primary key is (meal_id, food_id) and Hibernate flushes INSERTs before
        // DELETEs, so removing a food and adding it back in one transaction would insert a
        // duplicate key.
        Map<Long, Double> requestedAmounts = sumAmountsByFoodId(request.items());
        meal.getItems().removeIf(item -> !requestedAmounts.containsKey(item.getFood().getId()));

        Map<Long, MealItem> keptItems = meal.getItems().stream()
                .collect(Collectors.toMap(item -> item.getFood().getId(), item -> item));
        requestedAmounts.forEach((foodId, amountG) -> {
            MealItem keptItem = keptItems.get(foodId);
            if (keptItem != null) {
                keptItem.setAmountG(amountG);
            } else {
                meal.addItem(foodService.getEntity(foodId), amountG);
            }
        });

        // No save() needed: the meal was loaded in this transaction, so Hibernate writes all
        // changes, including added and removed items, on commit.
        return toResponse(meal);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        mealRepository.delete(getEntity(userId, id));
    }

    // Only the meals of this user, the "reset" button of the main view.
    @Transactional
    public void deleteAll(Long userId) {
        mealRepository.deleteAllByUserId(userId);
    }

    private Meal getEntity(Long userId, Long id) {
        return mealRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Meal", id));
    }

    // A request may list the same food more than once, but a meal can hold each food only once
    // (primary key), so the amounts are added up. LinkedHashMap keeps the request order, which
    // is the order in which new items are added.
    private Map<Long, Double> sumAmountsByFoodId(List<MealItemRequest> items) {
        Map<Long, Double> amounts = new LinkedHashMap<>();
        for (MealItemRequest item : items) {
            amounts.merge(item.foodId(), item.amountG(), Double::sum);
        }
        return amounts;
    }

    private MealResponse toResponse(Meal meal) {
        List<MealItemResponse> items = meal.getItems().stream()
                .map(this::toItemResponse)
                .toList();
        double totalKcal = items.stream().mapToDouble(MealItemResponse::kcal).sum();
        return new MealResponse(
                meal.getId(), meal.getTitle(), meal.getBookedAt(), totalKcal, items);
    }

    private MealItemResponse toItemResponse(MealItem item) {
        Food food = item.getFood();
        return new MealItemResponse(food.getId(), food.getName(), item.getAmountG(), kcal(item));
    }

    // Calories are never stored. They are computed from the food's current kcalPer100g whenever
    // a response is built, so correcting a food also corrects all meals that contain it.
    private double kcal(MealItem item) {
        return item.getAmountG() * item.getFood().getKcalPer100g() / 100;
    }
}