# Entwicklung und Setup

[English](../development.md) | [Deutsch](development.md)

## Voraussetzungen

- JDK 21
- Node.js und npm
- Docker Compose

## Datenbank konfigurieren

Kopiere `.env.example` nach `.env` im Repository-Stamm und ersetze die Beispielpasswörter. `docker-compose.yml` startet MariaDB 11.4; der Port 3306 ist nur an `127.0.0.1` gebunden. Die Zugangsdaten müssen zu den Umgebungsvariablen `DB_USER` und `DB_PASSWORD` der API passen. Standardmäßig ist `DB_USER=mealtracker`.

```sh
docker compose up -d db
```

Die API liest optionale Werte aus `.env`. Die JDBC-URL kann mit `DB_URL` überschrieben werden; andernfalls wird `jdbc:mariadb://localhost:3306/mealtracker` verwendet.

## Anwendungen starten

Backend:

```sh
./mvnw spring-boot:run
```

Auf Windows:

```powershell
.\mvnw.cmd spring-boot:run
```

Frontend in einem zweiten Terminal:

```sh
cd frontend
npm install
npm run dev
```

Vites Entwicklungsserver bindet an `127.0.0.1` und leitet Anfragen unter `/api` an `http://127.0.0.1:8080` weiter. Für native Capacitor-Builds konfiguriert `VITE_API_BASE_URL` die Backend-Basisadresse; auf einem Android-Gerät muss sie über das Netzwerk erreichbar sein.

## Prüfen

```sh
./mvnw test
```

Der Test `MealBookingIntegrationTest` verwendet Testcontainers und setzt eine funktionierende Docker-Umgebung voraus.

```sh
cd frontend
npm run lint
npm run build
```