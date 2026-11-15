package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

// Stores UserItemVisibility as its name ("PRIVATE", "FRIENDS") in the plain VARCHAR column of the
// V16 migration, like ColorThemeConverter. The allowed values are enforced by a CHECK constraint.
@Converter
public class UserItemVisibilityConverter implements AttributeConverter<UserItemVisibility, String> {

    @Override
    public String convertToDatabaseColumn(UserItemVisibility visibility) {
        return visibility == null ? null : visibility.name();
    }

    @Override
    public UserItemVisibility convertToEntityAttribute(String value) {
        return value == null ? null : UserItemVisibility.valueOf(value);
    }
}
