# Mealtracker

[English](README.md) | [Deutsch](README.de.md)

Mealtracker ist ein Kalorientracker mit einer React-Oberfläche und einer Spring-Boot-REST-API. Lebensmittel werden mit Nährwerten pro 100 g gepflegt und zu Mahlzeiten mit individuellen Mengen zusammengestellt. Die Anwendung berechnet daraus die Kalorien der Mahlzeiten.

## Technologie

- Backend: Java 21, Spring Boot, Spring Data JPA und Maven
- Datenbank: MariaDB 11.4; Schemaänderungen werden mit Flyway verwaltet
- Frontend: React 19 und Vite
- Mobile Laufzeit: Capacitor für Android

## Voraussetzungen

- JDK 21
- Node.js und npm
- Docker Compose für die lokale MariaDB

## Lokal starten

1. Lege im Repository-Stamm eine `.env`-Datei auf Basis von `.env.example` an und setze eigene Werte für `DB_PASSWORD` und `DB_ROOT_PASSWORD`.
2. Starte die Datenbank:

   ```sh
   docker compose up -d db
   ```

3. Starte die API in einem Terminal:

   ```sh
   ./mvnw spring-boot:run
   ```

   Unter Windows verwende `mvnw.cmd spring-boot:run`.

4. Installiere und starte das Frontend in einem weiteren Terminal:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

   Vite stellt `/api` lokal an `http://127.0.0.1:8080` weiter. Die API ist standardmäßig unter `http://localhost:8080` erreichbar.

Für die Android-App muss `VITE_API_BASE_URL` auf eine vom Gerät erreichbare Backend-Adresse zeigen. Ein Beispiel steht in `.env.example`.

## Tests und Build

Backend-Tests:

```sh
./mvnw test
```

Unter Windows:

```powershell
.\mvnw.cmd test
```

Frontend prüfen und bauen:

```sh
cd frontend
npm run lint
npm run build
```

Ein Integrationstest verwendet Testcontainers und benötigt Docker.

## Dokumentation

Die technische Dokumentation ist im Ordner [`docs/`](docs/de/README.md) gegliedert:

- [Entwicklung und Setup](docs/de/development.md)
- [Architektur](docs/de/architecture.md)
- [REST-API](docs/de/api.md)
- [Datenmodell und Migrationen](docs/de/data-model.md)

## Lizenz

Dieses Projekt steht unter der Apache License 2.0. Siehe [LICENSE](LICENSE).