package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.dto.FoodResponse;
import io.github.marcel_park.mealtracker.dto.FoodRequest;
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
    public List<FoodResponse> list(@RequestParam(required = false) String q) {
        return service.find(q);
    }

    @GetMapping("/{id}")
    public FoodResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FoodResponse create(@Valid @RequestBody FoodRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public FoodResponse update(@PathVariable Long id, @Valid @RequestBody FoodRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}