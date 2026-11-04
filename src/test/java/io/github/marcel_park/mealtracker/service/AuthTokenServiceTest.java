package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.model.AuthToken;
import io.github.marcel_park.mealtracker.model.User;
import io.github.marcel_park.mealtracker.repository.AuthTokenRepository;
import io.github.marcel_park.mealtracker.security.CurrentUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthTokenServiceTest {

    @Mock
    private AuthTokenRepository authTokenRepository;

    private AuthTokenService service;

    @BeforeEach
    void setUp() {
        service = new AuthTokenService(authTokenRepository);
    }

    private static User user(Long id, boolean active, boolean admin) {
        User user = new User();
        user.setId(id);
        user.setEmail("max@example.com");
        user.setActive(active);
        user.setAdmin(admin);
        return user;
    }

    private static AuthToken token(Long id, User user, String rawToken) {
        AuthToken token = new AuthToken(user, AuthTokenService.hash(rawToken));
        token.setId(id);
        return token;
    }

    // ---------- issue ----------

    @Test
    void issue_storesOnlyTheHashOfTheReturnedToken() {
        User user = user(1L, true, false);

        String rawToken = service.issue(user);

        ArgumentCaptor<AuthToken> captor = ArgumentCaptor.forClass(AuthToken.class);
        verify(authTokenRepository).save(captor.capture());
        AuthToken saved = captor.getValue();
        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getTokenHash())
                .isEqualTo(AuthTokenService.hash(rawToken))
                .isNotEqualTo(rawToken)
                .hasSize(64);
    }

    @Test
    void issue_returnsUrlSafeTokenWith256RandomBits() {
        String rawToken = service.issue(user(1L, true, false));

        // 32 bytes in Base64 without padding = 43 characters
        assertThat(rawToken).hasSize(43).matches("[A-Za-z0-9_-]+");
    }

    @Test
    void issue_returnsADifferentTokenEachTime() {
        User user = user(1L, true, false);

        assertThat(service.issue(user)).isNotEqualTo(service.issue(user));
    }

    // ---------- authenticate ----------

    @Test
    void authenticate_knownToken_returnsUserIdTokenIdAndAdminFlag() {
        User user = user(1L, true, true);
        when(authTokenRepository.findWithUserByTokenHash(AuthTokenService.hash("secret")))
                .thenReturn(Optional.of(token(10L, user, "secret")));

        Optional<CurrentUser> result = service.authenticate("secret");

        assertThat(result).contains(new CurrentUser(1L, 10L, true));
    }

    @Test
    void authenticate_unknownToken_returnsEmpty() {
        when(authTokenRepository.findWithUserByTokenHash(any())).thenReturn(Optional.empty());

        assertThat(service.authenticate("unknown")).isEmpty();
    }

    @Test
    void authenticate_tokenOfDeactivatedUser_returnsEmpty() {
        User user = user(1L, false, false);
        when(authTokenRepository.findWithUserByTokenHash(AuthTokenService.hash("secret")))
                .thenReturn(Optional.of(token(10L, user, "secret")));

        assertThat(service.authenticate("secret")).isEmpty();
    }

    @Test
    void authenticate_blankToken_returnsEmptyWithoutDatabaseLookup() {
        assertThat(service.authenticate("")).isEmpty();
        assertThat(service.authenticate(null)).isEmpty();

        verifyNoInteractions(authTokenRepository);
    }

    // ---------- revoke / hash ----------

    @Test
    void revoke_deletesTheToken() {
        service.revoke(10L);

        verify(authTokenRepository).deleteById(10L);
    }

    @Test
    void hash_isSha256InHex() {
        // well-known SHA-256 test vector
        assertThat(AuthTokenService.hash("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }
}
