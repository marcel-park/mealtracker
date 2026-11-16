package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.dto.MealItemResponse;
import io.github.marcel_park.mealtracker.dto.MealRequest;
import io.github.marcel_park.mealtracker.dto.MealResponse;
import io.github.marcel_park.mealtracker.exception.InvalidRequestException;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.Meal;
import io.github.marcel_park.mealtracker.model.MealItem;
import io.github.marcel_park.mealtracker.model.Quantity;
import io.github.marcel_park.mealtracker.repository.MealRepository;
import io.github.marcel_park.mealtracker.repository.TaskCompletionRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// Every method takes the id of the logged-in user and only ever touches that user's meals.
// A meal of another user is reported as "not found", so its existence is not revealed either.
// Foods can only be added if the user may see them (own or public ones, see FoodService).
// A meal booked by ticking off a task (see ChecklistService) can only be deleted as a whole;
// deleting it opens the task again.
// A recipe is booked by the app as its foods with scaled amounts, so meals know no recipes. The
// request only says which recipes (and variations) were booked, for the preselection next time.
@Service
public class MealService {

    private final MealRepository mealRepository;
    private final FoodService foodService;
    private final UserRepository userRepository;
    private final RecipeService recipeService;
    private final TaskCompletionRepository completionRepository;
    private final RecentFoodService recentFoodService;

    public MealService(MealRepository mealRepository, FoodService foodService, UserRepository userRepository,
                       RecipeService recipeService, TaskCompletionRepository completionRepository,
                       RecentFoodService recentFoodService) {
        this.mealRepository = mealRepository;
        this.foodService = foodService;
        this.userRepository = userRepository;
        this.recipeService = recipeService;
        this.completionRepository = completionRepository;
        this.recentFoodService = recentFoodService;
    }

    // Items and their foods are loaded lazily, so toResponse() has to run inside a transaction.
    @Transactional(readOnly = true)
    public List<MealResponse> findAll(Long userId) {
        return toResponses(mealRepository.findAllByUserIdOrderByBookedAtDesc(userId), userId);
    }

    // The meals booked on that day, from 0:00 up to 0:00 of the next day, newest first. The main
    // view shows only today's meals, so its list starts empty every day at midnight. The app sends
    // its local date, and bookedAt is the server's local time: both have to be in the same zone.
    @Transactional(readOnly = true)
    public List<MealResponse> findBookedOn(Long userId, LocalDate day) {
        return toResponses(
                mealRepository.findAllBookedBetween(userId, day.atStartOfDay(), day.plusDays(1).atStartOfDay()),
                userId);
    }

    @Transactional
    public MealResponse create(Long userId, MealRequest request) {
        Meal meal = new Meal();
        // A reference is enough to set the foreign key; it does not load the user.
        meal.setUser(userRepository.getReferenceById(userId));
        meal.setTitle(request.title());
        Map<Long, RequestedQuantities.Requested> requested = RequestedQuantities.byFoodId(request.items(),
                foodId -> foodService.getVisibleEntity(userId, foodId));
        requested.values().forEach(wanted -> meal.addItem(wanted.food(), wanted.quantity()));
        MealResponse response = toResponse(mealRepository.save(meal), userId, null);
        recipeService.markUsed(userId, request.recipes());
        recentFoodService.record(userId, requested.keySet());
        return response;
    }

    @Transactional
    public MealResponse update(Long userId, Long id, MealRequest request) {
        Meal meal = getEntity(userId, id);
        if (completionRepository.existsByMealId(id)) {
            throw new InvalidRequestException("Meal with id " + id + " was booked by a task and can only be deleted");
        }
        meal.setTitle(request.title());

        // Update the item list in place instead of clear() + addItem() for every requested food:
        // meal_item's primary key is (meal_id, food_id) and Hibernate flushes INSERTs before
        // DELETEs, so removing a food and adding it back in one transaction would insert a
        // duplicate key.
        // Foods already in the meal are not loaded again; the user saw them when booking.
        Map<Long, MealItem> keptItems = meal.getItems().stream()
                .collect(Collectors.toMap(item -> item.getFood().getId(), item -> item));
        Map<Long, RequestedQuantities.Requested> requested = RequestedQuantities.byFoodId(request.items(),
                foodId -> keptItems.containsKey(foodId)
                        ? keptItems.get(foodId).getFood()
                        : foodService.getVisibleEntity(userId, foodId));
        meal.getItems().removeIf(item -> !requested.containsKey(item.getFood().getId()));

        requested.forEach((foodId, wanted) -> {
            MealItem keptItem = keptItems.get(foodId);
            if (keptItem != null) {
                keptItem.setQuantity(wanted.quantity());
            } else {
                meal.addItem(wanted.food(), wanted.quantity());
            }
        });

        recipeService.markUsed(userId, request.recipes());
        recentFoodService.recordAdded(userId, requested.keySet(), keptItems.keySet());

        // No save() needed: the meal was loaded in this transaction, so Hibernate writes all
        // changes, including added and removed items, on commit.
        return toResponse(meal, userId, null);
    }

    // A meal booked by a task: the task is open again.
    @Transactional
    public void delete(Long userId, Long id) {
        Meal meal = getEntity(userId, id);
        completionRepository.deleteByMealId(id);
        mealRepository.delete(meal);
    }

    private Meal getEntity(Long userId, Long id) {
        return mealRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Meal", id));
    }

    // With the task of each meal, found with one query for all of them.
    private List<MealResponse> toResponses(List<Meal> meals, Long userId) {
        if (meals.isEmpty()) {
            return List.of(); // "in ()" is no valid SQL
        }
        Map<Long, Long> taskIds = completionRepository.findAllByMealIdIn(meals.stream().map(Meal::getId).toList())
                .stream()
                .collect(Collectors.toMap(completion -> completion.getMeal().getId(),
                        completion -> completion.getTask().getId()));
        return meals.stream()
                .map(meal -> toResponse(meal, userId, taskIds.get(meal.getId())))
                .toList();
    }

    private MealResponse toResponse(Meal meal, Long userId, Long taskId) {
        List<MealItemResponse> items = meal.getItems().stream()
                .map(item -> toItemResponse(item, userId))
                .toList();
        double totalKcal = items.stream().mapToDouble(MealItemResponse::kcal).sum();
        return new MealResponse(
                meal.getId(), meal.getTitle(), meal.getBookedAt(), totalKcal, items, taskId);
    }

    private MealItemResponse toItemResponse(MealItem item, Long userId) {
        Quantity quantity = item.getQuantity();
        return new MealItemResponse(
                FoodResponse.ofUsed(item.getFood(), userId),
                item.getAmount(),
                quantity.getPortionId(),
                quantity.getPortionCount(),
                kcal(item));
    }

    // Calories are never stored. They are computed from the food's current kcalPer100 whenever
    // a response is built, so correcting a food also corrects all meals that contain it.
    private double kcal(MealItem item) {
        return item.getAmount() * item.getFood().getKcalPer100() / 100;
    }
}