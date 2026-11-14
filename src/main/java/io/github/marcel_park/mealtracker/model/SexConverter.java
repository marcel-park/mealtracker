package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

// Stores Sex as its name ("MALE", "FEMALE", "DIVERSE") in the plain VARCHAR column of the V8
// migration, for the same reason as ColorThemeConverter. NULL stays NULL (users who registered
// before V8). The allowed values are enforced by a CHECK constraint.
@Converter
public class SexConverter implements AttributeConverter<Sex, String> {

    @Override
    public String convertToDatabaseColumn(Sex sex) {
        return sex == null ? null : sex.name();
    }

    @Override
    public Sex convertToEntityAttribute(String value) {
        return value == null ? null : Sex.valueOf(value);
    }
}
