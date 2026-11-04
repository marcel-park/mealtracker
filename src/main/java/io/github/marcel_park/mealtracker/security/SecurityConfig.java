package io.github.marcel_park.mealtracker.security;

import io.github.marcel_park.mealtracker.service.AuthTokenService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.Map;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    // Cost factor 12 = 2^12 rounds, roughly 0.2-0.3 s per hash on a typical server: unnoticeable
    // at login, but very slow for anyone trying to guess passwords from a stolen hash.
    private static final int BCRYPT_STRENGTH = 12;

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
                                            AuthTokenService authTokenService,
                                            CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                // The token travels in the Authorization header, never in a cookie, so the browser
                // cannot attach it to a forged cross-site request: CSRF protection is not needed.
                .csrf(AbstractHttpConfigurer::disable)
                // No server-side HTTP session: every request authenticates itself with its token.
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Login and logout are our own endpoints (AuthController), not Spring's built-in forms.
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll()
                        // Spring Boot's error page, otherwise errors on public paths turn into 401
                        .requestMatchers("/error").permitAll()
                        .anyRequest().authenticated())
                // Answer a missing or invalid token with a plain 401 (no login page, no redirect).
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .addFilterBefore(new TokenAuthenticationFilter(authTokenService),
                        UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    // The stored hash starts with "{bcrypt}". That prefix lets us switch to another algorithm
    // later (e.g. Argon2) without invalidating existing passwords: old hashes keep working and
    // could be upgraded at the next login.
    @Bean
    PasswordEncoder passwordEncoder() {
        return new DelegatingPasswordEncoder("bcrypt",
                Map.of("bcrypt", new BCryptPasswordEncoder(BCRYPT_STRENGTH)));
    }
}
