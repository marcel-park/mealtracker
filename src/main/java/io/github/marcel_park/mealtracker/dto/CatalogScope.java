package io.github.marcel_park.mealtracker.dto;

// Whose entries the food and recipe search returns (?scope=...). Without a scope the search returns
// everything the user may see: their own entries, private or public, and all public ones.
// RECENT: the foods the user booked last, most recent first (see FoodService.find). Recipes are not
// recorded as booked (a meal only holds their foods), so for them RECENT finds nothing.
// "Confirmed only" is a separate filter for foods (?confirmed=true); there are no confirmed recipes.
public enum CatalogScope {
    // public entries of everybody, the user's own public ones included
    PUBLIC,
    // the user's own entries, private or public
    OWN,
    // the foods the user booked last
    RECENT
}
