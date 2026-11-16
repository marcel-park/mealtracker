package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.TaskItemRequest;
import io.github.marcel_park.mealtracker.dto.TaskRequest;
import io.github.marcel_park.mealtracker.dto.TaskResponse;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.Quantity;
import io.github.marcel_park.mealtracker.model.Task;
import io.github.marcel_park.mealtracker.model.TaskItem;
import io.github.marcel_park.mealtracker.model.User;
import io.github.marcel_park.mealtracker.repository.TaskCompletionRepository;
import io.github.marcel_park.mealtracker.repository.TaskRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.DayOfWeek;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static java.time.DayOfWeek.FRIDAY;
import static java.time.DayOfWeek.MONDAY;
import static java.time.DayOfWeek.WEDNESDAY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private TaskCompletionRepository completionRepository;

    @Mock
    private FoodService foodService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private RecentFoodService recentFoodService;

    private TaskService service;

    private static final Long USER_ID = 7L;
    private final User me = user(USER_ID);
    private final Food shake = food(1L, "Proteinpulver", 380.0);
    private final Food milk = food(2L, "Milch", 64.0);

    @BeforeEach
    void setUp() {
        service = new TaskService(taskRepository, completionRepository, foodService, userRepository,
                recentFoodService);
    }

    private static User user(Long id) {
        User user = new User();
        user.setId(id);
        return user;
    }

    private static Food food(Long id, String name, double kcalPer100) {
        Food food = new Food();
        food.setId(id);
        food.setName(name);
        food.setKcalPer100(kcalPer100);
        return food;
    }

    private Task task(Long id, String name, Set<DayOfWeek> weekdays) {
        Task task = new Task();
        task.setId(id);
        task.setUser(me);
        task.setName(name);
        task.setWeekdays(weekdays);
        return task;
    }

    private static TaskRequest request(String name, Set<DayOfWeek> weekdays, TaskItemRequest... items) {
        return new TaskRequest(name, weekdays, List.of(items));
    }

    @Test
    void create_storesNameWeekdaysAndFoods_sameFoodAddedUp() {
        when(userRepository.getReferenceById(USER_ID)).thenReturn(me);
        when(foodService.getVisibleEntity(USER_ID, 1L)).thenReturn(shake);
        when(foodService.getVisibleEntity(USER_ID, 2L)).thenReturn(milk);
        when(taskRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        TaskResponse result = service.create(USER_ID, request(" Proteinshake ", EnumSet.of(FRIDAY, MONDAY),
                new TaskItemRequest(1L, 30), new TaskItemRequest(2L, 200), new TaskItemRequest(1L, 10)));

        assertThat(result.name()).isEqualTo("Proteinshake");
        assertThat(result.weekdays()).containsExactly(MONDAY, FRIDAY);
        assertThat(result.items())
                .extracting(item -> item.food().id(), item -> item.amount())
                .containsExactly(tuple(1L, 40.0), tuple(2L, 200.0));
        assertThat(result.kcal()).isEqualTo(40 * 3.8 + 200 * 0.64);
    }

    @Test
    void create_countsAllItsFoodsAsUsed() {
        when(userRepository.getReferenceById(USER_ID)).thenReturn(me);
        when(foodService.getVisibleEntity(USER_ID, 1L)).thenReturn(shake);
        when(foodService.getVisibleEntity(USER_ID, 2L)).thenReturn(milk);
        when(taskRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.create(USER_ID, request("Proteinshake", EnumSet.of(MONDAY),
                new TaskItemRequest(1L, 30), new TaskItemRequest(2L, 200)));

        verify(recentFoodService).record(USER_ID, Set.of(1L, 2L));
    }

    @Test
    void update_countsOnlyTheAddedFoodsAsUsed() {
        Task existing = task(3L, "Shake", EnumSet.of(MONDAY));
        existing.addItem(shake, Quantity.ofAmount(30));
        when(taskRepository.findByIdAndUserId(3L, USER_ID)).thenReturn(Optional.of(existing));
        when(foodService.getVisibleEntity(USER_ID, 2L)).thenReturn(milk);

        service.update(USER_ID, 3L, request("Shake", EnumSet.of(MONDAY),
                new TaskItemRequest(1L, 30), new TaskItemRequest(2L, 200)));

        // what is in the task now, and what was in it before
        verify(recentFoodService).recordAdded(USER_ID, Set.of(1L, 2L), Set.of(1L));
    }

    @Test
    void create_withoutFoods_isAllowed() {
        when(userRepository.getReferenceById(USER_ID)).thenReturn(me);
        when(taskRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        TaskResponse result = service.create(USER_ID, request("Spazieren", EnumSet.allOf(DayOfWeek.class)));

        assertThat(result.items()).isEmpty();
        assertThat(result.weekdays()).hasSize(7);
    }

    @Test
    void update_changesNameAndDays_keepsUpdatesAndRemovesItemsInPlace() {
        Task existing = task(3L, "Shake", EnumSet.of(MONDAY));
        existing.addItem(shake, Quantity.ofAmount(30));
        existing.addItem(milk, Quantity.ofAmount(200));
        TaskItem shakeItem = existing.getItems().get(0);
        when(taskRepository.findByIdAndUserId(3L, USER_ID)).thenReturn(Optional.of(existing));

        service.update(USER_ID, 3L, request("Proteinshake", EnumSet.of(MONDAY, WEDNESDAY),
                new TaskItemRequest(1L, 35)));

        assertThat(existing.getName()).isEqualTo("Proteinshake");
        assertThat(existing.getWeekdays()).containsExactly(MONDAY, WEDNESDAY);
        assertThat(existing.getItems()).containsExactly(shakeItem);
        assertThat(shakeItem.getAmount()).isEqualTo(35.0);
        // Foods already in the task are not loaded again
        verify(foodService, never()).getVisibleEntity(any(), any());
    }

    @Test
    void update_taskOfSomebodyElse_isNotFound() {
        when(taskRepository.findByIdAndUserId(3L, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(USER_ID, 3L, request("X", EnumSet.of(MONDAY))))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void delete_removesTheCompletionsFirst_soTheMealsStayAsOrdinaryMeals() {
        Task existing = task(3L, "Shake", EnumSet.of(MONDAY));
        when(taskRepository.findByIdAndUserId(3L, USER_ID)).thenReturn(Optional.of(existing));

        service.delete(USER_ID, 3L);

        InOrder inOrder = inOrder(completionRepository, taskRepository);
        inOrder.verify(completionRepository).deleteByTaskId(3L);
        inOrder.verify(taskRepository).delete(existing);
    }

    @Test
    void findAll_returnsTheTasksOfTheUser() {
        when(taskRepository.findAllByUserIdOrderById(USER_ID))
                .thenReturn(List.of(task(1L, "A", EnumSet.of(MONDAY)), task(2L, "B", EnumSet.of(FRIDAY))));

        assertThat(service.findAll(USER_ID)).extracting(TaskResponse::name).containsExactly("A", "B");
    }
}
