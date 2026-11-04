# Architecture

[English](architecture.md) | [Deutsch](de/architecture.md)

## Overview

Mealtracker consists of a React application, a Spring Boot REST API, and MariaDB. The frontend communicates with JSON endpoints under `/api`; during Vite development, this path is proxied to the backend. Capacitor packages the same frontend for Android.

## Backend

The Java code is under `src/main/java/io/github/marcel_park/mealtracker` and is organized into layers:

- `controller`: HTTP routes for foods and meals
- `dto`: request and response records, plus input validation
- `service`: application logic and meal-value calculations
- `repository`: data access through Spring Data JPA
- `model`: JPA entities
- `exception`: consistent error responses and handling of missing resources
- `config`: infrastructure configuration, including CORS

Spring Boot starts the application through `MealtrackerApplication`. Hibernate validates the database schema, while Flyway manages its versions.

## Frontend

The UI entry point is `frontend/src/main.jsx`; the application interface and API calls are in `frontend/src/App.jsx`. Set the API base URL with `VITE_API_BASE_URL`. When it is empty, the frontend uses the same origin.

## Main flows

- Foods are searched and managed through `/api/foods`.
- Meals contain foods and amounts in grams. The backend calculates calories from the nutrition values and stores the booking time and items.
- Database relationships and deletion rules are defined in the Flyway migrations.