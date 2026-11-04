# Development and setup

[English](development.md) | [Deutsch](de/development.md)

## Prerequisites

- JDK 21
- Node.js and npm
- Docker Compose

## Configure the database

Copy `.env.example` to `.env` in the repository root and replace the example passwords. `docker-compose.yml` starts MariaDB 11.4; port 3306 is bound to `127.0.0.1` only. The credentials must match the API's `DB_USER` and `DB_PASSWORD` environment variables. `DB_USER` defaults to `mealtracker`.

```sh
docker compose up -d db
```

The API reads optional values from `.env`. Override the JDBC URL with `DB_URL`; otherwise it uses `jdbc:mariadb://localhost:3306/mealtracker`.

## Start the applications

Backend:

```sh
./mvnw spring-boot:run
```

On Windows:

```powershell
.\mvnw.cmd spring-boot:run
```

Frontend, in a second terminal:

```sh
cd frontend
npm install
npm run dev
```

Vite's development server binds to `127.0.0.1` and proxies `/api` requests to `http://127.0.0.1:8080`. For native Capacitor builds, `VITE_API_BASE_URL` sets the API base URL; it must be reachable over the network from an Android device.

## Verify

```sh
./mvnw test
```

`MealBookingIntegrationTest` uses Testcontainers and requires a working Docker environment.

```sh
cd frontend
npm run lint
npm run build
```