package io.github.marcel_park.mealtracker.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Deliberately no format or length rules beyond an upper bound: a login must not fail because
// the registration rules changed later. A wrong password simply does not match.
public record LoginRequest(
        @NotBlank @Size(max = 254) String email,
        @NotBlank @Size(max = 1000) String password) {}
