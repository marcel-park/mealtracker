package io.github.marcel_park.mealtracker.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

// The authenticated caller of the current request. TokenAuthenticationFilter puts it into the
// security context; controllers get it with @AuthenticationPrincipal.
// tokenId identifies the login (device) the request came from, so logout can revoke just that one.
public record CurrentUser(Long userId, Long tokenId, boolean admin) {

    public List<GrantedAuthority> authorities() {
        if (admin) {
            return List.of(new SimpleGrantedAuthority("ROLE_USER"), new SimpleGrantedAuthority("ROLE_ADMIN"));
        }
        return List.of(new SimpleGrantedAuthority("ROLE_USER"));
    }
}
