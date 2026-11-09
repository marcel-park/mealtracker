package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.config.CorsConfig;
import io.github.marcel_park.mealtracker.dto.CatalogScope;
import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.dto.RecipeItemResponse;
import io.github.marcel_park.mealtracker.dto.RecipeResponse;
import io.github.marcel_park.mealtracker.dto.VariationItemResponse;
import io.github.marcel_park.mealtracker.dto.VariationResponse;
import io.github.marcel_park.mealtracker.exception.ForbiddenException;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.security.SecurityConfig;
import io.github.marcel_park.mealtracker.security.WithCurrentUser;
import io.github.marcel_park.mealtracker.service.AuthTokenService;
import io.github.marcel_park.mealtracker.service.RecipeService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.hasItems;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(RecipeController.class)
@Import({SecurityConfig.class, CorsConfig.class})
@WithCurrentUser
class RecipeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private RecipeService service;

    // Needed by the token filter in SecurityConfig, see FoodControllerTest.
    @MockitoBean
    private AuthTokenService authTokenService;

    private static final String VALID_BODY = """
            {"name":"Chili","servings":4,"published":false,"items":[{"foodId":1,"amountG":400}]}
            """;

    private static RecipeResponse chili() {
        FoodResponse beans = new FoodResponse(1L, "Kidneybohnen", 100, 8, 12, 0.5, true, false, false);
        return new RecipeResponse(5L, "Chili", 4, true, false, false, 400, 400,
                List.of(new RecipeItemResponse(beans, 400, 400)),
                List.of(new VariationResponse(9L, "Mehr Bohnen", null, 1800.0,
                        List.of(new VariationItemResponse(beans, 600)))),
                9L);
    }

    @Test
    void list_returnsRecipesWithItemsAsJson() throws Exception {
        when(service.find(1L, "chili", CatalogScope.PUBLIC)).thenReturn(List.of(chili()));

        mockMvc.perform(get("/api/recipes").param("query", "chili").param("scope", "PUBLIC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(5))
                .andExpect(jsonPath("$[0].servings").value(4.0))
                .andExpect(jsonPath("$[0].owned").value(true))
                .andExpect(jsonPath("$[0].items[0].food.name").value("Kidneybohnen"))
                .andExpect(jsonPath("$[0].items[0].amountG").value(400.0))
                .andExpect(jsonPath("$[0].variations[0].name").value("Mehr Bohnen"))
                .andExpect(jsonPath("$[0].variations[0].servings").isEmpty())
                .andExpect(jsonPath("$[0].variations[0].items[0].amountG").value(600.0))
                .andExpect(jsonPath("$[0].lastUsedVariationId").value(9));
    }

    @Test
    void get_unknownId_returns404() throws Exception {
        when(service.get(1L, 9L)).thenThrow(new NotFoundException("Recipe", 9L));

        mockMvc.perform(get("/api/recipes/9"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Recipe with id 9 not found"));
    }

    @Test
    void create_validRequest_returns201() throws Exception {
        when(service.create(eq(1L), any())).thenReturn(chili());

        mockMvc.perform(post("/api/recipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(5));
    }

    @Test
    void create_invalidRequest_returns400WithFieldErrorsAndDoesNotCallService() throws Exception {
        String invalid = """
                {"name":"","servings":0,"items":[]}
                """;

        mockMvc.perform(post("/api/recipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalid))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[*].field",
                        hasItems("name", "servings", "published", "items")));

        verifyNoInteractions(service);
    }

    @Test
    void create_invalidItemAmount_returns400() throws Exception {
        String invalid = """
                {"name":"Chili","servings":4,"published":false,"items":[{"foodId":1,"amountG":0}]}
                """;

        mockMvc.perform(post("/api/recipes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalid))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @Test
    void update_recipeOfOtherUser_returns403() throws Exception {
        when(service.update(eq(1L), eq(5L), any())).thenThrow(new ForbiddenException("Recipe", 5L));

        mockMvc.perform(put("/api/recipes/5")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    void delete_returns204() throws Exception {
        mockMvc.perform(delete("/api/recipes/5"))
                .andExpect(status().isNoContent());

        verify(service).delete(1L, 5L);
    }

    @Test
    void delete_recipeOfOtherUser_returns403() throws Exception {
        doThrow(new ForbiddenException("Recipe", 5L)).when(service).delete(1L, 5L);

        mockMvc.perform(delete("/api/recipes/5"))
                .andExpect(status().isForbidden());
    }

    // ---------- variations ----------

    private static final String VARIATION_BODY = """
            {"name":"Mehr Bohnen","servings":null,"weightG":1800,"items":[{"foodId":1,"amountG":600}]}
            """;

    @Test
    void createVariation_returns201() throws Exception {
        FoodResponse beans = new FoodResponse(1L, "Kidneybohnen", 100, 8, 12, 0.5, true, false, false);
        when(service.createVariation(eq(1L), eq(5L), any())).thenReturn(
                new VariationResponse(9L, "Mehr Bohnen", null, 1800.0, List.of(new VariationItemResponse(beans, 600))));

        mockMvc.perform(post("/api/recipes/5/variations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VARIATION_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(9))
                .andExpect(jsonPath("$.items[0].food.id").value(1));
    }

    @Test
    void createVariation_invalidRequest_returns400() throws Exception {
        String invalid = """
                {"name":"","servings":0,"items":[{"foodId":1,"amountG":-1}]}
                """;

        mockMvc.perform(post("/api/recipes/5/variations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalid))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[*].field", hasItems("name", "servings")));

        verifyNoInteractions(service);
    }

    @Test
    void createVariation_zeroAmountMeansLeftOut_passesValidation() throws Exception {
        mockMvc.perform(post("/api/recipes/5/variations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Ohne Bohnen","items":[{"foodId":1,"amountG":0}]}
                                """))
                .andExpect(status().isCreated());

        verify(service).createVariation(eq(1L), eq(5L), any());
    }

    @Test
    void createVariation_onRecipeOfOtherUser_returns403() throws Exception {
        when(service.createVariation(eq(1L), eq(5L), any())).thenThrow(new ForbiddenException("Recipe", 5L));

        mockMvc.perform(post("/api/recipes/5/variations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VARIATION_BODY))
                .andExpect(status().isForbidden());
    }

    @Test
    void updateVariation_returns200() throws Exception {
        when(service.updateVariation(eq(1L), eq(5L), eq(9L), any())).thenReturn(
                new VariationResponse(9L, "Mehr Bohnen", null, null, List.of()));

        mockMvc.perform(put("/api/recipes/5/variations/9")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VARIATION_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Mehr Bohnen"));
    }

    @Test
    void deleteVariation_returns204() throws Exception {
        mockMvc.perform(delete("/api/recipes/5/variations/9"))
                .andExpect(status().isNoContent());

        verify(service).deleteVariation(1L, 5L, 9L);
    }

    @Test
    void deleteVariation_unknownId_returns404() throws Exception {
        doThrow(new NotFoundException("Variation", 9L)).when(service).deleteVariation(1L, 5L, 9L);

        mockMvc.perform(delete("/api/recipes/5/variations/9"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Variation with id 9 not found"));
    }
}
