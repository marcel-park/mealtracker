package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.model.Food;
import io.github.marcel_park.mealtracker.service.FoodService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/foods")
public class FoodController {

    private final FoodService service;

    public FoodController(FoodService service) {
        this.service = service;
    }

    @GetMapping
    public List<Food> list(@RequestParam(required = false) String q) {
        return service.find(q);
    }

    @GetMapping("/{id}")
    public Food get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Food create(@Valid @RequestBody Food food) {
        return service.create(food);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}