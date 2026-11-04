package io.github.marcel_park.mealtracker;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.UUID;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// End-to-end through HTTP, the real security filter, the real services and a real MariaDB
// (Flyway schema, constraints, cascades). Deliberately not @Transactional: every request commits,
// as in production, so the reads really come from the database. The database is not reset between
// tests, so each test registers its own users (random emails) and only relies on ids it created.
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class MealBookingIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void mealLifecycle_bookUpdateRemoveItemDelete_isPersistedWithCalculatedKcal() throws Exception {
        String token = register();
        long oatsId = createFood(token, "Haferflocken (IT)", 372);
        long milkId = createFood(token, "Milch (IT)", 64);

        // Book: 150 g oats = 558 kcal, 200 g milk = 128 kcal
        MvcResult booked = mockMvc.perform(as(token, post("/api/meals"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Breakfast","items":[{"foodId":%d,"amountG":150},{"foodId":%d,"amountG":200}]}
                                """.formatted(oatsId, milkId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.bookedAt").isNotEmpty())
                .andExpect(jsonPath("$.kcal").value(686.0))
                .andReturn();
        long mealId = idOf(booked);
        String thisMeal = "$[?(@.id == %d)]".formatted(mealId);

        // Read back
        mockMvc.perform(as(token, get("/api/meals")))
                .andExpect(status().isOk())
                .andExpect(jsonPath(thisMeal + ".title").value(contains("Breakfast")))
                .andExpect(jsonPath(thisMeal + ".kcal").value(contains(686.0)))
                .andExpect(jsonPath(thisMeal + ".items[*].foodName")
                        .value(containsInAnyOrder("Haferflocken (IT)", "Milch (IT)")));

        // Change the oats amount: 100 g oats = 372 kcal, milk unchanged = 128 kcal
        mockMvc.perform(as(token, put("/api/meals/" + mealId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Breakfast","items":[{"foodId":%d,"amountG":100},{"foodId":%d,"amountG":200}]}
                                """.formatted(oatsId, milkId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.foodId == %d)].amountG".formatted(oatsId)).value(contains(100.0)))
                .andExpect(jsonPath("$.kcal").value(500.0));

        // Remove the milk item by leaving it out of the request
        mockMvc.perform(as(token, put("/api/meals/" + mealId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Breakfast","items":[{"foodId":%d,"amountG":100}]}
                                """.formatted(oatsId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kcal").value(372.0));

        // The removal was committed, not only reflected in the response
        mockMvc.perform(as(token, get("/api/meals")))
                .andExpect(jsonPath(thisMeal + ".items[*].foodId").value(contains((int) oatsId)))
                .andExpect(jsonPath(thisMeal + ".kcal").value(contains(372.0)));

        // Delete, then the meal is gone
        mockMvc.perform(as(token, delete("/api/meals/" + mealId)))
                .andExpect(status().isNoContent());

        mockMvc.perform(as(token, delete("/api/meals/" + mealId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Meal with id " + mealId + " not found"));
        mockMvc.perform(as(token, get("/api/meals")))
                .andExpect(jsonPath(thisMeal).isEmpty());

        // meal_item.food_id is ON DELETE RESTRICT, so these deletes only succeed because
        // deleting the meal also deleted its items.
        mockMvc.perform(as(token, delete("/api/foods/" + oatsId)))
                .andExpect(status().isNoContent());
        mockMvc.perform(as(token, delete("/api/foods/" + milkId)))
                .andExpect(status().isNoContent());
    }

    @Test
    void meals_areSeparatedByUser() throws Exception {
        String alice = register();
        String bob = register();
        long appleId = createFood(alice, "Apfel (IT)", 52);

        MvcResult booked = mockMvc.perform(as(alice, post("/api/meals"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Apfel","items":[{"foodId":%d,"amountG":150}]}
                                """.formatted(appleId)))
                .andExpect(status().isCreated())
                .andReturn();
        long aliceMealId = idOf(booked);

        // Bob neither sees nor changes Alice's meal, and his reset leaves it alone
        mockMvc.perform(as(bob, get("/api/meals")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mockMvc.perform(as(bob, put("/api/meals/" + aliceMealId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Gekapert","items":[{"foodId":%d,"amountG":1}]}
                                """.formatted(appleId)))
                .andExpect(status().isNotFound());
        mockMvc.perform(as(bob, delete("/api/meals/" + aliceMealId)))
                .andExpect(status().isNotFound());
        mockMvc.perform(as(bob, delete("/api/meals")))
                .andExpect(status().isNoContent());

        mockMvc.perform(as(alice, get("/api/meals")))
                .andExpect(jsonPath("$[*].id").value(contains((int) aliceMealId)))
                .andExpect(jsonPath("$[0].title").value("Apfel"));
    }

    @Test
    void authLifecycle_registerLoginSettingsLogout() throws Exception {
        String email = randomEmail();
        register(email);

        // Login is case-insensitive in the email and issues a new token for this device
        MvcResult login = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(credentials(email.toUpperCase(), "geheim123")))
                .andExpect(status().isOk())
                .andReturn();
        String token = JsonPath.read(login.getResponse().getContentAsString(), "$.token");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(credentials(email, "falsches-passwort")))
                .andExpect(status().isUnauthorized());

        // Settings are stored
        mockMvc.perform(as(token, put("/api/users/me"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"calorieTarget":1800,"colorTheme":"DARK"}
                                """))
                .andExpect(status().isOk());
        mockMvc.perform(as(token, get("/api/users/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.calorieTarget").value(1800))
                .andExpect(jsonPath("$.colorTheme").value("DARK"));

        // The same email cannot be registered twice
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(credentials(email, "geheim123")))
                .andExpect(status().isConflict());

        // After logout the token is useless
        mockMvc.perform(as(token, post("/api/auth/logout")))
                .andExpect(status().isNoContent());
        mockMvc.perform(as(token, get("/api/users/me")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpoints_withoutToken_return401() throws Exception {
        mockMvc.perform(get("/api/meals")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/foods")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
    }

    // ---------- helpers ----------

    private static MockHttpServletRequestBuilder as(String token, MockHttpServletRequestBuilder request) {
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    private static String randomEmail() {
        return "it-" + UUID.randomUUID() + "@example.com";
    }

    private static String credentials(String email, String password) {
        return """
                {"email":"%s","password":"%s"}
                """.formatted(email, password);
    }

    private String register() throws Exception {
        return register(randomEmail());
    }

    // Registers a user and returns its token.
    private String register(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(credentials(email, "geheim123")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.email").value(email))
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.token");
    }

    private long createFood(String token, String name, int kcalPer100g) throws Exception {
        MvcResult result = mockMvc.perform(as(token, post("/api/foods"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"%s","kcalPer100g":%d,"protein":10,"carbs":50,"fat":5}
                                """.formatted(name, kcalPer100g)))
                .andExpect(status().isCreated())
                .andReturn();
        return idOf(result);
    }

    private static long idOf(MvcResult result) throws Exception {
        Number id = JsonPath.read(result.getResponse().getContentAsString(), "$.id");
        return id.longValue();
    }
}
