package io.github.marcel_park.mealtracker.exception;

public class EmailAlreadyRegisteredException extends RuntimeException {

    public EmailAlreadyRegisteredException() {
        super("This email address is already registered");
    }
}
