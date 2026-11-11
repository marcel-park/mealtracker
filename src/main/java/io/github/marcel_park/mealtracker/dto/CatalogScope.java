package io.github.marcel_park.mealtracker.dto;

// Whose entries the food and recipe search returns (?scope=...). Without a scope the search returns
// everything the user may see: their own entries, private or public, and all public ones.
// "Confirmed only" is a separate filter that combines with any scope (?confirmed=true).
public enum CatalogScope {
    // public entries of everybody, the user's own public ones included
    PUBLIC,
    // the user's own entries, private or public
    OWN
}
