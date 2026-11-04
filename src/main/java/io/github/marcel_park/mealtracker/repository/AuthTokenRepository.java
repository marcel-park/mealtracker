package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.AuthToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface AuthTokenRepository extends JpaRepository<AuthToken, Long> {

    // Runs on every request, so the user is fetched in the same query.
    @Query("select t from AuthToken t join fetch t.user where t.tokenHash = :tokenHash")
    Optional<AuthToken> findWithUserByTokenHash(@Param("tokenHash") String tokenHash);
}
