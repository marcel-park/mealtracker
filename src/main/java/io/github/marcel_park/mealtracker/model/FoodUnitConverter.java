package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

// Stores FoodUnit as its name ("G", "ML") in the plain VARCHAR column of the V6 migration, for the
// same reason as ColorThemeConverter. The allowed values are enforced by a CHECK constraint.
@Converter
public class FoodUnitConverter implements AttributeConverter<FoodUnit, String> {

    @Override
    public String convertToDatabaseColumn(FoodUnit unit) {
        return unit == null ? null : unit.name();
    }

    @Override
    public FoodUnit convertToEntityAttribute(String value) {
        return value == null ? null : FoodUnit.valueOf(value);
    }
}
