package io.github.marcel_park.mealtracker.model;

import java.util.EnumMap;
import java.util.Map;

// The nutrients a food may state besides kcal, protein, carbs and fat, all optional. A food states
// them per 100 of its unit (g or ml), a user's daily target per day. The unit of each is fixed:
// grams for the macro nutrients and salt, milligrams or micrograms for vitamins and minerals, as
// on nutrition labels. The app knows the units, names and grouping; the server only stores values.
//
// Stored by name (see NutrientConverter), so renaming a constant needs a migration of the rows.
public enum Nutrient {

    // g
    FIBER,
    SUGAR,                  // part of the carbs
    SATURATED_FAT,          // part of the fat
    MONOUNSATURATED_FAT,    // part of the fat
    POLYUNSATURATED_FAT,    // part of the fat
    OMEGA_3,                // part of the polyunsaturated fat
    SALT,

    // Vitamins
    VITAMIN_A,              // µg
    VITAMIN_D,              // µg
    VITAMIN_E,              // mg
    VITAMIN_K,              // µg
    VITAMIN_C,              // mg
    VITAMIN_B1,             // mg, thiamine
    VITAMIN_B2,             // mg, riboflavin
    VITAMIN_B3,             // mg, niacin equivalent: niacin + tryptophan / 60
    VITAMIN_B5,             // mg, pantothenic acid
    VITAMIN_B6,             // mg
    VITAMIN_B7,             // µg, biotin
    VITAMIN_B9,             // µg, folate
    VITAMIN_B12,            // µg

    // Minerals
    POTASSIUM,              // mg
    CALCIUM,                // mg
    MAGNESIUM,              // mg
    PHOSPHORUS,             // mg

    // Trace elements
    IRON,                   // mg
    ZINC,                   // mg
    IODINE,                 // µg
    SELENIUM,               // µg
    COPPER,                 // mg
    MANGANESE;              // mg

    // A copy in the order above, detached from the entity it came from.
    public static Map<Nutrient, Double> inOrder(Map<Nutrient, Double> amounts) {
        Map<Nutrient, Double> copy = new EnumMap<>(Nutrient.class);
        copy.putAll(amounts);
        return copy;
    }
}
