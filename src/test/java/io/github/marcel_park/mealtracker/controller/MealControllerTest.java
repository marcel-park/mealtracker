package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.dto.MealItemRequest;
import io.github.marcel_park.mealtracker.dto.MealItemResponse;
import io.github.marcel_park.mealtracker.dto.MealRequest;
import io.github.marcel_park.mealtracker.dto.MealResponse;
import io.github.marcel_park.mealtracker.config.CorsConfig;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.security.SecurityConfig;
import io.github.marcel_park.mealtracker.security.WithCurrentUser;
import io.github.marcel_park.mealtracker.service.AuthTokenService;
import io.github.marcel_park.mealtracker.service.MealService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.hamcrest.Matchers.hasItem;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// Every request runs as user 1 (@WithCurrentUser); the controller must pass that id on.
@WebMvcTest(MealController.class)
@Import({SecurityConfig.class, CorsConfig.class})
@WithCurrentUser(userId = MealControllerTest.USER_ID)
class MealControllerTest {

    static final long USER_ID = 1L;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MealService service;

    // Needed by the token filter in SecurityConfig, unused here because @WithCurrentUser
    // authenticates the requests directly.
    @MockitoBean
    private AuthTokenService authTokenService;

    private static final String VALID_BODY = """
            {"title":"Haferflocken, Milch","items":[{"foodId":1,"amountG":150},{"foodId":2,"amountG":200}]}
            """;

    // Non-zero seconds, so the expected ISO string does not depend on whether ":00" is written.
    private static final LocalDateTime BOOKED_AT = LocalDateTime.of(2026, 11, 3, 12, 30, 15);

    private static MealResponse meal(Long id) {
        return new MealResponse(id, "Haferflocken, Milch", BOOKED_AT, 686.0, List.of(
                new MealItemResponse(1L, "Haferflocken", 150.0, 558.0),
                new MealItemResponse(2L, "Milch", 200.0, 128.0)));
    }

    // ---------- GET /api/meals ----------

    @Test
    void list_returnsMealsWithItemsAsJson() throws Exception {
        when(service.findAll(USER_ID)).thenReturn(List.of(meal(1L)));

        mockMvc.perform(get("/api/meals"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].title").value("Haferflocken, Milch"))
                .andExpect(jsonPath("$[0].bookedAt").value("2026-11-03T12:30:15"))
                .andExpect(jsonPath("$[0].kcal").value(686.0))
                .andExpect(jsonPath("$[0].items.length()").value(2))
                .andExpect(jsonPath("$[0].items[0].foodId").value(1))
                .andExpect(jsonPath("$[0].items[0].foodName").value("Haferflocken"))
                .andExpect(jsonPath("$[0].items[0].amountG").value(150.0))
                .andExpect(jsonPath("$[0].items[0].kcal").value(558.0));
    }

    @Test
    void list_withDate_returnsOnlyTheMealsOfThatDay() throws Exception {
        when(service.findBookedOn(USER_ID, LocalDate.of(2026, 11, 3))).thenReturn(List.of(meal(1L)));

        mockMvc.perform(get("/api/meals").param("date", "2026-11-03"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1));

        verify(service, never()).findAll(any());
    }

    @Test
    void list_invalidDate_returns400AndDoesNotCallService() throws Exception {
        mockMvc.perform(get("/api/meals").param("date", "03.11.2026"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));

        verifyNoInteractions(service);
    }

    // ---------- POST /api/meals ----------

    @Test
    void create_validRequest_returns201WithBody() throws Exception {
        when(service.create(eq(USER_ID), any())).thenReturn(meal(1L));

        mockMvc.perform(post("/api/meals")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.kcal").value(686.0));
    }

    @Test
    void create_validRequest_passesDeserializedRequestToService() throws Exception {
        when(service.create(eq(USER_ID), any())).thenReturn(meal(1L));

        mockMvc.perform(post("/api/meals")
                .contentType(MediaType.APPLICATION_JSON)
                .content(VALID_BODY));

        ArgumentCaptor<MealRequest> captor = ArgumentCaptor.forClass(MealRequest.class);
        verify(service).create(eq(USER_ID), captor.capture());
        MealRequest passed = captor.getValue();
        assertThat(passed.title()).isEqualTo("Haferflocken, Milch");
        assertThat(passed.items())
                .extracting(MealItemRequest::foodId, MealItemRequest::amountG)
                .containsExactly(tuple(1L, 150.0), tuple(2L, 200.0));
    }

    @Test
    void create_unknownFood_returns404WithErrorBody() throws Exception {
        when(service.create(eq(USER_ID), any())).thenThrow(new NotFoundException("Food", 99L));

        mockMvc.perform(post("/api/meals")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Food with id 99 not found"));
    }

    @Test
    void create_malformedJson_returns400() throws Exception {
        mockMvc.perform(post("/api/meals")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\": "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Malformed JSON request"));
    }

    // Each body breaks exactly one constraint of MealRequest / MealItemRequest. Spring reports a
    // constraint on a list element with the index in the path ("items[0].amountG").
    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', textBlock = """
            blank title       | {"title":"   ","items":[{"foodId":1,"amountG":150}]}  | title
            missing title     | {"items":[{"foodId":1,"amountG":150}]}               | title
            empty items       | {"title":"Snack","items":[]}                          | items
            missing items     | {"title":"Snack"}                                     | items
            null foodId       | {"title":"Snack","items":[{"foodId":null,"amountG":150}]} | items[0].foodId
            amountG 0         | {"title":"Snack","items":[{"foodId":1,"amountG":0}]}  | items[0].amountG
            negative amountG  | {"title":"Snack","items":[{"foodId":1,"amountG":-5}]} | items[0].amountG
            """)
    void create_invalidRequest_returns400WithFieldErrorAndDoesNotCallService(
            String violation, String body, String expectedField) throws Exception {
        mockMvc.perform(post("/api/meals")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.fieldErrors[*].field", hasItem(expectedField)));

        verifyNoInteractions(service);
    }

    // ---------- PUT /api/meals/{id} ----------

    @Test
    void update_validRequest_returns200WithBody() throws Exception {
        when(service.update(eq(USER_ID), eq(1L), any())).thenReturn(meal(1L));

        mockMvc.perform(put("/api/meals/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.title").value("Haferflocken, Milch"));
    }

    @Test
    void update_unknownMeal_returns404WithErrorBody() throws Exception {
        when(service.update(eq(USER_ID), eq(999L), any())).thenThrow(new NotFoundException("Meal", 999L));

        mockMvc.perform(put("/api/meals/999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Meal with id 999 not found"))
                .andExpect(jsonPath("$.fieldErrors").isEmpty());
    }

    @Test
    void update_invalidRequest_returns400AndDoesNotCallService() throws Exception {
        mockMvc.perform(put("/api/meals/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Snack","items":[]}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.fieldErrors[*].field", hasItem("items")));

        verifyNoInteractions(service);
    }

    // ---------- DELETE /api/meals/{id} ----------

    @Test
    void delete_existingId_returns204() throws Exception {
        mockMvc.perform(delete("/api/meals/1"))
                .andExpect(status().isNoContent());

        verify(service).delete(USER_ID, 1L);
    }

    @Test
    void delete_unknownId_returns404WithErrorBody() throws Exception {
        doThrow(new NotFoundException("Meal", 999L)).when(service).delete(USER_ID, 999L);

        mockMvc.perform(delete("/api/meals/999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Meal with id 999 not found"));
    }

    @Test
    void delete_nonNumericId_returns400() throws Exception {
        mockMvc.perform(delete("/api/meals/abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }
}
