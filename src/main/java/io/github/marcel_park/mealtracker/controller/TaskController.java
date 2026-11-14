package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.dto.TaskRequest;
import io.github.marcel_park.mealtracker.dto.TaskResponse;
import io.github.marcel_park.mealtracker.security.CurrentUser;
import io.github.marcel_park.mealtracker.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

// All endpoints work on the tasks of the logged-in user only.
@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public List<TaskResponse> list(@AuthenticationPrincipal CurrentUser user) {
        return taskService.findAll(user.userId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse create(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody TaskRequest request) {
        return taskService.create(user.userId(), request);
    }

    @PutMapping("/{id}")
    public TaskResponse update(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id,
                               @Valid @RequestBody TaskRequest request) {
        return taskService.update(user.userId(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id) {
        taskService.delete(user.userId(), id);
    }
}
