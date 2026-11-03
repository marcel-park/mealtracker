package io.github.marcel_park.mealtracker;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

// Smoke test: fails if the application context cannot start, e.g. broken bean wiring,
// a failing Flyway migration or an entity mapping that does not match the schema.
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class MealtrackerApplicationTests {

	@Test
	void contextLoads() {
	}

}
