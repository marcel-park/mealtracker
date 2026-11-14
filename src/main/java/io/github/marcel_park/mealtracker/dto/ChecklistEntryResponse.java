package io.github.marcel_park.mealtracker.dto;

// A task on the checklist of a day. done: ticked off that day. mealId: the meal it booked then,
// null if it is open or has no foods.
public record ChecklistEntryResponse(
        TaskResponse task,
        boolean done,
        Long mealId) {}
