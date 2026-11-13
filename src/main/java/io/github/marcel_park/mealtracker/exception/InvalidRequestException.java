package io.github.marcel_park.mealtracker.exception;

// The request is well-formed, but breaks a rule that bean validation on the DTO cannot express,
// e.g. two portions of a food with the same name. Answered with 400.
public class InvalidRequestException extends RuntimeException {

    public InvalidRequestException(String message) {
        super(message);
    }
}
