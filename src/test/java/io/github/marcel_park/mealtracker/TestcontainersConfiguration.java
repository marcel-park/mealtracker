package io.github.marcel_park.mealtracker;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.mariadb.MariaDBContainer;

// Shared by all application-level tests via @Import. @ServiceConnection points the DataSource
// (and Flyway) at the container, so no datasource properties are needed. Requires Docker.
@TestConfiguration(proxyBeanMethods = false)
class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    MariaDBContainer mariaDbContainer() {
        // Pinned instead of "latest" so test runs are reproducible; align with the production version.
        return new MariaDBContainer("mariadb:11.4");
    }
}
