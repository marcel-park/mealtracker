package io.github.marcel_park.mealtracker;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// End-to-end through HTTP, the real services and a real MariaDB (Flyway schema, constraints, cascades).
// Deliberately not @Transactional: every request commits, as in production, so the reads really come
// from the database. The database is not reset between tests, so the test only relies on ids it
// created itself.
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class MealBookingIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void mealLifecycle_bookUpdateRemoveItemDelete_isPersistedWithCalculatedKcal() throws Exception {
        long oatsId = createFood("Haferflocken (IT)", 372);
        long milkId = createFood("Milch (IT)", 64);

        // Book: 150 g oats = 558 kcal, 200 g milk = 128 kcal
        MvcResult booked = mockMvc.perform(post("/api/meals")
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
        mockMvc.perform(get("/api/meals"))
                .andExpect(status().isOk())
                .andExpect(jsonPath(thisMeal + ".title").value(contains("Breakfast")))
                .andExpect(jsonPath(thisMeal + ".kcal").value(contains(686.0)))
                .andExpect(jsonPath(thisMeal + ".items[*].foodName")
                        .value(containsInAnyOrder("Haferflocken (IT)", "Milch (IT)")));

        // Change the oats amount: 100 g oats = 372 kcal, milk unchanged = 128 kcal
        mockMvc.perform(put("/api/meals/" + mealId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Breakfast","items":[{"foodId":%d,"amountG":100},{"foodId":%d,"amountG":200}]}
                                """.formatted(oatsId, milkId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.foodId == %d)].amountG".formatted(oatsId)).value(contains(100.0)))
                .andExpect(jsonPath("$.kcal").value(500.0));

        // Remove the milk item by leaving it out of the request
        mockMvc.perform(put("/api/meals/" + mealId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Breakfast","items":[{"foodId":%d,"amountG":100}]}
                                """.formatted(oatsId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kcal").value(372.0));

        // The removal was committed, not only reflected in the response
        mockMvc.perform(get("/api/meals"))
                .andExpect(jsonPath(thisMeal + ".items[*].foodId").value(contains((int) oatsId)))
                .andExpect(jsonPath(thisMeal + ".kcal").value(contains(372.0)));

        // Delete, then the meal is gone
        mockMvc.perform(delete("/api/meals/" + mealId))
                .andExpect(status().isNoContent());

        mockMvc.perform(delete("/api/meals/" + mealId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Meal with id " + mealId + " not found"));
        mockMvc.perform(get("/api/meals"))
                .andExpect(jsonPath(thisMeal).isEmpty());

        // meal_item.food_id is ON DELETE RESTRICT, so these deletes only succeed because
        // deleting the meal also deleted its items.
        mockMvc.perform(delete("/api/foods/" + oatsId))
                .andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/foods/" + milkId))
                .andExpect(status().isNoContent());
    }

    private long createFood(String name, int kcalPer100g) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/foods")
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
