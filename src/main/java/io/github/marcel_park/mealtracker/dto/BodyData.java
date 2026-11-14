package io.github.marcel_park.mealtracker.dto;

// Limits of the body data, shared by RegisterRequest and UserSettingsRequest. The same ranges are
// CHECK constraints of the V8 migration.
public final class BodyData {

    public static final String MIN_WEIGHT_KG = "30.0";
    public static final String MAX_WEIGHT_KG = "300.0";
    public static final int MIN_HEIGHT_CM = 100;
    public static final int MAX_HEIGHT_CM = 250;
    public static final int MAX_STEP_GOAL = 100_000;

    // The weight is kept with one decimal, e.g. 80.5 kg.
    public static final int WEIGHT_FRACTION_DIGITS = 1;

    private BodyData() {}
}
