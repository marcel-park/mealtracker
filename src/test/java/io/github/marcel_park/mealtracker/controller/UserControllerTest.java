package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.config.CorsConfig;
import io.github.marcel_park.mealtracker.dto.UserResponse;
import io.github.marcel_park.mealtracker.dto.UserSettingsRequest;
import io.github.marcel_park.mealtracker.model.ColorTheme;
import io.github.marcel_park.mealtracker.model.Sex;
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

import java.math.BigDecimal;

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
            new UserResponse(USER_ID, "max@example.com", 1800, 40, 30, 30, 10_000,
                    new BigDecimal("80.5"), 180, Sex.MALE, ColorTheme.LIGHT, false, false);

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
                                {"calorieTarget":1800,"colorTheme":"DARK",
                                 "carbsPercent":50,"proteinPercent":25,"fatPercent":25,
                                 "stepGoal":8000,"weightKg":72.0,"heightCm":168,"sex":"FEMALE"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.calorieTarget").value(1800))
                .andExpect(jsonPath("$.carbsPercent").value(40));

        verify(userService).updateSettings(USER_ID, new UserSettingsRequest(1800, ColorTheme.DARK, 50, 25, 25,
                8000, new BigDecimal("72.0"), 168, Sex.FEMALE));
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', textBlock = """
            calorieTarget 0       | {"calorieTarget":0,"colorTheme":"LIGHT","carbsPercent":40,"proteinPercent":30,"fatPercent":30,"stepGoal":8000,"weightKg":72.0,"heightCm":168,"sex":"FEMALE"} | calorieTarget
            calorieTarget too big | {"calorieTarget":20001,"colorTheme":"LIGHT","carbsPercent":40,"proteinPercent":30,"fatPercent":30,"stepGoal":8000,"weightKg":72.0,"heightCm":168,"sex":"FEMALE"} | calorieTarget
            missing calorieTarget | {"colorTheme":"LIGHT","carbsPercent":40,"proteinPercent":30,"fatPercent":30,"stepGoal":8000,"weightKg":72.0,"heightCm":168,"sex":"FEMALE"} | calorieTarget
            missing colorTheme    | {"calorieTarget":1800,"carbsPercent":40,"proteinPercent":30,"fatPercent":30,"stepGoal":8000,"weightKg":72.0,"heightCm":168,"sex":"FEMALE"} | colorTheme
            missing fatPercent    | {"calorieTarget":1800,"colorTheme":"LIGHT","carbsPercent":40,"proteinPercent":30,"stepGoal":8000,"weightKg":72.0,"heightCm":168,"sex":"FEMALE"} | fatPercent
            negative percent      | {"calorieTarget":1800,"colorTheme":"LIGHT","carbsPercent":-10,"proteinPercent":80,"fatPercent":30,"stepGoal":8000,"weightKg":72.0,"heightCm":168,"sex":"FEMALE"} | carbsPercent
            percent above 100     | {"calorieTarget":1800,"colorTheme":"LIGHT","carbsPercent":110,"proteinPercent":0,"fatPercent":0,"stepGoal":8000,"weightKg":72.0,"heightCm":168,"sex":"FEMALE"} | carbsPercent
            sum not 100           | {"calorieTarget":1800,"colorTheme":"LIGHT","carbsPercent":40,"proteinPercent":30,"fatPercent":20,"stepGoal":8000,"weightKg":72.0,"heightCm":168,"sex":"FEMALE"} | macroPercentSum
            stepGoal 0            | {"calorieTarget":1800,"colorTheme":"LIGHT","carbsPercent":40,"proteinPercent":30,"fatPercent":30,"stepGoal":0,"weightKg":72.0,"heightCm":168,"sex":"FEMALE"} | stepGoal
            missing weight        | {"calorieTarget":1800,"colorTheme":"LIGHT","carbsPercent":40,"proteinPercent":30,"fatPercent":30,"stepGoal":8000,"heightCm":168,"sex":"FEMALE"} | weightKg
            weight too high       | {"calorieTarget":1800,"colorTheme":"LIGHT","carbsPercent":40,"proteinPercent":30,"fatPercent":30,"stepGoal":8000,"weightKg":300.1,"heightCm":168,"sex":"FEMALE"} | weightKg
            height too low        | {"calorieTarget":1800,"colorTheme":"LIGHT","carbsPercent":40,"proteinPercent":30,"fatPercent":30,"stepGoal":8000,"weightKg":72.0,"heightCm":99,"sex":"FEMALE"} | heightCm
            missing sex           | {"calorieTarget":1800,"colorTheme":"LIGHT","carbsPercent":40,"proteinPercent":30,"fatPercent":30,"stepGoal":8000,"weightKg":72.0,"heightCm":168} | sex
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
                                {"calorieTarget":1800,"colorTheme":"PINK",
                                 "carbsPercent":40,"proteinPercent":30,"fatPercent":30,
                                 "stepGoal":8000,"weightKg":72.0,"heightCm":168,"sex":"FEMALE"}
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(userService);
    }
}
