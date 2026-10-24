package io.github.marcel_park.mealtracker.exception;

import java.time.LocalDateTime;
import java.util.List;

public record ErrorResponse(
        int status,
        String error,
        String message,
        LocalDateTime timestamp,
        List<FieldError> fieldErrors
) {
    public record FieldError(String field, String message) {}

    public static ErrorResponse of(int status, String error, String message) {
        return new ErrorResponse(status, error, message, LocalDateTime.now(), List.of());
    }

    public static ErrorResponse validation(List<FieldError> fieldErrors) {
        return new ErrorResponse(400, "Bad Request", "Validation failed",
                LocalDateTime.now(), fieldErrors);
    }
}