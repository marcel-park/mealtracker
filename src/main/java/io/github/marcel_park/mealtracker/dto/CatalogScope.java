package io.github.marcel_park.mealtracker.dto;

// Filter of the food and recipe search (?scope=...). Without a scope the search returns
// everything the user may see: their own entries, private or public, and all public ones.
public enum CatalogScope {
    // public entries of everybody, the user's own public ones included
    PUBLIC,
    // the user's own entries, private or public
    OWN,
    // entries checked by an official source
    CONFIRMED
}
