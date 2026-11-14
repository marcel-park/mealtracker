package io.github.marcel_park.mealtracker.model;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.DayOfWeek;
import java.util.EnumSet;

import static org.assertj.core.api.Assertions.assertThat;

// The weekdays of a task: one bit per day in the column weekdays (Monday 1 ... Sunday 64).
class TaskTest {

    private static Task taskOn(EnumSet<DayOfWeek> days) {
        Task task = new Task();
        task.setWeekdays(days);
        return task;
    }

    @ParameterizedTest(name = "{0} is stored as {1}")
    @CsvSource({
            "MONDAY, 1",
            "TUESDAY, 2",
            "WEDNESDAY, 4",
            "THURSDAY, 8",
            "FRIDAY, 16",
            "SATURDAY, 32",
            "SUNDAY, 64",
    })
    void eachDay_hasItsOwnBit(DayOfWeek day, int bit) {
        Task task = taskOn(EnumSet.of(day));

        assertThat(ReflectionTestUtils.getField(task, "weekdays")).isEqualTo(bit);
    }

    @ParameterizedTest
    @EnumSource(DayOfWeek.class)
    void taskOnOneDay_isDueOnThatDayOnly(DayOfWeek day) {
        Task task = taskOn(EnumSet.of(day));

        for (DayOfWeek other : DayOfWeek.values()) {
            assertThat(task.isDueOn(other)).as(other.toString()).isEqualTo(other == day);
        }
        assertThat(task.getWeekdays()).containsExactly(day);
    }

    @Test
    void everyDay_isStoredAs127_andReadBackInWeekOrder() {
        Task task = taskOn(EnumSet.allOf(DayOfWeek.class));

        assertThat(ReflectionTestUtils.getField(task, "weekdays")).isEqualTo(127);
        assertThat(task.getWeekdays()).containsExactly(DayOfWeek.values());
    }

    @Test
    void changingTheDays_replacesThemAll() {
        Task task = taskOn(EnumSet.of(DayOfWeek.MONDAY, DayOfWeek.FRIDAY));

        task.setWeekdays(EnumSet.of(DayOfWeek.SUNDAY));

        assertThat(task.getWeekdays()).containsExactly(DayOfWeek.SUNDAY);
        assertThat(task.isDueOn(DayOfWeek.MONDAY)).isFalse();
    }
}
