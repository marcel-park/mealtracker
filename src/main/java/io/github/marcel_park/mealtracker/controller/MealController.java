package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.dto.MealRequest;
import io.github.marcel_park.mealtracker.dto.MealResponse;
import io.github.marcel_park.mealtracker.service.MealService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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

@RestController
@RequestMapping("/api/meals")
public class MealController {

    private final MealService mealService;

    public MealController(MealService mealService) {
        this.mealService = mealService;
    }

    @GetMapping
    public List<MealResponse> list() {
        return mealService.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MealResponse create(@Valid @RequestBody MealRequest request) {
        return mealService.create(request);
    }

    @PutMapping("/{id}")
    public MealResponse update(@PathVariable Long id, @Valid @RequestBody MealRequest request) {
        return mealService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        mealService.delete(id);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAll() {
        mealService.deleteAll();
    }
}