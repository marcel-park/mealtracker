package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.UserItem;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// name: stored trimmed; unique per user regardless of case (see UserItemService).
public record UserItemRequest(@NotBlank @Size(max = UserItem.MAX_NAME_LENGTH) String name) {}
