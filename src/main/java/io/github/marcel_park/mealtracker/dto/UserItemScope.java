package io.github.marcel_park.mealtracker.dto;

// Whose user items the search returns (?scope=...). Without a scope: everything the user may see,
// i.e. their own items and those their friends share. User items are never public and are not
// recorded as booked, so there is no PUBLIC or RECENT here (see CatalogScope for foods and recipes).
public enum UserItemScope {
    // the user's own items
    OWN,
    // the items friends share with the user (none yet: friends do not exist yet)
    FRIENDS
}
