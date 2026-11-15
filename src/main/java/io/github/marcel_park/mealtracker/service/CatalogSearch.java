package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.CatalogScope;
import io.github.marcel_park.mealtracker.exception.InvalidRequestException;
import io.github.marcel_park.mealtracker.repository.NamePatterns;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

// Turns the parameters of a food, recipe or user item search into the arguments of the repositories.
// namePatterns: see namePatterns.
// eanCode: the query if it looks like an EAN (8 to 14 digits, e.g. from the barcode scanner), else
// null; foods are then also found by their EAN.
// "Confirmed only" exists for foods only and is passed to FoodRepository.search directly.
record CatalogSearch(List<String> namePatterns, String eanCode, boolean ownOnly, boolean publicOnly) {

    static final char ESCAPE = '!';

    // Spaces and commas separate the terms of the search text.
    private static final Pattern TERM_SEPARATORS = Pattern.compile("[\\s,]+");

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
                namePatterns(query),
                eanCode(query),
                scope == CatalogScope.OWN,
                scope == CatalogScope.PUBLIC);
    }

    static String eanCode(String query) {
        if (query == null) return null;
        String trimmed = query.trim();
        return trimmed.matches("\\d{8,14}") ? trimmed : null;
    }

    // One LIKE pattern per term of the search text, in lower case: every term has to occur somewhere
    // in the name, in any order. "apri ro" finds "Paprika, rot"; "paprika rot" finds "Paprika, rot"
    // and "Rote Paprika", but not "Brot" (no "paprika" in it). The LIKE wildcards typed by the user
    // are escaped, so "50%" finds the text "50%". At most NamePatterns.MAX terms, the same one once.
    // No query or only separators: no pattern, every name.
    static List<String> namePatterns(String query) {
        List<String> patterns = new ArrayList<>();
        if (query == null) return patterns;
        for (String term : TERM_SEPARATORS.split(query.trim().toLowerCase(Locale.ROOT))) {
            String pattern = containsPattern(term);
            if (!term.isEmpty() && !patterns.contains(pattern) && patterns.size() < NamePatterns.MAX) {
                patterns.add(pattern);
            }
        }
        return patterns;
    }

    private static String containsPattern(String term) {
        StringBuilder pattern = new StringBuilder("%");
        for (char c : term.toCharArray()) {
            if (c == '%' || c == '_' || c == ESCAPE) pattern.append(ESCAPE);
            pattern.append(c);
        }
        return pattern.append('%').toString();
    }
}
