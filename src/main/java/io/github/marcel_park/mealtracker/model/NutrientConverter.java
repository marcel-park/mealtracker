package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

// Stores Nutrient as its name in the plain VARCHAR column of the V11 migration, for the same
// reason as ColorThemeConverter. The allowed values are enforced by a CHECK constraint.
@Converter
public class NutrientConverter implements AttributeConverter<Nutrient, String> {

    @Override
    public String convertToDatabaseColumn(Nutrient nutrient) {
        return nutrient == null ? null : nutrient.name();
    }

    @Override
    public Nutrient convertToEntityAttribute(String value) {
        return value == null ? null : Nutrient.valueOf(value);
    }
}
