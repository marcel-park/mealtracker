package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.config.CorsConfig;
import io.github.marcel_park.mealtracker.dto.UserItemRequest;
import io.github.marcel_park.mealtracker.dto.UserItemResponse;
import io.github.marcel_park.mealtracker.dto.UserItemScope;
import io.github.marcel_park.mealtracker.exception.ConflictException;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.security.SecurityConfig;
import io.github.marcel_park.mealtracker.security.WithCurrentUser;
import io.github.marcel_park.mealtracker.service.AuthTokenService;
import io.github.marcel_park.mealtracker.service.UserItemService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.hasItem;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// Every request runs as user 1 (@WithCurrentUser); the controller must pass that id on.
@WebMvcTest(UserItemController.class)
@Import({SecurityConfig.class, CorsConfig.class})
@WithCurrentUser(userId = UserItemControllerTest.USER_ID)
class UserItemControllerTest {

    static final long USER_ID = 1L;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserItemService service;

    // Needed by the token filter in SecurityConfig, unused here because @WithCurrentUser
    // authenticates the requests directly.
    @MockitoBean
    private AuthTokenService authTokenService;

    private static final UserItemResponse DETERGENT = new UserItemResponse(3L, "Spülmittel", true);

    @Test
    void list_passesQueryScopeAndPageOn() throws Exception {
        when(service.find(USER_ID, "spül", UserItemScope.OWN, 2, 50)).thenReturn(List.of(DETERGENT));

        mockMvc.perform(get("/api/user-items").param("query", "spül").param("scope", "OWN")
                        .param("page", "2").param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(3))
                .andExpect(jsonPath("$[0].name").value("Spülmittel"))
                .andExpect(jsonPath("$[0].owned").value(true));
    }

    @Test
    void list_withoutParameters_searchesEverythingVisible() throws Exception {
        when(service.find(USER_ID, null, null, 0, 50)).thenReturn(List.of());

        mockMvc.perform(get("/api/user-items")).andExpect(status().isOk());

        verify(service).find(USER_ID, null, null, 0, 50);
    }

    // User items are never public and are not booked.
    @ParameterizedTest
    @CsvSource({"PUBLIC", "RECENT", "nonsense"})
    void list_scopeThatDoesNotApply_returns400(String scope) throws Exception {
        mockMvc.perform(get("/api/user-items").param("scope", scope))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @Test
    void create_returns201WithTheItem() throws Exception {
        when(service.create(USER_ID, new UserItemRequest("Spülmittel"))).thenReturn(DETERGENT);

        mockMvc.perform(post("/api/user-items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Spülmittel\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(3));
    }

    @Test
    void create_nameTaken_returns409() throws Exception {
        when(service.create(eq(USER_ID), any())).thenThrow(new ConflictException("taken"));

        mockMvc.perform(post("/api/user-items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Milch\"}"))
                .andExpect(status().isConflict());
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', textBlock = """
            missing name | {}
            blank name   | {"name":"   "}
            """)
    void create_invalidName_returns400(String violation, String body) throws Exception {
        mockMvc.perform(post("/api/user-items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[*].field", hasItem("name")));

        verifyNoInteractions(service);
    }

    @Test
    void create_nameTooLong_returns400() throws Exception {
        mockMvc.perform(post("/api/user-items")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + "x".repeat(101) + "\"}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @Test
    void update_passesItOn() throws Exception {
        when(service.update(USER_ID, 3L, new UserItemRequest("Tabs"))).thenReturn(DETERGENT);

        mockMvc.perform(put("/api/user-items/3")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Tabs\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void delete_returns204() throws Exception {
        mockMvc.perform(delete("/api/user-items/3")).andExpect(status().isNoContent());

        verify(service).delete(USER_ID, 3L);
    }

    @Test
    void delete_itemOfSomebodyElse_returns404() throws Exception {
        doThrow(new NotFoundException("User item", 4L)).when(service).delete(USER_ID, 4L);

        mockMvc.perform(delete("/api/user-items/4")).andExpect(status().isNotFound());
    }
}
