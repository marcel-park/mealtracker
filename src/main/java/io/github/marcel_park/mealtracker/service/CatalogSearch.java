package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.CatalogScope;

import java.util.Locale;

// Turns the parameters of a food or recipe search into the arguments of FoodRepository.search
// and RecipeRepository.search.
// eanCode: the query if it looks like an EAN (8 to 14 digits, e.g. from the barcode scanner), else
// null; foods are then also found by their EAN.
// "Confirmed only" exists for foods only and is passed to FoodRepository.search directly.
record CatalogSearch(String namePattern, String eanCode, boolean ownOnly, boolean publicOnly) {

    static final char ESCAPE = '!';

    static CatalogSearch of(String query, CatalogScope scope) {
        return new CatalogSearch(
                containsPattern(query),
                eanCode(query),
                scope == CatalogScope.OWN,
                scope == CatalogScope.PUBLIC);
    }

    static String eanCode(String query) {
        if (query == null) return null;
        String trimmed = query.trim();
        return trimmed.matches("\\d{8,14}") ? trimmed : null;
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
