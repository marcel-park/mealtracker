package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.AuthResponse;
import io.github.marcel_park.mealtracker.dto.LoginRequest;
import io.github.marcel_park.mealtracker.dto.RegisterRequest;
import io.github.marcel_park.mealtracker.dto.UserResponse;
import io.github.marcel_park.mealtracker.dto.UserSettingsRequest;
import io.github.marcel_park.mealtracker.exception.AccountDisabledException;
import io.github.marcel_park.mealtracker.exception.EmailAlreadyRegisteredException;
import io.github.marcel_park.mealtracker.exception.InvalidCredentialsException;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.User;
import io.github.marcel_park.mealtracker.repository.MealRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final MealRepository mealRepository;
    private final AuthTokenService authTokenService;
    private final PasswordEncoder passwordEncoder;

    // Checked against when the email is unknown, so that such a login takes as long as one with a
    // wrong password. Otherwise the response time would reveal which addresses have an account.
    private final String dummyPasswordHash;

    public UserService(UserRepository userRepository, MealRepository mealRepository,
                       AuthTokenService authTokenService, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.mealRepository = mealRepository;
        this.authTokenService = authTokenService;
        this.passwordEncoder = passwordEncoder;
        this.dummyPasswordHash = passwordEncoder.encode("dummy password for unknown emails");
    }

    // Registers and logs in right away, so the response already contains a token.
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyRegisteredException();
        }

        // The very first account becomes the admin and takes over the meals that were booked
        // before multi-user support existed.
        boolean isFirstUser = userRepository.count() == 0;

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setWeightKg(request.weightKg());
        user.setHeightCm(request.heightCm());
        user.setSex(request.sex());
        user.setAdmin(isFirstUser);
        userRepository.save(user);

        if (isFirstUser) {
            mealRepository.assignOwnerlessMealsTo(user);
        }
        return new AuthResponse(authTokenService.issue(user), UserResponse.from(user));
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        // Registration never accepts such a password, so it cannot match. Checked up front because
        // the BCrypt encoder refuses to process it at all.
        if (request.password().getBytes(StandardCharsets.UTF_8).length > RegisterRequest.MAX_PASSWORD_BYTES) {
            throw new InvalidCredentialsException();
        }
        User user = userRepository.findByEmail(normalizeEmail(request.email())).orElse(null);
        if (user == null) {
            passwordEncoder.matches(request.password(), dummyPasswordHash);
            throw new InvalidCredentialsException();
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        if (!user.isActive()) {
            throw new AccountDisabledException();
        }
        return new AuthResponse(authTokenService.issue(user), UserResponse.from(user));
    }

    @Transactional(readOnly = true)
    public UserResponse get(Long userId) {
        return UserResponse.from(getEntity(userId));
    }

    // No save() needed: the user was loaded in this transaction, Hibernate writes the changes on commit.
    @Transactional
    public UserResponse updateSettings(Long userId, UserSettingsRequest request) {
        User user = getEntity(userId);
        user.setCalorieTarget(request.calorieTarget());
        user.setCarbsPercent(request.carbsPercent());
        user.setProteinPercent(request.proteinPercent());
        user.setFatPercent(request.fatPercent());
        user.setStepGoal(request.stepGoal());
        user.setWeightKg(request.weightKg());
        user.setHeightCm(request.heightCm());
        user.setSex(request.sex());
        user.setColorTheme(request.colorTheme());
        return UserResponse.from(user);
    }

    private User getEntity(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("User", userId));
    }

    // "Max@Example.com " and "max@example.com" are the same account.
    static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
