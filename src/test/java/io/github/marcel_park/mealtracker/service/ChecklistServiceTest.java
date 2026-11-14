package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.ChecklistEntryResponse;
import io.github.marcel_park.mealtracker.exception.InvalidRequestException;
import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.model.Meal;
import io.github.marcel_park.mealtracker.model.Quantity;
import io.github.marcel_park.mealtracker.model.Task;
import io.github.marcel_park.mealtracker.model.TaskCompletion;
import io.github.marcel_park.mealtracker.model.User;
import io.github.marcel_park.mealtracker.repository.MealRepository;
import io.github.marcel_park.mealtracker.repository.TaskCompletionRepository;
import io.github.marcel_park.mealtracker.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static java.time.DayOfWeek.MONDAY;
import static java.time.DayOfWeek.SATURDAY;
import static java.time.DayOfWeek.SUNDAY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChecklistServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private TaskCompletionRepository completionRepository;

    @Mock
    private MealRepository mealRepository;

    @Mock
    private TaskService taskService;

    private ChecklistService service;

    private static final Long USER_ID = 7L;
    // A Saturday
    private static final LocalDate DAY = LocalDate.of(2026, 11, 14);
    private final User me = new User();
    private final Food powder = food(1L, "Proteinpulver", 380.0);

    @BeforeEach
    void setUp() {
        me.setId(USER_ID);
        service = new ChecklistService(taskRepository, completionRepository, mealRepository, taskService);
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

    private static Meal meal(Long id) {
        Meal meal = new Meal();
        meal.setId(id);
        return meal;
    }

    @Test
    void get_listsTasksDueOnTheWeekday_andThoseDoneThatDay_openFirst() {
        Task weekend = task(1L, "Laufen", EnumSet.of(SATURDAY, SUNDAY));
        Task monday = task(2L, "Wiegen", EnumSet.of(MONDAY));
        Task doneButNoLongerDue = task(3L, "Shake", EnumSet.of(MONDAY));
        Task daily = task(4L, "Vitamine", EnumSet.allOf(DayOfWeek.class));
        when(taskRepository.findAllByUserIdOrderById(USER_ID))
                .thenReturn(List.of(weekend, monday, doneButNoLongerDue, daily));
        when(completionRepository.findAllByTaskUserIdAndDoneOn(USER_ID, DAY))
                .thenReturn(List.of(new TaskCompletion(doneButNoLongerDue, DAY, meal(20L))));

        List<ChecklistEntryResponse> result = service.get(USER_ID, DAY);

        assertThat(result)
                .extracting(entry -> entry.task().name(), ChecklistEntryResponse::done, ChecklistEntryResponse::mealId)
                .containsExactly(tuple("Laufen", false, null), tuple("Vitamine", false, null),
                        tuple("Shake", true, 20L));
    }

    // One task per weekday; on each day of the week of 16 to 22 November 2026 (Monday to Sunday)
    // exactly the task of that day is on the checklist.
    @ParameterizedTest(name = "{0} is a {1}")
    @CsvSource({
            "2026-11-16, MONDAY",
            "2026-11-17, TUESDAY",
            "2026-11-18, WEDNESDAY",
            "2026-11-19, THURSDAY",
            "2026-11-20, FRIDAY",
            "2026-11-21, SATURDAY",
            "2026-11-22, SUNDAY",
    })
    void get_listsTheTaskOfThatWeekdayOnly(LocalDate day, DayOfWeek weekday) {
        List<Task> oneTaskPerDay = new ArrayList<>();
        for (DayOfWeek each : DayOfWeek.values()) {
            oneTaskPerDay.add(task((long) each.getValue(), each.name(), EnumSet.of(each)));
        }
        when(taskRepository.findAllByUserIdOrderById(USER_ID)).thenReturn(oneTaskPerDay);
        when(completionRepository.findAllByTaskUserIdAndDoneOn(USER_ID, day)).thenReturn(List.of());

        List<ChecklistEntryResponse> result = service.get(USER_ID, day);

        assertThat(result).extracting(entry -> entry.task().name()).containsExactly(weekday.name());
    }

    @Test
    void complete_booksTheFoodsAsAMealTitledLikeTheTask() {
        Task shake = task(1L, "Proteinshake", EnumSet.of(SATURDAY));
        shake.addItem(powder, Quantity.ofAmount(30));
        when(taskService.getEntity(USER_ID, 1L)).thenReturn(shake);
        when(completionRepository.findByTaskIdAndDoneOn(1L, DAY)).thenReturn(Optional.empty());
        when(mealRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.complete(USER_ID, 1L, DAY);

        ArgumentCaptor<TaskCompletion> completion = ArgumentCaptor.forClass(TaskCompletion.class);
        verify(completionRepository).save(completion.capture());
        Meal meal = completion.getValue().getMeal();
        assertThat(meal.getTitle()).isEqualTo("Proteinshake");
        assertThat(meal.getUser()).isSameAs(me);
        assertThat(meal.getItems()).extracting(item -> item.getFood().getId(), item -> item.getAmount())
                .containsExactly(tuple(1L, 30.0));
        // A copy: changing the task later does not change the meal
        assertThat(meal.getItems().get(0).getQuantity()).isNotSameAs(shake.getItems().get(0).getQuantity());
        assertThat(completion.getValue().getDoneOn()).isEqualTo(DAY);
    }

    @Test
    void complete_taskWithoutFoods_isOnlyMarkedAsDone() {
        when(taskService.getEntity(USER_ID, 1L)).thenReturn(task(1L, "Laufen", EnumSet.of(SATURDAY)));
        when(completionRepository.findByTaskIdAndDoneOn(1L, DAY)).thenReturn(Optional.empty());

        service.complete(USER_ID, 1L, DAY);

        ArgumentCaptor<TaskCompletion> completion = ArgumentCaptor.forClass(TaskCompletion.class);
        verify(completionRepository).save(completion.capture());
        assertThat(completion.getValue().getMeal()).isNull();
        verify(mealRepository, never()).save(any());
    }

    @Test
    void complete_alreadyDone_booksNothingAgain() {
        Task shake = task(1L, "Proteinshake", EnumSet.of(SATURDAY));
        when(taskService.getEntity(USER_ID, 1L)).thenReturn(shake);
        when(completionRepository.findByTaskIdAndDoneOn(1L, DAY))
                .thenReturn(Optional.of(new TaskCompletion(shake, DAY, meal(20L))));

        service.complete(USER_ID, 1L, DAY);

        verify(completionRepository, never()).save(any());
        verify(mealRepository, never()).save(any());
    }

    @Test
    void complete_taskNotDueThatDay_isRejected() {
        when(taskService.getEntity(USER_ID, 1L)).thenReturn(task(1L, "Wiegen", EnumSet.of(MONDAY)));
        when(completionRepository.findByTaskIdAndDoneOn(1L, DAY)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.complete(USER_ID, 1L, DAY)).isInstanceOf(InvalidRequestException.class);

        verify(completionRepository, never()).save(any());
    }

    @Test
    void reopen_deletesTheCompletionAndThenTheMeal() {
        Task shake = task(1L, "Proteinshake", EnumSet.of(SATURDAY));
        Meal booked = meal(20L);
        TaskCompletion completion = new TaskCompletion(shake, DAY, booked);
        when(completionRepository.findByTaskIdAndDoneOn(1L, DAY)).thenReturn(Optional.of(completion));

        service.reopen(USER_ID, 1L, DAY);

        verify(taskService).getEntity(USER_ID, 1L);
        InOrder inOrder = inOrder(completionRepository, mealRepository);
        inOrder.verify(completionRepository).delete(completion);
        inOrder.verify(completionRepository).flush();
        inOrder.verify(mealRepository).delete(booked);
    }

    @Test
    void reopen_taskWithoutFoods_deletesOnlyTheCompletion() {
        TaskCompletion completion = new TaskCompletion(task(1L, "Laufen", EnumSet.of(SATURDAY)), DAY, null);
        when(completionRepository.findByTaskIdAndDoneOn(1L, DAY)).thenReturn(Optional.of(completion));

        service.reopen(USER_ID, 1L, DAY);

        verify(completionRepository).delete(completion);
        verify(mealRepository, never()).delete(any());
    }
}
