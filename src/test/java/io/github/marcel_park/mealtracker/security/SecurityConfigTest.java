package io.github.marcel_park.mealtracker.security;

import io.github.marcel_park.mealtracker.config.CorsConfig;
import io.github.marcel_park.mealtracker.controller.MealController;
import io.github.marcel_park.mealtracker.service.AuthTokenService;
import io.github.marcel_park.mealtracker.service.MealService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// The real token filter and access rules, with the token lookup mocked. Uses the meal endpoint
// as an example of a protected path.
@WebMvcTest(MealController.class)
@Import({SecurityConfig.class, CorsConfig.class})
class SecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthTokenService authTokenService;

    @MockitoBean
    private MealService mealService;

    @Test
    void protectedPath_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/meals"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(mealService);
    }

    @Test
    void protectedPath_withUnknownToken_returns401() throws Exception {
        when(authTokenService.authenticate("unknown")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/meals").header(HttpHeaders.AUTHORIZATION, "Bearer unknown"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(mealService);
    }

    @Test
    void protectedPath_withOtherAuthorizationScheme_returns401() throws Exception {
        mockMvc.perform(get("/api/meals").header(HttpHeaders.AUTHORIZATION, "Basic bWF4OmdlaGVpbQ=="))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(authTokenService);
    }

    @Test
    void protectedPath_withValidToken_passesTheTokensUserToTheController() throws Exception {
        when(authTokenService.authenticate("valid")).thenReturn(Optional.of(new CurrentUser(5L, 50L, false)));
        when(mealService.findAll(5L)).thenReturn(List.of());

        mockMvc.perform(get("/api/meals").header(HttpHeaders.AUTHORIZATION, "Bearer valid"))
                .andExpect(status().isOk());

        verify(mealService).findAll(5L);
    }

    // The Android app runs on http://localhost and calls the server cross-origin. The browser
    // first sends a preflight without token, which must be answered without authentication.
    // The absolute URL gives the request another host than MockMvc's default "localhost";
    // otherwise Spring sees the same origin and does not treat the request as CORS at all.
    private static final String SERVER_URL = "http://192.168.0.10:8080/api/meals";

    @Test
    void corsPreflight_fromAppOrigin_isAllowedWithAuthorizationHeader() throws Exception {
        mockMvc.perform(options(SERVER_URL)
                        .header(HttpHeaders.ORIGIN, "http://localhost")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost"));

        verifyNoInteractions(authTokenService, mealService);
    }

    @Test
    void corsPreflight_fromForeignOrigin_isRejected() throws Exception {
        mockMvc.perform(options(SERVER_URL)
                        .header(HttpHeaders.ORIGIN, "https://evil.example")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isForbidden());
    }

    @Test
    void unknownPath_withoutToken_returns401InsteadOfRevealingWhetherItExists() throws Exception {
        mockMvc.perform(get("/api/does-not-exist"))
                .andExpect(status().isUnauthorized());
    }
}
