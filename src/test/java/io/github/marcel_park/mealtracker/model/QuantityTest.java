package io.github.marcel_park.mealtracker.model;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class QuantityTest {

    private final Food egg = new Food();
    private final FoodPortion piece = egg.addPortion("Stück", 60, true);
    private final FoodPortion box = egg.addPortion("Packung", 600, false);

    private static Quantity portions(FoodPortion portion, String count) {
        return Quantity.ofPortions(portion, new BigDecimal(count));
    }

    @Test
    void portions_resolveToCountTimesThePortionsCurrentAmount() {
        Quantity quantity = portions(piece, "2.25");

        assertThat(quantity.resolvedAmount()).isEqualTo(135.0);
        piece.setAmount(50);
        assertThat(quantity.resolvedAmount()).isEqualTo(112.5);
    }

    @Test
    void count_isKeptWithTwoDecimals() {
        assertThat(portions(piece, "1.005").getPortionCount()).isEqualByComparingTo("1.01");
        assertThat(portions(piece, "2").getPortionCount()).hasToString("2.00");
    }

    @Test
    void amountPlusAnything_staysAnAmount() {
        Quantity sum = Quantity.ofAmount(120).plus(portions(piece, "0.5"));

        assertThat(sum.isPortion()).isFalse();
        assertThat(sum.getAmount()).isEqualTo(150.0);
    }

    @Test
    void portionPlusSamePortion_addsTheCounts() {
        Quantity sum = portions(piece, "2").plus(portions(piece, "0.5"));

        assertThat(sum.getPortion()).isSameAs(piece);
        assertThat(sum.getPortionCount()).isEqualByComparingTo("2.5");
    }

    @Test
    void portionPlusAmount_isConvertedIntoThePortion() {
        Quantity sum = portions(piece, "2").plus(Quantity.ofAmount(30));

        assertThat(sum.getPortion()).isSameAs(piece);
        assertThat(sum.getPortionCount()).isEqualByComparingTo("2.5");
    }

    @Test
    void portionPlusOtherPortion_isConvertedIntoTheFirst_roundedToTwoDecimals() {
        Quantity sum = portions(box, "1").plus(portions(piece, "1"));

        assertThat(sum.getPortion()).isSameAs(box);
        // 600 g + 60 g = 1,1 Packungen
        assertThat(sum.getPortionCount()).isEqualByComparingTo("1.10");
        assertThat(portions(piece, "0").plus(Quantity.ofAmount(25)).getPortionCount())
                .isEqualByComparingTo("0.42");
    }

    @Test
    void sameAmountAs_comparesInGramsWhateverTheWriting() {
        assertThat(portions(piece, "2").sameAmountAs(Quantity.ofAmount(120))).isTrue();
        assertThat(portions(piece, "2").sameAmountAs(Quantity.ofAmount(121))).isFalse();
    }
}
