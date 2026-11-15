package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.config.CorsConfig;
import io.github.marcel_park.mealtracker.dto.CatalogScope;
import io.github.marcel_park.mealtracker.dto.FoodPortionRequest;
import io.github.marcel_park.mealtracker.dto.FoodPortionResponse;
import io.github.marcel_park.mealtracker.dto.FoodRequest;
import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.exception.ForbiddenException;
import io.github.marcel_park.mealtracker.exception.InvalidRequestException;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.FoodUnit;
import io.github.marcel_park.mealtracker.model.Nutrient;
import io.github.marcel_park.mealtracker.security.SecurityConfig;
import io.github.marcel_park.mealtracker.security.WithCurrentUser;
import io.github.marcel_park.mealtracker.service.AuthTokenService;
import io.github.marcel_park.mealtracker.service.FoodService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
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
            {"name":"Haferflocken","kcalPer100":372,"protein":13.5,"carbs":58.7,"fat":7,"nutrients":{},"published":false,"unit":"G","portions":[]}
            """;

    @Test
    void list_returnsFoodsAsJson() throws Exception {
        when(service.find(1L, null, null, false)).thenReturn(List.of(
                new FoodResponse(1L, "Haferflocken", FoodUnit.G, 372, 13.5, 58.7, 7, Map.of(), List.of(), true, false, false, false, null)));

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
                new FoodResponse(1L, "Haferflocken", FoodUnit.G, 372, 13.5, 58.7, 7, Map.of(), List.of(), true, false, false, false, null));

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
                {"name":"","kcalPer100":-5,"carbs":10,"fat":1}
                """;

        mockMvc.perform(post("/api/foods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalid))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.fieldErrors[*].field",
                        hasItems("name", "kcalPer100", "protein")));
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"4311501042228", "12345", "43115010422x9"})
    void create_invalidEanCode_returns400(String eanCode) throws Exception {
        mockMvc.perform(post("/api/foods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY.replace("\"portions\":[]", "\"portions\":[],\"eanCode\":\"" + eanCode + "\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[*].field", hasItem("validEanCode")));

        verifyNoInteractions(service);
    }

    @Test
    void create_withEanCode_passesItOn() throws Exception {
        when(service.create(eq(1L), any())).thenReturn(
                new FoodResponse(1L, "Bacon", FoodUnit.G, 291, 16, 0.5, 25, Map.of(), List.of(), true, false, false, false, "4311596443819"));

        mockMvc.perform(post("/api/foods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY.replace("\"portions\":[]", "\"portions\":[],\"eanCode\":\"4311596443819\"")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.eanCode").value("4311596443819"));

        verify(service).create(eq(1L), argThat(request -> "4311596443819".equals(request.eanCode())));
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
                new FoodResponse(1L, "Haferflocken", FoodUnit.G, 372, 13.5, 58.7, 7, Map.of(), List.of(), true, false, false, false, null));

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
        when(service.get(1L, 1L)).thenReturn(new FoodResponse(1L, "Haferflocken", FoodUnit.G, 372, 13.5, 58.7, 7, Map.of(), List.of(), true, false, false, false, null));

        mockMvc.perform(get("/api/foods/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("Haferflocken"))
                .andExpect(jsonPath("$.kcalPer100").value(372.0))
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
                {"name":"   ","kcalPer100":372,"protein":13.5,"carbs":58.7,"fat":-1,"nutrients":{},"published":false,"unit":"G","portions":[]}
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
                new FoodResponse(1L, "Haferflocken", FoodUnit.G, 372, 13.5, 58.7, 7, Map.of(), List.of(), false, true, false, false, null)));

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

    // ---------- unit and portions ----------

    @Test
    void create_unknownUnit_returns400() throws Exception {
        mockMvc.perform(post("/api/foods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(withUnitAndPortions("\"KG\"", "[]")))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @Test
    void create_passesUnitAndPortionsToService() throws Exception {
        mockMvc.perform(post("/api/foods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(withUnitAndPortions("\"ML\"",
                                "[{\"id\":3,\"name\":\"Flasche\",\"amount\":330,\"favorite\":true}]")))
                .andExpect(status().isCreated());

        ArgumentCaptor<FoodRequest> captor = ArgumentCaptor.forClass(FoodRequest.class);
        verify(service).create(eq(1L), captor.capture());
        assertThat(captor.getValue().unit()).isEqualTo(FoodUnit.ML);
        assertThat(captor.getValue().portions())
                .containsExactly(new FoodPortionRequest(3L, "Flasche", 330.0, true));
    }

    @Test
    void get_returnsUnitPortionsAndUsedFlag() throws Exception {
        when(service.get(1L, 1L)).thenReturn(new FoodResponse(1L, "Bier", FoodUnit.ML, 42, 0.5, 3, 0, Map.of(),
                List.of(new FoodPortionResponse(4L, "Flasche", 330, true)), true, false, false, true, null));

        mockMvc.perform(get("/api/foods/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unit").value("ML"))
                .andExpect(jsonPath("$.portions[0].id").value(4))
                .andExpect(jsonPath("$.portions[0].name").value("Flasche"))
                .andExpect(jsonPath("$.portions[0].amount").value(330.0))
                .andExpect(jsonPath("$.portions[0].favorite").value(true))
                .andExpect(jsonPath("$.used").value(true));
    }

    @Test
    void update_duplicatePortionNames_returns400() throws Exception {
        when(service.update(eq(1L), eq(1L), any())).thenThrow(new InvalidRequestException("same name"));

        mockMvc.perform(put("/api/foods/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("same name"));
    }

    @Test
    void create_withNutrients_passesThemToService() throws Exception {
        mockMvc.perform(post("/api/foods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(withNutrients("{\"VITAMIN_D\":11,\"OMEGA_3\":2.5,\"IODINE\":34}")))
                .andExpect(status().isCreated());

        ArgumentCaptor<FoodRequest> request = ArgumentCaptor.forClass(FoodRequest.class);
        verify(service).create(eq(1L), request.capture());
        assertThat(request.getValue().nutrients()).isEqualTo(
                Map.of(Nutrient.VITAMIN_D, 11.0, Nutrient.OMEGA_3, 2.5, Nutrient.IODINE, 34.0));
    }

    @Test
    void create_unknownNutrient_returns400() throws Exception {
        mockMvc.perform(post("/api/foods")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(withNutrients("{\"VITAMIN_X\":1}")))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @Test
    void get_returnsNutrients() throws Exception {
        when(service.get(1L, 1L)).thenReturn(new FoodResponse(1L, "Lachs", FoodUnit.G, 200, 20, 2, 13,
                Map.of(Nutrient.VITAMIN_D, 11.0), List.of(), true, false, false, false, null));

        mockMvc.perform(get("/api/foods/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nutrients.VITAMIN_D").value(11.0));
    }

    // ---------- FoodRequest validation (POST) ----------

    private static String body(String name, String kcalPer100, String protein, String carbs, String fat) {
        return """
                {"name":%s,"kcalPer100":%s,"protein":%s,"carbs":%s,"fat":%s,"nutrients":{},"published":false,"unit":"G","portions":[]}
                """.formatted(name, kcalPer100, protein, carbs, fat);
    }

    // A valid food with the given JSON values for unit and portions.
    private static String withUnitAndPortions(String unit, String portions) {
        return """
                {"name":"Haferflocken","kcalPer100":372,"protein":13.5,"carbs":58.7,"fat":7,"nutrients":{},"published":false,
                 "unit":%s,"portions":%s}
                """.formatted(unit, portions);
    }

    // A valid salmon (2 g carbs, 13 g fat) with the given JSON value for nutrients.
    private static String withNutrients(String nutrients) {
        return """
                {"name":"Lachs","kcalPer100":200,"protein":20,"carbs":2,"fat":13,"nutrients":%s,"published":false,
                 "unit":"G","portions":[]}
                """.formatted(nutrients);
    }

    // Each body breaks exactly one constraint of FoodRequest; the third value is the field that must be reported.
    static Stream<Arguments> invalidBodies() {
        return Stream.of(
                Arguments.of("name with 101 chars", body("\"" + "a".repeat(101) + "\"", "372", "13.5", "58.7", "7"), "name"),
                Arguments.of("empty name", body("\"\"", "372", "13.5", "58.7", "7"), "name"),
                Arguments.of("whitespace-only name", body("\"   \"", "372", "13.5", "58.7", "7"), "name"),
                Arguments.of("null name", body("null", "372", "13.5", "58.7", "7"), "name"),
                Arguments.of("negative kcalPer100", body("\"Haferflocken\"", "-1", "13.5", "58.7", "7"), "kcalPer100"),
                Arguments.of("negative protein", body("\"Haferflocken\"", "372", "-0.1", "58.7", "7"), "protein"),
                Arguments.of("negative carbs", body("\"Haferflocken\"", "372", "13.5", "-1", "7"), "carbs"),
                Arguments.of("negative fat", body("\"Haferflocken\"", "372", "13.5", "58.7", "-1"), "fat"),
                Arguments.of("null kcalPer100", body("\"Haferflocken\"", "null", "13.5", "58.7", "7"), "kcalPer100"),
                Arguments.of("null protein", body("\"Haferflocken\"", "372", "null", "58.7", "7"), "protein"),
                Arguments.of("null carbs", body("\"Haferflocken\"", "372", "13.5", "null", "7"), "carbs"),
                Arguments.of("null fat", body("\"Haferflocken\"", "372", "13.5", "58.7", "null"), "fat"),
                Arguments.of("published missing", """
                        {"name":"Haferflocken","kcalPer100":372,"protein":13.5,"carbs":58.7,"fat":7,"unit":"G","portions":[]}
                        """, "published"),
                Arguments.of("unit missing", withUnitAndPortions("null", "[]"), "unit"),
                Arguments.of("portions missing", withUnitAndPortions("\"G\"", "null"), "portions"),
                Arguments.of("portion name empty",
                        withUnitAndPortions("\"G\"", "[{\"name\":\" \",\"amount\":250}]"), "portions[0].name"),
                Arguments.of("portion name with 21 chars",
                        withUnitAndPortions("\"G\"", "[{\"name\":\"" + "a".repeat(21) + "\",\"amount\":250}]"),
                        "portions[0].name"),
                Arguments.of("portion amount 0",
                        withUnitAndPortions("\"G\"", "[{\"name\":\"Packung\",\"amount\":0}]"), "portions[0].amount"),
                Arguments.of("portion amount missing",
                        withUnitAndPortions("\"G\"", "[{\"name\":\"Packung\"}]"), "portions[0].amount"),
                Arguments.of("nutrients missing", withNutrients("null"), "nutrients"),
                Arguments.of("negative nutrient", withNutrients("{\"FIBER\":-0.1}"), "nutrients[FIBER]"),
                Arguments.of("nutrient without value", withNutrients("{\"FIBER\":null}"), "nutrients[FIBER]"),
                Arguments.of("more sugar than carbs", withNutrients("{\"SUGAR\":2.1}"), "nutrientParts"),
                Arguments.of("more saturated fat than fat", withNutrients("{\"SATURATED_FAT\":13.1}"), "nutrientParts"),
                Arguments.of("more monounsaturated fat than fat",
                        withNutrients("{\"MONOUNSATURATED_FAT\":13.1}"), "nutrientParts"),
                Arguments.of("more polyunsaturated fat than fat",
                        withNutrients("{\"POLYUNSATURATED_FAT\":13.1}"), "nutrientParts"),
                Arguments.of("more omega-3 than polyunsaturated fat",
                        withNutrients("{\"POLYUNSATURATED_FAT\":3,\"OMEGA_3\":3.1}"), "nutrientParts"),
                Arguments.of("more omega-3 than fat, polyunsaturated fat unknown",
                        withNutrients("{\"OMEGA_3\":13.1}"), "nutrientParts"));
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
                Arguments.of("name with exactly 100 chars", body("\"" + "a".repeat(100) + "\"", "372", "13.5", "58.7", "7")),
                Arguments.of("millilitres", withUnitAndPortions("\"ML\"", "[]")),
                Arguments.of("portion name with exactly 20 chars, favorite omitted",
                        withUnitAndPortions("\"G\"", "[{\"name\":\"" + "a".repeat(20) + "\",\"amount\":0.5}]")),
                Arguments.of("nutrient 0", withNutrients("{\"VITAMIN_C\":0}")),
                // Each fatty acid on its own may reach the fat, even if they add up to more (rounding on labels)
                Arguments.of("parts equal to their whole", withNutrients("""
                        {"SUGAR":2,"SATURATED_FAT":13,"MONOUNSATURATED_FAT":13,"POLYUNSATURATED_FAT":3,"OMEGA_3":3}
                        """)),
                Arguments.of("omega-3 up to the fat, polyunsaturated fat unknown", withNutrients("{\"OMEGA_3\":13}")));
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