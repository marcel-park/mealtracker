package io.github.marcel_park.mealtracker.controller;

import io.github.marcel_park.mealtracker.dto.ColorThemeRequest;
import io.github.marcel_park.mealtracker.dto.UserResponse;
import io.github.marcel_park.mealtracker.dto.UserSettingsRequest;
import io.github.marcel_park.mealtracker.security.CurrentUser;
import io.github.marcel_park.mealtracker.service.UserService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// "me" is always the logged-in user; there is no way to address another user by id.
@RestController
@RequestMapping("/api/users/me")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public UserResponse get(@AuthenticationPrincipal CurrentUser user) {
        return userService.get(user.userId());
    }

    @PutMapping
    public UserResponse updateSettings(@AuthenticationPrincipal CurrentUser user,
                                       @Valid @RequestBody UserSettingsRequest request) {
        return userService.updateSettings(user.userId(), request);
    }

    // Applied by the app right away, so it is saved on its own, not with the other settings.
    @PutMapping("/color-theme")
    public UserResponse setColorTheme(@AuthenticationPrincipal CurrentUser user,
                                      @Valid @RequestBody ColorThemeRequest request) {
        return userService.setColorTheme(user.userId(), request.colorTheme());
    }
}
