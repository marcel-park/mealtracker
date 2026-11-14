package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Set;

// weekdays: the days the task is on the checklist, at least one ("MONDAY", ...). items: the foods
// it books when ticked off, all of them the task should have afterwards; may be empty, then
// ticking off only marks it as done.
public record TaskRequest(
        @NotBlank @Size(max = 100) String name,
        @NotEmpty Set<@NotNull DayOfWeek> weekdays,
        // The limit only guards against absurd requests.
        @NotNull @Size(max = 50) List<@Valid @NotNull TaskItemRequest> items) {}
