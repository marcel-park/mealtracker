package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.service.FoodService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.hasItems;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(FoodController.class)
class FoodControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private FoodService service;

    private static final String VALID_BODY = """
            {"name":"Haferflocken","kcalPer100g":372,"protein":13.5,"carbs":58.7,"fat":7}
            """;

    @Test
    void list_returnsFoodsAsJson() throws Exception {
        when(service.find(null)).thenReturn(List.of(
                new FoodResponse(1L, "Haferflocken", 372, 13.5, 58.7, 7)));

        mockMvc.perform(get("/api/foods"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("Haferflocken"));
    }

    @Test
    void get_unknownId_returns404WithErrorBody() throws Exception {
        when(service.get(999L)).thenThrow(new NotFoundException("Food", 999L));

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
        when(service.create(any())).thenReturn(
                new FoodResponse(1L, "Haferflocken", 372, 13.5, 58.7, 7));

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
        when(service.update(any(), any())).thenReturn(
                new FoodResponse(1L, "Haferflocken", 372, 13.5, 58.7, 7));

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

        verify(service).delete(1L);
    }
}