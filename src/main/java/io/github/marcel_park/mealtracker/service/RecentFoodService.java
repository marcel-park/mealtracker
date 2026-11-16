package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.model.RecentFood;
import io.github.marcel_park.mealtracker.model.RecentFoodId;
import io.github.marcel_park.mealtracker.repository.RecentFoodRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

// Remembers which foods a user used last, for the search filter "Zuletzt" (see FoodService.find).
// A food counts as used when it is booked (also by ticking off a task) or added to a recipe, a
// variation, a task or the shopping list, at the time this happens (not the time a meal is booked
// for). Changing a meal, recipe, variation or task only counts the foods added to it (see
// recordAdded): saving a recipe with a new name does not push all its ingredients up.
@Service
public class RecentFoodService {

    private final RecentFoodRepository repository;

    public RecentFoodService(RecentFoodRepository repository) {
        this.repository = repository;
    }

    // The foods (ids) were used now.
    @Transactional
    public void record(Long userId, Collection<Long> foodIds) {
        if (foodIds.isEmpty()) return;
        LocalDateTime now = LocalDateTime.now();
        List<RecentFoodId> ids = foodIds.stream().distinct().map(foodId -> new RecentFoodId(userId, foodId)).toList();
        Map<RecentFoodId, RecentFood> known = repository.findAllById(ids).stream()
                .collect(Collectors.toMap(RecentFood::getId, Function.identity()));
        for (RecentFoodId id : ids) {
            RecentFood recent = known.get(id);
            if (recent != null) {
                recent.setUsedAt(now);
            } else {
                repository.save(new RecentFood(id, now));
            }
        }
    }

    // After a change: the foods now in it (ids) that were not in it before were used now.
    @Transactional
    public void recordAdded(Long userId, Collection<Long> foodIds, Collection<Long> foodIdsBefore) {
        record(userId, foodIds.stream().filter(foodId -> !foodIdsBefore.contains(foodId)).toList());
    }
}
