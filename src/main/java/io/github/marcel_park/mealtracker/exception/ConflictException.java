package io.github.marcel_park.mealtracker.exception;

// The request contradicts data that already exists, e.g. a name that must be unique. Answered
// with 409, like EmailAlreadyRegisteredException.
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
