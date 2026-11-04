package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

// A login on one device. The device keeps the random token, the database only its SHA-256 hash.
// Tokens do not expire: the app stays logged in until the user logs out, which deletes the row.
@Entity
@Table(name = "auth_token")
public class AuthToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public AuthToken() {}

    public AuthToken(User user, String tokenHash) {
        this.user = user;
        this.tokenHash = tokenHash;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public String getTokenHash() { return tokenHash; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
