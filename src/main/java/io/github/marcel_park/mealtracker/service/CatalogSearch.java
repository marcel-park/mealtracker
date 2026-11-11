package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.CatalogScope;

import java.util.Locale;

// Turns the parameters of a food or recipe search into the arguments of FoodRepository.search
// and RecipeRepository.search.
record CatalogSearch(String namePattern, boolean ownOnly, boolean publicOnly, boolean confirmedOnly) {

    static final char ESCAPE = '!';

    // confirmedOnly combines with the scope, e.g. "own and confirmed".
    static CatalogSearch of(String query, CatalogScope scope, boolean confirmedOnly) {
        return new CatalogSearch(
                containsPattern(query),
                scope == CatalogScope.OWN,
                scope == CatalogScope.PUBLIC,
                confirmedOnly);
    }

    // "50% Fett" must find the text "50% Fett", so the LIKE wildcards typed by the user are escaped.
    // No query means every name.
    static String containsPattern(String query) {
        if (query == null || query.isBlank()) return "%";
        StringBuilder pattern = new StringBuilder("%");
        for (char c : query.trim().toLowerCase(Locale.ROOT).toCharArray()) {
            if (c == '%' || c == '_' || c == ESCAPE) pattern.append(ESCAPE);
            pattern.append(c);
        }
        return pattern.append('%').toString();
    }
}
