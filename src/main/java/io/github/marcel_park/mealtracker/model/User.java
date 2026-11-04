package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;

// Whether a request is authenticated is not stored here: that belongs to the login token sent
// with each request (see AuthToken), not to the user.
@Entity
@Table(name = "app_user")
public class User {

    public static final int DEFAULT_CALORIE_TARGET = 2000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Always stored trimmed and in lower case, see UserService.normalizeEmail().
    @Column(nullable = false, unique = true, length = 254)
    private String email;

    // BCrypt hash with the "{bcrypt}" prefix of Spring's DelegatingPasswordEncoder, never the password itself.
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "calorie_target", nullable = false)
    private int calorieTarget = DEFAULT_CALORIE_TARGET;

    // Stored as plain VARCHAR "LIGHT" / "DARK", see ColorThemeConverter.
    @Convert(converter = ColorThemeConverter.class)
    @Column(name = "color_theme", nullable = false, length = 10)
    private ColorTheme colorTheme = ColorTheme.LIGHT;

    // A deactivated user can neither log in nor use existing tokens.
    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "is_admin", nullable = false)
    private boolean admin = false;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public int getCalorieTarget() { return calorieTarget; }
    public void setCalorieTarget(int calorieTarget) { this.calorieTarget = calorieTarget; }
    public ColorTheme getColorTheme() { return colorTheme; }
    public void setColorTheme(ColorTheme colorTheme) { this.colorTheme = colorTheme; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isAdmin() { return admin; }
    public void setAdmin(boolean admin) { this.admin = admin; }
}
