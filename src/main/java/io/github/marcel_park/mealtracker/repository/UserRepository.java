package io.github.marcel_park.mealtracker.repository;

import io.github.marcel_park.mealtracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    // Expects an already normalized address (trimmed, lower case).
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);
}
