package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.UserItem;

// owned: the item belongs to the requesting user, who alone may rename or delete it.
public record UserItemResponse(Long id, String name, boolean owned) {

    public static UserItemResponse from(UserItem item, Long userId) {
        return new UserItemResponse(item.getId(), item.getName(), item.isOwnedBy(userId));
    }
}
