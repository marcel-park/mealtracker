package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.config.CorsConfig;
import io.github.marcel_park.mealtracker.dto.AuthResponse;
import io.github.marcel_park.mealtracker.dto.LoginRequest;
import io.github.marcel_park.mealtracker.dto.RegisterRequest;
import io.github.marcel_park.mealtracker.dto.UserResponse;
import io.github.marcel_park.mealtracker.exception.AccountDisabledException;
import io.github.marcel_park.mealtracker.exception.EmailAlreadyRegisteredException;
import io.github.marcel_park.mealtracker.exception.InvalidCredentialsException;
import io.github.marcel_park.mealtracker.model.ColorTheme;
import io.github.marcel_park.mealtracker.security.SecurityConfig;
import io.github.marcel_park.mealtracker.security.WithCurrentUser;
import io.github.marcel_park.mealtracker.service.AuthTokenService;
import io.github.marcel_park.mealtracker.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasItem;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, CorsConfig.class})
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private AuthTokenService authTokenService;

    private static final AuthResponse AUTH_RESPONSE = new AuthResponse("the-token",
            new UserResponse(1L, "max@example.com", 2000, 40, 30, 30, ColorTheme.LIGHT, false));

    private static final String CREDENTIALS = """
            {"email":"max@example.com","password":"geheim123"}
            """;

    // ---------- POST /api/auth/register ----------

    @Test
    void register_withoutToken_returns201WithTokenAndUser() throws Exception {
        when(userService.register(any())).thenReturn(AUTH_RESPONSE);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREDENTIALS))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").value("the-token"))
                .andExpect(jsonPath("$.user.email").value("max@example.com"))
                .andExpect(jsonPath("$.user.calorieTarget").value(2000))
                .andExpect(jsonPath("$.user.colorTheme").value("LIGHT"))
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist());

        verify(userService).register(new RegisterRequest("max@example.com", "geheim123"));
    }

    @Test
    void register_emailAlreadyRegistered_returns409() throws Exception {
        when(userService.register(any())).thenThrow(new EmailAlreadyRegisteredException());

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREDENTIALS))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    // "ä" is 2 bytes in UTF-8, so 38 of them are 76 bytes: too long for BCrypt despite only 38 characters.
    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', textBlock = """
            invalid email         | {"email":"kein-at-zeichen","password":"geheim123"} | email
            blank email           | {"email":"  ","password":"geheim123"}              | email
            password too short    | {"email":"max@example.com","password":"kurz"}      | password
            missing password      | {"email":"max@example.com"}                        | password
            password > 72 bytes   | {"email":"max@example.com","password":"ääääääääääääääääääääääääääääääääääääää"} | passwordWithinBcryptLimit
            """)
    void register_invalidRequest_returns400WithFieldErrorAndDoesNotCallService(
            String violation, String body, String expectedField) throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.fieldErrors[*].field", hasItem(expectedField)));

        verifyNoInteractions(userService);
    }

    @Test
    void register_passwordOfExactly72Bytes_passesValidation() throws Exception {
        when(userService.register(any())).thenReturn(AUTH_RESPONSE);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"max@example.com","password":"%s"}
                                """.formatted("a".repeat(72))))
                .andExpect(status().isCreated());
    }

    // ---------- POST /api/auth/login ----------

    @Test
    void login_withoutToken_returns200WithTokenAndUser() throws Exception {
        when(userService.login(any())).thenReturn(AUTH_RESPONSE);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREDENTIALS))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("the-token"))
                .andExpect(jsonPath("$.user.id").value(1));

        verify(userService).login(new LoginRequest("max@example.com", "geheim123"));
    }

    @Test
    void login_invalidCredentials_returns401() throws Exception {
        when(userService.login(any())).thenThrow(new InvalidCredentialsException());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREDENTIALS))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void login_disabledAccount_returns403() throws Exception {
        when(userService.login(any())).thenThrow(new AccountDisabledException());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(CREDENTIALS))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    void login_blankPassword_returns400() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"max@example.com","password":""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[*].field", hasItem("password")));

        verifyNoInteractions(userService);
    }

    // ---------- POST /api/auth/logout ----------

    @Test
    @WithCurrentUser(userId = 1L, tokenId = 42L)
    void logout_revokesTheTokenOfThisRequest() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isNoContent());

        verify(authTokenService).revoke(42L);
    }

    @Test
    void logout_withoutToken_returns401() throws Exception {
        mockMvc.perform(post("/api/auth/logout"))
                .andExpect(status().isUnauthorized());
    }
}
