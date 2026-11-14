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

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// End-to-end through HTTP, the real security filter, the real services and a real MariaDB
// (Flyway schema, constraints, cascades). The test application.properties switch Flyway off for
// the H2 tests; here it is on again and Hibernate only validates the mapping against the migrated
// schema, as in production. Deliberately not @Transactional: every request commits, so the reads
// really come from the database. The database is not reset between tests, so each test registers
// its own users (random emails) and only relies on ids it created.
@SpringBootTest(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
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
                                {"title":"Breakfast","items":[{"foodId":%d,"amount":150},{"foodId":%d,"amount":200}]}
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
                .andExpect(jsonPath(thisMeal + ".items[*].food.name")
                        .value(containsInAnyOrder("Haferflocken (IT)", "Milch (IT)")));

        // Change the oats amount: 100 g oats = 372 kcal, milk unchanged = 128 kcal
        mockMvc.perform(as(token, put("/api/meals/" + mealId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Breakfast","items":[{"foodId":%d,"amount":100},{"foodId":%d,"amount":200}]}
                                """.formatted(oatsId, milkId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.food.id == %d)].amount".formatted(oatsId)).value(contains(100.0)))
                .andExpect(jsonPath("$.kcal").value(500.0));

        // Remove the milk item by leaving it out of the request
        mockMvc.perform(as(token, put("/api/meals/" + mealId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Breakfast","items":[{"foodId":%d,"amount":100}]}
                                """.formatted(oatsId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kcal").value(372.0));

        // The removal was committed, not only reflected in the response
        mockMvc.perform(as(token, get("/api/meals")))
                .andExpect(jsonPath(thisMeal + ".items[*].food.id").value(contains((int) oatsId)))
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

    // Portions against the real schema (Flyway V6): the unique name per food (case- and
    // accent-insensitive by collation), the flush order in FoodService.applyPortions, and the unit
    // change of a booked food.
    @Test
    void portionsAndUnit_areSavedWithTheFood_andTheUnitCanChangeEvenOnceBooked() throws Exception {
        String token = register();
        MvcResult created = mockMvc.perform(as(token, post("/api/foods"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Bier (IT)","unit":"ML","kcalPer100":42,"protein":0.5,"carbs":3,"fat":0,
                                 "published":false,"portions":[
                                   {"name":"Flasche","amount":500},
                                   {"name":"kleine Flasche","amount":330}]}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.unit").value("ML"))
                .andExpect(jsonPath("$.used").value(false))
                .andExpect(jsonPath("$.portions[*].name").value(contains("Flasche", "kleine Flasche")))
                .andExpect(jsonPath("$.portions[*].favorite").value(contains(true, false)))
                .andReturn();
        long beerId = idOf(created);
        Number bottleId = JsonPath.read(created.getResponse().getContentAsString(), "$.portions[0].id");
        Number smallId = JsonPath.read(created.getResponse().getContentAsString(), "$.portions[1].id");

        // Delete "Flasche" and add a new "flasche" in the same request, rename the other one and
        // make it the favorite. Without the flushes in between, the INSERT would come first and
        // break the unique key on (food_id, name).
        mockMvc.perform(as(token, put("/api/foods/" + beerId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Bier (IT)","unit":"ML","kcalPer100":42,"protein":0.5,"carbs":3,"fat":0,
                                 "published":false,"portions":[
                                   {"id":%d,"name":"Dose","amount":330,"favorite":true},
                                   {"name":"flasche","amount":500}]}
                                """.formatted(smallId.longValue())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.portions[*].name").value(contains("Dose", "flasche")))
                .andExpect(jsonPath("$.portions[0].id").value(smallId.intValue()))
                .andExpect(jsonPath("$.portions[*].id", not(hasItem(bottleId.intValue()))));

        // Two portions swap their names in one request (FoodService renames through temporary names).
        Number canId = smallId;
        MvcResult afterChain = mockMvc.perform(as(token, get("/api/foods/" + beerId))).andReturn();
        Number newBottleId = JsonPath.read(afterChain.getResponse().getContentAsString(), "$.portions[1].id");
        mockMvc.perform(as(token, put("/api/foods/" + beerId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Bier (IT)","unit":"ML","kcalPer100":42,"protein":0.5,"carbs":3,"fat":0,
                                 "published":false,"portions":[
                                   {"id":%d,"name":"flasche","amount":330,"favorite":true},
                                   {"id":%d,"name":"Dose","amount":500}]}
                                """.formatted(canId.longValue(), newBottleId.longValue())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.portions[*].name").value(contains("flasche", "Dose")));

        // Names differing only in case or accents count as equal, as in the database.
        mockMvc.perform(as(token, put("/api/foods/" + beerId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Bier (IT)","unit":"ML","kcalPer100":42,"protein":0.5,"carbs":3,"fat":0,
                                 "published":false,"portions":[{"name":"Glas","amount":200},{"name":"GLÄS","amount":300}]}
                                """))
                .andExpect(status().isBadRequest());

        // The unit can change.
        mockMvc.perform(as(token, put("/api/foods/" + beerId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(beerJson("G")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unit").value("G"));

        // Also once booked: the booked amount keeps its number (330 g become 330 ml), and its kcal.
        MvcResult meal = mockMvc.perform(as(token, post("/api/meals"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Bier","items":[{"foodId":%d,"amount":330}]}
                                """.formatted(beerId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.items[0].food.used").value(true))
                .andReturn();
        mockMvc.perform(as(token, put("/api/foods/" + beerId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(beerJson("ML")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unit").value("ML"))
                .andExpect(jsonPath("$.used").value(true));
        String thisMeal = "$[?(@.id == %d)]".formatted(idOf(meal));
        mockMvc.perform(as(token, get("/api/meals")))
                .andExpect(jsonPath(thisMeal + ".items[0].food.unit").value(contains("ML")))
                .andExpect(jsonPath(thisMeal + ".items[0].amount").value(contains(330.0)))
                .andExpect(jsonPath(thisMeal + ".kcal").value(contains(138.6)));
    }

    private static String beerJson(String unit) {
        return """
                {"name":"Bier (IT)","unit":"%s","kcalPer100":42,"protein":0.5,"carbs":3,"fat":0,
                 "published":false,"portions":[]}
                """.formatted(unit);
    }

    @Test
    void meals_areSeparatedByUser() throws Exception {
        String alice = register();
        String bob = register();
        long appleId = createFood(alice, "Apfel (IT)", 52);

        MvcResult booked = mockMvc.perform(as(alice, post("/api/meals"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Apfel","items":[{"foodId":%d,"amount":150}]}
                                """.formatted(appleId)))
                .andExpect(status().isCreated())
                .andReturn();
        long aliceMealId = idOf(booked);

        // Bob neither sees nor changes Alice's meal
        mockMvc.perform(as(bob, get("/api/meals")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mockMvc.perform(as(bob, put("/api/meals/" + aliceMealId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Gekapert","items":[{"foodId":%d,"amount":1}]}
                                """.formatted(appleId)))
                .andExpect(status().isNotFound());
        mockMvc.perform(as(bob, delete("/api/meals/" + aliceMealId)))
                .andExpect(status().isNotFound());
        mockMvc.perform(as(bob, get("/api/meals").param("date", LocalDate.now().toString())))
                .andExpect(jsonPath("$").isEmpty());

        // Alice finds it among all her meals and among today's
        mockMvc.perform(as(alice, get("/api/meals")))
                .andExpect(jsonPath("$[*].id").value(contains((int) aliceMealId)))
                .andExpect(jsonPath("$[0].title").value("Apfel"));
        mockMvc.perform(as(alice, get("/api/meals").param("date", LocalDate.now().toString())))
                .andExpect(jsonPath("$[*].id").value(contains((int) aliceMealId)));
        mockMvc.perform(as(alice, get("/api/meals").param("date", LocalDate.now().minusDays(1).toString())))
                .andExpect(jsonPath("$").isEmpty());
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
                                {"calorieTarget":1800,"colorTheme":"DARK",
                                 "carbsPercent":50,"proteinPercent":25,"fatPercent":25,
                                 "stepGoal":8000,"weightKg":72.5,"heightCm":168,"sex":"FEMALE"}
                                """))
                .andExpect(status().isOk());
        mockMvc.perform(as(token, get("/api/users/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.calorieTarget").value(1800))
                .andExpect(jsonPath("$.carbsPercent").value(50))
                .andExpect(jsonPath("$.proteinPercent").value(25))
                .andExpect(jsonPath("$.fatPercent").value(25))
                .andExpect(jsonPath("$.stepGoal").value(8000))
                .andExpect(jsonPath("$.weightKg").value(72.5))
                .andExpect(jsonPath("$.heightCm").value(168))
                .andExpect(jsonPath("$.sex").value("FEMALE"))
                .andExpect(jsonPath("$.colorTheme").value("DARK"));

        // The same email cannot be registered twice
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registration(email)))
                .andExpect(status().isConflict());

        // After logout the token is useless
        mockMvc.perform(as(token, post("/api/auth/logout")))
                .andExpect(status().isNoContent());
        mockMvc.perform(as(token, get("/api/users/me")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void foodInUseByOthers_survivesPrivatizingAndDeletingByItsOwner() throws Exception {
        String alice = register();
        String bob = register();
        long oatsId = createFood(alice, "Haferflocken (IT rules)", 372, true);

        // Bob may see and book Alice's public food, but not change it
        mockMvc.perform(as(bob, post("/api/meals"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Porridge","items":[{"foodId":%d,"amount":100}]}
                                """.formatted(oatsId)))
                .andExpect(status().isCreated());
        mockMvc.perform(as(bob, put("/api/foods/" + oatsId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(foodJson("Gekapert", 1, true)))
                .andExpect(status().isForbidden());

        // Alice makes it private: Bob keeps the public original, Alice gets a private copy
        MvcResult privatized = mockMvc.perform(as(alice, put("/api/foods/" + oatsId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(foodJson("Haferflocken (IT rules)", 372, false)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.owned").value(true))
                .andExpect(jsonPath("$.published").value(false))
                .andReturn();
        long copyId = idOf(privatized);
        assertThat(copyId).isNotEqualTo(oatsId);

        mockMvc.perform(as(bob, get("/api/foods/" + oatsId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true))
                .andExpect(jsonPath("$.owned").value(false));
        mockMvc.perform(as(bob, get("/api/foods/" + copyId)))
                .andExpect(status().isNotFound());
        mockMvc.perform(as(alice, get("/api/foods").param("scope", "OWN")))
                .andExpect(jsonPath("$[*].id").value(contains((int) copyId)));

        // Nobody owns the original any more, so nobody can change or delete it
        mockMvc.perform(as(alice, delete("/api/foods/" + oatsId)))
                .andExpect(status().isForbidden());

        // The unused private copy is really deleted
        mockMvc.perform(as(alice, delete("/api/foods/" + copyId)))
                .andExpect(status().isNoContent());
        mockMvc.perform(as(alice, get("/api/foods/" + copyId)))
                .andExpect(status().isNotFound());
    }

    @Test
    void deletingFoodUsedInOwnRecipe_onlyReleasesIt() throws Exception {
        String alice = register();
        long riceId = createFood(alice, "Reis (IT rules)", 350, false);
        long recipeId = createRecipe(alice, "Reisbowl (IT)", false, riceId, 200);

        mockMvc.perform(as(alice, delete("/api/foods/" + riceId)))
                .andExpect(status().isNoContent());

        // Gone from Alice's own foods, but the recipe still works and the food is public now
        mockMvc.perform(as(alice, get("/api/foods").param("scope", "OWN")))
                .andExpect(jsonPath("$[?(@.id == %d)]".formatted(riceId)).isEmpty());
        mockMvc.perform(as(alice, get("/api/recipes/" + recipeId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].food.id").value((int) riceId))
                .andExpect(jsonPath("$.items[0].food.published").value(true))
                .andExpect(jsonPath("$.kcal").value(700.0));
    }

    @Test
    void publishingRecipe_publishesItsFoods_andMakingItPrivateHidesOnlyTheRecipe() throws Exception {
        String alice = register();
        String bob = register();
        long beansId = createFood(alice, "Bohnen (IT rules)", 100, false);
        long recipeId = createRecipe(alice, "Bohnensalat (IT)", false, beansId, 400);

        mockMvc.perform(as(bob, get("/api/recipes/" + recipeId)))
                .andExpect(status().isNotFound());

        mockMvc.perform(as(alice, put("/api/recipes/" + recipeId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recipeJson("Bohnensalat (IT)", true, beansId, 400)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true))
                .andExpect(jsonPath("$.items[0].food.published").value(true));
        mockMvc.perform(as(bob, get("/api/recipes/" + recipeId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.owned").value(false));

        mockMvc.perform(as(alice, put("/api/recipes/" + recipeId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recipeJson("Bohnensalat (IT)", false, beansId, 400)))
                .andExpect(status().isOk());
        mockMvc.perform(as(bob, get("/api/recipes/" + recipeId)))
                .andExpect(status().isNotFound());
        mockMvc.perform(as(bob, get("/api/foods/" + beansId)))
                .andExpect(status().isOk());
    }

    @Test
    void variations_belongToTheOwnerAndTheLastBookedOneIsRemembered() throws Exception {
        String alice = register();
        String bob = register();
        long beansId = createFood(alice, "Bohnen (IT variations)", 100, true);
        long recipeId = createRecipe(alice, "Chili (IT variations)", true, beansId, 400);

        // A variation stores only what differs from the original
        MvcResult created = mockMvc.perform(as(alice, post("/api/recipes/" + recipeId + "/variations"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Mehr Bohnen","servings":2,"weightG":900,"items":[{"foodId":%d,"amount":600}]}
                                """.formatted(beansId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.servings").isEmpty())   // 2 = as in the original
                .andExpect(jsonPath("$.weightG").value(900.0))
                .andExpect(jsonPath("$.items[0].amount").value(600.0))
                .andReturn();
        long variationId = idOf(created);

        mockMvc.perform(as(alice, get("/api/recipes/" + recipeId)))
                .andExpect(jsonPath("$.variations[0].id").value((int) variationId))
                .andExpect(jsonPath("$.lastUsedVariationId").isEmpty());

        // Bob sees the public recipe, but neither Alice's variations nor may he add his own
        mockMvc.perform(as(bob, get("/api/recipes/" + recipeId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.variations").isEmpty());
        mockMvc.perform(as(bob, post("/api/recipes/" + recipeId + "/variations"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Bobs","items":[]}
                                """))
                .andExpect(status().isForbidden());

        // Booking a meal from the variation makes it the preselection
        mockMvc.perform(as(alice, post("/api/meals"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Chili","items":[{"foodId":%d,"amount":300}],
                                 "recipes":[{"recipeId":%d,"variationId":%d}]}
                                """.formatted(beansId, recipeId, variationId)))
                .andExpect(status().isCreated());
        mockMvc.perform(as(alice, get("/api/recipes/" + recipeId)))
                .andExpect(jsonPath("$.lastUsedVariationId").value((int) variationId));

        // Deleting the variation falls back to the original
        mockMvc.perform(as(alice, delete("/api/recipes/" + recipeId + "/variations/" + variationId)))
                .andExpect(status().isNoContent());
        mockMvc.perform(as(alice, get("/api/recipes/" + recipeId)))
                .andExpect(jsonPath("$.variations").isEmpty())
                .andExpect(jsonPath("$.lastUsedVariationId").isEmpty());

        // Deleting the recipe also deletes its variations, even the preselected one
        // (recipe.last_used_variation_id references the variation that is deleted with it)
        long secondId = idOf(mockMvc.perform(as(alice, post("/api/recipes/" + recipeId + "/variations"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Wenig Bohnen","items":[{"foodId":%d,"amount":100}]}
                                """.formatted(beansId)))
                .andExpect(status().isCreated())
                .andReturn());
        mockMvc.perform(as(alice, post("/api/meals"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Chili","items":[{"foodId":%d,"amount":50}],
                                 "recipes":[{"recipeId":%d,"variationId":%d}]}
                                """.formatted(beansId, recipeId, secondId)))
                .andExpect(status().isCreated());
        mockMvc.perform(as(alice, delete("/api/recipes/" + recipeId)))
                .andExpect(status().isNoContent());
        mockMvc.perform(as(alice, get("/api/recipes/" + recipeId)))
                .andExpect(status().isNotFound());
    }

    @Test
    void protectedEndpoints_withoutToken_return401() throws Exception {
        mockMvc.perform(get("/api/meals")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/foods")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/recipes")).andExpect(status().isUnauthorized());
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

    // A complete registration with the password "geheim123" and the required body data.
    private static String registration(String email) {
        return """
                {"email":"%s","password":"geheim123","weightKg":80.5,"heightCm":180,"sex":"MALE"}
                """.formatted(email);
    }

    private String register() throws Exception {
        return register(randomEmail());
    }

    // Registers a user and returns its token.
    private String register(String email) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registration(email)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.email").value(email))
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.token");
    }

    private long createFood(String token, String name, int kcalPer100) throws Exception {
        return createFood(token, name, kcalPer100, false);
    }

    private long createFood(String token, String name, int kcalPer100, boolean published) throws Exception {
        MvcResult result = mockMvc.perform(as(token, post("/api/foods"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(foodJson(name, kcalPer100, published)))
                .andExpect(status().isCreated())
                .andReturn();
        return idOf(result);
    }

    private static String foodJson(String name, int kcalPer100, boolean published) {
        return """
                {"name":"%s","unit":"G","kcalPer100":%d,"protein":10,"carbs":50,"fat":5,"published":%b,
                 "portions":[]}
                """.formatted(name, kcalPer100, published);
    }

    private long createRecipe(String token, String name, boolean published, long foodId, int amount)
            throws Exception {
        MvcResult result = mockMvc.perform(as(token, post("/api/recipes"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recipeJson(name, published, foodId, amount)))
                .andExpect(status().isCreated())
                .andReturn();
        return idOf(result);
    }

    private static String recipeJson(String name, boolean published, long foodId, int amount) {
        return """
                {"name":"%s","servings":2,"published":%b,"items":[{"foodId":%d,"amount":%d}]}
                """.formatted(name, published, foodId, amount);
    }

    private static long idOf(MvcResult result) throws Exception {
        Number id = JsonPath.read(result.getResponse().getContentAsString(), "$.id");
        return id.longValue();
    }
}
