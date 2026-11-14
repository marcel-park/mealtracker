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
import io.github.marcel_park.mealtracker.model.ColorTheme;
import io.github.marcel_park.mealtracker.model.Sex;
import io.github.marcel_park.mealtracker.model.User;
import io.github.marcel_park.mealtracker.repository.MealRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private MealRepository mealRepository;

    @Mock
    private AuthTokenService authTokenService;

    // A real encoder, so the tests show that the password is really hashed and checked.
    // Cost 4 (the minimum) keeps the tests fast; production uses 12 (SecurityConfig).
    private final PasswordEncoder passwordEncoder =
            new DelegatingPasswordEncoder("bcrypt", Map.of("bcrypt", new BCryptPasswordEncoder(4)));

    private UserService service;

    @BeforeEach
    void setUp() {
        service = new UserService(userRepository, mealRepository, authTokenService, passwordEncoder);
    }

    // A complete registration of the given email with the password "geheim123".
    private static RegisterRequest registration(String email) {
        return new RegisterRequest(email, "geheim123", new BigDecimal("80.5"), 180, Sex.MALE);
    }

    private User existingUser(String email, String password) {
        User user = new User();
        user.setId(1L);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        return user;
    }

    // ---------- register ----------

    @Nested
    class Register {

        @BeforeEach
        void saveReturnsTheUserWithAnId() {
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User saved = inv.getArgument(0);
                saved.setId(1L);
                return saved;
            });
        }

        @Test
        void register_storesBcryptHashInsteadOfThePassword() {
            service.register(registration("max@example.com"));

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(captor.capture());
            String hash = captor.getValue().getPasswordHash();
            assertThat(hash).startsWith("{bcrypt}$2a$").doesNotContain("geheim123");
            assertThat(passwordEncoder.matches("geheim123", hash)).isTrue();
        }

        @Test
        void register_normalizesEmail() {
            service.register(registration("  Max@Example.COM "));

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(captor.capture());
            assertThat(captor.getValue().getEmail()).isEqualTo("max@example.com");
        }

        @Test
        void register_usesDefaultsForNewUser() {
            when(userRepository.count()).thenReturn(3L);

            UserResponse user = service.register(registration("max@example.com")).user();

            assertThat(user.calorieTarget()).isEqualTo(User.DEFAULT_CALORIE_TARGET);
            assertThat(user)
                    .extracting(UserResponse::carbsPercent, UserResponse::proteinPercent, UserResponse::fatPercent)
                    .containsExactly(40, 30, 30);
            assertThat(user.stepGoal()).isEqualTo(User.DEFAULT_STEP_GOAL);
            assertThat(user.colorTheme()).isEqualTo(ColorTheme.LIGHT);
            assertThat(user.admin()).isFalse();
        }

        @Test
        void register_storesBodyData() {
            UserResponse user = service.register(registration("max@example.com")).user();

            assertThat(user)
                    .extracting(UserResponse::weightKg, UserResponse::heightCm, UserResponse::sex)
                    .containsExactly(new BigDecimal("80.5"), 180, Sex.MALE);
        }

        @Test
        void register_returnsTokenAndUser() {
            when(authTokenService.issue(any(User.class))).thenReturn("new-token");

            AuthResponse response = service.register(registration("max@example.com"));

            assertThat(response.token()).isEqualTo("new-token");
            assertThat(response.user().id()).isEqualTo(1L);
            assertThat(response.user().email()).isEqualTo("max@example.com");
        }

        @Test
        void register_firstUser_becomesAdminAndTakesOverOwnerlessMeals() {
            when(userRepository.count()).thenReturn(0L);

            UserResponse user = service.register(registration("max@example.com")).user();

            assertThat(user.admin()).isTrue();
            verify(mealRepository).assignOwnerlessMealsTo(any(User.class));
        }

        @Test
        void register_laterUser_doesNotTakeOverMeals() {
            when(userRepository.count()).thenReturn(1L);

            service.register(registration("max@example.com"));

            verify(mealRepository, never()).assignOwnerlessMealsTo(any());
        }
    }

    @Test
    void register_emailAlreadyRegistered_throwsAndSavesNothing() {
        when(userRepository.existsByEmail("max@example.com")).thenReturn(true);

        assertThatThrownBy(() -> service.register(registration("Max@example.com")))
                .isInstanceOf(EmailAlreadyRegisteredException.class);

        verify(userRepository, never()).save(any());
    }

    // ---------- login ----------

    @Test
    void login_correctPassword_returnsTokenAndUser() {
        User user = existingUser("max@example.com", "geheim123");
        when(userRepository.findByEmail("max@example.com")).thenReturn(Optional.of(user));
        when(authTokenService.issue(user)).thenReturn("new-token");

        AuthResponse response = service.login(new LoginRequest(" MAX@example.com", "geheim123"));

        assertThat(response.token()).isEqualTo("new-token");
        assertThat(response.user().email()).isEqualTo("max@example.com");
    }

    @Test
    void login_wrongPassword_throwsInvalidCredentialsAndIssuesNoToken() {
        User user = existingUser("max@example.com", "geheim123");
        when(userRepository.findByEmail("max@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.login(new LoginRequest("max@example.com", "falsch123")))
                .isInstanceOf(InvalidCredentialsException.class);

        verify(authTokenService, never()).issue(any());
    }

    @Test
    void login_unknownEmail_throwsTheSameExceptionAsAWrongPassword() {
        when(userRepository.findByEmail("niemand@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.login(new LoginRequest("niemand@example.com", "geheim123")))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    void login_passwordLongerThan72Bytes_throwsInvalidCredentialsWithoutLookup() {
        assertThatThrownBy(() -> service.login(new LoginRequest("max@example.com", "ä".repeat(37))))
                .isInstanceOf(InvalidCredentialsException.class);

        verify(userRepository, never()).findByEmail(any());
    }

    @Test
    void login_deactivatedUserWithCorrectPassword_throwsAccountDisabled() {
        User user = existingUser("max@example.com", "geheim123");
        user.setActive(false);
        when(userRepository.findByEmail("max@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.login(new LoginRequest("max@example.com", "geheim123")))
                .isInstanceOf(AccountDisabledException.class);

        verify(authTokenService, never()).issue(any());
    }

    @Test
    void login_deactivatedUserWithWrongPassword_doesNotRevealThatTheAccountIsDisabled() {
        User user = existingUser("max@example.com", "geheim123");
        user.setActive(false);
        when(userRepository.findByEmail("max@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service.login(new LoginRequest("max@example.com", "falsch123")))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    // ---------- get / updateSettings ----------

    @Test
    void get_returnsProfileWithoutPasswordHash() {
        User user = existingUser("max@example.com", "geheim123");
        user.setCalorieTarget(1800);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        UserResponse result = service.get(1L);

        assertThat(result).isEqualTo(new UserResponse(1L, "max@example.com", 1800, 40, 30, 30, 10_000, null, null, null, ColorTheme.LIGHT, false));
    }

    @Test
    void get_unknownUser_throwsNotFound() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(99L))
                .isInstanceOf(NotFoundException.class)
                .hasMessage("User with id 99 not found");
    }

    @Test
    void updateSettings_setsAllSettingsAndBodyData() {
        User user = existingUser("max@example.com", "geheim123");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        UserResponse result = service.updateSettings(1L, new UserSettingsRequest(1800, ColorTheme.DARK,
                50, 25, 25, 8000, new BigDecimal("72.0"), 168, Sex.FEMALE));

        assertThat(user)
                .extracting(User::getCalorieTarget, User::getCarbsPercent, User::getProteinPercent,
                        User::getFatPercent, User::getColorTheme)
                .containsExactly(1800, 50, 25, 25, ColorTheme.DARK);
        assertThat(user)
                .extracting(User::getStepGoal, User::getWeightKg, User::getHeightCm, User::getSex)
                .containsExactly(8000, new BigDecimal("72.0"), 168, Sex.FEMALE);
        assertThat(result)
                .extracting(UserResponse::calorieTarget, UserResponse::carbsPercent,
                        UserResponse::proteinPercent, UserResponse::fatPercent, UserResponse::colorTheme)
                .containsExactly(1800, 50, 25, 25, ColorTheme.DARK);
    }
}
