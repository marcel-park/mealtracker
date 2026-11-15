package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.CatalogScope;
import io.github.marcel_park.mealtracker.exception.InvalidRequestException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CatalogSearchTest {

    // ---------- namePatterns ----------

    @Test
    void namePatterns_onePatternPerTerm_separatedBySpacesAndCommas() {
        assertThat(CatalogSearch.namePatterns("apri ro")).containsExactly("%apri%", "%ro%");
        assertThat(CatalogSearch.namePatterns("Paprika, rot")).containsExactly("%paprika%", "%rot%");
        assertThat(CatalogSearch.namePatterns("  Paprika   rot ")).containsExactly("%paprika%", "%rot%");
    }

    @Test
    void namePatterns_oneTerm_likeBefore() {
        assertThat(CatalogSearch.namePatterns("Hafer")).containsExactly("%hafer%");
    }

    @Test
    void namePatterns_escapeTheLikeWildcardsTyped() {
        assertThat(CatalogSearch.namePatterns(" 50% Fett ")).containsExactly("%50!%%", "%fett%");
        assertThat(CatalogSearch.namePatterns("100_g")).containsExactly("%100!_g%");
        assertThat(CatalogSearch.namePatterns("a!b")).containsExactly("%a!!b%");
    }

    @Test
    void namePatterns_noTerm_noPattern() {
        assertThat(CatalogSearch.namePatterns(null)).isEmpty();
        assertThat(CatalogSearch.namePatterns("   ")).isEmpty();
        assertThat(CatalogSearch.namePatterns(" , ")).isEmpty();
    }

    @Test
    void namePatterns_eachTermOnce_atMostFive() {
        assertThat(CatalogSearch.namePatterns("rot Rot")).containsExactly("%rot%");
        assertThat(CatalogSearch.namePatterns("a b c d e f g")).containsExactly("%a%", "%b%", "%c%", "%d%", "%e%");
    }

    // ---------- of ----------

    @Test
    void of_setsTheScopeFlagsAndTheEanCode() {
        CatalogSearch search = CatalogSearch.of(" 4311596443819 ", CatalogScope.OWN);

        assertThat(search.namePatterns()).containsExactly("%4311596443819%");
        assertThat(search.eanCode()).isEqualTo("4311596443819");
        assertThat(search.ownOnly()).isTrue();
        assertThat(search.publicOnly()).isFalse();
        assertThat(CatalogSearch.of("Quark", CatalogScope.PUBLIC).eanCode()).isNull();
    }

    @Test
    void page_rejectsInvalidValues() {
        assertThatThrownBy(() -> CatalogSearch.page(-1, 50)).isInstanceOf(InvalidRequestException.class);
        assertThatThrownBy(() -> CatalogSearch.page(0, 101)).isInstanceOf(InvalidRequestException.class);
    }
}
