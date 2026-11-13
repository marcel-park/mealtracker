package io.github.marcel_park.mealtracker.model;

import jakarta.persistence.*;

// Whether a request is authenticated is not stored here: that belongs to the login token sent
// with each request (see AuthToken), not to the user.
@Entity
@Table(name = "app_user")
public class User {

    public static final int DEFAULT_CALORIE_TARGET = 2000;

    // Default split of the calorie target, in percent of the calories (see the V7 migration).
    public static final int DEFAULT_CARBS_PERCENT = 40;
    public static final int DEFAULT_PROTEIN_PERCENT = 30;
    public static final int DEFAULT_FAT_PERCENT = 30;

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

    // How the calorie target splits into carbs, protein and fat, in whole percent of the calories;
    // together always 100 (checked by UserSettingsRequest and a CHECK constraint). The grams are
    // not stored: the app computes them from the calorie target.
    @Column(name = "carbs_percent", nullable = false)
    private int carbsPercent = DEFAULT_CARBS_PERCENT;

    @Column(name = "protein_percent", nullable = false)
    private int proteinPercent = DEFAULT_PROTEIN_PERCENT;

    @Column(name = "fat_percent", nullable = false)
    private int fatPercent = DEFAULT_FAT_PERCENT;

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
    public int getCarbsPercent() { return carbsPercent; }
    public void setCarbsPercent(int carbsPercent) { this.carbsPercent = carbsPercent; }
    public int getProteinPercent() { return proteinPercent; }
    public void setProteinPercent(int proteinPercent) { this.proteinPercent = proteinPercent; }
    public int getFatPercent() { return fatPercent; }
    public void setFatPercent(int fatPercent) { this.fatPercent = fatPercent; }
    public ColorTheme getColorTheme() { return colorTheme; }
    public void setColorTheme(ColorTheme colorTheme) { this.colorTheme = colorTheme; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isAdmin() { return admin; }
    public void setAdmin(boolean admin) { this.admin = admin; }
}
