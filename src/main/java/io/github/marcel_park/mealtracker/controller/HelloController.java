package io.github.marcel_park.mealtracker.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
public class HelloController {

    @GetMapping("/api/hello")
    public String hello() {
        return "MealTracker läuft!";
    }
}