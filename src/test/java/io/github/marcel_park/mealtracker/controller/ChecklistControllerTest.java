package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.config.CorsConfig;
import io.github.marcel_park.mealtracker.dto.ChecklistEntryResponse;
import io.github.marcel_park.mealtracker.dto.TaskResponse;
import io.github.marcel_park.mealtracker.exception.InvalidRequestException;
import io.github.marcel_park.mealtracker.security.SecurityConfig;
import io.github.marcel_park.mealtracker.security.WithCurrentUser;
import io.github.marcel_park.mealtracker.service.AuthTokenService;
import io.github.marcel_park.mealtracker.service.ChecklistService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ChecklistController.class)
@Import({SecurityConfig.class, CorsConfig.class})
@WithCurrentUser
class ChecklistControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ChecklistService service;

    // Needed by the token filter in SecurityConfig.
    @MockitoBean
    private AuthTokenService authTokenService;

    private static final LocalDate DAY = LocalDate.of(2026, 11, 14);
    private static final List<ChecklistEntryResponse> CHECKLIST = List.of(new ChecklistEntryResponse(
            new TaskResponse(3L, "Proteinshake", List.of(DayOfWeek.SATURDAY), 114.0, List.of()), true, 20L));

    @Test
    void get_returnsTheChecklistOfTheDay() throws Exception {
        when(service.get(1L, DAY)).thenReturn(CHECKLIST);

        mockMvc.perform(get("/api/checklist").param("date", "2026-11-14"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].task.name").value("Proteinshake"))
                .andExpect(jsonPath("$[0].done").value(true))
                .andExpect(jsonPath("$[0].mealId").value(20));
    }

    @Test
    void get_withoutDate_returns400() throws Exception {
        mockMvc.perform(get("/api/checklist"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @Test
    void complete_ticksTheTaskOffOnThatDay() throws Exception {
        when(service.complete(1L, 3L, DAY)).thenReturn(CHECKLIST);

        mockMvc.perform(put("/api/checklist/3/done").param("date", "2026-11-14"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].done").value(true));
    }

    @Test
    void complete_taskNotDue_returns400() throws Exception {
        when(service.complete(1L, 3L, DAY)).thenThrow(new InvalidRequestException("not due"));

        mockMvc.perform(put("/api/checklist/3/done").param("date", "2026-11-14"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void reopen_opensTheTaskAgain() throws Exception {
        mockMvc.perform(delete("/api/checklist/3/done").param("date", "2026-11-14"))
                .andExpect(status().isOk());

        verify(service).reopen(1L, 3L, DAY);
    }
}
