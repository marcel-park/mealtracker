package io.github.marcel_park.mealtracker.dto;

// Returned by register and login. The token is only ever sent this once; the client stores it
// and sends it as "Authorization: Bearer <token>" with every request.
public record AuthResponse(
        String token,
        UserResponse user) {}
