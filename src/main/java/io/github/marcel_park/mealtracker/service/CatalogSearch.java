package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.CatalogScope;
import io.github.marcel_park.mealtracker.exception.InvalidRequestException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.Locale;

// Turns the parameters of a food or recipe search into the arguments of FoodRepository.search
// and RecipeRepository.search.
// eanCode: the query if it looks like an EAN (8 to 14 digits, e.g. from the barcode scanner), else
// null; foods are then also found by their EAN.
// "Confirmed only" exists for foods only and is passed to FoodRepository.search directly.
record CatalogSearch(String namePattern, String eanCode, boolean ownOnly, boolean publicOnly) {

    static final char ESCAPE = '!';

    // The results come in pages (?page=0, 1, ... of ?size= entries), so a search for "a" does not
    // send the whole database; the app loads the next page while the list is scrolled.
    static final int MAX_PAGE_SIZE = 100;

    static Pageable page(int page, int size) {
        if (page < 0) throw new InvalidRequestException("page must not be negative");
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new InvalidRequestException("size must be between 1 and " + MAX_PAGE_SIZE);
        }
        return PageRequest.of(page, size);
    }

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
