package io.github.marcel_park.mealtracker.exception;

// Only thrown after the password was checked, so it reveals nothing to someone without it.
public class AccountDisabledException extends RuntimeException {

    public AccountDisabledException() {
        super("This account is disabled");
    }
}
