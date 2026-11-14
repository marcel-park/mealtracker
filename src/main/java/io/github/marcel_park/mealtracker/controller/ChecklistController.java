package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.dto.ChecklistEntryResponse;
import io.github.marcel_park.mealtracker.security.CurrentUser;
import io.github.marcel_park.mealtracker.service.ChecklistService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

// The checklist of the logged-in user for a day (date, e.g. 2026-11-14: the app's local date).
// Ticking a task off and on answers with the whole checklist of that day.
@RestController
@RequestMapping("/api/checklist")
public class ChecklistController {

    private final ChecklistService checklistService;

    public ChecklistController(ChecklistService checklistService) {
        this.checklistService = checklistService;
    }

    @GetMapping
    public List<ChecklistEntryResponse> get(@AuthenticationPrincipal CurrentUser user,
                                            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return checklistService.get(user.userId(), date);
    }

    // Books the task's foods as a meal.
    @PutMapping("/{taskId}/done")
    public List<ChecklistEntryResponse> complete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long taskId,
                                                 @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return checklistService.complete(user.userId(), taskId, date);
    }

    // Deletes the meal it booked.
    @DeleteMapping("/{taskId}/done")
    public List<ChecklistEntryResponse> reopen(@AuthenticationPrincipal CurrentUser user, @PathVariable Long taskId,
                                               @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return checklistService.reopen(user.userId(), taskId, date);
    }
}
