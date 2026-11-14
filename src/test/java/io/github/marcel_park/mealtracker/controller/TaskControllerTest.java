package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.config.CorsConfig;
import io.github.marcel_park.mealtracker.dto.TaskRequest;
import io.github.marcel_park.mealtracker.dto.TaskResponse;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.security.SecurityConfig;
import io.github.marcel_park.mealtracker.security.WithCurrentUser;
import io.github.marcel_park.mealtracker.service.AuthTokenService;
import io.github.marcel_park.mealtracker.service.TaskService;
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

import java.time.DayOfWeek;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Every request runs as user 1 (@WithCurrentUser); the controller passes that id on.
@WebMvcTest(TaskController.class)
@Import({SecurityConfig.class, CorsConfig.class})
@WithCurrentUser
class TaskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TaskService service;

    // Needed by the token filter in SecurityConfig.
    @MockitoBean
    private AuthTokenService authTokenService;

    private static final TaskResponse SHAKE =
            new TaskResponse(3L, "Proteinshake", List.of(DayOfWeek.MONDAY), 114.0, List.of());

    @Test
    void list_returnsTheTasksOfTheLoggedInUser() throws Exception {
        when(service.findAll(1L)).thenReturn(List.of(SHAKE));

        mockMvc.perform(get("/api/tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Proteinshake"))
                .andExpect(jsonPath("$[0].weekdays[0]").value("MONDAY"));
    }

    @Test
    void create_passesNameDaysAndFoodsOn() throws Exception {
        when(service.create(eq(1L), any())).thenReturn(SHAKE);

        mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Proteinshake","weekdays":["MONDAY","FRIDAY"],
                                 "items":[{"foodId":1,"amount":30},{"foodId":2,"portionId":5,"portionCount":1}]}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(3));

        ArgumentCaptor<TaskRequest> request = ArgumentCaptor.forClass(TaskRequest.class);
        verify(service).create(eq(1L), request.capture());
        assertThat(request.getValue().weekdays()).containsExactlyInAnyOrder(DayOfWeek.MONDAY, DayOfWeek.FRIDAY);
        assertThat(request.getValue().items()).hasSize(2);
    }

    @Test
    void create_withoutFoods_isValid() throws Exception {
        mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Spazieren\",\"weekdays\":[\"SUNDAY\"],\"items\":[]}"))
                .andExpect(status().isCreated());
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', textBlock = """
            blank name          | {"name":" ","weekdays":["MONDAY"],"items":[]}                        | name
            name with 101 chars | {"name":"%s","weekdays":["MONDAY"],"items":[]}                       | name
            no weekday          | {"name":"Shake","weekdays":[],"items":[]}                            | weekdays
            weekdays missing    | {"name":"Shake","items":[]}                                          | weekdays
            items missing       | {"name":"Shake","weekdays":["MONDAY"]}                               | items
            item without amount | {"name":"Shake","weekdays":["MONDAY"],"items":[{"foodId":1}]}        | items[0].quantityComplete
            """)
    void create_invalidField_returns400WithThatField(String violation, String body, String field) throws Exception {
        mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body.formatted("a".repeat(101))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[*].field", hasItem(field)));

        verifyNoInteractions(service);
    }

    @Test
    void create_unknownWeekday_returns400() throws Exception {
        mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Shake\",\"weekdays\":[\"FUNDAY\"],\"items\":[]}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(service);
    }

    @Test
    void update_taskOfSomebodyElse_returns404() throws Exception {
        when(service.update(eq(1L), eq(9L), any())).thenThrow(new NotFoundException("Task", 9L));

        mockMvc.perform(put("/api/tasks/9")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Shake\",\"weekdays\":[\"MONDAY\"],\"items\":[]}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void delete_returns204() throws Exception {
        mockMvc.perform(delete("/api/tasks/3"))
                .andExpect(status().isNoContent());

        verify(service).delete(1L, 3L);
    }

    @Test
    void delete_unknownTask_returns404() throws Exception {
        doThrow(new NotFoundException("Task", 9L)).when(service).delete(1L, 9L);

        mockMvc.perform(delete("/api/tasks/9"))
                .andExpect(status().isNotFound());
    }
}
