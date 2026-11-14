package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

// How much of a food an item holds: an amount in the unit of the food (g or ml), or a number of
// one of its portions ("2,25 × Stück"). Exactly one of the two is set, see the V9 migration.
//
// The amount of a portion item is not stored but computed from the portion's current amount, so
// correcting a portion corrects every item booked with it. Used by meal, recipe, variation and
// shopping list items, which all keep it in the columns amount, portion_id and portion_count.
//
// Immutable: items get a new Quantity instead of changing theirs.
@Embeddable
public class Quantity {

    // Portion counts are kept with two decimals ("2,25 Stück"), like the column.
    public static final int COUNT_SCALE = 2;

    @Column(name = "amount")
    private Double amount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portion_id")
    private FoodPortion portion;

    @Column(name = "portion_count", precision = 8, scale = COUNT_SCALE)
    private BigDecimal portionCount;

    protected Quantity() {}

    private Quantity(Double amount, FoodPortion portion, BigDecimal portionCount) {
        this.amount = amount;
        this.portion = portion;
        this.portionCount = portionCount;
    }

    public static Quantity ofAmount(double amount) {
        return new Quantity(amount, null, null);
    }

    public static Quantity ofPortions(FoodPortion portion, BigDecimal count) {
        return new Quantity(null, Objects.requireNonNull(portion), roundCount(count));
    }

    public static BigDecimal roundCount(BigDecimal count) {
        return count.setScale(COUNT_SCALE, RoundingMode.HALF_UP);
    }

    public boolean isPortion() {
        return portion != null;
    }

    // In the unit of the food: the stored amount, or count × the portion's current amount.
    public double resolvedAmount() {
        return isPortion() ? portionCount.doubleValue() * portion.getAmount() : amount;
    }

    // This quantity plus another one of the same food, kept in the unit of this one: amounts add
    // up, the same portion adds its counts, anything else is converted into this portion (rounded
    // to two decimals, so 25 g onto a 60 g portion add 0,42).
    public Quantity plus(Quantity other) {
        if (!isPortion()) {
            return ofAmount(amount + other.resolvedAmount());
        }
        if (other.isPortion() && samePortion(other.portion)) {
            return ofPortions(portion, portionCount.add(other.portionCount));
        }
        return ofPortions(portion, portionCount.add(countOf(other.resolvedAmount())));
    }

    // Same amount in g or ml, ignoring how it is written down.
    public boolean sameAmountAs(Quantity other) {
        return Math.abs(resolvedAmount() - other.resolvedAmount()) < 1e-9;
    }

    private BigDecimal countOf(double otherAmount) {
        return BigDecimal.valueOf(otherAmount / portion.getAmount());
    }

    // Portions not saved yet (tests) have no id; they are only the same object.
    private boolean samePortion(FoodPortion other) {
        return portion == other || (portion.getId() != null && portion.getId().equals(other.getId()));
    }

    public Double getAmount() { return amount; }
    public FoodPortion getPortion() { return portion; }
    // getId() on a lazy proxy does not load the portion.
    public Long getPortionId() { return portion == null ? null : portion.getId(); }
    public BigDecimal getPortionCount() { return portionCount; }
}
