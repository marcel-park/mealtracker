package io.github.marcel_park.mealtracker.security;

import io.github.marcel_park.mealtracker.service.AuthTokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

// Reads "Authorization: Bearer <token>" and, if the token belongs to an active user, marks the
// request as authenticated. Without a (valid) token the request simply stays anonymous; whether
// that is allowed is decided by the rules in SecurityConfig, which answer 401 for protected paths.
//
// Not a Spring bean on purpose: Spring Boot would otherwise also register it as a plain servlet
// filter outside the security chain.
public class TokenAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final AuthTokenService authTokenService;

    public TokenAuthenticationFilter(AuthTokenService authTokenService) {
        this.authTokenService = authTokenService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            String token = header.substring(BEARER_PREFIX.length()).trim();
            authTokenService.authenticate(token).ifPresent(TokenAuthenticationFilter::setAuthenticated);
        }
        filterChain.doFilter(request, response);
    }

    private static void setAuthenticated(CurrentUser user) {
        var authentication = UsernamePasswordAuthenticationToken.authenticated(user, null, user.authorities());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
    }
}
