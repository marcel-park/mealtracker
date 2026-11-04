package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.config.CorsConfig;
import io.github.marcel_park.mealtracker.dto.UserResponse;
import io.github.marcel_park.mealtracker.dto.UserSettingsRequest;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
@Import({SecurityConfig.class, CorsConfig.class})
@WithCurrentUser(userId = UserControllerTest.USER_ID)
class UserControllerTest {

    static final long USER_ID = 3L;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private AuthTokenService authTokenService;

    private static final UserResponse PROFILE =
            new UserResponse(USER_ID, "max@example.com", 1800, ColorTheme.LIGHT, false);

    @Test
    void get_returnsProfileOfTheLoggedInUser() throws Exception {
        when(userService.get(USER_ID)).thenReturn(PROFILE);

        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(3))
                .andExpect(jsonPath("$.email").value("max@example.com"))
                .andExpect(jsonPath("$.calorieTarget").value(1800))
                .andExpect(jsonPath("$.colorTheme").value("LIGHT"))
                .andExpect(jsonPath("$.admin").value(false))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void updateSettings_validRequest_passesItOnForTheLoggedInUser() throws Exception {
        when(userService.updateSettings(eq(USER_ID), any())).thenReturn(PROFILE);

        mockMvc.perform(put("/api/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"calorieTarget":1800,"colorTheme":"DARK"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.calorieTarget").value(1800));

        verify(userService).updateSettings(USER_ID, new UserSettingsRequest(1800, ColorTheme.DARK));
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', textBlock = """
            calorieTarget 0       | {"calorieTarget":0,"colorTheme":"LIGHT"}     | calorieTarget
            calorieTarget too big | {"calorieTarget":20001,"colorTheme":"LIGHT"} | calorieTarget
            missing calorieTarget | {"colorTheme":"LIGHT"}                       | calorieTarget
            missing colorTheme    | {"calorieTarget":1800}                       | colorTheme
            """)
    void updateSettings_invalidRequest_returns400AndDoesNotCallService(
            String violation, String body, String expectedField) throws Exception {
        mockMvc.perform(put("/api/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[*].field", hasItem(expectedField)));

        verifyNoInteractions(userService);
    }

    @Test
    void updateSettings_unknownColorTheme_returns400() throws Exception {
        mockMvc.perform(put("/api/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"calorieTarget":1800,"colorTheme":"PINK"}
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(userService);
    }
}
