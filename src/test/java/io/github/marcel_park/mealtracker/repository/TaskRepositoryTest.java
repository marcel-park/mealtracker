package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.FoodPortion;
import io.github.marcel_park.mealtracker.model.Meal;
import io.github.marcel_park.mealtracker.model.Quantity;
import io.github.marcel_park.mealtracker.model.Task;
import io.github.marcel_park.mealtracker.model.TaskCompletion;
import io.github.marcel_park.mealtracker.model.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;

import static java.time.DayOfWeek.FRIDAY;
import static java.time.DayOfWeek.MONDAY;
import static org.assertj.core.api.Assertions.assertThat;

// The queries on tasks, their items and completions, run against H2.
@DataJpaTest
class TaskRepositoryTest {

    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskItemRepository taskItemRepository;
    @Autowired private TaskCompletionRepository completionRepository;
    @Autowired private FoodRepository foodRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private MealRepository mealRepository;
    @Autowired private EntityManager entityManager;

    private static final LocalDate DAY = LocalDate.of(2026, 11, 14);

    private User alice;
    private User bob;
    private Food powder;
    private FoodPortion scoop;

    @BeforeEach
    void setUp() {
        alice = saveUser("alice@example.com");
        bob = saveUser("bob@example.com");
        powder = new Food();
        powder.setName("Proteinpulver");
        powder.setKcalPer100(380);
        scoop = powder.addPortion("Messlöffel", 30, true);
        powder = foodRepository.save(powder);
    }

    private User saveUser(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash("{bcrypt}not-a-real-hash");
        return userRepository.save(user);
    }

    private Task saveTask(User user, String name, EnumSet<DayOfWeek> weekdays) {
        Task task = new Task();
        task.setUser(user);
        task.setName(name);
        task.setWeekdays(weekdays);
        task.addItem(powder, Quantity.ofPortions(scoop, BigDecimal.ONE));
        return taskRepository.save(task);
    }

    private Meal saveMeal(User user, String title) {
        Meal meal = new Meal();
        meal.setUser(user);
        meal.setTitle(title);
        meal.addItem(powder, 30);
        return mealRepository.save(meal);
    }

    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }

    @Test
    void task_keepsItsWeekdaysAndItems() {
        Task saved = saveTask(alice, "Shake", EnumSet.of(MONDAY, FRIDAY));
        flushAndClear();

        Task loaded = taskRepository.findById(saved.getId()).orElseThrow();
        assertThat(loaded.getWeekdays()).containsExactly(MONDAY, FRIDAY);
        assertThat(loaded.getItems()).hasSize(1);
        assertThat(loaded.getItems().get(0).getAmount()).isEqualTo(30.0);
        Object stored = entityManager.createNativeQuery("select weekdays from task where id = :id")
                .setParameter("id", saved.getId()).getSingleResult();
        assertThat(((Number) stored).intValue()).isEqualTo(1 + 16);
    }

    @Test
    void tasksOfAUser_onlyTheirOwn_inTheOrderTheyWereCreated() {
        saveTask(alice, "B", EnumSet.of(MONDAY));
        saveTask(bob, "Bobs", EnumSet.of(MONDAY));
        saveTask(alice, "A", EnumSet.of(MONDAY));

        assertThat(taskRepository.findAllByUserIdOrderById(alice.getId()))
                .extracting(Task::getName).containsExactly("B", "A");
    }

    @Test
    void foodUse_isFoundInTasks_alsoOfOthersAndByPortion() {
        saveTask(alice, "Shake", EnumSet.of(MONDAY));
        flushAndClear();

        assertThat(taskItemRepository.existsByFoodId(powder.getId())).isTrue();
        assertThat(taskItemRepository.existsByFoodIdAndTaskUserIdNot(powder.getId(), alice.getId())).isFalse();
        assertThat(taskItemRepository.existsByFoodIdAndTaskUserIdNot(powder.getId(), bob.getId())).isTrue();
        assertThat(taskItemRepository.findUsedFoodIds(List.of(powder.getId()))).containsExactly(powder.getId());
        assertThat(taskItemRepository.findByPortionId(scoop.getId())).hasSize(1);
    }

    @Test
    void completions_ofTheUserOnTheDay_andByMeal() {
        Task aliceTask = saveTask(alice, "Shake", EnumSet.of(MONDAY));
        Task bobTask = saveTask(bob, "Shake", EnumSet.of(MONDAY));
        Meal meal = saveMeal(alice, "Shake");
        completionRepository.save(new TaskCompletion(aliceTask, DAY, meal));
        completionRepository.save(new TaskCompletion(aliceTask, DAY.minusDays(1), null));
        completionRepository.save(new TaskCompletion(bobTask, DAY, null));
        flushAndClear();

        assertThat(completionRepository.findAllByTaskUserIdAndDoneOn(alice.getId(), DAY))
                .extracting(completion -> completion.getMeal().getId()).containsExactly(meal.getId());
        assertThat(completionRepository.findByTaskIdAndDoneOn(aliceTask.getId(), DAY)).isPresent();
        assertThat(completionRepository.existsByMealId(meal.getId())).isTrue();
        assertThat(completionRepository.findAllByMealIdIn(List.of(meal.getId()))).hasSize(1);
    }

    @Test
    void deleteByMealId_opensTheTask_deleteByTaskId_keepsTheMeals() {
        Task task = saveTask(alice, "Shake", EnumSet.of(MONDAY));
        Meal meal = saveMeal(alice, "Shake");
        completionRepository.save(new TaskCompletion(task, DAY, meal));
        completionRepository.save(new TaskCompletion(task, DAY.minusDays(1), saveMeal(alice, "Shake")));
        flushAndClear();

        completionRepository.deleteByMealId(meal.getId());
        flushAndClear();
        assertThat(completionRepository.findByTaskIdAndDoneOn(task.getId(), DAY)).isEmpty();
        assertThat(completionRepository.findByTaskIdAndDoneOn(task.getId(), DAY.minusDays(1))).isPresent();

        completionRepository.deleteByTaskId(task.getId());
        taskRepository.deleteById(task.getId());
        flushAndClear();
        assertThat(completionRepository.count()).isZero();
        assertThat(mealRepository.findAllByUserIdOrderByBookedAtDesc(alice.getId())).hasSize(2);
    }
}
