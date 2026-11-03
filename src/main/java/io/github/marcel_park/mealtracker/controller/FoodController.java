package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.dto.FoodRequest;
import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.service.FoodService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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

import java.util.List;

@RestController
@RequestMapping("/api/foods")
public class FoodController {

    private final FoodService foodService;

    public FoodController(FoodService foodService) {
        this.foodService = foodService;
    }

    @GetMapping
    public List<FoodResponse> list(@RequestParam(required = false) String query) {
        return foodService.find(query);
    }

    @GetMapping("/{id}")
    public FoodResponse get(@PathVariable Long id) {
        return foodService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FoodResponse create(@Valid @RequestBody FoodRequest request) {
        return foodService.create(request);
    }

    @PutMapping("/{id}")
    public FoodResponse update(@PathVariable Long id, @Valid @RequestBody FoodRequest request) {
        return foodService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        foodService.delete(id);
    }
}