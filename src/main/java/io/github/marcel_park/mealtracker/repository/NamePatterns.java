package io.github.marcel_park.mealtracker.repository;

import java.util.List;

// The search text of a food, recipe or user item search as LIKE patterns, one per term (see
// CatalogSearch.namePatterns): every pattern must match the name, in any order. The queries take
// up to MAX patterns as separate parameters; one that is not given (null) is left out.
public final class NamePatterns {

    public static final int MAX = 5;

    private NamePatterns() {}

    // The index-th pattern, null if there are fewer.
    static String at(List<String> patterns, int index) {
        return index < patterns.size() ? patterns.get(index) : null;
    }
}
