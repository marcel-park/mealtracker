package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

// Stores ColorTheme as its name ("LIGHT", "DARK") in the plain VARCHAR column of the V3 migration,
// instead of the native ENUM column type that Hibernate would expect on MariaDB for @Enumerated.
// The allowed values are enforced by the CHECK constraint in the migration.
@Converter
public class ColorThemeConverter implements AttributeConverter<ColorTheme, String> {

    @Override
    public String convertToDatabaseColumn(ColorTheme theme) {
        return theme == null ? null : theme.name();
    }

    @Override
    public ColorTheme convertToEntityAttribute(String value) {
        return value == null ? null : ColorTheme.valueOf(value);
    }
}
