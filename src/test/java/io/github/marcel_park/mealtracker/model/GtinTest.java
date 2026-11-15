package io.github.marcel_park.mealtracker.model;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class GtinTest {

    @ParameterizedTest
    @ValueSource(strings = {"4311501042229", "40170725", "036000291452", "4000417025005", "14311501042226"})
    void isValid_acceptsCodesWithTheRightCheckDigit(String code) {
        assertThat(Gtin.isValid(code)).isTrue();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"4311501042228", "4311501042292", "40170726", "431150104222", "123", "431150104222x",
            "123456789", "431150104222910", ""})
    void isValid_rejectsWrongCheckDigitsLengthsAndCharacters(String code) {
        assertThat(Gtin.isValid(code)).isFalse();
    }
}
