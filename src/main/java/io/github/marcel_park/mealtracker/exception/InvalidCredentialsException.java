package io.github.marcel_park.mealtracker.exception;

// Same message for an unknown email and a wrong password, so a failed login does not reveal
// which email addresses have an account.
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException() {
        super("Invalid email or password");
    }
}
