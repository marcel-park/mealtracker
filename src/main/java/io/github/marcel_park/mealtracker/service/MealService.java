package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.dto.MealItemRequest;
import io.github.marcel_park.mealtracker.dto.MealItemResponse;
import io.github.marcel_park.mealtracker.dto.MealRequest;
import io.github.marcel_park.mealtracker.dto.MealResponse;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.Meal;
import io.github.marcel_park.mealtracker.model.MealItem;
import io.github.marcel_park.mealtracker.repository.MealRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Every method takes the id of the logged-in user and only ever touches that user's meals.
// A meal of another user is reported as "not found", so its existence is not revealed either.
// Foods can only be added if the user may see them (own or public ones, see FoodService).
// A recipe is booked by the app as its foods with scaled amounts, so meals know no recipes. The
// request only says which recipes (and variations) were booked, for the preselection next time.
@Service
public class MealService {

    private final MealRepository mealRepository;
    private final FoodService foodService;
    private final UserRepository userRepository;
    private final RecipeService recipeService;

    public MealService(MealRepository mealRepository, FoodService foodService, UserRepository userRepository,
                       RecipeService recipeService) {
        this.mealRepository = mealRepository;
        this.foodService = foodService;
        this.userRepository = userRepository;
        this.recipeService = recipeService;
    }

    // Items and their foods are loaded lazily, so toResponse() has to run inside a transaction.
    @Transactional(readOnly = true)
    public List<MealResponse> findAll(Long userId) {
        return mealRepository.findAllByUserIdOrderByBookedAtDesc(userId).stream()
                .map(meal -> toResponse(meal, userId))
                .toList();
    }

    // The meals booked on that day, from 0:00 up to 0:00 of the next day, newest first. The main
    // view shows only today's meals, so its list starts empty every day at midnight. The app sends
    // its local date, and bookedAt is the server's local time: both have to be in the same zone.
    @Transactional(readOnly = true)
    public List<MealResponse> findBookedOn(Long userId, LocalDate day) {
        return mealRepository.findAllBookedBetween(userId, day.atStartOfDay(), day.plusDays(1).atStartOfDay())
                .stream()
                .map(meal -> toResponse(meal, userId))
                .toList();
    }

    @Transactional
    public MealResponse create(Long userId, MealRequest request) {
        Meal meal = new Meal();
        // A reference is enough to set the foreign key; it does not load the user.
        meal.setUser(userRepository.getReferenceById(userId));
        meal.setTitle(request.title());
        for (MealItemRequest item : request.items()) {
            meal.addItem(foodService.getVisibleEntity(userId, item.foodId()), item.amount());
        }
        MealResponse response = toResponse(mealRepository.save(meal), userId);
        recipeService.markUsed(userId, request.recipes());
        return response;
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
        requestedAmounts.forEach((foodId, amount) -> {
            MealItem keptItem = keptItems.get(foodId);
            if (keptItem != null) {
                keptItem.setAmount(amount);
            } else {
                meal.addItem(foodService.getVisibleEntity(userId, foodId), amount);
            }
        });

        recipeService.markUsed(userId, request.recipes());

        // No save() needed: the meal was loaded in this transaction, so Hibernate writes all
        // changes, including added and removed items, on commit.
        return toResponse(meal, userId);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        mealRepository.delete(getEntity(userId, id));
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
            amounts.merge(item.foodId(), item.amount(), Double::sum);
        }
        return amounts;
    }

    private MealResponse toResponse(Meal meal, Long userId) {
        List<MealItemResponse> items = meal.getItems().stream()
                .map(item -> toItemResponse(item, userId))
                .toList();
        double totalKcal = items.stream().mapToDouble(MealItemResponse::kcal).sum();
        return new MealResponse(
                meal.getId(), meal.getTitle(), meal.getBookedAt(), totalKcal, items);
    }

    private MealItemResponse toItemResponse(MealItem item, Long userId) {
        return new MealItemResponse(
                FoodResponse.ofUsed(item.getFood(), userId), item.getAmount(), kcal(item));
    }

    // Calories are never stored. They are computed from the food's current kcalPer100 whenever
    // a response is built, so correcting a food also corrects all meals that contain it.
    private double kcal(MealItem item) {
        return item.getAmount() * item.getFood().getKcalPer100() / 100;
    }
}