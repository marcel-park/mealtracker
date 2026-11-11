package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.dto.MealRequest;
import io.github.marcel_park.mealtracker.dto.MealResponse;
import io.github.marcel_park.mealtracker.security.CurrentUser;
import io.github.marcel_park.mealtracker.service.MealService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

// All endpoints work on the meals of the logged-in user only.
@RestController
@RequestMapping("/api/meals")
public class MealController {

    private final MealService mealService;

    public MealController(MealService mealService) {
        this.mealService = mealService;
    }

    // date (e.g. 2026-11-11): only the meals booked on that day, as the main view shows them.
    // Without it all meals.
    @GetMapping
    public List<MealResponse> list(@AuthenticationPrincipal CurrentUser user,
                                   @RequestParam(required = false)
                                   @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return date == null
                ? mealService.findAll(user.userId())
                : mealService.findBookedOn(user.userId(), date);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MealResponse create(@AuthenticationPrincipal CurrentUser user,
                               @Valid @RequestBody MealRequest request) {
        return mealService.create(user.userId(), request);
    }

    @PutMapping("/{id}")
    public MealResponse update(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id,
                               @Valid @RequestBody MealRequest request) {
        return mealService.update(user.userId(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long id) {
        mealService.delete(user.userId(), id);
    }
}