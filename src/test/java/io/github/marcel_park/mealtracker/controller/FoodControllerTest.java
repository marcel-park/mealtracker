package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.dto.CatalogScope;
import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.exception.ForbiddenException;
import io.github.marcel_park.mealtracker.config.CorsConfig;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.security.SecurityConfig;
import io.github.marcel_park.mealtracker.security.WithCurrentUser;
import io.github.marcel_park.mealtracker.service.AuthTokenService;
import io.github.marcel_park.mealtracker.service.FoodService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.stream.Stream;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// Only logged-in users may use the food database. Every call passes on the id of the logged-in
// user (1, see @WithCurrentUser): what they may see and change is decided by FoodService.
@WebMvcTest(FoodController.class)
@Import({SecurityConfig.class, CorsConfig.class})
@WithCurrentUser
class FoodControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FoodService service;

    // Needed by the token filter in SecurityConfig, unused here because @WithCurrentUser
    // authenticates the requests directly.
    @MockitoBean
    private AuthTokenService authTokenService;

    private static final String VALID_BODY = """
            {"name":"Haferflocken","kcalPer100g":372,"protein":13.5,"carbs":58.7,"fat":7,"published":false}
            """;

    @Test
    void list_returnsFoodsAsJson() throws Exception {
        when(service.find(1L, null, null, false)).thenReturn(List.of(
                new FoodResponse(1L, "Haferflocken", 372, 13.5, 58.7, 7, true, false, false)));

        mockMvc.perform(get("/api/foods"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("Haferflocken"));
    }

    @Test
    void get_unknownId_returns404WithErrorBody() throws Exception {
        when(service.get(1L, 999L)).thenThrow(new NotFoundException("Food", 999L));

        mockMvc.perform(get("/api/foods/999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Food with id 999 not found"))
                .andExpect(jsonPath("$.fieldErrors").isEmpty());
    }

    @Test
    void get_nonNumericId_returns400() throws Exception {
        mockMvc.perform(get("/api/foods/abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void create_validRequest_returns201WithBody() throws Exception {
        when(service.create(eq(1L), any())).thenReturn(
                new FoodResponse(1L, "Haferflocken", 372, 13.5, 58.7, 7, true, false, false));

        mockMvc.perform(post("/api/foods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("Haferflocken"));
    }

    @Test
    void create_invalidRequest_returns400WithFieldErrors() throws Exception {
        // leerer Name, negative kcal, protein fehlt
        String invalid = """
                {"name":"","kcalPer100g":-5,"carbs":10,"fat":1}
                """;

        mockMvc.perform(post("/api/foods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalid))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.fieldErrors[*].field",
                        hasItems("name", "kcalPer100g", "protein")));
    }

    @Test
    void create_malformedJson_returns400() throws Exception {
        mockMvc.perform(post("/api/foods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Malformed JSON request"));
    }

    @Test
    void update_validRequest_returns200() throws Exception {
        when(service.update(any(), any(), any())).thenReturn(
                new FoodResponse(1L, "Haferflocken", 372, 13.5, 58.7, 7, true, false, false));

        mockMvc.perform(put("/api/foods/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void delete_existingId_returns204() throws Exception {
        mockMvc.perform(delete("/api/foods/1"))
                .andExpect(status().isNoContent());

        verify(service).delete(1L, 1L);
    }

    // ---------- GET /api/foods/{id}, GET /api/foods?query= ----------

    @Test
    void get_existingId_returnsAllFieldsAsJson() throws Exception {
        when(service.get(1L, 1L)).thenReturn(new FoodResponse(1L, "Haferflocken", 372, 13.5, 58.7, 7, true, false, false));

        mockMvc.perform(get("/api/foods/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("Haferflocken"))
                .andExpect(jsonPath("$.kcalPer100g").value(372.0))
                .andExpect(jsonPath("$.protein").value(13.5))
                .andExpect(jsonPath("$.carbs").value(58.7))
                .andExpect(jsonPath("$.fat").value(7.0));
    }

    @Test
    void list_withQuery_passesQueryToService() throws Exception {
        mockMvc.perform(get("/api/foods").param("query", "hafer"))
                .andExpect(status().isOk());

        verify(service).find(1L, "hafer", null, false);
    }

    // ---------- PUT /api/foods/{id} ----------

    @Test
    void update_invalidRequest_returns400WithFieldErrorsAndDoesNotCallService() throws Exception {
        String invalid = """
                {"name":"   ","kcalPer100g":372,"protein":13.5,"carbs":58.7,"fat":-1,"published":false}
                """;

        mockMvc.perform(put("/api/foods/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalid))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.fieldErrors[*].field", hasItems("name", "fat")));

        verifyNoInteractions(service);
    }

    @Test
    void update_unknownId_returns404WithErrorBody() throws Exception {
        when(service.update(eq(1L), eq(999L), any())).thenThrow(new NotFoundException("Food", 999L));

        mockMvc.perform(put("/api/foods/999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Food with id 999 not found"));
    }

    // ---------- DELETE /api/foods/{id} ----------

    @Test
    void delete_unknownId_returns404WithErrorBody() throws Exception {
        doThrow(new NotFoundException("Food", 999L)).when(service).delete(1L, 999L);

        mockMvc.perform(delete("/api/foods/999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Food with id 999 not found"));
    }

    // ---------- scope filter and ownership ----------

    @Test
    void list_withScope_passesScopeToService() throws Exception {
        mockMvc.perform(get("/api/foods").param("scope", "OWN"))
                .andExpect(status().isOk());

        verify(service).find(1L, null, CatalogScope.OWN, false);
    }

    @Test
    void list_confirmedOnly_passesFlagToService() throws Exception {
        mockMvc.perform(get("/api/foods").param("scope", "PUBLIC").param("confirmed", "true"))
                .andExpect(status().isOk());

        verify(service).find(1L, null, CatalogScope.PUBLIC, true);
    }

    @Test
    void list_unknownScope_returns400() throws Exception {
        mockMvc.perform(get("/api/foods").param("scope", "FRIENDS"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid value for parameter 'scope'"));

        verifyNoInteractions(service);
    }

    @Test
    void list_returnsOwnershipFlags() throws Exception {
        when(service.find(1L, null, null, false)).thenReturn(List.of(
                new FoodResponse(1L, "Haferflocken", 372, 13.5, 58.7, 7, false, true, false)));

        mockMvc.perform(get("/api/foods"))
                .andExpect(jsonPath("$[0].owned").value(false))
                .andExpect(jsonPath("$[0].published").value(true))
                .andExpect(jsonPath("$[0].confirmed").value(false));
    }

    @Test
    void update_foodOfOtherUser_returns403() throws Exception {
        when(service.update(eq(1L), eq(5L), any())).thenThrow(new ForbiddenException("Food", 5L));

        mockMvc.perform(put("/api/foods/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
    }

    @Test
    void delete_foodOfOtherUser_returns403() throws Exception {
        doThrow(new ForbiddenException("Food", 5L)).when(service).delete(1L, 5L);

        mockMvc.perform(delete("/api/foods/5"))
                .andExpect(status().isForbidden());
    }

    // ---------- FoodRequest validation (POST) ----------

    private static String body(String name, String kcalPer100g, String protein, String carbs, String fat) {
        return """
                {"name":%s,"kcalPer100g":%s,"protein":%s,"carbs":%s,"fat":%s,"published":false}
                """.formatted(name, kcalPer100g, protein, carbs, fat);
    }

    // Each body breaks exactly one constraint of FoodRequest; the third value is the field that must be reported.
    static Stream<Arguments> invalidBodies() {
        return Stream.of(
                Arguments.of("name with 101 chars", body("\"" + "a".repeat(101) + "\"", "372", "13.5", "58.7", "7"), "name"),
                Arguments.of("empty name", body("\"\"", "372", "13.5", "58.7", "7"), "name"),
                Arguments.of("whitespace-only name", body("\"   \"", "372", "13.5", "58.7", "7"), "name"),
                Arguments.of("null name", body("null", "372", "13.5", "58.7", "7"), "name"),
                Arguments.of("negative kcalPer100g", body("\"Haferflocken\"", "-1", "13.5", "58.7", "7"), "kcalPer100g"),
                Arguments.of("negative protein", body("\"Haferflocken\"", "372", "-0.1", "58.7", "7"), "protein"),
                Arguments.of("negative carbs", body("\"Haferflocken\"", "372", "13.5", "-1", "7"), "carbs"),
                Arguments.of("negative fat", body("\"Haferflocken\"", "372", "13.5", "58.7", "-1"), "fat"),
                Arguments.of("null kcalPer100g", body("\"Haferflocken\"", "null", "13.5", "58.7", "7"), "kcalPer100g"),
                Arguments.of("null protein", body("\"Haferflocken\"", "372", "null", "58.7", "7"), "protein"),
                Arguments.of("null carbs", body("\"Haferflocken\"", "372", "13.5", "null", "7"), "carbs"),
                Arguments.of("null fat", body("\"Haferflocken\"", "372", "13.5", "58.7", "null"), "fat"),
                Arguments.of("published missing", """
                        {"name":"Haferflocken","kcalPer100g":372,"protein":13.5,"carbs":58.7,"fat":7}
                        """, "published"));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidBodies")
    void create_invalidField_returns400WithThatFieldAndDoesNotCallService(
            String description, String body, String expectedField) throws Exception {
        mockMvc.perform(post("/api/foods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.fieldErrors[*].field", hasItem(expectedField)));

        verifyNoInteractions(service);
    }

    // Boundaries that must still pass: @PositiveOrZero allows 0, @Size(max = 100) allows exactly 100 chars.
    static Stream<Arguments> boundaryBodies() {
        return Stream.of(
                Arguments.of("all nutrient values 0", body("\"Wasser\"", "0", "0", "0", "0")),
                Arguments.of("name with exactly 100 chars", body("\"" + "a".repeat(100) + "\"", "372", "13.5", "58.7", "7")));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("boundaryBodies")
    void create_boundaryValues_passValidationAndReachService(String description, String body) throws Exception {
        mockMvc.perform(post("/api/foods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        verify(service).create(eq(1L), any());
    }
}