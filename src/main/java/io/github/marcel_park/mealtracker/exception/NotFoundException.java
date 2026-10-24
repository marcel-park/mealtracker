package io.github.marcel_park.mealtracker.exception;

public class NotFoundException extends RuntimeException {

    public NotFoundException(String resource, Long id) {
        super(resource + " with id " + id + " not found");
    }
}