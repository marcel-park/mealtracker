package io.github.marcel_park.mealtracker.model;

// The number under a barcode: EAN-8, UPC-A (12 digits), EAN-13 or GTIN-14. The last digit is a
// check digit: from the right, the other digits are weighted 3, 1, 3, 1, ... and the check digit
// tops their sum up to a multiple of 10. Catches every single typo and most swapped neighbours.
public final class Gtin {

    private Gtin() {}

    public static boolean isValid(String code) {
        if (code == null || !code.matches("\\d{8}|\\d{12,14}")) {
            return false;
        }
        int sum = 0;
        for (int i = code.length() - 2, weight = 3; i >= 0; i--, weight = 4 - weight) {
            sum += (code.charAt(i) - '0') * weight;
        }
        return (10 - sum % 10) % 10 == code.charAt(code.length() - 1) - '0';
    }
}
