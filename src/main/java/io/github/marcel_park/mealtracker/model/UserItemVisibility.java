package io.github.marcel_park.mealtracker.model;

// Who sees the user items of a user (one setting for all of them, see User): only the owner, or
// their friends as well. User items are never public.
public enum UserItemVisibility {
    PRIVATE,
    FRIENDS
}
