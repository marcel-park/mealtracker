package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.model.AuthToken;
import io.github.marcel_park.mealtracker.model.User;
import io.github.marcel_park.mealtracker.repository.AuthTokenRepository;
import io.github.marcel_park.mealtracker.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

// Issues, checks and revokes login tokens.
//
// A token is 32 random bytes from SecureRandom (256 bit), so it cannot be guessed. The database
// stores only its SHA-256 hash: whoever reads the database still cannot log in. A plain SHA-256
// is enough here, unlike for passwords, because a random 256-bit value cannot be found by trying
// out candidates, however fast the hash is.
@Service
public class AuthTokenService {

    private static final int TOKEN_BYTES = 32;

    private final AuthTokenRepository authTokenRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthTokenService(AuthTokenRepository authTokenRepository) {
        this.authTokenRepository = authTokenRepository;
    }

    // Returns the raw token. It exists only in the response to the client, never in the database.
    @Transactional
    public String issue(User user) {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        authTokenRepository.save(new AuthToken(user, hash(token)));
        return token;
    }

    // Empty for unknown or revoked tokens and for deactivated users.
    @Transactional(readOnly = true)
    public Optional<CurrentUser> authenticate(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        return authTokenRepository.findWithUserByTokenHash(hash(token))
                .filter(authToken -> authToken.getUser().isActive())
                .map(authToken -> new CurrentUser(
                        authToken.getUser().getId(), authToken.getId(), authToken.getUser().isAdmin()));
    }

    // Logs out one device; logins on other devices stay valid.
    @Transactional
    public void revoke(Long tokenId) {
        authTokenRepository.deleteById(tokenId);
    }

    static String hash(String token) {
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(sha256.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            // Every Java runtime is required to provide SHA-256.
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
