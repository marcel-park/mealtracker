package io.github.marcel_park.mealtracker.dto;

import io.github.marcel_park.mealtracker.model.Sex;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;

// weightKg, heightCm, sex: required, the app needs them to turn steps into calories.
public record RegisterRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = RegisterRequest.MIN_PASSWORD_LENGTH) String password,
        @NotNull @DecimalMin(BodyData.MIN_WEIGHT_KG) @DecimalMax(BodyData.MAX_WEIGHT_KG)
        @Digits(integer = 3, fraction = BodyData.WEIGHT_FRACTION_DIGITS) BigDecimal weightKg,
        @NotNull @Min(BodyData.MIN_HEIGHT_CM) @Max(BodyData.MAX_HEIGHT_CM) Integer heightCm,
        @NotNull Sex sex) {

    public static final int MIN_PASSWORD_LENGTH = 8;

    // BCrypt only uses the first 72 bytes of a password and Spring's encoder rejects longer ones.
    // Checked in bytes, not characters: umlauts and emoji take up to 4 bytes in UTF-8.
    public static final int MAX_PASSWORD_BYTES = 72;

    // Bean Validation treats this "is..." method as a property, so a violation is reported as
    // field "passwordWithinBcryptLimit".
    @AssertTrue(message = "must not be longer than " + MAX_PASSWORD_BYTES + " bytes")
    public boolean isPasswordWithinBcryptLimit() {
        return password == null || password.getBytes(StandardCharsets.UTF_8).length <= MAX_PASSWORD_BYTES;
    }
}
