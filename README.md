# Mealtracker

[English](README.md) | [Deutsch](README.de.md)

Mealtracker is a calorie tracker with a React interface and a Spring Boot REST API. Foods are stored with nutrition values per 100 g and can be combined into meals with individual serving amounts. The application calculates the calories for each meal.

## Technology

- Backend: Java 21, Spring Boot, Spring Data JPA, and Maven
- Database: MariaDB 11.4, with schema changes managed by Flyway
- Frontend: React 19 and Vite
- Mobile runtime: Capacitor for Android

## Prerequisites

- JDK 21
- Node.js and npm
- Docker Compose for the local MariaDB instance

## Run locally

1. Create a `.env` file in the repository root based on `.env.example` and set your own values for `DB_PASSWORD` and `DB_ROOT_PASSWORD`.
2. Start the database:

   ```sh
   docker compose up -d db
   ```

3. Start the API in a terminal:

   ```sh
   ./mvnw spring-boot:run
   ```

   On Windows, use `mvnw.cmd spring-boot:run`.

4. Install and start the frontend in another terminal:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

   Vite proxies `/api` requests to `http://127.0.0.1:8080`. The API is available at `http://localhost:8080` by default.

For the Android app, set `VITE_API_BASE_URL` to a backend address reachable from the device. See `.env.example` for an example.

## Tests and build

Run the backend tests:

```sh
./mvnw test
```

On Windows:

```powershell
.\mvnw.cmd test
```

Lint and build the frontend:

```sh
cd frontend
npm run lint
npm run build
```

The integration test uses Testcontainers and requires Docker.

## Documentation

The technical documentation is organized in [`docs/`](docs/README.md):

- [Development and setup](docs/development.md)
- [Architecture](docs/architecture.md)
- [REST API](docs/api.md)
- [Data model and migrations](docs/data-model.md)

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE).