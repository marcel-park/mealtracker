package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.config.CorsConfig;
import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.dto.ShoppingListAddRequest;
import io.github.marcel_park.mealtracker.dto.ShoppingListItemResponse;
import io.github.marcel_park.mealtracker.dto.ShoppingListQuantityRequest;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.FoodUnit;
import io.github.marcel_park.mealtracker.security.SecurityConfig;
import io.github.marcel_park.mealtracker.security.WithCurrentUser;
import io.github.marcel_park.mealtracker.service.AuthTokenService;
import io.github.marcel_park.mealtracker.service.ShoppingListService;
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

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// Every request runs as user 1 (@WithCurrentUser); the controller must pass that id on.
@WebMvcTest(ShoppingListController.class)
@Import({SecurityConfig.class, CorsConfig.class})
@WithCurrentUser(userId = ShoppingListControllerTest.USER_ID)
class ShoppingListControllerTest {

    static final long USER_ID = 1L;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ShoppingListService service;

    // Needed by the token filter in SecurityConfig, unused here because @WithCurrentUser
    // authenticates the requests directly.
    @MockitoBean
    private AuthTokenService authTokenService;

    private static final List<ShoppingListItemResponse> LIST = List.of(new ShoppingListItemResponse(
            5L,
            new FoodResponse(3L, "Ei", FoodUnit.G, 144, 12, 1, 10, List.of(), false, true, false, true),
            150.0, 50L, new BigDecimal("2.50"), true));

    @Test
    void list_returnsTheItemsWithQuantityAndCheckedState() throws Exception {
        when(service.find(USER_ID)).thenReturn(LIST);

        mockMvc.perform(get("/api/shopping-list"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(5))
                .andExpect(jsonPath("$[0].food.name").value("Ei"))
                .andExpect(jsonPath("$[0].amount").value(150.0))
                .andExpect(jsonPath("$[0].portionId").value(50))
                .andExpect(jsonPath("$[0].portionCount").value(2.5))
                .andExpect(jsonPath("$[0].checked").value(true));
    }

    @Test
    void add_passesItemsAndRecipeOn() throws Exception {
        when(service.add(eq(USER_ID), any())).thenReturn(LIST);

        mockMvc.perform(post("/api/shopping-list/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"items":[{"foodId":3,"portionId":50,"portionCount":4},{"foodId":2,"amount":500}],
                                 "recipes":[{"recipeId":7,"variationId":null}]}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(5));

        ArgumentCaptor<ShoppingListAddRequest> captor = ArgumentCaptor.forClass(ShoppingListAddRequest.class);
        verify(service).add(eq(USER_ID), captor.capture());
        assertThat(captor.getValue().items()).hasSize(2);
        assertThat(captor.getValue().items().get(1).amount()).isEqualTo(500.0);
        assertThat(captor.getValue().recipes().get(0).recipeId()).isEqualTo(7L);
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', textBlock = """
            empty items       | {"items":[]}                                              | items
            missing items     | {}                                                        | items
            no quantity       | {"items":[{"foodId":3}]}                                  | items[0].quantityComplete
            amount 0          | {"items":[{"foodId":3,"amount":0}]}                       | items[0].amount
            count 0           | {"items":[{"foodId":3,"portionId":50,"portionCount":0}]}  | items[0].portionCount
            """)
    void add_invalidRequest_returns400AndDoesNotCallService(String violation, String body, String field)
            throws Exception {
        mockMvc.perform(post("/api/shopping-list/items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[*].field", hasItem(field)));

        verifyNoInteractions(service);
    }

    @Test
    void check_passesTheNewStateOn() throws Exception {
        when(service.setChecked(USER_ID, 5L, true)).thenReturn(LIST);

        mockMvc.perform(put("/api/shopping-list/items/5/checked")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"checked\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].checked").value(true));
    }

    @Test
    void setQuantity_passesPortionAndCountOn() throws Exception {
        when(service.setQuantity(eq(USER_ID), eq(5L), any())).thenReturn(LIST);

        mockMvc.perform(put("/api/shopping-list/items/5/quantity")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"portionId\":50,\"portionCount\":6}"))
                .andExpect(status().isOk());

        ArgumentCaptor<ShoppingListQuantityRequest> captor = ArgumentCaptor.forClass(ShoppingListQuantityRequest.class);
        verify(service).setQuantity(eq(USER_ID), eq(5L), captor.capture());
        assertThat(captor.getValue().portionId()).isEqualTo(50L);
        assertThat(captor.getValue().portionCount()).isEqualByComparingTo("6");
    }

    @Test
    void setQuantity_withoutQuantity_returns400() throws Exception {
        mockMvc.perform(put("/api/shopping-list/items/5/quantity")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[*].field", hasItem("quantityComplete")));

        verifyNoInteractions(service);
    }

    @Test
    void move_passesTheTargetPlaceOn() throws Exception {
        when(service.move(USER_ID, 5L, 2)).thenReturn(LIST);

        mockMvc.perform(post("/api/shopping-list/items/5/move").param("to", "2"))
                .andExpect(status().isOk());

        verify(service).move(USER_ID, 5L, 2);
    }

    @Test
    void move_withoutOrWithInvalidPlace_returns400() throws Exception {
        mockMvc.perform(post("/api/shopping-list/items/5/move"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/shopping-list/items/5/move").param("to", "oben"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @Test
    void remove_unknownItem_returns404() throws Exception {
        when(service.remove(USER_ID, 9L)).thenThrow(new NotFoundException("Shopping list item", 9L));

        mockMvc.perform(delete("/api/shopping-list/items/9"))
                .andExpect(status().isNotFound());
    }

    @Test
    void clear_returns204() throws Exception {
        mockMvc.perform(delete("/api/shopping-list"))
                .andExpect(status().isNoContent());

        verify(service).clear(USER_ID);
    }
}
