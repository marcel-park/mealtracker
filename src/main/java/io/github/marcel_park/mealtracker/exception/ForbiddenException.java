package io.github.marcel_park.mealtracker.exception;

// The record exists and the user may see it, but only its owner may change it.
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String resource, Long id) {
        super(resource + " with id " + id + " belongs to somebody else");
    }
}
